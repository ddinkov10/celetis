import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { chmod, cp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { command, type Fixture, fixture, isolatedArgs, root, withFixture } from './lib/fixture.ts';

const build = join(root, 'scripts/build.ts');
const hostModule = join(root, 'scripts/lib/host.ts');
const launcher = join(root, 'scripts/launcher.ts');
setDefaultTimeout(25_000);
const install =
  'celetis: the plugin is not installed; run: claude plugin marketplace add ddinkov10/celetis && claude plugin install celetis@celetis\n';
const missingCodex =
  'celetis: Codex has no enabled celetis@celetis installation; install and enable the plugin in Codex\n';
let shared: Fixture;
let bundled: string;

beforeAll(async () => {
  shared = await fixture();
  const result = await shared.bun(build, ['--outdir', shared.dir]);
  expect(result).toEqual({ code: 0, stdout: '', stderr: '' });
  bundled = join(shared.dir, 'scripts/celetis');
  await hostStubs(shared);
});
afterAll(async () => shared?.cleanup());

async function hostStubs(f: Fixture) {
  await f.stub(
    'claude',
    String.raw`import {appendFileSync} from 'node:fs';
appendFileSync(process.env.CALLS!, JSON.stringify(process.argv.slice(2))+'\n');
if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['plugin','list','--json'])) process.exit(81);
process.stdout.write(await Bun.file(process.env.LIST!).text());
if(process.env.LOOKUP_FAIL){console.error('fixture: lookup failed');process.exit(Number(process.env.LOOKUP_FAIL));}`,
  );
  await f.stub(
    'codex',
    String.raw`import {appendFileSync,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
appendFileSync(process.env.CALLS!,JSON.stringify(process.argv.slice(2))+'\n');
if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['app-server','--stdio'])) process.exit(81);
writeFileSync(process.env.PID_FILE!,String(process.pid));
if(process.env.CODEX_MODE==='cleanup signal')setInterval(()=>{},1000);
process.on('SIGTERM',()=>{
 if(process.env.CODEX_MODE==='cleanup signal')writeFileSync(process.env.CLEANUP_READY!,String(process.pid));
 else process.exit(0);
});
for await(const line of createInterface({input:process.stdin})){
 appendFileSync(process.env.CALLS!,line+'\n');
 const {id,method}=JSON.parse(line);
 if(method==='initialize'){
  switch(process.env.CODEX_MODE){
   case 'exit':console.error('fixture: server stopped');process.exit(4);
   case 'timeout':continue;
   case 'hang':setInterval(()=>{},1000);continue;
   case 'flood':setInterval(()=>{for(let n=0;n<100;n++)console.log('{"method":"skills/changed"}');},1);continue;
   case 'malformed':console.log('not JSON');continue;
   case 'array':console.log('[]');continue;
   case 'invalid notification':console.log('{}');continue;
   case 'invalid result':console.log(JSON.stringify({id,result:[]}));continue;
   case 'error':console.log(JSON.stringify({id,error:{message:'fixture error'}}));continue;
   case 'fragment':process.stdout.write('{"id":1,"result":');await Bun.sleep(1200);console.log('{} }');continue;
  }
  console.log('{"method":"skills/changed"}');console.log('{"id":99,"result":{}}');console.log(JSON.stringify({id,result:{userAgent:'fixture'}}));
 }else if(method==='skills/list'){
  if(process.env.CODEX_MODE==='request timeout')continue;
  console.log('{"method":"skills/changed"}');console.log('{"id":"2","result":{}}');console.log(JSON.stringify({id,result:JSON.parse(await Bun.file(process.env.SKILLS!).text())}));
 }
}`,
  );
}

async function product(f: Fixture) {
  await f.repository();
  await f.config('landing: merge\n');
  const plugin = join(f.dir, 'plug in');
  await f.write('plug in/.claude-plugin/plugin.json', '{"name":"celetis"}');
  await f.write('plug in/skills/guide/SKILL.md', 'fixture skill');
  await f.write('plug in/scripts/echo.ts', 'process.stdout.write(process.argv.slice(2).map(x => "["+x+"]").join(""));');
  await f.write('plug in/scripts/host.ts', 'process.stdout.write(process.env.CELETIS_AGENT ?? "");');
  await f.write('plug in/scripts/fail.ts', 'process.exit(7);');
  await f.write('plug in/scripts/root.ts', await readFile(join(root, 'scripts/root.ts')));
  await f.write(
    'plug in/scripts/next-step.ts',
    'console.log(JSON.stringify({argv:process.argv.slice(2),executable:process.execPath,entry:import.meta.path,agent:process.env.CELETIS_AGENT,record:process.env.CELETIS_RESUME_RECORD,cache:process.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH,track:process.env.DO_NOT_TRACK}));',
  );
  const executable = await f.write('repo dir/scripts/celetis', await readFile(bundled), 0o755);
  const list = join(f.dir, 'list.json');
  const skills = join(f.dir, 'skills.json');
  const calls = join(f.dir, 'calls');
  const pid = join(f.dir, 'pid');
  await mkdir(join(f.dir, 'bin'));
  for (const name of ['claude', 'codex']) await symlink(join(shared.dir, 'bin', name), join(f.dir, 'bin', name));
  await symlink(process.execPath, join(f.dir, 'bin/bun'));
  const git = Bun.which('git');
  if (!git) throw new Error('fixture needs Git');
  await symlink(git, join(f.dir, 'bin/git'));
  const env: NodeJS.ProcessEnv = {
    ...f.env,
    PATH: join(f.dir, 'bin'),
    LIST: list,
    SKILLS: skills,
    CALLS: calls,
    PID_FILE: pid,
    CELETIS_AGENT: undefined,
    CELETIS_RESUME_RECORD: undefined,
    CODEX_MODE: undefined,
    LOOKUP_FAIL: undefined,
  };
  const record = (path = plugin, scope = 'user', enabled: unknown = true) => ({
    id: 'celetis@celetis',
    scope,
    enabled,
    installPath: path,
  });
  const skill = (
    path = `${plugin}/skills/guide/SKILL.md`,
    enabled = true,
    pluginId = 'celetis@celetis',
    name = 'celetis:guide',
  ) => ({ path, enabled, pluginId, name });
  const setList = (records: unknown) => writeFile(list, JSON.stringify(records));
  const setSkills = (records: unknown = [skill()], cwd = f.repo) =>
    writeFile(skills, JSON.stringify({ data: [{ cwd, skills: records, errors: [] }] }));
  await setList([record()]);
  await setSkills();
  const launch = (
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number; native?: boolean } = {},
  ) => {
    const { native, ...execution } = options;
    return command(native ? executable : process.execPath, native ? args : [...isolatedArgs, executable, ...args], {
      cwd: f.repo,
      ...execution,
      env: { ...env, ...options.env },
    });
  };
  return { plugin, executable, env, record, skill, setList, setSkills, launch, calls, pid };
}

