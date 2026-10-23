import { expect, setDefaultTimeout } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, isolatedArgs, root } from './lib/fixture.ts';
import { createLandingTests, registerLaneRefusals, subject } from './lib/land-fixture.ts';

setDefaultTimeout(25_000);
const landCase = createLandingTests();
const old = '0000000000000000000000000000000000000000';

registerLaneRefusals(landCase, 'pr');

landCase('pr_landing: exact request argv, verified SHA, real remote refs and epic closure', 'pr', async (f) => {
  await f.put('log-git');
  await f.lane('fix/7-crash', 'work', 'work.txt', true);
  await f.checks('pass');
  await f.json('parent', { number: 3, state: 'open' });
  await f.json('subs', [{ number: 7, state: 'open' }]);
  await f.land(['7', 'fix(x): the crash is gone']);
  await f.landed();
  expect(await f.calls('actions/runs\\?head_sha=')).toEqual([
    ['api', '--paginate', '--slurp', `repos/{owner}/{repo}/actions/runs?head_sha=${f.tip()}&per_page=100`],
  ]);
  expect(await f.calls('rerun-failed-jobs')).toHaveLength(0);
  expect(JSON.parse(await f.read('create-args'))).toEqual([
    'base=master',
    'head=fix/7-crash',
    'title=fix(x): the crash is gone (#7)',
    'body=Closes #7',
  ]);
  const mergeRequest = await f.mergeRequest();
  const verifiedHead = f.tip();
  expect(mergeRequest).toEqual({ pr: '9', merge_method: 'squash', sha: verifiedHead });
  expect(mergeRequest.sha).toBe(verifiedHead);
  expect(mergeRequest.merge_method).toBe('squash');
  expect(await f.calls(`commits/${verifiedHead}/check-runs\\?`)).toHaveLength(1);
  expect(await f.calls(`commits/${verifiedHead}/status\\?`)).toHaveLength(1);
  expect((await f.read('origin-at-merge')).split('\n')).toContain(`fix/7-crash ${verifiedHead}`);
  expect(await f.calls('/pulls/[0-9]+/merge')).toHaveLength(1);
  expect(await f.sleeps()).toEqual([]);
  expect(await f.read('closed')).toBe(
    'comment 3 Each sub-issue is closed: #7 landed last.\nclose 3 closed completed\n',
  );
  expect(await f.git(['rev-parse', 'master'])).toBe(await f.originMaster());
  expect(await f.originMaster()).not.toBe(f.before().split(' ')[0] ?? '');
  expect(await f.git(['status', '--porcelain'])).toBe('');
  expect(f.output()).not.toContain('did not move');
  if (process.env.LAND_TEST_EVIDENCE)
    await writeFile(
      process.env.LAND_TEST_EVIDENCE,
      JSON.stringify(
        {
          verifiedHead,
          mergeRequest,
          ghArgv: await f.logs(),
          gitArgv: await f.logs('git-calls'),
          originAtMerge: await f.read('origin-at-merge'),
          finalRefs: await f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes']),
        },
        null,
        2,
      ),
    );
});

landCase('pr_landing: main subfolder', 'pr', async (f) => {
  await f.lane();
  await f.checks('pass');
  const sub = join(f.repo, 'sub');
  await mkdir(sub);
  await f.land(undefined, sub);
  await f.landed();
});

for (const branch of ['feat/7-x', 'fix/7-x', 'hotfix/7-x', 'chore/7-x'])
  landCase(`pr_landing: existing ${branch}`, 'pr', async (f) => {
    await f.lane(branch);
    await f.prs('release/next', 12, branch, 9, 'fix/17-other', 10);
    await f.checks('pass skipping');
    await f.put('auto-delete', branch);
    await f.land();
    await f.landed();
    expect(await f.has(join(f.state, 'create-args'))).toBe(false);
    expect(await f.mergeRequest()).toEqual({ pr: '9', merge_method: 'squash', sha: f.tip() });
  });

landCase('pr_delete_and_stale: remote delete races GitHub deletion', 'pr', async (f) => {
  await f.ready();
  await f.put('delete-race');
  await f.land();
  await f.landed();
  const calls = await f.logs('git-calls');
  const i = calls.findIndex((a) => a[0] === 'push' && a.includes('--delete'));
  expect(i).toBeGreaterThan(-1);
  expect(calls.slice(0, i).some((a) => a[0] === 'ls-remote' && a.includes('refs/heads/fix/7-crash'))).toBe(false);
});

