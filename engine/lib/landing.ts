import { join } from 'node:path';
import type { Config } from './config-core.ts';
import { completeEpic } from './epic.ts';
import { parseEpicRepository } from './epic-acceptance.ts';
import { HostError } from './host.ts';
import { LessonError } from './lesson-record.ts';
import { readLessons } from './lesson-store.ts';
import { lineOf } from './lines.ts';
import { createOperation, type HostSelection, locateCheckouts, type Operation } from './operation.ts';
import { codexHome } from './plugin-metadata.ts';
import { run, streamBun } from './process.ts';
import { writeRefreshHint } from './refresh-hints.ts';
import { github } from './tracker.ts';
import { branchGlobs, branchPattern, decide, landable } from './workflow.ts';
import { checkoutOf, removeLane } from './worktree.ts';

export type Landing = Readonly<{ number: number; subject: string; selection: HostSelection; from: string }>;
export type LandingEnd = Readonly<{ status: number; defect: Readonly<{ error: unknown }> | null }>;

type Pull = {
  number: number;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
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
const statuses = { usage: 2, prerequisite: 3, repair: 4, checks: 5, blocked: 6, cleanup: 7 } as const;
type Outcome = keyof typeof statuses;
class Classified extends HostError {}
const suiteOf = (config: Config | undefined) => (config?.landing === 'merge' ? config.suite : undefined);

export async function runLanding(landing: Landing, main: string, signal: AbortSignal): Promise<LandingEnd> {
  const n = String(landing.number);
  const subject = landing.subject;
  let branch = '',
    trunk = '',
    cleanup = '';
  const stopped = () => (signal.reason instanceof HostError ? signal.reason.code : 143);
  const die = (outcome: Outcome, message: string): never => {
    throw new Classified(`land: ${outcome}: ${message}`, statuses[outcome]);
  };
  const interrupted = () => {
    if (signal.aborted) throw new HostError('', stopped());
  };
  const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
  const emitError = (error: unknown) => {
    const text = errorText(error);
    if (text) process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
  };
  try {
    const operation = await createOperation(await locateCheckouts(main), landing.selection, 'main');
    const common = operation.checkout.common as string;
    const config = operation.mainConfig as Config;
    if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
    const gitRaw = async (args: string[], at = main) => {
      interrupted();
      return run('git', args, { cwd: at, signal });
    };
    const git = async (args: string[], refusal?: readonly [Outcome, string], at = main) => {
      const result = await gitRaw(args, at);
      if (result.code !== 0) {
        if (refusal) {
          emitError(result.stderr);
          die(...refusal);
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
        { cwd: main, signal },
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
        return die('blocked', message);
      }
    };
    const closeIssue = async (issue: string, body: string) => {
      const gh = github(main, signal);
      await gh.comment(issue, body);
      await gh.edit(issue, { state: 'closed', state_reason: 'completed' });
      process.stderr.write(gh.stderr());
    };
    const repo = await checkedApi<{ default_branch: string; html_url: unknown }>(
      '',
      'cannot read the default branch from GitHub',
    );
    if (typeof repo.default_branch !== 'string' || !repo.default_branch)
      die('blocked', 'cannot read the default branch from GitHub');
    trunk = repo.default_branch;
    branch = await git(['branch', '--list', '--format=%(refname:lstrip=2)', ...branchGlobs(n)]);
    if (!branch) die('usage', `no lane branch matches #${n}; nothing to land`);
    if (branch.includes('\n'))
      die('blocked', `several branches match #${n}: ${branch.replaceAll('\n', ' ')}; keep one`);
    const checkout = await checkoutOf(branch, main, signal);
    if (checkout === main) die('blocked', `switch the main checkout off ${branch} first`);
    if (checkout) {
      if (landing.from === checkout)
        die('usage', `leave ${checkout} first: run celetis --agent <host> land from the main checkout`);
      try {
        await readLessons(checkout, 'active');
      } catch (error) {
        if (!(error instanceof LessonError)) throw error;
        if (error.code === 2)
          die('repair', `the lessons of ${branch} do not validate: ${error.message}; repair them, then land again`);
        die('blocked', error.message);
      }
      if (await git(['status', '--porcelain'], undefined, checkout))
        die('usage', `the lane worktree is dirty: ${checkout}; commit first`);
    }
    await git(['fetch', '-q', 'origin', trunk], ['blocked', `cannot fetch ${trunk} from origin`]);
    const tip = await git(['rev-parse', `refs/heads/${branch}`]);
    const base = await git(['rev-parse', `origin/${trunk}`]);
    if (!(await git(['rev-list', '-n', '1', `origin/${trunk}..${branch}`])))
      die('usage', `${branch} has no commit that ${trunk} lacks; nothing to land`);
    const stale = `merge origin/${trunk} into ${branch}, run the verify gate of the project again, then land again`;
    let checkPull: (() => Promise<void>) | undefined;
    const preflight = async (): Promise<Operation> => {
      const fresh = await createOperation(await locateCheckouts(main), operation.selection, 'main');
      if (fresh.mainConfig?.landing !== config.landing || suiteOf(fresh.mainConfig) !== suiteOf(config))
        die('blocked', 'the landing mechanism changed; invoke landing again');
      if (fresh.checkout.main !== operation.checkout.main || fresh.checkout.common !== common)
        die('blocked', 'the checkout changed; invoke landing again');
      const gh = github(main, signal);
      const read = await gh.read(n).catch(() => null);
      process.stderr.write(gh.stderr());
      interrupted();
      const decision = read ? decide(read.data) : die('blocked', `cannot read #${n} from GitHub`);
      if (!landable(decision)) die('prerequisite', `#${n} is not ready to land: ${lineOf(n, decision)}`);
      await checkPull?.();
      if (
        (await checkedApi<{ default_branch: string }>('', 'cannot read the default branch from GitHub'))
          .default_branch !== trunk
      )
        die('blocked', `the default branch changed from ${trunk}; invoke landing again`);
      await git(['fetch', '-q', 'origin', trunk], ['blocked', `cannot fetch ${trunk} from origin`]);
      if ((await git(['rev-parse', `origin/${trunk}`])) !== base)
        die('repair', `the head of ${trunk} changed; ${stale}`);
      const current = await git(['branch', '--list', '--format=%(refname:lstrip=2)', ...branchGlobs(n)]);
      if (current !== branch || (await git(['rev-parse', `refs/heads/${branch}`])) !== tip)
        die('repair', `the lane branch or its tip changed; ${stale}`);
      if ((await checkoutOf(branch, main, signal)) !== checkout) die('repair', `the lane checkout changed; ${stale}`);
      if (checkout && (await git(['status', '--porcelain'], undefined, checkout)))
        die('usage', `the lane worktree is dirty: ${checkout}; commit first`);
      if (fresh.mainConfig?.landing === 'merge') {
        const [firstChange, ...otherChanges] = (await git(['status', '--porcelain'], undefined, main))
          .split('\n')
          .filter(Boolean);
        if (firstChange !== undefined)
          die(
            'blocked',
            `the main checkout has uncommitted changes, your work: ${main}: ${firstChange.slice(3)}${otherChanges.length ? ` and ${otherChanges.length} more` : ''}; commit or stash them there, then land again`,
          );
        const current = await git(['branch', '--show-current'], undefined, main);
        if (current !== trunk)
          die(
            'blocked',
            `the main checkout is on ${current || 'a detached HEAD'}, not on ${trunk}: ${main}; switch it to ${trunk} there, then land again`,
          );
        const head = await git(['rev-parse', 'HEAD'], undefined, main);
        if (head !== base) {
          const ancestry = await gitRaw(['merge-base', '--is-ancestor', 'HEAD', base], main);
          process.stderr.write(ancestry.stderr);
          if (ancestry.code === 0)
            await git(
              ['merge', '-q', '--ff-only', base],
              ['blocked', `cannot fast-forward the main checkout to origin/${trunk}: ${main}`],
              main,
            );
          else if (ancestry.code === 1) {
            const ahead = (await git(['log', '--format=%h %s', `${base}..HEAD`], undefined, main)).split('\n');
            die(
              'blocked',
              `the main checkout has ${ahead.length} commit(s) that origin/${trunk} does not have, your work: ${main}: ${ahead[0]}; push them, or move them to a branch there, then land again`,
            );
          } else throw new HostError(ancestry.stderr.trimEnd(), ancestry.code);
        }
        const ancestor = await gitRaw(['merge-base', '--is-ancestor', base, tip]);
        process.stderr.write(ancestor.stderr);
        if (ancestor.code !== 0) die('repair', `${branch} does not contain the head of ${trunk}; ${stale}`);
      }
      const currentPolicy = await createOperation(fresh.checkout, operation.selection, 'main');
      if (currentPolicy.mainConfig?.landing !== config.landing || suiteOf(currentPolicy.mainConfig) !== suiteOf(config))
        die('blocked', 'the landing mechanism changed; invoke landing again');
      return currentPolicy;
    };

    const landMerge = async (suite: string) => {
      const merge = await gitRaw(['merge-tree', '--write-tree', base, tip]);
      const tree = merge.code === 0 ? merge.stdout.trimEnd() : '';
      const open = `the change is on ${trunk}, but #${n} is open; run celetis --agent <host> land again`;
      let commit: string;
      if (tree === (await git(['rev-parse', `${base}^{tree}`]))) {
        cleanup = open;
        commit = await git(['log', '-n', '1', '--format=%H', '--fixed-strings', `--grep=(#${n})`, `origin/${trunk}`]);
      } else {
        await preflight();
        if (!checkout) die('repair', `the lane worktree of ${branch} is missing`);
        const status = await streamBun(join(checkout, suite), [], checkout, signal);
        interrupted();
        if (status !== 0) die('checks', `the suite ${suite} failed with status ${status} at ${tip}`);
        commit = await git(['commit-tree', `${tip}^{tree}`, '-p', base, '-m', `${subject} (#${n})`]);
        await preflight();
        await git(
          ['push', '-q', 'origin', `${commit}:refs/heads/${trunk}`],
          ['blocked', `cannot push ${trunk} to origin; ${trunk} is as it was`],
        );
        cleanup = `the change is on origin/${trunk}, but the main checkout did not move; run git pull there, then run celetis --agent <host> land again`;
        await git(['merge', '-q', '--ff-only', commit], undefined, main);
        cleanup = open;
      }
      const issue = await api<{ state: string }>(`/issues/${n}`);
      if (issue.state !== 'closed') await closeIssue(n, `Landed on ${trunk}${commit ? ` in ${commit}` : ''}.`);
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
      if ((await gitRaw(['merge-tree', '--write-tree', base, tip])).code !== 0)
        die('repair', `${branch} conflicts with ${trunk}; ${stale}`);
      const open = (
        await checkedApi<Pull[][]>('/pulls?state=open&per_page=100', 'cannot list the open PRs on GitHub', {
          paginate: true,
        })
      ).flat();
      const lane = open.filter((pull) => branchPattern(n).test(pull.head.ref));
      for (const pull of lane) {
        if (pull.base.ref !== trunk)
          die(
            'blocked',
            `PR #${pull.number} of #${n} has the base ${pull.base.ref}, not ${trunk}; change its base, or close it: ${pull.html_url}`,
          );
      }
      if (lane.length > 1)
        die('blocked', `several open PRs match #${n}: ${lane.map((pull) => pull.head.ref).join(' ')}; keep one`);
      let pull = lane[0];
      if (pull && pull.head.ref !== branch)
        die(
          'blocked',
          `PR #${pull.number} of #${n} is on ${pull.head.ref}, not on ${branch}; keep one branch: ${pull.html_url}`,
        );
      await preflight();
      await git(
        ['push', '-q', 'origin', `${tip}:refs/heads/${branch}`],
        ['blocked', `cannot push ${branch} to origin`],
      );
      if (!pull) {
        await preflight();
        const created = await checkedApi<{ html_url: string }>('/pulls', `cannot open the PR of ${branch}`, {
          fields: { base: trunk, head: branch, title: `${subject} (#${n})`, body: `Closes #${n}` },
        });
        await writeRefreshHint(main, Number(n));
        const number = created.html_url.split('/').at(-1) ?? '';
        if (!/^[0-9]+$/.test(number)) die('blocked', `cannot read the number of the new PR: ${created.html_url}`);
        pull = {
          number: Number(number),
          html_url: created.html_url,
          head: { ref: branch, sha: tip },
          base: { ref: trunk, sha: base },
          merged_at: null,
        };
      }
      const pr = pull.number;
      const url = pull.html_url;
      const matches = (pull: Pull | null) =>
        pull?.head.sha === tip &&
        pull.head.ref === branch &&
        pull.base.ref === trunk &&
        pull.base.sha === base &&
        !pull.merged_at;
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
      const workflows = async (quiet = false): Promise<Workflow[]> =>
        (
          await api<{ workflow_runs: Workflow[] }[]>(`/actions/runs?head_sha=${tip}&per_page=100`, {
            paginate: true,
            quiet,
          })
        ).flatMap((page) => page.workflow_runs);
      const notGreen = () => die('checks', `PR #${pr} has a check that is not green (${buckets}): ${url}`);
      const rerunPick = async (): Promise<boolean> => {
        let red: Check[], status: Status[], runs: Workflow[];
        try {
          red = (await checks()).filter(
            (check) =>
              check.status === 'completed' &&
              ['failure', 'timed_out', 'action_required', 'cancelled'].includes(check.conclusion ?? ''),
          );
          status = (await statuses()).filter((item) => ['error', 'failure'].includes(item.state));
          runs = await workflows();
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
        const head = await api<Pull>(`/pulls/${pr}`, { quiet: true }).catch(() => null);
        if (!matches(head)) {
          buckets = `the PR head or base does not match ${branch} at ${tip} on ${trunk}`;
          return 1;
        }
        for (const id of reruns) {
          const run = await api<Workflow>(`/actions/runs/${id}`, { quiet: true }).catch(() => null);
          if (!run || run.run_attempt < 2 || run.status !== 'completed') {
            buckets = 'the re-run is not done';
            return 1;
          }
        }
        const runs = await workflows(true).catch(() => null);
        let checkRuns: Check[] = [];
        try {
          checkRuns = await checks(true);
          const values = checkRuns.map((check) =>
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
        if (buckets === 'pass' || buckets === 'pass skipping') {
          if (!runs) buckets = 'cannot read the workflow runs';
          else if (
            checkRuns.some(
              (check) =>
                check.app.slug === 'github-actions' && !runs.some((run) => run.check_suite_id === check.check_suite.id),
            )
          )
            buckets = 'the workflow run of a check is not listed';
          else if (runs.some((run) => run.status !== 'completed')) buckets = 'the workflow runs are not done';
          else return 0;
          return 1;
        }
        if (!buckets || buckets.includes('pending')) return 1;
        if (buckets === 'skipping') die('blocked', `no check ran on PR #${pr}: each check was skipped: ${url}`);
        if (reruns.length)
          die('checks', `PR #${pr} has a check that is not green after the re-run (${buckets}): ${url}`);
        return (await rerunPick()) ? 2 : 1;
      };
      const waitGreen = async () => {
        for (let i = 0; i < 60; i++) {
          interrupted();
          const status = await green();
          if (status !== 1) return status;
          await new Promise<void>((resolve, reject) => {
            const done = () => {
              signal.removeEventListener('abort', stop);
              resolve();
            };
            const timer = setTimeout(done, 15_000);
            const stop = () => {
              clearTimeout(timer);
              reject(new HostError('', stopped()));
            };
            signal.addEventListener('abort', stop, { once: true });
            if (signal.aborted) stop();
          });
        }
        return 1;
      };
      console.log(`Waiting up to 15 minutes for the checks of PR #${pr} at ${tip}`);
      let status = await waitGreen();
      if (status === 2) {
        for (const id of reruns) {
          await preflight();
          await checkedApi(
            `/actions/runs/${id}/rerun-failed-jobs`,
            `GitHub refused the re-run of the failed checks of PR #${pr}: ${url}`,
            { silent: true, method: 'POST' },
          );
        }
        console.log(`Waiting up to 15 more minutes for the re-run of the failed checks of PR #${pr} at ${tip}`);
        status = await waitGreen();
      }
      if (status !== 0)
        die(
          'blocked',
          `the checks of PR #${pr} did not finish in 15 minutes${reruns.length ? ' after the re-run' : ''} (${buckets || 'no check runs'}): ${url}`,
        );
      await preflight();
      if ((await green()) !== 0) notGreen();
      checkPull = async () => {
        if (!matches(await api<Pull>(`/pulls/${pr}`))) die('repair', `the head or base of PR #${pr} changed; ${stale}`);
      };
      await preflight();
      await checkedApi(`/pulls/${pr}/merge`, `cannot merge PR #${pr} at ${tip}; the PR stays open: ${url}`, {
        silent: true,
        method: 'PUT',
        fields: { merge_method: 'squash', sha: tip },
      });
      await writeRefreshHint(main, Number(n));
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
    const completeParent = async () => {
      let parent: number;
      try {
        const result = await api<{ number: number; html_url: unknown } | null>(`/issues/${n}/parent`, { quiet: true });
        if (!result || !Number.isSafeInteger(result.number) || result.number < 1)
          throw new Error('the parent response has no valid issue number');
        parent = result.number;
        const suffix = `/issues/${parent}`;
        if (typeof result.html_url !== 'string' || !result.html_url.endsWith(suffix))
          throw new Error('the parent response has no canonical issue URL that matches its number');
        const repository = parseEpicRepository(result.html_url.slice(0, -suffix.length));
        if (repository !== parseEpicRepository(repo.html_url)) {
          console.log(
            `land: parent ${result.html_url} is in another repository; run /celetis:accept-epic #${parent} in that repository's main checkout`,
          );
          return;
        }
      } catch (error) {
        if (!errorText(error).includes('HTTP 404'))
          console.log(`land: warning: cannot read the parent of #${n}: ${errorText(error)}`);
        return;
      }
      try {
        const result = await completeEpic(main, common, String(parent), undefined, signal);
        if (result.kind === 'pending')
          console.log(`land: parent #${parent} remains open: ${result.reason}; run ${result.nextAction}`);
      } catch (error) {
        console.log(
          `land: warning: cannot complete parent #${parent}; run /celetis:accept-epic #${parent}: ${errorText(error)}`,
        );
      }
    };
    if (config.landing === 'merge') await landMerge(config.suite);
    else await landPr();
    cleanup = `the change is on ${trunk}, but the removal of ${branch} stopped; run celetis --agent <host> land again`;
    console.log(`land: #${n} is on ${trunk}`);
    if (config.landing === 'pr') await pullMain();
    await completeParent();
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
    await removeLane(n, branch, checkout, main, signal);
    interrupted();
    console.log(`land: ${branch} and its worktree are gone`);
    await writeRefreshHint(main, Number(n));
    return { status: 0, defect: null };
  } catch (error) {
    const defect = error instanceof HostError || signal.aborted ? null : { error };
    if (cleanup) {
      if (!signal.aborted) emitError(error);
      console.error(`land: cleanup: ${cleanup}`);
      return { status: statuses.cleanup, defect };
    }
    if (signal.aborted) return { status: stopped(), defect };
    if (error instanceof Classified || !(error instanceof HostError)) {
      emitError(error);
      return { status: error instanceof HostError ? error.code : 1, defect };
    }
    const outcome = error.code === 2 ? 'usage' : 'blocked';
    emitError(`land: ${outcome}: ${error.message}`);
    return { status: statuses[outcome], defect };
  }
}
