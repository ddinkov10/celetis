import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tryFlock, UpdateLock } from '../scripts/lib/update-lock.ts';
import { command, fixture, isolatedArgs, root } from './lib/fixture.ts';

import { type RunnerFixture, runnerCase, updateTestClock } from './lib/runner-fixture.ts';

setDefaultTimeout(25_000);
const children = new Set<ChildProcess>();
afterAll(async () => {
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
      child.kill('SIGKILL');
    }
  }
  children.clear();
});

async function until(body: () => Promise<boolean>, message: string) {
  const deadline = performance.now() + 4000;
  while (!(await body())) {
    if (performance.now() >= deadline) throw new Error(message);
    await Bun.sleep(10);
  }
}

async function live(pid: number) {
  const result = await command('/bin/ps', ['-p', String(pid), '-o', 'stat=']);
  if (result.code !== 0 && result.stderr.includes('not permitted')) throw new Error(result.stderr);
  return result.code === 0 && !!result.stdout.trim() && !/[ZX]/.test(result.stdout);
}

test('system flock prevents independent open descriptions from overlapping', async () => {
  const f = await fixture();
  const file = join(f.dir, 'lock');
  const one = openSync(file, 'a');
  const two = openSync(file, 'a');
  try {
    expect(tryFlock(one)).toBe(true);
    expect(tryFlock(two)).toBe(false);
    closeSync(one);
    expect(tryFlock(two)).toBe(true);
  } finally {
    try {
      closeSync(one);
    } catch {}
    closeSync(two);
    await f.cleanup();
  }
});

test('SIGKILL of a helper leaves the inherited lock held until its real command exits', async () => {
  const f = await fixture();
  const lockPath = join(f.dir, 'lock');
  const pidPath = join(f.dir, 'pid');
  const childFile = await f.write(
    'command.ts',
    `import { fstatSync, writeFileSync } from 'node:fs';
    fstatSync(3); writeFileSync(${JSON.stringify(pidPath)}, String(process.pid));
    while (!await Bun.file(${JSON.stringify(join(f.dir, 'release'))}).exists()) await Bun.sleep(10);`,
  );
  const helper = await f.write(
    'helper.ts',
    `import { UpdateLock } from ${JSON.stringify(join(root, 'scripts/lib/update-lock.ts'))};
    const lock = await UpdateLock.acquire(${JSON.stringify(lockPath)}, ${process.pid});
    try { await lock.run(process.execPath, ${JSON.stringify([...isolatedArgs, childFile])}); } finally { await lock.close(); }`,
  );
  const child = spawn(process.execPath, [...isolatedArgs, helper], { env: f.env, stdio: 'ignore', detached: true });
  children.add(child);
  let commandPid = 0;
  try {
    await until(async () => Bun.file(pidPath).exists(), 'command did not inherit descriptor 3');
    commandPid = Number(await readFile(pidPath, 'utf8'));
    child.kill('SIGKILL');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    const probe = openSync(lockPath, 'a');
    try {
      expect(tryFlock(probe)).toBe(false);
      expect(await live(commandPid)).toBe(true);
      await f.write('release', '');
      await until(async () => tryFlock(probe), 'child exit did not release inherited lock');
    } finally {
      closeSync(probe);
    }
  } finally {
    if (commandPid) {
      try {
        process.kill(-commandPid, 'SIGKILL');
      } catch {}
    }
    await f.cleanup();
  }
});

