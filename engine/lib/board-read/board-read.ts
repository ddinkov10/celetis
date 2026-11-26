import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { z } from 'zod';
import { effectiveOrder, readAgentOrder } from '../agent/order.ts';
import { activeBlock, readUsage, selectAgent } from '../agent/usage.ts';
import { createOperation, locateCheckouts } from '../command/operation.ts';
import type { AgentDecision, AgentOrder, Config, Host, UsageBlock } from '../config/core.ts';
import { type Client, type Connection, chunks, client, connection, drain, graphqlQuery } from '../github/github.ts';
import { trusted } from '../github/tracker.ts';
import { hostAvailability } from '../host/host.ts';
import { capableOrder } from '../host/hosts.ts';
import { hosts } from '../host/names.ts';
import { commonDir } from '../process/git.ts';
import { run } from '../process/process.ts';
import { queueOwner, queueView, readQueue, readQueueView } from '../queue/queue.ts';
import type { QueueRecord, QueueView } from '../queue/types.ts';
import { nextBoard } from '../resolver/resolver.ts';
import { listRecoveries, recoveryOwner } from '../run/quota-recovery.ts';
import { readStepEnd, type StepEndRecord } from '../run/step-end.ts';
import { services } from '../services/services.ts';
import { commit, isCommit } from '../state/fields.ts';
import { laneFolder } from '../state/state.ts';
import type { Exec } from '../terminal/terminal.ts';
import { compareKeys, type IssueKey } from '../tracker/key.ts';
import { levels } from '../workflow/effort.ts';
import { hasPage, visualPage } from '../workflow/visual.ts';
import {
  closedKeys,
  folderPrefix,
  gateOf,
  type Lane,
  lands,
  laneKey,
  lanes,
  stages,
  steps,
  subjectKey,
} from '../workflow/workflow.ts';
import { appendCache, deliveryWindows, readCache } from './trends.ts';
import type { CacheLine, DeliveryWindow, Diff, Document, Flow, History, LandedIssue, QuotaState } from './types.ts';

export { commonDir } from '../process/git.ts';
export { mainNoRun } from '../resolver/resolver.ts';
export { readRefreshHints } from '../tracker/refresh-hints.ts';
export { labelOf, tabLabel } from '../workflow/workflow.ts';
export { appendSample, hourlySeries, pruneTrends, readSamples } from './trends.ts';

export type Reconcile = () => Promise<QueueView>;

// Half of the 60-second read limit of the server, which leaves time for the read-view fallback.
const RECONCILE_MS = 30_000;

const reconciled = (reconcile: Reconcile, signal: AbortSignal) =>
  new Promise<QueueView>((resolve, reject) => {
    signal.throwIfAborted();
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    reconcile().then(resolve, reject);
  });

export async function readBoard(main: string, reconcile: Reconcile, signal: AbortSignal): Promise<Document> {
  return readDocument(main, reconcile, signal);
}

export async function readBoardTargets(
  main: string,
  reconcile: Reconcile,
  numbers: readonly IssueKey[],
  previous: Document,
  signal: AbortSignal,
): Promise<Document> {
  return readDocument(main, reconcile, signal, { numbers, previous });
}