const pending: (() => void)[] = [];
let active = 0;
function withProduct(body: (f: Fixture, p: Awaited<ReturnType<typeof product>>) => Promise<void>) {
  return async () => {
    if (active >= 4) await new Promise<void>((resolve) => pending.push(resolve));
    else active++;
    try {
      await withFixture(async (f) => body(f, await product(f)))();
    } finally {
      const next = pending.shift();
      if (next) next();
      else active--;
    }
  };
}

test.concurrent(
  'copied launcher discovers only the enabled package and preserves every argument',
  withProduct(async (f, p) => {
    const marker = join(f.repo, 'marker');
    const args = ['a b', "a'b", 'λ', '$(touch marker)', ''];
    const rootResult = await p.launch(['--agent', 'codex', 'root'], { native: true });
    expect(rootResult).toEqual({ code: 0, stdout: `${p.plugin}\n`, stderr: '' });
    const result = await p.launch(['--agent', 'codex', 'next-step', ...args], { native: true });
    expect(result.code).toBe(0);
    const dispatched = JSON.parse(result.stdout);
    expect(dispatched.argv).toEqual(args);
    expect(dispatched.executable).toBe(process.execPath);
    expect(dispatched.entry.endsWith('/scripts/next-step.ts')).toBe(true);
    expect(dispatched.cache).toBe('0');
    expect(dispatched.track).toBe('1');
    expect(await Bun.file(marker).exists()).toBe(false);
    expect(await readdir(join(f.repo, 'scripts'))).toEqual(['celetis']);
    expect(await Bun.file(join(f.repo, 'node_modules')).exists()).toBe(false);
  }),
);

test.concurrent(
  'a selected Bun path with spaces runs the launcher and executable fixtures',
  withProduct(async (f, p) => {
    const selectedBun = join(f.dir, 'selected Bun/bin/bun');
    await mkdir(dirname(selectedBun), { recursive: true });
    await cp(process.execPath, selectedBun);
    const env = { ...p.env, PATH: `${dirname(selectedBun)}${delimiter}${p.env.PATH}` };
    expect(
      await command(selectedBun, [...isolatedArgs, '-e', 'process.stdout.write(process.execPath)'], { env }),
    ).toEqual({ code: 0, stdout: selectedBun, stderr: '' });
    const result = await p.launch(['--agent', 'claude', 'next-step'], { env, native: true });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).executable).toBe(selectedBun);
    const probe = await f.write(
      'fixture-probe.ts',
      `import {fixture,command} from ${JSON.stringify(join(root, 'tests/lib/fixture.ts'))};const f=await fixture();try{const stub=await f.stub('probe','console.log(process.execPath)');console.log(JSON.stringify(await command(stub,[])));}finally{await f.cleanup();}`,
    );
    const stub = await command(selectedBun, [...isolatedArgs, probe], { env });
    expect(stub.code).toBe(0);
    expect(JSON.parse(stub.stdout)).toEqual({ code: 0, stdout: `${selectedBun}\n`, stderr: '' });
  }),
);

test.concurrent(
  'imports expose typed interfaces without discovery or output',
  withFixture(async (f) => {
    const probe = await f.write(
      'probe.ts',
      `const host=await import(${JSON.stringify(hostModule)});const launcher=await import(${JSON.stringify(launcher)});if(typeof host.mainCheckout!=='function'||typeof host.selectHost!=='function'||typeof host.installedRoot!=='function'||typeof host.codexRequest!=='function'||typeof launcher.main!=='function')process.exit(71);`,
    );
    expect(await f.bun(probe, [], { env: { PATH: '' } })).toEqual({ code: 0, stdout: '', stderr: '' });
  }),
);

test.concurrent(
  'main checkout discovery handles the main tree, subfolder, lane, and Git failure',
  withFixture(async (f) => {
    await f.repository();
    const { mainCheckout } = await import(hostModule);
    await mkdir(join(f.repo, 'sub'));
    const lane = join(f.dir, 'lane dir');
    expect((await command('git', ['worktree', 'add', '-qb', 'lane', lane], { cwd: f.repo, env: f.env })).code).toBe(0);
    expect(await mainCheckout(f.repo)).toBe(f.repo);
    expect(await mainCheckout(join(f.repo, 'sub'))).toBe(f.repo);
    expect(await mainCheckout(lane)).toBe(f.repo);
    const probe = await f.write(
      'probe.ts',
      `import {mainCheckout} from ${JSON.stringify(hostModule)};try{console.log(await mainCheckout(process.cwd()));}catch{process.exit(1);}`,
    );
    expect(await f.bun(probe)).toEqual({ code: 1, stdout: '', stderr: '' });
  }),
);

for (const path of ['C:/Users/me/repo', 'c:\\Users\\me\\repo']) {
  test.concurrent(
    `main checkout preserves Windows drive path ${path}`,
    withFixture(async (f) => {
      await f.stub('git', `console.log(${JSON.stringify(`${path}/.git`)});`);
      const probe = await f.write(
        'probe.ts',
        `import {mainCheckout} from ${JSON.stringify(hostModule)};console.log(await mainCheckout(process.cwd()));`,
      );
      const result = await f.bun(probe, [], { env: { PATH: join(f.dir, 'bin') } });
      expect(result).toEqual({ code: 0, stdout: `${path}\n`, stderr: '' });
    }),
  );
}

