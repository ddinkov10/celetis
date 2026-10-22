import { execFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { basename, join, relative, resolve, sep } from 'node:path'
import { AGENT, NUMBER } from './config.mjs'
import { readDocument } from './contract.mjs'
import { activePresses, place, sessionsOf, stepsOf } from './place.mjs'

const HERE = import.meta.dirname
const STALE_MS = 60_000
const DIFF_MS = 15_000
const SCREEN_LINES = 16
const PANE = /^[\w:.][\w:.-]*$/
const RULE = /^[\s─━═╌┄-]*$/
const isPane = id => typeof id === 'string' && PANE.test(id)
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/board.css': ['board.css', 'text/css; charset=utf-8'],
  '/board.js': ['board.js', 'text/javascript; charset=utf-8'],
  '/view.mjs': ['view.mjs', 'text/javascript; charset=utf-8'],
  '/ui.mjs': ['ui.mjs', 'text/javascript; charset=utf-8'],
  '/panel.mjs': ['panel.mjs', 'text/javascript; charset=utf-8'],
  '/palette.mjs': ['palette.mjs', 'text/javascript; charset=utf-8'],
  '/fonts/geist.woff2': ['fonts/geist.woff2', 'font/woff2'],
  '/fonts/geist-mono.woff2': ['fonts/geist-mono.woff2', 'font/woff2'],
}
const POSTS = new Set(['/api/run', '/api/resume', '/api/shell', '/api/go', '/api/refresh', '/api/agent'])
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src data:; " +
  "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

class Refusal extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const firstLine = text => text.split('\n').map(line => line.trim()).find(Boolean) ?? ''
const cleanCause = cause => firstLine(String(cause ?? '')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200)
const quote = text => `'${text.replaceAll("'", "'\\''")}'`
const lineOf = (items, number, agent) => `${items.map(item => item === NUMBER ? number : item === AGENT ? quote(agent) : quote(item)).join(' ')} && exit`
const count = (text, word) => Number(new RegExp(`(\\d+) ${word}`).exec(text)?.[1] ?? 0)
const screenOf = text => text.replaceAll('\t', ' ').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').split('\n')
  .map(line => line.replace(/^[\s│┃╭╮╰╯]+|[\s│┃╭╮╰╯]+$/g, ''))
  .filter(line => !RULE.test(line)).slice(-SCREEN_LINES)

export const run = (file, args, options = {}) => new Promise(done => {
  execFile(file, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
    const isExit = typeof error?.code === 'number'
    done({ code: error ? (isExit ? error.code : 1) : 0, stdout, stderr: stderr || (error && !isExit ? error.message : '') })
  })
})

export const runData = async (main, data, exec = run) => {
  const { code, stdout, stderr } = await exec(data[0], data.slice(1), { cwd: main, timeout: STALE_MS })
  if (code === 0) return { output: stdout, error: null }
  return { output: null, error: firstLine(stderr) || firstLine(stdout) || `the data command exited ${code}` }
}

