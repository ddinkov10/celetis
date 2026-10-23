import { dlopen, FFIType, read } from 'bun:ffi';
import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import { HostError } from './host.ts';
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
        [errnoName]: { args: [], returns: FFIType.ptr },
      });
    } catch {}
  }
  throw new HostError('plugin-update: cannot load the system flock library');
}

const native = binding();

export function tryFlock(fd: number): boolean {
  if (native.symbols.flock(fd, 2 | 4) === 0) return true;
  const errorPointer = native.symbols[errnoName]?.();
  if (!errorPointer) throw new HostError('plugin-update: cannot read flock errno');
  const errno = read.i32(errorPointer);
  if ([constants.errno.EWOULDBLOCK, constants.errno.EAGAIN, constants.errno.EINTR].includes(errno)) return false;
  throw new HostError(`plugin-update: cannot acquire the plugin update lock (errno ${errno})`);
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
    options: { timeoutMs?: number; clock?: Clock } = {},
  ): Promise<UpdateLock> {
    const lock = new UpdateLock(
      openSync(path, 'a', 0o600),
      runnerPid,
      options.timeoutMs ?? 120_000,
      options.clock ?? { now: () => performance.now(), sleep: (ms) => Bun.sleep(ms) },
    );
    try {
      while (!tryFlock(lock.fd)) {
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

  async run(file: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<string> {
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
        env: childEnv(options.env),
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
