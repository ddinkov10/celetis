import { expect } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { join } from 'node:path';
import { command, fixture, isolatedArgs, root } from './fixture.ts';

export const uuid = '01a139fc-2ffa-74c0-9b14-e35e23339910';
export const stepText = `Keep "quotes", 'quotes', \\slashes, tabs:\tand Unicode: →.\n$(touch substitution) \u0060touch backticks\u0060\n\n`;
const commonSource = `import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { constants } from 'node:os';
const S=process.env.RUNNER_TEST!; const plugin=process.env.RUNNER_PLUGIN!;
const args=process.argv.slice(2);
const has=(name:string)=>existsSync(join(S,name));
const read=(name:string, value='')=>has(name)?readFileSync(join(S,name),'utf8'):value;
const put=(name:string,value='')=>writeFileSync(join(S,name),value);
const log=(name:string,value:unknown)=>appendFileSync(join(S,name),JSON.stringify(value)+'\\n');
const pause=async(name:string)=>{while(has(name)) await Bun.sleep(10);};
`;

export async function runnerFixture(realResolver = false) {
  const f = await fixture();
  const state = join(f.dir, 'state');
  const plugin = join(f.dir, 'installed package');
  await mkdir(state);
  await mkdir(join(f.dir, 'tmp'));
  await mkdir(plugin);
  await cp(join(root, 'scripts'), join(plugin, 'scripts'), { recursive: true });
  await cp(join(root, '.claude-plugin'), join(plugin, '.claude-plugin'), { recursive: true });
  await f.write('installed package/skills/guide/SKILL.md', 'fixture\n');
  await writeFile(join(plugin, 'step-prompt.md'), stepText);
  const env = Object.assign(f.env, {
    RUNNER_TEST: state,
    TMPDIR: join(f.dir, 'tmp'),
    RUNNER_PLUGIN: plugin,
    CLAUDE_CONFIG_DIR: join(f.dir, 'claude config'),
    CODEX_HOME: join(f.dir, 'codex config'),
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.test',
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0',
    DO_NOT_TRACK: '1',
    PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`,
  });
  for (const name of ['HERDR_ENV', 'HERDR_PANE_ID', 'HERDR_TAB_ID', 'CELETIS_AGENT', 'CELETIS_RESUME_RECORD'])
    delete env[name];
  const put = (name: string, value = '') => writeFile(join(state, name), value);
  const read = (name: string) => readFile(join(state, name), 'utf8').catch(() => '');
  const has = (name: string) => Bun.file(join(state, name)).exists();
  const logs = async <T = Record<string, unknown>>(name: string): Promise<T[]> =>
    (await read(name))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  await put('id', uuid);
  await put('status', 'idle');
  await put('step', 'plan');
  await put('developer');
  if (!realResolver)
    await writeFile(
      join(plugin, 'scripts/next-step.ts'),
      `${commonSource}
    if(args[0]==='--open') console.log('7\\t'+(has('progress')?'stop #7 is finished.':'run /celetis:'+read('step')+' #7'));
    else console.log(has('progress')?'stop #7 is finished.':'run /celetis:'+read('step')+' #7');`,
    );
  await f.stub(
    'gh',
    `${commonSource}
    for await (const _ of process.stdin) {}
    log('gh-calls',args); if(has('gh-fail')) {console.error('HTTP 502');process.exit(1);}
    const endpoint=args.find(a=>a.startsWith('repos/'))??''; const n=endpoint.match(/issues\\/(\\d+)/)?.[1];
    let value:any;
    if(n) {
      if(has('view-fail-'+n)){console.error('no issue '+n);process.exit(1);}
      const file=join(S,'issue-'+n+'.json'); if(!existsSync(file))process.exit(1);
      const issue=JSON.parse(readFileSync(file,'utf8'));
      value=endpoint.includes('/comments?')?[issue.comments]:{...issue,comments:issue.comments.length};
      if(has('status-during-resolver')) {const k=Number(read('resolver-checks','0'))+1;put('resolver-checks',String(k));if(k===2){put('status',read('status-during-resolver'));put('late-state-set');}}
    }else if(endpoint.includes('/issues?')){
      const {readdirSync}=await import('node:fs');
      const all=readdirSync(S).filter(n=>/^issue-\\d+\\.json$/.test(n)).map(n=>JSON.parse(readFileSync(join(S,n),'utf8')));
      value=[all.filter(i=>endpoint.includes('state='+i.state)).map(i=>({...i,comments:i.comments.length}))];
    }else if(endpoint.includes('/pulls?'))value=[[]]; else process.exit(1);
    console.log(JSON.stringify(value));`,
  );
  const hostSource = `${commonSource}
    const host=process.argv[1]!.split('/').at(-1)!;
    if(args[0]==='plugin'){
      log('updates',{host,args});log('order',{host,args});
      const phase=args[1]==='marketplace'?'marketplace':args[1];
      if(has('update-fail')||read('update-fail-phase')===phase){console.error('fixture: '+host+' '+phase+' update unavailable');process.exit(23);}
      if(read('update-hang')===phase){
        process.on('SIGTERM',()=>{});put('update-pid',String(process.pid));
        spawn(process.execPath,${JSON.stringify(isolatedArgs)}.concat(join(S,'update-descendant.ts')),{stdio:['ignore','inherit','inherit',3]});
        console.error('fixture update stalled with original cause'); await Bun.sleep(30_000);
      }
      if(phase==='marketplace'&&has('hold-update')){
        try{mkdirSync(join(S,'update-active'));}catch{put('update-overlap');}
        put('update-entered');await pause('hold-update');rmSync(join(S,'update-active'),{recursive:true,force:true});
      }
      if(phase==='list')process.stdout.write(has('plugin-list')?read('plugin-list'):JSON.stringify([{id:'celetis@celetis',scope:'user',enabled:true,installPath:plugin}])+'\\n');
      process.exit(0);
    }
    if(args[0]==='app-server'){
      let input=''; for await(const data of process.stdin){input+=data.toString();let at;
        while((at=input.indexOf('\\n'))!==-1){const line=input.slice(0,at);input=input.slice(at+1);if(!line)continue;const m=JSON.parse(line);if(m.method==='initialized')continue;
          let result:any={};
          if(m.method==='skills/list'){
            if(has('replace-record'))writeFileSync(join(process.cwd(),'.git/celetis-flow/sessions/7.json'),read('replace-record'));
            if(has('lookup-hang')){process.on('SIGTERM',()=>{});put('update-pid',String(process.pid));spawn(process.execPath,${JSON.stringify(isolatedArgs)}.concat(join(S,'update-descendant.ts')),{stdio:['ignore','inherit','inherit',3]});console.error('fixture: skills catalog lookup stalled with original cause');await Bun.sleep(30_000);}
            result={data:[{cwd:process.cwd(),skills:[{name:'celetis:guide',pluginId:'celetis@celetis',enabled:true,path:plugin+'/skills/guide/SKILL.md'}]}]};
          } else if(m.method==='config/read')result={config:{developer_instructions:has('config-invalid')?7:read('developer')}};
          else if(m.method==='thread/read')result={thread:{id:has('wrong-saved-id')?'00000000-0000-4000-8000-000000000002':read('id'),cwd:has('foreign-checkout')?'/other-checkout':process.cwd(),createdAt:Number(read('created','0')),ephemeral:has('ephemeral')}};
          else if(m.method==='thread/turns/list')result={data:has('saved')?[{id:'turn'}]:[]};
          else if(m.method!=='initialize')process.exit(82);
          console.log(JSON.stringify({id:m.id,result}));
        }
      }process.exit(0);
    }
    log('calls',{host,cwd:process.cwd(),args,pid:process.pid});log('order',{host,args,session:true});
    const stdin=Buffer.alloc(1);let typed='';const {readSync}=await import('node:fs');
    if(!has('skip-input')){while(true){let n=0;try{n=readSync(0,stdin);}catch{}if(!n||stdin[0]===10)break;typed+=stdin.toString();}}log('stdin',typed);
    if(args[0]==='resume'||args[0]==='--resume'){put('resumed');await pause('hold-resume');process.exit(0);}
    const k=Number(read('count','0'))+1;put('count',String(k));
    if(has('dynamic-id'))put('id','00000000-0000-4000-8000-'+String(k).padStart(12,'0'));
    if(has('initial-status'))put('status',read('initial-status'));
    if(has('change-host'))writeFileSync('.celetis.yaml','landing: merge\\nhost: '+read('change-host')+'\\n');
    const created=has('old-session')?0:Math.floor(Date.now()/1000);put('created',String(created));
    if(!has('no-save')){put('saved');const path=join(process.env.CLAUDE_CONFIG_DIR!,'projects/fixture');mkdirSync(path,{recursive:true});
      writeFileSync(join(path,read('id')+'.jsonl'),JSON.stringify({type:'user',sessionId:read('id'),cwd:has('foreign-checkout')?'/other-checkout':process.cwd(),timestamp:has('old-session')?'2000-01-01T00:00:00Z':new Date().toISOString()})+'\\n');}
    for(const name of ['settled','observed','exit-submitted','runner-waiting','prior-poll'])rmSync(join(S,name),{force:true});put('host',host);put('live');put('started-'+k);
    const refs=spawnSync('git',['for-each-ref','--format=%(refname)', 'refs/celetis-flow/locks'],{encoding:'utf8'});log('locks',refs.stdout.trim().split('\\n').filter(Boolean));
    if(has('hold-session')){while(!has('finish-'+k))await Bun.sleep(10);}
    else if(process.env.HERDR_ENV==='1'){while(!has('settled'))await Bun.sleep(10);}
    if(has('advance'))put('progress');
    if(has('after-'+k)){for(const [n,value] of Object.entries(JSON.parse(read('after-'+k))))put(n,typeof value==='string'?value:JSON.stringify(value));}
    if(has('wait-for-decision')&&process.env.HERDR_ENV==='1'){while(!has('exit-submitted')&&!has('runner-waiting'))await Bun.sleep(5);}
    if(has('invalid-config'))writeFileSync('.celetis.yaml',read('invalid-config'));
    rmSync(join(S,'live'),{force:true});process.exit(Number(read('exit','0')));
  `;
  await f.stub('claude', hostSource);
  await f.stub('codex', hostSource);
  await put(
    'update-descendant.ts',
    `import {writeFileSync} from 'node:fs';process.on('SIGTERM',()=>{});writeFileSync(${JSON.stringify(join(state, 'update-child'))},String(process.pid));await Bun.sleep(30_000);`,
  );
  await f.stub(
    'herdr',
    `${commonSource}
    log('herdr-calls',args);
    if(args[0]==='tab')process.exit(0);
    if(args[0]==='pane'){put('settled');console.log('Update, trust, or sign-in action is required.');process.exit(0);}
    if(args[1]==='get'){
      if(!has('live')&&!has('prior-id')){if(has('prior-poll')){const end=performance.now()+500;while(!has('live')&&performance.now()<end)await Bun.sleep(5);}else put('prior-poll');}
      let host=process.env.CELETIS_AGENT!,id=read('id'),status=read('status');
      if(has('prior-host')&&!has('prior-reported')){host=read('prior-host');id=read('prior-id');status='done';if(has('prior-seen'))put('prior-reported');else put('prior-seen');}
      else if(!has('live')){if(!has('prior-id'))process.exit(1);id=read('prior-id');status='done';}
      else {if(has('observed'))put('settled');put('observed');if(has('bad-json')){console.log('broken');process.exit(0);}}
      const row=JSON.parse(readFileSync(${JSON.stringify(join(root, 'tests/fixtures/herdr'))}+'/'+host+'.json','utf8'));
      Object.assign(row.result.agent,{agent:host,agent_status:status,cwd:process.cwd(),foreground_cwd:process.cwd(),pane_id:process.env.HERDR_PANE_ID,agent_session:id?{agent:host,kind:'id',value:id}:null});
      if(has('mutation')){const change=JSON.parse(read('mutation'));if(change.deleteStatus)delete row.result.agent.agent_status;else Object.assign(row.result.agent,change);}
      console.log(JSON.stringify(row));process.exit(0);
    }
    if(args[1]==='wait'){
      if(args.includes('working'))put('runner-waiting');if(!has('hold-session'))put('settled');if(args.includes('working')&&has('late-state-set'))put('decision-made');
      while(has('live')){
        if(args.includes(read('status'))){put('wait-returned');if(has('status-after-wait')){put('status',read('status-after-wait'));rmSync(join(S,'status-after-wait'));}process.exit(0);}
        if(args.includes('working')&&has('late-state-set'))put('decision-made');
        await Bun.sleep(10);
      }process.exit(1);
    }
    if(args[1]==='prompt'){log('prompts',args);put('exit-submitted');if(has('late-state-set'))put('decision-made');if(has('prompt-fail'))process.exit(1);process.exit(0);}
    process.exit(1);`,
  );
  await f.repository();
  await f.config(
    `landing: merge\ngates:\n  triage: auto\n  plan: auto\n  implement: auto\nworktreeSetup: |\n  import {writeFileSync} from 'node:fs';\n  writeFileSync(${JSON.stringify(join(state, 'setup-ran'))}, 'ran');\n`,
  );
  await f.write('repo dir/.gitignore', '.claude/worktrees/\n');
  const git = async (args: string[], cwd = f.repo) => {
    const result = await command('git', args, { cwd, env });
    expect(result.code, result.stderr).toBe(0);
    return result.stdout.trimEnd();
  };
  await git(['add', '.']);
  await git(['commit', '-qm', 'config']);
  const entry = join(plugin, 'scripts/celetis-flow.ts');
  const pollingEntry = await f.write(
    'runner-poll.ts',
    `import {main} from ${JSON.stringify(entry)}; const sleep = Bun.sleep; Bun.sleep = ms => sleep(ms === 1000 ? 50 : ms); process.exitCode = await main(process.argv.slice(2));`,
  );
  const children = new Set<ChildProcess>();
  const start = (
    args: string[] = ['7'],
    options: { host?: string; cwd?: string; env?: NodeJS.ProcessEnv; launcher?: boolean; entry?: string } = {},
  ) => {
    const child = spawn(
      process.execPath,
      [
        ...isolatedArgs,
        options.launcher
          ? join(plugin, 'scripts/launcher.ts')
          : (options.entry ?? (options.env?.HERDR_ENV === '1' ? pollingEntry : entry)),
        ...(options.launcher ? ['celetis-flow', ...args] : args),
      ],
      {
        cwd: options.cwd ?? f.repo,
        env: { ...env, CELETIS_AGENT: options.host ?? 'claude', ...options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    children.add(child);
    let stdout = '',
      stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (data: string) => {
      stdout += data;
    });
    child.stderr?.on('data', (data: string) => {
      stderr += data;
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end('terminal input\ntwo\nthree\nfour\n');
    const exited = new Promise<number>((done) => {
      child.once('error', () => done(1));
      child.once('exit', (code, signal) => done(code ?? (signal === 'SIGKILL' ? 137 : 1)));
    });
    const result = new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) =>
        resolve({
          code: code ?? (signal ? 128 + constants.signals[signal] : 1),
          stdout,
          stderr,
        }),
      );
    });
    return { child, result, exited, output: () => ({ stdout, stderr }) };
  };
  return {
    ...f,
    state,
    plugin,
    env,
    put,
    read,
    has,
    logs,
    git,
    entry,
    start,
    run: async (args?: string[], options?: Parameters<typeof start>[1]) => {
      const result = await start(args, options).result;
      expect(await has('setup-ran')).toBe(false);
      return result;
    },
    record: () =>
      readFile(join(f.repo, '.git/celetis-flow/sessions/7.json'), 'utf8').then((source) => JSON.parse(source)),
    async issue(n = 7, label = 'enhancement', body = 'Spec: fixture', comments: string[] = [], status = 'open') {
      await put(
        `issue-${n}.json`,
        JSON.stringify({
          number: n,
          title: `Issue ${n}`,
          html_url: `https://example.test/issues/${n}`,
          state: status,
          body,
          labels: label
            .split(',')
            .filter(Boolean)
            .map((name) => ({ name })),
          comments: comments.map((body) => ({ body })),
          updated_at: '2026-10-01T00:00:00Z',
          closed_at: status === 'closed' ? new Date().toISOString() : null,
        }),
      );
    },
    async wait(name: string) {
      const deadline = performance.now() + 10_000;
      while (!(await has(name))) {
        if (performance.now() >= deadline) throw new Error(`timed out: ${name}`);
        await Bun.sleep(10);
      }
    },
    async cleanup() {
      for (const child of children) child.kill('SIGKILL');
      for (const name of ['update-pid', 'update-child']) {
        const pid = Number(await read(name));
        if (pid) {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {}
          try {
            process.kill(pid, 'SIGKILL');
          } catch {}
        }
      }
      for (let k = 1; k <= 5; k++) await put(`finish-${k}`).catch(() => {});
      await Bun.sleep(20);
      await f.cleanup();
    },
  };
}

