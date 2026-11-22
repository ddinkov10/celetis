import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { type Bucket, bucket, type Pull as CodeHostPull, type PullDetails } from '../code-host/code-host.ts';
import type { Operation } from '../command/operation.ts';
import type { Config } from '../config/core.ts';
import { run as runProcess } from '../process/process.ts';
import { readSetAside } from '../queue/set-aside.ts';
import type { RecoveryAuthority } from '../run/quota-recovery.ts';
import { services } from '../services/services.ts';
import { isRecorded, issueLock, landLock, lockHolder } from '../state/locks.ts';
import { laneFolder } from '../state/state.ts';
import { compareKeys, type IssueKey } from '../tracker/key.ts';
import { type Issue, issueData, type Tracker, TrackerError } from '../tracker/tracker.ts';
import { decisionOf, type EffortDecision, startPair } from '../workflow/effort.ts';
import {
  type Decision,
  decide,
  factsOf,
  folderKey,
  folderPrefix,
  holdsAnyKey,
  holdsKey,
  type IssueData,
  laneOf,
  specified,
  stageOf,
} from '../workflow/workflow.ts';
import { describe, type Next, type Observed } from './lines.ts';
import type { IssueRow, ParentEpic, Pull } from './types.ts';

type Fetched = Readonly<{ issue: Issue; data: IssueData }>;
type BranchPull = Readonly<{ branch: string; pull: Pull }>;

function checkResult(buckets: readonly Bucket[]): Pull['checks'] {
  if (buckets.length === 0) return null;
  if (buckets.some((b) => b === 'fail' || b === 'cancel')) return 'fail';
  return buckets.includes('pending') ? 'pending' : 'pass';
}

function branchPull(pr: CodeHostPull, details: PullDetails | undefined): BranchPull {
  if (details === undefined) throw new Error(`no details of PR #${pr.number}`);
  const latest = new Map<string | null, string>();
  for (const review of details.reviews)
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
    pull: { number: pr.number, url: pr.url, draft: pr.draft, checks: checkResult(details.checks.map(bucket)), review },
  };
}

const unreadable: Observed = { kind: 'observed', reason: 'unreadable' };

async function isDirty(path: string, cwd: string, signal?: AbortSignal): Promise<boolean> {
  if (!(await stat(path).catch(() => null))?.isDirectory()) return false;
  signal?.throwIfAborted();
  const result = await runProcess('git', ['-C', path, '--no-optional-locks', 'status', '--porcelain'], { cwd, signal });
  signal?.throwIfAborted();
  return result.stdout.length > 0;
}

export async function mainNoRun(checkout: string, signal?: AbortSignal): Promise<string | null> {
  return (await isDirty(checkout, checkout, signal))
    ? `The main checkout is dirty: ${checkout}. Commit or stash first.`
    : null;
}

function reader(operation: Operation, signal?: AbortSignal) {
  const checkout = operation.checkout.main as string;
  const { tracker, codeHost } = services(operation.mainConfig as Config, checkout, signal);

  async function openIssues(): Promise<Fetched[]> {
    const issues = (await tracker.issues('open')).filter((issue) => !issue.pull);
    const histories = await tracker.timelines(issues);
    return issues.map((issue) => ({ issue, data: issueData(issue, histories.get(issue.key) ?? []) }));
  }

  const dirty = (path: string) => isDirty(path, checkout, signal);

  async function landing(n: IssueKey): Promise<boolean> {
    return (await lockHolder(checkout, landLock(n))) !== '';
  }

  async function lanes(n?: IssueKey): Promise<string[]> {
    const parent = laneFolder(checkout);
    return (await readdir(parent).catch(() => []))
      .filter((name) => (n === undefined ? folderKey(name) !== null : name.startsWith(folderPrefix(n))))
      .sort()
      .map((name) => join(parent, name));
  }

  async function dirtyLane(n: IssueKey, keeps?: Keeps): Promise<string | null> {
    for (const path of await lanes(n)) if ((await dirty(path)) && !(await keeps?.(path))) return path;
    return null;
  }

  async function observe(n: IssueKey, mainDirty: boolean, keeps?: Keeps): Promise<Observed | null> {
    if (mainDirty) return { kind: 'observed', reason: 'dirty', path: checkout };
    const path = await dirtyLane(n, keeps);
    if (path !== null) return { kind: 'observed', reason: 'dirty', path };
    return (await landing(n)) ? { kind: 'observed', reason: 'landing' } : null;
  }

  async function settle<T>(missing: T, work: () => Promise<T>): Promise<{ value: T; stderr: string }> {
    try {
      const value = await work();
      signal?.throwIfAborted();
      return { value, stderr: tracker.stderr() };
    } catch (error) {
      if (signal?.aborted) return { value: missing, stderr: tracker.stderr() };
      throw error;
    }
  }

  return { checkout, tracker, codeHost, openIssues, dirty, lanes, observe, settle };
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
  n: IssueKey,
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
      const { data } = await read.tracker.read(n);
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
): Promise<{ rows: readonly { number: IssueKey; next: Next }[] | null; stderr: string }> {
  const read = reader(operation, signal);
  const { value, stderr } = await read.settle<{ number: IssueKey; next: Next }[] | null>(null, async () => {
    let issues: Fetched[];
    try {
      issues = await read.openIssues();
    } catch {
      return null;
    }
    const mainDirty = await read.dirty(read.checkout);
    const rows: { number: IssueKey; next: Next }[] = [];
    for (const { issue, data } of issues.sort((a, b) => compareKeys(a.issue.key, b.issue.key)))
      rows.push({
        number: issue.key,
        next: (await read.observe(issue.key, mainDirty)) ?? decide(data),
      });
    return rows;
  });
  return { rows: value, stderr };
}