async function readDocument(
  main: string,
  reconcile: Reconcile,
  signal: AbortSignal,
  target?: { numbers: readonly IssueKey[]; previous: Document },
): Promise<Document> {
  const operation = await createOperation(await locateCheckouts(main), {}, 'main');
  const { data, stderr } = await nextBoard(operation, signal, target?.numbers);
  const config = operation.mainConfig as Config;
  const { tracker } = services(config, main, signal);
  if (!data) {
    signal.throwIfAborted();
    throw new Error(stderr.trim() || `cannot read the issues from ${tracker.name}`);
  }
  const common = operation.checkout.common as string;
  const history =
    target && !data.closed
      ? target.previous.history
      : config.tracker === 'local'
        ? await localHistory(main, signal)
        : await readHistory(client(main, signal), common);
  const flow: Flow = {
    lanes: Object.fromEntries(Object.entries(lanes).map(([lane, definition]) => [lane, [...definition.steps]])),
    stages: stages.map((stage) => ({ name: stage.name, steps: [...stage.steps] })),
    gates: {
      triage: { triage: gateOf(operation.mainConfig?.gates, { lane: null, step: 'triage' }) },
      ...Object.fromEntries(
        (Object.keys(lanes) as Lane[]).map((lane) => [
          lane,
          Object.fromEntries(
            lanes[lane].steps.map((step) => [step, gateOf(operation.mainConfig?.gates, { lane, step })]),
          ),
        ]),
      ),
    },
    steps: Object.fromEntries(
      [...steps].sort().map((step) => [
        step,
        {
          agent: operation.mainConfig?.agents?.[step] ?? null,
          ...(lands(step) ? { hint: 'It lands the change when the build is done.' } : {}),
        },
      ]),
    ),
    levels: [...levels],
  };
  const issues = [...data.rows];
  if (target) {
    const selected = new Set(target.numbers);
    issues.push(...target.previous.issues.filter((issue) => !selected.has(issue.number)));
    issues.sort((a, b) => compareKeys(a.number, b.number));
  }
  signal.throwIfAborted();
  const agents = Object.fromEntries(
    hosts.map((agent) => {
      const availability = hostAvailability(agent);
      return [agent, { available: availability.available, cause: availability.available ? null : availability.cause }];
    }),
  ) as Document['agents'];
  const queue = target ? await readQueue(main, common) : null;
  signal.throwIfAborted();
  const view =
    !target || queue?.numbers.some((number) => target.numbers.includes(number))
      ? await reconciled(reconcile, AbortSignal.any([signal, AbortSignal.timeout(RECONCILE_MS)])).catch(() =>
          readQueueView(operation, signal),
        )
      : target.previous.queue;
  signal.throwIfAborted();
  return {
    history,
    tracker: tracker.name,
    grammar: config.tracker,
    agents,
    flow,
    issues,
    queue: view,
  };
}

function malformed(): never {
  throw new Error('malformed GitHub history');
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) malformed();
  return result.data;
}

const identity = z.string().regex(commit);

const date = z
  .string()
  .refine(
    (at) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(at) &&
      Number.isFinite(Date.parse(at)),
  );

