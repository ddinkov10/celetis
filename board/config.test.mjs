import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { AGENT, CONFIG_PATH, ConfigError, NUMBER, parseConfig, readConfig } from './config.mjs'

const LANE = '.claude/worktrees/7-x'
const NONE = { data: null, run: null, resume: null, port: null }

const put = async (path, text = '#!/bin/sh\n', mode = 0o755) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
  await chmod(path, mode)
}

const checkout = async t => {
  const main = await realpath(await mkdtemp(join(tmpdir(), "board it's ")))
  // The name starts with the text of `main`: a prefix test with no separator takes it for a place inside.
  const outside = `${main}-out`
  t.after(() => Promise.all([main, outside].map(folder => rm(folder, { recursive: true, force: true }))))
  for (const path of ['scripts/data.sh', 'scripts/run.sh', 'scripts/a\tb.sh', 'scripts/a\u007fb.sh', `${LANE}/data.sh`, '.claude/worktrees-other/data.sh']) await put(join(main, path))
  await put(join(main, 'scripts/plain.txt'), 'text\n', 0o644)
  await put(join(main, LANE, 'board.json'), '{}', 0o644)
  await put(join(outside, 'out.sh'))
  await put(join(outside, 'board.json'), '{}', 0o644)
  const links = { 'link.sh': join(main, 'scripts/data.sh'), 'tab.sh': join(main, 'scripts/a\tb.sh'), 'del.sh': join(main, 'scripts/a\u007fb.sh'), 'lane.sh': join(main, LANE, 'data.sh'), 'out.sh': join(outside, 'out.sh') }
  for (const [name, target] of Object.entries(links)) await symlink(target, join(main, 'scripts', name))
  await mkdir(join(main, '.claude/celetis-flow'))
  return { main, outside, file: join(main, '.claude/celetis-flow/board.json') }
}
const sourceOf = config => typeof config === 'string' ? config : JSON.stringify(config)
const write = (w, config) => writeFile(w.file, sourceOf(config))

const readBoth = async (w, config) => {
  const source = sourceOf(config)
  await write(w, source)
  const result = await readConfig(w.main)
  assert.deepEqual(await parseConfig(w.main, source, 'the file'), result)
  return result
}

const refuses = (operation, message) => assert.rejects(operation, cause => {
  assert.deepEqual([cause instanceof ConfigError, cause.name, cause.message], [true, 'ConfigError', message])
  return true
})

const refuseBoth = async (w, config, message) => {
  const source = sourceOf(config)
  await write(w, source)
  await refuses(readConfig(w.main), message)
  await refuses(parseConfig(w.main, source, 'the file'), message)
}

