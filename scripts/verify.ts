import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { HostError } from '../engine/lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from '../engine/lib/operation.ts';
import { type Job, printJobs, runJobs } from '../engine/lib/parallel.ts';
import { codexHome } from '../engine/lib/plugin-metadata.ts';
import { bunArgs, childEnv, run } from '../engine/lib/process.ts';
import { findTools, toolPins } from './install-tools.ts';

const root = dirname(import.meta.dir);
export const generatedFiles = [
  'engine/board/board.js',
  'engine/board/view.mjs',
  'engine/board/ui.mjs',
  'engine/board/panel.mjs',
  'engine/board/palette.mjs',
  'engine/hooks/entry.js',
  'celetis',
];
export const fileRoles: Record<string, string> = {
  'engine/lib/vendor/yaml.mjs': 'unchanged vendored parser; checked by its SHA-256 and config type declarations',
  'engine/lib/vendor/yaml.d.mts': 'vendored parser API; checked by strict runtime types',
  'engine/lib/vendor/yaml.LICENSE': 'upstream licence; stays unchanged',
  '.gitignore': 'Git reads this text',
  '.gitattributes': 'Git reads this text',
  '.editorconfig': 'Biome reads these editor settings',
  'engine/board/fonts/OFL.txt': 'upstream font licence; stays unchanged',
  'engine/board/fonts/geist.woff2': 'binary font delivery asset',
  'engine/board/fonts/geist-mono.woff2': 'binary font delivery asset',
  'engine/board/index.html': 'HTML remains exempt until stable Biome HTML checking, per issue 83',
  '.codex/rules/celetis.rules': 'native host permission rules; Codex reads them',
};

export function classify(path: string, source: Buffer): string {
  if (
    /\.(?:sh|pl|jq)$/.test(path) ||
    /^#![^\n]*\b(?:bash|sh|dash|zsh|perl|jq|node)\b/.test(source.toString('utf8', 0, 512))
  )
    throw new Error(`verify: prohibited program: ${path}`);
  if (/[._](?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/.test(path))
    throw new Error(`verify: test file: ${path}: this repository keeps no tests (AGENTS.md, "Verify gate")`);
  if (generatedFiles.includes(path)) return 'generated';
  if (fileRoles[path]) return /\.json$/.test(path) ? 'biome' : 'role';
  if (/\.ts$/.test(path)) return 'typescript';
  if (/\.(?:json|jsonc|css)$/.test(path)) return 'biome';
  if (/^\.github\/workflows\/[^/]+\.yml$/.test(path)) return 'workflow';
  if (path === '.celetis.yaml') return 'config';
  if (/\.md$/.test(path)) return 'text';
  if (/^skills\/[^/]+\/agents\/openai\.yaml$/.test(path)) return 'text';
  throw new Error(`verify: no check for ${path}: add a row or an exemption in scripts/verify.ts`);
}

const pluginCitation = /<plugin>\/([A-Za-z0-9._/-]+)(?![A-Za-z0-9._/<>*{-])/g;
const relativeLink = /\]\(([^)\s]+)\)/g;

