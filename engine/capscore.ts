import { constants } from 'node:fs';
import { access, readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type Config, ConfigError, readConfig } from './lib/config.ts';
import { HostError, mainCheckout, selectHost } from './lib/host.ts';
import { childEnv, run } from './lib/process.ts';

const models = ['haiku', 'sonnet', 'opus', 'fable'];
const efforts = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
type Effort = (typeof efforts)[number];
type Score = { rank: number; effort: number };
type Profile = { schema: number; runtime: string; slots: string[]; reviewer: { rank: number; effort: string } };
type Runtime = { schema: number; runtime: string; models: { id: string; efforts: string[] }[] };
class ScoreError extends Error {}
const usage = `usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> capscore J V B N S X [options]
--bias N                 effort bias (CAP_EFFORT_BIAS; default 2)
--attempt N              gate-fail attempt (default 1; 4 or later stops)
--agent claude|codex      explicit agent (CELETIS_AGENT > project config > claude)
--json                   portable score plus the applied dispatch pair
--reviewer               apply the selected host's reviewer minimum
--profile FILE           Codex profile (CAP_MODEL_PROFILE > main config profile > parent model)
--runtime-models FILE    active dispatch allowlist for a Codex profile (CAP_RUNTIME_MODELS)
--current-model ID       opencode current model (CAP_CURRENT_MODEL)
See docs/capability.md of the plugin celetis for profile and result schemas.`;

