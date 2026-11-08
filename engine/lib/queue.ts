import type { AgentChoice, Host } from './config-core.ts';
import { exits } from './contract.ts';
import { HostError, selectHost } from './host.ts';
import { lineOf, type Next } from './lines.ts';
import { type LockOwner, lockHolder } from './locks.ts';
import { type HostSelection, locateCheckouts, type Operation } from './operation.ts';
import { childEnv } from './process.ts';
import type { QueueAction, QueueReceipt, QueueRecord, QueueView } from './queue-types.ts';
import { readRecovery, recoveryOwner } from './quota-recovery.ts';
import { nextIssue } from './resolver.ts';
import { ensureFolder, repositoryState, withLock, writeAtomic } from './state.ts';
import { commitMigration, type LocalRecord, readLocalRecord } from './state-migration.ts';
import { requestStatePreparation } from './state-preparation.ts';
import { lanes, type Run, type Step, steps } from './workflow.ts';

export type { QueueAction, QueueRecord, QueueView } from './queue-types.ts';

const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string) => Object.keys(value).sort().join(',') === names;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const step = (value: unknown): value is Step => typeof value === 'string' && steps.includes(value as Step);
const identity = (value: Record<string, unknown>) =>
  typeof value.id === 'string' && uuid.test(value.id) && positive(value.revision);
const numbers = (value: unknown): value is number[] =>
  Array.isArray(value) && Array.from(value).every(positive) && new Set(value).size === value.length;
const text = (value: unknown) => value === null || typeof value === 'string';

export function choice(value: unknown): value is AgentChoice {
  return (
    object(value) &&
    ((value.kind === 'default' && keys(value, 'kind')) ||
      (value.kind === 'explicit' && keys(value, 'host,kind') && (value.host === 'claude' || value.host === 'codex')))
  );
}

export const sameChoice = (a: AgentChoice, b: AgentChoice) =>
  a.kind === b.kind && (a.kind === 'default' || (b.kind === 'explicit' && a.host === b.host));

export const explicitHost = (value: AgentChoice | null | undefined): Host | null =>
  value?.kind === 'explicit' ? value.host : null;

export function requireQueueChoice(recorded: AgentChoice, requested: AgentChoice): void {
  if (!sameChoice(recorded, requested))
    throw new HostError(
      `queue: recorded agent choice is ${recorded.kind === 'default' ? 'the default order' : recorded.host}`,
      exits.prerequisite,
    );
}

export function queueSelection(
  queue: QueueRecord | null,
  use: 'add' | 'act' | 'read',
  selection: HostSelection,
): HostSelection {
  if (use === 'add' || !queue?.choice) return selection;
  const named = selection.explicit ?? selection.environment;
  if (use === 'act' && named !== undefined) {
    try {
      requireQueueChoice(queue.choice, { kind: 'explicit', host: selectHost(named) });
    } catch (cause) {
      throw new HostError((cause as Error).message, exits.usage);
    }
  }
  const host = explicitHost(queue.choice);
  return host === null ? {} : { saved: host };
}

function run(value: unknown): value is Run | null {
  return (
    value === null ||
    (object(value) &&
      keys(value, 'kind,lane,state,step') &&
      value.kind === 'run' &&
      step(value.step) &&
      (value.lane === null || (typeof value.lane === 'string' && Object.hasOwn(lanes, value.lane))) &&
      typeof value.state === 'string' &&
      ['unrouted', 'unspecified', 'undiagnosed', 'chore', 'hotfix', 'defined', 'planned', 'built'].includes(
        value.state,
      ))
  );
}

export function parseQueueAction(value: unknown): QueueAction {
  if (object(value) && object(value.expected) && keys(value.expected, 'current,id,revision')) {
    const expected = value.expected;
    const valid =
      expected.id === null
        ? expected.revision === 0 && expected.current === null
        : identity(expected) && (expected.current === null || positive(expected.current));
    if (valid) {
      if (
        value.kind === 'add' &&
        keys(value, 'expected,kind,number,step') &&
        positive(value.number) &&
        step(value.step)
      )
        return value as QueueAction;
      if (
        value.kind === 'move' &&
        keys(value, 'direction,expected,kind,number') &&
        positive(value.number) &&
        (value.direction === 'up' || value.direction === 'down')
      )
        return value as QueueAction;
      if (value.kind === 'remove' && keys(value, 'expected,kind,number') && positive(value.number))
        return value as QueueAction;
      if (
        keys(value, 'expected,kind,step') &&
        ((value.kind === 'continue' && step(value.step)) ||
          (value.kind === 'retry' && (value.step === null || step(value.step))))
      )
        return value as QueueAction;
    }
  }
  throw new HostError('queue: invalid action', exits.usage);
}

