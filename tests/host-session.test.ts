import { expect, setDefaultTimeout, test } from 'bun:test';
import { join } from 'node:path';
import { codexSourceArgs, hosts } from './lib/host-session-fixture.ts';
import { runnerCase, stepText } from './lib/runner-fixture.ts';

setDefaultTimeout(25_000);
const steps = ['triage', 'feature', 'bug', 'chore', 'hotfix', 'plan', 'implement'];

for (const host of hosts)
  for (const step of steps)
    test.concurrent(
      `launch ${host} ${step} preserves args, literal instructions, stdin and exact schema`,
      runnerCase(async (f) => {
        await f.put('step', step);
        const result = await f.run(['7'], { host });
        expect(result.code, result.stderr).toBe(0);
        const expected =
          host === 'claude'
            ? [
                '--permission-mode',
                'auto',
                '-n',
                `#7 ${step === 'feature' ? 'specify' : step}`,
                ...(step === 'feature' ? [] : ['--append-system-prompt-file', join(f.plugin, 'step-prompt.md')]),
                `/celetis:${step} #7`,
              ]
            : [
                ...codexSourceArgs(f.plugin),
                '--no-daemon',
                ...(step === 'feature' ? [] : ['-c', `developer_instructions=${JSON.stringify(stepText)}`]),
                `Use the celetis:${step} skill for #7. Complete its Host entry startup reads before any response, including commentary.`,
              ];
        expect(await f.logs('calls')).toEqual([expect.objectContaining({ host, cwd: f.repo, args: expected })]);
        expect(await f.logs<string>('stdin')).toEqual(['terminal input']);
        const record = await f.record();
        expect(Object.keys(record).sort()).toEqual(['checkout', 'host', 'issue', 'schema', 'session_id', 'step']);
        expect(record).toEqual({
          schema: 1,
          host,
          issue: 7,
          step: step === 'feature' ? 'specify' : step,
          checkout: f.repo,
          session_id: null,
        });
        expect(await f.has('substitution')).toBe(false);
        expect(await f.has('backticks')).toBe(false);
      }),
    );

for (const host of hosts) {
  test.concurrent(
    `recovery ${host} needs a verified saved turn`,
    runnerCase(async (f) => {
      expect((await f.run(['7'], { host })).code).toBe(0);
      const r = await f.run(['--resume', '7'], { host });
      expect(r.code).toBe(1);
      expect(r.stderr).toContain('herdr identity');
      expect(r.stderr).toContain(host === 'claude' ? 'claude --resume' : 'codex resume --no-daemon');
    }),
  );
  test.concurrent(
    `startup_exit ${host} is never no progress`,
    runnerCase(async (f) => {
      await f.put('exit', '1');
      const r = await f.run(['7'], { host });
      expect(r.code).toBe(1);
      expect(r.stderr).toContain('session exited with status 1');
      expect(await Bun.file(join(f.repo, '.git/celetis-flow/no-progress')).exists()).toBe(false);
    }),
  );
  for (const environment of [undefined, '', '0'])
    test.concurrent(
      `outside_herdr ${host} ${String(environment)}`,
      runnerCase(async (f) => {
        const r = await f.run(['7'], { host, env: { HERDR_ENV: environment, HERDR_PANE_ID: 'wW:pE' } });
        expect(r.code, r.stderr).toBe(0);
        expect(await f.logs('herdr-calls')).toEqual([]);
        expect((await f.record()).session_id).toBeNull();
      }),
    );
}

test.concurrent(
  'existing_developer keeps literal instructions and appends exact step text',
  runnerCase(async (f) => {
    const existing = 'Keep my instructions and literal $(value).\n\n';
    await f.put('developer', existing);
    expect((await f.run(['7'], { host: 'codex' })).code).toBe(0);
    expect((await f.logs('calls'))[0]?.args).toEqual([
      ...codexSourceArgs(f.plugin),
      '--no-daemon',
      '-c',
      `developer_instructions=${JSON.stringify(`${existing}\n\n${stepText}`)}`,
      'Use the celetis:plan skill for #7. Complete its Host entry startup reads before any response, including commentary.',
    ]);
  }),
);
test.concurrent(
  'invalid_config cannot create a session or record',
  runnerCase(async (f) => {
    await f.put('config-invalid');
    const r = await f.run(['7'], { host: 'codex' });
    expect(r.code).toBe(1);
    expect(await f.logs('calls')).toEqual([]);
    expect(await Bun.file(join(f.repo, '.git/celetis-flow/sessions/7.json')).exists()).toBe(false);
  }),
);
