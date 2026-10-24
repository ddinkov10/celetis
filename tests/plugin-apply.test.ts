import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { chmod, lstat, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tryFlock } from '../scripts/lib/update-lock.ts';
import { isolatedArgs, root } from './lib/fixture.ts';
import { updateFixture } from './lib/plugin-update-fixture.ts';

for (const host of ['claude', 'codex'] as const) {
  test(`${host} installs the exact approved commit when the source moves inside the native operation`, async () => {
    const f = await updateFixture(host);
    try {
      const other = await f.git(['--git-dir', f.source, 'rev-parse', 'main~1'], f.dir);
      await f.write('move-remote', other);
      const result = await f.apply([f.config, f.plugin, f.source, f.installed, f.target]);
      expect(result.code, result.stderr).toBe(0);
      expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.target);
      expect(await f.git(['--git-dir', f.source, 'rev-parse', 'main'], f.dir)).toBe(other);
    } finally {
      await f.cleanup();
    }
  });

  for (const partial of [false, true])
    test(`${host} native ${partial ? 'partial replacement' : 'application failure'} keeps cause and never retries installation`, async () => {
      const f = await updateFixture(host);
      try {
        const original = JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis;
        delete original.autoUpdate;
        await f.write('config/plugins/known_marketplaces.json', JSON.stringify({ celetis: original }));
        await f.write(partial ? 'apply-partial' : 'apply-fail', 'yes');
        const result = await f.apply([f.config, f.plugin, f.source, f.installed, f.target]);
        expect(result.code).toBe(1);
        expect(result.stderr).toContain(partial ? 'failed after package replacement' : 'failed before replacement');
        expect(result.stderr).toContain('Recovery:');
        expect(result.stderr).toContain('observed native source state:');
        const mutations = (await f.mutations())
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        expect(
          mutations.filter((args) => (host === 'codex' ? args.includes('upgrade') : args.includes('celetis@celetis')))
            .length,
        ).toBe(1);
        if (host === 'claude')
          expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis).toEqual(original);
      } finally {
        await f.cleanup();
      }
    });

  test(`${host} idle exact-target application succeeds through native commands and fresh discovery`, async () => {
    const f = await updateFixture(host);
    try {
      const settings = await f.read('config/settings.json');
      const effective = JSON.parse(await f.read('effective.json'));
      effective.config.plugins = { 'unrelated@another-marketplace': { enabled: true } };
      await f.write('effective.json', JSON.stringify(effective));
      await f.write('unrelated-plugin', 'unchanged');
      await f.write('config/config.toml', '[marketplaces.celetis]\nsource_type="git"\nref="main"\n');
      const config = await f.read('config/config.toml');
      const result = await f.apply();
      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(f.plugin);
      expect(await f.read('config/settings.json')).toBe(settings);
      expect(await f.read('config/config.toml')).toBe(config);
      expect(await f.read('unrelated-plugin')).toBe('unchanged');
      expect(await f.mutations()).not.toBe('');
      expect(await readFile(join(f.plugin, 'step-prompt.md'), 'utf8')).toBe('target\n');
      const check = await f.bun(join(root, 'scripts/plugin-update.ts'), ['check'], { cwd: f.repo, env: f.env });
      expect(check.code, check.stderr).toBe(0);
      expect(JSON.parse(check.stdout)).toBeNull();
      if (host === 'claude')
        expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis.source).toEqual({
          source: 'git',
          url: f.source,
          ref: 'main',
        });
    } finally {
      await f.cleanup();
    }
  });

  test(`${host} target-bound apply keeps an active native consumer running`, async () => {
    const f = await updateFixture(host);
    try {
      const consumer = spawn(join(f.dir, 'bin', host), [], { cwd: f.repo, env: f.env, stdio: 'ignore' });
      try {
        const deadline = performance.now() + 3000;
        while (!(await Bun.file(join(f.dir, 'consumer-pid')).exists())) {
          if (performance.now() >= deadline) throw new Error('native fixture did not start');
          await Bun.sleep(10);
        }
        const result = await f.apply([f.config, f.plugin, f.source, f.installed, f.target]);
        expect(result.code, result.stderr).toBe(0);
        expect(consumer.exitCode).toBeNull();
        expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.target);
        expect(await f.mutations()).not.toBe('');
      } finally {
        consumer.kill('SIGTERM');
        await new Promise<void>((done) => consumer.once('close', () => done()));
      }
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
        const result = await f.apply([f.config, f.plugin, ...args]);
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('changed');
        expect(await f.mutations()).toBe('');
      }
    } finally {
      await f.cleanup();
    }
  });
}