test('a real timeout kills the command and every descendant before lock close', async () => {
  const f = await fixture();
  const descendant = await f.write(
    'descendant.ts',
    `import { writeFileSync } from 'node:fs';
    process.on('SIGTERM', () => {}); writeFileSync(${JSON.stringify(join(f.dir, 'descendant'))}, String(process.pid)); await Bun.sleep(30_000);`,
  );
  const parent = await f.write(
    'parent.ts',
    `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
    process.on('SIGTERM', () => {}); writeFileSync(${JSON.stringify(join(f.dir, 'parent'))}, String(process.pid));
    spawn(process.execPath, ${JSON.stringify([...isolatedArgs, descendant])}, {stdio: ['ignore', 'inherit', 'inherit', 3]}); await Bun.sleep(30_000);`,
  );
  const lock = await UpdateLock.acquire(join(f.dir, 'lock'), process.pid, { timeoutMs: 400 });
  try {
    await expect(lock.run(process.execPath, [...isolatedArgs, parent])).rejects.toThrow('timed out');
    const pids = await Promise.all(['parent', 'descendant'].map(async (name) => Number(await f.read(name))));
    const table = await command('/bin/ps', ['-p', pids.join(','), '-o', 'pid=,ppid=,pgid=,stat=,command=']);
    console.log(
      `runtime ${Bun.version} ${process.platform}/${process.arch}; after timeout: ${table.stdout.trim() || '(no processes)'}`,
    );
    const descendantsAliveAfterTimeout = [];
    for (const pid of pids) if (await live(pid)) descendantsAliveAfterTimeout.push(pid);
    expect(descendantsAliveAfterTimeout).toEqual([]);
  } finally {
    await lock.close();
    await f.cleanup();
  }
});

test('lock wait uses the same 120 second monotonic deadline', async () => {
  const f = await fixture();
  const path = join(f.dir, 'lock');
  const fd = openSync(path, 'a');
  try {
    expect(tryFlock(fd)).toBe(true);
    let now = 0;
    const clock = {
      now: () => now,
      sleep: async (ms: number) => {
        expect(ms).toBe(50);
        now += 40_000;
      },
    };
    await expect(UpdateLock.acquire(path, process.pid, { clock })).rejects.toThrow(
      'timed out after 120 seconds during wait for the plugin update lock',
    );
    expect(now).toBe(120_000);
  } finally {
    closeSync(fd);
    await f.cleanup();
  }
});

