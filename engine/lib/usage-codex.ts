import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { codexRequest, commonDir, mainCheckout } from './host.ts';
import { privateMode, repositoryState, withLock, writeAtomic } from './state.ts';
import {
  type ObservedUsage,
  type UsageAttempt,
  type UsageObservation,
  unknownUsage,
  usageAttempt,
  usageObject,
} from './usage-types.ts';

type NativeUsage = { turnId: string; observation: UsageObservation };
type SequenceRecord = NativeUsage & { schema: 1; attempt: UsageAttempt; sequence: number };

const seconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const resultOf = (value: unknown) => (usageObject(value) && usageObject(value.result) ? value.result : null);
const turnTime = (id: unknown): number | null =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16)
    : null;

const invalid = () => new Error('usage: invalid or unsafe Codex attempt sequence');
const sameAttempt = (left: UsageAttempt, right: UsageAttempt) =>
  left.id === right.id &&
  left.host === right.host &&
  left.main === right.main &&
  left.startedAt === right.startedAt &&
  left.sessionId === right.sessionId;

function isObservation(value: unknown): value is UsageObservation {
  return (
    usageObject(value) &&
    (value.kind === 'unknown' ||
      value.kind === 'available' ||
      (value.kind === 'blocked' &&
        typeof value.reason === 'string' &&
        (value.resetAt === null ||
          (typeof value.resetAt === 'number' && Number.isSafeInteger(value.resetAt) && value.resetAt > 0))))
  );
}

function sameObservation(left: UsageObservation, right: UsageObservation): boolean {
  return (
    left.kind === right.kind &&
    (left.kind !== 'blocked' ||
      (right.kind === 'blocked' && left.reason === right.reason && left.resetAt === right.resetAt))
  );
}

async function readSequence(file: string, attempt: UsageAttempt): Promise<SequenceRecord | null> {
  const before = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (before === null) return null;
  if (!before.isFile() || !privateMode(before) || before.size > 16384) throw invalid();
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) throw invalid();
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await handle.readFile()));
    if (
      !usageObject(value) ||
      value.schema !== 1 ||
      !usageAttempt(value.attempt) ||
      !sameAttempt(value.attempt, attempt) ||
      typeof value.turnId !== 'string' ||
      turnTime(value.turnId) === null ||
      typeof value.sequence !== 'number' ||
      !Number.isSafeInteger(value.sequence) ||
      value.sequence < 1 ||
      !isObservation(value.observation)
    )
      throw invalid();
    return {
      schema: 1,
      attempt: value.attempt,
      turnId: value.turnId,
      sequence: value.sequence,
      observation: value.observation,
    };
  } finally {
    await handle.close();
  }
}

async function sequenced(attempt: UsageAttempt & { sessionId: string }): Promise<ObservedUsage> {
  if ((await mainCheckout(attempt.main)) !== attempt.main) throw invalid();
  const layout = await repositoryState(await realpath(await commonDir(attempt.main)));
  return withLock(layout.sequenceLock(attempt.id), async () => {
    const file = layout.sequenceState(attempt.id);
    const previous = await readSequence(file, attempt);
    const native = await readNativeUsage(attempt);
    if (!native || !isObservation(native.observation)) return unknownUsage(attempt);
    if (
      previous &&
      previous.turnId !== native.turnId &&
      (turnTime(native.turnId) ?? 0) <= (turnTime(previous.turnId) ?? 0)
    )
      return unknownUsage(attempt);
    const unchanged = previous?.turnId === native.turnId && sameObservation(previous.observation, native.observation);
    const sequence = unchanged ? previous.sequence : (previous?.sequence ?? 0) + 1;
    if (!Number.isSafeInteger(sequence)) throw invalid();
    if (!unchanged) {
      const next: SequenceRecord = { schema: 1, attempt, sequence, ...native };
      await writeAtomic(file, `${JSON.stringify(next)}\n`);
    }
    return { attemptId: attempt.id, sessionId: attempt.sessionId, sequence, observation: native.observation };
  });
}

