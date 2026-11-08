import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { type Effort, effortOf } from './effort.ts';
import { describe, type Next, type Observed } from './lines.ts';
import { isRecorded, lockHolder } from './locks.ts';
import type { Operation } from './operation.ts';
import { run as runProcess } from './process.ts';
import type { RecoveryAuthority } from './quota-recovery.ts';
import type { IssueRow, ParentEpic, Pull } from './resolver-types.ts';
import { type GitHub, GitHubReadError, github, type Issue, issueData, parseIssue } from './tracker.ts';
import { type Decision, decide, factsOf, type IssueData, laneOf, specified, stageOf } from './workflow.ts';

type Fetched = Readonly<{ issue: Issue; data: IssueData }>;
type ApiPull = {
  number: number;
  html_url: string;
  head: { ref: string; sha: string };
  draft: boolean;
  requested_reviewers: unknown[];
  requested_teams: unknown[];
};
type BranchPull = Readonly<{ branch: string; pull: Pull }>;

const unreadable: Observed = { kind: 'observed', reason: 'unreadable' };

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

  async function pullState(pr: ApiPull): Promise<BranchPull> {
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
    return { branch: pr.head.ref, pull: { number: pr.number, url: pr.html_url, draft: pr.draft, checks, review } };
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

  async function dirtyLane(n: string, keeps?: Keeps): Promise<string | null> {
    for (const path of await lanes(n)) if ((await dirty(path)) && !(await keeps?.(path))) return path;
    return null;
  }

  async function observe(n: string, mainDirty: boolean, keeps?: Keeps): Promise<Observed | null> {
    if (mainDirty) return { kind: 'observed', reason: 'dirty', path: checkout };
    const path = await dirtyLane(n, keeps);
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

type Keeps = (lane: string) => Promise<boolean>;
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
  keeps?: Keeps,
): Promise<Resolved & { stderr: string }> {
  const read = reader(operation, signal);
  const missing: Resolved = { next: unreadable, effort: null, authority: null };
  const { value, stderr } = await read.settle<Resolved>(missing, async () => {
    const observed = await read.observe(n, await read.dirty(read.checkout), keeps);
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

type Shown = Readonly<{ row: IssueRow; line: string }>;

function shownRow(
  { issue, data }: Fetched,
  prs: readonly BranchPull[],
  dirtyLanes: readonly string[],
  epic: ParentEpic | null,
): Shown | null {
  const next = decide(data);
  const { line, row: shown } = describe(String(issue.number), next);
  if (shown === null || shown.state === 'done') return null;
  const found = laneOf(issue.labels);
  const type = found.kind === 'lane' ? found.lane : null;
  const step = next.kind === 'run' ? next.step : null;
  const path = dirtyLanes.find((lane) => basename(lane).startsWith(`${issue.number}-`));
  return {
    line,
    row: {
      number: issue.number,
      title: issue.title,
      url: issue.url,
      type,
      updatedAt: issue.updatedAt,
      reason: shown.reason,
      act: shown.act,
      effort: effortOf(data, next),
      epic,
      pr: prs.find(({ branch }) => branch.includes(`/${issue.number}-`))?.pull ?? null,
      ...(path === undefined ? {} : { path }),
      state: path === undefined ? shown.state : 'dirty',
      step,
      started: step !== null && stageOf(step) > 1,
      urgent: type === 'hotfix',
    },
  };
}

async function boardRow(operation: Operation, { row, line }: Shown): Promise<IssueRow> {
  const locked = !!(await lockHolder(operation.checkout.main as string, `issue-${row.number}`));
  const stuck = await isRecorded(operation.checkout.common as string, String(row.number), line);
  if (locked) return { ...row, state: 'starting' };
  if (row.state === 'dirty' || !stuck) return row;
  return { ...row, state: 'stuck', act: `celetis --agent <host> run resume ${row.number}` };
}

export async function nextBoard(
  operation: Operation,
  signal: AbortSignal,
  targets?: readonly number[],
): Promise<{ data: { noRun: string | null; rows: readonly IssueRow[]; closed: boolean } | null; stderr: string }> {
  const read = reader(operation, signal);
  const { value, stderr } = await read.settle<{
    noRun: string | null;
    rows: readonly Shown[];
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
      const pulls = ((await read.gh.list('pulls?state=open&per_page=100')) as ApiPull[]).filter((pr) =>
        selected === null
          ? /\/[0-9]+-/.test(pr.head.ref)
          : [...selected].some((number) => pr.head.ref.includes(`/${number}-`)),
      );
      const prs: BranchPull[] = [];
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
      const rows: Shown[] = [];
      for (const fetched of open.sort((a, b) => a.issue.number - b.issue.number)) {
        const { parentUrl } = fetched.issue;
        const row = shownRow(fetched, prs, dirtyLanes, parentUrl === null ? null : (epics.get(parentUrl) ?? null));
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
  if (value === null) return { data: null, stderr };
  const rows: IssueRow[] = [];
  for (const shown of value.rows) rows.push(await boardRow(operation, shown));
  return { data: { ...value, rows }, stderr };
}
