import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { bunShebang } from './lib/process.ts';

const pin = '1.4.2';
const root = dirname(import.meta.dir);
const targets = [{ entry: 'scripts/launcher.ts', output: 'scripts/celetis', mode: 0o755 }];
const nativeTargets = [{ entry: 'hooks/entry.ts', output: 'hooks/entry.js', mode: 0o644 }];
const browserTargets = ['board', 'view', 'ui', 'panel', 'palette'].map((name) => ({
  entry: `board/${name}.ts`,
  output: `board/${name === 'board' ? 'board.js' : `${name}.mjs`}`,
  mode: 0o644,
}));

export async function main(args: string[]): Promise<number> {
  if (Bun.version !== pin) {
    console.error(`build: need Bun ${pin}, found ${Bun.version}`);
    return 1;
  }
  const check = args.length === 1 && args[0] === '--check';
  if (!check && args.length !== 0) {
    console.error('usage: scripts/build.ts [--check]');
    return 2;
  }
  process.chdir(root);
  let code = 0;
  const built: { output: string; mode: number; bytes: Buffer }[] = [];
  for (const target of [...targets, ...browserTargets, ...nativeTargets]) {
    const browser = target.entry.startsWith('board/');
    const result = await Bun.build({
      entrypoints: [join(root, target.entry)],
      root,
      target: target.entry.startsWith('scripts/') ? 'bun' : 'browser',
      format: 'esm',
      naming: target.output,
      minify: false,
      sourcemap: 'none',
      banner: target.entry.startsWith('scripts/') ? bunShebang : undefined,
      plugins: browser
        ? [
            {
              name: 'browser-urls',
              setup(build) {
                build.onResolve({ filter: /^\.\/(view|ui|panel|palette)\.ts$/ }, ({ path }) => ({
                  path: path.replace(/\.ts$/, '.mjs'),
                  external: true,
                }));
              },
            },
          ]
        : [],
    });
    const artifact = result.outputs[0];
    if (!result.success || result.outputs.length !== 1 || !artifact) {
      for (const log of result.logs) console.error(String(log));
      return 1;
    }
    const bytes = Buffer.from(await artifact.arrayBuffer());
    built.push({ output: target.output, mode: target.mode, bytes });
  }
  for (const target of built) {
    const bytes = target.bytes;
    const output = join(root, target.output);
    if (check) {
      const actual = await readFile(output).catch(() => null);
      const mode = await stat(output).catch(() => null);
      if (!actual?.equals(bytes) || !mode?.isFile() || (mode.mode & 0o777) !== target.mode) {
        console.error(`build: stale or missing ${target.output} (bytes or executable mode)`);
        code = 1;
      }
    } else {
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bytes);
      await chmod(output, target.mode);
    }
  }
  return code;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
