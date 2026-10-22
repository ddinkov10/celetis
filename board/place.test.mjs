import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activePresses, place, sessionsOf, stepsOf } from './place.mjs'

const NOW = Date.parse('2026-10-08T12:00:00Z')
const ago = seconds => new Date(NOW - seconds * 1000).toISOString()
const FLOW = {
  lanes: { feature: ['triage', 'specify', 'plan', 'implement'], bug: ['triage', 'bug', 'plan', 'implement'], chore: ['triage', 'chore'], hotfix: ['triage', 'hotfix'] },
  stages: [{ name: 'Triage', steps: ['triage'] }, { name: 'Define', steps: ['specify', 'bug', 'chore', 'hotfix'] }, { name: 'Plan', steps: ['plan'] }, { name: 'Implement', steps: ['implement'] }],
  steps: { plan: { gate: 'auto' }, implement: { gate: 'me', hint: 'It lands the change when the build is done.' } },
}
const row = (number, state, extra = {}) => ({
  number, title: `Issue ${number}`, url: `https://example.test/issues/${number}`, type: 'bug', state, updatedAt: ago(600), closedAt: null, pr: null, ...extra,
})
const ready = (number, step, extra = {}) => row(number, 'ready', { step, ...extra })
const session = (sessionId, extra = {}) => ({
  sessionId, paneId: 'w2:p8', agent: 'claude', status: 'working', issue: null, step: null, label: 'scratch', cwd: '/repo', since: ago(300), ...extra,
})
const cards = ({ sessions = [], issues = [], noRun = null, presses = {}, can = { run: true, resume: true } }) => {
  const { columns } = place({ sessions, board: { flow: FLOW, noRun, issues }, presses, can })
  return Object.entries(columns).flatMap(([column, list]) => list.map(card => ({ column, ...card })))
}
const pick = (card, keys) => Object.fromEntries(keys.map(key => [key, card[key]]))

const RULES = [
  ['done is in Done, with closedAt as its time', row(1, 'done', { closedAt: ago(60) }), { column: 'done', state: null, act: null, run: false, resume: false, since: ago(60) }],
  ['starting is in Running', row(1, 'starting', { step: 'plan' }), { column: 'running', state: 'starts', step: 'plan', run: false }],
  ['dirty is in Needs you with its path', row(1, 'dirty', { step: 'plan', path: '/w/1-x' }), { column: 'needs', state: 'dirty-tree', act: '/w/1-x', step: 'plan', run: false }],
  ['stuck is in Needs you with the act of its row', row(1, 'stuck', { step: 'implement', act: 'claude --resume "#1 implement"' }),
    { column: 'needs', state: 'no-progress', act: 'claude --resume "#1 implement"', step: 'implement', run: true, resume: true }],
  ['blocked is in Needs you with its reason', row(1, 'blocked', { reason: 'needs info', act: 'Answer the questions.' }),
    { column: 'needs', state: 'blocked', reason: 'needs info', act: 'Answer the questions.', step: null, run: false }],
  ['ready and started is in Needs you', ready(1, 'plan', { started: true }), { column: 'needs', state: null, step: 'plan', gate: 'auto', run: true, resume: false }],
  ['ready and urgent is in Needs you', ready(1, 'hotfix', { type: 'hotfix', urgent: true }), { column: 'needs', step: 'hotfix', gate: null, run: true }],
  ['ready is in Idle', ready(1, 'triage'), { column: 'idle', state: null, step: 'triage', gate: null, run: true }],
]

for (const [name, issue, expected] of RULES) {
  test(name, () => {
    const found = cards({ issues: [issue] })
    assert.equal(found.length, 1)
    assert.deepEqual(pick(found[0], Object.keys(expected)), expected)
    assert.deepEqual(pick(found[0], ['sessionId', 'number', 'title', 'url', 'type', 'go']),
      { sessionId: null, number: 1, title: 'Issue 1', url: 'https://example.test/issues/1', type: issue.type, go: false })
  })
}

