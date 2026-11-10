import { type ReviewerLevel, reviewerLevels } from './effort.ts';
import { type Host, hosts } from './host-names.ts';
import { type Document, isAlias, isMap, isScalar, isSeq, parseAllDocuments } from './vendor/yaml.mjs';
import { type Step, steps } from './workflow.ts';

export const bunFloor = '1.4.4';

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

export class ConfigError extends Error {
  field: string;

  constructor(
    path: Path,
    message: string,
    readonly ioCode?: string,
  ) {
    super(message);
    this.field = field(path);
  }
}

const coreTag = (name: string) => `tag:yaml.org,2002:${name}`;
const typedTags = ['null', 'bool', 'int', 'float'].map(coreTag);
const coreTags = ['map', 'seq', 'str'].map(coreTag).concat(typedTags);
const yaml11Int = /^[-+]?(?:0[bB][01]+|0[oO][0-7]+|0[xX][0-9a-fA-F]+|[0-9]+)$/;
const yaml11Float = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;

export const skillName = /^[a-z][a-z0-9-]*$/;

export type { Host };
export type AgentChoice = Readonly<{ kind: 'default' } | { kind: 'explicit'; host: Host }>;
export type AgentOrder = Readonly<{ schema: 1; order: readonly Host[]; version: string }>;
export type UsageBlock = Readonly<{ reason: string; resetAt: number | null }>;
export type AgentDecision =
  | { kind: 'start'; host: Host }
  | { kind: 'wait'; blocked: readonly (UsageBlock & { host: Host })[]; nextResetAt: number | null };

const sourceData = Symbol('ConfigSource');

export type ConfigSource = Readonly<{
  [sourceData]: { value: unknown; nodes: NodeRecord[] };
}>;

export type Config = Readonly<{
  gates?: Readonly<Partial<Record<Step, 'manual' | 'auto'>>>;
  agents?: Readonly<Partial<Record<Step, Host>>>;
  board?: Readonly<{ port?: number }>;
  worktreeSetup?: string;
  custom?: Readonly<Record<string, string>>;
  codexProfiles?: Readonly<
    Record<
      string,
      Readonly<{
        slots: readonly [string, string, string, string];
        reviewer: Readonly<{ rank: 0 | 1 | 2 | 3; effort: ReviewerLevel }>;
      }>
    >
  >;
}> &
  (Readonly<{ landing: 'pr' }> | Readonly<{ landing: 'merge'; suite: string }>);

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

function checkCharacters(text: string): void {
  const index = text.search(/[^\t\n\r\x20-\x7e\xa0-\u2027\u202a-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u);
  if (index >= 0) {
    const line = text.slice(0, index).split('\n').length;
    throw new ConfigError([], `invalid character ${codePoint(text, index)} at line ${line}`);
  }
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
  // yaml 2.9.1 drops a directive after the last document; YAML 1.2 needs a document after each directive.
  if (/^\uFEFF?%/m.test(source.slice(doc.range[2]))) throw new ConfigError([], 'need one YAML document');
  if (doc.directives.docStart && /^---[ \t]*[^ \t\r\n]/.test(source.slice(doc.range[0]))) {
    throw new ConfigError([], 'put nothing after --- on its line');
  }
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
  ];
  checkRules(nodes, rules);
}

function checkFieldMetadata(nodes: NodeRecord[]): void {
  const rules: [string, (node: NodeRecord) => Path | false][] = [
    [
      'use a literal block for multiline text',
      (node) => !node.key && node.style === 'BLOCK_FOLDED' && at(node.path, 'custom.*') && node.path,
    ],
    [
      'need an integer',
      (node) =>
        !node.key &&
        (node.tag === coreTag('float') || node.plain === '-0' || /^[-+]?0[0-7]*[89][0-9]*$/.test(node.plain ?? '')) &&
        (at(node.path, 'board.port') || at(node.path, 'codexProfiles.*.reviewer.rank')) &&
        node.path,
    ],
  ];
  checkRules(nodes, rules);
}

function checkRules(nodes: NodeRecord[], rules: [string, (node: NodeRecord) => Path | false][]): void {
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

function keysOnly(value: Record<string, unknown>, allowed: readonly string[], path: Path): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined) throw new ConfigError([...path, unknown], 'unknown field');
}

function required(value: Record<string, unknown>, key: string, path: Path): void {
  if (!Object.hasOwn(value, key)) throw new ConfigError([...path, key], 'required field');
}

function oneOf(value: unknown, values: readonly string[], path: Path): void {
  if (typeof value !== 'string' || !values.includes(value)) throw new ConfigError(path, 'invalid value');
}

