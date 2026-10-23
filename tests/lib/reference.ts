import { test as bunTest, expect } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './fixture.ts';

export function referenceTests(kind: string) {
  const context = new AsyncLocalStorage<{ name: string; index: number }>();
  let active = 0;
  const waiting: (() => void)[] = [];
  type Result = { code: number; stdout: string; stderr: string };
  const records = readFile(join(root, `tests/fixtures/${kind}-reference.json`), 'utf8').then((source) => {
    const data = JSON.parse(source) as { baseline: string; sourceSha256: string; cases: Record<string, Result[]> };
    if (data.baseline !== '4fe5554c4c09ec522aae410afde6a298787a04a9' || !/^[a-f0-9]{64}$/.test(data.sourceSha256))
      throw new Error(`invalid baseline identity: ${kind}`);
    return data.cases;
  });
  return {
    test(title: string, body: () => unknown, timeout = 29_000) {
      bunTest.concurrent(
        title,
        async () => {
          if (active >= 2) await new Promise<void>((done) => waiting.push(done));
          else active++;
          try {
            await context.run({ name: title, index: 0 }, async () => {
              await body();
              expect(context.getStore()?.index, `${kind}: unused baseline results in ${title}`).toBe(
                (await records)[title]?.length ?? 0,
              );
            });
          } finally {
            const next = waiting.shift();
            if (next) next();
            else active--;
          }
        },
        timeout,
      );
    },
    async expected(scratch: string, state = ''): Promise<{ code: number; stdout: string; stderr: string }> {
      const current = context.getStore();
      if (!current) throw new Error(`no baseline case: ${kind}`);
      const record = (await records)[current.name]?.[current.index++];
      if (!record) throw new Error(`missing baseline result: ${kind}: ${current.name} #${current.index}`);
      const dates = [...new Set(state.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g))];
      const restore = (source: string) =>
        source.replaceAll('<scratch>', scratch).replace(/<date:(\d+)>/g, (_token, n: string) => {
          const date = dates[Number(n)];
          if (!date) throw new Error(`missing baseline input date ${n}`);
          return date;
        });
      return { code: record.code, stdout: restore(record.stdout), stderr: restore(record.stderr) };
    },
  };
}
