import { constants, type Stats } from 'node:fs';
import { access, lstat, realpath, stat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { HostError } from './host.ts';
import { run } from './process.ts';
import { parseAllDocuments } from './vendor/yaml.mjs';

export const wiring = '.claude/celetis-flow/wiring.json';
export const settings = '.claude/settings.json';
export const configFile = '.celetis.yaml';
export const codexRules = '.codex/rules/celetis.rules';
export const codexRestriction =
  'prefix_rule(\n    pattern = ["gh", "pr", "merge"],\n    decision = "forbidden",\n    justification = "Use celetis --agent codex land from the main checkout.",\n)\n';
export const ignores = [
  '.claude/worktrees/',
  '.claude/settings.local.json',
  'docs/superpowers/',
  '.superpowers/',
  'docs/lessons/_pending/',
];
export const attribute = '.celetis.yaml text eol=lf';
export const claudeInstructions = ['CLAUDE.md', '.claude/CLAUDE.md'];
export const markerRepair = 'repair the Celetis markers; use one standalone START line before one standalone END line';

export type Entry = { path: string[]; item?: string; value?: unknown };
export type RecordOfSetup = { files: string[]; entries: Record<string, unknown[]> };
export type PathProblem = Readonly<{ kind: 'blocked' | 'invalid'; message: string; stderr?: string }>;
type Markers = Readonly<
  { kind: 'none' } | { kind: 'invalid' } | { kind: 'pair'; from: number; to: number; newline: string }
>;

export const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const normal = (text: string) => text.replace(/\r$/, '').replace(/^[ \t]+|[ \t]+$/g, '');
export const lines = (text: string) => (text === '' ? [] : text.replace(/\n$/, '').split('\n'));
export const hasLine = (text: string, line: string) => lines(text).some((item) => normal(item) === line);

export function ambiguousJSON(source: string): boolean {
  return parseAllDocuments(source, { uniqueKeys: true, merge: false }).some((doc) => doc.errors.length > 0);
}

export function recordOfSetup(value: unknown): RecordOfSetup | null {
  if (
    !object(value) ||
    value.schema !== 1 ||
    !Array.isArray(value.files) ||
    !value.files.every((file) => typeof file === 'string') ||
    !object(value.entries) ||
    !Object.values(value.entries).every(Array.isArray)
  )
    return null;
  return { files: value.files, entries: value.entries as Record<string, unknown[]> };
}

export function settingsForm(): Entry[] {
  return [
    ...['Bash(gh pr merge*)', 'PowerShell(gh pr merge*)'].map((item) => ({
      path: ['permissions', 'deny'],
      item,
    })),
    {
      path: ['extraKnownMarketplaces', 'celetis'],
      value: { source: { source: 'github', repo: 'ddinkov10/celetis' }, autoUpdate: false },
    },
    { path: ['enabledPlugins', 'superpowers@superpowers-marketplace'], value: true },
  ];
}

export function claudeImport(path: string): string {
  return `@${relative(dirname(path), 'AGENTS.md').split(sep).join('/')}`;
}

export function markerPair(source: string): Markers {
  const markers = [...source.matchAll(/(?:^|\n)(<!-- CELETIS:(START|END) -->)(?=\r?\n|$)/g)];
  if (!markers.length) return { kind: 'none' };
  const [start, end] = markers;
  if (markers.length !== 2 || !start || !end || start[2] !== 'START' || end[2] !== 'END') return { kind: 'invalid' };
  const afterStart = start.index + start[0].length;
  return {
    kind: 'pair',
    from: start.index + (start[0].startsWith('\n') ? 1 : 0),
    to: end.index + end[0].length,
    newline: source.startsWith('\r\n', afterStart) ? '\r\n' : '\n',
  };
}

export function managedInstructions(path: string, source: string): string {
  const block = `<!-- CELETIS:START -->
## Celetis

Use the installed \`celetis\` skills for changes in this project.
Follow an explicitly requested Celetis skill. For a new request with no
recorded intent or lane, start with \`celetis:intake\`. For an existing issue,
follow its current Celetis step.

Keep project-specific instructions outside this block. Celetis setup
refreshes the text between these markers.
<!-- CELETIS:END -->`;
  const pair = markerPair(source);
  if (pair.kind === 'none') {
    if (!source) return `${block}\n`;
    const newline = source.match(/\r?\n/)?.[0] ?? '\n';
    let separator = source.endsWith('\n') ? '' : newline;
    if (!/(?:^|\n)[ \t]*\r?\n$/.test(source + separator)) separator += newline;
    return source + separator + block.replaceAll('\n', newline) + newline;
  }
  if (pair.kind === 'invalid') throw new HostError(`setup: ${path}: ${markerRepair}`);
  return source.slice(0, pair.from) + block.replaceAll('\n', pair.newline) + source.slice(pair.to);
}

export async function destinationProblem(checkout: string, path: string): Promise<PathProblem | null> {
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    const component = parts.slice(0, i + 1).join('/');
    let info: Awaited<ReturnType<typeof lstat>>;
    try {
      info = await lstat(join(checkout, component));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      return { kind: 'blocked', message: `cannot inspect ${path} at ${component}: ${(error as Error).message}` };
    }
    if (info.isSymbolicLink())
      return { kind: 'invalid', message: `${component} is a symbolic link; setup writes no file through a link` };
    if (i < parts.length - 1 ? !info.isDirectory() : !info.isFile())
      return {
        kind: 'invalid',
        message: `${component} is no ${i < parts.length - 1 ? 'directory' : 'regular file'} for ${path}`,
      };
  }
  return null;
}

