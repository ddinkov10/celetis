import { z } from 'zod';
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
  connection,
  converting,
  drain,
  type GitHubError,
  graphqlQuery,
  malformed,
  parse,
  select,
} from './github.ts';

const count = z
  .array(z.unknown())
  .nullish()
  .transform((items) => items?.length ?? 0);

const ref: z.ZodType<Ref> = z.object({ ref: z.string(), sha: z.string() });

const repository: z.ZodType<Repository> = z
  .object({ full_name: z.string(), default_branch: z.string().min(1), html_url: z.string() })
  .transform(({ full_name, default_branch, html_url }) => ({
    fullName: full_name,
    defaultBranch: default_branch,
    url: html_url,
  }));

const pull: z.ZodType<Pull> = z
  .object({
    number: z.int(),
    html_url: z.string(),
    head: ref,
    base: ref,
    state: z.enum(['open', 'closed']),
    merged_at: z.string().nullable(),
    draft: z.boolean().optional(),
    requested_reviewers: count,
    requested_teams: count,
  })
  .transform((raw) => ({
    number: raw.number,
    url: raw.html_url,
    head: raw.head,
    base: raw.base,
    state: raw.state,
    mergedAt: raw.merged_at,
    draft: raw.draft ?? false,
    requestedReviewers: raw.requested_reviewers + raw.requested_teams,
  }));

const slug = z
  .object({ slug: z.string() })
  .transform(({ slug }) => slug)
  .nullable();

const checkRun: z.ZodType<CheckRun> = z
  .object({
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
    app: slug,
    check_suite: z
      .object({ id: z.int() })
      .transform(({ id }) => id)
      .nullable(),
    details_url: z.string().nullable(),
  })
  .transform((raw) => ({
    name: raw.name,
    status: raw.status,
    conclusion: raw.conclusion,
    app: raw.app,
    suite: raw.check_suite,
    url: raw.details_url,
  }));

const commitStatus: z.ZodType<CommitStatus> = z.object({ state: z.string() });

const workflowRun: z.ZodType<WorkflowRun> = z
  .object({
    id: z.int(),
    check_suite_id: z.int(),
    run_attempt: z.int(),
    status: z.string().nullable(),
    conclusion: z.string().nullable(),
    name: z.string().nullable(),
    path: z.unknown().optional(),
    html_url: z.string(),
  })
  .transform((raw, ctx) => {
    const name = raw.name || raw.path;
    if (typeof name !== 'string') {
      ctx.issues.push({ code: 'custom', message: 'name', input: raw });
      return z.NEVER;
    }
    return {
      id: raw.id,
      suite: raw.check_suite_id,
      attempt: raw.run_attempt,
      status: raw.status,
      conclusion: raw.conclusion,
      name,
      url: raw.html_url,
    };
  });

const reviewNodes = (after: string) =>
  `reviews(first: 100${after}) { pageInfo { hasNextPage endCursor } nodes { state author { login } } }`;

const checkRunNodes = (after: string) =>
  `checkRuns(first: 50${after}, filterBy: { checkType: LATEST }) { pageInfo { hasNextPage endCursor } nodes { name status conclusion detailsUrl } }`;

const checkSuiteNodes = (after: string) =>
  `checkSuites(first: 50${after}) { pageInfo { hasNextPage endCursor } nodes { id databaseId app { slug } ${checkRunNodes('')} } }`;

const review: z.ZodType<Review> = z
  .object({ author: z.object({ login: z.string() }).nullable(), state: z.string() })
  .transform(({ author, state }) => ({ user: author?.login ?? null, state }));

const lower = z.string().transform((value) => value.toLowerCase());

const checkSuite = z.object({
  id: z.unknown().optional(),
  databaseId: z.unknown().optional(),
  app: z.unknown().optional(),
  checkRuns: connection,
});

const checkRunNode = (app: unknown, databaseId: unknown): z.ZodType<CheckRun> =>
  z
    .object({ name: z.string(), status: lower, conclusion: lower.nullable(), detailsUrl: z.string().nullable() })
    .transform((run) => ({
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      app: parse(slug, app),
      suite: parse(z.int().nullable(), databaseId),
      url: run.detailsUrl,
    }));

const commit = z.object({
  status: z.object({ contexts: z.array(z.object({ state: lower })) }).nullable(),
  checkSuites: connection,
});

const createdPull = z.object({ html_url: z.string() });

const codeHostError = (error: GitHubError) => new CodeHostError(error.text, error.stderr, error.message);

export function githubCodeHost(client: Client): CodeHost {
  const { parsed, get, getAll, send, json, graphql, connectionAt } = client;

  async function checkRuns(raw: unknown): Promise<CheckRun[]> {
    const { id, databaseId, app, checkRuns: first } = parsed('graphql', () => parse(checkSuite, raw));
    const nodes = await drain(first, async (cursor) =>
      connectionAt(
        await graphql(
          `query($owner: String!, $name: String!, $id: ID!, $cursor: String!) { repository(owner: $owner, name: $name) { id } node(id: $id) { ... on CheckSuite { ${checkRunNodes(', after: $cursor')} } } }`,
          { id: parsed('graphql', () => parse(z.string(), id)), cursor },
        ),
        'node',
        'checkRuns',
      ),
    );
    return parsed('graphql', () => parse(z.array(checkRunNode(app, databaseId)), nodes));
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
        const { status, checkSuites } = parsed('graphql', () =>
          parse(commit, select(data, ['repository', `c${number}`])),
        );
        const statuses = status?.contexts ?? [];
        const suites = await drain(checkSuites, async (cursor) =>
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
          reviews: parsed('graphql', () => parse(z.array(review), reviews)),
        });
      }
    }
    return result;
  }

  const adapter: CodeHost = {
    name: 'GitHub',
    pullDetails,
    repository: () => get('', (raw) => parse(repository, raw)),
    pulls: (filter: PullFilter) =>
      getAll(
        'head' in filter
          ? `pulls?head={owner}:${encodeURIComponent(filter.head)}&state=${filter.state}&per_page=100`
          : 'pulls?state=open&per_page=100',
        (raw) => parse(pull, raw),
      ),
    pull: (n: number) => get(`pulls/${n}`, (raw) => parse(pull, raw)),
    async createPull(fields: NewPull) {
      const raw = await send('POST', 'pulls', { fields, silent: false });
      return parsed('pulls', () => parse(createdPull, json(raw)).html_url);
    },
    async mergePull(n: number, sha: string) {
      await send('PUT', `pulls/${n}/merge`, { fields: { merge_method: 'squash', sha } });
    },
    checkRuns: (sha: string) =>
      getAll(`commits/${sha}/check-runs?per_page=100`, (raw) => parse(checkRun, raw), 'check_runs'),
    statuses: (sha: string) =>
      getAll(`commits/${sha}/status?per_page=100`, (raw) => parse(commitStatus, raw), 'statuses'),
    workflowRuns: (sha: string) =>
      getAll(`actions/runs?head_sha=${sha}&per_page=100`, (raw) => parse(workflowRun, raw), 'workflow_runs'),
    workflowRun: (id: number) => get(`actions/runs/${id}`, (raw) => parse(workflowRun, raw)),
    async rerunFailedJobs(id: number) {
      await send('POST', `actions/runs/${id}/rerun-failed-jobs`);
    },
    stderr: client.stderr,
  };
  return converting(adapter, codeHostError);
}