const REFUSALS = [
  ['the file is not JSON', '{"data": [,]}'],
  ['the file is not a JSON object', '[]'],
  ['the file is not a regular file', w => mkdir(w.file)],
  ['the file is not a regular file', w => symlink(join(w.main, 'none.json'), w.file)],
  ['the file is not a regular file', async w => { await rm(dirname(w.file), { recursive: true }); await writeFile(dirname(w.file), '') }],
  ['the file resolves to a place outside the main checkout', w => symlink(join(w.outside, 'board.json'), w.file)],
  ['the file resolves into a lane worktree', w => symlink(join(w.main, LANE, 'board.json'), w.file)],
  ['"shell" is not a key of the config', { data: ['scripts/data.sh'], shell: true }],
  ['"a\\nb" is not a key of the config', { 'a\nb': 1 }],
  ['"data" is not a list of strings with one item or more', { data: 'scripts/data.sh' }],
  ['"run" is not a list of strings with one item or more', { run: [] }],
  ['"run" is not a list of strings with one item or more', { run: ['scripts/run.sh', 7] }],
  ['"resume" is not a list of strings with one item or more', { resume: null }],
  ...[1023, 65536, 4403.5, '4403', null].map(port => ['"port" is not an integer from 1024 to 65535', { port }]),
  ['"data": the first item is an absolute path', { data: ['/bin/sh'] }],
  ['"data": the first item has a ".." part', { data: ['scripts/../../x'] }],
  ['"data": scripts/none.sh does not exist', { data: ['scripts/none.sh'] }],
  ['"data": scripts is not a regular file', { data: ['scripts'] }],
  ['"data": scripts/plain.txt is not executable', { data: ['scripts/plain.txt'] }],
  ['"data": scripts/out.sh resolves to a place outside the main checkout', { data: ['scripts/out.sh'] }],
  [`"data": ${LANE}/data.sh resolves into a lane worktree`, { data: [`${LANE}/data.sh`] }],
  ['"data": scripts/lane.sh resolves into a lane worktree', { data: ['scripts/lane.sh'] }],
  ['"run": an item or a path has a control character', { run: ['scripts/run.sh', '{n}', 'a\nb'] }],
  ['"run": an item or a path has a control character', { run: ['scripts/run.sh', '{n}', 'a\u007fb'] }],
  ['"data": an item or a path has a control character', { data: ['scripts/no\u001bne.sh'] }],
  ['"data": an item or a path has a control character', { data: ['scripts/tab.sh'] }],
  ['"run": an item has "{" or "}" and is not {n}', { run: ['scripts/run.sh', '{n}', '{step}'] }],
  ['"resume": an item has "{" or "}" and is not {n}', { resume: ['scripts/run.sh', 'x{n}'] }],
  ['"run" has no {n} item', { run: ['scripts/run.sh'] }],
  ['"run" has no {n} item', { run: ['{n}'] }],
  ['"resume" has no {n} item', { resume: ['scripts/run.sh', '--resume'] }],
  ['"data": an item has "{" or "}"', { data: ['scripts/data.sh', '{n}'] }],
  ['"run": an item has "{" or "}" and is not {n}', { run: ['scripts/run.sh', '{n}', 'x{agent}'] }],
  ['"run": an item has "{" or "}" and is not {n}', { run: ['scripts/run.sh', '{n}', '--agent={agent}'] }],
  ['"run": an item has "{" or "}" and is not {n}', { run: ['scripts/run.sh', '{n}', '{Agent}'] }],
  ['"resume": an item has "{" or "}" and is not {n}', { resume: ['scripts/run.sh', '{n}', '{agent}'] }],
  ['"data": an item has "{" or "}"', { data: ['scripts/data.sh', '{agent}'] }],
  ['"run" has no {n} item', { run: ['scripts/run.sh', '{agent}'] }],
]
REFUSALS.forEach(([message, setup], index) => test(`refusal ${index}: ${message}`, async t => {
  const w = await checkout(t)
  if (typeof setup === 'function') {
    await setup(w)
    await refuses(readConfig(w.main), message)
  } else await refuseBoth(w, setup, message)
}))

test('shared config uses the supplied subject for JSON and root refusals', async t => {
  const w = await checkout(t)
  assert.deepEqual(await parseConfig(w.main, ' \n {} \t ', 'the input'), NONE)
  for (const source of ['', ' \n ', '{', '{}{}', '{"data": [,]}']) {
    await refuses(parseConfig(w.main, source, 'the input'), 'the input is not JSON')
    await refuseBoth(w, source, 'the file is not JSON')
  }
  for (const source of ['null', '[]', 'true', '7', '"text"']) {
    await refuses(parseConfig(w.main, source, 'the input'), 'the input is not a JSON object')
    await refuseBoth(w, source, 'the file is not a JSON object')
  }
})

test('shared config keeps optional fields and resolves commands', async t => {
  assert.deepEqual([CONFIG_PATH, NUMBER, AGENT], ['.claude/celetis-flow/board.json', '{n}', '{agent}'])
  const w = await checkout(t)
  assert.deepEqual(await readBoth(w, '{}'), NONE)
  assert.deepEqual(await readBoth(w, { data: ['scripts/data.sh', '--board'], run: ['scripts/run.sh', '{n}'], resume: ['scripts/run.sh', '--resume', '{n}'], port: 4403 }), {
    data: [join(w.main, 'scripts/data.sh'), '--board'],
    run: [join(w.main, 'scripts/run.sh'), '{n}'],
    resume: [join(w.main, 'scripts/run.sh'), '--resume', '{n}'],
    port: 4403,
  })
  assert.deepEqual(await readBoth(w, { data: ['scripts/link.sh', ''], run: ['scripts/run.sh', '', '{n}'], resume: ['scripts/run.sh', '{n}', ''] }), {
    data: [join(w.main, 'scripts/data.sh'), ''],
    run: [join(w.main, 'scripts/run.sh'), '', '{n}'],
    resume: [join(w.main, 'scripts/run.sh'), '{n}', ''],
    port: null,
  })
})

test('shared config rejects supplied invalid fields', async t => {
  const w = await checkout(t)
  for (const key of ['data', 'run', 'resume']) {
    for (const value of [null, 'scripts/data.sh', [], ['scripts/data.sh', 7]]) {
      await refuseBoth(w, { [key]: value }, `"${key}" is not a list of strings with one item or more`)
    }
  }
  await refuseBoth(w, { 'a\u0000b': 1 }, '"a\\u0000b" is not a key of the config')
  await refuseBoth(w, { 'a\tb': 1 }, '"a\\tb" is not a key of the config')
})

