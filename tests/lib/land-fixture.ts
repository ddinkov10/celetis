import { afterAll, beforeAll, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { command, isolatedArgs, root } from './fixture.ts';
export const subject = 'fix(x): y';
const env = {
  ...process.env,
  BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0',
  DO_NOT_TRACK: '1',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'maintenance.auto',
  GIT_CONFIG_VALUE_0: 'false',
};
const ghStub = String.raw`
import {appendFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const S=process.env.S!, args=process.argv.slice(2),repo='repos/{owner}/{repo}';
const read=(n:string)=>readFileSync(join(S,n),'utf8');
const has=(n:string)=>existsSync(join(S,n));
const put=(n:string,v:string)=>writeFileSync(join(S,n),v);
const log=(n:string,v:unknown)=>appendFileSync(join(S,n),JSON.stringify(v)+'\n');
log('gh-calls',args);
const lock=join(process.cwd(),'.git/celetis-flow/land-7.lock');
if(!has('lock-seen')&&existsSync(lock))put('lock-seen',readFileSync(lock,'utf8'));
if(args[0]!=='api'){console.error('HTTP 403: GitHub GraphQL is not available from Claude Code sessions');process.exit(1);}
let endpoint='',method='',fields:string[]=[];
for(let i=1;i<args.length;i++){
 const a=args[i]!;
 if(['--paginate','--slurp','--silent'].includes(a))continue;
 if(a==='-X'){method=args[++i]!;continue;}
 if(a==='-f'){fields.push(args[++i]!);continue;}
 if(a.startsWith('-')){console.error('stub gh: unknown flag '+a);process.exit(1);}
 endpoint=a;
}
method ||= fields.length?'POST':'GET';
const path=endpoint.split('?')[0]!,last=path.split('/').at(-1);
if(has('gh-fail')||has('fail-'+method+'-'+last)){console.error('HTTP 502');process.exit(1);}
if(has('warnings'))console.error('fixture: gh warning '+method+' '+endpoint);
if(readFileSync(join(S,'hold-stage'),'utf8').trim()===method+' '+path){
 put('held',String(process.pid));
 while(has('hold'))await Bun.sleep(5);
}
const answer=(n:string)=>JSON.parse(read(n+'.json'));
const list=(value:any)=>{
 if(!args.includes('--paginate')||!args.includes('--slurp')||(!endpoint.includes('per_page=100')&&!path.endsWith('/sub_issues'))){console.error('stub gh: a list without pagination: '+endpoint);process.exit(1);}
 let pages=[value];
 if(has('pages')){
  if(Array.isArray(value))pages=[value.slice(0,1),value.slice(1)];
  else {const k=Object.keys(value)[0]!;pages=[{[k]:value[k].slice(0,1)},{[k]:value[k].slice(1)}];}
 }
 console.log(JSON.stringify(pages));
};
const nth=(counter:string,name:string)=>{const k=Number(has(counter)?read(counter):'0')+1;put(counter,String(k));return has(name+'-'+k+'.json')?name+'-'+k:name;};
const field=(name:string)=>fields.find(f=>f.startsWith(name+'='))?.slice(name.length+1)??'';
const git=(args:string[])=>{const r=spawnSync(process.env.REAL_GIT!,['--git-dir='+process.env.ORIGIN!,...args],{encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stderr);process.exit(r.status??1);}return r.stdout.trimEnd();};
if(method==='GET'&&endpoint===repo)console.log(JSON.stringify(answer('repo')));
else if(method==='GET'&&path.endsWith('/parent')){
 if(has('parent-fail')){console.error('gh: Bad Gateway (HTTP 502)');process.exit(1);}
 if(!has('parent.json')){console.log('{"message":"No parent issue found","status":"404"}');console.error('gh: No parent issue found (HTTP 404)');process.exit(1);}
 console.log(JSON.stringify(answer('parent')));
}else if(method==='GET'&&path.endsWith('/sub_issues'))list(answer('subs'));
else if(method==='GET'&&path.includes('/issues/'))console.log(JSON.stringify(answer('issue')));
else if((method==='POST'||method==='PATCH')&&path.includes('/issues/')){
 const n=path.replace(/\/comments$/,'').split('/').at(-1)!;
 if(has('close-fail-'+n)){console.error('close failed');process.exit(1);}
 appendFileSync(join(S,'closed'),(method==='POST'?'comment '+n+' '+field('body'):'close '+n+' '+field('state')+' '+field('state_reason'))+'\n');
}else if(method==='GET'&&endpoint.startsWith(repo+'/pulls?state=open&'))list(answer('prs'));
else if(method==='GET'&&endpoint.startsWith(repo+'/pulls?head={owner}:')){
 const head=decodeURIComponent(endpoint.slice(endpoint.indexOf(':')+1).split('&')[0]!);
 list(answer('merged').filter((p:any)=>p.head.ref===head));
}else if(method==='POST'&&endpoint===repo+'/pulls'){
 put('create-args',JSON.stringify(fields));
 console.log(has('create-response.json')?read('create-response.json'):JSON.stringify({number:9,html_url:'https://github.com/o/r/pull/9'}));
}else if(method==='PUT'&&path.endsWith('/merge')){
 if(has('merge-fail')){console.error(read('merge-fail'));process.exit(1);}
 const pr=path.split('/').at(-2)!;
 put('merge-args',JSON.stringify({pr,fields}));
 put('origin-at-merge',git(['for-each-ref','--format=%(refname:short) %(objectname)','refs/heads']));
 const tree=git(['merge-tree','--write-tree','master',field('sha')]);
 const squash=git(['commit-tree',tree,'-p','master','-m','squash of '+pr]);
 git(['update-ref','refs/heads/master',squash]);
 if(has('auto-delete'))git(['update-ref','-d','refs/heads/'+read('auto-delete').trim()]);
}else if(method==='GET'&&path.includes('/pulls/'))console.log(JSON.stringify(answer(nth('views','view'))));
else if(method==='GET'&&path.endsWith('/check-runs'))list(answer(nth('polls','checks')));
else if(method==='GET'&&path.endsWith('/status'))list(answer('status'));
else if(method==='GET'&&endpoint.startsWith(repo+'/actions/runs?head_sha='))list(answer(nth('run-lists','runs')));
else if(method==='GET'&&path.includes('/actions/runs/'))console.log(JSON.stringify(answer(nth('run-polls','run'))));
else if(method==='POST'&&path.endsWith('/rerun-failed-jobs'))appendFileSync(join(S,'reruns'),path.split('/').at(-2)+'\n');
else{console.error('stub gh: unexpected '+method+' '+endpoint);process.exit(1);}
`;
async function landingFixture(mode: 'pr' | 'merge', scratch: string, realGit: string) {
  const dir = await mkdtemp(join(scratch, 'case.'));
  const repo = join(dir, 'main checkout');
  const origin = join(dir, 'origin.git');
  const state = join(dir, 'state');
  const bin = join(dir, 'bin');
  await mkdir(state);
  await mkdir(bin);
  const fixtureEnv: NodeJS.ProcessEnv = {
    ...env,
    S: state,
    ORIGIN: origin,
    REAL_GIT: realGit,
    PATH: `${bin}:${process.env.PATH}`,
  };
  await cp(join(scratch, `template-${mode}/main checkout`), repo, { recursive: true });
  await cp(join(scratch, `template-${mode}/origin.git`), origin, { recursive: true });
  const put = (name: string, source = '') => {
    if (
      [
        'log-git',
        'fetch-fail',
        'deaf',
        'delete-race',
        'delete-fail',
        'remote-read-fail',
        'remove-fail',
        'branch-fail',
      ].includes(name)
    )
      fixtureEnv.PATH = `${join(dir, 'intercept')}:${bin}:${process.env.PATH}`;
    return writeFile(join(state, name), source);
  };
  const read = (name: string) => readFile(join(state, name), 'utf8').catch(() => '');
  const has = async (path: string) => (await stat(path).catch(() => null)) !== null;
  const json = (name: string, value: unknown) => put(`${name}.json`, JSON.stringify(value));
  const git = async (args: string[], cwd = repo) => {
    const r = await command(realGit, args, { cwd, env: fixtureEnv });
    expect(r.code, `${args.join(' ')}: ${r.stderr}`).toBe(0);
    return r.stdout.trimEnd();
  };
  const stub = async (path: string, source: string) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      `#!/usr/bin/env -S "${process.execPath.replaceAll(' ', '\\_')}" ${isolatedArgs.join(' ')}\n${source}\n`,
      { mode: 0o755 },
    );
  };
  await stub(join(bin, 'gh'), ghStub);
  await stub(
    join(dir, 'intercept/git'),
    String.raw`import {appendFileSync,existsSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const a=process.argv.slice(2),S=process.env.S!;appendFileSync(join(S,'git-calls'),JSON.stringify(a)+'\n');
const isDelete=a[0]==='push'&&a.includes('--delete')&&a.includes('fix/7-crash');
if(a[0]==='worktree'&&a[1]==='remove'&&existsSync(join(S,'hold-cleanup'))&&a.at(-1)===readFileSync(join(S,'hold-cleanup'),'utf8')){writeFileSync(join(S,'cleanup-held'),String(process.pid));while(!existsSync(join(S,'cleanup-release')))await Bun.sleep(5);}
if(existsSync(join(S,'warnings'))&&['fetch','push','merge-tree','merge'].includes(a[0]!))console.error('fixture: git warning '+a.join(' '));
const fail=(n:string,m:string)=>{if(existsSync(join(S,n))){console.error(m);process.exit(128);}};
if(a[0]==='fetch')fail('fetch-fail','fatal: cannot fetch fixture origin');
if((a[0]==='push'||a[0]==='ls-remote')&&a.includes('origin')&&a.some(s=>s.includes('fix/7-crash')))fail('deaf','fatal: origin does not answer');
if(isDelete&&existsSync(join(S,'delete-race'))){spawnSync(process.env.REAL_GIT!,['--git-dir='+process.env.ORIGIN!,'update-ref','-d','refs/heads/fix/7-crash']);console.error('error: remote ref does not exist');process.exit(1);}
if(isDelete)fail('delete-fail','remote: hook declined');
if(a[0]==='ls-remote'&&a.some(s=>s.includes('fix/7-crash')))fail('remote-read-fail','fatal: fixture read failed');
if(a[0]==='worktree'&&a[1]==='remove')fail('remove-fail','fatal: fixture worktree removal failed');
if(a[0]==='branch'&&a[1]==='-D'&&a[2]==='fix/7-crash')fail('branch-fail','fatal: fixture branch deletion failed');
const r=spawnSync(process.env.REAL_GIT!,a,{stdio:'inherit'});process.exit(r.status??1);`,
  );
  await put('hold-stage');
  await git(['remote', 'set-url', 'origin', origin]);
  for (const [name, value] of Object.entries({
    repo: { default_branch: 'master' },
    issue: { state: 'open' },
    prs: [],
    merged: [],
    subs: [],
    checks: { check_runs: [] },
    status: { statuses: [] },
    runs: { workflow_runs: [{ check_suite_id: 50, id: 5, run_attempt: 1, status: 'completed' }] },
    run: { run_attempt: 2, status: 'completed' },
  }))
    await json(name, value);
  const entry = join(scratch, 'plug in/scripts/land.ts');
  const wrapper = join(dir, 'land.ts');
  await writeFile(
    wrapper,
    `import {appendFileSync} from 'node:fs';import {join} from 'node:path';import {main} from ${JSON.stringify(entry)};const timer=globalThis.setTimeout;globalThis.setTimeout=((fn,ms,...args)=>{if(ms===15_000){appendFileSync(join(process.env.S!,'sleeps'),String(ms)+'\\n');ms=0;}return timer(fn,ms,...args);}) as typeof timer;process.exitCode=await main(process.argv.slice(2));`,
  );
  let branch = '',
    wt = '',
    tip = '',
    before = '';
  const children = new Set<ReturnType<typeof spawn>>();
  const originMaster = () => git([`--git-dir=${origin}`, 'rev-parse', 'master']);
  const ref = async (name: string, remote = false) =>
    (
      await command(
        realGit,
        [...(remote ? [`--git-dir=${origin}`] : []), 'show-ref', '--verify', '--quiet', `refs/heads/${name}`],
        { cwd: repo, env: fixtureEnv },
      )
    ).code === 0;
  const logs = async (name = 'gh-calls'): Promise<string[][]> =>
    (await read(name))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  const calls = async (pattern: string) => (await logs()).filter((args) => new RegExp(pattern).test(args.join(' ')));
  const result = { code: -1, stdout: '', stderr: '' };
  const output = () => result.stdout + result.stderr;
  const noLock = async () =>
    expect((await readdir(join(repo, '.git/celetis-flow')).catch(() => [])).filter((n) => n.endsWith('.lock'))).toEqual(
      [],
    );
  const noSetup = async () => expect(await has(join(state, 'setup-ran'))).toBe(false);
  const start = (args = ['7', subject], cwd = repo) => {
    const child = spawn(process.execPath, [...isolatedArgs, wrapper, ...args], {
      cwd,
      env: fixtureEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    const done = new Promise<typeof result>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => {
        children.delete(child);
        resolve({ code: code ?? (signal ? 128 + constants.signals[signal] : 1), stdout, stderr });
      });
    });
    return { child, done };
  };
  const land = async (args = ['7', subject], cwd = repo) => {
    before = `${await originMaster()} ${await git(['rev-parse', 'master'])}`;
    Object.assign(result, await start(args, cwd).done);
    expect(output()).not.toMatch(/^\s+at .+:\d+:\d+/m);
    return result;
  };
  const kept = async () => {
    expect(`${await originMaster()} ${await git(['rev-parse', 'master'])}`).toBe(before);
    if (wt) {
      expect(await has(wt)).toBe(true);
      expect(await ref(branch)).toBe(true);
    }
    await noLock();
    await noSetup();
  };
  const refused = async (message: string, mergeAttempts = 0) => {
    expect(result.code, output()).toBe(1);
    expect(output()).toContain(`land: ${message}`);
    expect(
      output()
        .split('\n')
        .filter((line) => line.startsWith('land: ')),
    ).toHaveLength(1);
    await kept();
    expect(await calls('/pulls/[0-9]+/merge')).toHaveLength(mergeAttempts);
    expect(await has(join(state, 'closed'))).toBe(false);
  };
  const landed = async () => {
    expect(result.code, output()).toBe(0);
    expect(await has(wt)).toBe(false);
    expect(await ref(branch)).toBe(false);
    expect(await ref(branch, true)).toBe(false);
    expect(output()).toContain(`land: ${branch} and its worktree are gone`);
    expect(output()).not.toContain('error:');
    await noLock();
    await noSetup();
  };
  const stopped = async () => {
    expect(result.code, output()).toBe(1);
    expect(await has(wt)).toBe(true);
    expect(await ref(branch)).toBe(true);
    expect(output()).toContain('land: #7 is on master');
    expect(output()).toContain(
      `land: the change is on master, but the removal of ${branch} stopped; run scripts/celetis land again`,
    );
    expect(output().split('run scripts/celetis land again')).toHaveLength(2);
    await noLock();
    await noSetup();
  };
  const checks = (states: string, name = 'checks') =>
    json(name, {
      check_runs: states
        .split(' ')
        .filter(Boolean)
        .map((state, i) => {
          const [word, app = 'github-actions'] = state.split('@');
          const conclusion = (
            {
              pass: 'success',
              fail: 'failure',
              timeout: 'timed_out',
              action: 'action_required',
              skipping: 'skipped',
              neutral: 'neutral',
              cancel: 'cancelled',
            } as Record<string, string>
          )[word ?? ''];
          return {
            id: 100 + i,
            name: `job ${i}`,
            app: { slug: app },
            check_suite: { id: 50 },
            details_url: `https://github.com/o/r/actions/runs/5/job/${100 + i}`,
            status: conclusion ? 'completed' : 'in_progress',
            conclusion: conclusion ?? null,
          };
        }),
    });
  const runsAt = (attempt = 1, name = 'runs', status = 'completed') =>
    json(name, { workflow_runs: [{ check_suite_id: 50, id: 5, run_attempt: attempt, status }] });
  const prs = (...pairs: (string | number)[]) =>
    json(
      'prs',
      Array.from({ length: pairs.length / 2 }, (_, i) => ({
        head: { ref: pairs[i * 2] },
        base: { ref: 'master' },
        number: pairs[i * 2 + 1],
        html_url: `https://github.com/o/r/pull/${pairs[i * 2 + 1]}`,
      })),
    );
  return {
    dir,
    repo,
    origin,
    state,
    env: fixtureEnv,
    put,
    read,
    has,
    json,
    git,
    logs,
    calls,
    result,
    output,
    noLock,
    noSetup,
    land,
    start,
    kept,
    refused,
    landed,
    stopped,
    originMaster,
    ref,
    checks,
    runsAt,
    prs,
    branch: () => branch,
    wt: () => wt,
    tip: () => tip,
    before: () => before,
    async lane(name = 'fix/7-crash', text = 'work', file = 'work.txt', conflict = false) {
      branch = name;
      wt = join(repo, '.claude/worktrees', name.slice(name.indexOf('/') + 1));
      await git(['worktree', 'add', '-q', '-b', name, wt, 'origin/master']);
      await writeFile(join(wt, file), `${text}\n`);
      if (conflict) await writeFile(join(wt, '.celetis.yaml'), `landing: ${mode === 'pr' ? 'merge' : 'pr'}\n`);
      await git(['add', '-A'], wt);
      await git(['commit', '-qm', 'work'], wt);
      tip = await git(['rev-parse', name]);
      await json('view', { head: { sha: tip } });
    },
    async upstream(file = 'up.txt', text = 'theirs') {
      const other = join(dir, 'other');
      await git(['clone', '-q', origin, other]);
      await writeFile(join(other, file), `${text}\n`);
      await git(['add', '-A'], other);
      await git(['commit', '-qm', 'upstream'], other);
      await git(['push', '-q', 'origin', 'master'], other);
    },
    async rejectPush() {
      const hook = join(origin, 'hooks/pre-receive');
      await stub(hook, 'process.exit(1);');
    },
    async merged(sha = tip, base = 'master', at: string | null = '2026-10-19T00:00:00Z') {
      await json('merged', [{ state: 'closed', merged_at: at, base: { ref: base }, head: { ref: branch, sha } }]);
    },
    async onBase(pr: number, base: string) {
      const rows = JSON.parse(await read('prs.json'));
      rows.find((r: { number: number }) => r.number === pr).base.ref = base;
      await json('prs', rows);
    },
    async ready(states = 'pass') {
      await this.lane();
      await prs('fix/7-crash', 9);
      await checks(states);
    },
    async mergeRequest(): Promise<{ pr: string; merge_method: string; sha: string }> {
      const value = JSON.parse(await read('merge-args'));
      const fields = Object.fromEntries(
        value.fields.map((field: string) => {
          const i = field.indexOf('=');
          return [field.slice(0, i), field.slice(i + 1)];
        }),
      );
      return { pr: value.pr, merge_method: String(fields.merge_method), sha: String(fields.sha) };
    },
    async sleeps() {
      return (await read('sleeps')).trim().split('\n').filter(Boolean).map(Number);
    },
    async wait(name: string) {
      const deadline = performance.now() + 5000;
      while (!(await has(join(state, name)))) {
        if (performance.now() > deadline) throw new Error(`timed out: ${name}`);
        await Bun.sleep(5);
      }
    },
    async cleanup() {
      for (const child of children) child.kill('SIGKILL');
      await rm(dir, { recursive: true, force: true });
    },
  };
}
export type LandingFixture = Awaited<ReturnType<typeof landingFixture>>;
export function createLandingTests() {
  let scratch = '',
    realGit = '';
  beforeAll(async () => {
    scratch = await realpath(await mkdtemp(join(tmpdir(), 'celetis-land.')));
    realGit = (await command('which', ['git'])).stdout.trim();
    await symlink(root, join(scratch, 'plug in'));
    for (const mode of ['merge', 'pr']) {
      const base = join(scratch, `template-${mode}`);
      const repo = join(base, 'main checkout');
      await mkdir(repo, { recursive: true });
      const git = async (args: string[]) => {
        const r = await command(realGit, args, { cwd: repo, env });
        expect(r.code, r.stderr).toBe(0);
      };
      await git(['init', '-q', '-b', 'master']);
      await writeFile(join(repo, 'app.txt'), 'app\n');
      await writeFile(join(repo, '.gitignore'), '.claude/worktrees/\n');
      await writeFile(
        join(repo, '.celetis.yaml'),
        `landing: ${mode}\nworktreeSetup: await Bun.write(process.env.S + '/setup-ran', 'ran');\n`,
      );
      await mkdir(join(repo, '.claude/celetis-flow'), { recursive: true });
      await writeFile(
        join(repo, '.claude/celetis-flow/landing.json'),
        JSON.stringify({ landing: mode === 'pr' ? 'merge' : 'pr' }),
      );
      await git(['add', '-A']);
      await git(['commit', '-qm', 'base']);
      await git(['clone', '-q', '--bare', '.', join(base, 'origin.git')]);
      await git(['remote', 'add', 'origin', join(base, 'origin.git')]);
      await git(['fetch', '-q', 'origin']);
    }
  });
  afterAll(async () => {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  });
  let active = 0;
  const waiting: (() => void)[] = [];
  function landCase(name: string, mode: 'pr' | 'merge', body: (f: LandingFixture) => Promise<void>) {
    test.concurrent(name, async () => {
      if (active >= 8) await new Promise<void>((done) => waiting.push(done));
      else active++;
      let f: LandingFixture | undefined;
      try {
        f = await landingFixture(mode, scratch, realGit);
        await body(f);
      } finally {
        await f?.cleanup();
        const next = waiting.shift();
        if (next) next();
        else active--;
      }
    });
  }
  return landCase;
}