test.concurrent(
  'Claude discovery preserves scope priority, disabled state, lookup errors, and exit status',
  withProduct(async (f, p) => {
    await f.write('project/scripts/echo.ts', 'process.stdout.write("project");');
    const project = join(f.dir, 'project');
    await p.setList([p.record(project, 'project'), p.record()]);
    expect(await p.launch(['echo', 'a', 'b c', '#7'])).toEqual({ code: 0, stdout: '[a][b c][#7]', stderr: '' });
    await p.setList([p.record(project, 'project')]);
    expect(await p.launch(['echo'])).toEqual({ code: 0, stdout: 'project', stderr: '' });
    for (const records of [
      [{ id: 'other@market' }],
      [p.record(p.plugin, 'user', false)],
      [{ ...p.record(), enabled: undefined }],
      [p.record(project, 'project'), p.record(p.plugin, 'user', false)],
    ]) {
      await p.setList(records);
      expect(await p.launch(['echo'])).toEqual({ code: 1, stdout: '', stderr: install });
    }
    await writeFile(join(f.dir, 'list.json'), 'oops');
    expect(await p.launch(['echo'])).toEqual({
      code: 1,
      stdout: '',
      stderr: 'celetis: invalid plugin list JSON\noops\n',
    });
    await p.setList([p.record()]);
    const failed = await p.launch(['echo'], { env: { LOOKUP_FAIL: '23' } });
    expect(failed.code).toBe(23);
    expect(failed.stdout).toBe('');
    expect(failed.stderr).toBe(
      `fixture: lookup failed\nceletis: claude plugin list --json failed (exit 23)\n${await f.read('list.json')}\n`,
    );
    await rm(join(f.dir, 'bin/claude'));
    expect(await p.launch(['--agent', 'claude', 'echo'])).toEqual({ code: 1, stdout: '', stderr: install });
  }),
);

test.concurrent(
  'host precedence ignores obsolete settings and uses the main checkout from every folder',
  withProduct(async (f, p) => {
    const lane = join(f.dir, 'lane');
    expect((await command('git', ['worktree', 'add', '-qb', 'lane', lane], { cwd: f.repo, env: f.env })).code).toBe(0);
    await writeFile(join(lane, '.celetis.yaml'), 'landing: pr\nhost: claude\n');
    await mkdir(join(f.repo, 'sub'));
    await mkdir(join(lane, 'sub'));
    const env = {
      CELETIS_HOST: 'claude',
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'celetis-flow.agent',
      GIT_CONFIG_VALUE_0: 'other',
      GIT_CONFIG_KEY_1: 'celetis-flow.host',
      GIT_CONFIG_VALUE_1: 'claude',
    };
    for (const cwd of [f.repo, join(f.repo, 'sub'), lane, join(lane, 'sub')]) {
      await f.config('landing: merge\nhost: codex\n');
      await p.setSkills(undefined, cwd);
      expect(await p.launch(['host'], { cwd, env })).toEqual({ code: 0, stdout: 'codex', stderr: '' });
      expect(await p.launch(['host'], { cwd, env: { ...env, CELETIS_AGENT: 'claude' } })).toEqual({
        code: 0,
        stdout: 'claude',
        stderr: '',
      });
      expect(await p.launch(['--agent', 'claude', 'host'], { cwd, env: { ...env, CELETIS_AGENT: 'codex' } })).toEqual({
        code: 0,
        stdout: 'claude',
        stderr: '',
      });
      await f.config('landing: merge\n');
      expect(await p.launch(['host'], { cwd, env })).toEqual({ code: 0, stdout: 'claude', stderr: '' });
    }
  }),
);

test.concurrent(
  'host hint permits strict-only errors but rejects malformed YAML and unsafe config files',
  withProduct(async (f, p) => {
    await f.config('landing: merge\nhost: [\n');
    let result = await p.launch(['host']);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`${f.repo}/.celetis.yaml: <document>: invalid YAML:`);
    expect(await p.launch(['--agent', 'codex', 'host'])).toEqual({ code: 0, stdout: 'codex', stderr: '' });
    expect(await p.launch(['host'], { env: { CELETIS_AGENT: 'codex' } })).toEqual({
      code: 0,
      stdout: 'codex',
      stderr: '',
    });
    for (const [source, value] of [
      ['landing: merge\nhost: [a, b]\n', 'a sequence'],
      ['landing: merge\nhost: {name: codex}\n', 'a mapping'],
    ] as const) {
      await f.config(source);
      expect(await p.launch(['host'])).toEqual({
        code: 2,
        stdout: '',
        stderr: `celetis: invalid agent ${value}; use claude or codex\n`,
      });
    }
    let aliases = 'landing: merge\na0: &a0 [x, x]\n';
    for (let n = 1; n <= 16; n++) aliases += `a${n}: &a${n} [*a${n - 1}, *a${n - 1}]\n`;
    await f.config(`${aliases}host: *a16\n`);
    expect(await p.launch(['host'])).toEqual({
      code: 2,
      stdout: '',
      stderr: 'celetis: invalid agent a sequence; use claude or codex\n',
    });
    await f.config('landing: merge\nhost: codex\nextra: x\n');
    expect(await p.launch(['root'])).toEqual({ code: 0, stdout: `${p.plugin}\n`, stderr: '' });
    const target = await f.write('target.yaml', 'landing: merge\nhost: codex\n');
    await rm(join(f.repo, '.celetis.yaml'));
    await symlink(target, join(f.repo, '.celetis.yaml'));
    result = await p.launch(['host']);
    expect(result).toEqual({
      code: 2,
      stdout: '',
      stderr: `celetis: ${f.repo}/.celetis.yaml: <document>: need a regular, readable file, with no symlink\n`,
    });
  }),
);