function text(value: unknown, path: Path): void {
  if (typeof value !== 'string') throw new ConfigError(path, 'need a string');
  if (value.includes('\0')) throw new ConfigError(path, 'NUL is not allowed');
}

export function validateWorktreeSetup(value: unknown): string {
  if (typeof value !== 'string') throw new ConfigError(['worktreeSetup'], 'need a string');
  if (
    value !== '' &&
    (!value.endsWith('.ts') ||
      /[\\:]/.test(value) ||
      [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
      value.split('/').some((part) => ['', '.', '..', '.git'].includes(part)))
  ) {
    throw new ConfigError(['worktreeSetup'], 'need a relative path of a .ts file in the checkout');
  }
  return value;
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
  oneOf(reviewer.effort, reviewerLevels, [...reviewerPath, 'effort']);
}

function checkSchema(value: unknown): asserts value is Config {
  const config = object(value, []);
  keysOnly(config, ['landing', 'gates', 'agents', 'board', 'worktreeSetup', 'suite', 'custom', 'codexProfiles'], []);
  required(config, 'landing', []);
  oneOf(config.landing, ['pr', 'merge'], ['landing']);
  if (Object.hasOwn(config, 'gates')) {
    const gates = object(config.gates, ['gates']);
    keysOnly(gates, steps, ['gates']);
    for (const [step, gate] of Object.entries(gates)) {
      if (gate !== 'manual' && gate !== 'auto') throw new ConfigError(['gates', step], 'need manual or auto');
    }
  }
  if (Object.hasOwn(config, 'agents')) {
    const agents = object(config.agents, ['agents']);
    keysOnly(agents, steps, ['agents']);
    for (const [step, host] of Object.entries(agents)) oneOf(host, hosts, ['agents', step]);
  }
  if (Object.hasOwn(config, 'board')) {
    const board = object(config.board, ['board']);
    keysOnly(board, ['port'], ['board']);
    if (Object.hasOwn(board, 'port')) integer(board.port, 1024, 65535, ['board', 'port']);
  }
  if (Object.hasOwn(config, 'worktreeSetup')) validateWorktreeSetup(config.worktreeSetup);
  if (config.landing === 'merge') required(config, 'suite', []);
  if (Object.hasOwn(config, 'suite')) {
    text(config.suite, ['suite']);
    const suite = config.suite as string;
    if (config.landing === 'pr') throw new ConfigError(['suite'], 'the landing pr runs no suite');
    if (
      suite.startsWith('/') ||
      /^[A-Za-z]:\//.test(suite) ||
      suite.includes('\\') ||
      suite.split('/').includes('..') ||
      !suite.endsWith('.ts')
    ) {
      throw new ConfigError(['suite'], 'need a relative path of a .ts file in the checkout');
    }
  }
  if (Object.hasOwn(config, 'custom')) {
    const custom = object(config.custom, ['custom']);
    const key = Object.keys(custom).find((name) => !skillName.test(name));
    if (key !== undefined) {
      throw new ConfigError(
        ['custom', key],
        'need a skill name: a lowercase letter, then lowercase letters, digits, or -',
      );
    }
    for (const [skill, instruction] of Object.entries(custom)) text(instruction, ['custom', skill]);
  }
  if (Object.hasOwn(config, 'codexProfiles')) {
    for (const [runtime, entry] of Object.entries(object(config.codexProfiles, ['codexProfiles']))) {
      if (runtime === '') throw new ConfigError(['codexProfiles'], 'runtime keys must be nonempty');
      profile(entry, ['codexProfiles', runtime]);
    }
  }
}

export function parseConfigText(text: string): ConfigSource {
  checkCharacters(text);
  const doc = parseOne(text);
  const nodes = collectNodes(doc);
  checkWellFormed(nodes);
  checkMetadata(nodes);
  return Object.freeze({ [sourceData]: { value: doc.toJS(), nodes } });
}

export function validateHost(value: unknown): Host {
  oneOf(value, hosts, ['host']);
  return value as Host;
}

function freeze(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}

export function validateConfig(source: ConfigSource): Config {
  const { value, nodes } = source[sourceData];
  checkFieldMetadata(nodes);
  checkSchema(value);
  freeze(value);
  return value;
}

export async function checkSkills(
  config: Config,
  plugin: string,
  isFile: (path: string) => Promise<boolean>,
): Promise<void> {
  const root = plugin.replace(/[/\\]$/, '');
  for (const key of Object.keys(config.custom ?? {})) {
    const path = `${root}/skills/${key}/SKILL.md`;
    if (!(await isFile(path))) throw new ConfigError(['custom', key], `the plugin has no skill file ${path}`);
  }
}

export function formatConfigError(checkout: string, error: ConfigError): string {
  return `celetis: ${checkout}/.celetis.yaml: ${error.field}: ${error.message}`;
}
