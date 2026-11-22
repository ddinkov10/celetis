import { readFile } from 'node:fs/promises';
import { HostError } from './lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/command/operation.ts';
import type { Config, Host } from './lib/config/core.ts';
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
} from './lib/contract/contract.ts';
import { parseEpicAcceptance, parseEpicSubmission } from './lib/epic/acceptance.ts';
import { completeEpic, readEpic, withEpicLock, writeEpicDefinition } from './lib/epic/epic.ts';
import { hostAdapter } from './lib/host/hosts.ts';
import { lineOf } from './lib/resolver/lines.ts';
import { services } from './lib/services/services.ts';
import { installRecorder, markDefect } from './lib/state/events.ts';
import { parseHandle } from './lib/tracker/key.ts';
import { writeRefreshHint } from './lib/tracker/refresh-hints.ts';
import { type Edit, type Tracker, TrackerError } from './lib/tracker/tracker.ts';
import { decidable, effortMarker, isLevel, isModel } from './lib/workflow/effort.ts';
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
} from './lib/workflow/workflow.ts';

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
type EngineAct = Exclude<
  IssueAct,
  'epic' | 'epic-state' | 'complete-epic' | 'create' | 'comment' | 'view' | 'list' | 'link' | 'sync'
>;
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

const lifecycleActs: Readonly<Record<keyof typeof headings, IssueAct>> = {
  plan: 'plan',
  built: 'built',
  rootCause: 'root-cause',
  beforeLanding: 'before-landing',
  landingRefused: 'landing-refused',
  humanStepsDone: 'assisted',
  stopped: 'stopped',
};
const recorded: readonly (readonly [string, IssueAct])[] = [
  ...Object.entries(lifecycleActs).map(([key, act]) => [headings[key as keyof typeof headings], act] as const),
  ['Effort:', 'effort'],
];
const maxAttachments = 50;

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

async function synced<T>(gh: Tracker, work: () => Promise<T>): Promise<T> {
  let started = false;
  try {
    return await gh.synced('issue', () => {
      started = true;
      return work();
    });
  } catch (error) {
    if (!started && error instanceof HostError) die('prerequisite', error.message);
    throw error;
  }
}

async function readText(file: string): Promise<string> {
  return readFile(file, 'utf8').catch((error: Error) => die('usage', `cannot read ${file}: ${error.message}`));
}

async function enter(explicit: string | undefined) {
  const operation = await createOperation(
    await locateCheckouts(process.cwd()),
    { explicit, environment: process.env.CELETIS_AGENT },
    'main',
  );
  const main = operation.checkout.main as string;
  const config = operation.mainConfig as Config;
  await hostAdapter(operation.host).checkHome();
  return { operation, main, config };
}

async function createIssue(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  const [, file = ''] = argv;
  if (argv.length !== 2 || !file) die('usage', usageText('issue'));
  const body = await readText(file);
  const first =
    body
      .replace(/^\uFEFF/, '')
      .replace(/^(?:[ \t]*\r?\n)+/, '')
      .split('\n')[0]
      ?.trimEnd() ?? '';
  const intent = /^# Intent: (.*)$/.exec(first)?.[1]?.trim();
  if (!intent) die('usage', `${file}: the first line must be # Intent: <title>, with a title`);
  const title = `Intent: ${intent}`;
  const { main, config } = await enter(explicit);
  const gh = services(config, main).tracker;
  return synced(gh, async () => {
    const issue = await gh.createIssue({ title, body, labels: ['needs-triage'] }).catch((error: unknown) => {
      const details = [gh.stderr(), error instanceof Error ? error.message : String(error)];
      if (error instanceof TrackerError && error.refused)
        die('blocked', `${gh.name} refused the create; no issue was written`, ...details);
      die(
        'blocked',
        'the create has no readable answer; the issue can exist, so read the open issues before you create it again',
        ...details,
      );
    });
    console.log(issue.url);
    await writeRefreshHint(main, issue.key);
    if (!issue.labels.includes('needs-triage'))
      die(
        'blocked',
        `${issue.url} exists, but ${gh.name} did not set needs-triage; add the label with an account that has push access, and do not create the issue again`,
        gh.stderr(),
      );
    process.stderr.write(gh.stderr());
    return exits.done;
  });
}

async function commentIssue(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  const [number = '', , file = '', ...pairs] = argv;
  const n = parseHandle(number);
  const attachments: string[] = [];
  for (let index = 0; index < pairs.length; index += 2) {
    const value = pairs[index + 1];
    if (pairs[index] !== '--attach' || !value) die('usage', usageText('issue'));
    attachments.push(value);
  }
  if (n === null || !file || attachments.length > maxAttachments) die('usage', usageText('issue'));
  const text = await readText(file);
  if (!text.trim()) die('usage', `${file} is empty; give the text of the comment`);
  const start = text.replace(/^\uFEFF/, '').trimStart();
  const owner = recorded.find(([prefix]) => start.startsWith(prefix));
  if (owner)
    die(
      'usage',
      `${file} starts with ${owner[0]}; write that record with celetis --agent <host> issue <n> ${owner[1]}`,
    );
  const { main, config } = await enter(explicit);
  const gh = services(config, main).tracker;
  return synced(gh, async () => {
    const issue = await gh.issue(n).catch(() => null);
    if (!issue) die('blocked', `cannot read #${n} from ${gh.name}`, gh.stderr());
    if (issue.pull) die('prerequisite', `#${n} is a pull request; comment takes an issue`);
    const url = await gh
      .commentIssue(n, file, attachments)
      .catch((error: unknown) =>
        die(
          'blocked',
          `#${n}: the comment write failed`,
          gh.stderr(),
          error instanceof Error ? error.message : String(error),
        ),
      );
    process.stdout.write(url);
    process.stderr.write(gh.stderr());
    return exits.done;
  });
}

