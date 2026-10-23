import { expect, setDefaultTimeout, test } from 'bun:test';

setDefaultTimeout(25_000);

import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sessionIdle } from '../scripts/lib/session.ts';
import { isolatedArgs } from './lib/fixture.ts';
import { runnerCase } from './lib/runner-fixture.ts';
import { finish, held, identity, managed, start } from './lib/runner-lifecycle-fixture.ts';

for (const host of ['claude', 'codex'] as const)
  test(`idle ${host} pins all accepted and unsafe replies`, async () => {
    const row = JSON.parse(await readFile(join(import.meta.dir, 'fixtures/herdr', `${host}.json`), 'utf8'));
    const id = row.result.agent.agent_session.value;
    for (const status of ['idle', 'done']) {
      row.result.agent.agent_status = status;
      expect(sessionIdle(row, host, id)).toBe(true);
    }
    const changes = [
      { agent_status: 'working' },
      { agent_status: 'blocked' },
      { agent_status: 'unknown' },
      { agent_status: undefined },
      { agent_status: 'ready' },
      { agent: 'other' },
      { agent_session: null },
      { agent_session: { agent: 'other', kind: 'id', value: id } },
      { agent_session: { agent: host, kind: 'name', value: id } },
      { agent_session: { agent: host, kind: 'id', value: '00000000-0000-4000-8000-000000000002' } },
    ];
    for (const change of changes) {
      const copy = structuredClone(row);
      Object.assign(copy.result.agent, change);
      expect(sessionIdle(copy, host, id)).toBe(false);
    }
  });
for (const [host, status] of [
  ['claude', 'blocked'],
  ['codex', 'unknown'],
] as const)
  test.concurrent(
    `late ${host} ${status} repeats resolver and checks idle again`,
    runnerCase(async (f) => {
      const r = await start(f, host);
      await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
      await f.put('status-during-resolver', status);
      await f.put('status', 'idle');
      await f.wait('decision-made');
      expect(await f.read('resolver-checks')).toBe('2');
      expect(await f.logs('prompts')).toEqual([]);
      await held(f, host);
      expect((await finish(f, r)).code).toBe(0);
    }, true),
  );
