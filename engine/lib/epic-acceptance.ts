import { revision } from './fields.ts';
import { parseAllDocuments } from './vendor/yaml.mjs';
import type {
  AcceptedEpic,
  AcceptedEpicResult,
  EpicAcceptance,
  EpicChild,
  EpicDeclaration,
  EpicResult,
  EpicScenario,
  EpicSource,
  EpicSubmission,
  EpicTarget,
} from './workflow.ts';

function object(value: unknown, fields: readonly string[], path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: need an object`);
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).find((key) => !fields.includes(key));
  if (unknown !== undefined) throw new Error(`${path}: unknown field ${unknown}`);
  for (const key of fields) {
    if (!Object.hasOwn(record, key)) throw new Error(`${path}.${key}: missing field`);
  }
  return record;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
    throw new Error(`${path}: need a nonblank, NUL-free string`);
  }
  return value;
}

function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${path}: need a positive safe integer`);
  }
  return value;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path}: need an array`);
  return value;
}

function nonempty<T>(values: T[], path: string): T[] {
  if (values.length === 0) throw new Error(`${path}: must not be empty`);
  return values;
}

function unique<T>(values: T[], key: (value: T) => string | number, path: string): T[] {
  if (new Set(values.map(key)).size !== values.length) throw new Error(`${path}: duplicate identity`);
  return values;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function json(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const documents = parseAllDocuments(text, { uniqueKeys: true });
  const error = documents.flatMap((document) => document.errors)[0];
  if (error) throw new Error(`invalid JSON object: ${error.message.split('\n')[0]}`);
  return value;
}

function timestamp(value: unknown, path: string): string {
  const text = string(value, path);
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(text);
  if (
    !match ||
    !Number.isFinite(Date.parse(text)) ||
    new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) !== match[1] ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4]) > 59 ||
    Number(match[6] ?? 0) > 23 ||
    Number(match[7] ?? 0) > 59
  ) {
    throw new Error(`${path}: need an ISO timestamp`);
  }
  return text;
}

function digest(value: unknown, path: string): string {
  const text = string(value, path);
  if (!/^[0-9a-f]{64}$/.test(text)) throw new Error(`${path}: need a SHA-256 digest`);
  return text;
}

export function parseEpicRepository(value: unknown): string {
  const text = string(value, 'repository');
  const url = new URL(text);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.href !== text ||
    !/^\/[\w.-]+\/[\w.-]+$/.test(url.pathname)
  ) {
    throw new Error('repository: need a canonical repository URL');
  }
  return text;
}

function issueUrl(value: unknown, path: string): { url: string; number: number } {
  const url = string(value, path);
  const match = /^(.*)\/issues\/([1-9]\d*)$/.exec(url);
  if (!match) throw new Error(`${path}: need a canonical issue URL`);
  parseEpicRepository(match[1]);
  return { url, number: integer(Number(match[2]), path) };
}

export function parseEpicChildren(value: unknown): EpicChild[] {
  const children = array(value, 'children').map((raw, index): EpicChild => {
    const path = `children[${index}]`;
    const child = object(raw, ['url', 'id', 'number', 'state', 'stateReason', 'closedAt'], path);
    const { url, number } = issueUrl(child.url, `${path}.url`);
    if (integer(child.number, `${path}.number`) !== number) throw new Error(`${path}: URL and number differ`);
    if (child.state !== 'open' && child.state !== 'closed') throw new Error(`${path}.state: need open or closed`);
    const reason = child.stateReason;
    if (
      reason !== null &&
      reason !== 'completed' &&
      reason !== 'not_planned' &&
      reason !== 'duplicate' &&
      reason !== 'reopened'
    ) {
      throw new Error(`${path}.stateReason: invalid state reason`);
    }
    const closedAt = child.closedAt === null ? null : timestamp(child.closedAt, `${path}.closedAt`);
    if ((child.state === 'closed') !== (closedAt !== null)) throw new Error(`${path}: state and closedAt differ`);
    return { url, id: integer(child.id, `${path}.id`), number, state: child.state, stateReason: reason, closedAt };
  });
  unique(children, (child) => child.url, 'children');
  unique(children, (child) => child.id, 'children');
  return children.sort((a, b) => compare(a.url, b.url));
}

const scenarioFields = [
  'name',
  'criterion',
  'children',
  'setup',
  'preparation',
  'target',
  'expected',
  'timing',
  'sourceToFiles',
  'filesToTarget',
  'oracle',
] as const;

function acceptance(value: unknown): EpicAcceptance {
  const mode = value !== null && typeof value === 'object' && 'mode' in value ? value.mode : undefined;
  if (mode === 'independent') {
    const data = object(value, ['mode', 'rationale'], 'acceptance');
    return { mode, rationale: string(data.rationale, 'acceptance.rationale') };
  }
  if (mode !== 'combined') throw new Error('acceptance.mode: need independent or combined');
  const data = object(value, ['mode', 'scenarios'], 'acceptance');
  const scenarios = nonempty(array(data.scenarios, 'scenarios'), 'scenarios').map((raw, index): EpicScenario => {
    const path = `scenarios[${index}]`;
    const scenario = object(raw, scenarioFields, path);
    const children = nonempty(array(scenario.children, `${path}.children`), `${path}.children`).map(
      (child) => issueUrl(child, `${path}.children`).url,
    );
    unique(children, (child) => child, `${path}.children`);
    return {
      name: string(scenario.name, `${path}.name`),
      criterion: string(scenario.criterion, `${path}.criterion`),
      children,
      setup: string(scenario.setup, `${path}.setup`),
      preparation: string(scenario.preparation, `${path}.preparation`),
      target: string(scenario.target, `${path}.target`),
      expected: string(scenario.expected, `${path}.expected`),
      timing: string(scenario.timing, `${path}.timing`),
      sourceToFiles: string(scenario.sourceToFiles, `${path}.sourceToFiles`),
      filesToTarget: string(scenario.filesToTarget, `${path}.filesToTarget`),
      oracle: string(scenario.oracle, `${path}.oracle`),
    };
  });
  unique(scenarios, (scenario) => scenario.name, 'scenarios');
  return { mode, scenarios };
}

function sectionOf(body: string): string {
  const lines = body.split('\n');
  const sections: string[] = [];
  let start: number | null = null;
  let fence: { character: string; length: number } | null = null;
  for (const [index, line] of lines.entries()) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const ticks = delimiter?.[1];
    const tail = delimiter?.[2] ?? '';
    if (fence) {
      if (ticks && ticks.charAt(0) === fence.character && ticks.length >= fence.length && !tail.trim()) {
        fence = null;
      }
      continue;
    }
    if (ticks) {
      fence = { character: ticks.charAt(0), length: ticks.length };
      continue;
    }
    if (!line.startsWith('## ')) continue;
    if (start !== null) {
      sections.push(`${lines.slice(start, index).join('\n')}\n`);
      start = null;
    }
    if (/^## Epic acceptance[ \t]*$/.test(line)) start = index;
  }
  if (start !== null) sections.push(lines.slice(start).join('\n'));
  const [section] = sections;
  if (sections.length !== 1 || section === undefined)
    throw new Error('need exactly one top-level ## Epic acceptance section');
  return section;
}

export function parseEpicAcceptance(body: string | null): EpicDeclaration {
  try {
    const section = sectionOf((body ?? '').replaceAll('\r\n', '\n'));
    const content = section.slice(section.indexOf('\n') + 1);
    const fenced = /^\s*```json\n([\s\S]*?)\n```[ \t]*(?:\n\s*)?$/.exec(content)?.[1];
    if (fenced === undefined) throw new Error('acceptance: need one bounded json fence and no other content');
    return {
      kind: 'valid',
      acceptance: acceptance(json(fenced)),
      definitionHash: new Bun.CryptoHasher('sha256').update(section).digest('hex'),
    };
  } catch (error) {
    return { kind: 'unresolved', reason: error instanceof Error ? error.message : String(error) };
  }
}

function target(value: unknown, index: number): EpicTarget {
  const path = `targets[${index}]`;
  const data = object(value, ['name', 'source', 'runtime', 'sourceToFiles', 'filesToTarget'], path);
  const raw = data.source;
  const dirty = raw !== null && typeof raw === 'object' && 'dirty' in raw ? raw.dirty : undefined;
  if (typeof dirty !== 'boolean') throw new Error(`${path}.source.dirty: need a boolean`);
  const source = object(
    raw,
    dirty ? ['checkout', 'commit', 'dirty', 'snapshot'] : ['checkout', 'commit', 'dirty'],
    `${path}.source`,
  );
  const checkout = string(source.checkout, `${path}.source.checkout`);
  const commit = string(source.commit, `${path}.source.commit`);
  if (!revision.test(commit)) throw new Error(`${path}.source.commit: need a full commit`);
  const parsed: EpicSource = dirty
    ? { checkout, commit, dirty, snapshot: string(source.snapshot, `${path}.source.snapshot`) }
    : { checkout, commit, dirty };
  return {
    name: string(data.name, `${path}.name`),
    source: parsed,
    runtime: string(data.runtime, `${path}.runtime`),
    sourceToFiles: string(data.sourceToFiles, `${path}.sourceToFiles`),
    filesToTarget: string(data.filesToTarget, `${path}.filesToTarget`),
  };
}

function result(value: unknown, index: number): EpicResult {
  const path = `results[${index}]`;
  const status = value !== null && typeof value === 'object' && 'result' in value ? value.result : undefined;
  if (status === 'inapplicable') {
    const data = object(value, ['scenario', 'result', 'rationale', 'decision'], path);
    return {
      scenario: string(data.scenario, `${path}.scenario`),
      result: status,
      rationale: string(data.rationale, `${path}.rationale`),
      decision: integer(data.decision, `${path}.decision`),
    };
  }
  if (status !== 'PASS' && status !== 'FAIL' && status !== 'BLOCKED' && status !== 'unrun' && status !== 'UNVERIFIED') {
    throw new Error(`${path}.result: invalid result`);
  }
  const data = object(
    value,
    status === 'PASS'
      ? ['scenario', 'result', 'target', 'observation', 'oracle', 'reports']
      : ['scenario', 'result', 'reason', 'reports'],
    path,
  );
  const reports = nonempty(array(data.reports, `${path}.reports`), `${path}.reports`).map((id) =>
    integer(id, `${path}.reports`),
  );
  unique(reports, (id) => id, `${path}.reports`);
  const scenario = string(data.scenario, `${path}.scenario`);
  return status === 'PASS'
    ? {
        scenario,
        result: status,
        target: string(data.target, `${path}.target`),
        observation: string(data.observation, `${path}.observation`),
        oracle: string(data.oracle, `${path}.oracle`),
        reports,
      }
    : { scenario, result: status, reason: string(data.reason, `${path}.reason`), reports };
}

const submissionFields = ['repository', 'parent', 'definitionHash', 'children', 'review', 'targets', 'results'];

function submission(data: Record<string, unknown>): EpicSubmission {
  const review = object(data.review, ['session', 'at'], 'review');
  const targets = array(data.targets, 'targets').map(target);
  unique(targets, (target) => target.name, 'targets');
  return {
    repository: parseEpicRepository(data.repository),
    parent: integer(data.parent, 'parent'),
    definitionHash: digest(data.definitionHash, 'definitionHash'),
    children: parseEpicChildren(data.children),
    review: { session: string(review.session, 'review.session'), at: timestamp(review.at, 'review.at') },
    targets,
    results: array(data.results, 'results').map(result),
  };
}

export function parseEpicSubmission(text: string): EpicSubmission {
  return submission(object(json(text), submissionFields, 'submission'));
}

export function parseAcceptedEpic(text: string): AcceptedEpic & { completionId: string } {
  const data = object(json(text), [...submissionFields, 'mode', 'completionId'], 'accepted');
  const evidence = submission(data);
  let accepted: AcceptedEpic;
  if (data.mode === 'independent') {
    if (evidence.targets.length || evidence.results.length)
      throw new Error('independent acceptance has no targets or results');
    accepted = { ...evidence, mode: 'independent', targets: [], results: [] };
  } else if (data.mode === 'combined') {
    const results = evidence.results.filter(
      (result): result is AcceptedEpicResult => result.result === 'PASS' || result.result === 'inapplicable',
    );
    if (results.length !== evidence.results.length || !results.length)
      throw new Error('combined acceptance needs accepted results');
    accepted = { ...evidence, mode: 'combined', results };
  } else {
    throw new Error('accepted.mode: need independent or combined');
  }
  const completionId = digest(data.completionId, 'completionId');
  if (completionId !== completionIdentity(accepted)) throw new Error('accepted.completionId: does not match record');
  return { ...accepted, completionId };
}

export function completionIdentity(record: AcceptedEpic): string {
  const value = {
    repository: record.repository,
    parent: record.parent,
    mode: record.mode,
    definitionHash: record.definitionHash,
    children: [...record.children]
      .sort((a, b) => compare(a.url, b.url))
      .map((child) => ({
        url: child.url,
        id: child.id,
        number: child.number,
        state: child.state,
        stateReason: child.stateReason,
        closedAt: child.closedAt,
      })),
    targets: [...record.targets]
      .sort((a, b) => compare(a.name, b.name))
      .map((target) => ({
        name: target.name,
        source: target.source.dirty
          ? {
              checkout: target.source.checkout,
              commit: target.source.commit,
              dirty: true,
              snapshot: target.source.snapshot,
            }
          : { checkout: target.source.checkout, commit: target.source.commit, dirty: false },
        runtime: target.runtime,
        sourceToFiles: target.sourceToFiles,
        filesToTarget: target.filesToTarget,
      })),
    results: [...record.results]
      .sort((a, b) => compare(a.scenario, b.scenario))
      .map((result) =>
        result.result === 'PASS'
          ? {
              scenario: result.scenario,
              result: result.result,
              target: result.target,
              observation: result.observation,
              oracle: result.oracle,
              reports: [...result.reports].sort((a, b) => a - b),
            }
          : {
              scenario: result.scenario,
              result: result.result,
              rationale: result.rationale,
              decision: result.decision,
            },
      ),
  };
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}
