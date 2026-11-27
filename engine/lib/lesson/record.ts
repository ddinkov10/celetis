import { createHash } from 'node:crypto';
import { isAlias, isMap, isScalar, isSeq, parseAllDocuments } from 'yaml';
import { z } from 'zod';
import { type ExitCode, exits } from '../contract/contract.ts';
import { digestText, lowerUuid } from '../state/schemas.ts';

export class LessonError extends Error {
  constructor(
    readonly code: ExitCode,
    path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
  }
}
export const lessonsPath = '.celetis/lessons';
export const pendingPath = `${lessonsPath}/_pending`;
export const queuePath = `${pendingPath}/QUEUE.md`;
export const journalPath = `${pendingPath}/.transaction.json`;
export const ignorePath = `${pendingPath}/.gitignore`;
export const pendingHeader = '# Pending lessons\n\n| Candidate | Lesson | Date | Summary |\n|---|---|---|---|\n';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function fail(path: string, message: string): never {
  throw new LessonError(exits.usage, path, message);
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

const at = (value: unknown, keys: readonly PropertyKey[]) =>
  keys.reduce<unknown>((node, key) => (node as Record<PropertyKey, unknown> | null)?.[key], value);
export function missingKey(issue: z.core.$ZodIssue, value: unknown): string | null {
  const key = issue.path.at(-1);
  if (issue.code === 'unrecognized_keys' || typeof key !== 'string') return null;
  const parent = at(value, issue.path.slice(0, -1));
  return parent !== null && typeof parent === 'object' && !Array.isArray(parent) && !Object.hasOwn(parent, key)
    ? key
    : null;
}
const pathOf = (root: string, keys: readonly PropertyKey[]) =>
  keys.reduce<string>((path, key) => (typeof key === 'number' ? `${path}[${key}]` : `${path}.${String(key)}`), root);
function failure(issue: z.core.$ZodIssue, value: unknown, root: string): LessonError {
  const missing = missingKey(issue, value);
  if (missing !== null)
    return new LessonError(exits.usage, pathOf(root, issue.path.slice(0, -1)), `missing ${missing}`);
  const path = pathOf(root, issue.path);
  if (issue.code === 'unrecognized_keys') return new LessonError(exits.usage, path, `unknown field ${issue.keys[0]}`);
  if (issue.code === 'invalid_type' && issue.expected === 'object')
    return new LessonError(exits.usage, path, 'need an object');
  return new LessonError(
    exits.usage,
    issue.code === 'invalid_value' && issue.path.at(-1) === 'schema' ? pathOf(root, issue.path.slice(0, -1)) : path,
    issue.message,
  );
}
export function check<T extends z.ZodType>(schema: T, value: unknown, root: string): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw failure(parsed.error.issues[0] as z.core.$ZodIssue, value, root);
  return parsed.data;
}

const need = <T>(valid: (value: unknown) => boolean, message: string) =>
  z.custom<T>(valid, { error: message, abort: true });
const controls = /[^\t\n\r\x20-\x7e\xa0-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u;
const prose = (max = 512, multiline = false) =>
  need<string>(
    (value) =>
      typeof value === 'string' &&
      value.trim() !== '' &&
      value.length <= max &&
      !controls.test(value) &&
      (multiline || !/[\r\n\t]/.test(value)),
    `need nonempty text of at most ${max} characters without control characters`,
  );
const calendar = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const accepts = (schema: z.ZodType) => (value: unknown) => schema.safeParse(value).success;
const slug = prose(128).pipe(
  need<string>(accepts(z.string().regex(slugPattern)), 'need a safe kebab-case lesson name'),
);
export const uuid = prose(36).pipe(need<string>(accepts(lowerUuid), 'need a lowercase UUID'));
export const digest = need<string>(accepts(digestText), 'need a SHA-256 digest');
const date = prose(10).pipe(need<string>((value) => calendar(value as string), 'need a valid YYYY-MM-DD date'));
const choice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, `need ${values.join(' | ')}`);
const list = <T extends z.ZodType>(item: T) => z.array(item, 'need an array');
const nonempty = <T extends z.ZodType>(item: T) =>
  z.array(item, 'need a nonempty array').min(1, 'need a nonempty array');
const distinct = <T extends z.ZodType>(items: z.ZodArray<T>, by: (item: z.output<T>) => unknown = (item) => item) =>
  items.refine((all) => new Set(all.map(by)).size === all.length, 'duplicate identity');
