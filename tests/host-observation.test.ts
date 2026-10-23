import { expect, setDefaultTimeout, test } from 'bun:test';
import { hosts, managed, resumeArgs, saved } from './lib/host-session-fixture.ts';
import { runnerCase } from './lib/runner-fixture.ts';

setDefaultTimeout(25_000);

for (const [host, status] of [
  ['claude', 'idle'],
  ['claude', 'working'],
  ['claude', 'unknown'],
  ['codex', 'done'],
  ['codex', 'blocked'],
] as const)
  test.concurrent(
    `saved_status ${host} ${status}`,
    runnerCase(async (f) => {
      await f.put('status', status);
      await saved(f, host);
      await f.put('calls');
      const r = await f.run(['--resume', '7'], { host });
      expect(r.code, r.stderr).toBe(0);
      expect((await f.logs('calls'))[0]).toMatchObject({ host, args: resumeArgs(host, f.plugin) });
    }),
  );
for (const [host, pane] of [
  ['claude', 'w1:p1'],
  ['claude', 'w1:pE'],
  ['claude', 'wa0:pz9'],
  ['codex', 'wW:p14'],
  ['codex', 'wW:pE'],
] as const)
  test.concurrent(
    `valid_pane ${host} ${pane}`,
    runnerCase(async (f) => {
      await saved(f, host, 'plan', { HERDR_PANE_ID: pane });
      expect(await f.logs<string[]>('herdr-calls')).toContainEqual(['agent', 'get', pane]);
    }),
  );

for (const host of hosts) {
  test.concurrent(
    `prior_host ${host}`,
    runnerCase(async (f) => {
      await f.put('prior-id', '00000000-0000-4000-8000-000000000001');
      await f.put('prior-host', host === 'claude' ? 'codex' : 'claude');
      await saved(f, host);
      await f.put('calls');
      const r = await f.run(['--resume', '7'], { host: host === 'claude' ? 'codex' : 'claude' });
      expect(r.code, r.stderr).toBe(0);
      expect((await f.logs('calls'))[0]).toMatchObject({ host, args: resumeArgs(host, f.plugin) });
    }),
  );
  test.concurrent(
    `old_session ${host} rejects a saved turn from before startup`,
    runnerCase(async (f) => {
      await f.put('old-session');
      const r = await f.run(['7'], { host, env: managed });
      expect(r.code).toBe(1);
      expect((await f.record()).session_id).toBeNull();
    }),
  );
  test.concurrent(
    `old_pane_identity ${host} is replaced by the current UUID`,
    runnerCase(async (f) => {
      await f.put('prior-id', '00000000-0000-4000-8000-000000000001');
      await saved(f, host);
    }),
  );
}
