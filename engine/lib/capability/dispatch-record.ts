import { z } from 'zod';
import type { Host } from '../config/core.ts';
import type { DispatchStatus } from '../contract/contract.ts';
import { isHost } from '../host/names.ts';
import { code, count, issueKey, lowerUuid } from '../state/schemas.ts';
import { type IssueKey, isKey, parseKey } from '../tracker/key.ts';
import { isLevel, type Level } from '../workflow/effort.ts';
import { type Pair, pairText, ScoreError, scoreLabel } from './capability.ts';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type Schema = 1 | 2 | 3;
const taskId = /^(?:[1-9]\d*|final|verify-[1-9]\d*|land-[1-9]\d*)$/;
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !value.includes('\0');
const isChildId = (value: unknown): value is string => isText(value) && value.trim().length > 0;
const isTask = (value: unknown): value is string => isText(value) && taskId.test(value) && !value.endsWith('\n');
const isPlain = (value: unknown): value is object =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const plain = <T extends z.core.$ZodShape>(shape: T) => z.custom<object>(isPlain).pipe(z.strictObject(shape));
const range = (min: number, max: number) => z.int().min(min).max(max);
const text = z.custom<string>(isText);
const nullableText = text.nullable();
const effort = z.custom<Level>(isLevel);

function forward(ctx: z.core.$RefinementCtx, schema: z.ZodType, value: unknown, path: PropertyKey[] = []): void {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: [...path, ...issue.path] });
}

const role = z.enum(['implementer', 'reviewer']);
const action = z.enum(['spawn', 'resume', 'replace']);
const digits = z.custom<unknown[]>((value) => Array.isArray(value) && value.length === 6).pipe(z.array(range(0, 2)));
const scoreFields = { digits, bias: code };
const score = plain(scoreFields);
const scoreEntry = plain({ kind: z.literal('score'), ...scoreFields, time: text });
const dispatchEntry = plain({ kind: z.literal('dispatch'), id: lowerUuid });
const gateEntry = plain({
  kind: z.literal('gate'),
  result: z.enum(['pass', 'fail']),
  name: text,
  report: text,
  time: text,
});
const reviewEntry = plain({ kind: z.literal('review'), result: z.enum(['findings', 'blocked']), time: text });
const entry = z
  .custom<
    | z.output<typeof scoreEntry>
    | z.output<typeof dispatchEntry>
    | z.output<typeof gateEntry>
    | z.output<typeof reviewEntry>
  >()
  .superRefine((value: unknown, ctx) => {
    if (typeof value !== 'object' || value === null) return void ctx.addIssue({ code: 'custom' });
    switch ((value as { kind?: unknown }).kind) {
      case 'score':
        return forward(ctx, scoreEntry, value);
      case 'dispatch':
        return forward(ctx, dispatchEntry, value);
      case 'gate':
        return forward(ctx, gateEntry, value);
      case 'review':
        return forward(ctx, reviewEntry, value);
      default:
        ctx.addIssue({ code: 'custom', path: ['kind'] });
    }
  });
const pair = plain({
  rank: range(0, 3),
  model: nullableText,
  effort,
  runtime: nullableText,
  reviewer: z.boolean(),
});