function validate(value: unknown): QueueRecord {
  const invalid = () => new Error('queue: invalid or obsolete record');
  if (
    !object(value) ||
    !keys(value, 'act,activeHost,choice,current,id,last,launch,numbers,reason,revision,schema,state,waitId') ||
    value.schema !== 3 ||
    !identity(value) ||
    !numbers(value.numbers) ||
    !run(value.current) ||
    !run(value.last) ||
    !text(value.reason) ||
    !text(value.act)
  )
    throw invalid();
  if (value.state === 'empty') {
    if (
      value.numbers.length ||
      [
        value.choice,
        value.activeHost,
        value.waitId,
        value.current,
        value.last,
        value.reason,
        value.act,
        value.launch,
      ].some((item) => item !== null)
    )
      throw invalid();
  } else {
    if (
      !value.numbers.length ||
      !choice(value.choice) ||
      !(value.activeHost === null || value.activeHost === 'claude' || value.activeHost === 'codex') ||
      !['starting', 'running', 'quota-wait', 'me-gate', 'error'].includes(String(value.state))
    )
      throw invalid();
    if (
      value.state === 'quota-wait'
        ? typeof value.waitId !== 'string' || !uuid.test(value.waitId) || value.activeHost !== null
        : value.waitId !== null
    )
      throw invalid();
    if ((value.state === 'starting') !== (value.launch !== null)) throw invalid();
    if (value.state === 'me-gate' && value.current === null) throw invalid();
    if (value.launch !== null) {
      const launch = value.launch;
      if (
        !object(launch) ||
        !keys(launch, 'authorization,token') ||
        typeof launch.token !== 'string' ||
        !uuid.test(launch.token)
      )
        throw invalid();
      const auth = launch.authorization;
      if (
        auth !== null &&
        (!object(auth) ||
          !keys(auth, 'number,retry,step') ||
          auth.number !== value.numbers[0] ||
          typeof auth.retry !== 'boolean' ||
          !(step(auth.step) || (auth.retry && auth.step === null)))
      )
        throw invalid();
    }
  }
  return value as QueueRecord;
}

function nextValue(value: unknown): boolean {
  if (run(value)) return true;
  if (!object(value)) return false;
  if (value.kind === 'observed')
    return value.reason === 'dirty'
      ? keys(value, 'kind,path,reason') && typeof value.path === 'string'
      : keys(value, 'kind,reason') && ['landing', 'unreadable'].includes(String(value.reason));
  if (value.kind !== 'stop') return false;
  if (value.reason === 'ready-for-human')
    return keys(value, 'kind,reason,variant') && ['landing-refused', 'your-step'].includes(String(value.variant));
  if (value.reason === 'human-step')
    return keys(value, 'kind,reason,variant') && ['evidence', 'report', 'removal'].includes(String(value.variant));
  if (value.reason === 'several-lanes')
    return (
      keys(value, 'kind,labels,reason') &&
      Array.isArray(value.labels) &&
      value.labels.every((item) => typeof item === 'string')
    );
  return (
    keys(value, 'kind,reason') &&
    ['wontfix', 'finished', 'needs-info', 'epic', 'land-by-hand'].includes(String(value.reason))
  );
}

export function parseQueueView(value: unknown): QueueView {
  if (
    !object(value) ||
    !keys(value, 'actions,error,next,owner,record') ||
    !text(value.owner) ||
    !text(value.error) ||
    !nextValue(value.next) ||
    !object(value.actions) ||
    !keys(value.actions, 'add,continue,edit,retry') ||
    Object.values(value.actions).some((item) => typeof item !== 'boolean')
  )
    throw new Error('queue: invalid view');
  if (value.record !== null) validate(value.record);
  return value as QueueView;
}

