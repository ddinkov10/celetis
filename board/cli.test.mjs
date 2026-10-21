import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { copyFile, lstat, mkdir, mkdtemp, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { createConnection, createServer } from 'node:net'
import { networkInterfaces, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

const HERE = import.meta.dirname
const FIXTURES = join(HERE, 'fixtures')
const CLI = join(HERE, 'cli.mjs')
const CONFIG = '.claude/celetis-flow/board.json'
const LIMIT_MS = 30_000
const FIXTURE_CONFIG = { data: ['flow/producer.sh'], run: ['flow/run.sh', '{n}'] }
const DOCUMENT = await readFile(join(FIXTURES, 'contract-1.json'), 'utf8')
const OK = { code: 0, stdout: 'agent-board: contract 1, 3 issues, ok\n', stderr: '' }
const NOT_DOT_GIT = 'agent-board: the git directory is not the folder .git of a checkout (a bare repository or a submodule)'
const OLD_NODE = "--import=data:text/javascript,Object.defineProperty(process,'version',{value:'v20.19.0'});Object.defineProperty(process.versions,'node',{value:'20.19.0'})"
const READ_FAILURE = "--import=data:text/javascript,Object.defineProperty(process,'stdin',{get(){throw%20new%20Error('stdin%20read%20failed')}})"
const CONFIG_FORMS = [['--config-stdin'], ['check', '--config-stdin']]
const USAGE = { code: 2, stdout: '', stderr: 'usage: agent-board [--config-stdin | check [--config-stdin | --stdin]]\n' }
const OUTSIDE = Object.values(networkInterfaces()).flat().find(address => address.family === 'IPv4' && !address.internal)?.address

const BIN = await mkdtemp(join(tmpdir(), 'agent-board-bin-'))
after(() => rm(BIN, { recursive: true }))
await copyFile(join(FIXTURES, 'herdr'), join(BIN, 'herdr'))

// A git hook exports GIT_DIR: with it, the git commands of a test would write in the repository of the hook.
const ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|HERDR_|PORT$)/.test(key))),
  PATH: `${BIN}:${process.env.PATH}`,
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Board', GIT_AUTHOR_EMAIL: 'board@example.test', GIT_COMMITTER_NAME: 'Board', GIT_COMMITTER_EMAIL: 'board@example.test',
}

const exec = promisify(execFile)
const git = (cwd, ...args) => exec('git', args, { cwd, env: ENV })
const put = async (path, text, mode = 0o644) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text, { mode })
}
const script = (path, ...lines) => put(path, ['#!/bin/sh', ...lines, ''].join('\n'), 0o755)
const refusal = line => ({ code: 1, stdout: '', stderr: `${line}\n` })
const cardsOf = (columns, read) => Object.fromEntries(Object.entries(columns).map(([key, cards]) => [key, cards.map(read)]))

const temp = async t => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'agent-board-')))
  t.after(() => rm(folder, { recursive: true, force: true }))
  return folder
}

const repo = async (t, name = 'fix ture') => {
  const folder = join(await temp(t), name)
  await mkdir(folder)
  await git(folder, 'init', '-q', '-b', 'main')
  await git(folder, 'commit', '-q', '--allow-empty', '-m', 'first')
  return folder
}

const fixture = async (t, config = FIXTURE_CONFIG, name) => {
  const folder = await repo(t, name)
  await mkdir(join(folder, 'flow'))
  for (const name of ['producer.sh', 'contract-1.json', 'run.sh']) await copyFile(join(FIXTURES, name), join(folder, 'flow', name))
  await put(join(folder, CONFIG), JSON.stringify(config))
  return folder
}

const lane = async folder => {
  const path = join(folder, '.claude', 'worktrees', '7-x')
  await git(folder, 'worktree', 'add', '-q', path)
  return path
}

const cli = (args, { cwd, env, input = '' } = {}) => new Promise(done => {
  const child = execFile(process.execPath, [CLI, ...args], { cwd, env: { ...ENV, ...env }, timeout: LIMIT_MS },
    (error, stdout, stderr) => done({ code: error ? error.code : 0, stdout, stderr }))
  child.stdin.end(input)
})

const listening = (port = 0) => new Promise((done, fail) => {
  const server = createServer().on('error', fail).listen(port, '127.0.0.1', () => done(server))
})

// Not a port that listen(0) gives: a test file that runs at the same time cannot take it before the entry listens on it.
const freePort = async () => {
  const port = 20_000 + Math.floor(Math.random() * 10_000)
  const server = await listening(port).catch(cause => {
    if (cause.code !== 'EADDRINUSE') throw cause
  })
  if (!server) return freePort()
  server.close()
  await once(server, 'close')
  return port
}

const stop = child => {
  if (child.exitCode !== null || child.signalCode !== null) return null
  child.kill()
  return once(child, 'exit')
}

const serve = async (t, cwd, env = {}, { args = [], input = '', port } = {}) => {
  port ??= await freePort()
  const child = spawn(process.execPath, [CLI, ...args], { cwd, env: { ...ENV, PORT: String(port), ...env }, stdio: ['pipe', 'pipe', 'pipe'], timeout: LIMIT_MS })
  t.after(() => stop(child))
  const lines = await new Promise((done, fail) => {
    let stdout = ''
    let stderr = ''
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
    child.stdout.setEncoding('utf8').on('data', chunk => {
      stdout += chunk
      if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'))
    })
    child.on('error', fail).on('close', code => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)))
    child.stdin.end(input)
  })
  return { port, lines, ...http(port) }
}

