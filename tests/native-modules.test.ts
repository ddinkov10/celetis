import { expect, test } from 'bun:test';
import { cp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findTools } from '../scripts/install-tools.ts';
import { command, root, withFixture } from './lib/fixture.ts';

for (const target of [
  { source: 'hooks/entry.ts', generated: 'hooks/entry.js', manifest: 'hooks/hooks.json', module: './entry.js' },
  {
    source: 'tests/manual/native-observer/hooks/register.ts',
    generated: 'tests/manual/native-observer/hooks/register.js',
    manifest: 'tests/manual/native-observer/hooks/hooks.json',
    module: './register.js',
  },
])
  test(`source and generated module identities are distinct: ${target.generated}`, async () => {
    const sourceText = await readFile(join(root, target.source), 'utf8');
    const generatedText = await readFile(join(root, target.generated), 'utf8');
    expect(sourceText).not.toMatch(/(?:from|import\s*\()\s*['"](?:bun:|node:)/);
    expect(generatedText).not.toMatch(/(?:from|import\s*\()\s*['"](?:bun:|node:)/);
    const source = await import(join(root, target.source));
    const generated = await import(join(root, target.generated));
    expect(typeof source.register).toBe('function');
    expect(typeof generated.register).toBe('function');
    expect(source.register).not.toBe(generated.register);
    expect(JSON.parse(await readFile(join(root, target.manifest), 'utf8'))).toEqual({ modules: [target.module] });
  });

test(
  'native type environment rejects Bun globals',
  withFixture(async (f) => {
    await cp(join(root, 'tsconfig.native.json'), join(f.dir, 'tsconfig.native.json'));
    await f.write('hooks/probe.ts', 'export const invalid = Bun.file("native-host");\n');
    const path = join(f.dir, 'no-node-bin');
    await mkdir(path);
    for (const name of ['tsc', 'biome', 'actionlint']) {
      const executable = Bun.which(name);
      expect(executable).not.toBeNull();
      await symlink(executable as string, join(path, name));
    }
    expect(Bun.which('node', { PATH: path })).toBeNull();
    const tools = await findTools(path);
    const result = await command(tools.tsc.file, [...tools.tsc.args, '-p', join(f.dir, 'tsconfig.native.json')], {
      env: { ...f.env, PATH: path },
    });
    expect(result.code).not.toBe(0);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout + result.stderr).toContain('hooks/probe.ts');
    expect(result.stdout + result.stderr).toContain("Cannot find name 'Bun'");
  }),
);

test(
  'native compile failure writes no earlier delivery target',
  withFixture(async (f) => {
    const checkout = join(f.dir, 'checkout');
    for (const name of ['scripts', 'board', 'hooks', 'tests/manual/native-observer'])
      await cp(join(root, name), join(checkout, name), { recursive: true });
    await writeFile(join(checkout, 'tests/manual/native-observer/hooks/register.ts'), 'export const = ;\n');
    const output = join(f.dir, 'output');
    const result = await f.bun(join(checkout, 'scripts/build.ts'), ['--outdir', output]);
    expect(result.code).toBe(1);
    expect(await Bun.file(join(output, 'scripts/celetis')).exists()).toBe(false);
    expect(await Bun.file(join(output, 'board/board.js')).exists()).toBe(false);
    expect(await Bun.file(join(output, 'hooks/entry.js')).exists()).toBe(false);
  }),
);
