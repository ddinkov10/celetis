import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { commandName } from '../engine/launcher.ts';
import { bunFloor } from '../engine/lib/config-core.ts';
import { helpCommands, helpText } from '../engine/lib/help.ts';
import { HostError } from '../engine/lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from '../engine/lib/operation.ts';
import { codexHome } from '../engine/lib/plugin-metadata.ts';
import { programEntry } from '../engine/lib/process.ts';

const root = dirname(import.meta.dir);
const nativeTargets = [{ entry: 'engine/hooks/entry.ts', output: 'engine/hooks/entry.js', mode: 0o644 }];
const browserTargets = ['board', 'view', 'ui', 'panel', 'palette', 'queue', 'update-dialog', 'agent-picker'].map(
  (name) => ({
    entry: `engine/board/${name}.ts`,
    output: `engine/board/${name === 'board' ? 'board.js' : `${name}.mjs`}`,
    mode: 0o644,
  }),
);
const helpBegin =
  '<!-- scripts/build.ts writes this block from engine/lib/help.ts. Edit that file, then run scripts/build.ts. -->';
const helpEnd = '<!-- The end of the block that scripts/build.ts writes. -->';

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
  if (Bun.version !== bunFloor) {
    console.error(`build: need Bun ${bunFloor}, found ${Bun.version}`);
    return 1;
  }
  const check = args.length === 1 && args[0] === '--check';
  if (!check && args.length !== 0) {
    console.error('usage: scripts/build.ts [--check]');
    return 2;
  }
  const operation = await createOperation(
    await locateCheckouts(process.cwd()),
    { explicit: explicit ?? process.env.CELETIS_AGENT ?? 'claude' },
    'host',
  );
  if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
  process.chdir(root);
  for (const [form] of helpCommands) {
    const [program, name = ''] = form.split(' ');
    if (program === 'celetis' && (name === 'help' || name === '--version')) continue;
    if (program !== 'celetis' || !commandName.test(name)) {
      console.error(`build: the help lists ${form}, and the launcher takes no such command`);
      return 1;
    }
    if (!(await stat(join(root, 'engine', `${name}.ts`)).catch(() => null))?.isFile()) {
      console.error(`build: the help lists celetis ${name}, and engine/${name}.ts does not exist`);
      return 1;
    }
  }
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
                build.onResolve(
                  { filter: /^\.\/(view|ui|panel|palette|queue|update-dialog|agent-picker)\.ts$/ },
                  ({ path }) => ({
                    path: path.replace(/\.ts$/, '.mjs'),
                    external: true,
                  }),
                );
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
  built.push({ output: 'celetis', mode: 0o755, bytes: Buffer.from(programEntry) });
  const readme = (await readFile(join(root, 'README.md'), 'utf8')).split('\n');
  const begin = readme.indexOf(helpBegin);
  const end = readme.indexOf(helpEnd);
  if (begin < 0 || begin !== readme.lastIndexOf(helpBegin) || end !== readme.lastIndexOf(helpEnd) || end < begin)
    throw new HostError(`build: README.md needs one line ${helpBegin} and, after it, one line ${helpEnd}`, 1);
  readme.splice(begin + 1, end - begin - 1, '```text', ...helpText.split('\n'), '```');
  built.push({ output: 'README.md', mode: 0o644, bytes: Buffer.from(readme.join('\n')) });
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
