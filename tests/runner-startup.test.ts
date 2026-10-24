import { expect, setDefaultTimeout, test } from 'bun:test';
import { cp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './lib/fixture.ts';
import { runnerCase, stepText } from './lib/runner-fixture.ts';
import { held, managed, start } from './lib/runner-lifecycle-fixture.ts';

setDefaultTimeout(25_000);

for (const resume of [false, true])
  test.concurrent(
    `Codex ${resume ? 'exact Resume' : 'Run'} uses the native fallback after an absent higher-priority manifest`,
    runnerCase(async (f) => {
      await mkdir(join(f.plugin, '.codex-plugin'));
      await writeFile(join(f.plugin, '.codex-plugin/other.json'), '{}');
      await f.put('simulate-native-refresh');
      if (resume)
        await f.write(
          'repo dir/.git/celetis-flow/sessions/7.json',
          JSON.stringify({
            schema: 1,
            issue: 7,
            checkout: f.repo,
            host: 'codex',
            step: 'plan',
            session_id: '01a139fc-2ffa-74c0-9b14-e35e23339910',
          }),
        );
      const result = await f.run(resume ? ['--resume', '7'] : ['7'], { host: 'codex' });
      expect(result.code, result.stderr).toBe(0);
      const calls = await f.logs<{ args: string[] }>('calls');
      expect(calls).toHaveLength(1);
      if (resume) expect(calls[0]?.args).toContain('01a139fc-2ffa-74c0-9b14-e35e23339910');
      expect(await f.logs('native-replacements')).toEqual([]);
      expect(await f.logs('mutations')).toEqual([]);
    }),
  );

test.concurrent(
  'Codex keeps native manifest errors ahead of a valid lower fallback',
  runnerCase(async (f) => {
    const folder = join(f.plugin, '.codex-plugin');
    for (const invalid of ['symlink', 'directory', 'malformed', 'parent-file', 'parent-link']) {
      await rm(folder, { recursive: true, force: true });
      if (invalid === 'parent-file') await writeFile(folder, 'invalid');
      else if (invalid === 'parent-link') await symlink(join(f.plugin, '.claude-plugin'), folder);
      else {
        await mkdir(folder);
        const path = join(folder, 'plugin.json');
        if (invalid === 'symlink') await symlink(join(f.plugin, '.claude-plugin/plugin.json'), path);
        else if (invalid === 'directory') await mkdir(path);
        else await writeFile(path, '{');
      }
      const result = await f.run(['7'], { host: 'codex' });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(folder);
      expect(await f.logs('calls')).toEqual([]);
      expect(await f.logs('mutations')).toEqual([]);
    }
  }),
);

for (const [name, unsafe] of [
  ['_sibling', 'version'],
  ['-sibling', 'remote'],
] as const)
  test.concurrent(
    `Codex checks the native-valid leading name ${name} before sibling ${unsafe} changes`,
    runnerCase(async (f) => {
      const id = `${name}@celetis`;
      const path = join(f.plugin, '.claude-plugin/marketplace.json');
      const catalog = JSON.parse(await readFile(path, 'utf8'));
      catalog.plugins.push({
        name,
        source: unsafe === 'remote' ? { source: 'git', url: 'https://example.test/sibling.git' } : `./${name}`,
      });
      await writeFile(path, JSON.stringify(catalog));
      await mkdir(join(f.plugin, name, '.claude-plugin'), { recursive: true });
      const manifest = join(f.plugin, name, '.claude-plugin/plugin.json');
      await writeFile(manifest, JSON.stringify({ name, version: '2.0.0' }));
      await mkdir(join(f.dir, 'codex config/plugins/cache/celetis', name, 'local'), { recursive: true });
      await f.put('native-active-versions', JSON.stringify({ 'celetis@celetis': 'local', [id]: 'local' }));
      await f.put('native-configured-plugins', JSON.stringify({ [id]: { enabled: false } }));
      await f.put('simulate-native-refresh');
      const result = await f.run(['7'], { host: 'codex' });
      expect({
        code: result.code,
        replaced: await f.has('native-sibling-replaced'),
        materialized: await f.has('native-remote-source-materialized'),
      }).toEqual({ code: 1, replaced: false, materialized: false });
      expect(result.stderr).toContain(id);
      expect(await f.logs('calls')).toEqual([]);
      expect(await f.logs('mutations')).toEqual([]);
      catalog.plugins.at(-1).source = `./${name}`;
      await writeFile(path, JSON.stringify(catalog));
      await writeFile(manifest, JSON.stringify({ name }));
      const safe = await f.run(['7'], { host: 'codex' });
      expect(safe.code, safe.stderr).toBe(0);
      expect(await f.has('native-sibling-replaced')).toBe(false);
      expect(await f.has('native-remote-source-materialized')).toBe(false);
    }),
  );

test.concurrent(
  'Codex rejects a malformed same-marketplace plugin key before startup',
  runnerCase(async (f) => {
    await f.put('native-configured-plugins', JSON.stringify({ 'bad..name@celetis': { enabled: false } }));
    const result = await f.run(['7'], { host: 'codex' });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('invalid native plugin ID bad..name@celetis');
    expect(await f.logs('calls')).toEqual([]);
    expect(await f.logs('mutations')).toEqual([]);
  }),
);

for (const sourceType of ['Git', 'local'])
  for (const resume of [false, true])
    test.concurrent(
      `Codex ${sourceType} ${resume ? 'exact Resume' : 'Run'} keeps an active cooperating board package without native replacement`,
      runnerCase(async (f) => {
        await mkdir(join(f.plugin, 'board'));
        await writeFile(join(f.plugin, 'board/asset.txt'), 'board asset');
        await writeFile(
          join(f.plugin, 'board/cli.ts'),
          `import{fstatSync,readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';for await(const _ of process.stdin){}fstatSync(3);const state=process.env.RUNNER_TEST!;const asset=join(process.env.RUNNER_PLUGIN!,'board/asset.txt');readFileSync(asset);writeFileSync(join(state,'board-ready'),'');while(true){try{readFileSync(asset);}catch(error){writeFileSync(join(state,'board-asset-error'),(error as Error).message);}await Bun.sleep(5);}`,
        );
        const catalogPath = join(f.plugin, '.claude-plugin/marketplace.json');
        const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
        catalog.plugins.push({ name: 'sibling', source: './sibling' });
        await writeFile(catalogPath, JSON.stringify(catalog));
        await mkdir(join(f.plugin, 'sibling/.claude-plugin'), { recursive: true });
        await writeFile(join(f.plugin, 'sibling/.claude-plugin/plugin.json'), '{"name":"sibling"}');
        const sibling = join(f.dir, 'codex config/plugins/cache/celetis/sibling/local');
        await mkdir(sibling, { recursive: true });
        await writeFile(join(sibling, 'asset.txt'), 'unrelated package');
        await f.put(
          'native-active-versions',
          JSON.stringify({ 'celetis@celetis': 'local', 'sibling@celetis': 'local' }),
        );
        await f.put('native-configured-plugins', JSON.stringify({ 'sibling@celetis': { enabled: false } }));
        if (sourceType === 'Git') {
          await f.git(['init', '-q'], f.plugin);
          await f.git(['add', '.'], f.plugin);
          await f.git(['commit', '-qm', 'installed'], f.plugin);
          await f.git(['remote', 'add', 'origin', f.plugin], f.plugin);
          const sha = await f.git(['rev-parse', 'HEAD'], f.plugin);
          await writeFile(
            join(f.plugin, '.codex-marketplace-install.json'),
            JSON.stringify({ source_type: 'git', source: f.plugin, ref_name: 'main', sparse_paths: [], revision: sha }),
          );
          await f.put('git-marketplace');
          await f.put('installed-sha', sha);
        } else {
          const upstream = join(f.dir, 'upstream source');
          await cp(f.plugin, upstream, { recursive: true });
          const path = join(upstream, '.claude-plugin/plugin.json');
          await writeFile(path, JSON.stringify({ ...JSON.parse(await readFile(path, 'utf8')), version: '2.0.0' }));
          await f.put('marketplace-root', upstream);
        }
        await f.put('simulate-native-refresh');
        const config = await readFile(join(f.repo, '.celetis.yaml'), 'utf8');
        if (resume)
          await f.write(
            'repo dir/.git/celetis-flow/sessions/7.json',
            JSON.stringify({
              schema: 1,
              issue: 7,
              checkout: f.repo,
              host: 'codex',
              step: 'plan',
              session_id: '01a139fc-2ffa-74c0-9b14-e35e23339910',
            }),
          );
        const board = f.start([], { script: 'board', host: 'codex' });
        try {
          await f.wait('board-ready');
          const before = (await stat(f.plugin)).ino;
          const siblingBefore = (await stat(sibling)).ino;
          const marker = await readFile(join(f.plugin, '.codex-marketplace-install.json'), 'utf8').catch(() => null);
          const result = await f.run(resume ? ['--resume', '7'] : ['7'], { host: 'codex' });
          expect(result.code, result.stderr).toBe(0);
          const calls = await f.logs<{ args: string[] }>('calls');
          expect({
            replacements: await f.logs('native-replacements'),
            assetError: await f.read('board-asset-error'),
            sameRoot: (await stat(f.plugin)).ino === before,
          }).toEqual({ replacements: [], assetError: '', sameRoot: true });
          expect(calls[0]?.args).toContain('marketplaces.celetis.source_type="local"');
          expect(calls[0]?.args).toContain(`marketplaces.celetis.source=${JSON.stringify(f.plugin)}`);
          expect(calls[0]?.args.some((arg) => arg.startsWith('marketplaces.celetis.ref='))).toBe(false);
          if (resume) expect(calls[0]?.args).toContain('01a139fc-2ffa-74c0-9b14-e35e23339910');
          expect(await readFile(join(f.plugin, 'step-prompt.md'), 'utf8')).toBe(stepText);
          expect(await readFile(join(f.repo, '.celetis.yaml'), 'utf8')).toBe(config);
          expect(await readFile(join(f.plugin, '.codex-marketplace-install.json'), 'utf8').catch(() => null)).toBe(
            marker,
          );
          expect((await stat(sibling)).ino).toBe(siblingBefore);
          expect(await readFile(join(sibling, 'asset.txt'), 'utf8')).toBe('unrelated package');
          expect(await f.has('native-sibling-replaced')).toBe(false);
          expect(await f.has('native-remote-source-materialized')).toBe(false);
          expect(await f.logs('mutations')).toEqual([]);
        } finally {
          board.child.kill('SIGTERM');
          await board.result;
        }
      }),
    );

for (const condition of ['version', 'schema', 'sibling', 'scope', 'policy', 'catalog'])
  test.concurrent(
    `Codex refuses the concrete ${condition} conflict before native consumer startup`,
    runnerCase(async (f) => {
      if (condition === 'version') {
        await mkdir(join(f.plugin, '.codex-plugin'));
        await writeFile(join(f.plugin, '.codex-plugin/plugin.json'), '{"name":"celetis","version":"2.0.0"}');
      }
      if (condition === 'schema') {
        await mkdir(join(f.plugin, '.codex-plugin'));
        await writeFile(
          join(f.plugin, '.codex-plugin/plugin.json'),
          '{"name":"celetis","$schema":"https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"}',
        );
      }
      if (condition === 'sibling') {
        const path = join(f.plugin, '.claude-plugin/marketplace.json');
        const catalog = JSON.parse(await readFile(path, 'utf8'));
        catalog.plugins.push({ name: 'sibling', source: './sibling' });
        await writeFile(path, JSON.stringify(catalog));
        await mkdir(join(f.plugin, 'sibling/.claude-plugin'), { recursive: true });
        await writeFile(join(f.plugin, 'sibling/.claude-plugin/plugin.json'), '{"name":"sibling","version":"2.0.0"}');
        await mkdir(join(f.dir, 'codex config/plugins/cache/celetis/sibling/local'), { recursive: true });
        await f.put('native-configured-plugins', JSON.stringify({ 'sibling@celetis': { enabled: false } }));
      }
      let cwd = f.repo;
      if (condition === 'scope') {
        cwd = join(f.dir, 'aaa checkout');
        await cp(f.repo, cwd, { recursive: true });
        await mkdir(join(cwd, '.agents/plugins'), { recursive: true });
        await writeFile(
          join(cwd, '.agents/plugins/marketplace.json'),
          '{"name":"celetis","plugins":[{"name":"celetis","source":"./mutable"}]}',
        );
      }
      if (condition === 'policy') await f.put('native-local-marketplaces', '[]');
      if (condition === 'catalog') {
        const upstream = join(f.dir, 'upstream');
        await cp(f.plugin, upstream, { recursive: true });
        const path = join(upstream, '.claude-plugin/marketplace.json');
        const catalog = JSON.parse(await readFile(path, 'utf8'));
        catalog.plugins.push({ name: 'sibling', source: './sibling' });
        await writeFile(path, JSON.stringify(catalog));
        await f.put('marketplace-root', upstream);
        await f.put('native-configured-plugins', JSON.stringify({ 'sibling@celetis': { enabled: true } }));
      }
      const result = await f.run(['7'], { host: 'codex', cwd });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        condition === 'scope'
          ? 'mutable session marketplace precedes'
          : condition === 'policy'
            ? 'native policy or marketplace discovery'
            : condition === 'catalog'
              ? 'session catalog changes configured plugin sibling@celetis'
              : condition === 'schema'
                ? 'unsupported agent-plugin schema'
                : 'native session would install or replace configured plugin',
      );
      expect(await f.logs('calls')).toEqual([]);
      expect(await f.logs('mutations')).toEqual([]);
    }),
  );

