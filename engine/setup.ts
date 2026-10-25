import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, lstat, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { type Config, ConfigError, readConfig } from './lib/config.ts';
import { HostError } from './lib/host.ts';
import { checkClaudePolicy, claudePolicy } from './lib/plugin-policy.ts';
import { childEnv, run } from './lib/process.ts';
import { markerOf, removeCheckout, runSetup, worktrees } from './lib/worktree.ts';

const plugin = dirname(import.meta.dir);
const wiring = '.claude/celetis-flow/wiring.json';
const settings = '.claude/settings.json';
const configFile = '.celetis.yaml';
const subject = 'chore(celetis): wire the project for the celetis lanes';
const usage =
  'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> setup check | write <options> | try <options> | try --remove | lane <path> | push; <options>: --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge [--setup-file <file>] [--ignore <line>]... [--baseline-file <file>]';
const setupPaths = [
  'scripts/celetis',
  configFile,
  wiring,
  '.codex/rules/celetis.rules',
  settings,
  '.gitignore',
  '.gitattributes',
  'AGENTS.md',
  'CLAUDE.md',
  '.claude/CLAUDE.md',
  'docs/adr/README.md',
  'docs/adr/template.md',
  'docs/lessons/INDEX.md',
];
const ignores = [
  '.claude/worktrees/',
  '.claude/settings.local.json',
  'docs/superpowers/',
  '.superpowers/',
  'docs/lessons/_pending/',
];
const labels = [
  ['needs-triage', 'not yet classified', 'FBCA04'],
  ['bug', "Something isn't working", 'd73a4a'],
  ['enhancement', 'New feature or request', 'a2eeef'],
  ['hotfix', 'production broken, the fix ships now', 'FEF2C0'],
  ['chore', 'zero-behavior-change edit', '006B75'],
  ['epic', 'parent of several feature sub-issues', '0052CC'],
  ['needs-info', 'the report lacks what its lane needs; the questions are in a comment', 'FEF2C0'],
  ['ready-for-agent', 'plan posted; `/celetis:implement #<n>` can start', 'D93F0B'],
  ['ready-for-human', 'a step only a human runs', 'C2E0C6'],
  ['wontfix', 'This will not be worked on', 'ffffff'],
] as const;
type Options = {
  hosts: string[];
  default: string;
  landing: string;
  setup: string;
  baseline: string;
  ignores: string[];
};
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
function badUsage(): never {
  throw new HostError(usage, 2);
}

function options(argv: string[]): Options {
  const values: Record<string, string> = {};
  const ignores: string[] = [];
  const flags = ['--hosts', '--default', '--landing', '--setup-file', '--ignore', '--baseline-file'];
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] as string;
    const value = argv[i + 1];
    if (
      !flags.includes(flag) ||
      value === undefined ||
      (['--setup-file', '--ignore', '--baseline-file'].includes(flag) && !value)
    )
      badUsage();
    if (flag === '--ignore') ignores.push(value);
    else values[flag] = value;
  }
  const hosts = values['--hosts'];
  const given = values['--default'] ?? '';
  const landing = values['--landing'];
  let selected: string;
  if (hosts === 'claude' || hosts === 'codex') {
    if (given) badUsage();
    selected = hosts;
  } else if (hosts === 'claude,codex' && (given === 'claude' || given === 'codex')) selected = given;
  else return badUsage();
  if (landing !== 'pr' && landing !== 'merge') return badUsage();
  const absolute = (value = '') => (!value || isAbsolute(value) || win32.isAbsolute(value) ? value : resolve(value));
  return {
    hosts: hosts.split(','),
    default: selected,
    landing,
    setup: absolute(values['--setup-file']),
    baseline: absolute(values['--baseline-file']),
    ignores,
  };
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

