import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, lstat, mkdir, mkdtemp, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { CST, Parser } from 'yaml';
import { initializeAgentOrder, readAgentOrder, validateAgentOrder } from './lib/agent/order.ts';
import { CodeHostError } from './lib/code-host/code-host.ts';
import { HostError } from './lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts, type Operation } from './lib/command/operation.ts';
import { engineReader, readConfig } from './lib/config/config.ts';
import {
  type Config,
  ConfigError,
  configSchema,
  formatConfigError,
  type Host,
  validateWorktreeSetup,
} from './lib/config/core.ts';
import { type ExitCode, exits, labels, usage } from './lib/contract/contract.ts';
import { hostAdapter, type Need, requireCan } from './lib/host/hosts.ts';
import { checkClaudePolicy } from './lib/plugin/policy.ts';
import { childEnv, run } from './lib/process/process.ts';
import { engineRelease } from './lib/release/release.ts';
import { type Choice, services } from './lib/services/services.ts';
import { editJSON, jsonStyle, layoutJSON } from './lib/setup/json-layout.ts';
import { labelStyles } from './lib/setup/labels.ts';
import { parseSetupRecord, type SetupEntry, type WiringRecord } from './lib/setup/record.ts';
import { freshChoice, setupStatus } from './lib/setup/status.ts';
import {
  ambiguousJSON,
  attribute,
  claudeImport,
  codexRestriction,
  codexRules,
  configFile,
  destinationProblem,
  hasLine,
  ignores,
  instructionFiles,
  lines,
  managedInstructions,
  normal,
  object,
  settings,
  settingsForm,
  trackingProblem,
  wiring,
} from './lib/setup/wiring.ts';
import { installRecorder, markDefect, passOn } from './lib/state/events.ts';
import { laneFolder, laneFolderName } from './lib/state/state.ts';
import type { TrackerKind } from './lib/tracker/grammar.ts';
import { TrackerError } from './lib/tracker/tracker.ts';
import { markerOf, removeCheckout, runSetup, setupFile, worktrees } from './lib/workflow/worktree.ts';

const subject = 'chore(celetis): wire the project for the celetis lanes';
const setupPaths = [
  configFile,
  wiring,
  codexRules,
  settings,
  '.gitignore',
  '.gitattributes',
  'AGENTS.md',
  'CLAUDE.md',
  '.claude/CLAUDE.md',
];
type Options = {
  hosts: readonly Host[];
  tracker: TrackerKind;
  landing: 'pr' | 'merge';
  suite: string;
  setup: string;
  baseline: string;
  ignores: string[];
};
type Command =
  | { command: 'check' }
  | { command: 'status' }
  | { command: 'push' }
  | { command: 'remove' }
  | { command: 'lane'; path: string }
  | { command: 'write' | 'try'; options: Options };
type WiringChange = { kind: 'write'; contents: string | Buffer } | { kind: 'delete' };
const appendLine = (text: string, line: string) =>
  hasLine(text, line) ? text : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
