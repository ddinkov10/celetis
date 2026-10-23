import { expect } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readConfig } from '../../scripts/lib/config.ts';
import { command, fixture, isolatedArgs, root } from './fixture.ts';

export const allLabels =
  'needs-triage bug enhancement hotfix chore epic needs-info ready-for-agent ready-for-human wontfix';
export const setupSource = `import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
const kept = 'kept';
const main = process.argv[2];
appendFileSync(process.env.SETUP_LOG!, JSON.stringify({ cwd: process.cwd(), main, kept }) + '\\n');
writeFileSync(process.env.SETUP_BYTES!, readFileSync(import.meta.path));
writeFileSync(process.env.SETUP_META!, JSON.stringify({ file: import.meta.path, mode: statSync(import.meta.path).mode & 0o777, bun: process.execPath }));
console.error('noise "quoted" \\u005cslash');
if (process.env.SETUP_STDOUT) process.stdout.write(process.env.SETUP_STDOUT);
if (process.env.FAIL_SETUP) process.exit(Number(process.env.FAIL_SETUP));
`;

export function literal(text: string): string {
  const breaks = text.length - text.replace(/\n+$/, '').length;
  const first = text.split('\n').find((line) => line.length > 0);
  const indent = first?.startsWith(' ') ? '2' : '';
  const chomp = breaks === 0 ? '-' : breaks === 1 ? '' : '+';
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return `worktreeSetup: |${indent}${chomp}\n${text ? `${lines.map((line) => (line ? `  ${line}` : '')).join('\n')}\n` : ''}`;
}

