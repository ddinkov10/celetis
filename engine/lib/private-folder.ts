import type { Stats } from 'node:fs';
import { lstat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const privateRoot =
  process.platform === 'win32' ? join(tmpdir(), 'celetis') : `/tmp/celetis-${process.getuid?.()}`;

export function privateMode(stat: { uid: number; mode: number }): boolean {
  return process.platform === 'win32' || (stat.uid === process.getuid?.() && (stat.mode & 0o077) === 0);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function privateFolder(path: string, fail: (path: string, reason: string) => Error): Promise<void> {
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw fail(path, message(error));
  }
  let stat: Stats;
  try {
    stat = await lstat(path);
  } catch (error) {
    throw fail(path, message(error));
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || !privateMode(stat))
    throw fail(path, 'need a private directory owned by the current user (mode 0700)');
}