function section(text: string, want: string[]): string {
  const source = lines(text);
  const code = new Set<number>();
  let opened: { marker: string; index: number } | undefined;
  for (const [index, line] of source.entries()) {
    if (!opened) {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker) opened = { marker, index };
    } else if (new RegExp(`^ {0,3}${opened.marker[0]}{${opened.marker.length},}[ \\t\\r]*$`).test(line)) {
      for (let i = opened.index; i <= index; i++) code.add(i);
      opened = undefined;
    }
  }
  const start = source.findIndex((line, i) => !code.has(i) && normal(line) === normal(want[0] ?? ''));
  if (start < 0)
    return `${source.length ? `${source.join('\n')}\n${normal(source.at(-1) ?? '') ? '\n' : ''}` : ''}${want[0]}\n\n${want.slice(1).join('\n')}\n`;
  let stop = source.findIndex((line, i) => i > start && !code.has(i) && /^#{1,2} /.test(line));
  if (stop < 0) stop = source.length;
  const bare = (line: string) => normal(normal(line).replace(/^[-*] /, ''));
  const missing = want
    .slice(1)
    .filter((line) => !source.some((item, i) => i > start && i < stop && !code.has(i) && bare(item) === bare(line)));
  if (!missing.length) return text;
  let last = start;
  for (let i = start + 1; i < stop; i++) if (normal(source[i] as string)) last = i;
  source.splice(last + 1, 0, ...(last === start ? [''] : []), ...missing);
  return `${source.join('\n')}\n`;
}