export function registerLaneRefusals(landCase: ReturnType<typeof createLandingTests>, mode: 'merge' | 'pr') {
  landCase(`lane_refusals: ${mode} GitHub unavailable`, mode, async (f) => {
    await f.lane();
    await f.put('gh-fail');
    await f.land();
    await f.refused('cannot read the default branch from GitHub');
    expect(f.output()).toContain('HTTP 502');
    expect(f.output().split('HTTP 502')).toHaveLength(2);
  });
  for (const other of ['', 'fix/17-other', 'prototype/7-look'])
    landCase(`lane_refusals: ${mode} no matching lane ${other}`, mode, async (f) => {
      if (other) await f.lane(other);
      await f.land();
      await f.refused('no lane branch matches #7; nothing to land');
    });
  landCase(`lane_refusals: ${mode} two lanes`, mode, async (f) => {
    await f.lane();
    await f.git(['branch', '-q', 'feat/7-crash', 'master']);
    await f.land();
    await f.refused('several branches match #7: feat/7-crash fix/7-crash; keep one');
  });
  landCase(`lane_refusals: ${mode} inside lane`, mode, async (f) => {
    await f.lane();
    await f.land(undefined, f.wt());
    await f.refused(`leave ${f.wt()} first: run scripts/celetis land from the main checkout`);
  });
  landCase(`lane_refusals: ${mode} dirty lane`, mode, async (f) => {
    await f.lane();
    await writeFile(join(f.wt(), 'new.txt'), 'x');
    await f.land();
    await f.refused(`the lane worktree is dirty: ${f.wt()}; commit first`);
  });
  landCase(`lane_refusals: ${mode} no lane commit`, mode, async (f) => {
    await f.lane();
    await f.git(['reset', '-q', '--hard', 'origin/master'], f.wt());
    await f.land();
    await f.refused('fix/7-crash has no commit that master lacks; nothing to land');
  });
  landCase(`lane_refusals: ${mode} main on lane`, mode, async (f) => {
    await f.git(['checkout', '-q', '-b', 'fix/7-crash']);
    await f.git(['commit', '-q', '--allow-empty', '-m', 'work']);
    await f.land();
    await f.refused('switch the main checkout off fix/7-crash first');
  });
  landCase(`lane_refusals: ${mode} fetch error`, mode, async (f) => {
    await f.lane();
    await f.put('fetch-fail');
    await f.land();
    await f.refused('cannot fetch master from origin');
    expect(f.output()).toContain('fatal: cannot fetch fixture origin');
  });
}