const asEpic = ({ key, title }: Issue): ParentEpic => ({ number: key, title });

async function parentEpics(tracker: Tracker, open: readonly Fetched[]): Promise<ReadonlyMap<IssueKey, ParentEpic>> {
  const epics = new Map<IssueKey, ParentEpic>();
  const read = new Set<IssueKey>();
  for (const { issue } of open) {
    const n = issue.parent;
    if (n === null || read.has(n)) continue;
    read.add(n);
    let parent: Issue;
    try {
      parent = await tracker.issue(n);
    } catch (error) {
      if (error instanceof TrackerError && error.notFound) continue;
      throw error;
    }
    if (!parent.pull && parent.state === 'open' && parent.labels.includes('epic') && parent.key === n)
      epics.set(parent.key, asEpic(parent));
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
  const { line, row: shown } = describe(issue.key, next);
  if (shown === null || shown.state === 'done') return null;
  const found = laneOf(issue.labels);
  const type = found.kind === 'lane' ? found.lane : null;
  const step = next.kind === 'run' ? next.step : null;
  const path = dirtyLanes.find((lane) => basename(lane).startsWith(folderPrefix(issue.key)));
  return {
    line,
    row: {
      number: issue.key,
      title: issue.title,
      url: issue.url,
      type,
      updatedAt: issue.updatedAt,
      reason: shown.reason,
      act: shown.act,
      effort: next.kind === 'run' ? startPair(decisionOf(data, next), config?.sessions?.[next.step]) : null,
      epic,
      pr: prs.find(({ branch }) => holdsKey(branch, issue.key))?.pull ?? null,
      ...(path === undefined ? {} : { path }),
      state: path === undefined ? shown.state : 'dirty',
      step,
      started: step !== null && stageOf(step) > 1,
      urgent: type === 'hotfix',
    },
  };
}

async function boardRow(operation: Operation, { row, line }: Shown, aside: ReadonlySet<IssueKey>): Promise<IssueRow> {
  if (await lockHolder(operation.checkout.main as string, issueLock(row.number))) return { ...row, state: 'starting' };
  const act = `celetis --agent <host> run resume ${row.number}`;
  if (aside.has(row.number)) return { ...row, state: 'aside', act };
  if (row.state === 'dirty' || !(await isRecorded(operation.checkout.common as string, row.number, line))) return row;
  return { ...row, state: 'stuck', act };
}

export async function nextBoard(
  operation: Operation,
  signal: AbortSignal,
  targets?: readonly IssueKey[],
): Promise<{ data: { rows: readonly IssueRow[]; closed: boolean } | null; stderr: string }> {
  const read = reader(operation, signal);
  const { value, stderr } = await read.settle<{ rows: readonly Shown[]; closed: boolean } | null>(null, async () => {
    try {
      const selected = targets === undefined ? null : new Set(targets);
      const open: Fetched[] = [];
      let closed = false;
      if (selected === null) open.push(...(await read.openIssues()));
      else {
        for (const key of selected) {
          let fetched: Fetched;
          try {
            fetched = await read.tracker.read(key);
          } catch (error) {
            if (error instanceof TrackerError && error.missing === key) continue;
            throw error;
          }
          if (fetched.issue.pull) continue;
          if (fetched.issue.state === 'closed') closed = true;
          else open.push(fetched);
        }
      }
      const pulls = (await read.codeHost.pulls({ state: 'open' })).filter((pr) =>
        selected === null ? holdsAnyKey(pr.head.ref) : [...selected].some((key) => holdsKey(pr.head.ref, key)),
      );
      const details = await read.codeHost.pullDetails(pulls);
      const prs = pulls.map((pr) => branchPull(pr, details.get(pr.number)));
      const dirtyLanes: string[] = [];
      const paths =
        selected === null
          ? await read.lanes()
          : (await Promise.all([...selected].map((key) => read.lanes(key)))).flat();
      for (const path of paths) if (await read.dirty(path)) dirtyLanes.push(path);
      const epics =
        selected === null
          ? new Map(open.filter((f) => f.issue.labels.includes('epic')).map((f) => [f.issue.key, asEpic(f.issue)]))
          : await parentEpics(read.tracker, open);
      const rows: Shown[] = [];
      for (const fetched of open.sort((a, b) => compareKeys(a.issue.key, b.issue.key))) {
        const { parent } = fetched.issue;
        const epic = parent === null ? null : (epics.get(parent) ?? null);
        const row = shownRow(fetched, prs, dirtyLanes, epic, operation.mainConfig);
        if (row !== null) rows.push(row);
      }
      return { rows, closed };
    } catch {
      return null;
    }
  });
  if (value === null) return { data: null, stderr };
  const aside = await readSetAside(operation.checkout.common as string);
  const rows: IssueRow[] = [];
  for (const shown of value.rows) rows.push(await boardRow(operation, shown, aside));
  return { data: { ...value, rows }, stderr };
}