test.concurrent(
  'unsafe basenames and invalid agents stop before discovery',
  withProduct(async (_f, p) => {
    for (const name of ['../echo', '/echo', 'a/b', 'a\\b', 'echo.ts', '--host', 'a;touch marker', '']) {
      expect((await p.launch([name])).code).toBe(2);
    }
    expect(await Bun.file(p.calls).exists()).toBe(false);
    for (const value of ['other', '']) {
      expect(await p.launch(['--agent', value, 'host'])).toEqual({
        code: 2,
        stdout: '',
        stderr: `celetis: invalid agent ${value}; use claude or codex\n`,
      });
      expect(await p.launch(['host'], { env: { CELETIS_AGENT: value } })).toEqual({
        code: 2,
        stdout: '',
        stderr: `celetis: invalid agent ${value}; use claude or codex\n`,
      });
    }
    expect(await p.launch(['--agent', 'codex', 'host'], { env: { CELETIS_AGENT: 'other' } })).toEqual({
      code: 0,
      stdout: 'codex',
      stderr: '',
    });
    for (const args of [[], ['--agent'], ['--agent', 'codex']]) {
      const result = await p.launch(args);
      expect(result.code).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('usage: scripts/celetis');
    }
    expect(await p.launch(['nope'])).toEqual({
      code: 2,
      stdout: '',
      stderr: 'celetis: the plugin has no script nope\n',
    });
    expect(await p.launch(['fail'])).toEqual({ code: 7, stdout: '', stderr: '' });
  }),
);

test.concurrent(
  'Codex discovery refreshes enabled state and cleans up its own process',
  withProduct(async (f, p) => {
    await rm(join(f.dir, 'bin/claude'));
    expect(await p.launch(['--agent', 'codex', 'echo', 'a', 'b c', '', '#7', '--agent', 'claude'])).toEqual({
      code: 0,
      stdout: '[a][b c][][#7][--agent][claude]',
      stderr: '',
    });
    const calls = (await readFile(p.calls, 'utf8'))
      .trim()
      .split('\n')
      .map((x) => JSON.parse(x));
    expect(calls[0]).toEqual(['app-server', '--stdio']);
    expect(calls.slice(1)).toEqual([
      {
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'celetis', version: '0.0.0' }, capabilities: { experimentalApi: true } },
      },
      { method: 'initialized' },
      { id: 2, method: 'skills/list', params: { cwds: [f.repo], forceReload: true } },
    ]);
    const pid = Number(await readFile(p.pid, 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
    expect(await p.launch(['--agent', 'codex', 'fail'])).toEqual({ code: 7, stdout: '', stderr: '' });
    await rm(join(f.dir, 'bin/codex'));
    expect(await p.launch(['--agent', 'codex', 'echo'])).toEqual({
      code: 1,
      stdout: '',
      stderr: 'celetis: codex is not on PATH\n',
    });
  }),
);

test.concurrent(
  'Codex installation identity rejects disabled, missing, ambiguous, and malicious records',
  withProduct(async (f, p) => {
    for (const records of [
      [p.skill(undefined, false)],
      [],
      [p.skill(undefined, true, 'celetis@other'), p.skill(undefined, true, undefined, 'celetis-other:guide')],
    ]) {
      await p.setSkills(records);
      expect(await p.launch(['--agent', 'codex', 'echo'])).toEqual({ code: 1, stdout: '', stderr: missingCodex });
    }
    await p.setSkills([p.skill(), p.skill(`${f.repo}/skills/guide/SKILL.md`)]);
    expect(await p.launch(['--agent', 'codex', 'echo'])).toEqual({
      code: 1,
      stdout: '',
      stderr: 'celetis: Codex reports multiple celetis package roots; fix the enabled installation\n',
    });
    await p.setSkills([p.skill(), p.skill()]);
    expect(await p.launch(['--agent', 'codex', 'echo', 'ok'])).toEqual({ code: 0, stdout: '[ok]', stderr: '' });
    for (const path of [
      `${f.dir}/missing/skills/guide/SKILL.md`,
      `${p.plugin}/guide/SKILL.md`,
      `${p.plugin}/skills/../SKILL.md`,
      'relative/skills/guide/SKILL.md',
      `${p.plugin}/./skills/guide/SKILL.md`,
      `${p.plugin}//skills/guide/SKILL.md`,
      `${p.plugin}/skills/guide/SKILL.md\n`,
      `${p.plugin}/skills/bug/SKILL.md`,
    ]) {
      await p.setSkills([p.skill(path)]);
      const result = await p.launch(['--agent', 'codex', 'echo']);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    }
    await p.setSkills();
    await rm(join(p.plugin, 'skills/guide/SKILL.md'));
    expect(await p.launch(['--agent', 'codex', 'echo'])).toEqual({
      code: 1,
      stdout: '',
      stderr: 'celetis: Codex reports a missing installed skill; reinstall the plugin\n',
    });
    await f.write('plug in/skills/guide/SKILL.md', 'fixture skill');
    await writeFile(join(p.plugin, '.claude-plugin/plugin.json'), '{"name":"other"}');
    expect(await p.launch(['--agent', 'codex', 'echo'])).toEqual({
      code: 1,
      stdout: '',
      stderr: 'celetis: Codex reports an invalid celetis package; reinstall the plugin\n',
    });
  }),
);

test.concurrent(
  'Codex skills result validates the requested cwd and list shape',
  withProduct(async (f, p) => {
    for (const result of [
      { data: 'bad' },
      { data: [] },
      { data: [{ cwd: f.repo, skills: null }] },
      {
        data: [
          { cwd: f.repo, skills: [] },
          { cwd: f.repo, skills: [] },
        ],
      },
    ]) {
      await writeFile(join(f.dir, 'skills.json'), JSON.stringify(result));
      expect(await p.launch(['--agent', 'codex', 'echo'])).toEqual({
        code: 1,
        stdout: '',
        stderr: 'celetis: invalid Codex skills/list response\n',
      });
    }
    await p.setSkills(undefined, join(f.repo, 'wrong'));
    expect((await p.launch(['--agent', 'codex', 'echo'])).code).toBe(1);
  }),
);

