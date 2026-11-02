import { basename } from 'node:path';
import { LINK } from '../lib/terminal.ts';
import type { Terminal, TerminalStatus } from '../lib/terminal-types.ts';
import type { Card, Column, Columns, Document, Flow, Issue, Placement, Session } from './types.ts';
import { gateOf } from './view.ts';

const LABEL = /^#([1-9][0-9]*)(?: ([a-z]+))?/;
const RUNNER = 'celetis-flow.ts';

const time = (iso: string) => Date.parse(iso);

export const stepsOf = (flow: Flow | null | undefined): Set<string> => new Set(Object.values(flow?.lanes ?? {}).flat());

export const sessionsOf = (terminals: Terminal[], isHere: (path: string) => boolean, steps: Set<string>): Session[] =>
  terminals.flatMap(({ id, host, status, turn, labels, cwd, foreground, tab }) => {
    const link = labels[LINK] ?? '';
    const words = foreground ?? [];
    const isHost = basename(words[0] ?? '').replace(/\.exe$/, '') === host;
    const runner = words.findIndex((word) => basename(word) === RUNNER);
    const isRunner = runner >= 0 && (link !== '' || words.slice(runner + 1).includes('--resume'));
    if (!isHere(cwd) || host === null || status === null || !(isHost || isRunner)) return [];
    const [, issue, step = ''] = LABEL.exec(link) ?? [];
    return [
      {
        sessionId: id,
        agent: host,
        status,
        turn,
        stepEnd: null,
        issue: issue ? Number(issue) : null,
        step: steps.has(step) ? step : null,
        label: link || (tab ?? ''),
        cwd,
      },
    ];
  });

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
    issueCard(issue, { step: issue.step, gate: gateOf(flow, issue.step), run: isOpen, effort: issue.effort }),
  ],
};

const STATUSES: Record<TerminalStatus, [Column, string, string | null]> = {
  working: ['running', 'works', null],
  blocked: ['needs', 'waits', 'dialog'],
  idle: ['needs', 'waits', 'turn'],
  done: ['needs', 'waits', 'turn'],
  error: ['needs', 'waits', 'turn'],
};

const placeSession = (session: Session, issue: Issue | undefined): [Column, Card] => {
  const status = STATUSES[session.status];
  const [column, state, waitFor] =
    status[2] === 'turn' && (session.stepEnd === 'checking' || session.stepEnd === 'exiting')
      ? (['running', 'checks-step', null] as const)
      : status;
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
          { ...card, state: 'starts', act: null, assist: false, run: false, resume: false, go: false, effort: null },
        ];
      }),
  ];
  for (const [column, card] of placed) columns[column].push(card);
  for (const column of Object.keys(columns) as Column[]) columns[column].sort(ORDER[column]);
  return { noRun, columns };
};
