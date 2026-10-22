import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { constants } from 'node:os';
import { childEnv } from '../../scripts/lib/process.ts';

export class ManualInterrupted extends Error {
  constructor(readonly status: number) {
    super('manual check interrupted');
  }
}

export function manualEnvironment(): NodeJS.ProcessEnv {
  const env = childEnv(process.env);
  env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS = '1';
  for (const name of [
    'AI_AGENT',
    'CLAUDECODE',
    'CLAUDE_CODE_CHILD_SESSION',
    'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_CODE_EXECPATH',
    'CLAUDE_CODE_MESSAGING_SOCKET',
    'CLAUDE_CODE_MESSAGING_TOKEN',
    'CLAUDE_CODE_SESSION_ATTENDED',
    'CLAUDE_CODE_SESSION_ID',
    'CLAUDE_EFFORT',
    'CLAUDE_PID',
  ])
    delete env[name];
  return env;
}
export function manualClients(env: NodeJS.ProcessEnv) {
  const active = new Set<ChildProcessWithoutNullStreams>();
  let interrupted = 0;
  const cancel = (signal: 'SIGINT' | 'SIGTERM') => {
    interrupted = 128 + constants.signals[signal];
    for (const child of active) child.kill('SIGTERM');
  };
  const interrupt = () => cancel('SIGINT');
  const terminate = () => cancel('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  return {
    run(
      file: string,
      args: string[],
      options: {
        cwd: string;
        input?: string;
        protocol?: { messages: unknown[]; validate(rows: unknown[], result: unknown): void };
      },
    ): Promise<{ code: number; stdout: string; stderr: string }> {
      if (interrupted) throw new ManualInterrupted(interrupted);
      return new Promise((resolve, reject) => {
        const child = spawn(file, args, { cwd: options.cwd, env, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
        active.add(child);
        let stdout = '',
          stderr = '',
          buffer = '',
          failure = '',
          results = 0,
          closed = false;
        let launchFailure: NodeJS.ErrnoException | undefined;
        const rows: unknown[] = [];
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => stop('CLI protocol deadline exceeded'), 300_000);
        };
        const stop = (message: string) => {
          if (failure) return;
          failure = message;
          child.stdin.end();
          child.kill('SIGTERM');
        };
        const send = (value: unknown) => {
          child.stdin.write(`${JSON.stringify(value)}\n`);
        };
        child.stdin.on('error', (error) => {
          if (!closed && !failure) stop(`cannot write SDKUserMessage: ${error.message}`);
        });
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          stdout += chunk;
          if (!options.protocol || failure) return;
          buffer += chunk;
          while (buffer.includes('\n')) {
            const at = buffer.indexOf('\n'),
              line = buffer.slice(0, at);
            buffer = buffer.slice(at + 1);
            if (!line) continue;
            try {
              const row = JSON.parse(line);
              rows.push(row);
              if (row.type !== 'result') continue;
              results++;
              if (row.is_error || row.subtype !== 'success') throw new Error('CLI turn failed');
              if (results === 1) {
                options.protocol.validate(rows, row);
                send(options.protocol.messages[1]);
                deadline();
              } else if (results === 2) {
                child.stdin.end();
                closed = true;
              } else throw new Error('unexpected extra result');
            } catch (error) {
              stop(error instanceof Error ? error.message : String(error));
              break;
            }
          }
        });
        child.stderr.on('data', (chunk: string) => {
          stderr += chunk;
        });
        child.on('error', (error) => {
          launchFailure = error;
          failure = error.message;
        });
        child.on('close', (code, signal) => {
          active.delete(child);
          if (timer) clearTimeout(timer);
          if (interrupted) {
            reject(new ManualInterrupted(interrupted));
            return;
          }
          const status = launchFailure
            ? launchFailure.code === 'ENOENT'
              ? 127
              : launchFailure.code === 'EACCES'
                ? 126
                : 1
            : (code ?? (signal ? 128 + constants.signals[signal] : 1));
          if (options.protocol) {
            if (!failure && results !== 2) failure = 'expected two completed results';
            stderr += `CLI client exit: ${status}; completed results: ${results}\n`;
          }
          if (failure) stderr += `${failure}\n`;
          resolve({ code: launchFailure ? status : failure ? 2 : status, stdout, stderr });
        });
        if (options.protocol) {
          send(options.protocol.messages[0]);
          deadline();
        } else child.stdin.end(options.input ?? '');
      });
    },
    close() {
      for (const child of active) child.kill('SIGTERM');
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
    },
  };
}
