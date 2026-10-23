import { expect, setDefaultTimeout } from 'bun:test';
import { join } from 'node:path';
import { createLandingTests, type LandingFixture } from './lib/land-fixture.ts';

setDefaultTimeout(25_000);
const landCase = createLandingTests();
const old = '0000000000000000000000000000000000000000';
const url = 'https://github.com/o/r/pull/9';
const flaky = (i = 0, run = 5) =>
  `land: the check job ${i} of PR #9 failed, then passed on its re-run; look for a flaky test: https://github.com/o/r/actions/runs/${run}/job/${100 + i}`;
const oneRerun = async (f: LandingFixture) => {
  expect(await f.read('reruns')).toBe('5\n');
  const failedJobReruns = await f.calls('rerun-failed-jobs');
  expect(failedJobReruns).toHaveLength(1);
};
const noRerun = async (f: LandingFixture) => {
  expect(await f.has(join(f.state, 'reruns'))).toBe(false);
  expect(f.output()).not.toContain('more minutes');
};

for (const [states, message] of [
  ['fail pass', 'PR #9 has a check that is not green (fail pass)'],
  ['cancel pass', 'PR #9 has a check that is not green (cancel pass)'],
  ['skipping', 'no check ran on PR #9: each check was skipped'],
  ['neutral skipping', 'no check ran on PR #9: each check was skipped'],
  ['', 'the checks of PR #9 did not finish in 15 minutes (no check runs)'],
  ['pending pass', 'the checks of PR #9 did not finish in 15 minutes (pass pending)'],
])
  landCase(`checks_not_green/checks_none/checks_pending: ${states}`, 'pr', async (f) => {
    await f.ready(states);
    await f.land();
    await f.refused(message ?? '');
    expect(await f.ref(f.branch(), true)).toBe(true);
    if (states === '' || states === 'pending pass') {
      expect(await f.read('polls')).toBe('60');
      expect(await f.sleeps()).toEqual(Array(60).fill(15_000));
    }
  });

for (const state of ['failure', 'pending'])
  landCase(`status_pending/checks_not_green: ${state}`, 'pr', async (f) => {
    await f.ready();
    await f.json('status', { statuses: [{ state }] });
    await f.land();
    await f.refused(
      state === 'failure'
        ? 'PR #9 has a check that is not green (fail pass)'
        : 'the checks of PR #9 did not finish in 15 minutes (pass pending)',
    );
    if (state === 'pending') expect(await f.read('polls')).toBe('60');
  });

for (const call of ['check-runs', 'status'])
  landCase(`gh_call_fails: ${call}`, 'pr', async (f) => {
    await f.ready();
    await f.json('status', { statuses: [{ state: 'success' }] });
    await f.put(`fail-GET-${call}`);
    await f.land();
    await f.refused('the checks of PR #9 did not finish in 15 minutes (no check runs)');
  });

landCase('checks_wait: pending then green', 'pr', async (f) => {
  await f.ready('pending pass');
  await f.checks('pass', 'checks-3');
  await f.land();
  await f.landed();
  expect(await f.read('polls')).toBe('3');
  expect(await f.sleeps()).toEqual([15_000, 15_000]);
});

landCase('checks_wait: checks appear late', 'pr', async (f) => {
  await f.ready('');
  await f.checks('pass', 'checks-2');
  await f.land();
  await f.landed();
});

landCase('checks_wait: PR shows pushed head late', 'pr', async (f) => {
  await f.ready();
  await f.json('view', { head: { sha: old } });
  await f.json('view-3', { head: { sha: f.tip() } });
  await f.land();
  await f.landed();
  expect(await f.read('views')).toBe('3');
  expect(await f.read('polls')).toBe('1');
});

landCase('checks_wait: PR never shows pushed head', 'pr', async (f) => {
  await f.ready();
  await f.json('view', { head: { sha: old } });
  await f.land();
  await f.refused(`the checks of PR #9 did not finish in 15 minutes (the PR does not show ${f.tip()} yet)`);
  expect(await f.has(join(f.state, 'polls'))).toBe(false);
});

