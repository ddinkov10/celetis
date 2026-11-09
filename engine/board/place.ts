import { basename, join, relative, resolve } from 'node:path';
import {
  type AgentState,
  hasVisualPage,
  isInside,
  laneOf,
  readAgentState,
  readDiff,
  readQueueState,
  readStepEnds,
} from '../lib/board-read.ts';
import type { DaemonStatus } from '../lib/daemon-types.ts';
import { isHost } from '../lib/host-names.ts';
import { bunArgs } from '../lib/process.ts';
import { daemonScript } from '../lib/process-identity.ts';
import type { QueueView } from '../lib/queue-types.ts';
import { stateOutcome } from '../lib/state.ts';
import { type Exec, LINK, listTerminals, readScreen } from '../lib/terminal.ts';
import type { Terminal, TerminalStatus } from '../lib/terminal-types.ts';
import { visualLink } from '../lib/visual.ts';
import type { Reads } from './reads.ts';
import { firstLine, refused } from './requests.ts';
import type {
  Board,
  BoardHistory,
  Card,
  Column,
  Columns,
  DaemonView,
  Diff,
  Document,
  Flow,
  IssueRow,
  LandedIssue,
  Placement,
  QuotaState,
  Session,
  VisualState,
} from './types.ts';
import { gateOf } from './view.ts';

const LABEL = /^#([1-9][0-9]*)(?: ([a-z]+))?/;
const INDEPENDENT = ['intake', 'assist', 'visual'].map((name) =>
  bunArgs(join(import.meta.dir, '..', `${name}.ts`), []),
);

export type LaunchFeedback = { step: string | null } & (
  | { kind: 'timed'; expired: boolean }
  | { kind: 'pending' }
  | { kind: 'failed'; warning: string }
);

const time = (iso: string) => Date.parse(iso);
const QUOTA_WAIT =
  'Every included agent reached a usage limit. The run waits; the agent order shows the resets and Retry.';
const QUOTA_ORPHAN = 'The run of this step stopped during a usage-limit recovery. Run starts the step again.';

export const stepsOf = (flow: Flow | null | undefined): Set<string> => new Set(Object.values(flow?.lanes ?? {}).flat());

