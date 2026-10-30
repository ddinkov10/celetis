import { randomUUID } from 'node:crypto';
import { type BigIntStats, constants } from 'node:fs';
import { lstat, mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nextIssue } from '../next-step.ts';
import { lineOf } from './lines.ts';
import { lockHolder } from './locks.ts';
import type { Operation } from './operation.ts';
import type { QueueAction, QueueRecord, QueueView } from './queue-types.ts';
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
  Array.isArray(value) && value.length > 0 && Array.from(value).every(positive) && new Set(value).size === value.length;
const text = (value: unknown) => value === null || typeof value === 'string';

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
  if (object(value)) {
    if (value.kind === 'start' && keys(value, 'kind,numbers,step') && numbers(value.numbers) && step(value.step))
      return value as QueueAction;
    if (identity(value)) {
      if (value.kind === 'reset' && keys(value, 'id,kind,revision')) return value as QueueAction;
      if (
        keys(value, 'id,kind,revision,step') &&
        ((value.kind === 'continue' && step(value.step)) ||
          (value.kind === 'retry' && (value.step === null || step(value.step))))
      )
        return value as QueueAction;
    }
  }
  throw new Error('queue: invalid action');
}

function validate(value: unknown): QueueRecord {
  if (
    !object(value) ||
    !keys(value, 'act,current,host,id,last,numbers,position,reason,results,revision,schema,state') ||
    value.schema !== 1 ||
    !identity(value) ||
    (value.host !== 'claude' && value.host !== 'codex') ||
    !numbers(value.numbers) ||
    !Number.isSafeInteger(value.position) ||
    Number(value.position) < 0 ||
    !Array.isArray(value.results) ||
    value.results.length !== value.position ||
    !Array.from(value.results).every((result) => ['finished', 'wontfix', 'already-closed'].includes(result)) ||
    typeof value.state !== 'string' ||
    !['running', 'me-gate', 'error', 'complete'].includes(value.state) ||
    (value.state === 'complete'
      ? value.position !== value.numbers.length
      : Number(value.position) >= value.numbers.length) ||
    !run(value.current) ||
    !run(value.last) ||
    !text(value.reason) ||
    !text(value.act)
  )
    throw new Error('queue: invalid or obsolete record');
  return value as QueueRecord;
}

const pathOf = (common: string) => join(common, 'celetis-flow', 'queue.json');

export async function readQueue(common: string): Promise<QueueRecord | null> {
  const file = pathOf(common);
  let before: BigIntStats;
  try {
    before = await lstat(file, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (!before.isFile()) throw new Error(`queue: not a regular file: ${file}`);
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino)
      throw new Error(`queue: the record changed during the read: ${file}`);
    const source = new TextDecoder('utf-8', { fatal: true }).decode(await handle.readFile());
    return validate(JSON.parse(source));
  } finally {
    await handle.close();
  }
}

export async function writeQueue(common: string, record: QueueRecord): Promise<void> {
  validate(record);
  const previous = await readQueue(common);
  if (previous?.id === record.id && record.revision <= previous.revision)
    throw new Error('queue: the revision must increase');
  const file = pathOf(common);
  const dir = join(file, '..');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = join(dir, `.queue.${randomUUID()}`);
  try {
    await writeFile(temp, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function removeQueue(common: string): Promise<void> {
  if (await readQueue(common)) await rm(pathOf(common));
}

export async function readQueueView(operation: Operation, signal?: AbortSignal): Promise<QueueView> {
  const view: QueueView = {
    record: null,
    owner: null,
    next: null,
    error: null,
    actions: { continue: false, retry: false, reset: false },
  };
  try {
    signal?.throwIfAborted();
    const { main, common } = operation.checkout;
    if (main === null || common === null) throw new Error('queue: need a Git checkout');
    const record = await readQueue(common);
    view.record = record;
    view.owner = (await lockHolder(main, 'queue')) || null;
    if (record === null) return view;
    const n = record.numbers[record.position];
    if (n !== undefined) {
      view.owner ||= (await lockHolder(main, `issue-${n}`)) || null;
      view.next = (await nextIssue(String(n), operation, signal)).next;
    }
    signal?.throwIfAborted();
    const { next, owner } = view;
    const terminal = next?.kind === 'stop' && (next.reason === 'finished' || next.reason === 'wontfix');
    if (next && next.kind !== 'run' && !terminal) view.error = lineOf(String(n), next);
    else if (record.state === 'running' && !owner)
      view.error = 'queue: the runner was interrupted. Use Try again to continue.';
    else if (record.state === 'error') view.error = record.reason;
    if (owner || (next?.kind === 'observed' && next.reason === 'unreadable')) return view;
    view.actions.reset = true;
    if (record.state === 'me-gate' && next?.kind === 'run') view.actions.continue = true;
    if ((record.state === 'error' || record.state === 'running' || record.state === 'me-gate') && terminal)
      view.actions.retry = true;
    if ((record.state === 'error' || record.state === 'running') && next?.kind === 'run') view.actions.retry = true;
    return view;
  } catch (error) {
    view.error = error instanceof Error ? error.message : String(error);
    view.actions = { continue: false, retry: false, reset: false };
    return view;
  }
}
