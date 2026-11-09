import { type Pair, pairText, ScoreError, scoreLabel } from './capability.ts';
import type { Host } from './config-core.ts';
import type { DispatchStatus } from './contract.ts';
import { isLevel, type Level } from './effort.ts';
import { isHost } from './fields.ts';

export type Role = 'implementer' | 'reviewer';
export type Action = 'spawn' | 'resume' | 'replace';
export interface Score {
  digits: number[];
  bias: number;
}
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface NativeCall {
  tool: string;
  arguments: { [key: string]: JsonValue };
  result: JsonValue;
}
export interface ExecutionReport {
  call: NativeCall | null;
  outcome:
    | { result: 'started'; child: string | null; model: string | null; effort: Level | null }
    | { result: 'failed'; noWorkerStarted: true; error: string }
    | { result: 'incomplete' | 'unsupported'; error: string };
}
export interface Execution {
  provenance: 'agent-reported';
  report: ExecutionReport;
  result: 'started' | 'failed' | 'incomplete' | 'mismatch' | 'unsupported';
  reason: string | null;
  time: string;
}
export interface Dispatch {
  id: string;
  issue: number;
  task: string;
  role: Role;
  action: Action;
  child: string | null;
  attempt: number;
  round: number;
  level: number;
  pair: Pair;
  line: string;
  issued: string;
  execution: Execution | null;
  voided: boolean;
}
export type Entry =
  | { kind: 'score'; digits: number[]; bias: number; time: string }
  | { kind: 'dispatch'; id: string }
  | { kind: 'gate'; result: 'pass' | 'fail'; name: string; report: string; time: string }
  | { kind: 'review'; result: 'findings' | 'blocked'; time: string };
export interface Task {
  issue: number;
  task: string;
  attempt: number;
  round: number;
  escalated: boolean;
  closed: boolean;
  entries: Entry[];
}
export interface DispatchRecord {
  schema: 2;
  host: Host;
  session: string;
  tasks: Task[];
  dispatches: Dispatch[];
}
type Refusal = Exclude<DispatchStatus, 'ready' | 'reported' | 'closed'>;
export type Result =
  | { status: Extract<DispatchStatus, 'reported'>; dispatch: string; result: 'started' | 'failed' }
  | { status: Extract<DispatchStatus, 'ready'>; dispatch: Dispatch; voided: string[] }
  | { status: Extract<DispatchStatus, 'closed'>; issue: number; task: string }
  | { status: Refusal; issue: number; task: string; reason: string; trail: unknown[] | null };
export interface Context {
  resolve(score: Score, level: number, reviewer: boolean): Pair | null;
  id(): string;
  now(): string;
}
export class DispatchError extends Error {}

