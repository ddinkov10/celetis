import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { HostError } from '../engine/lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from '../engine/lib/operation.ts';
import { codexHome } from '../engine/lib/plugin-metadata.ts';

const pin = '1.4.2';
const root = dirname(import.meta.dir);
const nativeTargets = [{ entry: 'engine/hooks/entry.ts', output: 'engine/hooks/entry.js', mode: 0o644 }];
const browserTargets = ['board', 'view', 'ui', 'panel', 'palette'].map((name) => ({
  entry: `engine/board/${name}.ts`,
  output: `engine/board/${name === 'board' ? 'board.js' : `${name}.mjs`}`,
  mode: 0o644,
}));

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    return await execute(args, explicit);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

async function execute(args: string[], explicit: string | undefined): Promise<number> {
  if (Bun.version !== pin) {
    console.error(`build: need Bun ${pin}, found ${Bun.version}`);
    return 1;
  }
  const check = args.length === 1 && args[0] === '--check';
  if (!check && args.length !== 0) {
    console.error('usage: scripts/build.ts [--check]');
    return 2;
  }
  const operation = createOperation(
    await locateCheckouts(process.cwd()),
    { explicit, environment: process.env.CELETIS_AGENT },
    'host',
  );
  if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
  process.chdir(root);
  let code = 0;
  const built: { output: string; mode: number; bytes: Buffer }[] = [];
  for (const target of [...browserTargets, ...nativeTargets]) {
    const browser = target.entry.startsWith('engine/board/');
    const result = await Bun.build({
      entrypoints: [join(root, target.entry)],
      root,
      target: 'browser',
      format: 'esm',
      naming: target.output,
      minify: false,
      sourcemap: 'none',
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
      if (
        !actual?.equals(bytes) ||
        !mode?.isFile() ||
        (process.platform !== 'win32' && (mode.mode & 0o777) !== target.mode)
      ) {
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
