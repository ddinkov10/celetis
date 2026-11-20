import { readFile } from 'node:fs/promises';
import { ensureFolder, repositoryLayout, writeAtomic } from '../state/state.ts';
import { compareKeys, type IssueKey, isKey, parseKey } from '../tracker/key.ts';

const writes = new Map<string, Promise<void>>();

export async function readSetAside(common: string): Promise<ReadonlySet<IssueKey>> {
  const path = repositoryLayout(common).setAside;
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
    throw new Error(`cannot read the set-aside record ${path}: ${(error as Error).message}`, { cause: error });
  }
  return new Set(
    text.split('\n').flatMap((line) => {
      const key = parseKey(line.replace(/\r$/, ''));
      return key === null ? [] : [key];
    }),
  );
}

function change(common: string, key: IssueKey, aside: boolean): Promise<void> {
  if (!isKey(key)) return Promise.reject(new Error(`set-aside: not an issue key: ${key}`));
  const layout = repositoryLayout(common);
  const write = (writes.get(layout.setAside) ?? Promise.resolve()).then(async () => {
    const keys = new Set(await readSetAside(common));
    if (keys.has(key) === aside) return;
    if (aside) keys.add(key);
    else keys.delete(key);
    ensureFolder(layout.root);
    await writeAtomic(
      layout.setAside,
      [...keys]
        .sort(compareKeys)
        .map((each) => `${each}\n`)
        .join(''),
    );
  });
  writes.set(
    layout.setAside,
    write.catch(() => {}),
  );
  return write;
}

export const setAside = (common: string, key: IssueKey): Promise<void> => change(common, key, true);
export const clearAside = (common: string, key: IssueKey): Promise<void> => change(common, key, false);