landCase('pr_delete_and_stale: rejected remote delete and retry', 'pr', async (f) => {
  await f.ready();
  await f.put('delete-fail');
  await f.land();
  await f.stopped();
  expect(f.output()).toContain('hook declined');
  expect(await f.ref(f.branch(), true)).toBe(true);
  await rm(join(f.state, 'delete-fail'));
  await f.merged();
  await f.land();
  await f.landed();
  expect(await f.calls('/pulls/[0-9]+/merge')).toHaveLength(1);
});

landCase('pr_delete_and_stale: release number does not select release PR', 'pr', async (f) => {
  await f.prs('release/next', 12);
  await f.checks('pass');
  await f.land(['12', subject]);
  await f.refused('no lane branch matches #12; nothing to land');
});

landCase('pr_delete_and_stale: branch behind trunk with no conflict', 'pr', async (f) => {
  await f.lane();
  await f.upstream();
  await f.checks('pass');
  await f.land();
  await f.landed();
});

for (const condition of [
  'two lane PRs',
  'another branch',
  'another base',
  'another base beside trunk',
  'conflict',
  'list fails',
  'rejected push',
  'create fails',
])
  landCase(`pr_refusals: ${condition}`, 'pr', async (f) => {
    await f.lane(
      'fix/7-crash',
      condition === 'conflict' ? 'mine' : 'work',
      condition === 'conflict' ? 'app.txt' : 'work.txt',
    );
    await f.checks('pass');
    const messages: Record<string, string> = {
      'two lane PRs': 'several open PRs match #7: fix/7-crash feat/7-crash; keep one',
      'another branch': 'PR #10 of #7 is on feat/7-other, not on fix/7-crash; keep one branch',
      'another base':
        'PR #10 of #7 has the base develop, not master; change its base, or close it: https://github.com/o/r/pull/10',
      'another base beside trunk': 'PR #10 of #7 has the base develop, not master',
      conflict:
        'fix/7-crash conflicts with master; merge origin/master into fix/7-crash, run the verify gate of the project again, then land again',
      'list fails': 'cannot list the PRs of fix/7-crash on GitHub',
      'rejected push': 'cannot push fix/7-crash to origin',
      'create fails': 'cannot open the PR of fix/7-crash',
    };
    if (condition === 'two lane PRs') await f.prs('fix/7-crash', 9, 'feat/7-crash', 10);
    if (condition === 'another branch') await f.prs('feat/7-other', 10);
    if (condition === 'another base') {
      await f.prs('fix/7-crash', 10);
      await f.onBase(10, 'develop');
    }
    if (condition === 'another base beside trunk') {
      await f.prs('fix/7-crash', 9, 'fix/7-crash', 10);
      await f.onBase(10, 'develop');
    }
    if (condition === 'conflict') await f.upstream('app.txt');
    if (condition === 'list fails') await f.put('fail-GET-pulls');
    if (condition === 'rejected push') await f.rejectPush();
    if (condition === 'create fails') await f.put('fail-POST-pulls');
    await f.land();
    await f.refused(messages[condition] ?? '');
    if (['two lane PRs', 'another base', 'another base beside trunk', 'conflict'].includes(condition))
      expect(await f.ref(f.branch(), true)).toBe(false);
    if (condition === 'another base') expect(await f.has(join(f.state, 'create-args'))).toBe(false);
    if (condition === 'conflict') expect(await f.calls('pulls\\?state=open')).toHaveLength(0);
  });

landCase('pr_merged: merge rejected keeps remote lane', 'pr', async (f) => {
  await f.ready();
  await f.put('merge-fail', 'head branch was modified');
  await f.land();
  await f.refused(`cannot merge PR #9 at ${f.tip()}; the PR stays open`, 1);
  expect(f.output()).toContain('head branch was modified');
  expect(await f.ref(f.branch(), true)).toBe(true);
});

