import { type BigIntStats, closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import type { AgentChoice, AgentDecision, Host, UsageBlock } from './config-core.ts';
import { type ExitCode, exits } from './contract.ts';
import { HostError } from './errors.ts';
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
} from './state.ts';
import { type ObservedUsage, type UsageAttempt, usageAttempt, usageObject, usageUuid } from './usage-types.ts';

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
const invalid = (path: string, reason: string, code: ExitCode = exits.blocked) =>
  new HostError(`usage: ${path}: ${reason}`, code);
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

function regular(
  path: string,
  stat: BigIntStats,
  reason = 'need a private regular file owned by the current user (mode 0600)',
): void {
  if (!stat.isFile() || stat.nlink !== 1n || !privateStat(stat) || stat.size > 16384n) throw unsafe(path, reason);
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
      throw invalid(path, 'invalid record', exits.usage);
    const current = statAt(path);
    const after = checkFolder(layout.limits);
    if (!current || !after || !sameFile(opened, current) || !sameFile(directory, after))
      throw invalid(path, 'record changed during read', exits.prerequisite);
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
  const layout = repositoryLayout(common);
  return { claude: readHost(layout, 'claude'), codex: readHost(layout, 'codex') };
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
