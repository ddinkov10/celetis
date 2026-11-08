import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { type Effort, effortOf } from './lib/effort.ts';
import { installRecorder } from './lib/events.ts';
import { HostError } from './lib/host.ts';
import { describe, lineOf, type Next, type Observed } from './lib/lines.ts';
import { lockHolder } from './lib/locks.ts';
import { commandInput, createOperation, locateCheckouts, type Operation } from './lib/operation.ts';
import { codexHome } from './lib/plugin-metadata.ts';
import { run as runProcess } from './lib/process.ts';
import { permitHolds, type RecoveryAuthority, type RecoveryPermit } from './lib/quota-recovery.ts';
import { type GitHub, GitHubReadError, github, type Issue, issueData, parseIssue } from './lib/tracker.ts';
import { type Decision, decide, factsOf, type IssueData, type Lane, laneOf, specified } from './lib/workflow.ts';

type Fetched = Readonly<{ issue: Issue; data: IssueData }>;
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
export type ParentEpic = Readonly<{ number: number; title: string }>;
export type BoardRow = Readonly<{
  number: number;
  title: string;
  url: string;
  labels: readonly string[];
  updatedAt: string;
  closedAt: string | null;
  next: Decision;
  effort: Effort | null;
  path: string | null;
  pr: PullState | null;
  epic: ParentEpic | null;
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
  effort: Effort | null;
  epic: { number: number; title: string } | null;
  pr: { number: number; url: string; draft: boolean; checks: string | null; review: string | null } | null;
  path?: string;
};