export const createBoard = ({ main, config, exec = run, now = Date.now }) => {
  const can = { run: Boolean(config.run), resume: Boolean(config.resume) }
  let board = null
  let readAt = null
  let error = null
  let askedAt = -Infinity
  let pending = null
  let presses = {}
  let shown = new Set()
  let health = { ok: null, error: null }
  let firstSeen = new Map()
  let screens = new Map()
  const diffs = new Map()

  const readData = async () => {
    const data = await runData(main, config.data, exec)
    if (data.error !== null) {
      error = data.error
      return
    }
    const { doc, failures, isOtherContract } = readDocument(data.output)
    error = failures[0] ?? null
    if (doc) {
      board = doc
      readAt = new Date(now()).toISOString()
    } else if (isOtherContract) {
      board = null
      readAt = null
    }
  }

  const refresh = () => {
    if (!config.data) return null
    askedAt = now()
    pending ??= readData().finally(() => { pending = null })
    return pending
  }

  const isInside = path => typeof path === 'string' && (resolve(path) === main || resolve(path).startsWith(`${main}${sep}.claude${sep}worktrees${sep}`))

  const herdr = async (...args) => {
    const { code, stdout, stderr } = await exec('herdr', args, { timeout: 15_000 })
    let answer = null
    try { answer = JSON.parse(code === 0 ? stdout : stderr) } catch {}
    if (answer?.error) throw new Refusal(502, firstLine(String(answer.error.message ?? JSON.stringify(answer.error))))
    if (code !== 0) throw new Refusal(502, firstLine(stderr) || firstLine(stdout) || `herdr exited ${code}`)
    return answer?.result
  }

  const readSessions = async () => {
    const snapshot = (await herdr('api', 'snapshot'))?.snapshot
    if (!Array.isArray(snapshot?.agents) || !Array.isArray(snapshot.tabs)) throw new Refusal(502, 'herdr gave no snapshot')
    return sessionsOf(snapshot, isInside, stepsOf(board?.flow))
  }

  const watchSessions = async () => {
    try {
      const sessions = await readSessions()
      health = { ok: true, error: null }
      const seen = new Map()
      for (const session of sessions) {
        const key = `${session.sessionId}|${session.status === 'done' ? 'idle' : session.status}`
        seen.set(key, firstSeen.get(key) ?? now())
        session.since = new Date(seen.get(key)).toISOString()
      }
      firstSeen = seen
      return sessions
    } catch (cause) {
      health = { ok: false, error: firstLine(cause.message) }
      return []
    }
  }

  const readScreens = async sessions => {
    const read = await Promise.all(sessions.filter(session => isPane(session.paneId)).map(async session => {
      const { code, stdout } = await exec('herdr', ['agent', 'read', session.paneId, '--source', 'visible'], { timeout: 15_000 })
      return [session.sessionId, code === 0 ? screenOf(stdout) : screens.get(session.sessionId) ?? []]
    }))
    screens = new Map(read)
  }

  const laneOf = async number => {
    const dir = join(main, '.claude', 'worktrees')
    const name = (await readdir(dir).catch(() => [])).find(entry => entry.startsWith(`${number}-`))
    return name ? join(dir, name) : null
  }

  const diffOf = async cwd => {
    const known = diffs.get(cwd)
    if (known && now() - known.at < DIFF_MS) return known.value
    const { code, stdout } = await exec('git', ['--no-optional-locks', '-C', resolve(cwd), 'diff', '--shortstat', '--merge-base', 'origin/HEAD'], { timeout: 10_000 })
    const files = count(stdout, 'files? changed')
    const value = code === 0 && files > 0 ? { files, added: count(stdout, 'insertions?'), removed: count(stdout, 'deletions?') } : null
    diffs.set(cwd, { at: now(), value })
    return value
  }

  const placement = async ({ isLocal = false } = {}) => {
    const sessions = await watchSessions()
    if (!isLocal) await readScreens(sessions)
    for (const session of sessions) session.screen = screens.get(session.sessionId)
    presses = activePresses(presses, sessions, board, now())
    const placed = place({ sessions, board, presses, can })
    const cards = Object.values(placed.columns).flat()
    const ids = new Set(cards.map(card => card.sessionId).filter(Boolean))
    const hasEnded = [...shown].some(id => !ids.has(id))
    shown = ids
    if (hasEnded && !isLocal) void refresh()
    await Promise.all(cards.filter(card => card.sessionId).map(async card => {
      const folder = (card.number !== null && await laneOf(card.number)) || card.cwd
      if (!isInside(folder)) return
      card.diff = await diffOf(folder)
      card.cwd = relative(main, resolve(folder)) || '.'
    }))
    return {
      ...placed, flow: board?.flow ?? null, tracker: board?.tracker ?? null, runner: board?.runner ?? null,
      agents: board?.agents ?? null, defaultAgent: board?.defaultAgent ?? null, can, herdr: health,
      source: { isSet: Boolean(config.data), readAt, error }, repo: basename(main),
    }
  }

  const openTab = async ({ cwd, label, command, isQuiet }) => {
    const name = basename(main)
    const focus = isQuiet ? ['--no-focus'] : []
    const workspaces = (await herdr('workspace', 'list'))?.workspaces
    if (!Array.isArray(workspaces)) throw new Refusal(502, 'herdr gave no list of workspaces')
    const workspace = workspaces.find(w => w.label === name)
    if (workspace && !isPane(workspace.workspace_id)) throw new Refusal(502, 'herdr gave no id for the workspace')
    const made = workspace
      ? await herdr('tab', 'create', '--workspace', workspace.workspace_id, '--cwd', cwd, '--label', label, ...focus)
      : await herdr('workspace', 'create', '--cwd', cwd, '--label', name, ...focus)
    if (!isPane(made?.root_pane?.pane_id)) throw new Refusal(502, 'herdr gave no pane for the new tab')
    if (!workspace && made.tab?.tab_id) {
      if (!isPane(made.tab.tab_id)) throw new Refusal(502, 'herdr gave no id for the new tab')
      await herdr('tab', 'rename', made.tab.tab_id, label)
    }
    if (command) await herdr('pane', 'run', made.root_pane.pane_id, command)
  }

  const issueCardOf = async number => Object.values((await placement()).columns).flat().find(c => c.sessionId === null && c.number === number)

  // No await between the test and the set of presses: the card of a second press can be older than the first press.
  const press = async (number, isAllowed, refusal, start) => {
    if (!isAllowed || number in presses) throw new Refusal(409, refusal)
    presses[number] = now()
    try {
      await start()
    } catch (cause) {
      delete presses[number]
      throw cause
    }
    await refresh()
  }

  const runStep = async (number, agent) => {
    const card = await issueCardOf(number)
    const needsAgent = config.run?.includes(AGENT) ?? false
    let effective = null
    if (agent !== undefined && agent !== null) {
      if (!needsAgent) throw new Refusal(409, `#${number} has no agent "${String(agent)}"`)
      if (typeof agent !== 'string' || !/^[a-z]+$/.test(agent)) throw new Refusal(409, `#${number} has no agent "${String(agent)}"`)
      const members = board?.agents
      if (!board || !members || !Object.hasOwn(members, agent)) throw new Refusal(409, `#${number} has no agent "${agent}"`)
      if (!members[agent].available) throw new Refusal(409, cleanCause(members[agent].cause))
      effective = agent
    } else if (needsAgent) {
      const def = board?.defaultAgent ?? null
      if (def === null) throw new Refusal(409, `#${number} has no agent to run with`)
      const members = board?.agents
      if (!board || !members || !Object.hasOwn(members, def)) throw new Refusal(409, `#${number} has no agent to run with`)
      if (!members[def].available) throw new Refusal(409, cleanCause(members[def].cause))
      effective = def
    } else {
      const def = board?.defaultAgent ?? null
      if (def !== null && board?.agents?.[def]?.available === false) throw new Refusal(409, cleanCause(board.agents[def].cause))
      effective = def
    }
    await press(number, card?.run, `#${number} has no step to start now`,
      () => openTab({ cwd: main, label: `#${number} ${card.step}`, command: lineOf(config.run, number, effective), isQuiet: true }))
  }

  const resume = async number => {
    const card = await issueCardOf(number)
    await press(number, card?.resume, `#${number} has no session to resume now`,
      () => openTab({ cwd: main, label: `#${number} ${card.step}`, command: lineOf(config.resume, number) }))
  }

  const shell = async number => {
    const card = await issueCardOf(number)
    if (card?.state !== 'dirty-tree' || !isInside(card.act) || resolve(card.act) === main) throw new Refusal(409, `#${number} has no dirty worktree`)
    await openTab({ cwd: resolve(card.act), label: `#${number} shell` })
  }

  const go = async sessionId => {
    const session = (await readSessions()).find(s => s.sessionId === sessionId)
    if (!session) throw new Refusal(404, 'no herdr agent of this repository has that id')
    if (!isPane(session.paneId)) throw new Refusal(409, 'that agent has no herdr pane id')
    await herdr('agent', 'focus', session.paneId)
  }

  const readBody = async request => {
    let text = ''
    for await (const chunk of request) {
      text += chunk
      if (text.length > 1024) throw new Refusal(400, 'the body is too long')
    }
    try { return JSON.parse(text) ?? {} } catch { throw new Refusal(400, 'the body is not JSON') }
  }

  const send = (response, status, type, content) => {
    response.writeHead(status, { 'Content-Type': type, 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    response.end(content)
  }
  const sendJson = (response, status, value) => send(response, status, 'application/json; charset=utf-8', JSON.stringify(value))

  const answer = async (request, response) => {
    const host = request.headers.host
    const { port } = server.address()
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) throw new Refusal(403, 'the Host is not this server')
    const path = request.url.split('?')[0]
    if (request.method === 'GET' && Object.hasOwn(FILES, path)) {
      const [name, type] = FILES[path]
      return send(response, 200, type, await readFile(join(HERE, name)))
    }
    if (request.method === 'GET' && path === '/api/board') {
      const isLocal = new URLSearchParams(request.url.split('?')[1] ?? '').get('local') === '1'
      if (!pending && !isLocal && now() - askedAt > STALE_MS) void refresh()
      if (!board && !error && pending) await pending
      return sendJson(response, 200, await placement({ isLocal }))
    }
    if (request.method !== 'POST' || !POSTS.has(path)) throw new Refusal(404, 'no such path')
    if (request.headers.origin !== `http://${host}`) throw new Refusal(403, 'the Origin is not this page')
    if (!/^application\/json\s*(;|$)/.test(request.headers['content-type'] ?? '')) throw new Refusal(403, 'the content type is not application/json')
    const input = await readBody(request)
    const starts = { '/api/run': runStep, '/api/resume': resume, '/api/shell': shell }
    if (Object.hasOwn(starts, path)) {
      const { number } = input
      if (!['number', 'string'].includes(typeof number) || !/^[1-9][0-9]*$/.test(String(number))) throw new Refusal(400, 'the number of the issue is not digits')
      if (path === '/api/run') await runStep(Number(number), input.agent)
      else await starts[path](Number(number))
    } else if (path === '/api/go') {
      await go(String(input.sessionId))
    } else if (path === '/api/agent') {
      throw new Refusal(409, 'The producer controls the default agent. Change it in the producer configuration.')
    } else {
      await refresh()
    }
    sendJson(response, 200, { ok: true })
  }

  const server = createServer((request, response) => {
    request.setEncoding('utf8')
    answer(request, response).catch(cause => {
      sendJson(response, cause instanceof Refusal ? cause.status : 500, { error: firstLine(String(cause.message)) || 'the server failed' })
    })
  })
  return server
}
