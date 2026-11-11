import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Config } from './config-core.ts';
import { decisionOf, type EffortDecision, startPair } from './effort.ts';
import { describe, type Next, type Observed } from './lines.ts';
import { isRecorded, lockHolder } from './locks.ts';
import type { Operation } from './operation.ts';
import { run as runProcess } from './process.ts';
import type { RecoveryAuthority } from './quota-recovery.ts';
import type { IssueRow, ParentEpic, Pull } from './resolver-types.ts';
import { laneFolder } from './state.ts';
import {
  type Bucket,
  bucket,
  type GitHub,
  GitHubError,
  github,
  type Issue,
  issueData,
  type Pull as TrackerPull,
} from './tracker.ts';
import { type Decision, decide, factsOf, type IssueData, laneOf, specified, stageOf } from './workflow.ts';

type Fetched = Readonly<{ issue: Issue; data: IssueData }>;
type BranchPull = Readonly<{ branch: string; pull: Pull }>;

function checkResult(buckets: readonly Bucket[]): Pull['checks'] {
  if (buckets.length === 0) return null;
  if (buckets.some((b) => b === 'fail' || b === 'cancel')) return 'fail';
  return buckets.includes('pending') ? 'pending' : 'pass';
}

const unreadable: Observed = { kind: 'observed', reason: 'unreadable' };

function reader(operation: Operation, signal?: AbortSignal) {
  const checkout = operation.checkout.main as string;
  const gh = github(checkout, signal);

  async function openIssues(): Promise<Fetched[]> {
    const result: Fetched[] = [];
    for (const issue of (await gh.openIssues()).filter((issue) => !issue.pull))
      result.push({ issue, data: issueData(issue, await gh.history(issue)) });
    return result;
  }

  async function pullState(pr: TrackerPull): Promise<BranchPull> {
    const checks = [...(await gh.checkRuns(pr.head.sha)), ...(await gh.statuses(pr.head.sha))].map(bucket);
    const latest = new Map<string | null, string>();
    for (const review of await gh.reviews(pr.number))
      if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) latest.set(review.user, review.state);
    const states = [...latest.values()];
    const review = states.includes('CHANGES_REQUESTED')
      ? 'changes'
      : states.includes('APPROVED')
        ? 'approved'
        : pr.requestedReviewers > 0
          ? 'required'
          : null;
    return {
      branch: pr.head.ref,
      pull: { number: pr.number, url: pr.url, draft: pr.draft, checks: checkResult(checks), review },
    };
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
    const parent = laneFolder(checkout);
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

  return { checkout, gh, openIssues, pullState, dirty, lanes, observe, settle };
}

type Keeps = (lane: string) => Promise<boolean>;
type Resolved = { next: Next; decided: EffortDecision | null; authority: RecoveryAuthority | null };

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
  const missing: Resolved = { next: unreadable, decided: null, authority: null };
  const { value, stderr } = await read.settle<Resolved>(missing, async () => {
    const observed = await read.observe(n, await read.dirty(read.checkout), keeps);
    if (observed) return { next: observed, decided: null, authority: null };
    try {
      const { data } = await read.gh.read(n);
      const next = decide(data);
      return { next, decided: decisionOf(data, next), authority: authorityOf(data, next) };
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
      parent = await gh.issue(n);
    } catch (error) {
      if (error instanceof GitHubError && error.notFound) continue;
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
  config: Config | null,
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
      effort: next.kind === 'run' ? startPair(decisionOf(data, next), config?.sessions?.[next.step]) : null,
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
            if (error instanceof GitHubError && error.endpoint === `issues/${number}` && error.notFound) continue;
            throw error;
          }
          if (fetched.issue.pull) continue;
          if (fetched.issue.state === 'closed') closed = true;
          else open.push(fetched);
        }
      }
      const pulls = (await read.gh.pulls({ state: 'open' })).filter((pr) =>
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
        const epic = parentUrl === null ? null : (epics.get(parentUrl) ?? null);
        const row = shownRow(fetched, prs, dirtyLanes, epic, operation.mainConfig);
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
