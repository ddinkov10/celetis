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
export type Bucket = 'pass' | 'skipping' | 'fail' | 'cancel' | 'pending';
export type PullFilter = Readonly<{ state: 'open' }> | Readonly<{ head: string; state: 'closed' | 'all' }>;
export type NewPull = Readonly<{ base: string; head: string; title: string; body: string }>;

export type CodeHost = Readonly<{
  name: string;
  repository(): Promise<Repository>;
  pulls(filter: PullFilter): Promise<readonly Pull[]>;
  pull(n: number): Promise<Pull>;
  pullDetails(pulls: readonly Pull[]): Promise<ReadonlyMap<number, PullDetails>>;
  createPull(fields: NewPull): Promise<string>;
  mergePull(n: number, sha: string): Promise<void>;
  checkRuns(sha: string): Promise<readonly CheckRun[]>;
  statuses(sha: string): Promise<readonly CommitStatus[]>;
  workflowRuns(sha: string): Promise<readonly WorkflowRun[]>;
  workflowRun(id: number): Promise<WorkflowRun>;
  rerunFailedJobs(id: number): Promise<void>;
  stderr(): string;
}>;

export class CodeHostError extends Error {
  constructor(
    readonly text: string,
    readonly stderr: string | null,
    message: string,
  ) {
    super(message);
  }
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
