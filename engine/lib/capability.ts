import type { Host } from './config-core.ts';
import { capPrefix } from './contract.ts';
import { type Level, levels } from './effort.ts';

type Score = { rank: number; effort: number };
export type Runtime = { schema: number; runtime: string; models: { id: string; efforts: string[] }[] };
export class ScoreError extends Error {}

export interface Binding {
  host: 'claude' | 'codex' | 'opencode';
  slots: (string | null)[];
  reviewerRank: number;
  reviewerEffort: number;
  runtime: Runtime | null;
}

export interface Pair {
  rank: number;
  model: string | null;
  effort: Level;
  runtime: string | null;
  reviewer: boolean;
}

export function resolveScore(digits: readonly number[], bias: number, attempt: number): Score | null {
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

export function scoreLabel(values: readonly string[], biasText: string): string {
  const sum = values.reduce((sum, value) => sum + Number(value), 0);
  return `${capPrefix} J${values[0]} V${values[1]} B${values[2]} N${values[3]} S${values[4]} X${values[5]} = ${sum}${Number(biasText) === 0 ? '' : ` +b${biasText}`}`;
}

export function bindingMode(host: Host, profile: string | undefined, checkout: string | null): 'main' | 'host' {
  return host === 'codex' && profile === undefined && checkout !== null ? 'main' : 'host';
}

export function resolvePair(
  digits: readonly number[],
  bias: number,
  attempt: number,
  reviewer: boolean,
  binding: Binding,
): Pair | null {
  const score = resolveScore(digits, bias, attempt);
  if (!score) return null;
  const sum = digits.reduce((a, b) => a + b, 0);
  const { host, slots, reviewerRank, reviewerEffort, runtime } = binding;
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
  const effort = levels[applied.effort] as Level;
  const model = slots[slots.length === 1 ? 0 : applied.rank] as string | null;
  if (runtime && !runtime.models.some((item) => item.id === model && item.efforts.includes(effort)))
    throw new ScoreError(
      `effort unavailable in active runtime: ${model}/${effort}; repair --profile or select a runtime that supports this effort`,
    );
  return { rank: applied.rank, model, effort, runtime: runtime?.runtime ?? null, reviewer };
}

export function pairText(pair: Pair): string {
  return `${pair.model ?? 'inherit'}/${pair.effort}`;
}
