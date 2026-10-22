import { expect, setDefaultTimeout } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLandingTests, subject } from './lib/land-fixture.ts';

setDefaultTimeout(25_000);
const landCase = createLandingTests();
const usage =
  "usage: scripts/celetis land <issue number> '<type>(<area>): <what>', e.g. scripts/celetis land 415 'feat(agent-harness): the build step lands the change'";
for (const args of [
  [],
  ['7'],
  ['abc', subject],
  ['0', subject],
  ['7', ''],
  ['7', 'the crash is gone'],
  ['7', 'fix(x): y (#7)'],
  ['7', 'fix(x): y\nmore'],
  ['7', subject, 'extra'],
])
  landCase(`usage_and_config: arguments ${JSON.stringify(args)}`, 'merge', async (f) => {
    await f.lane();
    const r = await f.land(args);
    expect(r).toEqual({ code: 2, stdout: '', stderr: `${usage}\n` });
    await f.kept();
    expect(await f.logs()).toEqual([]);
  });

for (const value of ['landing: rebase', '{}', 'not yaml: [', ''])
  landCase(`usage_and_config: config ${JSON.stringify(value)}`, 'merge', async (f) => {
    await f.lane();
    if (value) await writeFile(join(f.repo, '.celetis.yaml'), value);
    else await rm(join(f.repo, '.celetis.yaml'));
    const r = await f.land();
    expect(r.code, f.output()).toBe(2);
    expect(f.output()).toContain(`${f.repo}/.celetis.yaml:`);
    await f.kept();
    expect(await f.ref(f.branch(), true)).toBe(false);
    expect(await f.has(join(f.repo, '.git/celetis-flow'))).toBe(false);
    expect(await f.logs()).toEqual([]);
  });

for (const mode of ['merge'] as const) {
  landCase(`lane_refusals: ${mode} GitHub unavailable`, mode, async (f) => {
    await f.lane();
    await f.put('gh-fail');
    await f.land();
    await f.refused('cannot read the default branch from GitHub');
    expect(f.output()).toContain('HTTP 502');
    expect(f.output().split('HTTP 502')).toHaveLength(2);
  });
  for (const other of ['', 'fix/17-other', 'prototype/7-look'])
    landCase(`lane_refusals: ${mode} no matching lane ${other}`, mode, async (f) => {
      if (other) await f.lane(other);
      await f.land();
      await f.refused('no lane branch matches #7; nothing to land');
    });
  landCase(`lane_refusals: ${mode} two lanes`, mode, async (f) => {
    await f.lane();
    await f.git(['branch', '-q', 'feat/7-crash', 'master']);
    await f.land();
    await f.refused('several branches match #7: feat/7-crash fix/7-crash; keep one');
  });
  landCase(`lane_refusals: ${mode} inside lane`, mode, async (f) => {
    await f.lane();
    await f.land(undefined, f.wt());
    await f.refused(`leave ${f.wt()} first: run scripts/celetis land from the main checkout`);
  });
  landCase(`lane_refusals: ${mode} dirty lane`, mode, async (f) => {
    await f.lane();
    await writeFile(join(f.wt(), 'new.txt'), 'x');
    await f.land();
    await f.refused(`the lane worktree is dirty: ${f.wt()}; commit first`);
  });
  landCase(`lane_refusals: ${mode} no lane commit`, mode, async (f) => {
    await f.lane();
    await f.git(['reset', '-q', '--hard', 'origin/master'], f.wt());
    await f.land();
    await f.refused('fix/7-crash has no commit that master lacks; nothing to land');
  });
  landCase(`lane_refusals: ${mode} main on lane`, mode, async (f) => {
    await f.git(['checkout', '-q', '-b', 'fix/7-crash']);
    await f.git(['commit', '-q', '--allow-empty', '-m', 'work']);
    await f.land();
    await f.refused('switch the main checkout off fix/7-crash first');
  });
  landCase(`lane_refusals: ${mode} fetch error`, mode, async (f) => {
    await f.lane();
    await f.put('fetch-fail');
    await f.land();
    await f.refused('cannot fetch master from origin');
    expect(f.output()).toContain('fatal: cannot fetch fixture origin');
  });
}