const unreadable: Observed = { kind: 'observed', reason: 'unreadable' };

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
    effort: row.effort,
    epic: row.epic,
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

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    const input = request(args);
    if (!input) {
      console.error(usage('next-step'));
      return exits.usage;
    }
    const operation = await createOperation(
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
  const gh = github(checkout, signal);

  async function issues(endpoint: string): Promise<Issue[]> {
    return (await gh.list(endpoint)).map(parseIssue).filter((issue) => !issue.pull);
  }

  async function openIssues(): Promise<Fetched[]> {
    const result: Fetched[] = [];
    for (const issue of await issues('issues?state=open&per_page=100'))
      result.push({ issue, data: issueData(issue, await gh.history(issue)) });
    return result;
  }

  async function pullState(pr: Pull): Promise<PullState> {
    const runs = (
      (await gh.list(`commits/${pr.head.sha}/check-runs?per_page=100`)) as {
        check_runs: { status: string; conclusion: string | null }[];
      }[]
    ).flatMap((page) => page.check_runs);
    const statuses = (
      (await gh.list(`commits/${pr.head.sha}/status?per_page=100`)) as { statuses: { state: string }[] }[]
    )
      .flatMap((page) => page.statuses)
      .map((status) => status.state);
    const reviews = (await gh.list(`pulls/${pr.number}/reviews?per_page=100`)) as {
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
    signal?.throwIfAborted();
    const result = await runProcess('git', ['-C', path, 'status', '--porcelain'], { cwd: checkout, signal });
    signal?.throwIfAborted();
    return result.stdout.length > 0;
  }

  async function landing(n: string): Promise<boolean> {
    return (await lockHolder(checkout, `land-${n}`)) !== '';
  }

  async function lanes(n?: string): Promise<string[]> {
    const parent = join(checkout, '.claude', 'worktrees');
    return (await readdir(parent).catch(() => []))
      .filter((name) => (n === undefined ? /^[0-9].*-/.test(name) : name.startsWith(`${n}-`)))
      .sort()
      .map((name) => join(parent, name));
  }

  async function dirtyLane(n: string, permit?: RecoveryPermit): Promise<string | null> {
    for (const path of await lanes(n))
      if ((await dirty(path)) && !(permit?.lane === path && (await permitHolds(checkout, permit)))) return path;
    return null;
  }

  async function observe(n: string, mainDirty: boolean, permit?: RecoveryPermit): Promise<Observed | null> {
    if (mainDirty) return { kind: 'observed', reason: 'dirty', path: checkout };
    const path = await dirtyLane(n, permit);
    if (path !== null) return { kind: 'observed', reason: 'dirty', path };
    return (await landing(n)) ? { kind: 'observed', reason: 'landing' } : null;
  }

  async function settle<T>(missing: T, work: () => Promise<T>): Promise<{ value: T; stderr: string }> {
    try {
      const value = await work();
      signal?.throwIfAborted();
      return { value, stderr: gh.stderr() };
    } catch (error) {
      if (signal?.aborted) return { value: missing, stderr: gh.stderr() };
      throw error;
    }
  }

  return { checkout, gh, issues, openIssues, pullState, dirty, lanes, observe, settle };
}

type Resolved = { next: Next; effort: Effort | null; authority: RecoveryAuthority | null };

function authorityOf(data: IssueData, next: Decision): RecoveryAuthority | null {
  if (next.kind !== 'run') return null;
  return {
    step: next.step,
    spec: specified(data)
      ? createHash('sha256')
          .update(data.body ?? '')
          .digest('hex')
      : null,
    plan: factsOf(data, next.lane).plan,
  };
}

export async function nextIssue(
  n: string,
  operation: Operation,
  signal?: AbortSignal,
  permit?: RecoveryPermit,
): Promise<Resolved & { stderr: string }> {
  const read = reader(operation, signal);
  const missing: Resolved = { next: unreadable, effort: null, authority: null };
  const { value, stderr } = await read.settle<Resolved>(missing, async () => {
    const observed = await read.observe(n, await read.dirty(read.checkout), permit);
    if (observed) return { next: observed, effort: null, authority: null };
    try {
      const { data } = await read.gh.read(n);
      const next = decide(data);
      return { next, effort: effortOf(data, next), authority: authorityOf(data, next) };
    } catch {
      return missing;
    }
  });
  return { ...value, stderr };
}

export async function nextOpen(
  operation: Operation,
  signal?: AbortSignal,
): Promise<{ rows: readonly { number: number; next: Next }[] | null; stderr: string }> {
  const read = reader(operation, signal);
  const { value, stderr } = await read.settle<{ number: number; next: Next }[] | null>(null, async () => {
    let issues: Fetched[];
    try {
      issues = await read.openIssues();
    } catch {
      return null;
    }
    const mainDirty = await read.dirty(read.checkout);
    const rows: { number: number; next: Next }[] = [];
    for (const { issue, data } of issues.sort((a, b) => a.issue.number - b.issue.number))
      rows.push({
        number: issue.number,
        next: (await read.observe(String(issue.number), mainDirty)) ?? decide(data),
      });
    return rows;
  });
  return { rows: value, stderr };
}

const asEpic = ({ number, title }: Issue): ParentEpic => ({ number, title });

function parentNumber({ apiUrl, parentUrl }: Issue): string | null {
  if (parentUrl === null) return null;
  const prefix = apiUrl.slice(0, apiUrl.lastIndexOf('/') + 1);
  const rest = parentUrl.slice(prefix.length);
  return parentUrl.startsWith(prefix) && /^[1-9][0-9]*$/.test(rest) ? rest : null;
}

async function parentEpics(gh: GitHub, open: readonly Fetched[]): Promise<ReadonlyMap<string, ParentEpic>> {
  const epics = new Map<string, ParentEpic>();
  const read = new Set<string>();
  for (const { issue } of open) {
    const n = parentNumber(issue);
    if (n === null || read.has(n)) continue;
    read.add(n);
    let parent: Issue;
    try {
      parent = parseIssue(await gh.api(`issues/${n}`));
    } catch (error) {
      if (error instanceof GitHubReadError && error.notFound) continue;
      throw error;
    }
    if (!parent.pull && parent.state === 'open' && parent.labels.includes('epic') && parent.apiUrl === issue.parentUrl)
      epics.set(parent.apiUrl, asEpic(parent));
  }
  return epics;
}

function boardRow(
  { issue, data }: Fetched,
  prs: readonly PullState[],
  dirtyLanes: readonly string[],
  epic: ParentEpic | null,
): BoardRow | null {
  const next = decide(data);
  if (describe(String(issue.number), next).row === null) return null;
  const finished = next.kind === 'stop' && next.reason === 'finished';
  return {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    labels: issue.labels,
    updatedAt: issue.updatedAt,
    closedAt: issue.closedAt,
    next,
    effort: effortOf(data, next),
    path: finished ? null : (dirtyLanes.find((path) => basename(path).startsWith(`${issue.number}-`)) ?? null),
    pr: prs.find((pr) => pr.headRefName.includes(`/${issue.number}-`)) ?? null,
    epic,
  };
}

export async function nextBoard(
  operation: Operation,
  signal: AbortSignal,
  targets?: readonly number[],
): Promise<{ data: { noRun: string | null; rows: readonly BoardRow[]; closed: boolean } | null; stderr: string }> {
  const read = reader(operation, signal);
  const { value, stderr } = await read.settle<{
    noRun: string | null;
    rows: readonly BoardRow[];
    closed: boolean;
  } | null>(null, async () => {
    try {
      const selected = targets === undefined ? null : new Set(targets);
      const open: Fetched[] = [];
      let closed = false;
      if (selected === null) open.push(...(await read.openIssues()));
      else {
        for (const number of selected) {
          let fetched: Fetched;
          try {
            fetched = await read.gh.read(String(number));
          } catch (error) {
            if (error instanceof GitHubReadError && error.endpoint === `issues/${number}` && error.notFound) continue;
            throw error;
          }
          if (fetched.issue.pull) continue;
          if (fetched.issue.state === 'closed') closed = true;
          else open.push(fetched);
        }
      }
      const pulls = ((await read.gh.list('pulls?state=open&per_page=100')) as Pull[]).filter((pr) =>
        selected === null
          ? /\/[0-9]+-/.test(pr.head.ref)
          : [...selected].some((number) => pr.head.ref.includes(`/${number}-`)),
      );
      const prs: PullState[] = [];
      for (const pr of pulls) prs.push(await read.pullState(pr));
      const dirtyLanes: string[] = [];
      const paths =
        selected === null
          ? await read.lanes()
          : (await Promise.all([...selected].map((number) => read.lanes(String(number))))).flat();
      for (const path of paths) if (await read.dirty(path)) dirtyLanes.push(path);
      const epics =
        selected === null
          ? new Map(open.filter((f) => f.issue.labels.includes('epic')).map((f) => [f.issue.apiUrl, asEpic(f.issue)]))
          : await parentEpics(read.gh, open);
      const rows: BoardRow[] = [];
      for (const fetched of open.sort((a, b) => a.issue.number - b.issue.number)) {
        const { parentUrl } = fetched.issue;
        const row = boardRow(fetched, prs, dirtyLanes, parentUrl === null ? null : (epics.get(parentUrl) ?? null));
        if (row !== null) rows.push(row);
      }
      const noRun = (await read.dirty(read.checkout))
        ? `The main checkout is dirty: ${read.checkout}. Commit or stash first.`
        : null;
      return { noRun, rows, closed };
    } catch {
      return null;
    }
  });
  return { data: value, stderr };
}

async function resolveNext(
  { arg, n }: { arg: string; n: string },
  operation: Operation,
): Promise<{ code: ExitCode; stdout: string; stderr: string }> {
  if (arg === '--open') {
    const { rows, stderr } = await nextOpen(operation);
    if (!rows) return { code: exits.blocked, stdout: 'stop cannot read the open issues from GitHub\n', stderr };
    const stdout = rows.map((row) => `${row.number}\t${lineOf(String(row.number), row.next)}\n`).join('');
    return { code: exits.done, stdout, stderr };
  }
  const { next, stderr } = await nextIssue(n, operation);
  const failed = next.kind === 'observed' && next.reason === 'unreadable';
  return { code: failed ? exits.blocked : exits.done, stdout: `${lineOf(n, next)}\n`, stderr };
}

if (import.meta.main) {
  installRecorder('next-step');
  process.exitCode = await main(process.argv.slice(2));
}
