import { createHash } from 'node:crypto';
import { isAlias, isMap, isScalar, isSeq, parseAllDocuments } from 'yaml';
import { type ExitCode, exits } from '../contract/contract.ts';

export class LessonError extends Error {
  constructor(
    readonly code: ExitCode,
    path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
  }
}
export type Evidence = { kind: 'user-report' | 'tool-output'; excerpt: string; reference?: string };
export type Diagnosis =
  | 'not-retrieved'
  | 'not-followed'
  | 'wrong-or-incomplete-rule'
  | 'failed-structural-constraint'
  | 'unknown';
export type Incident = {
  id: string;
  date: string;
  action: string;
  expected: string;
  observed: string;
  source: Evidence;
  inference: string;
  diagnosis: Diagnosis[];
  revision?: string;
  lesson?: { name: string; revision: string; digest: string };
  brief?: string;
};
export type FollowUp = {
  state: 'proposed' | 'verified' | 'not-needed';
  detail: string;
  owner?: string;
  reference?: string;
  evidence?: string;
};
export type Decision = 'approve' | 'edit' | 'merge' | 'supersede' | 'retire' | 'reject';
export type Review = {
  id: string;
  requestDigest: string;
  date: string;
  decision: Decision;
  source: string;
  related: string[];
  followUp: FollowUp;
};
type LessonFields = {
  schema: 1;
  name: string;
  description: string;
  tags: string[];
  date: string;
  source: string;
  incidents: Incident[];
  recurrences: number;
  reviews: Review[];
  body: string;
};
export type Lesson = LessonFields &
  (
    | { status: 'pending-review'; candidate: string; reason?: string; replacement?: never }
    | { status: 'active'; candidate?: never; replacement?: never; reason?: never }
    | { status: 'superseded'; candidate?: never; replacement?: string; reason: string }
  );
export type CaptureRequest = Omit<LessonFields, 'recurrences' | 'reviews'> & {
  candidate: string;
  expected: string | null;
};
export type ReviewRequest = {
  schema: 1;
  id: string;
  date: string;
  source: string;
  followUp: FollowUp;
  decision: Decision;
  candidates: string[];
  lessons: { name: string; document: string }[];
  reason: string;
};
export type FileContent = { content: string; digest: string };
export type LessonSnapshot = {
  schema: 1;
  root: string;
  active: (Lesson & { path: string; digest: string })[];
  history: (Lesson & { path: string; digest: string })[];
  pending: (Lesson & { path: string; digest: string })[];
  files: Record<string, FileContent>;
};
export type StoreResult = {
  schema: 1;
  status: 'saved' | 'applied' | 'recovered' | 'rolled-back' | 'unchanged';
  root: string;
  paths: string[];
};
export type ReviewSnapshot = {
  schema: 1;
  root: string;
  request: ReviewRequest;
  requestDigest: string;
  before: Record<string, string | null>;
  after: Record<string, string | null>;
  watched: Record<string, string | null>;
  digest: string;
};

export const lessonsPath = '.celetis/lessons';
export const pendingPath = `${lessonsPath}/_pending`;
export const queuePath = `${pendingPath}/QUEUE.md`;
export const journalPath = `${pendingPath}/.transaction.json`;
export const ignorePath = `${pendingPath}/.gitignore`;
export const pendingHeader = '# Pending lessons\n\n| Candidate | Lesson | Date | Summary |\n|---|---|---|---|\n';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const decisions: readonly Decision[] = ['approve', 'edit', 'merge', 'supersede', 'retire', 'reject'];
const diagnoses: readonly Diagnosis[] = [
  'not-retrieved',
  'not-followed',
  'wrong-or-incomplete-rule',
  'failed-structural-constraint',
  'unknown',
];