test('shared config keeps placeholder rules', async t => {
  const w = await checkout(t)
  assert.deepEqual(await readBoth(w, { run: ['scripts/run.sh', '--agent', '{agent}', '{n}'], resume: ['scripts/run.sh', '{n}'] }), {
    ...NONE,
    run: [join(w.main, 'scripts/run.sh'), '--agent', '{agent}', '{n}'],
    resume: [join(w.main, 'scripts/run.sh'), '{n}'],
  })
  for (const item of ['{n}', '{agent}', '{step}', 'x{n}', '{', '}']) {
    await refuseBoth(w, { data: ['scripts/data.sh', item] }, '"data": an item has "{" or "}"')
  }
  for (const key of ['run', 'resume']) {
    for (const item of ['x{n}', '{n}x', '{step}', '{', '}']) {
      await refuseBoth(w, { [key]: ['scripts/run.sh', '{n}', item] }, `"${key}": an item has "{" or "}" and is not {n}`)
    }
    await refuseBoth(w, { [key]: ['{n}'] }, `"${key}" has no {n} item`)
  }
  await refuseBoth(w, { run: ['scripts/run.sh', '{agent}'] }, '"run" has no {n} item')
  await refuseBoth(w, { resume: ['scripts/run.sh', '{n}', '{agent}'] }, '"resume": an item has "{" or "}" and is not {n}')
})

test('shared config keeps executable boundaries', async t => {
  const w = await checkout(t)
  for (const key of ['data', 'run', 'resume']) {
    for (const [first, message] of [
      ['/bin/sh', 'the first item is an absolute path'],
      ['scripts/../../x', 'the first item has a ".." part'],
      ['scripts/none.sh', 'scripts/none.sh does not exist'],
      ['scripts', 'scripts is not a regular file'],
      ['scripts/plain.txt', 'scripts/plain.txt is not executable'],
      ['scripts/out.sh', 'scripts/out.sh resolves to a place outside the main checkout'],
      [`${LANE}/data.sh`, `${LANE}/data.sh resolves into a lane worktree`],
      ['scripts/lane.sh', 'scripts/lane.sh resolves into a lane worktree'],
    ]) {
      const list = key === 'data' ? [first] : [first, '{n}']
      await refuseBoth(w, { [key]: list }, `"${key}": ${message}`)
    }
  }
  assert.deepEqual(await readBoth(w, { data: ['.claude/worktrees-other/data.sh'] }), {
    ...NONE, data: [join(w.main, '.claude/worktrees-other/data.sh')],
  })
})

test('shared config rejects control characters', async t => {
  const w = await checkout(t)
  for (const key of ['data', 'run', 'resume']) {
    const rest = key === 'data' ? [] : ['{n}']
    for (const code of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
      await refuseBoth(w, { [key]: ['scripts/run.sh', ...rest, `a${String.fromCharCode(code)}b`] }, `"${key}": an item or a path has a control character`)
    }
    for (const first of ['scripts/a\tb.sh', 'scripts/tab.sh', 'scripts/del.sh']) {
      await refuseBoth(w, { [key]: [first, ...rest] }, `"${key}": an item or a path has a control character`)
    }
  }
})

test('a link to a file of the main checkout passes: the config is read through it, and a first item gives the path of that file', async t => {
  const w = await checkout(t)
  await put(join(w.main, 'config/board.json'), JSON.stringify({ data: ['scripts/link.sh'] }), 0o644)
  await symlink(join(w.main, 'config/board.json'), w.file)
  assert.deepEqual(await readConfig(w.main), { ...NONE, data: [join(w.main, 'scripts/data.sh')] })
})

test('no file, a file with no key, and no folder of the file give no list and no port', async t => {
  const w = await checkout(t)
  assert.deepEqual(await readConfig(w.main), NONE)
  await write(w, '{}')
  assert.deepEqual(await readConfig(w.main), NONE)
  await rm(join(w.main, '.claude'), { recursive: true })
  assert.deepEqual(await readConfig(w.main), NONE)
})

test('shared config keeps the port range', async t => {
  const w = await checkout(t)
  for (const port of [1024, 65535]) {
    assert.deepEqual(await readBoth(w, { port }), { ...NONE, port })
  }
  for (const port of [1023, 65536, 4403.5, '4403', null, true, false]) {
    await refuseBoth(w, { port }, '"port" is not an integer from 1024 to 65535')
  }
})

test('the status text of a board with no data names the config path', async () => {
  const page = await readFile(join(import.meta.dirname, 'board.js'), 'utf8')
  assert.ok(page.includes(`no issue data: set "data" in ${CONFIG_PATH}`))
})
