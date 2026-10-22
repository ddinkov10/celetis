import fs from 'node:fs';
import { type Document, isAlias, isMap, isScalar, isSeq, parseAllDocuments } from './vendor/yaml.mjs';

const floor = '1.4.2';

type Path = (string | number)[];

type NodeRecord = {
  path: Path;
  key: boolean;
  kind: 'alias' | 'scalar' | 'map' | 'seq';
  tag: string;
  style?: string;
  value?: unknown;
  plain?: string;
  keys?: string[];
};

class ConfigError extends Error {
  field: string;

  constructor(path: Path, message: string) {
    super(message);
    this.field = field(path);
  }
}

const coreTag = (name: string) => `tag:yaml.org,2002:${name}`;
const typedTags = ['null', 'bool', 'int', 'float'].map(coreTag);
const coreTags = ['map', 'seq', 'str'].map(coreTag).concat(typedTags);
const yaml11Int = /^[-+]?(?:0[bB][01]+|0[oO][0-7]+|0[xX][0-9a-fA-F]+|[0-9]+)$/;
const yaml11Float = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;
const notRegularFile = 'need a regular, readable file, with no symlink';
const steps = ['triage', 'specify', 'bug', 'chore', 'hotfix', 'plan', 'implement'];
const skills = [
  'bug',
  'chore',
  'critic-loop',
  'doc-drift-sync',
  'feature',
  'guide',
  'hotfix',
  'implement',
  'intake',
  'lesson',
  'lesson-review',
  'plan',
  'polishing-code-comments',
  'prototype',
  'record-architecture-decisions',
  'setup',
  'specify',
  'triage',
  'writing-for-agents',
];

function field(path: Path): string {
  return path.join('.') || '<document>';
}

function at(path: Path, pattern: string): boolean {
  const parts = pattern.split('.');
  return path.length === parts.length && parts.every((part, index) => part === '*' || part === path[index]);
}

function codePoint(text: string, index: number): string {
  return `U+${text.codePointAt(index)?.toString(16).toUpperCase().padStart(4, '0')}`;
}

function yaml11Number(text: string): boolean {
  const digits = text.replaceAll('_', '');
  return /^[-+.0-9]/.test(text) && (yaml11Int.test(digits) || yaml11Float.test(digits));
}

function readSnapshot(file: string): Uint8Array {
  let before: fs.BigIntStats;
  try {
    before = fs.lstatSync(file, { bigint: true });
  } catch {
    throw new ConfigError([], notRegularFile);
  }
  if (!before.isFile()) throw new ConfigError([], notRegularFile);
  let fd: number;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    throw new ConfigError([], `cannot open the file: ${(error as NodeJS.ErrnoException).code}`);
  }
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new ConfigError([], 'the file changed during the read');
    }
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function decode(bytes: Uint8Array): string {
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ConfigError([], 'invalid UTF-8');
  }
  const index = decoded.search(/[^\t\n\r\x20-\x7e\xa0-\u2027\u202a-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u);
  if (index >= 0) {
    const line = decoded.slice(0, index).split('\n').length;
    throw new ConfigError([], `invalid character ${codePoint(decoded, index)} at line ${line}`);
  }
  return decoded;
}

function parse(source: string): Document[] {
  return parseAllDocuments(source, { schema: 'core', merge: false, uniqueKeys: false, customTags: ['timestamp'] });
}

function lastNode(node: unknown): unknown {
  if (isMap(node)) return lastNode(node.items.at(-1)?.value);
  if (isSeq(node)) return lastNode(node.items.at(-1));
  return node;
}

// When the file has no final line break, yaml 2.9.1 still ends the last block scalar with one; YAML 1.2 does not.
// The last line belongs to the block when its removal changes the value.
function removeAddedBreak(doc: Document, source: string): void {
  const node = lastNode(doc.contents);
  if (!isScalar(node) || !node.type?.startsWith('BLOCK') || typeof node.value !== 'string' || /[\r\n]$/.test(source)) {
    return;
  }
  const before = lastNode(parse(source.slice(0, source.lastIndexOf('\n') + 1))[0]?.contents);
  if (!isScalar(before) || before.value !== node.value) node.value = node.value.replace(/\n$/, '');
}