function block(text: string): string {
  const breaks = text.length - text.replace(/\n+$/, '').length;
  const indent = lines(text)
    .find((line) => line.length > 0)
    ?.startsWith(' ')
    ? '2'
    : '';
  const chomp = breaks === 0 ? '-' : breaks === 1 ? '' : '+';
  return `worktreeSetup: |${indent}${chomp}\n${lines(text)
    .map((line) => (line ? `  ${line}\n` : '\n'))
    .join('')}`;
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
  cwd = process.cwd();
  top = '';
  testLane = '';
  repo = '';
  trunk = '';
  ahead = 0;
  diagnostic = false;
  files = new Map<string, { contents: string }>();
  owned: RecordOfSetup = { files: [], entries: {} };

  output(text: string): void {
    (this.diagnostic ? process.stderr : process.stdout).write(text);
  }
  warn(message: string): void {
    this.output(`setup: warning: ${message}\n`);
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
    this.repo = repo.full_name;
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
  async check(): Promise<void> {
    await this.checkTrunk();
    if (/^i\/(?:crlf|mixed)/.test(await this.git(['ls-files', '--eol', '--', configFile])))
      fail(`the index holds ${configFile} with CRLF line endings; convert it to LF and commit it first`);
    const dirty = await this.changedPaths();
    if (dirty.length) fail(`commit or drop the uncommitted changes of these files first: ${dirty.join(' ')}`);
    await this.checkStaged();
  }
  async get(path: string): Promise<string> {
    const planned = this.files.get(path);
    if (planned) return planned.contents;
    try {
      return await readFile(join(this.cwd, path), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
      throw error;
    }
  }
  async there(path: string): Promise<boolean> {
    return (await stat(join(this.cwd, path)).catch(() => null)) !== null;
  }
  async same(a: string, b: string): Promise<boolean> {
    const [one, two] = await Promise.all([
      stat(join(this.cwd, a)).catch(() => null),
      stat(join(this.cwd, b)).catch(() => null),
    ]);
    return !!one && !!two && one.dev === two.dev && one.ino === two.ino;
  }
  async linked(path: string): Promise<boolean> {
    return (await lstat(join(this.cwd, path)).catch(() => null))?.isSymbolicLink() ?? false;
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
    }
    if (!object(doc)) fail(`${settings} is no JSON object; fix it first`);
    if (object(doc.permissions) && Object.hasOwn(doc.permissions, 'allow') && !Array.isArray(doc.permissions.allow))
      fail(`${settings}: permissions.allow is no array; fix it first`);
    let changed = false;
    for (const form of settingsForm()) {
      const parentKey = form.path[0] as string;
      const key = form.path[1] as string;
      let parent = doc[parentKey];
      if (parent != null && !object(parent)) fail(`${settings}: ${parentKey} is no object; fix it first`);
      if (parent == null) {
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
    const enabled = object(doc.enabledPlugins) ? doc.enabledPlugins['celetis@celetis'] : undefined;
    if (
      enabled === true &&
      (this.owned.entries[settings] ?? []).some((entry) =>
        isDeepStrictEqual(entry, { path: ['enabledPlugins', 'celetis@celetis'] }),
      )
    )
      this.warn(
        `${settings}: enabledPlugins.celetis@celetis needs review by the owner of the active project; setup preserves the entry and its ownership; follow the plugin README, "Wire a product project"`,
      );
    const policies = await claudePolicy(this.cwd);
    const projectPolicy = policies.find((entry) => entry.path === join(this.cwd, settings));
    if (projectPolicy) projectPolicy.value = doc;
    try {
      checkClaudePolicy(policies);
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
    let original: Partial<Config> = {};
    if (await this.there(configFile)) {
      try {
        original = readConfig(this.cwd);
      } catch (error) {
        this.configError(this.cwd, error);
        fail(`cannot read ${configFile}; fix the cause above first`);
      }
    }
    const desired: Partial<Config> = { ...original };
    const added: string[] = [];
    for (const [key, value] of [
      ['host', opts.default],
      ['landing', opts.landing],
    ] as const) {
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
      const setup = await readFile(opts.setup, 'utf8');
      if (original.worktreeSetup !== undefined) {
        if (original.worktreeSetup !== setup)
          this.warn(`${configFile}: worktreeSetup differs from the setup file; setup leaves it`);
      } else {
        proposed += `${proposed && !proposed.endsWith('\n') ? '\n' : ''}${block(setup)}`;
        desired.worktreeSetup = setup;
        await check(desired, `cannot add worktreeSetup to ${configFile}; add it by hand first`, true);
      }
    }
    if (proposed !== (await this.get(configFile))) this.files.set(configFile, { contents: proposed });
  }
  async plan(opts: Options, scratch: string): Promise<void> {
    for (const file of [opts.setup, opts.baseline].filter(Boolean)) {
      try {
        if (!(await stat(file)).isFile()) fail(`cannot read ${file}`);
        await access(file, fsConstants.R_OK);
      } catch {
        fail(`cannot read ${file}`);
      }
    }
    if (await this.there(wiring)) {
      let old: unknown;
      try {
        old = JSON.parse(await this.get(wiring));
      } catch {}
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
    let agentsPath = 'AGENTS.md';
    const claudeFiles: string[] = [];
    for (const path of ['CLAUDE.md', '.claude/CLAUDE.md']) {
      if ((await this.linked('AGENTS.md')) && !(await this.linked(path)) && (await this.same('AGENTS.md', path)))
        agentsPath = path;
      if (
        (await stat(join(this.cwd, path)).catch(() => null))?.isFile() &&
        !(await this.linked(path)) &&
        !(await this.same('AGENTS.md', path))
      )
        claudeFiles.push(path);
    }
    const touched = [configFile, wiring, '.gitignore', '.gitattributes', agentsPath];
    for (const path of ['docs/adr/README.md', 'docs/adr/template.md', 'docs/lessons/INDEX.md'])
      if (!(await this.there(path))) touched.push(path);
    if (opts.hosts.includes('codex')) touched.push('.codex/rules/celetis.rules');
    if (opts.hosts.includes('claude')) touched.push(settings, ...claudeFiles);
    for (const path of touched) {
      if (await this.linked(path)) fail(`${path} is a symbolic link; setup writes no file through a link`);
      const result = await run('git', ['check-ignore', '-q', '--', path], { cwd: this.cwd });
      if (result.code === 0) fail(`git ignores ${path}; make git track it first`);
      if (result.code !== 1) {
        process.stderr.write(result.stderr);
        fail(`${path} lies beyond a symbolic link or in a submodule; setup writes no file there`);
      }
    }
    if (opts.hosts.includes('claude')) await this.planSettings();
    await this.planConfig(opts, scratch);
    const oldLauncher = (await this.there('scripts/celetis')) || this.owned.files.includes('scripts/celetis');
    if (oldLauncher)
      this.warn(
        'scripts/celetis needs review by the owner of the active project; setup preserves its file and ownership; follow the plugin README, "Wire a product project" and "Explicit source repair"',
      );
    if (opts.hosts.includes('codex') && !(oldLauncher && (await this.there('.codex/rules/celetis.rules')))) {
      this.files.set('.codex/rules/celetis.rules', {
        contents:
          'prefix_rule(\n    pattern = ["gh", "pr", "merge"],\n    decision = "forbidden",\n    justification = "Use the bound plugin entrypoint with --agent codex land from the main checkout.",\n)\n',
      });
      this.owned.files.push('.codex/rules/celetis.rules');
    }
    await this.ownLines('.gitignore', ignores);
    await this.ownLines('.gitignore', opts.ignores, false);
    await this.ownLines('.gitattributes', ['.celetis.yaml text eol=lf']);
    const flow = [
      '## Celetis flow',
      `- The lanes are the skills of the plugin \`celetis\`, on the issues of \`${this.repo}\`.`,
      '- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `land` through the bound plugin entrypoint and personal host binding.',
      '- A lane never skips a step.',
      '- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.',
    ];
    for (const line of flow) this.own('AGENTS.md', line);
    let agents = section(await this.get(agentsPath), flow);
    if (opts.baseline) {
      const baseline = await readFile(opts.baseline, 'utf8');
      const heading = baseline.split('\n')[0] ?? '';
      if (hasLine(agents, heading)) this.warn(`AGENTS.md: ${heading} is there; setup leaves it`);
      else {
        if (agents && !agents.endsWith('\n')) agents += '\n';
        if (lines(agents).at(-1)) agents += '\n';
        agents += baseline;
        if (baseline && !baseline.endsWith('\n')) agents += '\n';
      }
    }
    this.files.set(agentsPath, { contents: agents });
    if (opts.hosts.includes('claude')) {
      for (const path of ['CLAUDE.md', '.claude/CLAUDE.md'])
        if ((await this.linked(path)) && !(await this.same(path, 'AGENTS.md')))
          this.warn(
            `${path} is a symbolic link to a file other than AGENTS.md; setup leaves it, so Claude reads AGENTS.md only if that file holds @AGENTS.md`,
          );
      for (const path of claudeFiles) await this.ownLines(path, ['@AGENTS.md']);
    }
    for (const path of ['docs/adr/README.md', 'docs/adr/template.md'])
      if (!(await this.there(path))) this.files.set(path, { contents: await readFile(join(plugin, path), 'utf8') });
    if (!(await this.there('docs/lessons/INDEX.md')))
      this.files.set('docs/lessons/INDEX.md', {
        contents: '# Lessons\n\n| Lesson | Tags | Date | Summary |\n|---|---|---|---|\n',
      });
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
    for (const [path, file] of this.files) {
      const absolute = join(this.cwd, path);
      if (!(await this.there(path)) || (await this.getUnplanned(path)) !== file.contents) {
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, file.contents);
      }
    }
  }
  async getUnplanned(path: string): Promise<string> {
    return readFile(join(this.cwd, path), 'utf8');
  }
  async makeLabels(): Promise<void> {
    const pages = await this.api<{ name: string }[][]>(
      ['--paginate', '--slurp', 'repos/{owner}/{repo}/labels?per_page=100'],
      'cannot list the labels',
    );
    const names = pages.flat().map((label) => label.name);
    for (const [name, description, color] of labels) {
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
      this.configError(checkout, error);
      return fail(`cannot read ${configFile}; fix the cause above first`);
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
    const config = this.read(this.top);
    if (!(config.worktreeSetup ?? '')) fail(`the main ${configFile} has no worktreeSetup to run`);
    await rm(await markerOf(path), { force: true });
    if ((await runSetup(path, config, this.top)) !== 0) fail(`the worktree setup failed in ${path}`);
  }
  async execute(argv: string[]): Promise<number> {
    const [command, ...args] = argv;
    if (command === 'check' && !args.length) {
      await this.check();
      return 0;
    }
    if (command === 'push' && !args.length) {
      await this.push();
      return 0;
    }
    if (command === 'lane' && args.length === 1 && args[0]) {
      await this.lane(args[0]);
      return 0;
    }
    if (command === 'try' && args[0] === '--remove') {
      if (args.length !== 1) return badUsage();
      await this.checkMain();
      await this.removeTestLane();
      return 0;
    }
    if (command !== 'write' && command !== 'try') return badUsage();
    const opts = options(args);
    this.diagnostic = command === 'try';
    await this.check();
    const scratch = await mkdtemp(join(tmpdir(), 'celetis-plan.'));
    try {
      if (command === 'try') {
        await this.removeTestLane();
        await this.live(['worktree', 'add', '--detach', this.testLane, 'HEAD']);
        this.cwd = this.testLane;
      }
      await this.plan(opts, scratch);
      if (command === 'write') await this.makeLabels();
      await this.writeTree();
      if (command === 'write') {
        const paths = await this.changedPaths();
        this.output(
          paths.length ? paths.map((path) => `setup: changed ${path}\n`).join('') : 'setup: no file changed\n',
        );
        return 0;
      }
      await this.commitWiring();
      const config = this.read(this.testLane);
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
    return await new Setup().execute(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message) console.error(message);
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
