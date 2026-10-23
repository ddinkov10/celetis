import { type ExecFileOptions, execFile, spawn } from 'node:child_process';
import { constants } from 'node:os';
import { delimiter } from 'node:path';

export const bunShebang =
  '#!/usr/bin/env -S BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros';

export function childEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...source,
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0',
    DO_NOT_TRACK: '1',
  };
  if (env.PATH) {
    env.PATH = env.PATH.split(delimiter)
      .filter((item) => !/node_modules\/\.bin\/*$/.test(item.replaceAll('\\', '/')))
      .join(delimiter);
  }
  return env;
}

function limitOutput(text: string, bytes: number): string {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(Buffer.from(text).subarray(0, bytes), {
    stream: true,
  });
}

export function run(
  file: string,
  args: string[],
  options: ExecFileOptions & { inheritedFd?: number; input?: string; stderr?: 'inherit' } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const maxBuffer = options.maxBuffer ?? 64 * 1024 * 1024;
  const env = childEnv(options.env);
  if (options.inheritedFd !== undefined) {
    return new Promise((resolve) => {
      const child = spawn(file, args, {
        cwd: options.cwd,
        env,
        stdio: ['ignore', 'pipe', options.stderr ?? 'pipe', options.inheritedFd],
      });
      let stdout = '';
      let stderr = '';
      let failure: Error | undefined;
      const full = new Set<string>();
      for (const [name, stream] of [
        ['stdout', child.stdout],
        ['stderr', child.stderr],
      ] as const) {
        stream?.setEncoding('utf8');
        stream?.on('data', (data: string) => {
          if (full.has(name)) return;
          const captured = name === 'stdout' ? stdout : stderr;
          const remaining = maxBuffer - Buffer.byteLength(captured);
          const overflow = Buffer.from(data).length > remaining;
          const chunk = overflow ? limitOutput(data, remaining) : data;
          if (name === 'stdout') stdout += chunk;
          else stderr += chunk;
          if (overflow) {
            full.add(name);
            if (!failure) {
              failure = new RangeError(`${name} maxBuffer length exceeded`);
              child.kill();
            }
          }
        });
      }
      child.once('error', (error) => {
        failure ??= error;
      });
      child.once('close', (code, signal) =>
        resolve({
          code: failure ? 1 : (code ?? (signal ? 128 + constants.signals[signal] : 1)),
          stdout,
          stderr: stderr || failure?.message || '',
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
      { ...options, env, encoding: 'utf8', maxBuffer, shell: false },
      (error, stdout, stderr) => {
        if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          stdout = limitOutput(stdout, maxBuffer);
          stderr = limitOutput(stderr, maxBuffer);
        }
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
  return ['--no-env-file', '--no-install', '--config=/dev/null', '--no-macros', entry, ...args];
}
