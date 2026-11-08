import { constants } from 'node:fs';
import { access, readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type Binding, type Runtime, ScoreError } from './capability.ts';
import type { Config, Host } from './config-core.ts';
import { levels, type ReviewerLevel, reviewerLevels } from './effort.ts';
import { codexHome } from './homes.ts';
import { childEnv, run } from './process.ts';

const models = ['haiku', 'sonnet', 'opus', 'fable'];
type Profile = { schema: number; runtime: string; slots: string[]; reviewer: { rank: number; effort: ReviewerLevel } };

async function currentModel(): Promise<string | undefined> {
  if (!Bun.which('sqlite3', { PATH: childEnv().PATH })) return;
  const db = join(
    process.env.OPENCODE_DATA_DIR || join(process.env.HOME ?? '', '.local/share/opencode'),
    'opencode.db',
  );
  if (!(await stat(db).catch(() => null))?.isFile()) return;
  const cwd = (await realpath(process.cwd())).replaceAll("'", "''");
  const prefix =
    "SELECT json_extract(data,'$.providerID') || '/' || json_extract(data,'$.modelID') FROM message WHERE json_extract(data,'$.modelID') IS NOT NULL";
  let result = await run('sqlite3', [
    db,
    `${prefix} AND json_extract(data,'$.path.cwd') = '${cwd}' ORDER BY time_created DESC LIMIT 1;`,
  ]);
  let model = result.stdout.trimEnd();
  if (!model || model === '/') {
    result = await run('sqlite3', [db, `${prefix} ORDER BY time_created DESC LIMIT 1;`]);
    model = result.stdout.trimEnd();
  }
  if (result.code === 0 && model && model !== '/') return model;
}

async function readable(file: string): Promise<boolean> {
  try {
    if (!file || !(await stat(file)).isFile()) return false;
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const text = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
const modelId = (value: unknown): value is string => text(value) && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value);
async function jsonFile(file: string, name: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new ScoreError(`invalid ${name}: need one JSON object`);
  }
}
function runtimeValue(value: unknown): Runtime {
  if (
    !object(value) ||
    value.schema !== 1 ||
    !text(value.runtime) ||
    !Array.isArray(value.models) ||
    value.models.length === 0 ||
    !value.models.every(
      (model) =>
        object(model) &&
        modelId(model.id) &&
        Array.isArray(model.efforts) &&
        model.efforts.length > 0 &&
        model.efforts.every(text) &&
        new Set(model.efforts).size === model.efforts.length,
    ) ||
    new Set(value.models.map((model) => model.id)).size !== value.models.length
  )
    throw new ScoreError('invalid runtime allowlist: schema 1 needs unique model IDs and supported efforts');
  return value as Runtime;
}
function profileValue(value: unknown): Profile {
  if (
    !object(value) ||
    value.schema !== 1 ||
    !text(value.runtime) ||
    !Array.isArray(value.slots) ||
    value.slots.length !== 4 ||
    !value.slots.every(modelId)
  )
    throw new ScoreError('invalid Codex profile: schema 1 needs runtime and four ordered model slots');
  const reviewer = value.reviewer;
  if (
    !object(reviewer) ||
    typeof reviewer.rank !== 'number' ||
    !Number.isInteger(reviewer.rank) ||
    reviewer.rank < 0 ||
    reviewer.rank > 3 ||
    typeof reviewer.effort !== 'string' ||
    !reviewerLevels.some((level) => level === reviewer.effort)
  )
    throw new ScoreError(
      'invalid Codex profile: reviewer needs rank 0-3 and effort low, medium, high or xhigh (max is reserved for sum 12)',
    );
  return value as Profile;
}
async function binding(
  profileFile: string | undefined,
  runtimeFile: string,
  checkout: string | null,
  config: Config | null,
): Promise<{ profile: Profile; runtime: Runtime } | null> {
  let explicit: unknown;
  if (profileFile !== undefined) {
    if (!(await readable(profileFile)))
      throw new ScoreError(
        'Codex needs a readable --profile FILE (or CAP_MODEL_PROFILE); configure four ordered slots and a reviewer minimum',
      );
    explicit = await jsonFile(profileFile, 'Codex profile');
  } else {
    if (checkout === null)
      throw new ScoreError('Codex needs a main checkout with .celetis.yaml or an explicit --profile FILE');
    if (!config?.codexProfiles || Object.keys(config.codexProfiles).length === 0) return null;
  }
  if (!(await readable(runtimeFile)))
    throw new ScoreError(
      'Codex needs a readable --runtime-models FILE (or CAP_RUNTIME_MODELS) from the active dispatch surface',
    );
  try {
    const runtime = runtimeValue(await jsonFile(runtimeFile, 'runtime allowlist'));
    const configured = config?.codexProfiles?.[runtime.runtime];
    if (profileFile === undefined && !configured)
      throw new ScoreError(
        `${checkout}/.celetis.yaml: codexProfiles.${runtime.runtime}: missing profile; configure it or pass --profile`,
      );
    const profile = profileValue(
      profileFile === undefined ? { schema: 1, runtime: runtime.runtime, ...configured } : explicit,
    );
    if (profile.runtime !== runtime.runtime)
      throw new ScoreError('profile runtime does not match the active dispatch runtime');
    for (const id of profile.slots)
      if (!runtime.models.some((model) => model.id === id))
        throw new ScoreError(`profile model unavailable in active runtime: ${id}`);
    const reviewer = profile.slots[profile.reviewer.rank];
    if (!runtime.models.some((model) => model.id === reviewer && model.efforts.includes(profile.reviewer.effort)))
      throw new ScoreError(`reviewer minimum effort unavailable: ${reviewer}/${profile.reviewer.effort}`);
    return { profile, runtime };
  } catch (error) {
    if (!(error instanceof ScoreError)) throw error;
    throw new ScoreError(
      `${error.message}; repair the Codex profile (--profile) and runtime allowlist (--runtime-models) for this dispatch surface`,
    );
  }
}

export async function readBinding(
  host: Host,
  input: { profile?: string; runtimeFile: string; current?: string; opencode: boolean },
  checkout: string | null,
  config: Config | null,
): Promise<Binding> {
  if (host === 'codex') {
    process.env.CODEX_HOME = await codexHome();
    const selected = await binding(input.profile, input.runtimeFile, checkout, config);
    return {
      host,
      slots: selected?.profile.slots ?? [null],
      reviewerRank: selected?.profile.reviewer.rank ?? 1,
      reviewerEffort: selected ? levels.indexOf(selected.profile.reviewer.effort) : 1,
      runtime: selected?.runtime ?? null,
    };
  }
  if (input.opencode) {
    const model = input.current || (await currentModel());
    return { host: 'opencode', slots: model ? [model] : models, reviewerRank: 1, reviewerEffort: 1, runtime: null };
  }
  return { host, slots: models, reviewerRank: 1, reviewerEffort: 1, runtime: null };
}
