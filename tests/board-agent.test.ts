import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cp, readFile, rename, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseConfig } from '../board/config.ts';
import { createBoard, runData } from '../board/server.ts';
import { invoke } from './lib/board-fixture.ts';
import { command, isolatedArgs, root } from './lib/fixture.ts';
import { runnerFixture } from './lib/runner-fixture.ts';

test('board Run selection and saved-host Resume keep YAML and Git settings unchanged', async () => {
  const f = await runnerFixture(true);
  let server: ReturnType<typeof createBoard> | undefined;
  try {
    await symlink(process.execPath, join(f.dir, 'bin/bun'));
    await symlink('/usr/bin/git', join(f.dir, 'bin/git'));
    await symlink('/bin/ps', join(f.dir, 'bin/ps'));
    f.env.PATH = join(f.dir, 'bin');
    await cp(join(root, 'board'), join(f.plugin, 'board'), { recursive: true });
    const build = await command(process.execPath, [
      ...isolatedArgs,
      join(root, 'scripts/build.ts'),
      '--outdir',
      f.plugin,
    ]);
    expect(build).toEqual({ code: 0, stdout: '', stderr: '' });
    await cp(join(f.plugin, 'scripts/celetis'), join(f.repo, 'scripts/celetis'));
    await f.config('landing: pr\nhost: claude\n');
    await f.git(['add', '.']);
    await f.git(['commit', '-qm', 'board fixture']);
    await f.git(['config', 'celetis-flow.agent', 'claude']);
    for (let n = 6; n <= 9; n++) await f.issue(n, 'enhancement', 'Spec: fixture');
    await f.put('skip-input');
    const captureEntry = join(f.plugin, 'board/cli.ts');
    const original = await readFile(captureEntry, 'utf8');
    await writeFile(
      captureEntry,
      `import {writeFileSync} from 'node:fs';let input='';for await(const chunk of process.stdin)input+=chunk.toString();writeFileSync(${JSON.stringify(join(f.state, 'board-input.json'))},input);writeFileSync(${JSON.stringify(join(f.state, 'board-argv'))},JSON.stringify(process.argv.slice(1)));`,
    );
    const adapter = await invoke(join(f.plugin, 'scripts/board.ts'), [], f.repo, f.env);
    expect(adapter).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(JSON.parse(await f.read('board-argv'))).toEqual([captureEntry, '--config-stdin']);
    await writeFile(captureEntry, original);
    await rename(join(f.dir, 'bin/herdr'), join(f.dir, 'bin/herdr-runner'));
    const pane = await f.write(
      'pane.ts',
      `import {openSync,writeFileSync} from 'node:fs';import {spawn} from 'node:child_process';
      const output=openSync(${JSON.stringify(join(f.state, 'run-output'))},'a');
      const child=spawn('/bin/sh',['-c',process.argv[2]!],{cwd:${JSON.stringify(f.repo)},env:{...process.env,HERDR_ENV:'1',HERDR_PANE_ID:'w1:p1',HERDR_TAB_ID:'w1:t1'},stdio:['ignore',output,output]});
      child.once('close',code=>writeFileSync(${JSON.stringify(join(f.state, 'ran'))},String(code)+'\\n'));`,
    );
    await f.stub(
      'herdr',
      `import {appendFileSync,rmSync} from 'node:fs';import {spawn,spawnSync} from 'node:child_process';
      const a=process.argv.slice(2);const k=a.slice(0,2).join(' ');
      if(k==='api snapshot')console.log('{"result":{"snapshot":{"agents":[],"tabs":[]}}}');
      else if(k==='workspace list')console.log('{"result":{"workspaces":[]}}');
      else if(k==='workspace create')console.log('{"result":{"root_pane":{"pane_id":"w1:p1"},"tab":{"tab_id":"w1:t1"}}}');
      else if(k==='tab rename')console.log('{"result":{}}');
      else if(k==='pane run'){
        appendFileSync(${JSON.stringify(join(f.state, 'commands'))},a[3]+'\\n');rmSync(${JSON.stringify(join(f.state, 'ran'))},{force:true});
        const child=spawn(process.execPath,${JSON.stringify(isolatedArgs)}.concat(${JSON.stringify(pane)},a[3]!),{env:process.env,detached:true,stdio:'ignore'});appendFileSync(${JSON.stringify(join(f.state, 'pane-pids'))},String(child.pid)+'\\n');child.unref();console.log('{"result":{}}');
      }else{const r=spawnSync(${JSON.stringify(join(f.dir, 'bin/herdr-runner'))},a,{stdio:'inherit'});process.exitCode=r.status??1;}`,
    );
    const main = f.repo;
    const state = f.state;
    const source = JSON.parse(await f.read('board-input.json'));
    const config = await parseConfig(main, JSON.stringify(source), 'the input');
    assert.deepEqual(
      source.run,
      ['scripts/celetis', '--agent', '{agent}', 'celetis-flow', '{n}'],
      'Run must pass the board selection to the launcher',
    );
    assert.deepEqual(source.data, ['scripts/celetis', 'celetis-flow', '--board']);
    assert.deepEqual(source.resume, ['scripts/celetis', 'celetis-flow', '--resume', '{n}']);
    let time = Date.now();
    const exec = (file: string, args: string[], options = {}) =>
      command(file, args, { ...options, env: f.env, timeout: 15_000 });
    server = createBoard({ main, config, now: () => time, exec });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const post = async (path: string, body = {}) => {
      const response = await fetch(`${url}/api/${path}`, {
        method: 'POST',
        headers: { origin: url, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    const ok = async (path: string, body?: any) =>
      assert.deepEqual(await post(path, body), { status: 200, body: { ok: true } });
    const launched = async (path: string, body: any) => {
      if (path === 'run') await f.put('id', `00000000-0000-4000-8000-${String(body.number).padStart(12, '0')}`);
      await ok(path, body);
      const deadline = performance.now() + 12_000;
      while (performance.now() < deadline) {
        const code = await readFile(join(state, 'ran'), 'utf8').catch(() => null);
        if (code !== null) return assert.equal(code.trim(), '0', await f.read('run-output'));
        await Bun.sleep(10);
      }
      assert.fail(`the ${path} fixture command did not end`);
    };
    const refuseDefault = async (agent: string) =>
      assert.deepEqual(
        await post('agent', { agent }),
        {
          status: 409,
          body: { error: 'The producer controls the default agent. Change it in the producer configuration.' },
        },
        'the board must refuse producer-default changes',
      );
    const git = async (...args: string[]) =>
      (await command('git', ['-C', main, ...args], { env: f.env })).stdout.trimEnd();
    const preference = () => git('config', '--get', 'celetis-flow.agent');
    const localConfig = () => git('config', '--local', '--null', '--list');
    const calls = () => f.logs<any>('calls');
    const producer = async () => {
      const data = await runData(main, config.data as any, exec);
      assert.equal(data.error, null);
      return JSON.parse(data.output as any);
    };
    const initial: any = await (await fetch(`${url}/api/board`)).json();
    assert.equal(initial.defaultAgent, 'claude');
    assert.deepEqual(initial.agents, {
      claude: { available: true, cause: null },
      codex: { available: true, cause: null },
    });
    const yaml = await readFile(join(main, '.celetis.yaml'));
    assert.deepEqual(
      yaml,
      Buffer.from((await command('git', ['-C', main, 'show', 'HEAD:.celetis.yaml'], { env: f.env })).stdout),
    );
    const before = await localConfig();
    const gitConfig = await readFile(join(main, '.git/config'));
    assert.equal(await preference(), 'claude');
    const initialCalls = await calls();
    await refuseDefault('codex');
    assert.deepEqual(
      await readFile(join(main, '.celetis.yaml')),
      yaml,
      'a refused default must leave tracked YAML unchanged',
    );
    assert.equal(await localConfig(), before, 'a refused default must leave all local Git settings unchanged');
    assert.deepEqual(
      await readFile(join(main, '.git/config')),
      gitConfig,
      'a refused default must leave the Git config bytes unchanged',
    );
    assert.equal((await producer()).defaultAgent, 'claude', 'the producer must ignore the old Git preference');
    assert.equal(((await (await fetch(`${url}/api/board`)).json()) as any).defaultAgent, 'claude');
    assert.deepEqual(await calls(), initialCalls, 'a refused default must start no agent');
    assert.equal(await f.read('commands'), '', 'a refused default must open no command');
    assert.equal(await git('status', '--porcelain'), '');
    await launched('run', { number: 6 });
    assert.equal((await calls()).at(-1).host, 'claude', 'an unqualified Run must keep the YAML default after refusal');
    assert.deepEqual(await readFile(join(main, '.celetis.yaml')), yaml);
    assert.equal(await localConfig(), before);
    await writeFile(join(main, '.celetis.yaml'), 'landing: pr\nhost: codex\n');
    await git('add', '.celetis.yaml');
    await git('commit', '-qm', 'fixture Codex default');
    await ok('refresh');
    assert.equal((await producer()).defaultAgent, 'codex');
    await launched('run', { number: 7, agent: 'claude' });
    assert.equal((await calls()).at(-1).host, 'claude');
    assert.equal(await localConfig(), before, 'Run must not change any local Git setting');
    await launched('run', { number: 8 });
    assert.equal((await calls()).at(-1).host, 'codex');
    assert.equal(await localConfig(), before);
    const saved = JSON.parse(await readFile(join(main, '.git/celetis-flow/sessions/8.json'), 'utf8'));
    assert.equal(saved.host, 'codex');
    assert.equal(saved.session_id, '00000000-0000-4000-8000-000000000008');
    const codexYaml = await readFile(join(main, '.celetis.yaml'));
    await refuseDefault('claude');
    assert.deepEqual(await readFile(join(main, '.celetis.yaml')), codexYaml);
    assert.equal(await localConfig(), before);
    assert.equal((await producer()).defaultAgent, 'codex');
    assert.equal(((await (await fetch(`${url}/api/board`)).json()) as any).defaultAgent, 'codex');
    await writeFile(join(main, '.celetis.yaml'), 'landing: pr\nhost: claude\n');
    await git('add', '.celetis.yaml');
    await git('commit', '-qm', 'fixture Claude default');
    await ok('refresh');
    assert.equal((await producer()).defaultAgent, 'claude');
    time += 31_000;
    await launched('resume', { number: 8 });
    const last = (await calls()).at(-1);
    assert.deepEqual(
      { host: last.host, cwd: last.cwd, args: last.args },
      { host: 'codex', cwd: main, args: ['resume', '--no-daemon', saved.session_id] },
    );
    assert.equal(await preference(), 'claude');
    const started = (await calls()).length;
    const commands = await f.read('commands');
    await rename(join(f.dir, 'bin/codex'), join(state, 'hidden-codex'));
    await ok('refresh');
    assert.equal((await producer()).agents.codex.available, false);
    for (const agent of ['codex', 'unknown']) {
      assert.equal((await post('run', { number: 9, agent })).status, 409);
      await refuseDefault(agent);
    }
    assert.equal((await calls()).length, started, 'a refused choice must start no agent');
    assert.equal(await f.read('commands'), commands, 'a refused choice must open no command');
    assert.equal(await preference(), 'claude');
    assert.equal(await localConfig(), before);
    assert.deepEqual(await readFile(join(main, '.git/config')), gitConfig);
    assert.deepEqual(await readFile(join(main, '.celetis.yaml')), yaml);
    assert.equal(await git('status', '--porcelain'), '');
  } finally {
    server?.closeAllConnections();
    if (server?.listening) await new Promise<void>((done) => (server as any).close(() => done()));
    const pids = (await f.read('pane-pids')).split('\n').filter(Boolean).map(Number);
    try {
      for (const pid of pids) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {}
      }
      for (const pid of pids) {
        const deadline = performance.now() + 1000;
        while (performance.now() < deadline) {
          try {
            process.kill(-pid, 0);
          } catch {
            break;
          }
          await Bun.sleep(10);
        }
        expect(() => process.kill(-pid, 0)).toThrow();
      }
    } finally {
      await f.cleanup();
    }
  }
}, 29_000);