const http = port => {
  const call = (method, path, value) => new Promise((done, fail) => {
    const headers = value === undefined ? {} : { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}` }
    request({ host: '127.0.0.1', port, method, path, headers }, response => {
      let text = ''
      response.setEncoding('utf8').on('data', chunk => { text += chunk })
        .on('end', () => done({ status: response.statusCode, text, json: text.startsWith('{') ? JSON.parse(text) : null }))
    }).on('error', fail).end(value === undefined ? undefined : JSON.stringify(value))
  })
  return { get: path => call('GET', path), post: (path, value) => call('POST', path, value) }
}

const connect = (host, port) => new Promise(done => {
  const socket = createConnection({ host, port })
  socket.once('error', cause => done(cause.code)).once('connect', () => {
    socket.destroy()
    done('open')
  })
})

test('the fixture repository: the start prints each command, the cards of the producer show, and Run types the run script with the number', async t => {
  const folder = await fixture(t)
  const log = join(dirname(folder), 'herdr.log')
  const board = await serve(t, folder, { HERDR_LOG: log, HERDR_WORKSPACE: basename(folder) })
  assert.deepEqual(board.lines, [
    `agent-board: repository ${folder}`,
    `agent-board: data    ${folder}/flow/producer.sh`,
    `agent-board: run     ${folder}/flow/run.sh {n}`,
    `agent-board: http://127.0.0.1:${board.port}`,
  ])
  const { status, json } = await board.get('/api/board')
  assert.equal(status, 200)
  assert.deepEqual(cardsOf(json.columns, card => card.number), { needs: [394, 430], running: [], idle: [], done: [414] })
  assert.equal(json.tracker, 'GitHub')
  assert.equal((await board.post('/api/run', { number: 430 })).status, 200)
  assert.equal((await board.post('/api/resume', { number: 430 })).status, 409)
  assert.deepEqual((await readFile(log, 'utf8')).split('\n').filter(call => call !== 'api snapshot'), [
    'workspace list',
    `tab create --workspace w1 --cwd ${folder} --label #430 plan --no-focus`,
    `pane run w1:p1 '${folder}/flow/run.sh' 430 && exit`,
    '',
  ])
})

test('with no config, the start prints the repository and the URL, serves the page, and the board shows the sessions of the repository only', async t => {
  const folder = await repo(t)
  const board = await serve(t, folder, { HERDR_AGENT_CWD: folder })
  assert.deepEqual(board.lines, [`agent-board: repository ${folder}`, `agent-board: http://127.0.0.1:${board.port}`])
  const page = await board.get('/')
  assert.deepEqual([page.status, page.text.includes('<title>Agent board</title>')], [200, true])
  const { json } = await board.get('/api/board')
  assert.equal(json.source.isSet, false)
  assert.deepEqual(cardsOf(json.columns, card => [card.number, card.title, card.sessionId]), { needs: [], running: [[7, '#7', 's1']], idle: [], done: [] })
})

test('the start prints each command of the config, and the server reads the config once: a change of board.json after the start changes nothing', async t => {
  const folder = await fixture(t, { resume: ['flow/run.sh', '--resume', '{n}'], ...FIXTURE_CONFIG })
  const board = await serve(t, folder)
  assert.deepEqual(board.lines, [
    `agent-board: repository ${folder}`,
    `agent-board: data    ${folder}/flow/producer.sh`,
    `agent-board: run     ${folder}/flow/run.sh {n}`,
    `agent-board: resume  ${folder}/flow/run.sh --resume {n}`,
    `agent-board: http://127.0.0.1:${board.port}`,
  ])
  await put(join(folder, CONFIG), '{}')
  const { json } = await board.get('/api/board')
  assert.deepEqual([json.source.isSet, json.can], [true, { run: true, resume: true }])
  assert.deepEqual(cardsOf(json.columns, card => card.number), { needs: [394, 430], running: [], idle: [], done: [414] })
})

