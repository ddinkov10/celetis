import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../process/process.ts';

export const installArgs: readonly string[] = ['install', '--frozen-lockfile', '--production', '--ignore-scripts'];

export type DependencyInstall =
  | { kind: 'done' }
  | { kind: 'no-lock' }
  | { kind: 'failed'; status: number; output: string };

export async function installDependencies(checkout: string): Promise<DependencyInstall> {
  const engine = join(checkout, 'engine');
  if (!(await lstat(join(engine, 'bun.lock')).catch(() => null))?.isFile()) return { kind: 'no-lock' };
  const result = await run(process.execPath, [...installArgs], { cwd: engine, timeout: 120_000, env: process.env });
  return result.code === 0
    ? { kind: 'done' }
    : { kind: 'failed', status: result.code, output: result.stdout + result.stderr };
}
