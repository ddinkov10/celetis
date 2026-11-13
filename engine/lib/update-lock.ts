import { dlopen, FFIType, ptr, read } from 'bun:ffi';
import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Host } from './config-core.ts';
import { exits, signalExit } from './contract.ts';
import { HostError } from './errors.ts';
import { codexHome, configHome } from './homes.ts';
import { childEnv } from './process.ts';
import { containProcess, type Job, lockFile } from './windows.ts';

const errnoName = process.platform === 'darwin' ? '__error' : '__errno_location';
const architecture = process.arch === 'arm64' ? 'aarch64' : process.arch === 'x64' ? 'x86_64' : process.arch;
const libraries =
  process.platform === 'darwin'
    ? ['/usr/lib/libSystem.B.dylib']
    : ['libc.so.6', `libc.musl-${architecture}.so.1`, `/lib/ld-musl-${architecture}.so.1`];

function binding() {
  for (const library of libraries) {
    try {
      return dlopen(library, {
        flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
        execve: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        [errnoName]: { args: [], returns: FFIType.ptr },
      });
    } catch {}
  }
  throw new HostError('update: cannot load the system flock library', exits.prerequisite);
}

let native: ReturnType<typeof binding> | undefined;

export function spawnConsumer(file: string, argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const signals = ['SIGINT', 'SIGBREAK'] as const;
  const hold = () => {};
  for (const signal of signals) process.on(signal, hold);
  return new Promise<number>((resolve, reject) => {
    const failed = (error: Error) =>
      reject(new HostError(`celetis: cannot start ${file}: ${error.message}`, exits.blocked));
    let child: ChildProcess;
    try {
      child = spawn(file, argv.slice(1), { stdio: 'inherit', env });
    } catch (error) {
      failed(error as Error);
      return;
    }
    child.once('error', failed);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 128 + constants.signals[signal] : 1)));
  }).finally(() => {
    for (const signal of signals) process.off(signal, hold);
  });
}

export async function execConsumer(file: string, argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  if (process.platform === 'win32') return spawnConsumer(file, argv, env);
  native ??= binding();
  const api = native;
  const entries = Object.entries(env)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => `${key}=${value}`);
  const values = [file, ...argv, ...entries];
  if (values.some((value) => value.includes('\0')))
    throw new HostError('celetis: process replacement arguments contain NUL', exits.internal);
  const buffers = values.map((value) => Buffer.from(`${value}\0`));
  const args = new BigUint64Array(argv.length + 1);
  const variables = new BigUint64Array(entries.length + 1);
  for (let at = 0; at < argv.length; at++) args[at] = BigInt(ptr(buffers[at + 1] as Buffer));
  for (let at = 0; at < entries.length; at++) variables[at] = BigInt(ptr(buffers[at + 1 + argv.length] as Buffer));
  api.symbols.execve(ptr(buffers[0] as Buffer), ptr(args), ptr(variables));
  const pointer = api.symbols[errnoName]?.();
  throw new HostError(
    `celetis: process replacement failed for ${file} (errno ${pointer ? read.i32(pointer) : 'unknown'})`,
    exits.blocked,
  );
}

export function tryFlock(fd: number, shared = false): boolean {
  if (process.platform === 'win32') return lockFile(fd, shared);
  native ??= binding();
  const api = native;
  if (api.symbols.flock(fd, (shared ? 1 : 2) | 4) === 0) return true;
  const errorPointer = api.symbols[errnoName]?.();
  if (!errorPointer) throw new HostError('update: cannot read flock errno', exits.blocked);
  const errno = read.i32(errorPointer);
  if ([constants.errno.EWOULDBLOCK, constants.errno.EAGAIN, constants.errno.EINTR].includes(errno)) return false;
  throw new HostError(`update: cannot acquire the plugin update lock (errno ${errno})`, exits.blocked);
}

export async function withPluginRead<T>(host: Host, inspect: () => Promise<T>): Promise<T> {
  if (host === 'opencode') return inspect();
  const home = host === 'codex' ? await codexHome() : configHome(host);
  await mkdir(home, { recursive: true });
  const fd = openSync(join(home, 'celetis-update.lock'), 'a+', 0o600);
  const deadline = performance.now() + 120_000;
  try {
    while (!tryFlock(fd, true)) {
      if (performance.now() >= deadline)
        throw new HostError(
          'celetis: an update still holds the installation; retry this start after it finishes',
          exits.prerequisite,
        );
      await Bun.sleep(50);
    }
    return await inspect();
  } finally {
    closeSync(fd);
  }
}

interface Clock {
  now(): number;
  sleep(ms: number): Promise<unknown>;
}

let childObserver: ((pid: number, active: boolean) => void) | undefined;

export function observeUpdateChildren(observer: (pid: number, active: boolean) => void): () => void {
  if (childObserver) throw new HostError('update: another child observer is active', exits.internal);
  childObserver = observer;
  return () => {
    if (childObserver === observer) childObserver = undefined;
  };
}

