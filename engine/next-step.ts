import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts, type Operation } from './lib/operation.ts';
import { codexHome } from './lib/plugin-metadata.ts';
import { run as runProcess } from './lib/process.ts';
import { processRunsScript } from './lib/process-identity.ts';
import { command, type Decision, decide, type IssueData, type Lane, laneOf, type Stop } from './lib/workflow.ts';

type Issue = Readonly<{
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  labels: readonly string[];
  body: string | null;
  comments: number | readonly string[];
  updatedAt: string;
  closedAt: string | null;
  pull: boolean;
}>;
type Pull = {
  number: number;
  html_url: string;
  head: { ref: string; sha: string };
  draft: boolean;
  requested_reviewers: unknown[];
  requested_teams: unknown[];
};
export type PullState = {
  headRefName: string;
  number: number;
  url: string;
  draft: boolean;
  checks: string | null;
  review: string | null;
};
export type Observed = Readonly<
  | { kind: 'observed'; reason: 'dirty'; path: string }
  | { kind: 'observed'; reason: 'landing' }
  | { kind: 'observed'; reason: 'unreadable' }
>;
export type Next = Decision | Observed;
export type BoardRow = Readonly<{
  number: number;
  title: string;
  url: string;
  labels: readonly string[];
  updatedAt: string;
  closedAt: string | null;
  next: Decision;
  path: string | null;
  pr: PullState | null;
}>;
export type JsonRow = {
  number: number;
  title: string;
  url: string;
  type: Lane | null;
  updatedAt: string;
  closedAt: string | null;
  line: string;
  state: 'ready' | 'blocked' | 'done' | 'dirty';
  reason: string | null;
  act: string | null;
  pr: { number: number; url: string; draft: boolean; checks: string | null; review: string | null } | null;
  path?: string;
};
type Described = {
  line: string;
  row: { state: 'ready' | 'blocked' | 'done'; reason: string | null; act: string | null } | null;
};

const usage =
  'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step <issue number> | --open, e.g. BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step 276';
const unreadable: Observed = { kind: 'observed', reason: 'unreadable' };

function malformed(): Error {
  return new Error('malformed GitHub data');
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw malformed();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw malformed();
  return value;
}

function bodies(value: unknown): string[] {
  if (!Array.isArray(value)) throw malformed();
  return value.map((comment) => text(record(comment).body));
}

function parseIssue(raw: unknown): Issue {
  const issue = record(raw);
  const { number, state, labels, body, comments, closed_at: closedAt, pull_request: pull } = issue;
  if (
    typeof number !== 'number' ||
    (state !== 'open' && state !== 'closed') ||
    !Array.isArray(labels) ||
    (pull !== undefined && pull !== null && typeof pull !== 'object')
  )
    throw malformed();
  return {
    number,
    title: text(issue.title),
    url: text(issue.html_url),
    state,
    labels: labels.map((label) => text(record(label).name)),
    body: body === null ? null : text(body),
    comments: typeof comments === 'number' ? comments : bodies(comments),
    updatedAt: text(issue.updated_at),
    closedAt: closedAt === null ? null : text(closedAt),
    pull: Boolean(pull),
  };
}

const issueData = (issue: Issue): IssueData => ({
  state: issue.state,
  labels: issue.labels,
  body: issue.body,
  comments: issue.comments,
});

function describeObserved(n: string, next: Observed): Described {
  switch (next.reason) {
    case 'dirty':
      return { line: `stop the working tree is dirty: ${next.path}; commit or stash first`, row: null };
    case 'landing':
      return {
        line: `stop the landing of #${n} runs; wait until /usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land' ends`,
        row: null,
      };
    case 'unreadable':
      return { line: `stop cannot read #${n} from GitHub`, row: null };
  }
}

