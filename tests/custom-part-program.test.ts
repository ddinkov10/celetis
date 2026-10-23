import { expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { customNames, recording } from './lib/custom-fixture.ts';
import { customManualFixture } from './lib/manual-fixture.ts';

async function run(body: (f: Awaited<ReturnType<typeof customManualFixture>>) => Promise<void>) {
  const f = await customManualFixture();
  try {
    await body(f);
  } finally {
    await f.cleanup();
  }
}
for (const fault of ['', 'unrelated-block'])
  test(`${fault || 'valid'} custom run keeps exactly 97 generated artifacts`, async () =>
    run(async (f) => {
      const evidence = join(f.dir, 'evidence');
      const out = await f.bun(f.custom, ['--output-dir', evidence], {
        cwd: f.repo,
        env: { ...f.env, CUSTOM_FAULT: fault },
      });
      expect(out.code).toBe(fault ? 1 : 0);
      expect(out.stdout).toContain(fault ? 'FAIL: denied-read' : 'PASS: 24 native custom-entry cases');
      const files = await readdir(evidence);
      expect(files).toHaveLength(97);
      expect(files.filter((n) => n.endsWith('.jsonl'))).toHaveLength(24);
      for (const name of customNames)
        for (const suffix of ['input.json', 'jsonl', 'err', 'status']) expect(files).toContain(`${name}.${suffix}`);
      const input = JSON.parse(await readFile(join(evidence, 'denied-read.input.json'), 'utf8'));
      expect(input.goal).toBe('/celetis:guide see the next step of an issue');
      expect(input.metadataRecording).toBe(recording);
      expect(input.prompt).toBe(`${input.goal}\n\n${recording}`);
      expect(input.tools).toBe('Skill,Read,Glob,Grep');
      expect(input.settings.permissions.deny).toHaveLength(1);
      expect(await readFile(join(evidence, 'denied-read.status'), 'utf8')).toBe('0\n');
      const transition = JSON.parse(await readFile(join(evidence, 'enter-worktree.input.json'), 'utf8'));
      expect(transition.messages).toHaveLength(2);
      expect(transition.messages[0].message.content).toBe(transition.goal);
      expect(transition.goal).toContain('Then wait for my guide invocation');
      expect(transition.messages[1].message.content).toBe(
        `/celetis:guide see the next step of an issue\n\n${recording}`,
      );
      expect(recording).not.toMatch(/CUSTOM_|Emit tool calls|\//);
      const rows = (await readFile(join(evidence, 'enter-worktree.jsonl'), 'utf8'))
        .trim()
        .split('\n')
        .map((s) => JSON.parse(s));
      const turns = rows.filter((row) => row.type === 'result');
      expect(turns).toHaveLength(2);
      expect(new Set(turns.map((row) => row.session_id)).size).toBe(1);
      const source = JSON.parse(await readFile(join(evidence, 'no-shell.input.json'), 'utf8'));
      expect(source.config.path).toBe(`${source.cwd}/.celetis.yaml`);
      expect(source.config.source).toContain('custom:');
      expect(source.config.source).toContain('UNRELATED_CUSTOM_MUST_NOT_RUN');
      expect(source.config.source).toContain('SETUP_MUST_NOT_RUN');
      expect(source.config.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(source.pluginSources.length).toBeGreaterThanOrEqual(5);
      expect(files).toContain('version');
    }));
test('obsolete MCP flag stops with status 2 before a model client', async () =>
  run(async (f) => {
    const calls = join(f.dir, 'calls');
    const out = await f.bun(f.custom, ['--mcp-config', 'obsolete'], {
      cwd: f.repo,
      env: { ...f.env, CUSTOM_CALLS: calls },
    });
    expect(out.code).toBe(2);
    expect(out.stderr).toMatch(/^usage:/);
    expect(await Bun.file(calls).exists()).toBe(false);
  }));
for (const fault of ['client-exit', 'worktree-no-native-transition'])
  test(`${fault} preserves failed client evidence and status`, async () =>
    run(async (f) => {
      const name = fault === 'client-exit' ? 'no-shell' : 'enter-worktree',
        evidence = join(f.dir, 'evidence');
      const out = await f.bun(f.custom, ['--output-dir', evidence], {
        cwd: f.repo,
        env: { ...f.env, CUSTOM_PART_CASES: name, CUSTOM_FAULT: fault },
      });
      expect(out.code).toBe(2);
      expect(out.stdout).toContain(`ERROR: ${name}: client exited with status ${fault === 'client-exit' ? 7 : 2}`);
      expect(await readFile(join(evidence, `${name}.status`), 'utf8')).toBe(`${fault === 'client-exit' ? 7 : 2}\n`);
      expect(await readdir(evidence)).toHaveLength(5);
      if (fault === 'client-exit')
        expect(await readFile(join(evidence, 'no-shell.jsonl'), 'utf8')).toContain('CUSTOM_FROM_ROOT');
    }));