function fail(message: string, code: ExitCode = exits.prerequisite): never {
  throw new HostError(`setup: ${message}`, code);
}
async function fromGitHub<T>(call: Promise<T>, message: string): Promise<T> {
  return call.catch((error: unknown) => {
    if (!(error instanceof TrackerError || error instanceof CodeHostError)) throw error;
    process.stderr.write(error.stderr ?? `${error.text}\n`);
    return fail(message, exits.blocked);
  });
}
function editConfig(source: string, updates: Map<string, string | number | undefined>): string {
  if (!updates.size) return source;
  if (!source)
    return [...updates]
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}\n`)
      .join('');
  const tokens = [...new Parser().parse(source)];
  const document = tokens.find((token) => token.type === 'document');
  if (
    document?.type !== 'document' ||
    !document.value ||
    (document.value.type !== 'block-map' && document.value.type !== 'flow-collection')
  )
    fail(`${configFile}: cannot edit its mapping; repair its fields by hand first`);
  const map = document.value;
  const flow = map.type === 'flow-collection';
  for (const [key, value] of updates) {
    const index = map.items.findIndex((item) => item.key && CST.resolveAsScalar(item.key)?.value === key);
    const item = map.items[index];
    if (item) {
      if (value !== undefined) {
        if (!item.value) fail(`${configFile}: ${key} has no editable value`);
        CST.setScalarValue(item.value, String(value), { type: typeof value === 'number' ? 'PLAIN' : 'QUOTE_DOUBLE' });
      } else {
        const retained = [
          ...item.start.filter((token) => token.type !== 'comma'),
          ...(item.sep ?? []).filter((token) => ['comment', 'newline'].includes(token.type)),
          ...(item.value && 'end' in item.value ? (item.value.end ?? []) : []),
          ...(item.value?.type === 'block-scalar'
            ? item.value.props.filter(
                (token): token is CST.SourceToken =>
                  token.type === 'comment' || token.type === 'space' || token.type === 'newline',
              )
            : []),
        ];
        map.items.splice(index, 1);
        const next = map.items[index];
        if (next) {
          if (flow && index === 0) next.start = next.start.filter((token) => token.type !== 'comma');
          next.start.unshift(...retained);
        } else if (map.type === 'flow-collection') map.end.unshift(...retained);
        else document.end = [...retained, ...(document.end ?? [])];
      }
    } else if (value !== undefined) {
      const token = [...new Parser().parse(`${JSON.stringify(key)}: ${JSON.stringify(value)}\n`)].find(
        (token) => token.type === 'document',
      );
      if (token?.type !== 'document' || !token.value || token.value.type !== 'block-map' || !token.value.items[0])
        fail(`${configFile}: cannot add ${key}`);
      const addition = token.value.items[0];
      if (flow) {
        const trailing = map.items.at(-1);
        if (trailing && !trailing.key && !trailing.value && trailing.start.some((token) => token.type === 'comma')) {
          addition.start.unshift(...trailing.start);
          map.items.pop();
        } else if (map.items.length)
          addition.start.push(
            { type: 'comma', source: ',', offset: 0, indent: 0 },
            { type: 'space', source: ' ', offset: 0, indent: 0 },
          );
        if (addition.value && 'end' in addition.value) addition.value.end = [];
        map.items.push(addition);
      } else {
        if (map.indent && map.items[0])
          map.items[0].start.unshift({ type: 'space', source: ' '.repeat(map.indent), offset: 0, indent: map.indent });
        map.items.unshift(addition);
      }
    }
  }
  return tokens.map((token) => CST.stringify(token)).join('');
}
function badUsage(): never {
  throw new HostError(usage('setup'), exits.usage);
}
function checkJSONKeys(path: string, source: string): void {
  if (ambiguousJSON(source)) fail(`${path} is ambiguous; fix duplicate object keys first`);
}

function options(argv: string[]): Options {
  const values: Record<string, string> = {};
  const ignores: string[] = [];
  const flags = ['--hosts', '--tracker', '--landing', '--suite', '--setup-file', '--ignore', '--baseline-file'];
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
  const tracker = values['--tracker'];
  const landing = values['--landing'];
  if (!hosts || !['claude', 'codex', 'claude,codex', 'codex,claude'].includes(hosts)) return badUsage();
  if (tracker !== 'github' && tracker !== 'local') return badUsage();
  if (landing !== 'pr' && landing !== 'merge') return badUsage();
  if (tracker === 'local' && landing === 'pr') return badUsage();
  const suite = values['--suite'] ?? '';
  if ((landing === 'merge') !== !!suite) return badUsage();
  const setup = values['--setup-file'] ?? '';
  try {
    validateWorktreeSetup(setup);
  } catch (error) {
    fail(`--setup-file ${setup}: ${error instanceof Error ? error.message : String(error)}`, exits.usage);
  }
  const absolute = (value = '') => (!value || isAbsolute(value) || win32.isAbsolute(value) ? value : resolve(value));
  return {
    hosts: validateAgentOrder(hosts.split(',')),
    tracker,
    landing,
    suite,
    setup,
    baseline: absolute(values['--baseline-file']),
    ignores,
  };
}

function parseCommand(argv: string[]): Command {
  const [command, ...args] = argv;
  if (command === 'check' || command === 'status' || command === 'push') {
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
  answers: Choice | null = null;
  top = '';
  testLane = '';
  trunk = '';
  ahead = 0;
  diagnostic = false;
  files = new Map<string, WiringChange>();
  previous: WiringRecord = { schema: 1, files: [], entries: {} };
  owned: { files: string[]; entries: Record<string, SetupEntry[]> } = { files: [], entries: {} };
  affected = new Set(setupPaths);

  async choice(): Promise<Choice> {
    const known = this.answers ?? this.config;
    if (known !== null) return known;
    if (await hasConfig(this.cwd))
      try {
        return readConfig(this.cwd);
      } catch (error) {
        if (!(error instanceof ConfigError)) throw error;
      }
    return freshChoice;
  }

  output(text: string): void {
    (this.diagnostic ? process.stderr : process.stdout).write(text);
  }
  warn(message: string): void {
    this.output(`setup: warning: ${message}\n`);
  }
  review(path: string, evidence: string): void {
    this.warn(
      `${path}: ${evidence}; the owner must review this old wiring; setup preserves the content; follow https://github.com/ddinkov10/celetis/blob/main/plugins/celetis/docs/setup.md#review-old-wiring (plugins/celetis/docs/setup.md, "Review old wiring")`,
    );
  }
  async git(args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
    const result = await run('git', args, { cwd: this.cwd, env });
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
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
      child.once('close', (code) => resolveCode(code ?? exits.blocked));
    });
    if (code !== 0) {
      if (message) fail(message, exits.blocked);
      throw new HostError('', exits.blocked);
    }
  }
  async checkMain(): Promise<void> {
    try {
      this.top = resolve(await this.git(['rev-parse', '--show-toplevel']));
    } catch (error) {
      throw new HostError(
        error instanceof Error ? error.message : String(error),
        error instanceof HostError ? error.code : exits.blocked,
      );
    }
    if (
      (await this.git(['rev-parse', '--path-format=absolute', '--git-dir'])) !==
      (await this.git(['rev-parse', '--path-format=absolute', '--git-common-dir']))
    )
      fail(`run setup in the main checkout, not in a linked worktree: ${this.top}`);
    this.cwd = this.top;
    this.testLane = join(laneFolder(this.top), 'setup-try');
  }
  async checkTrunk(): Promise<void> {
    await this.checkMain();
    const choice = await this.choice();
    const { codeHost } = services(choice, this.cwd);
    const message =
      choice.landing === 'pr'
        ? `origin is not a ${codeHost.name} repository that gh can read`
        : `cannot read the default branch from ${codeHost.name}`;
    let repo: Awaited<ReturnType<typeof codeHost.repository>>;
    if (choice !== freshChoice) repo = await fromGitHub(codeHost.repository(), message);
    else
      try {
        repo = await codeHost.repository();
      } catch (first) {
        if (!(first instanceof TrackerError || first instanceof CodeHostError)) throw first;
        repo = await services({ ...freshChoice, landing: 'merge' }, this.cwd)
          .codeHost.repository()
          .catch(() => fromGitHub(Promise.reject(first), message));
      }
    this.trunk = repo.defaultBranch;
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
    const result = await run(
      'git',
      ['--literal-pathspecs', 'status', '--porcelain', '-z', '--untracked-files=all', '--', ...this.affected],
      {
        cwd: this.cwd,
      },
    );
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
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
    if (tracked.code !== 0) fail(`cannot check ${reference} in the index: ${tracked.stderr.trimEnd()}`, exits.blocked);
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
      if (result.code !== 0) fail(`cannot check ${reference}: ${result.stderr.trimEnd()}`, exits.blocked);
    }
    const hash = await run('git', ['hash-object', `--path=${reference}`, '--', reference], { cwd: this.cwd });
    if (hash.code !== 0) fail(`cannot check ${reference}: ${hash.stderr.trimEnd()}`, exits.blocked);
    if (hash.stdout.trimEnd() !== entry?.split(' ')[1])
      fail(`${reference} differs in the working tree from the index; commit it first`);
  }
  async check(reference = ''): Promise<void> {
    await this.checkTrunk();
    if (reference) await this.checkSetupSource(reference);
    if (/^i\/(?:crlf|mixed)/.test(await this.git(['ls-files', '--eol', '--', configFile])))
      fail(`the index holds ${configFile} with CRLF line endings; convert it to LF and commit it first`);
    const record = await this.readRecord();
    for (const path of [...record.files, ...Object.keys(record.entries)]) this.affected.add(path);
    const dirty = await this.changedPaths();
    if (dirty.length) fail(`commit or drop the uncommitted changes of these files first: ${dirty.join(' ')}`);
    await this.checkStaged();
  }
  async get(path: string): Promise<string> {
    await this.checkDestination(path);
    const planned = this.files.get(path);
    if (planned)
      return planned.kind === 'delete'
        ? ''
        : Buffer.isBuffer(planned.contents)
          ? planned.contents.toString(this.byteFile(path) ? 'latin1' : 'utf8')
          : planned.contents;
    try {
      return await readFile(join(this.cwd, path), this.byteFile(path) ? 'latin1' : 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
      fail(`cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`, exits.blocked);
    }
  }
  async recordSource(): Promise<{ path: string; text: string } | undefined> {
    await this.checkDestination(wiring);
    let source: Buffer;
    try {
      source = await readFile(join(this.cwd, wiring));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      fail(`cannot read ${wiring}: ${error instanceof Error ? error.message : String(error)}`, exits.blocked);
    }
    try {
      return { path: wiring, text: new TextDecoder('utf-8', { fatal: true }).decode(source) };
    } catch {
      fail(`${wiring}: need valid UTF-8`, exits.usage);
    }
  }
  async readRecord(): Promise<WiringRecord> {
    const source = await this.recordSource();
    return source ? parseSetupRecord(source.text, source.path) : { schema: 1, files: [], entries: {} };
  }
  private async checkDestination(path: string): Promise<void> {
    const problem = await destinationProblem(this.cwd, path);
    if (problem) fail(problem.message, problem.kind === 'blocked' ? exits.blocked : exits.prerequisite);
  }
  async there(path: string): Promise<boolean> {
    return (
      (await lstat(join(this.cwd, path)).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        fail(`cannot inspect ${path}: ${error.message}`, exits.blocked);
      })) !== null
    );
  }
  byteFile(path: string): boolean {
    return ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md', '.gitignore', '.gitattributes'].includes(path);
  }
  claimed(path: string, entry: SetupEntry): boolean {
    return (this.previous.entries[path] ?? []).some((old) => isDeepStrictEqual(old, entry));
  }
  put(path: string, contents: string | Buffer): void {
    this.files.set(path, {
      kind: 'write',
      contents: typeof contents === 'string' && this.byteFile(path) ? Buffer.from(contents, 'latin1') : contents,
    });
  }
  own(path: string, entry: SetupEntry): void {
    this.owned.entries[path] ??= [];
    this.owned.entries[path].push(entry);
  }
  async ownLines(path: string, values: string[], owned = true): Promise<void> {
    let text = await this.get(path);
    for (const value of values) {
      if (owned) this.own(path, value);
      text = appendLine(text, Buffer.from(value).toString('latin1'));
    }
    this.put(path, text);
  }
  async planSettings(selected: boolean, recordSource: string): Promise<void> {
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
    const wanted = selected ? settingsForm() : [];
    for (const entry of this.previous.entries[settings] ?? []) {
      if (
        typeof entry === 'string' ||
        !('path' in entry) ||
        wanted.some((form) =>
          isDeepStrictEqual({ path: form.path, ...(form.item === undefined ? {} : { item: form.item }) }, entry),
        )
      )
        continue;
      const group = doc[entry.path[0] as string];
      if (!object(group)) continue;
      const key = entry.path[1] as string;
      if (entry.item === undefined) {
        if (Object.hasOwn(group, key)) {
          delete group[key];
          if (!Object.keys(group).length) delete doc[entry.path[0] as string];
          changed = true;
        }
      } else if (Array.isArray(group[key])) {
        const value = group[key] as unknown[];
        const remaining = value.filter((item) => item !== entry.item);
        if (remaining.length !== value.length) {
          group[key] = remaining;
          changed = true;
        }
      }
    }
    for (const form of wanted) {
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
      } else if (this.claimed(settings, { path: form.path })) {
        if (!isDeepStrictEqual(value, form.value)) {
          group[key] = form.value;
          changed = true;
        }
        this.own(settings, { path: form.path });
      } else if (isDeepStrictEqual(value, form.value)) this.own(settings, { path: form.path });
      else this.warn(`${settings}: ${form.path.join('.')} differs from the current form; setup leaves it`);
    }
    if (!selected)
      for (const form of settingsForm()) {
        const group = doc[form.path[0] as string];
        const value = object(group) ? group[form.path[1] as string] : undefined;
        if (form.item === undefined ? value !== undefined : Array.isArray(value) && value.includes(form.item))
          this.review(
            settings,
            `${form.path.join('.')}${form.item === undefined ? '' : `: ${form.item}`}; integration for the unselected Claude host`,
          );
      }
    try {
      checkClaudePolicy([{ path: join(this.cwd, settings), value: doc }]);
    } catch (error) {
      this.warn((error as Error).message);
    }
    if (!changed) return;
    if (!(await this.there(settings))) {
      this.put(settings, `${layoutJSON(doc, jsonStyle('', recordSource))}\n`);
      return;
    }
    const bytes = await readFile(join(this.cwd, settings)).catch((error: unknown) =>
      fail(`cannot read ${settings}: ${error instanceof Error ? error.message : String(error)}`, exits.blocked),
    );
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      fail(`${settings}: need valid UTF-8; repair the file by hand first`);
    }
    const replaced = settingsForm()
      .filter((form) => form.item === undefined)
      .map((form) => form.path);
    const edited = editJSON(text, doc, jsonStyle(text, recordSource), replaced);
    let value: unknown;
    try {
      value = JSON.parse(edited);
    } catch {}
    if (!isDeepStrictEqual(value, doc))
      fail(`cannot preserve unrelated values of ${settings}; repair the file by hand first`);
    this.put(settings, edited);
  }
  async configError(checkout: string, error: unknown): Promise<void> {
    if (!(error instanceof ConfigError)) throw error;
    console.error(formatConfigError(checkout, error, await engineReader()));
  }
  async planConfig(opts: Options, scratch: string): Promise<void> {
    let original: Partial<Config> & { suite?: string } = {};
    if (await this.there(configFile)) {
      try {
        original = this.config ??= readConfig(this.cwd);
      } catch (error) {
        await this.configError(this.cwd, error);
        fail(`cannot read ${configFile}; fix the cause above first`, exits.usage);
      }
    }
    const desired = { ...original };
    const updates = new Map<string, string | number | undefined>();
    const wanted: (readonly ['schema' | 'tracker' | 'landing' | 'suite', string | number])[] = [
      ['schema', configSchema],
      ['tracker', opts.tracker],
      ['landing', opts.landing],
    ];
    const landing =
      this.claimed(configFile, { path: ['landing'] }) || original.landing === undefined
        ? opts.landing
        : original.landing;
    if (opts.suite && landing === 'merge') wanted.push(['suite', opts.suite]);
    if (landing === 'pr' && original.suite !== undefined && !this.claimed(configFile, { path: ['suite'] }))
      fail(`${configFile}: suite is unowned and blocks landing pr; remove suite by hand first`);
    for (const entry of this.previous.entries[configFile] ?? []) {
      if (typeof entry !== 'string' && 'path' in entry && !wanted.some(([key]) => key === entry.path[0])) {
        const key = entry.path[0] as keyof typeof desired;
        if (Object.hasOwn(desired, key)) {
          delete desired[key];
          updates.set(key, undefined);
        }
      }
    }
    for (const [key, value] of wanted) {
      if (original[key] === undefined || this.claimed(configFile, { path: [key] }) || original[key] === value) {
        this.own(configFile, { path: [key] });
        if (desired[key] !== value) {
          Object.assign(desired, { [key]: value });
          updates.set(key, value);
        }
      } else this.warn(`${configFile}: ${key} is ${original[key]}, not ${value}; setup leaves it`);
    }
    if (opts.setup) {
      if (original.worktreeSetup !== undefined) {
        if (original.worktreeSetup !== opts.setup)
          this.warn(`${configFile}: worktreeSetup differs from the requested setup reference; setup leaves it`);
      } else {
        desired.worktreeSetup = opts.setup;
        updates.set('worktreeSetup', opts.setup);
      }
    }
    const source = await this.get(configFile);
    const proposed = editConfig(source, updates);
    if (proposed !== source) {
      await writeFile(join(scratch, configFile), proposed);
      let actual: Config;
      try {
        actual = readConfig(scratch);
      } catch (error) {
        await this.configError(scratch, error);
        fail(`cannot update ${configFile}; repair its fields by hand first`, exits.usage);
      }
      if (!isDeepStrictEqual(actual, desired))
        fail(`cannot preserve unrelated values of ${configFile}; repair its fields by hand first`);
      this.put(configFile, proposed);
    }
  }
  async retireLines(agentsPath: string, hosts: readonly Host[]): Promise<void> {
    for (const [recordedPath, entries] of Object.entries(this.previous.entries)) {
      const path = recordedPath === 'AGENTS.md' ? agentsPath : recordedPath;
      const retiring = entries
        .filter((entry): entry is string => typeof entry === 'string')
        .filter((entry) => {
          if (path === '.gitignore') return !ignores.includes(entry);
          if (path === '.gitattributes') return entry !== '.celetis.yaml text eol=lf';
          if (recordedPath === 'CLAUDE.md' || recordedPath === '.claude/CLAUDE.md')
            return (
              !hosts.includes('claude') || entry !== `@${relative(dirname(path), 'AGENTS.md').split(sep).join('/')}`
            );
          return true;
        });
      const marker = entries.some((entry) => typeof entry !== 'string' && 'start' in entry);
      if ((!retiring.length && (!marker || path === agentsPath)) || !(await this.there(path))) continue;
      let source = await this.get(path);
      if (marker && path !== agentsPath) {
        managedInstructions(path, source);
        const markers = [...source.matchAll(/(?:^|\n)(<!-- CELETIS:(START|END) -->)(?=\r?\n|$)/g)];
        const [start, end] = markers;
        if (start && end)
          source =
            source.slice(0, start.index + (start[0].startsWith('\n') ? 1 : 0)) +
            source.slice(end.index + end[0].length);
      }
      const physical = source.match(/[^\n]*\n|[^\n]+$/g) ?? [];
      for (const entry of retiring) {
        const matches = physical.flatMap((line, index) => (normal(line.replace(/\n$/, '')) === entry ? [index] : []));
        if (matches.length > 1)
          fail(`${path}: repeated recorded line ${entry}; remove the ambiguous copy by hand first`);
        const index = matches[0];
        if (index === undefined) continue;
        physical[index] = '';
      }
      source = physical.join('');
      this.put(path, source);
    }
  }
  async reportOldWiring(): Promise<void> {
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
    const allow = object(doc) && object(doc.permissions) ? doc.permissions.allow : undefined;
    for (const item of new Set(Array.isArray(allow) ? allow : []))
      if (typeof item === 'string' && /^(Bash|PowerShell)\((\.\/)?(scripts\/celetis|celetis)([ )])/.test(item))
        this.review(settings, `permissions.allow: ${item}`);
    if (object(doc) && object(doc.enabledPlugins) && Object.hasOwn(doc.enabledPlugins, 'celetis@celetis'))
      this.review(settings, 'enabledPlugins.celetis@celetis');
    if (object(doc) && object(doc.extraKnownMarketplaces) && Object.hasOwn(doc.extraKnownMarketplaces, 'celetis'))
      this.review(settings, 'extraKnownMarketplaces.celetis');
  }
  async plan(opts: Options, scratch: string): Promise<void> {
    if (opts.baseline) {
      try {
        if (!(await stat(opts.baseline)).isFile()) fail(`cannot read ${opts.baseline}`, exits.usage);
        await access(opts.baseline, fsConstants.R_OK);
      } catch {
        fail(`cannot read ${opts.baseline}`, exits.usage);
      }
    }
    this.previous = await this.readRecord();
    const recordSource = (await this.recordSource())?.text ?? '';
    for (const path of [...this.previous.files, ...Object.keys(this.previous.entries)]) this.affected.add(path);
    const dirty = await this.changedPaths();
    if (dirty.length) fail(`commit or drop the uncommitted changes of these files first: ${dirty.join(' ')}`);
    const baseline = opts.baseline ? await readFile(opts.baseline, 'utf8') : '';
    const touched = [configFile, wiring, '.gitignore', '.gitattributes'];
    if (opts.hosts.includes('codex')) touched.push(codexRules);
    if (opts.hosts.includes('claude') || (await this.there(settings))) touched.push(settings);
    for (const path of touched) await this.checkDestination(path);
    const instructions = await instructionFiles(this.cwd, opts.hosts.includes('claude'));
    const agentsPath = instructions.destination;
    const claudeFiles = instructions.imports;
    touched.push(agentsPath);
    if (opts.hosts.includes('claude')) touched.push(...claudeFiles);
    this.affected.add(agentsPath);
    for (const path of new Set([...touched, ...this.affected])) {
      if (path === 'AGENTS.md' && agentsPath !== path) continue;
      if (!touched.includes(path) && !(this.previous.files.includes(path) || this.previous.entries[path])) continue;
      await this.checkDestination(path);
      const problem = await trackingProblem(this.cwd, path);
      if (problem) {
        if (problem.stderr !== undefined) process.stderr.write(problem.stderr);
        fail(problem.message);
      }
    }
    await this.retireLines(agentsPath, opts.hosts);
    const source = Buffer.from(await this.get(agentsPath), 'latin1');
    const agents = Buffer.from(managedInstructions(agentsPath, source.toString('latin1')), 'latin1');
    this.put(agentsPath, agents);
    this.own(agentsPath, { start: '<!-- CELETIS:START -->', end: '<!-- CELETIS:END -->' });
    if (opts.hosts.includes('claude') || (await this.there(settings)))
      await this.planSettings(opts.hosts.includes('claude'), recordSource);
    await this.planConfig(opts, scratch);
    if (opts.hosts.includes('codex')) {
      const path = codexRules;
      const contents = codexRestriction;
      if (!(await this.there(path)) || this.previous.files.includes(path)) {
        this.put(path, contents);
        this.owned.files.push(path);
      } else if ((await this.get(path)) === contents) this.owned.files.push(path);
      else
        this.warn(
          `${path} differs from the required form; setup preserves it; the owner must review the direct-merge restriction and obsolete allows; follow https://github.com/ddinkov10/celetis/blob/main/plugins/celetis/docs/setup.md#review-old-wiring (plugins/celetis/docs/setup.md, "Review old wiring")`,
        );
    }
    if (
      !opts.hosts.includes('codex') &&
      !this.previous.files.includes('.codex/rules/celetis.rules') &&
      (await this.there('.codex/rules/celetis.rules'))
    )
      this.review('.codex/rules/celetis.rules', 'integration for the unselected Codex host');
    await this.ownLines('.gitignore', ignores);
    await this.ownLines('.gitignore', opts.ignores, false);
    await this.ownLines('.gitattributes', [attribute]);
    if (baseline) {
      const heading = baseline.split('\n')[0] ?? '';
      if (hasLine(agents.toString(), heading)) this.warn(`AGENTS.md: ${heading} is there; setup leaves it`);
      else {
        let addition = agents.at(-1) === 10 ? '' : '\n';
        if (lines(agents.toString() + addition).at(-1)) addition += '\n';
        addition += baseline;
        if (!baseline.endsWith('\n')) addition += '\n';
        this.put(agentsPath, Buffer.concat([agents, Buffer.from(addition)]));
      }
    }
    if (opts.hosts.includes('claude')) {
      for (const path of instructions.links)
        this.warn(
          `${path} is an unrelated symbolic link; setup preserves it; loading AGENTS.md requires owner review of that instruction file`,
        );
      for (const path of claudeFiles) {
        const required = claudeImport(path);
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
    for (const path of this.previous.files)
      if (path !== wiring && !this.owned.files.includes(path) && (await this.there(path)))
        this.files.set(path, { kind: 'delete' });
    await this.reportOldWiring();
    this.owned.files.push(wiring);
    const entries = Object.fromEntries(
      Object.entries(this.owned.entries).map(([file, items]) => [
        file,
        [...new Map(items.map((item) => [JSON.stringify(sortedKeys(item)), item])).values()].sort(compare),
      ]),
    );
    const record = {
      schema: 1,
      answers: { hosts: opts.hosts, tracker: opts.tracker },
      release: await engineRelease(resolve(import.meta.dir, '..')),
      files: [...new Set(this.owned.files)].sort(),
      entries,
    };
    const value = sortedKeys(record);
    const style = jsonStyle(recordSource, await this.get(settings));
    const contents = `${layoutJSON(value, style)}${style.newline}`;
    parseSetupRecord(contents, wiring);
    if (!(await this.there(wiring)) || !isDeepStrictEqual(JSON.parse(recordSource), value)) this.put(wiring, contents);
    for (const path of this.files.keys()) this.affected.add(path);
  }
  async writeTree(): Promise<void> {
    for (const path of this.files.keys()) await this.checkDestination(path);
    for (const [path, file] of this.files) {
      try {
        const absolute = join(this.cwd, path);
        await this.checkDestination(path);
        if (file.kind === 'delete') {
          if (await this.there(path)) await unlink(absolute);
          continue;
        }
        const contents = typeof file.contents === 'string' ? Buffer.from(file.contents) : file.contents;
        if (!(await this.there(path)) || !(await this.getUnplanned(path)).equals(contents)) {
          await this.checkDestination(path);
          await mkdir(dirname(absolute), { recursive: true });
          await this.checkDestination(path);
          await writeFile(absolute, file.contents);
          if (path === configFile) this.config = await this.read(this.cwd);
        }
      } catch (error) {
        fail(
          `cannot write ${path}: ${error instanceof Error ? error.message : String(error)}; review the partial product diff before retrying`,
          error instanceof HostError ? error.code : error instanceof ConfigError ? exits.usage : exits.blocked,
        );
      }
    }
  }
  async getUnplanned(path: string): Promise<Buffer> {
    await this.checkDestination(path);
    return readFile(join(this.cwd, path));
  }
  async makeLabels(): Promise<void> {
    const { tracker } = services(await this.choice(), this.cwd);
    const names = await fromGitHub(tracker.labels(), 'cannot list the labels');
    for (const name of labels) {
      const [description, color] = labelStyles[name];
      const found = names.find((existing) => existing.toLowerCase() === name.toLowerCase());
      if (found !== undefined) {
        if (found !== name) this.warn(`the label ${found} differs in case from ${name}; setup leaves it`);
      } else {
        await fromGitHub(tracker.createLabel({ name, description, color }), `cannot make the label ${name}`);
        this.output(`setup: made the label ${name}\n`);
      }
    }
  }
  async stage(paths: string[]): Promise<void> {
    for (const path of paths) await this.git(['--literal-pathspecs', 'add', '--', path]);
  }
  async push(): Promise<void> {
    await this.checkTrunk();
    await this.checkStaged();
    const current = await this.readRecord();
    let previous: Pick<WiringRecord, 'files' | 'entries'> = { files: [], entries: {} };
    const head = await run('git', ['show', `HEAD:${wiring}`], { cwd: this.cwd });
    if (head.code === 0) previous = parseSetupRecord(head.stdout, `HEAD:${wiring}`);
    for (const path of [
      ...current.files,
      ...previous.files,
      ...Object.keys(current.entries),
      ...Object.keys(previous.entries),
    ])
      this.affected.add(path);
    const paths = await this.changedPaths();
    for (const path of paths) await this.checkDestination(path);
    if (!paths.length) {
      this.output('setup: no file changed; nothing to commit\n');
      if (!this.ahead) return;
    } else {
      await this.stage(paths);
      try {
        await this.live(['commit', '-q', '-m', subject]);
      } catch {
        await this.git(['--literal-pathspecs', 'reset', '-q', '--', ...paths]);
        fail('the commit failed; the files stay uncommitted', exits.blocked);
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
      fail(`${laneFolderName}/setup-try is no worktree of git; remove it first`);
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
      fail('the commit failed in the test lane', exits.blocked);
    }
  }
  async read(checkout: string): Promise<Config> {
    try {
      return readConfig(checkout);
    } catch (error) {
      if (error instanceof ConfigError)
        throw new HostError(formatConfigError(checkout, error, await engineReader()), exits.usage);
      throw error;
    }
  }
  async lane(input: string): Promise<void> {
    const result = await run('git', ['-C', input, 'rev-parse', '--show-toplevel'], { cwd: this.cwd });
    const path = result.code === 0 ? resolve(result.stdout.trimEnd()) : '';
    await this.checkMain();
    const contained = relative(laneFolder(this.top), path);
    if (
      !path ||
      !contained ||
      isAbsolute(contained) ||
      contained === '..' ||
      contained.startsWith(`..${sep}`) ||
      path === this.testLane ||
      !(await worktrees(this.cwd)).some((tree) => tree.path === path)
    )
      fail(`${input} is no lane worktree in ${laneFolderName}/ of this repository`, exits.usage);
    const target = await createOperation(await locateCheckouts(path), this.operation.selection, 'active');
    const config = target.mainConfig as Config;
    if (!(config.worktreeSetup ?? '')) fail(`the main ${configFile} has no worktreeSetup to run`);
    await rm(await markerOf(path), { force: true });
    const code = await runSetup(path, config, this.top).catch((error: unknown) => {
      if (!(error instanceof HostError)) throw error;
      console.error(error.message);
      return fail(`the worktree setup failed in ${path}`, error.code);
    });
    if (code !== 0) fail(`the worktree setup failed in ${path}`, exits.blocked);
  }
  async execute(input: Exclude<Command, { command: 'status' }>): Promise<ExitCode> {
    const { command } = input;
    if (this.operation.checkout.common === null) fail('need a Git checkout');
    if (input.command === 'check') {
      this.diagnostic = true;
      await this.check();
      const record = await this.readRecord();
      process.stdout.write(`${JSON.stringify({ answers: record.answers ?? {} })}\n`);
      return exits.done;
    }
    if (input.command === 'push') {
      await this.push();
      return exits.done;
    }
    if (input.command === 'lane') {
      await this.lane(input.path);
      return exits.done;
    }
    if (input.command === 'remove') {
      await this.checkMain();
      await this.removeTestLane();
      return exits.done;
    }
    const opts = input.options;
    this.answers = { tracker: opts.tracker, landing: opts.landing };
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
          ? (await createOperation(checkout, this.operation.selection, 'active')).activeConfig
          : null;
      }
      await this.plan(opts, scratch);
      await readAgentOrder(this.operation.checkout.common);
      if (command === 'write') await this.makeLabels();
      await this.writeTree();
      if (command === 'write') {
        await initializeAgentOrder(this.operation.checkout.common, opts.hosts);
        const paths = await this.changedPaths();
        this.output(
          paths.length ? paths.map((path) => `setup: changed ${path}\n`).join('') : 'setup: no file changed\n',
        );
        if (paths.length)
          this.output(
            'setup: valid recorded ownership can refresh or remove manual edits within owned keys and dedicated files; unowned product content stays unchanged\n',
          );
        return exits.done;
      }
      await this.commitWiring();
      const config = this.config as Config;
      try {
        return passOn(await runSetup(this.testLane, config, this.top));
      } finally {
        process.stdout.write(`${config.worktreeSetup ? '\n' : ''}${this.testLane}\n`);
      }
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }
}

const need: Need = { kind: 'setup', command: 'setup' };

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    const input = parseCommand(args);
    const checkout = await locateCheckouts(process.cwd());
    const selection = { explicit, environment: process.env.CELETIS_AGENT };
    if (input.command === 'status') {
      const status = await createOperation(checkout, selection, 'host');
      requireCan(status.host, need, 'celetis');
      return await setupStatus(status);
    }
    const config = checkout.main !== null && (await hasConfig(checkout.main));
    const full = ['check', 'write', 'lane', 'try'].includes(input.command);
    const operation = await createOperation(checkout, selection, full && config ? 'main' : 'host');
    requireCan(operation.host, need, 'celetis');
    await hostAdapter(operation.host).checkHome();
    return await new Setup(operation).execute(input);
  } catch (error) {
    if (!(error instanceof ConfigError)) markDefect(error);
    const message = error instanceof Error ? error.message : String(error);
    if (message) console.error(message);
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('setup');
  process.exitCode = await main(process.argv.slice(2));
}