test('Claude registered GitHub source uses the approved materialized catalog and restores the original entry', async () => {
  const f = await updateFixture('claude');
  try {
    const url = 'https://github.com/ddinkov10/celetis.git';
    const source = { source: 'github', repo: 'ddinkov10/celetis', ref: 'main' };
    const originalEntry = {
      ...JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis,
      source,
      lastUpdated: '2026-10-24T00:00:00.000Z',
    };
    delete originalEntry.autoUpdate;
    await f.write('config/plugins/known_marketplaces.json', JSON.stringify({ celetis: originalEntry }));
    const userSettings = JSON.stringify({ extraKnownMarketplaces: { celetis: { source, autoUpdate: false } } });
    const projectSettings = JSON.stringify({ extraKnownMarketplaces: { celetis: { source, autoUpdate: false } } });
    await f.write('config/settings.json', userSettings);
    await f.write('repo dir/.claude/settings.json', projectSettings);
    await f.git(['config', '--global', `url.${f.source}.insteadOf`, url]);
    await f.git(['remote', 'set-url', 'origin', url]);
    await f.write('native-source-url', url);
    await chmod(join(f.config, 'plugins/known_marketplaces.json'), 0o640);
    const result = await f.apply([f.config, f.plugin, url, f.installed, f.target]);
    expect(result.code, result.stderr).toBe(0);
    expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.target);
    const native = JSON.parse(await f.read('native-catalog.json'));
    expect(native.entry.source).toEqual({ source: 'url', url, ref: 'main', sha: f.target });
    expect(native.market.source).toEqual({
      source: 'settings',
      name: 'celetis',
      owner: { name: 'Celetis' },
      plugins: [{ name: 'celetis', source: { source: 'url', url, ref: 'main', sha: f.target } }],
    });
    expect(native.market.autoUpdate).toBe(false);
    expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis).toEqual(originalEntry);
    expect(await f.read('config/settings.json')).toBe(userSettings);
    expect(await f.read('repo dir/.claude/settings.json')).toBe(projectSettings);
    expect((await lstat(join(f.config, 'plugins/known_marketplaces.json'))).mode & 0o777).toBe(0o640);
    expect(await Bun.file(join(native.market.installLocation, '.claude-plugin/marketplace.json')).exists()).toBe(false);
    expect(
      (await f.mutations())
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
    ).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});

test('Claude restoration failure reports both causes and retains its unreadable registration catalog', async () => {
  const f = await updateFixture('claude');
  try {
    await f.write('apply-fail', 'yes');
    await f.write('invalid-registry', 'yes');
    const result = await f.apply([f.config, f.plugin, f.source, f.installed, f.target]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('native application failed before replacement');
    expect(result.stderr).toContain('cannot read');
    expect(result.stderr).toContain('known_marketplaces.json');
    expect(result.stderr).toContain('observed native source state:');
    const catalog = JSON.parse(await f.read('native-catalog.json')).market.installLocation;
    expect(result.stderr).toContain(catalog);
    expect(await Bun.file(join(catalog, '.claude-plugin/marketplace.json')).exists()).toBe(true);
    expect(
      (await f.mutations())
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((args) => args.includes('celetis@celetis')),
    ).toHaveLength(1);
  } finally {
    const native = await Bun.file(join(f.dir, 'native-catalog.json'))
      .json()
      .catch(() => null);
    if (native) await rm(native.market.installLocation, { recursive: true, force: true });
    await f.cleanup();
  }
});

test('Claude native success at the wrong revision fails final validation without another installation', async () => {
  const f = await updateFixture('claude');
  try {
    const original = JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis;
    await f.write('wrong-sha', f.installed);
    const result = await f.apply();
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`expected approved target ${f.target}`);
    expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis).toEqual(original);
    expect((await f.mutations()).trim().split('\n')).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});

