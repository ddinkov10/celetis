import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { exits } from './contract.ts';
import { HostError } from './host.ts';
import { bunArgs, childEnv } from './process.ts';
import { daemonScript } from './process-identity.ts';

export type StatePreparation = { kind: 'queue' } | { kind: 'session'; issue: number };

export async function requestStatePreparation(main: string, request: StatePreparation): Promise<void> {
  if (
    request.kind !== 'queue' &&
    (request.kind !== 'session' || !Number.isSafeInteger(request.issue) || request.issue < 1)
  )
    throw new Error('state preparation: invalid request');
  const args = request.kind === 'queue' ? ['queue'] : ['session', String(request.issue)];
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      bunArgs(join(import.meta.dir, '..', daemonScript), ['--prepare-state', ...args]),
      {
        cwd: main,
        env: childEnv(),
        timeout: 30_000,
      },
      (error, stdout, stderr) => {
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
  });
}
