import { realpathSync } from 'node:fs';
import { chmod, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { HostError } from '../engine/lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts } from '../engine/lib/command/operation.ts';
import { bunFloor } from '../engine/lib/config/core.ts';
import {
  commands,
  type Entry,
  exitClasses,
  exits,
  formText,
  helpText,
  issueActs,
} from '../engine/lib/contract/contract.ts';
import { entryParts } from '../engine/lib/contract/entry-text.ts';
import { hostAdapter } from '../engine/lib/host/hosts.ts';
import { bootstrapEntry, bunArgs, engineEntry } from '../engine/lib/process/process.ts';

const root = dirname(import.meta.dir);
const nativeTargets = [
  { entry: 'engine/hooks/entry.ts', output: 'plugins/celetis/hooks/entry.js', mode: 0o644, format: 'esm' },
] as const;
const pageTracker: ReadonlySet<string> = new Set(['engine/lib/tracker/key.ts', 'engine/lib/tracker/grammar.ts']);
const browserTargets = [
  { entry: 'engine/board/page/theme/theme.ts', output: 'engine/board/theme.js', mode: 0o644, format: 'iife' },
] as const;
const pageEntry = 'engine/board/page/main.tsx';
const pageStyles = 'engine/board/page/app.css';
const tailwindCli = 'engine/node_modules/@tailwindcss/cli/dist/index.mjs';
const tailwindNode = 'engine/node_modules/@tailwindcss/node/dist/index.mjs';
const marks = (name: string) => ({
  begin: `<!-- scripts/build.ts writes the ${name} from engine/lib/contract/contract.ts. Edit that file, then run scripts/build.ts. -->`,
  end: `<!-- The end of the ${name} that scripts/build.ts writes. -->`,
});
const helpMarks = {
  begin:
    '<!-- scripts/build.ts writes this block from engine/lib/contract/contract.ts. Edit that file, then run scripts/build.ts. -->',
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

const landedRepeats: ReadonlySet<string> = new Set([
  '0039-the-board-starts-each-step-from-the-copy-of-its-host.md',
  '0039-the-runner-announces-the-claude-session-id-to-herdr.md',
  '0067-component-research-binds-behavior-and-guides-looks.md',
  '0067-local-agent-priority-and-usage-recovery.md',
  '0080-a-look-decision-bypasses-the-page-csp-on-its-own-browser-tab.md',
  '0080-the-daemon-ends-a-claude-host-with-sigterm-after-a-grace.md',
]);
const contextPairs: readonly (readonly [string, string])[] = [
  ['0008', '0005'],
  ['0009', '0004'],
  ['0009', '0005'],
  ['0009', '0007'],
  ['0019', '0015'],
  ['0023', '0001'],
  ['0029', '0001'],
  ['0032', '0029'],
  ['0032', '0030'],
  ['0032', '0031'],
  ['0034', '0028'],
  ['0034', '0030'],
  ['0035', '0003'],
  ['0035', '0004'],
  ['0035', '0007'],
  ['0035', '0012'],
  ['0035', '0014'],
];
const lastLanded = '0080';

type AdrRecord = { name: string; stem: string; number: string; title: string; section: string };

function adrIndex(files: readonly { name: string; text: string }[]): { errors: string[]; text: string } {
  const errors: string[] = [];
  const records: AdrRecord[] = files.map(({ name, text }) => {
    const lines = text.split('\n').map((line) => line.trimEnd());
    const title = lines.find((line) => line.startsWith('# '))?.slice(2);
    if (title === undefined) errors.push(`build: docs/adr/${name} has no title line that starts with "# "`);
    const start = lines.indexOf('## Supersedes');
    const stop = lines.findIndex((line, at) => at > start && line.startsWith('## '));
    const section = start < 0 ? '' : lines.slice(start + 1, stop < 0 ? undefined : stop).join('\n');
    return { name, stem: name.slice(0, -3), number: name.slice(0, 4), title: title ?? '', section };
  });
  const byNumber = Map.groupBy(records, ({ number }) => number);
  for (const [number, group] of byNumber)
    if (group.length > 1 && group.some(({ name }) => !landedRepeats.has(name)))
      errors.push(
        `build: docs/adr/ has ${group.length} records with the number ${number}: ${group.map(({ name }) => name).join(', ')}`,
      );
  const names = new Map<AdrRecord, Set<AdrRecord>>();
  for (const later of records) {
    const { section } = later;
    if (section.trim() === '') continue;
    const reported = errors.length;
    const linked = new Set<AdrRecord>();
    for (const target of new Set(
      Array.from(section.matchAll(/\]\((\d{4}-[^)\s#]*)\.md(?:#[^)\s]*)?\)/g), (match) => match[1]),
    )) {
      const record = records.find(({ stem }) => stem === target);
      if (record) linked.add(record);
      else
        errors.push(
          `build: docs/adr/${later.name}: its Supersedes links ${target}.md, which is no record of docs/adr/`,
        );
    }
    linked.delete(later);
    const linkOnly = later.number > lastLanded;
    const named = new Set(
      records.filter(
        (older) => older !== later && (section.includes(older.stem) || (older.title && section.includes(older.title))),
      ),
    );
    if (linkOnly)
      for (const older of named)
        if (!linked.has(older))
          errors.push(
            `build: docs/adr/${later.name}: a record after ADR-${lastLanded} names ${older.name} in its Supersedes with no Markdown link to it`,
          );
    for (const number of new Set(Array.from(section.matchAll(/ADR-(\d{4})/g), (match) => match[1] ?? ''))) {
      const others = (byNumber.get(number) ?? []).filter((older) => older !== later);
      const [only] = others;
      if (!only)
        errors.push(
          `build: docs/adr/${later.name}: its Supersedes names ADR-${number}, and no other record has that number`,
        );
      else if (linkOnly) {
        if (!others.some((older) => linked.has(older)))
          errors.push(
            `build: docs/adr/${later.name}: a record after ADR-${lastLanded} names ADR-${number} in its Supersedes with no Markdown link to a record of that number`,
          );
      } else if (others.length === 1) named.add(only);
      else if (!others.some((older) => named.has(older)))
        errors.push(
          `build: docs/adr/${later.name}: its Supersedes names ADR-${number}, which ${others.length} records have, and names the file or the title of none of them`,
        );
    }
    const replaced = linkOnly ? linked : named;
    if (replaced.size === 0 && errors.length === reported)
      errors.push(`build: docs/adr/${later.name}: its Supersedes names no record of docs/adr/`);
    names.set(later, replaced);
  }
  for (const [laterNumber, olderNumber] of contextPairs) {
    const [later, ...laterRest] = byNumber.get(laterNumber) ?? [];
    const [older, ...olderRest] = byNumber.get(olderNumber) ?? [];
    if (laterRest.length > 0 || olderRest.length > 0) continue;
    const named = later && names.get(later);
    if (!older || !named?.delete(older))
      errors.push(
        `build: scripts/build.ts lists ADR-${laterNumber} as naming ADR-${olderNumber} only for context, and the Supersedes of ADR-${laterNumber} does not name ADR-${olderNumber}`,
      );
  }
  const link = (record: AdrRecord) => `[${record.number}](${record.name})`;
  const links = (list: AdrRecord[]) => list.map(link).join(', ');
  const rows = records.map((record) => [
    link(record),
    cell(record.title),
    links(records.filter((older) => names.get(record)?.has(older))),
    links(records.filter((later) => names.get(later)?.has(record))),
  ]);
  const repeated = [...byNumber].filter(([, group]) => group.length > 1).map(([number]) => number);
  const listed =
    repeated.length < 3 ? repeated.join(' and ') : `${repeated.slice(0, -1).join(', ')}, and ${repeated.at(-1)}`;
  const text = [
    '# ADR index',
    '',
    '<!-- scripts/build.ts writes this file from the records of docs/adr/. Run scripts/build.ts after a change of a record. -->',
    '',
    'A later record that names an older record in its `## Supersedes` section replaces the parts of',
    'the older record that the section names. Each other part of the older record stays current. A',
    'record with no later record in its row is current in whole.',
    '',
    'Some landed records name an older record in their `## Supersedes` section only for context, for',
    'example to say that it stays. `scripts/build.ts` lists these pairs, and this index leaves them',
    `out. A record after ADR-${lastLanded} names in its \`## Supersedes\` section only the records that it`,
    'replaces in part, each by a Markdown link to its file.',
    '',
    `The numbers ${listed} each have two records. These records landed before the verify`,
    'gate refused a repeated number, and they keep their files.',
    '',
    ...table(['Record', 'Title', 'Replaces parts of', 'Parts replaced by'], rows),
  ];
  return { errors, text: `${text.join('\n')}\n` };
}

const packageName = /^(?:@[^/]+\/)?[^/]+/;

async function lockedPackages(root: string): Promise<ReadonlySet<string>> {
  const lock = Bun.JSONC.parse(await readFile(join(root, 'engine/bun.lock'), 'utf8')) as {
    packages?: Record<string, unknown>;
  };
  return new Set(Object.keys(lock.packages ?? {}));
}

function lockKey(path: string): string | undefined {
  const names = path.split('/node_modules/').map((segment) => packageName.exec(segment)?.[0]);
  return names.every((name) => name !== undefined) ? names.join('/') : undefined;
}

function bundleRefusals(
  root: string,
  output: string,
  inputs: readonly string[],
  locked: ReadonlySet<string>,
): string[] {
  if (inputs.length === 0) return [`build: ${output} has no bundle inputs to check`];
  return inputs.flatMap((input) => {
    const path = relative(root, resolve(root, input)).split(sep).join('/');
    if (path.startsWith('engine/board/') || pageTracker.has(path)) return [];
    const installed = path.startsWith('engine/node_modules/') && lockKey(path.slice('engine/node_modules/'.length));
    if (installed && locked.has(installed)) return [];
    return [
      `build: ${output} bundles ${input}, a file outside engine/board/, the issue key files of the tracker, and the packages of engine/bun.lock`,
    ];
  });
}

type Resolver = (id: string, base: string) => Promise<string | undefined>;
type TailwindNode = {
  compile(
    css: string,
    options: {
      base: string;
      onDependency(path: string): void;
      customCssResolver: Resolver;
      customJsResolver: Resolver;
    },
  ): Promise<{
    sources: { base: string; pattern: string; negated: boolean }[];
    root: 'none' | { base: string; pattern: string } | null;
    build(candidates: string[]): string;
  }>;
};

const unsafePath = (path: string) =>
  /[\\{}]/.test(path) || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(path) || isAbsolute(path);

// The guard runs the compile of @tailwindcss/node that the CLI runs, so it reads each input as Tailwind does.
async function styleRefusals(root: string, locked: ReadonlySet<string>): Promise<string[]> {
  const { compile } = (await import(join(root, tailwindNode))) as TailwindNode;
  const real = (path: string) => {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  };
  const top = real(root);
  const board = real(join(root, 'engine/board'));
  const modules = real(join(root, 'engine/node_modules'));
  const within = (path: string, folder: string) => {
    const inside = relative(folder, path);
    return !inside.startsWith('..') && !isAbsolute(inside);
  };
  const show = (path: string) => relative(top, real(path)).split(sep).join('/') || '.';
  const refusals: string[] = [];
  const refuse = (reason: string): never => {
    refusals.push(`build: ${reason}`);
    throw new Error(reason);
  };
  const customJsResolver: Resolver = async (id, base) =>
    refuse(
      `@plugin or @config "${id}" in ${show(base)}/ loads code; the page stylesheets take no @plugin and no @config`,
    );
  const customCssResolver: Resolver = async (id, base) => {
    const named = `@import or @reference "${id}" in ${show(base)}/`;
    if (unsafePath(id)) refuse(`${named} names an absolute path, a URL, an escape, or a brace pattern`);
    if (id.startsWith('.') && !id.endsWith('.css')) refuse(`${named} names no .css file; write the full file name`);
    if (!id.startsWith('.') && (id.split('/').includes('..') || !locked.has(packageName.exec(id)?.[0] ?? '')))
      refuse(`${named} names a package that engine/bun.lock does not hold`);
    return undefined;
  };
  const onDependency = (file: string) => {
    const path = real(file);
    const key = within(path, modules) ? lockKey(relative(modules, path).split(sep).join('/')) : undefined;
    if (!within(path, board) && !(key && locked.has(key)))
      refuse(`${show(path)} is a stylesheet outside engine/board/ and the packages of engine/bun.lock`);
  };
  const checkSource = ({ base, pattern }: { base: string; pattern: string }) => {
    const segments = pattern.split('/');
    const glob = segments.findIndex((segment) => /[*?[]/.test(segment));
    const prefix = glob === -1 ? segments : segments.slice(0, glob);
    if (unsafePath(pattern) || segments.includes('..') || !within(real(resolve(base, ...prefix)), board))
      refusals.push(
        `build: @source or source() "${pattern}" in ${show(base)}/ names a path that can leave engine/board/, an absolute path, an escape, or a brace pattern`,
      );
  };
  try {
    const compiler = await compile(await readFile(join(root, pageStyles), 'utf8'), {
      base: dirname(join(root, pageStyles)),
      onDependency,
      customCssResolver,
      customJsResolver,
    });
    for (const source of compiler.sources) checkSource(source);
    if (compiler.root !== null && compiler.root !== 'none') checkSource(compiler.root);
    if (/@import\b/.test(compiler.build([])))
      refusals.push(`build: ${pageStyles} keeps an @import that Tailwind does not inline, such as a url() path`);
  } catch (error) {
    if (refusals.length === 0) refusals.push(`build: ${pageStyles}: ${(error as Error).message}`);
  }
  return refusals;
}

export async function pageArtifacts(root: string): Promise<{ js: Buffer; css: Buffer }> {
  const locked = await lockedPackages(root);
  const refusals = await styleRefusals(root, locked);
  if (refusals.length > 0) throw new HostError(refusals.join('\n'), exits.internal);
  const caller = process.cwd();
  // Bun writes the module path comments of the bundle relative to the working folder.
  process.chdir(root);
  const result = await Bun.build({
    entrypoints: [join(root, pageEntry)],
    root,
    target: 'browser',
    format: 'esm',
    minify: false,
    sourcemap: 'none',
    metafile: true,
    jsx: { development: false },
    conditions: ['production'],
    define: { 'process.env.NODE_ENV': '"production"' },
  }).finally(() => process.chdir(caller));
  const artifact = result.outputs[0];
  if (!result.success || result.outputs.length !== 1 || !artifact)
    throw new HostError(result.logs.map(String).join('\n'), exits.internal);
  const outside = bundleRefusals(root, 'engine/board/board.js', Object.keys(result.metafile?.inputs ?? {}), locked);
  if (outside.length > 0) throw new HostError(outside.join('\n'), exits.internal);
  // With no source(), the CLI scans each file under --cwd, so the scan stays in engine/board/.
  const cli = Bun.spawnSync(
    [process.execPath, ...bunArgs(tailwindCli, ['--cwd', 'engine/board', '-i', join(root, pageStyles)])],
    {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  if (cli.exitCode !== 0) throw new HostError(`build: ${tailwindCli} failed:\n${cli.stderr}`, exits.internal);
  return { js: Buffer.from(await artifact.arrayBuffer()), css: Buffer.from(cli.stdout) };
}

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
  try {
    entryParts(await readFile(join(root, 'plugins/celetis/references/procedures/entry.md'), 'utf8'));
  } catch (error) {
    console.error(`build: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const operation = await createOperation(
    await locateCheckouts(process.cwd()),
    { explicit: explicit ?? process.env.CELETIS_AGENT ?? 'claude' },
    'host',
  );
  await hostAdapter(operation.host).checkHome();
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
  const adrFolder = join(root, 'docs/adr');
  const adrNames = (await readdir(adrFolder)).filter((name) => /^\d{4}-.+\.md$/.test(name)).sort();
  const adr = adrIndex(
    await Promise.all(adrNames.map(async (name) => ({ name, text: await readFile(join(adrFolder, name), 'utf8') }))),
  );
  for (const error of adr.errors) console.error(error);
  if (adr.errors.length > 0) return 1;
  let code = 0;
  const page = await pageArtifacts(root);
  const built: { output: string; mode: number; bytes: Buffer }[] = [
    { output: 'engine/board/board.js', mode: 0o644, bytes: page.js },
    { output: 'engine/board/app.css', mode: 0o644, bytes: page.css },
  ];
  const locked = await lockedPackages(root);
  for (const target of [...browserTargets, ...nativeTargets]) {
    const browser = target.entry.startsWith('engine/board/');
    const result = await Bun.build({
      entrypoints: [join(root, target.entry)],
      root,
      target: 'browser',
      format: target.format,
      naming: target.output,
      minify: false,
      sourcemap: 'none',
      metafile: browser,
    });
    const artifact = result.outputs[0];
    if (!result.success || result.outputs.length !== 1 || !artifact) {
      for (const log of result.logs) console.error(String(log));
      return 1;
    }
    if (browser) {
      const refusals = bundleRefusals(root, target.output, Object.keys(result.metafile?.inputs ?? {}), locked);
      for (const refusal of refusals) console.error(refusal);
      if (refusals.length > 0) return 1;
    }
    const bytes = Buffer.from(await artifact.arrayBuffer());
    built.push({ output: target.output, mode: target.mode, bytes });
  }
  built.push({ output: 'engine/celetis', mode: 0o755, bytes: Buffer.from(engineEntry) });
  built.push({ output: 'engine/bootstrap', mode: 0o755, bytes: Buffer.from(bootstrapEntry) });
  for (const [output, blocks] of [
    ['plugins/celetis/README.md', readmeBlocks],
    ['plugins/celetis/docs/issue-tracker.md', trackerBlocks],
  ] as const) {
    const text = spliceBlocks(await readFile(join(root, output), 'utf8'), output, [...blocks]);
    built.push({ output, mode: 0o644, bytes: Buffer.from(text) });
  }
  built.push({ output: 'docs/adr/index.md', mode: 0o644, bytes: Buffer.from(adr.text) });
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