test('all config forms enforce the same checkout guards', async t => {
  const folder = await repo(t)
  const root = dirname(folder)
  const inner = await repo(t, 'inner')
  await git(root, 'init', '-q', '--bare', 'bare.git')
  await git(folder, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', inner, 'module')
  const worktree = await lane(folder)
  const linked = join(root, 'linked')
  await git(folder, 'worktree', 'add', '-q', linked)
  const cases = [
    [root, 'agent-board: the current folder is not in a git checkout'],
    [join(root, 'bare.git'), NOT_DOT_GIT],
    [join(folder, 'module'), NOT_DOT_GIT],
    [join(folder, '.git'), NOT_DOT_GIT],
    [worktree, `agent-board: start the board in the main checkout: ${folder}`],
    [linked, `agent-board: start the board in the main checkout: ${folder}`],
  ]
  for (const args of [[], ['check'], ...CONFIG_FORMS]) {
    for (const [cwd, line] of cases) {
      assert.deepEqual(await cli(args, { cwd, env: { NODE_OPTIONS: READ_FAILURE } }), refusal(line), [...args, cwd].join(' '))
    }
  }

  await mkdir(join(folder, 'flow'))
  await copyFile(join(FIXTURES, 'contract-1.json'), join(folder, 'flow/contract-1.json'))
  await script(join(folder, 'flow/cwd.sh'), 'pwd -P >>"$PRODUCER_CWD"', 'cat flow/contract-1.json')
  const log = join(root, 'producer-cwd')
  const input = JSON.stringify({ data: ['flow/cwd.sh'] })
  const link = join(root, 'link')
  await symlink(folder, link)
  await mkdir(join(folder, 'sub'))
  for (const cwd of [folder, join(folder, 'sub'), link]) {
    const env = { PRODUCER_CWD: log, PWD: cwd }
    assert.deepEqual(await cli(['check', '--config-stdin'], { cwd, env, input }), OK)
    const board = await serve(t, cwd, env, { args: ['--config-stdin'], input })
    assert.equal(board.lines[0], `agent-board: repository ${folder}`)
    assert.equal((await board.get('/api/board')).status, 200)
  }
  assert.equal(await readFile(log, 'utf8'), `${folder}\n`.repeat(6))
})

test('a start in a subfolder of the main checkout, or through a symbolic link to it, prints the real path of the repository', async t => {
  const folder = await repo(t)
  const link = join(dirname(folder), 'link')
  await symlink(folder, link)
  await mkdir(join(folder, 'sub'))
  // A shell sets PWD to the path of the link, and git reads PWD.
  for (const [cwd, env] of [[join(folder, 'sub'), {}], [link, { PWD: link }]]) {
    assert.equal((await serve(t, cwd, env)).lines[0], `agent-board: repository ${folder}`, cwd)
  }
})

test('a config that the reader refuses gives one line with the path of the config, exit 1, and no stdout', async t => {
  const folder = await fixture(t, { run: ['flow/run.sh', '{n}', 'a\tb'] })
  assert.deepEqual(await cli([], { cwd: folder }), refusal(`agent-board: ${CONFIG}: "run": an item or a path has a control character`))
  const file = join(await lane(folder), 'board.json')
  await put(file, JSON.stringify(FIXTURE_CONFIG))
  await rm(join(folder, CONFIG))
  await symlink(file, join(folder, CONFIG))
  assert.deepEqual(await cli([], { cwd: folder }), refusal(`agent-board: ${CONFIG}: the file resolves into a lane worktree`))
})

test('a config that the user cannot read gives the line of the config with the system error, and no stack trace', { skip: process.getuid() === 0 && 'the root user reads each file' }, async t => {
  const folder = await repo(t)
  await put(join(folder, CONFIG), '{}', 0o000)
  assert.deepEqual(await cli([], { cwd: folder }), refusal(`agent-board: ${CONFIG}: EACCES: permission denied, open '${join(folder, CONFIG)}'`))
})

test('a git and a herdr in a node_modules/.bin folder of the start folder do not run, with that folder first on PATH', async t => {
  const folder = await repo(t)
  const planted = join(folder, 'node_modules', '.bin')
  const marker = join(dirname(folder), 'planted')
  const log = join(dirname(folder), 'herdr.log')
  for (const name of ['git', 'herdr']) await script(join(planted, name), 'echo "$0" >>"$PLANTED"')
  const env = { PATH: `${planted}:${ENV.PATH}`, PLANTED: marker, HERDR_LOG: log }
  const found = await exec('/bin/sh', ['-c', 'command -v git; command -v herdr'], { env: { ...ENV, ...env } })
  assert.equal(found.stdout, `${planted}/git\n${planted}/herdr\n`)
  const board = await serve(t, folder, env)
  assert.equal((await board.get('/api/board')).status, 200)
  await assert.rejects(readFile(marker), { code: 'ENOENT' })
  assert.equal(await readFile(log, 'utf8'), 'api snapshot\n')
})

test('the port is PORT, else the port of the config; a port in use, and a PORT that is no port, each give one line, exit 1, and no stdout', async t => {
  const folder = await repo(t)
  const { port } = await serve(t, folder)
  const other = await listening()
  t.after(() => other.close())
  await put(join(folder, CONFIG), JSON.stringify({ port: other.address().port }))
  const inUse = number => refusal(`agent-board: cannot listen on 127.0.0.1:${number}: the port is in use`)
  assert.deepEqual(await cli([], { cwd: folder, env: { PORT: String(port) } }), inUse(port))
  assert.deepEqual(await cli([], { cwd: folder }), inUse(other.address().port))
  const { code, stdout, stderr } = await cli([], { cwd: folder, env: { PORT: '99999' } })
  assert.deepEqual([code, stdout], [1, ''])
  assert.match(stderr, /^agent-board: cannot listen on 127\.0\.0\.1:99999: [^\n]+\n$/)
})

test('the server listens on 127.0.0.1 only: a connection to another address of this machine is refused', { skip: !OUTSIDE && 'this machine has no IPv4 address that is not a loopback address' }, async t => {
  const { port } = await serve(t, await repo(t))
  assert.deepEqual(await Promise.all(['127.0.0.1', OUTSIDE].map(host => connect(host, port))), ['open', 'ECONNREFUSED'])
})

test('issue data stdin stays independent', async t => {
  const cwd = await temp(t)
  await put(join(cwd, CONFIG), '{')
  const bad = JSON.parse(DOCUMENT)
  bad.tracker = 7
  bad.issues[0].state = 'waiting'
  const check = input => cli(['check', '--stdin'], { cwd, input })
  assert.deepEqual(await check(DOCUMENT), OK)
  assert.deepEqual(await check(JSON.stringify(bad)),
    { code: 1, stdout: '', stderr: 'tracker: is not a string with one character or more\nissues[0].state: "waiting" is not a state of contract 1\n' })
  assert.deepEqual(await check('{'), { code: 1, stdout: '', stderr: 'the data is not JSON\n' })
})

test('check runs the data command of the config in the main checkout and checks its output', async t => {
  const folder = await fixture(t)
  assert.deepEqual(await cli(['check'], { cwd: folder }), OK)
  await script(join(folder, 'flow', 'eval.sh'), 'eval "$1"')
  await mkdir(join(folder, 'sub'))
  for (const [command, result] of [
    ['cat flow/contract-1.json', OK],
    ['echo boom >&2; echo more >&2; echo out; exit 3', refusal('agent-board: boom')],
    ['echo stop cannot read; exit 1', refusal('agent-board: stop cannot read')],
    ['exit 3', refusal('agent-board: the data command exited 3')],
  ]) {
    await put(join(folder, CONFIG), JSON.stringify({ data: ['flow/eval.sh', command] }))
    assert.deepEqual(await cli(['check'], { cwd: join(folder, 'sub') }), result, command)
  }
  assert.deepEqual(await cli(['check'], { cwd: await repo(t) }), refusal('agent-board: the config has no "data"'))
})

test('only the five public argument tuples are accepted', async t => {
  const cwd = await temp(t)
  const lists = [
    ['nope'], ['check', 'nope'], ['check', '--stdin', 'more'], ['--stdin'], ['--unknown'],
    ['--config-stdin', 'check'], ['--stdin', 'check'], ['--config-stdin', '--stdin'], ['--stdin', '--config-stdin'],
    ['check', '--config-stdin', '--stdin'], ['check', '--stdin', '--config-stdin'],
    ['--config-stdin', '--config-stdin'], ['check', '--config-stdin', '--config-stdin'],
    ['check', '--stdin', '--stdin'], ['check', 'check'], ['--config-stdin', 'more'], ['check --stdin'],
  ]
  for (const args of lists) assert.deepEqual(await cli(args, { cwd, env: { NODE_OPTIONS: READ_FAILURE } }), USAGE, args.join(' '))
  const child = spawn(process.execPath, [CLI, 'check', '--stdin', '--config-stdin'], {
    cwd, env: { ...ENV, NODE_OPTIONS: READ_FAILURE }, stdio: ['pipe', 'pipe', 'pipe'], timeout: LIMIT_MS,
  })
  t.after(() => stop(child))
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
  const [code] = await once(child, 'close')
  assert.deepEqual({ code, stdout, stderr }, USAGE)
})

test('on a Node that is too old, the entry prints the Node line and exits 1 before each other act', async t => {
  for (const args of [['nope'], ...CONFIG_FORMS]) {
    const result = await cli(args, { cwd: await temp(t), env: { NODE_OPTIONS: `${OLD_NODE} ${READ_FAILURE}` } })
    assert.deepEqual(result, refusal('agent-board: Node 22.18, or Node 24.2 or later, is necessary'))
  }
})

test('config stdin serves and checks without a config file', async t => {
  const folder = await fixture(t)
  await rm(join(folder, CONFIG))
  const input = JSON.stringify(FIXTURE_CONFIG)
  assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, input }), OK)
  const board = await serve(t, folder, {}, { args: ['--config-stdin'], input })
  assert.deepEqual(board.lines, [
    `agent-board: repository ${folder}`,
    `agent-board: data    ${folder}/flow/producer.sh`,
    `agent-board: run     ${folder}/flow/run.sh {n}`,
    `agent-board: http://127.0.0.1:${board.port}`,
  ])
  const { status, json } = await board.get('/api/board')
  assert.equal(status, 200)
  assert.deepEqual(cardsOf(json.columns, card => card.number), { needs: [394, 430], running: [], idle: [], done: [414] })
  await assert.rejects(lstat(join(folder, CONFIG)), { code: 'ENOENT' })
  await put(join(folder, CONFIG), input)
  assert.deepEqual(await cli(['check'], { cwd: folder }), OK)
  const file = await serve(t, folder)
  assert.deepEqual(file.lines.slice(0, -1), board.lines.slice(0, -1))
  const fileJson = (await file.get('/api/board')).json
  assert.deepEqual([fileJson.can, cardsOf(fileJson.columns, card => card.number)], [json.can, cardsOf(json.columns, card => card.number)])
})

