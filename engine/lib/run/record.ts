import { readdir, readFile, rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { UsageTicket } from '../agent/usage.ts';
import type { AgentChoice, Host } from '../config/core.ts';
import { hosts, isHost } from '../host/names.ts';
import { usageAttempt } from '../host/usage.ts';
import { isSessionId, uuid } from '../state/fields.ts';
import { type Identity, issueLock } from '../state/locks.ts';
import { commitMigration, type LocalRecord, readLocalRecord } from '../state/migration.ts';
import { writeAtomic } from '../state/state.ts';
import { isSafeId } from '../terminal/terminal.ts';
import { type IssueKey, isKey, parseKey } from '../tracker/key.ts';
import { isLevel, isModel } from '../workflow/effort.ts';
import { lanes, type Run, type SessionWork, type Step, steps } from '../workflow/workflow.ts';
import type { RunInput, RunState } from './engine.ts';
import type { RecoveryAttempt, RecoveryAuthority } from './quota-recovery.ts';
import { convertSession, type SessionRecord, validateSession } from './session.ts';

export type RunRecord = {
  schema: 5;
  id: string;
  daemon: Identity;
  input: RunInput;
  issue: IssueKey | null;
  lock: string | null;
  queue: { id: string } | null;
  request: { step: Step | null; retry: boolean } | null;
  loop: {
    first: 'any' | 'gated';
    last: Run | null;
    lastHost: Host;
    exitCode: number | null;
    started: boolean;
    attempted: Host[];
    retrying: boolean;
    retryBlocked: boolean;
    finished: string | null;
  };
  wait: {
    waitId: string;
    authority: RecoveryAuthority;
    choice: AgentChoice;
    seen: Record<Host, { ordinal: number; sequence: number } | null>;
  } | null;
  session: {
    step: SessionWork;
    host: Host;
    next: Run | null;
    authority: RecoveryAuthority | null;
    choice: AgentChoice | null;
    record: SessionRecord | null;
    announced: string;
    ticket: UsageTicket | null;
    capture: string | null;
    owned: RecoveryAttempt | null;
    folder: string;
    terminal: string | null;
    tab: string;
    barrier: { pid: number; start: string; shell: number | null; tty: string | null } | null;
    startedMs: number | null;
  } | null;
  state: RunState;
  changedMs: number;
  stop?: { terminal: string; at: number };
};
type Schema = 2 | 3 | 5;
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
const issueStates = ['unrouted', 'unspecified', 'undiagnosed', 'chore', 'hotfix', 'defined', 'planned', 'built'];

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: unknown, names: string): value is Record<string, unknown> =>
  object(value) && Object.keys(value).sort().join(',') === names;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const filled = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const id = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const step = (value: unknown): value is Step => (steps as readonly unknown[]).includes(value);
const flag = (value: unknown): value is boolean => typeof value === 'boolean';
const nullable =
  <T>(test: (value: unknown) => value is T) =>
  (value: unknown): value is T | null =>
    value === null || test(value);

function identity(value: unknown): value is Identity {
  return keys(value, 'pid,start') && positive(value.pid) && filled(value.start);
}

function run(value: unknown): value is Run {
  return (
    keys(value, 'kind,lane,state,step') &&
    value.kind === 'run' &&
    step(value.step) &&
    (value.lane === null || (typeof value.lane === 'string' && Object.hasOwn(lanes, value.lane))) &&
    typeof value.state === 'string' &&
    issueStates.includes(value.state)
  );
}

function selection(value: unknown): boolean {
  return (
    object(value) &&
    Object.keys(value).every((name) => ['explicit', 'environment', 'saved'].includes(name)) &&
    (value.explicit === undefined || typeof value.explicit === 'string') &&
    (value.environment === undefined || typeof value.environment === 'string') &&
    (value.saved === undefined || isHost(value.saved))
  );
}

const keyOf = (value: unknown, schema: Schema): IssueKey | null =>
  schema === 5 ? (isKey(value) ? value : null) : positive(value) ? parseKey(String(value)) : null;

