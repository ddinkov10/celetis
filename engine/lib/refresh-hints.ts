import { randomUUID } from 'node:crypto';
import { lstat, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { commonDir } from './host.ts';
import { checkFolder, ensureFolder, repositoryState } from './state.ts';

function issueNumber(name: string): number | null {
  const match = /^([1-9][0-9]*)\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.exec(name);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) ? number : null;
}

export async function readRefreshHints(common: string): Promise<ReadonlyMap<string, number> | null> {
  let folder: string;
  let names: string[];
  try {
    const layout = await repositoryState(common);
    checkFolder(layout.root);
    checkFolder(layout.refresh);
    folder = layout.refresh.path;
    names = await readdir(folder);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? new Map() : null;
  }
  const hints = new Map<string, number>();
  for (const name of names) {
    const number = issueNumber(name);
    if (number === null) continue;
    try {
      if ((await lstat(join(folder, name))).isFile()) hints.set(name, number);
    } catch {}
  }
  return hints;
}

export async function writeRefreshHint(cwd: string, number: number): Promise<void> {
  try {
    if (!Number.isSafeInteger(number) || number < 1) return;
    const layout = await repositoryState(await commonDir(cwd));
    ensureFolder(layout.root);
    ensureFolder(layout.refresh);
    const folder = layout.refresh.path;
    await writeFile(join(folder, `${number}.${randomUUID()}`), '', { flag: 'wx', mode: 0o600 });
    const cutoff = Date.now() - 300_000;
    for (const name of await readdir(folder)) {
      if (issueNumber(name) === null) continue;
      try {
        const path = join(folder, name);
        const file = await lstat(path);
        if (file.isFile() && file.mtimeMs < cutoff) await unlink(path);
      } catch {}
    }
  } catch {}
}