function fail(path: string, message: string): never {
  throw new LessonError(exits.usage, path, message);
}
export function object(
  value: unknown,
  path: string,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'need an object');
  const result = value as Record<string, unknown>;
  for (const key of required) if (!Object.hasOwn(result, key)) fail(path, `missing ${key}`);
  for (const key of Object.keys(result))
    if (![...required, ...optional].includes(key)) fail(path, `unknown field ${key}`);
  return result;
}
export function string(value: unknown, path: string, max = 512, multiline = false): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[^\t\n\r\x20-\x7e\xa0-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(value) ||
    (!multiline && /[\r\n\t]/.test(value))
  )
    fail(path, `need nonempty text of at most ${max} characters without control characters`);
  return value;
}
export function slug(value: unknown, path: string): string {
  const result = string(value, path, 128);
  if (!slugPattern.test(result)) fail(path, 'need a safe kebab-case lesson name');
  return result;
}
export function uuid(value: unknown, path: string): string {
  const result = string(value, path, 36);
  if (!uuidPattern.test(result)) fail(path, 'need a lowercase UUID');
  return result;
}
export function digest(value: unknown, path: string): string {
  if (typeof value !== 'string' || !digestPattern.test(value)) fail(path, 'need a SHA-256 digest');
  return value;
}
export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function date(value: unknown, path: string): string {
  const result = string(value, path, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString().slice(0, 10) !== result
  )
    fail(path, 'need a valid YYYY-MM-DD date');
  return result;
}
function list<T>(value: unknown, path: string, parse: (value: unknown, path: string) => T, nonempty = false): T[] {
  if (!Array.isArray(value) || (nonempty && value.length === 0))
    fail(path, nonempty ? 'need a nonempty array' : 'need an array');
  return value.map((item, i) => parse(item, `${path}[${i}]`));
}
function unique(values: string[], path: string): void {
  if (new Set(values).size !== values.length) fail(path, 'duplicate identity');
}
function choice<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(path, `need ${values.join(' | ')}`);
  return value as T;
}
function evidence(value: unknown, path: string): Evidence {
  const row = object(value, path, ['kind', 'excerpt'], ['reference']);
  return {
    kind: choice(row.kind, `${path}.kind`, ['user-report', 'tool-output']),
    excerpt: string(row.excerpt, `${path}.excerpt`, 16_384, true),
    ...(row.reference === undefined ? {} : { reference: string(row.reference, `${path}.reference`, 2048) }),
  };
}
function incident(value: unknown, path: string): Incident {
  const row = object(
    value,
    path,
    ['id', 'date', 'action', 'expected', 'observed', 'source', 'inference', 'diagnosis'],
    ['revision', 'lesson', 'brief'],
  );
  const diagnosis = list(row.diagnosis, `${path}.diagnosis`, (v, p) => choice(v, p, diagnoses), true);
  unique(diagnosis, `${path}.diagnosis`);
  if (diagnosis.includes('unknown') && diagnosis.length !== 1)
    fail(path, 'unknown cannot coexist with a definitive diagnosis');
  const result: Incident = {
    id: string(row.id, `${path}.id`),
    date: date(row.date, `${path}.date`),
    action: string(row.action, `${path}.action`, 16_384, true),
    expected: string(row.expected, `${path}.expected`, 16_384, true),
    observed: string(row.observed, `${path}.observed`, 16_384, true),
    source: evidence(row.source, `${path}.source`),
    inference: string(row.inference, `${path}.inference`, 16_384, true),
    diagnosis,
  };
  if (row.revision !== undefined) result.revision = string(row.revision, `${path}.revision`);
  if (row.brief !== undefined) result.brief = string(row.brief, `${path}.brief`, 16_384, true);
  if (row.lesson !== undefined) {
    const lesson = object(row.lesson, `${path}.lesson`, ['name', 'revision', 'digest']);
    result.lesson = {
      name: slug(lesson.name, `${path}.lesson.name`),
      revision: string(lesson.revision, `${path}.lesson.revision`),
      digest: digest(lesson.digest, `${path}.lesson.digest`),
    };
  }
  return result;
}
export function followUp(value: unknown, path: string): FollowUp {
  const row = object(value, path, ['state', 'detail'], ['owner', 'reference', 'evidence']);
  const result: FollowUp = {
    state: choice(row.state, `${path}.state`, ['proposed', 'verified', 'not-needed']),
    detail: string(row.detail, `${path}.detail`, 16_384, true),
  };
  for (const key of ['owner', 'reference', 'evidence'] as const)
    if (row[key] !== undefined) result[key] = string(row[key], `${path}.${key}`, 16_384, true);
  if (result.state === 'verified' && !result.evidence) fail(path, 'verified follow-up requires evidence');
  return result;
}
function review(value: unknown, path: string): Review {
  const row = object(value, path, ['id', 'requestDigest', 'date', 'decision', 'source', 'related', 'followUp']);
  const related = list(row.related, `${path}.related`, slug);
  unique(related, `${path}.related`);
  return {
    id: string(row.id, `${path}.id`),
    requestDigest: digest(row.requestDigest, `${path}.requestDigest`),
    date: date(row.date, `${path}.date`),
    decision: choice(row.decision, `${path}.decision`, decisions),
    source: string(row.source, `${path}.source`, 16_384, true),
    related,
    followUp: followUp(row.followUp, `${path}.followUp`),
  };
}
function inspectYaml(node: unknown, path: string): void {
  if (isAlias(node)) fail(path, 'YAML aliases are not allowed');
  if (isMap(node) || isSeq(node) || isScalar(node)) {
    if (
      node.tag &&
      !['map', 'seq', 'str', 'null', 'bool', 'int', 'float'].some((tag) => node.tag === `tag:yaml.org,2002:${tag}`)
    )
      fail(path, 'custom YAML tags are not allowed');
    if (isMap(node))
      for (const pair of node.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string' || pair.key.value === '<<')
          fail(path, 'need string keys without YAML merges');
        inspectYaml(pair.key, path);
        inspectYaml(pair.value, path);
      }
    if (isSeq(node)) for (const item of node.items) inspectYaml(item, path);
  }
}
export function parseLesson(text: string, path: string): Lesson {
  string(text, path, 1_048_576, true);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) fail(path, 'need schema 1 frontmatter; review old-format records explicitly');
  const docs = parseAllDocuments(match[1] as string, { schema: 'core', merge: false, uniqueKeys: true });
  const doc = docs[0];
  if (docs.length !== 1 || !doc || doc.errors.length)
    fail(path, `invalid YAML: ${doc?.errors[0]?.message.split('\n')[0] ?? 'need one document'}`);
  inspectYaml(doc.contents, path);
  return validateLesson(doc.toJS(), match[2] as string, path);
}
function validateLesson(value: unknown, body: string, path: string): Lesson {
  if (!value || typeof value !== 'object' || !('schema' in value) || value.schema !== 1)
    fail(path, 'need schema 1; review old-format records explicitly');
  const required = [
    'schema',
    'name',
    'description',
    'tags',
    'date',
    'status',
    'source',
    'incidents',
    'recurrences',
    'reviews',
  ];
  const optional = ['candidate', 'replacement', 'reason'];
  const row = object(value, path, required, optional);
  const keys = [...required, ...optional].filter((key) => Object.hasOwn(row, key));
  if (Object.keys(row).some((key, i) => key !== keys[i])) fail(path, 'frontmatter keys are out of order');
  const tags = list(row.tags, `${path}.tags`, (v, p) => string(v, p, 128), true);
  unique(tags, `${path}.tags`);
  const incidents = list(row.incidents, `${path}.incidents`, incident, true);
  unique(
    incidents.map((item) => item.id),
    `${path}.incidents`,
  );
  if (row.recurrences !== incidents.length - 1) fail(path, 'recurrences must equal distinct incident IDs minus one');
  const reviews = list(row.reviews, `${path}.reviews`, review);
  unique(
    reviews.map((item) => item.id),
    `${path}.reviews`,
  );
  if (!/^(?:[ \t]*\r?\n)*# [^\r\n]+\r?\n/.test(body)) fail(path, 'need a lesson title');
  const sections: { heading: string; lines: string[] }[] = [];
  let fence: string | undefined;
  for (const line of body.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      sections.at(-1)?.lines.push(line);
      if (marker?.[1] && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2]?.trim())
        fence = undefined;
    } else if (marker) {
      fence = marker[1];
      sections.at(-1)?.lines.push(line);
    } else if (line.startsWith('## ')) sections.push({ heading: line.slice(3), lines: [] });
    else sections.at(-1)?.lines.push(line);
  }
  const headings = sections.map((section) => section.heading);
  const order = [
    'What happened',
    'Root cause',
    'Anti-pattern',
    'Fix',
    'Detection signature',
    'Rule',
    'Related lessons',
  ];
  const requiredHeadings = ['What happened', 'Root cause', 'Fix', 'Rule'];
  if (
    requiredHeadings.some((heading) => !headings.includes(heading)) ||
    headings.some(
      (heading, i) =>
        !heading ||
        order.indexOf(heading) < 0 ||
        (i > 0 && order.indexOf(heading) <= order.indexOf(headings[i - 1] as string)),
    )
  )
    fail(path, 'need the required body headings in their defined order');
  for (const heading of requiredHeadings) {
    if (
      !sections
        .find((section) => section.heading === heading)
        ?.lines.join('\n')
        .trim()
    )
      fail(path, `empty ${heading} section`);
  }
  const fields: LessonFields = {
    schema: 1,
    name: slug(row.name, `${path}.name`),
    description: string(row.description, `${path}.description`, 1024),
    tags,
    date: date(row.date, `${path}.date`),
    source: string(row.source, `${path}.source`, 16_384, true),
    incidents,
    recurrences: incidents.length - 1,
    reviews,
    body,
  };
  const status = choice(row.status, `${path}.status`, ['pending-review', 'active', 'superseded']);
  if (status === 'pending-review') {
    if (row.replacement !== undefined) fail(path, 'pending records cannot have a replacement');
    return {
      ...fields,
      status,
      candidate: uuid(row.candidate, `${path}.candidate`),
      ...(row.reason === undefined ? {} : { reason: string(row.reason, `${path}.reason`, 16_384, true) }),
    };
  }
  if (row.candidate !== undefined) fail(path, 'live and historical records cannot have a candidate');
  if (status === 'active') {
    if (row.replacement !== undefined || row.reason !== undefined)
      fail(path, 'active records cannot have replacement or reason');
    return { ...fields, status };
  }
  const replacement = row.replacement === undefined ? undefined : slug(row.replacement, `${path}.replacement`);
  if (replacement === fields.name) fail(path, 'a lesson cannot replace itself');
  return {
    ...fields,
    status,
    reason: string(row.reason, `${path}.reason`, 16_384, true),
    ...(replacement === undefined ? {} : { replacement }),
  };
}
export function validateCapture(value: unknown, path: string): CaptureRequest {
  const row = object(value, path, [
    'schema',
    'candidate',
    'expected',
    'name',
    'description',
    'tags',
    'date',
    'source',
    'incidents',
    'body',
  ]);
  if (row.schema !== 1) fail(path, 'need schema 1');
  const candidate = uuid(row.candidate, `${path}.candidate`);
  const expected = row.expected === null ? null : digest(row.expected, `${path}.expected`);
  const { name, description, tags, date, source, incidents, body } = validateLesson(
    {
      schema: 1,
      name: row.name,
      description: row.description,
      tags: row.tags,
      date: row.date,
      status: 'pending-review',
      source: row.source,
      incidents: row.incidents,
      recurrences: Array.isArray(row.incidents) ? row.incidents.length - 1 : 0,
      reviews: [],
      candidate,
    },
    string(row.body, `${path}.body`, 1_048_576, true),
    path,
  );
  return { schema: 1, candidate, expected, name, description, tags, date, source, incidents, body };
}
export function validateReviewRequest(value: unknown, path: string): ReviewRequest {
  const row = object(value, path, [
    'schema',
    'id',
    'date',
    'source',
    'followUp',
    'decision',
    'candidates',
    'lessons',
    'reason',
  ]);
  if (row.schema !== 1) fail(path, 'need schema 1');
  const candidates = list(row.candidates, `${path}.candidates`, uuid);
  unique(candidates, `${path}.candidates`);
  const lessons = list(row.lessons, `${path}.lessons`, (value, path) => {
    const item = object(value, path, ['name', 'document']);
    const name = slug(item.name, `${path}.name`);
    const document = string(item.document, `${path}.document`, 1_048_576, true);
    const lesson = parseLesson(document, `${lessonsPath}/${name}.md`);
    if (lesson.name !== name || lesson.status === 'pending-review')
      fail(path, 'need a matching live or historical document');
    return { name, document };
  });
  unique(
    lessons.map((lesson) => lesson.name),
    `${path}.lessons`,
  );
  return {
    schema: 1,
    id: string(row.id, `${path}.id`),
    date: date(row.date, `${path}.date`),
    source: string(row.source, `${path}.source`, 16_384, true),
    followUp: followUp(row.followUp, `${path}.followUp`),
    decision: choice(row.decision, `${path}.decision`, decisions),
    candidates,
    lessons,
    reason: string(row.reason, `${path}.reason`, 16_384, true),
  };
}
function snapshotPaths(value: unknown, path: string, digests: boolean): Record<string, string | null> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'need a path map');
  const result: Record<string, string | null> = {};
  for (const [key, content] of Object.entries(value)) {
    if (!storePath(key)) fail(`${path}.${key}`, 'invalid lesson store path');
    result[key] =
      content === null
        ? null
        : digests
          ? digest(content, `${path}.${key}`)
          : string(content, `${path}.${key}`, 4_194_304, true);
  }
  return result;
}
export function validateReviewSnapshot(value: unknown, path: string): ReviewSnapshot {
  const row = object(value, path, [
    'schema',
    'root',
    'request',
    'requestDigest',
    'before',
    'after',
    'watched',
    'digest',
  ]);
  if (row.schema !== 1) fail(path, 'need schema 1');
  return {
    schema: 1,
    root: string(row.root, `${path}.root`, 4096),
    request: validateReviewRequest(row.request, `${path}.request`),
    requestDigest: digest(row.requestDigest, `${path}.requestDigest`),
    before: snapshotPaths(row.before, `${path}.before`, false),
    after: snapshotPaths(row.after, `${path}.after`, false),
    watched: snapshotPaths(row.watched, `${path}.watched`, true),
    digest: digest(row.digest, `${path}.digest`),
  };
}
export function serializeLesson(lesson: Lesson): string {
  const {
    schema,
    name,
    description,
    tags,
    date,
    status,
    source,
    incidents,
    recurrences,
    reviews,
    candidate,
    replacement,
    reason,
    body,
  } = lesson;
  const fields = {
    schema,
    name,
    description,
    tags,
    date,
    status,
    source,
    incidents,
    recurrences,
    reviews,
    ...(candidate === undefined ? {} : { candidate }),
    ...(replacement === undefined ? {} : { replacement }),
    ...(reason === undefined ? {} : { reason }),
  };
  return `---\n${JSON.stringify(fields, null, 2)}\n---\n${body}`;
}
export function completedReview(files: ReadonlyMap<string, string>, input: ReviewRequest): boolean {
  const requestDigest = hash(stable(input));
  let found = false;
  for (const [path, text] of files) {
    if (!lessonFile(path)) continue;
    for (const review of parseLesson(text, path).reviews) {
      if (review.id !== input.id) continue;
      if (review.requestDigest !== requestDigest) fail(path, `review ${input.id} has a different request digest`);
      found = true;
    }
  }
  return found;
}
function retainedHistory(target: Lesson, inputs: Lesson[], path: string): void {
  const source = [...new Set(inputs.map((input) => input.source))].join('\n\n');
  if (target.source !== source)
    fail(path, 'preserve original source strings in input order, separated by a blank line');
  for (const key of ['incidents', 'reviews'] as const) {
    const expected = new Map<string, string>();
    for (const input of inputs) for (const item of input[key]) expected.set(item.id, stable(item));
    if (target[key].length !== expected.size || target[key].some((item) => expected.get(item.id) !== stable(item)))
      fail(path, `preserve the exact union of earlier ${key}; record corrections in the new review`);
  }
}
function removeQueueRow(files: Map<string, string>, proposal: Lesson): void {
  const row = queueRow(proposal);
  const text = files.get(queuePath) ?? pendingHeader;
  const at = text.lastIndexOf(row);
  if (at < 0) fail(queuePath, 'missing selected queue row');
  const end = at + row.length;
  const newline = text.slice(end).startsWith('\r\n') ? 2 : text[end] === '\n' ? 1 : 0;
  files.set(queuePath, text.slice(0, at) + text.slice(end + newline));
}
export function reviewChanges(files: ReadonlyMap<string, string>, input: ReviewRequest): Map<string, string> {
  if (completedReview(files, input)) fail('review', `review ${input.id} is already applied; use its retained snapshot`);
  const pending = input.candidates.map((candidate) => {
    const path = `${pendingPath}/${candidate}.md`;
    const text = files.get(path);
    if (text === undefined) fail(path, 'selected pending proposal is missing');
    const proposal = parseLesson(text, path);
    if (proposal.status !== 'pending-review' || proposal.candidate !== candidate)
      fail(path, 'selected file must contain its pending proposal');
    return proposal;
  });
  const targets = input.lessons.map(({ name, document }) => parseLesson(document, `${lessonsPath}/${name}.md`));
  for (const target of targets) {
    const path = `${lessonsPath}/${target.name}.md`;
    if (target.name === 'index')
      fail(
        path,
        'reserved name: on a case-insensitive file system index.md is a leftover catalog INDEX.md; select another name',
      );
  }
  const live = targets.flatMap((target) => {
    const path = `${lessonsPath}/${target.name}.md`;
    const text = files.get(path);
    if (text === undefined) return [];
    const previous = parseLesson(text, path);
    if (previous.status !== 'active') fail(path, 'select active guidance; historical files remain unchanged');
    return [previous];
  });
  const inputs = [...pending, ...live];
  const active = targets.filter((target) => target.status === 'active');
  const historical = targets.filter((target) => target.status === 'superseded');
  switch (input.decision) {
    case 'approve':
      if (pending.length !== 1 || live.length || targets.length !== 1 || active.length !== 1)
        fail('review', 'approve needs one pending proposal and one new active lesson');
      break;
    case 'edit':
      if (inputs.length !== 1 || targets.length !== 1 || active.length !== 1)
        fail('review', 'edit needs one pending proposal or one selected active lesson');
      break;
    case 'merge':
      if (
        inputs.length < 2 ||
        active.length !== 1 ||
        historical.length !== live.filter((item) => item.name !== active[0]?.name).length
      )
        fail('review', 'merge needs at least two inputs, one active survivor, and every absorbed live file');
      break;
    case 'supersede':
      if (active.length !== 1 || !historical.length)
        fail('review', 'supersede needs old live files and one active replacement');
      break;
    case 'retire':
      if (pending.length || active.length || !historical.length)
        fail('review', 'retire needs selected active lessons without a replacement');
      break;
    case 'reject':
      if (!pending.length || targets.length) fail('review', 'reject needs pending proposals and no live changes');
      break;
  }
  for (const target of targets) {
    const path = `${lessonsPath}/${target.name}.md`;
    if (target.status === 'superseded') {
      const previous = live.find((item) => item.name === target.name);
      if (!previous) fail(path, 'only an existing active lesson can become history');
      if (target.replacement !== (input.decision === 'retire' ? undefined : active[0]?.name))
        fail(path, 'replacement must name the selected active survivor, or be absent for retirement');
      retainedHistory(target, [previous], path);
      if (
        target.body !== previous.body ||
        target.description !== previous.description ||
        stable(target.tags) !== stable(previous.tags) ||
        target.date !== previous.date
      )
        fail(path, 'keep the old lesson content when making it historical');
    } else {
      retainedHistory(target, inputs, path);
      if (input.decision === 'approve' && target.name !== pending[0]?.name)
        fail(path, 'approve preserves the proposed lesson name; select edit for a new name');
      if (input.decision === 'approve') {
        const proposal = pending[0];
        if (
          !proposal ||
          target.body !== proposal.body ||
          target.description !== proposal.description ||
          stable(target.tags) !== stable(proposal.tags) ||
          target.date !== proposal.date
        )
          fail(path, 'approve preserves the proposal text; select edit for a revised proposal');
      }
    }
  }
  const review: Review = {
    id: input.id,
    requestDigest: hash(stable(input)),
    date: input.date,
    decision: input.decision,
    source: `${input.source}\n\n${input.reason}`,
    related: [...new Set([...inputs, ...targets].map((lesson) => lesson.name))],
    followUp: input.followUp,
  };
  const after = new Map(files);
  for (const proposal of pending) {
    const path = `${pendingPath}/${proposal.candidate}.md`;
    after.delete(path);
    removeQueueRow(after, proposal);
    if (input.decision === 'reject') {
      const rejected = `${pendingPath}/_rejected/${proposal.candidate}.md`;
      if (files.has(rejected)) fail(rejected, 'rejected destination already exists');
      after.set(
        rejected,
        serializeLesson({ ...proposal, reason: input.reason, reviews: [...proposal.reviews, review] }),
      );
    }
  }
  for (const target of targets) {
    const path = `${lessonsPath}/${target.name}.md`;
    after.set(path, serializeLesson({ ...target, reviews: [...target.reviews, review] }));
  }
  after.set(ignorePath, files.get(ignorePath) ?? '*\n');
  validateStore(after);
  return after;
}
export function reviewSnapshot(root: string, files: ReadonlyMap<string, string>, input: ReviewRequest): ReviewSnapshot {
  const result = reviewChanges(files, input);
  const before: Record<string, string | null> = {};
  const after: Record<string, string | null> = {};
  const watched: Record<string, string | null> = {};
  for (const path of [...new Set([...files.keys(), ...result.keys(), queuePath, ignorePath])].sort()) {
    before[path] = files.get(path) ?? null;
    after[path] = result.get(path) ?? null;
    watched[path] = before[path] === null ? null : hash(before[path]);
  }
  const snapshot = {
    schema: 1 as const,
    root,
    request: input,
    requestDigest: hash(stable(input)),
    before,
    after,
    watched,
  };
  return { ...snapshot, digest: hash(stable(snapshot)) };
}
export function lessonFile(path: string): 'live' | 'pending' | 'rejected' | null {
  const live = path.startsWith(`${lessonsPath}/`) && path.endsWith('.md') ? path.slice(lessonsPath.length + 1, -3) : '';
  if (live.length <= 128 && slugPattern.test(live)) return 'live';
  for (const [prefix, kind] of [
    [pendingPath, 'pending'],
    [`${pendingPath}/_rejected`, 'rejected'],
  ] as const) {
    if (path.startsWith(`${prefix}/`) && path.endsWith('.md') && uuidPattern.test(path.slice(prefix.length + 1, -3)))
      return kind;
  }
  return null;
}
export function storePath(path: string): boolean {
  return path === queuePath || path === ignorePath || lessonFile(path) !== null;
}
function cell(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('|', '&#124;')
    .replaceAll('`', '&#96;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
function queueRow(lesson: Lesson): string {
  return `| [${lesson.candidate}](${lesson.candidate}.md) | ${lesson.name} | ${lesson.date} | ${cell(lesson.description)} |`;
}
function validateQueue(files: ReadonlyMap<string, string>): void {
  const expected = new Set<string>();
  for (const [path, text] of files) {
    const kind = lessonFile(path);
    if (kind !== 'pending' && kind !== 'rejected') continue;
    const lesson = parseLesson(text, path);
    if (
      lesson.status !== 'pending-review' ||
      path !== `${pendingPath}/${kind === 'rejected' ? '_rejected/' : ''}${lesson.candidate}.md`
    )
      fail(path, 'pending filename and status must match the candidate');
    if (kind === 'pending') {
      if (lesson.reason !== undefined || lesson.reviews.at(-1)?.decision === 'reject')
        fail(path, 'rejected records belong in _rejected');
      expected.add(queueRow(lesson));
    } else if (!lesson.reason || lesson.reviews.at(-1)?.decision !== 'reject')
      fail(path, 'rejected records need a reason and a reject review');
  }
  const content = files.get(queuePath);
  if (content === undefined) {
    if (expected.size) fail(queuePath, 'missing queue for existing records');
    return;
  }
  string(content, queuePath, 4_194_304, true);
  const lines = content.split(/\r?\n/);
  const heading = '| Candidate | Lesson | Date | Summary |';
  const start = lines.indexOf(heading);
  if (
    start < 0 ||
    start !== lines.lastIndexOf(heading) ||
    !/^\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|$/.test(lines[start + 1] ?? '') ||
    lines[0] !== '# Pending lessons'
  )
    fail(queuePath, 'invalid queue header');
  const actual = lines.slice(start + 2).filter((line) => line.trim());
  if (
    new Set(actual).size !== actual.length ||
    actual.length !== expected.size ||
    actual.some((line) => !expected.has(line))
  )
    fail(queuePath, 'queue rows and pending files do not agree');
}
export function validateIgnore(text: string): void {
  string(text, ignorePath, 1_048_576, true);
  const patterns = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith('#'));
  const coversAll = patterns.findLastIndex((line) => ['*', '**', '**/*'].includes(line));
  if (coversAll < 0 || patterns.slice(coversAll + 1).some((line) => line.startsWith('!')))
    fail(
      ignorePath,
      'ignore conflict: need a rule that ignores all pending data without later exceptions; preserve this file and review it explicitly',
    );
}
export function validateStore(files: ReadonlyMap<string, string>, pending = true): void {
  const ignore = files.get(ignorePath);
  if (pending && ignore !== undefined) validateIgnore(ignore);
  if (pending) validateQueue(files);
  const incidents = new Map<string, { evidence: string; queued: boolean; pending: boolean }>();
  const reviews = new Map<string, string>();
  const candidates = new Set<string>();
  for (const [path, text] of files) {
    const kind = lessonFile(path);
    if (!kind) continue;
    const lesson = parseLesson(text, path);
    if (kind === 'live' && (lesson.status === 'pending-review' || path !== `${lessonsPath}/${lesson.name}.md`))
      fail(path, 'live filename and status must match the lesson');
    if (lesson.candidate) {
      if (candidates.has(lesson.candidate)) fail(path, 'candidate appears more than once');
      candidates.add(lesson.candidate);
    }
    const queued = kind !== 'live';
    for (const item of lesson.incidents) {
      const old = incidents.get(item.id);
      if (old && old.evidence !== stable(item)) fail(path, `incident ${item.id} has unequal evidence`);
      if (old?.queued && queued && (old.pending || kind === 'pending'))
        fail(path, `incident ${item.id} appears in more than one record with a pending proposal`);
      incidents.set(item.id, {
        evidence: stable(item),
        queued: queued || !!old?.queued,
        pending: kind === 'pending' || !!old?.pending,
      });
    }
    for (const item of lesson.reviews) {
      const old = reviews.get(item.id);
      if (old !== undefined && old !== item.requestDigest)
        fail(path, `review ${item.id} has a different request digest`);
      reviews.set(item.id, item.requestDigest);
    }
    if (lesson.status === 'superseded' && lesson.replacement && !files.has(`${lessonsPath}/${lesson.replacement}.md`))
      fail(path, 'replacement lesson is missing');
  }
}

export function captureChanges(files: ReadonlyMap<string, string>, input: CaptureRequest): Map<string, string> | null {
  const path = `${pendingPath}/${input.candidate}.md`;
  const saved = new Map<string, { evidence: string; path: string }>();
  for (const [file, text] of files)
    if (lessonFile(file)) {
      for (const item of parseLesson(text, file).incidents) saved.set(item.id, { evidence: stable(item), path: file });
    }
  for (const item of input.incidents) {
    const stored = saved.get(item.id);
    if (stored && stored.evidence !== stable(item))
      throw new LessonError(exits.usage, path, `incident ${item.id} has unequal evidence in ${stored.path}`);
  }
  const added = input.incidents.filter((item) => !saved.has(item.id));
  if (!added.length) return null;
  const before = files.get(path);
  if ((before === undefined ? null : hash(before)) !== input.expected)
    throw new LessonError(exits.prerequisite, path, 'stale: pending digest changed');
  const previous = before === undefined ? undefined : parseLesson(before, path);
  if (previous && (input.name !== previous.name || input.source !== previous.source))
    throw new LessonError(exits.usage, path, 'capture must preserve the proposal name and origin');
  for (const item of input.incidents) {
    const old = saved.get(item.id);
    if (old && old.path !== path)
      throw new LessonError(exits.usage, path, `incident ${item.id} already belongs to ${old.path}`);
  }
  const incidents = [...(previous?.incidents ?? []), ...added];
  const document = serializeLesson({
    schema: 1,
    name: input.name,
    description: input.description,
    tags: input.tags,
    date: input.date,
    status: 'pending-review',
    source: input.source,
    incidents,
    recurrences: incidents.length - 1,
    reviews: previous?.reviews ?? [],
    candidate: input.candidate,
    body: input.body,
  });
  const proposal = parseLesson(document, path);
  const after = new Map(files);
  after.set(path, document);
  const queue = files.get(queuePath) ?? pendingHeader;
  const row = queueRow(proposal);
  if (!previous) after.set(queuePath, `${queue}${queue.endsWith('\n') ? '' : '\n'}${row}\n`);
  else {
    const oldRow = queueRow(previous);
    const at = queue.lastIndexOf(oldRow);
    after.set(queuePath, queue.slice(0, at) + row + queue.slice(at + oldRow.length));
  }
  return after;
}
