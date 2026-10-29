import type { Card, Column, Columns, Document, Flow, Issue, Placement, Session } from './types.ts';

type Snapshot = {
  tabs: { tab_id: string; label?: string }[];
  agents: {
    terminal_id: string;
    pane_id?: string;
    tab_id: string;
    agent?: string;
    agent_status: string;
    agent_session?: { kind?: string; agent?: string; value?: string } | null;
    state_change_seq?: number;
    cwd: string;
    foreground_cwd?: string;
  }[];
};

import { gateOf } from './view.ts';

const LABEL = /^#([1-9][0-9]*)(?: ([a-z]+))?/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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
        agentSessionId:
          (agent.agent === 'claude' || agent.agent === 'codex') &&
          agent.agent_session?.kind === 'id' &&
          agent.agent_session.agent === agent.agent &&
          typeof agent.agent_session.value === 'string' &&
          UUID.test(agent.agent_session.value)
            ? agent.agent_session.value
            : null,
        stateChangeSeq:
          Number.isSafeInteger(agent.state_change_seq) && Number(agent.state_change_seq) >= 0
            ? (agent.state_change_seq as number)
            : null,
        stepEnd: null,
        issue: issue ? Number(issue) : null,
        step: steps.has(step as string) ? (step as string) : null,
        label,
        cwd: agent.foreground_cwd ?? agent.cwd,
      };
    });
};

export const launchMatches = (issue: Issue | undefined, step: string | null) =>
  issue?.step === step &&
  (issue.state === 'ready' || issue.state === 'stuck' || (issue.state === 'blocked' && step === null));

const issueCard = (issue: Issue, extra: Partial<Card>): Card => ({
  sessionId: null,
  number: issue.number,
  title: issue.title,
  url: issue.url,
  type: issue.type,
  agent: null,
  step: null,
  gate: null,
  state: null,
  since: issue.updatedAt,
  act: null,
  reason: null,
  urgent: issue.urgent,
  assist: false,
  run: false,
  resume: false,
  go: false,
  pr: issue.pr,
  ...extra,
});

const PLACERS: Record<Issue['state'], (issue: Issue, context: { flow: Flow; isOpen: boolean }) => [Column, Card]> = {
  starting: (issue) => ['running', issueCard(issue, { step: issue.step, state: 'starts' })],
  dirty: (issue) => ['needs', issueCard(issue, { step: issue.step, state: 'dirty-tree', act: issue.path })],
  stuck: (issue, { isOpen }) => [
    'needs',
    issueCard(issue, { step: issue.step, state: 'no-progress', act: issue.act, run: isOpen, resume: isOpen }),
  ],
  blocked: (issue, { isOpen }) => [
    'needs',
    issueCard(issue, { state: 'blocked', reason: issue.reason, act: issue.act, assist: isOpen }),
  ],
  ready: (issue, { flow, isOpen }) => [
    issue.started || issue.urgent ? 'needs' : 'idle',
    issueCard(issue, { step: issue.step, gate: gateOf(flow, issue.step), run: isOpen }),
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
  const checking =
    ['idle', 'done'].includes(session.status) && (session.stepEnd === 'checking' || session.stepEnd === 'exiting');
  const [column, state, waitFor] = checking
    ? (['running', 'checks-step', null] as const)
    : Object.hasOwn(STATUSES, session.status)
      ? (STATUSES[session.status] as [Column, string, string | null])
      : (STATUSES.unknown as [Column, string, string | null]);
  return [
    session.issue === null ? 'human' : column,
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
      assist: false,
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
  human: (a, b) =>
    a.title.localeCompare(b.title, undefined, { numeric: true }) ||
    (a.sessionId as string).localeCompare(b.sessionId as string),
};

export const place = ({
  sessions,
  board,
  launches,
}: {
  sessions: Session[];
  board: Pick<Document, 'flow' | 'noRun' | 'issues'> | null;
  launches: Record<string, { step: string | null; expired: boolean }>;
}): Placement => {
  const columns: Columns = { needs: [], running: [], idle: [], human: [] };
  const issues = board?.issues ?? [];
  const noRun = board?.noRun ?? null;
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const busy = new Set(sessions.map((session) => session.issue));
  const placed = [
    ...sessions.map((session) => placeSession(session, byNumber.get(session.issue as number))),
    ...issues
      .filter((issue) => !busy.has(issue.number))
      .map((issue): [Column, Card] => {
        const launch = launches[issue.number];
        const feedback = launch && launchMatches(issue, launch.step) ? launch : null;
        const [column, card] = PLACERS[issue.state](issue, {
          flow: (board as Pick<Document, 'flow' | 'noRun' | 'issues'>).flow,
          isOpen: noRun === null && (!feedback || feedback.expired),
        });
        if (!feedback) return [column, card];
        if (feedback.expired) {
          card.warning = 'Session not detected. Check the terminal before starting again.';
          return [column, card];
        }
        return [
          'running',
          { ...card, state: 'starts', act: null, assist: false, run: false, resume: false, go: false },
        ];
      }),
  ];
  for (const [column, card] of placed) columns[column].push(card);
  for (const column of Object.keys(columns) as Column[]) columns[column].sort(ORDER[column]);
  return { noRun, columns };
};
