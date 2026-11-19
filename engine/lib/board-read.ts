import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { effectiveOrder, readAgentOrder } from './agent-order.ts';
import { activeBlock, readUsage, selectAgent } from './agent-usage.ts';
import type {
  CacheLine,
  DeliveryWindow,
  Diff,
  Document,
  Flow,
  History,
  LandedIssue,
  QuotaState,
} from './board-read-types.ts';
import type { AgentDecision, AgentOrder, Host, UsageBlock } from './config-core.ts';
import { levels } from './effort.ts';
import { commit, isCommit } from './fields.ts';
import { commonDir } from './git.ts';
import { hostAvailability } from './host.ts';
import { hosts } from './host-names.ts';
import { capableOrder } from './hosts.ts';
import { createOperation, locateCheckouts } from './operation.ts';
import { queueOwner, queueView, readQueue, readQueueView } from './queue.ts';
import type { QueueRecord, QueueView } from './queue-types.ts';
import { listRecoveries, recoveryOwner } from './quota-recovery.ts';
import { nextBoard } from './resolver.ts';
import { laneFolder } from './state.ts';
import { readStepEnd, type StepEndRecord } from './step-end.ts';
import type { Exec } from './terminal.ts';
import { type Connection, chunks, drain, type GitHub, github, graphqlQuery } from './tracker.ts';
import { appendCache, deliveryWindows, readCache } from './trends.ts';
import { hasPage, visualPage } from './visual.ts';
import { defaultGate, lands, lanes, stages, steps } from './workflow.ts';

export { commonDir } from './git.ts';
export { readRefreshHints } from './refresh-hints.ts';
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
  numbers: readonly number[],
  previous: Document,
  signal: AbortSignal,
): Promise<Document> {
  return readDocument(main, reconcile, signal, { numbers, previous });
}

