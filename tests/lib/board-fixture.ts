import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, fixture, isolatedArgs, root } from './fixture.ts';

export function invoke(entry: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, input = '') {
  return new Promise<{ code: number; stdout: string; stderr: string }>((done) => {
    const child = execFile(
      process.execPath,
      [...isolatedArgs, entry, ...args],
      {
        cwd,
        env: { ...env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', DO_NOT_TRACK: '1' },
        timeout: 15_000,
      },
      (error, stdout, stderr) =>
        done({ code: typeof error?.code === 'number' ? error.code : error ? 1 : 0, stdout, stderr }),
    );
    child.stdin?.on('error', () => {});
    child.stdin?.end(input);
  });
}

export async function boardFixture() {
  const f = await fixture();
  const plugin = join(f.dir, 'installed package');
  await mkdir(plugin);
  await cp(join(root, 'scripts'), join(plugin, 'scripts'), { recursive: true });
  await writeFile(
    join(plugin, 'scripts/lib/plugin-policy.ts'),
    'export async function requireUpdatePolicy(): Promise<void> {}\n',
  );
  await mkdir(join(plugin, 'board'));
  const entry = join(plugin, 'scripts/board.ts');
  const capture = join(f.dir, 'capture.json');
  const env = Object.assign(f.env, {
    PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`,
    BOARD_CAPTURE: capture,
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.test',
  });
  delete env.PORT;
  delete env.CELETIS_AGENT;
  delete env.CELETIS_RESUME_RECORD;
  for (const name of Object.keys(env))
    if (name.startsWith('GIT_') && !/^(GIT_AUTHOR_|GIT_COMMITTER_)/.test(name)) delete env[name];
  await f.write(
    'installed package/board/cli.ts',
    `import {writeFileSync} from 'node:fs';
    let input='';for await(const data of process.stdin)input+=data.toString();
    writeFileSync(process.env.BOARD_CAPTURE!,JSON.stringify({argv:process.argv.slice(1),cwd:process.cwd(),port:process.env.PORT??'',path:process.env.PATH,config:JSON.parse(input)}));
    if(process.env.BOARD_CHECK==='1'){
      const {spawnSync}=await import('node:child_process');const r=spawnSync(process.execPath,${JSON.stringify(isolatedArgs)}.concat(${JSON.stringify(join(root, 'board/cli.ts'))},'check','--config-stdin'),{input,encoding:'utf8',env:process.env});
      process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exitCode=r.status??1;
    }else process.exitCode=Number(process.env.BOARD_CHILD_STATUS??0);`,
  );
  await f.stub(
    'gh',
    `const a=process.argv.slice(2);if(a[0]!=='api')process.exit(1);const p=a.find(s=>s.startsWith('repos/'))??'';if(!p.includes('/issues?')&&!p.includes('/pulls?'))process.exit(1);console.log('[[]]');`,
  );
  await f.stub('herdr', `console.log('{"result":{"snapshot":{"agents":[],"tabs":[]}}}');`);
  const launcher = `import {appendFileSync} from 'node:fs';appendFileSync(process.env.BOARD_PRODUCER_LOG!,JSON.stringify(process.argv.slice(2))+'\\n');
    const {spawnSync}=await import('node:child_process');const r=spawnSync(process.execPath,${JSON.stringify(isolatedArgs)}.concat(${JSON.stringify(join(plugin, 'scripts/celetis-flow.ts'))},process.argv.slice(3)),{stdio:'inherit',env:process.env});process.exitCode=r.status??1;`;
  await f.stub('unused', '');
  const shebang = (await readFile(join(f.dir, 'bin/unused'), 'utf8')).split('\n')[0];
  await f.write('repo dir/scripts/celetis', `${shebang}\n${launcher}`, 0o755);
  env.BOARD_PRODUCER_LOG = join(f.dir, 'producer');
  await f.write('repo dir/sub/.celetis.yaml', 'landing: merge\nboard: {port: 4555}\n');
  await f.config('landing: pr\nboard:\n  port: 4404\n');
  await f.repository();
  const git = async (...args: string[]) => {
    const result = await command('git', args, { cwd: f.repo, env });
    if (result.code) throw new Error(result.stderr);
    return result.stdout.trimEnd();
  };
  await git('add', '.');
  await git('commit', '-qm', 'fixture');
  const lane = join(f.repo, '.claude/worktrees/lane');
  await git('worktree', 'add', '-qb', 'lane', lane);
  await f.write('repo dir/.claude/worktrees/lane/sub/.keep', '');
  await f.write('repo dir/.claude/worktrees/lane/.celetis.yaml', 'landing: merge\nboard: {port: 4999}\n');
  return {
    ...f,
    plugin,
    entry,
    env,
    git,
    lane,
    capture,
    run: (cwd = f.repo, extra: NodeJS.ProcessEnv = {}, args: string[] = []) =>
      invoke(entry, args, cwd, { ...env, ...extra }),
    captured: async () => JSON.parse(await readFile(capture, 'utf8')),
  };
}
