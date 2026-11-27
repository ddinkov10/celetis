import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { digestText } from '../state/schemas.ts';

export class FormatError extends Error {
  constructor(
    readonly rule: string,
    at?: string,
  ) {
    super(at === undefined ? rule : `${rule}: ${at}`);
  }
}

export const bugVersion = 4;
export const identityVersion = 2;
export const emptyBlob = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';

export const create = 1;
export const setTitle = 2;
export const addComment = 3;
export const setStatus = 4;
export const labelChange = 5;
export const editComment = 6;
export const noOp = 7;
export const setMetadata = 8;

export type Entry = Readonly<{ name: string; type: 'blob' | 'tree'; hash: string }>;
export type RawCommit = Readonly<{
  commit: string;
  parents: readonly string[];
  entries: readonly Entry[];
  ops: Uint8Array | null;
}>;
export type Op = Readonly<{
  id: string;
  type: number;
  timestamp: number;
  metadata: Readonly<Record<string, string>>;
  fields: Readonly<Record<string, unknown>>;
}>;
export type Pack = Readonly<{
  id: string;
  commit: string;
  editClock: number;
  createClock: number | null;
  author: string;
  ops: readonly Op[];
}>;
export type Bug = Readonly<{ id: string; tip: string; createClock: number; editClock: number; packs: readonly Pack[] }>;
export type Identity = Readonly<{ id: string; tip: string; name: string | null; email: string | null; keys: boolean }>;
export type IdentityCommit = Readonly<{
  commit: string;
  parents: readonly string[];
  entries: readonly Entry[];
  version: Uint8Array | null;
}>;
export type Comment = Readonly<{ id: string; author: string; at: number; body: string }>;
export type SnapshotEvent =
  | Readonly<{ kind: 'comment'; id: string; author: string; at: number; body: string }>
  | Readonly<{ kind: 'label'; change: 'added' | 'removed'; name: string; at: number }>;
export type Snapshot = Readonly<{
  title: string;
  body: string;
  createOp: string;
  author: string;
  state: 'open' | 'closed';
  labels: readonly string[];
  comments: readonly Comment[];
  events: readonly SnapshotEvent[];
  metadata: ReadonlyMap<string, Readonly<Record<string, string>>>;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
  closeOp: string | null;
  files: readonly string[];
}>;

const rules = {
  versionEntry: 'the commit has no single version entry',
  version: `the format version is not ${bugVersion}`,
  opsEntry: 'the commit has no ops blob',
  editClock: 'the commit has no single edit clock',
  commits: 'a commit is repeated or a parent commit is missing',
  root: 'the bug has not exactly one root commit',
  head: 'the bug has not exactly one head commit',
  rootClock: 'the root commit has no create clock above 0',
  childClock: 'a non-root commit has a create clock',
  clockOrder: 'an edit clock is not above the clock of its parent',
  clockJump: 'an edit clock is more than 1000000 above its parent',
  utf8: 'the ops blob is not valid UTF-8 JSON',
  pack: 'the ops blob is not an operation pack',
  field: 'an operation field has the wrong type',
  merge: 'a merge commit has operations',
  author: 'the pack author is not a known identity',
  key: 'the pack author has a public key',
  ref: 'the ref name is not the ID of the first operation',
  rootPack: 'the root pack is not a single create operation',
  lateCreate: 'a create operation is outside the root pack',
  duplicate: 'two operations share an ID',
  identityTree: 'the identity commit tree is not one version entry',
  identityChain: 'the identity chain is not linear',
  identityUtf8: 'the identity version is not valid UTF-8 JSON',
  identityVersion: `the identity version is not ${identityVersion}`,
  identityKey: 'the identity has a public key',
  identityField: 'an identity field has the wrong type',
  identityRef: 'the ref name is not the ID of the first identity version',
} as const;

const maxJump = 1_000_000;

const strings = z.custom<Record<string, string>>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === 'string'),
);
const kinds = {
  string: z.string(),
  list: z.array(z.string()).nullable(),
  status: z.union([z.literal(1), z.literal(2)]),
  id: digestText,
  metadata: strings,
};
type Kind = keyof typeof kinds;
const shapes: Readonly<Record<number, Readonly<Record<string, Kind>>>> = {
  [create]: { title: 'string', message: 'string', files: 'list' },
  [setTitle]: { title: 'string', was: 'string' },
  [addComment]: { message: 'string', files: 'list' },
  [setStatus]: { status: 'status' },
  [labelChange]: { added: 'list', removed: 'list' },
  [editComment]: { target: 'id', message: 'string', files: 'list' },
  [noOp]: {},
  [setMetadata]: { target: 'id', new_metadata: 'metadata' },
};

