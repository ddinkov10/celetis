import { afterAll, test as entry } from 'bun:test';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export { isolatedArgs } from '../tests/lib/fixture.ts';

import { isolatedArgs } from '../tests/lib/fixture.ts';

export interface Context {
  after(cleanup: () => unknown): void;
  test(name: string, body: (context: Context) => unknown): Promise<void>;
  test(name: string, options: { skip?: boolean | string }, body: (context: Context) => unknown): Promise<void>;
}

async function within(body: (context: Context) => unknown) {
  const cleanup: (() => unknown)[] = [];
  const context: Context = {
    after: (fn) => {
      cleanup.unshift(fn);
    },
    async test(_name, options: any, nested?: (context: Context) => unknown) {
      if (nested && options.skip) return;
      await within(nested ?? options);
    },
  };
  try {
    await body(context);
  } finally {
    for (const fn of cleanup) await fn();
  }
}

export function test(name: string, body: (context: Context) => unknown) {
  entry(name, () => within(body), 29_000);
}

export const after = afterAll;

export async function executable(path: string, source: string) {
  await mkdir(dirname(path), { recursive: true });
  const runtime = process.execPath.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll(' ', '\\_');
  await writeFile(
    path,
    `#!/usr/bin/env -S "${runtime}" ${isolatedArgs.join(' ')}\n${source.replace(/^#![^\n]*\n/, '')}\n`,
  );
  await chmod(path, 0o755);
}

export const values = (object: object): any[] => Object.values(object);
export const entries = (object: object): [string, any][] => Object.entries(object);
