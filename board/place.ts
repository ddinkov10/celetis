import type { Capability, Card, Column, Columns, Document, Flow, Issue, Placement, Session } from './types.ts';

type Snapshot = {
  tabs: { tab_id: string; label?: string }[];
  agents: {
    terminal_id: string;
    pane_id?: string;
    tab_id: string;
    agent?: string;
    agent_status: string;
    cwd: string;
    foreground_cwd?: string;
  }[];
};

import { gateOf } from './view.ts';

const PRESS_MS = 30_000;
const LABEL = /^#([1-9][0-9]*)(?: ([a-z]+))?/;

const time = (iso: string) => Date.parse(iso);

export const stepsOf = (flow: Flow | null | undefined): Set<string> => new Set(Object.values(flow?.lanes ?? {}).flat());

export const sessionsOf = (snapshot: Snapshot, isHere: (path: string) => boolean, steps: Set<string>): Session[] => {
  const labels = new Map(snapshot.tabs.map((tab) => [tab.tab_id, tab.label]));
  return snapshot.agents
    .filter((agent) => isHere(agent.foreground_cwd ?? agent.cwd))
    .map((agent) => {
      const label = labels.get(agent.tab_id) ?? '';
      const [, issue, step] = LABEL.exec(label) ?? [];
      return {
        sessionId: agent.terminal_id,
        paneId: agent.pane_id,
        agent: agent.agent ?? null,
        status: agent.agent_status,
        issue: issue ? Number(issue) : null,
        step: steps.has(step as string) ? (step as string) : null,
        label,
        cwd: agent.foreground_cwd ?? agent.cwd,
      };
    });
};

export const activePresses = (
  presses: Record<string, number>,
  sessions: Session[],
  board: Pick<Document, 'flow' | 'noRun' | 'issues'> | null,
  now: number,
) => {
  const busy = new Set(sessions.map((session) => session.issue));
  for (const issue of board?.issues ?? []) if (issue.state === 'starting') busy.add(issue.number);
  return Object.fromEntries(
    Object.entries(presses).filter(([number, at]) => now - at < PRESS_MS && !busy.has(Number(number))),
  );
};

const issueCard = (issue: Issue, extra: Partial<Card>): Card => ({
  sessionId: null,
  number: issue.number,
  title: issue.title,
  url: issue.url ?? null,
  type: issue.type ?? null,
  agent: null,
  step: null,
  gate: null,
  state: null,
  since: issue.updatedAt,
  act: null,
  reason: null,
  urgent: issue.urgent === true,
  run: false,
  resume: false,
  go: false,
  pr: issue.pr ?? null,
  ...extra,
});

const PLACERS: Record<Issue['state'], (issue: Issue, context: { flow: Flow; can: Capability }) => [Column, Card]> = {
  done: (issue) => ['done', issueCard(issue, { since: issue.closedAt as string })],
  starting: (issue) => ['running', issueCard(issue, { step: issue.step ?? null, state: 'starts' })],
  dirty: (issue) => ['needs', issueCard(issue, { step: issue.step ?? null, state: 'dirty-tree', act: issue.path })],
  stuck: (issue, { can }) => [
    'needs',
    issueCard(issue, {
      step: issue.step as string,
      state: 'no-progress',
      act: issue.act ?? null,
      run: can.run,
      resume: can.resume,
    }),
  ],
  blocked: (issue) => ['needs', issueCard(issue, { state: 'blocked', reason: issue.reason, act: issue.act ?? null })],
  ready: (issue, { flow, can }) => [
    issue.started === true || issue.urgent === true ? 'needs' : 'idle',
    issueCard(issue, { step: issue.step as string, gate: gateOf(flow, issue.step as string), run: can.run }),
  ],
};

const STATUSES: Record<string, [Column, string, string | null]> = {
  working: ['running', 'works', null],
  unknown: ['running', 'unknown', null],
  blocked: ['needs', 'waits', 'dialog'],
  idle: ['needs', 'waits', 'turn'],
  done: ['needs', 'waits', 'turn'],
};

const placeSession = (session: Session, issue: Issue | undefined): [Column, Card] => {
  const [column, state, waitFor] = Object.hasOwn(STATUSES, session.status)
    ? (STATUSES[session.status] as [Column, string, string | null])
    : (STATUSES.unknown as [Column, string, string | null]);
  return [
    column,
    {
      sessionId: session.sessionId,
      number: session.issue,
      title: issue?.title ?? session.label,
      url: issue?.url ?? null,
      type: issue?.type ?? null,
      agent: session.agent,
      step: session.step,
      gate: null,
      state,
      since: session.since as string,
      act: null,
      reason: null,
      urgent: issue?.urgent === true,
      run: false,
      resume: false,
      go: true,
      pr: issue?.pr ?? null,
      waitFor,
      screen: session.screen ?? [],
      cwd: session.cwd ?? null,
    },
  ];
};

const rank = (card: Card) => (card.urgent ? 0 : 2) + (card.waitFor === 'dialog' ? 0 : 1);

const ORDER: Record<Column, (a: Card, b: Card) => number> = {
  needs: (a, b) => rank(a) - rank(b) || time(a.since) - time(b.since),
  running: (a, b) => time(b.since) - time(a.since),
  idle: (a, b) => (b.number as number) - (a.number as number),
  done: (a, b) => time(b.since) - time(a.since),
};

export const place = ({
  sessions,
  board,
  presses,
  can,
}: {
  sessions: Session[];
  board: Pick<Document, 'flow' | 'noRun' | 'issues'> | null;
  presses: Record<string, number>;
  can: Capability;
}): Placement => {
  const columns: Columns = { needs: [], running: [], idle: [], done: [] };
  const issues = board?.issues ?? [];
  const noRun = board?.noRun ?? null;
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const busy = new Set(sessions.map((session) => session.issue));
  const canFor = (issue: Issue) => {
    const open = noRun === null && !(issue.number in presses);
    return { run: can.run && open, resume: can.resume && open };
  };
  const placed = [
    ...sessions.map((session) => placeSession(session, byNumber.get(session.issue as number))),
    ...issues
      .filter((issue) => !busy.has(issue.number))
      .map((issue) =>
        PLACERS[issue.state](issue, {
          flow: (board as Pick<Document, 'flow' | 'noRun' | 'issues'>).flow,
          can: canFor(issue),
        }),
      ),
  ];
  for (const [column, card] of placed) columns[column].push(card);
  for (const column of Object.keys(columns) as Column[]) columns[column].sort(ORDER[column]);
  return { noRun, columns };
};
