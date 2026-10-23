import { dlopen, FFIType, ptr, read } from 'bun:ffi';
import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, fstatSync, openSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Host, HostError } from './host.ts';
import { codexHome, configHome } from './plugin-metadata.ts';
import { childEnv } from './process.ts';

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
        fcntl: { args: [FFIType.i32, FFIType.i32, FFIType.i32], returns: FFIType.i32 },
        execve: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        [errnoName]: { args: [], returns: FFIType.ptr },
      });
    } catch {}
  }
  throw new HostError('plugin-update: cannot load the system flock library');
}

const native = binding();

export function execConsumer(file: string, argv: string[], env: NodeJS.ProcessEnv): never {
  const entries = Object.entries(env)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => `${key}=${value}`);
  const values = [file, ...argv, ...entries];
  if (values.some((value) => value.includes('\0')))
    throw new HostError('celetis: process replacement arguments contain NUL');
  const buffers = values.map((value) => Buffer.from(`${value}\0`));
  const args = new BigUint64Array(argv.length + 1);
  const variables = new BigUint64Array(entries.length + 1);
  for (let at = 0; at < argv.length; at++) args[at] = BigInt(ptr(buffers[at + 1] as Buffer));
  for (let at = 0; at < entries.length; at++) variables[at] = BigInt(ptr(buffers[at + 1 + argv.length] as Buffer));
  native.symbols.execve(ptr(buffers[0] as Buffer), ptr(args), ptr(variables));
  const pointer = native.symbols[errnoName]?.();
  throw new HostError(
    `celetis: process replacement failed for ${file} (errno ${pointer ? read.i32(pointer) : 'unknown'})`,
  );
}

export function tryFlock(fd: number, shared = false): boolean {
  if (native.symbols.flock(fd, (shared ? 1 : 2) | 4) === 0) return true;
  const errorPointer = native.symbols[errnoName]?.();
  if (!errorPointer) throw new HostError('plugin-update: cannot read flock errno');
  const errno = read.i32(errorPointer);
  if ([constants.errno.EWOULDBLOCK, constants.errno.EAGAIN, constants.errno.EINTR].includes(errno)) return false;
  throw new HostError(`plugin-update: cannot acquire the plugin update lock (errno ${errno})`);
}

export class ConsumerLock {
  private constructor(readonly fd: number) {}

  static async acquire(host: Host): Promise<ConsumerLock> {
    const home = host === 'codex' ? await codexHome() : configHome(host);
    await mkdir(home, { recursive: true });
    const path = join(home, 'celetis-update.lock');
    let fd: number | undefined;
    const inherited = Number(process.env.CELETIS_CONSUMER_FD);
    if (Number.isInteger(inherited) && inherited >= 3) {
      try {
        const expected = statSync(path),
          current = fstatSync(inherited);
        if (expected.dev === current.dev && expected.ino === current.ino) fd = inherited;
      } catch {}
    }
    fd ??= openSync(path, 'a', 0o600);
    const deadline = performance.now() + 120_000;
    try {
      while (!tryFlock(fd, true)) {
        if (performance.now() >= deadline)
          throw new HostError('celetis: an update still holds the installation; retry this start after it finishes');
        await Bun.sleep(50);
      }
      if (native.symbols.fcntl(fd, 2, 0) !== 0)
        throw new HostError('celetis: cannot retain consumer protection across process replacement');
      process.env.CELETIS_CONSUMER_FD = String(fd);
      return new ConsumerLock(fd);
    } catch (error) {
      closeSync(fd);
      throw error;
    }
  }

  static retainInherited(): void {
    const fd = Number(process.env.CELETIS_CONSUMER_FD);
    if (!Number.isInteger(fd) || fd < 3) return;
    if (native.symbols.fcntl(fd, 2, 0) !== 0)
      throw new HostError('celetis: cannot retain the inherited consumer descriptor');
  }

  static releaseForUpdate(home: string): void {
    const fd = Number(process.env.CELETIS_CONSUMER_FD);
    if (!Number.isInteger(fd) || fd < 3) return;
    try {
      const current = fstatSync(fd);
      const expected = statSync(join(home, 'celetis-update.lock'));
      if (current.dev !== expected.dev || current.ino !== expected.ino)
        throw new HostError('plugin-update: inherited consumer protection belongs to another installation');
      closeSync(fd);
      delete process.env.CELETIS_CONSUMER_FD;
    } catch (error) {
      if (error instanceof HostError) throw error;
    }
  }

  close(): void {
    closeSync(this.fd);
    if (process.env.CELETIS_CONSUMER_FD === String(this.fd)) delete process.env.CELETIS_CONSUMER_FD;
  }
}

interface Clock {
  now(): number;
  sleep(ms: number): Promise<unknown>;
}

export class UpdateLock {
  private child?: ChildProcess;
  private interrupted?: string;
  private phase = 'wait for the plugin update lock';
  private readonly handlers = new Map<NodeJS.Signals, () => void>();
  private readonly deadline: number;

  private constructor(
    private readonly fd: number,
    private readonly runnerPid: number,
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
    runnerPid: number,
    options: { timeoutMs?: number; clock?: Clock; refuseBusy?: boolean } = {},
  ): Promise<UpdateLock> {
    const lock = new UpdateLock(
      openSync(path, 'a', 0o600),
      runnerPid,
      options.timeoutMs ?? 120_000,
      options.clock ?? { now: () => performance.now(), sleep: (ms) => Bun.sleep(ms) },
    );
    try {
      while (!tryFlock(lock.fd)) {
        if (options.refuseBusy)
          throw new HostError(
            'plugin-update: an active package consumer or another update holds this installation; stop affected consumers before a new decision. This attempt is consumed and was not queued',
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
    if (this.interrupted) throw new HostError(`plugin-update: interrupted by ${this.interrupted} during ${this.phase}`);
    try {
      process.kill(this.runnerPid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM')
        throw new HostError(`plugin-update: the runner exited during ${this.phase}`);
    }
    if (this.clock.now() >= this.deadline)
      throw new HostError(`plugin-update: timed out after ${this.timeoutMs / 1000} seconds during ${this.phase}`);
  }

  private async stopChild() {
    const child = this.child;
    if (!child) return;
    if (!child.pid) {
      this.child = undefined;
      return;
    }
    if (child.pid) {
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
      const child = spawn(file, args, {
        ...options,
        env: childEnv({ ...(options.env ?? process.env), CELETIS_UPDATE_FD: '3' }),
        detached: true,
        stdio: ['ignore', stdout, stderr, this.fd],
      });
      this.child = child;
      let status: number | undefined;
      child.once('error', (error) => {
        failure = error;
        status = 127;
      });
      child.once('exit', (code, signal) => {
        status = code ?? (signal ? 128 + constants.signals[signal] : 1);
      });
      while (status === undefined) {
        this.check();
        await this.clock.sleep(50);
      }
      this.check();
      if (status !== 0) throw new HostError(`plugin-update: ${this.phase} failed (exit ${status})`);
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
