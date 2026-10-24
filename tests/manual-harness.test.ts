import { expect, test } from 'bun:test';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './lib/custom-fixture.ts';
import { command } from './lib/fixture.ts';
import { manualFixture } from './lib/manual-fixture.ts';

async function run(body: (f: Awaited<ReturnType<typeof manualFixture>>) => Promise<void>) {
  const f = await manualFixture();
  try {
    await body(f);
  } finally {
    await f.cleanup();
  }
}
for (const host of ['claude', 'codex'])
  test(`${host} runs all applicable scenarios and accepts fenced exact stops`, async () =>
    run(async (f) => {
      for (const style of ['', 'fenced-named']) {
        const out = await f.bun(f.step, ['--agent', host], { cwd: f.repo, env: { ...f.env, MANUAL_STYLE: style } });
        expect(out.code).toBe(0);
        expect(out.stdout.match(/^PASS: case /gm)).toHaveLength(host === 'codex' ? 38 : 37);
        expect(out.stdout).toContain(`PASS (${host}): ${host === 'codex' ? 38 : 37} cases`);
      }
    }));
for (const host of ['claude', 'codex'])
  for (const folder of ['', 'area/sub'])
    test(`${host} preserves ordered product instructions from ${folder || 'root'}`, async () =>
      run(async (f) => {
        const evidence = join(f.dir, 'evidence');
        const cwd = join(f.repo, folder);
        const out = await f.bun(f.step, ['--agent', host, '--output-dir', evidence], {
          cwd,
          env: { ...f.env, MANUAL_INPUTS: evidence },
        });
        expect(out.code).toBe(0);
        const files = (await readdir(evidence)).filter((name) => name.startsWith('received-'));
        expect(files).toHaveLength(host === 'codex' ? 38 : 37);
        const expected = [
          'Keep PRODUCT_ROOT_21 open when Verify cannot run.',
          ...(folder
            ? ['Check PRODUCT_AREA_21 before a landing.', 'Wait for PRODUCT_SUBFOLDER_21 when approval is missing.']
            : []),
        ];
        for (const file of [...files, 'product-context.md']) {
          const text = await readFile(join(evidence, file), 'utf8');
          let previous = -1;
          for (const line of expected) {
            const at = text.indexOf(line);
            expect(at).toBeGreaterThan(previous);
            previous = at;
          }
          expect(text).not.toMatch(/OUTSIDE_PRODUCT_21|UNRELATED_SUBFOLDER_21/);
          if (!folder) expect(text).not.toMatch(/PRODUCT_AREA_21|PRODUCT_SUBFOLDER_21/);
          if (file === 'received-13-step')
            expect(text).toContain('For this case, return shell commands and the final Then line only.');
          if (file === 'received-20-step') {
            expect(text).toContain('For this case, answer with these six lines only');
            expect(text).toContain('no tool of this session reaches GitHub');
          }
        }
        const context = JSON.parse(await readFile(join(evidence, 'product-context.json'), 'utf8'));
        expect(context.cwd).toBe(cwd);
        expect(context.root).toBe(f.repo);
        expect(context.sources).toHaveLength(expected.length);
        const paths = [
          join(f.repo, 'AGENTS.md'),
          ...(folder ? [join(f.repo, 'area/AGENTS.md'), join(f.repo, 'area/sub/AGENTS.md')] : []),
        ];
        for (let i = 0; i < paths.length; i++) {
          const source = context.sources[i];
          expect(source.path).toBe(paths[i]);
          const bytes = await readFile(join(evidence, source.snapshot), 'utf8');
          expect(bytes).toBe(await readFile(paths[i] ?? '', 'utf8'));
          expect(source.sha256).toBe(sha256(bytes));
        }
      }));
test('nested linked checkout excludes physical parent instructions', async () =>
  run(async (f) => {
    for (const args of [
      ['add', '.'],
      ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'],
      ['worktree', 'add', '-q', '--detach', join(f.repo, '.claude/worktrees/lane')],
    ])
      expect((await command('git', args, { cwd: f.repo, env: f.env })).code).toBe(0);
    await f.write('repo dir/.claude/worktrees/lane/AGENTS.md', 'Apply LINKED_PRODUCT_21 to this checkout.\n');
    const evidence = join(f.dir, 'linked-context');
    expect(
      (
        await f.bun(f.step, ['--agent', 'codex', '--output-dir', evidence], {
          cwd: join(f.repo, '.claude/worktrees/lane'),
          env: f.env,
        })
      ).code,
    ).toBe(0);
    const prompt = await readFile(join(evidence, 'in-1-step'), 'utf8');
    expect(prompt).toContain('LINKED_PRODUCT_21');
    expect(prompt).not.toMatch(/PRODUCT_ROOT_21|OUTSIDE_PRODUCT_21/);
  }));
test('no product instructions is explicit', async () =>
  run(async (f) => {
    const cwd = join(f.dir, 'empty');
    await mkdir(cwd);
    await command('git', ['init', '-q'], { cwd, env: f.env });
    const evidence = join(f.dir, 'empty-context');
    expect((await f.bun(f.step, ['--agent', 'codex', '--output-dir', evidence], { cwd, env: f.env })).code).toBe(0);
    expect(JSON.parse(await readFile(join(evidence, 'product-context.json'), 'utf8')).sources).toEqual([]);
    expect(await readFile(join(evidence, 'in-1-step'), 'utf8')).toContain('No product AGENTS.md was found.');
  }));
for (const host of ['claude', 'codex'])
  test(`${host} stops on unreadable product instructions before client startup`, async () =>
    run(async (f) => {
      const cwd = join(f.dir, 'unreadable');
      await mkdir(join(cwd, 'AGENTS.md'), { recursive: true });
      await command('git', ['init', '-q'], { cwd, env: f.env });
      const calls = join(f.dir, 'calls');
      const out = await f.bun(f.step, ['--agent', host], { cwd, env: { ...f.env, MANUAL_CALLS: calls } });
      expect(out.code).toBe(2);
      expect(out.stderr).toContain('cannot read product instructions');
      expect(await Bun.file(calls).exists()).toBe(false);
    }));
test('Codex reports completed reconnects and exact form errors at the public entry', async () =>
  run(async (f) => {
    let out = await f.bun(f.step, ['--agent', 'codex', '--only', '4:step'], {
      cwd: f.repo,
      env: { ...f.env, MANUAL_FAULT: 'reconnect' },
    });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('WARN: case 4 step recovered 1 service event(s)');
    out = await f.bun(f.step, ['--agent', 'codex', '--only', '20:step'], {
      cwd: f.repo,
      env: { ...f.env, MANUAL_FAULT: 'form-two-faults' },
    });
    expect(out.code).toBe(1);
    expect(out.stdout).toContain('FAIL: case 20 step: missing "Fallback: NONE", missing "Issue: NOT POSTED"');
  }));

test('product root keeps a trailing space in its path', async () =>
  run(async (f) => {
    const cwd = join(f.dir, 'product '),
      evidence = join(f.dir, 'trailing-context');
    await mkdir(cwd);
    await command('git', ['init', '-q'], { cwd, env: f.env });
    const out = await f.bun(f.step, ['--agent', 'codex', '--only', '1:step', '--output-dir', evidence], {
      cwd,
      env: f.env,
    });
    expect(out.code).toBe(0);
    expect(JSON.parse(await readFile(join(evidence, 'product-context.json'), 'utf8')).root).toBe(cwd);
  }));
