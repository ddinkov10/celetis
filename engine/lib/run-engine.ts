import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { effectiveOrder, readAgentOrder } from './agent-order.ts';
import { beginUsageAttempt, readUsage, recordUsage, selectAgent, type UsageTicket } from './agent-usage.ts';
import type { AgentChoice, Config, Host } from './config-core.ts';
import { type ExitCode, exits, signalExit } from './contract.ts';
import { daemonArgv } from './daemon-start.ts';
import { defaultLevel, type Level } from './effort.ts';
import { HostError } from './errors.ts';
import { markDefect, passOn, recordEvent } from './events.ts';
import { describe, type Next } from './lines.ts';
import {
  addRecord,
  createLockOwner,
  type Identity,
  isRecorded,
  type LockClaim,
  type LockOwner,
  lockHolder,
} from './locks.ts';
import {
  type CheckoutIdentity,
  createOperation,
  type HostSelection,
  locateCheckouts,
  type Operation,
} from './operation.ts';
import { childEnv } from './process.ts';
import {
  controllingTerminal,
  daemonScript,
  processScript,
  processStart,
  processState,
  processTable,
  terminateChild,
} from './process-identity.ts';
import { explicitHost, readQueue, requireQueueChoice, updateQueue } from './queue.ts';
import { emptyQueue } from './queue-actions.ts';
import type { QueueRecord } from './queue-types.ts';
import {
  type AttemptEnd,
  archiveSession,
  endOwnedAttempt,
  type OwnedSession,
  permitHolds,
  type QuotaBlock,
  type QuotaRecovery,
  quotaWake,
  type RecoveryAttempt,
  type RecoveryAuthority,
  RecoveryError,
  readRecovery,
  snapshotLane,
  updateRecovery,
  validateRecovery,
} from './quota-recovery.ts';
import type { RunRecord } from './run-record.ts';
import {
  type Claim,
  codexClaim,
  codexPrompt,
  hostArguments,
  manualRecovery,
  observeSession,
  readSession,
  resumeArguments,
  type SessionRecord,
  selectSavedSession,
  startLine,
  startupError,
  writeSession,
} from './session.ts';
import { ensureFolder, type RepositoryLayout, startFiles } from './state.ts';
import {
  removeStepEnd,
  type StepEndRecord,
  type StepEndState,
  type TurnKey,
  verdictOf,
  writeStepEnd,
} from './step-end.ts';
import {
  closeTerminal,
  exitGraceMs,
  openTab,
  readTerminal,
  requestExit,
  requireTerminals,
  TerminalError,
  terminalLive,
  waitTerminal,
} from './terminal.ts';
import type { TerminalStatus } from './terminal-types.ts';
import { prepareClaudeUsage, readClaudeUsage } from './usage-claude.ts';
import { readCodexUsage } from './usage-codex.ts';
import type { ObservedUsage, UsageAttempt } from './usage-types.ts';
import { defaultGate, invocation, type Run, type Step, sameResult, skipped } from './workflow.ts';

export type Place = Readonly<{ main: string; common: string; state: RepositoryLayout; root: string }>;
export type RunInput =
  | Readonly<{ kind: 'number'; number: number; selection: HostSelection; effort: Level | null; quiet: boolean }>
  | Readonly<{ kind: 'auto'; number: number; selection: HostSelection; quiet: boolean }>
  | Readonly<{ kind: 'queue'; id: string; token: string; selection: HostSelection; quiet: boolean }>
  | Readonly<{ kind: 'resume'; number: number; selection: HostSelection }>;
export type RunState =
  | 'starting'
  | 'running'
  | 'checking'
  | 'waiting'
  | 'exiting'
  | 'quota-wait'
  | 'ending'
  | 'taken-over'
  | 'finished';
export type Admission = Readonly<{ ok: true }> | Readonly<{ ok: false; line: string; code: ExitCode }>;
export type RunEnd = Readonly<{ kind: 'closed' | 'gate' | 'stopped' | 'detached'; code: ExitCode; reason: string }>;
export type RunHooks = Readonly<{ ready?: () => Promise<void>; removed: () => void; fatal: () => void }>;
export type RunView = Readonly<{
  issue: number | null;
  numbers: readonly number[] | null;
  step: Step | null;
  host: Host | null;
  tab: string | null;
  state: RunState;
  changedMs: number;
  barrier: Identity | null;
}>;
export interface RunHandle {
  readonly id: string;
  readonly input: RunInput;
  readonly admitted: Promise<Admission>;
  readonly done: Promise<RunEnd>;
  view(): RunView;
  detach(): void;
}

export const removed = 'the program version of this daemon was removed after an update; start the daemon again';
const required = [
  'lib/resolver.ts',
  'lib/updater.ts',
  'daemon.ts',
  '../celetis',
  'launcher.ts',
  'lib/codex-app-server.ts',
  'lib/config-core.ts',
  'lib/config.ts',
  'lib/errors.ts',
  'lib/events.ts',
  'lib/git.ts',
  'lib/homes.ts',
  'lib/host.ts',
  'lib/locks.ts',
  'lib/operation.ts',
  'lib/plugin-metadata.ts',
  'lib/plugin-policy.ts',
  'lib/update-lock.ts',
  'lib/windows.ts',
  'lib/process-identity.ts',
  'lib/session.ts',
  'lib/step-end.ts',
  'lib/terminal.ts',
  'lib/contract.ts',
  'lib/workflow.ts',
  'lib/effort.ts',
  'lib/tracker.ts',
  'lib/lines.ts',
  'lib/process.ts',
  'lib/program.ts',
  'lib/queue.ts',
  'lib/state-migration.ts',
  'lib/state-move.ts',
  'lib/state-preparation.ts',
  'lib/state.ts',
  'lib/queue-types.ts',
  'lib/queue-actions.ts',
  'lib/quota-recovery.ts',
  'lib/agent-order.ts',
  'lib/agent-usage.ts',
  'lib/usage-types.ts',
  'lib/usage-claude.ts',
  'lib/usage-codex.ts',
  'lib/run-engine.ts',
  'lib/run-record.ts',
  'lib/daemon-types.ts',
  'lib/daemon-server.ts',
  'lib/daemon-client.ts',
  'lib/daemon-start.ts',
  'usage-hook.ts',
  'lib/vendor/yaml.mjs',
];

export async function gone(root: string): Promise<boolean> {
  for (const file of required) if (!(await stat(join(root, 'engine', file)).catch(() => null))?.isFile()) return true;
  return false;
}

const idle: Record<TerminalStatus, boolean> = { idle: true, done: true, error: true, working: false, blocked: false };
const die = (message: string, code: ExitCode): never => {
  throw new HostError(`daemon: ${message}`, code);
};

export async function requireSetup(gh: boolean): Promise<void> {
  if (gh && !Bun.which('gh', { PATH: childEnv().PATH })) die('gh is not on PATH', exits.prerequisite);
  try {
    await requireTerminals();
  } catch (error) {
    if (!(error instanceof TerminalError)) throw error;
    die(error.message, error.code);
  }
}

let preflights: Promise<unknown> = Promise.resolve();
function preflight<T>(work: () => Promise<T>): Promise<T> {
  const next = preflights.then(work);
  preflights = next.catch(() => {});
  return next;
}

type Filter = { said: string; repeat: boolean };
type Tabs = { finished: string };
type Journal = (record: RunRecord) => Promise<void>;
type Started = Readonly<{
  hooks: RunHooks;
  locks: LockOwner;
  filter: Filter;
  checkout?: CheckoutIdentity;
  tabs?: Tabs;
  journal: Journal;
  from?: RunRecord;
}>;
type Facts = NonNullable<RunRecord['session']>;
type Phase = 'before' | 'between' | 'live' | 'ended';
type Resumed = Readonly<{ record: RunRecord; phase: Phase }>;
type Steered = Readonly<{
  step: Step;
  host: Host;
  next: Run;
  authority: RecoveryAuthority;
  choice: AgentChoice;
  record: SessionRecord;
  announced: string;
  ticket: UsageTicket;
  capture: string;
  owned: RecoveryAttempt;
}>;
type Live = Steered & Readonly<{ ended: Promise<number | null>; barrier: Identity; startedMs: number }>;
type Settled = Readonly<{ end: RunEnd; started: boolean }>;

function handled<T>(work: Promise<T>): Promise<T> {
  work.catch(() => {});
  return work;
}

