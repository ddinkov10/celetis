import { constants } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { type Config, type Host, modelSlots, reviewerShape } from '../config/core.ts';
import { hostAdapter } from '../host/hosts.ts';
import { levels, models } from '../workflow/effort.ts';
import { type Binding, printable, type Runtime, runtimeAllowlist, ScoreError } from './capability.ts';

const profileRecord = z.looseObject({
  schema: z.literal(1),
  runtime: printable,
  slots: modelSlots,
  reviewer: z.looseObject(reviewerShape),
});
type Profile = z.output<typeof profileRecord>;

async function readable(file: string): Promise<boolean> {
  try {
    if (!file || !(await stat(file)).isFile()) return false;
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
async function jsonFile(file: string, name: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new ScoreError(`invalid ${name}: need one JSON object`);
  }
}
function runtimeValue(value: unknown): Runtime {
  if (!runtimeAllowlist.safeParse(value).success)
    throw new ScoreError('invalid runtime allowlist: schema 1 needs unique model IDs and supported efforts');
  return value as Runtime;
}
function profileValue(value: unknown): Profile {
  const found = profileRecord.safeParse(value);
  if (found.success) return found.data;
  if (found.error.issues.some((issue) => issue.path[0] !== 'reviewer'))
    throw new ScoreError('invalid Codex profile: schema 1 needs runtime and four ordered model slots');
  throw new ScoreError(
    'invalid Codex profile: reviewer needs rank 0-3 and effort low, medium, high or xhigh (max is reserved for sum 12)',
  );
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
  input: { profile?: string; runtimeFile: string },
  checkout: string | null,
  config: Config | null,
): Promise<Binding> {
  if (host === 'codex') {
    await hostAdapter(host).checkHome();
    const selected = await binding(input.profile, input.runtimeFile, checkout, config);
    return {
      host,
      slots: selected?.profile.slots ?? [null],
      reviewerRank: selected?.profile.reviewer.rank ?? 1,
      reviewerEffort: selected ? levels.indexOf(selected.profile.reviewer.effort) : 1,
      runtime: selected?.runtime ?? null,
    };
  }
  return { host, slots: [...models], reviewerRank: 1, reviewerEffort: 1, runtime: null };
}
