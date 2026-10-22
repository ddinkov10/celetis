import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from './test-support.ts';

const WORDS = /finish|specify|triage|implement|next-step|celetis-flow\.sh|STOPS|[Gg]it[Hh]ub/;

test('no file of the board holds a word of one flow or of one tracker', async () => {
  const entries = await readdir(import.meta.dirname, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && !/\.test\.(mjs|ts)$/.test(entry.name) && !entry.name.endsWith('.md'))
    .map((entry) => entry.name);
  for (const name of ['board.ts', 'server.ts', 'place.ts', 'view.ts', 'ui.ts', 'index.html'])
    assert.ok(names.includes(name), name);
  for (const name of names) assert.doesNotMatch(await readFile(join(import.meta.dirname, name), 'utf8'), WORDS, name);
});