export async function laneFixture(setup: string | null = setupSource) {
  const f = await fixture();
  const env = Object.assign(f.env, {
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.test',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'maintenance.auto',
    GIT_CONFIG_VALUE_0: 'false',
    GH_STATE: join(f.dir, 'state.json'),
    GH_LOG: join(f.dir, 'gh.log'),
    LABEL_LOG: join(f.dir, 'label.log'),
    GIT_LOG: join(f.dir, 'git.log'),
    TMPDIR: join(f.dir, 'tmp'),
    SETUP_LOG: join(f.dir, 'setup.log'),
    SETUP_BYTES: join(f.dir, 'setup.bytes'),
    SETUP_META: join(f.dir, 'setup.meta'),
    PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`,
  });
  await mkdir(env.TMPDIR);
  const git = async (args: string[], cwd = f.repo) => {
    const r = await command('git', args, { cwd, env: f.env });
    expect(r.code, `${args.join(' ')}: ${r.stderr}`).toBe(0);
    return r.stdout.trimEnd();
  };
  await f.repository();
  await git(['branch', '-M', 'main']);
  await f.write('repo dir/.gitignore', '.claude/worktrees/\n');
  await f.write('repo dir/app.txt', 'app\n');
  if (setup !== null) await f.config(`landing: merge\n${literal(setup)}`);
  await git(['add', '.']);
  await git(['commit', '-qm', 'base']);
  const origin = join(f.dir, 'origin.git');
  await git(['clone', '-q', '--bare', f.repo, origin]);
  await git(['remote', 'add', 'origin', origin]);
  await git(['fetch', '-q', 'origin']);
  const initial = {
    repo: 'acme/widgets',
    trunk: 'main',
    title: 'Probe',
    state: 'open',
    labels: 'enhancement',
    heads: '',
    prs: 'OPEN 0',
    names: allLabels,
    pages: 1,
  };
  let state = { ...initial } as Record<string, unknown>;
  await f.stub(
    'gh',
    String.raw`import { appendFileSync, readFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.GH_LOG!, JSON.stringify(args)+'\n');
if(args[0]!=='api'){console.error('HTTP 403: GitHub GraphQL is not available from Claude Code sessions');process.exit(1);}
const flags = new Set(['--paginate','--slurp','--silent']);
let endpoint='', fields:string[]=[];
for(let i=1;i<args.length;i++){const a=args[i]!;if(flags.has(a))continue;if(a==='-f'){fields.push(args[++i]!);continue;}if(a.startsWith('-')){console.error('unexpected flag '+a);process.exit(2);}endpoint=a;}
const s=JSON.parse(readFileSync(process.env.GH_STATE!,'utf8'));
const fail=(key:string,message:string,code=1)=>{if(s[key]){console.error(message);process.exit(code);}};
const list=(value:unknown[])=>{if(!args.includes('--paginate')||!args.includes('--slurp')||!endpoint.includes('per_page=100')){console.error('list needs pagination');process.exit(2);}const pages=s.pages===2?[value.slice(0,1),value.slice(1)]:[value];console.log(JSON.stringify(pages));};
if(endpoint==='repos/{owner}/{repo}'){fail('repoFail','HTTP 404: Not Found');console.log(JSON.stringify({full_name:s.repo,default_branch:s.trunk}));}
else if(/^repos\/\{owner\}\/\{repo\}\/issues\/\d+$/.test(endpoint)){fail('issueFail','HTTP 404: Not Found');console.log(JSON.stringify({title:s.title,state:s.state,labels:s.labels.split(' ').filter(Boolean).map((name:string)=>({name}))}));}
else if(endpoint.startsWith('repos/{owner}/{repo}/pulls?state=open')){fail('prFail','To get started with GitHub CLI, please run:  gh auth login',4);list(s.heads.split(' ').filter(Boolean).map((ref:string)=>({head:{ref}})));}
else if(endpoint.startsWith('repos/{owner}/{repo}/pulls?head={owner}:')){fail('prFail','To get started with GitHub CLI, please run:  gh auth login',4);list(s.prs.split('\n').filter(Boolean).map((line:string)=>{const [state,sha]=line.split(' ');return {state:state==='OPEN'?'open':'closed',merged_at:state==='MERGED'?'2026-10-19T00:00:00Z':null,head:{sha}};}));}
else if(endpoint==='repos/{owner}/{repo}/labels?per_page=100'){fail('listFail','HTTP 403: Resource not accessible');list(s.names.split(' ').filter(Boolean).map((name:string)=>({name})));}
else if(endpoint==='repos/{owner}/{repo}/labels'){fail('labelFail','HTTP 403: Resource not accessible');const v=Object.fromEntries(fields.map(f=>{const p=f.indexOf('=');return [f.slice(0,p),f.slice(p+1)];}));appendFileSync(process.env.LABEL_LOG!,[v.name,v.description,v.color].join('|')+'\n');}
else {console.error('HTTP 404: Not Found ('+endpoint+')');process.exit(1);}`,
  );
  for (const name of ['gh.log', 'label.log', 'setup.log']) await f.write(name, '');
  const update = async (next: Record<string, unknown>) => {
    state = { ...state, ...next };
    await writeFile(env.GH_STATE, JSON.stringify(state));
  };
  await update({});
  const call = (
    name: 'worktree' | 'setup',
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string } = {},
  ) => {
    return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [...isolatedArgs, join(root, `scripts/${name}.ts`), ...args], {
        cwd: options.cwd ?? f.repo,
        env: { ...f.env, ...options.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', DO_NOT_TRACK: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '',
        stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`${name} timed out`));
      }, 8_000);
      child.stdout.on('data', (b) => {
        stdout += b;
      });
      child.stderr.on('data', (b) => {
        stderr += b;
      });
      child.stdin.on('error', () => {});
      child.stdin.end(options.input);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        readdir(env.TMPDIR)
          .then((files) => {
            expect(files).toEqual([]);
            resolve({ code: code ?? 1, stdout, stderr });
          })
          .catch(reject);
      });
    });
  };
  const commit = async (subject = 'product', cwd = f.repo) => {
    await git(['add', '-A'], cwd);
    await git(['commit', '-qm', subject], cwd);
  };
  return {
    ...f,
    env,
    git,
    origin,
    update,
    commit,
    call,
    worktree: (args: string[], options?: Parameters<typeof call>[2]) => call('worktree', args, options),
    setup: (args: string[], options?: Parameters<typeof call>[2]) => call('setup', args, options),
    configValue: (cwd = f.repo) => readConfig(cwd),
    marker: async (cwd: string) =>
      join(await git(['rev-parse', '--path-format=absolute', '--git-dir'], cwd), 'celetis-flow-setup-done'),
    setupRows: async () =>
      (await readFile(env.SETUP_LOG, 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    calls: async () =>
      (await readFile(env.GH_LOG, 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]),
    clean: async (cwd = f.repo) => expect(await git(['status', '--porcelain', '--untracked-files=all'], cwd)).toBe(''),
    async tempRemoved() {
      const meta = JSON.parse(await readFile(env.SETUP_META, 'utf8'));
      expect(meta.mode).toBe(0o600);
      expect(meta.file.startsWith(`${f.repo}/`)).toBe(false);
      expect(meta.file.endsWith('.ts')).toBe(true);
      expect(meta.bun).toBe(process.execPath);
      expect(await exists(meta.file)).toBe(false);
      expect(await exists(join(meta.file, '..'))).toBe(false);
    },
    async logGit() {
      const realGit = Bun.which('git');
      if (!realGit) throw new Error('git is missing');
      await f.stub(
        'git',
        `import { appendFileSync } from 'node:fs'; import { execve } from 'node:process'; appendFileSync(process.env.GIT_LOG!, JSON.stringify(process.argv.slice(2))+'\\n'); execve(${JSON.stringify(realGit)},[${JSON.stringify(realGit)},...process.argv.slice(2)],process.env);`,
      );
      await f.write('git.log', '');
    },
    async aliasGitPaths() {
      const realGit = Bun.which('git');
      if (!realGit) throw new Error('git is missing');
      await f.stub(
        'git',
        `import {spawnSync} from 'node:child_process';\nconst args = process.argv.slice(2);\nconst result = spawnSync(${JSON.stringify(realGit)}, args, {encoding:'utf8'});\nprocess.stderr.write(result.stderr ?? '');\nif(result.status !== 0) process.exit(result.status ?? 1);\nlet output = result.stdout;\nif(args.includes('--show-toplevel')) output = output.trimEnd() + '/.\\n';\nif(args[0] === 'worktree' && args[1] === 'list') output = output.split('\\0').map((field) => field.startsWith('worktree ') ? field + '/.' : field).join('\\0');\nprocess.stdout.write(output);`,
      );
    },
  };
}

export type LaneFixture = Awaited<ReturnType<typeof laneFixture>>;
export const exists = async (path: string) => (await stat(path).catch(() => null)) !== null;
export const writeOptions = ['--hosts', 'codex', '--landing', 'merge'];
export function withLane(body: (f: LaneFixture) => Promise<void>, setup: string | null = setupSource) {
  return async () => {
    const f = await laneFixture(setup);
    try {
      await body(f);
      expect((await f.calls()).every((args) => args[0] === 'api')).toBe(true);
      expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
    } finally {
      await f.cleanup();
    }
  };
}

export async function hook(f: LaneFixture, path: string, text: string) {
  const executable = await f.stub(`hook-${path.split('/').at(-1)}`, text);
  const target = join(f.repo, path);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, await readFile(executable), { mode: 0o755 });
}

export async function resetLog(f: LaneFixture, name: 'GH_LOG' | 'SETUP_LOG') {
  await writeFile(f.env[name], '');
}
