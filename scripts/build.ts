import { chmod, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { bunFloor } from '../engine/lib/config-core.ts';
import { commands, type Entry, exitClasses, exits, formText, helpText, issueActs } from '../engine/lib/contract.ts';
import { entryParts } from '../engine/lib/entry-text.ts';
import { HostError } from '../engine/lib/errors.ts';
import { hostAdapter } from '../engine/lib/hosts.ts';
import { commandInput, createOperation, locateCheckouts } from '../engine/lib/operation.ts';
import { engineEntry } from '../engine/lib/process.ts';

const root = dirname(import.meta.dir);
const nativeTargets = [{ entry: 'engine/hooks/entry.ts', output: 'plugins/celetis/hooks/entry.js', mode: 0o644 }];
const browserTargets = [{ entry: 'engine/board/page/board.ts', output: 'engine/board/board.js', mode: 0o644 }];
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
    entryParts(await readFile(join(root, 'plugins/celetis/docs/procedures/entry.md'), 'utf8'));
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
      metafile: browser,
    });
    const artifact = result.outputs[0];
    if (!result.success || result.outputs.length !== 1 || !artifact) {
      for (const log of result.logs) console.error(String(log));
      return 1;
    }
    if (browser) {
      const inputs = Object.keys(result.metafile?.inputs ?? {});
      const outside = inputs.filter((input) => {
        const path = relative(join(root, 'engine/board'), resolve(process.cwd(), input));
        return path.startsWith('..') || isAbsolute(path);
      });
      if (inputs.length === 0) console.error(`build: ${target.output} has no bundle inputs to check`);
      for (const input of outside)
        console.error(`build: ${target.output} bundles ${input}, a file outside engine/board/`);
      if (inputs.length === 0 || outside.length > 0) return 1;
    }
    const bytes = Buffer.from(await artifact.arrayBuffer());
    built.push({ output: target.output, mode: target.mode, bytes });
  }
  built.push({ output: 'engine/celetis', mode: 0o755, bytes: Buffer.from(engineEntry) });
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
