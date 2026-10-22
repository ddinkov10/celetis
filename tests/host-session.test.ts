import { expect, setDefaultTimeout, test } from 'bun:test';

setDefaultTimeout(25_000);

import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readSession, serializeSession, writeSession } from '../scripts/lib/session.ts';
import { command, isolatedArgs } from './lib/fixture.ts';
import { type RunnerFixture, runnerCase, stepText, uuid } from './lib/runner-fixture.ts';

const managed = { HERDR_ENV: '1', HERDR_PANE_ID: 'w1:p1' };
const hosts = ['claude', 'codex'] as const;
const steps = ['triage', 'feature', 'bug', 'chore', 'hotfix', 'plan', 'implement'];
const resumeArgs = (host: string, id = uuid) => (host === 'codex' ? ['resume', '--no-daemon', id] : ['--resume', id]);
async function saved(f: RunnerFixture, host: string, step = 'plan', extra: NodeJS.ProcessEnv = {}) {
  await f.put('step', step);
  const result = await f.run(['7'], { host, env: { ...managed, ...extra } });
  expect(result.code, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(await f.record()).toEqual({
    schema: 1,
    host,
    issue: 7,
    step: step === 'feature' ? 'specify' : step,
    checkout: f.repo,
    session_id: uuid,
  });
}

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
      expect((await f.logs('calls'))[0]).toMatchObject({ host, args: resumeArgs(host) });
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
      expect((await f.logs('calls'))[0]).toMatchObject({ host, args: resumeArgs(host) });
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
    `old_pane_identity ${host} is replaced by the current UUID`,
    runnerCase(async (f) => {
      await f.put('prior-id', '00000000-0000-4000-8000-000000000001');
      await saved(f, host);
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
  test.concurrent(
    `invalid_panes ${host} stop before updates, sessions and herdr`,
    runnerCase(async (f) => {
      for (const pane of [
        undefined,
        '',
        'invalid',
        'w:p1',
        'w1:p',
        'w1:t1',
        'w1:p1:extra',
        '-w1:p1',
        ' w1:p1',
        'w1:p1 ',
        'w1:p1/x',
        'w1:p1\n',
        'w1:p1\t',
      ]) {
        const r = await f.run(['7'], { host, env: { HERDR_ENV: '1', HERDR_PANE_ID: pane } });
        expect(r.code).toBe(1);
        expect(r.stderr).toContain('HERDR_ENV=1 needs a valid HERDR_PANE_ID; start from a herdr pane');
        expect(await f.logs('updates')).toEqual([]);
        expect(await f.logs('herdr-calls')).toEqual([]);
        expect(await f.logs('calls')).toEqual([]);
      }
    }),
  );
  test.concurrent(
    `project_default ${host} and saved host survive a YAML preference change`,
    runnerCase(async (f) => {
      const other = host === 'claude' ? 'codex' : 'claude';
      await f.config(`landing: merge\nhost: ${host}\n`);
      await f.git(['add', '.']);
      await f.git(['commit', '-qm', 'host']);
      await f.put('change-host', other);
      const r = await f.run(['7'], { launcher: true, env: { ...managed, CELETIS_AGENT: undefined } });
      expect(r.code, r.stderr).toBe(0);
      expect((await f.record()).host).toBe(host);
      expect(await readFile(join(f.repo, '.celetis.yaml'), 'utf8')).toContain(`host: ${other}`);
      await f.put('calls');
      const resumed = await f.run(['--resume', '7'], { launcher: true, env: { CELETIS_AGENT: undefined } });
      expect(resumed.code, resumed.stderr).toBe(0);
      expect((await f.logs('calls'))[0]).toMatchObject({ host, args: resumeArgs(host) });
      const wrong = await command(
        process.execPath,
        [...isolatedArgs, join(f.plugin, 'scripts/launcher.ts'), '--agent', other, 'celetis-flow', '--resume', '7'],
        { cwd: f.repo, env: f.env },
      );
      expect(wrong.code).toBe(1);
      expect(wrong.stderr).toContain(`recorded host is ${host}`);
    }),
  );
}

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

for (const [host, step] of [
  ['claude', 'triage'],
  ['claude', 'bug'],
  ['claude', 'hotfix'],
  ['claude', 'implement'],
  ['codex', 'feature'],
  ['codex', 'chore'],
  ['codex', 'plan'],
] as const)
  test.concurrent(
    `exact_resume ${host} ${step}`,
    runnerCase(async (f) => {
      await saved(f, host, step);
      await f.put('calls');
      await f.put('herdr-calls');
      await f.put('updates');
      const r = await f.run(['--resume', '7'], { host: host === 'claude' ? 'codex' : 'claude', env: managed });
      expect(r.code, r.stderr).toBe(0);
      const resumeCalls = (await f.logs('calls')).map(({ host, cwd, args }) => ({ host, cwd, args }));
      const exactSavedHostInvocation = { host, cwd: f.repo, args: resumeArgs(host) };
      expect(resumeCalls).toEqual([exactSavedHostInvocation]);
      expect(await f.logs('herdr-calls')).toEqual([]);
      expect(await f.logs('updates')).toEqual([]);
    }),
  );
for (const change of [{ host: 'claude' }, { session_id: '00000000-0000-4000-8000-000000000001' }] as const)
  test.concurrent(
    `replaced_record ${JSON.stringify(change)} refuses discovery race`,
    runnerCase(async (f) => {
      const record = {
        schema: 1 as const,
        host: 'codex' as const,
        issue: 7,
        step: 'plan' as const,
        checkout: f.repo,
        session_id: uuid,
      };
      await writeSession(f.repo, record);
      await f.put('replace-record', JSON.stringify({ ...record, ...change }));
      const r = await f.run(['--resume', '7'], { host: 'codex', launcher: true });
      expect(r.code).toBe(1);
      expect(r.stderr).toContain('session record changed during package discovery');
      expect(await f.logs('calls')).toEqual([]);
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
test.concurrent(
  'existing_developer keeps literal instructions and appends exact step text',
  runnerCase(async (f) => {
    const existing = 'Keep my instructions and literal $(value).\n\n';
    await f.put('developer', existing);
    expect((await f.run(['7'], { host: 'codex' })).code).toBe(0);
    expect(((await f.logs('calls'))[0]?.args as string[] | undefined)?.[2]).toBe(
      `developer_instructions=${JSON.stringify(`${existing}\n\n${stepText}`)}`,
    );
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
test.concurrent(
  'bad_records reject each old mutation and malformed root',
  runnerCase(async (f) => {
    const valid = {
      schema: 1 as const,
      host: 'codex' as const,
      issue: 7,
      step: 'plan' as const,
      checkout: f.repo,
      session_id: uuid,
    };
    await writeSession(f.repo, valid);
    const rows: unknown[] = [
      { ...valid, schema: 0 },
      { ...valid, host: 'other' },
      { ...valid, step: 'feature' },
      { ...valid, issue: 8 },
      { ...valid, issue: '7' },
      { ...valid, checkout: '/other' },
      { ...valid, session_id: '--last' },
      { ...valid, session_id: 7 },
      { ...valid, extra: true },
      Object.fromEntries(Object.entries(valid).filter(([key]) => key !== 'schema')),
      { schema: 0 },
      {},
      [],
      { schema: 1, host: 'other' },
    ];
    for (const row of rows) {
      await writeFile(join(f.repo, '.git/celetis-flow/sessions/7.json'), JSON.stringify(row));
      await expect(readSession(f.repo, 7)).rejects.toThrow('invalid or obsolete session record');
    }
    await writeFile(join(f.repo, '.git/celetis-flow/sessions/7.json'), 'invalid');
    await expect(readSession(f.repo, 7)).rejects.toThrow('invalid or obsolete session record');
    expect(serializeSession(valid)).toBe(
      JSON.stringify({ checkout: f.repo, host: 'codex', issue: 7, schema: 1, session_id: uuid, step: 'plan' }),
    );
  }),
);
test.concurrent(
  'name_based_resume refuses an obsolete no-progress row without effects',
  runnerCase(async (f) => {
    await mkdir(join(f.repo, '.git/celetis-flow'), { recursive: true });
    await writeFile(join(f.repo, '.git/celetis-flow/no-progress'), '7\trun /celetis:plan #7\n');
    const r = await f.run(['--resume', '7']);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('no current session record');
    for (const name of ['calls', 'herdr-calls', 'gh-calls', 'updates']) expect(await f.logs(name)).toEqual([]);
    expect(await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks'])).toBe('');
  }),
);

test.concurrent(
  'codex_only and launcher_resume use the saved host with no Claude and ignore obsolete Git defaults',
  runnerCase(async (f) => {
    const bin = join(f.dir, 'codex-only');
    await mkdir(bin);
    for (const name of ['git', 'ps']) {
      const executable = Bun.which(name);
      if (!executable) throw new Error(`${name} is missing`);
      await symlink(executable, join(bin, name));
    }
    for (const name of ['codex', 'gh', 'herdr']) await symlink(join(f.dir, 'bin', name), join(bin, name));
    f.env.PATH = bin;
    await saved(f, 'codex');
    await f.put('calls');
    for (const preferred of ['claude', 'codex']) {
      await f.config(`landing: merge\nhost: ${preferred}\n`);
      const r = await f.run(['--resume', '7'], {
        launcher: true,
        env: {
          CELETIS_AGENT: undefined,
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'celetis-flow.agent',
          GIT_CONFIG_VALUE_0: preferred,
        },
      });
      expect(r.code, r.stderr).toBe(0);
    }
    expect((await f.logs('calls')).map((row) => ({ host: row.host, args: row.args }))).toEqual([
      { host: 'codex', args: resumeArgs('codex') },
      { host: 'codex', args: resumeArgs('codex') },
    ]);
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