test('config stdin ignores each file state', async t => {
  for (const state of ['absent', 'invalid JSON', 'conflicting config', 'unreadable', 'directory', 'external symlink']) {
    await t.test(state, { skip: state === 'unreadable' && process.getuid() === 0 && 'the root user reads each file' }, async t => {
      const folder = await fixture(t)
      const path = join(folder, CONFIG)
      const marker = join(dirname(folder), 'conflict-marker')
      await script(join(folder, 'flow/conflict.sh'), 'printf called >>"$PRODUCER_MARKER"', 'cat flow/contract-1.json')
      await rm(path)
      const port = await freePort()
      if (state === 'invalid JSON') await put(path, '{')
      if (state === 'conflicting config') await put(path, JSON.stringify({ data: ['flow/conflict.sh'], port: port + 1 }))
      if (state === 'unreadable') await put(path, '{}', 0o000)
      if (state === 'directory') await mkdir(path)
      if (state === 'external symlink') {
        const outside = join(dirname(folder), 'external.json')
        await put(outside, '{')
        await symlink(outside, path)
      }
      const snapshot = async () => {
        const info = await lstat(path).catch(cause => {
          if (cause.code !== 'ENOENT') throw cause
        })
        if (!info) return null
        return {
          mode: info.mode, ino: info.ino, size: info.size, mtime: info.mtimeMs, ctime: info.ctimeMs,
          contents: info.isSymbolicLink() ? await readlink(path) : info.isFile() && state !== 'unreadable' ? await readFile(path, 'utf8') : null,
        }
      }
      const before = await snapshot()
      const input = JSON.stringify({ ...FIXTURE_CONFIG, port })
      const env = { PORT: undefined, PRODUCER_MARKER: marker }
      assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, env, input }), OK)
      const board = await serve(t, folder, env, { args: ['--config-stdin'], input, port })
      assert.deepEqual(board.lines, [
        `agent-board: repository ${folder}`,
        `agent-board: data    ${folder}/flow/producer.sh`,
        `agent-board: run     ${folder}/flow/run.sh {n}`,
        `agent-board: http://127.0.0.1:${port}`,
      ])
      assert.deepEqual(cardsOf((await board.get('/api/board')).json.columns, card => card.number), { needs: [394, 430], running: [], idle: [], done: [414] })
      await assert.rejects(readFile(marker), { code: 'ENOENT' })
      assert.deepEqual(await snapshot(), before)
    })
  }
})