export function parseQueueReceipt(value: unknown): QueueReceipt {
  if (!object(value) || !keys(value, 'view,wake')) throw new Error('queue: invalid receipt');
  const { record } = parseQueueView(value.view);
  if (value.wake !== null) {
    const wake = value.wake;
    if (
      !object(wake) ||
      !keys(wake, 'choice,id,token') ||
      !record?.launch ||
      !record.choice ||
      wake.id !== record.id ||
      wake.token !== record.launch.token ||
      !choice(wake.choice) ||
      !sameChoice(wake.choice, record.choice)
    )
      throw new Error('queue: invalid receipt wake');
  }
  return value as QueueReceipt;
}

function historical(value: unknown, file: string): QueueRecord {
  const invalid = (cause: string): never => {
    throw new HostError(
      `queue: ${file}: schema ${object(value) ? String(value.schema) : 'unknown'} to 3: ${cause}`,
      exits.usage,
    );
  };
  if (!object(value) || (value.schema !== 1 && value.schema !== 2)) invalid('unsupported schema');
  const old = value as Record<string, unknown>;
  if (
    !keys(
      old,
      old.schema === 1
        ? 'act,current,host,id,last,numbers,position,reason,results,revision,schema,state'
        : 'act,current,host,id,last,launch,numbers,reason,revision,schema,state',
    ) ||
    !identity(old) ||
    !numbers(old.numbers) ||
    !run(old.current) ||
    !run(old.last) ||
    !text(old.reason) ||
    !text(old.act)
  )
    invalid('invalid historical fields');
  const originalNumbers = old.numbers as number[];
  if (old.schema === 1) {
    if (
      (old.host !== 'claude' && old.host !== 'codex') ||
      !originalNumbers.length ||
      !Number.isSafeInteger(old.position) ||
      Number(old.position) < 0 ||
      !Array.isArray(old.results) ||
      old.results.length !== old.position ||
      !old.results.every((result) => ['finished', 'wontfix', 'already-closed'].includes(result)) ||
      !['running', 'me-gate', 'error', 'complete'].includes(String(old.state)) ||
      (old.state === 'complete'
        ? old.position !== originalNumbers.length
        : Number(old.position) >= originalNumbers.length)
    )
      invalid('invalid schema-1 state, position, or completed results');
  } else if (old.state === 'empty') {
    if (
      originalNumbers.length ||
      [old.host, old.current, old.last, old.reason, old.act, old.launch].some((field) => field !== null)
    )
      invalid('invalid schema-2 empty state');
  } else if (
    (old.host !== 'claude' && old.host !== 'codex') ||
    !originalNumbers.length ||
    !['starting', 'running', 'me-gate', 'error'].includes(String(old.state))
  )
    invalid('invalid schema-2 state');
  if (old.revision === Number.MAX_SAFE_INTEGER) invalid('revision cannot advance as a safe integer');
  const empty = old.state === 'complete' || old.state === 'empty';
  const target = {
    schema: 3,
    id: old.id,
    revision: Number(old.revision) + 1,
    choice: empty ? null : { kind: 'explicit', host: old.host },
    activeHost: null,
    numbers: empty ? [] : old.schema === 1 ? originalNumbers.slice(Number(old.position)) : originalNumbers,
    state: empty ? 'empty' : old.state,
    waitId: null,
    current: empty ? null : old.current,
    last: empty ? null : old.last,
    reason: empty ? null : old.reason,
    act: empty ? null : old.act,
    launch: empty || old.schema === 1 ? null : old.launch,
  };
  if (!empty && old.state === 'me-gate' && old.current === null) invalid('current Run is unmappable for me-gate');
  try {
    return validate(target);
  } catch {
    return invalid('historical state or launch cannot map to the current invariant');
  }
}

