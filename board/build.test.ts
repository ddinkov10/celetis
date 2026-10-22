import { expect, test } from 'bun:test';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { command, isolatedArgs, root, withFixture } from '../tests/lib/fixture.ts';

test(
  'the pinned build emits the browser module graph with its public URLs and identical assets',
  withFixture(async (f) => {
    const before = await readFile(join(root, 'scripts/celetis'));
    const outdir = join(f.dir, 'build');
    const result = await command(process.execPath, [
      ...isolatedArgs,
      join(root, 'scripts/build.ts'),
      '--outdir',
      outdir,
    ]);
    expect(result).toEqual({ code: 0, stdout: '', stderr: '' });
    for (const file of ['board.js', 'view.mjs', 'ui.mjs', 'panel.mjs', 'palette.mjs']) {
      const built = await readFile(join(outdir, 'board', file), 'utf8');
      expect(Buffer.from(built)).toEqual(await readFile(join(root, 'board', file)));
      expect((await stat(join(root, 'board', file))).mode & 0o777).toBe(0o644);
      expect(built).not.toMatch(/from ['"][^'"]+\.ts['"]/);
      expect(built).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
      for (const match of built.matchAll(/(?:from|import)\s*['"](\.\/[^'"]+)['"]/g)) {
        expect(await Bun.file(join(outdir, 'board', match[1] as any)).exists()).toBe(true);
      }
    }
    const importEntry = join(outdir, 'import-check.ts');
    await mkdir(dirname(importEntry), { recursive: true });
    await Bun.write(
      importEntry,
      `const view=await import('./board/view.mjs');if(view.pageTitle('repo',2)!=='(2) repo · Agent board')process.exit(1);
    for(const [file,name] of [['ui','actionButton'],['panel','drawPanel'],['palette','openPalette']]){
      const module=await import('./board/'+file+'.mjs');if(typeof module[name]!=='function')process.exit(2);
    }`,
    );
    expect(await command(process.execPath, [...isolatedArgs, importEntry])).toEqual({
      code: 0,
      stdout: '',
      stderr: '',
    });
    expect(await readFile(join(root, 'scripts/celetis'))).toEqual(before);
  }),
  29_000,
);

for (const failure of ['missing source', 'syntax error']) {
  test(
    `a browser build failure (${failure}) delivers no partial output`,
    withFixture(async (f) => {
      const checkout = join(f.dir, 'checkout');
      for (const folder of ['scripts', 'board'])
        await cp(join(root, folder), join(checkout, folder), { recursive: true });
      if (failure === 'missing source') await rm(join(checkout, 'board/panel.ts'));
      else await writeFile(join(checkout, 'board/board.ts'), 'export const = ;\n');
      const outdir = join(f.dir, 'out');
      const result = await command(process.execPath, [
        ...isolatedArgs,
        join(checkout, 'scripts/build.ts'),
        '--outdir',
        outdir,
      ]);
      expect(result.code).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
      for (const file of [
        'scripts/celetis',
        'board/board.js',
        'board/view.mjs',
        'board/ui.mjs',
        'board/panel.mjs',
        'board/palette.mjs',
      ]) {
        expect(await Bun.file(join(outdir, file)).exists(), file).toBe(false);
      }
    }),
    29_000,
  );
}