function parseOne(source: string): Document {
  const docs = parse(source);
  for (const { errors } of docs) {
    const [error] = errors;
    if (error) throw new ConfigError([], `invalid YAML: ${error.message.split('\n')[0]}`);
  }
  const [doc] = docs;
  if (docs.length !== 1 || !doc) throw new ConfigError([], 'need one YAML document');
  removeAddedBreak(doc, source);
  return doc;
}

function plainTag(doc: Document, source: string): string {
  const tag = doc.schema.tags.find((t) => t.default === true && !t.collection && t.test?.test(source));
  return tag?.tag ?? coreTag('str');
}

function collectNodes(doc: Document): NodeRecord[] {
  const nodes: NodeRecord[] = [];
  const visit = (node: unknown, path: Path, key: boolean): void => {
    if (isAlias(node)) {
      nodes.push({ path, key, kind: 'alias', tag: '' });
    } else if (isScalar(node)) {
      const plain = node.tag === undefined && node.type === 'PLAIN' ? (node.source ?? '') : undefined;
      const tag =
        node.tag ?? (plain === undefined ? coreTag('str') : plain === '<<' ? coreTag('merge') : plainTag(doc, plain));
      nodes.push({ path, key, kind: 'scalar', tag, style: node.type, value: node.value, plain });
    } else if (isMap(node)) {
      const keys = node.items.flatMap((pair) => (isScalar(pair.key) ? [pair.key.source ?? ''] : []));
      nodes.push({ path, key, kind: 'map', tag: node.tag ?? coreTag('map'), keys });
      for (const pair of node.items) {
        const pairPath = isScalar(pair.key) || isAlias(pair.key) ? [...path, pair.key.source ?? ''] : path;
        visit(pair.key, pairPath, true);
        visit(pair.value, pairPath, false);
      }
    } else if (isSeq(node)) {
      nodes.push({ path, key, kind: 'seq', tag: node.tag ?? coreTag('seq') });
      for (const [index, item] of node.items.entries()) visit(item, [...path, index], false);
    }
  };
  visit(doc.contents, [], false);
  return nodes;
}

function checkWellFormed(nodes: NodeRecord[]): void {
  for (const { path, value } of nodes) {
    if (typeof value !== 'string') continue;
    const index = value.search(/\p{Cs}/u);
    if (index >= 0) throw new ConfigError(path, `invalid character ${codePoint(value, index)}`);
  }
}

function checkMetadata(nodes: NodeRecord[]): void {
  if (nodes[0]?.tag !== coreTag('map')) throw new ConfigError([], 'need a mapping root');
  const duplicate = (keys: string[]) => keys.filter((key, index) => keys.indexOf(key) !== index).sort()[0];
  const rules: [string, (node: NodeRecord) => Path | false][] = [
    ['mapping keys must be strings', (node) => node.key && node.tag !== coreTag('str') && node.path],
    [
      'duplicate key',
      (node) => {
        const key = duplicate(node.keys ?? []);
        return key !== undefined && [...node.path, key];
      },
    ],
    ['YAML aliases are not allowed', (node) => node.kind === 'alias' && node.path],
    [
      'unsupported YAML tag',
      (node) =>
        (!coreTags.includes(node.tag) ||
          (typedTags.includes(node.tag) && typeof node.value === 'string') ||
          ((node.kind === 'map' || node.kind === 'seq') && node.tag !== coreTag(node.kind))) &&
        node.path,
    ],
    [
      'quote this value: YAML 1.1 reads it as a number',
      (node) => node.tag === coreTag('str') && node.plain !== undefined && yaml11Number(node.plain) && node.path,
    ],
    [
      'non-finite numbers are not allowed',
      (node) =>
        node.tag === coreTag('float') && typeof node.value === 'number' && !Number.isFinite(node.value) && node.path,
    ],
    [
      'use a literal block for multiline text',
      (node) =>
        !node.key &&
        node.style === 'BLOCK_FOLDED' &&
        (at(node.path, 'worktreeSetup') || at(node.path, 'custom.*')) &&
        node.path,
    ],
    [
      'need an integer',
      (node) =>
        !node.key &&
        (node.tag === coreTag('float') || /^[-+]?0[0-9]*[89][0-9]*$/.test(node.plain ?? '')) &&
        (at(node.path, 'board.port') || at(node.path, 'codexProfiles.*.reviewer.rank')) &&
        node.path,
    ],
  ];
  for (const [message, hit] of rules) {
    for (const node of nodes) {
      const path = hit(node);
      if (path) throw new ConfigError(path, message);
    }
  }
}