const link = z
  .string()
  .refine((href) => !/[\x00-\x20\x7f-\x9f]/.test(href))
  .transform((href) => new URL(href))
  .refine((url) => ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
  .transform((url) => url.href);

const trunkOf = z.object({
  repository: z.object({
    nameWithOwner: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    url: z.unknown().optional(),
    defaultBranchRef: z.object({
      name: z.string().min(1),
      target: z.object({ oid: identity, history: connection }),
    }),
  }),
});

const commitNode = z.object({ oid: identity, url: link, message: z.string(), committedDate: date });

const repoName = z.object({ nameWithOwner: z.string() });

const pullNode = z.object({
  baseRepository: repoName.nullable(),
  headRepository: repoName.nullable(),
  baseRefName: z.string(),
  headRefName: z.string(),
  body: z.string().nullable(),
  mergedAt: date.nullable(),
  mergeCommit: z.object({ oid: identity }).nullable(),
});

const issueNode = z.discriminatedUnion('__typename', [
  z.object({ __typename: z.literal('PullRequest') }),
  z.object({
    __typename: z.literal('Issue'),
    number: z.unknown().optional(),
    title: z.string(),
    url: z.string().refine((href) => link.safeParse(href).success),
    createdAt: z.unknown().optional(),
    authorAssociation: z.unknown().optional(),
  }),
]);

const keyed = z.record(z.string(), z.unknown());

const pullsOf = (after: string) =>
  `associatedPullRequests(first: 100${after}) { pageInfo { hasNextPage endCursor } nodes { number body mergedAt mergeCommit { oid } baseRefName headRefName baseRepository { nameWithOwner } headRepository { nameWithOwner } } }`;

const historyOf = (after: string, since = '') =>
  `history(first: 100${after}${since}) { pageInfo { hasNextPage endCursor } nodes { oid url message committedDate } }`;

type Landing = Readonly<{ n: IssueKey | null; sha: string; commitUrl: string; committedAt: string }>;
type Landed = Readonly<{ title: string; url: string }>;
type Repo = Readonly<{ trunk: string; name: string }>;
type Commit = Readonly<{ sha: string; commitUrl: string; subject: string; committedAt: string }>;
type CommitLine = Extract<CacheLine, { sha: string }>;
type Cache = {
  commits: Map<string, IssueKey | null>;
  issues: Map<IssueKey, string | null>;
  fresh: CacheLine[];
  waiting: Map<IssueKey, CommitLine[]>;
};

const walkDays = 56;

async function loadCache(common: string): Promise<Cache> {
  const cache: Cache = { commits: new Map(), issues: new Map(), fresh: [], waiting: new Map() };
  for (const line of await readCache(common))
    if ('sha' in line) cache.commits.set(line.sha, line.issue);
    else cache.issues.set(line.issue, line.createdAt);
  return cache;
}

async function readTrunk(gh: Pick<Client, 'graphql'>, history: string) {
  const { repository } = parse(
    trunkOf,
    await gh.graphql(
      graphqlQuery(`nameWithOwner url defaultBranchRef { name target { ... on Commit { oid ${history} } } }`),
    ),
  );
  const { name: trunk, target } = repository.defaultBranchRef;
  return {
    trunk,
    name: repository.nameWithOwner,
    repoUrl: repository.url,
    head: target.oid,
    page: target.history,
  };
}

function commits(page: Connection): Commit[] {
  return parse(z.array(commitNode), page.nodes).map((row) => ({
    sha: row.oid,
    commitUrl: row.url,
    subject: row.message.split('\n')[0] as string,
    committedAt: row.committedDate,
  }));
}

async function commitConnection(
  gh: Pick<Client, 'graphql'>,
  fields: string,
  oid: string,
  cursor: string,
  key: 'history' | 'associatedPullRequests',
): Promise<Connection> {
  const data = await gh.graphql(
    graphqlQuery(`object(oid: $oid) { ... on Commit { ${fields} } }`, '$oid: GitObjectID!', '$cursor: String!'),
    { oid, cursor },
  );
  const { repository } = parse(z.object({ repository: z.object({ object: z.object({ [key]: connection }) }) }), data);
  return repository.object[key] as Connection;
}

async function readIssues(
  gh: Pick<Client, 'graphql'>,
  numbers: readonly IssueKey[],
  issues: Map<IssueKey, Landed | null>,
  cache: Cache,
): Promise<void> {
  const data = await gh.graphql(
    graphqlQuery(
      numbers
        .map(
          (n) =>
            `n${n}: issueOrPullRequest(number: ${n}) { __typename ... on Issue { number title url createdAt authorAssociation } }`,
        )
        .join(' '),
    ),
  );
  const repository = parse(z.object({ repository: keyed }), data).repository;
  for (const n of numbers) {
    const issue = parse(issueNode, repository[`n${n}`]);
    if (issue.__typename === 'PullRequest') issues.set(n, null);
    else
      issues.set(
        n,
        typeof issue.number === 'number' && String(issue.number) === n && trusted(issue.authorAssociation)
          ? { title: issue.title, url: issue.url }
          : null,
      );
    if (!cache.issues.has(n)) {
      const createdAt = issues.get(n) && issue.__typename === 'Issue' ? parse(date, issue.createdAt) : null;
      cache.issues.set(n, createdAt);
      cache.fresh.push({ issue: n, createdAt });
    }
  }
}

function association(
  trunk: string,
  name: string,
  sha: string,
  pulls: readonly unknown[],
  subject: string,
): IssueKey | null {
  if (pulls.length === 0) return subjectKey(subject);
  const candidates = new Set<IssueKey>();
  for (const raw of pulls) {
    const pull = parse(pullNode, raw);
    const lane = laneKey(pull.headRefName);
    const closes = closedKeys(pull.body ?? '');
    if (
      pull.mergedAt &&
      pull.mergeCommit?.oid === sha &&
      pull.baseRefName === trunk &&
      pull.baseRepository?.nameWithOwner === name &&
      pull.headRepository?.nameWithOwner === name &&
      lane &&
      closes.length > 0 &&
      closes.every((key) => key === lane)
    )
      candidates.add(lane);
  }
  return candidates.size === 1 ? ([...candidates][0] as IssueKey) : null;
}

async function issuesOf(
  gh: Pick<Client, 'graphql'>,
  repo: Repo,
  commits: readonly { sha: string; subject: string; committedAt: string }[],
  cache: Cache,
  save: () => Promise<void>,
  answer?: (numbers: IssueKey[]) => Promise<void>,
): Promise<(IssueKey | null)[]> {
  const unread = [...new Map(commits.filter(({ sha }) => !cache.commits.has(sha)).map((c) => [c.sha, c])).values()];
  const waiting = new Map<string, IssueKey>();
  // About 300 bytes per alias: 50 keep one `gh` argument far below the Windows limit of 32,767 characters.
  for (const chunk of chunks(unread, 50)) {
    const { repository } = parse(
      z.object({ repository: keyed }),
      await gh.graphql(
        graphqlQuery(
          chunk.map(({ sha }, i) => `c${i}: object(oid: "${sha}") { ... on Commit { ${pullsOf('')} } }`).join(' '),
        ),
      ),
    );
    for (const [i, { sha, subject, committedAt }] of chunk.entries()) {
      const first = parse(z.object({ associatedPullRequests: connection }), repository[`c${i}`]);
      const pulls = await drain(first.associatedPullRequests, (cursor) =>
        commitConnection(gh, pullsOf(', after: $cursor'), sha, cursor, 'associatedPullRequests'),
      );
      const issue = association(repo.trunk, repo.name, sha, pulls, subject);
      const line = { sha, issue, at: committedAt };
      if (pulls.length === 0 && issue !== null && !cache.issues.get(issue)) {
        // GitHub can list no PR for a new merge commit for a short time, so the line waits for an Issue answer.
        cache.waiting.set(issue, [...(cache.waiting.get(issue) ?? []), line]);
        waiting.set(sha, issue);
        continue;
      }
      cache.commits.set(sha, issue);
      cache.fresh.push(line);
    }
    await answer?.([...new Set(chunk.flatMap(({ sha }) => cache.commits.get(sha) ?? waiting.get(sha) ?? []))]);
    await save();
  }
  return commits.map(({ sha }) => cache.commits.get(sha) ?? waiting.get(sha) ?? null);
}

async function answerIssues(
  gh: Pick<Client, 'graphql'>,
  numbers: readonly IssueKey[],
  issues: Map<IssueKey, Landed | null>,
  cache: Cache,
): Promise<void> {
  if (numbers.length === 0) return;
  const known = new Set(numbers.filter((n) => cache.issues.has(n)));
  await readIssues(gh, numbers, issues, cache);
  for (const n of numbers) {
    const lines = cache.waiting.get(n);
    if (!lines) continue;
    cache.waiting.delete(n);
    if (cache.issues.get(n))
      for (const line of lines) {
        cache.commits.set(line.sha, n);
        cache.fresh.push(line);
      }
    else if (!known.has(n)) cache.fresh = cache.fresh.filter((line) => 'sha' in line || line.issue !== n);
  }
}

export async function readHistory(gh: Pick<Client, 'graphql'>, common: string): Promise<History> {
  const { trunk, name, repoUrl, head, page: first } = await readTrunk(gh, historyOf(''));
  const url = `${parse(link, repoUrl).replace(/\/$/, '')}/commits/${encodeURIComponent(trunk)}`;
  const cache = await loadCache(common);
  const entries: LandedIssue[] = [];
  const seen = new Set<IssueKey>();
  const issues = new Map<IssueKey, Landed | null>();
  const save = () => appendCache(common, cache.fresh.splice(0));
  const done = async (): Promise<History> => {
    await save();
    return { trunk, url, head, entries };
  };

  let page = first;
  for (;;) {
    const walked = commits(page);
    const numbers = await issuesOf(gh, { trunk, name }, walked, cache, save);
    const landings: Landing[] = walked.map(({ sha, commitUrl, committedAt }, i) => ({
      n: numbers[i] ?? null,
      sha,
      commitUrl,
      committedAt,
    }));
    for (const [index, { n, sha, commitUrl, committedAt }] of landings.entries()) {
      if (n === null || seen.has(n)) continue;
      if (!issues.has(n)) {
        const unread = landings
          .slice(index)
          .flatMap(({ n }) => (n === null || seen.has(n) || issues.has(n) ? [] : [n]));
        await answerIssues(gh, [...new Set(unread)].slice(0, 20 - entries.length), issues, cache);
      }
      const issue = issues.get(n);
      if (!issue) continue;
      entries.push({ number: n, title: issue.title, url: issue.url, sha, commitUrl, committedAt });
      seen.add(n);
      if (entries.length === 20) return done();
    }
    await save();
    if (page.next === null) return done();
    page = await commitConnection(gh, historyOf(', after: $cursor'), head, page.next, 'history');
  }
}

// The merge landing keeps the main checkout on the trunk, so its branch names the trunk with no network read.
async function localHistory(main: string, signal: AbortSignal): Promise<History> {
  const branch = async (ref: string) => {
    const read = await run('git', ['--no-optional-locks', 'symbolic-ref', '--quiet', '--short', ref], {
      cwd: main,
      signal,
    });
    return read.code === 0 ? read.stdout.trim() : '';
  };
  const trunk =
    (await branch('refs/remotes/origin/HEAD')).replace(/^origin\//, '') || (await branch('HEAD')) || 'trunk';
  return { trunk, url: '', head: '', entries: [] };
}

export async function readDelivery(
  main: string,
  common: string,
  now: number,
  signal: AbortSignal,
): Promise<DeliveryWindow[]> {
  if ((await createOperation(await locateCheckouts(main), {}, 'main')).mainConfig?.tracker === 'local') return [];
  const gh = client(main, signal);
  const from = now - walkDays * 86_400_000;
  const since = `, since: "${new Date(from).toISOString()}"`;
  const { trunk, name, head, page: first } = await readTrunk(gh, historyOf('', since));
  const walked: Commit[] = [];
  let page = first;
  for (;;) {
    walked.push(...commits(page));
    if (page.next === null) break;
    page = await commitConnection(gh, historyOf(', after: $cursor', since), head, page.next, 'history');
  }
  const kept = walked.filter(({ committedAt }) => Date.parse(committedAt) >= from);
  const cache = await loadCache(common);
  const save = () => appendCache(common, cache.fresh.splice(0));
  const answer = (numbers: IssueKey[]) =>
    answerIssues(
      gh,
      numbers.filter((n) => !cache.issues.has(n)),
      new Map(),
      cache,
    );
  const numbers = await issuesOf(gh, { trunk, name }, kept, cache, save, answer);
  const landed = new Map<IssueKey, number>();
  for (const [i, { committedAt }] of kept.entries()) {
    const n = numbers[i];
    if (n != null && !landed.has(n)) landed.set(n, Date.parse(committedAt));
  }
  const unread = [...landed.keys()].filter((n) => !cache.issues.has(n));
  for (const chunk of chunks(unread, 50)) {
    await answer(chunk);
    await save();
  }
  return deliveryWindows(
    [...landed].flatMap(([n, at]) => {
      const createdAt = cache.issues.get(n);
      return createdAt ? [{ at, createdAt: Date.parse(createdAt) }] : [];
    }),
    now,
  );
}

export type AgentState = Readonly<{
  order: AgentOrder;
  usage: Record<Host, UsageBlock | null>;
  next: AgentDecision;
  starts: Readonly<Record<string, AgentDecision>>;
  quota: ReadonlyMap<IssueKey, QuotaState>;
}>;

export async function readAgentState(
  main: string,
  now: number,
  flow: Readonly<Record<string, { agent: Host | null }>>,
): Promise<AgentState> {
  const common = await realpath(await commonDir(main));
  const order = await readAgentOrder(common);
  const records = await readUsage(common);
  const quota = new Map<IssueKey, QuotaState>();
  for (const record of await listRecoveries(main)) {
    if (!(await recoveryOwner(record))) quota.set(record.issue, { kind: 'orphaned' });
    else if (record.state === 'waiting' && record.waitId)
      quota.set(record.issue, {
        kind: 'waiting',
        wait: { number: record.issue, waitId: record.waitId, nextResetAt: record.nextResetAt },
      });
  }
  return {
    order,
    usage: Object.fromEntries(hosts.map((host) => [host, activeBlock(records, host, now)])) as AgentState['usage'],
    next: selectAgent({ kind: 'default' }, order.order, records, now, new Set(), false),
    starts: Object.fromEntries(
      steps.flatMap((step) => {
        const entry = flow[step];
        if (!entry) return [];
        const preferred = entry.agent ?? undefined;
        const capable = capableOrder(effectiveOrder(order.order, preferred), { kind: 'step', step }, preferred);
        return [[step, selectAgent({ kind: 'default' }, capable, records, now, new Set(), false)]];
      }),
    ),
    quota,
  };
}

export async function readQueueState(
  main: string,
  projected: QueueView | null | undefined,
): Promise<{
  record: QueueRecord | null;
  owner: string | null;
  matches: boolean;
  next: QueueView['next'];
  actions: QueueView['actions'];
}> {
  const { common } = await locateCheckouts(main);
  if (common === null) throw new Error('queue: need a Git checkout');
  const record = await readQueue(main, common);
  const owner = await queueOwner(main, record);
  const matches = record?.id === projected?.record?.id && record?.revision === projected?.record?.revision;
  const next = matches ? (projected?.next ?? null) : null;
  return { record, owner, matches, next, actions: queueView(record, owner, next).actions };
}

export async function queueReadView(main: string): Promise<QueueView> {
  return readQueueView(await createOperation(await locateCheckouts(main), {}, 'main'));
}

export async function readStepEnds(
  main: string,
  issues: readonly IssueKey[],
): Promise<ReadonlyMap<IssueKey, StepEndRecord | null>> {
  return new Map(
    await Promise.all([...new Set(issues)].map(async (issue) => [issue, await readStepEnd(main, issue)] as const)),
  );
}

export async function laneOf(main: string, number: IssueKey): Promise<string | null> {
  const dir = laneFolder(main);
  const name = (await readdir(dir).catch(() => [])).find((entry) => entry.startsWith(folderPrefix(number)));
  return name ? join(dir, name) : null;
}

export function isInside(main: string, path: unknown): path is string {
  return typeof path === 'string' && (resolve(path) === main || resolve(path).startsWith(`${laneFolder(main)}${sep}`));
}

const count = (text: string, word: string) => Number(new RegExp(`(\\d+) ${word}`).exec(text)?.[1] ?? 0);

export async function readDiff(main: string, folder: string, exec: Exec): Promise<Diff | null> {
  if (!isInside(main, folder)) throw new Error('board: the folder is outside the repository');
  const { code, stdout } = await exec(
    'git',
    ['--no-optional-locks', '-C', resolve(folder), 'diff', '--shortstat', '--merge-base', 'origin/HEAD'],
    { timeout: 10_000 },
  );
  const files = count(stdout, 'files? changed');
  return code === 0 && files > 0
    ? { files, added: count(stdout, 'insertions?'), removed: count(stdout, 'deletions?') }
    : null;
}

export async function hasVisualPage(main: string, sha: string): Promise<boolean> {
  return hasPage(main, sha);
}

export async function readVisualPage(main: string, sha: string): Promise<Buffer | null> {
  return isCommit(sha) && (await hasPage(main, sha)) ? readFile(visualPage(main, sha)) : null;
}
