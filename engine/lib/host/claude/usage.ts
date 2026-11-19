import { createHash } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import { lstat, open, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { mainCheckout } from '../../process/git.ts';
import { bunArgs } from '../../process/process.ts';
import { isSessionId } from '../../state/fields.ts';
import { captureFiles, privateMode, withLock, writeAtomic } from '../../state/state.ts';
import {
  type ObservedUsage,
  type UsageAttempt,
  type UsageObservation,
  unknownUsage,
  usageAttempt,
  usageObject,
  usageUuid,
} from '../usage.ts';

type Entry = { key: string; observation: UsageObservation };
type State = { schema: 1; attempt: UsageAttempt; events: Entry[] };
const limit = 16 * 1024 * 1024;
const sameAttempt = (a: UsageAttempt, b: UsageAttempt) =>
  a.id === b.id && a.host === b.host && a.main === b.main && a.startedAt === b.startedAt && a.sessionId === b.sessionId;
const failure = () => new Error('usage-hook: invalid or unsafe attempt capture');

async function directory(path: string): Promise<void> {
  const stat = await lstat(path);
  if (!isAbsolute(path) || !stat.isDirectory() || !privateMode(stat) || (await realpath(path)) !== path)
    throw failure();
}

async function read(path: string): Promise<string | null> {
  let before: Stats;
  try {
    before = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (!before.isFile() || !privateMode(before) || before.size > limit) throw failure();
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = await file.stat();
    if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev) throw failure();
    return new TextDecoder('utf-8', { fatal: true }).decode(await file.readFile());
  } finally {
    await file.close();
  }
}

async function binding(path: string): Promise<UsageAttempt> {
  await directory(path);
  const value: unknown = JSON.parse((await read(captureFiles(path).attempt)) ?? 'null');
  if (
    !usageObject(value) ||
    value.schema !== 1 ||
    !usageAttempt(value.attempt) ||
    value.attempt.host !== 'claude' ||
    !isSessionId('claude', value.attempt.sessionId) ||
    (await realpath(value.attempt.main)) !== value.attempt.main
  )
    throw failure();
  return value.attempt;
}

function observation(value: unknown): value is UsageObservation {
  return (
    usageObject(value) &&
    (value.kind === 'available' ||
      value.kind === 'unknown' ||
      (value.kind === 'blocked' &&
        typeof value.reason === 'string' &&
        value.reason.length > 0 &&
        value.resetAt === null))
  );
}

async function state(path: string, attempt: UsageAttempt): Promise<State> {
  const text = await read(captureFiles(path).events);
  if (text === null) return { schema: 1, attempt, events: [] };
  const value: unknown = JSON.parse(text);
  if (
    !usageObject(value) ||
    value.schema !== 1 ||
    !usageAttempt(value.attempt) ||
    !sameAttempt(attempt, value.attempt) ||
    !Array.isArray(value.events) ||
    !value.events.every(
      (event: unknown) =>
        usageObject(event) &&
        typeof event.key === 'string' &&
        /^[0-9a-f]{64}$/.test(event.key) &&
        observation(event.observation),
    )
  )
    throw failure();
  const events = value.events as Entry[];
  if (new Set(events.map((event) => event.key)).size !== events.length) throw failure();
  return { schema: 1, attempt, events };
}

async function locked<T>(path: string, work: () => Promise<T>): Promise<T> {
  await directory(path);
  return withLock(captureFiles(path).lock, work);
}

async function create(path: string, text: string): Promise<void> {
  const previous = await read(path);
  if (previous !== null) {
    if (previous !== text) throw failure();
    return;
  }
  await writeFile(path, text, { flag: 'wx', mode: 0o600 });
}

export async function prepareClaudeUsage(attempt: UsageAttempt, captureDirectory: string): Promise<string[]> {
  if (
    !usageAttempt(attempt) ||
    attempt.host !== 'claude' ||
    !isSessionId('claude', attempt.sessionId) ||
    (await realpath(attempt.main)) !== attempt.main
  )
    throw failure();
  const files = captureFiles(captureDirectory);
  const settings = files.settings;
  await locked(captureDirectory, async () => {
    await create(files.attempt, `${JSON.stringify({ schema: 1, attempt })}\n`);
    const args = bunArgs(join(import.meta.dir, '../../../usage-hook.ts'), [captureDirectory, attempt.id]);
    const hooks = Object.fromEntries(
      ['Stop', 'StopFailure'].map((event) => [
        event,
        [{ hooks: [{ type: 'command', command: process.execPath, args }] }],
      ]),
    );
    await create(settings, `${JSON.stringify({ hooks })}\n`);
  });
  return ['--session-id', attempt.sessionId, '--settings', settings];
}

function classify(value: Record<string, unknown>): UsageObservation {
  if (
    value.hook_event_name === 'Stop' &&
    value.error === undefined &&
    typeof value.stop_hook_active === 'boolean' &&
    typeof value.last_assistant_message === 'string'
  )
    return { kind: 'available' };
  if (
    value.hook_event_name !== 'StopFailure' ||
    value.error !== 'rate_limit' ||
    typeof value.last_assistant_message !== 'string'
  )
    return { kind: 'unknown' };
  const matched = /^You've hit your (weekly|5-hour) limit · resets [^\r\n]{1,160}$/.exec(value.last_assistant_message);
  if (!matched) return { kind: 'unknown' };
  return { kind: 'blocked', reason: `Claude ${matched[1]} usage allowance is exhausted.`, resetAt: null };
}

export async function receiveClaudeUsage(captureDirectory: string, attemptId: string, value: unknown): Promise<void> {
  const attempt = await binding(captureDirectory);
  if (attempt.id !== attemptId) throw failure();
  if (
    !usageObject(value) ||
    value.session_id !== attempt.sessionId ||
    !usageUuid(value.prompt_id) ||
    typeof value.cwd !== 'string' ||
    value.agent_id !== undefined ||
    (value.hook_event_name !== 'Stop' && value.hook_event_name !== 'StopFailure') ||
    (await mainCheckout(value.cwd).catch(() => null)) !== attempt.main ||
    Date.now() < attempt.startedAt
  )
    return;
  const result = classify(value);
  const key = createHash('sha256')
    .update(JSON.stringify([value.prompt_id, value.hook_event_name, result]))
    .digest('hex');
  await locked(captureDirectory, async () => {
    if (!sameAttempt(attempt, await binding(captureDirectory))) throw failure();
    const previous = await state(captureDirectory, attempt);
    if (previous.events.some((event) => event.key === key)) return;
    const next: State = { schema: 1, attempt, events: [...previous.events, { key, observation: result }] };
    await writeAtomic(captureFiles(captureDirectory).events, `${JSON.stringify(next)}\n`);
  });
}

export async function readClaudeUsage(attempt: UsageAttempt, captureDirectory: string): Promise<ObservedUsage> {
  const unknown = unknownUsage(attempt);
  if (!usageAttempt(attempt) || attempt.host !== 'claude' || attempt.sessionId === null) return unknown;
  try {
    if (!sameAttempt(attempt, await binding(captureDirectory))) return unknown;
    const record = await state(captureDirectory, attempt);
    const latest = record.events.at(-1);
    if (!latest) return unknown;
    return {
      attemptId: attempt.id,
      sessionId: attempt.sessionId,
      sequence: record.events.length,
      observation: latest.observation,
    };
  } catch {
    return unknown;
  }
}