type Key = { issue: number; task: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const taskId = /^(?:[1-9]\d*|final|verify-[1-9]\d*|land-[1-9]\d*)$/;
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !value.includes('\0');
const isChildId = (value: unknown): value is string => isText(value) && value.trim().length > 0;
const nullableText = (value: unknown): boolean => value === null || isText(value);
const nullableString = (value: unknown): boolean => value === null || typeof value === 'string';
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
function need(condition: unknown, field: string): asserts condition {
  if (!condition) throw new DispatchError(`invalid ${field}`);
}
function shape(value: unknown, fields: string[], path: string): Record<string, unknown> {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), path);
  const object = value as Record<string, unknown>;
  need(Object.getPrototypeOf(object) === Object.prototype || Object.getPrototypeOf(object) === null, path);
  for (const field of fields) need(Object.hasOwn(object, field), path ? `${path}.${field}` : field);
  for (const field of Object.keys(object)) need(fields.includes(field), path ? `${path}.${field}` : field);
  return object;
}
function list(value: unknown, path: string, validate: (value: unknown, path: string) => void): void {
  need(Array.isArray(value), path);
  for (let i = 0; i < value.length; i++) validate(value[i], `${path}[${i}]`);
}
function scoreValue(value: unknown, path: string, fields = ['digits', 'bias']): void {
  const score = shape(value, fields, path);
  need(Array.isArray(score.digits) && score.digits.length === 6, `${path}.digits`);
  list(score.digits, `${path}.digits`, (digit, field) => need(integer(digit, 0, 2), field));
  need(integer(score.bias, 0), `${path}.bias`);
}
function keyValue(value: Key): void {
  need(integer(value.issue, 1), 'issue');
  need(isText(value.task) && taskId.test(value.task) && !value.task.endsWith('\n'), 'task');
}
function pairValue(value: unknown, path: string): void {
  const pair = shape(value, ['rank', 'model', 'effort', 'runtime', 'reviewer'], path);
  need(integer(pair.rank, 0, 3), `${path}.rank`);
  need(nullableText(pair.model), `${path}.model`);
  need(isLevel(pair.effort), `${path}.effort`);
  need(nullableText(pair.runtime), `${path}.runtime`);
  need(typeof pair.reviewer === 'boolean', `${path}.reviewer`);
}
function entryValue(value: unknown, path: string): void {
  need(value !== null && typeof value === 'object', path);
  const entry = value as Record<string, unknown>;
  switch (entry.kind) {
    case 'score':
      scoreValue(entry, path, ['kind', 'digits', 'bias', 'time']);
      break;
    case 'dispatch':
      shape(entry, ['kind', 'id'], path);
      need(typeof entry.id === 'string' && uuid.test(entry.id), `${path}.id`);
      return;
    case 'gate':
      shape(entry, ['kind', 'result', 'name', 'report', 'time'], path);
      need(entry.result === 'pass' || entry.result === 'fail', `${path}.result`);
      need(isText(entry.name), `${path}.name`);
      need(isText(entry.report), `${path}.report`);
      break;
    case 'review':
      shape(entry, ['kind', 'result', 'time'], path);
      need(entry.result === 'findings' || entry.result === 'blocked', `${path}.result`);
      break;
    default:
      need(false, `${path}.kind`);
  }
  need(isText(entry.time), `${path}.time`);
}
function jsonValue(value: unknown, path: string, parents = new Set<unknown>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    need(Number.isFinite(value), path);
    return;
  }
  need(typeof value === 'object' && !parents.has(value), path);
  parents.add(value);
  if (Array.isArray(value)) {
    need(Reflect.ownKeys(value).length === value.length + 1, path);
    for (let i = 0; i < value.length; i++) {
      need(Object.hasOwn(value, i), path);
      jsonValue(value[i], `${path}[${i}]`, parents);
    }
  } else {
    need(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, path);
    for (const key of Reflect.ownKeys(value)) {
      need(typeof key === 'string' && Object.prototype.propertyIsEnumerable.call(value, key), path);
      jsonValue((value as Record<string, unknown>)[key], `${path}.${key}`, parents);
    }
  }
  parents.delete(value);
}
function executionReportValue(value: unknown, historical: boolean): ExecutionReport {
  jsonValue(value, 'report');
  const report = shape(value, historical ? ['host', 'session', 'call', 'outcome'] : ['call', 'outcome'], 'report');
  if (historical) {
    need(isHost(report.host), 'report.host');
    need(isText(report.session), 'report.session');
  }
  const outcome = report.outcome as Record<string, unknown> | null;
  need(outcome && typeof outcome === 'object', 'report.outcome');
  if (outcome.result === 'started') {
    shape(outcome, ['result', 'child', 'model', 'effort'], 'report.outcome');
    need(nullableString(outcome.child), 'report.outcome.child');
    need(nullableText(outcome.model), 'report.outcome.model');
    need(outcome.effort === null || isLevel(outcome.effort), 'report.outcome.effort');
  } else if (outcome.result === 'failed') {
    shape(outcome, ['result', 'noWorkerStarted', 'error'], 'report.outcome');
    need(outcome.noWorkerStarted === true, 'report.outcome.noWorkerStarted');
    need(isText(outcome.error), 'report.outcome.error');
  } else {
    shape(outcome, ['result', 'error'], 'report.outcome');
    need(outcome.result === 'incomplete' || outcome.result === 'unsupported', 'report.outcome.result');
    need(isText(outcome.error), 'report.outcome.error');
  }
  if (outcome.result === 'unsupported') need(report.call === null, 'report.call');
  else {
    const call = shape(report.call, ['tool', 'arguments', 'result'], 'report.call');
    need(isText(call.tool), 'report.call.tool');
    need(
      call.arguments !== null && typeof call.arguments === 'object' && !Array.isArray(call.arguments),
      'report.call.arguments',
    );
  }
  return structuredClone(value as ExecutionReport);
}
export function validateExecutionReport(value: unknown): ExecutionReport {
  return executionReportValue(value, false);
}
function executionValue(value: unknown, path: string, historical: boolean): void {
  const execution = shape(value, ['provenance', 'report', 'result', 'reason', 'time'], path);
  need(execution.provenance === 'agent-reported', `${path}.provenance`);
  executionReportValue(execution.report, historical);
  need(
    ['started', 'failed', 'incomplete', 'mismatch', 'unsupported'].includes(execution.result as string),
    `${path}.result`,
  );
  need(
    execution.result === 'started' || execution.result === 'failed'
      ? execution.reason === null
      : isText(execution.reason),
    `${path}.reason`,
  );
  need(isText(execution.time), `${path}.time`);
}
function dispatchValue(value: unknown, path: string, historical: boolean): void {
  const dispatch = shape(
    value,
    [
      'id',
      'issue',
      'task',
      'role',
      'action',
      'child',
      'attempt',
      'round',
      'level',
      'pair',
      'line',
      'issued',
      'execution',
      'voided',
    ],
    path,
  );
  need(typeof dispatch.id === 'string' && uuid.test(dispatch.id), `${path}.id`);
  need(integer(dispatch.issue, 1), `${path}.issue`);
  need(isText(dispatch.task) && taskId.test(dispatch.task) && !dispatch.task.endsWith('\n'), `${path}.task`);
  need(dispatch.role === 'implementer' || dispatch.role === 'reviewer', `${path}.role`);
  need(['spawn', 'resume', 'replace'].includes(dispatch.action as Action), `${path}.action`);
  need(nullableText(dispatch.child), `${path}.child`);
  need(dispatch.action === 'resume' || dispatch.child === null, `${path}.child`);
  need(integer(dispatch.attempt, 1, 3), `${path}.attempt`);
  need(integer(dispatch.round, 0, 5), `${path}.round`);
  need(integer(dispatch.level, 1, 3), `${path}.level`);
  pairValue(dispatch.pair, `${path}.pair`);
  need((dispatch.pair as Pair).reviewer === (dispatch.role === 'reviewer'), `${path}.pair.reviewer`);
  need(
    isText(dispatch.line) && dispatchIdOf(dispatch.line) === dispatch.id && !dispatch.line.includes('\n'),
    `${path}.line`,
  );
  need(isText(dispatch.issued), `${path}.issued`);
  if (dispatch.execution !== null) executionValue(dispatch.execution, `${path}.execution`, historical);
  need(typeof dispatch.voided === 'boolean', `${path}.voided`);
  if (dispatch.voided) need((dispatch.execution as Execution | null)?.result === 'failed', `${path}.voided`);
}