function object(value: unknown, path: Path): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigError(path, 'need an object');
  }
  return value as Record<string, unknown>;
}

function keysOnly(value: Record<string, unknown>, allowed: string[], path: Path): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined) throw new ConfigError([...path, unknown], 'unknown field');
}

function required(value: Record<string, unknown>, key: string, path: Path): void {
  if (!Object.hasOwn(value, key)) throw new ConfigError([...path, key], 'required field');
}

function oneOf(value: unknown, values: string[], path: Path): void {
  if (typeof value !== 'string' || !values.includes(value)) throw new ConfigError(path, 'invalid value');
}

function text(value: unknown, path: Path): void {
  if (typeof value !== 'string') throw new ConfigError(path, 'need a string');
  if (value.includes('\0')) throw new ConfigError(path, 'NUL is not allowed');
}

function integer(value: unknown, min: number, max: number, path: Path): void {
  if (typeof value !== 'number') throw new ConfigError(path, 'need an integer');
  if (!Number.isInteger(value) || value < min || value > max) throw new ConfigError(path, 'integer is out of range');
}

function profile(value: unknown, path: Path): void {
  const fields = object(value, path);
  keysOnly(fields, ['slots', 'reviewer'], path);
  required(fields, 'slots', path);
  required(fields, 'reviewer', path);
  const slots = fields.slots;
  if (
    !Array.isArray(slots) ||
    slots.length !== 4 ||
    !slots.every((slot) => typeof slot === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(slot))
  ) {
    throw new ConfigError([...path, 'slots'], 'need four nonempty model IDs');
  }
  const reviewerPath = [...path, 'reviewer'];
  const reviewer = object(fields.reviewer, reviewerPath);
  keysOnly(reviewer, ['rank', 'effort'], reviewerPath);
  required(reviewer, 'rank', reviewerPath);
  required(reviewer, 'effort', reviewerPath);
  integer(reviewer.rank, 0, 3, [...reviewerPath, 'rank']);
  oneOf(reviewer.effort, ['low', 'medium', 'high', 'xhigh'], [...reviewerPath, 'effort']);
}

function checkSchema(value: unknown): void {
  const config = object(value, []);
  keysOnly(config, ['host', 'landing', 'gates', 'board', 'worktreeSetup', 'custom', 'codexProfiles'], []);
  required(config, 'landing', []);
  oneOf(config.landing, ['pr', 'merge'], ['landing']);
  if (Object.hasOwn(config, 'host')) oneOf(config.host, ['claude', 'codex'], ['host']);
  if (Object.hasOwn(config, 'gates')) {
    const gates = object(config.gates, ['gates']);
    keysOnly(gates, steps, ['gates']);
    for (const [step, gate] of Object.entries(gates)) oneOf(gate, ['me', 'auto'], ['gates', step]);
  }
  if (Object.hasOwn(config, 'board')) {
    const board = object(config.board, ['board']);
    keysOnly(board, ['port'], ['board']);
    if (Object.hasOwn(board, 'port')) integer(board.port, 1024, 65535, ['board', 'port']);
  }
  if (Object.hasOwn(config, 'worktreeSetup')) text(config.worktreeSetup, ['worktreeSetup']);
  if (Object.hasOwn(config, 'custom')) {
    const custom = object(config.custom, ['custom']);
    keysOnly(custom, skills, ['custom']);
    for (const [skill, instruction] of Object.entries(custom)) text(instruction, ['custom', skill]);
  }
  if (Object.hasOwn(config, 'codexProfiles')) {
    for (const [runtime, entry] of Object.entries(object(config.codexProfiles, ['codexProfiles']))) {
      if (runtime === '') throw new ConfigError(['codexProfiles'], 'runtime keys must be nonempty');
      profile(entry, ['codexProfiles', runtime]);
    }
  }
}

const file = `${process.argv[2]}/.celetis.yaml`;
try {
  if (Bun.semver.order(Bun.version, floor) < 0) {
    throw new ConfigError([], `need Bun >=${floor} on PATH, found ${Bun.version}`);
  }
  const doc = parseOne(decode(readSnapshot(file)));
  const nodes = collectNodes(doc);
  checkWellFormed(nodes);
  checkMetadata(nodes);
  const config = doc.toJS();
  checkSchema(config);
  console.log(JSON.stringify(config));
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(`celetis: ${file}: ${error.field}: ${error.message}`);
  process.exit(2);
}