for (const condition of ['dirty', 'off trunk', 'ahead', 'behind', 'stale', 'rejected push'])
  landCase(`merge_refusals: ${condition}`, 'merge', async (f) => {
    await f.lane();
    const messages: Record<string, string> = {
      dirty: `the main checkout is dirty: ${f.repo}; commit or stash first`,
      'off trunk': `the main checkout is not on master: ${f.repo}`,
      ahead: 'the main checkout is not level with origin/master',
      behind: 'the main checkout is not level with origin/master',
      stale:
        'fix/7-crash does not contain the head of master; merge origin/master into fix/7-crash, run the verify gate of the project again, then land again',
      'rejected push': 'cannot push master to origin; master is as it was',
    };
    if (condition === 'dirty') await writeFile(join(f.repo, 'new.txt'), 'dirty');
    if (condition === 'off trunk') await f.git(['checkout', '-q', '-b', 'side']);
    if (condition === 'ahead') await f.git(['commit', '-q', '--allow-empty', '-m', 'local']);
    if (condition === 'behind' || condition === 'stale') await f.upstream();
    if (condition === 'stale') await f.git(['pull', '-q', 'origin', 'master']);
    if (condition === 'rejected push') await f.rejectPush();
    await f.land();
    await f.refused(messages[condition] ?? '');
    if (condition === 'rejected push') {
      expect(await f.git(['status', '--porcelain'])).toBe('');
      const worktreeRemovedAfterFailedPush = !(await f.has(f.wt()));
      expect(worktreeRemovedAfterFailedPush).toBe(false);
    }
  });

landCase('merge_landing: exact squash commit, issue close, prototypes and live lock', 'merge', async (f) => {
  await f.lane('fix/7-crash', 'work', 'work.txt', true);
  const prototype = join(f.repo, '.claude/worktrees/prototype-7-look');
  await f.git(['worktree', 'add', '-q', '-b', 'prototype/7-look', prototype, 'master']);
  await f.git(['branch', '-q', 'prototype/70-near', 'master']);
  await f.git(['push', '-q', 'origin', 'prototype/7-look', 'prototype/70-near', 'fix/7-crash']);
  await f.land(['#7', 'fix(x): the crash is gone']);
  await f.landed();
  const commit = await f.originMaster();
  expect(await f.git(['rev-parse', `${commit}^`])).toBe(f.before().split(' ')[0] ?? '');
  expect(await f.git(['log', '-1', '--format=%s', commit])).toBe('fix(x): the crash is gone (#7)');
  expect(await f.git(['rev-parse', `${commit}^{tree}`])).toBe(await f.git(['rev-parse', `${f.tip()}^{tree}`]));
  expect(await f.git(['rev-parse', 'HEAD'])).toBe(commit);
  expect(await f.has(join(f.repo, 'work.txt'))).toBe(true);
  expect(await f.git(['status', '--porcelain'])).toBe('');
  expect(await f.read('closed')).toBe(`comment 7 Landed on master in ${commit}.\nclose 7 closed completed\n`);
  expect(await f.ref('prototype/7-look')).toBe(false);
  expect(await f.ref('prototype/7-look', true)).toBe(false);
  expect(await f.has(prototype)).toBe(false);
  expect(await f.ref('prototype/70-near')).toBe(true);
  expect(await f.ref('prototype/70-near', true)).toBe(true);
  expect(await f.calls('/(pulls|commits)')).toHaveLength(0);
  expect(await f.read('lock-seen')).toMatch(/^[0-9]+\n$/);
});

landCase('merge_landing: already closed issue', 'merge', async (f) => {
  await f.lane();
  await f.json('issue', { state: 'closed' });
  await f.land();
  await f.landed();
  expect(await f.has(join(f.state, 'closed'))).toBe(false);
});

landCase('merge_retries: failed issue close', 'merge', async (f) => {
  await f.lane();
  await f.put('close-fail-7');
  await f.land();
  expect(f.result.code).toBe(1);
  expect(await f.has(f.wt())).toBe(true);
  expect(f.output()).toContain('land: the change is on master, but #7 is open; run scripts/celetis land again');
  const commit = await f.originMaster();
  await rm(join(f.state, 'close-fail-7'));
  await f.land(['7', 'fix(x): another subject']);
  await f.landed();
  expect(await f.originMaster()).toBe(commit);
  expect(await f.read('closed')).toBe(`comment 7 Landed on master in ${commit}.\nclose 7 closed completed\n`);
});