test('a working session is in Running and a waiting session is in Needs you', () => {
  const found = cards({
    sessions: [session('a', { issue: 1, step: 'plan' }), session('b', { issue: 2, status: 'idle', since: ago(720) })],
    issues: [ready(1, 'plan'), ready(2, 'bug')],
  })
  assert.deepEqual(found.map(card => pick(card, ['column', 'sessionId', 'number', 'title', 'type', 'step', 'gate', 'state', 'since', 'run', 'go'])), [
    { column: 'needs', sessionId: 'b', number: 2, title: 'Issue 2', type: 'bug', step: null, gate: null, state: 'waits', since: ago(720), run: false, go: true },
    { column: 'running', sessionId: 'a', number: 1, title: 'Issue 1', type: 'bug', step: 'plan', gate: null, state: 'works', since: ago(300), run: false, go: true },
  ])
})

test('each state of a herdr agent has its column, its state, and what it waits for', () => {
  const found = cards({ sessions: ['working', 'blocked', 'idle', 'done', 'unknown', 'new-state'].map(status => session(status, { status })) })
  assert.deepEqual(Object.fromEntries(found.map(card => [card.sessionId, [card.column, card.state, card.waitFor]])), {
    working: ['running', 'works', null], blocked: ['needs', 'waits', 'dialog'], idle: ['needs', 'waits', 'turn'],
    done: ['needs', 'waits', 'turn'], unknown: ['running', 'unknown', null], 'new-state': ['running', 'unknown', null],
  })
})

test('a state of a herdr agent that is a key that each object inherits is an unknown state', () => {
  const [found] = cards({ sessions: [session('a', { status: 'constructor' })] })
  assert.deepEqual([found.column, found.state, found.waitFor], ['running', 'unknown', null])
})

test('sessionsOf reads the issue and the step from the tab label, and keeps only the agents in the repository', () => {
  const agent = (terminal, tab, extra) => ({ terminal_id: terminal, pane_id: `w1:${terminal}`, tab_id: tab, agent: 'claude', agent_status: 'idle', cwd: '/repo', ...extra })
  const snapshot = {
    tabs: [{ tab_id: 't1', label: '#402 plan' }, { tab_id: 't2', label: '#7 shell' }, { tab_id: 't3', label: 'notes' }, { tab_id: 't4', label: '#12' }, { tab_id: 't5', label: '#5 finish' }],
    agents: [
      agent('a', 't1', { foreground_cwd: '/repo/.claude/worktrees/402-x' }), agent('b', 't2', { agent: undefined, agent_status: 'working' }),
      agent('c', 't3'), agent('d', 't4'), agent('h', 't5'), agent('e', 't9'), agent('f', 't1', { cwd: '/elsewhere' }), agent('g', 't1', { cwd: '/repo', foreground_cwd: '/elsewhere' }),
    ],
  }
  const isHere = path => path?.startsWith('/repo') ?? false
  const found = sessionsOf(snapshot, isHere, stepsOf(FLOW))
  assert.deepEqual(found.map(s => [s.sessionId, s.issue, s.step, s.label]), [['a', 402, 'plan', '#402 plan'], ['b', 7, null, '#7 shell'], ['c', null, null, 'notes'], ['d', 12, null, '#12'], ['h', 5, null, '#5 finish'], ['e', null, null, '']])
  assert.deepEqual(pick(found[0], ['paneId', 'agent', 'status', 'cwd']), { paneId: 'w1:a', agent: 'claude', status: 'idle', cwd: '/repo/.claude/worktrees/402-x' })
  assert.deepEqual(pick(found[1], ['agent', 'status', 'cwd']), { agent: null, status: 'working', cwd: '/repo' })
  assert.deepEqual([...stepsOf(FLOW)].sort(), ['bug', 'chore', 'hotfix', 'implement', 'plan', 'specify', 'triage'])
  assert.deepEqual(sessionsOf(snapshot, isHere, stepsOf(null)).map(s => s.step), Array(6).fill(null))
  assert.equal(stepsOf(null).size, 0)
})

