import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts, type Operation } from './lib/operation.ts';
import { codexHome } from './lib/plugin-metadata.ts';
import { run as runProcess } from './lib/process.ts';

type Comment = { body: string };
type Issue = {
  number: number;
  title: string;
  state: string;
  html_url: string;
  labels: { name: string }[];
  body: string | null;
  comments: number | Comment[];
  updated_at: string;
  closed_at: string | null;
  pull_request?: unknown;
};
type Resolution = { line: string; state?: 'ready' | 'blocked' | 'done'; reason?: string; act?: string };
type Pull = {
  number: number;
  html_url: string;
  head: { ref: string; sha: string };
  draft: boolean;
  requested_reviewers: unknown[];
  requested_teams: unknown[];
};
type PullState = {
  headRefName: string;
  number: number;
  url: string;
  draft: boolean;
  checks: string | null;
  review: string | null;
};
const usage =
  'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step <issue number> | --open | --json, e.g. BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step 276';

function resolve(issue: Issue, n: string): Resolution {
  const labeled = (name: string) => issue.labels.some((label) => label.name === name);
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  const commented = (prefix: string) => comments.some((comment) => comment.body.startsWith(prefix));
  const blocked = (head: string, reason: string, act: string): Resolution => ({
    line: `stop #${n} ${head}. ${act}`,
    state: 'blocked',
    reason,
    act,
  });
  if (issue.state === 'closed')
    return labeled('wontfix')
      ? { line: `stop #${n} is closed as wontfix.` }
      : { line: `stop #${n} is finished.`, state: 'done' };
  if (labeled('needs-info'))
    return blocked('needs info', 'needs info', 'Answer the questions on the issue, then remove the label.');
  if (labeled('ready-for-human')) {
    const heading = comments.filter((comment) => comment.body.startsWith('## ')).at(-1)?.body ?? '';
    return blocked(
      'is ready-for-human',
      heading.startsWith('## Landing refused') ? 'landing refused' : 'ready for your step',
      'Do the human step (e.g. the hotfix ship checklist), then remove the label.',
    );
  }
  if (labeled('epic')) return { line: `stop #${n} is an epic. Each child runs its own flow.` };
  const step = !['bug', 'enhancement', 'hotfix', 'chore'].some(labeled)
    ? 'triage'
    : labeled('enhancement') && !(issue.body ?? '').startsWith('Spec:')
      ? 'feature'
      : labeled('bug') && !commented('## Root cause')
        ? 'bug'
        : labeled('chore')
          ? 'chore'
          : labeled('hotfix')
            ? 'hotfix'
            : !commented('## Plan')
              ? 'plan'
              : 'implement';
  return { line: `run /celetis:${step} #${n}`, state: 'ready' };
}