test('config stdin keeps the startup config', async t => {
  const folder = await fixture(t)
  const config = { ...FIXTURE_CONFIG, resume: ['flow/run.sh', '--resume', '{n}'] }
  const board = await serve(t, folder, {}, { args: ['--config-stdin'], input: JSON.stringify(config) })
  assert.equal((await board.get('/api/board')).status, 200)
  const marker = join(dirname(folder), 'changed-producer')
  await script(join(folder, 'flow/changed.sh'), `printf called >'${marker}'`, 'exit 3')
  await put(join(folder, CONFIG), JSON.stringify({ data: ['flow/changed.sh'] }))
  const { json } = await board.get('/api/board')
  assert.deepEqual([json.source.isSet, json.source.error, json.can], [true, null, { run: true, resume: true }])
  assert.deepEqual(cardsOf(json.columns, card => card.number), { needs: [394, 430], running: [], idle: [], done: [414] })
  await assert.rejects(readFile(marker), { code: 'ENOENT' })
})

test('config stdin waits for EOF and accepts chunks', async t => {
  for (const args of CONFIG_FORMS) await t.test(args.join(' '), async t => {
    const folder = await fixture(t)
    const marker = join(dirname(folder), 'producer-marker')
    await script(join(folder, 'flow/producer-é.sh'), 'printf called >>"$PRODUCER_MARKER"', 'cat flow/contract-1.json')
    const port = await freePort()
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: folder, env: { ...ENV, PRODUCER_MARKER: marker }, stdio: ['pipe', 'pipe', 'pipe'], timeout: LIMIT_MS,
    })
    t.after(() => stop(child))
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
    const ended = once(child, 'close')
    const bytes = Buffer.from(` \n${JSON.stringify({ data: ['flow/producer-é.sh'], port })}\t \n`)
    const split = bytes.indexOf(Buffer.from('é')) + 1
    for (const chunk of [bytes.subarray(0, 3), bytes.subarray(3, split), bytes.subarray(split)]) {
      child.stdin.write(chunk)
      await delay(10)
    }
    const until = Date.now() + 200
    do {
      assert.equal(stdout, '')
      assert.equal(stderr, '')
      assert.deepEqual([child.exitCode, child.signalCode], [null, null])
      await assert.rejects(readFile(marker), { code: 'ENOENT' })
      assert.equal(await connect('127.0.0.1', port), 'ECONNREFUSED')
      await delay(20)
    } while (Date.now() < until)
    child.stdin.end()
    if (args[0] === 'check') {
      const [code] = await ended
      assert.deepEqual({ code, stdout, stderr }, OK)
    } else {
      const until = Date.now() + LIMIT_MS
      while (!stdout.includes(`agent-board: http://127.0.0.1:${port}\n`) && child.exitCode === null && Date.now() < until) await delay(10)
      assert.match(stdout, new RegExp(`agent-board: http://127\\.0\\.0\\.1:${port}\\n`))
      assert.equal(stderr, '')
      const { status, json } = await http(port).get('/api/board')
      assert.equal(status, 200)
      assert.deepEqual(cardsOf(json.columns, card => card.number), { needs: [394, 430], running: [], idle: [], done: [414] })
    }
    assert.equal(await readFile(marker, 'utf8'), 'called')
  })
})

