import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { z } from 'zod';
import { commonDir, mainCheckout } from '../../process/git.ts';
import { count } from '../../state/schemas.ts';
import { privateMode, repositoryLayout, withLock, writeAtomic } from '../../state/state.ts';
import {
  type ObservedUsage,
  type UsageAttempt,
  type UsageObservation,
  unknownUsage,
  usageAttempt,
  usageAttemptSchema,
  usageObservation,
} from '../usage.ts';
import { codexRequest } from './app-server.ts';

type NativeUsage = { turnId: string; observation: UsageObservation };

const turnTime = (id: unknown): number | null =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16)
    : null;

const turnId = z.string().refine((id) => turnTime(id) !== null);
const sequenceRecord = z.looseObject({
  schema: z.literal(1),
  attempt: usageAttemptSchema,
  turnId,
  sequence: count,
  observation: usageObservation,
});
type SequenceRecord = z.infer<typeof sequenceRecord>;
const threadReply = z.looseObject({
  result: z.looseObject({
    thread: z.looseObject({
      id: z.string(),
      sessionId: z.string(),
      ephemeral: z.literal(false),
      cwd: z.string(),
      modelProvider: z.unknown().optional(),
      model: z.unknown().optional(),
    }),
  }),
});
type Thread = z.infer<typeof threadReply>['result']['thread'];
const turnsReply = z.looseObject({ result: z.looseObject({ data: z.array(z.unknown()).length(1) }) });
const turnSchema = z.looseObject({
  id: z.string(),
  startedAt: count,
  completedAt: count,
  status: z.unknown().optional(),
  error: z.unknown().optional(),
});
const usageLimitError = z.looseObject({ codexErrorInfo: z.literal('usageLimitExceeded') });
const limitsReply = z.looseObject({ result: z.looseObject({ rateLimitsByLimitId: z.looseObject({}) }) });
const bucketHead = z.looseObject({
  limitId: z.unknown().optional(),
  normalModelSlug: z.unknown().optional(),
  spendControlReached: z.unknown().optional(),
  rateLimitReachedType: z.unknown().optional(),
});
const rateWindow = z.looseObject({ usedPercent: z.number(), resetsAt: z.unknown().optional() });
const reachedBucket = z.looseObject({ primary: rateWindow.nullable(), secondary: rateWindow.nullable() });

const invalid = () => new Error('usage: invalid or unsafe Codex attempt sequence');
const sameAttempt = (left: UsageAttempt, right: UsageAttempt) =>
  left.id === right.id &&
  left.host === right.host &&
  left.main === right.main &&
  left.startedAt === right.startedAt &&
  left.sessionId === right.sessionId;

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
    const record = sequenceRecord.safeParse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await handle.readFile())),
    );
    if (!record.success || !sameAttempt(record.data.attempt, attempt)) throw invalid();
    return record.data;
  } finally {
    await handle.close();
  }
}

async function sequenced(attempt: UsageAttempt & { sessionId: string }): Promise<ObservedUsage> {
  if ((await mainCheckout(attempt.main)) !== attempt.main) throw invalid();
  const layout = repositoryLayout(await realpath(await commonDir(attempt.main)));
  return withLock(layout.sequenceLock(attempt.id), async () => {
    const file = layout.sequenceState(attempt.id);
    const previous = await readSequence(file, attempt);
    const native = await readNativeUsage(attempt);
    if (!native || !usageObservation.safeParse(native.observation).success) return unknownUsage(attempt);
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

async function resetAt(attempt: UsageAttempt, thread: Thread): Promise<number | null> {
  if (thread.modelProvider !== 'openai') return null;
  const limits = limitsReply.safeParse(await codexRequest(attempt.main, 'account/rateLimits/read', {}));
  if (!limits.success) return null;
  const applicable = Object.values(limits.data.result.rateLimitsByLimitId).flatMap((value) => {
    const head = bucketHead.safeParse(value);
    return head.success &&
      (head.data.limitId === 'codex' ||
        (typeof thread.model === 'string' && head.data.normalModelSlug === thread.model))
      ? [head.data]
      : [];
  });
  if (!applicable.length) return null;
  const resets: number[] = [];
  for (const head of applicable) {
    if (head.spendControlReached === true) return null;
    if (head.rateLimitReachedType !== 'rate_limit_reached') {
      if (head.rateLimitReachedType !== null) return null;
      continue;
    }
    const bucket = reachedBucket.safeParse(head);
    if (!bucket.success) return null;
    let exhausted = false;
    for (const window of [bucket.data.primary, bucket.data.secondary]) {
      if (window === null || window.usedPercent < 100) continue;
      exhausted = true;
      const reset = count.safeParse(window.resetsAt);
      if (!reset.success) return null;
      resets.push(reset.data * 1000);
    }
    if (!exhausted) return null;
  }
  return resets.length ? Math.max(...resets) : null;
}

async function readNativeUsage(attempt: UsageAttempt): Promise<NativeUsage | null> {
  const info = threadReply.safeParse(await codexRequest(attempt.main, 'thread/read', { threadId: attempt.sessionId }));
  if (!info.success) return null;
  const thread = info.data.result.thread;
  if (
    thread.id !== attempt.sessionId ||
    thread.sessionId !== attempt.sessionId ||
    (await mainCheckout(thread.cwd)) !== attempt.main
  )
    return null;
  const since = Math.floor(attempt.startedAt / 1000);
  const page = turnsReply.safeParse(
    await codexRequest(attempt.main, 'thread/turns/list', {
      threadId: attempt.sessionId,
      limit: 1,
      sortDirection: 'desc',
      itemsView: 'notLoaded',
    }),
  );
  if (!page.success) return null;
  const parsed = turnSchema.safeParse(page.data.result.data[0]);
  if (!parsed.success) return null;
  const latest = parsed.data;
  const started = turnTime(latest.id);
  if (
    started === null ||
    Math.floor(started / 1000) !== latest.startedAt ||
    started < attempt.startedAt ||
    latest.completedAt < since
  )
    return null;
  const observed = { turnId: latest.id };
  if (latest.status === 'completed' && latest.error === null)
    return { ...observed, observation: { kind: 'available' } };
  if (latest.status !== 'failed' || !usageLimitError.safeParse(latest.error).success)
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