async function snapshot(common: string): Promise<LocalRecord | null> {
  const layout = await repositoryState(common);
  const file = layout.queue;
  try {
    return await readLocalRecord(file, [common, layout.root.path], 'shared');
  } catch (error) {
    throw new HostError(
      `queue: ${file}: target schema 3: cannot read record: ${error instanceof Error ? error.message : String(error)}`,
      exits.blocked,
    );
  }
}
const oldSchema = (source: LocalRecord) =>
  object(source.value) && (source.value.schema === 1 || source.value.schema === 2);
const currentRecord = (source: LocalRecord): QueueRecord => {
  if (!object(source.value) || source.value.schema !== 3)
    throw new HostError(
      `queue: ${source.path}: unsupported schema ${object(source.value) ? String(source.value.schema) : 'unknown'}; expected schema 3`,
      exits.usage,
    );
  try {
    return validate(source.value);
  } catch {
    throw new HostError(`queue: ${source.path}: invalid schema-3 record`, exits.usage);
  }
};
async function currentQueue(common: string): Promise<QueueRecord | null> {
  const source = await snapshot(common);
  return source ? currentRecord(source) : null;
}
async function commonOf(main: string, common?: string): Promise<string> {
  if (common !== undefined) return common;
  const checkout = await locateCheckouts(main);
  if (checkout.common === null || checkout.main !== main)
    throw new HostError('queue: need the main Git checkout', exits.usage);
  return checkout.common;
}

