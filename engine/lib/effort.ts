import { type Decision, type IssueData, lanes, type Step, steps } from './workflow.ts';

export const levels = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Level = (typeof levels)[number];

export type ReviewerLevel = Exclude<Level, 'max'>;
export const reviewerLevels: readonly ReviewerLevel[] = levels.filter(
  (level): level is ReviewerLevel => level !== 'max',
);

export function isLevel(value: unknown): value is Level {
  return levels.some((level) => level === value);
}

export type Decided = Exclude<Step, 'triage'>;
export const decidable: readonly Decided[] = steps.filter((step): step is Decided => step !== 'triage');
export const defaultLevel: Level = 'high';

export type Effort = Readonly<
  { level: Level; source: 'decided'; by: Step; reason: string } | { level: Level; source: 'default' }
>;

export function effortMarker(step: Decided, level: Level): string {
  return `Effort: ${step} ${level}`;
}

export function effortOf(data: IssueData, decision: Decision): Effort | null {
  if (decision.kind === 'stop') return null;
  const { step, lane } = decision;
  const order: readonly Step[] = lane === null ? [] : lanes[lane].steps;
  const by = order[order.indexOf(step) - 1];
  const fallback: Effort = { level: defaultLevel, source: 'default' };
  if (step === 'triage' || by === undefined) return fallback;
  for (const entry of data.history.toReversed()) {
    if (entry.kind !== 'comment') continue;
    const first = entry.body.split(/\r?\n/, 1)[0] ?? '';
    const level = levels.find((each) => first === effortMarker(step, each));
    if (level) return { level, source: 'decided', by, reason: entry.body.slice(first.length).trim() };
  }
  return fallback;
}

export function clampEffort(chosen: Level, supported: readonly string[]): Level | null {
  const known = levels.filter((level) => supported.includes(level));
  return known.findLast((level) => levels.indexOf(level) <= levels.indexOf(chosen)) ?? known[0] ?? null;
}