function input(value: unknown, schema: Schema): value is Record<string, unknown> {
  if (!object(value) || !selection(value.selection)) return false;
  const issue = (number: unknown) => keyOf(number, schema) !== null;
  switch (value.kind) {
    case 'number':
      return (
        keys(value, schema === 2 ? 'effort,kind,number,selection' : 'effort,kind,model,number,selection') &&
        issue(value.number) &&
        (value.effort === null || isLevel(value.effort)) &&
        (schema === 2 || value.model === null || isModel(value.model))
      );
    case 'auto':
      return keys(value, 'kind,number,selection') && issue(value.number);
    case 'queue':
      return keys(value, 'id,kind,selection,token') && id(value.id) && id(value.token);
    case 'resume':
      return keys(value, 'kind,number,selection') && issue(value.number);
    case 'assist':
      return schema === 5 && keys(value, 'kind,number,selection') && issue(value.number);
    default:
      return false;
  }
}

function authority(value: unknown): value is RecoveryAuthority {
  return (
    keys(value, 'plan,spec,step') &&
    step(value.step) &&
    (value.spec === null || typeof value.spec === 'string') &&
    (value.plan === null || filled(value.plan))
  );
}

function choice(value: unknown): value is AgentChoice {
  return (
    object(value) &&
    ((value.kind === 'default' && keys(value, 'kind')) ||
      (value.kind === 'explicit' && keys(value, 'host,kind') && isHost(value.host)))
  );
}

function attempt(value: unknown): value is RecoveryAttempt {
  return (
    keys(value, 'host,id,sessionId,startedAt') &&
    id(value.id) &&
    isHost(value.host) &&
    positive(value.startedAt) &&
    (value.sessionId === null || isSessionId(value.host, value.sessionId))
  );
}

function ticket(value: unknown): value is UsageTicket {
  return keys(value, 'attempt,ordinal') && usageAttempt(value.attempt) && positive(value.ordinal);
}

function loop(value: unknown): value is RunRecord['loop'] {
  return (
    keys(value, 'attempted,exitCode,finished,first,last,lastHost,retryBlocked,retrying,started') &&
    (value.first === 'any' || value.first === 'gated') &&
    nullable(run)(value.last) &&
    isHost(value.lastHost) &&
    nullable(natural)(value.exitCode) &&
    flag(value.started) &&
    Array.isArray(value.attempted) &&
    value.attempted.every(isHost) &&
    flag(value.retrying) &&
    flag(value.retryBlocked) &&
    nullable(filled)(value.finished)
  );
}

const seenKeys = [...hosts].sort().join(',');

function seen(value: unknown): boolean {
  return (
    keys(value, seenKeys) &&
    hosts.every((host) => {
      const each = value[host];
      return each === null || (keys(each, 'ordinal,sequence') && natural(each.ordinal) && natural(each.sequence));
    })
  );
}

function wait(value: unknown): value is NonNullable<RunRecord['wait']> {
  return (
    keys(value, 'authority,choice,seen,waitId') &&
    id(value.waitId) &&
    authority(value.authority) &&
    choice(value.choice) &&
    seen(value.seen)
  );
}

function barrier(value: unknown): value is NonNullable<NonNullable<RunRecord['session']>['barrier']> {
  return (
    keys(value, 'pid,shell,start,tty') &&
    positive(value.pid) &&
    filled(value.start) &&
    nullable(positive)(value.shell) &&
    nullable(filled)(value.tty)
  );
}

function session(value: unknown, issue: IssueKey | null, kind: RunInput['kind'], schema: Schema): boolean {
  if (
    !keys(
      value,
      'announced,authority,barrier,capture,choice,folder,host,next,owned,record,startedMs,step,tab,terminal,ticket',
    ) ||
    issue === null ||
    !(kind === 'assist' ? value.step === 'assist' : step(value.step)) ||
    !isHost(value.host) ||
    typeof value.announced !== 'string' ||
    !filled(value.folder) ||
    !isAbsolute(value.folder) ||
    !nullable(filled)(value.terminal) ||
    !filled(value.tab) ||
    !nullable(barrier)(value.barrier) ||
    !nullable(positive)(value.startedMs) ||
    (value.barrier === null) !== (value.startedMs === null)
  )
    return false;
  const facts = [value.next, value.authority, value.choice, value.ticket, value.capture];
  if (kind === 'assist') return value.record === null && facts.every((each) => each === null) && attempt(value.owned);
  try {
    const record = value.record;
    const checkout = object(record) ? String(record.checkout) : '';
    if (schema === 5) validateSession(record, checkout, issue, 'run record');
    else if (!object(record) || record.schema !== 2) return false;
    else convertSession(record, checkout, issue, 'run record');
  } catch {
    return false;
  }
  if (kind === 'resume') return facts.every((each) => each === null) && attempt(value.owned);
  return (
    run(value.next) &&
    authority(value.authority) &&
    choice(value.choice) &&
    (ticket(value.ticket) || (value.ticket === null && value.barrier === null)) &&
    filled(value.capture) &&
    attempt(value.owned)
  );
}

