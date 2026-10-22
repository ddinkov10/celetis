import { gateOf } from './view.mjs'

const PRESS_MS = 30_000
const LABEL = /^#([1-9][0-9]*)(?: ([a-z]+))?/

const time = iso => Date.parse(iso)

export const stepsOf = flow => new Set(Object.values(flow?.lanes ?? {}).flat())

export const sessionsOf = (snapshot, isHere, steps) => {
  const labels = new Map(snapshot.tabs.map(tab => [tab.tab_id, tab.label]))
  return snapshot.agents.filter(agent => isHere(agent.foreground_cwd ?? agent.cwd)).map(agent => {
    const label = labels.get(agent.tab_id) ?? ''
    const [, issue, step] = LABEL.exec(label) ?? []
    return {
      sessionId: agent.terminal_id, paneId: agent.pane_id, agent: agent.agent ?? null, status: agent.agent_status,
      issue: issue ? Number(issue) : null, step: steps.has(step) ? step : null, label, cwd: agent.foreground_cwd ?? agent.cwd,
    }
  })
}

export const activePresses = (presses, sessions, board, now) => {
  const busy = new Set(sessions.map(session => session.issue))
  for (const issue of board?.issues ?? []) if (issue.state === 'starting') busy.add(issue.number)
  return Object.fromEntries(Object.entries(presses).filter(([number, at]) => now - at < PRESS_MS && !busy.has(Number(number))))
}

const issueCard = (issue, extra) => ({
  sessionId: null, number: issue.number, title: issue.title, url: issue.url ?? null, type: issue.type ?? null, agent: null,
  step: null, gate: null, state: null, since: issue.updatedAt, act: null, reason: null, urgent: issue.urgent === true,
  run: false, resume: false, go: false, pr: issue.pr ?? null, ...extra,
})

const PLACERS = {
  done: issue => ['done', issueCard(issue, { since: issue.closedAt })],
  starting: issue => ['running', issueCard(issue, { step: issue.step ?? null, state: 'starts' })],
  dirty: issue => ['needs', issueCard(issue, { step: issue.step ?? null, state: 'dirty-tree', act: issue.path })],
  stuck: (issue, { can }) => ['needs', issueCard(issue, { step: issue.step, state: 'no-progress', act: issue.act ?? null, run: can.run, resume: can.resume })],
  blocked: issue => ['needs', issueCard(issue, { state: 'blocked', reason: issue.reason, act: issue.act ?? null })],
  ready: (issue, { flow, can }) => [issue.started === true || issue.urgent === true ? 'needs' : 'idle',
    issueCard(issue, { step: issue.step, gate: gateOf(flow, issue.step), run: can.run })],
}

// herdr's agent_status: blocked is an approval or question dialog; idle and done both wait for the next prompt.
const STATUSES = {
  working: ['running', 'works', null], unknown: ['running', 'unknown', null],
  blocked: ['needs', 'waits', 'dialog'], idle: ['needs', 'waits', 'turn'], done: ['needs', 'waits', 'turn'],
}

const placeSession = (session, issue) => {
  const [column, state, waitFor] = Object.hasOwn(STATUSES, session.status) ? STATUSES[session.status] : STATUSES.unknown
  return [column, {
    sessionId: session.sessionId, number: session.issue, title: issue?.title ?? session.label, url: issue?.url ?? null,
    type: issue?.type ?? null, agent: session.agent, step: session.step, gate: null, state, since: session.since, act: null, reason: null,
    urgent: issue?.urgent === true, run: false, resume: false, go: true, pr: issue?.pr ?? null, waitFor, screen: session.screen ?? [], cwd: session.cwd ?? null,
  }]
}

const rank = card => (card.urgent ? 0 : 2) + (card.waitFor === 'dialog' ? 0 : 1)

const ORDER = {
  needs: (a, b) => rank(a) - rank(b) || time(a.since) - time(b.since),
  running: (a, b) => time(b.since) - time(a.since),
  idle: (a, b) => b.number - a.number,
  done: (a, b) => time(b.since) - time(a.since),
}

export const place = ({ sessions, board, presses, can }) => {
  const columns = { needs: [], running: [], idle: [], done: [] }
  const issues = board?.issues ?? []
  const noRun = board?.noRun ?? null
  const byNumber = new Map(issues.map(issue => [issue.number, issue]))
  const busy = new Set(sessions.map(session => session.issue))
  const canFor = issue => {
    const open = noRun === null && !(issue.number in presses)
    return { run: can.run && open, resume: can.resume && open }
  }
  const placed = [
    ...sessions.map(session => placeSession(session, byNumber.get(session.issue))),
    ...issues.filter(issue => !busy.has(issue.number)).map(issue => PLACERS[issue.state](issue, { flow: board.flow, can: canFor(issue) })),
  ]
  for (const [column, card] of placed) columns[column].push(card)
  for (const column of Object.keys(columns)) columns[column].sort(ORDER[column])
  return { noRun, columns }
}