function describeStop(n: string, next: Stop): Described {
  const blocked = (head: string, reason: string, act: string): Described => ({
    line: `stop #${n} ${head}. ${act}`,
    row: { state: 'blocked', reason, act },
  });
  switch (next.reason) {
    case 'wontfix':
      return { line: `stop #${n} is closed as wontfix.`, row: null };
    case 'finished':
      return { line: `stop #${n} is finished.`, row: { state: 'done', reason: null, act: null } };
    case 'needs-info':
      return blocked('needs info', 'needs info', 'Answer the questions on the issue, then remove the label.');
    case 'ready-for-human':
      return blocked(
        'is ready-for-human',
        next.variant === 'landing-refused' ? 'landing refused' : 'ready for your step',
        'Do the human step (e.g. the hotfix ship checklist), then remove the label.',
      );
    case 'epic':
      return { line: `stop #${n} is an epic. Each child runs its own flow.`, row: null };
    case 'several-lanes':
      return blocked(
        `has several lane labels (${next.labels.join(' ')})`,
        'several lane labels',
        'Keep one lane label and remove the others.',
      );
  }
}

function describe(n: string, next: Next): Described {
  switch (next.kind) {
    case 'run':
      return {
        line: `run /celetis:${command(next.step)} #${n}`,
        row: { state: 'ready', reason: null, act: null },
      };
    case 'observed':
      return describeObserved(n, next);
    case 'stop':
      return describeStop(n, next);
  }
}

export function lineOf(n: string, next: Next): string {
  return describe(n, next).line;
}

export function jsonRow(row: BoardRow): JsonRow {
  const { line, row: shown } = describe(String(row.number), row.next);
  if (!shown) throw new Error(`#${row.number} has no board row`);
  const found = laneOf(row.labels);
  return {
    number: row.number,
    title: row.title,
    url: row.url,
    type: found.kind === 'lane' ? found.lane : null,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
    line,
    state: row.path === null ? shown.state : 'dirty',
    reason: shown.reason,
    act: shown.act,
    pr: row.pr
      ? { number: row.pr.number, url: row.pr.url, draft: row.pr.draft, checks: row.pr.checks, review: row.pr.review }
      : null,
    ...(row.path === null ? {} : { path: row.path }),
  };
}

function request(args: string[]): { arg: string; n: string } | null {
  const arg = args[0] ?? '';
  const n = arg.replace(/^#/, '');
  return args.length === 1 && (arg === '--open' || /^\d+$/.test(n)) ? { arg, n } : null;
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    const input = request(args);
    if (!input) {
      console.error(usage);
      return 2;
    }
    const operation = createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
    const result = await resolveNext(input, operation);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    return result.code;
  } catch (error) {
    if (error instanceof HostError) {
      if (error.message) console.error(error.message);
      return error.code;
    }
    throw error;
  }
}

