import { resolve } from 'node:path';
import {
  bindingMode,
  type Pair,
  pairText,
  resolvePair,
  resolveScore,
  ScoreError,
  scoreLabel,
} from './lib/capability.ts';
import { readBinding } from './lib/capability-binding.ts';
import { type ExitCode, exits, updateHint, usage } from './lib/contract.ts';
import { levels } from './lib/effort.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder } from './lib/events.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';

const flagLines = [
  '--bias N                 effort bias (CAP_EFFORT_BIAS; default 0)',
  '--attempt N              gate-fail attempt (default 1; 4 or later stops)',
  '--agent claude|codex      explicit agent (CELETIS_AGENT > local order; no checkout: claude)',
  '--json                   portable score plus the applied dispatch pair',
  "--reviewer               apply the selected host's reviewer minimum",
  '--profile FILE           Codex profile (CAP_MODEL_PROFILE > main config profile > parent model)',
  '--runtime-models FILE    active dispatch allowlist for a Codex profile (CAP_RUNTIME_MODELS)',
  'See docs/capability.md of the plugin celetis for profile and result schemas.',
];

export async function main(argv: string[]): Promise<ExitCode> {
  const cwd = process.cwd();
  let checkout: string | null = null;
  try {
    const input = commandInput(argv);
    argv = input.args;
    if (!argv.length)
      throw new ScoreError(
        'need six digits J V B N S X; see references/procedures/capability-score.md of the plugin celetis',
      );
    let biasText: string | undefined;
    let attemptText = '1';
    let agent = input.explicit;
    let profile: string | undefined;
    let runtimeFile: string | undefined;
    let json = false;
    let reviewer = false;
    const values: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i] as string;
      if (arg === '-h' || arg === '--help') {
        console.log(usage('capscore', ...flagLines));
        return exits.done;
      }
      if (arg === '--json') {
        json = true;
        continue;
      }
      if (arg === '--reviewer') {
        reviewer = true;
        continue;
      }
      if (['--bias', '--attempt', '--agent', '--profile', '--runtime-models'].includes(arg)) {
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
        else runtimeFile = value;
      } else if (arg.startsWith('-')) throw new ScoreError(`unknown flag: ${arg}`);
      else values.push(arg);
    }
    profile ??= process.env.CAP_MODEL_PROFILE;
    runtimeFile ??= process.env.CAP_RUNTIME_MODELS || '';
    if (profile) profile = resolve(cwd, profile);
    if (runtimeFile) runtimeFile = resolve(cwd, runtimeFile);
    const environment = process.env.CELETIS_AGENT;
    if (biasText === undefined) {
      biasText = process.env.CAP_EFFORT_BIAS || '0';
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
    const label = scoreLabel(values, biasText);
    const score = resolveScore(digits, bias, attempt);
    let host: string | null = null;
    let dispatch: Pair | null = null;
    let line = `${label} → STOP (attempt ${attemptText}: escalate to user with failure trail)`;
    if (score) {
      const identity = await locateCheckouts(cwd);
      checkout = identity.main;
      const operation = await createOperation(identity, { explicit: agent, environment }, (selected) =>
        bindingMode(selected, profile, checkout),
      );
      const binding = await readBinding(operation.host, { profile, runtimeFile }, checkout, operation.mainConfig);
      host = binding.host;
      dispatch = resolvePair(digits, bias, attempt, reviewer, binding) as Pair;
      line = `${label} → ${pairText(dispatch)}${attempt > 1 ? ` [attempt ${attemptText}]` : ''}`;
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
          effort: score ? levels[score.effort] : null,
          dispatch,
          line,
        }),
      );
    else console.log(line);
    return exits.done;
  } catch (error) {
    if (error instanceof ScoreError) {
      console.error(`capscore: ${error.message}\n${updateHint}`);
      return exits.usage;
    }
    if (error instanceof HostError) {
      if (error.message) console.error(error.message);
      return error.code;
    }
    throw error;
  }
}

if (import.meta.main) {
  installRecorder('capscore');
  process.exitCode = await main(process.argv.slice(2));
}
