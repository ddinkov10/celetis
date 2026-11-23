import { AsyncResource } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { readAgentOrder } from '../agent/order.ts';
import { beginUsageAttempt, readUsage, recordUsage, type UsageTicket } from '../agent/usage.ts';
import { attemptModel, recordAttemptEnd, recordAttemptStart } from '../attempt/attempt.ts';
import { HostError } from '../command/errors.ts';
import { type CheckoutIdentity, createOperation, type HostSelection, type Operation } from '../command/operation.ts';
import type { AgentChoice, Config, Host } from '../config/core.ts';
import { requireContract } from '../contract/check.ts';
import { type ExitCode, exits, signalExit } from '../contract/contract.ts';
import { daemonArgv } from '../daemon/start.ts';
import { stopKeptLine } from '../daemon/types.ts';
import { hostAvailability } from '../host/host.ts';
import { canRun, hostAdapter, type Need, requireCan, writeSessionEnv } from '../host/hosts.ts';
import { assistPrompt, interactiveHost } from '../host/interactive.ts';
import { hosts } from '../host/names.ts';
import type { SessionStart } from '../host/types.ts';
import type { ObservedUsage, UsageAttempt } from '../host/usage.ts';
import { versionFolderGone } from '../install/version-folder.ts';
import {
  controllingTerminal,
  daemonScript,
  processScript,
  processStart,
  processState,
  processTable,
  terminateChild,
} from '../process/identity.ts';
import { openJob, sessionJobName } from '../process/windows.ts';
import { emptyQueue } from '../queue/actions.ts';
import { explicitHost, readQueue, requireQueueChoice, updateQueue } from '../queue/queue.ts';
import { clearAside, readSetAside, setAside } from '../queue/set-aside.ts';
import type { QueueRecord } from '../queue/types.ts';
import { markDefect, passOn, recordEvent } from '../state/events.ts';
import { addRecord, type Identity, issueLock, type LockClaim, type LockOwner, lockHolder } from '../state/locks.ts';
import { startFiles } from '../state/state.ts';
import {
  closeTerminal,
  exitGraceMs,
  inSequence,
  openTab,
  readTerminal,
  requestExit,
  TerminalError,
  terminalLive,
  waitTerminal,
} from '../terminal/terminal.ts';
import type { TerminalStatus } from '../terminal/types.ts';
import type { IssueKey } from '../tracker/key.ts';
import { startPair } from '../workflow/effort.ts';
import { type Run, type SessionWork, sameResult, tabLabel } from '../workflow/workflow.ts';
import {
  type AttemptEnd,
  endOwnedAttempt,
  type OwnedSession,
  recordMembers,
  type StopEvidence,
} from './attempt-end.ts';
import type { Admission, Place, RunHooks, RunInput, RunState, RunView } from './engine.ts';
import {
  type Basis,
  type Effect,
  type EventOf,
  type Facts,
  type Flags,
  type Loop,
  type Own,
  type Request,
  type Seen,
  type StateOf,
  type Steered,
  unwatched,
  type Working,
} from './machine.ts';
import {
  archiveSession,
  permitHolds,
  type QuotaBlock,
  type QuotaRecovery,
  quotaWake,
  type RecoveryAuthority,
  RecoveryError,
  readRecovery,
  snapshotLane,
  updateRecovery,
  validateRecovery,
} from './quota-recovery.ts';
import type { RunRecord } from './record.ts';
import {
  observeSession,
  readSession,
  type SessionRecord,
  selectSavedSession,
  startLine,
  startupError,
  stepText,
  writeSession,
} from './session.ts';
import {
  removeStepEnd,
  type StepEndRecord,
  type StepEndState,
  type TurnKey,
  verdictOf,
  writeStepEnd,
} from './step-end.ts';

export const removed = 'the engine version of this daemon was removed after an update; start the daemon again';

const attentive: ReadonlySet<RunState> = new Set(['running', 'checking', 'waiting', 'exiting', 'stopping']);
const idle: Record<TerminalStatus, boolean> = { idle: true, done: true, error: true, working: false, blocked: false };
export const die = (message: string, code: ExitCode): never => {
  throw new HostError(`daemon: ${message}`, code);
};

let preflights: Promise<unknown> = Promise.resolve();
function preflight<T>(work: () => Promise<T>): Promise<T> {
  const next = preflights.then(work);
  preflights = next.catch(() => {});
  return next;
}

export type Options = Readonly<{
  hooks: RunHooks;
  locks: LockOwner;
  filter: { said: string; repeat: boolean };
  checkout?: CheckoutIdentity;
  tabs?: { finished: string };
  journal: (record: RunRecord) => Promise<void>;
}>;
type Live = Steered & Readonly<{ ended: Promise<number | null>; barrier: Identity; startedMs: number }>;
export type IssueHooks = {
  beforeStart?: (next: Run, host: Host) => Promise<void>;
  onWait?: (waitId: string, reason: string) => Promise<void>;
};

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

export async function barrierOf(source: string): Promise<Identity | null | 'unknown'> {
  const found = pidOf(source);
  if (found === null) return null;
  const { pid, start } = found;
  const state = await processState(pid, start);
  const script = state === 'gone' ? 'gone' : await processScript(pid, daemonScript);
  if (state === 'gone' || script === 'gone') return null;
  return state === 'runs' && script === 'runs' ? { pid, start } : 'unknown';
}

async function releasedLive(dir: string): Promise<boolean> {
  const files = startFiles(dir);
  if (!(await stat(files.go).catch(() => null))?.isFile()) return false;
  const source = await readFile(files.pid, 'utf8').catch(() => null);
  return source !== null && (await barrierOf(source)) !== null;
}