const pathMap = <T extends z.ZodType>(entry: T) =>
  need<Record<string, z.output<T>>>(
    (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    'need a path map',
  ).superRefine((map, ctx) => {
    for (const [key, content] of Object.entries(map)) {
      const found = storePath(key) ? entry.safeParse(content) : null;
      if (found?.success) continue;
      return void ctx.addIssue({
        code: 'custom',
        path: [key],
        message: found ? (found.error.issues[0]?.message ?? '') : 'invalid lesson store path',
      });
    }
  });

const decision = choice(['approve', 'edit', 'merge', 'supersede', 'retire', 'reject']);
const evidence = z.strictObject({
  kind: choice(['user-report', 'tool-output']),
  excerpt: prose(16_384, true),
  reference: prose(2048).optional(),
});
const incident = z
  .strictObject({
    id: prose(),
    date,
    action: prose(16_384, true),
    expected: prose(16_384, true),
    observed: prose(16_384, true),
    source: evidence,
    inference: prose(16_384, true),
    diagnosis: distinct(
      nonempty(
        choice([
          'not-retrieved',
          'not-followed',
          'wrong-or-incomplete-rule',
          'failed-structural-constraint',
          'unknown',
        ]),
      ),
    ),
    revision: prose().optional(),
    brief: prose(16_384, true).optional(),
    lesson: z.strictObject({ name: slug, revision: prose(), digest }).optional(),
  })
  .refine(
    (row) => !row.diagnosis.includes('unknown') || row.diagnosis.length === 1,
    'unknown cannot coexist with a definitive diagnosis',
  );
const followUp = z
  .strictObject({
    state: choice(['proposed', 'verified', 'not-needed']),
    detail: prose(16_384, true),
    owner: prose(16_384, true).optional(),
    reference: prose(16_384, true).optional(),
    evidence: prose(16_384, true).optional(),
  })
  .refine((row) => row.state !== 'verified' || !!row.evidence, 'verified follow-up requires evidence');
const review = z.strictObject({
  id: prose(),
  requestDigest: digest,
  date,
  decision,
  source: prose(16_384, true),
  related: distinct(list(slug)),
  followUp,
});
const tags = distinct(nonempty(prose(128)));
const incidents = distinct(nonempty(incident), (item) => item.id);
const reviews = distinct(list(review), (item) => item.id);
const lessonSchema = z
  .strictObject({
    schema: z.literal(1),
    name: slug,
    description: prose(1024),
    tags,
    date,
    status: choice(['pending-review', 'active', 'superseded']),
    source: prose(16_384, true),
    incidents,
    recurrences: need<number>((value) => value !== undefined, 'recurrences must equal distinct incident IDs minus one'),
    reviews,
    candidate: z.unknown().optional(),
    replacement: z.unknown().optional(),
    reason: z.unknown().optional(),
  })
  .refine(
    (row) => row.recurrences === row.incidents.length - 1,
    'recurrences must equal distinct incident IDs minus one',
  );
const absent = z.never().optional();
const pendingStatus = z.strictObject({
  status: z.literal('pending-review'),
  candidate: uuid,
  reason: prose(16_384, true).optional(),
  replacement: absent,
});
const activeStatus = z.strictObject({
  status: z.literal('active'),
  candidate: absent,
  replacement: absent,
  reason: absent,
});
const supersededStatus = z.strictObject({
  status: z.literal('superseded'),
  candidate: absent,
  replacement: slug.optional(),
  reason: prose(16_384, true),
});
const captureSchema = z.strictObject({
  schema: z.literal(1, 'need schema 1'),
  candidate: uuid,
  expected: digest.nullable(),
  name: slug,
  description: prose(1024),
  tags,
  date,
  source: prose(16_384, true),
  incidents,
  body: prose(1_048_576, true),
});
const requestSchema = z.strictObject({
  schema: z.literal(1, 'need schema 1'),
  id: prose(),
  date,
  source: prose(16_384, true),
  followUp,
  decision,
  candidates: distinct(list(uuid)),
  lessons: distinct(list(z.strictObject({ name: slug, document: prose(1_048_576, true) })), (item) => item.name),
  reason: prose(16_384, true),
});
const snapshotSchema = z.strictObject({
  schema: z.literal(1, 'need schema 1'),
  root: prose(4096),
  request: requestSchema,
  requestDigest: digest,
  before: pathMap(prose(4_194_304, true).nullable()),
  after: pathMap(prose(4_194_304, true).nullable()),
  watched: pathMap(digest.nullable()),
  digest,
});

export type Decision = z.output<typeof decision>;
export type Review = z.output<typeof review>;
type Row = z.output<typeof lessonSchema>;
type LessonFields = Omit<Row, 'status' | 'candidate' | 'replacement' | 'reason'> & { body: string };
export type Lesson = LessonFields &
  (z.output<typeof pendingStatus> | z.output<typeof activeStatus> | z.output<typeof supersededStatus>);
export type CaptureRequest = z.output<typeof captureSchema>;
export type ReviewRequest = z.output<typeof requestSchema>;
export type ReviewSnapshot = z.output<typeof snapshotSchema>;
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
  check(prose(1_048_576, true), text, path);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) fail(path, 'need schema 1 frontmatter; review old-format records explicitly');
  const docs = parseAllDocuments(match[1] as string, { schema: 'core', merge: false, uniqueKeys: true });
  const doc = docs[0];
  if (docs.length !== 1 || !doc || doc.errors.length)
    fail(path, `invalid YAML: ${doc?.errors[0]?.message.split('\n')[0] ?? 'need one document'}`);
  inspectYaml(doc.contents, path);
  return validateLesson(doc.toJS(), match[2] as string, path);
}
function checkBody(body: string, path: string): void {
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
}
function validateLesson(value: unknown, body: string, path: string): Lesson {
  if (!value || typeof value !== 'object' || !('schema' in value) || value.schema !== 1)
    fail(path, 'need schema 1; review old-format records explicitly');
  const row = check(lessonSchema, value, path);
  const keys = Object.keys(lessonSchema.shape).filter((key) => Object.hasOwn(value, key));
  if (Object.keys(value).some((key, i) => key !== keys[i])) fail(path, 'frontmatter keys are out of order');
  checkBody(body, path);
  const { schema, name, description, tags, date, source, incidents, reviews, status, candidate, replacement, reason } =
    row;
  const fields = {
    schema,
    name,
    description,
    tags,
    date,
    source,
    incidents,
    recurrences: incidents.length - 1,
    reviews,
    body,
  };
  if (status === 'pending-review') {
    if (replacement !== undefined) fail(path, 'pending records cannot have a replacement');
    return {
      ...fields,
      status,
      candidate: check(pendingStatus.shape.candidate, candidate, `${path}.candidate`),
      ...(reason === undefined ? {} : { reason: check(pendingStatus.shape.reason, reason, `${path}.reason`) }),
    };
  }
  if (candidate !== undefined) fail(path, 'live and historical records cannot have a candidate');
  if (status === 'active') {
    if (replacement !== undefined || reason !== undefined)
      fail(path, 'active records cannot have replacement or reason');
    return { ...fields, status };
  }
  const target =
    replacement === undefined
      ? undefined
      : check(supersededStatus.shape.replacement, replacement, `${path}.replacement`);
  if (target === name) fail(path, 'a lesson cannot replace itself');
  return {
    ...fields,
    status,
    reason: check(supersededStatus.shape.reason, reason, `${path}.reason`),
    ...(target === undefined ? {} : { replacement: target }),
  };
}
function checkDocuments(request: ReviewRequest, path: string): void {
  for (const [i, { name, document }] of request.lessons.entries()) {
    const lesson = parseLesson(document, `${lessonsPath}/${name}.md`);
    if (lesson.name !== name || lesson.status === 'pending-review')
      fail(`${path}.lessons[${i}]`, 'need a matching live or historical document');
  }
}
export function validateCapture(value: unknown, path: string): CaptureRequest {
  const request = check(captureSchema, value, path);
  checkBody(request.body, path);
  return request;
}
export function validateReviewRequest(value: unknown, path: string): ReviewRequest {
  const request = check(requestSchema, value, path);
  checkDocuments(request, path);
  return request;
}
export function validateReviewSnapshot(value: unknown, path: string): ReviewSnapshot {
  const snapshot = check(snapshotSchema, value, path);
  checkDocuments(snapshot.request, `${path}.request`);
  return snapshot;
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
    if (
      path.startsWith(`${prefix}/`) &&
      path.endsWith('.md') &&
      lowerUuid.safeParse(path.slice(prefix.length + 1, -3)).success
    )
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
  check(prose(4_194_304, true), content, queuePath);
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
  check(prose(1_048_576, true), text, ignorePath);
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
