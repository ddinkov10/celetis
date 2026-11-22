import { type ExecFileOptions, execFile, spawn } from 'node:child_process';
import { fstatSync } from 'node:fs';
import { constants, devNull } from 'node:os';
import { delimiter } from 'node:path';

export const bunShebang =
  '#!/usr/bin/env -S BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros';

export const engineEntry = `${bunShebang}\nimport { main } from './launcher.ts';\n\nprocess.exitCode = await main(process.argv.slice(2));\n`;

export function updateDescriptor(): number | undefined {
  const fd = Number(process.env.CELETIS_UPDATE_FD);
  if (!Number.isInteger(fd) || fd < 3) return undefined;
  try {
    return fstatSync(fd).isFile() ? fd : undefined;
  } catch {
    return undefined;
  }
}

export function childEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...source,
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0',
    DO_NOT_TRACK: '1',
  };
  const variants =
    process.platform === 'win32' ? Object.keys(env).filter((key) => /^path$/i.test(key) && key !== 'PATH') : [];
  if (variants.length) {
    if (env.PATH === undefined) env.PATH = env[variants[0] as string];
    for (const key of variants) delete env[key];
  }
  if (env.PATH) {
    env.PATH = env.PATH.split(delimiter)
      .filter((item) => !/node_modules\/\.bin\/*$/.test(item.replaceAll('\\', '/')))
      .join(delimiter);
  }
  return env;
}

// latin1 keeps each byte of a binary output as one character.
function decode(output: Buffer, bytes: number, latin1: boolean): string {
  const kept = output.subarray(0, bytes);
  return latin1
    ? kept.toString('latin1')
    : new TextDecoder('utf-8', { ignoreBOM: true }).decode(kept, { stream: true });
}

export function run(
  file: string,
  args: string[],
  options: ExecFileOptions & {
    inheritedFd?: number;
    input?: string | Uint8Array;
    bytes?: boolean;
    stderr?: 'inherit';
  } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const maxBuffer = options.maxBuffer ?? 64 * 1024 * 1024;
  options = { ...options, inheritedFd: options.inheritedFd ?? updateDescriptor() };
  const env = childEnv(options.env);
  const latin1 = options.bytes === true;
  if (options.inheritedFd !== undefined) {
    return new Promise((resolve) => {
      const child = spawn(file, args, {
        cwd: options.cwd,
        env,
        stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', options.stderr ?? 'pipe', options.inheritedFd],
      });
      const output = { stdout: [] as Buffer[], stderr: [] as Buffer[] };
      const sizes = { stdout: 0, stderr: 0 };
      let failure: Error | undefined;
      const full = new Set<string>();
      for (const [name, stream] of [
        ['stdout', child.stdout],
        ['stderr', child.stderr],
      ] as const) {
        stream?.on('data', (data: Buffer) => {
          if (full.has(name)) return;
          const remaining = maxBuffer - sizes[name];
          const overflow = data.length > remaining;
          const chunk = overflow ? data.subarray(0, remaining) : data;
          output[name].push(chunk);
          sizes[name] += chunk.length;
          if (overflow) {
            full.add(name);
            if (!failure) {
              failure = new RangeError(`${name} maxBuffer length exceeded`);
              child.kill();
            }
          }
        });
      }
      child.stdin?.end(options.input);
      child.once('error', (error) => {
        failure ??= error;
      });
      child.once('close', (code, signal) =>
        resolve({
          code: failure ? 1 : (code ?? (signal ? 128 + constants.signals[signal] : 1)),
          stdout: decode(Buffer.concat(output.stdout), maxBuffer, latin1),
          stderr: decode(Buffer.concat(output.stderr), maxBuffer, false) || failure?.message || '',
        }),
      );
      child.once('exit', (code, signal) => {
        if (code !== 0 || signal) {
          child.stdout?.destroy();
          child.stderr?.destroy();
        }
      });
    });
  }
  return new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { ...options, env, encoding: 'buffer', maxBuffer, shell: false },
      (error, out, err) => {
        const stdout = decode(out, maxBuffer, latin1);
        const stderr = decode(err, maxBuffer, false);
        const code =
          typeof error?.code === 'number' ? error.code : error?.signal ? 128 + constants.signals[error.signal] : 1;
        resolve({
          code: error ? code : 0,
          stdout,
          stderr:
            stderr || (error && typeof error.code !== 'number' && error.code !== 'ABORT_ERR' ? error.message : ''),
        });
      },
    );
    child.stdin?.end(options.input);
    child.once('exit', (code, signal) => {
      if (code !== 0 || signal) {
        child.stdout?.destroy();
        child.stderr?.destroy();
      }
    });
  });
}

export function bunArgs(entry: string, args: string[]): string[] {
  return ['--no-env-file', '--no-install', `--config=${devNull}`, '--no-macros', entry, ...args];
}

export function streamBun(file: string, args: string[], cwd: string, signal: AbortSignal): Promise<number> {
  if (signal.aborted) return Promise.resolve(143);
  return new Promise<number>((resolveCode) => {
    const child = spawn(process.execPath, bunArgs(file, args), {
      cwd,
      env: childEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let kill: ReturnType<typeof setTimeout> | undefined;
    // A suite that handles SIGTERM must not hold the stop of the daemon past its 60 seconds.
    const stop = () => {
      child.kill('SIGTERM');
      kill = setTimeout(() => child.kill('SIGKILL'), 10_000);
    };
    signal.addEventListener('abort', stop, { once: true });
    let failed = false;
    let done = false;
    let ended = false;
    let pending = 0;
    let status: number | null = null;
    let name: NodeJS.Signals | null = null;
    let drain: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (ended || !done || pending) return;
      ended = true;
      clearTimeout(drain);
      clearTimeout(kill);
      signal.removeEventListener('abort', stop);
      child.stdout.destroy();
      child.stderr.destroy();
      resolveCode(signal.aborted ? 143 : failed ? 1 : (status ?? (name ? 128 + constants.signals[name] : 1)));
    };
    // On Bun, console.log and console.error do not wait behind a queued write, so the end waits for each callback.
    const forward = (target: NodeJS.WriteStream) => (chunk: Buffer) => {
      pending++;
      target.write(chunk, () => {
        pending--;
        settle();
      });
    };
    child.stdout.on('data', forward(process.stdout));
    child.stderr.on('data', forward(process.stderr));
    child.once('error', (error) => {
      failed = true;
      console.error(error.message);
    });
    const finish = (code: number | null, signalName: NodeJS.Signals | null) => {
      status = code;
      name = signalName;
      done = true;
      settle();
    };
    // A descendant of the suite can hold a pipe open after the suite exits, and close waits for that descendant.
    child.once('exit', (code, signalName) => {
      clearTimeout(kill);
      drain = setTimeout(() => finish(code, signalName), 1_000);
    });
    child.once('close', finish);
  });
}

export function runBun(file: string, args: string[], cwd: string): Promise<number> {
  return new Promise<number>((resolveCode) => {
    const child = spawn(process.execPath, bunArgs(file, args), { cwd, env: childEnv(), stdio: 'inherit' });
    const handlers = new Map<NodeJS.Signals, () => void>();
    let interrupted = 0;
    for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
      const handler = () => {
        interrupted = 128 + constants.signals[signal];
        child.kill(signal);
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    let failed = false;
    child.once('error', (error) => {
      failed = true;
      console.error(error.message);
    });
    child.once('close', (status, signal) => {
      for (const [name, handler] of handlers) process.off(name, handler);
      resolveCode(interrupted || (failed ? 1 : (status ?? (signal ? 128 + constants.signals[signal] : 1))));
    });
  });
}
