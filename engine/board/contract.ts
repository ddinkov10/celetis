import type { Document } from './types.ts';

type Json = Record<string, unknown>;
type Rule<T = unknown> = { text: string; test: (value: unknown) => value is T };

import { isAbsolute } from 'node:path';

export const CONTRACT = 1;

const STATES = ['ready', 'starting', 'stuck', 'dirty', 'blocked', 'done'];
const NEEDS: Record<string, string> = {
  ready: 'step',
  stuck: 'step',
  dirty: 'path',
  blocked: 'reason',
  done: 'closedAt',
};
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const LANE = 'a lane of flow.lanes';
const STEP = 'a step of any lane';

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const kind = <T = unknown>(text: string, test: (value: unknown) => boolean): Rule<T> => ({
  text,
  test: (value: unknown): value is T => test(value),
});
const oneOf = (...values: string[]) =>
  kind(`one of ${values.map((value) => JSON.stringify(value)).join(', ')}`, (value) =>
    values.includes(value as string),
  );

const STRING = kind<string>('a string', isString);
const TEXT = kind<string>('a string with one character or more', (value) => isString(value) && value.length > 0);
const BOOLEAN = kind<boolean>('a boolean', (value) => typeof value === 'boolean');
const OBJECT = kind<Json>('an object', isObject);
const ARRAY = kind<unknown[]>('an array', Array.isArray);
const INTEGER = kind<number>('an integer', Number.isInteger);
const COUNT = kind<number>(
  'an integer from 1',
  (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1,
);
const NAME = kind<string>('a name of lowercase letters only', (value) => isString(value) && /^[a-z]+$/.test(value));
const STEPS = kind<unknown[]>('a list of one step or more', (value) => Array.isArray(value) && value.length > 0);
const URL = kind<string>('an https:// or http:// URL', (value) => isString(value) && /^https?:\/\//.test(value));
const PATH = kind<string>('an absolute path', (value) => isString(value) && isAbsolute(value));
const TIME = kind<string>(
  'an ISO 8601 time',
  (value) => isString(value) && ISO_TIME.test(value) && !Number.isNaN(Date.parse(value)),
);
const GATE = oneOf('me', 'auto');
const CHECKS = oneOf('pass', 'fail', 'pending');
const REVIEWS = oneOf('approved', 'changes', 'required');

const reporter = () => {
  const failures: string[] = [];
  const fail = (place: string, rule: string) => {
    failures.push(`${place}: ${rule}`);
    return false;
  };
  function field<T>(place: string, value: unknown, rule: Rule<T>, optional?: false): value is T;
  function field<T>(place: string, value: unknown, rule: Rule<T>, optional: true): value is T | null | undefined;
  function field<T>(place: string, value: unknown, rule: Rule<T>, optional: boolean): value is T | null | undefined;
  function field<T>(
    place: string,
    value: unknown,
    { text, test }: Rule<T>,
    optional = false,
  ): value is T | null | undefined {
    return (optional && value == null) || test(value) || fail(place, `is not ${text}${optional ? ' or null' : ''}`);
  }
  const known = (names: Set<string> | null, place: string, value: unknown, what: string) =>
    names === null || names.has(value as string) || fail(place, `${JSON.stringify(value)} is not ${what}`);
  const once = (seen: Set<unknown>, place: string, value: unknown, where: string) => {
    if (seen.has(value)) return fail(place, `${JSON.stringify(value)} is in ${where} two times`);
    seen.add(value);
    return true;
  };
  return { failures, fail, field, known, once };
};

const checkFlow = (flow: Json, { field, known, once }: ReturnType<typeof reporter>) => {
  const names: { laneKeys: Set<string> | null; stepNames: Set<string> | null } = { laneKeys: null, stepNames: null };
  if (field('flow.lanes', flow.lanes, OBJECT)) {
    names.laneKeys = new Set();
    names.stepNames = new Set();
    for (const [key, steps] of Object.entries(flow.lanes as Json)) {
      const at = `flow.lanes.${key}`;
      if (field(at, key, NAME)) names.laneKeys.add(key);
      if (!field(at, steps, STEPS)) continue;
      const inLane = new Set<string>();
      steps.forEach((step, index) => {
        const place = `${at}[${index}]`;
        if (field(place, step, NAME) && once(inLane, place, step, 'the lane'))
          (names.stepNames as Set<string>).add(step);
      });
    }
  }
  if (field('flow.stages', flow.stages, ARRAY)) {
    const inStages = new Set<string>();
    flow.stages.forEach((stage, index) => {
      const at = `flow.stages[${index}]`;
      if (!field(at, stage, OBJECT)) return;
      field(`${at}.name`, stage.name, STRING);
      if (!field(`${at}.steps`, stage.steps, ARRAY)) return;
      stage.steps.forEach((step, i) => {
        const place = `${at}.steps[${i}]`;
        if (known(names.stepNames, place, step, STEP)) once(inStages, place, step, 'the stages');
      });
    });
  }
  field('flow.steps', flow.steps, OBJECT, true);
  if (isObject(flow.steps)) {
    for (const [name, entry] of Object.entries(flow.steps as Json)) {
      const at = `flow.steps.${name}`;
      known(names.stepNames, at, name, STEP);
      if (!field(at, entry, OBJECT)) continue;
      field(`${at}.gate`, entry.gate, GATE, true);
      field(`${at}.hint`, entry.hint, STRING, true);
    }
  }
  return names;
};

const checkIssue = (
  issue: unknown,
  at: string,
  seen: Set<number>,
  { fail, field, known }: ReturnType<typeof reporter>,
  { laneKeys, stepNames }: ReturnType<typeof checkFlow>,
) => {
  if (!field(at, issue, OBJECT)) return;
  const { state } = issue;
  const stateKnown = typeof state === 'string' && STATES.includes(state);
  const own = (name: string, rule: Rule, always = false) => {
    const place = `${at}.${name}`;
    const needed = stateKnown && NEEDS[state as string] === name;
    if (needed && issue[name] == null) return fail(place, `is required for state ${state}`);
    return field(place, issue[name], rule, !always && !needed);
  };

  if (own('number', COUNT, true)) {
    if (seen.has(issue.number as number)) fail(`${at}.number`, 'is the number of an earlier row');
    seen.add(issue.number as number);
  }
  own('title', STRING, true);
  own('url', URL);
  if (own('type', STRING) && issue.type != null) known(laneKeys, `${at}.type`, issue.type, LANE);
  if (!stateKnown) fail(`${at}.state`, `${JSON.stringify(state)} is not a state of contract ${CONTRACT}`);
  if (own('step', STRING) && issue.step != null) known(stepNames, `${at}.step`, issue.step, STEP);
  own('started', BOOLEAN);
  own('urgent', BOOLEAN);
  own('updatedAt', TIME, true);
  own('closedAt', TIME);
  own('path', PATH);
  own('reason', TEXT);
  own('act', STRING);
  own('pr', OBJECT);
  if (isObject(issue.pr)) {
    const { pr } = issue;
    field(`${at}.pr.number`, pr.number, COUNT);
    field(`${at}.pr.url`, pr.url, URL, true);
    field(`${at}.pr.draft`, pr.draft, BOOLEAN);
    field(`${at}.pr.checks`, pr.checks, CHECKS, true);
    field(`${at}.pr.review`, pr.review, REVIEWS, true);
  }
};

const hasOtherContract = (doc: unknown) => isObject(doc) && Number.isInteger(doc.contract) && doc.contract !== CONTRACT;

export const check = (doc: unknown): string[] => {
  if (!isObject(doc)) return ['document: is not an object'];
  if (hasOtherContract(doc)) return [`the data has contract ${doc.contract}; this board reads contract ${CONTRACT}`];
  const report = reporter();
  report.field('contract', doc.contract, INTEGER);
  report.field('tracker', doc.tracker, TEXT);
  const names = checkFlow(isObject(doc.flow) ? doc.flow : {}, report);
  report.field('noRun', doc.noRun, TEXT, true);
  report.field('runner', doc.runner, BOOLEAN, true);
  if (doc.agents != null && report.field('agents', doc.agents, OBJECT)) {
    for (const [name, entry] of Object.entries(doc.agents as Json)) {
      const at = `agents.${name}`;
      if (!report.field(at, name, NAME)) continue;
      if (!report.field(at, entry, OBJECT)) continue;
      if (report.field(`${at}.available`, entry.available, BOOLEAN)) {
        if (entry.available) {
          if (entry.cause !== null) report.fail(`${at}.cause`, 'is not null');
        } else {
          report.field(`${at}.cause`, entry.cause, TEXT);
        }
      }
    }
  }
  if (doc.defaultAgent != null && report.field('defaultAgent', doc.defaultAgent, NAME)) {
    if (!isObject(doc.agents) || !Object.hasOwn(doc.agents, doc.defaultAgent)) {
      report.fail('defaultAgent', `${JSON.stringify(doc.defaultAgent)} is not an agent of agents`);
    }
  }
  if (report.field('issues', doc.issues, ARRAY)) {
    const seen = new Set<number>();
    doc.issues.forEach((issue: unknown, index: number) => {
      checkIssue(issue, `issues[${index}]`, seen, report, names);
    });
  }
  return report.failures;
};

export const readDocument = (text: string): { doc: Document | null; failures: string[]; isOtherContract: boolean } => {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { doc: null, failures: ['the data is not JSON'], isOtherContract: false };
  }
  const failures = check(doc);
  return { doc: failures.length > 0 ? null : (doc as Document), failures, isOtherContract: hasOtherContract(doc) };
};