test.concurrent(
  'Codex keeps the installed source ahead of a later mutable checkout catalog',
  runnerCase(async (f) => {
    const alias = join(f.dir, 'source alias');
    await symlink(f.plugin, alias);
    await f.put('marketplace-root', alias);
    const path = join(f.plugin, '.claude-plugin/plugin.json');
    await writeFile(
      path,
      JSON.stringify({
        ...JSON.parse(await readFile(path, 'utf8')),
        $schema: 'https://example.test/unrelated.schema.json',
      }),
    );
    await f.write(
      'repo dir/.agents/plugins/marketplace.json',
      '{"name":"celetis","plugins":[{"name":"celetis","source":"./mutable"}]}',
    );
    const result = await f.run(['7'], { host: 'codex' });
    expect(result.code, result.stderr).toBe(0);
    expect(await f.logs('mutations')).toEqual([]);
  }),
);

test.concurrent(
  'missing update-policy dependency is reported before starting a numbered session',
  runnerCase(async (f) => {
    await rm(join(f.plugin, 'scripts/lib/plugin-metadata.ts'));
    const result = await f.run(['7']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('plugin version of this runner was removed');
    expect(await f.logs('calls')).toEqual([]);
  }),
);

for (const args of [['7'], [], ['--board'], ['--resume', '7']])
  test.concurrent(
    `real Codex invalid native profile refuses ${JSON.stringify(args)} before a consumer starts`,
    runnerCase(async (f) => {
      await cp(join(root, 'scripts/lib/plugin-policy.ts'), join(f.plugin, 'scripts/lib/plugin-policy.ts'));
      await f.issue();
      if (args[0] === '--resume') {
        await f.git(['rev-parse', '--git-common-dir']);
        await f.write(
          'repo dir/.git/celetis-flow/sessions/7.json',
          JSON.stringify({
            schema: 1,
            issue: 7,
            checkout: f.repo,
            host: 'codex',
            step: 'plan',
            session_id: '01a139fc-2ffa-74c0-9b14-e35e23339910',
          }),
        );
      }
      f.env.CODEX_HOME = join(f.dir, 'missing-native-profile');
      const result = await f.run(args, { host: 'codex' });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('CODEX_HOME');
      expect(await f.logs('calls')).toEqual([]);
      expect(await f.logs('mutations')).toEqual([]);
    }),
  );

for (const args of [['7'], [], ['--board'], ['--resume', '7']])
  test.concurrent(
    `real Claude concrete local policy conflict refuses ${JSON.stringify(args)}`,
    runnerCase(async (f) => {
      await cp(join(root, 'scripts/lib/plugin-policy.ts'), join(f.plugin, 'scripts/lib/plugin-policy.ts'));
      await f.issue();
      await f.write(
        'repo dir/.claude/settings.json',
        JSON.stringify({ extraKnownMarketplaces: { celetis: { autoUpdate: false } } }),
      );
      if (args[0] === '--resume')
        await f.write(
          'repo dir/.git/celetis-flow/sessions/7.json',
          JSON.stringify({
            schema: 1,
            issue: 7,
            checkout: f.repo,
            host: 'claude',
            step: 'plan',
            session_id: '01a139fc-2ffa-74c0-9b14-e35e23339910',
          }),
        );
      await f.write(
        'repo dir/.claude/settings.local.json',
        JSON.stringify({ extraKnownMarketplaces: { celetis: { autoUpdate: true } } }),
      );
      const result = await f.run(args);
      expect(result.code, result.stderr).toBe(1);
      expect(result.stderr).toContain('settings.local.json');
      expect(await f.logs('calls')).toEqual([]);
      expect(await f.logs('mutations')).toEqual([]);
    }),
  );

test.concurrent(
  'real Claude local policy overrides project false and refuses consumer start',
  runnerCase(async (f) => {
    await cp(join(root, 'scripts/lib/plugin-policy.ts'), join(f.plugin, 'scripts/lib/plugin-policy.ts'));
    await f.write(
      'repo dir/.claude/settings.json',
      JSON.stringify({ extraKnownMarketplaces: { celetis: { autoUpdate: false } } }),
    );
    await f.write(
      'repo dir/.claude/settings.local.json',
      JSON.stringify({ extraKnownMarketplaces: { celetis: { autoUpdate: true } } }),
    );
    const result = await f.run(['7']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('.claude/settings.local.json');
    expect(await f.logs('calls')).toEqual([]);
    expect(await f.logs('mutations')).toEqual([]);
  }),
);

for (const host of ['claude', 'codex']) {
  for (const automatic of [false, true])
    test.concurrent(
      `${host} ${automatic ? 'automatic' : 'numbered'} start uses its installed package without updates`,
      runnerCase(async (f) => {
        await f.put('update-fail');
        await rm(join(f.plugin, 'scripts/plugin-update.ts'));

        const r = await start(f, host, automatic);
        await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
        await f.put('finish-1');
        if (automatic) {
          const deadline = performance.now() + 5000;
          while (await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks/issue-7'])) {
            if (performance.now() >= deadline) throw new Error('the completed issue lock was not released');
            await Bun.sleep(10);
          }
          r.child.kill('SIGTERM');
        }
        const result = await r.result;
        expect(result.code, result.stderr).toBe(automatic ? 143 : 0);
        expect(await f.logs('mutations')).toEqual([]);
        expect((await f.logs('calls')).map((call) => call.host)).toEqual([host]);
      }, true),
    );
  test.concurrent(
    `updater rejects obsolete identity arguments for ${host} through the public launcher`,
    runnerCase(async (f) => {
      const r = await f.run(['--agent', host, 'plugin-update', 'apply', '/old/home'], {
        host: host === 'claude' ? 'codex' : 'claude',
        entry: join(f.plugin, 'scripts/launcher.ts'),
      });
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('plugin-update [check]');
      expect(await f.logs('mutations')).toEqual([]);
      expect(await f.logs('calls')).toEqual([]);
    }),
  );
}
test.concurrent(
  'manual update rejects the obsolete runner PID interface before native commands',
  runnerCase(async (f) => {
    const r = await f.run([String(process.pid), 'claude'], { script: 'plugin-update' });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('usage: scripts/celetis [--agent claude|codex] plugin-update');
    expect(await f.logs('mutations')).toEqual([]);
  }),
);
for (const [host, automatic] of [
  ['claude', false],
  ['codex', true],
] as const)
  test.concurrent(
    `registration ${host} ${automatic ? 'auto' : 'issue'} starts only after both refs commit`,
    runnerCase(async (f) => {
      const realGit = Bun.which('git');
      if (!realGit) throw new Error('git is missing');
      f.env.REAL_GIT = realGit;
      await f.put('hold-session');
      await f.put('skip-input');
      await f.issue();
      await f.put('hold-registration');
      await f.stub(
        'git',
        `import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {spawn} from 'node:child_process';const S=process.env.RUNNER_TEST!;const args=process.argv.slice(2);let input='';if(args.join(' ')==='update-ref --no-deref --stdin'&&existsSync(join(S,'hold-registration'))){for await(const data of process.stdin)input+=data.toString();writeFileSync(join(S,'registering'),input);while(!existsSync(join(S,'allow-registration')))await Bun.sleep(10);}const c=spawn(process.env.REAL_GIT!,args,{stdio:input?['pipe','inherit','inherit']:'inherit'});if(input)c.stdin!.end(input);process.exitCode=await new Promise<number>(done=>c.on('close',code=>done(code??1)));`,
      );
      const dying = f.start(automatic ? [] : ['7'], { host, env: managed });
      await f.wait('registering');
      dying.child.kill('SIGKILL');
      await dying.exited;
      await f.put('allow-registration');
      await Bun.sleep(200);
      const startedBeforeLockRegistration = await f.has('started-1');
      expect(startedBeforeLockRegistration).toBe(false);
      await rm(join(f.state, 'hold-registration'));
      await f.put('dynamic-id');
      const r = await start(f, host, automatic);
      if (automatic)
        expect(await f.git(['rev-parse', 'refs/celetis-flow/locks/runner'])).toBe(
          await f.git(['rev-parse', 'refs/celetis-flow/locks/issue-7']),
        );
      await f.issue(7, 'enhancement', 'Spec: fixture', [], 'closed');
      r.child.kill('SIGKILL');
      await r.exited;
      await held(f, host);
      if (automatic) {
        const other = await f.run([], { host: 'codex' });
        expect(other.code).toBe(1);
        expect(other.stderr).toContain('another automatic runner or its session');
      }
      await f.put('finish-1');
      const deadline = performance.now() + 4000;
      while ((await f.has('live')) && performance.now() < deadline) await Bun.sleep(10);
      expect(await f.has('live')).toBe(false);
      const after = await f.run(['7'], { host });
      expect(after.stdout).toContain('stop #7 is finished');
    }, true),
  );