for (const condition of [
  'local tip',
  'plus branch',
  'closed without merge',
  'other commit',
  'other base',
  'trunk ahead',
])
  landCase(`pr_merged: ${condition}`, 'pr', async (f) => {
    await f.lane(condition === 'plus branch' ? 'fix/7-c++' : 'fix/7-crash');
    await f.merged(
      condition === 'other commit' ? old : f.tip(),
      condition === 'other base' ? 'develop' : 'master',
      condition === 'closed without merge' ? null : undefined,
    );
    if (condition === 'trunk ahead') await f.upstream();
    if (['closed without merge', 'other commit', 'other base'].includes(condition)) await f.checks('pass');
    await f.land();
    await f.landed();
    if (['local tip', 'plus branch'].includes(condition)) expect(await f.calls('/(pulls|commits)')).toHaveLength(1);
    if (condition === 'local tip')
      expect(await f.calls('pulls\\?head=\\{owner\\}:fix%2F7-crash&state=closed&')).toHaveLength(1);
    if (['closed without merge', 'other commit', 'other base'].includes(condition))
      expect(await f.calls('/pulls/[0-9]+/merge')).toHaveLength(1);
    if (condition === 'other base') expect(await f.calls(' -f base=master ')).toHaveLength(1);
    if (condition === 'trunk ahead') {
      expect(await f.git(['rev-parse', 'master'])).toBe(await f.originMaster());
      expect(f.output()).not.toContain('did not move');
    }
  });

for (const condition of ['ahead', 'side', 'detached', 'local file'])
  landCase(`pr_main_checkout: ${condition}`, 'pr', async (f) => {
    await f.lane();
    await f.checks('pass');
    if (condition === 'ahead') await f.git(['commit', '-q', '--allow-empty', '-m', 'local']);
    if (condition === 'side') await f.git(['checkout', '-q', '-b', 'side']);
    if (condition === 'detached') await f.git(['checkout', '-q', '--detach']);
    if (condition === 'local file') await writeFile(join(f.repo, 'work.txt'), 'mine\n');
    const head = await f.git(['rev-parse', 'HEAD']);
    await f.land();
    await f.landed();
    expect(f.output()).toContain('land: the main checkout did not move to origin/master; run git pull on master there');
    expect(f.output().split('did not move')).toHaveLength(2);
    expect(await f.git(['rev-parse', 'HEAD'])).toBe(head);
    if (await f.has(join(f.repo, 'work.txt'))) expect(await readFile(join(f.repo, 'work.txt'), 'utf8')).toBe('mine\n');
  });

landCase('pr_main_checkout: untouched local change stays', 'pr', async (f) => {
  await f.lane();
  await f.checks('pass');
  await writeFile(join(f.repo, 'app.txt'), 'changed\n');
  await f.land();
  await f.landed();
  expect(await f.git(['rev-parse', 'master'])).toBe(await f.originMaster());
  expect(await readFile(join(f.repo, 'app.txt'), 'utf8')).toBe('changed\n');
  expect(f.output()).not.toContain('did not move');
});

for (const failure of ['remote-read-fail', 'remove-fail', 'branch-fail'])
  landCase(`cleanup errors: ${failure} stops before the remaining deletes`, 'pr', async (f) => {
    await f.ready();
    if (failure === 'remote-read-fail') await f.put('delete-fail');
    await f.put(failure);
    await f.land();
    if (failure === 'branch-fail') {
      expect(f.result.code).toBe(1);
      expect(await f.ref(f.branch())).toBe(true);
      expect(await f.has(f.wt())).toBe(false);
      expect(f.output()).toContain('the removal of fix/7-crash stopped');
      await f.noLock();
    } else await f.stopped();
    expect(f.output()).toContain(
      failure === 'remote-read-fail'
        ? 'fixture read failed'
        : failure === 'remove-fail'
          ? 'fixture worktree removal failed'
          : 'fixture branch deletion failed',
    );
  });

landCase('request arguments: quotes, Unicode, dollar signs and backticks stay literal', 'pr', async (f) => {
  await f.lane();
  await f.checks('pass');
  const text = 'fix(x): "quoted" \\ Unicode Ж $(touch injected) `touch injected`';
  await f.land(['7', text]);
  await f.landed();
  expect(JSON.parse(await f.read('create-args'))).toEqual([
    'base=master',
    'head=fix/7-crash',
    `title=${text} (#7)`,
    'body=Closes #7',
  ]);
  expect(await f.has(join(f.repo, 'injected'))).toBe(false);
});

