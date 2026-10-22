import { isAbsolute } from 'node:path';

export const CONTRACT = 1;

const STATES = ['ready', 'starting', 'stuck', 'dirty', 'blocked', 'done'];
const NEEDS = { ready: 'step', stuck: 'step', dirty: 'path', blocked: 'reason', done: 'closedAt' };
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const LANE = 'a lane of flow.lanes';
const STEP = 'a step of any lane';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value) => typeof value === 'string';
const kind = (text, test) => ({ text, test });
const oneOf = (...values) =>
  kind(`one of ${values.map((value) => JSON.stringify(value)).join(', ')}`, (value) => values.includes(value));

const STRING = kind('a string', isString);
const TEXT = kind('a string with one character or more', (value) => isString(value) && value.length > 0);
const BOOLEAN = kind('a boolean', (value) => typeof value === 'boolean');
const OBJECT = kind('an object', isObject);
const ARRAY = kind('an array', Array.isArray);
const INTEGER = kind('an integer', Number.isInteger);
const COUNT = kind('an integer from 1', (value) => Number.isSafeInteger(value) && value >= 1);
const NAME = kind('a name of lowercase letters only', (value) => isString(value) && /^[a-z]+$/.test(value));
const STEPS = kind('a list of one step or more', (value) => Array.isArray(value) && value.length > 0);
const URL = kind('an https:// or http:// URL', (value) => isString(value) && /^https?:\/\//.test(value));
const PATH = kind('an absolute path', (value) => isString(value) && isAbsolute(value));
const TIME = kind(
  'an ISO 8601 time',
  (value) => isString(value) && ISO_TIME.test(value) && !Number.isNaN(Date.parse(value)),
);
const GATE = oneOf('me', 'auto');
const CHECKS = oneOf('pass', 'fail', 'pending');
const REVIEWS = oneOf('approved', 'changes', 'required');

const reporter = () => {
  const failures = [];
  const fail = (place, rule) => {
    failures.push(`${place}: ${rule}`);
    return false;
  };
  const field = (place, value, { text, test }, optional = false) =>
    (optional && value == null) || test(value) || fail(place, `is not ${text}${optional ? ' or null' : ''}`);
  const known = (names, place, value, what) =>
    names === null || names.has(value) || fail(place, `${JSON.stringify(value)} is not ${what}`);
  const once = (seen, place, value, where) => {
    if (seen.has(value)) return fail(place, `${JSON.stringify(value)} is in ${where} two times`);
    seen.add(value);
    return true;
  };
  return { failures, fail, field, known, once };
};

const checkFlow = (flow, { field, known, once }) => {
  const names = { laneKeys: null, stepNames: null };
  if (field('flow.lanes', flow.lanes, OBJECT)) {
    names.laneKeys = new Set();
    names.stepNames = new Set();
    for (const [key, steps] of Object.entries(flow.lanes)) {
      const at = `flow.lanes.${key}`;
      if (field(at, key, NAME)) names.laneKeys.add(key);
      if (!field(at, steps, STEPS)) continue;
      const inLane = new Set();
      steps.forEach((step, index) => {
        const place = `${at}[${index}]`;
        if (field(place, step, NAME) && once(inLane, place, step, 'the lane')) names.stepNames.add(step);
      });
    }
  }
  if (field('flow.stages', flow.stages, ARRAY)) {
    const inStages = new Set();
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
    for (const [name, entry] of Object.entries(flow.steps)) {
      const at = `flow.steps.${name}`;
      known(names.stepNames, at, name, STEP);
      if (!field(at, entry, OBJECT)) continue;
      field(`${at}.gate`, entry.gate, GATE, true);
      field(`${at}.hint`, entry.hint, STRING, true);
    }
  }
  return names;
};

const checkIssue = (issue, at, seen, { fail, field, known }, { laneKeys, stepNames }) => {
  if (!field(at, issue, OBJECT)) return;
  const { state } = issue;
  const stateKnown = STATES.includes(state);
  const own = (name, rule, always = false) => {
    const place = `${at}.${name}`;
    const needed = stateKnown && NEEDS[state] === name;
    if (needed && issue[name] == null) return fail(place, `is required for state ${state}`);
    return field(place, issue[name], rule, !always && !needed);
  };

  if (own('number', COUNT, true)) {
    if (seen.has(issue.number)) fail(`${at}.number`, 'is the number of an earlier row');
    seen.add(issue.number);
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

const hasOtherContract = (doc) => Number.isInteger(doc?.contract) && doc.contract !== CONTRACT;

export const check = (doc) => {
  if (!isObject(doc)) return ['document: is not an object'];
  if (hasOtherContract(doc)) return [`the data has contract ${doc.contract}; this board reads contract ${CONTRACT}`];
  const report = reporter();
  report.field('contract', doc.contract, INTEGER);
  report.field('tracker', doc.tracker, TEXT);
  const names = checkFlow(isObject(doc.flow) ? doc.flow : {}, report);
  report.field('noRun', doc.noRun, TEXT, true);
  report.field('runner', doc.runner, BOOLEAN, true);
  if (doc.agents != null && report.field('agents', doc.agents, OBJECT)) {
    for (const [name, entry] of Object.entries(doc.agents)) {
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
    const seen = new Set();
    doc.issues.forEach((issue, index) => checkIssue(issue, `issues[${index}]`, seen, report, names));
  }
  return report.failures;
};

export const readDocument = (text) => {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { doc: null, failures: ['the data is not JSON'], isOtherContract: false };
  }
  const failures = check(doc);
  return { doc: failures.length > 0 ? null : doc, failures, isOtherContract: hasOtherContract(doc) };
};
