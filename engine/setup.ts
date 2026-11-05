import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, lstat, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { initializeAgentOrder, readAgentOrder, validateAgentOrder } from './lib/agent-order.ts';
import { readConfig } from './lib/config.ts';
import { type Config, ConfigError, formatConfigError, type Host, validateWorktreeSetup } from './lib/config-core.ts';
import { installRecorder, markDefect } from './lib/events.ts';
import { HostError, updateHint } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts, type Operation } from './lib/operation.ts';
import { codexHome } from './lib/plugin-metadata.ts';
import { checkClaudePolicy } from './lib/plugin-policy.ts';
import { childEnv, run } from './lib/process.ts';
import { parseAllDocuments } from './lib/vendor/yaml.mjs';
import { type Label, labels } from './lib/workflow.ts';
import { markerOf, removeCheckout, runSetup, setupFile, worktrees } from './lib/worktree.ts';

const wiring = '.claude/celetis-flow/wiring.json';
const settings = '.claude/settings.json';
const configFile = '.celetis.yaml';
const subject = 'chore(celetis): wire the project for the celetis lanes';
const usage = `usage: celetis --agent <host> setup check | write <options> | try <options> | try --remove | lane <path> | push; <options>: --hosts claude|codex|claude,codex|codex,claude --landing pr|merge [--suite <file>] [--setup-file <file>] [--ignore <line>]... [--baseline-file <file>]\n${updateHint}`;
const setupPaths = [
  configFile,
  wiring,
  '.codex/rules/celetis.rules',
  settings,
  '.gitignore',
  '.gitattributes',
  'AGENTS.md',
  'CLAUDE.md',
  '.claude/CLAUDE.md',
];
const ignores = [
  '.claude/worktrees/',
  '.claude/settings.local.json',
  'docs/superpowers/',
  '.superpowers/',
  'docs/lessons/_pending/',
];
const labelStyles = {
  'needs-triage': ['not yet classified', 'FBCA04'],
  bug: ["Something isn't working", 'd73a4a'],
  enhancement: ['New feature or request', 'a2eeef'],
  hotfix: ['production broken, the fix ships now', 'FEF2C0'],
  chore: ['zero-behavior-change edit', '006B75'],
  epic: ['parent of several feature sub-issues', '0052CC'],
  'needs-info': ['the report lacks what its lane needs; the questions are in a comment', 'FEF2C0'],
  'ready-for-agent': ['plan posted; no human hold; build completion is recorded in comments', 'D93F0B'],
  'ready-for-human': ['a step needs assistance before continuation', 'C2E0C6'],
  wontfix: ['This will not be worked on', 'ffffff'],
} as const satisfies Record<Label, readonly [string, string]>;
type Options = {
  hosts: readonly Host[];
  landing: string;
  suite: string;
  setup: string;
  baseline: string;
  ignores: string[];
};
type Command =
  | { command: 'check' }
  | { command: 'push' }
  | { command: 'remove' }
  | { command: 'lane'; path: string }
  | { command: 'write' | 'try'; options: Options };
type Entry = { path: string[]; item?: string; value?: unknown };
type RecordOfSetup = { files: string[]; entries: Record<string, unknown[]> };
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const normal = (text: string) => text.replace(/\r$/, '').replace(/^[ \t]+|[ \t]+$/g, '');
const lines = (text: string) => (text === '' ? [] : text.replace(/\n$/, '').split('\n'));
const hasLine = (text: string, line: string) => lines(text).some((item) => normal(item) === line);
const appendLine = (text: string, line: string) =>
  hasLine(text, line) ? text : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
function fail(message: string): never {
  throw new HostError(`setup: ${message}`);
}
function managedInstructions(path: string, source: string): string {
  const block = `<!-- CELETIS:START -->
## Celetis

Use the installed \`celetis\` skills for changes in this project.
Follow an explicitly requested Celetis skill. For a new request with no
recorded intent or lane, start with \`celetis:intake\`. For an existing issue,
follow its current Celetis step.

Keep project-specific instructions outside this block. Celetis setup
refreshes the text between these markers.
<!-- CELETIS:END -->`;
  const markers = [...source.matchAll(/(?:^|\n)(<!-- CELETIS:(START|END) -->)(?=\r?\n|$)/g)];
  if (!markers.length) {
    if (!source) return `${block}\n`;
    const newline = source.match(/\r?\n/)?.[0] ?? '\n';
    let separator = source.endsWith('\n') ? '' : newline;
    if (!/(?:^|\n)[ \t]*\r?\n$/.test(source + separator)) separator += newline;
    return source + separator + block.replaceAll('\n', newline) + newline;
  }
  const [start, end] = markers;
  if (markers.length !== 2 || !start || !end || start[2] !== 'START' || end[2] !== 'END')
    fail(`${path}: repair the Celetis markers; use one standalone START line before one standalone END line`);
  const from = start.index + (start[0].startsWith('\n') ? 1 : 0);
  const afterStart = start.index + start[0].length;
  const newline = source.startsWith('\r\n', afterStart) ? '\r\n' : '\n';
  return source.slice(0, from) + block.replaceAll('\n', newline) + source.slice(end.index + end[0].length);
}
function badUsage(): never {
  throw new HostError(usage, 2);
}
function checkJSONKeys(path: string, source: string): void {
  if (parseAllDocuments(source, { uniqueKeys: true, merge: false }).some((doc) => doc.errors.length))
    fail(`${path} is ambiguous; fix duplicate object keys first`);
}

