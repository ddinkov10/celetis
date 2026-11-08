import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { exits } from './contract.ts';
import { daemonArgv } from './daemon-start.ts';
import { HostError } from './errors.ts';
import { childEnv } from './process.ts';

export type StatePreparation = { kind: 'queue' } | { kind: 'session'; issue: number };

const root = resolve(import.meta.dir, '../..');

export async function requestStatePreparation(main: string, request: StatePreparation): Promise<void> {
  if (
    request.kind !== 'queue' &&
    (request.kind !== 'session' || !Number.isSafeInteger(request.issue) || request.issue < 1)
  )
    throw new Error('state preparation: invalid request');
  const [file, ...args] = daemonArgv(
    root,
    request.kind === 'queue' ? ['--prepare-state', 'queue'] : ['--prepare-state', 'session', String(request.issue)],
  );
  await new Promise<void>((resolve, reject) => {
    let drain: ReturnType<typeof setTimeout> | undefined;
    const child = execFile(
      file,
      args,
      {
        cwd: main,
        env: childEnv(),
        timeout: 30_000,
      },
      (error, stdout, stderr) => {
        clearTimeout(drain);
        if (error)
          reject(
            new HostError(
              stderr.trim() || `state preparation: ${request.kind} preparation failed: ${error.message}`,
              exits.blocked,
            ),
          );
        else if (stdout) reject(new HostError('state preparation: unexpected preparation output', exits.blocked));
        else resolve();
      },
    );
    // A descendant that inherits the pipes holds the close after the exit; the drain keeps the last stderr text.
    child.once('exit', (code, signal) => {
      if (code === 0 && !signal) return;
      drain = setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
      }, 250);
    });
  });
}
