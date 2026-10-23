import { expect, test } from 'bun:test';
import { cp, lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readConfig } from '../scripts/lib/config.ts';
import { boardFixture, invoke } from './lib/board-fixture.ts';
import { command, root } from './lib/fixture.ts';

test('board adapter keeps its stdin contract, main path, port, child status, and clean PATH', async () => {
  const f = await boardFixture();
  try {
    const expected = {
      data: ['scripts/celetis', 'celetis-flow', '--board'],
      run: ['scripts/celetis', '--agent', '{agent}', 'celetis-flow', '{n}'],
      resume: ['scripts/celetis', 'celetis-flow', '--resume', '{n}'],
      port: 4404,
    };
    const before = await f.git('status', '--porcelain', '--untracked-files=all');
    expect(await f.run()).toEqual({ code: 0, stdout: '', stderr: '' });
    expect((await f.captured()).config).toEqual(expected);
    expect((await f.captured()).argv).toEqual([join(f.plugin, 'board/cli.ts'), '--config-stdin']);
    expect((await f.captured()).cwd).toBe(f.repo);
    expect(await Bun.file(join(f.repo, '.claude/celetis-flow')).exists()).toBe(false);
    expect(await f.git('status', '--porcelain', '--untracked-files=all')).toBe(before);
    expect((await f.run(join(f.repo, 'sub'))).code).toBe(0);
    expect((await f.captured()).cwd).toBe(f.repo);
    expect((await f.captured()).config.port).toBe(4404);
    await f.config('landing: pr\n');
    expect((await f.run()).code).toBe(0);
    expect((await f.captured()).config.port).toBe(4403);
    expect((await f.run(f.repo, { PORT: '4517' })).code).toBe(0);
    expect((await f.captured()).port).toBe('4517');
    expect((await f.captured()).config.port).toBe(4403);
    expect((await f.run(f.repo, { BOARD_CHILD_STATUS: '7' })).code).toBe(7);
    const planted = join(f.repo, 'node_modules/.bin');
    await mkdir(planted, { recursive: true });
    for (const name of ['bun', 'git']) {
      const source = await readFile(
        await f.stub(name, `await Bun.write(${JSON.stringify(join(f.dir, 'planted'))},'started');process.exit(99);`),
        'utf8',
      );
      await f.write(`repo dir/node_modules/.bin/${name}`, source, 0o755);
    }
    expect((await f.run(f.repo, { PATH: `${planted}:${process.env.PATH}` })).code).toBe(0);
    expect((await f.captured()).path.split(':')).not.toContain(planted);
    expect(await Bun.file(join(f.dir, 'planted')).exists()).toBe(false);
    await rm(join(f.repo, 'node_modules'), { recursive: true });
    await f.stub(
      'git',
      `const {spawnSync}=await import('node:child_process');const r=spawnSync('/usr/bin/git',process.argv.slice(2),{stdio:'inherit'});process.exitCode=r.status??1;`,
    );
    expect((await f.run(f.repo, { PATH: join(f.dir, 'bin') })).code).toBe(0);
  } finally {
    await f.cleanup();
  }
}, 29_000);

test('board adapter refuses a missing entry, lane starts, extra arguments, and invalid main YAML', async () => {
  const f = await boardFixture();
  const refused = async (cwd = f.repo, args: string[] = []) => {
    await rm(f.capture, { force: true });
    const result = await f.run(cwd, {}, args);
    expect(result.code).not.toBe(0);
    expect(await Bun.file(f.capture).exists()).toBe(false);
    return result;
  };
  try {
    await rm(join(f.plugin, 'board/cli.ts'));
    expect(await refused()).toEqual({
      code: 1,
      stdout: '',
      stderr: `celetis-board: the plugin has no board/cli.ts: ${f.plugin}; reinstall the plugin\n`,
    });
    await f.write('installed package/board/cli.ts', '');
    for (const folder of [f.lane, join(f.lane, 'sub')]) expect((await refused(folder)).stderr).toContain(f.repo);
    expect((await refused(f.repo, ['extra'])).code).toBe(2);
    for (const source of [null, 'landing: [\n', 'landing: pr\nboard: {other: 4404}\n']) {
      if (source === null) await rm(join(f.repo, '.celetis.yaml'));
      else await f.config(source);
      expect((await refused()).stderr).toContain(join(f.repo, '.celetis.yaml'));
    }
    expect((await lstat(join(root, '.celetis.yaml'))).isFile()).toBe(true);
    expect((await lstat(join(root, '.celetis.yaml'))).isSymbolicLink()).toBe(false);
    const tracked = await command(
      'git',
      ['ls-files', '--', '.claude/celetis-flow', ':!.claude/celetis-flow/wiring.json'],
      { cwd: root },
    );
    expect(tracked.stdout).toBe('');
    const config = readConfig(root);
    expect(config.board?.port).toBe(4404);
    for (const step of ['triage', 'specify', 'bug', 'chore', 'hotfix', 'plan', 'implement'] as const)
      expect(config.gates?.[step] ?? 'me').toBe('me');
  } finally {
    await f.cleanup();
  }
}, 29_000);

test('the board adapter checks the real producer and refuses executable escapes without running them', async () => {
  const f = await boardFixture();
  try {
    const result = await f.run(f.repo, { BOARD_CHECK: '1' });
    expect(result).toEqual({ code: 0, stdout: 'agent-board: contract 1, 0 issues, ok\n', stderr: '' });
    expect(await readFile(f.env.BOARD_PRODUCER_LOG as any, 'utf8')).toBe('["celetis-flow","--board"]\n');
    expect(await Bun.file(join(f.repo, '.claude/celetis-flow')).exists()).toBe(false);
    const saved = join(f.dir, 'saved-launcher');
    const target = join(f.repo, 'scripts/celetis');
    await cp(target, saved);
    for (const kind of ['external', 'lane', 'missing', 'mode', 'directory']) {
      await rm(target, { recursive: true, force: true });
      if (kind === 'external') await symlink(saved, target);
      if (kind === 'lane') {
        await cp(saved, join(f.lane, 'launcher'));
        await symlink(join(f.lane, 'launcher'), target);
      }
      if (kind === 'mode') {
        await writeFile(target, await readFile(saved), { mode: 0o644 });
      }
      if (kind === 'directory') await mkdir(target);
      await rm(f.env.BOARD_PRODUCER_LOG as any, { force: true });
      const actual = await f.run(f.repo, { BOARD_CHECK: '1' });
      expect(actual.code, kind).toBe(1);
      expect(actual.stderr, kind).toContain('config stdin:');
      expect(await Bun.file(f.env.BOARD_PRODUCER_LOG as any).exists(), kind).toBe(false);
    }
    await rm(target, { recursive: true, force: true });
    await cp(saved, target);
    for (const input of [
      '{',
      '{"unknown":true}',
      '{"data":[]}',
      '{"run":["scripts/celetis","{agent}"]}',
      '{"resume":["scripts/celetis","{agent}","{n}"]}',
      '{"port":0}',
    ]) {
      const actual = await invoke(join(root, 'board/cli.ts'), ['check', '--config-stdin'], f.repo, f.env, input);
      expect(actual.code, input).toBe(1);
      expect(actual.stderr, input).toContain('config stdin:');
    }
  } finally {
    await f.cleanup();
  }
}, 29_000);
