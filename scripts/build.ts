import { chmod, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { bunFloor } from '../engine/lib/config-core.ts';
import { commands, type Entry, exitClasses, exits, formText, helpText, issueActs } from '../engine/lib/contract.ts';
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
const marks = (name: string) => ({
  begin: `<!-- scripts/build.ts writes the ${name} from engine/lib/contract.ts. Edit that file, then run scripts/build.ts. -->`,
  end: `<!-- The end of the ${name} that scripts/build.ts writes. -->`,
});
const helpMarks = {
  begin:
    '<!-- scripts/build.ts writes this block from engine/lib/contract.ts. Edit that file, then run scripts/build.ts. -->',
  end: '<!-- The end of the block that scripts/build.ts writes. -->',
};
const unlisted = new Set(['launcher.ts', 'usage-hook.ts']);

const cell = (text: string) => text.replaceAll('|', '\\|');
const codeOf = (name: string) => exitClasses.find((row) => row.name === name)?.code;
const commandRow = (entry: Entry) => {
  const forms = entry.forms.map((each) => cell(formText(each))).join(' \\| ');
  const sources = new Set(entry.forms.flatMap(({ passThrough }) => (passThrough ? [passThrough] : [])));
  const status = [...entry.exits.map((name) => `${codeOf(name)} ${name}`), ...[...sources].map((each) => `or ${each}`)];
  const head = entry.agent ? 'celetis --agent <host> ' : 'celetis ';
  return [`\`${head}${forms}\``, `${cell(entry.description.replace(/\.$/, ''))}. Exit status: ${status.join(', ')}`];
};
const table = (header: string[], rows: string[][]) => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
];
const readmeBlocks = [
  { ...helpMarks, body: ['```text', ...helpText.split('\n'), '```'] },
  {
    ...marks('command table'),
    body: table(['Command', 'What it does'], commands.filter(({ internal }) => !internal).map(commandRow)),
  },
  {
    ...marks('exit-class table'),
    body: table(
      ['Code', 'Class', 'Meaning'],
      exitClasses.map(({ code, name, meaning }) => [String(code), name, cell(meaning)]),
    ),
  },
];
const trackerBlocks = [
  {
    ...marks('act table'),
    body: table(
      ['Act', 'Prerequisite', 'Writes'],
      Object.values(issueActs).map((act) => [`\`${cell(formText(act))}\``, cell(act.prerequisite), cell(act.writes)]),
    ),
  },
];

function spliceBlocks(text: string, file: string, blocks: { begin: string; end: string; body: string[] }[]): string {
  const lines = text.split('\n');
  for (const { begin, end, body } of blocks) {
    const start = lines.indexOf(begin);
    const stop = lines.indexOf(end);
    if (start < 0 || start !== lines.lastIndexOf(begin) || stop !== lines.lastIndexOf(end) || stop < start)
      throw new HostError(`build: ${file} needs one line ${begin} and, after it, one line ${end}`, exits.internal);
    lines.splice(start + 1, stop - start - 1, ...body);
  }
  return lines.join('\n');
}

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
  const declared = new Set(commands.map((each) => each.command));
  for (const command of declared) {
    if (!(await stat(join(root, 'engine', `${command}.ts`)).catch(() => null))?.isFile()) {
      console.error(`build: the contract declares celetis ${command}, and engine/${command}.ts does not exist`);
      return 1;
    }
  }
  for (const file of await readdir(join(root, 'engine'))) {
    if (file.endsWith('.ts') && !unlisted.has(file) && !declared.has(file.slice(0, -3) as Entry['command'])) {
      console.error(`build: engine/${file} is no command that the contract declares`);
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
  for (const [output, blocks] of [
    ['README.md', readmeBlocks],
    ['docs/issue-tracker.md', trackerBlocks],
  ] as const) {
    const text = spliceBlocks(await readFile(join(root, output), 'utf8'), output, [...blocks]);
    built.push({ output, mode: 0o644, bytes: Buffer.from(text) });
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
