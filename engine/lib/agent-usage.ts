import { randomUUID } from 'node:crypto';
import { type BigIntStats, closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentChoice, AgentDecision, Host, UsageBlock } from './config-core.ts';
import { privateFolderSync, privateMode, sharedFolderSync, sharedMode } from './private-folder.ts';
import { stateFolder } from './state-folder.ts';
import { tryFlock } from './update-lock.ts';
import { type ObservedUsage, type UsageAttempt, usageAttempt, usageObject, usageUuid } from './usage-types.ts';
import { openLockFile } from './windows.ts';

export type UsageTicket = { attempt: UsageAttempt; ordinal: number };
type UsageRecord = Readonly<{
  schema: 1;
  nextOrdinal: number;
  ordinal: number;
  attemptId: string | null;
  sequence: number;
  block: UsageBlock | null;
}>;
export type UsageState = Readonly<Record<Host, UsageRecord | null>>;
const invalid = (path: string, reason: string) => new Error(`usage: ${path}: ${reason}`);
const sameFile = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino;
const privateStat = (stat: BigIntStats) => privateMode({ uid: Number(stat.uid), mode: Number(stat.mode) });
const natural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const empty = (): UsageRecord => ({ schema: 1, nextOrdinal: 1, ordinal: 0, attemptId: null, sequence: 0, block: null });

function statAt(path: string): BigIntStats | null {
  try {
    return lstatSync(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function folder(path: string): BigIntStats | null {
  const stat = statAt(path);
  if (stat && (!stat.isDirectory() || !privateStat(stat))) throw invalid(path, 'need a private directory');
  return stat;
}

function sharedFolder(path: string): BigIntStats | null {
  const stat = statAt(path);
  if (stat && (!stat.isDirectory() || !sharedMode({ uid: Number(stat.uid), mode: Number(stat.mode) })))
    throw invalid(path, 'need a directory owned by the current user with no group or other write access');
  return stat;
}

function regular(path: string, stat: BigIntStats): void {
  if (!stat.isFile() || stat.nlink !== 1n || !privateStat(stat) || stat.size > 16384n)
    throw invalid(path, 'need a private regular file');
}

function block(value: unknown): value is UsageBlock {
  return (
    usageObject(value) &&
    Object.keys(value).sort().join(',') === 'reason,resetAt' &&
    typeof value.reason === 'string' &&
    value.reason.length > 0 &&
    value.reason.length <= 4096 &&
    (value.resetAt === null || (natural(value.resetAt) && value.resetAt > 0))
  );
}

function readHost(state: string, host: Host): UsageRecord | null {
  if (!sharedFolder(state)) return null;
  const dir = join(state, 'limits');
  const directory = folder(dir);
  if (!directory) return null;
  const path = join(dir, `${host}.json`);
  const before = statAt(path);
  if (!before) return null;
  regular(path, before);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd, { bigint: true });
    regular(path, opened);
    if (!sameFile(before, opened)) throw invalid(path, 'record changed during read');
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(fd)));
    if (
      !usageObject(value) ||
      Object.keys(value).sort().join(',') !== 'attemptId,block,nextOrdinal,ordinal,schema,sequence' ||
      value.schema !== 1 ||
      !natural(value.nextOrdinal) ||
      value.nextOrdinal < 1 ||
      !natural(value.ordinal) ||
      value.ordinal >= value.nextOrdinal ||
      !natural(value.sequence) ||
      !(value.block === null || block(value.block)) ||
      !(value.ordinal === 0
        ? value.attemptId === null && value.sequence === 0 && value.block === null
        : typeof value.attemptId === 'string' &&
          value.attemptId.length > 0 &&
          value.attemptId.length <= 128 &&
          value.sequence > 0)
    )
      throw invalid(path, 'invalid record');
    const current = statAt(path);
    const after = folder(dir);
    if (!current || !after || !sameFile(opened, current) || !sameFile(directory, after))
      throw invalid(path, 'record changed during read');
    return {
      schema: 1,
      nextOrdinal: value.nextOrdinal,
      ordinal: value.ordinal,
      attemptId: value.attemptId as string | null,
      sequence: value.sequence,
      block: value.block,
    };
  } finally {
    closeSync(fd);
  }
}

export async function readUsage(common: string): Promise<UsageState> {
  const state = await stateFolder(common);
  return { claude: readHost(state, 'claude'), codex: readHost(state, 'codex') };
}