for (const location of ['staged', 'staged/.', 'other', 'unresolved'])
  test(`Claude restoration preserves a competing native identity with the ${location} catalog`, async () => {
    const f = await updateFixture('claude');
    try {
      const competing = {
        source: { source: 'github', repo: 'competing/marketplace' },
        installLocation: location.startsWith('staged') ? location : join(f.dir, `${location}-catalog`),
      };
      if (location === 'other') await mkdir(competing.installLocation);
      await f.write('competing-marketplace.json', JSON.stringify(competing));
      const result = await f.apply();
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('native marketplace identity changed');
      const catalog = JSON.parse(await f.read('native-catalog.json')).market.installLocation;
      expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis).toEqual({
        ...competing,
        installLocation:
          location === 'staged' ? catalog : location === 'staged/.' ? `${catalog}/.` : competing.installLocation,
      });
      expect(await Bun.file(join(catalog, '.claude-plugin/marketplace.json')).exists()).toBe(location !== 'other');
      if (location !== 'other') expect(result.stderr).toContain(catalog);
      expect((await f.mutations()).trim().split('\n')).toHaveLength(1);
    } finally {
      const native = await Bun.file(join(f.dir, 'native-catalog.json'))
        .json()
        .catch(() => null);
      if (native) await rm(native.market.installLocation, { recursive: true, force: true });
      await f.cleanup();
    }
  });

for (const invalid of [
  'missing owner',
  'missing owner name',
  'empty owner name',
  'missing plugin source',
  'empty plugin source',
  'missing plugin source type',
  'missing plugin source URL',
])
  test(`Claude rejects ${invalid} in original catalog metadata before a native update`, async () => {
    const f = await updateFixture('claude');
    try {
      const known = await f.read('config/plugins/known_marketplaces.json');
      const location = JSON.parse(known).celetis.installLocation;
      const path = join(location, '.claude-plugin/marketplace.json');
      const catalog = JSON.parse(await readFile(path, 'utf8'));
      if (invalid === 'missing owner') delete catalog.owner;
      else if (invalid === 'missing owner name') delete catalog.owner.name;
      else if (invalid === 'empty owner name') catalog.owner.name = '';
      else if (invalid === 'missing plugin source') delete catalog.plugins[0].source;
      else if (invalid === 'empty plugin source') catalog.plugins[0].source = '';
      else catalog.plugins[0].source = invalid === 'missing plugin source type' ? {} : { source: 'url' };
      await Bun.write(path, JSON.stringify(catalog));
      const result = await f.apply();
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('catalog');
      expect(await f.mutations()).toBe('');
      expect(
        (await f.read('calls'))
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
          .filter((args) => args.includes('update')),
      ).toHaveLength(0);
      expect(await f.read('config/plugins/known_marketplaces.json')).toBe(known);
    } finally {
      await f.cleanup();
    }
  });

for (const source of ['./', '.', './plugins/celetis', { source: 'github', repo: 'ddinkov10/celetis' }])
  test(`Claude accepts the native original catalog source ${JSON.stringify(source)}`, async () => {
    const f = await updateFixture('claude');
    try {
      const known = await f.read('config/plugins/known_marketplaces.json');
      const path = join(JSON.parse(known).celetis.installLocation, '.claude-plugin/marketplace.json');
      const catalog = JSON.parse(await readFile(path, 'utf8'));
      catalog.plugins[0].source = source;
      const content = JSON.stringify(catalog);
      await Bun.write(path, content);
      const result = await f.apply();
      expect(result.code, result.stderr).toBe(0);
      expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.target);
      expect(await readFile(path, 'utf8')).toBe(content);
      expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json'))).toEqual(JSON.parse(known));
    } finally {
      await f.cleanup();
    }
  });

test('Claude restoration keeps unrelated marketplace writes and registry file mode', async () => {
  const f = await updateFixture('claude');
  try {
    const original = JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis;
    await chmod(join(f.config, 'plugins/known_marketplaces.json'), 0o600);
    await f.write('unrelated-marketplace', 'yes');
    const result = await f.apply();
    expect(result.code, result.stderr).toBe(0);
    const registry = JSON.parse(await f.read('config/plugins/known_marketplaces.json'));
    expect(registry.celetis).toEqual(original);
    expect(registry.other).toEqual({
      source: { source: 'github', repo: 'other/marketplace' },
      installLocation: join(f.dir, 'other'),
    });
    expect((await lstat(join(f.config, 'plugins/known_marketplaces.json'))).mode & 0o777).toBe(0o600);
  } finally {
    await f.cleanup();
  }
});

