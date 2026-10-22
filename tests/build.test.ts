import { expect, test } from 'bun:test';
import { chmod, cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, withFixture } from './lib/fixture.ts';

const build = join(root, 'scripts/build.ts');

test(
  'build creates one deterministic executable without changing the public launcher',
  withFixture(async (f) => {
    const original = await readFile(join(root, 'scripts/celetis'));
    const first = join(f.dir, 'first');
    const second = join(f.dir, 'second');
    expect(await f.bun(build, ['--outdir', first])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await f.bun(build, ['--outdir', second])).toEqual({ code: 0, stdout: '', stderr: '' });
    const file = join(first, 'scripts/celetis');
    expect(await readdir(join(first, 'scripts'))).toEqual(['celetis']);
    expect(await readFile(file)).toEqual(await readFile(join(second, 'scripts/celetis')));
    expect((await stat(file)).mode & 0o777).toBe(0o755);
    expect(await readFile(join(root, 'scripts/celetis'))).toEqual(original);
  }),
);

test(
  'a build from another checkout path has the same bytes',
  withFixture(async (f) => {
    const checkout = join(f.dir, 'another checkout');
    await cp(join(root, 'scripts'), join(checkout, 'scripts'), { recursive: true });
    await cp(join(root, 'board'), join(checkout, 'board'), { recursive: true });
    const first = join(f.dir, 'first');
    const second = join(f.dir, 'second');
    expect((await f.bun(build, ['--outdir', first])).code).toBe(0);
    expect((await f.bun(join(checkout, 'scripts/build.ts'), ['--outdir', second])).code).toBe(0);
    expect(await readFile(join(first, 'scripts/celetis'))).toEqual(await readFile(join(second, 'scripts/celetis')));
  }),
);

test(
  'check reports missing, stale, and nonexecutable outputs without writes',
  withFixture(async (f) => {
    const checkout = join(f.dir, 'checkout');
    await cp(join(root, 'scripts'), join(checkout, 'scripts'), { recursive: true });
    await cp(join(root, 'board'), join(checkout, 'board'), { recursive: true });
    const entry = join(checkout, 'scripts/build.ts');
    const output = join(checkout, 'scripts/celetis');
    await rm(output);
    let result = await f.bun(entry, ['--check']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('scripts/celetis');
    expect(await Bun.file(output).exists()).toBe(false);
    expect((await f.bun(entry, ['--outdir', checkout])).code).toBe(0);
    expect(await f.bun(entry, ['--check'])).toEqual({ code: 0, stdout: '', stderr: '' });
    const generated = await readFile(output);
    await writeFile(output, 'stale\n');
    result = await f.bun(entry, ['--check']);
    expect(result.code).toBe(1);
    expect(await readFile(output, 'utf8')).toBe('stale\n');
    await writeFile(output, generated);
    await chmod(output, 0o644);
    result = await f.bun(entry, ['--check']);
    expect(result.code).toBe(1);
    expect((await stat(output)).mode & 0o777).toBe(0o644);
    expect(await readFile(output)).toEqual(generated);
  }),
);

for (const failure of ['missing import', 'syntax error']) {
  test(
    `build fails before delivery for a ${failure}`,
    withFixture(async (f) => {
      const checkout = join(f.dir, 'checkout');
      await cp(join(root, 'scripts'), join(checkout, 'scripts'), { recursive: true });
      await cp(join(root, 'board'), join(checkout, 'board'), { recursive: true });
      if (failure === 'missing import') await rm(join(checkout, 'scripts/lib/host.ts'));
      else await writeFile(join(checkout, 'scripts/launcher.ts'), 'export const = ;\n');
      const outdir = join(f.dir, 'out');
      const result = await f.bun(join(checkout, 'scripts/build.ts'), ['--outdir', outdir]);
      expect(result.code).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
      expect(await Bun.file(join(outdir, 'scripts/celetis')).exists()).toBe(false);
    }),
  );
}

test(
  'generation rejects a Bun version other than the exact pin',
  withFixture(async (f) => {
    const result = await f.bun('--define', ['Bun.version:"1.4.3"', build, '--outdir', join(f.dir, 'out')]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Bun 1.4.2');
    expect(await Bun.file(join(f.dir, 'out/scripts/celetis')).exists()).toBe(false);
  }),
);