export function createRun(
  place: Place,
  input: RunInput,
  options: { hooks: RunHooks; locks?: LockOwner; journal: Journal; from?: RunRecord },
): RunHandle {
  return begin(place, input, {
    hooks: options.hooks,
    locks: options.locks ?? createLockOwner(place.main),
    filter: { said: '', repeat: input.kind === 'auto' },
    journal: options.journal,
    from: options.from,
  }).handle;
}

function pidOf(source: string): Identity | null {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { pid, start } = value as Record<string, unknown>;
  if (typeof pid !== 'number' || !Number.isSafeInteger(pid) || pid <= 0 || typeof start !== 'string' || !start)
    return null;
  return { pid, start };
}

function steered(session: Facts): Steered & Readonly<{ barrier: Identity; startedMs: number }> {
  const { next, authority, choice, ticket, capture, owned, barrier, startedMs } = session;
  if (!next || !authority || !choice || !ticket || !capture || !owned || !barrier || startedMs === null)
    throw new Error('run record: the session of an issue run lacks its facts');
  return {
    ...session,
    next,
    authority,
    choice,
    ticket,
    capture,
    owned,
    barrier: { pid: barrier.pid, start: barrier.start },
    startedMs,
  };
}

function begin(place: Place, input: RunInput, options: Started): { handle: RunHandle; settled: Promise<Settled> } {
  const { main, common, state, root } = place;
  const { hooks, locks, filter, from } = options;
  const id = from?.id ?? randomUUID();
  let admit: (admission: Admission) => void = () => {};
  const admitted = new Promise<Admission>((done) => {
    admit = done;
  });
  let checkout: CheckoutIdentity;
  let operation: Operation;
  let initial: Operation | undefined;
  let selection: HostSelection = input.selection;
  let queue: QueueRecord | null = null;
  let queueWritable = false;
  let storageFailed = false;
  let terminal = '';
  let tab = '';
  let unreleased = '';
  const tabs = options.tabs ?? { finished: '' };
  const detach = new AbortController();
  const halt = new AbortController();
  const halted = new Promise<null>((done) => halt.signal.addEventListener('abort', () => done(null), { once: true }));
  const rest = (ms: number) => pause(ms, undefined, { signal: halt.signal }).catch(() => {});
  let watcher: AbortController | undefined;
  let watching: Promise<void> | undefined;
  let stepEndIssue: number | undefined;
  let stepEndOwner: StepEndRecord['daemon'];
  let unremovable = false;
  let watchDir = '';
  let shown: RunView = {
    issue: input.kind === 'queue' ? null : input.number,
    numbers: null,
    step: null,
    host: null,
    tab: null,
    state: 'starting',
    changedMs: Date.now(),
    barrier: null,
  };
  const mark = (next: RunState) => {
    shown = { ...shown, state: next, changedMs: Date.now() };
  };
  let told: string | null = null;
  const say = (message: string) => {
    if (filter.repeat && message === filter.said) return false;
    filter.said = message;
    told = `daemon: ${message}`;
    console.log(told);
    return true;
  };
  const stopped = () => {
    if (detach.signal.aborted) throw new HostError('', exits.prerequisite);
  };
  // A detach keeps the owner records for the next daemon.
  const handOff = () => !detach.signal.aborted;
  let fact: RunRecord | null = from ?? null;
  let self: Identity | undefined;
  const note = async (change: Partial<RunRecord> = {}) => {
    if (!self?.start) self = { pid: process.pid, start: await processStart(process.pid) };
    fact = {
      ...(fact ?? {
        schema: 2,
        id,
        daemon: self,
        input,
        issue: input.kind === 'queue' ? null : input.number,
        lock: null,
        queue: input.kind === 'queue' ? { id: input.id } : null,
        request: null,
        loop: {
          first: input.kind === 'number' ? 'any' : 'gated',
          last: null,
          lastHost: 'claude',
          exitCode: 0,
          started: false,
          attempted: [],
          retrying: false,
          retryBlocked: false,
          finished: null,
        },
        wait: null,
        session: null,
      }),
      ...change,
      daemon: self,
      state: shown.state,
      changedMs: shown.changedMs,
    };
    await options.journal(fact);
  };
  const noteBarrier = async (barrier: Identity, startedMs: number, change: Partial<RunRecord> = {}) => {
    if (!fact?.session) return;
    const row = (await processTable())?.find((each) => each.pid === barrier.pid);
    await note({
      ...change,
      session: {
        ...fact.session,
        barrier: {
          ...barrier,
          shell: row ? row.ppid : null,
          tty: row && controllingTerminal(row.tty) ? row.tty : null,
        },
        startedMs,
      },
    });
  };
  const ownedOf = (barrier: Identity): OwnedSession => {
    const recorded = fact?.session?.barrier;
    const same = recorded?.pid === barrier.pid && recorded.start === barrier.start;
    return { ...barrier, terminal, shell: same ? recorded.shell : null, tty: same ? recorded.tty : null };
  };
  const removal = async () => {
    hooks.removed();
    await halted;
    stopped();
  };
  const saveQueue = async (change: Partial<QueueRecord>) => {
    stopped();
    if (queue === null) throw new HostError('daemon: queue: no submitted queue', exits.internal);
    const expected = queue;
    try {
      queue = await updateQueue(
        main,
        async (current) => {
          if (!current || current.id !== expected.id || current.numbers[0] !== expected.numbers[0])
            throw new Error('queue: the current issue changed; refresh the queue');
          return { ...current, ...change };
        },
        common,
        locks,
      );
    } catch (error) {
      storageFailed = true;
      throw new HostError(
        `daemon: queue: cannot save recovery state: ${(error as Error).message}; no further session will start. Repair access to the queue record, then use Try again.`,
        exits.blocked,
      );
    }
  };
  const fresh = () => createOperation(checkout, selection, 'main');
  const nextOperation = async () => {
    const current = initial ?? (await fresh());
    initial = undefined;
    return current;
  };
  const requireStart = async (host: Host, cwd: string) => {
    if (host === 'codex') process.env.CODEX_HOME = await (await import('./homes.ts')).codexHome();
    const { requireUpdatePolicy } = await import('./plugin-policy.ts');
    await (await import('./update-lock.ts')).withPluginRead(host, async () => {
      await requireUpdatePolicy(host, cwd);
      if (cwd !== main) await requireUpdatePolicy(host, main);
    });
    if (!Bun.which(host, { PATH: childEnv().PATH }))
      throw new HostError(`celetis: ${host} is not on PATH`, exits.prerequisite);
  };
  const nextOf = async (
    n: string,
    current: Operation,
    abort?: AbortSignal,
    permit?: Awaited<ReturnType<typeof validateRecovery>>,
  ) => {
    const { nextIssue } = await import('./resolver.ts');
    const { lineOf } = await import('./lines.ts');
    const keeps =
      permit && (async (lane: string) => lane === permit.lane && permitHolds(current.checkout.main as string, permit));
    const { next, effort, authority, stderr } = await nextIssue(n, current, abort, keeps);
    process.stderr.write(stderr);
    return { next, effort, authority, line: lineOf(n, next) };
  };
  const blockedText = (blocked: readonly QuotaBlock[]) =>
    blocked
      .map(
        (each) =>
          `${each.host}: ${each.reason} Reset: ${each.resetAt === null ? 'unknown' : new Date(each.resetAt).toISOString()}`,
      )
      .join('; ') || 'no included agent can start';
  const usageWarning = (n: string) => {
    let warned = false;
    return (error: unknown) => {
      if (!warned) console.error(`daemon: #${n} cannot record usage: ${(error as Error).message}`);
      warned = true;
    };
  };
  const observeUsage = async (
    n: string,
    ticket: UsageTicket,
    capture: string,
    warn: (error: unknown) => void,
  ): Promise<ObservedUsage | null> => {
    const saved = await readSession(main, Number(n), common, locks).then(
      (record) => record.session_id,
      () => null,
    );
    if (saved === null || (ticket.attempt.sessionId !== null && ticket.attempt.sessionId !== saved)) return null;
    ticket.attempt.sessionId = saved;
    const observed =
      ticket.attempt.host === 'claude'
        ? await readClaudeUsage(ticket.attempt, capture)
        : await readCodexUsage(ticket.attempt);
    await recordUsage(common, ticket, observed).catch(warn);
    return observed;
  };
  const watchUsage = async (
    n: string,
    ticket: UsageTicket,
    capture: string,
    abort: AbortSignal,
  ): Promise<ObservedUsage | null> => {
    const warn = usageWarning(n);
    while (!abort.aborted) {
      const observed = await observeUsage(n, ticket, capture, warn);
      if (observed?.observation.kind === 'blocked') return observed;
      await pause(2000, undefined, { signal: abort }).catch(() => {});
    }
    return null;
  };
  const clearStepEnd = async () => {
    if (stepEndIssue === undefined || unremovable) return;
    try {
      await removeStepEnd(main, stepEndIssue);
    } catch (error) {
      console.error(`daemon: #${stepEndIssue} cannot remove step-end: ${(error as Error).message}`);
      console.error(
        `daemon: cannot revoke watcher ownership; the daemon stops. Exit the session in the tab ${tab} when ready.`,
      );
      unremovable = true;
      hooks.fatal();
    }
  };
  const publish = async (host: Host, state: StepEndState, turn: TurnKey | null) => {
    try {
      await writeStepEnd(main, stepEndIssue as number, { daemon: stepEndOwner, terminal, host, state, turn });
      mark(state);
      return true;
    } catch (error) {
      await clearStepEnd();
      const line = `daemon: #${stepEndIssue} cannot write step-end: ${(error as Error).message}`;
      console.error(line);
      recordEvent({ name: 'step-end-write', message: line, issue: stepEndIssue });
      return false;
    }
  };
  const sessionTurn = async (
    id: string,
    host: Host,
    startedMs: number,
    abort: AbortSignal,
  ): Promise<{ turn: TurnKey; idle: boolean } | null> => {
    const view = await readTerminal(terminal, { signal: abort });
    if (!view || view.host !== host || view.status === null || view.statusMs === null || view.statusMs < startedMs)
      return null;
    return { turn: { terminalId: terminal, sessionId: id, sequence: view.turn }, idle: idle[view.status] };
  };
  const sameTurn = (a: TurnKey | null, b: TurnKey | null) =>
    a !== null &&
    b !== null &&
    a.terminalId === b.terminalId &&
    a.sessionId === b.sessionId &&
    a.sequence === b.sequence;
  const endWhenDone = async (
    n: string,
    start: Run,
    record: SessionRecord,
    announced: string,
    startedMs: number,
    ended: Promise<number | null>,
    barrier: Identity,
    abort: AbortSignal,
  ) => {
    const startedAt = Math.floor(startedMs / 1000);
    const deadline = performance.now() + 60_000;
    let saved = false;
    let warned = false;
    while (!abort.aborted) {
      const claim: Claim =
        record.host === 'claude'
          ? { kind: 'one', id: announced }
          : await codexClaim(main, codexPrompt(record.step, Number(n)), startedAt);
      const result = await observeSession(record, claim, startedAt, locks);
      if (result === 0) {
        saved = true;
        break;
      }
      if (result === 2) {
        await writeFile(startFiles(watchDir).error, '');
        await startupError(Number(n), record.host, 'no single session identity can be saved', terminal, tab);
        return;
      }
      if (!warned && performance.now() >= deadline) {
        warned = true;
        console.error(
          `daemon: #${n} ${record.host} startup: no saved turn with a verified identity after 60 seconds; monitoring continues. Check setup prompts in the tab ${tab}.`,
        );
      }
      await Bun.sleep(1000);
    }
    if (!saved || abort.aborted) return false;
    const id = (await readSession(main, Number(n), common, locks)).session_id ?? '';
    let retained: TurnKey | null = null;
    while (!abort.aborted && (await waitTerminal(terminal, 60, abort))) {
      if (await gone(root)) {
        await removal();
        return;
      }
      const observed = await sessionTurn(id, record.host, startedMs, abort);
      const turn = observed?.turn;
      if (observed && !observed.idle) {
        retained = null;
        if (!(await publish(record.host, 'checking', observed.turn))) return false;
      } else if (turn) {
        if (!sameTurn(turn, retained) && !(await publish(record.host, 'checking', turn))) return false;
        const { next: first } = await nextOf(n, await fresh(), abort);
        let changed = false;
        if (first.kind !== 'observed' && !sameResult(first, start)) {
          const { next: second } = await nextOf(n, await fresh(), abort);
          changed = second.kind !== 'observed' && sameResult(second, first);
        }
        const current = await sessionTurn(id, record.host, startedMs, abort);
        if (!current) {
          retained = null;
          await clearStepEnd();
        } else if (!current.idle || !sameTurn(turn, current.turn)) {
          retained = null;
          if (!(await publish(record.host, 'checking', current.turn))) return false;
          if (current.idle) continue;
        } else if (!abort.aborted) {
          const verdict = verdictOf(first, changed);
          if (verdict === 'exiting') {
            if (!(await publish(record.host, 'exiting', turn))) return false;
            // hc send can return seconds after the delivery, while it waits for a turn to start.
            const requested = performance.now();
            if (!(await requestExit(terminal, record.host, abort))) {
              if (!abort.aborted) {
                await publish(record.host, 'waiting', turn);
                const line = `daemon: #${n} cannot request ${record.host} exit; the session stays open. Exit it in the tab ${tab} when ready.`;
                console.error(line);
                recordEvent({ name: 'exit-request', message: line, issue: Number(n) });
              }
              return false;
            }
            const mark = startFiles(watchDir).terminated;
            let settled = false;
            let after: ReturnType<typeof setTimeout> | undefined;
            const report = (name: string, line: string) => {
              console.error(line);
              recordEvent({ name, message: line, issue: Number(n) });
            };
            const signalHost = async () => {
              try {
                await writeFile(mark, '');
              } catch {
                return null;
              }
              const pid = await terminateChild(barrier, abort);
              if (pid === null) await rm(mark, { force: true }).catch(() => {});
              return pid;
            };
            const escalate = async () => {
              if (settled || abort.aborted) return;
              const pid = record.host === 'claude' ? await signalHost() : null;
              if (pid === null) {
                if (!settled && !abort.aborted)
                  report(
                    'exit-timeout',
                    `daemon: #${n} ${record.host} did not exit within 10 seconds; the session stays open. Exit it in the tab ${tab} when ready.`,
                  );
                return;
              }
              report(
                'exit-signal',
                `daemon: #${n} claude did not exit within 10 seconds; the daemon sent SIGTERM to its host process (PID ${pid}).`,
              );
              if (settled || abort.aborted) return;
              after = setTimeout(() => {
                if (abort.aborted) return;
                report(
                  'exit-timeout',
                  `daemon: #${n} claude did not exit within 10 seconds after SIGTERM; the session stays open. Exit it in the tab ${tab} when ready.`,
                );
              }, exitGraceMs);
            };
            const timer = setTimeout(() => void escalate(), requested + exitGraceMs - performance.now());
            try {
              await Promise.race([ended, halted]);
            } finally {
              settled = true;
              clearTimeout(timer);
              clearTimeout(after);
            }
            return true;
          }
          if (!(await publish(record.host, verdict, turn))) return false;
          retained = verdict === 'waiting' ? turn : null;
        }
      } else {
        retained = null;
        await clearStepEnd();
      }
      await pause(5000, undefined, { signal: abort }).catch(() => {});
    }
  };
  const barrierOf = async (source: string) => {
    const found = pidOf(source);
    if (found === null) return null;
    const { pid, start } = found;
    const state = await processState(pid, start);
    const script = state === 'gone' ? 'gone' : await processScript(pid, daemonScript);
    if (state === 'gone' || script === 'gone') return null;
    return state === 'runs' && script === 'runs' ? { pid, start } : 'unknown';
  };
  const forgetTab = async (change: Partial<RunRecord>) =>
    note(change).catch((error: unknown) => console.error((error as Error).message));
  const closeFinished = async () => {
    const id = tabs.finished;
    tabs.finished = '';
    if (!id) return;
    await closeTerminal(id);
    if (fact?.loop.finished === id) await forgetTab({ loop: { ...fact.loop, finished: null } });
  };
  const closeUnreleased = async () => {
    const id = unreleased;
    unreleased = '';
    if (!id) return;
    await closeTerminal(id);
    if (fact?.session?.terminal === id) await forgetTab({ session: { ...fact.session, terminal: null } });
  };
  const closeTabs = async () => {
    await closeUnreleased();
    await closeFinished();
  };
  const sessionExit = async (dir: string, barrier: Identity): Promise<number | null> => {
    while (!halt.signal.aborted && (await processState(barrier.pid, barrier.start)) !== 'gone') await rest(500);
    const status = await readFile(startFiles(dir).status, 'utf8').catch(() => '');
    if (!/^\d+\n$/.test(status)) return null;
    const code = Number(status);
    if (code !== signalExit(constants.signals.SIGTERM)) return code;
    return (await stat(startFiles(dir).terminated).catch(() => null))?.isFile() ? exits.done : code;
  };
  const startSession = async (
    n: string,
    step: Step,
    host: Host,
    args: string[],
    focus: boolean,
    facts: Omit<Facts, 'folder' | 'terminal' | 'tab' | 'barrier' | 'startedMs'>,
    attempt = '-',
    recovery = false,
    opened: () => Promise<Partial<Facts>> = async () => ({}),
  ) => {
    if (host === 'codex') args = [...(await (await import('./plugin-metadata.ts')).codexSessionPin(main)), ...args];
    const dir = await mkdtemp(state.startPrefix);
    watchDir = dir;
    tab = `#${n} ${step}`;
    shown = { ...shown, issue: Number(n), step, host, tab, barrier: null };
    const unstarted = async () => {
      if (!detach.signal.aborted) return;
      await note({ session: null });
      stopped();
    };
    stopped();
    const opening: Facts = { ...facts, folder: dir, terminal: null, tab, barrier: null, startedMs: null };
    await note({ session: opening });
    await unstarted();
    try {
      terminal = await openTab({
        repository: { main, common },
        folder: main,
        name: tab,
        argv: [
          // hc gives the tab the environment of its server, not of this daemon.
          ...(process.platform === 'win32' ? [] : ['env', 'BUN_RUNTIME_TRANSPILER_CACHE_PATH=0', 'DO_NOT_TRACK=1']),
          ...daemonArgv(root, [
            '--session-start',
            dir,
            String(process.pid),
            host,
            attempt,
            recovery ? 'recovery' : '-',
            ...args,
          ]),
        ],
        focus,
        keepShell: true,
      });
    } catch (error) {
      if (!(error instanceof TerminalError)) throw error;
      die(`#${n} cannot open the session tab: ${error.message}`, error.code);
    }
    unreleased = terminal;
    await unstarted();
    await note({ session: { ...opening, terminal } });
    const more = await opened();
    if (Object.keys(more).length) await note({ session: { ...opening, terminal, ...more } });
    await closeFinished();
    const waited = performance.now();
    let checked = waited;
    let warned = false;
    let barrier: Identity;
    for (;;) {
      stopped();
      const source = await readFile(startFiles(dir).pid, 'utf8').catch(() => null);
      const read = source === null ? 'unknown' : await barrierOf(source);
      if (read !== 'unknown') {
        barrier =
          read ??
          die(
            `#${n} ${host} startup: the start barrier record of the tab ${tab} is not valid; start the step again`,
            exits.blocked,
          );
        break;
      }
      const now = performance.now();
      if (now - checked >= 1000) {
        checked = now;
        if (!(await terminalLive(terminal)))
          die(
            `#${n} ${host} startup: the tab ${tab} ended before its start barrier reported; check the login files of $SHELL, then start the step again`,
            exits.blocked,
          );
      }
      if (!warned && now - waited >= 60_000) {
        warned = true;
        console.error(
          `daemon: #${n} ${host} startup: the start barrier of the tab ${tab} did not report after 60 seconds; waiting continues. Check the login files of $SHELL in that tab.`,
        );
      }
      await rest(250);
    }
    shown = { ...shown, barrier };
    await locks.registerSession(barrier.pid);
    stopped();
    return { ended: sessionExit(dir, barrier), barrier };
  };
  const releaseBarrier = async () => {
    stopped();
    await writeFile(startFiles(watchDir).go, '');
    unreleased = '';
    mark('running');
  };
  const sessionEnd = async (ended: Promise<number | null>) => {
    const code = await Promise.race([ended, halted]);
    if (!detach.signal.aborted) return code;
    // The released barrier can still be waiting to read go in the start folder.
    watchDir = '';
    throw new HostError('', exits.prerequisite);
  };
  const normalEnd = (code: number | null) => {
    if (code === exits.done) tabs.finished = terminal;
  };
  type IssueOutcome = {
    kind: 'closed' | 'gate' | 'stopped';
    started: boolean;
    next: Next | null;
    last: Run | null;
    exitCode: number | null;
    reason: string;
    act: string | null;
  };
  type IssueHooks = {
    beforeStart?: (next: Run, host: Host) => Promise<void>;
    onWait?: (waitId: string, reason: string) => Promise<void>;
  };
  const runIssue = async (
    n: string,
    first: 'any' | 'gated',
    request?: {
      step: Step | null;
      retry: boolean;
    },
    hooks?: IssueHooks,
    override?: Level,
    from?: Resumed,
  ): Promise<IssueOutcome> => {
    const kept = from && from.phase !== 'before' ? from.record.loop : null;
    let lastHost: Host = kept ? kept.lastHost : (explicitHost(queue?.choice) ?? 'claude');
    let last: Run | null = kept ? kept.last : (queue?.last ?? null);
    let started = kept?.started ?? false;
    let exitCode: number | null = kept ? kept.exitCode : 0;
    let resolved: Next | null = null;
    const issue = Number(n);
    shown = { ...shown, issue, step: null, host: null, tab: null };
    const outcome = (kind: IssueOutcome['kind'], reason: string, act: string | null = null): IssueOutcome => ({
      kind,
      started,
      next: resolved,
      last,
      exitCode,
      reason,
      act,
    });
    let recovery: QuotaRecovery | null = null;
    let attempted = new Set<Host>(kept?.attempted);
    let retryBlocked = kept?.retryBlocked ?? false;
    let retrying = kept?.retrying ?? false;
    const noteLoop = (change: Partial<RunRecord> = {}) =>
      note({
        loop: {
          first,
          last,
          lastHost,
          exitCode,
          started,
          attempted: [...attempted],
          retrying,
          retryBlocked,
          finished: tabs.finished || null,
        },
        ...change,
      });
    if (!from) {
      const holder = await locks.take(`issue-${n}`);
      if (holder !== null) {
        const reason = `another run or its session (PID ${holder}) works on #${n}`;
        say(reason);
        admit({ ok: false, line: `daemon: ${reason}`, code: exits.prerequisite });
        return outcome('stopped', reason, 'Wait for that session to exit, then use Try again.');
      }
      await noteLoop({ issue, lock: `issue-${n}`, request: request ?? null });
    }
    const daemon = { pid: process.pid, start: await processStart(process.pid) };
    const saveRecovery = async (
      authority: RecoveryAuthority,
      choice: AgentChoice,
      change: (current: QuotaRecovery) => QuotaRecovery,
    ) => {
      stopped();
      recovery = await updateRecovery(main, issue, (current) =>
        change(
          current ?? {
            schema: 2,
            id: randomUUID(),
            revision: 1,
            issue,
            authority,
            main,
            common,
            lane: null,
            choice,
            attempt: null,
            prior: [],
            daemon,
            lock: `issue-${n}`,
            attempted: [],
            state: 'recovering',
            waitId: null,
            wake: null,
            blocked: [],
            nextResetAt: null,
          },
        ),
      );
    };
    const endRecovery = async () => {
      stopped();
      if (recovery) await updateRecovery(main, issue, () => null);
      recovery = null;
      retrying = false;
      attempted = new Set();
      retryBlocked = false;
    };
    const waitQuota = async (
      authority: RecoveryAuthority,
      choice: AgentChoice,
      blocked: readonly QuotaBlock[],
      nextResetAt: number | null,
      kept: RunRecord['wait'] = null,
    ) => {
      admit({ ok: true });
      const waitId = kept?.waitId ?? randomUUID();
      if (!kept)
        await saveRecovery(authority, choice, (current) => ({
          ...current,
          state: 'waiting',
          waitId,
          wake: null,
          blocked,
          nextResetAt,
          attempted: [...attempted],
        }));
      mark('quota-wait');
      const deadline =
        nextResetAt === null ? 'no reset is known' : `the run waits until ${new Date(nextResetAt).toISOString()}`;
      const line = `#${n}: all default agents are limited (${blockedText(blocked)}); ${deadline}. Retry: celetis run retry ${n} ${waitId}`;
      say(line);
      if (!kept) {
        recordEvent({ name: 'quota-wait', message: `daemon: ${line}`, issue });
        await hooks?.onWait?.(waitId, line);
      }
      const snapshot = kept ? null : await readUsage(common);
      const seenOf = (host: Host) => {
        const each = snapshot?.[host];
        return each ? { ordinal: each.ordinal, sequence: each.sequence } : null;
      };
      const seen = kept?.seen ?? { claude: seenOf('claude'), codex: seenOf('codex') };
      await note({ wait: { waitId, authority, choice, seen } });
      for (;;) {
        stopped();
        const current = await readRecovery(main, issue);
        if (!current || current.waitId !== waitId)
          throw new HostError(`daemon: #${n}: the quota wait record changed; start the run again`, exits.prerequisite);
        const usage = await readUsage(common);
        const renewed = (await readAgentOrder(common)).order.some((each) => {
          const now = usage[each];
          const before = seen[each];
          return (
            now !== null &&
            now.block === null &&
            (before === null || now.ordinal !== before.ordinal || now.sequence !== before.sequence)
          );
        });
        const woke = quotaWake(current, Date.now()) ?? (renewed ? 'available' : null);
        if (woke) {
          await saveRecovery(authority, choice, (record) => ({ ...record, state: 'recovering', attempted: [] }));
          mark('starting');
          return woke;
        }
        await rest(1000);
      }
    };
    const sessionDone = async (code: number | null, host: Host) => {
      if ((await readSession(main, issue, common, locks)).session_id === null) {
        if (!(await stat(startFiles(watchDir).error).catch(() => null)))
          await startupError(
            issue,
            host,
            'the session ended before a saved turn had a verified identity',
            terminal,
            tab,
          );
        throw new HostError('', exits.blocked);
      }
      normalEnd(code);
      await noteLoop({ session: null });
      await rm(watchDir, { recursive: true, force: true });
      watchDir = '';
      stopped();
      await endRecovery();
      await noteLoop();
      mark('starting');
    };
    const endAttempt = async (s: Steered, barrier: Identity): Promise<AttemptEnd> => {
      await saveRecovery(s.authority, s.choice, (record) => ({
        ...record,
        attempt: { ...s.owned, sessionId: s.ticket.attempt.sessionId },
        state: 'recovering',
      }));
      return endOwnedAttempt(s.ticket.attempt, ownedOf(barrier));
    };
    const settle = async (s: Steered, reason: string, ownership: AttemptEnd): Promise<IssueOutcome | null> => {
      if (detach.signal.aborted) {
        // The next daemon proves this session end again from the start folder and the run record.
        watchDir = '';
        throw new HostError('', exits.prerequisite);
      }
      const sessionId = s.ticket.attempt.sessionId ?? '';
      const resume = `${s.host} ${resumeArguments({ ...s.record, session_id: sessionId }).join(' ')}`;
      if (ownership.kind === 'unverified') {
        const running = ownership.running.length ? ` (running PIDs: ${ownership.running.join(', ')})` : '';
        const line = `#${n}: ${reason} The daemon cannot prove that the ${s.host} session and its delegated work stopped: ${ownership.reason}${running}. No other agent starts. The session stays in the tab ${tab}; its native resume from the main checkout: ${resume}`;
        say(line);
        recordEvent({ name: 'quota-unverified', message: `daemon: ${line}`, issue });
        return outcome('stopped', line, 'Stop the session and its tasks in its tab, then use Try again.');
      }
      const archived = await archiveSession(main, issue, s.owned.id, locks);
      tabs.finished = terminal;
      attempted.add(s.host);
      retrying = true;
      await noteLoop({ session: null });
      await rm(watchDir, { recursive: true, force: true });
      watchDir = '';
      const lane = await snapshotLane(main, issue);
      await saveRecovery(s.authority, s.choice, (record) => ({
        ...record,
        lane,
        prior: [...record.prior, archived],
        attempted: [...attempted],
      }));
      say(
        `#${n}: ${reason} Its session ended, and no process of its tree or with its attempt marker runs; native resume from the main checkout: ${resume}. The same step continues with the next eligible agent.`,
      );
      mark('starting');
      return null;
    };
    const follow = async (s: Live, fresh: boolean): Promise<IssueOutcome | null> => {
      let watchError: unknown;
      watcher = new AbortController();
      watching = endWhenDone(n, s.next, s.record, s.announced, s.startedMs, s.ended, s.barrier, watcher.signal)
        .then(async (exiting) => {
          if (!exiting) await clearStepEnd();
        })
        .catch(async (error: unknown) => {
          await clearStepEnd();
          watchError = error;
        });
      const usageWatch = new AbortController();
      const refusal = watchUsage(n, s.ticket, s.capture, AbortSignal.any([usageWatch.signal, detach.signal]));
      if (fresh) {
        await hooks?.beforeStart?.(s.next, s.host);
        request = undefined;
        override = undefined;
      }
      last = s.next;
      lastHost = s.host;
      if (fresh) {
        await noteBarrier(s.barrier, s.startedMs, { request: null });
        await releaseBarrier();
      }
      started = true;
      const ending = sessionEnd(s.ended);
      ending.catch(() => {});
      let refused = await Promise.race([ending.then(() => null), refusal]);
      if (refused?.observation.kind === 'blocked' && s.choice.kind === 'explicit') {
        say(
          `#${n}: the explicit agent ${s.host} reports: ${refused.observation.reason} The session stays open; no other agent starts.`,
        );
        refused = null;
      }
      if (refused?.observation.kind !== 'blocked') {
        exitCode = await ending;
        usageWatch.abort();
        await refusal;
        watcher?.abort();
        await watching;
        watching = undefined;
        watcher = undefined;
        await clearStepEnd();
        stepEndIssue = undefined;
        if (watchError !== undefined) throw watchError;
        await sessionDone(exitCode, s.host);
        return null;
      }
      const reason = refused.observation.reason;
      usageWatch.abort();
      watcher?.abort();
      const ownership = await endAttempt(s, s.barrier);
      await watching;
      watching = undefined;
      watcher = undefined;
      await clearStepEnd();
      stepEndIssue = undefined;
      if (watchError !== undefined) throw watchError;
      return settle(s, reason, ownership);
    };
    const resumeSession = async (session: Facts, phase: 'live' | 'ended'): Promise<IssueOutcome | null> => {
      const s = steered(session);
      if (phase === 'live') {
        stepEndIssue = issue;
        stepEndOwner = daemon;
        await publish(s.host, 'checking', null);
        watchDir = session.folder;
        return follow({ ...s, ended: sessionExit(session.folder, s.barrier) }, false);
      }
      last = s.next;
      lastHost = s.host;
      started = true;
      exitCode = await sessionExit(session.folder, s.barrier);
      const startedAt = Math.floor(s.startedMs / 1000);
      if ((await readSession(main, issue, common, locks)).session_id === null) {
        const claim: Claim =
          s.host === 'claude'
            ? { kind: 'one', id: s.announced }
            : await codexClaim(main, codexPrompt(s.record.step, issue), startedAt);
        if ((await observeSession(s.record, claim, startedAt, locks)) === 2) {
          await writeFile(startFiles(watchDir).error, '');
          await startupError(issue, s.host, 'no single session identity can be saved', terminal, tab);
        }
      }
      const observed = await observeUsage(n, s.ticket, s.capture, usageWarning(n));
      if (observed?.observation.kind === 'blocked' && s.choice.kind === 'default')
        return settle(s, observed.observation.reason, await endAttempt(s, s.barrier));
      await sessionDone(exitCode, s.host);
      return null;
    };
    const adoptRecovery = async () => {
      for (;;) {
        stopped();
        let unknown = false;
        const kept = await updateRecovery(main, issue, async (current) => {
          if (!current || current.lock !== `issue-${n}`) return current;
          const state = await processState(current.daemon.pid, current.daemon.start);
          unknown = state === 'unknown';
          return state === 'gone' ? { ...current, daemon } : current;
        });
        if (!unknown) return kept;
        await rest(2000);
      }
    };
    try {
      if (!from || (from.phase === 'before' && from.record.wait === null)) {
        stopped();
        await updateRecovery(main, issue, () => null);
      } else recovery = await adoptRecovery();
      const session = from?.record.session;
      if (session && (from.phase === 'live' || from.phase === 'ended')) {
        const result = await resumeSession(session, from.phase);
        if (result) return result;
      }
      const waiting = from?.record.wait;
      if (waiting) {
        const bound = recovery as QuotaRecovery | null;
        if (bound?.waitId !== waiting.waitId)
          throw new HostError(`daemon: #${n}: the quota wait record changed; start the run again`, exits.prerequisite);
        const woke = await waitQuota(waiting.authority, waiting.choice, bound.blocked, bound.nextResetAt, waiting);
        attempted = new Set();
        retryBlocked = woke === 'retry';
        await noteLoop({ wait: null });
      }
      for (;;) {
        stopped();
        if (await gone(root)) {
          await removal();
          return outcome('stopped', removed, 'Start the daemon again.');
        }
        const current = await nextOperation();
        const config = current.mainConfig as Config;
        const bound = recovery as QuotaRecovery | null;
        let permit: Awaited<ReturnType<typeof validateRecovery>> | undefined;
        if (retrying && bound?.lane && bound.attempt)
          permit = await validateRecovery(main, issue, bound.attempt.id).catch((error: unknown) => {
            if (!(error instanceof RecoveryError)) throw error;
            say(error.message);
            return undefined;
          });
        const { next, effort, authority, line } = await nextOf(n, current, halt.signal, permit);
        stopped();
        resolved = next;
        const unreadable = next.kind === 'observed' && next.reason === 'unreadable';
        if (request && (next.kind === 'run' ? next.step : null) !== request.step) {
          const reason = `#${n}: the displayed decision changed: ${line}; no step was started`;
          say(reason);
          if (unreadable) admit({ ok: false, line: `daemon: ${reason}`, code: exits.blocked });
          return outcome('stopped', reason, 'Refresh the queue, then use its displayed action.');
        }
        if (next.kind !== 'run' || authority === null) {
          say(line);
          if (unreadable) admit({ ok: false, line: `daemon: ${line}`, code: exits.blocked });
          if (next.kind === 'stop' && (next.reason === 'finished' || next.reason === 'wontfix')) await endRecovery();
          return outcome(
            next.kind === 'stop' && (next.reason === 'finished' || next.reason === 'wontfix') ? 'closed' : 'stopped',
            line,
            describe(n, next).row?.act ?? 'Fix the cause, then use Try again.',
          );
        }
        const { step } = next;
        const prompt = invocation(step, issue);
        if (retrying && bound) {
          const same =
            step === bound.authority.step &&
            authority.spec === bound.authority.spec &&
            authority.plan === bound.authority.plan;
          if (!same && step === bound.authority.step) {
            const reason = `#${n}: the spec or plan changed during the quota recovery of ${step}; no step was started`;
            say(reason);
            return outcome('stopped', reason, 'Read the issue, then start the step again.');
          }
          if (!same) {
            await endRecovery();
            continue;
          }
        } else {
          if (last && !request?.retry && sameResult(next, last)) {
            if (exitCode !== exits.done)
              die(
                `${lastHost} session exited with status ${exitCode ?? 'unknown'} before issue progress; check startup output, then run ${manualRecovery(lastHost)} from the main checkout or start the step again`,
                exits.blocked,
              );
            const reason = `no progress: ${prompt}`;
            if (say(reason)) recordEvent({ name: 'no-progress', message: `daemon: ${reason}`, issue });
            await addRecord(common, n, line);
            return outcome('stopped', reason, 'Open the saved session, or use Try again for this step.');
          }
          const skips = last ? skipped(last.step, step, next.lane) : [];
          if (last && !request?.retry && skips.length > 0) {
            const reason = `#${n}: ${step} skips ${skips.join(', ')} after ${last.step}; fix the issue, or start ${step} by hand: celetis --agent <host> run ${n}`;
            if (say(reason)) recordEvent({ name: 'step-skip', message: `daemon: ${reason}`, issue });
            await addRecord(common, n, line);
            return outcome('stopped', reason, 'Fix the issue, or use Try again for this displayed step.');
          }
          if (first !== 'any' && (config.gates?.[step] ?? defaultGate) !== 'auto') {
            const reason = `the gate of ${step} is me: celetis --agent <host> run ${n} starts ${prompt}`;
            say(reason);
            return outcome('gate', reason, 'Use Continue queue to start this displayed step.');
          }
        }
        const decision = selectAgent(
          current.choice,
          effectiveOrder((await readAgentOrder(common)).order, config.agents?.[step]),
          await readUsage(common),
          Date.now(),
          attempted,
          retryBlocked,
        );
        if (decision.kind === 'wait') {
          const woke = await waitQuota(authority, current.choice, decision.blocked, decision.nextResetAt);
          attempted = new Set();
          retryBlocked = woke === 'retry';
          await noteLoop({ wait: null });
          continue;
        }
        const stepHost = decision.host;
        const prepared = await preflight(async () => {
          stopped();
          await requireStart(stepHost, current.checkout.cwd);
          const pluginRoot = await (await import('./updater.ts')).requireSameRevision(stepHost, main, root);
          if ((await gone(root)) || !(await stat(join(root, 'step-prompt.md')).catch(() => null))?.isFile())
            return null;
          const chosen =
            override === undefined
              ? (effort ?? { level: defaultLevel, source: 'default' as const })
              : { level: override, source: 'override' as const };
          const { args, applied, model } = await hostArguments(
            stepHost,
            issue,
            step,
            root,
            main,
            { pluginRoot, landing: config.landing, recovery: retrying },
            chosen.level,
          );
          return { args, applied, model, ...chosen };
        });
        stopped();
        first = 'gated';
        if (prepared === null) {
          await removal();
          return outcome('stopped', removed, 'Start the daemon again.');
        }
        const { args, applied, model } = prepared;
        say(startLine(prompt, prepared.level, prepared.source, applied, model));
        const attempt: UsageAttempt = {
          id: randomUUID(),
          host: stepHost,
          main,
          startedAt: Date.now(),
          sessionId: stepHost === 'claude' ? randomUUID() : null,
        };
        const capture = state.usageCapture(attempt.id).path;
        let sessionArgs = args;
        if (stepHost === 'claude') {
          ensureFolder(state.root);
          ensureFolder(state.usageCaptures);
          ensureFolder(state.usageCapture(attempt.id));
          sessionArgs = [...(await prepareClaudeUsage(attempt, capture)), ...args];
        }
        const owned = {
          id: attempt.id,
          host: stepHost,
          startedAt: attempt.startedAt,
          sessionId: attempt.sessionId,
        };
        const record: SessionRecord = {
          schema: 2,
          host: stepHost,
          issue,
          step,
          checkout: main,
          session_id: null,
          effort: applied,
        };
        const quiet = input.kind !== 'resume' && input.quiet;
        const facts = {
          step,
          host: stepHost,
          next,
          authority,
          choice: current.choice,
          record,
          announced: attempt.sessionId ?? '',
          ticket: null,
          capture,
          owned,
        };
        let ticket: UsageTicket | undefined;
        let begun: Awaited<ReturnType<typeof startSession>>;
        admit({ ok: true });
        try {
          begun = await startSession(n, step, stepHost, sessionArgs, !quiet, facts, attempt.id, retrying, async () => {
            ticket = await beginUsageAttempt(common, attempt);
            if (retrying)
              await saveRecovery(authority, current.choice, (each) => ({
                ...each,
                attempt: owned,
                state: 'recovering',
              }));
            await writeSession(main, record, locks);
            return { ticket };
          });
        } catch (error) {
          if (ticket === undefined) await rm(capture, { recursive: true, force: true });
          throw error;
        }
        if (ticket === undefined) throw new Error('usage: a session started with no usage attempt');
        const { ended, barrier } = begun;
        const steering: Steered = { ...facts, ticket };
        stepEndIssue = issue;
        stepEndOwner = daemon;
        await publish(stepHost, 'checking', null);
        const result = await follow({ ...steering, ended, barrier, startedMs: Date.now() }, true);
        if (result) return result;
      }
    } finally {
      watcher?.abort();
      await watching;
      await clearStepEnd();
      stepEndIssue = undefined;
      await closeUnreleased();
      await locks.release(`issue-${n}`, handOff());
    }
  };
  const resumeRun = async (n: number, from?: Resumed): Promise<RunEnd> => {
    if (!from) {
      const holder = await locks.take(`issue-${n}`);
      if (holder !== null) die(`another run or its session (PID ${holder}) works on #${n}`, exits.prerequisite);
      await note({ issue: n, lock: `issue-${n}` });
    }
    const session = from?.record.session;
    let code: number | null;
    if (session?.barrier && (from?.phase === 'live' || from?.phase === 'ended')) {
      const exit = sessionExit(session.folder, session.barrier);
      if (from.phase === 'live') {
        mark('running');
        watchDir = session.folder;
        code = await sessionEnd(exit);
      } else code = await exit;
    } else {
      const saved = await selectSavedSession(main, n, selection.explicit, common, locks);
      operation = await createOperation(checkout, { ...selection, saved: saved.host }, 'main');
      const host = operation.host;
      await preflight(async () => {
        stopped();
        await requireStart(host, operation.checkout.cwd);
      });
      stopped();
      if (!from) await hooks.ready?.();
      admit({ ok: true });
      const { ended, barrier } = await startSession(String(n), saved.step, host, resumeArguments(saved), true, {
        step: saved.step,
        host,
        next: null,
        authority: null,
        choice: null,
        record: saved,
        announced: '',
        ticket: null,
        capture: null,
        owned: null,
      });
      await noteBarrier(barrier, Date.now());
      await releaseBarrier();
      code = await sessionEnd(ended);
    }
    normalEnd(code);
    return { kind: 'stopped', code: code === null ? exits.blocked : passOn(code), reason: '' };
  };
  const queueRun = async (claim: Readonly<{ id: string; token: string }>): Promise<RunEnd> => {
    operation = await createOperation(checkout, selection, 'main');
    stopped();
    const holder = await locks.take('queue');
    if (holder !== null) throw new HostError('queue: another run owns this work', exits.prerequisite);
    queue = await updateQueue(
      main,
      async (current) => {
        stopped();
        if (!current || current.id !== claim.id || current.launch?.token !== claim.token)
          throw new HostError('queue: stale launch token; no session started', exits.prerequisite);
        if (!current.choice) throw new HostError('queue: no recorded agent choice', exits.prerequisite);
        requireQueueChoice(current.choice, operation.choice);
        if (await lockHolder(main, `issue-${current.numbers[0]}`))
          throw new HostError('queue: a run or its foreground still owns this work', exits.prerequisite);
        return current;
      },
      common,
      locks,
    );
    queueWritable = true;
    const authorization = queue.launch?.authorization;
    const request: Parameters<typeof runIssue>[2] =
      authorization && authorization.number === queue.numbers[0]
        ? { step: authorization.step, retry: authorization.retry }
        : undefined;
    await note({ issue: queue.numbers[0] ?? null, request: request ?? null });
    shown = { ...shown, numbers: queue.numbers };
    const pinned = explicitHost(queue.choice);
    selection = pinned === null ? {} : { saved: pinned };
    operation = await fresh();
    await hooks.ready?.();
    await saveQueue({ state: 'running', launch: null });
    return drainQueue((n) => runIssue(n, request ? 'any' : 'gated', request, queueHooks));
  };
  const queueHooks: IssueHooks = {
    beforeStart: (next, activeHost) =>
      saveQueue({
        state: 'running',
        current: next,
        last: next,
        reason: null,
        act: null,
        activeHost,
        waitId: null,
      }),
    onWait: (waitId, reason) =>
      saveQueue({
        state: 'quota-wait',
        activeHost: null,
        waitId,
        reason,
        act: 'Wait for the reset, or use Retry of this issue.',
      }),
  };
  const drainQueue = async (first: (n: string) => Promise<IssueOutcome>): Promise<RunEnd> => {
    if (queue === null) throw new HostError('daemon: queue: no submitted queue', exits.internal);
    let start = first;
    while (queue.numbers.length) {
      const n = String(queue.numbers[0]);
      const result = await start(n);
      start = (each) => runIssue(each, 'gated', undefined, queueHooks);
      if (result.kind !== 'closed') {
        await saveQueue({
          activeHost: null,
          waitId: null,
          state: result.kind === 'gate' ? 'me-gate' : 'error',
          current: result.next?.kind === 'run' ? result.next : null,
          last: result.last,
          reason: result.reason,
          act: result.act,
        });
        if (result.kind !== 'gate') recordEvent({ name: 'queue-error', message: result.reason, issue: Number(n) });
        return { kind: result.kind, code: exits.done, reason: result.reason };
      }
      for (;;) {
        const snapshot = await readQueue(main, common, locks);
        if (!snapshot || snapshot.id !== queue.id || snapshot.numbers[0] !== Number(n))
          throw new HostError('queue: current issue changed during drain', exits.prerequisite);
        const { next } = await nextOf(n, await fresh(), halt.signal);
        stopped();
        if (next.kind !== 'stop' || (next.reason !== 'finished' && next.reason !== 'wontfix'))
          die('queue: cannot advance without a fresh closed resolver result', exits.prerequisite);
        let drained = false;
        try {
          queue = await updateQueue(
            main,
            async (current) => {
              if (!current || current.id !== snapshot.id)
                throw new HostError('queue: identity changed during drain', exits.prerequisite);
              if (current.revision !== snapshot.revision) return current;
              const numbers = current.numbers.slice(1);
              if (!numbers.length) await locks.release('queue', handOff());
              drained = true;
              return numbers.length
                ? { ...current, numbers, current: null, last: null, reason: null, act: null }
                : emptyQueue(current);
            },
            common,
            locks,
          );
        } catch (error) {
          storageFailed = true;
          throw error;
        }
        shown = { ...shown, numbers: queue.numbers };
        if (drained) break;
      }
      if (queue.numbers.length)
        await note({
          issue: queue.numbers[0] ?? null,
          lock: null,
          request: null,
          wait: null,
          session: null,
          loop: {
            first: 'gated',
            last: null,
            lastHost: explicitHost(queue.choice) ?? 'claude',
            exitCode: 0,
            started: false,
            attempted: [],
            retrying: false,
            retryBlocked: false,
            finished: tabs.finished || null,
          },
        });
    }
    queueWritable = false;
    const reason = 'queue: empty; Add starts the next issue';
    say(reason);
    return { kind: 'closed', code: exits.done, reason };
  };
  const issueRun = async (n: number, first: 'any' | 'gated', override?: Level) => {
    operation = await createOperation(checkout, selection, 'main');
    initial = operation;
    await hooks.ready?.();
    return runIssue(String(n), first, undefined, undefined, override);
  };
  const queueFailure = async (error: unknown): Promise<RunEnd> => {
    const reason = error instanceof Error ? error.message : String(error);
    if (queueWritable && !storageFailed) {
      await closeTabs();
      try {
        await saveQueue({
          state: 'error',
          activeHost: null,
          waitId: null,
          launch: null,
          reason,
          act: 'Fix the cause, then use Try again for the displayed step.',
        });
      } catch (failure) {
        told = (failure as Error).message;
        console.error(told);
        return { kind: 'stopped', code: exits.blocked, reason: told };
      }
      if (reason) {
        told = reason;
        console.error(reason);
      }
      recordEvent({
        name: 'queue-error',
        message: reason,
        issue: queue?.numbers[0] ?? null,
        error: error instanceof HostError ? undefined : error,
      });
      return { kind: 'stopped', code: exits.done, reason };
    }
    if (reason) {
      told = reason;
      console.error(reason);
    }
    markDefect(error);
    return { kind: 'stopped', code: error instanceof HostError ? error.code : exits.internal, reason };
  };
  let issueStarted = false;
  const sessionPhase = async (session: Facts): Promise<'missing' | 'live' | 'ended'> => {
    for (;;) {
      stopped();
      const go = await stat(startFiles(session.folder).go).then(
        () => true,
        (error: NodeJS.ErrnoException) => (error.code === 'ENOENT' ? false : null),
      );
      if (go === false) return 'missing';
      if (go) {
        if (!session.barrier) throw new Error('run record: a released session has no start barrier');
        const { pid, start } = session.barrier;
        const state = await processState(pid, start);
        const script = state === 'gone' ? 'gone' : await processScript(pid, daemonScript);
        if (state === 'gone' || script === 'gone') return 'ended';
        if (state === 'runs' && script === 'runs') return 'live';
      }
      await rest(2000);
    }
  };
  const takeOver = async (record: RunRecord): Promise<RunEnd> => {
    mark('taken-over');
    const { session } = record;
    const n = record.issue ?? 0;
    const claimed = session?.barrier
      ? { pid: session.barrier.pid, start: session.barrier.start }
      : session
        ? pidOf(await readFile(startFiles(session.folder).pid, 'utf8').catch(() => ''))
        : null;
    const issueLock = record.lock ?? (record.queue && record.issue !== null ? `issue-${record.issue}` : null);
    const names = (record.queue ? ['queue', issueLock] : [issueLock]).filter((name) => name !== null);
    for (;;) {
      let claim: LockClaim = { kind: 'taken' };
      for (const name of names) {
        claim = await locks.adopt(name, claimed);
        if (claim.kind !== 'taken') break;
      }
      if (claim.kind === 'taken') break;
      if (claim.kind === 'held') {
        const reason = `#${n}: another run or its session (PID ${claim.holder}) took #${n} while no daemon ran; this run ends`;
        say(reason);
        admit({ ok: false, line: `daemon: ${reason}`, code: exits.done });
        return { kind: 'stopped', code: exits.done, reason };
      }
      admit({ ok: true });
      await rest(2000);
      stopped();
    }
    admit({ ok: true });
    await note({ lock: issueLock });
    if (record.queue) {
      const found = await readQueue(main, common, locks);
      if (!found || found.id !== record.queue.id || found.numbers[0] !== record.issue) {
        const reason = 'queue: the queue changed while no daemon ran; this run ends';
        say(reason);
        return { kind: 'stopped', code: exits.done, reason };
      }
      queue = found;
      queueWritable = true;
      shown = { ...shown, numbers: queue.numbers };
      const pinned = explicitHost(queue.choice);
      selection = pinned === null ? {} : { saved: pinned };
      if (record.input.kind === 'queue' && queue.launch?.token === record.input.token)
        await saveQueue({ state: 'running', launch: null });
    }
    tabs.finished = record.loop.finished ?? '';
    let phase: Phase = record.loop.started ? 'between' : 'before';
    if (session) {
      terminal = session.terminal ?? '';
      tab = session.tab;
      shown = { ...shown, issue: n, step: session.step, host: session.host, tab, barrier: claimed };
      const read = await sessionPhase(session);
      if (read !== 'live') watchDir = session.folder;
      if (read === 'missing') {
        await closeTerminal(terminal);
        const reason = `#${n}: the daemon stopped before the step ${session.step} started; no step was started`;
        say(reason);
        if (record.queue)
          return drainQueue(async () => ({
            kind: 'stopped',
            started: false,
            next: session.next,
            last: record.loop.last,
            exitCode: record.loop.exitCode,
            reason,
            act: 'Fix the cause, then use Try again for the displayed step.',
          }));
        return { kind: 'stopped', code: exits.done, reason };
      }
      phase = read;
    }
    if (record.input.kind === 'resume') return await resumeRun(n, { record, phase });
    operation = await createOperation(checkout, selection, 'main');
    initial = operation;
    const resumed: Resumed = { record, phase };
    if (record.queue) {
      const request = phase === 'before' ? (record.request ?? undefined) : undefined;
      return drainQueue((each) => runIssue(each, request ? 'any' : 'gated', request, queueHooks, undefined, resumed));
    }
    const result =
      phase === 'before'
        ? await runIssue(
            String(n),
            record.loop.first,
            record.request ?? undefined,
            undefined,
            record.input.kind === 'number' ? (record.input.effort ?? undefined) : undefined,
            { record, phase },
          )
        : await runIssue(String(n), 'gated', undefined, undefined, undefined, { record, phase });
    issueStarted = result.started;
    return { kind: result.kind, code: exits.done, reason: result.reason };
  };
  const work = async (): Promise<RunEnd> => {
    try {
      checkout = options.checkout ?? (await locateCheckouts(process.cwd()));
      if (from) return await takeOver(from);
      if (input.kind === 'resume') return await resumeRun(input.number);
      if (input.kind === 'queue') return await queueRun(input);
      const result =
        input.kind === 'number'
          ? await issueRun(input.number, 'any', input.effort ?? undefined)
          : await issueRun(input.number, 'gated');
      issueStarted = result.started;
      return { kind: result.kind, code: exits.done, reason: result.reason };
    } catch (error) {
      if (detach.signal.aborted && error instanceof HostError)
        return { kind: 'detached', code: exits.done, reason: '' };
      if (input.kind === 'queue') return await queueFailure(error);
      if (error instanceof HostError) {
        if (error.message) {
          told = error.message;
          console.error(told);
        }
        return { kind: 'stopped', code: error.code, reason: error.message };
      }
      throw error;
    } finally {
      mark('ending');
      watcher?.abort();
      await watching;
      if (options.tabs && !detach.signal.aborted) await closeUnreleased();
      else await closeTabs();
      if (watchDir) await rm(watchDir, { recursive: true, force: true });
      await clearStepEnd();
      await locks.releaseAll(handOff());
      mark('finished');
    }
  };
  const ended = handled(
    work().then(
      (end) => {
        admit({ ok: false, line: told ?? end.reason, code: end.code });
        return { end, started: issueStarted };
      },
      (error: unknown) => {
        admit({ ok: false, line: error instanceof Error ? error.message : String(error), code: exits.internal });
        throw error;
      },
    ),
  );
  const handle: RunHandle = {
    id,
    input,
    admitted,
    done: handled(ended.then((each) => each.end)),
    view: () => Object.freeze({ ...shown }),
    detach() {
      detach.abort();
      watcher?.abort();
      halt.abort();
    },
  };
  return { handle, settled: ended };
}

