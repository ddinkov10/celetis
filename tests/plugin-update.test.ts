import { expect, test } from 'bun:test';
import { appendFile, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkClaudePolicy } from '../scripts/lib/plugin-policy.ts';
import { root } from './lib/fixture.ts';
import { updateFixture } from './lib/plugin-update-fixture.ts';

for (const host of ['claude', 'codex'] as const) {
  test(`${host} distinct local sources remain distinct when only the Git suffix differs`, async () => {
    const f = await updateFixture(host);
    try {
      const other = f.source.slice(0, -4);
      await f.git(['clone', '--bare', '-q', f.plugin, other], f.dir);
      await f.git(['remote', 'set-url', 'origin', other]);
      const mismatch = await f.update(['check']);
      expect(mismatch.code).toBe(1);
      expect(mismatch.stderr).toContain('installed Git source does not match configured source');
      expect(mismatch.stdout).toBe('');
      expect(await f.mutations()).toBe('');
      await f.git(['remote', 'set-url', 'origin', f.source]);
      const same = await f.update(['check']);
      expect(same.code, same.stderr).toBe(0);
      expect(JSON.parse(same.stdout)).toEqual({
        host,
        source: f.source,
        installed: f.installed,
        target: f.target,
        root: f.plugin,
      });
    } finally {
      await f.cleanup();
    }
  });
  test(`${host} annotated tag resolves its commit and a branch/tag collision refuses the offer`, async () => {
    const f = await updateFixture(host);
    try {
      await f.git(['--git-dir', f.source, 'tag', '-am', 'offer', 'offered', f.target], f.dir);
      const ref = async (value: string) => {
        await f.write(
          'config/settings.json',
          JSON.stringify({
            extraKnownMarketplaces: {
              celetis: { source: { source: 'git', url: f.source, ref: value }, autoUpdate: false },
            },
          }),
        );
        await f.write(
          'effective.json',
          JSON.stringify({
            config: { marketplaces: { celetis: { source_type: 'git', source: f.source, ref: value } } },
          }),
        );
      };
      await ref('refs/tags/offered');
      let result = await f.update(['check']);
      expect(result.code, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout).target).toBe(f.target);
      await f.git(['--git-dir', f.source, 'update-ref', 'refs/heads/offered', f.target], f.dir);
      await ref('offered');
      result = await f.update(['check']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('ambiguous');
      expect(result.stdout).toBe('');
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });
  test(`${host} check returns exact revisions without changing installation bytes or records`, async () => {
    const f = await updateFixture(host);
    try {
      const before = await readFile(join(f.config, 'plugins/installed_plugins.json'), 'utf8');
      const result = await f.update(['check'], true);
      expect(result.code, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        host,
        source: f.source,
        installed: f.installed,
        target: f.target,
        root: f.plugin,
      });
      expect(await f.mutations()).toBe('');
      expect(await readFile(join(f.config, 'plugins/installed_plugins.json'), 'utf8')).toBe(before);
      expect(await readFile(join(f.plugin, 'step-prompt.md'), 'utf8')).toBe('installed\n');
    } finally {
      await f.cleanup();
    }
  });
  test(`${host} same revision produces no offer`, async () => {
    const f = await updateFixture(host);
    try {
      await f.git(['push', '-q', '--force', f.source, 'HEAD:main']);
      const result = await f.update(['check']);
      expect(result.code, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toBeNull();
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });
  test(`${host} dirty package and missing ref report a cause without a current claim`, async () => {
    const f = await updateFixture(host);
    try {
      await appendFile(join(f.plugin, 'step-prompt.md'), 'changed\n');
      let result = await f.update(['check']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('dirty');
      expect(result.stdout).toBe('');
      await f.git(['checkout', '--', 'step-prompt.md']);
      await f.git(['--git-dir', f.source, 'update-ref', '-d', 'refs/heads/main'], f.dir);
      result = await f.update(['check']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('ref');
      expect(result.stdout).toBe('');
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });
  test(`${host} disabled, ambiguous, unsupported, and offline checks never claim current`, async () => {
    const f = await updateFixture(host);
    try {
      const original = JSON.parse(await f.read('list.json'));
      const records = host === 'claude' ? original : original.installed;
      for (const malformed of [[{ ...records[0], enabled: false }], [records[0], records[0]]]) {
        await f.write(
          'list.json',
          JSON.stringify(host === 'claude' ? malformed : { installed: malformed, available: [] }),
        );
        const result = await f.update(['check']);
        expect(result.code).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr).toMatch(/disabled|ambiguous|multiple|enabled/);
      }
      await f.write('list.json', JSON.stringify(original));
      await f.git(['--git-dir', f.source, 'config', 'core.bare', 'false'], f.dir);
      await f.write(
        'config/plugins/known_marketplaces.json',
        JSON.stringify({
          celetis: { source: { source: 'url', url: 'https://example.test/catalog.json' }, autoUpdate: false },
        }),
      );
      if (host === 'claude')
        await f.write(
          'config/settings.json',
          JSON.stringify({
            extraKnownMarketplaces: {
              celetis: { source: { source: 'url', url: 'https://example.test/catalog.json' }, autoUpdate: false },
            },
          }),
        );
      if (host === 'codex') {
        original.installed[0].marketplaceSource.sourceType = 'local';
        const market = JSON.parse(await f.read('market.json'));
        market.marketplaces[0].marketplaceSource.sourceType = 'local';
        await f.write('market.json', JSON.stringify(market));
        await f.write('list.json', JSON.stringify(original));
      }
      let result = await f.update(['check']);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toMatch(/Git source|not a Git/);
      await f.write(
        'config/plugins/known_marketplaces.json',
        JSON.stringify({ celetis: { source: { source: 'git', url: f.source, ref: 'main' }, autoUpdate: false } }),
      );
      if (host === 'claude')
        await f.write(
          'config/settings.json',
          JSON.stringify({
            extraKnownMarketplaces: {
              celetis: { source: { source: 'git', url: f.source, ref: 'main' }, autoUpdate: false },
            },
          }),
        );
      if (host === 'codex') {
        original.installed[0].marketplaceSource.sourceType = 'git';
        const market = JSON.parse(await f.read('market.json'));
        market.marketplaces[0].marketplaceSource.sourceType = 'git';
        await f.write('market.json', JSON.stringify(market));
        await f.write('list.json', JSON.stringify(original));
      }
      await f.write('offline-source', 'not a Git repository');
      await f.git(['remote', 'set-url', 'origin', join(f.dir, 'offline-source')]);
      if (host === 'claude') {
        await f.write(
          'config/settings.json',
          JSON.stringify({
            extraKnownMarketplaces: {
              celetis: {
                source: { source: 'git', url: join(f.dir, 'offline-source'), ref: 'main' },
                autoUpdate: false,
              },
            },
          }),
        );
        await f.write(
          'config/plugins/known_marketplaces.json',
          JSON.stringify({
            celetis: { source: { source: 'git', url: join(f.dir, 'offline-source'), ref: 'main' }, autoUpdate: false },
          }),
        );
      } else {
        original.installed[0].marketplaceSource.source = join(f.dir, 'offline-source');
        const market = JSON.parse(await f.read('market.json'));
        market.marketplaces[0].marketplaceSource.source = join(f.dir, 'offline-source');
        await f.write('market.json', JSON.stringify(market));
        await f.write('list.json', JSON.stringify(original));
        await f.write(
          'effective.json',
          JSON.stringify({
            config: {
              marketplaces: { celetis: { source_type: 'git', source: join(f.dir, 'offline-source'), ref: 'main' } },
            },
          }),
        );
      }
      result = await f.update(['check']);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('cannot resolve configured Git ref');
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });
}

test('Claude effective precedence names managed and local conflicts above project false', () => {
  const project = {
    path: '/project/.claude/settings.json',
    value: { extraKnownMarketplaces: { celetis: { autoUpdate: false } } },
  };
  for (const path of ['/project/.claude/settings.local.json', '/managed/managed-settings.json']) {
    expect(() =>
      checkClaudePolicy([project, { path, value: { extraKnownMarketplaces: { celetis: { autoUpdate: true } } } }]),
    ).toThrow(path);
  }
  expect(() =>
    checkClaudePolicy([
      {
        path: '/native/known_marketplaces.json',
        value: { celetis: { source: { source: 'github', repo: 'owner/repo' } } },
      },
      project,
    ]),
  ).not.toThrow();
  expect(() =>
    checkClaudePolicy([
      { path: '/user/settings.json', value: { extraKnownMarketplaces: { celetis: { autoUpdate: true } } } },
      project,
    ]),
  ).not.toThrow();
});

test('unbound latest updater is no longer an action', async () => {
  const f = await updateFixture('claude');
  try {
    const result = await f.update([]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('check | apply <source> <installed> <target>');
    expect(await f.mutations()).toBe('');
  } finally {
    await f.cleanup();
  }
});

test('Claude full native registry revision requires exact scope, path and version binding', async () => {
  const f = await updateFixture('claude');
  try {
    await rm(join(f.plugin, '.git'), { recursive: true });
    const result = await f.update(['check']);
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).installed).toBe(f.installed);
    const registry = JSON.parse(await f.read('config/plugins/installed_plugins.json'));
    registry.plugins['celetis@celetis'][0].scope = 'project';
    await f.write('config/plugins/installed_plugins.json', JSON.stringify(registry));
    const mismatch = await f.update(['check']);
    expect(mismatch.code).toBe(1);
    expect(mismatch.stderr).toContain('revision witness');
    expect(mismatch.stdout).toBe('');
    expect(await f.mutations()).toBe('');
  } finally {
    await f.cleanup();
  }
});

for (const registered of ['different', 'missing'])
  test(`Claude no-Git native SHA refuses ${registered} registered source proof`, async () => {
    const f = await updateFixture('claude');
    try {
      const other = join(f.dir, 'other-source.git');
      await f.git(['clone', '--bare', '-q', f.source, other], f.dir);
      await rm(join(f.plugin, '.git'), { recursive: true });
      await f.write(
        'config/settings.json',
        JSON.stringify({
          extraKnownMarketplaces: {
            celetis: { source: { source: 'git', url: other, ref: 'main' }, autoUpdate: false },
          },
        }),
      );
      if (registered === 'missing') await f.write('config/plugins/known_marketplaces.json', '{}');
      const result = await f.update(['check']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('native registered source');
      expect(result.stdout).toBe('');
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });

test('a non-owned Git witness cannot be hidden by a full native revision record', async () => {
  const f = await updateFixture('claude');
  try {
    await rm(join(f.plugin, '.git'), { recursive: true });
    await writeFile(join(f.plugin, '.git'), `gitdir: ${join(f.repo, '.git')}\n`);
    const result = await f.update(['check']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('package-owned');
    expect(result.stdout).toBe('');
  } finally {
    await f.cleanup();
  }
});

test('Claude linked worktree reads the main checkout local policy above active project false', async () => {
  const f = await updateFixture('claude');
  try {
    await f.write(
      'repo dir/.claude/settings.json',
      JSON.stringify({ extraKnownMarketplaces: { celetis: { autoUpdate: false } } }),
    );
    await f.git(['add', '.'], f.repo);
    await f.git(['commit', '-qm', 'project policy'], f.repo);
    const lane = join(f.dir, 'lane');
    await f.git(['worktree', 'add', '-qb', 'policy-lane', lane], f.repo);
    await f.write(
      'repo dir/.claude/settings.local.json',
      JSON.stringify({ extraKnownMarketplaces: { celetis: { autoUpdate: true } } }),
    );
    const probe = await f.write(
      'policy.ts',
      `import {requireUpdatePolicy} from ${JSON.stringify(join(root, 'scripts/lib/plugin-policy.ts'))};try{await requireUpdatePolicy('claude',process.cwd());}catch(error){console.error((error as Error).message);process.exitCode=1;}`,
    );
    const result = await f.bun(probe, [], { cwd: lane, env: f.env });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(join(f.repo, '.claude/settings.local.json'));
  } finally {
    await f.cleanup();
  }
});