function steered(session: Facts): Steered & Readonly<{ barrier: Identity; startedMs: number }> {
  const { step, record, next, authority, choice, ticket, capture, owned, barrier, startedMs } = session;
  if (
    step === 'assist' ||
    !record ||
    !next ||
    !authority ||
    !choice ||
    !ticket ||
    !capture ||
    !owned ||
    !barrier ||
    startedMs === null
  )
    throw new Error('run record: the session of an issue run lacks its facts');
  return {
    ...session,
    step,
    record,
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

export function createIo(place: Place, input: RunInput, options: Options, from: RunRecord | undefined) {
  const { main, common, state, root } = place;
  const { hooks, locks, filter } = options;
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
  let stepEndIssue: IssueKey | undefined;
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
    terminal: null,
    turn: null,
  };
  let stop: NonNullable<RunRecord['stop']> | null = from?.stop ?? null;
  let evidence: StopEvidence | null = null;
  let held: RunState = shown.state;
  let open = false;
  let claimed = false;
  let keepsLock = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = new AsyncResource('run-io');
  let kept = Promise.withResolvers<void>();
  const mark = (next: RunState) => {
    if (stop) held = next;
    const label = stop && next !== 'ending' && next !== 'finished' ? 'stopping' : next;
    shown = {
      ...shown,
      state: label,
      changedMs: Date.now(),
      ...(attentive.has(label) ? {} : { terminal: null, turn: null }),
    };
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
    const { stop: _stop, ...next }: RunRecord = {
      ...(fact ?? {
        schema: 5,
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
    fact = stop ? { ...next, stop } : next;
    await options.journal(fact);
  };
  const expire = () => {
    if (!stop || claimed || detach.signal.aborted) return;
    if (!open) {
      timer = setTimeout(expire, 250);
      return;
    }
    evidence?.job?.close();
    evidence = null;
    stop = null;
    kept.resolve();
    kept = Promise.withResolvers<void>();
    mark(held);
    if (shown.issue !== null) say(stopKeptLine(shown.issue));
    note().catch((error: unknown) => console.error((error as Error).message));
  };
  const arm = () => {
    clearTimeout(timer);
    if (stop) timer = setTimeout(frame.bind(expire), Math.max(0, stop.at + 60_000 - Date.now()));
  };
  const openStop = () => {
    open = true;
  };
  const claimStop = () => {
    open = false;
    if (stop) {
      claimed = true;
      clearTimeout(timer);
    }
    return stop;
  };
  // An open session window and the flag change together, so a Stop is either refused or ends the run as a Stop.
  const requestStop = async (id: string) => {
    if (stop) return;
    if (!open) die(`#${shown.issue} has no session that runs now`, exits.prerequisite);
    stop = { terminal: id, at: Date.now() };
    claimed = false;
    mark(shown.state);
    try {
      await note();
    } catch (error) {
      if (!claimed) {
        stop = null;
        mark(held);
      }
      throw error;
    }
    arm();
    const session = fact?.session;
    if (session?.owned && session.barrier && hostAdapter(session.owned.host).terminatesAfterGrace) {
      const owned = ownedOf(session.barrier);
      let members: StopEvidence['members'] = null;
      let job: StopEvidence['job'] = null;
      try {
        if (process.platform === 'win32') job = openJob(sessionJobName(session.owned.id, ''));
        else members = await recordMembers(session.owned.id, owned);
      } catch {}
      evidence = { members, job, closedAt: performance.now() };
    }
    await closeTerminal(id);
  };
  const takeEvidence = () => {
    const taken = evidence;
    evidence = null;
    return taken;
  };
  arm();
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
    return {
      ...barrier,
      terminal,
      shell: same ? recorded.shell : null,
      tty: same ? recorded.tty : null,
      folder: same ? (fact?.session?.folder ?? null) : null,
    };
  };
  const removal = async (): Promise<never> => {
    hooks.removed();
    await halted;
    stopped();
    throw new HostError('', exits.prerequisite);
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
  const requireStart = async (host: Host, cwd: string, need: Need) => {
    requireCan(host, need, 'daemon');
    await hostAdapter(host).checkHome();
    const { requireUpdatePolicy } = await import('../plugin/policy.ts');
    await (await import('../update/lock.ts')).withPluginRead(host, async () => {
      await requireUpdatePolicy(host, cwd);
      if (cwd !== main) await requireUpdatePolicy(host, main);
    });
    const availability = hostAvailability(host);
    if (!availability.available) throw new HostError(availability.cause, exits.prerequisite);
  };
  const nextOf = async (
    n: IssueKey,
    current: Operation,
    abort?: AbortSignal,
    permit?: Awaited<ReturnType<typeof validateRecovery>>,
  ) => {
    const { nextIssue } = await import('../resolver/resolver.ts');
    const { lineOf } = await import('../resolver/lines.ts');
    const keeps =
      permit && (async (lane: string) => lane === permit.lane && permitHolds(current.checkout.main as string, permit));
    const { next, decided, authority, stderr } = await nextIssue(n, current, abort, keeps);
    process.stderr.write(stderr);
    return { next, decided, authority, line: lineOf(n, next) };
  };
  const blockedText = (blocked: readonly QuotaBlock[]) =>
    blocked
      .map(
        (each) =>
          `${each.host}: ${each.reason} Reset: ${each.resetAt === null ? 'unknown' : new Date(each.resetAt).toISOString()}`,
      )
      .join('; ') || 'no included agent can start';
  const usageWarning = (n: IssueKey) => {
    let warned = false;
    return (error: unknown) => {
      if (!warned) console.error(`daemon: #${n} cannot record usage: ${(error as Error).message}`);
      warned = true;
    };
  };
  const observeUsage = async (
    n: IssueKey,
    ticket: UsageTicket,
    capture: string,
    warn: (error: unknown) => void,
  ): Promise<ObservedUsage | null> => {
    const saved = await readSession(main, n, common, locks).then(
      (record) => record.session_id,
      () => null,
    );
    if (saved === null || (ticket.attempt.sessionId !== null && ticket.attempt.sessionId !== saved)) return null;
    ticket.attempt.sessionId = saved;
    const observed = await hostAdapter(ticket.attempt.host).readUsage(ticket.attempt, capture);
    await recordUsage(common, ticket, observed).catch(warn);
    return observed;
  };
  const watchUsage = async (
    n: IssueKey,
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
      await writeStepEnd(main, stepEndIssue as IssueKey, { daemon: stepEndOwner, terminal, host, state, turn });
      mark(state);
      shown = { ...shown, turn: turn?.sequence ?? null };
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
    n: IssueKey,
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
    const adapter = hostAdapter(record.host);
    let saved = false;
    let warned = false;
    while (!abort.aborted) {
      const claim = await adapter.claim(main, adapter.stepPrompt(record.step, n), announced, startedAt);
      const result = await observeSession(record, claim, startedAt, locks);
      if (result === 0) {
        saved = true;
        break;
      }
      if (result === 2) {
        await writeFile(startFiles(watchDir).error, '');
        await startupError(n, record.host, 'no single session identity can be saved', terminal, tab);
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
    const id = (await readSession(main, n, common, locks)).session_id ?? '';
    let retained: TurnKey | null = null;
    while (!abort.aborted && (await waitTerminal(terminal, 60, abort))) {
      if (await versionFolderGone(root)) {
        await removal();
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
          const requested =
            verdict === 'exiting'
              ? await inSequence(terminal, async () => {
                  if (abort.aborted) return null;
                  const again = await sessionTurn(id, record.host, startedMs, abort);
                  if (!again?.idle || !sameTurn(turn, again.turn)) return null;
                  if (!(await publish(record.host, 'exiting', turn))) return false;
                  // hc send can return seconds after the delivery, while it waits for a turn to start.
                  const begun = performance.now();
                  if (await requestExit(terminal, record.host, abort)) return begun;
                  if (!abort.aborted) {
                    await publish(record.host, 'waiting', turn);
                    const line = `daemon: #${n} cannot request ${record.host} exit; the session stays open. Exit it in the tab ${tab} when ready.`;
                    console.error(line);
                    recordEvent({ name: 'exit-request', message: line, issue: n });
                  }
                  return false;
                })
              : null;
          if (requested === false) return false;
          if (requested !== null) {
            const mark = startFiles(watchDir).terminated;
            let settled = false;
            let after: ReturnType<typeof setTimeout> | undefined;
            const report = (name: string, line: string) => {
              console.error(line);
              recordEvent({ name, message: line, issue: n });
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
              const pid = adapter.terminatesAfterGrace ? await signalHost() : null;
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
                process.platform === 'win32'
                  ? `daemon: #${n} ${record.host} did not exit within 10 seconds; the daemon ended its host process (PID ${pid}).`
                  : `daemon: #${n} ${record.host} did not exit within 10 seconds; the daemon sent SIGTERM to its host process (PID ${pid}).`,
              );
              if (settled || abort.aborted) return;
              after = setTimeout(() => {
                if (abort.aborted) return;
                report(
                  'exit-timeout',
                  process.platform === 'win32'
                    ? `daemon: #${n} ${record.host} did not exit within 10 seconds after the end of its host process; the session stays open. Exit it in the tab ${tab} when ready.`
                    : `daemon: #${n} ${record.host} did not exit within 10 seconds after SIGTERM; the session stays open. Exit it in the tab ${tab} when ready.`,
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
          if (verdict !== 'exiting' && !(await publish(record.host, verdict, turn))) return false;
          retained = verdict === 'waiting' ? turn : null;
        }
      } else {
        retained = null;
        await clearStepEnd();
      }
      await pause(5000, undefined, { signal: abort }).catch(() => {});
    }
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
    n: IssueKey,
    work: SessionWork,
    host: Host,
    args: string[],
    facts: Omit<Facts, 'folder' | 'terminal' | 'tab' | 'barrier' | 'startedMs'>,
    session: Omit<SessionStart, 'folder'>,
    attempt = '-',
    recovery = false,
    opened: () => Promise<Partial<Facts>> = async () => ({}),
  ) => {
    args = [...(await hostAdapter(host).pin(main)), ...args];
    const dir = await mkdtemp(state.startPrefix);
    watchDir = dir;
    tab = tabLabel(n, work);
    shown = { ...shown, issue: n, step: work, host, tab, barrier: null, terminal: null, turn: null };
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
      await writeSessionEnv(host, { ...session, folder: dir });
    } catch (error) {
      die(
        `#${n} cannot prepare the session environment: ${(error as Error).message}`,
        error instanceof HostError ? error.code : exits.blocked,
      );
    }
    try {
      terminal = await openTab({
        repository: { main, common },
        folder: main,
        name: tab,
        argv: daemonArgv(root, [
          '--session-start',
          dir,
          String(process.pid),
          host,
          attempt,
          recovery ? 'recovery' : '-',
          ...args,
        ]),
        env: { BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', DO_NOT_TRACK: '1' },
        focus: false,
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
            process.platform === 'win32'
              ? `#${n} ${host} startup: the tab ${tab} ended before its start barrier reported; start the step again`
              : `#${n} ${host} startup: the tab ${tab} ended before its start barrier reported; check the login files of $SHELL, then start the step again`,
            exits.blocked,
          );
      }
      if (!warned && now - waited >= 60_000) {
        warned = true;
        console.error(
          process.platform === 'win32'
            ? `daemon: #${n} ${host} startup: the start barrier of the tab ${tab} did not report after 60 seconds; waiting continues. Read that tab.`
            : `daemon: #${n} ${host} startup: the start barrier of the tab ${tab} did not report after 60 seconds; waiting continues. Check the login files of $SHELL in that tab.`,
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
    shown = { ...shown, terminal };
  };
  const sessionEnd = async (ended: Promise<number | null>) => {
    const code = await Promise.race([ended, halted]);
    if (!detach.signal.aborted) return code;
    // The released barrier can still be waiting to read go in the start folder.
    watchDir = '';
    throw new HostError('', exits.prerequisite);
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
  const issueHooks = input.kind === 'queue' ? queueHooks : undefined;
  let recovery: QuotaRecovery | null = null;
  let daemon: Identity;
  const issueOf = (n: IssueKey, attempted: readonly Host[] = []) => {
    const issue = n;
    const hooks = issueHooks;
    const saveRecovery = async (
      authority: RecoveryAuthority,
      choice: AgentChoice,
      change: (current: QuotaRecovery) => QuotaRecovery,
    ) => {
      stopped();
      recovery = await updateRecovery(main, issue, (current) =>
        change(
          current ?? {
            schema: 4,
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
            lock: issueLock(issue),
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
      const seen =
        kept?.seen ??
        (Object.fromEntries(hosts.map((host) => [host, seenOf(host)])) as NonNullable<RunRecord['wait']>['seen']);
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
            canRun(each, { kind: 'step', step: authority.step }) &&
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
    const endAttempt = async (s: Steered, barrier: Identity): Promise<AttemptEnd> => {
      await saveRecovery(s.authority, s.choice, (record) => ({
        ...record,
        attempt: { ...s.owned, sessionId: s.ticket.attempt.sessionId },
        state: 'recovering',
      }));
      return endOwnedAttempt(s.ticket.attempt, ownedOf(barrier));
    };
    return { saveRecovery, endRecovery, waitQuota, endAttempt };
  };
  return {
    place,
    input,
    id,
    hooks,
    locks,
    tabs,
    shared: options.tabs !== undefined,
    detach,
    halt,
    rest,
    admitted,
    admit: (admission: Admission) => admit(admission),
    get checkout() {
      return checkout;
    },
    set checkout(value: CheckoutIdentity) {
      checkout = value;
    },
    get operation() {
      return operation;
    },
    set operation(value: Operation) {
      operation = value;
    },
    get initial() {
      return initial;
    },
    set initial(value: Operation | undefined) {
      initial = value;
    },
    get selection() {
      return selection;
    },
    set selection(value: HostSelection) {
      selection = value;
    },
    get queue() {
      return queue;
    },
    set queue(value: QueueRecord | null) {
      queue = value;
    },
    get queueWritable() {
      return queueWritable;
    },
    set queueWritable(value: boolean) {
      queueWritable = value;
    },
    get storageFailed() {
      return storageFailed;
    },
    set storageFailed(value: boolean) {
      storageFailed = value;
    },
    get recovery() {
      return recovery;
    },
    set recovery(value: QuotaRecovery | null) {
      recovery = value;
    },
    get daemon() {
      return daemon;
    },
    set daemon(value: Identity) {
      daemon = value;
    },
    get terminal() {
      return terminal;
    },
    set terminal(value: string) {
      terminal = value;
    },
    get tab() {
      return tab;
    },
    set tab(value: string) {
      tab = value;
    },
    get shown() {
      return shown;
    },
    set shown(value: RunView) {
      shown = value;
    },
    get told() {
      return told;
    },
    set told(value: string | null) {
      told = value;
    },
    get stopping() {
      return stop !== null;
    },
    flagCleared: () => kept.promise,
    get keepsLock() {
      return keepsLock;
    },
    set keepsLock(value: boolean) {
      keepsLock = value;
    },
    get recorded() {
      return fact;
    },
    ledger: {
      get watchDir() {
        return watchDir;
      },
      set watchDir(value: string) {
        watchDir = value;
      },
      get unreleased() {
        return unreleased;
      },
      stepEnd: {
        get issue() {
          return stepEndIssue;
        },
        set issue(value: IssueKey | undefined) {
          stepEndIssue = value;
        },
        get owner() {
          return stepEndOwner;
        },
        set owner(value: StepEndRecord['daemon']) {
          stepEndOwner = value;
        },
        get unremovable() {
          return unremovable;
        },
      },
      watch: {
        get watcher() {
          return watcher;
        },
        set watcher(value: AbortController | undefined) {
          watcher = value;
        },
        get watching() {
          return watching;
        },
        set watching(value: Promise<void> | undefined) {
          watching = value;
        },
      },
    },
    issueHooks,
    issueOf,
    mark,
    openStop,
    claimStop,
    requestStop,
    takeEvidence,
    ownedOf,
    say,
    stopped,
    handOff,
    note,
    noteBarrier,
    removal,
    saveQueue,
    fresh,
    nextOperation,
    requireStart,
    nextOf,
    usageWarning,
    observeUsage,
    watchUsage,
    clearStepEnd,
    publish,
    endWhenDone,
    closeUnreleased,
    closeTabs,
    sessionExit,
    startSession,
    releaseBarrier,
    sessionEnd,
    sessionPhase,
  };
}

export type Io = ReturnType<typeof createIo>;
export type Activities = { [S in Working]: (state: StateOf<S>, io: Io) => Promise<EventOf<Own[S]>> };

const flagsOf = (io: Io): Flags => ({
  detached: io.detach.signal.aborted,
  queueWritable: io.queueWritable,
  storageFailed: io.storageFailed,
});
const basisOf = (queue: QueueRecord | null): Basis => ({
  lastHost: explicitHost(queue?.choice) ?? 'claude',
  last: queue?.last ?? null,
});
const unwatchedEnded = (code: number | null, attempt: string | null): EventOf<'session-ended'> => ({
  kind: 'session-ended',
  code,
  end: { scope: 'unwatched', passed: code === null ? exits.blocked : passOn(code), attempt },
});

async function daemonOf(): Promise<Identity> {
  return { pid: process.pid, start: await processStart(process.pid) };
}

async function sessionEnded(
  io: Io,
  issue: IssueKey,
  session: Steered,
  code: number | null,
): Promise<EventOf<'session-ended'>> {
  const { main, common } = io.place;
  const saved = (await readSession(main, issue, common, io.locks)).session_id !== null;
  const reported = !saved && Boolean(await stat(startFiles(io.ledger.watchDir).error).catch(() => null));
  return { kind: 'session-ended', code, end: { scope: 'issue', session, saved, reported } };
}

function blocked(
  io: Io,
  s: Steered,
  reason: string,
  ownership: AttemptEnd,
  ended: Readonly<{ code: number | null }> | null,
): EventOf<'usage-blocked'> {
  const detached = io.detach.signal.aborted;
  // The next daemon proves this session end again from the start folder and the run record.
  if (detached) io.ledger.watchDir = '';
  return { kind: 'usage-blocked', session: s, reason, ownership, detached, resume: resumeOf(s), ended };
}

function resumeOf(s: Steered): string {
  const sessionId = s.ticket.attempt.sessionId ?? '';
  const args = hostAdapter(s.record.host).resumeArguments({ ...s.record, session_id: sessionId });
  return `${s.host} ${args.join(' ')}`;
}

async function halting(io: Io, s: Steered, barrier: Identity, tab: string): Promise<EventOf<'halted'>> {
  const ownership = await endOwnedAttempt(s.ticket.attempt, io.ownedOf(barrier), io.takeEvidence());
  return { kind: 'halted', ownership, host: s.host, tab, resume: resumeOf(s), attempt: s.owned.id };
}

async function haltingUnwatched(io: Io, barrier: Identity, n: IssueKey): Promise<EventOf<'halted'>> {
  const session = io.recorded?.session;
  if (!session) throw new Error('run record: an unwatched run has no session');
  const { host, record, owned, tab } = session;
  const resume = record
    ? `${host} ${hostAdapter(host)
        .resumeArguments({ ...record, session_id: record.session_id ?? '' })
        .join(' ')}`
    : `celetis --agent ${host} assist ${n}`;
  const ownership: AttemptEnd = owned
    ? await endOwnedAttempt({ ...owned, main: io.place.main }, io.ownedOf(barrier), io.takeEvidence())
    : { kind: 'unverified', reason: 'the session has no attempt marker', running: [], signalled: [] };
  return { kind: 'halted', ownership, host, tab, resume, attempt: owned?.id ?? null };
}

async function starting(_at: StateOf<'starting'>, io: Io): Promise<EventOf<Own['starting']>> {
  const { input, checkout, selection, locks, hooks, stopped, note, fresh, saveQueue } = io;
  const { main, common } = io.place;
  if (input.kind === 'queue') {
    const claim = input;
    io.operation = await createOperation(checkout, selection, 'main');
    stopped();
    const holder = await locks.take('queue');
    if (holder !== null) throw new HostError('queue: another run owns this work', exits.prerequisite);
    io.queue = await updateQueue(
      main,
      async (current) => {
        stopped();
        if (!current || current.id !== claim.id || current.launch?.token !== claim.token)
          throw new HostError('queue: stale launch token; no session started', exits.prerequisite);
        if (!current.choice) throw new HostError('queue: no recorded agent choice', exits.prerequisite);
        requireQueueChoice(current.choice, io.operation.choice);
        if (await lockHolder(main, issueLock(current.numbers[0] as IssueKey)))
          throw new HostError('queue: a run or its foreground still owns this work', exits.prerequisite);
        return current;
      },
      common,
      locks,
    );
    io.queueWritable = true;
    const authorization = io.queue.launch?.authorization;
    const request: Request | undefined =
      authorization && authorization.number === io.queue.numbers[0]
        ? { step: authorization.step, retry: authorization.retry }
        : undefined;
    await note({ issue: io.queue.numbers[0] ?? null, request: request ?? null });
    io.shown = { ...io.shown, numbers: io.queue.numbers };
    const pinned = explicitHost(io.queue.choice);
    io.selection = pinned === null ? {} : { saved: pinned };
    io.operation = await fresh();
    await hooks.ready?.();
    await saveQueue({ state: 'running', launch: null });
    if (!io.queue.numbers.length) io.queueWritable = false;
    const first = io.queue.numbers[0];
    return {
      kind: 'started',
      issue: first === undefined ? null : first,
      request: request ?? null,
      basis: basisOf(io.queue),
    };
  }
  io.operation = await createOperation(checkout, selection, 'main');
  io.initial = io.operation;
  await hooks.ready?.();
  return { kind: 'started', issue: input.number, request: null, basis: basisOf(io.queue) };
}

async function admitting(at: StateOf<'admitting'>, io: Io): Promise<EventOf<Own['admitting']>> {
  const issue = at.scope === 'issue' ? at.issue.number : at.number;
  if (at.scope === 'issue') io.shown = { ...io.shown, issue, step: null, host: null, tab: null };
  const holder = await io.locks.take(issueLock(issue));
  if (holder !== null) return { kind: 'lock-held', holder, flags: flagsOf(io) };
  if (io.input.kind !== 'auto') return { kind: 'admitted' };
  // The read comes after the lock take, so a Set aside that writes under the issue lock cannot race this start.
  const aside = await readSetAside(io.place.common).catch((error: unknown) =>
    error instanceof Error && error.cause instanceof Error ? error.cause : new Error(String(error)),
  );
  if (aside instanceof Error)
    return {
      kind: 'aside',
      reason: `stop cannot read the set-aside record: ${aside.message}; auto mode asks again each 60 seconds`,
    };
  return aside.has(issue)
    ? { kind: 'aside', reason: `#${issue} is set aside; auto mode skips it` }
    : { kind: 'admitted' };
}

async function binding(at: StateOf<'binding'>, io: Io): Promise<EventOf<Own['binding']>> {
  const { stopped, rest, daemon } = io;
  const { main } = io.place;
  const issue = at.issue.number;
  io.recovery = null;
  io.shown = { ...io.shown, issue, ...(at.keepRow ? {} : { step: null, host: null, tab: null }) };
  const adoptRecovery = async () => {
    for (;;) {
      stopped();
      let unknown = false;
      const kept = await updateRecovery(main, issue, async (current) => {
        if (!current || current.lock !== issueLock(issue)) return current;
        const state = await processState(current.daemon.pid, current.daemon.start);
        unknown = state === 'unknown';
        return state === 'gone' ? { ...current, daemon } : current;
      });
      if (!unknown) return kept;
      await rest(2000);
    }
  };
  if (!at.adopt) {
    stopped();
    await updateRecovery(main, issue, () => null);
  } else io.recovery = await adoptRecovery();
  return { kind: 'bound' };
}

async function resolving(at: StateOf<'resolving'>, io: Io): Promise<EventOf<Own['resolving']>> {
  const { stopped, removal, nextOperation, say, nextOf, halt, recovery } = io;
  const { main, root } = io.place;
  const issue = at.issue.number;
  const n = issue;
  const { retrying, lastHost } = at.issue.loop;
  stopped();
  if (await versionFolderGone(root)) {
    await removal();
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
  const { next, decided, authority, line } = await nextOf(n, current, halt.signal, permit);
  stopped();
  return {
    kind: 'resolved',
    operation: current,
    config,
    next,
    decided,
    authority,
    line,
    recovery: bound,
    recoveryCommand: hostAdapter(lastHost).recovery,
  };
}

async function selecting(_at: StateOf<'selecting'>, io: Io): Promise<EventOf<Own['selecting']>> {
  const { common } = io.place;
  return {
    kind: 'selected',
    order: (await readAgentOrder(common)).order,
    usage: await readUsage(common),
    now: Date.now(),
  };
}

async function quotaWait(at: StateOf<'quota-wait'>, io: Io): Promise<EventOf<Own['quota-wait']>> {
  const { recovery } = io;
  const n = at.issue.number;
  const { waitQuota } = io.issueOf(n, at.issue.loop.attempted);
  if (at.wait.kind === 'kept') {
    const waiting = at.wait.wait;
    const bound = recovery as QuotaRecovery | null;
    if (bound?.waitId !== waiting.waitId)
      throw new HostError(`daemon: #${n}: the quota wait record changed; start the run again`, exits.prerequisite);
    const woke = await waitQuota(waiting.authority, waiting.choice, bound.blocked, bound.nextResetAt, waiting);
    return { kind: 'woke', woke };
  }
  const { authority, choice, blocked, nextResetAt } = at.wait;
  return { kind: 'woke', woke: await waitQuota(authority, choice, blocked, nextResetAt) };
}

async function prepareResume(
  at: Extract<StateOf<'preparing'>, { scope: 'unwatched' }>,
  io: Io,
): Promise<EventOf<'prepared'>> {
  const { selection, checkout, locks, stopped, requireStart, hooks, admit } = io;
  const { main, common } = io.place;
  const n = at.number;
  const saved = await selectSavedSession(main, n, selection.explicit, common, locks);
  io.operation = await createOperation(checkout, { ...selection, saved: saved.host }, 'main');
  const host = io.operation.host;
  const { landing } = io.operation.mainConfig as Config;
  await preflight(async () => {
    stopped();
    await requireStart(host, io.operation.checkout.cwd, { kind: 'step', step: saved.step });
  });
  stopped();
  if (at.ready) await hooks.ready?.();
  admit({ ok: true });
  const args = hostAdapter(saved.host).resumeArguments(saved);
  let contract: Promise<string> | undefined;
  const plugin = () => (contract ??= requireContract(host, main));
  const session = {
    plugin,
    stepText: async () => stepText({ issue: n, step: saved.step, host, main, pluginRoot: await plugin(), landing }),
  };
  const attempt = randomUUID();
  return {
    kind: 'prepared',
    start: {
      scope: 'unwatched',
      work: saved.step,
      host,
      args,
      record: saved,
      sessionId: saved.session_id,
      attempt,
      entry: {
        id: attempt,
        issue: n,
        work: saved.step,
        start: 'resume',
        host,
        model: null,
        effort: saved.effort,
        startedAt: Date.now(),
      },
      session,
    },
  };
}

async function prepareAssist(
  at: Extract<StateOf<'preparing'>, { scope: 'unwatched' }>,
  io: Io,
): Promise<EventOf<'prepared'>> {
  const { selection, checkout, stopped, requireStart, hooks, admit } = io;
  const { main } = io.place;
  const n = at.number;
  io.operation = await createOperation(checkout, selection, 'main');
  if (at.ready) await hooks.ready?.();
  const { readDecision } = await import('../resolver/resolver.ts');
  const { lineOf } = await import('../resolver/lines.ts');
  const { next, stderr } = await readDecision(n, io.operation);
  process.stderr.write(stderr);
  if (next.kind === 'observed') die(lineOf(n, next), exits.blocked);
  if (next.kind === 'stop' && (next.reason === 'finished' || next.reason === 'wontfix'))
    die(`#${n} is closed; no assist session starts`, exits.prerequisite);
  if (next.kind !== 'stop' || (next.reason !== 'needs-info' && next.reason !== 'ready-for-human'))
    die(`#${n} has no hold (needs-info or ready-for-human); no assist session starts`, exits.prerequisite);
  const host = await interactiveHost(io.operation, 'assist', 'celetis');
  await preflight(async () => {
    stopped();
    await requireStart(host, io.operation.checkout.cwd, { kind: 'interactive', command: 'assist' });
  });
  stopped();
  const plugin = await requireContract(host, main);
  const skill = join(plugin, 'skills/assist/SKILL.md');
  if (!(await stat(skill).catch(() => null))?.isFile())
    die(`cannot read the assistance skill: ${skill}`, exits.prerequisite);
  admit({ ok: true });
  const adapter = hostAdapter(host);
  const attempt = randomUUID();
  const sessionId = adapter.startId();
  const args = [
    ...(sessionId === null ? [] : adapter.sessionArguments(sessionId)),
    ...adapter.interactiveArguments(tabLabel(n, 'assist'), assistPrompt(host, n, plugin, true), attempt),
  ];
  return {
    kind: 'prepared',
    start: {
      scope: 'unwatched',
      work: 'assist',
      host,
      args,
      record: null,
      sessionId,
      attempt,
      entry: {
        id: attempt,
        issue: n,
        work: 'assist',
        start: 'new',
        host,
        model: null,
        effort: null,
        startedAt: Date.now(),
      },
      session: { plugin: async () => plugin, stepText: null },
    },
  };
}

async function preparing(at: StateOf<'preparing'>, io: Io): Promise<EventOf<Own['preparing']>> {
  if (at.scope === 'unwatched') return io.input.kind === 'assist' ? prepareAssist(at, io) : prepareResume(at, io);
  const { stopped, requireStart, removal, say } = io;
  const { main, root, state } = io.place;
  const { operation: current, config, next, authority, decided, prompt } = at.resolution;
  const { step } = next;
  const issue = at.issue.number;
  const { override } = at.issue;
  const { retrying } = at.issue.loop;
  const stepHost = at.host;
  const adapter = hostAdapter(stepHost);
  const sessionId = adapter.startId();
  const prepared = await preflight(async () => {
    stopped();
    await requireStart(stepHost, current.checkout.cwd, { kind: 'step', step });
    const pluginRoot = await requireContract(stepHost, main);
    if (await versionFolderGone(root)) return null;
    const pair = startPair(decided, config.sessions?.[step], override);
    const text = () =>
      stepText({ issue, step, host: stepHost, main, pluginRoot, landing: config.landing, recovery: retrying });
    const { args, applied, model } = await adapter.stepArguments({
      issue,
      step,
      cwd: main,
      start: pair,
      sessionId,
      stepText: text,
    });
    return { args, applied, model, pair, session: { plugin: async () => pluginRoot, stepText: text } };
  });
  stopped();
  if (prepared === null) return removal();
  const { args, applied, model, pair, session } = prepared;
  say(startLine(prompt, pair, applied, model));
  const attempt: UsageAttempt = {
    id: randomUUID(),
    host: stepHost,
    main,
    startedAt: Date.now(),
    sessionId,
  };
  const capture = state.usageCapture(attempt.id).path;
  const sessionArgs = [...(await adapter.prepareUsage(attempt, state)), ...args];
  const owned = {
    id: attempt.id,
    host: stepHost,
    startedAt: attempt.startedAt,
    sessionId: attempt.sessionId,
  };
  const record: SessionRecord = {
    schema: 3,
    host: stepHost,
    issue,
    step,
    checkout: main,
    session_id: null,
    effort: applied,
  };
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
  const entry = {
    id: attempt.id,
    issue,
    work: step,
    start: 'new',
    host: stepHost,
    model: attemptModel(stepHost, pair.model, model),
    effort: applied,
    startedAt: attempt.startedAt,
  } as const;
  return { kind: 'prepared', start: { scope: 'issue', args: sessionArgs, facts, attempt, entry, session } };
}

async function openUnwatched(
  at: Extract<StateOf<'opening'>, { scope: 'unwatched' }>,
  io: Io,
): Promise<EventOf<'barrier-reported'>> {
  const { startSession } = io;
  const n = at.number;
  const { work, host, args, record, sessionId, attempt, entry, session } = at.start;
  const { ended, barrier } = await startSession(
    n,
    work,
    host,
    args,
    {
      step: work,
      host,
      next: null,
      authority: null,
      choice: null,
      record,
      announced: '',
      ticket: null,
      capture: null,
      owned: { id: attempt, host, startedAt: entry.startedAt, sessionId },
    },
    session,
    attempt,
  );
  await recordAttemptStart(io.place.common, entry);
  return { kind: 'barrier-reported', terminal: io.terminal, tab: io.tab, barrier, exit: ended, ticket: null };
}

async function opening(at: StateOf<'opening'>, io: Io): Promise<EventOf<Own['opening']>> {
  if (at.scope === 'unwatched') return openUnwatched(at, io);
  const { admit, startSession, locks } = io;
  const { main, common } = io.place;
  const { args: sessionArgs, facts, attempt, session } = at.start;
  const { step, host: stepHost, authority, owned, record, capture } = facts;
  const n = at.issue.number;
  const { retrying } = at.issue.loop;
  const { saveRecovery } = io.issueOf(n);
  let ticket: UsageTicket | undefined;
  let begun: Awaited<ReturnType<typeof startSession>>;
  admit({ ok: true });
  try {
    begun = await startSession(n, step, stepHost, sessionArgs, facts, session, attempt.id, retrying, async () => {
      ticket = await beginUsageAttempt(common, attempt);
      if (retrying)
        await saveRecovery(authority, facts.choice, (each) => ({
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
  await recordAttemptStart(common, at.start.entry);
  return {
    kind: 'barrier-reported',
    terminal: io.terminal,
    tab: io.tab,
    barrier: begun.barrier,
    exit: begun.ended,
    ticket,
  };
}

async function begunLive(at: Extract<StateOf<'live'>, { scope: 'issue'; fresh: true }>, io: Io): Promise<Live> {
  const { ledger, daemon, publish } = io;
  const issue = at.issue.number;
  const { barrier, exit: ended, session: steering } = at;
  const stepHost = steering.host;
  ledger.stepEnd.issue = issue;
  ledger.stepEnd.owner = daemon;
  await publish(stepHost, 'checking', null);
  return { ...steering, ended, barrier, startedMs: Date.now() };
}

async function adoptedLive(at: Extract<StateOf<'live'>, { scope: 'issue'; fresh: false }>, io: Io): Promise<Live> {
  const { ledger, daemon, publish, sessionExit } = io;
  const issue = at.issue.number;
  const { session } = at;
  const s = steered(session);
  ledger.stepEnd.issue = issue;
  ledger.stepEnd.owner = daemon;
  await publish(s.host, 'checking', null);
  ledger.watchDir = session.folder;
  return { ...s, ended: sessionExit(session.folder, s.barrier) };
}

async function unwatchedEnd(
  io: Io,
  n: IssueKey,
  ended: Promise<number | null>,
  barrier: Identity,
): Promise<EventOf<Own['live']>> {
  io.openStop();
  try {
    const code = await io.sessionEnd(ended);
    return io.claimStop()
      ? await haltingUnwatched(io, barrier, n)
      : unwatchedEnded(code, io.recorded?.session?.owned?.id ?? null);
  } finally {
    io.claimStop();
  }
}

async function liveUnwatched(
  at: Extract<StateOf<'live'>, { scope: 'unwatched'; fresh: true }>,
  io: Io,
): Promise<EventOf<Own['live']>> {
  const { noteBarrier, releaseBarrier } = io;
  const { barrier, exit: ended } = at;
  await noteBarrier(barrier, Date.now());
  await releaseBarrier();
  return unwatchedEnd(io, at.number, ended, barrier);
}

async function adoptedUnwatched(
  at: Extract<StateOf<'live'>, { scope: 'unwatched'; fresh: false }>,
  io: Io,
): Promise<EventOf<Own['live']>> {
  const { sessionExit, mark, ledger } = io;
  const { session } = at;
  const exit = sessionExit(session.folder, session.barrier);
  mark('running');
  ledger.watchDir = session.folder;
  return unwatchedEnd(io, at.number, exit, session.barrier);
}

async function live(at: StateOf<'live'>, io: Io): Promise<EventOf<Own['live']>> {
  if (at.scope === 'unwatched') return at.fresh ? liveUnwatched(at, io) : adoptedUnwatched(at, io);
  const { clearStepEnd, endWhenDone, watchUsage, detach, noteBarrier, releaseBarrier, sessionEnd, say } = io;
  const { watch, stepEnd } = io.ledger;
  const hooks = io.issueHooks;
  const issue = at.issue.number;
  const n = issue;
  const { endAttempt } = io.issueOf(n);
  const s = at.fresh ? await begunLive(at, io) : await adoptedLive(at, io);
  let watchError: unknown;
  watch.watcher = new AbortController();
  watch.watching = endWhenDone(n, s.next, s.record, s.announced, s.startedMs, s.ended, s.barrier, watch.watcher.signal)
    .then(async (exiting) => {
      if (!exiting) await clearStepEnd();
    })
    .catch(async (error: unknown) => {
      await clearStepEnd();
      watchError = error;
    });
  const usageWatch = new AbortController();
  const refusal = watchUsage(n, s.ticket, s.capture, AbortSignal.any([usageWatch.signal, detach.signal]));
  if (at.fresh) {
    await hooks?.beforeStart?.(s.next, s.host);
  }
  if (at.fresh) {
    await noteBarrier(s.barrier, s.startedMs, { request: null });
    await releaseBarrier();
  }
  io.openStop();
  try {
    const ending = sessionEnd(s.ended);
    ending.catch(() => {});
    let refused = await Promise.race([ending.then(() => null), refusal]);
    if (refused?.observation.kind === 'blocked' && s.choice.kind === 'explicit') {
      say(
        `#${n}: the explicit agent ${s.host} reports: ${refused.observation.reason} The session stays open; no other agent starts.`,
      );
      refused = null;
    } else if (refused?.observation.kind === 'blocked' && io.stopping) {
      const first = await Promise.race([
        ending.then(() => 'ended' as const),
        io.flagCleared().then(() => 'kept' as const),
      ]);
      if (first === 'ended') refused = null;
    }
    if (refused?.observation.kind !== 'blocked') {
      const exitCode = await ending;
      const stop = io.claimStop();
      usageWatch.abort();
      await refusal;
      watch.watcher?.abort();
      await watch.watching;
      watch.watching = undefined;
      watch.watcher = undefined;
      await clearStepEnd();
      stepEnd.issue = undefined;
      if (watchError !== undefined) throw watchError;
      return stop ? await halting(io, s, s.barrier, at.tab) : sessionEnded(io, issue, s, exitCode);
    }
    io.claimStop();
    const reason = refused.observation.reason;
    usageWatch.abort();
    watch.watcher?.abort();
    const ownership = await endAttempt(s, s.barrier);
    await watch.watching;
    watch.watching = undefined;
    watch.watcher = undefined;
    await clearStepEnd();
    stepEnd.issue = undefined;
    if (watchError !== undefined) throw watchError;
    return blocked(io, s, reason, ownership, null);
  } finally {
    io.claimStop();
  }
}

async function ended(at: StateOf<'ended'>, io: Io): Promise<EventOf<Own['ended']>> {
  const stop = io.claimStop();
  if (at.scope === 'unwatched') {
    const code = await io.sessionExit(at.session.folder, at.session.barrier);
    return stop
      ? haltingUnwatched(io, at.session.barrier, at.number)
      : unwatchedEnded(code, at.session.owned?.id ?? null);
  }
  const { sessionExit, observeUsage, usageWarning, locks } = io;
  const { main, common } = io.place;
  const { watchDir } = io.ledger;
  const { session, terminal, tab } = at;
  const issue = at.issue.number;
  const n = issue;
  const { endAttempt } = io.issueOf(n);
  const s = steered(session);
  const exitCode = await sessionExit(session.folder, s.barrier);
  const startedAt = Math.floor(s.startedMs / 1000);
  if ((await readSession(main, issue, common, locks)).session_id === null) {
    const adapter = hostAdapter(s.host);
    const claim = await adapter.claim(main, adapter.stepPrompt(s.record.step, issue), s.announced, startedAt);
    if ((await observeSession(s.record, claim, startedAt, locks)) === 2) {
      await writeFile(startFiles(watchDir).error, '');
      await startupError(issue, s.host, 'no single session identity can be saved', terminal, tab);
    }
  }
  if (stop) return halting(io, s, s.barrier, tab);
  const observed = await observeUsage(n, s.ticket, s.capture, usageWarning(n));
  if (observed?.observation.kind === 'blocked' && s.choice.kind === 'default')
    return blocked(io, s, observed.observation.reason, await endAttempt(s, s.barrier), { code: exitCode });
  return sessionEnded(io, issue, s, exitCode);
}

async function closing(at: StateOf<'closing'>, io: Io): Promise<EventOf<Own['closing']>> {
  const { clearStepEnd, closeUnreleased, locks, handOff } = io;
  const { watch, stepEnd } = io.ledger;
  const n = at.number;
  watch.watcher?.abort();
  await watch.watching;
  await clearStepEnd();
  stepEnd.issue = undefined;
  await closeUnreleased();
  if (!io.keepsLock) await locks.release(issueLock(n), handOff());
  return { kind: 'closed', flags: flagsOf(io) };
}

async function advancing(at: StateOf<'advancing'>, io: Io): Promise<EventOf<Own['advancing']>> {
  const { locks, nextOf, fresh, halt, stopped, handOff } = io;
  const { main, common } = io.place;
  if (io.queue === null) throw new HostError('daemon: queue: no submitted queue', exits.internal);
  const n = at.number;
  for (;;) {
    const snapshot = await readQueue(main, common, locks);
    if (!snapshot || snapshot.id !== io.queue.id || snapshot.numbers[0] !== at.number)
      throw new HostError('queue: current issue changed during drain', exits.prerequisite);
    const { next } = await nextOf(n, await fresh(), halt.signal);
    stopped();
    if (next.kind !== 'stop' || (next.reason !== 'finished' && next.reason !== 'wontfix'))
      die('queue: cannot advance without a fresh closed resolver result', exits.prerequisite);
    let drained = false;
    try {
      io.queue = await updateQueue(
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
      io.storageFailed = true;
      throw error;
    }
    io.shown = { ...io.shown, numbers: io.queue.numbers };
    if (drained) break;
  }
  if (!io.queue.numbers.length) io.queueWritable = false;
  const issue = io.queue.numbers[0];
  return {
    kind: 'advanced',
    next: issue === undefined ? null : { issue, basis: basisOf(io.queue) },
  };
}

async function reporting(at: StateOf<'reporting'>, io: Io): Promise<EventOf<Own['reporting']>> {
  const { closeTabs, saveQueue } = io;
  const { error } = at;
  const reason = error instanceof Error ? error.message : String(error);
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
    return { kind: 'unsaved', line: (failure as Error).message };
  }
  const first = io.queue?.numbers[0];
  return { kind: 'reported', issue: first === undefined ? null : first };
}

async function adopting(at: StateOf<'adopting'>, io: Io): Promise<EventOf<Own['adopting']>> {
  const { mark, locks, admit, rest, stopped } = io;
  const { record } = at;
  mark('taken-over');
  const { session } = record;
  const claimed = session?.barrier
    ? { pid: session.barrier.pid, start: session.barrier.start }
    : session
      ? pidOf(await readFile(startFiles(session.folder).pid, 'utf8').catch(() => ''))
      : null;
  const ownLock = record.lock ?? (record.queue && record.issue !== null ? issueLock(record.issue) : null);
  const names = (record.queue ? ['queue', ownLock] : [ownLock]).filter((name) => name !== null);
  for (;;) {
    let claim: LockClaim = { kind: 'taken' };
    for (const name of names) {
      claim = await locks.adopt(name, claimed);
      if (claim.kind !== 'taken') break;
    }
    if (claim.kind === 'taken') break;
    if (claim.kind === 'held') return { kind: 'lock-held', holder: claim.holder, flags: flagsOf(io) };
    admit({ ok: true });
    await rest(2000);
    stopped();
  }
  return { kind: 'adopted', claimed, lock: ownLock };
}

async function observing(at: StateOf<'observing'>, io: Io): Promise<EventOf<Own['observing']>> {
  const { note, locks, saveQueue, tabs, sessionPhase, ledger, checkout } = io;
  const { main, common } = io.place;
  const { record, claimed, lock: ownLock } = at;
  const { session } = record;
  const n = record.issue;
  await note({ lock: ownLock });
  if (record.queue) {
    const found = await readQueue(main, common, locks);
    if (!found || found.id !== record.queue.id || found.numbers[0] !== record.issue) {
      return { kind: 'observed', seen: { kind: 'queue-changed' }, basis: basisOf(io.queue) };
    }
    io.queue = found;
    io.queueWritable = true;
    io.shown = { ...io.shown, numbers: io.queue.numbers };
    const pinned = explicitHost(io.queue.choice);
    io.selection = pinned === null ? {} : { saved: pinned };
    if (record.input.kind === 'queue' && io.queue.launch?.token === record.input.token)
      await saveQueue({ state: 'running', launch: null });
  }
  tabs.finished = record.loop.finished ?? '';
  let seen: Seen = { kind: 'no-session' };
  if (session) {
    io.terminal = session.terminal ?? '';
    io.tab = session.tab;
    const read = await sessionPhase(session);
    io.shown = {
      ...io.shown,
      issue: n,
      step: session.step,
      host: session.host,
      tab: io.tab,
      barrier: claimed,
      terminal: read === 'live' && io.terminal ? io.terminal : null,
    };
    if (read !== 'live') ledger.watchDir = session.folder;
    if (read === 'missing') {
      // A recorded barrier read pid, and ending removes pid first, so pid with no go proves no release.
      const neverReleased =
        session.barrier === null ||
        (await stat(startFiles(session.folder).pid).then(
          (found) => found.isFile(),
          () => false,
        ));
      return { kind: 'observed', seen: { kind: 'not-started', session, neverReleased }, basis: basisOf(io.queue) };
    }
    seen = { kind: read, session };
  }
  if (!unwatched(record.input.kind)) {
    io.operation = await createOperation(checkout, io.selection, 'main');
    io.initial = io.operation;
    io.daemon = await daemonOf();
  }
  return { kind: 'observed', seen, basis: basisOf(io.queue) };
}

async function ending(_at: StateOf<'ending'>, io: Io): Promise<EventOf<Own['ending']>> {
  const { mark, ledger, shared, detach, closeUnreleased, closeTabs, clearStepEnd, locks, handOff } = io;
  io.claimStop();
  io.takeEvidence()?.job?.close();
  mark('ending');
  ledger.watch.watcher?.abort();
  await ledger.watch.watching;
  if (shared && !detach.signal.aborted) await closeUnreleased();
  else await closeTabs();
  // A released session that still runs reads its step text from the start folder at each turn.
  if (ledger.watchDir && !(await releasedLive(ledger.watchDir))) {
    await rm(startFiles(ledger.watchDir).pid, { force: true });
    await rm(ledger.watchDir, { recursive: true, force: true });
  }
  await clearStepEnd();
  if (io.keepsLock) await locks.release('queue', handOff());
  else await locks.releaseAll(handOff());
  mark('finished');
  return { kind: 'cleaned' };
}

export const activities: Activities = {
  starting,
  admitting,
  binding,
  resolving,
  selecting,
  'quota-wait': quotaWait,
  preparing,
  opening,
  live,
  closing,
  advancing,
  reporting,
  adopting,
  observing,
  ended,
  ending,
};

const noteLoop = (io: Io, loop: Loop, change: Partial<RunRecord>) =>
  io.note({
    loop: {
      first: loop.first,
      last: loop.last,
      lastHost: loop.lastHost,
      exitCode: loop.exitCode,
      started: loop.started,
      attempted: [...loop.attempted],
      retrying: loop.retrying,
      retryBlocked: loop.retryBlocked,
      finished: io.tabs.finished || null,
    },
    ...change,
  });

async function archive(io: Io, effect: Extract<Effect, { kind: 'archive' }>): Promise<void> {
  const { locks, tabs, ledger } = io;
  const { main } = io.place;
  const { issue, attemptId, terminal, loop, authority, choice } = effect;
  const { attempted } = loop;
  const { saveRecovery } = io.issueOf(issue);
  const archived = await archiveSession(main, issue, attemptId, locks);
  tabs.finished = terminal;
  await noteLoop(io, loop, { session: null });
  await rm(ledger.watchDir, { recursive: true, force: true });
  ledger.watchDir = '';
  const lane = await snapshotLane(main, issue);
  await saveRecovery(authority, choice, (record) => ({
    ...record,
    lane,
    prior: [...record.prior, archived],
    attempted: [...attempted],
  }));
}

export async function perform(effect: Effect, io: Io): Promise<void> {
  switch (effect.kind) {
    case 'say':
      if (io.say(effect.line) && effect.record)
        recordEvent({ name: effect.record.name, message: `daemon: ${effect.line}`, issue: effect.record.issue });
      return;
    case 'event':
      recordEvent({ name: effect.name, message: effect.message, issue: effect.issue, error: effect.error });
      return;
    case 'admit':
      io.admit(effect.admission);
      return;
    case 'note':
      await io.note(effect.change);
      return;
    case 'note-loop':
      await noteLoop(io, effect.loop, effect.change);
      return;
    case 'mark':
      io.mark(effect.label);
      return;
    case 'no-progress':
      await addRecord(io.place.common, effect.issue, effect.line);
      return;
    case 'set-aside':
      await setAside(io.place.common, effect.issue);
      return;
    case 'clear-aside':
      await clearAside(io.place.common, effect.issue);
      return;
    case 'keep-lock':
      io.keepsLock = true;
      return;
    case 'end-recovery':
      await io.issueOf(effect.issue).endRecovery();
      return;
    case 'archive':
      await archive(io, effect);
      return;
    case 'attempt-end':
      await recordAttemptEnd(io.place.common, effect.issue, effect.attempt, effect.finish);
      return;
    case 'save-queue':
      await io.saveQueue(effect.change);
      return;
    case 'startup-error':
      await startupError(
        effect.issue,
        effect.host,
        'the session ended before a saved turn had a verified identity',
        effect.terminal,
        effect.tab,
      );
      return;
    case 'finish-tab':
      io.tabs.finished = effect.terminal;
      return;
    case 'remove-start':
      await rm(io.ledger.watchDir, { recursive: true, force: true });
      io.ledger.watchDir = '';
      return;
    case 'close-tab':
      await closeTerminal(effect.terminal);
      return;
    case 'error-line':
      io.told = effect.line;
      console.error(effect.line);
      return;
    case 'defect':
      markDefect(effect.error);
      return;
    case 'daemon':
      io.daemon = await daemonOf();
      return;
    default: {
      const unknown: never = effect;
      throw new Error(`run machine: no act for the effect ${JSON.stringify(unknown)}`);
    }
  }
}

export function failedOf(io: Io, error: unknown): EventOf<'failed'> {
  return { kind: 'failed', failure: { ...flagsOf(io), error } };
}

export function detachRun(io: Io): void {
  const { detach, halt } = io;
  detach.abort();
  io.ledger.watch.watcher?.abort();
  halt.abort();
}
