import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { constants } from 'node:os';
import { join } from 'node:path';
import { exits, signalExit } from '../contract/contract.ts';
import { bunArgs } from '../process/process.ts';
import { createDetachedProcess, type Detached } from '../process/windows.ts';

export type DaemonForm =
  | readonly ['--prepare-state', 'queue']
  | readonly ['--prepare-state', 'session', string]
  | readonly ['--daemon', ...string[]]
  | readonly ['--session-start', ...string[]];

export function daemonArgv(root: string, form: DaemonForm): [string, ...string[]] {
  return [process.execPath, ...bunArgs(join(root, 'engine', 'celetis'), ['daemon', ...form])];
}

export async function startDetached(
  file: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; log: string },
): Promise<Detached> {
  if (process.platform === 'win32') return createDetachedProcess(file, args, options);
  const out = openSync(options.log, 'a', 0o600);
  try {
    const child = spawn(file, args, {
      detached: true,
      stdio: ['ignore', out, out],
      env: options.env,
      cwd: options.cwd,
    });
    let code: number | null = null;
    child.once('exit', (exit, signal) => {
      code = exit ?? (signal ? signalExit(constants.signals[signal]) : exits.blocked);
    });
    await new Promise<void>((spawned, failed) => {
      child.once('spawn', spawned);
      child.once('error', failed);
    });
    child.unref();
    return { pid: child.pid as number, exitCode: () => code, inJob: false };
  } finally {
    closeSync(out);
  }
}