function stop(value: unknown): boolean {
  return keys(value, 'at,terminal') && isSafeId(value.terminal) && natural(value.at);
}

function validFields(value: unknown, schema: Schema): boolean {
  if (!object(value)) return false;
  const { stop: pending, ...fields } = value;
  const issue = keyOf(value.issue, schema);
  return !(
    (pending !== undefined && !stop(pending)) ||
    !keys(fields, 'changedMs,daemon,id,input,issue,lock,loop,queue,request,schema,session,state,wait') ||
    value.schema !== schema ||
    !id(value.id) ||
    !identity(value.daemon) ||
    !input(value.input, schema) ||
    (value.issue !== null && issue === null) ||
    !(value.input.kind === 'queue'
      ? value.lock === null || (issue !== null && value.lock === issueLock(issue))
      : issue !== null && value.issue === value.input.number && value.lock === issueLock(issue)) ||
    !(value.queue === null || (keys(value.queue, 'id') && id(value.queue.id))) ||
    (value.queue !== null) !== (value.input.kind === 'queue') ||
    !(
      value.request === null ||
      (keys(value.request, 'retry,step') && nullable(step)(value.request.step) && flag(value.request.retry))
    ) ||
    !loop(value.loop) ||
    !nullable(wait)(value.wait) ||
    !(value.session === null || session(value.session, issue, value.input.kind as RunInput['kind'], schema)) ||
    typeof value.state !== 'string' ||
    !Object.hasOwn(runStates, value.state) ||
    !positive(value.changedMs)
  );
}

export function validRunRecord(value: unknown): value is RunRecord {
  return validFields(value, 5);
}

export async function writeRunRecord(folder: string, record: RunRecord): Promise<void> {
  const written: unknown = record;
  if (!validRunRecord(written)) throw new Error(`run record ${record.id}: not valid`);
  await writeAtomic(join(folder, `${record.id}.json`), `${JSON.stringify(record)}\n`);
}

export async function removeRunRecord(folder: string, id: string): Promise<void> {
  await rm(join(folder, `${id}.json`), { force: true });
}

function keyed(value: Record<string, unknown>, schema: 2 | 3): unknown {
  const old = value as Record<string, unknown> & {
    input: Record<string, unknown>;
    session: (Record<string, unknown> & { record: Record<string, unknown> }) | null;
  };
  const issue = keyOf(old.issue, schema);
  const input = {
    ...old.input,
    ...('number' in old.input ? { number: keyOf(old.input.number, schema) } : {}),
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
  const value = source.value;
  if (!object(value) || (value.schema !== 2 && value.schema !== 3) || !validFields(value, value.schema))
    return { path, error: 'the record is not a valid run record' };
  if (`${String(value.id)}.json` !== name) return { path, error: 'the record ID differs from its file name' };
  const record = keyed(value, value.schema);
  if (!validRunRecord(record)) return { path, error: 'the record is not a valid run record' };
  try {
    await commitMigration(source, value.schema, `${JSON.stringify(record)}\n`);
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
      if (object(value) && object(value.wait) && object(value.wait.seen) && !keys(value.wait.seen, seenKeys))
        return { path, error: 'the record keeps the quota wait of an older engine; start the run again' };
      if (object(value) && (value.schema === 2 || value.schema === 3)) return convert(path, name, folder);
      if (!object(value) || value.schema !== 5) return { path, error: 'the record has another schema' };
      if (!validRunRecord(value)) return { path, error: 'the record is not a valid run record' };
      if (`${value.id}.json` !== name) return { path, error: 'the record ID differs from its file name' };
      return { path, record: value };
    }),
  );
}
