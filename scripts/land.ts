import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { join } from 'node:path';
import { type Config, ConfigError, readConfig } from './lib/config.ts';
import { commonDir, HostError, mainCheckout } from './lib/host.ts';
import { run } from './lib/process.ts';
import { checkoutOf, removeLane } from './lib/worktree.ts';

type Pull = {
  number: number;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  merged_at: string | null;
};
type Check = {
  status: string;
  conclusion: string | null;
  app: { slug: string };
  check_suite: { id: number };
  name: string;
  details_url: string;
};
type Status = { state: string };
type Workflow = { id: number; check_suite_id: number; run_attempt: number; status: string };
type Request = {
  paginate?: boolean;
  silent?: boolean;
  quiet?: boolean;
  method?: string;
  fields?: Record<string, string>;
};
const usage =
  "usage: scripts/celetis land <issue number> '<type>(<area>): <what>', e.g. scripts/celetis land 415 'feat(agent-harness): the build step lands the change'";
const conventional = /^[a-z]+(\([^()]+\))?!?: [^ ]/;

export async function main(argv: string[]): Promise<number> {
  const n = argv[0]?.replace(/^#/, '') ?? '';
  const subject = argv[1] ?? '';
  if (
    argv.length !== 2 ||
    !/^[1-9][0-9]*$/.test(n) ||
    !conventional.test(subject) ||
    subject.includes('\n') ||
    subject.endsWith(`(#${n})`)
  ) {
    console.error(usage);
    return 2;
  }
  const cwd = process.cwd();
  let lock = '',
    branch = '',
    trunk = '',
    landed = false,
    signalStatus = 0;
  const abort = new AbortController();
  const handlers = new Map<NodeJS.Signals, () => void>();
  const die = (message: string): never => {
    throw new HostError(`land: ${message}`);
  };
  const interrupted = () => {
    if (signalStatus) throw new HostError('', signalStatus);
  };
  const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
  const emitError = (error: unknown) => {
    const text = errorText(error);
    if (text) process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
  };
  try {
    const common = await commonDir(cwd);
    const main = await mainCheckout(cwd);
    let config: Config;
    try {
      config = readConfig(main);
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error;
      throw new HostError(`celetis: ${main}/.celetis.yaml: ${error.field}: ${error.message}`, 2);
    }
    for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
      const handler = () => {
        signalStatus = 128 + constants.signals[signal];
        abort.abort();
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    lock = join(common, 'celetis-flow', `land-${n}.lock`);
    await mkdir(join(common, 'celetis-flow'), { recursive: true });
    await writeFile(lock, `${process.pid}\n`);
    const gitRaw = async (args: string[], at = cwd) => {
      interrupted();
      return run('git', args, { cwd: at, signal: abort.signal });
    };
    const git = async (args: string[], message?: string, at = cwd) => {
      const result = await gitRaw(args, at);
      if (result.code !== 0) {
        if (message) {
          emitError(result.stderr);
          die(message);
        }
        throw new HostError(result.stderr.trimEnd(), result.code);
      }
      process.stderr.write(result.stderr);
      return result.stdout.trimEnd();
    };
    const api = async <T>(endpoint: string, options: Request = {}): Promise<T> => {
      interrupted();
      const result = await run(
        'gh',
        [
          'api',
          ...(options.paginate ? ['--paginate', '--slurp'] : []),
          ...(options.silent ? ['--silent'] : []),
          ...(options.method ? ['-X', options.method] : []),
          `repos/{owner}/{repo}${endpoint}`,
          ...Object.entries(options.fields ?? {}).flatMap(([name, value]) => ['-f', `${name}=${value}`]),
        ],
        { cwd, signal: abort.signal },
      );
      if (result.code !== 0) throw new HostError(`${result.stdout}${result.stderr}`.trimEnd(), result.code);
      if (!options.quiet) process.stderr.write(result.stderr);
      return options.silent ? (undefined as T) : (JSON.parse(result.stdout) as T);
    };
    const checkedApi = async <T>(endpoint: string, message: string, options?: Request): Promise<T> => {
      try {
        return await api<T>(endpoint, options);
      } catch (error) {
        emitError(error);
        return die(message);
      }
    };
    const list = async <T>(endpoint: string): Promise<T[]> =>
      (await api<T[][]>(endpoint, { paginate: true, quiet: true })).flat();
    const closeIssue = async (issue: string, body: string) => {
      await api(`/issues/${issue}/comments`, { silent: true, fields: { body } });
      await api(`/issues/${issue}`, {
        silent: true,
        method: 'PATCH',
        fields: { state: 'closed', state_reason: 'completed' },
      });
    };
    const repo = await checkedApi<{ default_branch: string }>('', 'cannot read the default branch from GitHub');
    if (typeof repo.default_branch !== 'string' || !repo.default_branch)
      die('cannot read the default branch from GitHub');
    trunk = repo.default_branch;
    branch = await git([
      'branch',
      '--list',
      '--format=%(refname:lstrip=2)',
      `feat/${n}-*`,
      `fix/${n}-*`,
      `hotfix/${n}-*`,
      `chore/${n}-*`,
    ]);
    if (!branch) die(`no lane branch matches #${n}; nothing to land`);
    if (branch.includes('\n')) die(`several branches match #${n}: ${branch.replaceAll('\n', ' ')}; keep one`);
    const checkout = await checkoutOf(branch, cwd, abort.signal);
    if (checkout === main) die(`switch the main checkout off ${branch} first`);
    if (checkout) {
      if ((await git(['rev-parse', '--show-toplevel'])) === checkout)
        die(`leave ${checkout} first: run scripts/celetis land from the main checkout`);
      if (await git(['status', '--porcelain'], undefined, checkout))
        die(`the lane worktree is dirty: ${checkout}; commit first`);
    }
    await git(['fetch', '-q', 'origin', trunk], `cannot fetch ${trunk} from origin`);
    const tip = await git(['rev-parse', `refs/heads/${branch}`]);
    if (!(await git(['rev-list', '-n', '1', `origin/${trunk}..${branch}`])))
      die(`${branch} has no commit that ${trunk} lacks; nothing to land`);
    const stale = `merge origin/${trunk} into ${branch}, run the verify gate of the project again, then land again`;

    const landMerge = async () => {
      const merge = await gitRaw(['merge-tree', '--write-tree', `origin/${trunk}`, branch]);
      const tree = merge.code === 0 ? merge.stdout.trimEnd() : '';
      let commit: string;
      if (tree === (await git(['rev-parse', `origin/${trunk}^{tree}`]))) {
        commit = await git(['log', '-n', '1', '--format=%H', '--fixed-strings', `--grep=(#${n})`, `origin/${trunk}`]);
      } else {
        if (await git(['status', '--porcelain'], undefined, main))
          die(`the main checkout is dirty: ${main}; commit or stash first`);
        if ((await git(['branch', '--show-current'], undefined, main)) !== trunk)
          die(`the main checkout is not on ${trunk}: ${main}`);
        if ((await git(['rev-parse', 'HEAD'], undefined, main)) !== (await git(['rev-parse', `origin/${trunk}`])))
          die(`the main checkout is not level with origin/${trunk}; run git pull, or push, there first`);
        const ancestor = await gitRaw(['merge-base', '--is-ancestor', `origin/${trunk}`, branch]);
        process.stderr.write(ancestor.stderr);
        if (ancestor.code !== 0) die(`${branch} does not contain the head of ${trunk}; ${stale}`);
        commit = await git(['commit-tree', `${branch}^{tree}`, '-p', `origin/${trunk}`, '-m', `${subject} (#${n})`]);
        await git(
          ['push', '-q', 'origin', `${commit}:refs/heads/${trunk}`],
          `cannot push ${trunk} to origin; ${trunk} is as it was`,
        );
        await git(
          ['merge', '-q', '--ff-only', commit],
          `the change is on origin/${trunk}, but the main checkout did not move; run git pull there, then run scripts/celetis land again`,
          main,
        );
      }
      try {
        const issue = await api<{ state: string }>(`/issues/${n}`);
        if (issue.state !== 'closed') await closeIssue(n, `Landed on ${trunk}${commit ? ` in ${commit}` : ''}.`);
      } catch (error) {
        emitError(error);
        die(`the change is on ${trunk}, but #${n} is open; run scripts/celetis land again`);
      }
    };

    const landPr = async () => {
      const merged = (
        await checkedApi<Pull[][]>(
          `/pulls?head={owner}:${encodeURIComponent(branch)}&state=closed&per_page=100`,
          `cannot list the PRs of ${branch} on GitHub`,
          { paginate: true },
        )
      ).flat();
      if (merged.some((pull) => pull.merged_at && pull.base.ref === trunk && pull.head.sha === tip)) return;
      if ((await gitRaw(['merge-tree', '--write-tree', `origin/${trunk}`, branch])).code !== 0)
        die(`${branch} conflicts with ${trunk}; ${stale}`);
      const open = (
        await checkedApi<Pull[][]>('/pulls?state=open&per_page=100', 'cannot list the open PRs on GitHub', {
          paginate: true,
        })
      ).flat();
      const lane = open.filter((pull) => new RegExp(`^(feat|fix|hotfix|chore)/${n}-`).test(pull.head.ref));
      for (const pull of lane) {
        if (pull.base.ref !== trunk)
          die(
            `PR #${pull.number} of #${n} has the base ${pull.base.ref}, not ${trunk}; change its base, or close it: ${pull.html_url}`,
          );
      }
      if (lane.length > 1)
        die(`several open PRs match #${n}: ${lane.map((pull) => pull.head.ref).join(' ')}; keep one`);
      let pull = lane[0];
      if (pull && pull.head.ref !== branch)
        die(`PR #${pull.number} of #${n} is on ${pull.head.ref}, not on ${branch}; keep one branch: ${pull.html_url}`);
      await git(['push', '-q', 'origin', branch], `cannot push ${branch} to origin`);
      if (!pull) {
        const created = await checkedApi<{ html_url: string }>('/pulls', `cannot open the PR of ${branch}`, {
          fields: { base: trunk, head: branch, title: `${subject} (#${n})`, body: `Closes #${n}` },
        });
        const number = created.html_url.split('/').at(-1) ?? '';
        if (!/^[0-9]+$/.test(number)) die(`cannot read the number of the new PR: ${created.html_url}`);
        pull = {
          number: Number(number),
          html_url: created.html_url,
          head: { ref: branch, sha: tip },
          base: { ref: trunk },
          merged_at: null,
        };
      }
      const pr = pull.number;
      const url = pull.html_url;
      let buckets = '';
      let reruns: number[] = [];
      let flaky: Check[] = [];
      const checks = async (quiet = false) =>
        (
          await api<{ check_runs: Check[] }[]>(`/commits/${tip}/check-runs?per_page=100`, { paginate: true, quiet })
        ).flatMap((page) => page.check_runs);
      const statuses = async (quiet = false) =>
        (await api<{ statuses: Status[] }[]>(`/commits/${tip}/status?per_page=100`, { paginate: true, quiet })).flatMap(
          (page) => page.statuses,
        );
      const notGreen = () => die(`PR #${pr} has a check that is not green (${buckets}): ${url}`);
      const rerunPick = async (): Promise<boolean> => {
        let red: Check[], status: Status[], runs: Workflow[];
        try {
          red = (await checks()).filter(
            (check) =>
              check.status === 'completed' &&
              ['failure', 'timed_out', 'action_required', 'cancelled'].includes(check.conclusion ?? ''),
          );
          status = (await statuses()).filter((item) => ['error', 'failure'].includes(item.state));
          runs = (
            await api<{ workflow_runs: Workflow[] }[]>(`/actions/runs?head_sha=${tip}&per_page=100`, { paginate: true })
          ).flatMap((page) => page.workflow_runs);
        } catch (error) {
          emitError(error);
          return notGreen();
        }
        if (!red.length || status.length) return notGreen();
        const ids = new Set<number>();
        let busy = false;
        for (const check of red) {
          if (check.app.slug !== 'github-actions' || !['failure', 'timed_out'].includes(check.conclusion ?? ''))
            return notGreen();
          const run = runs.find((run) => run.check_suite_id === check.check_suite.id && run.run_attempt === 1);
          if (!run) return notGreen();
          if (run.status !== 'completed') busy = true;
          ids.add(run.id);
        }
        if (busy) {
          buckets = 'the workflow run of a failed check is not done';
          return false;
        }
        reruns = [...ids];
        flaky = red;
        return true;
      };
      const green = async (): Promise<0 | 1 | 2> => {
        const head = await api<{ head: { sha: string } }>(`/pulls/${pr}`, { quiet: true }).catch(() => null);
        if (head?.head.sha !== tip) {
          buckets = `the PR does not show ${tip} yet`;
          return 1;
        }
        for (const id of reruns) {
          const run = await api<Workflow>(`/actions/runs/${id}`, { quiet: true }).catch(() => null);
          if (!run || run.run_attempt < 2 || run.status !== 'completed') {
            buckets = 'the re-run is not done';
            return 1;
          }
        }
        try {
          const values = (await checks(true)).map((check) =>
            check.status !== 'completed'
              ? 'pending'
              : check.conclusion === 'success'
                ? 'pass'
                : ['skipped', 'neutral'].includes(check.conclusion ?? '')
                  ? 'skipping'
                  : check.conclusion === 'cancelled'
                    ? 'cancel'
                    : ['failure', 'timed_out', 'action_required'].includes(check.conclusion ?? '')
                      ? 'fail'
                      : 'pending',
          );
          values.push(
            ...(await statuses(true)).map((status) =>
              status.state === 'success' ? 'pass' : ['error', 'failure'].includes(status.state) ? 'fail' : 'pending',
            ),
          );
          buckets = [...new Set(values)].sort().join(' ');
        } catch {
          buckets = '';
        }
        if (buckets === 'pass' || buckets === 'pass skipping') return 0;
        if (!buckets || buckets.includes('pending')) return 1;
        if (buckets === 'skipping') die(`no check ran on PR #${pr}: each check was skipped: ${url}`);
        if (reruns.length) die(`PR #${pr} has a check that is not green after the re-run (${buckets}): ${url}`);
        return (await rerunPick()) ? 2 : 1;
      };
      const waitGreen = async () => {
        for (let i = 0; i < 60; i++) {
          interrupted();
          const status = await green();
          if (status !== 1) return status;
          await new Promise<void>((resolve, reject) => {
            const done = () => {
              abort.signal.removeEventListener('abort', stop);
              resolve();
            };
            const timer = setTimeout(done, 15_000);
            const stop = () => {
              clearTimeout(timer);
              reject(new HostError('', signalStatus || 1));
            };
            abort.signal.addEventListener('abort', stop, { once: true });
            if (abort.signal.aborted) stop();
          });
        }
        return 1;
      };
      console.log(`Waiting up to 15 minutes for the checks of PR #${pr} at ${tip}`);
      let status = await waitGreen();
      if (status === 2) {
        for (const id of reruns)
          await checkedApi(
            `/actions/runs/${id}/rerun-failed-jobs`,
            `GitHub refused the re-run of the failed checks of PR #${pr}: ${url}`,
            { silent: true, method: 'POST' },
          );
        console.log(`Waiting up to 15 more minutes for the re-run of the failed checks of PR #${pr} at ${tip}`);
        status = await waitGreen();
      }
      if (status !== 0)
        die(
          `the checks of PR #${pr} did not finish in 15 minutes${reruns.length ? ' after the re-run' : ''} (${buckets || 'no check runs'}): ${url}`,
        );
      await checkedApi(`/pulls/${pr}/merge`, `cannot merge PR #${pr} at ${tip}; the PR stays open: ${url}`, {
        silent: true,
        method: 'PUT',
        fields: { merge_method: 'squash', sha: tip },
      });
      for (const check of flaky)
        console.log(
          `land: the check ${check.name} of PR #${pr} failed, then passed on its re-run; look for a flaky test: ${check.details_url}`,
        );
    };

    const pullMain = async () => {
      const fetch = await gitRaw(['fetch', '-q', 'origin', trunk]);
      const current = fetch.code === 0 ? await gitRaw(['branch', '--show-current'], main) : null;
      if (current) process.stderr.write(current.stderr);
      const merge =
        current?.code === 0 && current.stdout.trimEnd() === trunk
          ? await gitRaw(['merge', '-q', '--ff-only', `origin/${trunk}`], main)
          : null;
      if (merge?.code !== 0)
        console.log(`land: the main checkout did not move to origin/${trunk}; run git pull on ${trunk} there`);
    };
    const closeEpic = async () => {
      let parent: { number: number; state: string };
      try {
        parent = await api(`/issues/${n}/parent`, { quiet: true });
      } catch (error) {
        if (!errorText(error).includes('HTTP 404'))
          console.log(`land: cannot read the parent of #${n}; close its epic by hand: ${errorText(error)}`);
        return;
      }
      if (parent.state !== 'open') return;
      let siblings: { number: number; state: string }[];
      try {
        siblings = await list(`/issues/${parent.number}/sub_issues`);
      } catch (error) {
        console.log(
          `land: cannot read the sub-issues of #${parent.number}; close the epic by hand: ${errorText(error)}`,
        );
        return;
      }
      if (siblings.some((issue) => issue.state === 'open' && String(issue.number) !== n)) return;
      try {
        await closeIssue(String(parent.number), `Each sub-issue is closed: #${n} landed last.`);
      } catch (error) {
        emitError(error);
        console.log(`land: cannot close the epic #${parent.number}; close it by hand`);
      }
    };
    if (config.landing === 'merge') await landMerge();
    else await landPr();
    landed = true;
    console.log(`land: #${n} is on ${trunk}`);
    if (config.landing === 'pr') await pullMain();
    await closeEpic();
    interrupted();
    const deletion = await gitRaw(['push', '-q', 'origin', '--delete', branch]);
    if (deletion.code !== 0) {
      const left = await gitRaw(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
      process.stderr.write(left.stderr);
      if (left.code !== 0 || left.stdout.trimEnd()) {
        throw new HostError(`${deletion.stdout}${deletion.stderr}`.trimEnd());
      }
    }
    interrupted();
    await removeLane(n, branch, checkout, cwd, abort.signal);
    interrupted();
    console.log(`land: ${branch} and its worktree are gone`);
    return 0;
  } catch (error) {
    if (!signalStatus) emitError(error);
    if (landed) {
      console.error(
        `land: the change is on ${trunk}, but the removal of ${branch} stopped; run scripts/celetis land again`,
      );
      return 1;
    }
    return signalStatus || (error instanceof HostError ? error.code : 1);
  } finally {
    if (lock && (await readFile(lock, 'utf8').catch(() => '')).replace(/\n+$/, '') === String(process.pid))
      await rm(lock, { force: true });
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
