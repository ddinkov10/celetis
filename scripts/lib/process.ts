import { type ExecFileOptions, execFile } from 'node:child_process';
import { constants } from 'node:os';
import { delimiter } from 'node:path';

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

export function run(
  file: string,
  args: string[],
  options: ExecFileOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const maxBuffer = options.maxBuffer ?? 64 * 1024 * 1024;
  const env = childEnv(options.env);
  return new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { ...options, env, encoding: 'utf8', maxBuffer, shell: false },
      (error, stdout, stderr) => {
        if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          const limit = (text: string) =>
            new TextDecoder('utf-8', { ignoreBOM: true }).decode(Buffer.from(text).subarray(0, maxBuffer), {
              stream: true,
            });
          stdout = limit(stdout);
          stderr = limit(stderr);
        }
        const code =
          typeof error?.code === 'number' ? error.code : error?.signal ? 128 + constants.signals[error.signal] : 1;
        resolve({
          code: error ? code : 0,
          stdout,
          stderr: stderr || (error && typeof error.code !== 'number' ? error.message : ''),
        });
      },
    );
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