const shapeJson = Object.fromEntries(
  Object.entries(shapes).map(([type, table]) => [
    type,
    z.looseObject(Object.fromEntries(Object.entries(table).map(([name, kind]) => [name, kinds[kind]]))),
  ]),
);
const opJson = z.looseObject({ type: z.int(), timestamp: z.int(), nonce: z.string(), metadata: strings.nullish() });
const packJson = z.looseObject({ author: z.looseObject({ id: digestText }), ops: z.array(z.unknown()) });
const identityVersionJson = z.looseObject({
  version: z.literal(identityVersion),
  pub_keys: z.array(z.unknown()).max(0).nullish(),
  name: z.string().optional(),
  email: z.string().optional(),
});
const identityRules: Readonly<Record<string, string>> = {
  version: rules.identityVersion,
  pub_keys: rules.identityKey,
  name: rules.identityField,
  email: rules.identityField,
};

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function nonce(): string {
  return randomBytes(20).toString('base64');
}

export function encodeOp(
  type: number,
  fields: Readonly<Record<string, unknown>>,
  timestamp: number,
  metadata: Readonly<Record<string, string>> = {},
): string {
  return JSON.stringify({
    type,
    timestamp,
    nonce: nonce(),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...fields,
  });
}

export function encodePack(author: string, ops: readonly string[]): string {
  return `{"author":{"id":${JSON.stringify(author)}},"ops":[${ops.join(',')}]}`;
}

export function encodeIdentity(
  name: string,
  email: string,
  times: Readonly<{ create: number; edit: number }>,
  unixTime: number,
): string {
  return JSON.stringify({
    version: identityVersion,
    times: { 'bugs-create': times.create, 'bugs-edit': times.edit },
    unix_time: unixTime,
    name,
    email,
    nonce: nonce(),
  });
}

const trim = (text: string) => text.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');

export function rawElements(blob: string): readonly string[] {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let expectKey = false;
  let keyStart = -1;
  let key: unknown = null;
  let valueKey: unknown = null;
  let current: string[] | null = null;
  let found: string[] | null = null;
  let start = 0;
  for (let i = 0; i < blob.length; i++) {
    const c = blob[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') {
        inString = false;
        if (keyStart >= 0) {
          key = JSON.parse(blob.slice(keyStart, i + 1));
          keyStart = -1;
        }
      }
      continue;
    }
    switch (c) {
      case '"':
        inString = true;
        if (depth === 1 && expectKey) {
          keyStart = i;
          expectKey = false;
        }
        break;
      case ':':
        if (depth === 1) {
          valueKey = key;
          if (valueKey === 'ops') found = null;
        }
        break;
      case '{':
      case '[':
        depth++;
        if (depth === 1) expectKey = c === '{';
        else if (depth === 2 && c === '[' && valueKey === 'ops') {
          current = [];
          start = i + 1;
        }
        break;
      case ',':
        if (depth === 1) expectKey = true;
        else if (depth === 2 && current) {
          current.push(trim(blob.slice(start, i)));
          start = i + 1;
        }
        break;
      case '}':
      case ']':
        if (depth === 2 && current && c === ']') {
          const last = trim(blob.slice(start, i));
          if (last !== '' || current.length > 0) current.push(last);
          found = current;
          current = null;
        }
        depth--;
        break;
    }
  }
  if (!found) throw new FormatError(rules.pack);
  return found;
}

function entryNumbers(entries: readonly Entry[], prefix: string): number[] {
  return entries
    .filter((e) => e.name.startsWith(`${prefix}-`))
    .map((e) => {
      const digits = e.name.slice(prefix.length + 1);
      return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
    });
}

function only(numbers: readonly number[]): number | null {
  const [n] = numbers;
  return numbers.length === 1 && n !== undefined && Number.isSafeInteger(n) ? n : null;
}

function decodeOp(value: unknown, id: string, at: string): Op {
  const head = opJson.safeParse(value);
  if (!head.success) throw new FormatError(rules.field, at);
  const input = value as Record<string, unknown>;
  const { type, timestamp } = head.data;
  const shape = shapeJson[type];
  if (shape) {
    const parsed = shape.safeParse(value);
    if (!parsed.success) throw new FormatError(rules.field, `${at} ${String(parsed.error.issues[0]?.path[0])}`);
  }
  const fields: Record<string, unknown> = {};
  for (const name of Object.keys(shapes[type] ?? {})) fields[name] = input[name];
  return { id, type, timestamp, metadata: (input.metadata ?? {}) as Record<string, string>, fields };
}

