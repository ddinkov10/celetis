import { readFile } from 'node:fs/promises';
import type { Host } from './lib/config-core.ts';
import {
  type ExitClass,
  type ExitCode,
  exits,
  headings,
  type IssueAct,
  type IssueStateKey,
  issueActs,
  issueStateKeys,
  type Label,
  marker,
  usageText,
} from './lib/contract.ts';
import { decidable, effortMarker, isLevel } from './lib/effort.ts';
import { completeEpic, readEpic, writeEpicDefinition } from './lib/epic.ts';
import { parseEpicAcceptance, parseEpicSubmission } from './lib/epic-acceptance.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder, markDefect } from './lib/events.ts';
import { isIssueNumber } from './lib/fields.ts';
import { hostAdapter } from './lib/hosts.ts';
import { lineOf } from './lib/lines.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { type Edit, github } from './lib/tracker.ts';
import {
  type Decision,
  decide,
  diagnosed,
  type EpicSubmission,
  factsOf,
  type IssueData,
  type Lane,
  type LaneOf,
  lands,
  laneOf,
  lanes,
  specified,
} from './lib/workflow.ts';

type Context = Readonly<{
  host: Host;
  data: IssueData;
  found: LaneOf;
  decision: Decision;
  argument: string;
  text: string;
  during: boolean;
  effort: string;
}>;
type Writes = Readonly<{ comment?: string; add?: readonly Label[]; remove?: readonly Label[] }> & Edit;
type Write = Readonly<{ send(): Promise<void>; flags: readonly string[]; close?: boolean }>;
type EngineAct = Exclude<IssueAct, 'epic' | 'epic-state' | 'complete-epic'>;
type Act = Readonly<{
  ready(context: Context): boolean;
  writes(context: Context): Writes;
}>;

const open = ({ data }: Context) => data.state === 'open';
const inLane = (context: Context, ...names: Lane[]) =>
  open(context) && context.found.kind === 'lane' && names.includes(context.found.lane);
const landing = ({ decision }: Context) => decision.kind === 'run' && lands(decision.step);
const headed = (heading: string, text: string) => `${heading}\n\n${text}`;

const acts: Readonly<Record<EngineAct, Act>> = {
  route: {
    ready: (context) => open(context) && context.found.kind !== 'epic',
    writes: ({ argument }) => {
      const label = lanes[argument as Lane].label;
      const others = Object.values(lanes).flatMap((lane) => (lane.label === label ? [] : [lane.label]));
      return { add: [label], remove: [...others, 'needs-triage'] };
    },
  },
  effort: { ready: open, writes: ({ effort, text }) => ({ comment: headed(effort, text.trim()) }) },
  'needs-info': { ready: open, writes: ({ text }) => ({ comment: text, add: ['needs-info'] }) },
  wontfix: {
    ready: open,
    writes: ({ text }) => ({ comment: text, add: ['wontfix'], state: 'closed', state_reason: 'not_planned' }),
  },
  spec: {
    ready: (context) => inLane(context, 'feature'),
    writes: ({ text }) => ({ body: `Spec: ${today()}\n\n${text}` }),
  },
  'root-cause': {
    ready: (context) => inLane(context, 'bug', 'hotfix'),
    writes: ({ text }) => ({ comment: headed(headings.rootCause, text) }),
  },
  plan: {
    ready: (context) =>
      (inLane(context, 'feature') && specified(context.data)) || (inLane(context, 'bug') && diagnosed(context.data)),
    writes: ({ data, text }) => ({
      comment: headed(headings.plan, text),
      ...(data.labels.includes('ready-for-human') ? { remove: ['ready-for-agent'] } : { add: ['ready-for-agent'] }),
    }),
  },
  built: {
    ready: ({ decision }) => decision.kind === 'run' && decision.step === 'implement' && decision.state === 'planned',
    writes: () => ({ comment: headings.built, remove: ['ready-for-agent'] }),
  },
  'before-landing': {
    ready: landing,
    writes: ({ text, during }) => ({
      comment: `${headings.beforeLanding}\n${marker(during ? 'during-the-build' : 'general')}\n\n${text}`,
      add: ['ready-for-human'],
      remove: ['ready-for-agent'],
    }),
  },
  'landing-refused': {
    ready: landing,
    writes: ({ text }) => ({ comment: headed(headings.landingRefused, text) }),
  },
  stopped: {
    ready: open,
    writes: ({ text }) => ({
      comment: headed(headings.stopped, text),
      add: ['ready-for-human'],
      remove: ['ready-for-agent'],
    }),
  },
  'ready-for-human': {
    ready: open,
    writes: () => ({ add: ['ready-for-human'], remove: ['ready-for-agent'] }),
  },
  assisted: {
    ready: ({ data, found }) =>
      data.state === 'open' &&
      (data.labels.includes('needs-info') ||
        data.labels.includes('ready-for-human') ||
        factsOf(data, found.kind === 'lane' ? found.lane : null).open.length > 0),
    writes: ({ host, text }) => ({
      comment: headed(headings.humanStepsDone, `Reported by the assistance agent (\`${host}\`).\n\n${text}`),
      remove: ['needs-info', 'ready-for-human'],
    }),
  },
  state: { ready: () => true, writes: () => ({}) },
};