for (const state of ['fail', 'timeout'])
  landCase(`rerun_passes: ${state}`, 'pr', async (f) => {
    await f.ready(`${state} pass`);
    await f.checks('pass pass', 'checks-3');
    await f.runsAt();
    await f.land();
    await f.landed();
    await oneRerun(f);
    expect(await f.mergeRequest()).toEqual({ pr: '9', merge_method: 'squash', sha: f.tip() });
    expect(f.output()).toContain(
      `Waiting up to 15 more minutes for the re-run of the failed checks of PR #9 at ${f.tip()}`,
    );
    expect(f.output()).toContain(flaky());
    expect((await f.logs()).flatMap((a) => a.join(' ').match(/rerun-failed-jobs|\/pulls\/9\/merge/g) ?? [])).toEqual([
      'rerun-failed-jobs',
      '/pulls/9/merge',
    ]);
  });

landCase('rerun_two_in_one_run: one request for two jobs', 'pr', async (f) => {
  await f.ready('fail fail pass');
  await f.checks('pass pass pass', 'checks-3');
  await f.runsAt();
  await f.land();
  await f.landed();
  await oneRerun(f);
  expect(f.output()).toContain(flaky(0));
  expect(f.output()).toContain(flaky(1));
});

landCase('rerun_stale_first_poll: old attempt then incomplete new attempt', 'pr', async (f) => {
  await f.ready('fail pass');
  await f.checks('pass pass', 'checks-3');
  await f.runsAt();
  await f.json('run', { run_attempt: 1, status: 'completed' });
  await f.json('run-2', { run_attempt: 2, status: 'in_progress' });
  await f.json('run-3', { run_attempt: 2, status: 'completed' });
  await f.land();
  await f.landed();
  expect(await f.read('run-polls')).toBe('3');
  await oneRerun(f);
  expect(f.output()).not.toContain('not green');
});

landCase('rerun_fails_again: no third attempt', 'pr', async (f) => {
  await f.ready('fail pass');
  await f.runsAt();
  await f.land();
  await f.refused(`PR #9 has a check that is not green after the re-run (fail pass): ${url}`);
  await oneRerun(f);
});

for (const condition of [
  'attempt 2',
  'red status',
  'other app',
  'cancelled',
  'approval',
  'two runs one at attempt 2',
  'failed check gone',
  'runs unreadable',
])
  landCase(`rerun_refusals: ${condition}`, 'pr', async (f) => {
    const states =
      condition === 'other app'
        ? 'fail@other-ci pass'
        : condition === 'cancelled'
          ? 'cancel pass'
          : condition === 'approval'
            ? 'action pass'
            : condition === 'two runs one at attempt 2'
              ? 'fail fail'
              : 'fail pass';
    await f.ready(states);
    await f.runsAt(condition === 'attempt 2' ? 2 : 1);
    if (condition === 'red status') await f.json('status', { statuses: [{ state: 'failure' }] });
    if (condition === 'two runs one at attempt 2') {
      const c = JSON.parse(await f.read('checks.json'));
      c.check_runs[1].check_suite.id = 51;
      await f.json('checks', c);
      await f.json('runs', {
        workflow_runs: [
          { check_suite_id: 50, id: 5, run_attempt: 1, status: 'completed' },
          { check_suite_id: 51, id: 6, run_attempt: 2, status: 'completed' },
        ],
      });
    }
    if (condition === 'failed check gone') await f.checks('pass pass', 'checks-2');
    if (condition === 'runs unreadable') await f.put('fail-GET-runs');
    await f.land();
    await f.refused(
      `PR #9 has a check that is not green (${condition === 'cancelled' ? 'cancel pass' : condition === 'two runs one at attempt 2' ? 'fail' : 'fail pass'})`,
    );
    await noRerun(f);
    if (condition === 'attempt 2') {
      const alreadyAttempt2Reruns = await f.calls('rerun-failed-jobs');
      expect(alreadyAttempt2Reruns).toHaveLength(0);
    }
  });

landCase('rerun_run_not_done: failed workflow completes in first wait', 'pr', async (f) => {
  await f.ready('fail pass');
  await f.checks('pass pass', 'checks-5');
  await f.runsAt(1, 'runs', 'in_progress');
  await f.runsAt(1, 'runs-2');
  await f.land();
  await f.landed();
  await oneRerun(f);
  expect(
    (await f.logs()).flatMap((a) => a.join(' ').match(/head_sha=|rerun-failed-jobs|\/pulls\/9\/merge/g) ?? []),
  ).toEqual(['head_sha=', 'head_sha=', 'rerun-failed-jobs', '/pulls/9/merge']);
  expect(f.output()).toContain(flaky());
});

