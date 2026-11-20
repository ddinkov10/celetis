import { HostError } from '../command/errors.ts';
import { writeRefreshHint } from '../tracker/refresh-hints.ts';
import { bucket, type CheckRun, type Pull, runBucket, type WorkflowRun } from '../tracker/tracker.ts';
import { branchPattern, closesLine, keyedSubject } from '../workflow/workflow.ts';
import type { LandingContext, Mechanism } from './landing.ts';

export function prMechanism(context: LandingContext): Mechanism {
  const { n, subject, main, trunk, branch, tip, base, stale, signal } = context;
  const { git, gitRaw, tracked, checked, die, interrupted, stopped, emitError, preflight } = context;
  const matches = (pull: Pull | null) =>
    pull?.head.sha === tip &&
    pull.head.ref === branch &&
    pull.base.ref === trunk &&
    pull.base.sha === base &&
    !pull.mergedAt;
  let merging: number | undefined;
  return {
    async check() {
      if (merging === undefined) return;
      const pr = merging;
      if (!matches(await tracked((gh) => gh.pull(pr))))
        die('repair', `the head or base of PR #${pr} changed; ${stale}`);
    },
    async land() {
      const merged = await checked(
        (gh) => gh.pulls({ head: branch, state: 'closed' }),
        `cannot list the PRs of ${branch} on GitHub`,
      );
      if (merged.some((pull) => pull.mergedAt && pull.base.ref === trunk && pull.head.sha === tip)) return;
      if ((await gitRaw(['merge-tree', '--write-tree', base, tip])).code !== 0)
        die('repair', `${branch} conflicts with ${trunk}; ${stale}`);
      const open = await checked((gh) => gh.pulls({ state: 'open' }), 'cannot list the open PRs on GitHub');
      const lane = open.filter((pull) => branchPattern(n).test(pull.head.ref));
      for (const pull of lane) {
        if (pull.base.ref !== trunk)
          die(
            'blocked',
            `PR #${pull.number} of #${n} has the base ${pull.base.ref}, not ${trunk}; change its base, or close it: ${pull.url}`,
          );
      }
      if (lane.length > 1)
        die('blocked', `several open PRs match #${n}: ${lane.map((pull) => pull.head.ref).join(' ')}; keep one`);
      const pull = lane[0];
      if (pull && pull.head.ref !== branch)
        die(
          'blocked',
          `PR #${pull.number} of #${n} is on ${pull.head.ref}, not on ${branch}; keep one branch: ${pull.url}`,
        );
      await preflight();
      await git(
        ['push', '-q', 'origin', `${tip}:refs/heads/${branch}`],
        ['blocked', `cannot push ${branch} to origin`],
      );
      let pr: number;
      let url: string;
      if (pull) {
        pr = pull.number;
        url = pull.url;
      } else {
        await preflight();
        url = await checked(
          (gh) => gh.createPull({ base: trunk, head: branch, title: keyedSubject(subject, n), body: closesLine(n) }),
          `cannot open the PR of ${branch}`,
        );
        await writeRefreshHint(main, n);
        const number = url.split('/').at(-1) ?? '';
        if (!/^[0-9]+$/.test(number)) die('blocked', `cannot read the number of the new PR: ${url}`);
        pr = Number(number);
      }
      let buckets = '';
      let reruns: number[] = [];
      let flaky: CheckRun[] = [];
      const notGreen = () => die('checks', `PR #${pr} has a check that is not green (${buckets}): ${url}`);
      const rerunPick = async (): Promise<boolean> => {
        let red: CheckRun[], failed: boolean, runs: readonly WorkflowRun[];
        try {
          red = (await tracked((gh) => gh.checkRuns(tip))).filter((check) =>
            ['fail', 'cancel'].includes(bucket(check)),
          );
          failed = (await tracked((gh) => gh.statuses(tip))).some((status) => bucket(status) === 'fail');
          runs = await tracked((gh) => gh.workflowRuns(tip));
        } catch (error) {
          emitError(error);
          return notGreen();
        }
        if (!red.length || failed) return notGreen();
        const ids = new Set<number>();
        let busy = false;
        for (const check of red) {
          if (check.app !== 'github-actions' || !['failure', 'timed_out'].includes(check.conclusion ?? ''))
            return notGreen();
          const run = runs.find((run) => run.suite === check.suite && run.attempt === 1);
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
        const head = await tracked((gh) => gh.pull(pr), true).catch(() => null);
        if (!matches(head)) {
          buckets = `the PR head or base does not match ${branch} at ${tip} on ${trunk}`;
          return 1;
        }
        for (const id of reruns) {
          const run = await tracked((gh) => gh.workflowRun(id), true).catch(() => null);
          if (!run || run.attempt < 2 || run.status !== 'completed') {
            buckets = 'the re-run is not done';
            return 1;
          }
        }
        const runs = await tracked((gh) => gh.workflowRuns(tip), true).catch(() => null);
        let checkRuns: readonly CheckRun[] = [];
        let red: readonly WorkflowRun[] = [];
        try {
          checkRuns = await tracked((gh) => gh.checkRuns(tip), true);
          const added = (runs ?? []).map((run) => ({ run, value: runBucket(run, checkRuns) }));
          red = added.filter(({ value }) => value === 'fail' || value === 'cancel').map(({ run }) => run);
          const values = [
            ...checkRuns.map(bucket),
            ...(await tracked((gh) => gh.statuses(tip), true)).map(bucket),
            ...added.flatMap(({ value }) => value ?? []),
          ];
          buckets = [...new Set(values)].sort().join(' ');
        } catch {
          buckets = '';
        }
        if (buckets === 'pass' || buckets === 'pass skipping') {
          if (!runs) buckets = 'cannot read the workflow runs';
          else if (
            checkRuns.some((check) => check.app === 'github-actions' && !runs.some((run) => run.suite === check.suite))
          )
            buckets = 'the workflow run of a check is not listed';
          else if (runs.some((run) => run.status !== 'completed')) buckets = 'the workflow runs are not done';
          else return 0;
          return 1;
        }
        if (!buckets || buckets.includes('pending')) return 1;
        const [first] = red;
        if (first)
          die(
            'checks',
            `PR #${pr} has a workflow run that is not green (${red.map((run) => `${run.name}: ${run.conclusion}`).join(', ')}): ${first.url}`,
          );
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
          await checked(
            (gh) => gh.rerunFailedJobs(id),
            `GitHub refused the re-run of the failed checks of PR #${pr}: ${url}`,
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
      merging = pr;
      await preflight();
      await checked((gh) => gh.mergePull(pr, tip), `cannot merge PR #${pr} at ${tip}; the PR stays open: ${url}`);
      await writeRefreshHint(main, n);
      for (const check of flaky)
        console.log(
          `land: the check ${check.name} of PR #${pr} failed, then passed on its re-run; look for a flaky test: ${check.url}`,
        );
    },
    async after() {
      const fetch = await gitRaw(['fetch', '-q', 'origin', trunk]);
      const current = fetch.code === 0 ? await gitRaw(['branch', '--show-current'], main) : null;
      if (current) process.stderr.write(current.stderr);
      const merge =
        current?.code === 0 && current.stdout.trimEnd() === trunk
          ? await gitRaw(['merge', '-q', '--ff-only', `origin/${trunk}`], main)
          : null;
      if (merge?.code !== 0)
        console.log(`land: the main checkout did not move to origin/${trunk}; run git pull on ${trunk} there`);
    },
  };
}
