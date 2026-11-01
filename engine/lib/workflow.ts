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
  built: '## Built',
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

export type EpicScenario = Readonly<{
  name: string;
  criterion: string;
  children: readonly string[];
  setup: string;
  preparation: string;
  target: string;
  expected: string;
  timing: string;
  sourceToFiles: string;
  filesToTarget: string;
  oracle: string;
}>;

export type EpicAcceptance =
  | Readonly<{ mode: 'independent'; rationale: string }>
  | Readonly<{ mode: 'combined'; scenarios: readonly EpicScenario[] }>;

export type EpicDeclaration =
  | Readonly<{ kind: 'valid'; acceptance: EpicAcceptance; definitionHash: string }>
  | Readonly<{ kind: 'unresolved'; reason: string }>;

export type EpicChild = Readonly<{
  url: string;
  id: number;
  number: number;
  state: 'open' | 'closed';
  stateReason: 'completed' | 'not_planned' | 'duplicate' | 'reopened' | null;
  closedAt: string | null;
}>;

export type EpicSource = Readonly<{ checkout: string; commit: string }> &
  (Readonly<{ dirty: false }> | Readonly<{ dirty: true; snapshot: string }>);

export type EpicTarget = Readonly<{
  name: string;
  source: EpicSource;
  runtime: string;
  sourceToFiles: string;
  filesToTarget: string;
}>;

export type AcceptedEpicResult =
  | Readonly<{
      scenario: string;
      result: 'PASS';
      target: string;
      observation: string;
      oracle: string;
      reports: readonly number[];
    }>
  | Readonly<{ scenario: string; result: 'inapplicable'; rationale: string; decision: number }>;

export type EpicResult =
  | AcceptedEpicResult
  | Readonly<{
      scenario: string;
      result: 'FAIL' | 'BLOCKED' | 'unrun' | 'UNVERIFIED';
      reason: string;
      reports: readonly number[];
    }>;

export type EpicReview = Readonly<{ session: string; at: string }>;

type EpicEvidence = Readonly<{
  repository: string;
  parent: number;
  definitionHash: string;
  children: readonly EpicChild[];
  review: EpicReview;
}>;

export type EpicSubmission = EpicEvidence &
  Readonly<{ targets: readonly EpicTarget[]; results: readonly EpicResult[] }>;

export type AcceptedEpic = EpicEvidence &
  (
    | Readonly<{ mode: 'independent'; targets: readonly []; results: readonly [] }>
    | Readonly<{ mode: 'combined'; targets: readonly EpicTarget[]; results: readonly AcceptedEpicResult[] }>
  );

export type EpicSnapshot = Readonly<{
  repository: string;
  parent: number;
  data: IssueData;
  declaration: EpicDeclaration;
  children: readonly EpicChild[];
}>;

export type EpicCompletionInput = Readonly<{ snapshot: EpicSnapshot; submission: EpicSubmission | null }>;

export type EpicCompletionDecision =
  | Readonly<{ kind: 'closed' }>
  | Readonly<{ kind: 'refused'; reason: string }>
  | Readonly<{ kind: 'complete'; mode: EpicAcceptance['mode'] }>;

export type Build = 'none' | 'planned' | 'built';

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
  const built = headed(history, headings.built, headings.beforeLanding).some(({ position }) => position > anchor);
  const build: Build = !plan ? 'none' : built ? 'built' : 'planned';
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

export function decideEpicCompletion({ snapshot, submission }: EpicCompletionInput): EpicCompletionDecision {
  const { data, declaration, children } = snapshot;
  const refuse = (reason: string): EpicCompletionDecision => ({ kind: 'refused', reason });
  if (data.state === 'closed') return { kind: 'closed' };
  if (!data.labels.includes('epic')) return refuse('parent is not an epic');
  if (children.length === 0) return refuse('epic has no children');
  if (children.some((child) => child.state !== 'closed')) return refuse('epic has open children');
  if (data.labels.includes('needs-info') || data.labels.includes('ready-for-human'))
    return refuse('epic has a current hold');
  if (factsOf(data, null).open.length) return refuse('epic has an unresolved human precondition');
  if (declaration.kind === 'unresolved') return refuse(`unresolved epic acceptance: ${declaration.reason}`);
  const { acceptance, definitionHash } = declaration;
  if (acceptance.mode === 'independent') return { kind: 'complete', mode: 'independent' };
  const childUrls = new Set(children.map((child) => child.url));
  for (const scenario of acceptance.scenarios) {
    if (scenario.children.some((url) => !childUrls.has(url)))
      return refuse(`scenario ${scenario.name} references a child outside the current epic`);
  }
  if (!submission) return refuse('combined acceptance requires a current submission');
  if (submission.repository !== snapshot.repository || submission.parent !== snapshot.parent)
    return refuse('submission names a different repository or parent');
  if (submission.definitionHash !== definitionHash) return refuse('submission uses a stale acceptance definition');
  const submittedChildren = new Map(submission.children.map((child) => [child.url, child]));
  if (
    children.length !== submission.children.length ||
    children.some((child) => {
      const submitted = submittedChildren.get(child.url);
      return (
        !submitted ||
        child.id !== submitted.id ||
        child.number !== submitted.number ||
        child.state !== submitted.state ||
        child.stateReason !== submitted.stateReason ||
        child.closedAt !== submitted.closedAt
      );
    })
  )
    return refuse('submission uses a stale child snapshot');
  const names = new Set(acceptance.scenarios.map((scenario) => scenario.name));
  const covered = new Set(submission.results.map((result) => result.scenario));
  if (
    submission.results.length !== names.size ||
    covered.size !== names.size ||
    [...covered].some((name) => !names.has(name))
  )
    return refuse('submission must cover each declared scenario exactly once');
  const targets = new Set(submission.targets.map((target) => target.name));
  const comments = new Set(data.history.flatMap((entry) => (entry.kind === 'comment' ? [entry.id] : [])));
  for (const result of submission.results) {
    if (result.result === 'inapplicable') {
      if (!comments.has(result.decision))
        return refuse(`scenario ${result.scenario} references a missing decision comment`);
    } else if (result.result === 'PASS') {
      if (!targets.has(result.target)) return refuse(`scenario ${result.scenario} references a missing target`);
      if (result.reports.some((id) => !comments.has(id)))
        return refuse(`scenario ${result.scenario} references a missing report comment`);
    } else {
      return refuse(`scenario ${result.scenario} is ${result.result}`);
    }
  }
  return { kind: 'complete', mode: 'combined' };
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

const handsOn: Partial<Record<Step, Step>> = { bug: 'plan' };

export function skipped(from: Step, to: Step, lane: Lane | null): readonly Step[] {
  if (lane === null) return [];
  const order = stepsOf(lane);
  return order.slice(order.includes(from) ? order.indexOf(handsOn[from] ?? from) + 1 : 1, order.indexOf(to));
}
