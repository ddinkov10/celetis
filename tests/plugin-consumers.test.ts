import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, isolatedArgs, root } from './lib/fixture.ts';

for (const [profile, inventory] of [
  ['same', 'native'],
  ['other', 'native'],
  ['missing', 'native'],
  ['shared-equal', 'native'],
  ['shared-repeated', 'native'],
  ['same', 'short'],
  ['other', 'short'],
  ['missing', 'short'],
  ['shared-equal', 'short'],
  ['same', 'old-short'],
] as const)
  test(`renamed native executable has ${profile} profile with ${inventory} inventory and private diagnostics`, async () => {
    const f = await fixture();
    const home = join(f.dir, 'profile');
    const other = join(f.dir, 'other');
    await mkdir(home);
    await mkdir(other);
    await mkdir(join(f.dir, 'bin'));
    const executable = join(f.dir, '2.1.306');
    await cp(process.execPath, executable);
    await symlink(executable, join(f.dir, 'bin/claude'));
    const old = join(f.dir, 'claude/versions/2.1.305');
    if (inventory === 'old-short') {
      await mkdir(join(f.dir, 'claude/versions'), { recursive: true });
      await cp(process.execPath, old);
    }
    const alias = join(f.dir, 'package alias');
    await symlink(f.repo, alias);
    const pluginArgs =
      profile === 'shared-equal'
        ? ['--', `--plugin-dir=${alias}`]
        : profile === 'shared-repeated'
          ? ['--', '--plugin-dir', other, '--plugin-dir', alias]
          : [];
    const marker = join(f.dir, 'ready');
    const env = { ...f.env, PATH: `${join(f.dir, 'bin')}:${process.env.PATH}` };
    const child = spawn(
      inventory === 'old-short' ? old : executable,
      [
        ...isolatedArgs,
        '-e',
        `await Bun.write(${JSON.stringify(marker)},String(process.pid));await Bun.sleep(30000);`,
        ...pluginArgs,
      ],
      {
        env: {
          ...env,
          HOME: profile === 'missing' ? undefined : f.home,
          CLAUDE_CONFIG_DIR: profile === 'missing' ? undefined : profile === 'same' ? home : other,
          PRIVATE_FIXTURE_SECRET: 'must-not-appear',
        },
        stdio: 'ignore',
      },
    );
    try {
      const deadline = performance.now() + 3000;
      while (!(await Bun.file(marker).exists())) {
        if (performance.now() >= deadline) throw new Error('consumer did not start');
        await Bun.sleep(10);
      }
      const probe = await f.write(
        'probe.ts',
        `import {requireStoppedConsumers} from ${JSON.stringify(join(root, 'scripts/lib/plugin-consumers.ts'))};import{run}from${JSON.stringify(join(root, 'scripts/lib/process.ts'))};const inventory=${JSON.stringify(`${child.pid} ${inventory === 'old-short' ? '2.1.305' : '2.1.306'}\n`)};try{await requireStoppedConsumers('claude',${JSON.stringify(home)},${JSON.stringify(f.repo)},${inventory === 'native' ? 'run' : "async(file,args,options)=>file==='ps'?{code:0,stdout:inventory,stderr:''}:run(file,args,options)"});}catch(error){console.error((error as Error).message);process.exitCode=1;}`,
      );
      const result = await f.bun(probe, [], { env });
      expect(result.code, result.stderr).toBe(profile === 'other' ? 0 : 1);
      if (profile !== 'other') expect(result.stderr).toContain('PID');
      expect(result.stderr).not.toContain('must-not-appear');
      expect(result.stderr).not.toContain('PRIVATE_FIXTURE_SECRET');
      expect(child.pid).toBe(Number(await readFile(marker, 'utf8')));
    } finally {
      child.kill('SIGTERM');
      await new Promise<void>((done) => child.once('close', () => done()));
      await f.cleanup();
    }
  });
