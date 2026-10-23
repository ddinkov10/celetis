import { expect, test } from 'bun:test';
import { appendFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkClaudePolicy } from '../scripts/lib/plugin-policy.ts';
import { command, fixture, root } from './lib/fixture.ts';

async function updateFixture(host: 'claude' | 'codex') {
  const f = await fixture();
  await f.repository();
  const config = join(f.dir, 'config');
  const plugin = join(config, 'plugins/cache/celetis/celetis/local');
  const source = join(f.dir, 'source with spaces.git');
  await mkdir(plugin, { recursive: true });
  await f.write('config/plugins/cache/celetis/celetis/local/.claude-plugin/plugin.json', '{"name":"celetis"}');
  await f.write(
    'config/plugins/cache/celetis/celetis/local/.claude-plugin/marketplace.json',
    JSON.stringify({ name: 'celetis', plugins: [{ name: 'celetis', source: './' }] }),
  );
  await f.write('config/plugins/cache/celetis/celetis/local/scripts/root.ts', '');
  await f.write('config/plugins/cache/celetis/celetis/local/step-prompt.md', 'installed\n');
  await f.write('config/plugins/cache/celetis/celetis/local/skills/guide/SKILL.md', 'installed\n');
  const env = {
    ...f.env,
    CELETIS_AGENT: host,
    CLAUDE_CONFIG_DIR: config,
    CODEX_HOME: config,
    PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`,
    UPDATE_FIXTURE: f.dir,
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.test',
  };
  const git = async (args: string[], cwd = plugin) => {
    const result = await command('git', args, { cwd, env });
    expect(result.code, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  await git(['init', '-qb', 'main']);
  await git(['add', '.']);
  await git(['commit', '-qm', 'installed']);
  const installed = await git(['rev-parse', 'HEAD']);
  await git(['clone', '--bare', '-q', plugin, source], f.dir);
  await git(['remote', 'add', 'origin', source]);
  const next = join(f.dir, 'next');
  await git(['clone', '-q', source, next], f.dir);
  await writeFile(join(next, 'step-prompt.md'), 'target\n');
  await git(['add', '.'], next);
  await git(['commit', '-qm', 'target'], next);
  const target = await git(['rev-parse', 'HEAD'], next);
  await git(['push', '-q', 'origin', 'main'], next);
  const market = { sourceType: 'git', source };
  await f.write(
    'effective.json',
    JSON.stringify({
      config: { marketplaces: { celetis: { source_type: 'git', source, ref: 'main' } } },
      layers: [],
      origins: {},
    }),
  );
  await f.write(
    'config/plugins/known_marketplaces.json',
    JSON.stringify({ celetis: { source: { source: 'git', url: source, ref: 'main' }, autoUpdate: false } }),
  );
  await f.write(
    'config/plugins/installed_plugins.json',
    JSON.stringify({
      version: 2,
      plugins: {
        'celetis@celetis': [{ scope: 'user', installPath: plugin, version: 'local', gitCommitSha: installed }],
      },
    }),
  );
  await f.write(
    'config/settings.json',
    JSON.stringify({
      extraKnownMarketplaces: { celetis: { source: { source: 'git', url: source, ref: 'main' }, autoUpdate: false } },
    }),
  );
  const records =
    host === 'claude'
      ? [{ id: 'celetis@celetis', scope: 'user', enabled: true, installPath: plugin, version: 'local' }]
      : {
          installed: [
            {
              pluginId: 'celetis@celetis',
              name: 'celetis',
              marketplaceName: 'celetis',
              installed: true,
              enabled: true,
              version: 'local',
              source: { source: 'local', path: next },
              marketplaceSource: market,
            },
          ],
          available: [],
        };
  await f.write('list.json', JSON.stringify(records));
  await f.write(
    'market.json',
    JSON.stringify({ marketplaces: [{ name: 'celetis', root: next, marketplaceSource: market }] }),
  );
  await f.stub(
    host,
    `import { appendFileSync,readFileSync } from 'node:fs';import {join} from 'node:path';const dir=process.env.UPDATE_FIXTURE!;const args=process.argv.slice(2);appendFileSync(join(dir,'calls'),JSON.stringify(args)+'\\n');if(JSON.stringify(args)===JSON.stringify(['--disable','plugins','app-server','--stdio'])){for await(const data of (await import('node:readline')).createInterface({input:process.stdin})){const m=JSON.parse(data);if(m.method==='initialized')continue;console.log(JSON.stringify({id:m.id,result:m.method==='config/read'?JSON.parse(readFileSync(join(dir,'effective.json'),'utf8')):{}}));}process.exit(0);}if(args[0]==='--version'){console.log(${JSON.stringify(host === 'codex' ? 'codex-cli 0.163.0' : '2.1.306 (Claude Code)')});process.exit(0);}if(JSON.stringify(args)===${JSON.stringify(JSON.stringify(host === 'claude' ? ['plugin', 'list', '--json'] : ['plugin', 'list', '--marketplace', 'celetis', '--json']))}){process.stdout.write(readFileSync(join(dir,'list.json')));process.exit(0);}if(JSON.stringify(args)===JSON.stringify(['plugin','marketplace','list','--json'])){process.stdout.write(readFileSync(join(dir,'market.json')));process.exit(0);}appendFileSync(join(dir,'mutations'),JSON.stringify(args)+'\\n');console.error('unexpected native operation');process.exit(91);`,
  );
  await cp(join(root, 'scripts'), join(plugin, 'scripts'), { recursive: true });
  await git(['add', '.']);
  await git(['commit', '-qm', 'fixture commands']);
  const actualInstalled = await git(['rev-parse', 'HEAD']);
  await f.write(
    'config/plugins/installed_plugins.json',
    JSON.stringify({
      version: 2,
      plugins: {
        'celetis@celetis': [{ scope: 'user', installPath: plugin, version: 'local', gitCommitSha: actualInstalled }],
      },
    }),
  );
  const update = (args: string[], launcher = false) =>
    f.bun(
      join(plugin, launcher ? 'scripts/launcher.ts' : 'scripts/plugin-update.ts'),
      launcher ? ['plugin-update', ...args] : args,
      { cwd: f.repo, env },
    );
  const mutations = () => readFile(join(f.dir, 'mutations'), 'utf8').catch(() => '');
  return { ...f, env, config, plugin, source, installed: actualInstalled, target, update, mutations, git };
}

for (const host of ['claude', 'codex'] as const) {
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
  test(`${host} target-bound apply refuses unsupported native cutover before mutation`, async () => {
    const f = await updateFixture(host);
    try {
      const result = await f.update(['apply', f.source, f.installed, f.target]);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        host === 'claude'
          ? 'command-line, MDM, and server-managed replacement policy is unknown'
          : 'automatic plugin refresh',
      );
      expect(result.stderr).toMatch(/stop|supported/);
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });
  test(`${host} stale source and target cannot reach native application`, async () => {
    const f = await updateFixture(host);
    try {
      for (const args of [
        [`${f.source}/other`, f.installed, f.target],
        [f.source, f.target, f.installed],
        [f.source, f.installed, '1'.repeat(40)],
      ]) {
        const result = await f.update(['apply', ...args]);
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('changed');
        expect(await f.mutations()).toBe('');
      }
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
