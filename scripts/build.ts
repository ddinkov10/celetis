import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const pin = '1.4.2';
const root = dirname(import.meta.dir);
const targets = [{ entry: 'scripts/launcher.ts', output: 'scripts/celetis', mode: 0o755 }];
const shebang =
  '#!/usr/bin/env -S BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros';

export async function main(args: string[]): Promise<number> {
  if (Bun.version !== pin) {
    console.error(`build: need Bun ${pin}, found ${Bun.version}`);
    return 1;
  }
  const check = args.length === 1 && args[0] === '--check';
  if (!check && args.length !== 0 && !(args.length === 2 && args[0] === '--outdir' && args[1])) {
    console.error('usage: scripts/build.ts [--outdir DIR | --check]');
    return 2;
  }
  const outdir = args[0] === '--outdir' ? resolve(args[1] ?? '') : root;
  process.chdir(root);
  let code = 0;
  for (const target of targets) {
    const result = await Bun.build({
      entrypoints: [join(root, target.entry)],
      root,
      target: 'bun',
      format: 'esm',
      naming: target.output,
      minify: false,
      sourcemap: 'none',
      banner: shebang,
    });
    const artifact = result.outputs[0];
    if (!result.success || result.outputs.length !== 1 || !artifact) {
      for (const log of result.logs) console.error(String(log));
      return 1;
    }
    const bytes = Buffer.from(await artifact.arrayBuffer());
    const output = join(check ? root : outdir, target.output);
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
