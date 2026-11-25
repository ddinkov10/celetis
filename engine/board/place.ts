import { basename, dirname, join, relative, resolve } from 'node:path';
import {
  type AgentState,
  hasVisualPage,
  isInside,
  labelOf,
  laneOf,
  mainNoRun,
  readAgentState,
  readDiff,
  readQueueState,
  readStepEnds,
} from '../lib/board-read/board-read.ts';
import type { CoordinatorFacts } from '../lib/coordinator/types.ts';
import {
  codexStopLine,
  type DaemonStatus,
  type LandingRow,
  type RunRow,
  stopKeptLine,
  unprovedStopAct,
} from '../lib/daemon/types.ts';
import { isHost, registry } from '../lib/host/names.ts';
import { daemonScript } from '../lib/process/identity.ts';
import { bunArgs } from '../lib/process/process.ts';
import type { QueueView } from '../lib/queue/types.ts';
import { stateOutcome } from '../lib/state/state.ts';
import { type Exec, LINK, listTerminals, readScreen, terminalState } from '../lib/terminal/terminal.ts';
import type { Terminal, TerminalStatus } from '../lib/terminal/types.ts';
import { grammar } from '../lib/tracker/grammar.ts';
import { compareKeys, type IssueKey, keySource, parseKey } from '../lib/tracker/key.ts';
import { visualLink } from '../lib/workflow/visual.ts';
import type { CoordinatorReads } from './coordinator.ts';
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
  Placement,
  QuotaState,
  Session,
  Trends,
  VisualState,
} from './types.ts';
import { gateOf } from './view.ts';

const INDEPENDENT_COMMANDS = ['intake', 'assist', 'visual'];
const INDEPENDENT = INDEPENDENT_COMMANDS.map((name) => bunArgs(join(import.meta.dir, '..', `${name}.ts`), []));
const FLAGS = bunArgs('', []).slice(0, -1);

// The tabs of an older engine version stay open across an update, so an entry matches by its shape, not by its path.
const isEntry = (word = '') => basename(word) === 'celetis' && basename(dirname(word)) === 'engine';
const isLaunched = (words: string[]) => {
  if (!FLAGS.every((arg, index) => words[index + 1] === arg) || !isEntry(words[FLAGS.length + 1])) return false;
  const [first, second, third] = words.slice(FLAGS.length + 2);
  return INDEPENDENT_COMMANDS.includes((first === '--agent' && isHost(second) ? third : first) ?? '');
};

export type LaunchFeedback = { step: string | null } & (
  | { kind: 'timed'; expired: boolean }
  | { kind: 'pending' }
  | { kind: 'failed'; warning: string }
);

const time = (iso: string) => Date.parse(iso);
const QUOTA_WAIT =
  'Every included agent reached a usage limit. The run waits; the agent order shows the resets and Retry.';
const STOPPING = 'The daemon ends the session. The card moves to Idle when the session has ended.';
const STOPPABLE: ReadonlySet<RunRow['state']> = new Set(['running', 'waiting', 'checking', 'stopping']);
const QUOTA_ORPHAN = 'The run of this step stopped during a usage-limit recovery. Run starts the step again.';

export const stepsOf = (flow: Flow | null | undefined): Set<string> => new Set(Object.keys(flow?.steps ?? {}));