for (const mode of [
  'malformed',
  'array',
  'invalid notification',
  'invalid result',
  'error',
  'exit',
  'timeout',
  'flood',
  'request timeout',
]) {
  test.concurrent(
    `Codex ${mode} stops by the request deadline and removes only its own process`,
    withProduct(async (_f, p) => {
      const unrelated = spawn(process.execPath, [...isolatedArgs, '-e', 'setInterval(()=>{},1000)'], {
        stdio: 'ignore',
      });
      try {
        const started = performance.now();
        const result = await p.launch(['--agent', 'codex', 'echo'], { env: { CODEX_MODE: mode }, timeout: 12_000 });
        expect(result.code).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr.length).toBeGreaterThan(0);
        if (mode === 'timeout' || mode === 'flood' || mode === 'request timeout') {
          expect(performance.now() - started).toBeGreaterThanOrEqual(9_500);
          expect(result.stderr).toContain('timed out after 10 seconds');
        }
        expect(performance.now() - started).toBeLessThan(12_000);
        if (mode === 'exit') expect(result.stderr).toContain('fixture: server stopped');
        const pid = Number(await readFile(p.pid, 'utf8'));
        expect(() => process.kill(pid, 0)).toThrow();
        const unrelatedPid = unrelated.pid;
        if (unrelatedPid === undefined) throw new Error('fixture child did not start');
        expect(() => process.kill(unrelatedPid, 0)).not.toThrow();
      } finally {
        unrelated.kill();
        await new Promise<void>((resolve) => unrelated.once('close', () => resolve()));
      }
    }),
    25_000,
  );
}

test.concurrent(
  'fragmented Codex responses remain intact',
  withProduct(async (_f, p) => {
    expect(await p.launch(['--agent', 'codex', 'echo', 'fragmented'], { env: { CODEX_MODE: 'fragment' } })).toEqual({
      code: 0,
      stdout: '[fragmented]',
      stderr: '',
    });
  }),
);

test.concurrent(
  'all project commands require the whole main config before dispatch',
  withProduct(async (f, p) => {
    for (const name of ['worktree', 'celetis-flow', 'next-step', 'land', 'board']) {
      await f.write(`plug in/scripts/${name}.ts`, 'console.log("dispatched");');
      for (const bad of [null, 'landing: merge\nhost: other\n', 'landing: merge\nextra: bad\n']) {
        if (bad === null) await rm(join(f.repo, '.celetis.yaml'), { force: true });
        else await f.config(bad);
        const result = await p.launch(['--agent', 'claude', name, '7']);
        expect(result.code).toBe(2);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain(`${f.repo}/.celetis.yaml:`);
      }
    }
    await f.config('landing: merge\n');
    expect(await p.launch(['--agent', 'claude', 'next-step', '7'])).toEqual({
      code: 0,
      stdout: 'dispatched\n',
      stderr: '',
    });
    await rm(join(p.plugin, 'scripts/lib'), { recursive: true, force: true });
    expect(await p.launch(['--agent', 'claude', 'next-step', '7'])).toEqual({
      code: 0,
      stdout: 'dispatched\n',
      stderr: '',
    });
  }),
);

test.concurrent(
  'copied root works outside Git with explicit and default host selection',
  withProduct(async (f, p) => {
    await p.setSkills(undefined, f.dir);
    expect(await p.launch(['--agent', 'codex', 'root'], { cwd: f.dir })).toEqual({
      code: 0,
      stdout: `${p.plugin}\n`,
      stderr: '',
    });
    expect(await p.launch(['root'], { cwd: f.dir })).toEqual({ code: 0, stdout: `${p.plugin}\n`, stderr: '' });
  }),
);

test.concurrent(
  'Resume uses the saved host and exact session record before project defaults',
  withProduct(async (f, p) => {
    const id = '12345678-1234-1234-1234-123456789abc';
    const record = { schema: 1, issue: 7, checkout: f.repo, host: 'codex', step: 'implement', session_id: id };
    const file = await f.write('repo dir/.git/celetis-flow/sessions/7.json', JSON.stringify(record));
    await f.write(
      'plug in/scripts/celetis-flow.ts',
      'console.log(JSON.stringify({host:process.env.CELETIS_AGENT,record:JSON.parse(process.env.CELETIS_RESUME_RECORD!)}));',
    );
    const result = await p.launch(['celetis-flow', '--resume', '7'], { env: { CELETIS_AGENT: 'claude' } });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ host: 'codex', record });
    const wrong = await p.launch(['--agent', 'claude', 'celetis-flow', '--resume', '7']);
    expect(wrong).toEqual({
      code: 1,
      stdout: '',
      stderr: 'celetis: #7 recorded host is codex; resume without --agent or use --agent codex\n',
    });
    for (const mutation of [
      { ...record, issue: 8 },
      { ...record, checkout: f.dir },
      { ...record, host: 'other' },
      { ...record, host: ['codex'] },
      { ...record, host: { toString: 'codex' } },
      { ...record, step: 'feature' },
      { ...record, step: ['implement'] },
      { ...record, session_id: 'bad' },
      { ...record, extra: 1 },
    ]) {
      await writeFile(file, JSON.stringify(mutation));
      const result = await p.launch(['celetis-flow', '--resume', '7']);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('invalid or obsolete session record');
    }
    await writeFile(file, JSON.stringify({ ...record, session_id: null }));
    const noTurn = await p.launch(['celetis-flow', '--resume', '7']);
    expect(noTurn.code).toBe(1);
    expect(noTurn.stderr).toContain('codex resume --no-daemon');
    await rm(file);
    expect((await p.launch(['celetis-flow', '--resume', '7'])).stderr).toContain('has no current session record');
    expect((await p.launch(['celetis-flow', '--resume', 'bad'])).code).toBe(2);
  }),
);

