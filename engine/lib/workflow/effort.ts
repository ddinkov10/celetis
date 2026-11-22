import { type Decision, type IssueData, type LaneStep, laneSteps, lanes, type Step } from './workflow.ts';

export const levels = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Level = (typeof levels)[number];

export type ReviewerLevel = Exclude<Level, 'max'>;
export const reviewerLevels: readonly ReviewerLevel[] = levels.filter(
  (level): level is ReviewerLevel => level !== 'max',
);

export function isLevel(value: unknown): value is Level {
  return levels.some((level) => level === value);
}

export const models = ['haiku', 'sonnet', 'opus', 'fable'] as const;
export type Model = (typeof models)[number];

export function isModel(value: unknown): value is Model {
  return models.some((model) => model === value);
}

export type Pin = Readonly<{ model?: Model; effort?: Level }>;

export type Decided = LaneStep;
export const decidable: readonly Decided[] = laneSteps;
export const defaultModel: Model = 'opus';
export const defaultLevel: Level = 'medium';

export type Source = 'override' | 'pinned' | 'decided' | 'default';
export type RowSource = Exclude<Source, 'override'>;
export type Override = Readonly<{ model: Model | null; level: Level | null }>;
export const noOverride: Override = { model: null, level: null };

export type EffortDecision = Readonly<{ model: Model; level: Level; by: Step; reason: string }>;
export type StartPair<S extends Source = Source> = Readonly<{
  model: Model;
  level: Level;
  source: Readonly<{ model: S; level: S }>;
  decision: Readonly<{ by: Step; reason: string }> | null;
}>;

export function effortMarker(step: Decided, model: Model, level: Level): string {
  return `Effort: ${step} ${model} ${level}`;
}

export function decisionOf(data: IssueData, decision: Decision): EffortDecision | null {
  if (decision.kind === 'stop') return null;
  const { step, lane } = decision;
  const order: readonly LaneStep[] = lane === null ? [] : lanes[lane].steps;
  const own = order.find((each) => each === step);
  if (own === undefined) return null;
  const by: Step = order[order.indexOf(own) - 1] ?? 'triage';
  for (const entry of data.history.toReversed()) {
    if (entry.kind !== 'comment') continue;
    const first = entry.body.split('\n', 1)[0] ?? '';
    const line = first.trimEnd();
    for (const model of models)
      for (const level of levels)
        if (line === effortMarker(own, model, level))
          return { model, level, by, reason: entry.body.slice(first.length).trim() };
  }
  return null;
}

function strongest<T>(override: T | null, pinned: T | undefined, decided: T | undefined, fallback: T): [T, Source] {
  if (override !== null) return [override, 'override'];
  if (pinned !== undefined) return [pinned, 'pinned'];
  if (decided !== undefined) return [decided, 'decided'];
  return [fallback, 'default'];
}

export function startPair(decided: EffortDecision | null, pin: Pin | undefined): StartPair<RowSource>;
export function startPair(decided: EffortDecision | null, pin: Pin | undefined, override: Override): StartPair;
export function startPair(
  decided: EffortDecision | null,
  pin: Pin | undefined,
  override: Override = noOverride,
): StartPair {
  const [model, modelSource] = strongest(override.model, pin?.model, decided?.model, defaultModel);
  const [level, levelSource] = strongest(override.level, pin?.effort, decided?.level, defaultLevel);
  const used = decided !== null && (modelSource === 'decided' || levelSource === 'decided');
  return {
    model,
    level,
    source: { model: modelSource, level: levelSource },
    decision: used ? { by: decided.by, reason: decided.reason } : null,
  };
}

export function clampEffort(chosen: Level, supported: readonly string[]): Level | null {
  const known = levels.filter((level) => supported.includes(level));
  return known.findLast((level) => levels.indexOf(level) <= levels.indexOf(chosen)) ?? known[0] ?? null;
}
