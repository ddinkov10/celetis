import { readFile } from 'node:fs/promises';
import { ensureFolder, repositoryLayout, writeAtomic } from './state.ts';

const NUMBER = /^[1-9][0-9]*$/;
const writes = new Map<string, Promise<void>>();

export async function readSetAside(common: string): Promise<ReadonlySet<number>> {
  const path = repositoryLayout(common).setAside;
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
    throw new Error(`cannot read the set-aside record ${path}: ${(error as Error).message}`, { cause: error });
  }
  return new Set(
    text
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => NUMBER.test(line))
      .map(Number)
      .filter(Number.isSafeInteger),
  );
}

function change(common: string, n: number, aside: boolean): Promise<void> {
  if (!Number.isSafeInteger(n) || n < 1) return Promise.reject(new Error(`set-aside: not an issue number: ${n}`));
  const layout = repositoryLayout(common);
  const write = (writes.get(layout.setAside) ?? Promise.resolve()).then(async () => {
    const numbers = new Set(await readSetAside(common));
    if (numbers.has(n) === aside) return;
    if (aside) numbers.add(n);
    else numbers.delete(n);
    ensureFolder(layout.root);
    await writeAtomic(
      layout.setAside,
      [...numbers]
        .sort((a, b) => a - b)
        .map((number) => `${number}\n`)
        .join(''),
    );
  });
  writes.set(
    layout.setAside,
    write.catch(() => {}),
  );
  return write;
}

export const setAside = (common: string, n: number): Promise<void> => change(common, n, true);
export const clearAside = (common: string, n: number): Promise<void> => change(common, n, false);