function options(argv: string[]): Options {
  const values: Record<string, string> = {};
  const ignores: string[] = [];
  const flags = ['--hosts', '--landing', '--suite', '--setup-file', '--ignore', '--baseline-file'];
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] as string;
    const value = argv[i + 1];
    if (
      !flags.includes(flag) ||
      value === undefined ||
      (['--suite', '--setup-file', '--ignore', '--baseline-file'].includes(flag) && !value)
    )
      badUsage();
    if (flag === '--ignore') ignores.push(value);
    else values[flag] = value;
  }
  const hosts = values['--hosts'];
  const landing = values['--landing'];
  if (!hosts || !['claude', 'codex', 'claude,codex', 'codex,claude'].includes(hosts)) return badUsage();
  if (landing !== 'pr' && landing !== 'merge') return badUsage();
  const suite = values['--suite'] ?? '';
  if ((landing === 'merge') !== !!suite) return badUsage();
  const setup = values['--setup-file'] ?? '';
  try {
    validateWorktreeSetup(setup);
  } catch (error) {
    fail(`--setup-file ${setup}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const absolute = (value = '') => (!value || isAbsolute(value) || win32.isAbsolute(value) ? value : resolve(value));
  return {
    hosts: validateAgentOrder(hosts.split(',')),
    landing,
    suite,
    setup,
    baseline: absolute(values['--baseline-file']),
    ignores,
  };
}

function parseCommand(argv: string[]): Command {
  const [command, ...args] = argv;
  if (command === 'check' || command === 'push') {
    if (args.length) return badUsage();
    return { command };
  }
  if (command === 'lane') {
    if (args.length !== 1 || !args[0]) return badUsage();
    return { command, path: args[0] };
  }
  if (command === 'try' && args[0] === '--remove') {
    if (args.length !== 1) return badUsage();
    return { command: 'remove' };
  }
  if (command === 'write' || command === 'try') return { command, options: options(args) };
  return badUsage();
}

async function hasConfig(checkout: string): Promise<boolean> {
  return (
    (await lstat(join(checkout, configFile)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    })) !== null
  );
}

function settingsForm(): Entry[] {
  return [
    ...['Bash(gh\u0020pr merge*)', 'PowerShell(gh\u0020pr merge*)'].map((item) => ({
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

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  return object(value)
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, sortedKeys(value[key])]),
      )
    : value;
}

function compare(a: unknown, b: unknown): number {
  const rank = (value: unknown) =>
    value === null
      ? 0
      : typeof value === 'boolean'
        ? value
          ? 2
          : 1
        : typeof value === 'number'
          ? 3
          : typeof value === 'string'
            ? 4
            : Array.isArray(value)
              ? 5
              : 6;
  const delta = rank(a) - rank(b);
  if (delta) return delta;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const delta = compare(a[i], b[i]);
      if (delta) return delta;
    }
    return a.length - b.length;
  }
  if (object(a) && object(b)) {
    const keys = Object.keys(a).sort();
    return (
      compare(keys, Object.keys(b).sort()) ||
      compare(
        keys.map((key) => a[key]),
        keys.map((key) => b[key]),
      )
    );
  }
  return a === b ? 0 : (a as number | string) < (b as number | string) ? -1 : 1;
}

class Setup {
  constructor(readonly operation: Operation) {
    this.cwd = operation.checkout.cwd;
    this.config = operation.mainConfig;
  }

  cwd: string;
  config: Config | null;
  top = '';
  testLane = '';
  trunk = '';
  ahead = 0;
  diagnostic = false;
  files = new Map<string, { contents: string | Buffer }>();
  owned: RecordOfSetup = { files: [], entries: {} };

  output(text: string): void {
    (this.diagnostic ? process.stderr : process.stdout).write(text);
  }
  warn(message: string): void {
    this.output(`setup: warning: ${message}\n`);
  }
  review(path: string, evidence: string): void {
    this.warn(
      `${path}: ${evidence}; the owner must review this old wiring; setup preserves the content and any historical ownership; follow https://github.com/ddinkov10/celetis#review-old-wiring (README, "Review old wiring")`,
    );
  }
  async git(args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
    const result = await run('git', args, { cwd: this.cwd, env });
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
    process.stderr.write(result.stderr);
    return result.stdout.trimEnd();
  }
  async live(args: string[], message?: string): Promise<void> {
    const code = await new Promise<number>((resolveCode) => {
      const child = spawn('git', args, {
        cwd: this.cwd,
        env: childEnv(),
        stdio: ['inherit', this.diagnostic ? 2 : 1, 2],
      });
      child.once('error', (error) => {
        console.error(error.message);
      });
      child.once('close', (code, signal) => resolveCode(code ?? (signal ? 128 + constants.signals[signal] : 1)));
    });
    if (code !== 0) {
      if (message) fail(message);
      throw new HostError('', code);
    }
  }
  async api<T>(args: string[], message: string): Promise<T> {
    const result = await run('gh', ['api', ...args], { cwd: this.cwd });
    if (result.code !== 0) {
      process.stderr.write(result.stderr);
      fail(message);
    }
    return (result.stdout.trim() ? JSON.parse(result.stdout) : undefined) as T;
  }
  async checkMain(): Promise<void> {
    try {
      this.top = resolve(await this.git(['rev-parse', '--show-toplevel']));
    } catch (error) {
      throw new HostError(error instanceof Error ? error.message : String(error));
    }
    if (
      (await this.git(['rev-parse', '--path-format=absolute', '--git-dir'])) !==
      (await this.git(['rev-parse', '--path-format=absolute', '--git-common-dir']))
    )
      fail(`run setup in the main checkout, not in a linked worktree: ${this.top}`);
    this.cwd = this.top;
    this.testLane = join(this.top, '.claude/worktrees/setup-try');
  }
  async checkTrunk(): Promise<void> {
    await this.checkMain();
    const repo = await this.api<{ full_name: string; default_branch: string }>(
      ['repos/{owner}/{repo}'],
      'origin is not a GitHub repository that gh can read',
    );
    this.trunk = repo.default_branch;
    const branch = await this.git(['branch', '--show-current']);
    if (branch !== this.trunk)
      fail(
        `the main checkout is on ${branch || 'a detached HEAD'}, not on ${this.trunk}; switch to ${this.trunk} first`,
      );
    await this.live(['fetch', '-q', 'origin', this.trunk], `cannot fetch ${this.trunk} from origin`);
    if (Number(await this.git(['rev-list', '--count', `HEAD..origin/${this.trunk}`])) !== 0)
      fail(`the local ${this.trunk} is behind origin/${this.trunk} or has diverged from it; run git pull first`);
    this.ahead = Number(await this.git(['rev-list', '--count', `origin/${this.trunk}..HEAD`]));
    if (this.ahead) {
      this.warn(
        `the local ${this.trunk} is ${this.ahead} commit${this.ahead === 1 ? '' : 's'} ahead of origin/${this.trunk}; the push carries ${this.ahead === 1 ? 'it' : 'them'}:`,
      );
      this.output(`${await this.git(['log', '--reverse', '--format=  %s', `origin/${this.trunk}..HEAD`])}\n`);
    }
  }
  async changedPaths(): Promise<string[]> {
    const result = await run('git', ['status', '--porcelain', '-z', '--untracked-files=all', '--', ...setupPaths], {
      cwd: this.cwd,
    });
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
    const rows = result.stdout.split('\0');
    const paths: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as string;
      if (!row) continue;
      paths.push(row.slice(3));
      if (row[0] === 'R' || row[0] === 'C') i++;
    }
    return paths;
  }
  async checkStaged(): Promise<void> {
    const result = await run('git', ['diff', '--cached', '--quiet'], { cwd: this.cwd });
    if (result.code !== 0) fail('the index holds staged changes; commit or unstage them first');
  }
  private async checkSetupSource(reference: string): Promise<void> {
    await setupFile(this.top, reference);
    const tracked = await run(
      'git',
      ['--literal-pathspecs', 'ls-files', '--stage', '--error-unmatch', '-z', '--', reference],
      { cwd: this.cwd },
    );
    if (tracked.code !== 0) fail(`cannot check ${reference} in the index: ${tracked.stderr.trimEnd()}`);
    const [entry, path] = tracked.stdout.split('\t');
    if (!/^100(?:644|755) [0-9a-f]+ 0$/.test(entry ?? '') || path !== `${reference}\0`)
      fail(`${reference} is no regular tracked file; commit it on ${this.trunk} first`);
    for (const cached of [true, false]) {
      const result = await run(
        'git',
        [
          '--literal-pathspecs',
          'diff',
          '--no-ext-diff',
          '--quiet',
          ...(cached ? ['--cached', 'HEAD'] : []),
          '--',
          reference,
        ],
        { cwd: this.cwd },
      );
      if (result.code === 1)
        fail(
          `${reference} differs in the ${cached ? 'index from local trunk HEAD' : 'working tree from the index'}; commit it first`,
        );
      if (result.code !== 0) fail(`cannot check ${reference}: ${result.stderr.trimEnd()}`);
    }
    const hash = await run('git', ['hash-object', `--path=${reference}`, '--', reference], { cwd: this.cwd });
    if (hash.code !== 0) fail(`cannot check ${reference}: ${hash.stderr.trimEnd()}`);
    if (hash.stdout.trimEnd() !== entry?.split(' ')[1])
      fail(`${reference} differs in the working tree from the index; commit it first`);
  }
  async check(reference = ''): Promise<void> {
    await this.checkTrunk();
    if (reference) await this.checkSetupSource(reference);
    if (/^i\/(?:crlf|mixed)/.test(await this.git(['ls-files', '--eol', '--', configFile])))
      fail(`the index holds ${configFile} with CRLF line endings; convert it to LF and commit it first`);
    const dirty = await this.changedPaths();
    if (dirty.length) fail(`commit or drop the uncommitted changes of these files first: ${dirty.join(' ')}`);
    await this.checkStaged();
  }
  async get(path: string): Promise<string> {
    await this.checkDestination(path);
    const planned = this.files.get(path);
    if (planned) return planned.contents.toString();
    try {
      return await readFile(join(this.cwd, path), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
      fail(`cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  private async checkDestination(path: string): Promise<void> {
    const parts = path.split('/');
    for (let i = 0; i < parts.length; i++) {
      const component = parts.slice(0, i + 1).join('/');
      const info = await lstat(join(this.cwd, component)).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        fail(`cannot inspect ${path} at ${component}: ${error.message}`);
      });
      if (info === null) return;
      if (info.isSymbolicLink()) fail(`${component} is a symbolic link; setup writes no file through a link`);
      if (i < parts.length - 1 ? !info.isDirectory() : !info.isFile())
        fail(`${component} is no ${i < parts.length - 1 ? 'directory' : 'regular file'} for ${path}`);
    }
  }
  async there(path: string): Promise<boolean> {
    return (
      (await lstat(join(this.cwd, path)).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        fail(`cannot inspect ${path}: ${error.message}`);
      })) !== null
    );
  }
  async same(a: string, b: string): Promise<boolean> {
    const [one, two] = await Promise.all([
      stat(join(this.cwd, a)).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        fail(`cannot inspect ${a}: ${error.message}`);
      }),
      stat(join(this.cwd, b)).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        fail(`cannot inspect ${b}: ${error.message}`);
      }),
    ]);
    return !!one && !!two && one.dev === two.dev && one.ino === two.ino;
  }
  async linked(path: string): Promise<boolean> {
    return (
      (
        await lstat(join(this.cwd, path)).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return null;
          fail(`cannot inspect ${path}: ${error.message}`);
        })
      )?.isSymbolicLink() ?? false
    );
  }
  own(path: string, entry: unknown): void {
    this.owned.entries[path] ??= [];
    this.owned.entries[path].push(entry);
  }
  async ownLines(path: string, values: string[], owned = true): Promise<void> {
    let text = await this.get(path);
    for (const value of values) {
      if (owned) this.own(path, value);
      text = appendLine(text, value);
    }
    this.files.set(path, { contents: text });
  }
  async planSettings(): Promise<void> {
    const source = await this.get(settings);
    let doc: unknown = {};
    if (await this.there(settings)) {
      try {
        doc = JSON.parse(source);
      } catch {
        fail(`${settings} is no JSON object; fix it first`);
      }
      checkJSONKeys(settings, source);
    }
    if (!object(doc)) fail(`${settings} is no JSON object; fix it first`);
    if (object(doc.permissions) && Object.hasOwn(doc.permissions, 'allow') && !Array.isArray(doc.permissions.allow))
      fail(`${settings}: permissions.allow is no array; fix it first`);
    let changed = false;
    for (const form of settingsForm()) {
      const parentKey = form.path[0] as string;
      const key = form.path[1] as string;
      let parent = doc[parentKey];
      if (Object.hasOwn(doc, parentKey) && !object(parent))
        fail(`${settings}: ${parentKey} is no object; fix it first`);
      if (!Object.hasOwn(doc, parentKey)) {
        parent = {};
        doc[parentKey] = parent;
      }
      const group = parent as Record<string, unknown>;
      const present = Object.hasOwn(group, key);
      const value = group[key];
      if (form.item !== undefined) {
        if (present && !Array.isArray(value)) fail(`${settings}: ${form.path.join('.')} is no array; fix it first`);
        if (!present) {
          group[key] = [form.item];
          changed = true;
        } else if (!(value as unknown[]).includes(form.item)) {
          (value as unknown[]).push(form.item);
          changed = true;
        }
        this.own(settings, { path: form.path, item: form.item });
      } else if (!present) {
        group[key] = form.value;
        this.own(settings, { path: form.path });
        changed = true;
      } else if (
        parentKey === 'extraKnownMarketplaces' &&
        key === 'celetis' &&
        (this.owned.entries[settings] ?? []).some((entry) => isDeepStrictEqual(entry, { path: form.path })) &&
        isDeepStrictEqual(value, { source: { source: 'github', repo: 'ddinkov10/celetis' }, autoUpdate: true })
      ) {
        group[key] = form.value;
        changed = true;
      } else if (isDeepStrictEqual(value, form.value)) this.own(settings, { path: form.path });
      else
        this.warn(
          `${settings}: ${form.path.join('.')} differs from the current form; setup leaves it${parentKey === 'extraKnownMarketplaces' && key === 'celetis' ? '; review this entry and set autoUpdate to false by hand' : ''}`,
        );
    }
    try {
      checkClaudePolicy([{ path: join(this.cwd, settings), value: doc }]);
    } catch (error) {
      this.warn((error as Error).message);
    }
    if (changed) {
      const lead = source.match(/^[ \t]+(?=[^ \t\r\n])/m)?.[0] ?? '';
      const indent = lead.startsWith('\t') ? '\t' : lead.length >= 1 && lead.length <= 7 ? lead.length : 2;
      this.files.set(settings, { contents: `${JSON.stringify(doc, null, indent)}\n` });
    }
  }
  configError(checkout: string, error: unknown): void {
    if (!(error instanceof ConfigError)) throw error;
    console.error(`celetis: ${checkout}/${configFile}: ${error.field}: ${error.message}`);
  }
  async planConfig(opts: Options, scratch: string): Promise<void> {
    let original: Partial<Config> & { suite?: string } = {};
    if (await this.there(configFile)) {
      try {
        original = this.config ??= readConfig(this.cwd);
      } catch (error) {
        this.configError(this.cwd, error);
        fail(`cannot read ${configFile}; fix the cause above first`);
      }
    }
    const desired = { ...original };
    const added: string[] = [];
    const wanted: (readonly ['landing' | 'suite', string])[] = [['landing', opts.landing]];
    if (opts.suite && (original.landing ?? opts.landing) === 'merge') wanted.push(['suite', opts.suite]);
    for (const [key, value] of wanted) {
      if (original[key] === undefined) {
        added.push(`${key}: ${value}`);
        Object.assign(desired, { [key]: value });
        this.own(configFile, { path: [key] });
      } else if (original[key] === value) this.own(configFile, { path: [key] });
      else this.warn(`${configFile}: ${key} is ${original[key]}, not ${value}; setup leaves it`);
    }
    let proposed = await this.get(configFile);
    const check = async (want: Partial<Config>, message: string, showError: boolean) => {
      await writeFile(join(scratch, configFile), proposed);
      let actual: Config;
      try {
        actual = readConfig(scratch);
      } catch (error) {
        if (showError) this.configError(scratch, error);
        return fail(message);
      }
      if (!isDeepStrictEqual(actual, want)) fail(message);
    };
    if (added.length) {
      proposed += `${proposed && !proposed.endsWith('\n') ? '\n' : ''}${added.join('\n')}\n`;
      await check(desired, `cannot add the line ${added[0]} to ${configFile}; add it by hand first`, false);
    }
    if (opts.setup) {
      if (original.worktreeSetup !== undefined) {
        if (original.worktreeSetup !== opts.setup)
          this.warn(`${configFile}: worktreeSetup differs from the requested setup reference; setup leaves it`);
      } else {
        proposed += `${proposed && !proposed.endsWith('\n') ? '\n' : ''}worktreeSetup: ${JSON.stringify(opts.setup)}\n`;
        desired.worktreeSetup = opts.setup;
        await check(desired, `cannot add worktreeSetup to ${configFile}; add it by hand first`, true);
      }
    }
    if (proposed !== (await this.get(configFile))) this.files.set(configFile, { contents: proposed });
  }
  async reportOldWiring(agentsPath: string): Promise<void> {
    if ((await this.there('scripts/celetis')) || this.owned.files.includes('scripts/celetis'))
      this.review('scripts/celetis', 'obsolete product launcher or recorded launcher ownership');
    const flow = [
      '## Celetis flow',
      '- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `celetis --agent <host> land`.',
      '- A lane never skips a step.',
      '- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.',
    ];
    for (const line of new Set([...lines(await this.get(agentsPath)), ...(this.owned.entries['AGENTS.md'] ?? [])]))
      if (
        typeof line === 'string' &&
        (flow.includes(normal(line)) ||
          /^- The lanes are the skills of the plugin `celetis`, on the issues of `[^`]+`\.$/.test(normal(line)))
      )
        this.review(agentsPath, line);
    const attribute = 'scripts/celetis text eol=lf';
    if (
      hasLine(await this.get('.gitattributes'), attribute) ||
      (this.owned.entries['.gitattributes'] ?? []).includes(attribute)
    )
      this.review('.gitattributes', attribute);
    let doc: unknown = {};
    if (await this.there(settings)) {
      const source = await this.get(settings);
      try {
        doc = JSON.parse(source);
      } catch {
        fail(`${settings} is no JSON object; fix it first`);
      }
      checkJSONKeys(settings, source);
      if (!object(doc)) fail(`${settings} is no JSON object; fix it first`);
    }
    const recorded = this.owned.entries[settings] ?? [];
    const allow = object(doc) && object(doc.permissions) ? doc.permissions.allow : undefined;
    for (const item of new Set([
      ...(Array.isArray(allow) ? allow : []),
      ...recorded.flatMap((entry) =>
        object(entry) && isDeepStrictEqual(entry.path, ['permissions', 'allow']) ? [entry.item] : [],
      ),
    ]))
      if (typeof item === 'string' && /^(Bash|PowerShell)\((\.\/)?(scripts\/celetis|celetis)([ )])/.test(item))
        this.review(settings, `permissions.allow: ${item}`);
    if (
      (object(doc) && object(doc.enabledPlugins) && Object.hasOwn(doc.enabledPlugins, 'celetis@celetis')) ||
      recorded.some((entry) => isDeepStrictEqual(entry, { path: ['enabledPlugins', 'celetis@celetis'] }))
    )
      this.review(settings, 'enabledPlugins.celetis@celetis');
  }
  async plan(opts: Options, scratch: string): Promise<void> {
    if (opts.baseline) {
      try {
        if (!(await stat(opts.baseline)).isFile()) fail(`cannot read ${opts.baseline}`);
        await access(opts.baseline, fsConstants.R_OK);
      } catch {
        fail(`cannot read ${opts.baseline}`);
      }
    }
    const baseline = opts.baseline ? await readFile(opts.baseline, 'utf8') : '';
    const touched = [configFile, wiring, '.gitignore', '.gitattributes'];
    if (opts.hosts.includes('codex')) touched.push('.codex/rules/celetis.rules');
    if (opts.hosts.includes('claude') || (await this.there(settings))) touched.push(settings);
    for (const path of touched) await this.checkDestination(path);
    let agentsPath = 'AGENTS.md';
    const claudeFiles: string[] = [];
    for (const path of ['CLAUDE.md', '.claude/CLAUDE.md']) {
      if ((await this.linked('AGENTS.md')) && !(await this.linked(path)) && (await this.same('AGENTS.md', path)))
        agentsPath = path;
      if ((await this.there(path)) && !(await this.linked(path)) && !(await this.same('AGENTS.md', path)))
        claudeFiles.push(path);
    }
    touched.push(agentsPath);
    if (opts.hosts.includes('claude')) touched.push(...claudeFiles);
    for (const path of touched) {
      await this.checkDestination(path);
      const result = await run('git', ['check-ignore', '-q', '--', path], { cwd: this.cwd });
      if (result.code === 0) fail(`git ignores ${path}; make git track it first`);
      if (result.code !== 1) {
        process.stderr.write(result.stderr);
        fail(`${path} lies beyond a symbolic link or in a submodule; setup writes no file there`);
      }
    }
    if (await this.there(wiring)) {
      const source = await this.get(wiring);
      let old: unknown;
      try {
        old = JSON.parse(source);
      } catch {}
      if (old !== undefined) checkJSONKeys(wiring, source);
      if (
        !object(old) ||
        old.schema !== 1 ||
        !Array.isArray(old.files) ||
        !old.files.every((file) => typeof file === 'string') ||
        !object(old.entries) ||
        !Object.values(old.entries).every(Array.isArray)
      )
        fail(`${wiring} is no record of setup; fix or remove it first`);
      this.owned = { files: old.files, entries: old.entries as Record<string, unknown[]> };
    }
    const source = (await this.there(agentsPath)) ? await this.getUnplanned(agentsPath) : Buffer.alloc(0);
    const agents = Buffer.from(managedInstructions(agentsPath, source.toString('latin1')), 'latin1');
    this.files.set(agentsPath, { contents: agents });
    this.own(agentsPath, { start: '<!-- CELETIS:START -->', end: '<!-- CELETIS:END -->' });
    if (opts.hosts.includes('claude')) await this.planSettings();
    await this.planConfig(opts, scratch);
    if (opts.hosts.includes('codex')) {
      const path = '.codex/rules/celetis.rules';
      const contents =
        'prefix_rule(\n    pattern = ["gh", "pr", "merge"],\n    decision = "forbidden",\n    justification = "Use celetis --agent codex land from the main checkout.",\n)\n';
      if (!(await this.there(path))) {
        this.files.set(path, { contents });
        this.owned.files.push(path);
      } else if ((await this.get(path)) === contents) this.owned.files.push(path);
      else
        this.warn(
          `${path} differs from the required form; setup preserves it and any historical ownership; the owner must review the direct-merge restriction and obsolete allows; follow https://github.com/ddinkov10/celetis#review-old-wiring (README, "Review old wiring")`,
        );
    }
    await this.ownLines('.gitignore', ignores);
    await this.ownLines('.gitignore', opts.ignores, false);
    await this.ownLines('.gitattributes', ['.celetis.yaml text eol=lf']);
    if (baseline) {
      const heading = baseline.split('\n')[0] ?? '';
      if (hasLine(agents.toString(), heading)) this.warn(`AGENTS.md: ${heading} is there; setup leaves it`);
      else {
        let addition = agents.at(-1) === 10 ? '' : '\n';
        if (lines(agents.toString() + addition).at(-1)) addition += '\n';
        addition += baseline;
        if (!baseline.endsWith('\n')) addition += '\n';
        this.files.set(agentsPath, { contents: Buffer.concat([agents, Buffer.from(addition)]) });
      }
    }
    if (opts.hosts.includes('claude')) {
      for (const path of ['CLAUDE.md', '.claude/CLAUDE.md'])
        if ((await this.linked(path)) && !(await this.same(path, 'AGENTS.md')))
          this.warn(
            `${path} is an unrelated symbolic link; setup preserves it; loading AGENTS.md requires owner review of that instruction file`,
          );
      for (const path of claudeFiles) {
        const required = `@${relative(dirname(path), 'AGENTS.md').split(sep).join('/')}`;
        const wrong = lines(await this.get(path)).filter(
          (line) => /^@(?:\.\.?\/)*AGENTS\.md$/.test(normal(line)) && normal(line) !== required,
        );
        if (wrong.length) {
          for (const line of wrong)
            this.warn(
              `${path}: ${line}; the owner must review this import and the required ${required}; setup preserves the file`,
            );
        } else await this.ownLines(path, [required]);
      }
    }
    await this.reportOldWiring(agentsPath);
    this.owned.files.push(wiring);
    const entries = Object.fromEntries(
      Object.entries(this.owned.entries).map(([file, items]) => [
        file,
        [...new Map(items.map((item) => [JSON.stringify(sortedKeys(item)), item])).values()].sort(compare),
      ]),
    );
    const record = {
      schema: 1,
      answers: { hosts: opts.hosts, tracker: 'github' },
      files: [...new Set(this.owned.files)].sort(),
      entries,
    };
    this.files.set(wiring, { contents: `${JSON.stringify(sortedKeys(record), null, 2)}\n` });
  }
  async writeTree(): Promise<void> {
    for (const path of this.files.keys()) await this.checkDestination(path);
    for (const [path, file] of this.files) {
      try {
        const absolute = join(this.cwd, path);
        const contents = typeof file.contents === 'string' ? Buffer.from(file.contents) : file.contents;
        if (!(await this.there(path)) || !(await this.getUnplanned(path)).equals(contents)) {
          await this.checkDestination(path);
          await mkdir(dirname(absolute), { recursive: true });
          await writeFile(absolute, file.contents);
          if (path === configFile) this.config = this.read(this.cwd);
        }
      } catch (error) {
        fail(
          `cannot write ${path}: ${error instanceof Error ? error.message : String(error)}; review the partial product diff before retrying`,
        );
      }
    }
  }
  async getUnplanned(path: string): Promise<Buffer> {
    await this.checkDestination(path);
    return readFile(join(this.cwd, path));
  }
  async makeLabels(): Promise<void> {
    const pages = await this.api<{ name: string }[][]>(
      ['--paginate', '--slurp', 'repos/{owner}/{repo}/labels?per_page=100'],
      'cannot list the labels',
    );
    const names = pages.flat().map((label) => label.name);
    for (const name of labels) {
      const [description, color] = labelStyles[name];
      const found = names.find((existing) => existing.toLowerCase() === name.toLowerCase());
      if (found !== undefined) {
        if (found !== name) this.warn(`the label ${found} differs in case from ${name}; setup leaves it`);
      } else {
        await this.api(
          [
            '--silent',
            'repos/{owner}/{repo}/labels',
            '-f',
            `name=${name}`,
            '-f',
            `description=${description}`,
            '-f',
            `color=${color}`,
          ],
          `cannot make the label ${name}`,
        );
        this.output(`setup: made the label ${name}\n`);
      }
    }
  }
  async stage(paths: string[]): Promise<void> {
    for (const path of paths) await this.git(['add', '--', path]);
  }
  async push(): Promise<void> {
    await this.checkTrunk();
    await this.checkStaged();
    const paths = await this.changedPaths();
    if (!paths.length) {
      this.output('setup: no file changed; nothing to commit\n');
      if (!this.ahead) return;
    } else {
      await this.stage(paths);
      try {
        await this.live(['commit', '-q', '-m', subject]);
      } catch {
        await this.git(['reset', '-q', '--', ...setupPaths]);
        fail('the commit failed; the files stay uncommitted');
      }
    }
    await this.live(
      ['push', '-q', 'origin', `refs/heads/${this.trunk}:refs/heads/${this.trunk}`],
      `the push failed; the commit stays on the local ${this.trunk}`,
    );
  }
  async removeTestLane(): Promise<void> {
    if ((await worktrees(this.cwd)).some((tree) => tree.path === this.testLane)) {
      await removeCheckout(this.testLane, this.cwd, true);
      await this.git(['worktree', 'prune']);
    } else if (await lstat(this.testLane).catch(() => null))
      fail('.claude/worktrees/setup-try is no worktree of git; remove it first');
  }
  async commitWiring(): Promise<void> {
    const paths = await this.changedPaths();
    if (!paths.length) return;
    await this.stage(paths);
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: 'celetis',
      GIT_AUTHOR_EMAIL: 'setup@celetis.invalid',
      GIT_COMMITTER_NAME: 'celetis',
      GIT_COMMITTER_EMAIL: 'setup@celetis.invalid',
    };
    try {
      const tree = await this.git(['write-tree']);
      const commit = await this.git(['commit-tree', '--no-gpg-sign', '-p', 'HEAD', '-m', subject, tree], env);
      await this.git(['update-ref', 'HEAD', commit]);
    } catch (error) {
      if (error instanceof Error && error.message) console.error(error.message);
      fail('the commit failed in the test lane');
    }
  }
  read(checkout: string): Config {
    try {
      return readConfig(checkout);
    } catch (error) {
      if (error instanceof ConfigError) throw new HostError(formatConfigError(checkout, error), 2);
      throw error;
    }
  }
  async lane(input: string): Promise<void> {
    const result = await run('git', ['-C', input, 'rev-parse', '--show-toplevel'], { cwd: this.cwd });
    const path = result.code === 0 ? resolve(result.stdout.trimEnd()) : '';
    await this.checkMain();
    const contained = relative(join(this.top, '.claude/worktrees'), path);
    if (
      !path ||
      !contained ||
      isAbsolute(contained) ||
      contained === '..' ||
      contained.startsWith(`..${sep}`) ||
      path === this.testLane ||
      !(await worktrees(this.cwd)).some((tree) => tree.path === path)
    )
      fail(`${input} is no lane worktree in .claude/worktrees/ of this repository`);
    const target = createOperation(await locateCheckouts(path), this.operation.selection, 'active');
    const config = target.mainConfig as Config;
    if (!(config.worktreeSetup ?? '')) fail(`the main ${configFile} has no worktreeSetup to run`);
    await rm(await markerOf(path), { force: true });
    if ((await runSetup(path, config, this.top)) !== 0) fail(`the worktree setup failed in ${path}`);
  }
  async execute(input: Command): Promise<number> {
    const { command } = input;
    if (input.command === 'check') {
      await this.check();
      return 0;
    }
    if (input.command === 'push') {
      await this.push();
      return 0;
    }
    if (input.command === 'lane') {
      await this.lane(input.path);
      return 0;
    }
    if (input.command === 'remove') {
      await this.checkMain();
      await this.removeTestLane();
      return 0;
    }
    const opts = input.options;
    this.diagnostic = command === 'try';
    await this.check(opts.setup);
    const scratch = await mkdtemp(join(tmpdir(), 'celetis-plan.'));
    try {
      if (command === 'try') {
        await this.removeTestLane();
        await this.live(['worktree', 'add', '--detach', this.testLane, 'HEAD']);
        const checkout = await locateCheckouts(this.testLane);
        this.cwd = checkout.active as string;
        this.config = (await hasConfig(this.cwd))
          ? createOperation(checkout, this.operation.selection, 'active').activeConfig
          : null;
      }
      await this.plan(opts, scratch);
      if (this.operation.checkout.common === null) fail('need a Git checkout');
      readAgentOrder(this.operation.checkout.common);
      if (command === 'write') await this.makeLabels();
      await this.writeTree();
      if (command === 'write') {
        await initializeAgentOrder(this.operation.checkout.common, opts.hosts);
        const paths = await this.changedPaths();
        this.output(
          paths.length ? paths.map((path) => `setup: changed ${path}\n`).join('') : 'setup: no file changed\n',
        );
        return 0;
      }
      await this.commitWiring();
      const config = this.config as Config;
      const code = await runSetup(this.testLane, config, this.top);
      process.stdout.write(`${config.worktreeSetup ? '\n' : ''}${this.testLane}\n`);
      return code;
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    const input = parseCommand(args);
    const checkout = await locateCheckouts(process.cwd());
    const config = checkout.main !== null && (await hasConfig(checkout.main));
    const full = ['check', 'write', 'lane', 'try'].includes(input.command);
    const operation = createOperation(
      checkout,
      { explicit, environment: process.env.CELETIS_AGENT },
      full && config ? 'main' : 'host',
    );
    if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
    return await new Setup(operation).execute(input);
  } catch (error) {
    if (!(error instanceof ConfigError)) markDefect(error);
    const message = error instanceof Error ? error.message : String(error);
    if (message) console.error(message);
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) {
  installRecorder('setup');
  process.exitCode = await main(process.argv.slice(2));
}
