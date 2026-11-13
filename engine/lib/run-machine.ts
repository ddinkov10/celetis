import { effectiveOrder } from './agent-order.ts';
import { selectAgent, type UsageState, type UsageTicket } from './agent-usage.ts';
import type { AgentChoice, Config, Host } from './config-core.ts';
import { type ExitCode, exits } from './contract.ts';
import { type EffortDecision, noOverride, type Override } from './effort.ts';
import { HostError } from './errors.ts';
import type { SessionStart } from './host-types.ts';
import { capableOrder } from './hosts.ts';
import { describe, type Next } from './lines.ts';
import type { Identity } from './locks.ts';
import type { Operation } from './operation.ts';
import type { QueueRecord } from './queue-types.ts';
import type { AttemptEnd, QuotaBlock, QuotaRecovery, RecoveryAttempt, RecoveryAuthority } from './quota-recovery.ts';
import type { Admission, RunEnd, RunInput, RunState } from './run-engine.ts';
import type { RunRecord } from './run-record.ts';
import type { SessionRecord } from './session.ts';
import type { UsageAttempt } from './usage-types.ts';
import {
  autoTakes,
  defaultGate,
  invocation,
  type Run,
  type Step as StepName,
  sameResult,
  skipped,
} from './workflow.ts';

export type RunFacts = Readonly<{ input: RunInput; shared: boolean }>;

export type Request = NonNullable<RunRecord['request']>;
export type Loop = Readonly<{
  first: 'any' | 'gated';
  last: Run | null;
  lastHost: Host;
  exitCode: number | null;
  started: boolean;
  attempted: readonly Host[];
  retrying: boolean;
  retryBlocked: boolean;
}>;
export type IssueFacts = Readonly<{
  number: number;
  loop: Loop;
  request: Request | null;
  override: Override;
  resolved: Next | null;
}>;
export type Basis = Readonly<{ lastHost: Host; last: Run | null }>;

