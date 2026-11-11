import { readdir, readFile, rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { UsageTicket } from './agent-usage.ts';
import type { AgentChoice, Host } from './config-core.ts';
import { isLevel, isModel } from './effort.ts';
import { uuid } from './fields.ts';
import { isHost } from './host-names.ts';
import type { Identity } from './locks.ts';
import type { RecoveryAttempt, RecoveryAuthority } from './quota-recovery.ts';
import type { RunInput, RunState } from './run-engine.ts';
import { type SessionRecord, validateSession } from './session.ts';
import { writeAtomic } from './state.ts';
import { commitMigration, type LocalRecord, readLocalRecord } from './state-migration.ts';
import { usageAttempt } from './usage-types.ts';
import { lanes, type Run, type Step, steps } from './workflow.ts';

export type RunRecord = {
  schema: 3;
  id: string;
  daemon: Identity;
  input: RunInput;
  issue: number | null;
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
    step: Step;
    host: Host;
    next: Run | null;
    authority: RecoveryAuthority | null;
    choice: AgentChoice | null;
    record: SessionRecord;
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
};
type NumberInput = Extract<RunInput, { kind: 'number' }>;
type HistoricalInput = Exclude<RunInput, NumberInput> | Omit<NumberInput, 'model'>;
type Historical = Omit<RunRecord, 'schema' | 'input'> & { schema: 2; input: HistoricalInput };
export type ReadRecord = { path: string; record: RunRecord } | { path: string; error: string };

const file = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.json$/;
const runStates: Record<RunState, true> = {
  starting: true,
  running: true,
  checking: true,
  waiting: true,
  exiting: true,
  'quota-wait': true,
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

function input(value: unknown, schema: 2 | 3): value is HistoricalInput {
  if (!object(value) || !selection(value.selection)) return false;
  switch (value.kind) {
    case 'number':
      return (
        keys(value, schema === 3 ? 'effort,kind,model,number,selection' : 'effort,kind,number,selection') &&
        positive(value.number) &&
        (value.effort === null || isLevel(value.effort)) &&
        (schema !== 3 || value.model === null || isModel(value.model))
      );
    case 'auto':
      return keys(value, 'kind,number,selection') && positive(value.number);
    case 'queue':
      return keys(value, 'id,kind,selection,token') && id(value.id) && id(value.token);
    case 'resume':
      return keys(value, 'kind,number,selection') && positive(value.number);
    default:
      return false;
  }
}

function authority(value: unknown): value is RecoveryAuthority {
  return (
    keys(value, 'plan,spec,step') &&
    step(value.step) &&
    (value.spec === null || typeof value.spec === 'string') &&
    (value.plan === null || positive(value.plan))
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
    (value.sessionId === null || id(value.sessionId))
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

function seen(value: unknown): boolean {
  return (
    keys(value, 'claude,codex') &&
    [value.claude, value.codex].every(
      (each) => each === null || (keys(each, 'ordinal,sequence') && natural(each.ordinal) && natural(each.sequence)),
    )
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

function session(value: unknown, issue: number | null, resume: boolean): value is NonNullable<RunRecord['session']> {
  if (
    !keys(
      value,
      'announced,authority,barrier,capture,choice,folder,host,next,owned,record,startedMs,step,tab,terminal,ticket',
    ) ||
    issue === null ||
    !step(value.step) ||
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
  try {
    const record = value.record as SessionRecord;
    validateSession(record, object(record) ? (record.checkout as string) : '', issue, 'run record');
  } catch {
    return false;
  }
  const facts = [value.next, value.authority, value.choice, value.ticket, value.capture, value.owned];
  if (resume) return facts.every((each) => each === null);
  return (
    run(value.next) &&
    authority(value.authority) &&
    choice(value.choice) &&
    (ticket(value.ticket) || (value.ticket === null && value.barrier === null)) &&
    filled(value.capture) &&
    attempt(value.owned)
  );
}

function validFields(value: unknown, schema: 2 | 3): boolean {
  return !(
    !keys(value, 'changedMs,daemon,id,input,issue,lock,loop,queue,request,schema,session,state,wait') ||
    value.schema !== schema ||
    !id(value.id) ||
    !identity(value.daemon) ||
    !input(value.input, schema) ||
    !nullable(positive)(value.issue) ||
    !(value.input.kind === 'queue'
      ? value.lock === null || (value.issue !== null && value.lock === `issue-${value.issue}`)
      : value.issue === value.input.number && value.lock === `issue-${value.input.number}`) ||
    !(value.queue === null || (keys(value.queue, 'id') && id(value.queue.id))) ||
    (value.queue !== null) !== (value.input.kind === 'queue') ||
    !(
      value.request === null ||
      (keys(value.request, 'retry,step') && nullable(step)(value.request.step) && flag(value.request.retry))
    ) ||
    !loop(value.loop) ||
    !nullable(wait)(value.wait) ||
    !(value.session === null || session(value.session, value.issue, value.input.kind === 'resume')) ||
    typeof value.state !== 'string' ||
    !Object.hasOwn(runStates, value.state) ||
    !positive(value.changedMs)
  );
}

export function validRunRecord(value: unknown): value is RunRecord {
  return validFields(value, 3);
}

const historical = (value: unknown): value is Historical => validFields(value, 2);

export async function writeRunRecord(folder: string, record: RunRecord): Promise<void> {
  const written: unknown = record;
  if (!validRunRecord(written)) throw new Error(`run record ${record.id}: not valid`);
  await writeAtomic(join(folder, `${record.id}.json`), `${JSON.stringify(record)}\n`);
}

export async function removeRunRecord(folder: string, id: string): Promise<void> {
  await rm(join(folder, `${id}.json`), { force: true });
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
  if (!historical(value)) return { path, error: 'the record is not a valid run record' };
  if (`${value.id}.json` !== name) return { path, error: 'the record ID differs from its file name' };
  const input: RunInput = value.input.kind === 'number' ? { ...value.input, model: null } : value.input;
  const record: RunRecord = { ...value, schema: 3, input };
  if (!validRunRecord(record)) return { path, error: 'the record is not a valid run record' };
  try {
    await commitMigration(source, 2, `${JSON.stringify(record)}\n`);
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
      if (object(value) && value.schema === 2) return convert(path, name, folder);
      if (!object(value) || value.schema !== 3) return { path, error: 'the record has another schema' };
      if (!validRunRecord(value)) return { path, error: 'the record is not a valid run record' };
      if (`${value.id}.json` !== name) return { path, error: 'the record ID differs from its file name' };
      return { path, record: value };
    }),
  );
}