function decodePack(commit: RawCommit & { ops: Uint8Array }): Readonly<{ author: string; ops: readonly Op[] }> {
  let text: string;
  let json: unknown;
  try {
    text = decoder.decode(commit.ops);
    json = JSON.parse(text);
  } catch {
    throw new FormatError(rules.utf8, commit.commit);
  }
  const pack = packJson.safeParse(json);
  if (!pack.success) throw new FormatError(rules.pack, commit.commit);
  const values = pack.data.ops;
  const raw = rawElements(text);
  if (raw.length !== values.length) throw new FormatError(rules.pack, commit.commit);
  return {
    author: pack.data.author.id,
    ops: values.map((value, i) => decodeOp(value, sha256(raw[i] ?? ''), commit.commit)),
  };
}

export function checkBug(ref: string, commits: readonly RawCommit[], identities: ReadonlyMap<string, Identity>): Bug {
  const clocks = new Map<string, Readonly<{ edit: number; create: readonly number[] }>>();
  for (const c of commits) {
    const versions = entryNumbers(c.entries, 'version');
    if (versions.length !== 1) throw new FormatError(rules.versionEntry, c.commit);
    if (versions[0] !== bugVersion) throw new FormatError(rules.version, c.commit);
    if (c.ops === null) throw new FormatError(rules.opsEntry, c.commit);
    const edit = only(entryNumbers(c.entries, 'edit-clock'));
    if (edit === null) throw new FormatError(rules.editClock, c.commit);
    clocks.set(c.commit, { edit, create: entryNumbers(c.entries, 'create-clock') });
  }
  if (clocks.size !== commits.length || commits.some((c) => c.parents.some((p) => !clocks.has(p))))
    throw new FormatError(rules.commits);
  const roots = commits.filter((c) => c.parents.length === 0);
  const [root] = roots;
  if (roots.length !== 1 || root === undefined) throw new FormatError(rules.root);
  const parents = new Set(commits.flatMap((c) => c.parents));
  const heads = commits.filter((c) => !parents.has(c.commit));
  const [head] = heads;
  if (heads.length !== 1 || head === undefined) throw new FormatError(rules.head);
  const clockOf = (hash: string) => clocks.get(hash)?.edit ?? 0;
  const createClock = only(clocks.get(root.commit)?.create ?? []);
  if (createClock === null || createClock === 0) throw new FormatError(rules.rootClock, root.commit);
  for (const c of commits) {
    if (c !== root && (clocks.get(c.commit)?.create.length ?? 0) > 0) throw new FormatError(rules.childClock, c.commit);
    const edit = clockOf(c.commit);
    for (const p of c.parents) {
      if (edit <= clockOf(p)) throw new FormatError(rules.clockOrder, c.commit);
      if (c.parents.length === 1 && edit - clockOf(p) > maxJump) throw new FormatError(rules.clockJump, c.commit);
    }
  }

  const packs: Pack[] = commits.map((c) => {
    const blob = c.ops ?? new Uint8Array();
    const { author, ops } = decodePack({ ...c, ops: blob });
    if (c.parents.length > 1 && ops.length > 0) throw new FormatError(rules.merge, c.commit);
    const identity = identities.get(author);
    if (!identity) throw new FormatError(rules.author, c.commit);
    if (identity.keys) throw new FormatError(rules.key, c.commit);
    return {
      id: sha256(blob),
      commit: c.commit,
      editClock: clockOf(c.commit),
      createClock: c === root ? createClock : null,
      author,
      ops,
    };
  });
  packs.sort((a, b) => a.editClock - b.editClock || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const rootPack = packs.find((p) => p.commit === root.commit);
  const first = rootPack?.ops[0];
  if (first?.id !== ref) throw new FormatError(rules.ref, ref);
  if (rootPack?.ops.length !== 1 || first.type !== create) throw new FormatError(rules.rootPack, root.commit);
  const seen = new Set<string>();
  for (const pack of packs)
    for (const op of pack.ops) {
      if (op.type === create && pack !== rootPack) throw new FormatError(rules.lateCreate, pack.commit);
      if (seen.has(op.id)) throw new FormatError(rules.duplicate, op.id);
      seen.add(op.id);
    }
  return {
    id: ref,
    tip: head.commit,
    createClock,
    editClock: packs.reduce((most, p) => Math.max(most, p.editClock), 0),
    packs,
  };
}

export function checkIdentity(ref: string, chain: readonly IdentityCommit[]): Identity {
  for (const c of chain) {
    const [entry] = c.entries;
    if (c.entries.length !== 1 || entry?.name !== 'version' || entry.type !== 'blob' || c.version === null)
      throw new FormatError(rules.identityTree, c.commit);
  }
  const byHash = new Map(chain.map((c) => [c.commit, c]));
  const child = new Map<string, IdentityCommit>();
  for (const c of chain) {
    const [parent] = c.parents;
    if (parent === undefined) continue;
    if (c.parents.length > 1 || !byHash.has(parent) || child.has(parent))
      throw new FormatError(rules.identityChain, c.commit);
    child.set(parent, c);
  }
  const roots = chain.filter((c) => c.parents.length === 0);
  const ordered: IdentityCommit[] = [];
  for (let c = roots.length === 1 ? roots[0] : undefined; c; c = child.get(c.commit)) ordered.push(c);
  const [first] = ordered;
  const last = ordered.at(-1);
  if (ordered.length !== chain.length || first === undefined || last === undefined)
    throw new FormatError(rules.identityChain);

  const versions = ordered.map((c) => {
    let json: unknown;
    try {
      json = JSON.parse(decoder.decode(c.version ?? new Uint8Array()));
    } catch {
      throw new FormatError(rules.identityUtf8, c.commit);
    }
    const parsed = identityVersionJson.safeParse(json);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      throw new FormatError(
        typeof field === 'string' ? (identityRules[field] ?? rules.identityUtf8) : rules.identityUtf8,
        c.commit,
      );
    }
    return { name: parsed.data.name ?? null, email: parsed.data.email ?? null };
  });
  if (sha256(first.version ?? new Uint8Array()) !== ref) throw new FormatError(rules.identityRef, ref);
  const latest = versions.at(-1);
  return { id: ref, tip: last.commit, name: latest?.name ?? null, email: latest?.email ?? null, keys: false };
}