function resolveScore(digits: number[], bias: number, attempt: number): Score | null {
  if (attempt >= 4) return null;
  const sum = digits.reduce((a, b) => a + b, 0);
  let rank = sum <= 3 ? 0 : sum <= 6 ? 1 : sum <= 11 ? 2 : 3;
  let effort = sum <= 3 ? 0 : sum <= 6 ? 1 : sum <= 9 ? 2 : sum <= 11 ? 3 : 4;
  if (digits[5] === 2) {
    rank = Math.max(rank, 2);
    effort = Math.max(effort, 2);
  }
  if (digits[1] === 2) effort = Math.max(effort, 2);
  effort += bias;
  if (attempt === 3) {
    rank++;
    effort = Math.max(effort, 2);
  } else if (attempt === 2) effort++;
  rank = Math.min(rank, 3);
  effort = Math.min(effort, 4);
  if (rank === 3 && sum < 12) effort = Math.min(effort, 3);
  return { rank, effort };
}

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
    !['low', 'medium', 'high', 'xhigh'].includes(reviewer.effort)
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
): Promise<{ profile: Profile; runtime: Runtime } | null> {
  let explicit: unknown;
  let config: Config | undefined;
  if (profileFile !== undefined) {
    if (!(await readable(profileFile)))
      throw new ScoreError(
        'Codex needs a readable --profile FILE (or CAP_MODEL_PROFILE); configure four ordered slots and a reviewer minimum',
      );
    explicit = await jsonFile(profileFile, 'Codex profile');
  } else {
    if (checkout === null)
      throw new ScoreError('Codex needs a main checkout with .celetis.yaml or an explicit --profile FILE');
    config = readConfig(checkout);
    if (!config.codexProfiles || Object.keys(config.codexProfiles).length === 0) return null;
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

export async function main(argv: string[]): Promise<number> {
  let checkout: string | null = null;
  try {
    if (!argv.length) throw new ScoreError('need six digits J V B N S X; see docs/capability.md of the plugin celetis');
    let biasText: string | undefined;
    let attemptText = '1';
    let agent: string | undefined;
    let profile = process.env.CAP_MODEL_PROFILE;
    let runtimeFile = process.env.CAP_RUNTIME_MODELS || '';
    let current = '';
    let json = false;
    let reviewer = false;
    const values: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i] as string;
      if (arg === '-h' || arg === '--help') {
        console.log(usage);
        return 0;
      }
      if (arg === '--json') {
        json = true;
        continue;
      }
      if (arg === '--reviewer') {
        reviewer = true;
        continue;
      }
      if (['--bias', '--attempt', '--agent', '--profile', '--runtime-models', '--current-model'].includes(arg)) {
        const value = argv[++i];
        if (!value) throw new ScoreError(`${arg} needs a value`);
        if (arg === '--bias') {
          if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
            throw new ScoreError('--bias needs a non-negative integer');
          biasText = value;
        } else if (arg === '--attempt') {
          if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
            throw new ScoreError('--attempt needs a positive integer');
          attemptText = value;
        } else if (arg === '--agent') agent = value;
        else if (arg === '--profile') profile = value;
        else if (arg === '--runtime-models') runtimeFile = value;
        else current = value;
      } else if (arg.startsWith('-')) throw new ScoreError(`unknown flag: ${arg}`);
      else values.push(arg);
    }
    if (biasText === undefined) {
      biasText = process.env.CAP_EFFORT_BIAS || '2';
      if (!/^\d+$/.test(biasText) || !Number.isSafeInteger(Number(biasText)))
        throw new ScoreError('CAP_EFFORT_BIAS must be a non-negative integer');
    }
    const bias = Number(biasText);
    const attempt = Number(attemptText);
    if (attempt < 1) throw new ScoreError('--attempt needs a positive integer');
    if (values.length !== 6) throw new ScoreError(`need exactly six digits J V B N S X, got ${values.length}`);
    for (const value of values)
      if (!/^\d+$/.test(value) || Number(value) > 2) throw new ScoreError(`digit out of range (0-2): ${value}`);
    const digits = values.map(Number);
    const [j, v, b, n, s, x] = digits;
    const sum = digits.reduce((a, b) => a + b, 0);
    const label = `CAP: J${values[0]} V${values[1]} B${values[2]} N${values[3]} S${values[4]} X${values[5]} = ${sum}${bias === 0 ? '' : ` +b${biasText}`}`;
    const score = resolveScore(digits, bias, attempt);
    let host: string | null = null;
    let dispatch: {
      rank: number;
      model: string | null;
      effort: Effort;
      runtime: string | null;
      reviewer: boolean;
    } | null = null;
    let line = `${label} → STOP (attempt ${attemptText}: escalate to user with failure trail)`;
    if (score) {
      checkout = await mainCheckout(process.cwd()).catch(() => null);
      host = selectHost(agent, process.env, checkout);
      let slots: (string | null)[] = models;
      let reviewerRank = 1;
      let reviewerEffort = 1;
      let selected: Awaited<ReturnType<typeof binding>> = null;
      if (host === 'codex') {
        selected = await binding(profile, runtimeFile, checkout);
        slots = selected?.profile.slots ?? [null];
        reviewerRank = selected?.profile.reviewer.rank ?? 1;
        reviewerEffort = selected ? efforts.indexOf(selected.profile.reviewer.effort as Effort) : 1;
      } else if (process.env.OPENCODE === '1') {
        host = 'opencode';
        const model = current || process.env.CAP_CURRENT_MODEL || (await currentModel());
        if (model) slots = [model];
      }
      let applied = score;
      let previousModel: string | null = null;
      let previousEffort = 0;
      for (let retry = host === 'codex' ? 1 : attempt; retry <= attempt; retry++) {
        const portable = resolveScore(digits, bias, retry) as Score;
        applied = { ...portable };
        if (reviewer) {
          applied.rank = Math.max(applied.rank, reviewerRank);
          applied.effort = Math.max(applied.effort, reviewerEffort);
          if (applied.rank === 3 && sum < 12) applied.effort = Math.min(applied.effort, 3);
        }
        const model = slots[slots.length === 1 ? 0 : applied.rank] as string | null;
        if (host === 'codex' && model === previousModel) applied.effort = Math.max(applied.effort, previousEffort);
        previousModel = model;
        previousEffort = applied.effort;
      }
      const effort = efforts[applied.effort] as Effort;
      const model = slots[slots.length === 1 ? 0 : applied.rank] as string | null;
      if (selected && !selected.runtime.models.some((item) => item.id === model && item.efforts.includes(effort)))
        throw new ScoreError(
          `effort unavailable in active runtime: ${model}/${effort}; repair --profile or select a runtime that supports this effort`,
        );
      dispatch = { rank: applied.rank, model, effort, runtime: selected?.runtime.runtime ?? null, reviewer };
      line = `${label} → ${model ?? 'inherit'}/${effort}${attempt > 1 ? ` [attempt ${attemptText}]` : ''}`;
    }
    if (json)
      console.log(
        JSON.stringify({
          schema: 1,
          digits: { J: j, V: v, B: b, N: n, S: s, X: x },
          bias,
          attempt,
          sum,
          status: score ? 'ready' : 'stop',
          host,
          rank: score?.rank ?? null,
          effort: score ? efforts[score.effort] : null,
          dispatch,
          line,
        }),
      );
    else console.log(line);
    return 0;
  } catch (error) {
    if (error instanceof ScoreError) {
      console.error(`capscore: ${error.message}`);
      return 2;
    }
    if (error instanceof ConfigError) {
      console.error(`celetis: ${checkout}/.celetis.yaml: ${error.field}: ${error.message}`);
      return 2;
    }
    if (error instanceof HostError) {
      if (error.message) console.error(error.message);
      return error.code;
    }
    throw error;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
