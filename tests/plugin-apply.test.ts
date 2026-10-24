import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tryFlock } from '../scripts/lib/update-lock.ts';
import { root } from './lib/fixture.ts';
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
          expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis.source).toEqual({
            source: 'git',
            url: f.source,
            ref: 'main',
          });
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

test('Claude restoration failure reports original application cause and the remaining native pin', async () => {
  const f = await updateFixture('claude');
  try {
    await f.write('apply-fail', 'yes');
    await f.write('restore-fail', 'yes');
    const result = await f.apply([f.config, f.plugin, f.source, f.installed, f.target]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('native application failed before replacement');
    expect(result.stderr).toContain('native source restoration failed');
    expect(result.stderr).toContain('observed native source state:');
    expect(JSON.parse(await f.read('config/plugins/known_marketplaces.json')).celetis.source.source).toBe('settings');
    expect(
      (await f.mutations())
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((args) => args.includes('celetis@celetis')),
    ).toHaveLength(1);
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
