import { type Document, isAlias, isMap, isScalar, isSeq, parseAllDocuments } from 'yaml';
import { z } from 'zod';
import { type Host, hosts, isHost } from '../host/names.ts';
import { orderVersion } from '../state/fields.ts';
import type { TrackerKind } from '../tracker/grammar.ts';
import { levels, models, reviewerLevels } from '../workflow/effort.ts';
import { autoLaneNames, lanes, type Step, steps } from '../workflow/workflow.ts';

export const bunFloor = '1.4.4';
export const configSchema = 1;

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
  schema?: number;

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

type Frozen<T> = T extends object ? { readonly [Key in keyof T]: Frozen<T[Key]> } : T;

export const agentOrderList = z
  .array(z.custom<Host>(isHost))
  .min(1)
  .refine((order) => new Set(order).size === order.length);
export const agentOrderRecord = z.strictObject({
  schema: z.literal(1),
  order: agentOrderList,
  version: z.string().regex(orderVersion),
});

export type { Host };
export type AgentChoice = Readonly<{ kind: 'default' } | { kind: 'explicit'; host: Host }>;
export type AgentOrder = Frozen<z.output<typeof agentOrderRecord>>;
export type UsageBlock = Readonly<{ reason: string; resetAt: number | null }>;
export type AgentDecision =
  | { kind: 'start'; host: Host }
  | { kind: 'wait'; blocked: readonly (UsageBlock & { host: Host })[]; nextResetAt: number | null };

const sourceData = Symbol('ConfigSource');

export type ConfigSource = Readonly<{
  [sourceData]: { value: unknown; nodes: NodeRecord[] };
}>;

export type ConfigReader = Readonly<{ part: string; act: string }>;

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

function parse(source: string): Document.Parsed[] {
  return parseAllDocuments(source, { schema: 'core', merge: false, uniqueKeys: false, customTags: ['timestamp'] });
}

function lastNode(node: unknown): unknown {
  if (isMap(node)) return lastNode(node.items.at(-1)?.value);
  if (isSeq(node)) return lastNode(node.items.at(-1));
  return node;
}

// When the file has no final line break, yaml 2.9.1 still ends the last block scalar with one; YAML 1.2 does not.
function removeAddedBreak(doc: Document.Parsed, source: string): void {
  const node = lastNode(doc.contents);
  if (!isScalar(node) || !node.type?.startsWith('BLOCK') || typeof node.value !== 'string' || /[\r\n]$/.test(source)) {
    return;
  }
  const before = lastNode(parse(source.slice(0, source.lastIndexOf('\n') + 1))[0]?.contents);
  if (!isScalar(before) || before.value !== node.value) node.value = node.value.replace(/\n$/, '');
}