landCase('rerun_run_never_done: first wait stays within sixty polls', 'pr', async (f) => {
  await f.ready('fail pass');
  await f.runsAt(1, 'runs', 'in_progress');
  await f.land();
  await f.refused(
    `the checks of PR #9 did not finish in 15 minutes (the workflow run of a failed check is not done): ${url}`,
  );
  expect(await f.has(join(f.state, 'reruns'))).toBe(false);
  expect(await f.read('run-lists')).toBe('60');
});

landCase('rerun_two_runs: each workflow gets one request', 'pr', async (f) => {
  await f.ready('fail fail pass');
  const c = JSON.parse(await f.read('checks.json'));
  c.check_runs[1].check_suite.id = 51;
  c.check_runs[1].details_url = 'https://github.com/o/r/actions/runs/6/job/101';
  await f.json('checks', c);
  await f.checks('pass pass pass', 'checks-3');
  await f.json('runs', {
    workflow_runs: [
      { check_suite_id: 50, id: 5, run_attempt: 1, status: 'completed' },
      { check_suite_id: 51, id: 6, run_attempt: 1, status: 'completed' },
    ],
  });
  await f.land();
  await f.landed();
  expect(await f.read('reruns')).toBe('5\n6\n');
  expect(await f.calls('actions/runs/5(?: |$)')).toHaveLength(1);
  expect(await f.calls('actions/runs/6(?: |$)')).toHaveLength(1);
  expect(f.output()).toContain(flaky(0));
  expect(f.output()).toContain(flaky(1, 6));
});

landCase('rerun_merge_rejected: one refusal after rerun', 'pr', async (f) => {
  await f.ready('fail pass');
  await f.checks('pass pass', 'checks-3');
  await f.runsAt();
  await f.put('merge-fail', 'head branch was modified');
  await f.land();
  await f.refused(`cannot merge PR #9 at ${f.tip()}; the PR stays open`, 1);
});

landCase('rerun_github_refuses: original API error stays visible', 'pr', async (f) => {
  await f.ready('fail pass');
  await f.runsAt();
  await f.put('fail-POST-rerun-failed-jobs');
  await f.land();
  await f.refused(`GitHub refused the re-run of the failed checks of PR #9: ${url}`);
  expect(f.output()).toContain('HTTP 502');
  expect(f.output().split('HTTP 502')).toHaveLength(2);
});

landCase('rerun_wait_runs_out: one further fifteen minute wait', 'pr', async (f) => {
  await f.ready('fail pass');
  await f.checks('pass', 'checks-3');
  await f.runsAt();
  await f.json('run', { run_attempt: 2, status: 'in_progress' });
  await f.land();
  await f.refused(`the checks of PR #9 did not finish in 15 minutes after the re-run (the re-run is not done): ${url}`);
  expect(await f.read('run-polls')).toBe('60');
  await oneRerun(f);
  expect(f.output()).toContain(`Waiting up to 15 minutes for the checks of PR #9 at ${f.tip()}`);
  expect(f.output()).toContain(
    `Waiting up to 15 more minutes for the re-run of the failed checks of PR #9 at ${f.tip()}`,
  );
});

landCase('pagination: merged, open, checks, statuses and rerun pages retain every row', 'pr', async (f) => {
  await f.ready('fail fail pass');
  await f.put('pages');
  await f.runsAt();
  await f.checks('pass pass pass', 'checks-3');
  await f.prs('release/next', 12, 'fix/7-crash', 9);
  await f.land();
  await f.landed();
  await oneRerun(f);
  expect(f.output()).toContain(flaky(0));
  expect(f.output()).toContain(flaky(1));
});

for (const state of ['success', 'error'])
  landCase(`external status: ${state}`, 'pr', async (f) => {
    await f.ready('neutral');
    await f.json('status', { statuses: [{ state }] });
    await f.land();
    if (state === 'success') await f.landed();
    else {
      await f.refused('PR #9 has a check that is not green (fail skipping)');
      await noRerun(f);
    }
  });