export function emptyRecord(host: Host, session: string): DispatchRecord {
  need(isHost(host), 'host');
  need(isText(session), 'session');
  return { schema: 2, host, session, tasks: [], dispatches: [] };
}
function recordValue(value: unknown, host: Host, session: string, historical: boolean): DispatchRecord {
  const record = shape(value, ['schema', 'host', 'session', 'tasks', 'dispatches'], '');
  need(record.schema === (historical ? 1 : 2), 'schema');
  need(isHost(record.host) && record.host === host, 'host');
  need(isText(record.session) && record.session === session, 'session');
  const keys = new Set<string>();
  list(record.tasks, 'tasks', (value, path) => {
    const task = shape(value, ['issue', 'task', 'attempt', 'round', 'escalated', 'closed', 'entries'], path);
    need(integer(task.issue, 1), `${path}.issue`);
    need(isText(task.task) && taskId.test(task.task) && !task.task.endsWith('\n'), `${path}.task`);
    const key = `${task.issue}:${task.task}`;
    need(!keys.has(key), path);
    keys.add(key);
    need(integer(task.attempt, 1, 4), `${path}.attempt`);
    need(integer(task.round, 0, 5), `${path}.round`);
    need(typeof task.escalated === 'boolean', `${path}.escalated`);
    need(typeof task.closed === 'boolean', `${path}.closed`);
    list(task.entries, `${path}.entries`, entryValue);
    need((task.entries as Entry[])[0]?.kind === 'score', `${path}.entries[0]`);
  });
  list(record.dispatches, 'dispatches', (value, path) => dispatchValue(value, path, historical));
  const typed = record as unknown as DispatchRecord;
  const dispatches = new Map<string, Dispatch>();
  for (const [index, dispatch] of typed.dispatches.entries()) {
    need(!dispatches.has(dispatch.id), `dispatches[${index}].id`);
    need(keys.has(`${dispatch.issue}:${dispatch.task}`), `dispatches[${index}].task`);
    if (dispatch.execution) {
      if (historical) {
        const report = dispatch.execution.report as unknown as Record<string, unknown>;
        need(report.host === host, `dispatches[${index}].execution.report.host`);
        need(report.session === session, `dispatches[${index}].execution.report.session`);
      }
      const expected = executionResult(
        { ...typed, dispatches: typed.dispatches.slice(0, index) },
        dispatch,
        dispatch.execution.report,
        historical,
      );
      need(
        dispatch.execution.result === expected.result && dispatch.execution.reason === expected.reason,
        'dispatch.execution.result',
      );
    }
    dispatches.set(dispatch.id, dispatch);
  }
  const referenced = new Set<string>();
  for (const [index, task] of typed.tasks.entries()) {
    let score: Score | undefined;
    let attempt = 1;
    let round = 0;
    let escalated = false;
    let stopped = false;
    const ordered = dispatchesOf(typed, task);
    const previous = new Map<Role, Dispatch>();
    let latest: Dispatch | undefined;
    let ordinal = 0;
    for (const [entryIndex, entry] of task.entries.entries()) {
      need(!stopped, `tasks[${index}].entries[${entryIndex}]`);
      if (entry.kind === 'score') score = entry;
      if (entry.kind === 'gate' && entry.result === 'fail') attempt++;
      if (entry.kind === 'review') {
        if (round === 5) stopped = true;
        else round++;
        if (round >= 4 || entry.result === 'blocked') escalated = true;
      }
      if (entry.kind !== 'dispatch') continue;
      const path = `tasks[${index}].entries[${entryIndex}].id`;
      const dispatch = dispatches.get(entry.id);
      need(dispatch && dispatch.issue === task.issue && dispatch.task === task.task && !referenced.has(entry.id), path);
      need(ordered[ordinal++] === dispatch, path);
      referenced.add(entry.id);
      const dispatchPath = `dispatches[${typed.dispatches.indexOf(dispatch)}]`;
      need(dispatch.attempt === attempt, `${dispatchPath}.attempt`);
      need(dispatch.round === round, `${dispatchPath}.round`);
      const prior = previous.get(dispatch.role);
      const repair = prior?.voided && prior.execution?.result === 'failed';
      need(
        dispatch.level ===
          (repair ? prior.level : dispatch.role === 'reviewer' ? attempt : Math.max(attempt, escalated ? 3 : 1)),
        `${dispatchPath}.level`,
      );
      if (repair) {
        need(prior === latest && prior.attempt === attempt && prior.round === round, `${dispatchPath}.retry`);
        need(dispatch.action === prior.action && dispatch.child === prior.child, `${dispatchPath}.action`);
      }
      need(
        score && dispatch.line === lineOf(score, dispatch.pair, dispatch.level, dispatch.id),
        `${dispatchPath}.line`,
      );
      previous.set(dispatch.role, dispatch);
      latest = dispatch;
    }
    need(task.attempt === attempt, `tasks[${index}].attempt`);
    need(task.round === round, `tasks[${index}].round`);
    need(task.escalated === escalated, `tasks[${index}].escalated`);
    validateHistory(typed, task, historical);
    if (task.closed) {
      need(task.attempt < 4 && !stopped, `tasks[${index}].closed`);
      need(closeReason(typed, task) === null, `tasks[${index}].closed`);
    }
  }
  for (const [index, dispatch] of typed.dispatches.entries())
    need(referenced.has(dispatch.id), `dispatches[${index}].id`);
  return structuredClone(typed);
}
export function validateRecord(value: unknown, host: Host, session: string): DispatchRecord {
  return recordValue(value, host, session, false);
}
export function convertDispatchRecord(value: unknown, host: Host, session: string): DispatchRecord {
  const record = recordValue(value, host, session, true);
  for (const dispatch of record.dispatches) {
    if (!dispatch.execution) continue;
    const { call, outcome } = dispatch.execution.report;
    dispatch.execution.report = { call, outcome };
  }
  record.schema = 2;
  return validateRecord(record, host, session);
}
export function dispatchIdOf(text: string): string | null {
  return (
    /^CAP: .* \[dispatch ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]$/.exec(
      text.split('\n', 1)[0] ?? '',
    )?.[1] ?? null
  );
}

