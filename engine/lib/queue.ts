import { randomUUID } from 'node:crypto';
import { type BigIntStats, closeSync, constants, fstatSync, openSync } from 'node:fs';
import { lstat, mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nextIssue } from '../next-step.ts';
import type { AgentChoice, Host } from './config-core.ts';
import { lineOf, type Next } from './lines.ts';
import { lockHolder } from './locks.ts';
import type { Operation } from './operation.ts';
import { childEnv } from './process.ts';
import type { QueueAction, QueueReceipt, QueueRecord, QueueView } from './queue-types.ts';
import { readRecovery, recoveryOwner } from './quota-recovery.ts';
import { tryFlock } from './update-lock.ts';
import { openLockFile } from './windows.ts';
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
    throw new Error(
      `queue: recorded agent choice is ${recorded.kind === 'default' ? 'the default order' : recorded.host}`,
    );
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
  throw new Error('queue: invalid action');
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

export function parseQueueReceipt(value: unknown): QueueReceipt {
  if (!object(value) || !keys(value, 'view,wake') || !object(value.view)) throw new Error('queue: invalid receipt');
  const view = value.view;
  if (
    !keys(view, 'actions,error,next,owner,record') ||
    !text(view.owner) ||
    !text(view.error) ||
    !nextValue(view.next) ||
    !object(view.actions) ||
    !keys(view.actions, 'add,continue,edit,retry') ||
    Object.values(view.actions).some((item) => typeof item !== 'boolean')
  )
    throw new Error('queue: invalid receipt view');
  const record = view.record === null ? null : validate(view.record);
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
    try {
      return validate(JSON.parse(source));
    } catch {
      throw new Error(
        `queue: invalid or obsolete record: ${file}; preserve this file and follow the manual recovery in ${join(import.meta.dir, '../../docs/celetis-flow.md')}, "The continuous queue"`,
      );
    }
  } finally {
    await handle.close();
  }
}

async function writeQueue(common: string, record: QueueRecord): Promise<void> {
  validate(record);
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

export async function updateQueue(
  common: string,
  change: (record: QueueRecord | null) => Promise<QueueRecord>,
): Promise<QueueRecord> {
  const dir = join(common, 'celetis-flow');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, 'queue-write.lock');
  const fd =
    process.platform === 'win32'
      ? openLockFile(path)
      : openSync(path, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    if (!fstatSync(fd).isFile()) throw new Error(`queue: not a regular lock file: ${path}`);
    const deadline = performance.now() + 5_000;
    while (!tryFlock(fd)) {
      if (performance.now() >= deadline) throw new Error('queue: write lock is busy; refresh and try again');
      await Bun.sleep(50);
    }
    const previous = await readQueue(common);
    const changed = await change(previous);
    if (changed === previous) return changed;
    const next = { ...changed, revision: (previous?.revision ?? 0) + 1 };
    await writeQueue(common, next);
    return next;
  } finally {
    closeSync(fd);
  }
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
    error = 'queue: the runner was interrupted. Use Try again to continue.';
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
    record = await readQueue(common);
    const number = record?.numbers[0];
    const next = number ? (await nextIssue(String(number), operation, signal)).next : null;
    const owner = await queueOwner(main, record);
    signal?.throwIfAborted();
    const latest = await readQueue(common);
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