export function autoLoop(
  place: Place,
  input: { selection: HostSelection; quiet: boolean },
  options: {
    hooks: RunHooks;
    active: () => boolean;
    signal: AbortSignal;
    launch: <T extends Readonly<{ handle: RunHandle }>>(start: () => T) => T;
    leaving?: () => void;
    journal: Journal;
    adopted?: Promise<ExitCode>;
  },
): { admitted: Promise<Admission>; done: Promise<ExitCode> } {
  const { main, common, root } = place;
  const { hooks, signal } = options;
  const filter: Filter = { said: '', repeat: true };
  const locks = createLockOwner(main);
  let admit: (admission: Admission) => void = () => {};
  const admitted = new Promise<Admission>((done) => {
    admit = done;
  });
  const say = (message: string) => {
    if (message === filter.said) return false;
    filter.said = message;
    console.log(`daemon: ${message}`);
    return true;
  };
  const aborted = new Promise<null>((done) => {
    if (signal.aborted) done(null);
    else signal.addEventListener('abort', () => done(null), { once: true });
  });
  const running = () => !signal.aborted && options.active();
  const tabs: Tabs = { finished: '' };
  const loop = async (): Promise<ExitCode> => {
    try {
      const checkout = await locateCheckouts(process.cwd());
      const fresh = () => createOperation(checkout, input.selection, 'main');
      let initial: Operation | undefined = await fresh();
      await hooks.ready?.();
      const holder = await locks.take('auto');
      if (holder !== null) die(`auto mode of another daemon or its session has PID ${holder}`, exits.prerequisite);
      admit({ ok: true });
      if (options.adopted) {
        const code = await Promise.race([options.adopted, aborted]);
        if (code) return code;
        initial = undefined;
      }
      while (running()) {
        if (await gone(root)) {
          hooks.removed();
          await aborted;
          return exits.done;
        }
        const current = initial ?? (await fresh());
        initial = undefined;
        const config = current.mainConfig as Config;
        if (current.choice.kind === 'explicit')
          await (await import('./plugin-policy.ts')).requireUpdatePolicy(current.host, main);
        const { nextOpen } = await import('./resolver.ts');
        const { lineOf } = await import('./lines.ts');
        const { rows, stderr } = await nextOpen(current, signal);
        process.stderr.write(stderr);
        if (signal.aborted) break;
        let started = false;
        if (rows) {
          let pick = 0;
          for (const { number, next } of rows) {
            const n = String(number);
            if (next.kind !== 'run' || (config.gates?.[next.step] ?? defaultGate) !== 'auto') continue;
            if ((await lockHolder(main, `issue-${n}`)) || (await isRecorded(common, n, lineOf(n, next)))) continue;
            pick = number;
            break;
          }
          if (pick) {
            // No await may come between this check and `launch`, or a signal can miss the run.
            if (!running()) break;
            const start = () =>
              begin(
                place,
                { kind: 'auto', number: pick, selection: input.selection, quiet: input.quiet },
                {
                  hooks: { removed: hooks.removed, fatal: hooks.fatal },
                  locks: createLockOwner(main),
                  filter: { said: '', repeat: true },
                  checkout,
                  tabs,
                  journal: options.journal,
                },
              );
            const run = options.launch(start);
            const result = await run.settled;
            if (result.end.code !== exits.done) return result.end.code;
            started = result.started;
          } else say('no auto step can start; auto mode asks again each 60 seconds');
        } else if (say('stop cannot read the open issues from GitHub'))
          recordEvent({ name: 'issues-read', message: 'daemon: stop cannot read the open issues from GitHub' });
        if (!started) {
          const until = performance.now() + 60_000;
          while (running() && performance.now() < until) await Bun.sleep(50);
        }
      }
      return exits.done;
    } catch (error) {
      if (error instanceof HostError) {
        if (error.message) console.error(error.message);
        admit({ ok: false, line: error.message, code: error.code });
        return error.code;
      }
      throw error;
    } finally {
      options.leaving?.();
      const id = tabs.finished;
      tabs.finished = '';
      if (id) await closeTerminal(id);
      await locks.releaseAll();
    }
  };
  const done = handled(
    loop().then(
      (code) => {
        admit({ ok: false, line: '', code });
        return code;
      },
      (error: unknown) => {
        admit({ ok: false, line: error instanceof Error ? error.message : String(error), code: exits.internal });
        throw error;
      },
    ),
  );
  return { admitted, done };
}
