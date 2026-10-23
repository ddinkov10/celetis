import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, isolatedArgs, root } from './lib/fixture.ts';

for (const profile of ['same', 'other', 'missing', 'shared-equal', 'shared-repeated'])
  test(`renamed native executable has ${profile} profile identity without diagnostic environment data`, async () => {
    const f = await fixture();
    const home = join(f.dir, 'profile');
    const other = join(f.dir, 'other');
    await mkdir(home);
    await mkdir(other);
    await mkdir(join(f.dir, 'bin'));
    const executable = join(f.dir, '2.1.306');
    await cp(process.execPath, executable);
    await symlink(executable, join(f.dir, 'bin/claude'));
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
      executable,
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
        `import {requireStoppedConsumers} from ${JSON.stringify(join(root, 'scripts/lib/plugin-consumers.ts'))};try{await requireStoppedConsumers('claude',${JSON.stringify(home)},${JSON.stringify(f.repo)});}catch(error){console.error((error as Error).message);process.exitCode=1;}`,
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