function reader(operation: Operation, signal?: AbortSignal) {
  const checkout = operation.checkout.main as string;
  const common = operation.checkout.common as string;
  let stderr = '';
  const run = async (file: string, args: string[]) => {
    signal?.throwIfAborted();
    const result = await runProcess(file, args, { cwd: checkout, signal });
    signal?.throwIfAborted();
    return result;
  };

  async function api<T = unknown>(endpoint: string, paginate = false): Promise<T> {
    const result = await run('gh', [
      'api',
      ...(paginate ? ['--paginate', '--slurp'] : []),
      `repos/{owner}/{repo}/${endpoint}`,
    ]);
    stderr += result.stderr;
    if (result.code !== 0) throw new Error('GitHub read failed');
    return JSON.parse(result.stdout) as T;
  }

  async function list(endpoint: string): Promise<unknown[]> {
    const pages = await api(endpoint, true);
    if (!Array.isArray(pages)) throw malformed();
    return pages.flat();
  }

  async function withComments(issue: Issue): Promise<Issue> {
    return {
      ...issue,
      comments: issue.comments === 0 ? [] : bodies(await list(`issues/${issue.number}/comments?per_page=100`)),
    };
  }

  async function issues(endpoint: string): Promise<Issue[]> {
    return (await list(endpoint)).map(parseIssue).filter((issue) => !issue.pull);
  }

  async function openIssues(): Promise<Issue[]> {
    const result: Issue[] = [];
    for (const issue of await issues('issues?state=open&per_page=100')) result.push(await withComments(issue));
    return result;
  }

  async function pullState(pr: Pull): Promise<PullState> {
    const runs = (
      await api<{ check_runs: { status: string; conclusion: string | null }[] }[]>(
        `commits/${pr.head.sha}/check-runs?per_page=100`,
        true,
      )
    ).flatMap((page) => page.check_runs);
    const statuses = (
      await api<{ statuses: { state: string }[] }[]>(`commits/${pr.head.sha}/status?per_page=100`, true)
    )
      .flatMap((page) => page.statuses)
      .map((status) => status.state);
    const reviews = (await list(`pulls/${pr.number}/reviews?per_page=100`)) as {
      user: { login: string };
      state: string;
    }[];
    const latest = new Map<string, string>();
    for (const review of reviews)
      if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state))
        latest.set(review.user.login, review.state);
    const states = [...latest.values()];
    const checks =
      runs.length + statuses.length === 0
        ? null
        : runs.some((run) =>
              ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'].includes(
                run.conclusion ?? '',
              ),
            ) || statuses.some((status) => ['failure', 'error'].includes(status))
          ? 'fail'
          : runs.some((run) => run.status !== 'completed') || statuses.includes('pending')
            ? 'pending'
            : 'pass';
    const review = states.includes('CHANGES_REQUESTED')
      ? 'changes'
      : states.includes('APPROVED')
        ? 'approved'
        : pr.requested_reviewers.length + pr.requested_teams.length > 0
          ? 'required'
          : null;
    return { headRefName: pr.head.ref, number: pr.number, url: pr.html_url, draft: pr.draft, checks, review };
  }

  async function dirty(path: string): Promise<boolean> {
    if (!(await stat(path).catch(() => null))?.isDirectory()) return false;
    return (await run('git', ['-C', path, 'status', '--porcelain'])).stdout.length > 0;
  }

  async function landing(n: string): Promise<boolean> {
    const lockPath = join(common, 'celetis-flow', `land-${n}.lock`);
    const pid = (await readFile(lockPath, 'utf8').catch(() => '')).trimEnd();
    if (!/^\d+$/.test(pid)) return false;
    const written = await stat(lockPath).catch(() => null);
    if (!written) return false;
    return processRunsScript(Number(pid), 'land.ts', written.mtimeMs);
  }

  async function lanes(n?: string): Promise<string[]> {
    const parent = join(checkout, '.claude', 'worktrees');
    return (await readdir(parent).catch(() => []))
      .filter((name) => (n === undefined ? /^[0-9].*-/.test(name) : name.startsWith(`${n}-`)))
      .sort()
      .map((name) => join(parent, name));
  }

  async function dirtyLane(n: string): Promise<string | null> {
    for (const path of await lanes(n)) if (await dirty(path)) return path;
    return null;
  }

  async function observe(n: string, mainDirty: boolean): Promise<Observed | null> {
    if (mainDirty) return { kind: 'observed', reason: 'dirty', path: checkout };
    const path = await dirtyLane(n);
    if (path !== null) return { kind: 'observed', reason: 'dirty', path };
    return (await landing(n)) ? { kind: 'observed', reason: 'landing' } : null;
  }

  async function settle<T>(missing: T, work: () => Promise<T>): Promise<{ value: T; stderr: string }> {
    try {
      const value = await work();
      signal?.throwIfAborted();
      return { value, stderr };
    } catch (error) {
      if (signal?.aborted) return { value: missing, stderr };
      throw error;
    }
  }

  return { checkout, api, list, issues, openIssues, withComments, pullState, dirty, lanes, observe, settle };
}

export async function nextIssue(
  n: string,
  operation: Operation,
  signal?: AbortSignal,
): Promise<{ next: Next; stderr: string }> {
  const read = reader(operation, signal);
  const { value, stderr } = await read.settle<Next>(unreadable, async () => {
    const observed = await read.observe(n, await read.dirty(read.checkout));
    if (observed) return observed;
    try {
      return decide(issueData(await read.withComments(parseIssue(await read.api(`issues/${n}`)))));
    } catch {
      return unreadable;
    }
  });
  return { next: value, stderr };
}

