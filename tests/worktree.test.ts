import { expect, setDefaultTimeout, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, isolatedArgs, root } from './lib/fixture.ts';
import { exists, type LaneFixture, literal, resetLog, setupSource, withLane } from './lib/lane-fixture.ts';

setDefaultTimeout(25_000);
const usage = 'usage: scripts/celetis worktree [--remove] <issue number>, e.g. 302 or #302\n';
const lanePath = (f: LaneFixture, name: string) => join(f.repo, '.claude/worktrees', name);
const ref = (f: LaneFixture, name: string) =>
  command('git', ['show-ref', '--verify', '--quiet', `refs/heads/${name}`], { cwd: f.repo, env: f.env });
const branches = (f: LaneFixture, n: string) => f.git(['branch', '--list', '--format=%(refname:short)', `*/${n}-*`]);
async function newLane(f: LaneFixture, n = '1') {
  const r = await f.worktree([n]);
  expect(r.code, r.stderr).toBe(0);
  return r.stdout.trim().split('\n').at(-1) as string;
}
async function denied(
  f: LaneFixture,
  args: string[],
  message?: string,
  env?: NodeJS.ProcessEnv,
  code: number | null = 1,
) {
  const r = await f.worktree(args, { env });
  if (code === null) expect(r.code, r.stderr).not.toBe(0);
  else expect(r.code, r.stderr).toBe(code);
  expect(r.stdout).toBe('');
  if (message) expect(r.stderr).toContain(message);
  return r;
}

test.concurrent(
  'lane_new: fresh trunk, exact TypeScript bytes, streams, private file, marker and clean checkout',
  withLane(async (f) => {
    const other = join(f.dir, 'other');
    await f.git(['clone', '-q', f.origin, other]);
    await f.git(['commit', '-q', '--allow-empty', '-m', 'upstream'], other);
    await f.git(['push', '-q', 'origin', 'HEAD:main'], other);
    const upstream = await f.git(['rev-parse', 'HEAD'], other);
    await f.config('landing: merge\nworktreeSetup: process.exit(91)\n');
    const lane = lanePath(f, '1-probe');
    const r = await f.worktree(['1'], { env: { SETUP_STDOUT: 'stdout-noise' } });
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe(`stdout-noise\n${lane}\n`);
    expect(r.stderr).toContain('noise "quoted"');
    expect(await f.git(['branch', '--show-current'], lane)).toBe('feat/1-probe');
    expect(await f.git(['rev-parse', 'HEAD'], lane)).toBe(upstream);
    expect(
      (await command('git', ['config', '--get', 'branch.feat/1-probe.merge'], { cwd: f.repo, env: f.env })).code,
    ).toBe(1);
    expect(await f.setupRows()).toEqual([{ cwd: lane, main: f.repo, kept: 'kept' }]);
    expect(await readFile(f.env.SETUP_BYTES, 'utf8')).toBe(setupSource);
    expect(await exists(await f.marker(lane))).toBe(true);
    await f.tempRemoved();
    await f.clean(lane);
    await f.config(`landing: merge\n${literal(setupSource)}`);
    await resetLog(f, 'GH_LOG');
    await f.update({ title: 'A renamed title' });
    expect((await f.worktree(['#1'])).stdout).toBe(`${lane}\n`);
    expect((await f.worktree(['1'], { cwd: lane })).stdout).toBe(`${lane}\n`);
    expect(await f.calls()).toEqual([]);
    expect(await branches(f, '1')).toBe('feat/1-probe');
    expect((await f.setupRows()).length).toBe(1);
    await writeFile(join(lane, '.celetis.yaml'), 'landing: invalid\n');
    await denied(f, ['1'], 'worktree setup failed');
    expect((await f.setupRows()).length).toBe(1);
    expect(await exists(await f.marker(lane))).toBe(true);
    await writeFile(join(lane, '.celetis.yaml'), `landing: merge\n${literal(setupSource)}`);
    await rm(await f.marker(lane));
    expect((await f.worktree(['1'])).stdout).toBe(`\n${lane}\n`);
    expect((await f.setupRows()).length).toBe(2);
    await rm(await f.marker(lane));
    await denied(f, ['1'], 'worktree setup failed', { FAIL_SETUP: '7' });
    expect(await exists(lane)).toBe(true);
    expect((await ref(f, 'feat/1-probe')).code).toBe(0);
    expect(await exists(await f.marker(lane))).toBe(false);
    await f.tempRemoved();
    await f.clean(lane);
    await f.update({ title: 'Nested', labels: 'bug' });
    const nested = await f.worktree(['2'], { cwd: lane });
    expect(nested.code, nested.stderr).toBe(0);
    expect(nested.stdout).toBe(`\n${lanePath(f, '2-nested')}\n`);
    expect((await ref(f, 'fix/2-nested')).code).toBe(0);
  }),
);