function parseOne(source: string): Document.Parsed {
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

function plainTag(doc: Document.Parsed, source: string): string {
  const tag = doc.schema.tags.find((t) => t.default === true && !t.collection && t.test?.test(source));
  return tag?.tag ?? coreTag('str');
}

function collectNodes(doc: Document.Parsed): NodeRecord[] {
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

const isMapping = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pathLine = 'need a relative path of a .ts file in the checkout';
const skillLine = 'need a skill name: a lowercase letter, then lowercase letters, digits, or -';
const laneGateLine = 'need manual, auto, or a mapping from a step of the lane to manual or auto';
const autoLanesLine = `need a sequence with one or more of ${autoLaneNames.join(', ')}`;

const nulFree = z.string().refine((value) => !value.includes('\0'));
const worktreeSetup = z
  .string()
  .refine(
    (value) =>
      value === '' ||
      (value.endsWith('.ts') &&
        !/[\\:]/.test(value) &&
        ![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) &&
        !value.split('/').some((part) => ['', '.', '..', '.git'].includes(part))),
  );

export const modelId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/);
export const modelSlots = z.tuple([modelId, modelId, modelId, modelId]);
export const reviewerShape = {
  rank: z.int().min(0).max(3) as z.ZodType<0 | 1 | 2 | 3>,
  effort: z.enum(reviewerLevels),
};
export const codexProfile = z.strictObject({ slots: modelSlots, reviewer: z.strictObject(reviewerShape) });

const gate = z.enum(['manual', 'auto']);
const laneGate = <S extends readonly string[]>(names: S) =>
  z
    .union([
      gate,
      z.strictObject(
        Object.fromEntries(names.map((name) => [name, gate.optional()])) as Record<
          S[number],
          z.ZodOptional<typeof gate>
        >,
      ),
    ])
    .optional();
const gates = z.strictObject({
  triage: gate.optional(),
  feature: laneGate(lanes.feature.steps),
  bug: laneGate(lanes.bug.steps),
  chore: laneGate(lanes.chore.steps),
  hotfix: laneGate(lanes.hotfix.steps),
});
const stepMap = <T extends z.ZodType>(entry: T) =>
  z.strictObject(Object.fromEntries(steps.map((step) => [step, entry.optional()])) as Record<Step, z.ZodOptional<T>>);
const pin = z.strictObject({ model: z.enum(models).optional(), effort: z.enum(levels).optional() });

// z.record skips an own __proto__ key; these maps check every own key.
function entries<T extends z.ZodType>(key: z.ZodType<string>, entry: T) {
  return z.custom<Record<string, z.output<T>>>(isMapping).superRefine((value, ctx) => {
    for (const name of Object.keys(value))
      if (!key.safeParse(name).success)
        ctx.addIssue({ code: 'invalid_key', origin: 'record', issues: [], path: [name], input: name });
    for (const [name, each] of Object.entries(value))
      for (const issue of entry.safeParse(each).error?.issues ?? [])
        ctx.addIssue({ ...issue, path: [name, ...issue.path] });
  });
}

const configShape = z.strictObject({
  schema: z.number(),
  tracker: z.enum(['github', 'local']),
  landing: z.enum(['pr', 'merge']),
  gates: gates.optional(),
  agents: stepMap(z.enum(hosts)).optional(),
  sessions: stepMap(pin).optional(),
  autoLanes: z.array(z.enum(autoLaneNames)).min(1).optional(),
  board: z.strictObject({ port: z.int().min(1024).max(65535).optional() }).optional(),
  worktreeSetup: worktreeSetup.optional(),
  holdLanding: z.boolean().optional(),
  suite: nulFree.optional(),
  custom: entries(z.string().regex(skillName), nulFree).optional(),
  codexProfiles: entries(z.string().min(1), codexProfile).optional(),
});

export type Gates = Frozen<z.output<typeof gates>>;
export type Config = Frozen<Omit<z.output<typeof configShape>, 'tracker' | 'landing' | 'suite'>> &
  (
    | Readonly<{ tracker: 'github'; landing: 'pr' }>
    | Readonly<{ tracker: TrackerKind; landing: 'merge'; suite: string }>
  );

function child(value: unknown, path: Path): unknown {
  let node = value;
  for (const key of path)
    node = isMapping(node) || Array.isArray(node) ? Object.getOwnPropertyDescriptor(node, key)?.value : undefined;
  return node;
}

const integerLine = (value: unknown) => (typeof value === 'number' ? 'integer is out of range' : 'need an integer');
const textLine = (value: unknown) => (typeof value === 'string' ? 'NUL is not allowed' : 'need a string');
const leaves: [pattern: string, line: (value: unknown) => string][] = [
  ['tracker', () => 'invalid value'],
  ['landing', () => 'invalid value'],
  ['gates.triage', () => 'need manual or auto'],
  ['gates.*.*', () => 'need manual or auto'],
  ['agents.*', () => 'invalid value'],
  ['sessions.*.model', () => 'invalid value'],
  ['sessions.*.effort', () => 'invalid value'],
  ['board.port', integerLine],
  ['worktreeSetup', (value) => (typeof value === 'string' ? pathLine : 'need a string')],
  ['holdLanding', () => 'need a boolean'],
  ['suite', textLine],
  ['custom.*', textLine],
  ['codexProfiles.*.reviewer.rank', integerLine],
  ['codexProfiles.*.reviewer.effort', () => 'invalid value'],
];

function configError(issue: z.core.$ZodIssue, value: unknown, prefix: Path = []): ConfigError {
  const path: Path = [...prefix, ...issue.path.map(String)];
  if (issue.code === 'invalid_union' && at(path, 'gates.*')) {
    const [mapping] = issue.errors[1] ?? [];
    return isMapping(child(value, path)) && mapping
      ? configError(mapping, value, path)
      : new ConfigError(path, laneGateLine);
  }
  if (issue.code === 'unrecognized_keys') {
    const keyPath = [...path, issue.keys[0] ?? ''];
    if (at(path, 'gates')) return new ConfigError(keyPath, `need one of ${autoLaneNames.join(', ')}`);
    const lane = Object.entries(lanes).find(([name]) => at(path, `gates.${name}`));
    if (lane) return new ConfigError(keyPath, `need one of ${lane[1].steps.join(', ')}`);
    return new ConfigError(keyPath, 'unknown field');
  }
  if (issue.code === 'invalid_key' && at(path, 'custom.*')) return new ConfigError(path, skillLine);
  if (issue.code === 'invalid_key' && at(path, 'codexProfiles.*'))
    return new ConfigError(['codexProfiles'], 'runtime keys must be nonempty');
  const parent = child(value, path.slice(0, -1));
  const key = path.at(-1);
  if (key !== undefined && isMapping(parent) && !Object.hasOwn(parent, key))
    return new ConfigError(path, 'required field');
  if (path[0] === 'autoLanes') return new ConfigError(['autoLanes'], autoLanesLine);
  if (at(path.slice(0, 3), 'codexProfiles.*.slots'))
    return new ConfigError(path.slice(0, 3), 'need four nonempty model IDs');
  const leaf = leaves.find(([pattern]) => at(path, pattern));
  if (leaf) return new ConfigError(path, leaf[1](child(value, path)));
  return new ConfigError(path, 'need an object');
}

export function validateWorktreeSetup(value: unknown): string {
  const found = worktreeSetup.safeParse(value);
  if (!found.success) throw new ConfigError(['worktreeSetup'], typeof value === 'string' ? pathLine : 'need a string');
  return found.data;
}

function checkSchema(value: unknown): asserts value is Config {
  const found = configShape.safeParse(value);
  if (!found.success) throw configError(found.error.issues[0] as z.core.$ZodIssue, value);
  const config = found.data;
  if (config.tracker === 'local' && config.landing === 'pr')
    throw new ConfigError(['tracker'], 'the tracker local needs the landing merge');
  if (config.holdLanding && config.landing === 'pr')
    throw new ConfigError(['holdLanding'], 'the landing pr has no hold');
  if (config.landing === 'merge' && config.suite === undefined) throw new ConfigError(['suite'], 'required field');
  if (config.suite !== undefined) {
    const { suite } = config;
    if (config.landing === 'pr') throw new ConfigError(['suite'], 'the landing pr runs no suite');
    if (
      suite.startsWith('/') ||
      /^[A-Za-z]:\//.test(suite) ||
      suite.includes('\\') ||
      suite.split('/').includes('..') ||
      !suite.endsWith('.ts')
    ) {
      throw new ConfigError(['suite'], pathLine);
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

const host = z.enum(hosts);

export function validateHost(value: unknown): Host {
  const found = host.safeParse(value);
  if (!found.success) throw new ConfigError(['host'], 'invalid value');
  return found.data;
}

function freeze(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}

const schemaNumber = z.int().min(1);

function fileSchema(value: unknown, nodes: NodeRecord[]): number {
  if (!isMapping(value)) throw new ConfigError([], 'need an object');
  if (!Object.hasOwn(value, 'schema'))
    throw new ConfigError(['schema'], `required field; add "schema: ${configSchema}" as a root field`);
  const node = nodes.find((each) => !each.key && at(each.path, 'schema'));
  if (typeof value.schema !== 'number' || !/^(?:0|-?[1-9][0-9]*)$/.test(node?.plain ?? ''))
    throw new ConfigError(['schema'], 'need an integer');
  const found = schemaNumber.safeParse(value.schema);
  if (!found.success) throw new ConfigError(['schema'], 'integer is out of range');
  return found.data;
}

export function validateConfig(source: ConfigSource): Config {
  const { value, nodes } = source[sourceData];
  const schema = fileSchema(value, nodes);
  if (schema > configSchema)
    throw Object.assign(new ConfigError(['schema'], `the file has schema ${schema}, a newer one`), { schema });
  try {
    checkFieldMetadata(nodes);
    checkSchema(value);
  } catch (error) {
    if (error instanceof ConfigError && schema !== configSchema) error.schema = schema;
    throw error;
  }
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

export function describeConfigError(error: ConfigError, reader: ConfigReader): string {
  const line = `${error.field}: ${error.message}`;
  if (error.schema === undefined) return line;
  const skew = `the file has schema ${error.schema}, and ${reader.part} reads schema ${configSchema}`;
  return error.schema > configSchema
    ? `schema: ${skew}; ${reader.act}`
    : `${line}; ${skew}; plugins/celetis/docs/configuration.md, "Schema versions", says how to change the file`;
}

export function formatConfigError(checkout: string, error: ConfigError, reader: ConfigReader): string {
  return `celetis: ${checkout}/.celetis.yaml: ${describeConfigError(error, reader)}`;
}
