import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { isPluginHost, type PluginHost } from '../host/names.ts';
import { integrityForm } from '../package/registry.ts';
import { releaseParts, releaseSource, releaseVersion } from '../release/release.ts';
import { revision } from '../state/fields.ts';
import { part } from './types.ts';

const text = z.string().refine((value) => !value.includes('\0'));
const sha = z.string().regex(revision);
// The type names only the fields that the engine reads; the parse keeps the other keys.
const kept = <S extends z.ZodRawShape>(shape: S) => z.looseObject(shape) as unknown as z.ZodObject<S>;
const unique = (values: readonly unknown[]) => new Set(values).size === values.length;
const branch = z.strictObject({ kind: z.literal('branch'), name: text });
const ref = z.union([
  branch,
  z.strictObject({ kind: z.literal('release'), name: text.refine((name) => releaseParts(name) !== null) }),
]);

export const engineSource = z.union([
  z.strictObject({ kind: z.literal('git'), source: text, ref: branch, revision: sha }),
  z.strictObject({
    kind: z.literal('package'),
    source: z.literal(releaseSource),
    version: releaseVersion,
    revision: sha,
    integrity: z.string().regex(integrityForm),
  }),
]);

const offered = { root: text, source: text, ref: text, installed: sha, target: sha, to: text, clone: sha.optional() };
export const partEntry = z
  .union([
    kept({ part, skipped: text, clone: sha.optional() }),
    kept({ part, error: text, clone: sha.optional() }),
    kept({ part: z.literal('engine'), ...offered }),
    kept({ part: z.custom<PluginHost>(isPluginHost), home: text, ...offered }),
  ])
  .refine((entry) => entry.clone === undefined || entry.part === 'claude');
export const parts = z
  .array(partEntry)
  .max(3)
  .refine((entries) => unique(entries.map((entry) => entry.part)));

const engineTarget = (entries: z.output<typeof parts>) => {
  const entry = entries.find((each) => each.part === 'engine');
  return entry && 'target' in entry ? entry.target : undefined;
};

export const pluginInspection = kept({
  host: z.custom<PluginHost>(isPluginHost),
  home: text,
  root: text,
  source: text,
  ref: text,
  resolvedRef: text,
  to: text,
  toRef: ref,
  user: kept({ path: text, source: z.looseObject({}) }).nullable(),
  layer: text.nullable(),
  installed: sha,
  target: sha,
  clone: sha.optional(),
  scope: text.optional(),
  registered: z.unknown().optional(),
  siblings: z.array(text),
});
export const pluginUpdate = pluginInspection.refine(
  (plugin) => plugin.layer === null && (plugin.clone === undefined || plugin.host === 'claude'),
);

export const preparedUpdate = kept({
  parts,
  engine: kept({
    installed: kept({ root: text, entry: text, command: text, revision: sha }),
    source: engineSource,
    to: engineSource,
  }),
  plugins: z
    .array(pluginUpdate)
    .max(2)
    .refine((plugins) => unique(plugins.map((plugin) => plugin.host))),
  target: sha,
  request: text.nullable(),
}).refine(
  (offer) =>
    offer.request === null && engineTarget(offer.parts) === offer.target && offer.engine.to.revision === offer.target,
);

const checkShape = z.strictObject({ parts, offer: preparedUpdate.nullable(), error: text.nullable() });
type CheckShape = z.output<typeof checkShape>;
const isCheckShape = (value: unknown): value is CheckShape => checkShape.safeParse(value).success;
// The parse output drops an own __proto__ key of a kept record, so the parts compare as given.
export const updateCheck = z.custom<CheckShape>(
  (value) =>
    isCheckShape(value) &&
    (value.offer === null || (value.error === null && isDeepStrictEqual(value.offer.parts, value.parts))),
);

const components = z.array(part).refine(unique);
export const updateResult = z
  .strictObject({ ok: z.boolean(), target: sha, completed: components, incomplete: components, error: text.nullable() })
  .refine(
    (result) =>
      (!result.ok || (result.error === null && result.incomplete.length === 0)) &&
      !result.completed.some((entry) => result.incomplete.includes(entry)),
  );

export type Part = z.output<typeof partEntry>;
export type PluginUpdate = z.output<typeof pluginUpdate>;
export type PreparedUpdate = z.output<typeof preparedUpdate>;
export type UpdateCheck = z.output<typeof updateCheck>;
export type UpdateResult = z.output<typeof updateResult>;
