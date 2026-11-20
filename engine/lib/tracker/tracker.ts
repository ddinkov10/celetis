import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Label } from '../contract/contract.ts';
import { parseEpicAcceptance, parseEpicChildren, parseEpicRepository } from '../epic/acceptance.ts';
import { run } from '../process/process.ts';
import { isCommit } from '../state/fields.ts';
import type { Entry, EpicSnapshot, IssueData } from '../workflow/workflow.ts';
import { type IssueKey, parseKey } from './key.ts';
import { writeRefreshHint } from './refresh-hints.ts';

export type Issue = Readonly<{
  key: IssueKey;
  title: string;
  url: string;
  apiUrl: string;
  parentUrl: string | null;
  state: 'open' | 'closed';
  labels: readonly string[];
  body: string | null;
  comments: number;
  updatedAt: string;
  closedAt: string | null;
  pull: boolean;
}>;

export type Edit = Readonly<{
  body?: string;
  state?: 'closed';
  state_reason?: 'completed' | 'not_planned';
}>;

export type Ref = Readonly<{ ref: string; sha: string }>;
export type Repository = Readonly<{ fullName: string; defaultBranch: string; url: string }>;
export type Pull = Readonly<{
  number: number;
  url: string;
  head: Ref;
  base: Ref;
  state: 'open' | 'closed';
  mergedAt: string | null;
  draft: boolean;
  requestedReviewers: number;
}>;
export type CheckRun = Readonly<{
  name: string;
  status: string;
  conclusion: string | null;
  app: string | null;
  suite: number | null;
  url: string | null;
}>;
export type CommitStatus = Readonly<{ state: string }>;
export type WorkflowRun = Readonly<{
  id: number;
  suite: number;
  attempt: number;
  status: string | null;
  conclusion: string | null;
  name: string;
  url: string;
}>;
export type Review = Readonly<{ user: string | null; state: string }>;
export type PullDetails = Readonly<{ checks: readonly (CheckRun | CommitStatus)[]; reviews: readonly Review[] }>;
export type Parent = Readonly<{ key: IssueKey; url: string }>;
export type Bucket = 'pass' | 'skipping' | 'fail' | 'cancel' | 'pending';
export type PullFilter = Readonly<{ state: 'open' }> | Readonly<{ head: string; state: 'closed' | 'all' }>;
export type NewPull = Readonly<{ base: string; head: string; title: string; body: string }>;
export type NewLabel = Readonly<{ name: string; description: string; color: string }>;
export type NewIssue = Readonly<{ title: string; body: string; labels: readonly Label[] }>;

export type GitHub = Readonly<{
  api(endpoint: string): Promise<unknown>;
  list(endpoint: string): Promise<unknown[]>;
  graphql(query: string, variables?: Readonly<Record<string, string | number>>): Promise<Record<string, unknown>>;
  timelines(issues: readonly Issue[]): Promise<ReadonlyMap<IssueKey, readonly Entry[]>>;
  pullDetails(pulls: readonly Pull[]): Promise<ReadonlyMap<number, PullDetails>>;
  read(n: IssueKey): Promise<Readonly<{ issue: Issue; data: IssueData }>>;
  epic(n: IssueKey): Promise<EpicSnapshot>;
  issue(n: IssueKey): Promise<Issue>;
  openIssues(): Promise<readonly Issue[]>;
  repository(): Promise<Repository>;
  pulls(filter: PullFilter): Promise<readonly Pull[]>;
  pull(n: number): Promise<Pull>;
  createPull(fields: NewPull): Promise<string>;
  mergePull(n: number, sha: string): Promise<void>;
  checkRuns(sha: string): Promise<readonly CheckRun[]>;
  statuses(sha: string): Promise<readonly CommitStatus[]>;
  workflowRuns(sha: string): Promise<readonly WorkflowRun[]>;
  workflowRun(id: number): Promise<WorkflowRun>;
  rerunFailedJobs(id: number): Promise<void>;
  parent(n: IssueKey): Promise<Parent>;
  labels(): Promise<readonly string[]>;
  createLabel(fields: NewLabel): Promise<void>;
  createIssue(fields: NewIssue): Promise<Issue>;
  comment(n: IssueKey, text: string): Promise<void>;
  commentIssue(n: IssueKey, file: string, attachments: readonly string[]): Promise<string>;
  addLabels(n: IssueKey, names: readonly string[]): Promise<void>;
  removeLabel(n: IssueKey, name: string): Promise<void>;
  edit(n: IssueKey, fields: Edit): Promise<void>;
  stderr(): string;
}>;