function taskOf(record: DispatchRecord, key: Key): Task | undefined {
  return record.tasks.find((task) => task.issue === key.issue && task.task === key.task);
}
function dispatchesOf(record: DispatchRecord, key: Key, role?: Role): Dispatch[] {
  return record.dispatches.filter(
    (dispatch) => dispatch.issue === key.issue && dispatch.task === key.task && (!role || dispatch.role === role),
  );
}
function started(dispatch: Dispatch | undefined): dispatch is Dispatch {
  return dispatch?.execution?.result === 'started';
}
function workerOf(dispatch: Dispatch | undefined): string | null {
  const outcome = dispatch?.execution?.report.outcome;
  return outcome?.result === 'started' ? outcome.child : null;
}
function spawnCall(dispatch: Dispatch): NativeCall | null {
  const call = dispatch.execution?.report.call;
  return started(dispatch) && call?.tool === 'Agent' ? call : null;
}
function followupAddress(record: DispatchRecord, dispatch: Dispatch, to: JsonValue | undefined): boolean {
  if (to === dispatch.child) return true;
  if (record.host !== 'claude' || !isText(to)) return false;
  const holders = record.dispatches.filter((prior) => spawnCall(prior)?.arguments.name === to);
  const bound = holders.some((prior) => {
    const result = spawnCall(prior)?.result;
    if (isText(result)) {
      const lines = result.split('\n');
      return lines.includes(`name: ${to}`) && lines.includes(`agent_id: ${workerOf(prior)}`);
    }
    return result !== null && typeof result === 'object' && !Array.isArray(result) && result.name === to;
  });
  return bound && holders.every((prior) => workerOf(prior) === dispatch.child);
}
function childOf(record: DispatchRecord, key: Key, role: Role): Dispatch | undefined {
  return dispatchesOf(record, key, role).findLast(
    (dispatch) => (dispatch.action === 'spawn' || dispatch.action === 'replace') && started(dispatch),
  );
}
function samePair(left: Pair, right: Pair): boolean {
  return left.model === right.model && left.effort === right.effort && left.runtime === right.runtime;
}
function trailOf(record: DispatchRecord, task: Task): unknown[] {
  return task.entries.map((entry) => {
    if (entry.kind !== 'dispatch') return structuredClone(entry);
    const dispatch = record.dispatches.find((dispatch) => dispatch.id === entry.id) as Dispatch;
    const { id, role, action, attempt, round, line, execution } = dispatch;
    return {
      kind: 'dispatch',
      id,
      role,
      action,
      attempt,
      round,
      line,
      execution: execution?.result ?? null,
    };
  });
}
function refused(record: DispatchRecord, key: Key, reason: string, status: Refusal = 'refused'): Result {
  const task = taskOf(record, key);
  return { status, issue: key.issue, task: key.task, reason, trail: task ? trailOf(record, task) : null };
}
function guard(record: DispatchRecord, key: Key): Result | null {
  keyValue(key);
  const task = taskOf(record, key);
  if (task && task.entries.filter((entry) => entry.kind === 'review').length > 5)
    return refused(record, task, 'fix round 5 still has findings: escalate with the failure trail', 'stop');
  if (task && task.attempt >= 4) return refused(record, task, 'attempt 4: escalate with the failure trail', 'stop');
  const pending = record.dispatches.find(
    (dispatch) =>
      dispatch.execution === null || ['incomplete', 'mismatch', 'unsupported'].includes(dispatch.execution.result),
  );
  if (pending)
    return refused(
      record,
      key,
      'dispatch ' +
        pending.id +
        ': ' +
        (pending.execution?.reason ?? `missing execution report; run dispatch report ${pending.id} <report-file>`),
      'setup',
    );
  if (task?.closed) return refused(record, key, 'the task is closed');
  return null;
}
function latestScore(task: Task): Score {
  const entry = task.entries.findLast((entry) => entry.kind === 'score');
  if (entry?.kind !== 'score') throw new DispatchError('invalid task.entries: missing score');
  return { digits: [...entry.digits], bias: entry.bias };
}
function lineOf(score: Score, pair: Pair, level: number, id: string): string {
  return `${scoreLabel(score.digits.map(String), String(score.bias))} → ${pairText(pair)}${level > 1 ? ` [attempt ${level}]` : ''} [dispatch ${id}]`;
}
function freshGate(task: Task, implementer: Dispatch): number {
  const last = task.entries.findLastIndex((entry) => entry.kind === 'dispatch' && entry.id === implementer.id);
  return task.entries.findLastIndex(
    (entry, index) => index > Math.max(last, adverseEntry(task)) && entry.kind === 'gate' && entry.result === 'pass',
  );
}
function adverseEntry(task: Task): number {
  return task.entries.findLastIndex(
    (entry) => entry.kind === 'review' || (entry.kind === 'gate' && entry.result === 'fail'),
  );
}
function reviewerAllowed(record: DispatchRecord, task: Task): boolean {
  const implementers = dispatchesOf(record, task, 'implementer');
  if (implementers.length === 0) return task.task === 'final' && adverseEntry(task) < 0;
  const implementer = implementers.at(-1);
  return started(implementer) && freshGate(task, implementer) >= 0;
}
function validateHistory(record: DispatchRecord, task: Task, historical: boolean): void {
  const prefix = { ...task, entries: [] as Entry[] };
  const history = { ...record, tasks: [prefix], dispatches: [] as Dispatch[] };
  let terminal = false;
  let failures = 0;
  let reviews = 0;
  for (const entry of task.entries) {
    need(!terminal, 'task.entries after terminal stop');
    const latest = history.dispatches.at(-1);
    if (entry.kind === 'gate' || entry.kind === 'review') {
      need(started(latest), 'task.entries execution');
      need(
        latest.role === (entry.kind === 'gate' || entry.result === 'blocked' ? 'implementer' : 'reviewer'),
        'task.entries role',
      );
      if (entry.kind === 'gate' && entry.result === 'fail') terminal = ++failures === 3;
      if (entry.kind === 'review') terminal = ++reviews === 6;
    }
    if (entry.kind === 'dispatch') {
      const dispatch = record.dispatches.find((dispatch) => dispatch.id === entry.id) as Dispatch;
      const child = childOf(history, task, dispatch.role);
      const previous = dispatchesOf(history, task, dispatch.role).at(-1);
      if (dispatch.role === 'reviewer') need(reviewerAllowed(history, prefix), 'dispatch.reviewer gate');
      if (dispatch.action === 'resume') {
        need(child && dispatch.child === workerOf(child), 'dispatch.child');
        need(samePair(child.pair, dispatch.pair), 'dispatch.pair');
      } else if (dispatch.action === 'spawn') need(!child, 'dispatch.action');
      else
        need(
          child &&
            ((!historical &&
              (!samePair(child.pair, dispatch.pair) ||
                (previous?.action === 'replace' && previous.voided && previous.execution?.result === 'failed'))) ||
              dispatch.round >= 4 ||
              task.entries
                .slice(0, prefix.entries.length)
                .some((entry) => entry.kind === 'review' && entry.result === 'blocked')),
          'dispatch.replacement',
        );
      history.dispatches.push(dispatch);
    }
    prefix.entries.push(entry);
  }
}
function issueDispatch(
  record: DispatchRecord,
  task: Task,
  role: Role,
  context: Context,
  reason: string,
  action?: Action,
  repair = false,
): Result {
  const previous = dispatchesOf(record, task, role).at(-1);
  const retry =
    repair &&
    previous &&
    previous === dispatchesOf(record, task).at(-1) &&
    previous.attempt === task.attempt &&
    previous.round === task.round &&
    !previous.voided &&
    previous.execution?.result === 'failed'
      ? previous
      : undefined;
  const child = childOf(record, task, role);
  const level = retry?.level ?? (role === 'reviewer' ? task.attempt : Math.max(task.attempt, task.escalated ? 3 : 1));
  let pair: Pair | null;
  try {
    pair = context.resolve(latestScore(task), level, role === 'reviewer');
  } catch (error) {
    if (!(error instanceof ScoreError)) throw error;
    return refused(record, task, error.message, 'setup');
  }
  if (!pair) return refused(record, task, `attempt ${task.attempt}: escalate with the failure trail`, 'stop');
  const selectedAction =
    retry?.action ?? action ?? (child ? (samePair(child.pair, pair) ? 'resume' : 'replace') : 'spawn');
  if (selectedAction === 'resume') {
    if (!child) return refused(record, task, `no recorded ${role} child to resume`, 'setup');
    if (!samePair(child.pair, pair))
      return refused(
        record,
        task,
        `the recorded ${role} ${workerOf(child)} runs ${pairText(child.pair)}; ${reason} needs ${pairText(pair)}; no follow-up tool of ${record.host} sets a pair`,
        'setup',
      );
  }
  const id = context.id();
  need(uuid.test(id) && !record.dispatches.some((dispatch) => dispatch.id === id), 'dispatch.id');
  const dispatch: Dispatch = {
    id,
    issue: task.issue,
    task: task.task,
    role,
    action: selectedAction,
    child: selectedAction === 'resume' ? workerOf(child) : null,
    attempt: task.attempt,
    round: task.round,
    level,
    pair: structuredClone(pair),
    line: lineOf(latestScore(task), pair, level, id),
    issued: context.now(),
    execution: null,
    voided: false,
  };
  if (retry) retry.voided = true;
  record.dispatches.push(dispatch);
  task.entries.push({ kind: 'dispatch', id });
  return { status: 'ready', dispatch, voided: retry ? [retry.id] : [] };
}

