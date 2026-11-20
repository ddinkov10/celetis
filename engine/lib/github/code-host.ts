import {
  type CheckRun,
  type CodeHost,
  CodeHostError,
  type CommitStatus,
  type NewPull,
  type Pull,
  type PullDetails,
  type PullFilter,
  type Ref,
  type Repository,
  type Review,
  type WorkflowRun,
} from '../code-host/code-host.ts';
import { isCommit } from '../state/fields.ts';
import {
  type Client,
  chunks,
  converting,
  drain,
  type GitHubError,
  graphqlQuery,
  integer,
  malformed,
  orNull,
  record,
  select,
  text,
} from './github.ts';

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

const codeHostError = (error: GitHubError) => new CodeHostError(error.text, error.stderr, error.message);

export function githubCodeHost(client: Client): CodeHost {
  const { parsed, get, getAll, send, json, graphql, connectionAt } = client;

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

  const adapter: CodeHost = {
    pullDetails,
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
    stderr: client.stderr,
  };
  return converting(adapter, codeHostError);
}