async function update<T>(
  common: string,
  host: Host,
  work: (previous: UsageRecord) => { next: UsageRecord; result: T },
): Promise<T> {
  const state = await stateFolder(common);
  sharedFolderSync(state, invalid);
  const dir = join(state, 'limits');
  privateFolderSync(dir, invalid);
  const directory = folder(dir) as BigIntStats;
  const lock = join(dir, `${host}.lock`);
  const before = statAt(lock);
  if (before) regular(lock, before);
  const fd =
    process.platform === 'win32'
      ? openLockFile(lock)
      : openSync(lock, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    const opened = fstatSync(fd, { bigint: true });
    regular(lock, opened);
    if (before && !sameFile(before, opened)) throw invalid(lock, 'lock changed during open');
    const stable = () => {
      const current = statAt(lock);
      const currentDirectory = folder(dir);
      if (!current || !currentDirectory || !sameFile(opened, current) || !sameFile(directory, currentDirectory))
        throw invalid(lock, 'directory or lock changed');
      regular(lock, current);
    };
    const deadline = performance.now() + 5000;
    while (!tryFlock(fd)) {
      if (performance.now() >= deadline) throw invalid(lock, 'write lock is busy');
      await Bun.sleep(25);
    }
    stable();
    const previous = readHost(state, host) ?? empty();
    const { next, result } = work(previous);
    if (next === previous) return result;
    const path = join(dir, `${host}.json`);
    const original = statAt(path);
    const temp = join(dir, `.${host}.${randomUUID()}`);
    try {
      await writeFile(temp, `${JSON.stringify(next)}\n`, { mode: 0o600, flag: 'wx' });
      stable();
      const current = statAt(path);
      if (original ? !current || !sameFile(original, current) : current !== null)
        throw invalid(path, 'record changed during write');
      if (JSON.stringify(readHost(state, host) ?? empty()) !== JSON.stringify(previous))
        throw invalid(path, 'content changed during write');
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true });
    }
    return result;
  } finally {
    closeSync(fd);
  }
}

export async function beginUsageAttempt(common: string, attempt: UsageAttempt): Promise<UsageTicket> {
  if (!usageAttempt(attempt)) throw new Error('usage: invalid attempt');
  return update(common, attempt.host, (previous) => {
    if (!Number.isSafeInteger(previous.nextOrdinal + 1)) throw new Error('usage: attempt number exhausted');
    return {
      next: { ...previous, nextOrdinal: previous.nextOrdinal + 1 },
      result: { attempt: { ...attempt }, ordinal: previous.nextOrdinal },
    };
  });
}

export async function recordUsage(
  common: string,
  ticket: UsageTicket,
  observed: ObservedUsage,
): Promise<'saved' | 'stale'> {
  const { attempt, ordinal } = ticket;
  if (
    !usageAttempt(attempt) ||
    !natural(ordinal) ||
    ordinal < 1 ||
    observed.attemptId !== attempt.id ||
    !natural(observed.sequence) ||
    !(
      observed.observation.kind === 'unknown' ||
      observed.observation.kind === 'available' ||
      (observed.observation.kind === 'blocked' &&
        block({ reason: observed.observation.reason, resetAt: observed.observation.resetAt }))
    ) ||
    (observed.sessionId !== null && (!usageUuid(observed.sessionId) || observed.sessionId !== attempt.sessionId)) ||
    (observed.observation.kind !== 'unknown' &&
      (attempt.sessionId === null || observed.sessionId !== attempt.sessionId))
  )
    throw new Error('usage: observation does not match its attempt');
  return update(common, attempt.host, (previous) => {
    if (ordinal >= previous.nextOrdinal) throw new Error('usage: attempt was not allocated');
    if (
      ordinal < previous.ordinal ||
      (ordinal === previous.ordinal && (attempt.id !== previous.attemptId || observed.sequence <= previous.sequence)) ||
      observed.sequence === 0
    )
      return { next: previous, result: 'stale' as const };
    const nextBlock =
      observed.observation.kind === 'blocked'
        ? { reason: observed.observation.reason, resetAt: observed.observation.resetAt }
        : observed.observation.kind === 'available'
          ? null
          : previous.block;
    return {
      next: { ...previous, ordinal, attemptId: attempt.id, sequence: observed.sequence, block: nextBlock },
      result: 'saved' as const,
    };
  });
}

export function activeBlock(usage: UsageState, host: Host, now: number): UsageBlock | null {
  const block = usage[host]?.block ?? null;
  return block && (block.resetAt === null || block.resetAt > now) ? block : null;
}

export function selectAgent(
  choice: AgentChoice,
  order: readonly Host[],
  usage: UsageState,
  now: number,
  attempted: ReadonlySet<Host>,
  retryBlocked: boolean,
): AgentDecision {
  if (choice.kind === 'explicit') return { kind: 'start', host: choice.host };
  for (const host of order)
    if (!attempted.has(host) && (retryBlocked || !activeBlock(usage, host, now))) return { kind: 'start', host };
  const blocked = order.flatMap((host) => {
    const value = usage[host]?.block;
    return value ? [{ host, ...value }] : [];
  });
  const deadlines = blocked.flatMap((value) => (value.resetAt !== null && value.resetAt > now ? [value.resetAt] : []));
  return { kind: 'wait', blocked, nextResetAt: deadlines.length ? Math.min(...deadlines) : null };
}