for (const bad of ['missing', 'invalid'])
  test.concurrent(
    `lane_new: ${bad} main config stops before state mutation`,
    withLane(async (f) => {
      await f.logGit();
      if (bad === 'missing') await rm(join(f.repo, '.celetis.yaml'));
      else await f.config('landing: invalid\n');
      const r = await f.worktree(['90']);
      expect(r.code).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toContain(join(f.repo, '.celetis.yaml'));
      const calls = (await readFile(f.env.GIT_LOG, 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      expect(
        calls.some(
          (a: string[]) =>
            a[0] === 'branch' || (a[0] === 'worktree' && ['add', 'prune', 'remove'].includes(a[1] ?? '')),
        ),
      ).toBe(false);
      expect(await f.calls()).toEqual([]);
    }),
  );

test.concurrent(
  'lanes_existing: checkout identity, main branch refusal and owned cleanup',
  withLane(async (f) => {
    const elsewhere = join(f.dir, 'elsewhere');
    await f.git(['worktree', 'add', '-q', '-b', 'chore/3-elsewhere', elsewhere]);
    expect((await f.worktree(['3'])).stdout).toBe(`\n${elsewhere}\n`);
    expect((await f.setupRows()).length).toBe(1);
    await f.git(['checkout', '-q', '-b', 'chore/5-inplace']);
    await denied(f, ['5'], 'switch the main checkout');
    expect(await exists(lanePath(f, '5-inplace'))).toBe(false);
    await f.git(['checkout', '-q', 'main']);
    await f.update({ labels: 'bug', title: 'Broken' });
    await denied(f, ['6'], 'worktree setup failed', { FAIL_SETUP: '1' });
    expect(await branches(f, '6')).toBe('');
    expect(await exists(lanePath(f, '6-broken'))).toBe(false);
    await f.git(['branch', 'fix/7-kept']);
    await denied(f, ['7'], 'worktree setup failed', { FAIL_SETUP: '1' });
    expect((await ref(f, 'fix/7-kept')).code).toBe(0);
    expect(await exists(lanePath(f, '7-kept'))).toBe(false);
    await f.tempRemoved();
  }),
);

for (const args of [['feat/4-old-form'], ['4x'], ['01'], ['#'], [''], [], ['1', '2'], ['--remove']])
  test.concurrent(
    `usage: ${JSON.stringify(args)}`,
    withLane(async (f) => {
      const r = await f.worktree(args);
      expect(r).toEqual({ code: 2, stdout: '', stderr: usage });
    }),
  );

const slugs = [
  ['9', 'Fire', 'hotfix', 'fire', 'hotfix'],
  ['10', 'Tidy', 'ready-for-agent chore', 'tidy', 'chore'],
  ['11', 'Lane commands: stop when the issue has no branch!', 'enhancement', 'lane-commands-stop-when-the', 'feat'],
  ['12', 'Aaaaaaaaa Bbbbbbbbb Cccccccccc dd', 'enhancement', 'aaaaaaaaa-bbbbbbbbb-cccccccccc', 'feat'],
  ['13', 'Supercalifragilisticexpialidocious fix', 'enhancement', 'supercalifragilisticexpialidoc', 'feat'],
  ['14', '!!! ???', 'enhancement', 'issue', 'feat'],
  ['15', 'Грешка в PDF', 'enhancement', 'pdf', 'feat'],
] as const;
for (const [n, title, labels, slug, prefix] of slugs)
  test.concurrent(
    `lanes_named: ${n} ${slug}`,
    withLane(async (f) => {
      await f.update({ title, labels });
      const lane = await newLane(f, n);
      expect(lane).toBe(lanePath(f, `${n}-${slug}`));
      expect((await ref(f, `${prefix}/${n}-${slug}`)).code).toBe(0);
    }),
  );

test.concurrent(
  'lanes_named: deleted checkout recreated and empty setup receives no marker',
  withLane(async (f) => {
    const lane = await newLane(f);
    await rm(lane, { recursive: true });
    expect(await newLane(f)).toBe(lane);
    expect(await exists(await f.marker(lane))).toBe(true);
  }),
);

for (const setup of [null, ''])
  test.concurrent(
    `setup_fields: ${setup === null ? 'omitted' : 'empty'} setup and a later script`,
    withLane(async (f) => {
      if (setup === null) {
        await f.config('landing: merge\n');
        await f.commit();
        await f.git(['push', '-q', 'origin', 'main']);
      }
      const lane = await newLane(f);
      expect((await f.worktree(['1'])).stdout).toBe(`${lane}\n`);
      expect(await exists(await f.marker(lane))).toBe(false);
      expect(await f.setupRows()).toEqual([]);
      await writeFile(join(lane, '.celetis.yaml'), `landing: merge\n${literal(setupSource)}`);
      await f.commit('later setup', lane);
      expect((await f.worktree(['1'])).stdout).toBe(`\n${lane}\n`);
      expect(await exists(await f.marker(lane))).toBe(true);
      expect((await f.worktree(['1'])).stdout).toBe(`${lane}\n`);
      expect((await f.setupRows()).length).toBe(1);
    }, setup),
  );

for (const ending of ['', '\n', '\n\n\n'])
  test.concurrent(
    `setup text and inherited input: ${ending.length} final line breaks`,
    withLane(async (f) => {
      const originalText = `import { readFileSync, writeFileSync } from 'node:fs';\nconst observed = { main: process.argv[2], cwd: process.cwd(), input: await Bun.stdin.text() };\nwriteFileSync(process.env.SETUP_LOG!, JSON.stringify(observed));\nwriteFileSync(process.env.SETUP_BYTES!, readFileSync(import.meta.path));${ending}`;
      await f.config(`landing: merge\n${literal(originalText)}`);
      await f.commit();
      await f.git(['push', '-q', 'origin', 'main']);
      const lane = lanePath(f, '1-probe');
      const r = await f.worktree(['1'], { input: 'input from caller\n' });
      expect(r.code, r.stderr).toBe(0);
      const observed = JSON.parse(await readFile(f.env.SETUP_LOG, 'utf8'));
      expect(observed.main).toBe(f.repo);
      expect(observed.cwd).toBe(lane);
      expect(observed.input).toBe('input from caller\n');
      expect(f.configValue(lane).worktreeSetup).toBe(originalText);
      expect(await readFile(f.env.SETUP_BYTES, 'utf8')).toBe(originalText);
      expect(await exists(await f.marker(lane))).toBe(true);
      await f.clean(lane);
    }),
  );

for (const [name, source] of [
  ['syntax error', 'const broken: = ;'],
  ['uncaught exception', 'throw new Error("setup boom");'],
  ['process.exit(7)', 'process.exit(7);'],
  [
    'checked external failure',
    'const result = Bun.spawnSync([process.execPath, "--no-env-file", "--no-install", "--config=/dev/null", "--no-macros", "-e", "process.exit(9)"]); if (result.exitCode !== 0) process.exit(result.exitCode);',
  ],
  ['old Bash is rejected', 'set -e\nprintf "%s\\n" "$1"'],
] as const)
  test.concurrent(
    `new setup cleanup: ${name}`,
    withLane(async (f) => {
      await f.config(`landing: merge\n${literal(source)}`);
      await f.commit();
      await f.git(['push', '-q', 'origin', 'main']);
      await denied(f, ['1'], 'worktree setup failed');
      expect(await branches(f, '1')).toBe('');
      expect(await exists(lanePath(f, '1-probe'))).toBe(false);
      await f.git(['worktree', 'add', '-q', '-b', 'fix/2-existing', lanePath(f, '2-existing')]);
      await denied(f, ['2'], 'worktree setup failed');
      expect((await ref(f, 'fix/2-existing')).code).toBe(0);
      expect(await exists(await f.marker(lanePath(f, '2-existing')))).toBe(false);
      await f.clean(lanePath(f, '2-existing'));
    }),
  );

test.concurrent(
  'lanes_from_pr: pagination, remote branch tracking, cleanup, and ignored merged leftovers',
  withLane(async (f) => {
    const other = join(f.dir, 'other');
    await f.git(['clone', '-q', f.origin, other]);
    await f.git(['checkout', '-qb', 'fix/16-remote-work'], other);
    await f.git(['commit', '-q', '--allow-empty', '-m', 'remote-work'], other);
    await f.git(['push', '-q', 'origin', 'fix/16-remote-work'], other);
    const tip = await f.git(['rev-parse', 'HEAD'], other);
    await f.update({ pages: 2, heads: 'feat/160-other fix/16-remote-work', title: 'Another title' });
    const lane = await newLane(f, '16');
    expect(lane).toBe(lanePath(f, '16-remote-work'));
    expect(await f.git(['rev-parse', 'HEAD'], lane)).toBe(tip);
    expect(await f.git(['config', '--get', 'branch.fix/16-remote-work.remote'])).toBe('origin');
    expect(await f.git(['config', '--get', 'branch.fix/16-remote-work.merge'])).toBe('refs/heads/fix/16-remote-work');
    expect(await branches(f, '16')).toBe('fix/16-remote-work');
    await f.git(['checkout', '-qb', 'fix/25-remote-setup'], other);
    await f.git(['push', '-q', 'origin', 'fix/25-remote-setup'], other);
    await f.update({ heads: 'fix/25-remote-setup' });
    await denied(f, ['25'], 'worktree setup failed', { FAIL_SETUP: '1' });
    expect(await branches(f, '25')).toBe('');
    expect(await exists(lanePath(f, '25-remote-setup'))).toBe(false);
    expect(await f.git(['ls-remote', '--exit-code', 'origin', 'refs/heads/fix/25-remote-setup'])).not.toBe('');
    await f.git(['checkout', '-qb', 'feat/17-merged-long-ago'], other);
    await f.git(['push', '-q', 'origin', 'feat/17-merged-long-ago'], other);
    await f.update({ heads: '', title: 'Fresh start' });
    const fresh = await newLane(f, '17');
    expect(fresh).toBe(lanePath(f, '17-fresh-start'));
    expect(await branches(f, '17')).toBe('feat/17-fresh-start');
    expect(await f.git(['rev-parse', 'HEAD'], fresh)).toBe(await f.git(['rev-parse', 'origin/main']));
    await f.update({ prs: `CLOSED ${tip}`, state: 'closed' });
    expect((await f.worktree(['--remove', '16'])).code).toBe(0);
    expect(await exists(lane)).toBe(false);
    expect((await ref(f, 'fix/16-remote-work')).code).toBe(1);
    expect(await f.git(['ls-remote', '--exit-code', 'origin', 'refs/heads/fix/16-remote-work'])).not.toBe('');
  }),
);

test.concurrent(
  'lanes_refused_setup: invalid remote config cleanup and changed default branch',
  withLane(async (f) => {
    const other = join(f.dir, 'other');
    await f.git(['clone', '-q', f.origin, other]);
    await f.git(['checkout', '-qb', 'fix/31-invalid-config'], other);
    await writeFile(join(other, '.celetis.yaml'), 'landing: invalid\n');
    await f.commit('invalid', other);
    await f.git(['push', '-q', 'origin', 'fix/31-invalid-config'], other);
    await f.update({ heads: 'fix/31-invalid-config' });
    await denied(f, ['31'], 'worktree setup failed');
    expect(await branches(f, '31')).toBe('');
    expect(await exists(lanePath(f, '31-invalid-config'))).toBe(false);
    expect(await f.git(['ls-remote', '--exit-code', 'origin', 'refs/heads/fix/31-invalid-config'])).not.toBe('');
    await f.git(['checkout', '-q', 'main'], other);
    await f.git(['commit', '-q', '--allow-empty', '-m', 'on-trunk'], other);
    await f.git(['push', '-q', 'origin', 'HEAD:trunk'], other);
    await f.update({ heads: '', title: 'Trunk', trunk: 'trunk' });
    const lane = await newLane(f, '28');
    expect(await f.git(['rev-parse', 'HEAD'], lane)).toBe(await f.git(['rev-parse', 'HEAD'], other));
    await f.update({ repoFail: true });
    await denied(f, ['29'], 'cannot read the default branch from GitHub');
    expect(await branches(f, '29')).toBe('');
    expect(await exists(lanePath(f, '29-trunk'))).toBe(false);
  }),
);

for (const [n, state, message] of [
  ['19', { heads: 'feat/19-a fix/19-b' }, 'several open PRs'],
  ['20', { labels: 'enhancement epic' }, 'epic'],
  ['21', { labels: 'needs-triage' }, '/celetis:triage #21'],
  ['22', { labels: 'bug enhancement' }, 'several lane labels'],
  ['23', { issueFail: true }, 'cannot read #23'],
  ['24', { prFail: true }, 'cannot list the open PRs'],
] as const)
  test.concurrent(
    `lanes_refused: ${n}`,
    withLane(async (f) => {
      await f.update(state);
      await denied(f, [n], message);
      expect(await branches(f, n)).toBe('');
      expect((await f.git(['worktree', 'list', '--porcelain'])).includes(`/${n}-`)).toBe(false);
    }),
  );

test.concurrent(
  'lanes_refused: ambiguous local branches preserve both branches for open and remove',
  withLane(async (f) => {
    await f.git(['branch', 'feat/18-a']);
    await f.git(['branch', 'fix/18-b']);
    for (const args of [['18'], ['--remove', '18']]) await denied(f, args, 'several branches');
    expect(await branches(f, '18')).toBe('feat/18-a\nfix/18-b');
  }),
);

test.concurrent(
  'removal: PR and issue guards, caller identity, prototype order, dirty work, locks and remote failures',
  withLane(async (f) => {
    const lane = await newLane(f);
    const proto = lanePath(f, 'prototype-1-probe-ui');
    await f.git(['worktree', 'add', '-q', '-b', 'prototype/1-probe-ui', proto, 'main']);
    for (const name of ['prototype/1-alt', 'prototype/1-gone', 'prototype/10-near'])
      await f.git(['branch', name, 'main']);
    await f.git(['push', '-q', 'origin', 'prototype/1-probe-ui', 'prototype/1-gone', 'prototype/10-near']);
    await f.git(['branch', '-D', 'prototype/1-gone']);
    const kept = async (alt = true) => {
      expect(await exists(lane)).toBe(true);
      expect(await exists(proto)).toBe(true);
      for (const name of ['feat/1-probe', 'prototype/1-probe-ui', ...(alt ? ['prototype/1-alt'] : [])])
        expect((await ref(f, name)).code).toBe(0);
      for (const name of ['prototype/1-probe-ui', 'prototype/1-gone'])
        expect(await f.git(['ls-remote', '--exit-code', 'origin', `refs/heads/${name}`])).not.toBe('');
    };
    for (const state of [
      { prs: 'OPEN 0' },
      { prs: 'CLOSED 0\nOPEN 0', state: 'closed' },
      { prs: '', state: 'open' },
      { prs: '', labels: 'enhancement epics' },
      { prFail: true, state: 'closed' },
      { prFail: false, issueFail: true },
    ]) {
      await f.update(state);
      await denied(f, ['--remove', '1']);
      await kept();
    }
    const calls = await f.calls();
    expect(calls.some((a) => a.some((v) => v.includes('head={owner}:feat%2F1-probe&')))).toBe(true);
    await f.update({ issueFail: false, prs: `MERGED ${await f.git(['rev-parse', 'feat/1-probe'])}` });
    await f.git(['commit', '-q', '--allow-empty', '-m', 'unpushed'], lane);
    await denied(f, ['--remove', '1'], 'local branch has commits');
    await kept();
    await f.update({ prs: `CLOSED 0\nMERGED ${await f.git(['rev-parse', 'feat/1-probe'])}`, pages: 2 });
    expect((await f.worktree(['--remove', '1'], { cwd: lane })).code).toBe(1);
    await kept();
    await f.git(['remote', 'set-url', 'origin', join(f.dir, 'missing.git')]);
    await denied(f, ['--remove', '1'], undefined, undefined, null);
    await f.git(['remote', 'set-url', 'origin', f.origin]);
    await kept();
    await writeFile(join(proto, 'scratch'), 'keep');
    await denied(f, ['--remove', '1'], undefined, undefined, null);
    expect(await readFile(join(proto, 'scratch'), 'utf8')).toBe('keep');
    await kept(false);
    await rm(join(proto, 'scratch'));
    await f.git(['worktree', 'lock', proto]);
    await writeFile(join(lane, 'scratch'), 'keep');
    await denied(f, ['--remove', '1'], undefined, undefined, null);
    expect(await exists(proto)).toBe(false);
    expect(await readFile(join(lane, 'scratch'), 'utf8')).toBe('keep');
    expect((await ref(f, 'feat/1-probe')).code).toBe(0);
    await rm(join(lane, 'scratch'));
    await f.git(['worktree', 'lock', lane]);
    expect((await f.worktree(['--remove', '#1'])).code).toBe(0);
    expect(await exists(lane)).toBe(false);
    for (const name of ['feat/1-probe', 'prototype/1-probe-ui', 'prototype/1-alt'])
      expect((await ref(f, name)).code).toBe(1);
    for (const name of ['prototype/1-probe-ui', 'prototype/1-gone'])
      expect(
        (
          await command('git', ['ls-remote', '--exit-code', 'origin', `refs/heads/${name}`], {
            cwd: f.repo,
            env: f.env,
          })
        ).code,
      ).toBe(2);
    expect((await ref(f, 'prototype/10-near')).code).toBe(0);
    expect(await f.git(['ls-remote', '--exit-code', 'origin', 'refs/heads/prototype/10-near'])).not.toBe('');
    await resetLog(f, 'GH_LOG');
    expect((await f.worktree(['--remove', '1'])).code).toBe(0);
    expect(await f.calls()).toEqual([]);
  }),
);

test.concurrent(
  'closed issue removal: unpushed commits and own prototype are not origin copies',
  withLane(async (f) => {
    const lane = await newLane(f);
    await f.update({ prs: '', state: 'closed' });
    await f.git(['branch', 'prototype/1-sketch', 'main']);
    await f.git(['push', '-q', 'origin', 'prototype/1-sketch']);
    expect((await f.worktree(['--remove', '1'], { cwd: lane })).code).toBe(1);
    await f.git(['commit', '-q', '--allow-empty', '-m', 'local-only'], lane);
    await f.git(['branch', '-f', 'prototype/1-sketch', 'feat/1-probe']);
    await f.git(['push', '-q', '-f', 'origin', 'prototype/1-sketch']);
    await denied(f, ['--remove', '1'], 'git push origin feat/1-probe');
    expect(await exists(lane)).toBe(true);
    expect((await ref(f, 'prototype/1-sketch')).code).toBe(0);
    await f.git(['push', '-q', 'origin', 'feat/1-probe']);
    expect((await f.worktree(['--remove', '1'])).code).toBe(0);
    expect(await exists(lane)).toBe(false);
    expect((await ref(f, 'prototype/1-sketch')).code).toBe(1);
  }),
);

test.concurrent(
  'open epic removal: a branch without a PR can be removed',
  withLane(async (f) => {
    const lane = await newLane(f);
    await f.update({ prs: '', labels: 'epic', state: 'open' });
    expect((await f.worktree(['--remove', '1'])).code).toBe(0);
    expect(await exists(lane)).toBe(false);
    expect((await ref(f, 'feat/1-probe')).code).toBe(1);
  }),
);

for (const target of ['lane', 'main', 'linked lane'])
  test.concurrent(
    `setup refuses a temporary directory inside the ${target} before writing setup text`,
    withLane(async (f) => {
      const lane = lanePath(f, '1-probe');
      let tmp = target === 'main' ? f.repo : lane;
      if (target === 'linked lane') {
        tmp = join(f.dir, 'linked-tmp');
        await symlink(lane, tmp);
      }
      const result = await f.worktree(['1'], { env: { TMPDIR: tmp } });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('temporary directory must be outside the checkout');
      expect(await exists(lane)).toBe(false);
      expect(await branches(f, '1')).toBe('');
      expect(await f.setupRows()).toEqual([]);
    }),
  );

test.concurrent(
  'setup ignores product Bun startup files and imports only an explicit absolute product path',
  withLane(async (f) => {
    const source = `import { join } from 'node:path';\nimport { writeFileSync } from 'node:fs';\nif (process.env.SETUP_POISON) throw new Error('product env loaded');\nconst local = await import(join(process.cwd(), 'product.ts'));\nconst main = await import(join(process.argv[2]!, 'product.ts'));\nwriteFileSync(process.env.SETUP_LOG!, JSON.stringify([local.value, main.value]));\n`;
    await f.config(`landing: merge\n${literal(source)}`);
    await f.write('repo dir/.env', 'SETUP_POISON=loaded\n');
    await f.write('repo dir/bunfig.toml', 'preload = ["./poison.ts"]\n');
    await f.write('repo dir/poison.ts', 'throw new Error("product preload loaded");\n');
    await f.write('repo dir/product.ts', 'export const value: string = "absolute local import";\n');
    await f.commit();
    await f.git(['push', '-q', 'origin', 'main']);
    const r = await f.worktree(['1']);
    expect(r.code, r.stderr).toBe(0);
    expect(JSON.parse(await readFile(f.env.SETUP_LOG, 'utf8'))).toEqual([
      'absolute local import',
      'absolute local import',
    ]);
    await f.clean(lanePath(f, '1-probe'));
  }),
);

test.concurrent(
  'runSetup forwards a real signal, removes the private source and leaves no marker',
  withLane(async (f) => {
    const source = `import { writeFileSync, statSync } from 'node:fs';\nwriteFileSync(process.env.SETUP_META!, JSON.stringify({file: import.meta.path, mode: statSync(import.meta.path).mode & 0o777, bun: process.execPath, pid: process.pid}));\nprocess.on('SIGTERM', () => process.exit(0));\nwriteFileSync(process.env.SETUP_LOG!, 'ready');\nsetInterval(() => {}, 1000);\n`;
    const entry = await f.write(
      'driver.ts',
      `import { runSetup } from ${JSON.stringify(join(root, 'scripts/lib/worktree.ts'))};\nprocess.exitCode = await runSetup(${JSON.stringify(f.repo)}, {landing:'merge',worktreeSetup:${JSON.stringify(source)}}, ${JSON.stringify(f.repo)});\n`,
    );
    const child = spawn(process.execPath, [...isolatedArgs, entry], {
      cwd: f.repo,
      env: { ...f.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', DO_NOT_TRACK: '1' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once('close', resolve);
      child.once('error', reject);
    });
    try {
      const deadline = Date.now() + 5_000;
      while ((await readFile(f.env.SETUP_LOG, 'utf8')) !== 'ready' && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(await readFile(f.env.SETUP_LOG, 'utf8')).toBe('ready');
      child.kill('SIGTERM');
      expect(await exited).toBe(143);
      expect(stderr).toBe('');
      expect(await exists(await f.marker(f.repo))).toBe(false);
      await f.tempRemoved();
      await f.clean();
    } finally {
      child.kill('SIGKILL');
      await exited;
      const meta = await readFile(f.env.SETUP_META, 'utf8').catch(() => 'null');
      const pid = JSON.parse(meta)?.pid;
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
      }
    }
  }),
);

test.concurrent(
  'equivalent Git checkout paths still identify the main checkout branch',
  withLane(async (f) => {
    await f.git(['checkout', '-qb', 'feat/1-inplace']);
    await f.aliasGitPaths();
    const result = await f.worktree(['1']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('switch the main checkout off feat/1-inplace first');
    expect(await f.setupRows()).toEqual([]);
  }),
);
