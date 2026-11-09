import { isAbsolute } from 'node:path';
import type { Host } from './config-core.ts';
import { type ExitCode, exitCodeOf, exits, passThrough } from './contract.ts';
import { isLevel, type Level } from './effort.ts';
import { HostError } from './errors.ts';
import { commit, uuid } from './fields.ts';
import { isHost } from './host-names.ts';
import type { ProcessState } from './process-identity.ts';
import { parseQueueAction, parseQueueView } from './queue.ts';
import type { QueueAction, QueueView } from './queue-types.ts';
import type { RunInput, RunState } from './run-engine.ts';
import { daemonSocketPath, type RepositoryLayout, repositoryState } from './state.ts';
import { type Step, steps } from './workflow.ts';

export type Selection = Readonly<{ explicit?: Host; environment?: string }>;
export type DaemonRequest =
  | { kind: 'run'; number: number; selection: Selection; effort: Level | null; quiet: boolean }
  | { kind: 'auto'; on: boolean; selection: Selection; quiet: boolean }
  | { kind: 'queue'; id: string; token: string; selection: Selection; quiet: boolean }
  | { kind: 'resume'; number: number; selection: Selection }
  | { kind: 'retry'; number: number; waitId: string }
  | { kind: 'queue-action'; action: QueueAction; selection: Selection; quiet: boolean }
  | { kind: 'queue-reconcile' }
  | { kind: 'land'; number: number; subject: string; selection: Selection; from: string }
  | { kind: 'status' }
  | { kind: 'stop' };
export type LandingRecord = { out: string } | { err: string } | { code: ExitCode };
export type DaemonAnswer = { accepted: true; run: string | null } | { accepted: false; line: string; code: ExitCode };
export type QueueAnswer =
  | { accepted: true; run: string | null; view: QueueView }
  | { accepted: false; line: string; code: ExitCode };
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
  outcome: { kind: 'closed' | 'gate' | 'stopped'; reason: string; code: ExitCode } | null;
};
export type LandingRow = { issue: number; state: 'runs' | 'waits'; changedMs: number };
export type DaemonStatus = {
  schema: 1;
  daemon: DaemonIdentity;
  board: string;
  auto: 'on' | 'off' | 'stopping';
  runs: RunRow[];
  landings: LandingRow[];
};

export const textLimit = 4096;
export const stopLine = 'daemon: the daemon stops; start it again, then send the request';
export const requestUsage =
  'usage: GET /status | POST /run {"number":<issue>,"selection":<selection>,"effort":<level>|null,"quiet":<boolean>} | POST /auto {"on":<boolean>,"selection":<selection>,"quiet":<boolean>} | POST /queue {"id":<uuid>,"token":<uuid>,"selection":<selection>,"quiet":<boolean>} | POST /resume {"number":<issue>,"selection":<selection>} | POST /stop {} | POST /retry {"number":<issue>,"waitId":<text>} | POST /queue/action {"action":<action>,"selection":<selection>,"quiet":<boolean>} | POST /queue/reconcile {} | POST /land {"number":<issue>,"subject":<subject>,"selection":<selection>,"from":<path>}; <selection> is {"explicit"?:"claude"|"codex","environment"?:<text>}; <level> is low|medium|high|xhigh|max; <action> is a queue action of celetis queue action';

export const requestPaths: Readonly<Record<Exclude<DaemonRequest['kind'], 'status'>, string>> = {
  run: '/run',
  auto: '/auto',
  queue: '/queue',
  resume: '/resume',
  retry: '/retry',
  stop: '/stop',
  'queue-action': '/queue/action',
  'queue-reconcile': '/queue/reconcile',
  land: '/land',
};
const routes: Readonly<Record<string, 'GET' | 'POST'>> = Object.fromEntries([
  ['/status', 'GET'],
  ...Object.values(requestPaths).map((path) => [path, 'POST']),
]);
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
const boardUrl = /^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/;

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
const member = <T extends string>(table: Record<T, true>, value: unknown): value is T =>
  typeof value === 'string' && Object.hasOwn(table, value);
const nullable =
  <T>(test: (value: unknown) => value is T) =>
  (value: unknown): value is T | null =>
    value === null || test(value);
const path = (value: unknown): value is string => filled(value) && isAbsolute(value);
const isStep = (value: unknown): value is Step => (steps as readonly unknown[]).includes(value);
const latin1 = (value: unknown): value is string =>
  typeof value === 'string' && Buffer.from(value, 'latin1').toString('latin1') === value;

export function landingSubject(number: number, subject: string): boolean {
  return /^[a-z]+(\([^()]+\))?!?: [^ ]/.test(subject) && !subject.includes('\n') && !subject.endsWith(`(#${number})`);
}

