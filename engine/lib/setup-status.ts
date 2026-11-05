import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readConfig } from './config.ts';
import { type Config, ConfigError, type Host } from './config-core.ts';
import type { Operation } from './operation.ts';
import { run } from './process.ts';
import { parseSetupRecord, type WiringRecord } from './setup-record.ts';
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
  markerPair,
  markerRepair,
  normal,
  object,
  projectFile,
  settings,
  settingsForm,
  trackingProblem,
  wiring,
} from './setup-wiring.ts';
import { github } from './tracker.ts';
import { labels } from './workflow.ts';

type Finding = Readonly<{ kind: 'missing' | 'invalid' | 'different' | 'blocked'; subject: string; cause: string }>;
type Origin = Readonly<{ host: string; repository: string }>;

function originRepository(url: string): (Origin & { ssh: boolean }) | null {
  const scp = /^(?:[^@/:]+@)?([^/:]+):(?!\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url);
  let origin: Origin & { ssh: boolean };
  if (scp) origin = { host: scp[1] as string, repository: `${scp[2]}/${scp[3]}`, ssh: true };
  else {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (!['https:', 'http:', 'ssh:', 'git:'].includes(parsed.protocol) || parts.length !== 2) return null;
    origin = {
      host: parsed.hostname,
      repository: `${parts[0]}/${(parts[1] as string).replace(/\.git$/, '')}`,
      ssh: parsed.protocol === 'ssh:',
    };
  }
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(origin.host) ? origin : null;
}

class Status {
  readonly findings: Finding[] = [];
  saved: WiringRecord | null = null;
  constructor(
    readonly root: string,
    readonly host: Host,
  ) {}

  add(kind: Finding['kind'], subject: string, cause: string): void {
    this.findings.push({ kind, subject, cause });
  }

  async read(path: string): Promise<Buffer | null | undefined> {
    const problem = (await destinationProblem(this.root, path)) ?? (await trackingProblem(this.root, path));
    if (problem) {
      this.add(problem.kind, path, problem.message);
      return undefined;
    }
    try {
      return await readFile(join(this.root, path));
    } catch (error) {
      const { code, message } = error as NodeJS.ErrnoException;
      if (code === 'ENOENT') return null;
      this.add('blocked', path, `cannot read the file: ${code ?? message}`);
      return undefined;
    }
  }

