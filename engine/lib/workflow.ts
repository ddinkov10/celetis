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

export const headings = {
  plan: '## Plan',
  rootCause: '## Root cause',
  beforeLanding: '## Before landing',
  landingRefused: '## Landing refused',
  humanStepsDone: '## Human steps done',
  stopped: '## Stopped',
} as const;

export type Kind = 'general' | 'during-the-build';

export const marker = (kind: Kind) => `<!-- celetis-before-landing ${kind} -->`;

export type Entry = Readonly<
  | { kind: 'comment'; id: number; at: string; body: string }
  | { kind: 'label'; change: 'added' | 'removed'; name: string; at: string }
>;

export type IssueData = Readonly<{
  state: 'open' | 'closed';
  labels: readonly string[];
  body: string | null;
  history: readonly Entry[];
}>;

export type Build = 'none' | 'planned' | 'built' | 'not-marked' | 'added-again';

export type HumanStep = Readonly<{
  comment: number;
  kind: Kind | 'unmarked';
  missing: 'evidence' | 'report' | 'removal';
}>;

export type Facts = Readonly<{ plan: number | null; build: Build; open: readonly HumanStep[]; refusal: boolean }>;

const kinds: readonly Kind[] = ['general', 'during-the-build'];

function headed(history: readonly Entry[], ...prefixes: string[]) {
  return history.flatMap((entry, position) =>
    entry.kind === 'comment' && prefixes.some((prefix) => entry.body.startsWith(prefix))
      ? [{ ...entry, position }]
      : [],
  );
}

function removedAfter(history: readonly Entry[], name: Label, at: number): boolean {
  return history.some(
    (entry, position) => position > at && entry.kind === 'label' && entry.change === 'removed' && entry.name === name,
  );
}

export function factsOf(issue: IssueData, lane: Lane | null): Facts {
  const { history } = issue;
  const plan = lane === null || stepsOf(lane).includes('plan') ? headed(history, headings.plan).at(-1) : undefined;
  const anchor = plan?.position ?? -1;
  const marked = issue.labels.includes('ready-for-agent');
  const built = removedAfter(history, 'ready-for-agent', anchor);
  const build: Build = !plan ? 'none' : marked ? (built ? 'added-again' : 'planned') : built ? 'built' : 'not-marked';
  const reports = headed(history, headings.humanStepsDone);
  const open = headed(history, headings.beforeLanding)
    .filter(({ position }) => position > anchor)
    .flatMap(({ id, body, position }): HumanStep[] => {
      const kind = kinds.find((each) => body.split(/\r?\n/)[1] === marker(each)) ?? 'unmarked';
      const report = reports.some((done) => done.position > position);
      const removal = removedAfter(history, 'ready-for-human', position);
      if (kind === 'general' ? report || removal : report && removal) return [];
      return [{ comment: id, kind, missing: report ? 'removal' : removal ? 'report' : 'evidence' }];
    });
  const refusal = headed(history, '## ').at(-1)?.body.startsWith(headings.landingRefused) ?? false;
  return { plan: plan?.id ?? null, build, open, refusal };
}

export function specified(issue: IssueData): boolean {
  return (issue.body ?? '').startsWith('Spec:');
}

export function diagnosed(issue: IssueData): boolean {
  return headed(issue.history, headings.rootCause).length > 0;
}

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
  | { kind: 'stop'; reason: 'wontfix' | 'finished' | 'needs-info' | 'epic' | 'land-by-hand' }
  | { kind: 'stop'; reason: 'ready-for-human'; variant: 'landing-refused' | 'your-step' }
  | { kind: 'stop'; reason: 'human-step'; variant: HumanStep['missing'] }
  | { kind: 'stop'; reason: 'plan-order'; variant: 'not-marked' | 'added-again' }
  | { kind: 'stop'; reason: 'several-lanes'; labels: readonly string[] }
>;

export type Decision = Run | Stop;

export function decide(issue: IssueData): Decision {
  const labeled = (name: Label) => issue.labels.includes(name);
  const stop = (reason: 'wontfix' | 'finished' | 'needs-info' | 'epic'): Stop => ({ kind: 'stop', reason });
  const run = (step: Step, lane: Lane | null, state: RunState): Run => ({ kind: 'run', step, lane, state });
  const found = laneOf(issue.labels);
  const { build, open, refusal } = factsOf(issue, found.kind === 'lane' ? found.lane : null);

  if (issue.state === 'closed') return stop(labeled('wontfix') ? 'wontfix' : 'finished');
  if (labeled('needs-info')) return stop('needs-info');
  if (labeled('ready-for-human'))
    return { kind: 'stop', reason: 'ready-for-human', variant: refusal ? 'landing-refused' : 'your-step' };
  if (found.kind === 'epic') return stop('epic');
  if (found.kind === 'several') return { kind: 'stop', reason: 'several-lanes', labels: found.labels };
  if (found.kind === 'none') return run('triage', null, 'unrouted');
  const { lane } = found;
  if (lane === 'feature' && !specified(issue)) return run('specify', lane, 'unspecified');
  if (lane === 'bug' && !diagnosed(issue)) return run('bug', lane, 'undiagnosed');
  const human = open.at(-1);
  if (human) return { kind: 'stop', reason: 'human-step', variant: human.missing };
  const handed = headed(issue.history, headings.landingRefused, headings.beforeLanding).at(-1);
  if (lane === 'hotfix' && handed && removedAfter(issue.history, 'ready-for-human', handed.position))
    return { kind: 'stop', reason: 'land-by-hand' };
  if (lane === 'chore') return run('chore', lane, 'chore');
  if (lane === 'hotfix') return run('hotfix', lane, 'hotfix');
  if (build === 'none') return run('plan', lane, 'defined');
  if (build === 'not-marked' || build === 'added-again') return { kind: 'stop', reason: 'plan-order', variant: build };
  return run('implement', lane, build);
}

export function landable(decision: Decision): boolean {
  if (decision.kind === 'stop') return decision.reason === 'land-by-hand';
  return decision.step === 'implement' ? decision.state === 'built' : ['chore', 'hotfix'].includes(decision.step);
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