export function daemonSocket(common: string): string {
  const socket = daemonSocketPath(common);
  const bytes = Buffer.byteLength(socket);
  if (bytes >= 104)
    throw new HostError(
      `daemon: the socket path ${socket} has ${bytes} bytes; a socket path needs fewer than 104`,
      exits.prerequisite,
    );
  return socket;
}

export async function daemonPaths(common: string): Promise<{
  layout: RepositoryLayout;
  identity: string;
  log: string;
  socket: string;
}> {
  const socket = daemonSocket(common);
  const layout = await repositoryState(common);
  return { layout, identity: layout.daemonIdentity, log: layout.daemonLog, socket };
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
  const wanted = routes[path];
  if (method !== wanted) return { status: 405, line: `daemon: ${path} takes ${wanted}` };
  if (path === '/status') return { kind: 'status' };
  const refused = { status: 400 as const, line: requestUsage };
  if (!object(body)) return refused;
  if (path === '/stop') return exact(body, []) ? { kind: 'stop' } : refused;
  if (path === '/queue/reconcile') return exact(body, []) ? { kind: 'queue-reconcile' } : refused;
  if (path === '/retry')
    return exact(body, ['number', 'waitId']) && count(body.number) && filled(body.waitId)
      ? { kind: 'retry', number: body.number, waitId: body.waitId }
      : refused;
  const selection = selectionOf(body.selection);
  if (selection === null) return refused;
  const { number, effort, quiet, on, subject, from } = body;
  if (path === '/land')
    return exact(body, ['number', 'subject', 'selection', 'from']) &&
      count(number) &&
      typeof subject === 'string' &&
      landingSubject(number, subject) &&
      filled(from) &&
      isAbsolute(from)
      ? { kind: 'land', number, subject, selection, from }
      : refused;
  if (path === '/queue/action') {
    if (!exact(body, ['action', 'selection', 'quiet']) || typeof quiet !== 'boolean') return refused;
    try {
      return { kind: 'queue-action', action: parseQueueAction(body.action), selection, quiet };
    } catch {
      return refused;
    }
  }
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
  throw new HostError(`daemon: the daemon sent an invalid ${what}`, exits.blocked);
}

export function parseAnswer(value: unknown): DaemonAnswer {
  if (object(value) && value.accepted === true && exact(value, ['accepted', 'run']) && nullable(id)(value.run))
    return { accepted: true, run: value.run };
  const refusal = object(value) ? exitCodeOf(value.code) : null;
  if (
    object(value) &&
    value.accepted === false &&
    exact(value, ['accepted', 'line', 'code']) &&
    text(value.line) &&
    refusal !== null
  )
    return { accepted: false, line: value.line, code: refusal };
  return invalid('answer');
}

export function parseQueueAnswer(value: unknown): QueueAnswer {
  if (object(value) && value.accepted === true) {
    if (!exact(value, ['accepted', 'run', 'view']) || !nullable(id)(value.run)) return invalid('answer');
    try {
      return { accepted: true, run: value.run, view: parseQueueView(value.view) };
    } catch {
      return invalid('answer');
    }
  }
  const answer = parseAnswer(value);
  return answer.accepted ? invalid('answer') : answer;
}

export function parseLandingRecord(line: string): LandingRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!object(value)) return null;
  if (exact(value, ['out']) && latin1(value.out)) return { out: value.out };
  if (exact(value, ['err']) && latin1(value.err)) return { err: value.err };
  const status = exitCodeOf(value.code);
  if (exact(value, ['code']) && status !== null) return { code: status };
  return null;
}

export function parseIdentity(value: unknown): DaemonIdentity {
  if (
    object(value) &&
    exact(value, ['schema', 'pid', 'start', 'revision', 'main', 'common', 'socket']) &&
    value.schema === 1 &&
    count(value.pid) &&
    filled(value.start) &&
    typeof value.revision === 'string' &&
    commit.test(value.revision) &&
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
    ? { kind: value.kind, reason: value.reason, code: passThrough(value.code) }
    : invalid('run');
}

function landingOf(value: unknown): LandingRow {
  if (
    object(value) &&
    exact(value, ['issue', 'state', 'changedMs']) &&
    count(value.issue) &&
    (value.state === 'runs' || value.state === 'waits') &&
    code(value.changedMs)
  )
    return { issue: value.issue, state: value.state, changedMs: value.changedMs };
  return invalid('landing');
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
    !exact(value, ['schema', 'daemon', 'board', 'auto', 'runs', 'landings']) ||
    value.schema !== 1 ||
    typeof value.board !== 'string' ||
    !boardUrl.test(value.board) ||
    !member(autos, value.auto) ||
    !Array.isArray(value.runs) ||
    !Array.isArray(value.landings)
  )
    return invalid('status');
  return {
    schema: 1,
    daemon: parseIdentity(value.daemon),
    board: value.board,
    auto: value.auto,
    runs: value.runs.map(rowOf),
    landings: value.landings.map(landingOf),
  };
}