test('config stdin reports each bad input without starting work', async t => {
  const folder = await fixture(t, { data: ['flow/record.sh'] })
  const marker = join(dirname(folder), 'producer-marker')
  await script(join(folder, 'flow/record.sh'), 'printf called >>"$PRODUCER_MARKER"', 'cat flow/contract-1.json')
  const port = await freePort()
  const inputs = [
    ...['', ' \t\n', '{', '{}{}', '{"data":}'].map(input => [input, 'the input is not JSON']),
    ...['null', '[]', '"text"', 'true', 'false', '7'].map(input => [input, 'the input is not a JSON object']),
    [JSON.stringify({ data: ['flow/record.sh'], extra: true }), '"extra" is not a key of the config'],
    ...[null, false, 1, 'flow/record.sh', [], [1]].map(data => [JSON.stringify({ data }), '"data" is not a list of strings with one item or more']),
    [JSON.stringify({ data: ['flow/record.sh'], run: null }), '"run" is not a list of strings with one item or more'],
    [JSON.stringify({ data: ['flow/record.sh'], resume: 7 }), '"resume" is not a list of strings with one item or more'],
    ...[null, '4403', 0, 65536, 4403.5].map(value => [JSON.stringify({ data: ['flow/record.sh'], port: value }), '"port" is not an integer from 1024 to 65535']),
  ]
  for (const args of CONFIG_FORMS) for (const [input, message] of inputs) {
    const result = await cli(args, { cwd: folder, input, env: { PORT: String(port), PRODUCER_MARKER: marker } })
    assert.deepEqual(result, refusal(`agent-board: config stdin: ${message}`), `${args.join(' ')}: ${input}`)
    await assert.rejects(readFile(marker), { code: 'ENOENT' })
    assert.equal(await connect('127.0.0.1', port), 'ECONNREFUSED')
  }
})

test('config stdin catches read failures', async t => {
  const folder = await fixture(t, { data: ['flow/record.sh'] })
  const marker = join(dirname(folder), 'producer-marker')
  await script(join(folder, 'flow/record.sh'), 'printf called >>"$PRODUCER_MARKER"', 'cat flow/contract-1.json')
  const port = await freePort()
  for (const args of CONFIG_FORMS) {
    const env = { PORT: String(port), PRODUCER_MARKER: marker, NODE_OPTIONS: READ_FAILURE }
    assert.deepEqual(await cli(args, { cwd: folder, env }), refusal('agent-board: config stdin: stdin read failed'))
    await assert.rejects(readFile(marker), { code: 'ENOENT' })
    assert.equal(await connect('127.0.0.1', port), 'ECONNREFUSED')
  }
})

test('config stdin enforces executable security in the real CLI', async t => {
  const folder = await fixture(t)
  const marker = join(dirname(folder), 'producer-marker')
  const port = await freePort()
  const env = { PORT: String(port), PRODUCER_MARKER: marker }
  await script(join(folder, 'flow/record.sh'), 'printf called >>"$PRODUCER_MARKER"', 'cat flow/contract-1.json')
  await put(join(folder, CONFIG), JSON.stringify({ data: ['flow/record.sh'] }))
  await script(join(dirname(folder), 'sibling.sh'), 'printf called >>"$PRODUCER_MARKER"')
  await symlink(join(dirname(folder), 'sibling.sh'), join(folder, 'flow/external.sh'))
  await put(join(folder, 'flow/not-executable.sh'), 'exit 0\n')
  await script(join(folder, '.claude/worktrees/lane/run.sh'), 'printf called >>"$PRODUCER_MARKER"')
  await symlink(join(folder, '.claude/worktrees/lane/run.sh'), join(folder, 'flow/lane.sh'))
  await script(join(folder, 'flow/control\nname.sh'), 'printf called >>"$PRODUCER_MARKER"')
  await symlink(join(folder, 'flow/control\nname.sh'), join(folder, 'flow/control.sh'))
  await symlink(join(folder, 'flow/producer.sh'), join(folder, 'flow/internal.sh'))
  const cases = [
    [['/bin/sh'], '"data": the first item is an absolute path'],
    [['flow/../flow/record.sh'], '"data": the first item has a ".." part'],
    [['flow'], '"data": flow is not a regular file'],
    [['flow/not-executable.sh'], '"data": flow/not-executable.sh is not executable'],
    [['flow/external.sh'], '"data": flow/external.sh resolves to a place outside the main checkout'],
    [['.claude/worktrees/lane/run.sh'], '"data": .claude/worktrees/lane/run.sh resolves into a lane worktree'],
    [['flow/lane.sh'], '"data": flow/lane.sh resolves into a lane worktree'],
    [['flow/record.sh', 'a\tb'], '"data": an item or a path has a control character'],
    [['flow/control.sh'], '"data": an item or a path has a control character'],
    [['flow/record.sh', '{agent}'], '"data": an item has "{" or "}"'],
  ]
  for (const args of CONFIG_FORMS) for (const [data, message] of cases) {
    assert.deepEqual(await cli(args, { cwd: folder, env, input: JSON.stringify({ data }) }), refusal(`agent-board: config stdin: ${message}`))
    await assert.rejects(readFile(marker), { code: 'ENOENT' })
    assert.equal(await connect('127.0.0.1', port), 'ECONNREFUSED')
  }
  const input = JSON.stringify({ data: ['flow/internal.sh'] })
  assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, input }), OK)
  const board = await serve(t, folder, {}, { args: ['--config-stdin'], input })
  assert.equal(board.lines[1], `agent-board: data    ${folder}/flow/producer.sh`)
  assert.equal((await board.get('/api/board')).status, 200)
  assert.deepEqual(await cli(['check', '--config-stdin'], {
    cwd: folder, input: JSON.stringify({ resume: ['flow/run.sh', '{agent}', '{n}'] }),
  }), refusal('agent-board: config stdin: "resume": an item has "{" or "}" and is not {n}'))
})