export const sessionsOf = (terminals: Terminal[], isHere: (path: string) => boolean, steps: Set<string>): Session[] =>
  terminals.flatMap(({ id, host, status, turn, labels, cwd, foreground, tab }) => {
    const link = labels[LINK] ?? '';
    const words = foreground ?? [];
    const executable = basename(words[0] ?? '').replace(/\.exe$/, '');
    const isHost = executable === host;
    const isIndependent =
      executable === 'bun' && INDEPENDENT.some((args) => args.every((arg, index) => words[index + 1] === arg));
    const daemonAt = words.findIndex((word) => basename(word) === daemonScript);
    const isSession = daemonAt >= 0 && link !== '';
    if (!isHere(cwd) || host === null || status === null || !(isHost || isSession || isIndependent)) return [];
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

export const launchMatches = (issue: IssueRow | undefined, step: string | null) =>
  issue?.step === step &&
  (issue.state === 'ready' ||
    issue.state === 'starting' ||
    issue.state === 'stuck' ||
    (issue.state === 'blocked' && step === null));

const issueCard = (issue: IssueRow, extra: Partial<Card>): Card => ({
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
  epic: issue.epic,
  pr: issue.pr,
  ...extra,
});

const PLACERS: Record<
  IssueRow['state'],
  (issue: IssueRow, context: { flow: Flow; isOpen: boolean }) => [Column, Card]
> = {
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

const placeSession = (session: Session, issue: IssueRow | undefined): [Column, Card] => {
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
      epic: issue?.epic ?? null,
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
  quota = new Map(),
}: {
  sessions: Session[];
  board: Pick<Document, 'flow' | 'noRun' | 'issues'> | null;
  launches: Record<string, LaunchFeedback>;
  quota?: ReadonlyMap<number, QuotaState>;
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
        const recovery = quota.get(issue.number);
        if (recovery?.kind === 'waiting')
          return ['needs', issueCard(issue, { step: issue.step, state: 'quota-wait', reason: QUOTA_WAIT })];
        const launch = launches[issue.number];
        const feedback = launch && launchMatches(issue, launch.step) ? launch : null;
        const [column, card] = PLACERS[issue.state](issue, {
          flow: (board as Pick<Document, 'flow' | 'noRun' | 'issues'>).flow,
          isOpen:
            noRun === null &&
            (!feedback || feedback.kind === 'failed' || (feedback.kind === 'timed' && feedback.expired)),
        });
        const orphan = recovery?.kind === 'orphaned' ? QUOTA_ORPHAN : null;
        if (orphan) card.warning = orphan;
        if (!feedback) return [column, card];
        if (feedback.kind === 'failed') {
          card.warning = orphan ?? feedback.warning;
          return [column, card];
        }
        if (feedback.kind === 'timed' && feedback.expired) {
          card.warning = orphan ?? 'Session not detected. Check the terminal before starting again.';
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

const DIFF_MS = 15_000;
const SCREEN_LINES = 16;
const RULE = /^[\s─━═╌┄-]*$/;
const daemonView = (status: DaemonStatus): DaemonView => ({ pid: status.daemon.pid, auto: status.auto });
export const agentCause = (cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/\b(EACCES|EPERM)\b|permission denied/.test(message)) return 'access to local agent state was denied';
  if (/\b(ENOSPC|EDQUOT)\b/.test(message)) return 'local storage is full';
  if (/\bEROFS\b/.test(message)) return 'local agent state is on a read-only filesystem';
  const outcome = stateOutcome(cause);
  if (outcome?.kind === 'busy' && outcome.lock === 'agents') return 'the agent order is busy; try again';
  if (outcome?.kind === 'unsafe' && outcome.reason.startsWith('need a '))
    return 'local agent state has unsafe file permissions; check it in a terminal';
  if (
    /^recovery: (#[1-9][0-9]* (has no quota wait|waits with another wait ID; refresh, then use its Retry)|the run of #[1-9][0-9]* no longer runs; start the run again)$/.test(
      message,
    )
  )
    return message;
  if (message.includes('the celetis program is not installed')) return 'the celetis program is not installed';
  return 'local agent state could not be read or changed; check it in a terminal';
};
const screenOf = (text: string) =>
  text
    .replaceAll('\t', ' ')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .split('\n')
    .map((line) => line.replace(/^[\s│┃╭╮╰╯]+|[\s│┃╭╮╰╯]+$/g, ''))
    .filter((line) => !RULE.test(line))
    .slice(-SCREEN_LINES);

export type PressView = {
  nextRead(): number;
  follow(status: DaemonStatus, read: number, busy: ReadonlySet<number | null>): void;
  launches(
    issues: readonly IssueRow[] | undefined,
    busy: ReadonlySet<number | null>,
    checkedFrom: number,
  ): Record<string, LaunchFeedback>;
  isVisualPressed(number: number): boolean;
};
export type Placer = {
  placement(options?: { isLocal?: boolean }): Promise<Board>;
  queueView(): Promise<QueueView | null>;
  readSessions(): Promise<Session[]>;
  visualOf(row: LandedIssue, terminals: Terminal[], isPressed: boolean): Promise<VisualState>;
};

export const createPlacement = ({
  main,
  reads,
  presses,
  status,
  exec,
  now,
}: {
  main: string;
  reads: Reads;
  presses: PressView;
  status: () => Promise<DaemonStatus>;
  exec: Exec;
  now: () => number;
}): Placer => {
  let shown = new Map<string, number | null>();
  let firstSeen = new Map<string, number>();
  let screens = new Map<string, string[]>();
  const diffs = new Map<string, { at: number; value: Diff | null }>();
  let agentState: AgentState | null = null;
  let agentError: string | null = null;
  const { readError, refresh, target } = reads;

  const queueView = async (): Promise<QueueView | null> => {
    const projected = reads.document?.queue;
    try {
      const { record, owner, matches, next, actions } = await readQueueState(main, projected);
      if (reads.document && !reads.fullError && (!matches || owner !== projected?.owner)) void refresh();
      if (
        !matches ||
        reads.fullError ||
        (projected?.next?.kind === 'observed' && projected.next.reason === 'unreadable')
      ) {
        actions.continue = false;
        actions.retry = false;
        if (reads.fullError) {
          actions.add = false;
          actions.edit = false;
        }
      }
      return { record, owner, next, error: matches ? (projected?.error ?? null) : null, actions };
    } catch (cause) {
      return projected
        ? {
            ...projected,
            next: null,
            error: firstLine(cause instanceof Error ? cause.message : String(cause)),
            actions: { add: false, edit: false, continue: false, retry: false },
          }
        : null;
    }
  };

  const sessionsIn = (terminals: Terminal[]) =>
    sessionsOf(terminals, (path) => isInside(main, path), stepsOf(reads.document?.flow));
  const readSessions = async () => sessionsIn(await listTerminals(exec).catch(refused));

  const watchSessions = async () => {
    try {
      const terminals = await listTerminals(exec);
      const sessions = sessionsIn(terminals);
      const seen = new Map<string, number>();
      for (const session of sessions) {
        const status = session.status === 'done' || session.status === 'error' ? 'idle' : session.status;
        const key = `${session.sessionId}|${status}`;
        seen.set(key, firstSeen.get(key) ?? now());
        session.since = new Date(seen.get(key) as number).toISOString();
      }
      firstSeen = seen;
      return { terminals, sessions, health: { ok: true, error: null } };
    } catch (cause) {
      return { terminals: [], sessions: [], health: { ok: false, error: firstLine((cause as Error).message) } };
    }
  };

  const visualOf = async (row: LandedIssue, terminals: Terminal[], isPressed: boolean): Promise<VisualState> => {
    if (await hasVisualPage(main, row.sha)) return 'ready';
    if (isPressed) return 'starting';
    const link = visualLink(row.number);
    if (terminals.some((terminal) => terminal.labels[LINK] === link && isInside(main, terminal.cwd))) return 'making';
    return 'none';
  };

  const historyOf = async (terminals: Terminal[]): Promise<BoardHistory | null> => {
    const history = reads.document?.history;
    if (!history) return null;
    const entries = await Promise.all(
      history.entries.map(async (row) => ({
        ...row,
        visual: await visualOf(row, terminals, presses.isVisualPressed(row.number)),
      })),
    );
    return { ...history, entries };
  };

  const readScreens = async (sessions: Session[]) => {
    const read = await Promise.all(
      sessions.map(async (session) => {
        const text = await readScreen(session.sessionId, 0, exec);
        return [session.sessionId, text === null ? (screens.get(session.sessionId) ?? []) : screenOf(text)] as const;
      }),
    );
    screens = new Map(read);
  };

  const diffOf = async (cwd: string) => {
    const known = diffs.get(cwd);
    if (known && now() - known.at < DIFF_MS) return known.value;
    const value = await readDiff(main, cwd, exec);
    diffs.set(cwd, { at: now(), value });
    return value;
  };

  const placement = async ({ isLocal = false } = {}): Promise<Board> => {
    const queue = await queueView();
    const { terminals, sessions: found, health } = await watchSessions();
    const dispositions = await readStepEnds(
      main,
      found.flatMap((session) => (session.issue === null ? [] : [session.issue])),
    );
    const sessions: Session[] = [];
    for (const session of found) {
      const record = dispositions.get(session.issue as number);
      if (record?.terminal === session.sessionId) {
        session.stepEnd =
          record.turn?.terminalId === session.sessionId && record.turn.sequence === session.turn
            ? record.state
            : 'checking';
      }
      sessions.push(session);
    }
    if (!isLocal) await readScreens(sessions);
    for (const session of sessions) session.screen = screens.get(session.sessionId);
    const busy = new Set(sessions.map((session) => session.issue));
    const read = presses.nextRead();
    const daemon = await status();
    presses.follow(daemon, read, busy);
    const launches = presses.launches(reads.document?.issues, busy, reads.checkedFrom);
    try {
      agentState = await readAgentState(main, now());
      agentError = null;
    } catch (cause) {
      agentError = agentCause(cause);
    }
    const placed = place({ sessions, board: reads.document, launches, quota: agentState?.quota });
    const cards = Object.values(placed.columns).flat();
    const ids = new Map(cards.flatMap((card) => (card.sessionId ? [[card.sessionId, card.number] as const] : [])));
    const ended = [...shown].filter(([id]) => !ids.has(id)).map(([, number]) => number);
    shown = ids;
    target(ended.filter((number) => number !== null));
    if (ended.includes(null) && !isLocal) void refresh();
    await Promise.all(
      cards
        .filter((card) => card.sessionId)
        .map(async (card) => {
          const folder = (card.number !== null && (await laneOf(main, card.number))) || card.cwd;
          if (!isInside(main, folder)) return;
          card.diff = await diffOf(folder);
          card.cwd = relative(main, resolve(folder)) || '.';
        }),
    );
    const history = await historyOf(terminals);
    return {
      ...placed,
      history,
      flow: reads.document?.flow ?? null,
      tracker: reads.document?.tracker ?? null,
      daemon: daemonView(daemon),
      agents: reads.document?.agents ?? null,
      picker: agentState && {
        order: agentState.order,
        usage: agentState.usage,
        activeHosts: [...new Set(sessions.flatMap((session) => (isHost(session.agent) ? [session.agent] : [])))],
        waits: [...agentState.quota.values()].flatMap((state) => (state.kind === 'waiting' ? [state.wait] : [])),
        error: agentError,
      },
      next: agentState?.next ?? null,
      queue,
      terminal: health,
      source: { readAt: reads.readAt, error: readError() },
      repo: basename(main),
    };
  };

  return { placement, queueView, readSessions, visualOf };
};