export class GitHubError extends Error {
  readonly notFound: boolean;

  constructor(
    readonly endpoint: string,
    readonly text: string,
    readonly stderr: string | null,
    message: string,
  ) {
    super(message);
    this.notFound = stderr !== null && /\bHTTP 404\b/.test(stderr);
  }
}

class Refusal extends Error {}

function malformed(): Error {
  return new Refusal('malformed GitHub data');
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw malformed();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw malformed();
  return value;
}

function integer(value: unknown): number {
  if (!Number.isSafeInteger(value)) throw malformed();
  return value as number;
}

function orNull<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value === null ? null : parse(value);
}

function count(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (!Array.isArray(value)) throw malformed();
  return value.length;
}

function ref(value: unknown): Ref {
  const { ref, sha } = record(value);
  return { ref: text(ref), sha: text(sha) };
}

function parseRepository(raw: unknown): Repository {
  const repository = record(raw);
  const defaultBranch = text(repository.default_branch);
  if (!defaultBranch) throw malformed();
  return { fullName: text(repository.full_name), defaultBranch, url: text(repository.html_url) };
}

function parsePull(raw: unknown): Pull {
  const pull = record(raw);
  const { state, draft } = pull;
  if ((state !== 'open' && state !== 'closed') || (draft !== undefined && typeof draft !== 'boolean'))
    throw malformed();
  return {
    number: integer(pull.number),
    url: text(pull.html_url),
    head: ref(pull.head),
    base: ref(pull.base),
    state,
    mergedAt: orNull(pull.merged_at, text),
    draft: draft ?? false,
    requestedReviewers: count(pull.requested_reviewers) + count(pull.requested_teams),
  };
}

function parseCheckRun(raw: unknown): CheckRun {
  const run = record(raw);
  return {
    name: text(run.name),
    status: text(run.status),
    conclusion: orNull(run.conclusion, text),
    app: orNull(run.app, (app) => text(record(app).slug)),
    suite: orNull(run.check_suite, (suite) => integer(record(suite).id)),
    url: orNull(run.details_url, text),
  };
}

function parseCommitStatus(raw: unknown): CommitStatus {
  return { state: text(record(raw).state) };
}

function parseWorkflowRun(raw: unknown): WorkflowRun {
  const run = record(raw);
  return {
    id: integer(run.id),
    suite: integer(run.check_suite_id),
    attempt: integer(run.run_attempt),
    status: orNull(run.status, text),
    conclusion: orNull(run.conclusion, text),
    name: orNull(run.name, text) || text(run.path),
    url: text(run.html_url),
  };
}

function issueKey(value: unknown): IssueKey | null {
  return Number.isSafeInteger(value) ? parseKey(String(value)) : null;
}

function parseParent(raw: unknown): Parent {
  const parent = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const key = issueKey(parent.number);
  const url = parent.html_url;
  if (key === null) throw new Refusal('the parent response has no valid issue number');
  if (typeof url !== 'string' || !url.endsWith(`/issues/${key}`))
    throw new Refusal('the parent response has no canonical issue URL that matches its number');
  return { key, url };
}

function parseLabelName(raw: unknown): string {
  return text(record(raw).name);
}

function concluded(conclusion: string | null): Bucket {
  switch (conclusion) {
    case 'success':
      return 'pass';
    case 'neutral':
    case 'skipped':
      return 'skipping';
    case 'failure':
    case 'timed_out':
    case 'action_required':
      return 'fail';
    case 'cancelled':
      return 'cancel';
    default:
      return 'pending';
  }
}

export function bucket(check: CheckRun | CommitStatus): Bucket {
  if ('state' in check) {
    if (check.state === 'success') return 'pass';
    return check.state === 'failure' || check.state === 'error' ? 'fail' : 'pending';
  }
  return check.status === 'completed' ? concluded(check.conclusion) : 'pending';
}