export function checkCitations(files: ReadonlyMap<string, string>): string[] {
  const checked = [...files].filter(
    ([path]) =>
      /^skills\/.+\.md$/.test(path) || /^docs\/procedures\/[^/]+\.md$/.test(path) || path === 'step-prompt.md',
  );
  const errors: string[] = [];
  const cited = new Map<string, Set<string>>();
  for (const [file, text] of checked) {
    const targets = new Set<string>();
    for (const [, path = ''] of text.matchAll(pluginCitation)) {
      const target = path.replace(/\.$/, '');
      targets.add(target);
      if (!files.has(target)) errors.push(`verify: citation: ${file}: <plugin>/${target} is not a tracked file`);
    }
    for (const [, link = ''] of text.matchAll(relativeLink)) {
      if (link.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(link) || /[<{*]/.test(link)) continue;
      const [target = ''] = link.split('#');
      const resolved = posix.join(posix.dirname(file), target);
      targets.add(resolved);
      if (!files.has(resolved)) errors.push(`verify: citation: ${file}: ${target} is not a tracked file`);
    }
    cited.set(file, targets);
  }
  for (const [file, text] of files)
    if (/^(?:skills|docs\/procedures)\//.test(file) && text.includes('docs/hosts/'))
      errors.push(`verify: host reference: ${file} cites docs/hosts/`);
  for (const [module] of checked) {
    if (!/^docs\/procedures\/[^/]+\.md$/.test(module)) continue;
    const citers = checked.filter(([file]) => file !== module && cited.get(file)?.has(module)).length;
    if (citers < 2) errors.push(`verify: module: ${module} is cited by ${citers} files; need 2`);
  }
  const entryLine = /^## The entry line\n\n([^\n]+)/m.exec(files.get('docs/procedures/entry.md') ?? '')?.[1];
  for (const [file, text] of checked) {
    if (!/^skills\/[^/]+\/SKILL\.md$/.test(file)) continue;
    const count = entryLine ? text.split(entryLine).length - 1 : 0;
    if (count !== 1) errors.push(`verify: entry line: ${file}: need the entry line of docs/procedures/entry.md once`);
  }
  return errors;
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
  if (args.length) {
    console.error('usage: scripts/verify.ts');
    return 2;
  }
  const operation = createOperation(
    await locateCheckouts(process.cwd()),
    { explicit, environment: process.env.CELETIS_AGENT },
    'host',
  );
  if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
  process.chdir(root);
  process.env.PATH = childEnv().PATH;
  try {
    for (const name of ['git', 'claude'])
      if (!Bun.which(name)) throw new Error(`verify: ${name} is missing (README.md, "Requirements")`);
    const tools = await findTools();
    const claude = await realpath(Bun.which('claude') as string);
    const actionVersion = await run(tools.actionlint.file, ['--version']);
    tools.actionlint.version = /\d+\.\d+\.\d+/.exec(actionVersion.stdout + actionVersion.stderr)?.[0] ?? '';
    const versions: Record<string, string> = {
      actionlint: tools.actionlint.version,
      biome: tools.biome.version,
      tsc: tools.tsc.version,
      '@types/bun': tools.bunTypesVersion,
    };
    for (const pin of await toolPins()) {
      const version = versions[pin.name] ?? '';
      console.log(`== ${pin.name} ${version}`);
      if (version !== pin.version)
        console.log(`verify: warning: ${pin.name} ${version} is not the pin ${pin.version} (scripts/install-tools.ts)`);
    }
    const listed = await run('git', ['ls-files', '-z']);
    if (listed.code) throw new Error(listed.stderr);
    const files = listed.stdout.split('\0').filter(Boolean);
    const biome: string[] = [];
    const workflows: string[] = [];
    const texts = new Map<string, string>();
    let unknown = false;
    for (const path of files) {
      try {
        const source = await readFile(path);
        texts.set(path, source.toString('utf8'));
        const role = classify(path, source);
        if (['biome', 'typescript'].includes(role)) biome.push(path);
        if (role === 'workflow') workflows.push(path);
      } catch (error) {
        console.error((error as Error).message);
        unknown = true;
      }
    }
    const citations = checkCitations(texts);
    for (const line of citations) console.error(line);
    if (unknown || citations.length) return 1;
    const vendor = await readFile('engine/lib/vendor/yaml.mjs');
    if (
      new Bun.CryptoHasher('sha256').update(vendor).digest('hex') !==
      '4ff31df191fa26a9cf07ef43fd233964e554426bd0dd314009bd9e1a377f0bd7'
    )
      throw new Error('verify: the vendored parser differs from its recorded source');
    const job = (label: string, file: string, args: string[]): Job => ({ label, file, args, cwd: root });
    const jobs: Job[] = [
      job('biome', tools.biome.file, [
        ...tools.biome.args,
        'check',
        '--error-on-warnings',
        '--max-diagnostics=none',
        ...biome,
      ]),
      job('actionlint', tools.actionlint.file, ['-shellcheck=', ...workflows]),
      job('config', process.execPath, bunArgs(join(root, 'engine/lib/config.ts'), [root])),
      job('tsc runtime', tools.tsc.file, [
        ...tools.tsc.args,
        '-p',
        'tsconfig.runtime.json',
        '--typeRoots',
        tools.typeRoots,
      ]),
      job('tsc browser', tools.tsc.file, [
        ...tools.tsc.args,
        '-p',
        'engine/board/tsconfig.json',
        '--typeRoots',
        tools.typeRoots,
      ]),
      job('tsc native', tools.tsc.file, [...tools.tsc.args, '-p', 'tsconfig.native.json']),
      job('build', process.execPath, bunArgs(join(root, 'scripts/build.ts'), ['--check'])),
      /\.(?:c?js|mjs)$/.test(claude)
        ? job('plugin', process.execPath, bunArgs(claude, ['plugin', 'validate', '.']))
        : job('plugin', claude, ['plugin', 'validate', '.']),
    ];
    console.log('== tsc');
    const results = await runJobs(jobs);
    for (const result of results) {
      if (result.label === 'config' && result.code) result.code = 1;
      console.log(`== ${result.label === 'biome' ? 'biome check' : result.label}`);
      if (result.label === 'biome' && /Found .* info/.test(result.output)) result.code = 1;
      if (result.label === 'biome' && result.code)
        result.output += 'verify: fix each file that Biome names above with biome check --write <file>\n';
      if (result.label.startsWith('tsc ')) result.label = 'tsc';
    }
    const code = printJobs(results);
    console.log(`verify: ${code ? 'FAIL' : 'PASS'}`);
    return code;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