async function syncIssues(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  if (argv.length !== 1) die('usage', usageText('issue'));
  const { main, config } = await enter(explicit);
  const gh = services(config, main).tracker;
  const synced = await gh.sync().catch((error: unknown) => {
    if (error instanceof HostError) die('prerequisite', error.message);
    if (error instanceof TrackerError)
      die('blocked', `the local issues are not in sync with origin: ${error.text}`, gh.stderr());
    throw error;
  });
  if (!synced) die('prerequisite', `the tracker of the project is ${gh.name}; it has no local issues to sync`);
  process.stderr.write(gh.stderr());
  return exits.done;
}

const unreadable = (gh: Tracker, what: string) => () =>
  die('blocked', `cannot read ${what} from ${gh.name}`, gh.stderr());

function listFilter(argv: string[]): { state: 'open' | 'closed'; label?: string } {
  const options = new Map<string, string>();
  for (let index = 1; index < argv.length; index += 2) {
    const [name = '', value] = argv.slice(index, index + 2);
    if (!['--state', '--label'].includes(name) || value === undefined || options.has(name))
      die('usage', usageText('issue'));
    options.set(name, value);
  }
  const state = options.get('--state') ?? 'open';
  const label = options.get('--label');
  // A comma makes the REST filter match several labels.
  if (
    (state !== 'open' && state !== 'closed') ||
    (label !== undefined && (label === '' || label.startsWith('-') || label.includes(',')))
  )
    die('usage', usageText('issue'));
  return label === undefined ? { state } : { state, label };
}

async function listIssues(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  const { state, label } = listFilter(argv);
  const { main, config } = await enter(explicit);
  const gh = services(config, main).tracker;
  const issues = await gh.issues(state, label).catch(unreadable(gh, `the ${state} issues`));
  const listed = issues
    .filter((issue) => !issue.pull)
    .map(({ key, title, url, labels }) => ({ key, title, url, labels }));
  console.log(JSON.stringify(listed, null, 2));
  process.stderr.write(gh.stderr());
  return exits.done;
}

async function viewIssue(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  const [number = '', , flag, heading = ''] = argv;
  const n = parseHandle(number);
  const latest = argv.length === 4;
  if (n === null || !(argv.length === 2 || (latest && flag === '--latest' && heading.startsWith('## '))))
    die('usage', usageText('issue'));
  const { main, config } = await enter(explicit);
  const gh = services(config, main).tracker;
  const issue = await gh.issue(n).catch(unreadable(gh, `#${n}`));
  if (issue.pull) die('prerequisite', `#${n} is a pull request; view takes an issue`);
  const history = await gh.history(n).catch(unreadable(gh, `#${n}`));
  if (latest) {
    const body = history
      .flatMap((entry) =>
        entry.kind === 'comment' && entry.body.split('\n')[0]?.trimEnd() === heading ? [entry.body] : [],
      )
      .at(-1);
    if (body === undefined) {
      process.stderr.write(gh.stderr());
      throw new HostError(`issue: #${n} has no comment whose first line is ${heading}`, exits.prerequisite);
    }
    process.stdout.write(body);
  } else {
    const children = await gh.children(n).catch(unreadable(gh, `#${n}`));
    const { key, title, url, state, labels, body, parent } = issue;
    console.log(JSON.stringify({ key, title, url, state, labels, body, parent, children, history }, null, 2));
  }
  process.stderr.write(gh.stderr());
  return exits.done;
}