test('config stdin keeps port selection and listen errors', async t => {
  const folder = await repo(t)
  const reserved = await listening()
  t.after(() => reserved.close())
  const configPort = reserved.address().port
  const port = await freePort()
  const input = JSON.stringify({ port: configPort })
  const board = await serve(t, folder, { PORT: String(port) }, { args: ['--config-stdin'], input, port })
  assert.equal(board.lines.at(-1), `agent-board: http://127.0.0.1:${port}`)
  assert.equal(await connect('127.0.0.1', port), 'open')
  await t.test('loopback only', { skip: !OUTSIDE && 'this machine has no IPv4 address that is not a loopback address' }, async () => {
    assert.equal(await connect(OUTSIDE, port), 'ECONNREFUSED')
  })
  const inUse = value => refusal(`agent-board: cannot listen on 127.0.0.1:${value}: the port is in use`)
  for (const PORT of [undefined, 'not-a-number', '0']) {
    assert.deepEqual(await cli(['--config-stdin'], { cwd: folder, env: { PORT }, input }), inUse(configPort))
  }
  const configured = await freePort()
  const fromConfig = await serve(t, folder, { PORT: undefined }, {
    args: ['--config-stdin'], input: JSON.stringify({ port: configured }), port: configured,
  })
  assert.equal(fromConfig.lines.at(-1), `agent-board: http://127.0.0.1:${configured}`)
  const defaultPort = await listening(4403).catch(cause => {
    if (cause.code !== 'EADDRINUSE') throw cause
  })
  if (defaultPort) t.after(() => defaultPort.close())
  for (const PORT of [undefined, 'not-a-number', '0']) {
    assert.deepEqual(await cli(['--config-stdin'], { cwd: folder, env: { PORT }, input: '{}' }), inUse(4403))
  }
  const { code, stdout, stderr } = await cli(['--config-stdin'], { cwd: folder, env: { PORT: '99999' }, input: '{}' })
  assert.deepEqual([code, stdout], [1, ''])
  assert.match(stderr, /^agent-board: cannot listen on 127\.0\.0\.1:99999: [^\n]+\n$/)
})

test('config stdin preserves missing data and producer results', async t => {
  const folder = await fixture(t)
  const board = await serve(t, folder, {}, { args: ['--config-stdin'], input: '{}' })
  assert.deepEqual(board.lines, [`agent-board: repository ${folder}`, `agent-board: http://127.0.0.1:${board.port}`])
  assert.equal((await board.get('/api/board')).json.source.isSet, false)
  assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, input: '{}' }), refusal('agent-board: the config has no "data"'))
  await script(join(folder, 'flow/eval.sh'), 'eval "$1"')
  const invalid = JSON.parse(DOCUMENT)
  invalid.tracker = 7
  await put(join(folder, 'flow/invalid.json'), JSON.stringify(invalid))
  const cases = [
    ['cat flow/contract-1.json', OK],
    ['echo boom >&2; echo more >&2; echo out; exit 3', refusal('agent-board: boom')],
    ['echo stop cannot read; echo more; exit 1', refusal('agent-board: stop cannot read')],
    ['exit 3', refusal('agent-board: the data command exited 3')],
    ['echo not-json', refusal('the data is not JSON')],
    ['cat flow/invalid.json', refusal('tracker: is not a string with one character or more')],
  ]
  for (const [command, expected] of cases) {
    const input = JSON.stringify({ data: ['flow/eval.sh', command] })
    await put(join(folder, CONFIG), input)
    assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, input }), expected, command)
    assert.deepEqual(await cli(['check'], { cwd: folder }), expected, command)
  }
})

