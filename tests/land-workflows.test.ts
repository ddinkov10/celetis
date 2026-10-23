import { expect, setDefaultTimeout } from 'bun:test';
import { createLandingTests } from './lib/land-fixture.ts';

setDefaultTimeout(25_000);
const landCase = createLandingTests();

for (const attempt of [1, 2]) {
  landCase(`workflow completion: active attempt ${attempt}`, 'pr', async (f) => {
    await f.ready('pass');
    await f.runsAt(attempt, 'runs', 'in_progress');
    await f.land();
    expect(await f.calls('/pulls/9/merge')).toHaveLength(0);
    expect(f.result.code).toBe(1);
    expect(await f.sleeps()).toEqual(Array(60).fill(15_000));
    expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
    expect(f.output()).toContain('(the workflow runs are not done)');
    await f.kept();
  });
}

for (const [attempt, status] of [
  [1, 'in_progress'],
  [2, 'in_progress'],
  [1, 'queued'],
  [1, 'requested'],
  [1, 'waiting'],
  [1, 'pending'],
] as const) {
  landCase(`workflow completion: completes attempt ${attempt} from ${status}`, 'pr', async (f) => {
    await f.ready('pass');
    await f.runsAt(attempt, 'runs', status);
    await f.runsAt(attempt, 'runs-2');
    await f.land();
    expect(await f.sleeps()).toEqual([15_000]);
    expect(await f.calls('/pulls/9/merge')).toHaveLength(1);
    expect(await f.mergeRequest()).toEqual({ pr: '9', merge_method: 'squash', sha: f.tip() });
    expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
    await f.landed();
  });
}

landCase('workflow completion: late failure at attempt 2', 'pr', async (f) => {
  await f.ready('fail pass');
  await f.checks('pass', 'checks-1');
  await f.runsAt(2, 'runs', 'in_progress');
  await f.runsAt(2, 'runs-2');
  await f.land();
  expect(await f.sleeps()).toEqual([15_000]);
  expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
  await f.refused('PR #9 has a check that is not green (fail pass)');
});

landCase('workflow completion: completed first', 'pr', async (f) => {
  await f.ready('pass');
  await f.land();
  const calls = await f.logs();
  const workflows = calls.findLastIndex((args) =>
    args.includes(`repos/{owner}/{repo}/actions/runs?head_sha=${f.tip()}&per_page=100`),
  );
  const checks = calls.findLastIndex((args) =>
    args.includes(`repos/{owner}/{repo}/commits/${f.tip()}/check-runs?per_page=100`),
  );
  expect(workflows).toBeGreaterThan(-1);
  expect(workflows).toBeLessThan(checks);
  expect(await f.sleeps()).toEqual([]);
  expect(await f.calls('/pulls/9/merge')).toHaveLength(1);
  expect(await f.mergeRequest()).toEqual({ pr: '9', merge_method: 'squash', sha: f.tip() });
  expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
  await f.landed();
});

landCase('workflow completion: later page', 'pr', async (f) => {
  await f.ready('pass');
  await f.put('pages');
  await f.json('runs', {
    workflow_runs: [
      { check_suite_id: 50, id: 5, run_attempt: 1, status: 'completed' },
      { check_suite_id: 51, id: 6, run_attempt: 1, status: 'in_progress' },
    ],
  });
  await f.json('runs-2', {
    workflow_runs: [
      { check_suite_id: 50, id: 5, run_attempt: 1, status: 'completed' },
      { check_suite_id: 51, id: 6, run_attempt: 1, status: 'completed' },
    ],
  });
  await f.land();
  expect(await f.sleeps()).toEqual([15_000]);
  expect(await f.calls('/pulls/9/merge')).toHaveLength(1);
  expect(await f.mergeRequest()).toEqual({ pr: '9', merge_method: 'squash', sha: f.tip() });
  expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
  await f.landed();
});

for (const producer of ['check', 'status']) {
  landCase(`workflow completion: external only ${producer}`, 'pr', async (f) => {
    await f.ready(producer === 'check' ? 'pass@other-ci' : '');
    await f.json('runs', { workflow_runs: [] });
    if (producer === 'status') await f.json('status', { statuses: [{ state: 'success' }] });
    await f.land();
    expect(await f.sleeps()).toEqual([]);
    expect(await f.calls('/pulls/9/merge')).toHaveLength(1);
    expect(await f.mergeRequest()).toEqual({ pr: '9', merge_method: 'squash', sha: f.tip() });
    expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
    await f.landed();
  });
}

landCase('workflow completion: unreadable', 'pr', async (f) => {
  await f.ready('pass');
  await f.put('fail-GET-runs');
  await f.land();
  expect(await f.sleeps()).toEqual(Array(60).fill(15_000));
  expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
  await f.refused('the checks of PR #9 did not finish in 15 minutes (cannot read the workflow runs)');
});

landCase('workflow completion: completed skipped', 'pr', async (f) => {
  await f.ready('pass skipping');
  await f.land();
  expect(await f.sleeps()).toEqual([]);
  expect(await f.calls('/pulls/9/merge')).toHaveLength(1);
  expect(await f.mergeRequest()).toEqual({ pr: '9', merge_method: 'squash', sha: f.tip() });
  expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
  await f.landed();
});

for (const condition of ['empty', 'unrelated']) {
  landCase(`workflow completion: missing Actions run ${condition}`, 'pr', async (f) => {
    await f.ready('pass');
    await f.json('runs', {
      workflow_runs: condition === 'empty' ? [] : [{ check_suite_id: 51, id: 6, run_attempt: 1, status: 'completed' }],
    });
    await f.land();
    expect(await f.calls('/pulls/9/merge')).toHaveLength(0);
    expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
    expect(await f.sleeps()).toEqual(Array(60).fill(15_000));
    await f.refused('the checks of PR #9 did not finish in 15 minutes (the workflow run of a check is not listed)');
  });
}
