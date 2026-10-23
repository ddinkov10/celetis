import { expect, setDefaultTimeout, test } from 'bun:test';
import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './lib/fixture.ts';
import { runnerCase } from './lib/runner-fixture.ts';
import { held, managed, start } from './lib/runner-lifecycle-fixture.ts';

setDefaultTimeout(25_000);

test.concurrent(
  'missing update-policy dependency is reported before starting a numbered session',
  runnerCase(async (f) => {
    await rm(join(f.plugin, 'scripts/lib/plugin-metadata.ts'));
    const result = await f.run(['7']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('plugin version of this runner was removed');
    expect(await f.logs('calls')).toEqual([]);
  }),
);

for (const args of [['7'], [], ['--board'], ['--resume', '7']])
  test.concurrent(
    `real Codex replacement policy refuses ${JSON.stringify(args)} before a consumer starts`,
    runnerCase(async (f) => {
      await cp(join(root, 'scripts/lib/plugin-policy.ts'), join(f.plugin, 'scripts/lib/plugin-policy.ts'));
      await f.issue();
      if (args[0] === '--resume') {
        await f.git(['rev-parse', '--git-common-dir']);
        await f.write(
          'repo dir/.git/celetis-flow/sessions/7.json',
          JSON.stringify({
            schema: 1,
            issue: 7,
            checkout: f.repo,
            host: 'codex',
            step: 'plan',
            session_id: '01a139fc-2ffa-74c0-9b14-e35e23339910',
          }),
        );
      }
      const result = await f.run(args, { host: 'codex' });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('automatic plugin refresh');
      expect(result.stderr).toContain('config.toml');
      expect(await f.logs('calls')).toEqual([]);
      expect(await f.logs('mutations')).toEqual([]);
    }),
  );

test.concurrent(
  'real Claude local policy overrides project false and refuses consumer start',
  runnerCase(async (f) => {
    await cp(join(root, 'scripts/lib/plugin-policy.ts'), join(f.plugin, 'scripts/lib/plugin-policy.ts'));
    await f.write(
      'repo dir/.claude/settings.json',
      JSON.stringify({ extraKnownMarketplaces: { celetis: { autoUpdate: false } } }),
    );
    await f.write(
      'repo dir/.claude/settings.local.json',
      JSON.stringify({ extraKnownMarketplaces: { celetis: { autoUpdate: true } } }),
    );
    const result = await f.run(['7']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('.claude/settings.local.json');
    expect(await f.logs('calls')).toEqual([]);
    expect(await f.logs('mutations')).toEqual([]);
  }),
);

for (const host of ['claude', 'codex']) {
  for (const automatic of [false, true])
    test.concurrent(
      `${host} ${automatic ? 'automatic' : 'numbered'} start uses its installed package without updates`,
      runnerCase(async (f) => {
        await f.put('update-fail');
        await rm(join(f.plugin, 'scripts/plugin-update.ts'));
        await rm(join(f.plugin, 'scripts/lib/update-lock.ts'));
        const r = await start(f, host, automatic);
        await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
        await f.put('finish-1');
        if (automatic) {
          const deadline = performance.now() + 5000;
          while (await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks/issue-7'])) {
            if (performance.now() >= deadline) throw new Error('the completed issue lock was not released');
            await Bun.sleep(10);
          }
          r.child.kill('SIGTERM');
        }
        const result = await r.result;
        expect(result.code, result.stderr).toBe(automatic ? 143 : 0);
        expect(await f.logs('updates')).toEqual([]);
        expect((await f.logs('calls')).map((call) => call.host)).toEqual([host]);
      }, true),
    );
  test.concurrent(
    `unbound updater refuses ${host} through the public launcher`,
    runnerCase(async (f) => {
      const r = await f.run(['--agent', host, 'plugin-update'], {
        host: host === 'claude' ? 'codex' : 'claude',
        entry: join(f.plugin, 'scripts/launcher.ts'),
      });
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('check | apply <source> <installed> <target>');
      expect(await f.logs('mutations')).toEqual([]);
      expect(await f.logs('calls')).toEqual([]);
    }),
  );
}
test.concurrent(
  'manual update rejects the obsolete runner PID interface before native commands',
  runnerCase(async (f) => {
    const r = await f.run([String(process.pid), 'claude'], { script: 'plugin-update' });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('usage: scripts/celetis [--agent claude|codex] plugin-update');
    expect(await f.logs('updates')).toEqual([]);
  }),
);
for (const [host, automatic] of [
  ['claude', false],
  ['codex', true],
] as const)
  test.concurrent(
    `registration ${host} ${automatic ? 'auto' : 'issue'} starts only after both refs commit`,
    runnerCase(async (f) => {
      const realGit = Bun.which('git');
      if (!realGit) throw new Error('git is missing');
      f.env.REAL_GIT = realGit;
      await f.put('hold-session');
      await f.put('skip-input');
      await f.issue();
      await f.put('hold-registration');
      await f.stub(
        'git',
        `import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {spawn} from 'node:child_process';const S=process.env.RUNNER_TEST!;const args=process.argv.slice(2);let input='';if(args.join(' ')==='update-ref --no-deref --stdin'&&existsSync(join(S,'hold-registration'))){for await(const data of process.stdin)input+=data.toString();writeFileSync(join(S,'registering'),input);while(!existsSync(join(S,'allow-registration')))await Bun.sleep(10);}const c=spawn(process.env.REAL_GIT!,args,{stdio:input?['pipe','inherit','inherit']:'inherit'});if(input)c.stdin!.end(input);process.exitCode=await new Promise<number>(done=>c.on('close',code=>done(code??1)));`,
      );
      const dying = f.start(automatic ? [] : ['7'], { host, env: managed });
      await f.wait('registering');
      dying.child.kill('SIGKILL');
      await dying.exited;
      await f.put('allow-registration');
      await Bun.sleep(200);
      const startedBeforeLockRegistration = await f.has('started-1');
      expect(startedBeforeLockRegistration).toBe(false);
      await rm(join(f.state, 'hold-registration'));
      await f.put('dynamic-id');
      const r = await start(f, host, automatic);
      if (automatic)
        expect(await f.git(['rev-parse', 'refs/celetis-flow/locks/runner'])).toBe(
          await f.git(['rev-parse', 'refs/celetis-flow/locks/issue-7']),
        );
      await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
      r.child.kill('SIGKILL');
      await r.exited;
      await held(f, host);
      if (automatic) {
        const other = await f.run([], { host: 'codex' });
        expect(other.code).toBe(1);
        expect(other.stderr).toContain('another automatic runner or its session');
      }
      await f.put('finish-1');
      const deadline = performance.now() + 4000;
      while ((await f.has('live')) && performance.now() < deadline) await Bun.sleep(10);
      expect(await f.has('live')).toBe(false);
      const after = await f.run(['7'], { host });
      expect(after.stdout).toContain('stop #7 is finished');
    }, true),
  );