  json(path: string, source: Buffer): unknown {
    const text = source.toString('utf8');
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      this.add('invalid', path, 'is no valid JSON; repair it by hand');
      return undefined;
    }
    if (ambiguousJSON(text)) {
      this.add('invalid', path, 'is ambiguous; remove the duplicate object keys by hand');
      return undefined;
    }
    return value;
  }

  async origin(): Promise<Origin | null> {
    const result = await run('git', ['remote', 'get-url', 'origin'], { cwd: this.root });
    if (result.code === 2) {
      this.add('missing', 'origin', 'no remote origin; add the GitHub repository of the project as origin');
      return null;
    }
    if (result.code !== 0) {
      this.add('blocked', 'origin', `cannot read the remote origin: git exited ${result.code}`);
      return null;
    }
    const origin = originRepository(result.stdout.trim());
    if (origin === null) {
      this.add(
        'invalid',
        'origin',
        'the remote origin is no GitHub repository URL; set origin to the GitHub repository',
      );
      return null;
    }
    let host = origin.host;
    if (origin.ssh) {
      const config = await run('ssh', ['-G', host], { cwd: this.root });
      host = (config.code === 0 && /^hostname (\S+)$/m.exec(config.stdout)?.[1]) || host;
    }
    if (host !== 'github.com' && (await run('gh', ['auth', 'status', '--hostname', host], { cwd: this.root })).code) {
      this.add(
        'invalid',
        'origin',
        `the host ${host} of origin is no GitHub host that gh is logged in to; set origin to the GitHub repository`,
      );
      return null;
    }
    return { host, repository: origin.repository };
  }

  async config(): Promise<Config | null> {
    const tracking = await trackingProblem(this.root, configFile);
    if (tracking) this.add(tracking.kind, configFile, tracking.message);
    try {
      return readConfig(this.root);
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error;
      if (error.ioCode === 'ENOENT')
        this.add('missing', configFile, 'no file; setup writes landing, and suite with merge');
      else if (error.ioCode) this.add('blocked', configFile, `${error.field}: ${error.message}`);
      else this.add('invalid', configFile, `${error.field}: ${error.message}; repair it by hand`);
      return null;
    }
  }

  async configured(field: string, reference: string): Promise<void> {
    try {
      await projectFile(this.root, reference);
    } catch (error) {
      const { code, message } = error as NodeJS.ErrnoException;
      if (code === 'ENOENT') this.add('missing', reference, `${field} names no file; add the file to the project`);
      else if (code === 'EACCES' || code === 'EPERM') this.add('blocked', reference, `cannot read the file: ${code}`);
      else this.add('invalid', reference, `${field}: ${message}`);
    }
  }

  async instructions(): Promise<void> {
    let files: Awaited<ReturnType<typeof instructionFiles>>;
    try {
      files = await instructionFiles(this.root, this.host === 'claude');
    } catch (error) {
      this.add('blocked', 'instruction files', (error as Error).message.replace(/^setup: /, ''));
      const agents = await lstat(join(this.root, 'AGENTS.md')).catch((error: NodeJS.ErrnoException) =>
        error.code === 'ENOENT' ? null : undefined,
      );
      if (agents === undefined || agents?.isSymbolicLink()) return;
      files = { destination: 'AGENTS.md', imports: [], links: [] };
    }
    const path = files.destination;
    const bytes = await this.read(path);
    const source = bytes?.toString('latin1');
    const pair = source === undefined ? null : markerPair(source);
    if (bytes === null || pair?.kind === 'none') this.add('missing', path, 'no Celetis block; setup adds it');
    else if (pair?.kind === 'invalid') this.add('invalid', path, markerRepair);
    else if (source !== undefined && managedInstructions(path, source) !== source)
      this.add('different', path, 'the Celetis block is not the current pointer; setup refreshes it');
    if (this.host !== 'claude') return;
    for (const file of files.imports) {
      const text = await this.read(file);
      if (!text) continue;
      const required = claudeImport(file);
      const found = lines(text.toString('utf8'))
        .map(normal)
        .filter((line) => /^@(?:\.\.?\/)*AGENTS\.md$/.test(line));
      const wrong = found.filter((line) => line !== required);
      if (wrong.length)
        this.add(
          'different',
          file,
          `${wrong.join(', ')} is a wrong import; the owner must replace it with ${required}; setup preserves the file`,
        );
      else if (!found.length) this.add('missing', file, `no ${required} import; setup adds it`);
    }
    for (const link of files.links)
      this.add(
        'invalid',
        link,
        'is an unrelated symbolic link; the owner must review this instruction file so that it loads AGENTS.md',
      );
  }

  async claude(): Promise<void> {
    const source = await this.read(settings);
    if (source === null) {
      this.add('missing', settings, 'no file; setup writes the required entries');
      return;
    }
    if (source === undefined) return;
    const doc = this.json(settings, source);
    if (doc === undefined) return;
    if (!object(doc)) {
      this.add('invalid', settings, 'is no JSON object; repair it by hand');
      return;
    }
    if (object(doc.permissions) && Object.hasOwn(doc.permissions, 'allow') && !Array.isArray(doc.permissions.allow))
      this.add('invalid', settings, 'permissions.allow is no array; repair it by hand');
    const invalid = new Set<string>();
    for (const form of settingsForm()) {
      const parentKey = form.path[0] as string;
      const key = form.path[1] as string;
      const name = form.path.join('.');
      if (!Object.hasOwn(doc, parentKey)) {
        this.add(
          'missing',
          settings,
          `${name} ${form.item === undefined ? 'is missing' : `lacks ${form.item}`}; setup adds it`,
        );
        continue;
      }
      const parent = doc[parentKey];
      if (!object(parent)) {
        if (!invalid.has(parentKey)) this.add('invalid', settings, `${parentKey} is no object; repair it by hand`);
        invalid.add(parentKey);
        continue;
      }
      const present = Object.hasOwn(parent, key);
      const value = parent[key];
      if (form.item !== undefined) {
        if (present && !Array.isArray(value)) {
          if (!invalid.has(name)) this.add('invalid', settings, `${name} is no array; repair it by hand`);
          invalid.add(name);
        } else if (!present || !(value as unknown[]).includes(form.item))
          this.add('missing', settings, `${name} lacks ${form.item}; setup adds it`);
      } else if (!present) this.add('missing', settings, `${name} is missing; setup adds it`);
      else if (!isDeepStrictEqual(value, form.value))
        this.add(
          'different',
          settings,
          this.saved?.entries[settings]?.some((entry) => isDeepStrictEqual(entry, { path: form.path }))
            ? `${name} differs from the required form; setup refreshes the recorded owned value`
            : `${name} differs from the required form; setup preserves it; repair it by hand`,
        );
    }
  }

  async codex(): Promise<void> {
    const source = await this.read(codexRules);
    if (source === null) this.add('missing', codexRules, 'no file; setup writes the dedicated restriction');
    else if (source !== undefined && source.toString('utf8') !== codexRestriction)
      this.add(
        'different',
        codexRules,
        this.saved?.files.includes(codexRules)
          ? 'differs from the required form; setup refreshes the recorded owned file'
          : 'differs from the required form; setup preserves it; the owner must review the direct-merge restriction and obsolete allows (README, "Review old wiring")',
      );
  }

  async requiredLines(path: string, required: readonly string[]): Promise<void> {
    const source = await this.read(path);
    if (source === undefined) return;
    const text = source?.toString('utf8') ?? '';
    for (const line of required) if (!hasLine(text, line)) this.add('missing', path, `no line ${line}; setup adds it`);
  }

  async record(): Promise<void> {
    const source = await this.read(wiring);
    if (source === null) {
      this.add('missing', wiring, 'no record of setup; setup writes it');
      return;
    }
    if (source === undefined) return;
    let value: WiringRecord;
    try {
      value = parseSetupRecord(new TextDecoder('utf-8', { fatal: true }).decode(source), wiring);
    } catch {
      this.add('invalid', wiring, 'is no valid schema-1 setup record; repair or remove it by hand');
      return;
    }
    this.saved = value;
    const answers = value.answers;
    if (answers?.tracker !== 'github') this.add('missing', wiring, 'answers.tracker is missing; run setup with GitHub');
    if (!answers?.hosts) this.add('missing', wiring, 'answers.hosts is missing; run setup with the selected hosts');
    else if (!answers.hosts.includes(this.host))
      this.add('missing', wiring, `answers.hosts lacks ${this.host}; run setup with ${this.host}`);
  }

  async tracker({ host, repository: name }: Origin): Promise<void> {
    const tracker = github(this.root, undefined, { ...process.env, GH_HOST: host, GH_REPO: name });
    try {
      if (!object(await tracker.api(''))) throw new Error('malformed');
    } catch {
      this.add('blocked', name, 'cannot read the GitHub repository of origin with gh');
      return;
    }
    let found: string[];
    try {
      found = (await tracker.list('labels?per_page=100')).map((label) => {
        if (!object(label) || typeof label.name !== 'string') throw new Error('malformed');
        return label.name;
      });
    } catch {
      this.add('blocked', `${name} labels`, 'cannot read the labels of the GitHub repository with gh');
      return;
    }
    for (const label of labels) {
      if (found.includes(label)) continue;
      const variant = found.find((other) => other.toLowerCase() === label);
      if (variant === undefined)
        this.add('missing', `label ${label}`, 'the repository has no such label; setup makes it');
      else this.add('different', `label ${label}`, `the repository has ${variant}; rename it to ${label} by hand`);
    }
  }
}

