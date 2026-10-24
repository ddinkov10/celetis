import { expect } from 'bun:test';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, fixture, root } from './fixture.ts';

export async function updateFixture(host: 'claude' | 'codex', sibling = false) {
  const f = await fixture();
  await f.repository();
  const config = join(f.dir, 'config');
  const plugin = join(config, 'plugins/cache/celetis/celetis/local');
  const source = join(f.dir, 'source with spaces.git');
  await mkdir(plugin, { recursive: true });
  await f.write('config/plugins/cache/celetis/celetis/local/.claude-plugin/plugin.json', '{"name":"celetis"}');
  await f.write(
    'config/plugins/cache/celetis/celetis/local/.claude-plugin/marketplace.json',
    JSON.stringify({
      name: 'celetis',
      plugins: [{ name: 'celetis', source: './' }, ...(sibling ? [{ name: 'sibling', source: './sibling' }] : [])],
    }),
  );
  await f.write('config/plugins/cache/celetis/celetis/local/scripts/root.ts', '');
  await f.write('config/plugins/cache/celetis/celetis/local/step-prompt.md', 'installed\n');
  await f.write('config/plugins/cache/celetis/celetis/local/skills/guide/SKILL.md', 'installed\n');
  if (sibling)
    await f.write(
      'config/plugins/cache/celetis/celetis/local/sibling/.claude-plugin/plugin.json',
      '{"name":"sibling"}',
    );
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
    `import { appendFileSync,readFileSync,writeFileSync } from 'node:fs';import {dirname,join} from 'node:path';const dir=dirname(process.env.CELETIS_AGENT==='claude'?process.env.CLAUDE_CONFIG_DIR!:process.env.CODEX_HOME!);const nativeRoot=join(dir,'config/plugins/cache/celetis/celetis/local');const args=process.argv.slice(2);appendFileSync(join(dir,'calls'),JSON.stringify(args)+'\\n');if(JSON.stringify(args)===JSON.stringify(['--disable','plugins','app-server','--stdio'])){for await(const data of (await import('node:readline')).createInterface({input:process.stdin})){const m=JSON.parse(data);if(m.method==='initialized')continue;console.log(JSON.stringify({id:m.id,result:m.method==='config/read'?JSON.parse(readFileSync(join(dir,'effective.json'),'utf8')):{}}));}process.exit(0);}if(args[0]==='--version'){console.log(${JSON.stringify(host === 'codex' ? 'codex-cli 0.164.0' : '2.1.306 (Claude Code)')});process.exit(0);}if(JSON.stringify(args)===${JSON.stringify(JSON.stringify(host === 'claude' ? ['plugin', 'list', '--json'] : ['plugin', 'list', '--marketplace', 'celetis', '--json']))}){process.stdout.write(readFileSync(join(dir,'list.json')));process.exit(0);}if(JSON.stringify(args)===JSON.stringify(['plugin','marketplace','list','--json'])){process.stdout.write(readFileSync(join(dir,'market.json')));process.exit(0);}appendFileSync(join(dir,'mutations'),JSON.stringify(args)+'\\n');console.error('unexpected native operation');process.exit(91);`,
  );
  await cp(join(root, 'scripts'), join(plugin, 'scripts'), { recursive: true });
  await git(['add', '.']);
  await git(['commit', '-qm', 'fixture commands']);
  const actualInstalled = await git(['rev-parse', 'HEAD']);
  if (host === 'codex')
    await writeFile(
      join(plugin, '.codex-marketplace-install.json'),
      JSON.stringify({ source_type: 'git', source, ref_name: 'main', sparse_paths: [], revision: actualInstalled }),
    );
  await f.write(
    'config/plugins/installed_plugins.json',
    JSON.stringify({
      version: 2,
      plugins: {
        'celetis@celetis': [{ scope: 'user', installPath: plugin, version: 'local', gitCommitSha: actualInstalled }],
      },
    }),
  );
  const native = await readFile(join(f.dir, 'bin', host), 'utf8');
  await writeFile(
    join(f.dir, 'bin', host),
    native.replace(
      "if(JSON.stringify(args)===JSON.stringify(['--disable'",
      `if(args.length===0){writeFileSync(join(dir,'consumer-pid'),String(process.pid));await Bun.sleep(30000);process.exit(0);}if(args.includes('update')||args.includes('upgrade')){let sha;const at=args.indexOf('--settings');if(at>=0){const settings=JSON.parse(readFileSync(args[at+1],'utf8'));const market=settings.extraKnownMarketplaces.celetis;if(market.source.source!=='settings'){if((await Bun.file(join(dir,'restore-fail'))).size){console.error('fixture: native source restoration failed');process.exit(25);}if(args.slice(at+2).join(' ')!=='plugin marketplace update celetis')process.exit(94);appendFileSync(join(dir,'mutations'),JSON.stringify(args)+'\\n');writeFileSync(join(dir,'config/plugins/known_marketplaces.json'),JSON.stringify({celetis:{source:market.source,autoUpdate:false}}));console.log(JSON.stringify({restored:true}));process.exit(0);}sha=market.source.plugins[0].source.sha;if(market.source.plugins[0].source.url!==${JSON.stringify(source)})process.exit(92);writeFileSync(join(dir,'config/plugins/known_marketplaces.json'),JSON.stringify({celetis:{source:market.source,autoUpdate:false}}));}else{const override=args.find(value=>value.startsWith('marketplaces.celetis.ref='));sha=override?JSON.parse(override.slice(override.indexOf('=')+1)):undefined;}if(sha!==${JSON.stringify(target)})process.exit(93);appendFileSync(join(dir,'mutations'),JSON.stringify(args)+'\\n');if((await Bun.file(join(dir,'apply-fail'))).size){console.error('fixture: native application failed before replacement');process.exit(23);}const {execFileSync}=await import('node:child_process');const moved=await Bun.file(join(dir,'move-remote')).text().catch(()=>null);if(moved)execFileSync('git',['--git-dir',${JSON.stringify(source)},'update-ref','refs/heads/main',moved]);execFileSync('git',['-C',nativeRoot,'fetch','-q',${JSON.stringify(source)},sha]);execFileSync('git',['-C',nativeRoot,'reset','--hard',sha]);if(process.env.CELETIS_AGENT==='codex')writeFileSync(join(nativeRoot,'.codex-marketplace-install.json'),JSON.stringify({source_type:'git',source:${JSON.stringify(source)},ref_name:sha,sparse_paths:[],revision:sha}));const configured=JSON.parse(readFileSync(join(dir,'effective.json'),'utf8')).config.plugins;if(configured?.['sibling@celetis'])writeFileSync(join(dir,'sibling-state'),'changed');if((await Bun.file(join(dir,'apply-partial'))).size){console.error('fixture: native application failed after package replacement');process.exit(24);}const registry=JSON.parse(readFileSync(join(dir,'config/plugins/installed_plugins.json'),'utf8'));registry.plugins['celetis@celetis'][0].gitCommitSha=sha;writeFileSync(join(dir,'config/plugins/installed_plugins.json'),JSON.stringify(registry));console.log(JSON.stringify({updated:true,sha}));process.exit(0);}if(JSON.stringify(args)===JSON.stringify(['--disable'`,
    ),
  );
  const update = (args: string[], launcher = false) =>
    f.bun(
      join(plugin, launcher ? 'scripts/launcher.ts' : 'scripts/plugin-update.ts'),
      launcher ? ['plugin-update', ...args] : args,
      { cwd: f.repo, env },
    );
  const mutations = () => readFile(join(f.dir, 'mutations'), 'utf8').catch(() => '');
  const applyEntry = await f.write(
    'apply.ts',
    `import {updatePlugin} from ${JSON.stringify(join(plugin, 'scripts/plugin-update.ts'))};const [home,root,source,installed,target]=process.argv.slice(2);try{console.log(await updatePlugin(process.pid,${JSON.stringify(host)},{home:home!,root:root!,source:source!,installed:installed!,target:target!}));}catch(error){console.error((error as Error).message);process.exitCode=1;}`,
  );
  const apply = (args = [config, plugin, source, actualInstalled, target], selectedEnv: NodeJS.ProcessEnv = env) =>
    f.bun(applyEntry, args, { cwd: f.repo, env: selectedEnv });
  return { ...f, env, config, plugin, source, installed: actualInstalled, target, update, apply, mutations, git };
}