export type RunnerFixture = Awaited<ReturnType<typeof runnerFixture>>;
let active = 0;
const waiting: (() => void)[] = [];
export function runnerCase(body: (f: RunnerFixture) => Promise<void>, realResolver = false) {
  return async () => {
    if (active >= 8) await new Promise<void>((done) => waiting.push(done));
    else active++;
    let f: RunnerFixture | undefined;
    try {
      f = await runnerFixture(realResolver);
      await body(f);
    } finally {
      await f?.cleanup();
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

export async function updateTestClock(f: RunnerFixture) {
  const entry = join(f.plugin, 'scripts/plugin-update.ts');
  await cp(entry, join(f.plugin, 'scripts/plugin-update-fixture.ts'));
  await writeFile(
    entry,
    `import {existsSync,appendFileSync,writeFileSync} from 'node:fs';
    import {UpdateLock} from './lib/update-lock.ts';
    const acquire=UpdateLock.acquire;appendFileSync(${JSON.stringify(join(f.state, 'update-helpers'))},String(process.pid)+'\\n');writeFileSync(${JSON.stringify(join(f.state, 'update-lock-waiting'))},'');
    UpdateLock.acquire=(path,runner)=>acquire(path,runner,{clock:{now:()=>performance.now()+(existsSync(${JSON.stringify(join(f.state, 'clock-jump'))})?120_000:0),sleep:ms=>Bun.sleep(ms)}});
    const {updatePlugin}=await import('./plugin-update-fixture.ts');
    try{console.log(await updatePlugin(Number(process.argv[2]),process.argv[3] as 'claude'|'codex'));}
    catch(error){console.error((error as Error).message);process.exitCode=1;}`,
  );
}