for (const source of [
  { source: 'git', url: 42 },
  { source: 'git', url: 'https://example.test/other.git', ref: 'main' },
  { source: 'github', repo: 'invalid repo' },
])
  test(`Claude refuses an invalid native ${JSON.stringify(source)} source even with an installed Git witness`, async () => {
    const f = await updateFixture('claude');
    try {
      const registry = JSON.parse(await f.read('config/plugins/known_marketplaces.json'));
      registry.celetis.source = source;
      await f.write('config/plugins/known_marketplaces.json', JSON.stringify(registry));
      await f.write('config/plugins/installed_plugins.json', '{}');
      const result = await f.apply();
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('source');
      expect(await f.mutations()).toBe('');
      expect(
        (await f.read('calls'))
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
          .filter((args) => args.includes('update')),
      ).toHaveLength(0);
      expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json'))).toEqual(registry);
    } finally {
      await f.cleanup();
    }
  });

for (const invalid of ['missing location', 'missing catalog', 'invalid catalog', 'inline source', 'symlink registry'])
  test(`Claude refuses ${invalid} native metadata before installation`, async () => {
    const f = await updateFixture('claude');
    try {
      const registry = JSON.parse(await f.read('config/plugins/known_marketplaces.json'));
      const catalog = join(registry.celetis.installLocation, '.claude-plugin/marketplace.json');
      if (invalid === 'missing location') {
        delete registry.celetis.installLocation;
        await f.write('config/plugins/known_marketplaces.json', JSON.stringify(registry));
      } else if (invalid === 'missing catalog') await rm(catalog);
      else if (invalid === 'invalid catalog') await Bun.write(catalog, '{"name":"another","plugins":[]}');
      else if (invalid === 'inline source') {
        registry.celetis.source = {
          source: 'settings',
          name: 'celetis',
          owner: { name: 'Celetis' },
          plugins: [{ name: 'celetis', source: { source: 'url', url: f.source, ref: 'main', sha: f.target } }],
        };
        await f.write('config/plugins/known_marketplaces.json', JSON.stringify(registry));
      } else {
        const path = join(f.config, 'plugins/known_marketplaces.json');
        await f.write('registry.json', JSON.stringify(registry));
        await rm(path);
        await symlink(join(f.dir, 'registry.json'), path);
      }
      const result = await f.apply();
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        invalid === 'symlink registry'
          ? 'regular file'
          : invalid === 'inline source'
            ? 'recovery'
            : invalid === 'missing catalog'
              ? 'marketplace.json'
              : 'catalog',
      );
      expect(await f.mutations()).toBe('');
      expect(
        (await f.read('calls'))
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
          .filter((args) => args.includes('update')),
      ).toHaveLength(0);
    } finally {
      await f.cleanup();
    }
  });

for (const interrupt of ['deadline', 'SIGTERM'])
  test(`Claude ${interrupt} after catalog binding restores before unlock and stops its native descendants`, async () => {
    const f = await updateFixture('claude');
    try {
      const original = JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis;
      const marker = join(f.dir, 'native-child');
      await f.write('apply-stall', 'yes');
      await f.write(
        'native-child.ts',
        `process.on('SIGTERM',()=>{});await Bun.write(${JSON.stringify(marker)},String(process.pid));await Bun.sleep(30000);`,
      );
      const probe = await f.write(
        'staged-interruption.ts',
        `
import {existsSync} from 'node:fs';
import {UpdateLock} from ${JSON.stringify(join(f.plugin, 'scripts/lib/update-lock.ts'))};
import {updatePlugin} from ${JSON.stringify(join(f.plugin, 'scripts/plugin-update.ts'))};
${interrupt === 'deadline' ? `const acquire=UpdateLock.acquire.bind(UpdateLock);UpdateLock.acquire=(path,pid,options)=>acquire(path,pid,{...options,clock:{now:()=>performance.now()+(existsSync(${JSON.stringify(marker)})?120000:0),sleep:ms=>Bun.sleep(ms)}});` : ''}
try{await updatePlugin(process.pid,'claude',${JSON.stringify({ home: f.config, root: f.plugin, source: f.source, installed: f.installed, target: f.target })});}catch(error){console.error((error as Error).message);process.exitCode=1;}
`,
      );
      const child = spawn(process.execPath, [...isolatedArgs, probe], {
        cwd: f.repo,
        env: f.env,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data;
      });
      const closed = new Promise<number | null>((resolve) => child.once('close', resolve));
      try {
        const startedBy = performance.now() + 10000;
        while (!(await Bun.file(marker).exists())) {
          if (performance.now() > startedBy || child.exitCode !== null)
            throw new Error(`native child did not start: ${stderr}`);
          await Bun.sleep(10);
        }
        const fd = openSync(join(f.config, 'celetis-update.lock'), 'a');
        try {
          expect(tryFlock(fd)).toBe(false);
          if (interrupt === 'SIGTERM') child.kill('SIGTERM');
          const stoppedBy = performance.now() + 10000;
          while (!tryFlock(fd)) {
            if (performance.now() > stoppedBy) throw new Error(`updater did not release its lock: ${stderr}`);
            await Bun.sleep(10);
          }
          expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis).toEqual(original);
          const catalog = JSON.parse(await f.read('native-catalog.json')).market.installLocation;
          expect(await Bun.file(join(catalog, '.claude-plugin/marketplace.json')).exists()).toBe(false);
        } finally {
          closeSync(fd);
        }
        expect(await closed).toBe(1);
        expect(stderr).toContain(interrupt === 'deadline' ? 'timed out after 120 seconds' : 'interrupted by SIGTERM');
        expect(stderr).toContain('native update stalled original cause');
        for (const name of ['native-parent', 'native-child']) {
          const pid = Number(await f.read(name));
          expect(pid).toBeGreaterThan(0);
          const status = await f.bun(
            await f.write(
              'native-state.ts',
              `import {run} from ${JSON.stringify(join(root, 'scripts/lib/process.ts'))};console.log((await run('/bin/ps',['-p',${JSON.stringify(String(pid))},'-o','stat='])).stdout);`,
            ),
          );
          expect(status.stdout.trim()).toMatch(/^$|[ZX]/);
        }
      } finally {
        if (child.exitCode === null) child.kill('SIGKILL');
        await closed;
      }
    } finally {
      await f.cleanup();
    }
  });