test('the state of a session wins over the state of its issue, Done included', () => {
  const found = cards({ sessions: [session('a', { issue: 1 })], issues: [row(1, 'done', { closedAt: ago(60) })] })
  assert.deepEqual(found.map(card => [card.column, card.sessionId]), [['running', 'a']])
})

test('two live sessions on one issue make two cards, and the issue makes none', () => {
  const found = cards({ sessions: [session('a', { issue: 1 }), session('b', { issue: 1 })], issues: [ready(1, 'plan')] })
  assert.deepEqual(found.map(card => card.sessionId).sort(), ['a', 'b'])
})

test('a session card names the agent that herdr found, and an issue card names none', () => {
  const found = cards({ sessions: [session('a', { issue: 1, agent: 'opencode' }), session('b', { issue: 2, agent: null })], issues: [ready(1, 'plan'), ready(2, 'plan'), ready(3, 'plan')] })
  assert.deepEqual(found.map(card => [card.sessionId ?? card.number, card.agent]).sort(), [[3, null], ['a', 'opencode'], ['b', null]])
})

test('a session card carries the screen lines and the folder of its pane', () => {
  const found = cards({ sessions: [session('a', { status: 'blocked', screen: ['Bash command', 'git push'], cwd: '/repo/.claude/worktrees/1-x' }), session('b', { cwd: undefined })] })
  assert.deepEqual(found.map(card => pick(card, ['sessionId', 'screen', 'cwd'])), [
    { sessionId: 'a', screen: ['Bash command', 'git push'], cwd: '/repo/.claude/worktrees/1-x' },
    { sessionId: 'b', screen: [], cwd: null },
  ])
})

test('each card carries the pull request of its issue', () => {
  const pr = { number: 9, url: 'https://example.test/pull/9', draft: false, checks: 'fail', review: null }
  const found = cards({ sessions: [session('a', { issue: 1 })], issues: [ready(1, 'implement', { pr }), ready(2, 'chore', { pr }), ready(3, 'plan')] })
  assert.deepEqual(found.map(card => [card.sessionId ?? card.number, card.pr?.number ?? null]).sort(), [[2, 9], [3, null], ['a', 9]])
})

test('an urgent card is before every other card in Needs you, and a dialog comes before other waits', () => {
  const found = cards({
    sessions: [session('a', { status: 'idle', since: ago(900) }), session('b', { status: 'blocked', since: ago(10) })],
    issues: [ready(1, 'plan', { started: true, updatedAt: ago(5000) }), ready(2, 'hotfix', { urgent: true, updatedAt: ago(1) })],
  })
  assert.deepEqual(found.map(card => [card.column, card.sessionId ?? card.number]), [['needs', 2], ['needs', 'b'], ['needs', 1], ['needs', 'a']])
})

test('a session with no issue shows its tab label', () => {
  const [card] = cards({ sessions: [session('a', { label: 'look at the logs' })] })
  assert.deepEqual(pick(card, ['number', 'title', 'url', 'type']), { number: null, title: 'look at the logs', url: null, type: null })
})

test('a session whose issue is not in the data keeps its number', () => {
  const [card] = cards({ sessions: [session('a', { issue: 9, step: 'plan', label: '#9 plan' })] })
  assert.deepEqual(pick(card, ['number', 'title', 'url']), { number: 9, title: '#9 plan', url: null })
})

