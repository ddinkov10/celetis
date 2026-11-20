import { parseAllDocuments } from 'yaml';
import { validateAgentOrder } from '../agent/order.ts';
import { HostError } from '../command/errors.ts';
import type { Host } from '../config/core.ts';
import { exits } from '../contract/contract.ts';
import { laneIgnore } from '../state/state.ts';

export type SetupAnswers = { tracker?: 'github'; hosts?: readonly Host[] };
export type SetupEntry =
  | string
  | { path: string[]; item?: string }
  | { start: '<!-- CELETIS:START -->'; end: '<!-- CELETIS:END -->' };
export type WiringRecord = {
  schema: 1;
  answers?: SetupAnswers;
  files: string[];
  entries: Record<string, SetupEntry[]>;
};

type Scope = {
  file?: true;
  lines?: readonly string[];
  marker?: true;
  keys?: readonly (readonly string[])[];
  items?: readonly { path: readonly string[]; values?: readonly string[]; entrypoint?: true }[];
};
const scopes: Record<string, Scope> = {
  '.claude/celetis/wiring.json': { file: true },
  '.codex/rules/celetis.rules': { file: true },
  '.celetis.yaml': { keys: [['landing'], ['suite'], ['host']] },
  '.claude/settings.json': {
    keys: [
      ['extraKnownMarketplaces', 'celetis'],
      ['enabledPlugins', 'superpowers@superpowers-marketplace'],
      ['enabledPlugins', 'celetis@celetis'],
    ],
    items: [
      { path: ['permissions', 'deny'], values: ['Bash(gh pr merge*)', 'PowerShell(gh pr merge*)'] },
      { path: ['permissions', 'allow'], entrypoint: true },
    ],
  },
  '.gitignore': {
    lines: [
      laneIgnore,
      '.claude/settings.local.json',
      'docs/superpowers/',
      '.superpowers/',
      '.celetis/lessons/_pending/',
      'docs/lessons/_pending/',
    ],
  },
  '.gitattributes': { lines: ['.celetis.yaml text eol=lf'] },
  'AGENTS.md': { marker: true },
  'CLAUDE.md': { marker: true, lines: ['@AGENTS.md'] },
  '.claude/CLAUDE.md': { marker: true, lines: ['@../AGENTS.md', '@AGENTS.md'] },
};
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const safe = (value: string) => !value.includes('\\') && !/\p{Cc}/u.test(value);
const keysAre = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
const samePath = (one: readonly string[], two: readonly string[]) =>
  one.length === two.length && one.every((key, i) => key === two[i]);

function entry(value: unknown, scope: Scope): SetupEntry | null {
  if (typeof value === 'string') return safe(value) && scope.lines?.includes(value) ? value : null;
  if (!object(value)) return null;
  if (
    scope.marker &&
    keysAre(value, ['start', 'end']) &&
    value.start === '<!-- CELETIS:START -->' &&
    value.end === '<!-- CELETIS:END -->'
  )
    return { start: value.start, end: value.end };
  if (
    !keysAre(value, ['path', 'item']) ||
    !Array.isArray(value.path) ||
    !value.path.every((key): key is string => typeof key === 'string' && safe(key))
  )
    return null;
  const path = value.path;
  if (!Object.hasOwn(value, 'item')) return scope.keys?.some((keys) => samePath(path, keys)) ? { path } : null;
  const item = value.item;
  if (typeof item !== 'string' || !safe(item)) return null;
  return scope.items?.some(
    (form) =>
      samePath(path, form.path) &&
      (form.values?.includes(item) ||
        (form.entrypoint && /^(Bash|PowerShell)\((\.\/)?(scripts\/celetis|celetis)([ )])/.test(item))),
  )
    ? { path, item }
    : null;
}

export function parseSetupRecord(source: string, path: string): WiringRecord {
  const invalid = (reason: string): never => {
    throw new HostError(`setup: ${path}: ${reason}; fix or remove the setup record first`, exits.usage);
  };
  if (parseAllDocuments(source, { uniqueKeys: true, merge: false }).some((doc) => doc.errors.length))
    invalid('ambiguous JSON; fix duplicate object keys');
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return invalid('need a JSON object');
  }
  if (
    !object(value) ||
    !keysAre(value, ['schema', 'answers', 'files', 'entries']) ||
    value.schema !== 1 ||
    !Array.isArray(value.files) ||
    !object(value.entries)
  )
    return invalid('need schema: 1, files and entries, with optional answers');
  const result: WiringRecord = { schema: 1, files: [], entries: {} };
  if (Object.hasOwn(value, 'answers')) {
    const answers = value.answers;
    if (!object(answers) || !keysAre(answers, ['tracker', 'hosts'])) return invalid('invalid answers');
    result.answers = {};
    if (Object.hasOwn(answers, 'tracker')) {
      if (answers.tracker !== 'github') return invalid('answers.tracker: only GitHub is supported now');
      result.answers.tracker = answers.tracker;
    }
    if (Object.hasOwn(answers, 'hosts')) {
      try {
        result.answers.hosts = validateAgentOrder(answers.hosts);
      } catch (error) {
        return invalid(`answers.hosts: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  for (const file of value.files) {
    if (typeof file !== 'string' || !Object.hasOwn(scopes, file) || !scopes[file]?.file)
      return invalid(`unsupported whole-file claim ${JSON.stringify(file)}`);
    if (result.files.includes(file)) return invalid(`duplicate whole-file claim ${file}`);
    result.files.push(file);
  }
  for (const [destination, items] of Object.entries(value.entries)) {
    const scope = scopes[destination];
    if (!Object.hasOwn(scopes, destination) || !scope) return invalid(`unsupported entry destination ${destination}`);
    if (scope.file || result.files.includes(destination))
      return invalid(`overlapping or unsupported entries for ${destination}`);
    if (!Array.isArray(items)) return invalid(`${destination}: entries must be an array`);
    const seen = new Set<string>();
    const entries: SetupEntry[] = [];
    for (const item of items) {
      const parsed = entry(item, scope);
      if (parsed === null) return invalid(`${destination}: unsupported entry ${JSON.stringify(item)}`);
      const key = JSON.stringify(parsed);
      if (seen.has(key)) return invalid(`${destination}: duplicate or overlapping entry ${key}`);
      seen.add(key);
      entries.push(parsed);
    }
    result.entries[destination] = entries;
  }
  return result;
}
