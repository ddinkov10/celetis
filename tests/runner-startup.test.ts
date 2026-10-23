import { expect, setDefaultTimeout, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runnerCase } from './lib/runner-fixture.ts';
import { finish, held, managed, start } from './lib/runner-lifecycle-fixture.ts';

setDefaultTimeout(25_000);

for (const host of ['claude', 'codex']) {
  for (const outcome of ['success', 'failure'])
    test.concurrent(
      `update ${host} ${outcome} keeps exact host sequence and stop behavior`,
      runnerCase(async (f) => {
        await f.issue();
        if (outcome === 'failure') await f.put('update-fail');
        const r =
          outcome === 'failure'
            ? await f.run(['7'], { host })
            : await (async () => {
                const r = await start(f, host);
                await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
                return finish(f, r);
              })();
        if (outcome === 'failure') {
          expect(r.code).toBe(1);
          expect(r.stderr).toContain(`fixture: ${host} marketplace update unavailable`);
          expect(r.stderr).toContain('celetis-flow: the plugin update failed; the step did not start');
          expect(await f.logs('calls')).toEqual([]);
          expect(await Bun.file(join(f.repo, '.git/celetis-flow/no-progress')).exists()).toBe(false);
          expect(await Bun.file(join(f.repo, '.git/celetis-flow/sessions/7.json')).exists()).toBe(false);
        } else expect(r.code, r.stderr).toBe(0);
        const want =
          host === 'codex'
            ? [['plugin', 'marketplace', 'upgrade', 'celetis']]
            : outcome === 'failure'
              ? [['plugin', 'marketplace', 'update', 'celetis']]
              : [
                  ['plugin', 'marketplace', 'update', 'celetis'],
                  ['plugin', 'update', 'celetis@celetis', '--scope', 'user'],
                  ['plugin', 'list', '--json'],
                ];
        expect(await f.logs('updates')).toEqual(want.map((args) => ({ host, args })));
      }, true),
    );
}
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