export async function trackingProblem(checkout: string, path: string): Promise<PathProblem | null> {
  const result = await run('git', ['check-ignore', '-q', '--', path], { cwd: checkout });
  if (result.code === 0) return { kind: 'invalid', message: `git ignores ${path}; make git track it first` };
  if (result.code !== 1)
    return {
      kind: 'invalid',
      message: `${path} lies beyond a symbolic link or in a submodule; setup writes no file there`,
      stderr: result.stderr,
    };
  return null;
}

async function inspect(checkout: string, path: string, read: (path: string) => Promise<Stats> = lstat) {
  return read(join(checkout, path)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw new HostError(`setup: cannot inspect ${path}: ${error.message}`);
  });
}

async function sameFile(checkout: string, a: string, b: string): Promise<boolean> {
  const [one, two] = await Promise.all([inspect(checkout, a, stat), inspect(checkout, b, stat)]);
  return !!one && !!two && one.dev === two.dev && one.ino === two.ino;
}

export async function instructionFiles(
  checkout: string,
  claude: boolean,
): Promise<Readonly<{ destination: string; imports: string[]; links: string[] }>> {
  const agentsLinked = (await inspect(checkout, 'AGENTS.md'))?.isSymbolicLink() ?? false;
  let destination = 'AGENTS.md';
  const imports: string[] = [];
  const links: string[] = [];
  for (const path of claudeInstructions) {
    const info = await inspect(checkout, path);
    if (!info) continue;
    if (info.isSymbolicLink()) {
      if (claude && !(await sameFile(checkout, path, 'AGENTS.md'))) links.push(path);
      continue;
    }
    const same = await sameFile(checkout, 'AGENTS.md', path);
    if (agentsLinked && same) destination = path;
    if (!same) imports.push(path);
  }
  return { destination, imports, links };
}

export async function projectFile(checkout: string, reference: string): Promise<string> {
  const root = await realpath(checkout);
  const target = join(root, reference);
  const parts = reference.split('/');
  for (let i = 0; i < parts.length; i++) {
    const component = join(root, ...parts.slice(0, i + 1));
    const info = await lstat(component);
    if (i < parts.length - 1 ? !info.isDirectory() : !info.isFile()) {
      throw new Error(`${component} is no ${i < parts.length - 1 ? 'directory' : 'regular file'}`);
    }
  }
  await access(target, constants.R_OK);
  const result = await run('git', ['rev-parse', '--show-toplevel'], { cwd: dirname(target) });
  if (result.code !== 0) throw new Error(result.stderr.trimEnd());
  if ((await realpath(result.stdout.trimEnd())) !== root) throw new Error('file belongs to another checkout');
  return target;
}
