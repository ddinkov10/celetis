import { type BigIntStats, closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import type { AgentChoice, AgentDecision, Host, UsageBlock } from '../config/core.ts';
import { type ExitCode, exits } from '../contract/contract.ts';
import { hosts } from '../host/names.ts';
import { type ObservedUsage, type UsageAttempt, usageAttempt } from '../host/usage.ts';
import { isSessionId } from '../state/fields.ts';
import { code, count, filledWithin } from '../state/schemas.ts';
import {
  checkFolder,
  ensureFolder,
  lockReason,
  privateMode,
  type RepositoryLayout,
  repositoryLayout,
  unsafe,
  withLock,
  writeAtomic,
} from '../state/state.ts';

export type UsageTicket = { attempt: UsageAttempt; ordinal: number };
const usageBlock = z.strictObject({ reason: filledWithin(4096), resetAt: count.nullable() });
const usageRecord = z
  .strictObject({
    schema: z.literal(1),
    nextOrdinal: count,
    ordinal: code,
    attemptId: filledWithin(128).nullable(),
    sequence: code,
    block: usageBlock.nullable(),
  })
  .refine(
    (record) =>
      record.ordinal < record.nextOrdinal &&
      (record.ordinal === 0
        ? record.attemptId === null && record.sequence === 0 && record.block === null
        : record.attemptId !== null && record.sequence > 0),
  );
type UsageRecord = Readonly<z.output<typeof usageRecord>>;
export type UsageState = Readonly<Record<Host, UsageRecord | null>>;
const invalid = (path: string, reason: string, code: ExitCode = exits.blocked) =>
  new HostError(`usage: ${path}: ${reason}`, code);
const sameFile = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino;
const privateStat = (stat: BigIntStats) => privateMode({ uid: Number(stat.uid), mode: Number(stat.mode) });
const empty = (): UsageRecord => ({ schema: 1, nextOrdinal: 1, ordinal: 0, attemptId: null, sequence: 0, block: null });

function statAt(path: string): BigIntStats | null {
  try {
    return lstatSync(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function regular(
  path: string,
  stat: BigIntStats,
  reason = 'need a private regular file owned by the current user (mode 0600)',
): void {
  if (!stat.isFile() || stat.nlink !== 1n || !privateStat(stat) || stat.size > 16384n) throw unsafe(path, reason);
}

function readHost(layout: RepositoryLayout, host: Host): UsageRecord | null {
  if (!checkFolder(layout.root)) return null;
  const directory = checkFolder(layout.limits);
  if (!directory) return null;
  const path = layout.limit(host);
  const before = statAt(path);
  if (!before) return null;
  regular(path, before);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd, { bigint: true });
    regular(path, opened);
    if (!sameFile(before, opened)) throw invalid(path, 'record changed during read', exits.prerequisite);
    const source = readFileSync(fd);
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(source));
    } catch (error) {
      throw invalid(path, error instanceof Error ? error.message : String(error), exits.usage);
    }
    const record = usageRecord.safeParse(value);
    if (!record.success) throw invalid(path, 'invalid record', exits.usage);
    const current = statAt(path);
    const after = checkFolder(layout.limits);
    if (!current || !after || !sameFile(opened, current) || !sameFile(directory, after))
      throw invalid(path, 'record changed during read', exits.prerequisite);
    return { ...record.data, block: (value as { block: UsageRecord['block'] }).block };
  } finally {
    closeSync(fd);
  }
}

export async function readUsage(common: string): Promise<UsageState> {
  const layout = repositoryLayout(common);
  return Object.fromEntries(hosts.map((host) => [host, readHost(layout, host)])) as UsageState;
}

async function update<T>(
  common: string,
  host: Host,
  work: (previous: UsageRecord) => { next: UsageRecord; result: T },
): Promise<T> {
  const layout = repositoryLayout(common);
  ensureFolder(layout.root);
  const directory = ensureFolder(layout.limits);
  const limitLock = layout.limitLock(host);
  const lock = limitLock.path;
  const before = statAt(lock);
  if (before) regular(lock, before, lockReason);
  let opened: BigIntStats | undefined;
  const stable = () => {
    const current = statAt(lock);
    const currentDirectory = checkFolder(layout.limits);
    if (
      !opened ||
      !current ||
      !currentDirectory ||
      !sameFile(opened, current) ||
      !sameFile(directory, currentDirectory)
    )
      throw invalid(lock, 'directory or lock changed', exits.prerequisite);
    regular(lock, current, lockReason);
  };
  const check = (stage: 'opened' | 'locked', file: BigIntStats) => {
    if (stage === 'locked') return stable();
    regular(lock, file, lockReason);
    if (before && !sameFile(before, file)) throw invalid(lock, 'lock changed during open', exits.prerequisite);
    opened = file;
  };
  return withLock(
    limitLock,
    async () => {
      const previous = readHost(layout, host) ?? empty();
      const { next, result } = work(previous);
      if (next === previous) return result;
      const path = layout.limit(host);
      const original = statAt(path);
      await writeAtomic(path, `${JSON.stringify(next)}\n`, {
        check: () => {
          stable();
          const current = statAt(path);
          if (original ? !current || !sameFile(original, current) : current !== null)
            throw invalid(path, 'record changed during write', exits.prerequisite);
          if (JSON.stringify(readHost(layout, host) ?? empty()) !== JSON.stringify(previous))
            throw invalid(path, 'content changed during write', exits.prerequisite);
        },
      });
      return result;
    },
    { check },
  );
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
    !count.safeParse(ordinal).success ||
    observed.attemptId !== attempt.id ||
    !code.safeParse(observed.sequence).success ||
    !(
      observed.observation.kind === 'unknown' ||
      observed.observation.kind === 'available' ||
      (observed.observation.kind === 'blocked' &&
        usageBlock.safeParse({ reason: observed.observation.reason, resetAt: observed.observation.resetAt }).success)
    ) ||
    (observed.sessionId !== null &&
      (!isSessionId(attempt.host, observed.sessionId) || observed.sessionId !== attempt.sessionId)) ||
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