export function requestNext(
  record: DispatchRecord,
  input: Key & { role: Role; score: Score },
  context: Context,
): { record: DispatchRecord; result: Result } {
  record = structuredClone(record);
  const blocked = guard(record, input);
  if (blocked) return { record, result: blocked };
  need(input.role === 'implementer' || input.role === 'reviewer', 'role');
  scoreValue(input.score, 'score');
  let task = taskOf(record, input);
  if (!task) {
    task = { issue: input.issue, task: input.task, attempt: 1, round: 0, escalated: false, closed: false, entries: [] };
    record.tasks.push(task);
  }
  const previous = task.entries.findLast((entry) => entry.kind === 'score');
  if (
    previous?.kind !== 'score' ||
    previous.bias !== input.score.bias ||
    previous.digits.some((digit, index) => digit !== input.score.digits[index])
  )
    task.entries.push({ kind: 'score', digits: [...input.score.digits], bias: input.score.bias, time: context.now() });
  if (input.role === 'reviewer' && !reviewerAllowed(record, task))
    return {
      record,
      result: refused(record, task, 'a reviewer needs a gate pass after the latest started implementer dispatch'),
    };
  return { record, result: issueDispatch(record, task, input.role, context, 'the next dispatch', undefined, true) };
}
export function reportGate(
  record: DispatchRecord,
  input: Key & { result: 'pass' | 'fail'; name: string; report: string },
  context: Context,
): { record: DispatchRecord; result: Result } {
  record = structuredClone(record);
  const blocked = guard(record, input);
  if (blocked) return { record, result: blocked };
  need(input.result === 'pass' || input.result === 'fail', 'result');
  need(isText(input.name), 'name');
  need(isText(input.report), 'report');
  const task = taskOf(record, input);
  const latest = dispatchesOf(record, input).at(-1);
  if (!task || !started(latest) || latest.role !== 'implementer')
    return {
      record,
      result: refused(record, input, 'a gate needs the latest dispatch to be a started implementer dispatch'),
    };
  if (task.attempt >= 4)
    return { record, result: refused(record, task, 'attempt 4: escalate with the failure trail', 'stop') };
  task.entries.push({
    kind: 'gate',
    result: input.result,
    name: input.name,
    report: input.report,
    time: context.now(),
  });
  if (input.result === 'pass')
    return { record, result: issueDispatch(record, task, 'reviewer', context, 'the gate pass', undefined, true) };
  task.attempt++;
  if (task.attempt >= 4)
    return { record, result: refused(record, task, 'attempt 4: escalate with the failure trail', 'stop') };
  return { record, result: issueDispatch(record, task, 'implementer', context, 'the gate failure') };
}
export function reportReview(
  record: DispatchRecord,
  input: Key & { result: 'findings' | 'blocked' },
  context: Context,
): { record: DispatchRecord; result: Result } {
  record = structuredClone(record);
  const blocked = guard(record, input);
  if (blocked) return { record, result: blocked };
  need(input.result === 'findings' || input.result === 'blocked', 'result');
  const task = taskOf(record, input);
  const latest = dispatchesOf(record, input).at(-1);
  if (!task || !started(latest) || latest.role !== (input.result === 'findings' ? 'reviewer' : 'implementer'))
    return {
      record,
      result: refused(
        record,
        input,
        `${input.result} needs the latest dispatch to be a started ${input.result === 'findings' ? 'reviewer' : 'implementer'} dispatch`,
      ),
    };
  task.entries.push({ kind: 'review', result: input.result, time: context.now() });
  if (task.round >= 5)
    return {
      record,
      result: refused(record, task, 'fix round 5 still has findings: escalate with the failure trail', 'stop'),
    };
  task.round++;
  if (task.round >= 4 || input.result === 'blocked') task.escalated = true;
  const action =
    task.round >= 4 || input.result === 'blocked'
      ? childOf(record, task, 'implementer')
        ? 'replace'
        : 'spawn'
      : undefined;
  return { record, result: issueDispatch(record, task, 'implementer', context, `fix round ${task.round}`, action) };
}
export function closeTask(
  record: DispatchRecord,
  input: Key,
  _context: Context,
): { record: DispatchRecord; result: Result } {
  record = structuredClone(record);
  const blocked = guard(record, input);
  if (blocked) return { record, result: blocked };
  const task = taskOf(record, input);
  if (!task) return { record, result: refused(record, input, 'the task has no dispatch evidence') };
  const reason = closeReason(record, task);
  if (reason) return { record, result: refused(record, task, reason) };
  task.closed = true;
  return { record, result: { status: 'closed', issue: task.issue, task: task.task } };
}
function closeReason(record: DispatchRecord, task: Task): string | null {
  const implementer = dispatchesOf(record, task, 'implementer').at(-1);
  if (task.task !== 'final' && !childOf(record, task, 'implementer'))
    return 'the task needs a recorded implementer child';
  let after = adverseEntry(task);
  if (implementer) {
    if (!started(implementer)) return 'the task needs a successfully reported implementer dispatch';
    after = freshGate(task, implementer);
    if (after < 0) return 'the task needs a gate pass after the latest implementer dispatch';
  }
  const reviewer = dispatchesOf(record, task, 'reviewer').at(-1);
  const reviewIndex = task.entries.findIndex((entry) => entry.kind === 'dispatch' && entry.id === reviewer?.id);
  if (!started(reviewer) || reviewIndex <= after)
    return 'the task needs a started reviewer dispatch after the gate pass';
  return null;
}
function nativeFields(value: JsonValue): { child: JsonValue[]; model: JsonValue[]; effort: JsonValue[] } {
  const fields = { child: [] as JsonValue[], model: [] as JsonValue[], effort: [] as JsonValue[] };
  const identities = ['agentId', 'resumedAgentId', 'task_name'];
  function metadata(value: { [key: string]: JsonValue }): void {
    for (const key of identities) if (Object.hasOwn(value, key)) fields.child.push(value[key] as JsonValue);
    for (const key of ['model', 'resolvedModel'])
      if (Object.hasOwn(value, key)) fields.model.push(value[key] as JsonValue);
    for (const key of ['effort', 'reasoning_effort'])
      if (Object.hasOwn(value, key)) fields.effort.push(value[key] as JsonValue);
    if (value.type === 'text') text(value.text ?? null);
    if (Array.isArray(value.content)) text(value.content);
  }
  function text(value: JsonValue): void {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as JsonValue;
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          (Object.hasOwn(parsed, 'task_name') ||
            (Object.hasOwn(parsed, 'resumedAgentId') && Object.hasOwn(parsed, 'success')) ||
            (Object.hasOwn(parsed, 'agentId') && Object.hasOwn(parsed, 'isAsync')))
        )
          metadata(parsed);
      } catch {}
      if (value.startsWith('Async agent launched successfully.')) {
        const child = /^agentId: ([A-Za-z0-9_-]+) \(internal ID -/m.exec(value)?.[1];
        if (child) fields.child.push(child);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) text(item);
    } else if (value !== null && typeof value === 'object' && value.type === 'text') text(value.text ?? null);
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) metadata(value);
  else text(value);
  return fields;
}
function executionResult(
  record: DispatchRecord,
  dispatch: Dispatch,
  report: ExecutionReport,
  historical = false,
): Pick<Execution, 'result' | 'reason'> {
  const outcome = report.outcome;
  const mismatch = (reason: string) => ({ result: 'mismatch' as const, reason });
  if (outcome.result === 'unsupported') return { result: 'unsupported', reason: outcome.error };
  const call = report.call as NativeCall;
  const args = call.arguments;
  const resume = dispatch.action === 'resume';
  const claude = record.host === 'claude';
  const tool = resume
    ? claude
      ? 'SendMessage'
      : 'collaboration.followup_task'
    : claude
      ? 'Agent'
      : 'collaboration.spawn_agent';
  if (call.tool !== tool) return mismatch(`the ${dispatch.action} action needs ${tool}`);
  const prompt = args[resume || !claude ? 'message' : 'prompt'];
  if (typeof prompt !== 'string' || prompt.split('\n', 1)[0] !== dispatch.line)
    return mismatch('the first message line must equal the issued CAP line');
  if (resume) {
    if (
      historical
        ? args[claude ? 'to' : 'target'] !== dispatch.child
        : !followupAddress(record, dispatch, args[claude ? 'to' : 'target'])
    )
      return mismatch(`the follow-up needs recorded child ${dispatch.child}`);
    for (const key of ['model', 'effort', 'reasoning_effort', 'fork_turns', 'fork'])
      if (Object.hasOwn(args, key)) return mismatch(`the follow-up tool has no ${key} control`);
  } else {
    if (
      claude
        ? !isText(args.subagent_type) || args.subagent_type === 'fork' || args.fork === true
        : args.fork_turns !== 'none'
    )
      return mismatch('the spawn must use an isolated child');
    if (dispatch.pair.model === null ? Object.hasOwn(args, 'model') : args.model !== dispatch.pair.model)
      return mismatch(`the spawn model must be ${dispatch.pair.model ?? 'omitted'}`);
    if (args[claude ? 'effort' : 'reasoning_effort'] !== dispatch.pair.effort)
      return mismatch(`the spawn effort must be ${dispatch.pair.effort}`);
  }
  const native = nativeFields(call.result);
  if (outcome.result === 'failed') {
    if (native.child.some(isChildId)) return mismatch('the result names a worker despite noWorkerStarted');
    return { result: 'failed', reason: null };
  }
  if (outcome.result !== 'started') return { result: 'incomplete', reason: outcome.error };
  if (!isChildId(outcome.child))
    return {
      result: 'incomplete',
      reason: 'the native result has no usable worker identity; dependent work must stop',
    };
  for (const key of ['child', 'model', 'effort'] as const) {
    if (native[key].some((value) => value !== outcome[key]))
      return mismatch(`the reported ${key} contradicts the native result`);
  }
  if (outcome.effort !== null && outcome.effort !== dispatch.pair.effort)
    return mismatch(`the native effort must be ${dispatch.pair.effort}`);
  if (resume && outcome.child !== dispatch.child) return mismatch(`the reported child must be ${dispatch.child}`);
  if (!resume && record.dispatches.some((prior) => prior.id !== dispatch.id && workerOf(prior) === outcome.child))
    return mismatch(`a spawn cannot reuse recorded worker ${outcome.child}`);
  return { result: 'started', reason: null };
}
export function reportExecution(
  record: DispatchRecord,
  input: { dispatch: string; report: ExecutionReport },
  context: Context,
): { record: DispatchRecord; result: Result } {
  const report = validateExecutionReport(input.report);
  record = structuredClone(record);
  const dispatch = record.dispatches.find((dispatch) => dispatch.id === input.dispatch);
  const key = dispatch ?? { issue: 1, task: 'final' };
  if (!dispatch) return { record, result: refused(record, key, `unknown dispatch ${input.dispatch}`) };
  if (dispatch.execution !== null || dispatch.voided)
    return { record, result: refused(record, dispatch, `dispatch ${dispatch.id} already has execution evidence`) };
  dispatch.execution = {
    provenance: 'agent-reported',
    report,
    ...executionResult(record, dispatch, report),
    time: context.now(),
  };
  const result = dispatch.execution.result;
  return {
    record,
    result:
      result === 'started' || result === 'failed'
        ? { status: 'reported', dispatch: dispatch.id, result }
        : refused(record, dispatch, `dispatch ${dispatch.id}: ${dispatch.execution.reason}`, 'setup'),
  };
}