async function resetAt(attempt: UsageAttempt, thread: Record<string, unknown>): Promise<number | null> {
  if (thread.modelProvider !== 'openai') return null;
  const result = resultOf(await codexRequest(attempt.main, 'account/rateLimits/read', {}));
  if (!result || !usageObject(result.rateLimitsByLimitId)) return null;
  const applicable = Object.values(result.rateLimitsByLimitId).filter(
    (value) =>
      usageObject(value) &&
      (value.limitId === 'codex' || (typeof thread.model === 'string' && value.normalModelSlug === thread.model)),
  );
  if (!applicable.length) return null;
  const resets: number[] = [];
  for (const bucket of applicable) {
    if (!usageObject(bucket) || bucket.spendControlReached === true) return null;
    if (bucket.rateLimitReachedType !== 'rate_limit_reached') {
      if (bucket.rateLimitReachedType !== null) return null;
      continue;
    }
    if (
      !(bucket.primary === null || usageObject(bucket.primary)) ||
      !(bucket.secondary === null || usageObject(bucket.secondary))
    )
      return null;
    let exhausted = false;
    for (const window of [bucket.primary, bucket.secondary]) {
      if (window === null) continue;
      if (typeof window.usedPercent !== 'number' || !Number.isFinite(window.usedPercent)) return null;
      if (window.usedPercent < 100) continue;
      exhausted = true;
      if (!seconds(window.resetsAt)) return null;
      resets.push(window.resetsAt * 1000);
    }
    if (!exhausted) return null;
  }
  return resets.length ? Math.max(...resets) : null;
}

async function readNativeUsage(attempt: UsageAttempt): Promise<NativeUsage | null> {
  const info = resultOf(await codexRequest(attempt.main, 'thread/read', { threadId: attempt.sessionId }));
  const thread = info?.thread;
  if (
    !usageObject(thread) ||
    thread.id !== attempt.sessionId ||
    thread.sessionId !== attempt.sessionId ||
    thread.ephemeral !== false ||
    typeof thread.cwd !== 'string' ||
    (await mainCheckout(thread.cwd)) !== attempt.main
  )
    return null;
  const since = Math.floor(attempt.startedAt / 1000);
  const page = resultOf(
    await codexRequest(attempt.main, 'thread/turns/list', {
      threadId: attempt.sessionId,
      limit: 1,
      sortDirection: 'desc',
      itemsView: 'notLoaded',
    }),
  );
  if (!page || !Array.isArray(page.data) || page.data.length !== 1) return null;
  const latest: unknown = page.data[0];
  if (!usageObject(latest) || typeof latest.id !== 'string' || !seconds(latest.startedAt)) return null;
  const started = turnTime(latest.id);
  if (
    started === null ||
    Math.floor(started / 1000) !== latest.startedAt ||
    started < attempt.startedAt ||
    !seconds(latest.completedAt) ||
    latest.completedAt < since
  )
    return null;
  const observed = { turnId: latest.id };
  if (latest.status === 'completed' && latest.error === null)
    return { ...observed, observation: { kind: 'available' } };
  if (latest.status !== 'failed' || !usageObject(latest.error) || latest.error.codexErrorInfo !== 'usageLimitExceeded')
    return { ...observed, observation: { kind: 'unknown' } };
  return {
    ...observed,
    observation: {
      kind: 'blocked',
      reason: 'Codex usage allowance is exhausted.',
      resetAt: await resetAt(attempt, thread).catch(() => null),
    },
  };
}

export async function readCodexUsage(attempt: UsageAttempt): Promise<ObservedUsage> {
  const unknown = unknownUsage(attempt);
  if (
    !usageAttempt(attempt) ||
    attempt.host !== 'codex' ||
    attempt.sessionId === null ||
    attempt.startedAt > Date.now()
  )
    return unknown;
  try {
    return await sequenced({ ...attempt, sessionId: attempt.sessionId });
  } catch {
    return unknown;
  }
}
