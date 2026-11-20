import { randomUUID } from 'node:crypto';
import { lstat, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { commonDir } from '../process/git.ts';
import { checkFolder, ensureFolder, repositoryLayout } from '../state/state.ts';
import { type IssueKey, isKey, keySource, parseKey } from './key.ts';

function hintKey(name: string): IssueKey | null {
  const match = new RegExp(
    `^(${keySource()})\\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
  ).exec(name);
  return match ? parseKey(match[1] as string) : null;
}

export async function readRefreshHints(common: string): Promise<ReadonlyMap<string, IssueKey> | null> {
  let folder: string;
  let names: string[];
  try {
    const layout = repositoryLayout(common);
    checkFolder(layout.root);
    checkFolder(layout.refresh);
    folder = layout.refresh.path;
    names = await readdir(folder);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? new Map() : null;
  }
  const hints = new Map<string, IssueKey>();
  for (const name of names) {
    const key = hintKey(name);
    if (key === null) continue;
    try {
      if ((await lstat(join(folder, name))).isFile()) hints.set(name, key);
    } catch {}
  }
  return hints;
}

export async function writeRefreshHint(cwd: string, key: IssueKey): Promise<void> {
  try {
    if (!isKey(key)) return;
    const layout = repositoryLayout(await commonDir(cwd));
    ensureFolder(layout.root);
    ensureFolder(layout.refresh);
    const folder = layout.refresh.path;
    await writeFile(join(folder, `${key}.${randomUUID()}`), '', { flag: 'wx', mode: 0o600 });
    const cutoff = Date.now() - 300_000;
    for (const name of await readdir(folder)) {
      if (hintKey(name) === null) continue;
      try {
        const path = join(folder, name);
        const file = await lstat(path);
        if (file.isFile() && file.mtimeMs < cutoff) await unlink(path);
      } catch {}
    }
  } catch {}
}
