import { createHash } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
import type { Host } from './config-core.ts';
import { isLevel, type Level } from './effort.ts';
import { HostError } from './host.ts';
import { privateRoot } from './private-folder.ts';
import type { ProcessState } from './process-identity.ts';
import type { RunInput, RunState } from './run-engine.ts';
import { stateFolder } from './state-folder.ts';
import { type Step, steps } from './workflow.ts';

export type Selection = Readonly<{ explicit?: Host; environment?: string }>;
export type DaemonRequest =
  | { kind: 'run'; number: number; selection: Selection; effort: Level | null; quiet: boolean }
  | { kind: 'auto'; on: boolean; selection: Selection; quiet: boolean }
  | { kind: 'queue'; id: string; token: string; selection: Selection; quiet: boolean }
  | { kind: 'resume'; number: number; selection: Selection }
  | { kind: 'retry'; number: number; waitId: string }
  | { kind: 'status' }
  | { kind: 'stop' };
export type DaemonAnswer = { accepted: true; run: string | null } | { accepted: false; line: string; code: number };
export type DaemonIdentity = {
  schema: 1;
  pid: number;
  start: string;
  revision: string;
  main: string;
  common: string;
  socket: string;
};
export type RunRow = {
  id: string;
  kind: RunInput['kind'];
  issue: number | null;
  numbers: number[] | null;
  step: Step | null;
  host: Host | null;
  tab: string | null;
  state: RunState;
  line: string | null;
  changedMs: number;
  session: ProcessState | null;
  outcome: { kind: 'closed' | 'gate' | 'stopped'; reason: string; code: number } | null;
};
export type DaemonStatus = { schema: 1; daemon: DaemonIdentity; auto: 'on' | 'off' | 'stopping'; runs: RunRow[] };

export const textLimit = 4096;
export const requestUsage =
  'usage: GET /status | POST /run {"number":<issue>,"selection":<selection>,"effort":<level>|null,"quiet":<boolean>} | POST /auto {"on":<boolean>,"selection":<selection>,"quiet":<boolean>} | POST /queue {"id":<uuid>,"token":<uuid>,"selection":<selection>,"quiet":<boolean>} | POST /resume {"number":<issue>,"selection":<selection>} | POST /stop {} | POST /retry {"number":<issue>,"waitId":<text>}; <selection> is {"explicit"?:"claude"|"codex","environment"?:<text>}; <level> is low|medium|high|xhigh|max';

const routes = {
  '/status': 'GET',
  '/run': 'POST',
  '/auto': 'POST',
  '/queue': 'POST',
  '/resume': 'POST',
  '/stop': 'POST',
  '/retry': 'POST',
} as const;
const kinds: Record<RunInput['kind'], true> = { number: true, auto: true, queue: true, resume: true };
const states: Record<RunState, true> = {
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
const reads: Record<ProcessState, true> = { runs: true, gone: true, unknown: true };
const ends: Record<NonNullable<RunRow['outcome']>['kind'], true> = { closed: true, gate: true, stopped: true };
const autos: Record<DaemonStatus['auto'], true> = { on: true, off: true, stopping: true };
const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, names: readonly string[], optional: readonly string[] = []) =>
  names.every((name) => Object.hasOwn(value, name)) &&
  Object.keys(value).every((name) => names.includes(name) || optional.includes(name));
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= textLimit;
const filled = (value: unknown): value is string => text(value) && value.length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const code = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const id = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const isHost = (value: unknown): value is Host => value === 'claude' || value === 'codex';
const member = <T extends string>(table: Record<T, true>, value: unknown): value is T =>
  typeof value === 'string' && Object.hasOwn(table, value);
const nullable =
  <T>(test: (value: unknown) => value is T) =>
  (value: unknown): value is T | null =>
    value === null || test(value);
const path = (value: unknown): value is string => filled(value) && isAbsolute(value);
const isStep = (value: unknown): value is Step => (steps as readonly unknown[]).includes(value);

export function daemonSocket(common: string): string {
  const socket = join(privateRoot, 'daemon', `${createHash('sha256').update(common).digest('hex').slice(0, 16)}.sock`);
  const bytes = Buffer.byteLength(socket);
  if (bytes >= 104)
    throw new HostError(`daemon: the socket path ${socket} has ${bytes} bytes; a socket path needs fewer than 104`);
  return socket;
}

export async function daemonPaths(common: string): Promise<{
  folder: string;
  identity: string;
  log: string;
  runs: string;
  socket: string;
}> {
  const socket = daemonSocket(common);
  const folder = join(await stateFolder(common), 'daemon');
  return {
    folder,
    identity: join(folder, 'daemon.json'),
    log: join(folder, 'daemon.log'),
    runs: join(folder, 'runs'),
    socket,
  };
}

function selectionOf(value: unknown): Selection | null {
  if (!object(value) || !exact(value, [], ['explicit', 'environment'])) return null;
  const { explicit, environment } = value;
  if (explicit !== undefined && !isHost(explicit)) return null;
  if (environment !== undefined && !text(environment)) return null;
  return { ...(explicit === undefined ? {} : { explicit }), ...(environment === undefined ? {} : { environment }) };
}

