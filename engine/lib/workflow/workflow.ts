import type { Gates } from '../config/core.ts';
import { deferredMarker, headings, type Kind, type Label, marker } from '../contract/contract.ts';
import type { AcceptedEpicResult, EpicAcceptance, EpicChild, EpicSubmission, EpicTarget } from '../epic/schemas.ts';
import { type IssueKey, keySource, parseKey } from '../tracker/key.ts';
import { holdApplies, holdOf } from './hold.ts';

export const lanes = {
  feature: { label: 'enhancement', prefix: 'feat', steps: ['specify', 'plan', 'implement'] },
  bug: { label: 'bug', prefix: 'bugfix', steps: ['bug', 'plan', 'implement'] },
  chore: { label: 'chore', prefix: 'chore', steps: ['chore'] },
  hotfix: { label: 'hotfix', prefix: 'hotfix', steps: ['hotfix'] },
} as const;

export type Lane = keyof typeof lanes;
export type LaneStep = (typeof lanes)[Lane]['steps'][number];
export type Step = 'triage' | LaneStep;

const laneNames = Object.keys(lanes) as Lane[];

export type AutoLane = Lane | 'triage';
export const autoLaneNames: readonly AutoLane[] = ['triage', ...laneNames];
const stepsOf = (lane: Lane): readonly LaneStep[] => lanes[lane].steps;

export const laneSteps: readonly LaneStep[] = [...new Set(laneNames.flatMap(stepsOf))];
export const steps: readonly Step[] = ['triage', ...laneSteps];
export type SessionWork = Step | 'assist';
export const sessionWorks: readonly SessionWork[] = [...steps, 'assist'];

const laneStageNames = ['Define', 'Plan', 'Implement'] as const;

export const stages: readonly { name: 'Triage' | (typeof laneStageNames)[number]; steps: readonly Step[] }[] = [
  { name: 'Triage', steps: ['triage'] },
  ...laneStageNames.map((name, position) => ({
    name,
    steps: [...new Set(laneNames.flatMap((lane) => stepsOf(lane).slice(position, position + 1)))],
  })),
];

export type Gate = 'manual' | 'auto';

export const defaultGate: Gate = 'manual';

export function command(step: Step): string {
  return step === 'specify' ? 'feature' : step;
}

export function invocation(step: Step, key: IssueKey): string {
  return `/celetis:${command(step)} #${key}`;
}

export function lands(step: Step): boolean {
  return laneNames.some((lane) => stepsOf(lane).at(-1) === step);
}

export function stageOf(step: Step): number {
  return stages.findIndex((stage) => stage.steps.includes(step));
}

const prefixes = () => laneNames.map((lane) => lanes[lane].prefix).join('|');
const captured = (match: RegExpExecArray | null) => (match ? parseKey(match[1] as string) : null);

export function laneBranch(lane: Lane, key: IssueKey, slug: string): string {
  return `${lanes[lane].prefix}/${key}-${slug}`;
}

export function laneKey(ref: string): IssueKey | null {
  return captured(new RegExp(`^(?:${prefixes()})/(${keySource()})-[a-z0-9][a-z0-9-]*$`).exec(ref));
}

export function branchGlobs(key: IssueKey): string[] {
  return laneNames.map((lane) => `${lanes[lane].prefix}/${key}-*`);
}

export function branchPattern(key: IssueKey): RegExp {
  return new RegExp(`^(${prefixes()})/${RegExp.escape(key)}-`);
}

export function folderPrefix(key: IssueKey): string {
  return `${key}-`;
}

export function folderKey(name: string): IssueKey | null {
  return captured(new RegExp(`^(${keySource()})-`).exec(name));
}

export function prototypeGlob(key: IssueKey): string {
  return `prototype/${key}-*`;
}

export function holdsKey(ref: string, key: IssueKey): boolean {
  return ref.includes(`/${key}-`);
}

export function holdsAnyKey(ref: string): boolean {
  return [...ref.matchAll(new RegExp(`/(${keySource()})-`, 'g'))].some((match) => parseKey(match[1] as string));
}

export function tabLabel(key: IssueKey, word: string): string {
  return `#${key} ${word}`;
}

export function labelOf(label: string): { key: IssueKey; word: string } | null {
  const match = new RegExp(`^#(${keySource()})(?: ([a-z]+))?`).exec(label);
  const key = captured(match);
  return key === null ? null : { key, word: match?.[2] ?? '' };
}

export function keyedSubject(subject: string, key: IssueKey): string {
  return `${subject} (#${key})`;
}

export function subjectKey(subject: string): IssueKey | null {
  return captured(new RegExp(`^[a-z]+(?:\\([^()\\r\\n]+\\))?!?: [^ ].* \\(#(${keySource()})\\)$`).exec(subject));
}

export function closesLine(key: IssueKey): string {
  return `Closes #${key}`;
}