const text = (op: Op, name: string) => String(op.fields[name]);
const blobHash = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const list = (op: Op, name: string): readonly string[] => {
  const value = op.fields[name];
  return Array.isArray(value) ? value.map(String) : [];
};

export function snapshot(bug: Bug): Snapshot {
  const createOp = bug.packs[0]?.ops[0];
  const author = bug.packs[0]?.author;
  if (createOp?.type !== create || author === undefined) throw new FormatError(rules.rootPack);
  const replay = bug.packs.flatMap((pack) => pack.ops.map((op) => ({ op, author: pack.author })));
  let title = text(createOp, 'title');
  let body = text(createOp, 'message');
  let state: 'open' | 'closed' = 'open';
  let closedAt: number | null = null;
  let closeOp: string | null = null;
  const labels = new Set<string>();
  const comments: { id: string; author: string; at: number; body: string }[] = [];
  const byId = new Map<string, { body: string }>();
  const events: ({ kind: 'comment'; comment: Comment } | Extract<SnapshotEvent, { kind: 'label' }>)[] = [];
  const metadata = new Map<string, Record<string, string>>();
  const files = new Set<string>();

  for (const { op } of replay) if (Object.keys(op.metadata).length > 0) metadata.set(op.id, { ...op.metadata });
  for (const { op, author: by } of replay) {
    if (op.type === create || op.type === addComment || op.type === editComment)
      for (const hash of list(op, 'files')) if (blobHash.test(hash)) files.add(hash);
    switch (op.type) {
      case setTitle:
        title = text(op, 'title');
        break;
      case addComment: {
        const comment = { id: op.id, author: by, at: op.timestamp, body: text(op, 'message') };
        comments.push(comment);
        byId.set(op.id, comment);
        events.push({ kind: 'comment', comment });
        break;
      }
      case editComment: {
        const target = text(op, 'target');
        const comment = byId.get(target);
        if (target === createOp.id) body = text(op, 'message');
        else if (comment) comment.body = text(op, 'message');
        break;
      }
      case setStatus:
        if (op.fields.status === 2) {
          state = 'closed';
          closedAt = op.timestamp;
          closeOp = op.id;
        } else {
          state = 'open';
          closedAt = null;
          closeOp = null;
        }
        break;
      case labelChange:
        for (const name of list(op, 'added')) {
          labels.add(name);
          events.push({ kind: 'label', change: 'added', name, at: op.timestamp });
        }
        for (const name of list(op, 'removed')) {
          labels.delete(name);
          events.push({ kind: 'label', change: 'removed', name, at: op.timestamp });
        }
        break;
      case setMetadata: {
        const target = text(op, 'target');
        const values = metadata.get(target) ?? {};
        for (const [key, value] of Object.entries(op.fields.new_metadata ?? {}))
          if (!Object.hasOwn(values, key)) values[key] = String(value);
        if (Object.keys(values).length > 0) metadata.set(target, values);
        break;
      }
    }
  }
  return {
    title,
    body,
    createOp: createOp.id,
    author,
    state,
    labels: [...labels].sort(),
    comments: comments.map((c) => ({ ...c })),
    events: events.map((e) => (e.kind === 'comment' ? { kind: 'comment', ...e.comment } : e)),
    metadata,
    createdAt: createOp.timestamp,
    updatedAt: replay.at(-1)?.op.timestamp ?? createOp.timestamp,
    closedAt,
    closeOp,
    files: [...files],
  };
}