export function parseRequest(
  method: string,
  path: string,
  body: unknown,
): DaemonRequest | { status: 400 | 404 | 405; line: string } {
  if (!Object.hasOwn(routes, path)) return { status: 404, line: `daemon: no request at ${path.slice(0, 200)}` };
  const wanted = routes[path as keyof typeof routes];
  if (method !== wanted) return { status: 405, line: `daemon: ${path} takes ${wanted}` };
  if (path === '/status') return { kind: 'status' };
  const refused = { status: 400 as const, line: requestUsage };
  if (!object(body)) return refused;
  if (path === '/stop') return exact(body, []) ? { kind: 'stop' } : refused;
  if (path === '/retry')
    return exact(body, ['number', 'waitId']) && count(body.number) && filled(body.waitId)
      ? { kind: 'retry', number: body.number, waitId: body.waitId }
      : refused;
  const selection = selectionOf(body.selection);
  if (selection === null) return refused;
  const { number, effort, quiet, on } = body;
  if (path === '/run')
    return exact(body, ['number', 'selection', 'effort', 'quiet']) &&
      count(number) &&
      (effort === null || isLevel(effort)) &&
      typeof quiet === 'boolean'
      ? { kind: 'run', number, selection, effort, quiet }
      : refused;
  if (path === '/auto')
    return exact(body, ['on', 'selection', 'quiet']) && typeof on === 'boolean' && typeof quiet === 'boolean'
      ? { kind: 'auto', on, selection, quiet }
      : refused;
  if (path === '/queue')
    return exact(body, ['id', 'token', 'selection', 'quiet']) &&
      id(body.id) &&
      id(body.token) &&
      typeof quiet === 'boolean'
      ? { kind: 'queue', id: body.id, token: body.token, selection, quiet }
      : refused;
  return exact(body, ['number', 'selection']) && count(number) ? { kind: 'resume', number, selection } : refused;
}

function invalid(what: string): never {
  throw new HostError(`daemon: the daemon sent an invalid ${what}`);
}

export function parseAnswer(value: unknown): DaemonAnswer {
  if (object(value) && value.accepted === true && exact(value, ['accepted', 'run']) && nullable(id)(value.run))
    return { accepted: true, run: value.run };
  if (
    object(value) &&
    value.accepted === false &&
    exact(value, ['accepted', 'line', 'code']) &&
    text(value.line) &&
    code(value.code)
  )
    return { accepted: false, line: value.line, code: value.code };
  return invalid('answer');
}

export function parseIdentity(value: unknown): DaemonIdentity {
  if (
    object(value) &&
    exact(value, ['schema', 'pid', 'start', 'revision', 'main', 'common', 'socket']) &&
    value.schema === 1 &&
    count(value.pid) &&
    filled(value.start) &&
    typeof value.revision === 'string' &&
    /^[0-9a-f]{40}$/.test(value.revision) &&
    path(value.main) &&
    path(value.common) &&
    path(value.socket)
  )
    return {
      schema: 1,
      pid: value.pid,
      start: value.start,
      revision: value.revision,
      main: value.main,
      common: value.common,
      socket: value.socket,
    };
  return invalid('identity');
}

function numbersOf(value: unknown): number[] | null {
  if (value === null) return null;
  return Array.isArray(value) && value.every(count) ? [...value] : invalid('run');
}

function outcomeOf(value: unknown): RunRow['outcome'] {
  if (value === null) return null;
  return object(value) &&
    exact(value, ['kind', 'reason', 'code']) &&
    member(ends, value.kind) &&
    text(value.reason) &&
    code(value.code)
    ? { kind: value.kind, reason: value.reason, code: value.code }
    : invalid('run');
}

function rowOf(value: unknown): RunRow {
  if (
    object(value) &&
    exact(value, [
      'id',
      'kind',
      'issue',
      'numbers',
      'step',
      'host',
      'tab',
      'state',
      'line',
      'changedMs',
      'session',
      'outcome',
    ]) &&
    id(value.id) &&
    member(kinds, value.kind) &&
    nullable(count)(value.issue) &&
    nullable(isStep)(value.step) &&
    nullable(isHost)(value.host) &&
    nullable(text)(value.tab) &&
    member(states, value.state) &&
    nullable(text)(value.line) &&
    code(value.changedMs) &&
    nullable((each: unknown) => member(reads, each))(value.session)
  )
    return {
      id: value.id,
      kind: value.kind,
      issue: value.issue,
      numbers: numbersOf(value.numbers),
      step: value.step,
      host: value.host,
      tab: value.tab,
      state: value.state,
      line: value.line,
      changedMs: value.changedMs,
      session: value.session,
      outcome: outcomeOf(value.outcome),
    };
  return invalid('run');
}

export function parseStatus(value: unknown): DaemonStatus {
  if (
    !object(value) ||
    !exact(value, ['schema', 'daemon', 'auto', 'runs']) ||
    value.schema !== 1 ||
    !member(autos, value.auto) ||
    !Array.isArray(value.runs)
  )
    return invalid('status');
  return { schema: 1, daemon: parseIdentity(value.daemon), auto: value.auto, runs: value.runs.map(rowOf) };
}