const nativeCall = plain({
  tool: text,
  arguments: z.custom<{ [key: string]: JsonValue }>(
    (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
  ),
  result: z.unknown(),
});
const startedOutcome = plain({
  result: z.literal('started'),
  child: z.string().nullable(),
  model: nullableText,
  effort: effort.nullable(),
});
const failedOutcome = plain({ result: z.literal('failed'), noWorkerStarted: z.literal(true), error: text });
const stoppedOutcome = plain({ result: z.unknown(), error: text }).refine(
  (outcome): outcome is { result: 'incomplete' | 'unsupported'; error: string } =>
    outcome.result === 'incomplete' || outcome.result === 'unsupported',
  { path: ['result'] },
);
const outcomeSchemaOf = (value: unknown) => {
  const result = typeof value === 'object' && value !== null ? (value as { result?: unknown }).result : undefined;
  return result === 'started' ? startedOutcome : result === 'failed' ? failedOutcome : stoppedOutcome;
};
const outcome = z
  .custom<z.output<typeof startedOutcome> | z.output<typeof failedOutcome> | z.output<typeof stoppedOutcome>>()
  .superRefine((value, ctx) => forward(ctx, outcomeSchemaOf(value), value));
const callRule = (
  report: { call: z.output<typeof nativeCall> | null; outcome: { result: string } | null | undefined },
  ctx: z.core.$RefinementCtx,
) => {
  if (report.outcome?.result !== 'unsupported') return forward(ctx, nativeCall, report.call, ['call']);
  if (report.call !== null) ctx.addIssue({ code: 'custom', path: ['call'] });
};
const call = z.custom<z.output<typeof nativeCall> | null>();
export const executionReport = plain({ call, outcome }).superRefine(callRule);
const historicalReport = plain({ host: z.custom<Host>(isHost), session: text, call, outcome }).superRefine(callRule);

const executionSchema = <T extends z.ZodType>(report: T) =>
  plain({
    provenance: z.literal('agent-reported'),
    report,
    result: z.enum(['started', 'failed', 'incomplete', 'mismatch', 'unsupported']),
    reason: nullableText,
    time: text,
  }).refine(
    (execution) =>
      execution.result === 'started' || execution.result === 'failed'
        ? execution.reason === null
        : execution.reason !== null,
    { path: ['reason'] },
  );
const dispatchSchema = <I extends z.ZodType, T extends z.ZodType>(issue: I, report: T) =>
  plain({
    id: lowerUuid,
    issue,
    task: z.custom<string>(isTask),
    role,
    action,
    child: nullableText,
    attempt: range(1, 3),
    round: range(0, 5),
    level: range(1, 3),
    pair,
    line: text,
    issued: text,
    execution: executionSchema(report).nullable(),
    voided: z.boolean(),
  }).superRefine((dispatch, ctx) => {
    const fail = (...path: string[]) => ctx.addIssue({ code: 'custom', path });
    if (dispatch.action !== 'resume' && dispatch.child !== null) fail('child');
    if (dispatch.pair.reviewer !== (dispatch.role === 'reviewer')) fail('pair', 'reviewer');
    if (dispatchIdOf(dispatch.line) !== dispatch.id || dispatch.line.includes('\n')) fail('line');
    if (dispatch.voided && dispatch.execution?.result !== 'failed') fail('voided');
  });
const taskSchema = <I extends z.ZodType>(issue: I) =>
  plain({
    issue,
    task: z.custom<string>(isTask),
    attempt: range(1, 4),
    round: range(0, 5),
    escalated: z.boolean(),
    closed: z.boolean(),
    entries: z.array(entry).refine((entries) => entries[0]?.kind === 'score', { path: [0] }),
  });
const recordSchema = <V extends Schema, I extends z.ZodType, T extends z.ZodType>(version: V, issue: I, report: T) =>
  plain({
    schema: z.literal(version),
    host: z.custom<Host>(isHost),
    session: text,
    tasks: z.array(taskSchema(issue)).superRefine((tasks, ctx) => {
      const keys = new Set<string>();
      for (const [index, task] of (tasks as { issue: unknown; task: string }[]).entries()) {
        const key = `${task.issue}:${task.task}`;
        if (keys.has(key)) ctx.addIssue({ code: 'custom', path: [index] });
        keys.add(key);
      }
    }),
    dispatches: z.array(dispatchSchema(issue, report)),
  });
export const dispatchRecord = recordSchema(3, issueKey, executionReport);
const historicalRecords = { 1: recordSchema(1, count, historicalReport), 2: recordSchema(2, count, executionReport) };

export type Role = z.output<typeof role>;
export type Action = z.output<typeof action>;
export type Score = z.output<typeof score>;
export type NativeCall = z.output<typeof nativeCall>;
export type ExecutionReport = z.output<typeof executionReport>;
export type DispatchRecord = z.output<typeof dispatchRecord>;
export type Task = DispatchRecord['tasks'][number];
export type Entry = Task['entries'][number];
export type Dispatch = DispatchRecord['dispatches'][number];
export type Execution = NonNullable<Dispatch['execution']>;

type Refusal = Exclude<DispatchStatus, 'ready' | 'reported' | 'closed'>;
export type Result =
  | { status: Extract<DispatchStatus, 'reported'>; dispatch: string; result: 'started' | 'failed' }
  | { status: Extract<DispatchStatus, 'ready'>; dispatch: Dispatch; voided: string[] }
  | { status: Extract<DispatchStatus, 'closed'>; issue: IssueKey; task: string }
  | { status: Refusal; issue: IssueKey; task: string; reason: string; trail: unknown[] | null };
export interface Context {
  resolve(score: Score, level: number, reviewer: boolean): Pair | null;
  id(): string;
  now(): string;
}
export class DispatchError extends Error {}

type Key = { issue: IssueKey; task: string };
function need(condition: unknown, field: string): asserts condition {
  if (!condition) throw new DispatchError(`invalid ${field}`);
}
function pathOf(issue: z.core.$ZodIssue, value: unknown, root: string): string {
  const segments: PropertyKey[] = [...issue.path];
  if (issue.code === 'unrecognized_keys') segments.push(issue.keys[0] as string);
  let base = root;
  if (root === '' && segments[0] === 'dispatches' && segments[2] === 'execution' && segments[3] === 'report') {
    const dispatches = (value as { dispatches: { execution: object }[] }).dispatches;
    if (segments.length > 4 || Object.hasOwn(dispatches[segments[1] as number]?.execution as object, 'report')) {
      base = 'report';
      segments.splice(0, 4);
    }
  }
  return segments.reduce<string>(
    (path, segment) =>
      typeof segment === 'number' ? `${path}[${segment}]` : path ? `${path}.${String(segment)}` : String(segment),
    base,
  );
}
function check<T extends z.ZodType>(schema: T, value: unknown, root: string): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new DispatchError(`invalid ${pathOf(parsed.error.issues[0] as z.core.$ZodIssue, value, root)}`);
  return parsed.data;
}
function keyValue(value: Key): void {
  need(isKey(value.issue), 'issue');
  need(isTask(value.task), 'task');
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

export function validateExecutionReport(value: unknown): ExecutionReport {
  jsonValue(value, 'report');
  check(executionReport, value, 'report');
  return structuredClone(value as ExecutionReport);
}
function walkReports(value: unknown): void {
  if (!isPlain(value) || !Array.isArray((value as { dispatches?: unknown }).dispatches)) return;
  for (const dispatch of (value as { dispatches: unknown[] }).dispatches) {
    if (!isPlain(dispatch) || !Object.hasOwn(dispatch, 'execution')) continue;
    const execution = (dispatch as { execution: unknown }).execution;
    if (isPlain(execution) && Object.hasOwn(execution, 'report'))
      jsonValue((execution as { report: unknown }).report, 'report');
  }
}
export function emptyRecord(host: Host, session: string): DispatchRecord {
  need(isHost(host), 'host');
  need(isText(session), 'session');
  return { schema: 3, host, session, tasks: [], dispatches: [] };
}
function recordValue(value: unknown, host: Host, session: string, schema: Schema): DispatchRecord {
  const historical = schema === 1;
  walkReports(value);
  const typed = check(schema === 3 ? dispatchRecord : historicalRecords[schema], value, '') as DispatchRecord;
  need(typed.host === host, 'host');
  need(typed.session === session, 'session');
  const keys = new Set(typed.tasks.map((task) => `${task.issue}:${task.task}`));
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
  return structuredClone(value as DispatchRecord);
}
export function validateRecord(value: unknown, host: Host, session: string): DispatchRecord {
  return recordValue(value, host, session, 3);
}
export function convertDispatchRecord(value: unknown, host: Host, session: string, schema: 1 | 2): DispatchRecord {
  const record = recordValue(value, host, session, schema);
  const key = (issue: unknown, path: string) => {
    const parsed = parseKey(String(issue));
    need(parsed !== null, path);
    return parsed;
  };
  for (const [index, task] of record.tasks.entries()) task.issue = key(task.issue, `tasks[${index}].issue`);
  for (const [index, dispatch] of record.dispatches.entries()) {
    dispatch.issue = key(dispatch.issue, `dispatches[${index}].issue`);
    if (!dispatch.execution || schema !== 1) continue;
    const { call, outcome } = dispatch.execution.report;
    dispatch.execution.report = { call, outcome };
  }
  record.schema = 3;
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
    const result = spawnCall(prior)?.result as JsonValue | undefined;
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
  need(lowerUuid.safeParse(id).success && !record.dispatches.some((dispatch) => dispatch.id === id), 'dispatch.id');
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
  check(score, input.score, 'score');
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
    const model = Object.hasOwn(value, 'resolvedModel') ? 'resolvedModel' : 'model';
    if (Object.hasOwn(value, model)) fields.model.push(value[model] as JsonValue);
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
  const native = nativeFields(call.result as JsonValue);
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
  const key = dispatch ?? { issue: '1' as IssueKey, task: 'final' };
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