export type Facts = NonNullable<RunRecord['session']>;
export type Released = Facts & Readonly<{ barrier: NonNullable<Facts['barrier']> }>;
export type Steered = Readonly<{
  step: StepName;
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
export type StepFacts = Omit<Steered, 'ticket'> & Readonly<{ ticket: null }>;
export type KeptWait = NonNullable<RunRecord['wait']>;
export type Recorded = Readonly<{ facts: Facts; live: boolean }>;
export type Resolution = Readonly<{
  operation: Operation;
  config: Config;
  next: Run;
  authority: RecoveryAuthority;
  decided: EffortDecision | null;
  prompt: string;
}>;
export type QuotaWait = Readonly<
  | {
      kind: 'new';
      authority: RecoveryAuthority;
      choice: AgentChoice;
      blocked: readonly QuotaBlock[];
      nextResetAt: number | null;
    }
  | { kind: 'kept'; wait: KeptWait }
>;
type SessionInput = Omit<SessionStart, 'folder'>;
export type StepStart = Readonly<{
  scope: 'issue';
  args: string[];
  facts: StepFacts;
  attempt: UsageAttempt;
  session: SessionInput;
}>;
export type ResumeStart = Readonly<{
  scope: 'resume';
  saved: SessionRecord;
  host: Host;
  args: string[];
  session: SessionInput;
}>;
export type Start = StepStart | ResumeStart;
export type Outcome = Readonly<{
  kind: 'closed' | 'gate' | 'stopped';
  started: boolean;
  next: Next | null;
  last: Run | null;
  exitCode: number | null;
  reason: string;
  act: string | null;
}>;
export type Cause = Readonly<{ kind: 'outcome'; outcome: Outcome } | { kind: 'failure'; error: unknown }>;
export type Result = Readonly<{ ok: true; end: RunEnd; started: boolean } | { ok: false; error: unknown }>;

type IssueSession = Readonly<{
  scope: 'issue';
  issue: IssueFacts;
  terminal: string;
  tab: string;
  wait: KeptWait | null;
}>;
type ResumeSession = Readonly<{ scope: 'resume'; number: number; terminal: string }>;
type Opened = Readonly<{ barrier: Identity; exit: Promise<number | null> }>;

export type State =
  | Readonly<{ kind: 'starting' }>
  | Readonly<{ kind: 'admitting'; scope: 'issue'; issue: IssueFacts }>
  | Readonly<{ kind: 'admitting'; scope: 'resume'; number: number }>
  | Readonly<{
      kind: 'binding';
      issue: IssueFacts;
      adopt: boolean;
      keepRow: boolean;
      session: Recorded | null;
      wait: KeptWait | null;
    }>
  | Readonly<{ kind: 'resolving'; issue: IssueFacts }>
  | Readonly<{ kind: 'selecting'; issue: IssueFacts; resolution: Resolution }>
  | Readonly<{ kind: 'quota-wait'; issue: IssueFacts; wait: QuotaWait }>
  | Readonly<{ kind: 'preparing'; scope: 'issue'; issue: IssueFacts; resolution: Resolution; host: Host }>
  | Readonly<{ kind: 'preparing'; scope: 'resume'; number: number; ready: boolean }>
  | Readonly<{ kind: 'opening'; scope: 'issue'; issue: IssueFacts; start: StepStart }>
  | Readonly<{ kind: 'opening'; scope: 'resume'; number: number; start: ResumeStart }>
  | (Readonly<{ kind: 'live' }> &
      IssueSession &
      ((Opened & Readonly<{ fresh: true; session: Steered }>) | Readonly<{ fresh: false; session: Facts }>))
  | (Readonly<{ kind: 'live' }> &
      ResumeSession &
      ((Opened & Readonly<{ fresh: true }>) | Readonly<{ fresh: false; session: Released }>))
  | Readonly<{ kind: 'closing'; number: number; cause: Cause }>
  | Readonly<{ kind: 'advancing'; number: number }>
  | Readonly<{ kind: 'reporting'; error: unknown }>
  | Readonly<{ kind: 'adopting'; record: RunRecord }>
  | Readonly<{ kind: 'observing'; record: RunRecord; claimed: Identity | null; lock: string | null }>
  | (Readonly<{ kind: 'ended'; session: Facts }> & IssueSession)
  | (Readonly<{ kind: 'ended'; session: Released }> & ResumeSession)
  | Readonly<{ kind: 'ending'; result: Result }>
  | Readonly<{ kind: 'finished'; result: Result }>;

export type Flags = Readonly<{ detached: boolean; queueWritable: boolean; storageFailed: boolean }>;
export type Failure = Flags & Readonly<{ error: unknown }>;
export type Seen = Readonly<
  | { kind: 'queue-changed' }
  | { kind: 'no-session' }
  | { kind: 'not-started'; session: Facts }
  | { kind: 'live'; session: Facts }
  | { kind: 'ended'; session: Facts }
>;
export type SessionEnd = Readonly<
  { scope: 'issue'; session: Steered; saved: boolean; reported: boolean } | { scope: 'resume'; passed: ExitCode }
>;

export type Event =
  | Readonly<{ kind: 'started'; issue: number | null; request: Request | null; basis: Basis }>
  | Readonly<{ kind: 'admitted' }>
  | Readonly<{ kind: 'lock-held'; holder: string; flags: Flags }>
  | Readonly<{ kind: 'bound' }>
  | Readonly<{
      kind: 'resolved';
      operation: Operation;
      config: Config;
      next: Next;
      decided: EffortDecision | null;
      authority: RecoveryAuthority | null;
      line: string;
      recovery: QuotaRecovery | null;
      recoveryCommand: string;
    }>
  | Readonly<{ kind: 'selected'; order: readonly Host[]; usage: UsageState; now: number }>
  | Readonly<{ kind: 'woke'; woke: 'retry' | 'timer' | 'available' }>
  | Readonly<{ kind: 'prepared'; start: Start }>
  | Readonly<{
      kind: 'barrier-reported';
      terminal: string;
      tab: string;
      barrier: Identity;
      exit: Promise<number | null>;
      ticket: UsageTicket | null;
    }>
  | Readonly<{ kind: 'session-ended'; code: number | null; end: SessionEnd }>
  | Readonly<{
      kind: 'usage-blocked';
      session: Steered;
      reason: string;
      ownership: AttemptEnd;
      detached: boolean;
      resume: string;
      ended: Readonly<{ code: number | null }> | null;
    }>
  | Readonly<{ kind: 'closed'; flags: Flags }>
  | Readonly<{ kind: 'advanced'; next: Readonly<{ issue: number; basis: Basis }> | null }>
  | Readonly<{ kind: 'reported'; issue: number | null }>
  | Readonly<{ kind: 'unsaved'; line: string }>
  | Readonly<{ kind: 'adopted'; claimed: Identity | null; lock: string | null }>
  | Readonly<{ kind: 'observed'; seen: Seen; basis: Basis }>
  | Readonly<{ kind: 'cleaned' }>
  | Readonly<{ kind: 'failed'; failure: Failure }>;

export type Effect =
  | Readonly<{ kind: 'say'; line: string; record: Readonly<{ name: string; issue: number }> | null }>
  | Readonly<{ kind: 'event'; name: string; message: string; issue: number | null; error: unknown }>
  | Readonly<{ kind: 'admit'; admission: Admission }>
  | Readonly<{ kind: 'note'; change: Partial<RunRecord> }>
  | Readonly<{ kind: 'note-loop'; loop: Loop; change: Partial<RunRecord> }>
  | Readonly<{ kind: 'mark'; label: RunState }>
  | Readonly<{ kind: 'no-progress'; issue: number; line: string }>
  | Readonly<{ kind: 'end-recovery'; issue: number }>
  | Readonly<{
      kind: 'archive';
      issue: number;
      attemptId: string;
      terminal: string;
      loop: Loop;
      authority: RecoveryAuthority;
      choice: AgentChoice;
    }>
  | Readonly<{ kind: 'save-queue'; change: Partial<QueueRecord> }>
  | Readonly<{ kind: 'startup-error'; issue: number; host: Host; terminal: string; tab: string }>
  | Readonly<{ kind: 'finish-tab'; terminal: string }>
  | Readonly<{ kind: 'remove-start' }>
  | Readonly<{ kind: 'close-tab'; terminal: string }>
  | Readonly<{ kind: 'error-line'; line: string }>
  | Readonly<{ kind: 'defect'; error: unknown }>
  | Readonly<{ kind: 'daemon' }>;

export type Kind = State['kind'];
export type Working = Exclude<Kind, 'finished'>;
export type StateOf<K extends Kind> = Extract<State, { kind: K }>;
export type EventOf<K extends Event['kind']> = Extract<Event, { kind: K }>;

export type Own = {
  starting: 'started';
  admitting: 'admitted' | 'lock-held';
  binding: 'bound';
  resolving: 'resolved';
  selecting: 'selected';
  'quota-wait': 'woke';
  preparing: 'prepared';
  opening: 'barrier-reported';
  live: 'session-ended' | 'usage-blocked';
  closing: 'closed';
  advancing: 'advanced';
  reporting: 'reported' | 'unsaved';
  adopting: 'adopted' | 'lock-held';
  observing: 'observed';
  ended: 'session-ended' | 'usage-blocked';
  ending: 'cleaned';
};
export type Accepts = { [S in Working]: Own[S] | 'failed' };
export type Targets = {
  starting: 'admitting' | 'reporting' | 'ending';
  admitting: 'binding' | 'preparing' | 'reporting' | 'ending';
  binding: 'resolving' | 'quota-wait' | 'live' | 'ended' | 'closing';
  resolving: 'resolving' | 'selecting' | 'closing';
  selecting: 'quota-wait' | 'preparing' | 'closing';
  'quota-wait': 'resolving' | 'closing';
  preparing: 'opening' | 'closing' | 'reporting' | 'ending';
  opening: 'live' | 'closing' | 'reporting' | 'ending';
  live: 'resolving' | 'quota-wait' | 'closing' | 'reporting' | 'ending';
  closing: 'advancing' | 'reporting' | 'ending';
  advancing: 'admitting' | 'reporting' | 'ending';
  reporting: 'ending';
  adopting: 'observing' | 'reporting' | 'ending';
  observing: 'binding' | 'preparing' | 'live' | 'ended' | 'reporting' | 'ending';
  ended: 'resolving' | 'quota-wait' | 'closing' | 'reporting' | 'ending';
  ending: 'finished';
};
export type Step<K extends Kind> = K extends Kind ? Readonly<{ state: StateOf<K>; effects: readonly Effect[] }> : never;
export type Table = {
  [S in Working]: { [E in Accepts[S]]: (state: StateOf<S>, event: EventOf<E>, run: RunFacts) => Step<Targets[S]> };
};

const say = (line: string, record: Readonly<{ name: string; issue: number }> | null = null): Effect => ({
  kind: 'say',
  line,
  record,
});
const errorLine = (line: string): Effect => ({ kind: 'error-line', line });
const logged = (name: string, message: string, issue: number | null, error: unknown = undefined): Effect => ({
  kind: 'event',
  name,
  message,
  issue,
  error,
});
const endRecovery = (issue: number): Effect => ({ kind: 'end-recovery', issue });
const finishTab = (terminal: string): Effect => ({ kind: 'finish-tab', terminal });
const noteLoop = (loop: Loop, change: Partial<RunRecord>): Effect => ({ kind: 'note-loop', loop, change });
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const emptyQueue = 'queue: empty; Add starts the next issue';

const ending = (result: Result, effects: readonly Effect[] = []): Step<'ending'> => ({
  state: { kind: 'ending', result },
  effects,
});
const stopped = (code: ExitCode, reason: string, effects: readonly Effect[] = []): Step<'ending'> =>
  ending({ ok: true, end: { kind: 'stopped', code, reason }, started: false }, effects);
const fail = (number: number, error: unknown, effects: readonly Effect[] = []): Step<'closing'> => ({
  state: { kind: 'closing', number, cause: { kind: 'failure', error } },
  effects,
});
const outcomeOf = (issue: IssueFacts, kind: Outcome['kind'], reason: string, act: string | null): Outcome => ({
  kind,
  started: issue.loop.started,
  next: issue.resolved,
  last: issue.loop.last,
  exitCode: issue.loop.exitCode,
  reason,
  act,
});
const close = (
  issue: IssueFacts,
  kind: Outcome['kind'],
  reason: string,
  act: string | null,
  effects: readonly Effect[],
): Step<'closing'> => ({
  state: {
    kind: 'closing',
    number: issue.number,
    cause: { kind: 'outcome', outcome: outcomeOf(issue, kind, reason, act) },
  },
  effects,
});
const proceed = (
  issue: IssueFacts,
  wait: KeptWait | null,
  effects: readonly Effect[],
): Step<'resolving' | 'quota-wait'> =>
  wait
    ? { state: { kind: 'quota-wait', issue, wait: { kind: 'kept', wait } }, effects }
    : { state: { kind: 'resolving', issue }, effects };

function newIssue(number: number, first: Loop['first'], basis: Basis, request: Request | null, override: Override) {
  const loop: Loop = {
    first,
    last: basis.last,
    lastHost: basis.lastHost,
    exitCode: 0,
    started: false,
    attempted: [],
    retrying: false,
    retryBlocked: false,
  };
  return { number, loop, request, override, resolved: null };
}

const cleared = (loop: Loop): Loop => ({ ...loop, attempted: [], retrying: false, retryBlocked: false });

function failure(failed: Failure, run: RunFacts): Step<'reporting' | 'ending'> {
  const { error } = failed;
  if (failed.detached && error instanceof HostError)
    return ending({ ok: true, end: { kind: 'detached', code: exits.done, reason: '' }, started: false });
  if (run.input.kind === 'queue') {
    if (failed.queueWritable && !failed.storageFailed) return { state: { kind: 'reporting', error }, effects: [] };
    const reason = messageOf(error);
    const code = error instanceof HostError ? error.code : exits.internal;
    return stopped(code, reason, [...(reason ? [errorLine(reason)] : []), { kind: 'defect', error }]);
  }
  if (error instanceof HostError)
    return stopped(error.code, error.message, error.message ? [errorLine(error.message)] : []);
  return ending({ ok: false, error });
}

const outside = (_state: unknown, event: EventOf<'failed'>, run: RunFacts) => failure(event.failure, run);
const inside = (state: Readonly<{ issue: IssueFacts }>, event: EventOf<'failed'>) =>
  fail(state.issue.number, event.failure.error);
const scoped = (
  state: Readonly<{ scope: 'issue'; issue: IssueFacts }> | Readonly<{ scope: 'resume' }>,
  event: EventOf<'failed'>,
  run: RunFacts,
) => (state.scope === 'issue' ? fail(state.issue.number, event.failure.error) : failure(event.failure, run));
function astray(
  state: Readonly<{ scope: 'issue'; issue: IssueFacts }> | Readonly<{ scope: 'resume' }>,
  event: Event['kind'],
): Step<'closing' | 'ending'> {
  if (state.scope === 'issue')
    return fail(state.issue.number, new Error(`run machine: an issue run cannot take the ${event} of a resume run`));
  return ending({ ok: false, error: new Error(`run machine: a resume run cannot take the ${event} of an issue run`) });
}

function endIssue(outcome: Outcome, number: number, run: RunFacts, effects: readonly Effect[]): Step<'ending'> {
  const end: RunEnd = { kind: outcome.kind, code: exits.done, reason: outcome.reason };
  if (run.input.kind !== 'queue')
    return ending(
      { ok: true, end, started: (run.input.kind === 'number' || run.input.kind === 'auto') && outcome.started },
      effects,
    );
  return ending({ ok: true, end, started: false }, [
    ...effects,
    {
      kind: 'save-queue',
      change: {
        activeHost: null,
        waitId: null,
        state: outcome.kind === 'gate' ? 'me-gate' : 'error',
        current: outcome.next?.kind === 'run' ? outcome.next : null,
        last: outcome.last,
        reason: outcome.reason,
        act: outcome.act,
      },
    },
    ...(outcome.kind === 'gate' ? [] : [logged('queue-error', outcome.reason, number)]),
  ]);
}

const drained = (): Step<'ending'> =>
  ending({ ok: true, end: { kind: 'closed', code: exits.done, reason: emptyQueue }, started: false }, [
    say(emptyQueue),
  ]);

function resolve(state: StateOf<'resolving'>, event: EventOf<'resolved'>, run: RunFacts): Step<Targets['resolving']> {
  const { next, authority, line, config, recovery } = event;
  const issue: IssueFacts = { ...state.issue, resolved: next };
  const { number, loop, request } = issue;
  const n = String(number);
  const unreadable = next.kind === 'observed' && next.reason === 'unreadable';
  const refuse = (text: string): Effect[] =>
    unreadable ? [{ kind: 'admit', admission: { ok: false, line: `daemon: ${text}`, code: exits.blocked } }] : [];
  if (request && (next.kind === 'run' ? next.step : null) !== request.step) {
    const reason = `#${n}: the displayed decision changed: ${line}; no step was started`;
    return close(issue, 'stopped', reason, 'Refresh the queue, then use its displayed action.', [
      say(reason),
      ...refuse(reason),
    ]);
  }
  if (next.kind !== 'run' || authority === null) {
    const closed = next.kind === 'stop' && (next.reason === 'finished' || next.reason === 'wontfix');
    return close(
      issue,
      closed ? 'closed' : 'stopped',
      line,
      describe(n, next).row?.act ?? 'Fix the cause, then use Try again.',
      [say(line), ...refuse(line), ...(closed ? [endRecovery(number)] : [])],
    );
  }
  const { step } = next;
  const prompt = invocation(step, number);
  if (loop.retrying && recovery) {
    const same =
      step === recovery.authority.step &&
      authority.spec === recovery.authority.spec &&
      authority.plan === recovery.authority.plan;
    if (!same && step === recovery.authority.step) {
      const reason = `#${n}: the spec or plan changed during the quota recovery of ${step}; no step was started`;
      return close(issue, 'stopped', reason, 'Read the issue, then start the step again.', [say(reason)]);
    }
    if (!same)
      return {
        state: { kind: 'resolving', issue: { ...issue, loop: cleared(loop) } },
        effects: [endRecovery(number)],
      };
  } else {
    if (run.input.kind === 'auto' && !autoTakes(config.autoLanes, next)) {
      const reason = `#${n}: autoLanes does not name ${next.lane ?? 'triage'}: celetis --agent <host> run ${n} starts ${prompt}`;
      return close(issue, 'gate', reason, null, [say(reason)]);
    }
    if (loop.last && !request?.retry && sameResult(next, loop.last)) {
      if (loop.exitCode !== exits.done)
        return fail(
          number,
          new HostError(
            `daemon: ${loop.lastHost} session exited with status ${loop.exitCode ?? 'unknown'} before issue progress; check startup output, then run ${event.recoveryCommand} from the main checkout or start the step again`,
            exits.blocked,
          ),
        );
      const reason = `no progress: ${prompt}`;
      return close(issue, 'stopped', reason, 'Open the saved session, or use Try again for this step.', [
        say(reason, { name: 'no-progress', issue: number }),
        { kind: 'no-progress', issue: number, line },
      ]);
    }
    const skips = loop.last ? skipped(loop.last.step, step, next.lane) : [];
    if (loop.last && !request?.retry && skips.length > 0) {
      const reason = `#${n}: ${step} skips ${skips.join(', ')} after ${loop.last.step}; fix the issue, or start ${step} by hand: celetis --agent <host> run ${n}`;
      return close(issue, 'stopped', reason, 'Fix the issue, or use Try again for this displayed step.', [
        say(reason, { name: 'step-skip', issue: number }),
        { kind: 'no-progress', issue: number, line },
      ]);
    }
    if (loop.first !== 'any' && (config.gates?.[step] ?? defaultGate) !== 'auto') {
      const reason = `the gate of ${step} is manual: celetis --agent <host> run ${n} starts ${prompt}`;
      return close(issue, 'gate', reason, 'Use Continue queue to start this displayed step.', [say(reason)]);
    }
  }
  return {
    state: {
      kind: 'selecting',
      issue,
      resolution: { operation: event.operation, config, next, authority, decided: event.decided, prompt },
    },
    effects: [],
  };
}

function played(issue: IssueFacts, fresh: boolean, session: Steered, exitCode: number | null): IssueFacts {
  const loop: Loop = { ...issue.loop, last: session.next, lastHost: session.host, started: true, exitCode };
  return fresh ? { ...issue, loop, request: null, override: noOverride } : { ...issue, loop };
}

function sessionDone(
  state: IssueSession,
  fresh: boolean,
  code: number | null,
  end: Extract<SessionEnd, { scope: 'issue' }>,
): Step<'resolving' | 'quota-wait' | 'closing'> {
  const { session } = end;
  const issue = played(state.issue, fresh, session, code);
  const { number } = issue;
  if (!end.saved)
    return fail(
      number,
      new HostError('', exits.blocked),
      end.reported
        ? []
        : [{ kind: 'startup-error', issue: number, host: session.host, terminal: state.terminal, tab: state.tab }],
    );
  const loop = cleared(issue.loop);
  return proceed({ ...issue, loop }, state.wait, [
    ...(code === exits.done ? [finishTab(state.terminal)] : []),
    noteLoop(issue.loop, { session: null }),
    { kind: 'remove-start' },
    endRecovery(number),
    noteLoop(loop, {}),
    { kind: 'mark', label: 'starting' },
  ]);
}

function settle(
  state: IssueSession,
  fresh: boolean,
  event: EventOf<'usage-blocked'>,
): Step<'resolving' | 'quota-wait' | 'closing'> {
  const { session, reason, ownership, resume } = event;
  const issue = played(state.issue, fresh, session, event.ended ? event.ended.code : state.issue.loop.exitCode);
  const { number } = issue;
  if (event.detached) return fail(number, new HostError('', exits.prerequisite));
  if (ownership.kind === 'unverified') {
    const running = ownership.running.length ? ` (running PIDs: ${ownership.running.join(', ')})` : '';
    const line = `#${number}: ${reason} The daemon cannot prove that the ${session.host} session and its delegated work stopped: ${ownership.reason}${running}. No other agent starts. The session stays in the tab ${state.tab}; its native resume from the main checkout: ${resume}`;
    return close(issue, 'stopped', line, 'Stop the session and its tasks in its tab, then use Try again.', [
      say(line),
      logged('quota-unverified', `daemon: ${line}`, number),
    ]);
  }
  const { attempted } = issue.loop;
  const loop: Loop = {
    ...issue.loop,
    attempted: attempted.includes(session.host) ? attempted : [...attempted, session.host],
    retrying: true,
  };
  return proceed({ ...issue, loop }, state.wait, [
    {
      kind: 'archive',
      issue: number,
      attemptId: session.owned.id,
      terminal: state.terminal,
      loop,
      authority: session.authority,
      choice: session.choice,
    },
    say(
      `#${number}: ${reason} Its session ended, and ${process.platform === 'win32' ? 'its job holds no other process' : 'no process of its tree or with its attempt marker runs'}; native resume from the main checkout: ${resume}. The same step continues with the next eligible agent.`,
    ),
    { kind: 'mark', label: 'starting' },
  ]);
}

function observe(record: RunRecord, event: EventOf<'observed'>, run: RunFacts): Step<Targets['observing']> {
  const { seen } = event;
  const number = record.issue ?? 0;
  if (seen.kind === 'queue-changed')
    return stopped(exits.done, 'queue: the queue changed while no daemon ran; this run ends', [
      say('queue: the queue changed while no daemon ran; this run ends'),
    ]);
  if (seen.kind === 'not-started') {
    const { session } = seen;
    const reason = `#${number}: the daemon stopped before the step ${session.step} started; no step was started`;
    const outcome: Outcome = {
      kind: 'stopped',
      started: false,
      next: session.next,
      last: record.loop.last,
      exitCode: record.loop.exitCode,
      reason,
      act: 'Fix the cause, then use Try again for the displayed step.',
    };
    return endIssue(outcome, number, run, [{ kind: 'close-tab', terminal: session.terminal ?? '' }, say(reason)]);
  }
  const session = seen.kind === 'no-session' ? null : seen.session;
  const { input } = record;
  if (input.kind === 'resume') {
    const barrier = session?.barrier;
    if (session && barrier) {
      const released: Released = { ...session, barrier };
      const terminal = session.terminal ?? '';
      return seen.kind === 'live'
        ? { state: { kind: 'live', scope: 'resume', number, terminal, fresh: false, session: released }, effects: [] }
        : { state: { kind: 'ended', scope: 'resume', number, terminal, session: released }, effects: [] };
    }
    return { state: { kind: 'preparing', scope: 'resume', number, ready: false }, effects: [] };
  }
  const before = session === null && !record.loop.started;
  const kept = record.loop;
  const request = before ? record.request : null;
  const first = !before ? 'gated' : input.kind === 'queue' ? (request ? 'any' : 'gated') : kept.first;
  const override = before && input.kind === 'number' ? { model: input.model, level: input.effort } : noOverride;
  const issue: IssueFacts = before
    ? newIssue(number, first, event.basis, request, override)
    : {
        number,
        loop: {
          first,
          last: kept.last,
          lastHost: kept.lastHost,
          exitCode: kept.exitCode,
          started: kept.started,
          attempted: [...kept.attempted],
          retrying: kept.retrying,
          retryBlocked: kept.retryBlocked,
        },
        request,
        override,
        resolved: null,
      };
  return {
    state: {
      kind: 'binding',
      issue,
      adopt: !(before && record.wait === null),
      keepRow: seen.kind === 'live',
      session: session && { facts: session, live: seen.kind === 'live' },
      wait: record.wait,
    },
    effects: [],
  };
}

export const on: Table = {
  starting: {
    started: (_state, event, run) => {
      if (event.issue === null) return drained();
      const { input } = run;
      const first = input.kind === 'number' || (input.kind === 'queue' && event.request) ? 'any' : 'gated';
      const override = input.kind === 'number' ? { model: input.model, level: input.effort } : noOverride;
      return {
        state: {
          kind: 'admitting',
          scope: 'issue',
          issue: newIssue(event.issue, first, event.basis, event.request, override),
        },
        effects: [],
      };
    },
    failed: outside,
  },
  admitting: {
    admitted: (state) =>
      state.scope === 'resume'
        ? {
            state: { kind: 'preparing', scope: 'resume', number: state.number, ready: true },
            effects: [{ kind: 'note', change: { issue: state.number, lock: `issue-${state.number}` } }],
          }
        : {
            state: { kind: 'binding', issue: state.issue, adopt: false, keepRow: false, session: null, wait: null },
            effects: [
              noteLoop(state.issue.loop, {
                issue: state.issue.number,
                lock: `issue-${state.issue.number}`,
                request: state.issue.request,
              }),
              { kind: 'daemon' },
            ],
          },
    'lock-held': (state, event, run) => {
      if (state.scope === 'resume')
        return failure(
          {
            ...event.flags,
            error: new HostError(
              `daemon: another run or its session (PID ${event.holder}) works on #${state.number}`,
              exits.prerequisite,
            ),
          },
          run,
        );
      const reason = `another run or its session (PID ${event.holder}) works on #${state.issue.number}`;
      return endIssue(
        outcomeOf(state.issue, 'stopped', reason, 'Wait for that session to exit, then use Try again.'),
        state.issue.number,
        run,
        [say(reason), { kind: 'admit', admission: { ok: false, line: `daemon: ${reason}`, code: exits.prerequisite } }],
      );
    },
    failed: outside,
  },
  binding: {
    bound: (state) => {
      const { issue, session, wait } = state;
      if (session) {
        const terminal = session.facts.terminal ?? '';
        const { tab } = session.facts;
        return session.live
          ? {
              state: { kind: 'live', scope: 'issue', issue, terminal, tab, wait, fresh: false, session: session.facts },
              effects: [],
            }
          : {
              state: { kind: 'ended', scope: 'issue', issue, terminal, tab, wait, session: session.facts },
              effects: [],
            };
      }
      return proceed(issue, wait, []);
    },
    failed: inside,
  },
  resolving: {
    resolved: resolve,
    failed: inside,
  },
  selecting: {
    selected: (state, event) => {
      const { issue, resolution } = state;
      const { choice } = resolution.operation;
      const preferred = resolution.config.agents?.[resolution.next.step];
      const decision = selectAgent(
        choice,
        capableOrder(effectiveOrder(event.order, preferred), { kind: 'step', step: resolution.next.step }, preferred),
        event.usage,
        event.now,
        new Set(issue.loop.attempted),
        issue.loop.retryBlocked,
      );
      if (decision.kind === 'wait')
        return {
          state: {
            kind: 'quota-wait',
            issue,
            wait: {
              kind: 'new',
              authority: resolution.authority,
              choice,
              blocked: decision.blocked,
              nextResetAt: decision.nextResetAt,
            },
          },
          effects: [],
        };
      return { state: { kind: 'preparing', scope: 'issue', issue, resolution, host: decision.host }, effects: [] };
    },
    failed: inside,
  },
  'quota-wait': {
    woke: (state, event) => {
      const loop: Loop = { ...state.issue.loop, attempted: [], retryBlocked: event.woke === 'retry' };
      return {
        state: { kind: 'resolving', issue: { ...state.issue, loop } },
        effects: [noteLoop(loop, { wait: null })],
      };
    },
    failed: inside,
  },
  preparing: {
    prepared: (state, event) => {
      const { start } = event;
      if (state.scope === 'issue' && start.scope === 'issue')
        return {
          state: {
            kind: 'opening',
            scope: 'issue',
            issue: { ...state.issue, loop: { ...state.issue.loop, first: 'gated' } },
            start,
          },
          effects: [],
        };
      if (state.scope === 'resume' && start.scope === 'resume')
        return { state: { kind: 'opening', scope: 'resume', number: state.number, start }, effects: [] };
      return astray(state, event.kind);
    },
    failed: scoped,
  },
  opening: {
    'barrier-reported': (state, event) => {
      const { terminal, tab, barrier, exit, ticket } = event;
      if (state.scope === 'resume')
        return {
          state: { kind: 'live', scope: 'resume', number: state.number, terminal, fresh: true, barrier, exit },
          effects: [],
        };
      if (ticket === null) return fail(state.issue.number, new Error('usage: a session started with no usage attempt'));
      return {
        state: {
          kind: 'live',
          scope: 'issue',
          issue: state.issue,
          terminal,
          tab,
          wait: null,
          fresh: true,
          session: { ...state.start.facts, ticket },
          barrier,
          exit,
        },
        effects: [],
      };
    },
    failed: scoped,
  },
  live: {
    'session-ended': (state, event) => {
      const { end } = event;
      if (state.scope === 'resume')
        return end.scope === 'resume'
          ? stopped(end.passed, '', event.code === exits.done ? [finishTab(state.terminal)] : [])
          : astray(state, event.kind);
      if (end.scope === 'resume') return astray(state, event.kind);
      return sessionDone(state, state.fresh, event.code, end);
    },
    'usage-blocked': (state, event) =>
      state.scope === 'resume' ? astray(state, event.kind) : settle(state, state.fresh, event),
    failed: scoped,
  },
  closing: {
    closed: (state, event, run) => {
      const { cause } = state;
      if (cause.kind === 'failure') return failure({ ...event.flags, error: cause.error }, run);
      const { outcome } = cause;
      if (run.input.kind === 'queue' && outcome.kind === 'closed')
        return { state: { kind: 'advancing', number: state.number }, effects: [] };
      return endIssue(outcome, state.number, run, []);
    },
    failed: outside,
  },
  advancing: {
    advanced: (_state, event) => {
      const { next } = event;
      if (next === null) return drained();
      const issue = newIssue(next.issue, 'gated', next.basis, null, noOverride);
      return {
        state: { kind: 'admitting', scope: 'issue', issue },
        effects: [
          noteLoop(
            { ...issue.loop, last: null },
            { issue: next.issue, lock: null, request: null, wait: null, session: null },
          ),
        ],
      };
    },
    failed: outside,
  },
  reporting: {
    reported: (state, event) => {
      const reason = messageOf(state.error);
      return stopped(exits.done, reason, [
        ...(reason ? [errorLine(reason)] : []),
        logged('queue-error', reason, event.issue, state.error instanceof HostError ? undefined : state.error),
      ]);
    },
    unsaved: (_state, event) => stopped(exits.blocked, event.line, [errorLine(event.line)]),
    failed: (_state, event) => ending({ ok: false, error: event.failure.error }),
  },
  adopting: {
    adopted: (state, event) => ({
      state: { kind: 'observing', record: state.record, claimed: event.claimed, lock: event.lock },
      effects: [{ kind: 'admit', admission: { ok: true } }],
    }),
    'lock-held': (state, event) => {
      const number = state.record.issue ?? 0;
      const reason = `#${number}: another run or its session (PID ${event.holder}) took #${number} while no daemon ran; this run ends`;
      return stopped(exits.done, reason, [
        say(reason),
        { kind: 'admit', admission: { ok: false, line: `daemon: ${reason}`, code: exits.done } },
      ]);
    },
    failed: outside,
  },
  observing: {
    observed: (state, event, run) => observe(state.record, event, run),
    failed: outside,
  },
  ended: {
    'session-ended': (state, event) => {
      const { end } = event;
      if (state.scope === 'resume')
        return end.scope === 'resume'
          ? stopped(end.passed, '', event.code === exits.done ? [finishTab(state.terminal)] : [])
          : astray(state, event.kind);
      if (end.scope === 'resume') return astray(state, event.kind);
      return sessionDone(state, false, event.code, end);
    },
    'usage-blocked': (state, event) =>
      state.scope === 'resume' ? astray(state, event.kind) : settle(state, false, event),
    failed: scoped,
  },
  ending: {
    cleaned: (state) => ({ state: { kind: 'finished', result: state.result }, effects: [] }),
    failed: (_state, event) => ({
      state: { kind: 'finished', result: { ok: false, error: event.failure.error } },
      effects: [],
    }),
  },
};

export function initial(input: RunInput, record: RunRecord | undefined): State {
  if (record) return { kind: 'adopting', record };
  if (input.kind === 'resume') return { kind: 'admitting', scope: 'resume', number: input.number };
  return { kind: 'starting' };
}