export async function nextOpen(
  operation: Operation,
  signal?: AbortSignal,
): Promise<{ rows: readonly { number: number; next: Next }[] | null; stderr: string }> {
  const read = reader(operation, signal);
  const { value, stderr } = await read.settle<{ number: number; next: Next }[] | null>(null, async () => {
    let issues: Issue[];
    try {
      issues = await read.openIssues();
    } catch {
      return null;
    }
    const mainDirty = await read.dirty(read.checkout);
    const rows: { number: number; next: Next }[] = [];
    for (const issue of issues.sort((a, b) => a.number - b.number))
      rows.push({
        number: issue.number,
        next: (await read.observe(String(issue.number), mainDirty)) ?? decide(issueData(issue)),
      });
    return rows;
  });
  return { rows: value, stderr };
}

export async function nextBoard(
  operation: Operation,
  signal: AbortSignal,
): Promise<{ data: { noRun: string | null; rows: readonly BoardRow[] } | null; stderr: string }> {
  const read = reader(operation, signal);
  const { value, stderr } = await read.settle<{ noRun: string | null; rows: readonly BoardRow[] } | null>(
    null,
    async () => {
      try {
        const since = new Date(Date.now() - 1_209_600_000).toISOString().slice(0, 10);
        const open = await read.openIssues();
        const closed = (await read.issues(`issues?state=closed&since=${since}T00:00:00Z&per_page=100`)).filter(
          (issue) => issue.closedAt !== null && issue.closedAt >= since,
        );
        const pulls = ((await read.list('pulls?state=open&per_page=100')) as Pull[]).filter((pr) =>
          /\/[0-9]+-/.test(pr.head.ref),
        );
        const prs: PullState[] = [];
        for (const pr of pulls) prs.push(await read.pullState(pr));
        const unique = new Map<number, Issue>();
        for (const issue of [...open, ...closed]) if (!unique.has(issue.number)) unique.set(issue.number, issue);
        const dirtyLanes: string[] = [];
        for (const path of await read.lanes()) if (await read.dirty(path)) dirtyLanes.push(path);
        const rows: BoardRow[] = [];
        for (const issue of [...unique.values()].sort((a, b) => a.number - b.number)) {
          const next = decide(issueData(issue));
          if (describe(String(issue.number), next).row === null) continue;
          const finished = next.kind === 'stop' && next.reason === 'finished';
          rows.push({
            number: issue.number,
            title: issue.title,
            url: issue.url,
            labels: issue.labels,
            updatedAt: issue.updatedAt,
            closedAt: issue.closedAt,
            next,
            path: finished
              ? null
              : (dirtyLanes.find((path) => path.split('/').at(-1)?.startsWith(`${issue.number}-`)) ?? null),
            pr: prs.find((pr) => pr.headRefName.includes(`/${issue.number}-`)) ?? null,
          });
        }
        const noRun = (await read.dirty(read.checkout))
          ? `The main checkout is dirty: ${read.checkout}. Commit or stash first.`
          : null;
        return { noRun, rows };
      } catch {
        return null;
      }
    },
  );
  return { data: value, stderr };
}

async function resolveNext(
  { arg, n }: { arg: string; n: string },
  operation: Operation,
): Promise<{ code: number; stdout: string; stderr: string }> {
  if (arg === '--open') {
    const { rows, stderr } = await nextOpen(operation);
    if (!rows) return { code: 1, stdout: 'stop cannot read the open issues from GitHub\n', stderr };
    const stdout = rows.map((row) => `${row.number}\t${lineOf(String(row.number), row.next)}\n`).join('');
    return { code: 0, stdout, stderr };
  }
  const { next, stderr } = await nextIssue(n, operation);
  const failed = next.kind === 'observed' && next.reason === 'unreadable';
  return { code: failed ? 1 : 0, stdout: `${lineOf(n, next)}\n`, stderr };
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