for (const name of ['issue-7', 'runner'])
  test.concurrent(
    `CAS stale ${name} contenders cannot replace a new live owner`,
    runnerCase(async (f) => {
      await f.put('skip-input');
      await f.put('hold-session');
      await f.issue();
      const owner = await writeOwner(f, { runner: { pid: 12345678, start: 'dead' }, session: null });
      await f.git(['update-ref', `refs/celetis-flow/locks/${name}`, owner]);
      const realPs = '/bin/ps';
      await f.stub(
        'ps',
        `import {existsSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {spawn} from 'node:child_process';const args=process.argv.slice(2),S=process.env.RUNNER_TEST!,host=process.env.CELETIS_AGENT!;if(args[1]==='12345678'){writeFileSync(join(S,'read-'+host),'');const end=performance.now()+4000;while(!(existsSync(join(S,'read-claude'))&&existsSync(join(S,'read-codex')))&&performance.now()<end)await Bun.sleep(5);if(host==='codex')while(!existsSync(join(S,'started-1'))&&performance.now()<end)await Bun.sleep(5);writeFileSync(join(S,'returned-'+host),'');process.exit(1);}const child=spawn(${JSON.stringify(realPs)},args,{stdio:'inherit'});process.exitCode=await new Promise<number>(done=>child.once('close',code=>done(code??1)));`,
      );
      const one = f.start(name === 'runner' ? [] : ['7'], { host: 'claude' });
      const two = f.start(name === 'runner' ? [] : ['7'], { host: 'codex' });
      await f.wait('returned-codex');
      await f.wait('started-1');
      expect((await f.logs('calls')).map((row) => row.host)).toEqual(['claude']);
      expect((await command('git', ['log', '--all', '--oneline'], { cwd: f.repo, env: f.env })).code).toBe(0);
      await f.put('finish-1');
      if (name === 'runner') {
        const end = performance.now() + 4000;
        while (!one.output().stdout.includes('no auto step') && performance.now() < end) await Bun.sleep(10);
        one.child.kill('SIGTERM');
      }
      const [a, b] = await Promise.all([one.result, two.result]);
      expect(name === 'runner' ? b.stderr : b.stdout).toContain(
        name === 'runner' ? 'another automatic runner' : 'another celetis-flow.ts',
      );
      expect(a.code).toBe(name === 'runner' ? 143 : 0);
      expect(await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks'])).toBe('');
    }, true),
  );

async function writeOwner(f: RunnerFixture, value: unknown) {
  const { spawn } = await import('node:child_process');
  const child = spawn('git', ['hash-object', '-w', '--stdin'], {
    cwd: f.repo,
    env: f.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout?.on('data', (data: Buffer) => {
    out += data.toString();
  });
  child.stdin?.end(`${JSON.stringify(value)}\n`);
  expect(await new Promise<number>((done) => child.once('close', (code) => done(code ?? 1)))).toBe(0);
  return out.trimEnd();
}
for (const stale of ['dead', 'pid-reuse', 'wrong-executable', 'garbage'])
  test.concurrent(
    `ownership ${stale} cannot keep an issue lock`,
    runnerCase(async (f) => {
      await f.issue();
      let runner: unknown;
      if (stale === 'dead') runner = { pid: 2147483647, start: 'stale' };
      if (stale === 'pid-reuse') runner = { pid: process.pid, start: 'not-the-current-start' };
      if (stale === 'wrong-executable') {
        const ps = await command('/bin/ps', ['-p', String(process.pid), '-o', 'lstart='], {
          env: { ...f.env, LC_ALL: 'C' },
        });
        runner = { pid: process.pid, start: ps.stdout.trimEnd() };
      }
      if (stale === 'garbage') runner = { pid: 'garbage', start: 'stale' };
      const owner = await writeOwner(
        f,
        stale === 'pid-reuse' ? { runner: null, session: runner } : { runner, session: null },
      );
      await f.git(['update-ref', 'refs/celetis-flow/locks/issue-7', owner]);
      const result = await f.run();
      expect(result.code, result.stderr).toBe(0);
      expect((await f.logs('calls')).length).toBe(1);
      expect(await f.git(['for-each-ref', '--format=%(refname)', 'refs/celetis-flow/locks'])).toBe('');
    }, true),
  );
test.concurrent(
  'replacement owner survives the previous runner release',
  runnerCase(async (f) => {
    await f.issue();
    await f.put('hold-session');
    await f.put('skip-input');
    const r = f.start();
    await f.wait('started-1');
    const replacement = await writeOwner(f, { runner: { pid: 12345679, start: 'replacement' }, session: null });
    await f.git(['update-ref', 'refs/celetis-flow/locks/issue-7', replacement]);
    await f.put('finish-1');
    expect((await r.result).code).toBe(0);
    expect(await f.git(['rev-parse', 'refs/celetis-flow/locks/issue-7'])).toBe(replacement);
  }, true),
);
test.concurrent(
  'a real zombie session owner cannot hold an issue lock',
  runnerCase(async (f) => {
    const script = await f.write(
      'zombie-parent.ts',
      `import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';const child=spawn(process.execPath,${JSON.stringify([...isolatedArgs, '-e', 'await Bun.sleep(150);'])},{stdio:'ignore'});writeFileSync(${JSON.stringify(join(f.state, 'zombie'))},String(child.pid));setTimeout(()=>process.kill(process.pid,'SIGSTOP'),30);await Bun.sleep(30_000);`,
    );
    const parent = spawn(process.execPath, [...isolatedArgs, script], { stdio: 'ignore', detached: true });
    children.add(parent);
    try {
      await f.wait('zombie');
      const pid = Number(await f.read('zombie'));
      await until(async () => {
        const ps = await command('/bin/ps', ['-p', String(pid), '-o', 'stat=']);
        return ps.stdout.includes('Z');
      }, 'child did not become a zombie');
      const ps = await command('/bin/ps', ['-p', String(pid), '-o', 'lstart='], { env: { ...f.env, LC_ALL: 'C' } });
      const owner = await writeOwner(f, { runner: null, session: { pid, start: ps.stdout.trimEnd() } });
      await f.git(['update-ref', 'refs/celetis-flow/locks/issue-7', owner]);
      await f.issue();
      const r = await f.run();
      expect(r.code, r.stderr).toBe(0);
      expect((await f.logs('calls')).length).toBe(1);
    } finally {
      parent.kill('SIGCONT');
      parent.kill('SIGKILL');
    }
  }, true),
);

for (const host of ['claude', 'codex'] as const)
  test.concurrent(
    `${host} waitingSession keeps shared admission after runner SIGKILL until native exit`,
    runnerCase(async (f) => {
      await f.put('hold-session');
      await f.put('skip-input');
      await f.issue();
      const running = f.start(['7'], { host });
      const lockPath = join(
        host === 'claude' ? (f.env.CLAUDE_CONFIG_DIR ?? '') : (f.env.CODEX_HOME ?? ''),
        'celetis-update.lock',
      );
      let fd = -1;
      try {
        await f.wait('started-1');
        fd = openSync(lockPath, 'a');
        expect(tryFlock(fd)).toBe(false);
        running.child.kill('SIGKILL');
        await running.exited;
        expect(tryFlock(fd)).toBe(false);
        await f.put('finish-1');
        await until(async () => tryFlock(fd), 'native process did not release its inherited shared admission');
      } finally {
        if (fd >= 0) closeSync(fd);
        running.child.kill('SIGKILL');
        await f.put('finish-1');
      }
    }),
  );

for (const host of ['claude', 'codex'] as const)
  test.concurrent(
    `nested ${host} installed-root child and descendant inherit the update lock`,
    runnerCase(async (f) => {
      if (host === 'claude') await f.put('update-hang', 'list');
      else await f.put('lookup-hang');
      const lockPath = join(f.dir, 'update.lock');
      const lookup = await f.write(
        'lookup.ts',
        `import {writeFileSync} from 'node:fs';import {installedRoot} from ${JSON.stringify(join(root, 'scripts/lib/host.ts'))};writeFileSync(${JSON.stringify(join(f.state, 'lookup-pid'))},String(process.pid));await installedRoot(${JSON.stringify(host)},process.cwd(),3);`,
      );
      const supervisor = await f.write(
        'supervisor.ts',
        `import {UpdateLock} from ${JSON.stringify(join(root, 'scripts/lib/update-lock.ts'))};const lock=await UpdateLock.acquire(${JSON.stringify(lockPath)},${process.pid});try{await lock.run(process.execPath,${JSON.stringify([...isolatedArgs, lookup])},{cwd:${JSON.stringify(f.repo)}});}finally{await lock.close();}`,
      );
      const child = spawn(process.execPath, [...isolatedArgs, supervisor], {
        cwd: f.repo,
        env: f.env,
        stdio: 'ignore',
        detached: true,
      });
      children.add(child);
      let lookupPid = 0,
        hostPid = 0,
        descendantPid = 0;
      try {
        await f.wait('update-child');
        lookupPid = Number(await f.read('lookup-pid'));
        hostPid = Number(await f.read('update-pid'));
        descendantPid = Number(await f.read('update-child'));
        const probe = openSync(lockPath, 'a');
        try {
          child.kill('SIGKILL');
          await new Promise<void>((done) => child.once('exit', () => done()));
          expect(tryFlock(probe)).toBe(false);
          process.kill(lookupPid, 'SIGKILL');
          await until(async () => !(await live(lookupPid)), 'lookup did not exit');
          expect(await live(hostPid)).toBe(true);
          expect(tryFlock(probe)).toBe(false);
          process.kill(hostPid, 'SIGKILL');
          await until(async () => !(await live(hostPid)), 'host did not exit');
          expect(await live(descendantPid)).toBe(true);
          expect(tryFlock(probe)).toBe(false);
          process.kill(descendantPid, 'SIGKILL');
          await until(async () => tryFlock(probe), 'nested descriptor did not release');
          const table = await command('/bin/ps', [
            '-p',
            [lookupPid, hostPid, descendantPid].join(','),
            '-o',
            'pid=,ppid=,pgid=,stat=,command=',
          ]);
          console.log(`${host} nested lock after SIGKILL: ${table.stdout.trim() || '(no processes)'}`);
        } finally {
          closeSync(probe);
        }
      } finally {
        for (const pid of [lookupPid, hostPid, descendantPid])
          if (pid) {
            try {
              process.kill(pid, 'SIGKILL');
            } catch {}
          }
      }
    }),
  );

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
  test.concurrent(
    `update supervisor ${signal} kills its real TERM-ignoring descendants`,
    runnerCase(async (f) => {
      await f.put('update-hang', 'marketplace');
      const lockPath = join(f.dir, 'update.lock');
      const supervisor = await f.write(
        'supervisor.ts',
        `import {UpdateLock} from ${JSON.stringify(join(root, 'scripts/lib/update-lock.ts'))};const lock=await UpdateLock.acquire(${JSON.stringify(lockPath)},${process.pid});try{await lock.run('claude',['plugin','marketplace','update','celetis']);}catch(error){console.error((error as Error).message);process.exitCode=1;}finally{await lock.close();}`,
      );
      const child = spawn(process.execPath, [...isolatedArgs, supervisor], {
        cwd: f.repo,
        env: f.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });
      children.add(child);
      let stderr = '';
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      const exited = new Promise<number | null>((done) => child.once('close', done));
      await f.wait('update-child');
      const started = performance.now();
      child.kill(signal);
      expect(await exited).toBe(1);
      expect(performance.now() - started).toBeLessThan(5000);
      expect(stderr).toContain(`interrupted by ${signal}`);
      expect(stderr).toContain('fixture update stalled with original cause');
      expect(await live(Number(await f.read('update-pid')))).toBe(false);
      expect(await live(Number(await f.read('update-child')))).toBe(false);
      const fd = openSync(lockPath, 'a');
      try {
        expect(tryFlock(fd)).toBe(true);
      } finally {
        closeSync(fd);
      }
    }),
  );

test.concurrent(
  'runner death cancels the surviving update helper and its descendants',
  runnerCase(async (f) => {
    await f.put('update-hang', 'marketplace');
    const lockPath = join(f.dir, 'update.lock');
    const runner = spawn(process.execPath, [...isolatedArgs, '-e', 'await Bun.sleep(30_000);'], {
      stdio: 'ignore',
      detached: true,
    });
    children.add(runner);
    const supervisor = await f.write(
      'supervisor.ts',
      `import {UpdateLock} from ${JSON.stringify(join(root, 'scripts/lib/update-lock.ts'))};const lock=await UpdateLock.acquire(${JSON.stringify(lockPath)},${runner.pid});try{await lock.run('claude',['plugin','marketplace','update','celetis']);}catch(error){console.error((error as Error).message);process.exitCode=1;}finally{await lock.close();}`,
    );
    const child = spawn(process.execPath, [...isolatedArgs, supervisor], {
      cwd: f.repo,
      env: f.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    children.add(child);
    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    const exited = new Promise<number | null>((done) => child.once('close', done));
    await f.wait('update-child');
    runner.kill('SIGKILL');
    await new Promise<void>((done) => runner.once('exit', () => done()));
    expect(await exited).toBe(1);
    expect(stderr).toContain('the runner exited during claude plugin marketplace update celetis');
    for (const name of ['update-pid', 'update-child']) expect(await live(Number(await f.read(name)))).toBe(false);
  }),
);

test('successful command exit closes descendant output pipes and releases its lock after cleanup', async () => {
  const f = await fixture();
  const desc = await f.write(
    'desc.ts',
    `import {writeFileSync} from 'node:fs';process.on('SIGTERM',()=>{});writeFileSync(${JSON.stringify(join(f.dir, 'pid'))},String(process.pid));await Bun.sleep(30_000);`,
  );
  const commandFile = await f.write(
    'command.ts',
    `import {spawn} from 'node:child_process';const child=spawn(process.execPath,${JSON.stringify([...isolatedArgs, desc])},{stdio:['ignore','inherit','inherit',3]});child.unref();while(!await Bun.file(${JSON.stringify(join(f.dir, 'pid'))}).exists())await Bun.sleep(5);console.log('exact stdout');process.exit(0);`,
  );
  const lock = await UpdateLock.acquire(join(f.dir, 'lock'), process.pid);
  try {
    expect(await lock.run(process.execPath, [...isolatedArgs, commandFile])).toBe('exact stdout\n');
    expect(await live(Number(await f.read('pid')))).toBe(false);
  } finally {
    await lock.close();
    await f.cleanup();
  }
});

test('all update commands share one 120 second monotonic deadline', async () => {
  const f = await fixture();
  let now = 0;
  const lock = await UpdateLock.acquire(join(f.dir, 'lock'), process.pid, {
    clock: {
      now: () => now,
      sleep: async (ms) => {
        await Bun.sleep(ms);
        now += 60_000;
      },
    },
  });
  try {
    expect(await lock.run(process.execPath, [...isolatedArgs, '-e', 'console.log("first");'])).toBe('first\n');
    await expect(lock.run(process.execPath, [...isolatedArgs, '-e', 'await Bun.sleep(30_000);'])).rejects.toThrow(
      'timed out after 120 seconds',
    );
    expect(now).toBe(120_000);
  } finally {
    await lock.close();
    await f.cleanup();
  }
});

for (const killed of [false, true])
  test.concurrent(
    `two repositories serialize plugin refresh${killed ? ' after helper SIGKILL' : ''}`,
    runnerCase(async (f) => {
      const second = join(f.dir, 'other repository');
      await f.git(['clone', '-q', f.repo, second]);
      await f.put('hold-update');
      await updateTestClock(f);
      const launch = (cwd: string) => {
        const child = spawn(process.execPath, [...isolatedArgs, join(f.plugin, 'scripts/plugin-update.ts')], {
          cwd,
          env: f.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        children.add(child);
        let stderr = '';
        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
        return { child, result: new Promise<number | null>((done) => child.once('close', done)), error: () => stderr };
      };
      const one = launch(f.repo);
      await f.wait('update-entered');
      if (killed) {
        one.child.kill('SIGKILL');
        await new Promise<void>((done) => one.child.once('exit', () => done()));
      }
      const two = launch(second);
      await Bun.sleep(150);
      expect((await f.logs('updates')).length).toBe(1);
      let updateOverlap = await f.has('update-overlap');
      expect(updateOverlap).toBe(false);
      await rm(join(f.state, 'hold-update'));
      const [a, b] = await Promise.all([one.result, two.result]);
      expect(a).toBe(killed ? null : 0);
      expect(b, two.error()).toBe(0);
      updateOverlap = await f.has('update-overlap');
      expect(updateOverlap).toBe(false);
      const marketplace = { host: 'claude', args: ['plugin', 'marketplace', 'update', 'celetis'] };
      const plugin = { host: 'claude', args: ['plugin', 'update', 'celetis@celetis', '--scope', 'user'] };
      expect(await f.logs('updates')).toEqual(
        killed ? [marketplace, marketplace, plugin] : [marketplace, plugin, marketplace, plugin],
      );
    }),
  );

test.concurrent(
  'Codex registry-lookup interruption preserves stderr once and cleans its real child group',
  runnerCase(async (f) => {
    await f.put('lookup-hang');
    await updateTestClock(f);
    const child = spawn(process.execPath, [...isolatedArgs, join(f.plugin, 'scripts/plugin-update.ts')], {
      cwd: f.repo,
      env: { ...f.env, CELETIS_AGENT: 'codex' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    const ended = new Promise<number | null>((done) => child.once('close', done));
    await f.wait('update-child');
    child.kill('SIGTERM');
    expect(await ended).toBe(1);
    expect(stderr).toContain('interrupted by SIGTERM');
    expect(stderr.split('fixture: skills catalog lookup stalled with original cause').length - 1).toBe(1);
    for (const name of ['update-pid', 'update-child']) expect(await live(Number(await f.read(name)))).toBe(false);
  }),
);
