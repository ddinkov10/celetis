import { expect, setDefaultTimeout, test } from 'bun:test';
import { join } from 'node:path';
import { hosts, managed } from './lib/host-session-fixture.ts';
import { runnerCase, uuid } from './lib/runner-fixture.ts';

setDefaultTimeout(25_000);

const failures: [string, string][] = [];
for (const host of hosts)
  for (const name of ['no-save', 'unsaved-blocked', 'unsaved-unknown', 'foreign-checkout', 'wrong-host'])
    failures.push([host, name]);
for (const name of ['no-id', 'stale-id', 'wrong-session-host', 'malformed-identity', 'invalid-status'])
  failures.push(['claude', name]);
for (const name of ['bad-id', 'bad-json', 'wrong-kind', 'missing-status']) failures.push(['codex', name]);
for (const [host, failure] of failures)
  test.concurrent(
    `identity_failure ${host} ${failure} preserves startup diagnostics and refuses resume`,
    runnerCase(async (f) => {
      if (failure === 'no-id') await f.put('id', '');
      else if (failure === 'bad-id') await f.put('id', '--last');
      else if (failure === 'stale-id') await f.put('prior-id', uuid);
      else if (failure.startsWith('unsaved-')) {
        await f.put('status', failure.slice(8));
        await f.put('no-save');
      } else if (failure === 'wrong-host') {
        const other = host === 'claude' ? 'codex' : 'claude';
        await f.put(
          'mutation',
          JSON.stringify({ agent: other, agent_session: { agent: other, kind: 'id', value: uuid } }),
        );
      } else if (failure === 'wrong-session-host')
        await f.put('mutation', JSON.stringify({ agent_session: { agent: 'other', kind: 'id', value: uuid } }));
      else if (failure === 'wrong-kind')
        await f.put('mutation', JSON.stringify({ agent_session: { agent: host, kind: 'name', value: uuid } }));
      else if (failure === 'malformed-identity') await f.put('mutation', JSON.stringify({ agent_session: 'invalid' }));
      else if (failure === 'missing-status') await f.put('mutation', JSON.stringify({ deleteStatus: true }));
      else if (failure === 'invalid-status') await f.put('mutation', JSON.stringify({ agent_status: 'ready' }));
      else await f.put(failure);
      const r = await f.run(['7'], { host, env: managed });
      expect(r.code, r.stderr).toBe(1);
      expect(r.stderr).toContain('startup');
      expect(r.stderr).toContain('Update, trust, or sign-in');
      expect(await Bun.file(join(f.repo, '.git/celetis-flow/no-progress')).exists()).toBe(false);
      expect((await f.run(['--resume', '7'], { host })).code).toBe(1);
    }),
  );

for (const failure of ['wrong-saved-id', 'ephemeral'] as const)
  test.concurrent(
    `codex_persistence ${failure}`,
    runnerCase(async (f) => {
      await f.put(failure);
      const r = await f.run(['7'], { host: 'codex', env: managed });
      expect(r.code).toBe(1);
      expect((await f.record()).session_id).toBeNull();
    }),
  );
for (const host of hosts)
  test.concurrent(
    `successful ${host} foreground exit cancels only the active watcher resolver`,
    runnerCase(async (f) => {
      await f.put('hold-session');
      await f.write(
        'installed package/scripts/next-step.ts',
        `import {existsSync,writeFileSync} from 'node:fs';import {join} from 'node:path';const state=process.env.RUNNER_TEST!;if(!existsSync(join(state,'started-1')))console.log('run /celetis:plan #7');else if(!existsSync(join(state,'watcher-resolver'))){writeFileSync(join(state,'watcher-resolver'),String(process.pid));await Bun.sleep(30_000);}else console.log('stop #7 is finished.');`,
      );
      const running = f.start(['7'], { host, env: managed });
      await f.wait('watcher-resolver');
      const resolver = Number(await f.read('watcher-resolver'));
      await f.put('finish-1');
      const result = await running.result;
      expect(result.code, result.stderr).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('celetis-flow: start: /celetis:plan #7\nceletis-flow: stop #7 is finished.\n');
      expect((await f.record()).session_id).toBe(uuid);
      expect(() => process.kill(resolver, 0)).toThrow();
      expect(await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks'])).toBe('');
    }),
  );

test.concurrent(
  'identity discovery keeps its 60 second deadline and startup trust diagnostic',
  runnerCase(async (f) => {
    await f.put('id', '');
    await f.put('hold-session');
    await f.put('skip-input');
    const entry = await f.write(
      'identity-clock.ts',
      `import {main} from ${JSON.stringify(join(f.plugin, 'scripts/celetis-flow.ts'))};const now=performance.now.bind(performance),sleep=Bun.sleep;let virtual=0;Object.defineProperty(performance,'now',{value:()=>now()+virtual});Bun.sleep=async ms=>{if(ms===1000){virtual+=60_000;return sleep(0);}return sleep(ms);};process.exitCode=await main(['7']);`,
    );
    const r = f.start(['7'], { entry, env: managed });
    const deadline = performance.now() + 5000;
    while (!r.output().stderr.includes('no saved turn with a verified identity after 60 seconds')) {
      if (performance.now() > deadline) throw new Error(`identity deadline did not fire: ${r.output().stderr}`);
      await Bun.sleep(10);
    }
    await f.put('finish-1');
    const result = await r.result;
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Check the version, trust, and sign-in prompts');
    expect((await f.record()).session_id).toBeNull();
  }),
);