export async function setupStatus(operation: Operation): Promise<number> {
  const { checkout, host } = operation;
  const out = (line: string) => process.stdout.write(`${line}\n`);
  if (checkout.active === null || checkout.main === null) {
    out(`setup: host ${host}`);
    out(`setup: missing: checkout: ${checkout.cwd} is in no Git checkout`);
    out('Enter the main checkout of the project, then run /celetis:setup there');
    return 3;
  }
  out(`setup: checkout ${checkout.active}`);
  out(`setup: host ${host}`);
  const status = new Status(checkout.active, host);
  const origin = await status.origin();
  const config = await status.config();
  if (config?.landing === 'merge') await status.configured('suite', config.suite);
  if (config?.worktreeSetup) await status.configured('worktreeSetup', config.worktreeSetup);
  await status.record();
  await status.instructions();
  if (host === 'claude') await status.claude();
  else await status.codex();
  await status.requiredLines('.gitignore', ignores);
  await status.requiredLines('.gitattributes', [attribute]);
  if (origin !== null) await status.tracker(origin);
  for (const { kind, subject, cause } of status.findings) out(`setup: ${kind}: ${subject}: ${cause}`);
  if (!status.findings.length) {
    out('setup: the required wiring is complete');
    return 0;
  }
  out(`Run /celetis:setup in the main checkout: ${checkout.main}`);
  return status.findings.some((finding) => finding.kind === 'blocked') ? 6 : 3;
}