export function runBucket(run: WorkflowRun, checkRuns: readonly CheckRun[]): 'fail' | 'cancel' | 'pending' | null {
  if (run.status !== 'completed') return null;
  if (run.conclusion === 'startup_failure') return 'fail';
  if (checkRuns.some((check) => check.suite === run.suite)) return null;
  const value = concluded(run.conclusion);
  return value === 'pass' || value === 'skipping' ? null : value;
}

export async function loggedIn(host: string, cwd: string): Promise<boolean> {
  return (await run('gh', ['auth', 'status', '--hostname', host], { cwd })).code === 0;
}

export function parseIssue(raw: unknown): Issue {
  const issue = record(raw);
  const { state, labels, body, comments, closed_at: closedAt, pull_request: pull } = issue;
  const key = issueKey(issue.number);
  if (
    key === null ||
    (state !== 'open' && state !== 'closed') ||
    !Array.isArray(labels) ||
    typeof comments !== 'number' ||
    (pull !== undefined && pull !== null && typeof pull !== 'object')
  )
    throw malformed();
  const parent = issue.parent_issue_url;
  if (parent !== undefined && parent !== null && typeof parent !== 'string') throw malformed();
  return {
    key,
    title: text(issue.title),
    url: text(issue.html_url),
    apiUrl: text(issue.url),
    parentUrl: parent ?? null,
    state,
    labels: labels.map((label) => text(record(label).name)),
    body: body === null ? null : text(body),
    comments,
    updatedAt: text(issue.updated_at),
    closedAt: closedAt === null ? null : text(closedAt),
    pull: Boolean(pull),
  };
}

export function parentKey({ apiUrl, parentUrl }: Issue): IssueKey | null {
  if (parentUrl === null) return null;
  const prefix = apiUrl.slice(0, apiUrl.lastIndexOf('/') + 1);
  return parentUrl.startsWith(prefix) ? parseKey(parentUrl.slice(prefix.length)) : null;
}

export function parseTimeline(entries: readonly unknown[]): Entry[] {
  return entries.flatMap((raw): Entry[] => {
    const entry = record(raw);
    const event = text(entry.event);
    if (!event || /[\s\0]/.test(event)) throw malformed();
    switch (event) {
      case 'commented':
        if (typeof entry.id !== 'number') throw malformed();
        return [{ kind: 'comment', id: entry.id, at: text(entry.created_at), body: text(entry.body) }];
      case 'labeled':
      case 'unlabeled':
        return [
          {
            kind: 'label',
            change: event === 'labeled' ? 'added' : 'removed',
            name: text(record(entry.label).name),
            at: text(entry.created_at),
          },
        ];
      default:
        return [];
    }
  });
}

export type Connection = Readonly<{ nodes: readonly unknown[]; next: string | null }>;

function connection(raw: unknown): Connection {
  const { nodes, pageInfo } = record(raw);
  const { hasNextPage, endCursor } = record(pageInfo);
  if (!Array.isArray(nodes) || typeof hasNextPage !== 'boolean') throw malformed();
  return { nodes, next: hasNextPage ? text(endCursor) : null };
}

