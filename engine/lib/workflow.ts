export const labels = [
  'needs-triage',
  'bug',
  'enhancement',
  'hotfix',
  'chore',
  'epic',
  'needs-info',
  'ready-for-agent',
  'ready-for-human',
  'wontfix',
] as const;

export type Label = (typeof labels)[number];

export const lanes = {
  feature: { label: 'enhancement', prefix: 'feat', steps: ['triage', 'specify', 'plan', 'implement'] },
  bug: { label: 'bug', prefix: 'fix', steps: ['triage', 'bug', 'plan', 'implement'] },
  chore: { label: 'chore', prefix: 'chore', steps: ['triage', 'chore'] },
  hotfix: { label: 'hotfix', prefix: 'hotfix', steps: ['triage', 'hotfix'] },
} as const;

export type Lane = keyof typeof lanes;
export type Step = (typeof lanes)[Lane]['steps'][number];

const laneNames = Object.keys(lanes) as Lane[];
const stepsOf = (lane: Lane): readonly Step[] => lanes[lane].steps;

export const steps: readonly Step[] = [...new Set(laneNames.flatMap(stepsOf))];

const stageNames = ['Triage', 'Define', 'Plan', 'Implement'] as const;

export const stages: readonly { name: (typeof stageNames)[number]; steps: readonly Step[] }[] = stageNames.map(
  (name, position) => ({
    name,
    steps: [...new Set(laneNames.flatMap((lane) => stepsOf(lane).slice(position, position + 1)))],
  }),
);

export const defaultGate = 'me';

export function command(step: Step): string {
  return step === 'specify' ? 'feature' : step;
}

export function invocation(step: Step, n: number): string {
  return `/celetis:${command(step)} #${n}`;
}

export function lands(step: Step): boolean {
  return laneNames.some((lane) => stepsOf(lane).at(-1) === step);
}

export function stageOf(step: Step): number {
  return stepsOf(laneNames.find((lane) => stepsOf(lane).includes(step)) as Lane).indexOf(step);
}

export function branchGlobs(n: string): string[] {
  return laneNames.map((lane) => `${lanes[lane].prefix}/${n}-*`);
}

export function branchPattern(n: string): RegExp {
  return new RegExp(`^(${laneNames.map((lane) => lanes[lane].prefix).join('|')})/${n}-`);
}

export type LaneOf =
  | { kind: 'lane'; lane: Lane }
  | { kind: 'epic' }
  | { kind: 'none' }
  | { kind: 'several'; labels: readonly string[] };

export function laneOf(names: readonly string[]): LaneOf {
  if (names.includes('epic')) return { kind: 'epic' };
  const found = names.filter((name) => laneNames.some((lane) => lanes[lane].label === name));
  if (found.length === 0) return { kind: 'none' };
  if (found.length > 1) return { kind: 'several', labels: found };
  return { kind: 'lane', lane: laneNames.find((lane) => lanes[lane].label === found[0]) as Lane };
}

export type IssueData = Readonly<{
  state: 'open' | 'closed';
  labels: readonly string[];
  body: string | null;
  comments: number | readonly string[];
}>;

export type RunState =
  | 'unrouted'
  | 'unspecified'
  | 'undiagnosed'
  | 'chore'
  | 'hotfix'
  | 'defined'
  | 'planned'
  | 'built';

export type Run = Readonly<{ kind: 'run'; step: Step; lane: Lane | null; state: RunState }>;

export type Stop = Readonly<
  | { kind: 'stop'; reason: 'wontfix' | 'finished' | 'needs-info' | 'epic' }
  | { kind: 'stop'; reason: 'ready-for-human'; variant: 'landing-refused' | 'your-step' }
  | { kind: 'stop'; reason: 'several-lanes'; labels: readonly string[] }
>;

export type Decision = Run | Stop;

export function decide(issue: IssueData): Decision {
  const labeled = (name: Label) => issue.labels.includes(name);
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  const commented = (prefix: string) => comments.some((body) => body.startsWith(prefix));
  const stop = (reason: 'wontfix' | 'finished' | 'needs-info' | 'epic'): Stop => ({ kind: 'stop', reason });
  const run = (step: Step, lane: Lane | null, state: RunState): Run => ({ kind: 'run', step, lane, state });

  if (issue.state === 'closed') return stop(labeled('wontfix') ? 'wontfix' : 'finished');
  if (labeled('needs-info')) return stop('needs-info');
  if (labeled('ready-for-human')) {
    const heading = comments.filter((body) => body.startsWith('## ')).at(-1) ?? '';
    return {
      kind: 'stop',
      reason: 'ready-for-human',
      variant: heading.startsWith('## Landing refused') ? 'landing-refused' : 'your-step',
    };
  }
  const found = laneOf(issue.labels);
  if (found.kind === 'epic') return stop('epic');
  if (found.kind === 'several') return { kind: 'stop', reason: 'several-lanes', labels: found.labels };
  if (found.kind === 'none') return run('triage', null, 'unrouted');
  const { lane } = found;
  if (lane === 'feature' && !(issue.body ?? '').startsWith('Spec:')) return run('specify', lane, 'unspecified');
  if (lane === 'bug' && !commented('## Root cause')) return run('bug', lane, 'undiagnosed');
  if (lane === 'chore') return run('chore', lane, 'chore');
  if (lane === 'hotfix') return run('hotfix', lane, 'hotfix');
  if (!commented('## Plan')) return run('plan', lane, 'defined');
  return run('implement', lane, labeled('ready-for-agent') ? 'planned' : 'built');
}

export function sameResult(a: Decision, b: Decision): boolean {
  if (a.kind === 'run') return b.kind === 'run' && a.step === b.step;
  if (b.kind === 'run' || a.reason !== b.reason) return false;
  const [x, y] = [a, b] as const;
  return (
    ('variant' in x ? x.variant : null) === ('variant' in y ? y.variant : null) &&
    ('labels' in x ? x.labels : []).join('\n') === ('labels' in y ? y.labels : []).join('\n')
  );
}

export function skipped(from: Step, to: Step, lane: Lane | null): readonly Step[] {
  if (lane === null) return [];
  const order = stepsOf(lane);
  return order.slice(order.includes(from) ? order.indexOf(from) + 1 : 1, order.indexOf(to));
}
