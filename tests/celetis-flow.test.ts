import { expect, setDefaultTimeout, test } from 'bun:test';
import { closeSync, openSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { check } from '../board/contract.ts';
import { tryFlock } from '../scripts/lib/update-lock.ts';
import { command, isolatedArgs, root } from './lib/fixture.ts';
import { type RunnerFixture, runnerCase, stepText, updateTestClock } from './lib/runner-fixture.ts';

setDefaultTimeout(25_000);
const usage =
  'usage: scripts/celetis celetis-flow [<issue number>...] | --board | --resume <issue number>, e.g. scripts/celetis celetis-flow 373 374; with no number, the automatic runner';
const bad = [
  ['abc'],
  ['0'],
  ['7x'],
  ['#'],
  ['7', 'abc'],
  ['-h'],
  ['--open'],
  ['--board', '7'],
  ['7', '--board'],
  ['--resume'],
  ['--resume', 'abc'],
  ['--resume', '7', '8'],
  ['7', '--resume'],
];
for (const args of bad)
  test.concurrent(
    `usage ${JSON.stringify(args)}`,
    runnerCase(async (f) => {
      const r = await f.run(args);
      expect(r.code).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toBe(`${usage}\n`);
      expect(await f.logs('gh-calls')).toEqual([]);
      expect(await f.logs('calls')).toEqual([]);
    }, true),
  );
for (const bad of ['missing', 'invalid'])
  test.concurrent(
    `config ${bad} stops before state and effects`,
    runnerCase(async (f) => {
      if (bad === 'missing') await rm(join(f.repo, '.celetis.yaml'));
      else await f.config('landing: invalid\n');
      const r = await f.run();
      expect(r.code).toBe(2);
      expect(r.stderr).toContain(join(f.repo, '.celetis.yaml'));
      expect(await stat(join(f.repo, '.git/celetis-flow')).catch(() => null)).toBeNull();
      expect(await Bun.file(join(f.repo, '.git/celetis-flow/no-progress')).exists()).toBe(false);
      expect(await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks'])).toBe('');
      expect(await f.logs('updates')).toEqual([]);
      expect(await f.logs('calls')).toEqual([]);
    }, true),
  );
async function issueText(
  _f: RunnerFixture,
  n: number,
  label: string,
  comments: string[] = [],
  state = 'open',
  body = 'Spec: fixture',
) {
  return JSON.stringify({
    number: n,
    title: `Issue ${n}`,
    html_url: `https://example.test/issues/${n}`,
    state,
    body,
    labels: label
      .split(',')
      .filter(Boolean)
      .map((name) => ({ name })),
    comments: comments.map((body) => ({ body })),
    updated_at: '2026-10-01T00:00:00Z',
    closed_at: state === 'closed' ? new Date().toISOString() : null,
  });
}
const rows = (f: RunnerFixture) => readFile(join(f.repo, '.git/celetis-flow/no-progress'), 'utf8').catch(() => '');
const lockNames = (f: RunnerFixture) => f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks']);
async function after(
  f: RunnerFixture,
  k: number,
  n: number,
  label: string,
  comments: string[] = [],
  state = 'open',
  body = 'Spec: fixture',
) {
  await f.put(
    `after-${k}`,
    JSON.stringify({ [`issue-${n}.json`]: await issueText(f, n, label, comments, state, body) }),
  );
}
async function waitOutput(r: ReturnType<RunnerFixture['start']>, text: string) {
  const until = performance.now() + 5000;
  while (!r.output().stdout.includes(text)) {
    if (performance.now() > until) throw new Error(`missing output ${text} ${JSON.stringify(r.output())}`);
    await Bun.sleep(10);
  }
}

test.concurrent(
  'chain starts the requested me step and each auto step despite nonzero exits after progress',
  runnerCase(async (f) => {
    await f.issue(7, 'bug');
    await f.put('exit', '1');
    await after(f, 1, 7, 'bug', ['## Root cause']);
    await after(f, 2, 7, 'bug', ['## Root cause', '## Plan']);
    await after(f, 3, 7, 'bug', ['## Root cause', '## Plan'], 'closed');
    const r = await f.run(['7']);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe(
      'celetis-flow: start: /celetis:bug #7\nceletis-flow: start: /celetis:plan #7\nceletis-flow: start: /celetis:implement #7\nceletis-flow: stop #7 is finished.\n',
    );
    const calls = await f.logs('calls');
    expect(calls.map((row) => (row.args as string[]).at(-1))).toEqual([
      '/celetis:bug #7',
      '/celetis:plan #7',
      '/celetis:implement #7',
    ]);
    expect(calls.map((row) => row.cwd)).toEqual([f.repo, f.repo, f.repo]);
    expect(await f.logs<string>('stdin')).toEqual(['terminal input', 'two', 'three']);
    expect(await f.logs('herdr-calls')).toEqual([]);
    expect(await lockNames(f)).toBe('');
    expect(await rows(f)).toBe('');
  }, true),
);
test.concurrent(
  'chain preserves number order and exactly one no-progress row per step',
  runnerCase(async (f) => {
    await f.issue(9);
    await f.issue(8);
    const r = await f.run(['9', '#8']);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe(
      'celetis-flow: start: /celetis:plan #9\nceletis-flow: no progress: /celetis:plan #9\nceletis-flow: start: /celetis:plan #8\nceletis-flow: no progress: /celetis:plan #8\n',
    );
    expect(await rows(f)).toBe('9\trun /celetis:plan #9\n8\trun /celetis:plan #8\n');
    expect((await f.run(['9'])).code).toBe(0);
    expect((await f.logs('calls')).length).toBe(3);
    expect(await rows(f)).toBe('9\trun /celetis:plan #9\n8\trun /celetis:plan #8\n');
  }, true),
);
for (const [kind, label, state, expected] of [
  ['epic', 'epic', 'open', 'is an epic. Each child runs its own flow.'],
  ['closed', 'bug', 'closed', 'is finished.'],
])
  test.concurrent(
    `chain stop ${kind}`,
    runnerCase(async (f) => {
      await f.issue(7, label, '', [], state);
      const r = await f.run();
      expect(r.stdout).toBe(`celetis-flow: stop #7 ${expected}\n`);
      expect(await f.logs('calls')).toEqual([]);
    }, true),
  );
test.concurrent(
  'chain GitHub failure after a session never writes no progress',
  runnerCase(async (f) => {
    await f.issue();
    await f.put('after-1', JSON.stringify({ 'gh-fail': '' }));
    const r = await f.run();
    expect(r.stdout).toBe('celetis-flow: start: /celetis:plan #7\nceletis-flow: stop cannot read #7 from GitHub\n');
    expect(await rows(f)).toBe('');
  }, true),
);
test.concurrent(
  'config is read again before the second session',
  runnerCase(async (f) => {
    await f.issue();
    await after(f, 1, 7, 'enhancement', ['## Plan']);
    await f.put('invalid-config', 'landing: invalid\n');
    const r = await f.run();
    expect(r.code).toBe(2);
    expect((await f.logs('calls')).length).toBe(1);
    expect(await f.logs('updates')).toEqual([]);
    expect(await lockNames(f)).toBe('');
  }, true),
);
for (const phase of ['marketplace', 'update', 'list'])
  test.concurrent(
    `update supervisor fixture ${phase} failure keeps command, exit, cause and stops the chain`,
    runnerCase(async (f) => {
      await f.issue();
      await f.put('update-fail-phase', phase);
      await updateTestClock(f);
      const r = await f.run([], { script: 'plugin-update' });
      expect(r.code).toBe(1);
      expect(r.stderr).toContain('exit 23');
      expect(r.stderr).toContain(`fixture: claude ${phase} update unavailable`);
      expect(r.stderr).toContain(
        phase === 'marketplace'
          ? 'claude plugin marketplace update celetis'
          : phase === 'update'
            ? 'claude plugin update celetis@celetis --scope user'
            : 'claude plugin list --json',
      );
      expect(await f.logs('calls')).toEqual([]);
      expect(await rows(f)).toBe('');
      expect(await lockNames(f)).toBe('');
      expect((await f.logs('updates')).length).toBe(['marketplace', 'update', 'list'].indexOf(phase) + 1);
    }, true),
  );
test.concurrent(
  'each session keeps the resolved instruction root without plugin calls',
  runnerCase(async (f) => {
    await f.issue();
    await after(f, 1, 7, 'enhancement', ['## Plan']);
    const moved = await f.write('moved plugin Ж  /step-prompt.md', stepText);
    const path = join(moved, '..');
    await f.put(
      'plugin-list',
      JSON.stringify([{ id: 'celetis@celetis', scope: 'user', enabled: true, installPath: path }]),
    );
    const r = await f.run();
    expect(r.code, r.stderr).toBe(0);
    expect(r.stderr).toBe('');
    expect(
      (await f.logs('order')).map((row) =>
        row.session ? `session ${(row.args as string[]).at(-1)}` : (row.args as string[]).join(' '),
      ),
    ).toEqual(['session /celetis:plan #7', 'session /celetis:implement #7']);
    for (const call of await f.logs('calls')) expect(call.args).toContain(join(f.plugin, 'step-prompt.md'));
  }, true),
);
for (const list of ['oops', '[]'])
  test.concurrent(
    `installed invalid lookup ${list} stops before host`,
    runnerCase(async (f) => {
      await f.issue();
      await f.put('plugin-list', list);
      const r = await f.run(['7'], { launcher: true });
      expect(r.code).toBe(1);
      expect(r.stderr.length).toBeGreaterThan(0);
      if (list === 'oops') {
        expect(r.stderr).toContain('invalid plugin list JSON');
        expect(r.stderr).toContain('oops');
      }
      expect(await f.logs('calls')).toEqual([]);
    }, true),
  );
test.concurrent(
  'specify refuses an incomplete installed package before starting a session',
  runnerCase(async (f) => {
    await f.issue(7, 'enhancement', 'An idea');
    await rm(join(f.plugin, 'step-prompt.md'));
    const r = await f.run();
    expect(await f.logs('calls')).toEqual([]);
    expect(r.stdout).toContain('#7: the plugin version of this runner was removed after an update');
    expect(await lockNames(f)).toBe('');
  }, true),
);
test.concurrent(
  'update supervisor fixture missing step text names the root and stops before host',
  runnerCase(async (f) => {
    await f.issue();
    const bare = join(f.dir, 'bare plugin');
    await mkdir(bare);
    await f.put(
      'plugin-list',
      JSON.stringify([{ id: 'celetis@celetis', scope: 'user', enabled: true, installPath: bare }]),
    );
    await updateTestClock(f);
    const r = await f.run([], { script: 'plugin-update' });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('step-prompt.md');
    expect(r.stderr).toContain(bare);
    expect(await f.logs('calls')).toEqual([]);
  }, true),
);
test.concurrent(
  'a later step uses its installed package when a new lookup would fail',
  runnerCase(async (f) => {
    await f.issue();
    await f.put(
      'after-1',
      JSON.stringify({ 'issue-7.json': await issueText(f, 7, 'enhancement', ['## Plan']), 'plugin-list': 'oops' }),
    );
    const r = await f.run();
    expect(r.code, r.stderr).toBe(0);
    expect((await f.logs('calls')).length).toBe(2);
    expect(await f.logs('updates')).toEqual([]);
    expect(await rows(f)).toBe('7\trun /celetis:implement #7\n');
  }, true),
);
for (const [label, body, next, gate] of [
  ['needs-triage', 'A typo', 'chore', 'chore'],
  ['enhancement', 'An idea', 'plan', 'plan'],
  ['needs-triage', 'An idea', 'feature', 'specify'],
])
  test.concurrent(
    `gates ${label} to ${next}`,
    runnerCase(async (f) => {
      await f.issue(7, label, body);
      if (next === 'chore') await after(f, 1, 7, 'chore', [], 'open', 'A typo');
      else if (next === 'feature') await after(f, 1, 7, 'enhancement', [], 'open', 'An idea');
      else await after(f, 1, 7, 'enhancement');
      const r = await f.run();
      expect(r.code, r.stderr).toBe(0);
      expect((await f.logs('calls'))[0]?.args).toContain(
        label === 'enhancement' ? '/celetis:feature #7' : '/celetis:triage #7',
      );
      expect(r.stdout).toContain(next === 'plan' ? 'start: /celetis:plan #7' : `the gate of ${gate} is me`);
    }, true),
  );
for (const where of ['lane', 'subfolder', 'outside'])
  test.concurrent(
    `checkout ${where} binds the main checkout`,
    runnerCase(async (f) => {
      await f.issue();
      let cwd = f.dir;
      if (where === 'lane') {
        cwd = join(f.repo, '.claude/worktrees/7-fixture');
        await f.git(['worktree', 'add', '-q', '-b', 'fix/7-fixture', cwd]);
        await writeFile(join(cwd, '.celetis.yaml'), 'host: codex\nlanding: pr\n');
        await f.git(['add', '.'], cwd);
        await f.git(['commit', '-qm', 'lane config'], cwd);
      }
      if (where === 'subfolder') {
        cwd = join(f.repo, 'sub');
        await mkdir(cwd);
      }
      const r = await f.run(['7'], { cwd });
      if (where === 'outside') {
        expect(r.code).not.toBe(0);
        expect(r.stdout).toBe('');
        expect(await f.logs('gh-calls')).toEqual([]);
        expect(await f.logs('calls')).toEqual([]);
      } else {
        expect(r.code, r.stderr).toBe(0);
        expect((await f.logs('calls'))[0]).toMatchObject({ cwd: f.repo });
      }
    }, true),
  );
test.concurrent(
  'checkout dirty main starts no session',
  runnerCase(async (f) => {
    await f.issue();
    await f.write('repo dir/new.txt', 'dirty');
    const r = await f.run();
    expect(r.stdout).toBe(`celetis-flow: stop the working tree is dirty: ${f.repo}; commit or stash first\n`);
    expect(await f.logs('calls')).toEqual([]);
  }, true),
);
test.serial(
  'auto selects ordered auto gates, reloads lists, records rows and keeps inherited stdin',
  runnerCase(async (f) => {
    await f.issue(4, 'bug', 'old', [], 'closed');
    await f.issue(5, 'bug', 'It breaks');
    await f.issue(6, 'epic', '');
    await f.issue(7);
    await f.issue(8);
    await after(f, 1, 7, 'enhancement', ['## Plan']);
    const r = f.start([]);
    await waitOutput(r, 'no auto step can start');
    r.child.kill('SIGTERM');
    const result = await r.result;
    expect(result.code).toBe(143);
    expect(result.stdout).toBe(
      'celetis-flow: start: /celetis:plan #7\nceletis-flow: start: /celetis:implement #7\nceletis-flow: no progress: /celetis:implement #7\nceletis-flow: start: /celetis:plan #8\nceletis-flow: no progress: /celetis:plan #8\nceletis-flow: no auto step can start; the runner asks again each 60 seconds\n',
    );
    expect(await f.logs<string>('stdin')).toEqual(['terminal input', 'two', 'three']);
    expect(
      (await f.logs<string[]>('gh-calls')).filter((args) =>
        args.some((arg) => arg.startsWith('repos/{owner}/{repo}/issues?state=open&')),
      ).length,
    ).toBe(3);
    expect((await f.logs<string[]>('locks')).at(-1)).toEqual([
      'refs/celetis-flow/locks/issue-8',
      'refs/celetis-flow/locks/runner',
    ]);
    expect(await rows(f)).toBe('7\trun /celetis:implement #7\n8\trun /celetis:plan #8\n');
    expect(await lockNames(f)).toBe('');
    const manual = await f.run(['7']);
    expect(manual.stdout).toContain('start: /celetis:implement #7');
    expect((await rows(f)).split('\n').filter(Boolean).length).toBe(2);
  }, true),
);
for (const fault of ['no-auto', 'gh-fail', 'view-fail', 'dirty'])
  test.concurrent(
    `auto waits after ${fault} without repeated output or sessions`,
    runnerCase(async (f) => {
      await f.issue(7, fault === 'no-auto' ? 'bug' : 'enhancement');
      if (fault === 'gh-fail') await f.put('gh-fail');
      if (fault === 'view-fail') await f.put('view-fail-7');
      if (fault === 'dirty') await f.write('repo dir/new', 'dirty');
      const r = f.start([]);
      await waitOutput(
        r,
        fault === 'gh-fail'
          ? 'stop cannot read the open issues'
          : fault === 'view-fail'
            ? 'stop cannot read #7'
            : 'no auto step can start',
      );
      await Bun.sleep(100);
      const output = r.output().stdout;
      r.child.kill('SIGTERM');
      const result = await r.result;
      expect(result.code).toBe(143);
      expect(result.stdout).toBe(output);
      expect(await f.logs('calls')).toEqual([]);
      expect(await rows(f)).toBe('');
      if (fault === 'gh-fail') expect(result.stderr).toContain('HTTP 502');
    }, true),
  );
test.concurrent(
  'main_gates ignores lane config and obsolete Git gates, and YAML enables the selected step',
  runnerCase(async (f) => {
    await f.config('landing: merge\n');
    await f.git(['add', '.']);
    await f.git(['commit', '-qm', 'gates']);
    await f.issue();
    await after(f, 1, 7, 'enhancement', ['## Plan']);
    for (const step of ['triage', 'specify', 'bug', 'chore', 'hotfix', 'plan', 'implement'])
      await f.git(['config', `celetis-flow.gate.${step}`, 'auto']);
    const r = await f.run();
    expect(r.stdout).toContain('the gate of implement is me');
    const lane = join(f.repo, '.claude/worktrees/7-fixture');
    await f.git(['worktree', 'add', '-q', '-b', 'fix/7-fixture', lane]);
    await writeFile(join(lane, '.celetis.yaml'), 'landing: pr\ngates:\n  plan: auto\n');
    await mkdir(join(f.repo, 'config-sub'));
    await mkdir(join(lane, 'config-sub'));
    for (const cwd of [f.repo, lane, join(f.repo, 'config-sub'), join(lane, 'config-sub')]) {
      const doc = JSON.parse((await f.run(['--board'], { cwd })).stdout);
      expect(Object.values(doc.flow.steps).map((row) => (row as { gate: string }).gate)).toEqual([
        'me',
        'me',
        'me',
        'me',
        'me',
        'me',
        'me',
      ]);
    }
  }, true),
);
async function boardIssues(f: RunnerFixture) {
  await f.issue(4, 'bug', 'old', [], 'closed');
  await f.issue(5, 'bug', 'It breaks');
  await f.issue(6, 'epic', '');
  await f.issue(7);
  await f.issue(8, 'needs-triage', 'A typo');
  await f.issue(9, 'enhancement', 'An idea');
  await f.issue(10, 'hotfix,needs-info', '');
  await f.issue(11, 'chore,ready-for-human', '', ['## Landing refused']);
  await f.issue(12, 'hotfix,ready-for-human', '', ['## Landing refused', '## Before landing']);
  await f.config(
    'landing: merge\ngates:\n  triage: auto\n  chore: auto\n  specify: auto\n  plan: me\n  implement: auto\n',
  );
  await f.git(['add', '.']);
  await f.git(['commit', '-qm', 'board']);
  await mkdir(join(f.repo, '.git/celetis-flow'), { recursive: true });
  await writeFile(join(f.repo, '.git/celetis-flow/no-progress'), '7\trun /celetis:plan #7\n');
}
test.concurrent(
  'board contract 1 keeps issue precedence, fields, flow, locks, lists and no mutation',
  runnerCase(async (f) => {
    await boardIssues(f);
    await f.put('hold-session');
    await f.put('skip-input');
    const r = f.start(['5']);
    await f.wait('started-1');
    const lane = join(f.repo, '.claude/worktrees/7-crash');
    await f.git(['worktree', 'add', '-q', '-b', 'fix/7-crash', lane]);
    await writeFile(join(lane, 'new.txt'), 'dirty');
    await f.put('gh-calls');
    const result = await f.run(['--board']);
    expect(result.code, result.stderr).toBe(0);
    const doc = JSON.parse(result.stdout);
    expect(check(doc)).toEqual([]);
    expect([
      doc.contract,
      doc.tracker,
      doc.noRun,
      doc.runner,
      doc.issues.map((i: { number: number }) => i.number),
    ]).toEqual([1, 'GitHub', null, false, [4, 5, 7, 8, 9, 10, 11, 12]]);
    const row = (n: number) => doc.issues.find((i: { number: number }) => i.number === n);
    expect(row(4)).toMatchObject({
      type: 'bug',
      state: 'done',
      step: null,
      title: 'Issue 4',
      url: 'https://example.test/issues/4',
    });
    const closedIssue = JSON.parse(await f.read('issue-4.json')) as { closed_at: string };
    expect(row(4).closedAt).toBe(closedIssue.closed_at);
    expect(row(5)).toMatchObject({ state: 'starting', step: 'bug' });
    expect(row(7)).toMatchObject({ type: 'feature', state: 'dirty', step: 'plan', path: lane, started: true });
    expect(row(8)).toMatchObject({ state: 'ready', step: 'triage', started: false, urgent: false });
    expect(row(9)).toMatchObject({ state: 'ready', step: 'specify' });
    expect(row(10)).toMatchObject({
      state: 'blocked',
      reason: 'needs info',
      act: 'Answer the questions on the issue, then remove the label.',
      urgent: true,
    });
    expect(row(11)).toMatchObject({
      type: 'chore',
      state: 'blocked',
      reason: 'landing refused',
      act: 'Do the human step (e.g. the hotfix ship checklist), then remove the label.',
      step: null,
      urgent: false,
    });
    expect(row(12)).toMatchObject({ state: 'blocked', reason: 'ready for your step', urgent: true });
    expect(doc.issues.every((i: object) => !Object.hasOwn(i, 'line'))).toBe(true);
    expect(doc.flow.lanes.feature).toEqual(['triage', 'specify', 'plan', 'implement']);
    expect(doc.flow.lanes.hotfix).toEqual(['triage', 'hotfix']);
    expect(doc.flow.stages.map((s: { name: string }) => s.name)).toEqual(['Triage', 'Define', 'Plan', 'Implement']);
    expect(doc.flow.stages[1].steps).toEqual(['specify', 'bug', 'chore', 'hotfix']);
    expect(doc.flow.steps.implement.hint).toBe('It lands the change when the build is done.');
    expect(doc.flow.steps.plan.hint).toBeUndefined();
    expect(
      Object.fromEntries(Object.entries(doc.flow.steps).map(([step, row]) => [step, (row as { gate: string }).gate])),
    ).toEqual({
      bug: 'me',
      chore: 'auto',
      hotfix: 'me',
      implement: 'auto',
      plan: 'me',
      specify: 'auto',
      triage: 'auto',
    });
    const endpoints = (await f.logs<string[]>('gh-calls'))
      .map((args) => args.find((arg) => arg.startsWith('repos/'))?.replace(/since=\d{4}-\d\d-\d\dT/, 'since=<date>T'))
      .sort();
    expect(endpoints).toEqual(
      [
        'repos/{owner}/{repo}/issues?state=open&per_page=100',
        'repos/{owner}/{repo}/issues?state=closed&since=<date>T00:00:00Z&per_page=100',
        'repos/{owner}/{repo}/pulls?state=open&per_page=100',
        'repos/{owner}/{repo}/issues/11/comments?per_page=100',
        'repos/{owner}/{repo}/issues/12/comments?per_page=100',
      ].sort(),
    );
    expect((await f.logs('calls')).length).toBe(1);
    expect((await lockNames(f)).split('\n').filter(Boolean).length).toBe(1);
    expect(await rows(f)).toBe('7\trun /celetis:plan #7\n');
    await rm(join(lane, 'new.txt'));
    const cleanDoc = JSON.parse((await f.run(['--board'])).stdout);
    expect(check(cleanDoc)).toEqual([]);
    const stuck = cleanDoc.issues.find((i: { number: number }) => i.number === 7);
    expect(stuck).toMatchObject({
      state: 'stuck',
      step: 'plan',
      act: 'scripts/celetis celetis-flow --resume 7',
      started: true,
    });
    await f.write('repo dir/new', 'dirty');
    expect(JSON.parse((await f.run(['--board'])).stdout).noRun).toBe(
      `The main checkout is dirty: ${f.repo}. Commit or stash first.`,
    );
    await f.put('finish-1');
    await r.result;
  }, true),
);
test.concurrent(
  'board_agent changes only defaultAgent and reads each current YAML host',
  runnerCase(async (f) => {
    await boardIssues(f);
    const claude = JSON.parse((await f.run(['--board'])).stdout);
    const codex = JSON.parse((await f.run(['--board'], { host: 'codex' })).stdout);
    expect(codex.defaultAgent).toBe('codex');
    expect({ ...codex, defaultAgent: 'claude' }).toEqual(claude);
    expect(codex.agents).toEqual({ claude: { available: true, cause: null }, codex: { available: true, cause: null } });
    expect(await f.logs('updates')).toEqual([]);
    expect(await f.logs('calls')).toEqual([]);
    await f.git(['config', 'celetis-flow.agent', 'codex']);
    expect(JSON.parse((await f.run(['--board'], { env: { CELETIS_AGENT: undefined } })).stdout).defaultAgent).toBe(
      'claude',
    );
    await f.config('landing: merge\nhost: codex\n');
    await f.git(['add', '.']);
    await f.git(['commit', '-qm', 'host']);
    expect(JSON.parse((await f.run(['--board'], { env: { CELETIS_AGENT: undefined } })).stdout).defaultAgent).toBe(
      'codex',
    );
  }, true),
);
test.concurrent(
  'board_live reports the automatic lock and stops on GitHub failure',
  runnerCase(async (f) => {
    await f.issue(8, 'needs-triage', 'A typo');
    await f.put('hold-session');
    await f.put('skip-input');
    const r = f.start([]);
    await f.wait('started-1');
    expect(JSON.parse((await f.run(['--board'])).stdout).runner).toBe(true);
    r.child.kill('SIGTERM');
    await f.put('finish-1');
    await r.result;
    await f.put('gh-fail');
    const bad = await f.run(['--board']);
    expect(bad.code).toBe(1);
    expect(bad.stdout).toBe('stop cannot read the issues from GitHub\n');
    expect(bad.stderr).toContain('HTTP 502');
    expect((await f.logs('calls')).length).toBe(1);
  }, true),
);
for (const args of [['7'], ['7', '8'], ['--board'], []])
  test.concurrent(
    `stale resources ${JSON.stringify(args)} preserve diagnostics`,
    runnerCase(async (f) => {
      const dir = join(f.dir, 'stale/scripts');
      await mkdir(dir, { recursive: true });
      await cp(join(root, 'scripts/celetis-flow.ts'), join(dir, 'celetis-flow.ts'));
      const r = await command(process.execPath, [...isolatedArgs, join(dir, 'celetis-flow.ts'), ...args], {
        cwd: f.repo,
        env: f.env,
      });
      expect(r.stderr).toBe('');
      expect(r.code).toBe(args[0] === '7' ? 0 : 1);
      const message = 'the plugin version of this runner was removed after an update; start the runner again';
      expect(r.stdout).toBe(
        args[0] === '7'
          ? args.map((n) => `celetis-flow: #${n}: ${message}\n`).join('')
          : args[0] === '--board'
            ? `stop ${message}\n`
            : `celetis-flow: stop ${message}\n`,
      );
      expect(await f.logs('gh-calls')).toEqual([]);
    }, true),
  );

for (const stage of ['marketplace', 'update', 'list'])
  test.concurrent(
    `update_hang ${stage} keeps the 120 second total deadline and removes real descendants`,
    runnerCase(async (f) => {
      await f.issue();
      await updateTestClock(f);
      await f.put('update-hang', stage);
      const r = f.start([], { script: 'plugin-update' });
      await f.wait('update-child');
      const pids = [Number(await f.read('update-pid')), Number(await f.read('update-child'))];
      await f.put('clock-jump');
      const result = await r.result;
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('timed out after 120 seconds');
      expect(result.stderr).toContain('fixture update stalled with original cause');
      expect(result.stderr).toContain(stage === 'list' ? '--root claude' : stage);
      expect(await f.logs('calls')).toEqual([]);
      expect(await rows(f)).toBe('');
      expect(await lockNames(f)).toBe('');
      for (const pid of pids) {
        const ps = await command('/bin/ps', ['-p', String(pid), '-o', 'stat=']);
        expect(ps.code !== 0 || !ps.stdout.trim() || /[ZX]/.test(ps.stdout)).toBe(true);
      }
      const fd = openSync(join(String(f.env.CLAUDE_CONFIG_DIR), 'celetis-update.lock'), 'a');
      try {
        expect(tryFlock(fd)).toBe(true);
      } finally {
        closeSync(fd);
      }
    }, true),
  );
for (const boundary of ['timeout', 'interruption'])
  test.concurrent(
    `codex_lookup ${boundary} retains diagnostics once, releases locks, and creates no session state`,
    runnerCase(async (f) => {
      await f.issue();
      await updateTestClock(f);
      await f.put('lookup-hang');
      const r = f.start([], { host: 'codex', script: 'plugin-update' });
      await f.wait('update-child');
      const pids = [Number(await f.read('update-pid')), Number(await f.read('update-child'))];
      if (boundary === 'timeout') await f.put('clock-jump');
      else r.child.kill('SIGTERM');
      const result = await r.result;
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        boundary === 'timeout' ? 'timed out after 120 seconds' : 'interrupted by SIGTERM',
      );
      expect(result.stderr.split('fixture: skills catalog lookup stalled with original cause').length - 1).toBe(1);
      expect(await f.logs('calls')).toEqual([]);
      expect(await rows(f)).toBe('');
      expect(await Bun.file(join(f.repo, '.git/celetis-flow/sessions/7.json')).exists()).toBe(false);
      expect(await lockNames(f)).toBe('');
      expect(await readdir(join(f.dir, 'tmp'))).toEqual([]);
      for (const pid of pids) {
        const ps = await command('/bin/ps', ['-p', String(pid), '-o', 'stat=']);
        expect(ps.code !== 0 || !ps.stdout.trim() || /[ZX]/.test(ps.stdout)).toBe(true);
      }
      const fd = openSync(join(String(f.env.CODEX_HOME), 'celetis-update.lock'), 'a');
      try {
        expect(tryFlock(fd)).toBe(true);
      } finally {
        closeSync(fd);
      }
    }, true),
  );

test.concurrent(
  'board_agent missing non-selected host is unavailable and missing selected host stops before GitHub',
  runnerCase(async (f) => {
    await f.issue();
    const bin = join(f.dir, 'codex-only');
    await mkdir(bin);
    for (const name of ['git', 'ps']) {
      const executable = Bun.which(name);
      if (!executable) throw new Error(`${name} is missing`);
      await symlink(executable, join(bin, name));
    }
    for (const name of ['codex', 'gh']) await symlink(join(f.dir, 'bin', name), join(bin, name));
    const board = await f.run(['--board'], { host: 'codex', env: { PATH: bin } });
    expect(board.code, board.stderr).toBe(0);
    const doc = JSON.parse(board.stdout);
    expect(doc.agents.claude.available).toBe(false);
    expect(doc.agents.claude.cause).toBe('celetis: claude is not on PATH');
    expect(doc.agents.codex).toEqual({ available: true, cause: null });
    await f.put('gh-calls');
    const missing = await f.run(['7'], { env: { PATH: bin } });
    expect(missing.code).toBe(1);
    expect(missing.stderr).toBe('celetis: claude is not on PATH\n');
    expect(await f.logs('gh-calls')).toEqual([]);
    expect(await f.logs('calls')).toEqual([]);
    expect(await rows(f)).toBe('');
  }, true),
);
test.concurrent(
  'stale diagnostics cover a directory at the resolver path and delivery source modes',
  runnerCase(async (f) => {
    await rm(join(f.plugin, 'scripts/next-step.ts'));
    await mkdir(join(f.plugin, 'scripts/next-step.ts'));
    const r = await f.run(['7']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('#7: the plugin version of this runner was removed after an update');
    expect(r.stderr).toBe('');
    expect(await f.logs('gh-calls')).toEqual([]);
    expect((await stat(join(root, 'step-prompt.md'))).isFile()).toBe(true);
    expect((await stat(join(root, 'scripts/celetis'))).mode & 0o111).toBe(0o111);
    expect((await stat(join(root, 'scripts/celetis-flow.ts'))).isFile()).toBe(true);
  }, true),
);
test.concurrent(
  'documented recovery command and the retired tracked setup state stay exact',
  runnerCase(async (f) => {
    const document = await readFile(join(root, 'docs/celetis-flow.md'), 'utf8');
    expect(document.match(/\| `stuck` \| `act`: `([^`]+)` \|/)?.[1]).toBe('scripts/celetis celetis-flow --resume <n>');
    const files = await command(
      'git',
      ['ls-files', '--', '.claude/celetis-flow', ':!.claude/celetis-flow/wiring.json'],
      { cwd: root },
    );
    expect(files.code).toBe(0);
    expect(files.stdout).toBe('');
    void f;
  }, true),
);

const managed = { HERDR_ENV: '1', HERDR_PANE_ID: 'w1:p4', HERDR_TAB_ID: 'w1:t2' };
test.concurrent(
  'herdr names each tab, carries the issue chain and exits only a completed step',
  runnerCase(async (f) => {
    await f.issue(7, 'bug', 'It breaks');
    await f.issue(8);
    await after(f, 1, 7, 'bug', ['## Root cause']);
    await f.put('wait-for-decision');
    const r = await f.run(['7', '8'], { env: managed });
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe(
      'celetis-flow: start: /celetis:bug #7\nceletis-flow: start: /celetis:plan #7\nceletis-flow: no progress: /celetis:plan #7\nceletis-flow: start: /celetis:plan #8\nceletis-flow: no progress: /celetis:plan #8\n',
    );
    const calls = await f.logs<string[]>('herdr-calls');
    expect(
      calls.filter(
        (args) => !(args[0] === 'agent' && args[1] === 'get') && !(args[1] === 'wait' && args.includes('working')),
      ),
    ).toEqual([
      ['tab', 'rename', 'w1:t2', '#7 bug'],
      ['agent', 'wait', 'w1:p4', '--until', 'idle', '--until', 'done'],
      ['agent', 'prompt', 'w1:p4', '/exit'],
      ['tab', 'rename', 'w1:t2', '#7 plan'],
      ['agent', 'wait', 'w1:p4', '--until', 'idle', '--until', 'done'],
      ['tab', 'rename', 'w1:t2', '#8 plan'],
      ['agent', 'wait', 'w1:p4', '--until', 'idle', '--until', 'done'],
    ]);
    expect(calls).toContainEqual(['agent', 'get', 'w1:p4']);
    expect(calls).toContainEqual([
      'agent',
      'wait',
      'w1:p4',
      '--until',
      'working',
      '--until',
      'blocked',
      '--timeout',
      '5000',
    ]);
  }, true),
);
test.concurrent(
  'herdr_specify no spec records no progress and a published spec stops at the plan gate',
  runnerCase(async (f) => {
    await f.issue(9, 'enhancement', 'An idea');
    await f.config('landing: merge\ngates:\n  plan: me\n');
    await f.git(['add', '.']);
    await f.git(['commit', '-qm', 'gate']);
    await f.put('wait-for-decision');
    await after(f, 2, 9, 'enhancement');
    const first = await f.run(['9'], { env: managed });
    const second = await f.run(['9'], { env: managed });
    expect(first.code, first.stderr).toBe(0);
    expect(second.code, second.stderr).toBe(0);
    expect(first.stdout).toBe(
      'celetis-flow: start: /celetis:feature #9\nceletis-flow: no progress: /celetis:feature #9\n',
    );
    expect(second.stdout).toBe(
      'celetis-flow: start: /celetis:feature #9\nceletis-flow: the gate of plan is me: scripts/celetis celetis-flow 9 starts /celetis:plan #9\n',
    );
    expect(await rows(f)).toBe('9\trun /celetis:feature #9\n');
    expect((await f.logs<string[]>('herdr-calls')).filter((args) => args[0] === 'tab')).toEqual([
      ['tab', 'rename', 'w1:t2', '#9 specify'],
      ['tab', 'rename', 'w1:t2', '#9 specify'],
    ]);
    expect((await f.logs('prompts')).length).toBe(1);
    expect(
      (await f.logs<string[]>('herdr-calls')).filter(
        (args) => !(args[0] === 'agent' && args[1] === 'get') && !(args[1] === 'wait' && args.includes('working')),
      ),
    ).toEqual([
      ['tab', 'rename', 'w1:t2', '#9 specify'],
      ['agent', 'wait', 'w1:p4', '--until', 'idle', '--until', 'done'],
      ['tab', 'rename', 'w1:t2', '#9 specify'],
      ['agent', 'wait', 'w1:p4', '--until', 'idle', '--until', 'done'],
      ['agent', 'prompt', 'w1:p4', '/exit'],
    ]);
  }, true),
);
for (const [state, label] of [
  ['open', 'epic'],
  ['closed', 'wontfix'],
] as const)
  test.concurrent(
    `herdr_end ${state} ${label} ends the current specify session`,
    runnerCase(async (f) => {
      await f.issue(9, 'enhancement', 'An idea');
      await after(f, 1, 9, label, [], state, 'An idea');
      await f.put('wait-for-decision');
      const r = await f.run(['9'], { env: managed });
      expect(r.code, r.stderr).toBe(0);
      expect(r.stdout).toContain('celetis-flow: stop #9 is ');
      expect((await f.logs('calls')).length).toBe(1);
      expect(await rows(f)).toBe('');
      expect(await f.logs<string[]>('herdr-calls')).toContainEqual(['agent', 'prompt', 'w1:p4', '/exit']);
    }, true),
  );
test.concurrent(
  'automatic lock checks precede stuck rows and skip a live issue for the next auto issue',
  runnerCase(async (f) => {
    await f.issue(7);
    await f.issue(8);
    await f.put('hold-session');
    await f.put('skip-input');
    const manual = f.start(['7']);
    await f.wait('started-1');
    const auto = f.start([]);
    const deadline = performance.now() + 5000;
    while ((await f.logs('calls')).length < 2) {
      if (performance.now() > deadline) throw new Error('automatic runner did not skip the locked issue');
      await Bun.sleep(10);
    }
    expect((await f.logs('calls')).map((call) => (call.args as string[]).at(-1))).toEqual([
      '/celetis:plan #7',
      '/celetis:plan #8',
    ]);
    const duplicate = await f.run([]);
    expect(duplicate.code).toBe(1);
    expect(duplicate.stderr).toContain('another automatic runner');
    auto.child.kill('SIGTERM');
    await f.put('finish-1');
    await f.put('finish-2');
    await Promise.all([manual.result, auto.result]);
    expect(await lockNames(f)).toBe('');
  }, true),
);

for (const [fault, limit] of [
  ['no-auto', 3],
  ['gh-fail', 2],
  ['view-fail', 2],
] as const)
  test.concurrent(
    `automatic 60 second clock ${fault} repeats the resolver without duplicate output`,
    runnerCase(async (f) => {
      await f.issue(7, fault === 'no-auto' ? 'bug' : 'enhancement');
      if (fault === 'gh-fail') await f.put('gh-fail');
      if (fault === 'view-fail') await f.put('view-fail-7');
      const entry = await f.write(
        'auto-clock.ts',
        `import {appendFileSync} from 'node:fs';import {main} from ${JSON.stringify(join(f.plugin, 'scripts/celetis-flow.ts'))};const now=performance.now.bind(performance),sleep=Bun.sleep;let virtual=0,count=0;Object.defineProperty(performance,'now',{value:()=>now()+virtual});Bun.sleep=async ms=>{if(ms===50){virtual+=60_000;appendFileSync(${JSON.stringify(join(f.state, 'auto-sleeps'))},String(virtual)+'\\n');if(++count===${limit})process.kill(process.pid,'SIGTERM');return sleep(0);}return sleep(ms);};process.exitCode=await main([]);`,
      );
      const r = await f.run([], { entry });
      expect(r.code, r.stderr).toBe(143);
      expect(r.stdout.trim().split('\n')).toEqual([
        fault === 'gh-fail'
          ? 'celetis-flow: stop cannot read the open issues from GitHub'
          : fault === 'view-fail'
            ? 'celetis-flow: stop cannot read #7 from GitHub'
            : 'celetis-flow: no auto step can start; the runner asks again each 60 seconds',
      ]);
      expect((await f.read('auto-sleeps')).split('\n').filter(Boolean).map(Number)).toEqual(
        Array.from({ length: limit }, (_, i) => (i + 1) * 60_000),
      );
      expect(await f.logs('calls')).toEqual([]);
      expect(await rows(f)).toBe('');
    }, true),
  );

test.concurrent(
  'update_lock wait uses the same deadline, runs no command, and leaves no stale lock after owner death',
  runnerCase(async (f) => {
    await f.issue();
    await updateTestClock(f);
    await mkdir(String(f.env.CLAUDE_CONFIG_DIR), { recursive: true });
    const holder = await f.write(
      'lock-holder.ts',
      `import {openSync,writeFileSync} from 'node:fs';import {tryFlock} from ${JSON.stringify(join(root, 'scripts/lib/update-lock.ts'))};if(!tryFlock(openSync(${JSON.stringify(join(String(f.env.CLAUDE_CONFIG_DIR), 'celetis-update.lock'))},'a')))process.exit(1);writeFileSync(${JSON.stringify(join(f.state, 'lock-held'))},'');await Bun.sleep(30_000);`,
    );
    const { spawn } = await import('node:child_process');
    const owner = spawn(process.execPath, [...isolatedArgs, holder], { env: f.env, stdio: 'ignore' });
    try {
      await f.wait('lock-held');
      const r = f.start([], { script: 'plugin-update' });
      await f.wait('update-lock-waiting');
      await Bun.sleep(100);
      await f.put('clock-jump');
      const result = await r.result;
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('timed out after 120 seconds during wait for the plugin update lock');
      expect(await f.logs('updates')).toEqual([]);
      expect(await f.logs('calls')).toEqual([]);
      owner.kill('SIGKILL');
      await new Promise<void>((done) => owner.once('exit', () => done()));
      await rm(join(f.state, 'clock-jump'));
      expect((await f.run([], { script: 'plugin-update' })).code).toBe(0);
      expect(await f.logs('calls')).toEqual([]);
    } finally {
      owner.kill('SIGKILL');
    }
  }, true),
);
for (const killed of [false, true])
  test.concurrent(
    `shared_lock two manual updates${killed ? ' keep a surviving update lock after helper SIGKILL' : ''}`,
    runnerCase(async (f) => {
      await f.issue(7);
      await f.issue(8);
      await updateTestClock(f);
      await f.put('hold-update');
      const second = join(f.dir, 'other repository');
      await f.git(['clone', '-q', f.repo, second]);
      const a = f.start([], { script: 'plugin-update' });
      await f.wait('update-entered');
      if (killed) {
        const pid = Number((await f.read('update-helpers')).split('\n')[0]);
        process.kill(pid, 'SIGKILL');
        expect((await a.result).code).toBe(137);
      }
      const b = f.start([], { cwd: second, script: 'plugin-update' });
      const deadline = performance.now() + 5000;
      while ((await f.read('update-helpers')).split('\n').filter(Boolean).length < 2) {
        if (performance.now() > deadline) throw new Error('second update helper did not start');
        await Bun.sleep(10);
      }
      await Bun.sleep(100);
      expect((await f.logs('updates')).length).toBe(1);
      expect(await f.has('update-overlap')).toBe(false);
      await rm(join(f.state, 'hold-update'));
      const results = await Promise.all([a.result, b.result]);
      expect(results[1]?.code).toBe(0);
      if (!killed) expect(results[0]?.code).toBe(0);
      expect(await f.logs('calls')).toEqual([]);
      expect(await f.has('update-overlap')).toBe(false);
    }, true),
  );

for (const [step, label, body, prompt] of [
  ['bug', 'bug', 'It breaks', 'bug'],
  ['specify', 'enhancement', 'An idea', 'feature'],
] as const)
  test.concurrent(
    `main_gates obsolete Git auto values cannot enable ${step} but YAML can`,
    runnerCase(async (f) => {
      await f.issue(5, label, body);
      await f.config('landing: merge\n');
      await f.git(['add', '.']);
      await f.git(['commit', '-qm', 'default gates']);
      for (const name of ['triage', 'specify', 'bug', 'chore', 'hotfix', 'plan', 'implement'])
        await f.git(['config', `celetis-flow.gate.${name}`, 'auto']);
      const first = f.start([]);
      await waitOutput(first, 'no auto step can start');
      first.child.kill('SIGTERM');
      expect((await first.result).code).toBe(143);
      expect(await f.logs('calls')).toEqual([]);
      await f.config(`landing: merge\ngates:\n  ${step}: auto\n`);
      await f.git(['add', '.']);
      await f.git(['commit', '-qm', 'YAML auto gate']);
      const next = f.start([]);
      await waitOutput(next, 'no auto step can start');
      next.child.kill('SIGTERM');
      expect((await next.result).code).toBe(143);
      expect((await f.logs('calls')).map((call) => (call.args as string[]).at(-1))).toEqual([`/celetis:${prompt} #5`]);
      expect(await rows(f)).toBe(`5\trun /celetis:${prompt} #5\n`);
    }, true),
  );