for (const stage of ['GET repos/{owner}/{repo}', 'GET repos/{owner}/{repo}/issues/7/parent'])
  landCase(`lock lifetime: ${stage}`, 'pr', async (f) => {
    await f.ready();
    await f.put('hold-stage', stage);
    await f.put('hold');
    const child = f.start();
    await f.wait('held');
    const lock = join(f.repo, '.git/celetis-flow/land-7.lock');
    expect(await readFile(lock, 'utf8')).toBe(`${child.child.pid}\n`);
    const ps = await command('ps', ['-p', String(child.child.pid), '-o', 'command=']);
    expect(ps.code, ps.stderr).toBe(0);
    expect(ps.stdout).toContain('land.ts');
    const r = await command(process.execPath, [...isolatedArgs, join(root, 'scripts/next-step.ts'), '7'], {
      cwd: f.repo,
      env: f.env,
    });
    expect(r).toEqual({
      code: 0,
      stdout: 'stop the landing of #7 runs; wait until scripts/celetis land ends\n',
      stderr: '',
    });
    expect(await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks'])).toBe('');
    await rm(join(f.state, 'hold'));
    Object.assign(f.result, await child.done);
    await f.landed();
  });

for (const owner of ['different PID', 'PID with trailing space'])
  landCase(`lock cleanup: ${owner} is retained`, 'pr', async (f) => {
    await f.ready();
    await f.put('hold-stage', 'GET repos/{owner}/{repo}/issues/7/parent');
    await f.put('hold');
    const child = f.start();
    await f.wait('held');
    const lock = join(f.repo, '.git/celetis-flow/land-7.lock');
    const replacement = owner === 'different PID' ? '123456789\n' : `${child.child.pid} \n`;
    await writeFile(lock, replacement);
    await rm(join(f.state, 'hold'));
    Object.assign(f.result, await child.done);
    expect(f.result.code, f.output()).toBe(0);
    expect(await readFile(lock, 'utf8')).toBe(replacement);
  });

landCase('streams: ordinary success warnings stay and explicit quiet calls stay quiet', 'pr', async (f) => {
  await f.put('log-git');
  await f.lane();
  await f.checks('pass');
  await f.json('parent', { number: 3, state: 'closed' });
  await f.put('warnings');
  await f.land();
  await f.landed();
  expect(f.result.stderr.split('\n').filter((line) => line.startsWith('fixture: '))).toEqual([
    'fixture: gh warning GET repos/{owner}/{repo}',
    'fixture: git warning fetch -q origin master',
    'fixture: gh warning GET repos/{owner}/{repo}/pulls?head={owner}:fix%2F7-crash&state=closed&per_page=100',
    'fixture: gh warning GET repos/{owner}/{repo}/pulls?state=open&per_page=100',
    'fixture: git warning push -q origin fix/7-crash',
    'fixture: gh warning POST repos/{owner}/{repo}/pulls',
    'fixture: gh warning PUT repos/{owner}/{repo}/pulls/9/merge',
  ]);
});

for (const stage of ['lane', 'prototype'])
  landCase(`interrupted cleanup: SIGTERM during ${stage} removal stops later deletes`, 'pr', async (f) => {
    await f.ready();
    const prototype = join(f.repo, '.claude/worktrees/prototype-7-signal');
    if (stage === 'prototype') {
      await f.git(['worktree', 'add', '-q', '-b', 'prototype/7-signal', prototype, 'master']);
      await f.git(['push', '-q', 'origin', 'prototype/7-signal']);
    }
    await f.put('log-git');
    await f.put('hold-cleanup', stage === 'prototype' ? prototype : f.wt());
    const child = f.start();
    try {
      await f.wait('cleanup-held');
      expect(child.child.kill('SIGTERM')).toBe(true);
      await Bun.sleep(50);
    } finally {
      await f.put('cleanup-release');
      Object.assign(f.result, await child.done);
    }
    const calls = await f.logs('git-calls');
    expect(await f.ref(f.branch()), JSON.stringify(calls)).toBe(true);
    expect(calls.filter((args) => args[0] === 'branch' && args[1] === '-D')).toEqual([]);
    await f.stopped();
    expect(await f.ref(f.branch(), true)).toBe(false);
    if (stage === 'prototype') {
      expect(await f.has(prototype)).toBe(true);
      expect(await f.ref('prototype/7-signal')).toBe(true);
      expect(await f.ref('prototype/7-signal', true)).toBe(true);
    }
    await f.merged();
    await f.land();
    await f.landed();
    expect(await f.calls('/pulls/[0-9]+/merge')).toHaveLength(1);
    if (stage === 'prototype') {
      expect(await f.has(prototype)).toBe(false);
      expect(await f.ref('prototype/7-signal')).toBe(false);
      expect(await f.ref('prototype/7-signal', true)).toBe(false);
    }
  });