export function closedKeys(body: string): IssueKey[] {
  return [...body.matchAll(new RegExp(`\\bCloses\\s+#(${keySource()})\\b`, 'gi'))].flatMap((match) => {
    const key = parseKey(match[1] as string);
    return key === null ? [] : [key];
  });
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

export type Entry = Readonly<
  | { kind: 'comment'; id: string; at: string; body: string; own: boolean }
  | { kind: 'label'; change: 'added' | 'removed'; name: string; at: string }
>;

export type IssueData = Readonly<{
  state: 'open' | 'closed';
  labels: readonly string[];
  body: string | null;
  history: readonly Entry[];
}>;

export type EpicDeclaration =
  | Readonly<{ kind: 'valid'; acceptance: EpicAcceptance; definitionHash: string }>
  | Readonly<{ kind: 'unresolved'; reason: string }>;

export type EpicReview = Readonly<{ session: string; at: string }>;

type EpicEvidence = Readonly<{
  repository: string;
  parent: IssueKey;
  definitionHash: string;
  children: readonly EpicChild[];
  review: EpicReview;
}>;

export type AcceptedEpic = EpicEvidence &
  (
    | Readonly<{ mode: 'independent'; targets: readonly []; results: readonly [] }>
    | Readonly<{ mode: 'combined'; targets: readonly EpicTarget[]; results: readonly AcceptedEpicResult[] }>
  );

export type EpicSnapshot = Readonly<{
  repository: string;
  parent: IssueKey;
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
  comment: string;
  kind: Kind | 'unmarked';
  missing: 'evidence' | 'report' | 'removal';
}>;

export type Facts = Readonly<{ plan: string | null; build: Build; open: readonly HumanStep[]; refusal: boolean }>;

const kinds: readonly Kind[] = ['general', 'during-the-build'];

export function headed(history: readonly Entry[], ...prefixes: string[]) {
  return history.flatMap((entry, position) =>
    entry.kind === 'comment' && prefixes.some((prefix) => entry.body.startsWith(prefix))
      ? [{ ...entry, position }]
      : [],
  );
}

export function removedAfter(history: readonly Entry[], name: Label, at: number): boolean {
  return history.some(
    (entry, position) => position > at && entry.kind === 'label' && entry.change === 'removed' && entry.name === name,
  );
}

export function isDeferral(body: string): boolean {
  const [heading, second] = body.split(/\r?\n/);
  return heading === headings.stopped && second === deferredMarker;
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
  const refusal =
    headed(history, '## ')
      .filter(({ body }) => !isDeferral(body))
      .at(-1)
      ?.body.startsWith(headings.landingRefused) ?? false;
  return { plan: plan?.id ?? null, build, open, refusal };
}

export function decideEpicCompletion({ snapshot, submission }: EpicCompletionInput): EpicCompletionDecision {
  const { data, declaration, children } = snapshot;
  const refuse = (reason: string): EpicCompletionDecision => ({ kind: 'refused', reason });
  if (data.state === 'closed') return { kind: 'closed' };
  if (!data.labels.includes('epic')) return refuse('parent is not an epic');
  if (children.length === 0) return refuse('epic has no children');
  if (children.some((child) => child.state !== 'closed')) return refuse('epic has open children');
  if (['deferred', 'needs-info', 'ready-for-human'].some((label) => data.labels.includes(label)))
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

export function gateOf(gates: Gates | undefined, run: Pick<Run, 'lane' | 'step'>): Gate {
  if (run.lane === null || run.step === 'triage') return gates?.triage ?? defaultGate;
  const value = gates?.[run.lane];
  if (typeof value === 'string') return value;
  const mapping: Readonly<Partial<Record<Step, Gate>>> | undefined = value;
  return mapping?.[run.step] ?? defaultGate;
}

export function autoTakes(list: readonly AutoLane[] | undefined, run: Run): boolean {
  return list === undefined || list.includes(run.lane ?? 'triage');
}

export type Stop = Readonly<
  | {
      kind: 'stop';
      reason: 'wontfix' | 'finished' | 'deferred' | 'needs-info' | 'epic' | 'land-by-hand' | 'held' | 'released';
    }
  | { kind: 'stop'; reason: 'ready-for-human'; variant: 'landing-refused' | 'your-step' }
  | { kind: 'stop'; reason: 'human-step'; variant: HumanStep['missing'] }
  | { kind: 'stop'; reason: 'several-lanes'; labels: readonly string[] }
>;

export type Decision = Run | Stop;

export function decide(issue: IssueData): Decision {
  const labeled = (name: Label) => issue.labels.includes(name);
  const stop = (reason: 'wontfix' | 'finished' | 'deferred' | 'needs-info' | 'epic' | 'held' | 'released'): Stop => ({
    kind: 'stop',
    reason,
  });
  const run = (step: Step, lane: Lane | null, state: RunState): Run => ({ kind: 'run', step, lane, state });
  const found = laneOf(issue.labels);
  const { build, open, refusal } = factsOf(issue, found.kind === 'lane' ? found.lane : null);

  if (issue.state === 'closed') return stop(labeled('wontfix') ? 'wontfix' : 'finished');
  if (labeled('deferred')) return stop('deferred');
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
  if (build === 'built' && holdApplies(issue, lane, false)) {
    const { latest } = holdOf(issue);
    if (latest?.kind === 'held' || latest?.kind === 'released') return stop(latest.kind);
  }
  const handed = headed(issue.history, headings.landingRefused, headings.beforeLanding).at(-1);
  if (lane === 'hotfix' && handed && removedAfter(issue.history, 'ready-for-human', handed.position))
    return { kind: 'stop', reason: 'land-by-hand' };
  if (lane === 'chore') return run('chore', lane, 'chore');
  if (lane === 'hotfix') return run('hotfix', lane, 'hotfix');
  if (build === 'none') return run('plan', lane, 'defined');
  return run('implement', lane, build);
}

export function landable(decision: Decision): boolean {
  if (decision.kind === 'stop') return decision.reason === 'land-by-hand' || decision.reason === 'released';
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

const handsOn: Partial<Record<LaneStep, LaneStep>> = { bug: 'plan' };

export function skipped(from: Step, to: Step, lane: Lane | null): readonly Step[] {
  if (lane === null || to === 'triage') return [];
  const order = stepsOf(lane);
  const own = order.find((step) => step === from);
  return order.slice(own === undefined ? 0 : order.indexOf(handsOn[own] ?? own) + 1, order.indexOf(to));
}
