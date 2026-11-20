import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../process/process.ts';

export type InstallKind = 'user' | 'development';

export const installArgs: Readonly<Record<InstallKind, readonly string[]>> = {
  user: ['install', '--frozen-lockfile', '--production', '--ignore-scripts'],
  development: ['install', '--frozen-lockfile', '--ignore-scripts'],
};

export type DependencyInstall =
  | { kind: 'done' }
  | { kind: 'no-lock' }
  | { kind: 'failed'; status: number; output: string };

export async function installDependencies(checkout: string, kind: InstallKind): Promise<DependencyInstall> {
  const engine = join(checkout, 'engine');
  if (!(await lstat(join(engine, 'bun.lock')).catch(() => null))?.isFile()) return { kind: 'no-lock' };
  const result = await run(process.execPath, [...installArgs[kind]], {
    cwd: engine,
    timeout: 120_000,
    env: process.env,
  });
  return result.code === 0
    ? { kind: 'done' }
    : { kind: 'failed', status: result.code, output: result.stdout + result.stderr };
}
