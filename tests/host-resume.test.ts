import { expect, setDefaultTimeout, test } from 'bun:test';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readSession, serializeSession, writeSession } from '../scripts/lib/session.ts';
import { command, isolatedArgs } from './lib/fixture.ts';
import { hosts, managed, resumeArgs, saved } from './lib/host-session-fixture.ts';
import { runnerCase, uuid } from './lib/runner-fixture.ts';

setDefaultTimeout(25_000);

for (const host of hosts) {
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