async function linkIssue(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  const [number = '', , handle = ''] = argv;
  const epic = parseHandle(number);
  const child = parseHandle(handle);
  if (epic === null || child === null || argv.length !== 3) die('usage', usageText('issue'));
  if (epic === child) die('prerequisite', `#${epic} cannot be a sub-issue of itself`);
  const { operation, main, config } = await enter(explicit);
  const common = operation.checkout.common ?? die('usage', 'run the command inside a Git checkout');
  await synced(services(config, main).tracker, () =>
    withEpicLock(common, epic, undefined, async (signal) => {
      const gh = services(config, main, signal).tracker;
      const parent = await gh.issue(epic).catch(unreadable(gh, `#${epic}`));
      const sub = await gh.issue(child).catch(unreadable(gh, `#${child}`));
      for (const issue of [parent, sub]) {
        if (issue.pull) die('prerequisite', `#${issue.key} is a pull request; link takes an issue`);
        if (issue.state !== 'open') die('prerequisite', `#${issue.key} is closed; link takes open issues`);
      }
      if (sub.parent === epic) {
        process.stderr.write(gh.stderr());
        return;
      }
      if (sub.parent !== null) die('prerequisite', `#${child} is a sub-issue of #${sub.parent}`);
      await gh.link(epic, child).catch((error: unknown) => {
        const details = [gh.stderr(), error instanceof Error ? error.message : String(error)];
        if (error instanceof TrackerError && error.refused)
          die('blocked', `${gh.name} refused the link; nothing changed`, ...details);
        die(
          'blocked',
          `the link of #${child} to #${epic} has no readable answer; the link can exist, so run issue ${epic} link ${child} again (it writes nothing when the link exists) or read issue ${child} view before another write`,
          ...details,
        );
      });
      process.stderr.write(gh.stderr());
    }),
  );
  return exits.done;
}

async function execute(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  if (argv[0] === 'create') return createIssue(argv, explicit);
  if (argv[0] === 'sync') return syncIssues(argv, explicit);
  if (argv[0] === 'list') return listIssues(argv, explicit);
  if (argv[1] === 'comment') return commentIssue(argv, explicit);
  if (argv[1] === 'view') return viewIssue(argv, explicit);
  if (argv[1] === 'link') return linkIssue(argv, explicit);
  const [number = '', name = '', argument = '', flag] = argv;
  const n = parseHandle(number);
  const known = Object.hasOwn(acts, name) ? (name as EngineAct) : undefined;
  const act = known && acts[known];
  const kind = known && issueActs[known].argument;
  const epic = ['epic', 'epic-state', 'complete-epic'].includes(name);
  const during = name === 'before-landing' && flag === '--during-the-build';
  const step = decidable.find((each) => each === argument);
  const level = argv[4];
  const effort = step && isModel(flag) && isLevel(level) ? effortMarker(step, flag, level) : '';
  const file = kind === 'effort' ? (argv[5] ?? '') : argument;
  if (
    n === null ||
    (epic
      ? name === 'complete-epic'
        ? argv.length < 2 || argv.length > 3
        : argv.length !== (name === 'epic' ? 3 : 2)
      : !act ||
        argv.length !== (kind === 'none' ? 2 : kind === 'effort' ? 6 : during ? 4 : 3) ||
        (kind === 'lane' && !Object.hasOwn(lanes, argument)) ||
        (kind === 'effort' && !effort))
  )
    die('usage', usageText('issue'));
  let text = '';
  if (kind === 'file' || kind === 'effort' || name === 'epic' || (name === 'complete-epic' && argv.length === 3)) {
    text = await readText(file);
    const first = text.trimStart().split(/\r?\n/)[0] ?? '';
    if (!epic && first.startsWith('## ')) die('usage', `${file} starts with a ## line; give the text with no heading`);
    if (name === 'spec' && first.startsWith('Spec:'))
      die('usage', `${file} starts with Spec:; give the spec with no Spec: line`);
    if (name === 'effort' && !text.trim()) die('usage', `${file} is empty; give the reason of the model and the level`);
  }
  const { operation, main, config } = await enter(explicit);
  if (epic) {
    const tracker = services(config, main).tracker;
    const { forms } = tracker;
    let submission: EpicSubmission | undefined;
    if (name === 'complete-epic' && argv.length === 3) {
      try {
        submission = parseEpicSubmission(text, forms);
      } catch (error) {
        die('usage', error instanceof Error ? error.message : String(error));
      }
    }
    if (name === 'epic') {
      const declaration = parseEpicAcceptance(text, forms);
      if (declaration.kind === 'unresolved') die('usage', declaration.reason);
    }
    const common = operation.checkout.common ?? die('usage', 'run the command inside a Git checkout');
    if (name === 'epic-state') {
      const snapshot = await readEpic(config, main, n);
      console.log(JSON.stringify({ ...snapshot, open: factsOf(snapshot.data, null).open }, null, 2));
    } else if (name === 'epic') {
      await synced(tracker, () => writeEpicDefinition(config, main, common, n, text));
    } else {
      await synced(tracker, async () => {
        const result = await completeEpic(config, main, common, n, submission);
        if (result.kind === 'pending') die('prerequisite', `#${n}: ${result.reason}; next: ${result.nextAction}`);
        console.log(
          result.kind === 'closed'
            ? `epic: #${n} is already closed`
            : `epic: #${n} completed; record ${result.completionId}`,
        );
      });
    }
    return exits.done;
  }
  if (!act) die('usage', usageText('issue'));
  const gh = services(config, main).tracker;
  const work = async (): Promise<ExitCode> => {
    const read = await gh.read(n).catch(() => null);
    if (!read) die('blocked', `cannot read #${n} from ${gh.name}`, gh.stderr());
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
      ...(Object.keys(edit).length
        ? [{ send: () => gh.edit(n, edit), flags: [], close: edit.state === 'closed' }]
        : []),
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
  };
  return name === 'state' ? work() : synced(gh, work);
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
