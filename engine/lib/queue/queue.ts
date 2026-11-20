import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import { type HostSelection, locateCheckouts, type Operation } from '../command/operation.ts';
import type { AgentChoice, Host } from '../config/core.ts';
import { exits } from '../contract/contract.ts';
import { hostAvailability, selectHost } from '../host/host.ts';
import { isHost } from '../host/names.ts';
import { lineOf, type Next } from '../resolver/lines.ts';
import { nextIssue } from '../resolver/resolver.ts';
import { readRecovery, recoveryOwner } from '../run/quota-recovery.ts';
import { issueLock, type LockOwner, lockHolder } from '../state/locks.ts';
import { commitMigration, type LocalRecord, readLocalRecord } from '../state/migration.ts';
import { requestStatePreparation } from '../state/preparation.ts';
import { ensureFolder, repositoryLayout, withLock, writeAtomic } from '../state/state.ts';
import { type IssueKey, parseKey } from '../tracker/key.ts';
import {
  agentChoice,
  type QueueAction,
  type QueueReceipt,
  type QueueRecord,
  type QueueView,
  queueAction,
  queueReceipt,
  queueRecord,
  queueRecordSchema3,
  sameChoice,
  queueView as viewSchema,
} from './types.ts';

export type { QueueAction, QueueRecord, QueueView } from './types.ts';
export { sameChoice };

const versioned = z.looseObject({ schema: z.unknown().optional() });
const versionOf = (value: unknown) => {
  const parsed = versioned.safeParse(value);
  return parsed.success ? { schema: parsed.data.schema } : null;
};
const schemaText = (value: unknown) => {
  const version = versionOf(value);
  return version ? String(version.schema) : 'unknown';
};

export function choice(value: unknown): value is AgentChoice {
  return agentChoice.safeParse(value).success;
}

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

export function parseQueueAction(value: unknown): QueueAction {
  const parsed = queueAction.safeParse(value);
  if (!parsed.success) throw new HostError('queue: invalid action', exits.usage);
  return parsed.data;
}

function validate(value: unknown): QueueRecord {
  const parsed = queueRecord.safeParse(value);
  if (!parsed.success) throw new Error('queue: invalid or obsolete record');
  return parsed.data;
}

type Schema3Record = z.output<typeof queueRecordSchema3>;

function validate3(value: unknown): Schema3Record {
  const parsed = queueRecordSchema3.safeParse(value);
  if (!parsed.success) throw new Error('queue: invalid or obsolete record');
  return parsed.data;
}

const viewShape = viewSchema.extend({ record: z.unknown() });

export function parseQueueView(value: unknown): QueueView {
  if (!viewShape.safeParse(value).success) throw new Error('queue: invalid view');
  const parsed = viewSchema.safeParse(value);
  if (!parsed.success) throw new Error('queue: invalid or obsolete record');
  return parsed.data;
}

const receiptShape = z.strictObject({ view: z.unknown(), wake: z.unknown() });

export function parseQueueReceipt(value: unknown): QueueReceipt {
  const shape = receiptShape.safeParse(value);
  if (!shape.success) throw new Error('queue: invalid receipt');
  parseQueueView(shape.data.view);
  const parsed = queueReceipt.safeParse(value);
  if (!parsed.success) throw new Error('queue: invalid receipt wake');
  return parsed.data;
}

const { id, revision, numbers, current, last, reason, act } = queueRecordSchema3.shape;
const historicalFields = { id, revision, numbers, current, last, reason, act };
const historicalSchemas = {
  1: z.strictObject({
    ...historicalFields,
    schema: z.literal(1),
    host: z.unknown(),
    position: z.unknown(),
    results: z.unknown(),
    state: z.unknown(),
  }),
  2: z.strictObject({
    ...historicalFields,
    schema: z.literal(2),
    host: z.unknown(),
    state: z.unknown(),
    launch: z.unknown(),
  }),
};

function keyed(record: Schema3Record, invalid: (cause: string) => never): QueueRecord {
  const key = (number: number): IssueKey => parseKey(String(number)) ?? invalid('an issue number is not an issue key');
  const authorization = record.launch?.authorization;
  const target = {
    ...record,
    schema: 4,
    numbers: record.numbers.map(key),
    launch: record.launch && {
      ...record.launch,
      authorization: authorization ? { ...authorization, number: key(authorization.number) } : null,
    },
  };
  try {
    return validate(target);
  } catch {
    return invalid('the record cannot map to the current invariant');
  }
}

function historical(value: unknown, file: string): QueueRecord {
  const invalid = (cause: string): never => {
    throw new HostError(`queue: ${file}: schema ${schemaText(value)} to 4: ${cause}`, exits.usage);
  };
  const version = versionOf(value)?.schema;
  if (version === 3) {
    let record: Schema3Record;
    try {
      record = validate3(value);
    } catch {
      return invalid('invalid schema-3 record');
    }
    return keyed(record, invalid);
  }
  if (version !== 1 && version !== 2) return invalid('unsupported schema');
  const fields = historicalSchemas[version].safeParse(value);
  if (!fields.success) return invalid('invalid historical fields');
  const old = fields.data;
  const originalNumbers = old.numbers;
  if (old.schema === 1) {
    if (
      !isHost(old.host) ||
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
    !isHost(old.host) ||
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
  let record: Schema3Record;
  try {
    record = validate3(target);
  } catch {
    return invalid('historical state or launch cannot map to the current invariant');
  }
  return keyed(record, invalid);
}

async function snapshot(common: string): Promise<LocalRecord | null> {
  const layout = repositoryLayout(common);
  const file = layout.queue;
  try {
    return await readLocalRecord(file, [common, layout.root.path], 'shared');
  } catch (error) {
    throw new HostError(
      `queue: ${file}: target schema 4: cannot read record: ${error instanceof Error ? error.message : String(error)}`,
      exits.blocked,
    );
  }
}
const oldSchema = (source: LocalRecord) => {
  const schema = versionOf(source.value)?.schema;
  return schema === 1 || schema === 2 || schema === 3;
};
const currentRecord = (source: LocalRecord): QueueRecord => {
  if (versionOf(source.value)?.schema !== 4)
    throw new HostError(
      `queue: ${source.path}: unsupported schema ${schemaText(source.value)}; expected schema 4`,
      exits.usage,
    );
  try {
    return validate(source.value);
  } catch {
    throw new HostError(`queue: ${source.path}: invalid schema-4 record`, exits.usage);
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
  const context = `queue: ${first.path}: schema ${schemaText(first.value)} to 4`;
  const issue: IssueKey | undefined = decided.numbers[0];
  if (!owner.owns('queue') && issue !== undefined && owner.owns(issueLock(issue)))
    throw new Error(
      `${context}: cannot acquire queue ownership after ${issueLock(issue)}; retry after releasing the issue`,
    );
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
    if (issue !== undefined) await take(issueLock(issue));
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
  const layout = repositoryLayout(common);
  ensureFolder(layout.root);
  await writeAtomic(layout.queue, `${JSON.stringify(record)}\n`);
}

async function withQueueWrite<T>(common: string, change: () => Promise<T>): Promise<T> {
  return withLock(repositoryLayout(common).queueLock, change);
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
  const first = record?.numbers[0];
  if (!error && first !== undefined && next && next.kind !== 'run' && !terminal) error = lineOf(first, next);
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
    (record?.numbers[0] ? await lockHolder(main, issueLock(record.numbers[0])) : null) ||
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
    const next = number ? (await nextIssue(number, operation, signal)).next : null;
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
    if (pinned && !hostAvailability(pinned).available) {
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
