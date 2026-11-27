import { readdir, readFile, rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import type { Host } from '../config/core.ts';
import { hosts } from '../host/names.ts';
import { type UsageAttempt, usageAttempt } from '../host/usage.ts';
import { agentChoice, run } from '../queue/types.ts';
import { isSessionId } from '../state/fields.ts';
import { issueLock } from '../state/locks.ts';
import { commitMigration, type LocalRecord, readLocalRecord } from '../state/migration.ts';
import { code, count, filled, identity, issueKey, members, uuidText } from '../state/schemas.ts';
import { writeAtomic } from '../state/state.ts';
import { isSafeId } from '../terminal/terminal.ts';
import { type IssueKey, parseKey } from '../tracker/key.ts';
import { levels, models } from '../workflow/effort.ts';
import { sessionWorks, steps } from '../workflow/workflow.ts';
import type { RunState } from './engine.ts';
import { convertSession, matchesSession, sessionRecord, sessionRecord2 } from './session.ts';

type Schema = 2 | 3;
export type ReadRecord = { path: string; record: RunRecord } | { path: string; error: string };

const file = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.json$/;
const runStates: Record<RunState, true> = {
  starting: true,
  running: true,
  checking: true,
  waiting: true,
  exiting: true,
  'quota-wait': true,
  stopping: true,
  ending: true,
  'taken-over': true,
  finished: true,
};

const host = z.enum(hosts);
const step = z.enum(steps);
const flag = z.boolean();
const keyFor = (value: unknown): IssueKey | null => (count.safeParse(value).success ? parseKey(String(value)) : null);
const legacyKey = z.custom<number>((value) => keyFor(value) !== null);

const selection = z.strictObject({
  explicit: z.string().optional(),
  environment: z.string().optional(),
  saved: host.optional(),
});
const inputKinds = <N extends z.ZodType, E extends z.ZodRawShape>(number: N, extra: E) =>
  [
    z.strictObject({ kind: z.literal('number'), number, selection, ...extra }),
    z.strictObject({ kind: z.literal('auto'), number, selection }),
    z.strictObject({ kind: z.literal('queue'), id: uuidText, token: uuidText, selection }),
    z.strictObject({ kind: z.literal('resume'), number, selection }),
  ] as const;
const effort = z.enum(levels).nullable();
const model = z.enum(models).nullable();
const input = z.discriminatedUnion('kind', [
  ...inputKinds(issueKey, { effort, model }),
  z.strictObject({ kind: z.literal('assist'), number: issueKey, selection }),
]);

const authority = z.strictObject({ plan: filled.nullable(), spec: z.string().nullable(), step });
const attempt = z
  .strictObject({ host, id: uuidText, sessionId: z.string().nullable(), startedAt: count })
  .refine((each) => each.sessionId === null || isSessionId(each.host, each.sessionId));
const ticket = z.strictObject({ attempt: z.custom<UsageAttempt>(usageAttempt), ordinal: count });
const barrier = z.strictObject({ pid: count, shell: count.nullable(), start: filled, tty: filled.nullable() });
const loop = z.strictObject({
  attempted: z.array(host),
  exitCode: code.nullable(),
  finished: filled.nullable(),
  first: z.enum(['any', 'gated']),
  last: run.nullable(),
  lastHost: host,
  retryBlocked: flag,
  retrying: flag,
  started: flag,
});
const seenEach = z.strictObject({ ordinal: code, sequence: code }).nullable();
const seenKeys = [...hosts].sort().join(',');
const wait = z.strictObject({
  authority,
  choice: agentChoice,
  seen: z.strictObject(Object.fromEntries(hosts.map((each) => [each, seenEach])) as Record<Host, typeof seenEach>),
  waitId: uuidText,
});
const sessionOf = <R extends z.ZodType>(record: R) =>
  z.strictObject({
    announced: z.string(),
    authority: authority.nullable(),
    barrier: barrier.nullable(),
    capture: filled.nullable(),
    choice: agentChoice.nullable(),
    folder: filled.refine(isAbsolute),
    host,
    next: run.nullable(),
    owned: attempt,
    record: record.nullable(),
    startedMs: count.nullable(),
    step: z.enum(sessionWorks),
    tab: filled,
    terminal: filled.nullable(),
    ticket: ticket.nullable(),
  });

type Facts<R> = {
  step: string;
  record: R | null;
  next: unknown;
  authority: unknown;
  choice: unknown;
  ticket: unknown;
  capture: unknown;
  barrier: unknown;
  startedMs: unknown;
};
type Related<I, R> = {
  issue: I | null;
  lock: string | null;
  queue: unknown;
  input: { kind: string; number?: unknown };
  session: Facts<R> | null;
};

function sessionHolds<R>(session: Facts<R>, kind: string, recordHolds: (record: R) => boolean): boolean {
  const bare = [session.next, session.authority, session.choice, session.ticket, session.capture].every(
    (each) => each === null,
  );
  if ((session.barrier === null) !== (session.startedMs === null)) return false;
  if (kind === 'assist') return session.step === 'assist' && session.record === null && bare;
  if (session.step === 'assist' || session.record === null || !recordHolds(session.record)) return false;
  if (kind === 'resume') return bare;
  return (
    session.next !== null &&
    session.authority !== null &&
    session.choice !== null &&
    session.capture !== null &&
    (session.ticket !== null || session.barrier === null)
  );
}

const related =
  <I, R>(issueOf: (issue: I) => IssueKey | null, recordHolds: (record: R, issue: IssueKey) => boolean) =>
  (record: Related<I, R>): boolean => {
    const issue = record.issue === null ? null : issueOf(record.issue);
    const queued = record.input.kind === 'queue';
    return (
      (queued
        ? record.lock === null || (issue !== null && record.lock === issueLock(issue))
        : issue !== null && record.issue === record.input.number && record.lock === issueLock(issue)) &&
      (record.queue !== null) === queued &&
      (record.session === null ||
        (issue !== null && sessionHolds(record.session, record.input.kind, (each) => recordHolds(each, issue))))
    );
  };

const runBase = z.strictObject({
  schema: z.literal(5),
  id: uuidText,
  daemon: identity,
  input,
  issue: issueKey.nullable(),
  lock: z.string().nullable(),
  queue: z.strictObject({ id: uuidText }).nullable(),
  request: z.strictObject({ retry: flag, step: step.nullable() }).nullable(),
  loop,
  wait: wait.nullable(),
  session: sessionOf(sessionRecord).nullable(),
  state: members(runStates),
  changedMs: count,
  stop: z.strictObject({ at: code, terminal: z.custom<string>(isSafeId) }).optional(),
});

export const runRecord = runBase.refine(
  related<IssueKey, z.output<typeof sessionRecord>>(
    (issue) => issue,
    (record, issue) => matchesSession(record, record.checkout, issue),
  ),
);
export type RunRecord = z.output<typeof runRecord>;

const convertible = (record: z.output<typeof sessionRecord2>, issue: IssueKey) => {
  try {
    convertSession(record, record.checkout, issue, 'run record');
    return true;
  } catch {
    return false;
  }
};
const legacyOf = (schema: Schema, input: z.ZodType<{ kind: string; number?: unknown }>) =>
  runBase
    .extend({
      schema: z.literal(schema),
      input,
      issue: legacyKey.nullable(),
      session: sessionOf(sessionRecord2).nullable(),
    })
    .refine(related(keyFor, convertible));
const legacy = {
  2: legacyOf(2, z.discriminatedUnion('kind', inputKinds(legacyKey, { effort }))),
  3: legacyOf(3, z.discriminatedUnion('kind', inputKinds(legacyKey, { effort, model }))),
};

const versioned = z.looseObject({ schema: z.unknown().optional() });
const versionOf = (value: unknown) => {
  const parsed = versioned.safeParse(value);
  return parsed.success ? parsed.data.schema : undefined;
};
const plain = z.custom<Record<string, unknown>>(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
);
const olderWait = z.looseObject({ wait: z.looseObject({ seen: plain }) });

export function validRunRecord(value: unknown): value is RunRecord {
  return runRecord.safeParse(value).success;
}

export async function writeRunRecord(folder: string, record: RunRecord): Promise<void> {
  if (!runRecord.safeParse(record).success) throw new Error(`run record ${record.id}: not valid`);
  await writeAtomic(join(folder, `${record.id}.json`), `${JSON.stringify(record)}\n`);
}

export async function removeRunRecord(folder: string, id: string): Promise<void> {
  await rm(join(folder, `${id}.json`), { force: true });
}

function keyed(value: unknown, schema: Schema): unknown {
  const old = value as Record<string, unknown> & {
    input: Record<string, unknown>;
    session: (Record<string, unknown> & { record: Record<string, unknown> }) | null;
  };
  const issue = keyFor(old.issue);
  const input = {
    ...old.input,
    ...('number' in old.input ? { number: keyFor(old.input.number) } : {}),
    ...(old.input.kind === 'number' && schema === 2 ? { model: null } : {}),
  };
  const session =
    old.session === null || issue === null
      ? old.session
      : {
          ...old.session,
          record: convertSession(old.session.record, String(old.session.record.checkout), issue, 'run record'),
        };
  return { ...old, schema: 5, input, issue, session };
}

async function convert(path: string, name: string, folder: string): Promise<ReadRecord> {
  let source: LocalRecord | null;
  try {
    source = await readLocalRecord(path, [folder], 'private');
  } catch (error) {
    return { path, error: (error as Error).message };
  }
  if (!source) return { path, error: 'the record is missing' };
  const schema = versionOf(source.value);
  if (schema !== 2 && schema !== 3) return { path, error: 'the record is not a valid run record' };
  const old = legacy[schema].safeParse(source.value);
  if (!old.success) return { path, error: 'the record is not a valid run record' };
  if (`${old.data.id}.json` !== name) return { path, error: 'the record ID differs from its file name' };
  const record = keyed(source.value, schema);
  if (!validRunRecord(record)) return { path, error: 'the record is not a valid run record' };
  try {
    await commitMigration(source, schema, `${JSON.stringify(record)}\n`);
  } catch (error) {
    return { path, error: (error as Error).message };
  }
  return { path, record };
}

export async function readRunRecords(folder: string): Promise<ReadRecord[]> {
  const names = (await readdir(folder)).filter((name) => file.test(name)).sort();
  return Promise.all(
    names.map(async (name): Promise<ReadRecord> => {
      const path = join(folder, name);
      let source: string;
      try {
        source = await readFile(path, 'utf8');
      } catch (error) {
        return { path, error: (error as Error).message };
      }
      let value: unknown;
      try {
        value = JSON.parse(source);
      } catch {
        return { path, error: 'the record is not valid JSON' };
      }
      const older = olderWait.safeParse(value);
      if (older.success && Object.keys(older.data.wait.seen).sort().join(',') !== seenKeys)
        return { path, error: 'the record keeps the quota wait of an older engine; start the run again' };
      const schema = versionOf(value);
      if (schema === 2 || schema === 3) return convert(path, name, folder);
      if (schema !== 5) return { path, error: 'the record has another schema' };
      if (!validRunRecord(value)) return { path, error: 'the record is not a valid run record' };
      if (`${value.id}.json` !== name) return { path, error: 'the record ID differs from its file name' };
      return { path, record: value };
    }),
  );
}