function request(args: string[]): { arg: string; n: string } | null {
  const arg = args[0] ?? '';
  const n = arg.replace(/^#/, '');
  return args.length === 1 && (arg === '--open' || arg === '--json' || /^\d+$/.test(n)) ? { arg, n } : null;
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    if (!request(args)) {
      console.error(usage);
      return 2;
    }
    const operation = createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
    const result = await resolveNext(args, operation);
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

export async function resolveNext(
  argv: string[],
  operation: Operation,
  signal?: AbortSignal,
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const input = request(argv);
  if (!input) return { code: 2, stdout, stderr: `${usage}\n` };
  const { arg, n } = input;
  const checkout = operation.checkout.main as string;
  const common = operation.checkout.common as string;
  const print = (value: string) => {
    stdout += `${value}\n`;
  };
  const run = async (file: string, args: string[]) => {
    signal?.throwIfAborted();
    const result = await runProcess(file, args, { cwd: checkout, signal });
    signal?.throwIfAborted();
    return result;
  };
  async function api<T>(endpoint: string, paginate = false): Promise<T> {
    const result = await run('gh', [
      'api',
      ...(paginate ? ['--paginate', '--slurp'] : []),
      `repos/{owner}/{repo}/${endpoint}`,
    ]);
    stderr += result.stderr;
    if (result.code !== 0) throw new Error('GitHub read failed');
    return JSON.parse(result.stdout) as T;
  }

  async function list<T>(endpoint: string): Promise<T[]> {
    return (await api<T[][]>(endpoint, true)).flat();
  }

  async function withComments(issue: Issue): Promise<Issue> {
    return {
      ...issue,
      comments: issue.comments === 0 ? [] : await list<Comment>(`issues/${issue.number}/comments?per_page=100`),
    };
  }

  async function openIssues(): Promise<Issue[]> {
    const issues = (await list<Issue>('issues?state=open&per_page=100')).filter((issue) => !issue.pull_request);
    const result: Issue[] = [];
    for (const issue of issues) result.push(await withComments(issue));
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
    const reviews = await list<{ user: { login: string }; state: string }>(`pulls/${pr.number}/reviews?per_page=100`);
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
  const dirtyLine = (path: string) => `stop the working tree is dirty: ${path}; commit or stash first`;
  const landingLine = (n: string) =>
    `stop the landing of #${n} runs; wait until /usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land' ends`;
  async function landing(common: string, n: string): Promise<boolean> {
    const pid = (await readFile(join(common, 'celetis-flow', `land-${n}.lock`), 'utf8').catch(() => '')).trimEnd();
    if (!/^\d+$/.test(pid)) return false;
    const result = await run('ps', ['-p', pid, '-o', 'command=']).catch(() => null);
    return result?.code === 0 && result.stdout.includes('land.ts');
  }
  async function lanes(main: string, n?: string): Promise<string[]> {
    const parent = join(main, '.claude', 'worktrees');
    return (await readdir(parent).catch(() => []))
      .filter((name) => (n === undefined ? /^[0-9].*-/.test(name) : name.startsWith(`${n}-`)))
      .sort()
      .map((name) => join(parent, name));
  }
  const execute = async (): Promise<number> => {
    if (arg === '--json') {
      try {
        const since = new Date(Date.now() - 1_209_600_000).toISOString().slice(0, 10);
        const open = await openIssues();
        const closed = (await list<Issue>(`issues?state=closed&since=${since}T00:00:00Z&per_page=100`)).filter(
          (issue) => !issue.pull_request && issue.closed_at !== null && issue.closed_at >= since,
        );
        const pulls = (await list<Pull>('pulls?state=open&per_page=100')).filter((pr) => /\/[0-9]+-/.test(pr.head.ref));
        const prs: PullState[] = [];
        for (const pr of pulls) prs.push(await pullState(pr));
        const unique = new Map<number, Issue>();
        for (const issue of [...open, ...closed]) if (!unique.has(issue.number)) unique.set(issue.number, issue);
        const issues = [...unique.values()].sort((a, b) => a.number - b.number);
        const dirtyLanes: string[] = [];
        for (const lane of await lanes(checkout)) if (await dirty(lane)) dirtyLanes.push(lane);
        const rows = issues.flatMap((issue) => {
          const result = resolve(issue, String(issue.number));
          if (!result.state) return [];
          const pr = prs.find((pr) => pr.headRefName.includes(`/${issue.number}-`));
          const path = dirtyLanes.find((path) => path.split('/').at(-1)?.startsWith(`${issue.number}-`));
          return [
            {
              number: issue.number,
              title: issue.title,
              url: issue.html_url,
              type: issue.labels.some((l) => l.name === 'bug')
                ? 'bug'
                : issue.labels.some((l) => l.name === 'enhancement')
                  ? 'feature'
                  : issue.labels.some((l) => l.name === 'chore')
                    ? 'chore'
                    : issue.labels.some((l) => l.name === 'hotfix')
                      ? 'hotfix'
                      : null,
              updatedAt: issue.updated_at,
              closedAt: issue.closed_at,
              line: result.line,
              state: result.state !== 'done' && path ? 'dirty' : result.state,
              reason: result.reason ?? null,
              act: result.act ?? null,
              pr: pr ? { number: pr.number, url: pr.url, draft: pr.draft, checks: pr.checks, review: pr.review } : null,
              ...(result.state !== 'done' && path ? { path } : {}),
            },
          ];
        });
        print(
          JSON.stringify(
            {
              noRun: (await dirty(checkout)) ? `The main checkout is dirty: ${checkout}. Commit or stash first.` : null,
              issues: rows,
            },
            null,
            2,
          ),
        );
        return 0;
      } catch {
        print('stop cannot read the issues from GitHub');
        return 1;
      }
    }
    if (arg === '--open') {
      let issues: Issue[];
      try {
        issues = await openIssues();
      } catch {
        print('stop cannot read the open issues from GitHub');
        return 1;
      }
      const all = (await dirty(checkout)) ? dirtyLine(checkout) : null;
      for (const issue of issues.sort((a, b) => a.number - b.number)) {
        const number = String(issue.number);
        let line = resolve(issue, number).line;
        if (await landing(common, number)) line = landingLine(number);
        for (const lane of await lanes(checkout, number))
          if (await dirty(lane)) {
            line = dirtyLine(lane);
            break;
          }
        print(`${number}\t${all ?? line}`);
      }
      return 0;
    }
    for (const path of [checkout, ...(await lanes(checkout, n))])
      if (await dirty(path)) {
        print(dirtyLine(path));
        return 0;
      }
    if (await landing(common, n)) {
      print(landingLine(n));
      return 0;
    }
    try {
      print(resolve(await withComments(await api<Issue>(`issues/${n}`)), n).line);
      return 0;
    } catch {
      print(`stop cannot read #${n} from GitHub`);
      return 1;
    }
  };
  try {
    signal?.throwIfAborted();
    const code = await execute();
    signal?.throwIfAborted();
    return { code, stdout, stderr };
  } catch (error) {
    if (signal?.aborted) return { code: 1, stdout: '', stderr };
    throw error;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