test('no card has Run or Resume while the data gives a noRun text, and Run and Resume each need their entry of the config', () => {
  const issues = [ready(1, 'plan', { started: true }), row(2, 'stuck', { step: 'plan', act: 'x' })]
  assert.deepEqual(cards({ issues, noRun: 'The main checkout is dirty.' }).map(c => [c.run, c.resume]), [[false, false], [false, false]])
  assert.equal(place({ sessions: [], board: { flow: FLOW, noRun: 'n', issues }, presses: {}, can: { run: true, resume: true } }).noRun, 'n')
  assert.deepEqual(cards({ issues, can: { run: false, resume: true } }).map(c => [c.number, c.run, c.resume]).sort(), [[1, false, false], [2, false, true]])
  assert.deepEqual(cards({ issues, can: { run: true, resume: false } }).map(c => [c.number, c.run, c.resume]).sort(), [[1, true, false], [2, true, false]])
})

test('an urgent card is first in Needs you, and the session of an urgent issue too', () => {
  const found = cards({ sessions: [session('a', { status: 'idle', issue: 3, since: ago(5) })],
    issues: [ready(1, 'plan', { started: true, updatedAt: ago(5000) }), ready(2, 'hotfix', { urgent: true, updatedAt: ago(100) }), ready(3, 'hotfix', { urgent: true })] })
  assert.deepEqual(found.map(card => card.sessionId ?? card.number), [2, 'a', 1])
})

test('a card has no Run or Resume after a press', () => {
  const issues = [ready(1, 'plan'), ready(2, 'plan'), row(3, 'stuck', { step: 'plan', act: 'x' }), row(4, 'stuck', { step: 'plan', act: 'x' })]
  const found = cards({ issues, presses: { 1: NOW - 1000, 3: NOW - 1000 } })
  assert.deepEqual(found.map(card => [card.number, card.run, card.resume]).sort(), [[1, false, false], [2, true, false], [3, false, false], [4, true, true]])
})

test('a press holds Run for 30 seconds, or until the starting row or a session of the issue shows', () => {
  const presses = { 1: NOW - 29_999, 2: NOW - 30_000, 3: NOW - 1000, 4: NOW - 1000, 5: NOW - 1000 }
  const sessions = [session('a', { issue: 3 })]
  const board = { flow: FLOW, noRun: null, issues: [row(4, 'starting', { step: 'plan' })] }
  assert.deepEqual(activePresses(presses, sessions, board, NOW), { 1: NOW - 29_999, 5: NOW - 1000 })
  assert.deepEqual(activePresses(presses, [], null, NOW), { 1: NOW - 29_999, 3: NOW - 1000, 4: NOW - 1000, 5: NOW - 1000 })
})

test('Needs you has the longest wait first', () => {
  const found = cards({
    sessions: [session('a', { status: 'idle', since: ago(100) })],
    issues: [ready(1, 'plan', { started: true, updatedAt: ago(50) }), ready(2, 'plan', { started: true, updatedAt: ago(900) })],
  })
  assert.deepEqual(found.map(card => card.sessionId ?? card.number), [2, 'a', 1])
})

test('Running has the newest first', () => {
  const found = cards({ sessions: [session('a', { since: ago(900) }), session('b', { since: ago(30) })], issues: [row(1, 'starting', { step: 'plan', updatedAt: ago(100) })] })
  assert.deepEqual(found.map(card => card.sessionId ?? card.number), ['b', 1, 'a'])
})

test('Idle has the highest number first, and Done has the last close first', () => {
  const finished = (number, seconds) => row(number, 'done', { closedAt: ago(seconds) })
  const found = cards({ issues: [ready(7, 'bug'), ready(123, 'triage'), ready(40, 'chore'), finished(5, 900), finished(6, 60), finished(4, 300)] })
  assert.deepEqual(found.map(card => card.number), [123, 40, 7, 6, 4, 5])
})

test('no data of the issues gives the session cards only', () => {
  const { noRun, columns } = place({ sessions: [session('a')], board: null, presses: {}, can: { run: true, resume: true } })
  assert.equal(noRun, null)
  assert.deepEqual([columns.needs.length, columns.running.length, columns.idle.length, columns.done.length], [0, 1, 0, 0])
})