test('metadata timeout retains the one deadline and stops its owned descendants before unlock', async () => {
  const f = await updateFixture('claude');
  try {
    const marker = join(f.dir, 'inventory-child');
    const descendant = await f.write(
      'inventory-child.ts',
      `process.on('SIGTERM',()=>{});await Bun.write(${JSON.stringify(marker)},String(process.pid));await Bun.sleep(30000);`,
    );
    await f.stub(
      'claude',
      `import {spawn} from 'node:child_process';process.on('SIGTERM',()=>{});await Bun.write(${JSON.stringify(join(f.dir, 'inventory-parent'))},String(process.pid));spawn(process.execPath,${JSON.stringify(['--no-env-file', '--no-install', '--config=/dev/null', '--no-macros'])}.concat(${JSON.stringify(descendant)}),{stdio:['ignore','inherit','inherit',3]});console.error('fixture: inventory stalled original cause');await Bun.sleep(30000);`,
    );
    const probe = await f.write(
      'inventory-deadline.ts',
      `import {existsSync} from 'node:fs';import {UpdateLock} from ${JSON.stringify(join(f.plugin, 'scripts/lib/update-lock.ts'))};import {updatePlugin} from ${JSON.stringify(join(f.plugin, 'scripts/plugin-update.ts'))};const acquire=UpdateLock.acquire.bind(UpdateLock);UpdateLock.acquire=(path,pid,options)=>acquire(path,pid,{...options,clock:{now:()=>performance.now()+(existsSync(${JSON.stringify(marker)})?120000:0),sleep:ms=>Bun.sleep(ms)}});try{await updatePlugin(process.pid,'claude',${JSON.stringify({ home: f.config, root: f.plugin, source: f.source, installed: f.installed, target: f.target })});}catch(error){console.error((error as Error).message);process.exitCode=1;}`,
    );
    const result = await f.bun(probe, [], { cwd: f.repo, env: f.env });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('timed out after 120 seconds');
    expect(result.stderr).toContain('inventory stalled original cause');
    for (const name of ['inventory-parent', 'inventory-child']) {
      const pid = Number(await f.read(name));
      expect(pid).toBeGreaterThan(0);
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
      }
      if (alive) {
        const status = await f.bun(
          await f.write(
            'state.ts',
            `import {run} from ${JSON.stringify(join(root, 'scripts/lib/process.ts'))};const r=await run('/bin/ps',['-p',${JSON.stringify(String(pid))},'-o','stat=']);console.log(r.stdout);`,
          ),
        );
        expect(status.stdout.trim()).toMatch(/^$|[ZX]/);
      }
    }
    const fd = openSync(join(f.config, 'celetis-update.lock'), 'a');
    try {
      expect(tryFlock(fd)).toBe(true);
    } finally {
      closeSync(fd);
    }
    expect(await f.mutations()).toBe('');
  } finally {
    await f.cleanup();
  }
});