export class UpdateLock {
  private child?: ChildProcess;
  private job?: Job | null;
  private interrupted?: NodeJS.Signals;
  private phase = 'wait for the plugin update lock';
  private readonly handlers = new Map<NodeJS.Signals, () => void>();
  private readonly deadline: number;

  private constructor(
    private readonly fd: number,
    private readonly callerPid: number,
    private readonly timeoutMs: number,
    private readonly clock: Clock,
  ) {
    this.deadline = clock.now() + timeoutMs;
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const handler = () => {
        this.interrupted = signal;
      };
      this.handlers.set(signal, handler);
      process.on(signal, handler);
    }
  }

  static async acquire(
    path: string,
    callerPid: number,
    options: { timeoutMs?: number; clock?: Clock; refuseBusy?: boolean } = {},
  ): Promise<UpdateLock> {
    const lock = new UpdateLock(
      openSync(path, 'a+', 0o600),
      callerPid,
      options.timeoutMs ?? 120_000,
      options.clock ?? { now: () => performance.now(), sleep: (ms) => Bun.sleep(ms) },
    );
    try {
      while (!tryFlock(lock.fd)) {
        if (options.refuseBusy)
          throw new HostError(
            'update: installation discovery or another update holds this installation; try again after it finishes. This attempt is consumed and was not queued',
            exits.prerequisite,
          );
        lock.check();
        await lock.clock.sleep(50);
      }
      lock.check();
      return lock;
    } catch (error) {
      await lock.close();
      throw error;
    }
  }

  private check() {
    if (this.interrupted)
      throw new HostError(
        `update: interrupted by ${this.interrupted} during ${this.phase}`,
        signalExit(constants.signals[this.interrupted]),
      );
    try {
      process.kill(this.callerPid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM')
        throw new HostError(`update: the calling process exited during ${this.phase}`, exits.blocked);
    }
    if (this.clock.now() >= this.deadline)
      throw new HostError(
        `update: timed out after ${this.timeoutMs / 1000} seconds during ${this.phase}`,
        exits.blocked,
      );
  }

  private async stopChild() {
    const child = this.child;
    if (!child) return;
    if (!child.pid) {
      this.child = undefined;
      return;
    }
    if (process.platform === 'win32') {
      this.job?.terminate();
      this.job?.close();
      this.job = undefined;
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
        await Bun.sleep(1000);
      } catch {}
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }
    if (child.exitCode === null && child.signalCode === null)
      await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    childObserver?.(child.pid, false);
    this.child = undefined;
  }

  async run(
    file: string,
    args: string[],
    options: { cwd?: string | URL; env?: NodeJS.ProcessEnv } = {},
  ): Promise<string> {
    this.phase = [file, ...args].join(' ');
    this.check();
    const temp = await mkdtemp(join(tmpdir(), 'celetis-update.'));
    const stdoutPath = join(temp, 'stdout');
    const stderrPath = join(temp, 'stderr');
    const stdout = openSync(stdoutPath, 'w+', 0o600);
    const stderr = openSync(stderrPath, 'w+', 0o600);
    let failure: unknown;
    try {
      const source = options.env ?? process.env;
      const child =
        process.platform === 'win32'
          ? spawn(file, args, {
              ...options,
              env: childEnv(source),
              detached: false,
              windowsHide: true,
              stdio: ['ignore', stdout, stderr],
            })
          : spawn(file, args, {
              ...options,
              env: childEnv({ ...source, CELETIS_UPDATE_FD: '3' }),
              detached: true,
              stdio: ['ignore', stdout, stderr, this.fd],
            });
      this.child = child;
      if (child.pid) childObserver?.(child.pid, true);
      let status: number | undefined;
      child.once('error', (error) => {
        failure = error;
        status = 127;
      });
      child.once('exit', (code, signal) => {
        status = code ?? (signal ? 128 + constants.signals[signal] : 1);
      });
      if (process.platform === 'win32' && child.pid) {
        try {
          this.job = containProcess(child.pid);
        } catch (error) {
          child.kill();
          throw new HostError(
            `update: ${this.phase} failed: ${error instanceof Error ? error.message : String(error)}`,
            exits.blocked,
          );
        }
      }
      while (status === undefined) {
        this.check();
        await this.clock.sleep(50);
      }
      this.check();
      if (status !== 0) throw new HostError(`update: ${this.phase} failed (exit ${status})`, exits.blocked);
    } catch (error) {
      failure = error;
    } finally {
      await this.stopChild();
      closeSync(stdout);
      closeSync(stderr);
    }
    try {
      const output = await readFile(stdoutPath, 'utf8');
      if (failure) {
        const diagnostic = await readFile(stderrPath, 'utf8');
        throw new HostError(
          [failure instanceof Error ? failure.message : String(failure), diagnostic.trimEnd(), output.trimEnd()]
            .filter(Boolean)
            .join('\n'),
          failure instanceof HostError ? failure.code : exits.blocked,
        );
      }
      return output;
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }

  async close(): Promise<void> {
    await this.stopChild();
    for (const [signal, handler] of this.handlers) process.off(signal, handler);
    closeSync(this.fd);
  }
}