function die(outcome: ExitClass, message: string, ...details: string[]): never {
  throw new HostError(
    [`issue: ${outcome}: ${message}`, ...details.map((detail) => detail.trimEnd()).filter(Boolean)].join('\n'),
    exits[outcome],
  );
}

function today(): string {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
}

async function execute(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  const [number = '', name = '', argument = '', flag] = argv;
  const n = number.replace(/^#/, '');
  const known = Object.hasOwn(acts, name) ? (name as EngineAct) : undefined;
  const act = known && acts[known];
  const kind = known && issueActs[known].argument;
  const epic = ['epic', 'epic-state', 'complete-epic'].includes(name);
  const during = name === 'before-landing' && flag === '--during-the-build';
  const step = decidable.find((each) => each === argument);
  const effort = step && isLevel(flag) ? effortMarker(step, flag) : '';
  const file = kind === 'effort' ? (argv[4] ?? '') : argument;
  if (
    !isIssueNumber(n) ||
    (epic
      ? name === 'complete-epic'
        ? argv.length < 2 || argv.length > 3
        : argv.length !== (name === 'epic' ? 3 : 2)
      : !act ||
        argv.length !== (kind === 'none' ? 2 : kind === 'effort' ? 5 : during ? 4 : 3) ||
        (kind === 'lane' && !Object.hasOwn(lanes, argument)) ||
        (kind === 'effort' && !effort))
  )
    die('usage', usageText('issue'));
  let text = '';
  if (kind === 'file' || kind === 'effort' || name === 'epic' || (name === 'complete-epic' && argv.length === 3)) {
    text = await readFile(file, 'utf8').catch((error: Error) => die('usage', `cannot read ${file}: ${error.message}`));
    const first = text.trimStart().split(/\r?\n/)[0] ?? '';
    if (!epic && first.startsWith('## ')) die('usage', `${file} starts with a ## line; give the text with no heading`);
    if (name === 'spec' && first.startsWith('Spec:'))
      die('usage', `${file} starts with Spec:; give the spec with no Spec: line`);
    if (name === 'effort' && !text.trim()) die('usage', `${file} is empty; give the reason of the level`);
  }
  let submission: EpicSubmission | undefined;
  if (name === 'complete-epic' && argv.length === 3) {
    try {
      submission = parseEpicSubmission(text);
    } catch (error) {
      die('usage', error instanceof Error ? error.message : String(error));
    }
  }
  if (name === 'epic') {
    const declaration = parseEpicAcceptance(text);
    if (declaration.kind === 'unresolved') die('usage', declaration.reason);
  }
  const operation = await createOperation(
    await locateCheckouts(process.cwd()),
    { explicit, environment: process.env.CELETIS_AGENT },
    'host',
  );
  const main = operation.checkout.main ?? die('usage', 'run the command inside a Git checkout');
  await hostAdapter(operation.host).checkHome();
  if (epic) {
    const common = operation.checkout.common ?? die('usage', 'run the command inside a Git checkout');
    if (name === 'epic-state') {
      const snapshot = await readEpic(main, n);
      console.log(JSON.stringify({ ...snapshot, open: factsOf(snapshot.data, null).open }, null, 2));
    } else if (name === 'epic') {
      await writeEpicDefinition(main, common, n, text);
    } else {
      const result = await completeEpic(main, common, n, submission);
      if (result.kind === 'pending') die('prerequisite', `#${n}: ${result.reason}; next: ${result.nextAction}`);
      console.log(
        result.kind === 'closed'
          ? `epic: #${n} is already closed`
          : `epic: #${n} completed; record ${result.completionId}`,
      );
    }
    return exits.done;
  }
  if (!act) die('usage', usageText('issue'));
  const gh = github(main);
  const read = await gh.read(n).catch(() => null);
  if (!read) die('blocked', `cannot read #${n} from GitHub`, gh.stderr());
  const { data } = read;
  const found = laneOf(data.labels);
  const decision = decide(data);
  if (name === 'state') {
    const facts = factsOf(data, found.kind === 'lane' ? found.lane : null);
    const steps = facts.open.map((step) => `${step.kind} ${step.comment} ${step.missing}`);
    const values: Record<IssueStateKey, readonly string[]> = {
      lane: [found.kind === 'lane' ? found.lane : found.kind],
      line: [lineOf(n, decision)],
      build: [facts.build],
      plan: [String(facts.plan ?? 'none')],
      open: steps.length ? steps : ['none'],
      refusal: [facts.refusal ? 'current' : 'none'],
    };
    console.log(issueStateKeys.flatMap((key) => values[key].map((value) => `${key}: ${value}`)).join('\n'));
    process.stderr.write(gh.stderr());
    return exits.done;
  }
  const context: Context = { host: operation.host, data, found, decision, argument, text, during, effort };
  if (!act.ready(context)) die('prerequisite', `#${n} cannot ${name}: ${lineOf(n, decision)}`);
  const { comment, add = [], remove = [], body, ...close } = act.writes(context);
  const adding = add.filter((label) => !data.labels.includes(label));
  const removing = remove.filter((label) => data.labels.includes(label));
  const edit: Edit = { ...(body === undefined || body === data.body ? {} : { body }), ...close };
  const writes: Write[] = [
    ...(comment === undefined ? [] : [{ send: () => gh.comment(n, comment), flags: [] }]),
    ...(adding.length
      ? [{ send: () => gh.addLabels(n, adding), flags: adding.map((label) => `--add-label ${label}`) }]
      : []),
    ...removing.map((label) => ({ send: () => gh.removeLabel(n, label), flags: [`--remove-label ${label}`] })),
    ...(Object.keys(edit).length ? [{ send: () => gh.edit(n, edit), flags: [], close: edit.state === 'closed' }] : []),
  ];
  let done = 0;
  try {
    for (const write of writes) {
      await write.send();
      done++;
    }
  } catch (error) {
    const details = [gh.stderr(), error instanceof Error ? error.message : String(error)];
    if (done === 0) die('blocked', `#${n}: the write failed; nothing changed`, ...details);
    const left = writes.slice(done);
    const flags = left.flatMap((write) => write.flags);
    const byHand = [
      ...(flags.length ? [`gh issue edit ${n} ${flags.join(' ')}`] : []),
      ...(left.some((write) => write.close) ? [`gh issue close ${n} --reason 'not planned'`] : []),
    ].join(' && ');
    const what =
      comment === undefined
        ? 'the label change failed partway'
        : 'the comment is on the issue, but the label change failed';
    die('blocked', `#${n}: ${what}; complete it by hand: ${byHand}`, ...details);
  }
  process.stderr.write(gh.stderr());
  return exits.done;
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    return await execute(args, explicit);
  } catch (error) {
    markDefect(error);
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('issue');
  process.exitCode = await main(process.argv.slice(2));
}