test('stdin config keeps startup safeguards and terminal actions', async t => {
  const config = {
    data: ['flow/producer.sh'],
    run: ['flow/run.sh', '--agent', '{agent}', '{n}', 'one word', 'a;b'],
    resume: ['flow/run.sh', '--resume', '{n}'],
  }
  const folder = await fixture(t, config, "it's a fixture")
  const document = JSON.parse(DOCUMENT)
  document.issues.push({
    number: 431, title: 'stopped step', type: 'feature', state: 'stuck', step: 'plan',
    updatedAt: '2026-10-11T18:00:00Z', act: 'resume the step',
  })
  document.agents.opencode = { available: true, cause: null }
  await put(join(folder, 'flow/contract-1.json'), JSON.stringify(document))
  const planted = join(folder, 'node_modules/.bin')
  const marker = join(dirname(folder), 'planted')
  for (const name of ['git', 'herdr']) await script(join(planted, name), 'echo "$0" >>"$PLANTED"')
  const env = { PATH: `${planted}:${ENV.PATH}`, PLANTED: marker, HERDR_WORKSPACE: basename(folder) }
  assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, env, input: JSON.stringify(config) }), {
    code: 0, stdout: 'agent-board: contract 1, 4 issues, ok\n', stderr: '',
  })
  const typed = []
  for (const args of [[], ['--config-stdin']]) {
    const log = join(dirname(folder), args.length ? 'stdin-herdr.log' : 'file-herdr.log')
    const board = await serve(t, folder, { ...env, HERDR_LOG: log }, { args, input: JSON.stringify(config) })
    const { json } = await board.get('/api/board')
    assert.deepEqual(json.can, { run: true, resume: true })
    assert.equal((await board.post('/api/run', { number: 430, agent: 'opencode' })).status, 200)
    assert.equal((await board.post('/api/resume', { number: 431 })).status, 200)
    typed.push((await readFile(log, 'utf8')).split('\n').filter(line => line.startsWith('pane run ')))
    await assert.rejects(readFile(marker), { code: 'ENOENT' })
  }
  const quoted = folder.replaceAll("'", "'\\''")
  const expected = [
    `pane run w1:p1 '${quoted}/flow/run.sh' '--agent' 'opencode' 430 'one word' 'a;b' && exit`,
    `pane run w1:p1 '${quoted}/flow/run.sh' '--resume' 431 && exit`,
  ]
  assert.deepEqual(typed, [expected, expected])
})

test('default changes leave producer configuration unchanged in both config modes', async t => {
  const config = {
    data: ['flow/producer.sh'], run: ['flow/run.sh', '--agent', '{agent}', '{n}'],
    resume: ['flow/run.sh', '--resume', '{n}'],
  }
  for (const args of [[], ['--config-stdin']]) await t.test(args.length ? 'stdin' : 'file', async t => {
    const folder = await fixture(t, config)
    const document = JSON.parse(DOCUMENT)
    document.agents = { claude: { available: true, cause: null }, codex: { available: true, cause: null } }
    delete document.defaultAgent
    document.issues.push(
      { ...document.issues[0], number: 431, state: 'stuck', act: 'Resume the step' },
      { ...document.issues[0], number: 432 },
    )
    await put(join(folder, 'flow/contract-1.json'), JSON.stringify(document))
    await put(join(folder, '.celetis.yaml'), 'agent: claude\n')
    await git(folder, 'add', '.celetis.yaml')
    await git(folder, 'commit', '-q', '-m', 'producer settings')
    await git(folder, 'config', 'celetis-flow.agent', 'claude')
    await git(folder, 'config', '--add', 'fixture.keep', 'one')
    await git(folder, 'config', '--add', 'fixture.keep', 'two')
    await put(join(folder, 'flow/producer.sh'), `#!/usr/bin/env node
const { readFile } = require('node:fs/promises')
async function main() {
  const document = JSON.parse(await readFile('flow/contract-1.json', 'utf8'))
  const yaml = await readFile('.celetis.yaml', 'utf8')
  if (yaml !== 'agent: claude\\n') throw new Error('unexpected producer configuration')
  document.defaultAgent = 'claude'
  console.log(JSON.stringify(document))
}
main()
`, 0o755)
    const snapshot = async () => ({
      yaml: await readFile(join(folder, '.celetis.yaml')),
      git: (await git(folder, 'config', '--local', '--null', '--list')).stdout,
      producer: JSON.parse((await exec(join(folder, 'flow/producer.sh'), [], { cwd: folder, env: ENV })).stdout),
    })
    const before = await snapshot()
    assert.equal(before.producer.defaultAgent, 'claude')
    const log = join(dirname(folder), 'herdr.log')
    const board = await serve(t, folder, { HERDR_LOG: log, HERDR_WORKSPACE: basename(folder) }, { args, input: JSON.stringify(config) })
    assert.equal((await board.get('/api/board')).json.defaultAgent, 'claude')
    const { status, json } = await board.post('/api/agent', { agent: 'codex' })
    assert.deepEqual([status, json], [409, { error: 'The producer controls the default agent. Change it in the producer configuration.' }])
    assert.deepEqual(await snapshot(), before)
    assert.equal((await board.post('/api/refresh', {})).status, 200)
    assert.equal((await board.get('/api/board')).json.defaultAgent, 'claude')
    assert.equal((await board.post('/api/run', { number: 430, agent: 'codex' })).status, 200)
    assert.equal((await board.post('/api/run', { number: 432 })).status, 200)
    assert.equal((await board.post('/api/resume', { number: 431 })).status, 200)
    assert.deepEqual((await readFile(log, 'utf8')).split('\n').filter(line => line.startsWith('pane run ')), [
      `pane run w1:p1 '${folder}/flow/run.sh' '--agent' 'codex' 430 && exit`,
      `pane run w1:p1 '${folder}/flow/run.sh' '--agent' 'claude' 432 && exit`,
      `pane run w1:p1 '${folder}/flow/run.sh' '--resume' 431 && exit`,
    ])
    assert.deepEqual(await snapshot(), before)
    assert.equal((await board.get('/api/board')).json.defaultAgent, 'claude')
  })
})
