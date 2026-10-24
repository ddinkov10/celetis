import { expect, test } from 'bun:test';
import { cp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './lib/fixture.ts';
import { updateFixture } from './lib/plugin-update-fixture.ts';

test('Codex validates its native marketplace marker without accepting other local changes', async () => {
  const f = await updateFixture('codex');
  try {
    const path = join(f.plugin, '.codex-marketplace-install.json');
    const valid = await readFile(path, 'utf8');
    const check = () => f.update(['check']);
    const same = await check();
    expect(same.code, same.stderr).toBe(0);
    for (const invalid of [
      { source: `${f.source}/other` },
      { revision: '1'.repeat(40) },
      { source_type: 'local' },
      { sparse_paths: 'invalid' },
      { ref_name: 7 },
      { schema_version: 1 },
    ]) {
      await writeFile(path, JSON.stringify({ ...JSON.parse(valid), ...invalid }));
      const result = await check();
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('native marketplace metadata');
      expect(result.stdout).toBe('');
    }
    await f.write('marker.json', valid);
    await rm(path);
    await symlink(join(f.dir, 'marker.json'), path);
    const link = await check();
    expect(link.code).toBe(1);
    expect(link.stderr).toContain('native marketplace metadata');
    await rm(path);
    await writeFile(path, valid);
    await writeFile(join(f.plugin, 'unrelated.txt'), 'local');
    expect((await check()).stderr).toContain('dirty');
    await rm(join(f.plugin, 'unrelated.txt'));
    await writeFile(join(f.plugin, 'step-prompt.md'), 'local');
    expect((await check()).stderr).toContain('dirty');
    expect(await f.mutations()).toBe('');
  } finally {
    await f.cleanup();
  }
});

test('Claude does not allow an untracked Codex native marker', async () => {
  const f = await updateFixture('claude');
  try {
    await writeFile(
      join(f.plugin, '.codex-marketplace-install.json'),
      JSON.stringify({ source_type: 'git', source: f.source, ref_name: null, sparse_paths: [], revision: f.installed }),
    );
    const result = await f.update(['check']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('dirty');
    expect(await f.mutations()).toBe('');
  } finally {
    await f.cleanup();
  }
});

for (const host of ['claude', 'codex'] as const)
  test(`${host} the offered profile remains selected when terminal defaults name another matching installation`, async () => {
    const f = await updateFixture(host);
    try {
      const other = join(f.dir, 'other profile');
      const config = join(other, 'config');
      const plugin = join(config, 'plugins/cache/celetis/celetis/local');
      await cp(f.config, config, { recursive: true });
      for (const file of ['list.json', 'market.json', 'effective.json'])
        await f.write(`other profile/${file}`, (await f.read(file)).replaceAll(f.plugin, plugin));
      const registry = await readFile(join(config, 'plugins/installed_plugins.json'), 'utf8');
      await f.write('other profile/config/plugins/installed_plugins.json', registry.replaceAll(f.plugin, plugin));
      const offer = JSON.parse((await f.update(['check'])).stdout);
      expect(offer.home).toBe(f.config);
      expect(offer.root).toBe(f.plugin);
      expect(await f.git(['rev-parse', 'HEAD'], plugin)).toBe(f.installed);
      const otherEnv = { ...f.env, CLAUDE_CONFIG_DIR: config, CODEX_HOME: config };
      const otherOffer = await f.bun(join(root, 'scripts/plugin-update.ts'), ['check'], { cwd: f.repo, env: otherEnv });
      expect(otherOffer.code, otherOffer.stderr).toBe(0);
      expect(JSON.parse(otherOffer.stdout)).toEqual({ ...offer, home: config, root: plugin });
      await f.write('other profile/calls', '');
      const result = await f.apply([offer.home, offer.root, offer.source, offer.installed, offer.target], otherEnv);
      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(f.plugin);
      expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.target);
      expect(await f.git(['rev-parse', 'HEAD'], plugin)).toBe(f.installed);
      expect(await readFile(join(plugin, 'step-prompt.md'), 'utf8')).toBe('installed\n');
      expect(await f.read('other profile/calls')).toBe('');
    } finally {
      await f.cleanup();
    }
  });

for (const host of ['claude', 'codex'] as const)
  test(`${host} mismatched offered home or root cannot load an updater or mutate a package`, async () => {
    const f = await updateFixture(host);
    try {
      const other = join(f.dir, 'other profile/config');
      const plugin = join(other, 'plugins/cache/celetis/celetis/local');
      await cp(f.config, other, { recursive: true });
      for (const file of ['list.json', 'market.json', 'effective.json'])
        await f.write(`other profile/${file}`, (await f.read(file)).replaceAll(f.plugin, plugin));
      const registry = await readFile(join(other, 'plugins/installed_plugins.json'), 'utf8');
      await f.write('other profile/config/plugins/installed_plugins.json', registry.replaceAll(f.plugin, plugin));
      for (const [home, packageRoot] of [
        [other, f.plugin],
        [f.config, f.repo],
      ] as const) {
        const args = [home, packageRoot, f.source, f.installed, f.target];
        const result = await f.update(['apply', ...args], true);
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('usage:');
        const direct = await f.apply(args);
        expect(direct.code).not.toBe(0);
        expect(direct.stderr).toContain('home, root');
        expect(await f.mutations()).toBe('');
        expect(await f.read('other profile/mutations').catch(() => '')).toBe('');
        expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.installed);
        expect(await f.git(['rev-parse', 'HEAD'], plugin)).toBe(f.installed);
      }
      const missing = await f.apply([join(f.dir, 'missing'), f.plugin, f.source, f.installed, f.target]);
      expect(missing.code).not.toBe(0);
      expect(missing.stderr).toContain('home');
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });

for (const state of ['enabled', 'disabled', 'pending', 'native-only'])
  test(`Codex refuses a whole-marketplace update with a ${state} same-marketplace sibling`, async () => {
    const f = await updateFixture('codex', true);
    try {
      const effective = JSON.parse(await f.read('effective.json'));
      effective.config.plugins = { 'celetis@celetis': { enabled: true } };
      if (state !== 'native-only') effective.config.plugins['sibling@celetis'] = { enabled: state === 'enabled' };
      await f.write('effective.json', JSON.stringify(effective));
      if (state !== 'pending') {
        const list = JSON.parse(await f.read('list.json'));
        list.installed.push({
          ...list.installed[0],
          pluginId: 'sibling@celetis',
          name: 'sibling',
          enabled: state === 'enabled',
        });
        await f.write('list.json', JSON.stringify(list));
      }
      await f.write('sibling-state', 'unchanged');
      const discovery = await f.bun(join(root, 'scripts/launcher.ts'), ['--agent', 'codex', 'root'], {
        cwd: f.repo,
        env: f.env,
      });
      expect(discovery.code, discovery.stderr).toBe(0);
      expect((await f.update(['check'])).code).toBe(0);
      const result = await f.apply([f.config, f.plugin, f.source, f.installed, f.target]);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('sibling@celetis');
      expect(await f.mutations()).toBe('');
      expect(await f.read('sibling-state')).toBe('unchanged');
      expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.installed);
    } finally {
      await f.cleanup();
    }
  });