export async function prepareQueue(_main: string, common: string, owner: LockOwner): Promise<void> {
  const first = await snapshot(common);
  if (!first) return;
  if (!oldSchema(first)) {
    currentRecord(first);
    return;
  }
  const decided = historical(first.value, first.path);
  const context = `queue: ${first.path}: schema ${object(first.value) ? first.value.schema : 'unknown'} to 3`;
  const issue = decided.numbers[0];
  if (!owner.owns('queue') && issue !== undefined && owner.owns(`issue-${issue}`))
    throw new Error(`${context}: cannot acquire queue ownership after issue-${issue}; retry after releasing the issue`);
  const acquired: string[] = [];
  const take = async (name: string) => {
    if (owner.owns(name)) return;
    let holder: string | null;
    try {
      holder = await owner.take(name);
    } catch (error) {
      throw new HostError(
        `${context}: cannot take ${name} ownership: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof HostError ? error.code : exits.internal,
      );
    }
    if (holder !== null)
      throw new HostError(
        `${context}: busy ${name} ownership (PID ${holder}); retry after the owner exits`,
        exits.prerequisite,
      );
    acquired.push(name);
  };
  try {
    await take('queue');
    const owned = await snapshot(common);
    if (!owned) throw new HostError(`${context}: source disappeared during preparation`, exits.prerequisite);
    if (!oldSchema(owned)) {
      currentRecord(owned);
      return;
    }
    const ownedTarget = historical(owned.value, owned.path);
    if (ownedTarget.id !== decided.id || ownedTarget.numbers[0] !== issue)
      throw new HostError(
        `${context}: identity or current unfinished issue changed during preparation`,
        exits.prerequisite,
      );
    if (issue !== undefined) await take(`issue-${issue}`);
    await withQueueWrite(common, async () => {
      const locked = await snapshot(common);
      if (!locked) throw new HostError(`${context}: source disappeared under the write lock`, exits.prerequisite);
      if (!oldSchema(locked)) {
        currentRecord(locked);
        return;
      }
      const target = historical(locked.value, locked.path);
      if (target.id !== decided.id || target.numbers[0] !== issue)
        throw new HostError(
          `${context}: identity or current unfinished issue changed under the write lock`,
          exits.prerequisite,
        );
      await commitMigration(
        locked,
        Number((locked.value as Record<string, unknown>).schema),
        `${JSON.stringify(target)}\n`,
      );
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    if (cause.startsWith(context)) throw error;
    throw new HostError(`${context}: ${cause}`, error instanceof HostError ? error.code : exits.internal);
  } finally {
    for (const name of acquired.reverse()) await owner.release(name);
  }
}

export async function readQueue(main: string, common?: string, owner?: LockOwner): Promise<QueueRecord | null> {
  common = await commonOf(main, common);
  const source = await snapshot(common);
  if (!source) return null;
  if (!oldSchema(source)) return currentRecord(source);
  historical(source.value, source.path);
  if (owner) await prepareQueue(main, common, owner);
  else await requestStatePreparation(main, { kind: 'queue' });
  return currentQueue(common);
}

async function writeQueue(common: string, record: QueueRecord): Promise<void> {
  validate(record);
  const layout = await repositoryState(common);
  ensureFolder(layout.root);
  await writeAtomic(layout.queue, `${JSON.stringify(record)}\n`);
}

async function withQueueWrite<T>(common: string, change: () => Promise<T>): Promise<T> {
  return withLock((await repositoryState(common)).queueLock, change);
}

export async function updateQueue(
  main: string,
  change: (record: QueueRecord | null) => Promise<QueueRecord>,
  common?: string,
  owner?: LockOwner,
): Promise<QueueRecord> {
  const storage = await commonOf(main, common);
  await readQueue(main, storage, owner);
  return withQueueWrite(storage, async () => {
    const previous = await currentQueue(storage);
    const changed = await change(previous);
    if (changed === previous) return changed;
    const next = { ...changed, revision: (previous?.revision ?? 0) + 1 };
    await writeQueue(storage, next);
    return next;
  });
}

export function queueView(
  record: QueueRecord | null,
  owner: string | null,
  next: Next | null,
  error: string | null = null,
): QueueView {
  const terminal = next?.kind === 'stop' && (next.reason === 'finished' || next.reason === 'wontfix');
  const unreadable = next?.kind === 'observed' && next.reason === 'unreadable';
  if (!error && next && next.kind !== 'run' && !terminal) error = lineOf(String(record?.numbers[0]), next);
  if (!error && record?.state === 'error') error = record.reason;
  if (!error && (record?.state === 'running' || record?.state === 'quota-wait') && !owner)
    error = 'queue: the run was interrupted. Use Try again to continue.';
  return {
    record,
    owner,
    next,
    error,
    actions: {
      add: !unreadable,
      edit: Boolean(record?.numbers.length) && !unreadable,
      continue: !owner && record?.state === 'me-gate' && next?.kind === 'run',
      retry:
        !owner &&
        Boolean(record?.numbers.length) &&
        (terminal || (record?.state !== 'me-gate' && next?.kind === 'run')),
    },
  };
}

export async function queueOwner(main: string, record: QueueRecord | null): Promise<string | null> {
  return (
    (await lockHolder(main, 'queue')) ||
    (record?.numbers[0] ? await lockHolder(main, `issue-${record.numbers[0]}`) : null) ||
    null
  );
}

export async function readQueueView(operation: Operation, signal?: AbortSignal): Promise<QueueView> {
  let record: QueueRecord | null = null;
  try {
    signal?.throwIfAborted();
    const { main, common } = operation.checkout;
    if (main === null || common === null) throw new Error('queue: need a Git checkout');
    record = await readQueue(main, common);
    const number = record?.numbers[0];
    const next = number ? (await nextIssue(String(number), operation, signal)).next : null;
    const owner = await queueOwner(main, record);
    signal?.throwIfAborted();
    const latest = await readQueue(main, common);
    if (latest?.id !== record?.id || latest?.revision !== record?.revision)
      throw new Error('queue: changed during the read; refresh before acting');
    const recovery = record?.state === 'quota-wait' && owner && number ? await readRecovery(main, number) : null;
    const kept =
      recovery?.state === 'waiting' &&
      recovery.waitId === record?.waitId &&
      next?.kind === 'observed' &&
      next.reason === 'dirty' &&
      recovery.lane?.path === next.path &&
      (await recoveryOwner(recovery));
    const view = queueView(record, owner, next, kept ? (record?.reason ?? null) : null);
    const pinned = explicitHost(record?.choice);
    if (pinned && !Bun.which(pinned, { PATH: childEnv().PATH })) {
      view.error = `queue: ${pinned} is not on PATH`;
      view.actions.add = false;
      view.actions.continue = false;
      if (next?.kind === 'run') view.actions.retry = false;
    }
    return view;
  } catch (error) {
    return {
      record,
      owner: null,
      next: null,
      error: error instanceof Error ? error.message : String(error),
      actions: { add: false, edit: false, continue: false, retry: false },
    };
  }
}