landCase('merge_retries: dirty prototype removal stops before branch delete', 'merge', async (f) => {
  await f.lane();
  const prototype = join(f.repo, '.claude/worktrees/prototype-7-look');
  await f.git(['worktree', 'add', '-q', '-b', 'prototype/7-look', prototype, 'master']);
  await writeFile(join(prototype, 'scratch'), 'x');
  await f.land();
  await f.stopped();
  expect(await f.ref('prototype/7-look')).toBe(true);
  await rm(join(prototype, 'scratch'));
  await f.json('issue', { state: 'closed' });
  await f.land();
  await f.landed();
  expect(await f.calls('PATCH .*/issues/7(?: |$)')).toHaveLength(1);
});

landCase('merge_retries: deaf origin during delete', 'merge', async (f) => {
  await f.lane();
  await f.git(['push', '-q', 'origin', f.branch()]);
  await f.put('deaf');
  await f.land();
  await f.stopped();
  expect(f.output()).toContain('fatal: origin does not answer');
  expect(await f.ref(f.branch(), true)).toBe(true);
  await rm(join(f.state, 'deaf'));
  await f.json('issue', { state: 'closed' });
  await f.land();
  await f.landed();
});

landCase('merge_retries: main checkout cannot move after push', 'merge', async (f) => {
  await f.lane();
  await writeFile(join(f.repo, '.git/index.lock'), '');
  await f.land();
  expect(f.result.code).toBe(1);
  expect(await f.has(f.wt())).toBe(true);
  expect(await f.ref(f.branch())).toBe(true);
  expect(f.output()).toContain(
    'land: the change is on origin/master, but the main checkout did not move; run git pull there, then run scripts/celetis land again',
  );
  await f.noLock();
  const commit = await f.originMaster();
  await rm(join(f.repo, '.git/index.lock'));
  await f.git(['pull', '-q', 'origin', 'master']);
  await f.land(['7', 'fix(x): another subject']);
  await f.landed();
  expect(await f.originMaster()).toBe(commit);
});

for (const condition of [
  'last sub-issue',
  'open sibling',
  'closed epic',
  'no parent',
  'parent read fails',
  'epic close fails',
  'sub-issue read fails',
])
  landCase(`epics: ${condition}`, 'merge', async (f) => {
    await f.lane();
    if (!['no parent', 'parent read fails'].includes(condition))
      await f.json('parent', { number: 3, state: condition === 'closed epic' ? 'closed' : 'open' });
    if (condition === 'last sub-issue')
      await f.json('subs', [
        { number: 7, state: 'open' },
        { number: 8, state: 'closed' },
      ]);
    if (condition === 'open sibling')
      await f.json('subs', [
        { number: 7, state: 'closed' },
        { number: 8, state: 'open' },
      ]);
    if (condition === 'parent read fails') await f.put('parent-fail');
    if (condition === 'epic close fails') await f.put('close-fail-3');
    if (condition === 'sub-issue read fails') await f.put('fail-GET-sub_issues');
    await f.land();
    await f.landed();
    if (condition === 'last sub-issue')
      expect((await f.read('closed')).trimEnd().split('\n').slice(-2).join('\n')).toBe(
        'comment 3 Each sub-issue is closed: #7 landed last.\nclose 3 closed completed',
      );
    if (condition === 'open sibling') expect(await f.calls('issues/3(/comments)?(?: |$)')).toHaveLength(0);
    if (condition === 'closed epic') expect(await f.calls('sub_issues|issues/3(/comments)?(?: |$)')).toHaveLength(0);
    if (condition === 'no parent') {
      expect(await f.calls('sub_issues')).toHaveLength(0);
      expect(f.output()).not.toContain('parent');
    }
    if (condition === 'parent read fails')
      expect(f.output()).toContain('land: cannot read the parent of #7; close its epic by hand');
    if (condition === 'epic close fails')
      expect(f.output()).toContain('land: cannot close the epic #3; close it by hand');
    if (condition === 'sub-issue read fails')
      expect(f.output()).toContain('land: cannot read the sub-issues of #3; close the epic by hand');
  });
