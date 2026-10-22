import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { chmod, cp, mkdir, readFile, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { withFixture } from '../tests/lib/fixture.ts';
import { parseConfig } from './config.ts';
import { realpath } from './realpath.ts';
import { runData } from './server.ts';

test(
  'a mode-0111 native producer keeps canonical data, Run and Resume paths without source read permission',
  withFixture(async (f) => {
    const target = join(f.repo, 'scripts/native');
    const source = Bun.which('true');
    assert.ok(source);
    await mkdir(join(f.repo, 'scripts'));
    await cp(source, target);
    await chmod(target, 0o111);
    expect((await stat(target)).mode & 0o777).toBe(0o111);
    await assert.rejects(readFile(target), { code: 'EACCES' });
    await symlink(target, join(f.repo, 'scripts/native-link'));
    const config = await parseConfig(
      f.repo,
      JSON.stringify({
        data: ['scripts/native-link'],
        run: ['scripts/native', '{n}'],
        resume: ['scripts/native', '{n}'],
      }),
      'the input',
    );
    expect(config).toEqual({ data: [target], run: [target, '{n}'], resume: [target, '{n}'], port: null });
    assert.ok(config.data);
    expect(await runData(f.repo, config.data)).toEqual({ output: '', error: null });
    await assert.rejects(readFile(target), { code: 'EACCES' });
  }),
  29_000,
);

test(
  'importing native realpath does not load libc and a missing primitive stops the operation',
  withFixture(async (f) => {
    const source = await readFile(new URL('./realpath.ts', import.meta.url), 'utf8');
    const unavailable = source.replace(
      /const libraries =[\s\S]*?;\n/,
      "const libraries = ['/celetis-missing-system-library'];\n",
    );
    expect(unavailable).not.toBe(source);
    const module = await f.write('unavailable.ts', unavailable);
    const probe = await f.write(
      'probe.ts',
      `const module=await import(${JSON.stringify(module)});console.log('imported');try{await module.realpath(${JSON.stringify(f.repo)});}catch(error){console.error((error as Error).message);process.exitCode=1;}`,
    );
    expect(await f.bun(probe)).toEqual({
      code: 1,
      stdout: 'imported\n',
      stderr: 'board: cannot load the system realpath library\n',
    });
  }),
);

test(
  'native realpath keeps missing-path, symlink-loop and NUL refusals',
  withFixture(async (f) => {
    const missing = join(f.repo, 'missing');
    await expect(realpath(missing)).rejects.toMatchObject({ code: 'ENOENT', syscall: 'realpath', path: missing });
    const loop = join(f.repo, 'loop');
    await symlink(loop, loop);
    await expect(realpath(loop)).rejects.toMatchObject({ code: 'ELOOP', syscall: 'realpath', path: loop });
    await expect(realpath(`${f.repo}\0extra`)).rejects.toThrow('path contains NUL');
  }),
);