for (const host of ['claude', 'codex']) {
  for (const status of ['blocked', 'unknown'])
    test.concurrent(
      `saved ${host} ${status} stays open`,
      runnerCase(async (f) => {
        await f.put('initial-status', status);
        const r = await start(f, host);
        await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
        await Bun.sleep(150);
        expect(await f.logs('prompts')).toEqual([]);
        await held(f, host);
        expect((await finish(f, r)).code).toBe(0);
      }, true),
    );
  test.concurrent(
    `resume ${host} holds the issue without watcher, runner lock or refresh`,
    runnerCase(async (f) => {
      const r = await start(f, host);
      const blocked = await f.run(['--resume', '7'], { host, launcher: true });
      expect(blocked.code).toBe(1);
      expect(blocked.stderr).toContain('works on #7');
      expect(await f.has('resumed')).toBe(false);
      await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
      expect((await finish(f, r)).code).toBe(0);
      await f.put('updates');
      await f.put('herdr-calls');
      await f.put('hold-resume');
      const resumed = f.start(['--resume', '7'], { host, env: managed });
      await f.wait('resumed');
      await held(f, host);
      expect(await f.logs('updates')).toEqual([]);
      expect(await f.logs('herdr-calls')).toEqual([]);
      expect(await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks/runner'])).toBe('');
      await rm(join(f.state, 'hold-resume'));
      expect((await resumed.result).code).toBe(0);
    }, true),
  );
  test.concurrent(
    `handoff ${host} starts the next saved session exactly once`,
    runnerCase(async (f) => {
      const r = await start(f, host);
      await f.issue(7, 'enhancement', 'Spec: fixture', ['## Plan']);
      await f.put('status', 'idle');
      await f.wait('exit-submitted');
      await held(f, host);
      await f.put('finish-1');
      await f.wait('started-2');
      await identity(f, 2);
      await f.issue(7, 'enhancement', 'Spec: fixture', ['## Plan'], 'closed');
      await f.put('finish-2');
      expect((await r.result).code).toBe(0);
      expect(await f.read('count')).toBe('2');
    }, true),
  );
}
for (const [host, status] of [
  ['claude', 'blocked'],
  ['codex', 'unknown'],
] as const)
  test.concurrent(
    `after_wait ${host} ${status} blocks exit`,
    runnerCase(async (f) => {
      const r = await start(f, host);
      await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
      await f.put('status-after-wait', status);
      await f.put('status', 'idle');
      await f.wait('wait-returned');
      await Bun.sleep(150);
      expect(await f.logs('prompts')).toEqual([]);
      await held(f, host);
      expect((await finish(f, r)).code).toBe(0);
    }, true),
  );
for (const [host, guard] of [
  ['claude', 'unchanged'],
  ['claude', 'dirty'],
  ['codex', 'landing'],
  ['codex', 'missing'],
] as const)
  test.concurrent(
    `guard ${host} ${guard} blocks exit`,
    runnerCase(async (f) => {
      const r = await start(f, host);
      if (guard !== 'unchanged') await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
      if (guard === 'dirty') {
        await f.git(['worktree', 'add', '-q', '-b', 'fix/7-fixture', join(f.repo, '.claude/worktrees/7-fixture')]);
        await writeFile(join(f.repo, '.claude/worktrees/7-fixture/new'), 'dirty');
      }
      if (guard === 'missing') await rm(join(f.plugin, 'scripts/next-step.ts'));
      let landingPid = 0;
      if (guard === 'landing') {
        const entry = await f.write('land.ts', 'await Bun.sleep(30_000);');
        const { spawn } = await import('node:child_process');
        const child = spawn(process.execPath, [...isolatedArgs, entry], { stdio: 'ignore' });
        if (!child.pid) throw new Error('landing did not start');
        landingPid = child.pid;
        await writeFile(join(f.repo, '.git/celetis-flow/land-7.lock'), String(landingPid));
      }
      try {
        await f.put('status', 'idle');
        await f.wait('wait-returned');
        if (guard === 'missing') {
          const deadline = performance.now() + 5000;
          while (!r.output().stdout.includes('the plugin version of this runner was removed')) {
            if (performance.now() > deadline) throw new Error('stale diagnosis did not appear');
            await Bun.sleep(10);
          }
        } else await f.wait('runner-waiting');
        expect(await f.logs('prompts')).toEqual([]);
        await held(f, host);
        const result = await finish(f, r);
        if (guard === 'landing') {
          expect(result.stdout).toContain('stop the landing of #7 runs; wait until scripts/celetis land ends');
          expect(await f.logs<string[]>('herdr-calls')).toContainEqual([
            'agent',
            'wait',
            'w1:p1',
            '--until',
            'working',
            '--until',
            'blocked',
            '--timeout',
            '5000',
          ]);
        }
        if (guard === 'missing')
          expect(r.output().stdout).toContain('the plugin version of this runner was removed after an update');
      } finally {
        if (landingPid) process.kill(landingPid, 'SIGKILL');
      }
    }, true),
  );
for (const [host, status, result] of [
  ['claude', 'idle', 'accepted'],
  ['claude', 'done', 'failed'],
  ['codex', 'idle', 'failed'],
  ['codex', 'done', 'accepted'],
] as const)
  test.concurrent(
    `ending ${host} ${status} ${result} waits for foreground exit`,
    runnerCase(async (f) => {
      const r = await start(f, host);
      if (result === 'failed') await f.put('prompt-fail');
      await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
      await f.put('status', status);
      await f.wait('exit-submitted');
      await held(f, host);
      expect((await f.logs('prompts')).length).toBe(1);
      expect((await finish(f, r)).code).toBe(0);
    }, true),
  );
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
  test.concurrent(
    `term ${signal} holds lock until the foreground exits`,
    runnerCase(async (f) => {
      const r = await start(f, 'codex');
      await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
      r.child.kill(signal);
      await Bun.sleep(100);
      await held(f, 'codex');
      const expected = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 }[signal];
      expect((await finish(f, r)).code).toBe(expected);
    }, true),
  );
test.concurrent(
  'crash preserves exit status 23 without a no-progress row',
  runnerCase(async (f) => {
    const r = await start(f, 'claude');
    await f.put('exit', '23');
    const result = await finish(f, r);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('session exited with status 23');
    expect(await Bun.file(join(f.repo, '.git/celetis-flow/no-progress')).exists()).toBe(false);
  }, true),
);