test.concurrent(
  'Resume reads the exact Git common directory',
  withProduct(async (f, p) => {
    const common = join(f.dir, 'shared/control');
    await mkdir(dirname(common), { recursive: true });
    expect((await command('git', ['init', '-q', '--separate-git-dir', common, f.repo], { env: f.env })).code).toBe(0);
    await f.write('shared/.celetis.yaml', 'landing: merge\n');
    const record = {
      schema: 1,
      issue: 7,
      checkout: dirname(common),
      host: 'codex',
      step: 'implement',
      session_id: '12345678-1234-1234-1234-123456789abc',
    };
    await f.write('shared/control/celetis-flow/sessions/7.json', JSON.stringify(record));
    await f.write('plug in/scripts/celetis-flow.ts', 'console.log(process.env.CELETIS_RESUME_RECORD);');
    const result = await p.launch(['celetis-flow', '--resume', '7']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(record);
  }),
);

for (const version of ['0.9.0', '1.2.10', '1.4.1', '1.4.2-canary.1']) {
  test.concurrent(
    `launcher and reader refuse below-floor Bun ${version}`,
    withProduct(async (f, p) => {
      for (const entry of [launcher, join(root, 'scripts/lib/config.ts')]) {
        const args = entry === launcher ? ['--agent', 'claude', 'host'] : [f.repo];
        const result = await command(
          process.execPath,
          [...isolatedArgs, '--define', `Bun.version:${JSON.stringify(version)}`, entry, ...args],
          { cwd: f.repo, env: p.env },
        );
        expect(result.code).toBe(2);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain(`need Bun >=1.4.2 on PATH, found ${version}`);
      }
      expect(await Bun.file(p.calls).exists()).toBe(false);
    }),
  );
}
for (const version of ['1.4.3', '1.5.0-canary.1', '2.0.0']) {
  test.concurrent(
    `host hint accepts Bun ${version}`,
    withProduct(async (f, p) => {
      const result = await command(
        process.execPath,
        [...isolatedArgs, '--define', `Bun.version:${JSON.stringify(version)}`, launcher, 'host'],
        { cwd: f.repo, env: p.env },
      );
      expect(result).toEqual({ code: 0, stdout: 'claude', stderr: '' });
    }),
  );
}

test.concurrent(
  'missing and broken Bun stop at interpreter startup before all side effects',
  withProduct(async (f, p) => {
    const marker = await f.write('payload.ts', 'await Bun.write(process.env.MARK!,"ran");');
    const mark = join(f.dir, 'mark');
    await f.write('repo dir/bunfig.toml', `preload = [${JSON.stringify(marker)}]\n`);
    for (const kind of ['missing', 'broken', 'nonexecutable']) {
      const bin = join(f.dir, kind);
      await mkdir(bin);
      if (kind !== 'missing') {
        const file = await f.write(`${kind}/bun`, '#!/usr/bin/false\n', kind === 'broken' ? 0o755 : 0o644);
        if (kind === 'nonexecutable') await chmod(file, 0o644);
      }
      const result = await p.launch(['--agent', 'claude', 'host'], { env: { PATH: bin, MARK: mark }, native: true });
      expect(result.code).toBe(kind === 'broken' ? 1 : kind === 'nonexecutable' ? 126 : 127);
      expect(result.stdout).toBe('');
      if (kind !== 'broken') expect(result.stderr).toContain('bun');
      expect(await Bun.file(p.calls).exists()).toBe(false);
      expect(await Bun.file(mark).exists()).toBe(false);
    }
  }),
);

test.concurrent(
  'complete startup shebang suppresses product config, env, macros, cache, and crash reports',
  withProduct(async (f, p) => {
    const sub = join(f.repo, 'sub');
    await mkdir(sub);
    const marker = join(f.dir, 'preloaded');
    const payload = await f.write('repo dir/sub/payload.ts', 'await Bun.write(process.env.MARK!,"ran");');
    await f.write('repo dir/sub/bunfig.toml', `preload = [${JSON.stringify(payload)}]\n`);
    await f.write('repo dir/sub/.env', 'CELETIS_AGENT=other\n');
    await f.config('landing: merge\nhost: codex\n');
    await p.setSkills(undefined, sub);
    const env = { MARK: marker, BUN_RUNTIME_TRANSPILER_CACHE_PATH: join(f.dir, 'cache'), DO_NOT_TRACK: '0' };
    expect(await p.launch(['host'], { cwd: sub, env, native: true })).toEqual({ code: 0, stdout: 'codex', stderr: '' });
    expect(await Bun.file(marker).exists()).toBe(false);
    const isolated = await p.launch(['--agent', 'codex', 'next-step'], { cwd: sub, env, native: true });
    expect(isolated.code).toBe(0);
    expect(JSON.parse(isolated.stdout).cache).toBe('0');
    expect(JSON.parse(isolated.stdout).track).toBe('1');
    expect(await Bun.file(join(f.dir, 'cache')).exists()).toBe(false);
    await f.config('host: codex\nlanding: [\n');
    expect((await p.launch(['--agent', 'codex', 'next-step'], { cwd: sub, env, native: true })).code).toBe(2);
    expect(await Bun.file(marker).exists()).toBe(false);
    expect((await command(process.execPath, ['-e', '1'], { cwd: sub, env: { ...p.env, MARK: marker } })).code).toBe(0);
    expect(await Bun.file(marker).exists()).toBe(true);
    const macro = await f.write(
      'macro.ts',
      'import {writeFileSync} from "node:fs"; export function mark(){writeFileSync(process.env.MARK!,"macro");return "codex";}',
    );
    await f.write('repo dir/sub/bunfig.toml', `[macros]\n"./macro.ts" = { mark = "mark" }\n`);
    await cp(macro, join(sub, 'macro.ts'));
    await rm(marker);
    const script = await f.write(
      'repo dir/sub/control.ts',
      `${(await readFile(p.executable, 'utf8')).split('\n')[0]}\nimport {mark} from ${JSON.stringify(macro)} with {type:"macro"};mark();`,
      0o755,
    );
    expect(
      (await command(script, ['--agent', 'codex', 'root'], { cwd: sub, env: { ...p.env, MARK: marker } })).code,
    ).not.toBe(0);
    expect(await Bun.file(marker).exists()).toBe(false);
    expect(
      (
        await command(
          process.execPath,
          ['--no-env-file', '--no-install', '--config=/dev/null', script, '--agent', 'codex', 'root'],
          { cwd: sub, env: { ...p.env, MARK: marker } },
        )
      ).code,
    ).toBe(0);
    expect(await Bun.file(marker).exists()).toBe(true);
  }),
);

test.skipIf(!Bun.which(process.platform === 'darwin' ? 'genv' : 'env')).concurrent(
  'the full startup argument line also executes with GNU env',
  withProduct(async (f, p) => {
    const gnu = Bun.which(process.platform === 'darwin' ? 'genv' : 'env');
    expect(gnu).not.toBeNull();
    const bytes = await readFile(p.executable, 'utf8');
    const file = await f.write('gnu-launcher', bytes.replace('#!/usr/bin/env -S', `#!${gnu} -S`), 0o755);
    expect(await command(file, ['--agent', 'claude', 'root'], { cwd: f.repo, env: p.env })).toEqual({
      code: 0,
      stdout: `${p.plugin}\n`,
      stderr: '',
    });
  }),
);

test.concurrent(
  'product node_modules executables cannot replace host discovery',
  withProduct(async (f, p) => {
    await f.write('repo dir/node_modules/.bin/claude', '#!/usr/bin/false\n', 0o755);
    expect(
      await p.launch(['--agent', 'claude', 'echo', 'ok'], {
        env: { PATH: `${join(f.repo, 'node_modules/.bin')}${delimiter}${p.env.PATH}` },
      }),
    ).toEqual({ code: 0, stdout: '[ok]', stderr: '' });
  }),
);

const hints: [string, string, 'claude' | 'codex'][] = [
  ['host_hint_6', 'host: codex\nlanding: pr\nboard:\n  port: 4404\n', 'codex'],
  ['host_hint_9', '# Repository defaults.\nhost: codex # Selected host.\nlanding: pr\nboard:\n  port: 4404\n', 'codex'],
  ['host_hint_11', 'landing: merge\n', 'claude'],
  ['host_hint_13', '%YAML 1.2\n---\nlanding: pr\nworktreeSetup: yes\ncustom:\n  bug: on\n', 'claude'],
  [
    'host_hint_15',
    'landing: pr\nworktreeSetup: |\n  A "quote" and \\path.\ncustom:\n  bug: |-\n    A "quote" and \\path.\n  plan: |+\n    Добър ден.\n\n    End.\n\n\n',
    'claude',
  ],
  ['host_hint_19', 'landing: pr\ncustom:\n  bug: |\n    Keep', 'claude'],
  ['host_hint_21', 'landing: pr\ncustom:\n  bug: |+\n    Keep', 'claude'],
  ['host_hint_23', 'landing: pr\ncustom:\n  bug: |\n    Keep\n      ', 'claude'],
  ['host_hint_25', 'landing: pr\ncustom:\n  bug: |\n    Keep\n    ', 'claude'],
  ['host_hint_27', 'landing: pr\ncustom:\n  bug: |\n    Keep\r', 'claude'],
  ['host_hint_29', 'landing: pr\ncustom:\n  bug: "Keep\\n"', 'claude'],
  ['host_hint_31', 'landing: pr\ncustom:\n  bug: |\n    \ta\n', 'claude'],
  ['host_hint_33', 'landing: pr\nworktreeSetup: ""\ngates: {}\nboard: {}\ncustom: {}\ncodexProfiles: {}\n', 'claude'],
  ['host_hint_35', 'landing: pr\nworktreeSetup: |\n  touch "$CONFIG_EXECUTION_MARKER"\n', 'claude'],
  [
    'host_hint_38',
    'landing: merge\nhost: claude\nboard: {port: 1024}\ngates: {triage: me, specify: auto, bug: me, chore: auto, hotfix: me, plan: auto, implement: me}\ncodexProfiles:\n  codex-desktop:\n    slots: [gpt-6-luna, gpt-6.1-sol, org/model-v2, gpt-6-astra]\n    reviewer: {rank: 3, effort: xhigh}\n',
    'claude',
  ],
  ['host_hint_41', 'landing: pr\nboard: {port: 4403}\n', 'claude'],
  ['host_hint_43', 'landing: pr\nboard: {port: 65535}\n', 'claude'],
  [
    'host_hint_45',
    'landing: pr\ncustom: {bug: Instruction., chore: Instruction., critic-loop: Instruction., doc-drift-sync: Instruction., feature: Instruction., guide: Instruction., hotfix: Instruction., implement: Instruction., intake: Instruction., lesson: Instruction., lesson-review: Instruction., plan: Instruction., polishing-code-comments: Instruction., prototype: Instruction., record-architecture-decisions: Instruction., setup: Instruction., specify: Instruction., triage: Instruction., writing-for-agents: Instruction.}\n',
    'claude',
  ],
  ['host_hint_62', '---\nhost: codex\nlanding: pr\n', 'codex'],
  ['host_hint_97', 'landing: pr\nboard: {port: 04404}\n', 'claude'],
  ['host_hint_171', "landing: pr\ncustom: {bug: '1_000', plan: !!str 0b101}\n", 'claude'],
  ['host_hint_173', 'landing: pr\ncustom: {bug: _1}\n', 'claude'],
  ['host_hint_181', '%YAML 1.1\n---\nlanding: pr\nworktreeSetup: yes\n', 'claude'],
];
for (const [name, source, want] of hints) {
  test.concurrent(
    name,
    withFixture(async (f) => {
      const { selectHost } = await import(hostModule);
      await f.config(source);
      expect(selectHost(undefined, {}, f.repo)).toBe(want);
      expect(await Bun.file(join(f.dir, 'executed')).exists()).toBe(false);
    }),
  );
}

test.concurrent(
  'dispatch preserves inherited stdin and termination signals',
  withProduct(async (f, p) => {
    await f.write('plug in/scripts/echo.ts', 'process.stdout.write(await Bun.stdin.text());');
    const child = spawn(p.executable, ['--agent', 'claude', 'echo'], {
      cwd: f.repo,
      env: p.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const closed = new Promise<number | null>((resolve) => child.once('close', resolve));
    child.stdin.end('terminal input\n');
    let output = '';
    for await (const chunk of child.stdout) output += chunk;
    expect(output).toBe('terminal input\n');
    expect(await closed).toBe(0);
    for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
      const marker = join(f.dir, signal);
      await f.write(
        'plug in/scripts/echo.ts',
        'await Bun.write(process.env.READY!,String(process.pid));setInterval(()=>{},1000);',
      );
      const child = spawn(p.executable, ['--agent', 'claude', 'echo'], {
        cwd: f.repo,
        env: { ...p.env, READY: marker },
        stdio: 'ignore',
      });
      const closed = new Promise<NodeJS.Signals | null>((resolve) =>
        child.once('close', (_code, signal) => resolve(signal)),
      );
      try {
        const deadline = Date.now() + 3000;
        while (!(await Bun.file(marker).exists()) && Date.now() < deadline) await Bun.sleep(10);
        expect(await Bun.file(marker).exists()).toBe(true);
        child.kill(signal);
        expect(await closed).toBe(signal);
        const pid = Number(await Bun.file(marker).text());
        expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        child.kill('SIGKILL');
      }
    }
  }),
);

test.concurrent(
  'copied launcher preserves its PID and installed command cannot survive SIGKILL',
  withProduct(async (f, p) => {
    const marker = join(f.dir, 'command-pid');
    await f.write(
      'plug in/scripts/echo.ts',
      'await Bun.write(process.env.READY!,String(process.pid));setInterval(()=>{},1000);',
    );
    const child = spawn(p.executable, ['--agent', 'claude', 'echo'], {
      cwd: f.repo,
      env: { ...p.env, READY: marker },
      stdio: 'ignore',
    });
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
    const launcherPid = child.pid;
    if (launcherPid === undefined) throw new Error('fixture launcher did not start');
    let installedPid: number | undefined;
    try {
      const deadline = Date.now() + 3000;
      while (!(await Bun.file(marker).exists()) && Date.now() < deadline) await Bun.sleep(10);
      const runningPid = Number(await Bun.file(marker).text());
      installedPid = runningPid;
      child.kill('SIGKILL');
      await closed;
      let survives = false;
      try {
        process.kill(runningPid, 0);
        survives = true;
      } catch {}
      expect({ pid: installedPid, survives }).toEqual({ pid: launcherPid, survives: false });
    } finally {
      child.kill('SIGKILL');
      if (installedPid !== undefined)
        try {
          process.kill(installedPid, 'SIGKILL');
        } catch {}
    }
  }),
);

test.concurrent(
  'a signal during Codex discovery removes its app-server process',
  withProduct(async (f, p) => {
    const child = spawn(p.executable, ['--agent', 'codex', 'echo'], {
      cwd: f.repo,
      env: { ...p.env, CODEX_MODE: 'hang' },
      stdio: 'ignore',
    });
    const closed = new Promise<number | null>((resolve) => child.once('close', resolve));
    let pid: number | undefined;
    try {
      const deadline = Date.now() + 3000;
      while (!(await Bun.file(p.pid).exists()) && Date.now() < deadline) await Bun.sleep(10);
      const serverPid = Number(await readFile(p.pid, 'utf8'));
      pid = serverPid;
      child.kill('SIGTERM');
      expect(await closed).toBe(143);
      expect(() => process.kill(serverPid, 0)).toThrow();
    } finally {
      child.kill('SIGKILL');
      if (pid)
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
    }
  }),
);

for (const [signal, code, laterSignal] of [
  ['SIGHUP', 129, 'SIGTERM'],
  ['SIGINT', 130, 'SIGTERM'],
  ['SIGTERM', 143, 'SIGINT'],
] as const) {
  test.concurrent(
    `Codex cleanup preserves the first ${signal} status and stops before dispatch`,
    withProduct(async (f, p) => {
      const ready = join(f.dir, 'cleanup-ready');
      const dispatched = join(f.dir, 'dispatched');
      await f.write('plug in/scripts/echo.ts', 'await Bun.write(process.env.DISPATCH_MARK!,"ran");');
      const child = spawn(p.executable, ['--agent', 'codex', 'echo'], {
        cwd: f.repo,
        env: { ...p.env, CODEX_MODE: 'cleanup signal', CLEANUP_READY: ready, DISPATCH_MARK: dispatched },
        stdio: 'ignore',
      });
      const closed = new Promise<number | null>((resolve) => child.once('close', resolve));
      let serverPid: number | undefined;
      let later: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = Date.now() + 3000;
        while (!(await Bun.file(ready).exists()) && Date.now() < deadline) await Bun.sleep(10);
        const pid = Number(await readFile(ready, 'utf8'));
        serverPid = pid;
        child.kill(signal);
        later = setTimeout(() => child.kill(laterSignal), 25);
        const result = await closed;
        let serverAlive = false;
        try {
          process.kill(pid, 0);
          serverAlive = true;
        } catch {}
        expect({ code: result, serverAlive, dispatched: await Bun.file(dispatched).exists() }).toEqual({
          code,
          serverAlive: false,
          dispatched: false,
        });
      } finally {
        clearTimeout(later);
        child.kill('SIGKILL');
        if (serverPid !== undefined)
          try {
            process.kill(serverPid, 'SIGKILL');
          } catch {}
      }
    }),
  );
}
