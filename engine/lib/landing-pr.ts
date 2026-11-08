import { HostError } from './host.ts';
import type { LandingContext, Mechanism } from './landing.ts';
import { writeRefreshHint } from './refresh-hints.ts';
import { branchPattern } from './workflow.ts';

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

export function prMechanism(context: LandingContext): Mechanism {
  const { n, subject, main, trunk, branch, tip, base, stale, signal } = context;
  const { git, gitRaw, api, checkedApi, die, interrupted, stopped, emitError, preflight } = context;
  const matches = (pull: Pull | null) =>
    pull?.head.sha === tip &&
    pull.head.ref === branch &&
    pull.base.ref === trunk &&
    pull.base.sha === base &&
    !pull.merged_at;
  let checked: number | undefined;
  return {
    async check() {
      if (checked === undefined) return;
      if (!matches(await api<Pull>(`/pulls/${checked}`)))
        die('repair', `the head or base of PR #${checked} changed; ${stale}`);
    },
    async land() {
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
      checked = pr;
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
