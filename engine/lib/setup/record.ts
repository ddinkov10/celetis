import { isDeepStrictEqual } from 'node:util';
import { parseAllDocuments } from 'yaml';
import { z } from 'zod';
import { validateAgentOrder } from '../agent/order.ts';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { releaseParts } from '../release/release.ts';
import { laneIgnore } from '../state/state.ts';

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
  '.celetis.yaml': { keys: [['schema'], ['tracker'], ['landing'], ['suite'], ['host']] },
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
const shape = 'need schema: 1, files and entries, with optional answers';
const safe = (value: string) => !value.includes('\\') && !/\p{Cc}/u.test(value);

const lineForm = z.string();
const markerForm = z.strictObject({
  start: z.literal('<!-- CELETIS:START -->'),
  end: z.literal('<!-- CELETIS:END -->'),
});
const pathForm = z.strictObject({ path: z.array(z.string()), item: z.string().optional() });
export type SetupEntry = z.output<typeof lineForm | typeof markerForm | typeof pathForm>;

function formsOf(scope: Scope): z.ZodType<SetupEntry>[] {
  const forms: z.ZodType<SetupEntry>[] = [];
  const { lines, keys, items } = scope;
  if (lines) forms.push(lineForm.refine((line) => safe(line) && lines.includes(line)));
  if (scope.marker) forms.push(markerForm);
  forms.push(
    pathForm.refine(({ path, item }) =>
      item === undefined
        ? !!keys?.some((allowed) => isDeepStrictEqual(path, allowed))
        : safe(item) &&
          !!items?.some(
            (form) =>
              isDeepStrictEqual(path, form.path) &&
              (form.values?.includes(item) ||
                (form.entrypoint && /^(Bash|PowerShell)\((\.\/)?(scripts\/celetis|celetis)([ )])/.test(item))),
          ),
    ),
  );
  return forms;
}

const noRepeat =
  <T>(describe: (item: T, key: string) => string) =>
  (items: T[], ctx: z.core.$RefinementCtx<T[]>) => {
    const seen = new Set<string>();
    for (const item of items) {
      const key = JSON.stringify(item);
      if (seen.has(key)) return void ctx.addIssue({ code: 'custom', message: describe(item, key) });
      seen.add(key);
    }
  };

const wholeFiles = Object.keys(scopes).filter((destination) => scopes[destination]?.file);
const fileClaim = z.custom<string>((value) => typeof value === 'string' && wholeFiles.includes(value));
const entriesOf = z.strictObject(
  Object.fromEntries(
    Object.entries(scopes).map(([destination, scope]) => [
      destination,
      (scope.file
        ? z.never()
        : z
            .array(z.union(formsOf(scope)))
            .superRefine(noRepeat((_, key) => `${destination}: duplicate or overlapping entry ${key}`))
      ).optional(),
    ]),
  ),
) as z.ZodType<Record<string, SetupEntry[]>>;
const hostOrder = z.unknown().transform((value, ctx) => {
  try {
    return validateAgentOrder(value);
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: `answers.hosts: ${error instanceof Error ? error.message : String(error)}`,
    });
    return z.NEVER;
  }
});
const answers = z.strictObject({ tracker: z.enum(['github', 'local']).optional(), hosts: hostOrder.optional() });
const release = z.custom<string>(
  (value) =>
    typeof value === 'string' && !!(releaseParts(`v${value}`) || /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value)),
);

export const wiringRecord = z.strictObject({
  schema: z.literal(1),
  files: z.array(fileClaim).superRefine(noRepeat((file) => `duplicate whole-file claim ${file}`)),
  entries: entriesOf,
  answers: answers.optional(),
  release: release.optional(),
});
export type WiringRecord = z.output<typeof wiringRecord>;

const at = (value: unknown, path: readonly PropertyKey[]) =>
  path.reduce<unknown>((node, key) => (node as Record<PropertyKey, unknown>)[key], value);

function reasonOf(issue: z.core.$ZodIssue, value: unknown): string {
  const [section, name, index] = issue.path;
  if (section === 'answers') {
    if (name === 'tracker') return 'answers.tracker: need github or local';
    return name === 'hosts' ? issue.message : 'invalid answers';
  }
  if (section === 'release') return 'release: need a version X.Y.Z or a full revision';
  if (section === 'files') {
    if (name !== undefined) return `unsupported whole-file claim ${JSON.stringify(at(value, ['files', name]))}`;
    return issue.code === 'custom' ? issue.message : shape;
  }
  if (section === 'entries') {
    if (name === undefined)
      return issue.code === 'unrecognized_keys' ? `unsupported entry destination ${issue.keys[0]}` : shape;
    if (index !== undefined)
      return `${String(name)}: unsupported entry ${JSON.stringify(at(value, ['entries', name, index]))}`;
    if (issue.code === 'custom') return issue.message;
    return scopes[String(name)]?.file
      ? `overlapping or unsupported entries for ${String(name)}`
      : `${String(name)}: entries must be an array`;
  }
  return shape;
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
  const found = wiringRecord.safeParse(value);
  if (!found.success) return invalid(found.error.issues[0] ? reasonOf(found.error.issues[0], value) : shape);
  const order = Object.keys((value as { entries: object }).entries);
  const entries = Object.entries(found.data.entries).sort(([one], [two]) => order.indexOf(one) - order.indexOf(two));
  return { ...found.data, entries: Object.fromEntries(entries) };
}
