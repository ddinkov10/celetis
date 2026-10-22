import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

const WORDS = /finish|specify|triage|implement|next-step|celetis-flow\.sh|STOPS|[Gg]it[Hh]ub/

test('no file of the board holds a word of one flow or of one tracker', async () => {
  const entries = await readdir(import.meta.dirname, { withFileTypes: true })
  const names = entries.filter(entry => entry.isFile() && !entry.name.endsWith('.test.mjs') && !entry.name.endsWith('.md')).map(entry => entry.name)
  for (const name of ['board.js', 'server.mjs', 'place.mjs', 'view.mjs', 'ui.mjs', 'index.html']) assert.ok(names.includes(name), name)
  for (const name of names) assert.doesNotMatch(await readFile(join(import.meta.dirname, name), 'utf8'), WORDS, name)
})