export const sessionsOf = (terminals: Terminal[], isHere: (path: string) => boolean, steps: Set<string>): Session[] =>
  terminals.flatMap(({ id, host, status, turn, labels, cwd, foreground, tab }) => {
    const link = labels[LINK] ?? '';
    const words = foreground ?? [];
    const executable = basename(words[0] ?? '').replace(/\.exe$/, '');
    const isHost = executable === host;
    const isIndependent =
      executable === 'bun' &&
      (INDEPENDENT.some((args) => args.every((arg, index) => words[index + 1] === arg)) || isLaunched(words));
    const isSession =
      words.some((word, at) => basename(word) === daemonScript || (isEntry(word) && words[at + 1] === 'daemon')) &&
      link !== '';
    if (!isHere(cwd) || host === null || status === null || !(isHost || isSession || isIndependent)) return [];
    const label = labelOf(link);
    const step = label?.word ?? '';
    return [
      {
        sessionId: id,
        agent: host,
        status,
        turn,
        stepEnd: null,
        issue: label ? label.key : null,
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
    issue.state === 'aside' ||
    (issue.state === 'blocked' && step === null));

const webUrl = (url: string | undefined) =>
  url !== undefined && ['http:', 'https:'].includes(URL.parse(url)?.protocol ?? '') ? url : null;

const issueCard = (issue: IssueRow, extra: Partial<Card>): Card => ({
  sessionId: null,
  number: issue.number,
  title: issue.title,
  url: webUrl(issue.url),
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
  aside: false,
  hold: issue.holdable,
  epic: issue.epic,
  pr: issue.pr,
  ...extra,
});

const PLACERS: Record<
  IssueRow['state'],
  (issue: IssueRow, context: { flow: Flow; isOpen: boolean; landings: readonly LandingRow[] }) => [Column, Card]
> = {
  starting: (issue) => ['running', issueCard(issue, { step: issue.step, state: 'starts' })],
  aside: (issue, { isOpen }) => [
    'idle',
    issueCard(issue, {
      step: issue.step,
      state: 'set-aside',
      act: issue.act,
      path: issue.path,
      run: isOpen,
      resume: isOpen,
    }),
  ],
  dirty: (issue, { isOpen }) => [
    'needs',
    issueCard(issue, { step: issue.step, state: 'dirty-tree', act: issue.path, aside: isOpen }),
  ],
  stuck: (issue, { isOpen }) => [
    'needs',
    issueCard(issue, {
      step: issue.step,
      state: 'no-progress',
      act: issue.act,
      run: isOpen,
      resume: isOpen,
      aside: isOpen,
    }),
  ],
  blocked: (issue, { isOpen }) => [
    'needs',
    issueCard(issue, { state: 'blocked', reason: issue.reason, act: issue.act, assist: isOpen }),
  ],
  held: (issue, { landings }) => [
    'needs',
    issueCard(issue, {
      state: 'held',
      reason: issue.reason,
      act: issue.act,
      held: issue.held,
      landing: landings.find((row) => row.issue === issue.number)?.state ?? null,
    }),
  ],
  ready: (issue, { flow, isOpen }) => [
    issue.started || issue.urgent ? 'needs' : 'idle',
    issueCard(issue, {
      step: issue.step,
      gate: gateOf(flow, issue.type, issue.step),
      run: isOpen,
      effort: issue.effort,
    }),
  ],
};

const STATUSES: Record<TerminalStatus, [Column, string, string | null]> = {
  working: ['running', 'works', null],
  blocked: ['needs', 'waits', 'dialog'],
  idle: ['needs', 'waits', 'turn'],
  done: ['needs', 'waits', 'turn'],
  error: ['needs', 'waits', 'turn'],
};

const placeSession = (
  session: Session,
  issue: IssueRow | undefined,
  runs: readonly RunRow[],
  landings: readonly LandingRow[],
): [Column, Card] => {
  const status = STATUSES[session.status];
  const row = runs.find((each) => each.issue === session.issue && each.terminal === session.sessionId);
  const stoppable = row && STOPPABLE.has(row.state) && !landings.some((each) => each.issue === session.issue);
  const keptLine = session.issue === null ? null : stopKeptLine(session.issue);
  const kept = keptLine !== null && row?.line?.endsWith(keptLine) ? keptLine : null;
  const [column, state, waitFor] =
    row?.state === 'stopping'
      ? (['running', 'stopping', null] as const)
      : status[2] === 'turn' && (session.stepEnd === 'checking' || session.stepEnd === 'exiting')
        ? (['running', 'checks-step', null] as const)
        : status;
  return [
    session.issue === null ? 'human' : column,
    {
      sessionId: session.sessionId,
      number: session.issue,
      title: issue?.title ?? session.label,
      url: webUrl(issue?.url),
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
      aside: false,
      hold: issue?.holdable === true,
      ...(stoppable && {
        stop: { reason: row.host === 'codex' ? codexStopLine : row.state === 'stopping' ? STOPPING : null },
      }),
      ...(kept && { warning: kept }),
      epic: issue?.epic ?? null,
      pr: issue?.pr ?? null,
      waitFor,
      turn: session.turn,
      screen: session.screen ?? [],
      cwd: session.cwd ?? null,
    },
  ];
};

const rank = (card: Card) => (card.urgent ? 0 : 2) + (card.waitFor === 'dialog' ? 0 : 1);

const ORDER: Record<Column, (a: Card, b: Card) => number> = {
  needs: (a, b) => rank(a) - rank(b) || time(a.since) - time(b.since),
  running: (a, b) => time(b.since) - time(a.since),
  idle: (a, b) => compareKeys(b.number as IssueKey, a.number as IssueKey),
  human: (a, b) =>
    a.title.localeCompare(b.title, undefined, { numeric: true }) ||
    (a.sessionId as string).localeCompare(b.sessionId as string),
};

export const place = ({
  sessions,
  board,
  noRun,
  launches,
  quota = new Map(),
  runs = [],
  landings = [],
}: {
  sessions: Session[];
  board: Pick<Document, 'flow' | 'issues'> | null;
  noRun: string | null;
  launches: Record<string, LaunchFeedback>;
  quota?: ReadonlyMap<IssueKey, QuotaState>;
  runs?: readonly RunRow[];
  landings?: readonly LandingRow[];
}): Placement => {
  const columns: Columns = { needs: [], running: [], idle: [], human: [] };
  const issues = board?.issues ?? [];
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const busy = new Set(sessions.map((session) => session.issue));
  const placed = [
    ...sessions.map((session) =>
      placeSession(session, session.issue === null ? undefined : byNumber.get(session.issue), runs, landings),
    ),
    ...issues
      .filter((issue) => !busy.has(issue.number))
      .map((issue): [Column, Card] => {
        const recovery = quota.get(issue.number);
        if (recovery?.kind === 'waiting')
          return ['needs', issueCard(issue, { step: issue.step, state: 'quota-wait', reason: QUOTA_WAIT })];
        const launch = launches[issue.number];
        const feedback = launch && launchMatches(issue, launch.step) ? launch : null;
        const [column, card] = PLACERS[issue.state](issue, {
          flow: (board as Pick<Document, 'flow' | 'issues'>).flow,
          isOpen:
            noRun === null &&
            (!feedback || feedback.kind === 'failed' || (feedback.kind === 'timed' && feedback.expired)),
          landings,
        });
        const orphan = recovery?.kind === 'orphaned' ? QUOTA_ORPHAN : null;
        if (orphan) card.warning = orphan;
        const unproved =
          issue.state === 'starting'
            ? runs.findLast(
                (row) =>
                  row.issue === issue.number &&
                  row.outcome?.kind === 'stopped' &&
                  row.outcome.reason.endsWith(unprovedStopAct),
              )?.outcome?.reason
            : undefined;
        if (unproved) card.warning = unproved;
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
          {
            ...card,
            state: 'starts',
            act: null,
            assist: false,
            run: false,
            resume: false,
            go: false,
            aside: false,
            effort: null,
          },
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
const isRecoveryLine = (message: string) => {
  const key = `#(${keySource()})`;
  const match = new RegExp(
    `^recovery: (?:${key} (?:has no quota wait|waits with another wait ID; refresh, then use its Retry)|the run of ${key} no longer runs; start the run again)$`,
  ).exec(message);
  return match !== null && parseKey((match[1] ?? match[2]) as string) !== null;
};
export const agentCause = (cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/\b(EACCES|EPERM)\b|permission denied/.test(message)) return 'access to local agent state was denied';
  if (/\b(ENOSPC|EDQUOT)\b/.test(message)) return 'local storage is full';
  if (/\bEROFS\b/.test(message)) return 'local agent state is on a read-only filesystem';
  const outcome = stateOutcome(cause);
  if (outcome?.kind === 'busy' && outcome.lock === 'agents') return 'the agent order is busy; try again';
  if (outcome?.kind === 'unsafe' && outcome.reason.startsWith('need a '))
    return 'local agent state has unsafe file permissions; check it in a terminal';
  if (isRecoveryLine(message)) return message;
  if (message.includes('the celetis engine is not installed')) return 'the celetis engine is not installed';
  return 'local agent state could not be read or changed; check it in a terminal';
};
export const cleanScreen = (text: string, limit: number | null): string[] => {
  const keepsIndent = limit === null;
  const lines = (keepsIndent ? text : text.replaceAll('\t', ' '))
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .split('\n')
    .map((line) =>
      line
        .replace(/[\s│┃╭╮╰╯]+$/, '')
        .replace(/^[\s│┃╭╮╰╯]+/, (lead) => (keepsIndent ? lead.replace(/[│┃╭╮╰╯]/g, '') : '')),
    )
    .filter((line) => line === '' || !RULE.test(line));
  return limit === null
    ? lines.filter((line, index) => line !== '' || lines[index - 1] !== '')
    : lines.filter(Boolean).slice(-limit);
};
const screenOf = (text: string) => cleanScreen(text, SCREEN_LINES);

export type PressView = {
  nextRead(): number;
  follow(status: DaemonStatus, read: number, busy: ReadonlySet<IssueKey | null>): void;
  launches(
    issues: readonly IssueRow[] | undefined,
    busy: ReadonlySet<IssueKey | null>,
    checkedFrom: number,
  ): Record<string, LaunchFeedback>;
  isVisualPressed(key: IssueKey): boolean;
};
export type Placer = {
  placement(options?: { isLocal?: boolean }): Promise<Board>;
  queueView(): Promise<QueueView | null>;
  readSessions(): Promise<Session[]>;
  visualOf(
    row: Document['history']['entries'][number],
    terminals: Terminal[],
    isPressed: boolean,
  ): Promise<VisualState>;
};

export const createPlacement = ({
  main,
  reads,
  presses,
  status,
  coordinator,
  facts,
  trends,
  exec,
  now,
}: {
  main: string;
  reads: Reads;
  presses: PressView;
  status: () => Promise<DaemonStatus>;
  coordinator: CoordinatorReads;
  facts: () => CoordinatorFacts | null;
  trends: () => Trends;
  exec: Exec;
  now: () => number;
}): Placer => {
  let shown = new Map<string, IssueKey | null>();
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

  const visualOf = async (
    row: Document['history']['entries'][number],
    terminals: Terminal[],
    isPressed: boolean,
  ): Promise<VisualState> => {
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
    const { terminals, sessions: listed, health } = await watchSessions();
    const held = facts();
    const isRead =
      health.ok &&
      (held === null ||
        terminals.some((terminal) => terminal.id === held.terminal) ||
        (await terminalState(held.terminal, exec)) === 'ended');
    const coordinatorView = coordinator.view(isRead ? terminals : null);
    const found = listed.filter((session) => session.sessionId !== held?.terminal);
    const dispositions = await readStepEnds(
      main,
      found.flatMap((session) => (session.issue === null ? [] : [session.issue])),
    );
    const sessions: Session[] = [];
    for (const session of found) {
      const record = session.issue === null ? undefined : dispositions.get(session.issue);
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
      agentState = await readAgentState(main, now(), reads.document?.flow.steps ?? {});
      agentError = null;
    } catch (cause) {
      agentError = agentCause(cause);
    }
    const placed = place({
      sessions,
      board: reads.document,
      noRun: await mainNoRun(main),
      launches,
      quota: agentState?.quota,
      runs: daemon.runs,
      landings: daemon.landings,
    });
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
      grammar: reads.document?.grammar ?? grammar().kind,
      daemon: daemonView(daemon),
      agents: reads.document?.agents ?? null,
      registry,
      picker: agentState && {
        order: agentState.order,
        usage: agentState.usage,
        activeHosts: [...new Set(listed.flatMap((session) => (isHost(session.agent) ? [session.agent] : [])))],
        waits: [...agentState.quota.values()].flatMap((state) => (state.kind === 'waiting' ? [state.wait] : [])),
        error: agentError,
      },
      next: agentState?.next ?? null,
      starts: agentState?.starts ?? null,
      queue,
      terminal: health,
      coordinator: coordinatorView,
      source: { readAt: reads.readAt, error: readError() },
      repo: basename(main),
      trends: trends(),
    };
  };

  return { placement, queueView, readSessions, visualOf };
};