async function readDocument(
  main: string,
  reconcile: Reconcile,
  signal: AbortSignal,
  target?: { numbers: readonly number[]; previous: Document },
): Promise<Document> {
  const operation = await createOperation(await locateCheckouts(main), {}, 'main');
  const { data, stderr } = await nextBoard(operation, signal, target?.numbers);
  if (!data) {
    signal.throwIfAborted();
    throw new Error(stderr.trim() || 'cannot read the issues from GitHub');
  }
  const common = operation.checkout.common as string;
  const history = !target || data.closed ? await readHistory(github(main, signal), common) : target.previous.history;
  const flow: Flow = {
    lanes: Object.fromEntries(Object.entries(lanes).map(([lane, definition]) => [lane, [...definition.steps]])),
    stages: stages.map((stage) => ({ name: stage.name, steps: [...stage.steps] })),
    steps: Object.fromEntries(
      [...steps].sort().map((step) => [
        step,
        {
          gate: operation.mainConfig?.gates?.[step] ?? defaultGate,
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
    issues.sort((a, b) => a.number - b.number);
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
    tracker: 'GitHub',
    agents,
    flow,
    noRun: data.noRun,
    issues,
    queue: view,
  };
}

function malformed(): never {
  throw new Error('malformed GitHub history');
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) malformed();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') malformed();
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) malformed();
  return value;
}

function identity(value: unknown): string {
  const sha = text(value);
  if (!commit.test(sha)) malformed();
  return sha;
}

function date(value: unknown): string {
  const at = text(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(at) ||
    !Number.isFinite(Date.parse(at))
  )
    malformed();
  return at;
}

function link(value: unknown): string {
  const href = text(value);
  if (/[\u0000-\u0020\u007f-\u009f]/.test(href)) malformed();
  const url = new URL(href);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) malformed();
  return url.href;
}

const laneHead = new RegExp(
  `^(?:${Object.values(lanes)
    .map(({ prefix }) => prefix)
    .join('|')})/([1-9][0-9]*)-[a-z0-9][a-z0-9-]*$`,
);

function connection(value: unknown): Connection {
  const { nodes, pageInfo } = record(value);
  const { hasNextPage, endCursor } = record(pageInfo);
  if (typeof hasNextPage !== 'boolean') malformed();
  return { nodes: array(nodes), next: hasNextPage ? text(endCursor) : null };
}

const pullsOf = (after: string) =>
  `associatedPullRequests(first: 100${after}) { pageInfo { hasNextPage endCursor } nodes { number body mergedAt mergeCommit { oid } baseRefName headRefName baseRepository { nameWithOwner } headRepository { nameWithOwner } } }`;

const historyOf = (after: string, since = '') =>
  `history(first: 100${after}${since}) { pageInfo { hasNextPage endCursor } nodes { oid url message committedDate } }`;

type Landing = Readonly<{ n: number | null; sha: string; commitUrl: string; committedAt: string }>;
type Landed = Readonly<{ title: string; url: string }>;
type Repo = Readonly<{ trunk: string; name: string }>;
type Commit = Readonly<{ sha: string; commitUrl: string; subject: string; committedAt: string }>;
type CommitLine = Extract<CacheLine, { sha: string }>;
type Cache = {
  commits: Map<string, number | null>;
  issues: Map<number, string | null>;
  fresh: CacheLine[];
  waiting: Map<number, CommitLine[]>;
};

const walkDays = 56;

async function loadCache(common: string): Promise<Cache> {
  const cache: Cache = { commits: new Map(), issues: new Map(), fresh: [], waiting: new Map() };
  for (const line of await readCache(common))
    if ('sha' in line) cache.commits.set(line.sha, line.issue);
    else cache.issues.set(line.issue, line.createdAt);
  return cache;
}

async function readTrunk(gh: Pick<GitHub, 'graphql'>, history: string) {
  const repo = record(
    (
      await gh.graphql(
        graphqlQuery(`nameWithOwner url defaultBranchRef { name target { ... on Commit { oid ${history} } } }`),
      )
    ).repository,
  );
  const branch = record(repo.defaultBranchRef);
  const trunk = text(branch.name);
  const name = text(repo.nameWithOwner);
  if (!trunk || !/^[^/\s]+\/[^/\s]+$/.test(name)) malformed();
  const target = record(branch.target);
  return { trunk, name, repoUrl: repo.url, head: identity(target.oid), page: connection(target.history) };
}

function commits(page: Connection): Commit[] {
  return page.nodes.map((raw) => {
    const row = record(raw);
    return {
      sha: identity(row.oid),
      commitUrl: link(row.url),
      subject: text(row.message).split('\n')[0] as string,
      committedAt: date(row.committedDate),
    };
  });
}

async function commitObject(
  gh: Pick<GitHub, 'graphql'>,
  fields: string,
  oid: string,
  cursor: string,
): Promise<Record<string, unknown>> {
  const data = await gh.graphql(
    graphqlQuery(`object(oid: $oid) { ... on Commit { ${fields} } }`, '$oid: GitObjectID!', '$cursor: String!'),
    { oid, cursor },
  );
  return record(record(data.repository).object);
}

async function readIssues(
  gh: Pick<GitHub, 'graphql'>,
  numbers: readonly number[],
  issues: Map<number, Landed | null>,
  cache: Cache,
): Promise<void> {
  const data = await gh.graphql(
    graphqlQuery(
      numbers
        .map(
          (n) => `n${n}: issueOrPullRequest(number: ${n}) { __typename ... on Issue { number title url createdAt } }`,
        )
        .join(' '),
    ),
  );
  const repository = record(data.repository);
  for (const n of numbers) {
    const issue = record(repository[`n${n}`]);
    if (issue.__typename === 'PullRequest') issues.set(n, null);
    else if (issue.__typename !== 'Issue') malformed();
    else {
      const title = text(issue.title);
      const href = text(issue.url);
      link(href);
      issues.set(n, issue.number === n ? { title, url: href } : null);
    }
    if (!cache.issues.has(n)) {
      const createdAt = issues.get(n) ? date(issue.createdAt) : null;
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
): number | null {
  if (pulls.length === 0) {
    const direct = /^[a-z]+(?:\([^()\r\n]+\))?!?: [^ ].* \(#([1-9][0-9]*)\)$/.exec(subject);
    return direct ? Number(direct[1]) : null;
  }
  const candidates = new Set<number>();
  for (const raw of pulls) {
    const pull = record(raw);
    const baseRepo = pull.baseRepository === null ? null : text(record(pull.baseRepository).nameWithOwner);
    const headRepo = pull.headRepository === null ? null : text(record(pull.headRepository).nameWithOwner);
    const baseRef = text(pull.baseRefName);
    const headRef = text(pull.headRefName);
    const body = pull.body === null ? '' : text(pull.body);
    const merged = pull.mergedAt === null ? null : date(pull.mergedAt);
    const mergeSha = pull.mergeCommit === null ? null : identity(record(pull.mergeCommit).oid);
    const lane = laneHead.exec(headRef);
    const closes = [...body.matchAll(/\bCloses\s+#([1-9][0-9]*)\b/gi)].map((match) => Number(match[1]));
    if (
      merged &&
      mergeSha === sha &&
      baseRef === trunk &&
      baseRepo === name &&
      headRepo === name &&
      lane &&
      closes.length > 0 &&
      closes.every((number) => number === Number(lane[1]))
    )
      candidates.add(Number(lane[1]));
  }
  return candidates.size === 1 ? ([...candidates][0] as number) : null;
}

async function issuesOf(
  gh: Pick<GitHub, 'graphql'>,
  repo: Repo,
  commits: readonly { sha: string; subject: string; committedAt: string }[],
  cache: Cache,
  save: () => Promise<void>,
  answer?: (numbers: number[]) => Promise<void>,
): Promise<(number | null)[]> {
  const unread = [...new Map(commits.filter(({ sha }) => !cache.commits.has(sha)).map((c) => [c.sha, c])).values()];
  const waiting = new Map<string, number>();
  // About 300 bytes per alias: 50 keep one `gh` argument far below the Windows limit of 32,767 characters.
  for (const chunk of chunks(unread, 50)) {
    const repository = record(
      (
        await gh.graphql(
          graphqlQuery(
            chunk.map(({ sha }, i) => `c${i}: object(oid: "${sha}") { ... on Commit { ${pullsOf('')} } }`).join(' '),
          ),
        )
      ).repository,
    );
    for (const [i, { sha, subject, committedAt }] of chunk.entries()) {
      const pulls = await drain(connection(record(repository[`c${i}`]).associatedPullRequests), async (cursor) =>
        connection((await commitObject(gh, pullsOf(', after: $cursor'), sha, cursor)).associatedPullRequests),
      );
      const n = association(repo.trunk, repo.name, sha, pulls, subject);
      const issue = n !== null && Number.isSafeInteger(n) ? n : null;
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
  gh: Pick<GitHub, 'graphql'>,
  numbers: readonly number[],
  issues: Map<number, Landed | null>,
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

export async function readHistory(gh: Pick<GitHub, 'graphql'>, common: string): Promise<History> {
  const { trunk, name, repoUrl, head, page: first } = await readTrunk(gh, historyOf(''));
  const url = `${link(repoUrl).replace(/\/$/, '')}/commits/${encodeURIComponent(trunk)}`;
  const cache = await loadCache(common);
  const entries: LandedIssue[] = [];
  const seen = new Set<number>();
  const issues = new Map<number, Landed | null>();
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
    page = connection((await commitObject(gh, historyOf(', after: $cursor'), head, page.next)).history);
  }
}

export async function readDelivery(
  main: string,
  common: string,
  now: number,
  signal: AbortSignal,
): Promise<DeliveryWindow[]> {
  const gh = github(main, signal);
  const from = now - walkDays * 86_400_000;
  const since = `, since: "${new Date(from).toISOString()}"`;
  const { trunk, name, head, page: first } = await readTrunk(gh, historyOf('', since));
  const walked: Commit[] = [];
  let page = first;
  for (;;) {
    walked.push(...commits(page));
    if (page.next === null) break;
    page = connection((await commitObject(gh, historyOf(', after: $cursor', since), head, page.next)).history);
  }
  const kept = walked.filter(({ committedAt }) => Date.parse(committedAt) >= from);
  const cache = await loadCache(common);
  const save = () => appendCache(common, cache.fresh.splice(0));
  const answer = (numbers: number[]) =>
    answerIssues(
      gh,
      numbers.filter((n) => !cache.issues.has(n)),
      new Map(),
      cache,
    );
  const numbers = await issuesOf(gh, { trunk, name }, kept, cache, save, answer);
  const landed = new Map<number, number>();
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
  quota: ReadonlyMap<number, QuotaState>;
}>;

export async function readAgentState(
  main: string,
  now: number,
  flow: Readonly<Record<string, { agent: Host | null }>>,
): Promise<AgentState> {
  const common = await realpath(await commonDir(main));
  const order = await readAgentOrder(common);
  const records = await readUsage(common);
  const quota = new Map<number, QuotaState>();
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
  issues: readonly number[],
): Promise<ReadonlyMap<number, StepEndRecord | null>> {
  return new Map(
    await Promise.all([...new Set(issues)].map(async (issue) => [issue, await readStepEnd(main, issue)] as const)),
  );
}

export async function laneOf(main: string, number: number): Promise<string | null> {
  const dir = laneFolder(main);
  const name = (await readdir(dir).catch(() => [])).find((entry) => entry.startsWith(`${number}-`));
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