export async function drain(first: Connection, more: (cursor: string) => Promise<Connection>): Promise<unknown[]> {
  const nodes = [...first.nodes];
  let page = first;
  while (page.next !== null) {
    page = await more(page.next);
    nodes.push(...page.nodes);
  }
  return nodes;
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export function graphqlQuery(fields: string, ...variables: string[]): string {
  return `query(${['$owner: String!', '$name: String!', ...variables].join(', ')}) { repository(owner: $owner, name: $name) { ${fields} } }`;
}

const timelineItems = (after: string) =>
  `timelineItems(first: 100${after}, itemTypes: [ISSUE_COMMENT, LABELED_EVENT, UNLABELED_EVENT]) { pageInfo { hasNextPage endCursor } nodes { __typename ... on IssueComment { databaseId createdAt body } ... on LabeledEvent { createdAt label { name } } ... on UnlabeledEvent { createdAt label { name } } } }`;

function timelineEntry(raw: unknown): Entry {
  const node = record(raw);
  switch (node.__typename) {
    case 'IssueComment':
      return { kind: 'comment', id: integer(node.databaseId), at: text(node.createdAt), body: text(node.body) };
    case 'LabeledEvent':
    case 'UnlabeledEvent':
      return {
        kind: 'label',
        change: node.__typename === 'LabeledEvent' ? 'added' : 'removed',
        name: text(record(node.label).name),
        at: text(node.createdAt),
      };
    default:
      throw malformed();
  }
}

const reviewNodes = (after: string) =>
  `reviews(first: 100${after}) { pageInfo { hasNextPage endCursor } nodes { state author { login } } }`;

const checkRunNodes = (after: string) =>
  `checkRuns(first: 50${after}, filterBy: { checkType: LATEST }) { pageInfo { hasNextPage endCursor } nodes { name status conclusion detailsUrl } }`;

const checkSuiteNodes = (after: string) =>
  `checkSuites(first: 50${after}) { pageInfo { hasNextPage endCursor } nodes { id databaseId app { slug } ${checkRunNodes('')} } }`;

function reviewNode(raw: unknown): Review {
  const review = record(raw);
  return { user: orNull(review.author, (author) => text(record(author).login)), state: text(review.state) };
}

const lower = (value: unknown) => text(value).toLowerCase();

const checkRunNode =
  (suite: Record<string, unknown>) =>
  (raw: unknown): CheckRun => {
    const run = record(raw);
    return {
      name: text(run.name),
      status: lower(run.status),
      conclusion: orNull(run.conclusion, lower),
      app: orNull(suite.app, (app) => text(record(app).slug)),
      suite: orNull(suite.databaseId, integer),
      url: orNull(run.detailsUrl, text),
    };
  };

function statusNodes(commit: unknown): CommitStatus[] {
  const { status } = record(commit);
  if (status === null) return [];
  const { contexts } = record(status);
  if (!Array.isArray(contexts)) throw malformed();
  return contexts.map((context) => ({ state: lower(record(context).state) }));
}

const select = (value: unknown, keys: readonly string[]) => keys.reduce((node, key) => record(node)[key], value);

export function issueData(issue: Issue, history: readonly Entry[]): IssueData {
  return { state: issue.state, labels: issue.labels, body: issue.body, history };
}

export function github(cwd: string, signal?: AbortSignal, env?: NodeJS.ProcessEnv): GitHub {
  let stderr = '';

  function parsed<T>(endpoint: string, parse: () => T): T {
    try {
      return parse();
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      throw new GitHubError(endpoint, error.message, null, error.message);
    }
  }

  function json(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      throw malformed();
    }
  }

  async function call(endpoint: string, paginate: boolean): Promise<unknown> {
    signal?.throwIfAborted();
    const result = await run(
      'gh',
      ['api', ...(paginate ? ['--paginate', '--slurp'] : []), `repos/{owner}/{repo}${endpoint ? `/${endpoint}` : ''}`],
      { cwd, signal, env },
    );
    signal?.throwIfAborted();
    stderr += result.stderr;
    if (result.code !== 0)
      throw new GitHubError(
        endpoint,
        `${result.stdout}${result.stderr}`.trimEnd(),
        result.stderr,
        'GitHub read failed',
      );
    return parsed(endpoint, () => json(result.stdout));
  }

  async function get<T>(endpoint: string, parse: (raw: unknown) => T): Promise<T> {
    const raw = await call(endpoint, false);
    return parsed(endpoint, () => parse(raw));
  }

  async function pages(endpoint: string, key?: string): Promise<unknown[]> {
    const raw = await call(endpoint, true);
    return parsed(endpoint, () => {
      if (!Array.isArray(raw)) throw malformed();
      return raw.flatMap((page: unknown): unknown[] => {
        const items = key === undefined ? page : record(page)[key];
        if (!Array.isArray(items)) throw malformed();
        return items;
      });
    });
  }

  async function getAll<T>(endpoint: string, parse: (raw: unknown) => T, key?: string): Promise<T[]> {
    const items = await pages(endpoint, key);
    return parsed(endpoint, () => items.map(parse));
  }

  async function send(
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    options: { fields?: object; silent?: boolean } = {},
  ): Promise<string> {
    signal?.throwIfAborted();
    const folder = options.fields === undefined ? null : await mkdtemp(join(tmpdir(), 'celetis-gh.'));
    try {
      const input = folder === null ? [] : ['--input', join(folder, 'input.json')];
      if (folder !== null) await writeFile(join(folder, 'input.json'), JSON.stringify(options.fields), { mode: 0o600 });
      const result = await run(
        'gh',
        [
          'api',
          '-X',
          method,
          `repos/{owner}/{repo}/${endpoint}`,
          ...(options.silent === false ? [] : ['--silent']),
          ...input,
        ],
        { cwd, signal, env },
      );
      const issue = /^issues\/([1-9][0-9]*)(?:\/|$)/.exec(endpoint);
      const key = issue && parseKey(issue[1] as string);
      if (result.code === 0 && key) await writeRefreshHint(cwd, key);
      signal?.throwIfAborted();
      if (result.code !== 0) {
        const failure = `${result.stdout}${result.stderr}`.trimEnd();
        throw new GitHubError(endpoint, failure, result.stderr, failure);
      }
      stderr += result.stderr;
      return result.stdout;
    } finally {
      if (folder !== null) await rm(folder, { recursive: true, force: true });
    }
  }

  async function graphql(
    query: string,
    variables: Readonly<Record<string, string | number>> = {},
  ): Promise<Record<string, unknown>> {
    signal?.throwIfAborted();
    const result = await run(
      'gh',
      [
        'api',
        'graphql',
        '-F',
        'owner={owner}',
        '-F',
        'name={repo}',
        '-f',
        `query=${query}`,
        ...Object.entries(variables).flatMap(([key, value]) => [
          typeof value === 'number' ? '-F' : '-f',
          `${key}=${value}`,
        ]),
      ],
      { cwd, signal, env },
    );
    signal?.throwIfAborted();
    stderr += result.stderr;
    if (result.code !== 0)
      throw new GitHubError(
        'graphql',
        `${result.stdout}${result.stderr}`.trimEnd(),
        result.stderr,
        'GitHub read failed',
      );
    return parsed('graphql', () => {
      const answer = record(json(result.stdout));
      if (answer.errors !== undefined) throw malformed();
      return record(answer.data);
    });
  }

  const connectionAt = (value: unknown, ...keys: string[]) => parsed('graphql', () => connection(select(value, keys)));

  async function timelines(issues: readonly Issue[]): Promise<ReadonlyMap<IssueKey, readonly Entry[]>> {
    const result = new Map<IssueKey, readonly Entry[]>(issues.map((issue) => [issue.key, []]));
    for (const chunk of chunks(
      issues.filter((issue) => issue.comments > 0),
      50,
    )) {
      const data = await graphql(
        graphqlQuery(chunk.map(({ key }) => `i${key}: issue(number: ${key}) { ${timelineItems('')} }`).join(' ')),
      );
      for (const { key } of chunk) {
        const nodes = await drain(connectionAt(data, 'repository', `i${key}`, 'timelineItems'), async (cursor) =>
          connectionAt(
            await graphql(
              graphqlQuery(`issue(number: ${key}) { ${timelineItems(', after: $cursor')} }`, '$cursor: String!'),
              {
                cursor,
              },
            ),
            'repository',
            'issue',
            'timelineItems',
          ),
        );
        result.set(
          key,
          parsed('graphql', () => nodes.map(timelineEntry)),
        );
      }
    }
    return result;
  }

  async function checkRuns(suite: unknown): Promise<CheckRun[]> {
    const fields = parsed('graphql', () => record(suite));
    const nodes = await drain(connectionAt(fields, 'checkRuns'), async (cursor) =>
      connectionAt(
        await graphql(
          `query($owner: String!, $name: String!, $id: ID!, $cursor: String!) { repository(owner: $owner, name: $name) { id } node(id: $id) { ... on CheckSuite { ${checkRunNodes(', after: $cursor')} } } }`,
          { id: parsed('graphql', () => text(fields.id)), cursor },
        ),
        'node',
        'checkRuns',
      ),
    );
    return parsed('graphql', () => nodes.map(checkRunNode(fields)));
  }

  async function pullDetails(pulls: readonly Pull[]): Promise<ReadonlyMap<number, PullDetails>> {
    const result = new Map<number, PullDetails>();
    for (const chunk of chunks(pulls, 20)) {
      parsed('graphql', () => {
        if (!chunk.every(({ head }) => isCommit(head.sha))) throw malformed();
      });
      const data = await graphql(
        graphqlQuery(
          chunk
            .map(
              ({ number, head }) =>
                `p${number}: pullRequest(number: ${number}) { ${reviewNodes('')} } c${number}: object(oid: "${head.sha}") { ... on Commit { status { contexts { state } } ${checkSuiteNodes('')} } }`,
            )
            .join(' '),
        ),
      );
      for (const { number, head } of chunk) {
        const reviews = await drain(connectionAt(data, 'repository', `p${number}`, 'reviews'), async (cursor) =>
          connectionAt(
            await graphql(
              graphqlQuery(`pullRequest(number: ${number}) { ${reviewNodes(', after: $cursor')} }`, '$cursor: String!'),
              { cursor },
            ),
            'repository',
            'pullRequest',
            'reviews',
          ),
        );
        const commit = parsed('graphql', () => select(data, ['repository', `c${number}`]));
        const statuses = parsed('graphql', () => statusNodes(commit));
        const suites = await drain(connectionAt(commit, 'checkSuites'), async (cursor) =>
          connectionAt(
            await graphql(
              graphqlQuery(
                `object(oid: "${head.sha}") { ... on Commit { ${checkSuiteNodes(', after: $cursor')} } }`,
                '$cursor: String!',
              ),
              { cursor },
            ),
            'repository',
            'object',
            'checkSuites',
          ),
        );
        const runs: CheckRun[] = [];
        for (const suite of suites) runs.push(...(await checkRuns(suite)));
        result.set(number, {
          checks: [...runs, ...statuses],
          reviews: parsed('graphql', () => reviews.map(reviewNode)),
        });
      }
    }
    return result;
  }

  async function history(issue: Issue): Promise<readonly Entry[]> {
    if (issue.comments === 0) return [];
    const endpoint = `issues/${issue.key}/timeline?per_page=100`;
    const entries = await pages(endpoint);
    return parsed(endpoint, () => parseTimeline(entries));
  }

  return {
    api: (endpoint: string) => call(endpoint, false),
    list: (endpoint: string) => pages(endpoint),
    graphql,
    timelines,
    pullDetails,
    async read(n: IssueKey) {
      const issue = await get(`issues/${n}`, parseIssue);
      return { issue, data: issueData(issue, await history(issue)) };
    },
    async epic(n: IssueKey) {
      const target = `issues/${n}`;
      const rawRepository = await get('', record);
      const repository = parsed('', () => {
        const url = parseEpicRepository(rawRepository.html_url);
        if (
          !Number.isSafeInteger(rawRepository.id) ||
          Number(rawRepository.id) <= 0 ||
          rawRepository.full_name !== new URL(url).pathname.slice(1)
        )
          throw malformed();
        return url;
      });
      const rawParent = await get(target, record);
      const issue = parsed(target, () => {
        const parent = parseIssue(rawParent);
        if (
          Object.hasOwn(rawParent, 'pull_request') ||
          parent.key !== n ||
          parent.url !== `${repository}/issues/${n}` ||
          !Number.isSafeInteger(parent.comments) ||
          parent.comments < 0
        )
          throw malformed();
        return parent;
      });
      const timeline = `${target}/timeline?per_page=100`;
      const rawEntries = await pages(timeline);
      const entries = parsed(timeline, () => {
        const result = parseTimeline(rawEntries);
        const ids = new Set<number>();
        for (const entry of result) {
          if (entry.kind !== 'comment') continue;
          if (!Number.isSafeInteger(entry.id) || entry.id <= 0 || ids.has(entry.id)) throw malformed();
          ids.add(entry.id);
        }
        return result;
      });
      const sub = `${target}/sub_issues?per_page=100`;
      const rawChildren = await pages(sub);
      const children = parseEpicChildren(
        parsed(sub, () =>
          rawChildren.map((raw, index) => {
            const child = record(raw);
            if (Object.hasOwn(child, 'pull_request')) throw malformed();
            const number = issueKey(child.number);
            if (number === null) throw new Error(`children[${index}].number: need a positive safe integer`);
            return {
              url: child.html_url,
              id: child.id,
              number,
              state: child.state,
              stateReason: child.state_reason,
              closedAt: child.closed_at,
            };
          }),
        ),
      );
      return {
        repository,
        parent: issue.key,
        data: issueData(issue, entries),
        declaration: parseEpicAcceptance(issue.body),
        children,
      };
    },
    issue: (n: IssueKey) => get(`issues/${n}`, parseIssue),
    openIssues: () => getAll('issues?state=open&per_page=100', parseIssue),
    repository: () => get('', parseRepository),
    pulls: (filter: PullFilter) =>
      getAll(
        'head' in filter
          ? `pulls?head={owner}:${encodeURIComponent(filter.head)}&state=${filter.state}&per_page=100`
          : 'pulls?state=open&per_page=100',
        parsePull,
      ),
    pull: (n: number) => get(`pulls/${n}`, parsePull),
    async createPull(fields: NewPull) {
      const raw = await send('POST', 'pulls', { fields, silent: false });
      return parsed('pulls', () => text(record(json(raw)).html_url));
    },
    async mergePull(n: number, sha: string) {
      await send('PUT', `pulls/${n}/merge`, { fields: { merge_method: 'squash', sha } });
    },
    checkRuns: (sha: string) => getAll(`commits/${sha}/check-runs?per_page=100`, parseCheckRun, 'check_runs'),
    statuses: (sha: string) => getAll(`commits/${sha}/status?per_page=100`, parseCommitStatus, 'statuses'),
    workflowRuns: (sha: string) =>
      getAll(`actions/runs?head_sha=${sha}&per_page=100`, parseWorkflowRun, 'workflow_runs'),
    workflowRun: (id: number) => get(`actions/runs/${id}`, parseWorkflowRun),
    async rerunFailedJobs(id: number) {
      await send('POST', `actions/runs/${id}/rerun-failed-jobs`);
    },
    parent: (n: IssueKey) => get(`issues/${n}/parent`, parseParent),
    labels: () => getAll('labels?per_page=100', parseLabelName),
    async createLabel(fields: NewLabel) {
      await send('POST', 'labels', { fields });
    },
    async createIssue(fields: NewIssue) {
      const raw = await send('POST', 'issues', { fields, silent: false });
      return parsed('issues', () => parseIssue(json(raw)));
    },
    async comment(n: IssueKey, text: string) {
      await send('POST', `issues/${n}/comments`, { fields: { body: text } });
    },
    async commentIssue(n: IssueKey, file: string, attachments: readonly string[]) {
      signal?.throwIfAborted();
      const result = await run(
        'gh',
        ['issue', 'comment', n, `--body-file=${file}`, ...attachments.map((value) => `--attach=${value}`)],
        { cwd, signal, env },
      );
      if (result.code !== 0) {
        const failure = `${result.stdout}${result.stderr}`.trimEnd();
        throw new GitHubError(`issues/${n}/comments`, failure, result.stderr, failure);
      }
      stderr += result.stderr;
      await writeRefreshHint(cwd, n);
      return result.stdout;
    },
    async addLabels(n: IssueKey, names: readonly string[]) {
      await send('POST', `issues/${n}/labels`, { fields: { labels: names } });
    },
    async removeLabel(n: IssueKey, name: string) {
      await send('DELETE', `issues/${n}/labels/${encodeURIComponent(name)}`).catch((error: unknown) => {
        if (!(error instanceof GitHubError && error.notFound)) throw error;
      });
    },
    async edit(n: IssueKey, fields: Edit) {
      await send('PATCH', `issues/${n}`, { fields });
    },
    stderr: () => stderr,
  };
}
