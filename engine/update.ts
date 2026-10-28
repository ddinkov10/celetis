import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Host } from './lib/config-core.ts';
import { codexRequest, HostError, installedRoot, NotInstalled, requireBun, updateHint } from './lib/host.ts';
import { commandInput } from './lib/operation.ts';
import {
  bindUpdateHome,
  claudeInstallation,
  codexPlugin,
  configHome,
  git,
  installedRevision,
  jsonFile,
  nativeJson,
  object,
} from './lib/plugin-metadata.ts';
import { checkClaudePolicy, claudePolicy, requireUpdatePolicy } from './lib/plugin-policy.ts';
import { bunArgs, childEnv, type run } from './lib/process.ts';
import { installProgram, programRevision, programSource, readProgram } from './lib/program.ts';
import { UpdateLock, withPluginRead } from './lib/update-lock.ts';

export type UpdateTarget = { home: string; root: string; source: string; installed: string; target: string };
export type UpdateOffer = UpdateTarget & { host: Host };
export type Installation = {
  host: Host;
  home: string;
  root: string;
  source: string;
  ref: string;
  installed: string;
  scope?: string;
  registered?: unknown;
  siblings: string[];
};
type Offer = Omit<UpdateTarget, 'home'> & { ref: string };
export type Part =
  | { part: 'program' | Host; skipped: string }
  | { part: 'program' | Host; error: string }
  | ({ part: 'program' } & Offer)
  | ({ part: Host } & UpdateTarget & { ref: string });
const revision = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

function gitSource(value: unknown): { source: string; ref: string } {
  if (!object(value)) throw new HostError('update: no configured Git source; inspect the native marketplace record');
  let source: unknown;
  if (value.source === 'git') source = value.url;
  else if (value.source === 'settings' && value.name === 'celetis' && Array.isArray(value.plugins)) {
    const plugins = value.plugins.filter((plugin) => object(plugin) && plugin.name === 'celetis');
    const plugin = plugins[0];
    if (plugins.length !== 1 || !object(plugin) || !object(plugin.source) || plugin.source.source !== 'url')
      throw new HostError('update: invalid native inline marketplace source');
    return gitSource({ source: 'git', url: plugin.source.url, ref: plugin.source.ref });
  } else if (value.source === 'github' && typeof value.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(value.repo))
    source = `https://github.com/${value.repo}.git`;
  if (
    typeof source !== 'string' ||
    !source ||
    [...source].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    !(/^(https?|ssh|git|file):\/\//.test(source) || source.startsWith('/') || /^[\w.-]+@[\w.-]+:/.test(source))
  )
    throw new HostError('update: unsupported configured Git source; use a native Git or GitHub marketplace source');
  const ref = value.ref ?? 'HEAD';
  if (
    typeof ref !== 'string' ||
    !ref ||
    ref.startsWith('-') ||
    [...ref].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  )
    throw new HostError('update: invalid configured Git ref; repair the native marketplace source');
  return { source, ref };
}

async function claudeRegistrations(records: unknown, scope: unknown, version: unknown, root: string) {
  const matches: Record<string, unknown>[] = [];
  if (Array.isArray(records))
    for (const record of records)
      if (
        object(record) &&
        record.scope === scope &&
        record.version === version &&
        typeof record.installPath === 'string' &&
        isAbsolute(record.installPath) &&
        ![...record.installPath].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) &&
        (await realpath(record.installPath).catch(() => null)) === root
      )
        matches.push(record);
  return matches;
}

export async function installation(host: Host, cwd: string): Promise<Installation> {
  const home = await bindUpdateHome(host);
  let siblings: string[] = [];
  let scope: string | undefined;
  let registeredSource: unknown;
  let root: string;
  let nativeRevision: string | undefined;
  let configured: { source: string; ref: string };
  if (host === 'claude') {
    const list = await nativeJson(host, ['plugin', 'list', '--json'], cwd);
    const installation = await claudeInstallation(list, cwd);
    const selected = installation.records;
    const record = selected[0];
    if (selected.length !== 1 || !record)
      throw new HostError(
        'update: Claude installation is disabled, missing, or ambiguous; repair the enabled Celetis identity',
      );
    root = installation.root;
    scope = typeof record.scope === 'string' ? record.scope : undefined;
    const manifest = await jsonFile(join(root, '.claude-plugin/plugin.json'));
    if (manifest.name !== 'celetis') throw new HostError(`update: wrong installed plugin identity in ${root}`);
    const policies = await claudePolicy(cwd);
    checkClaudePolicy(policies);
    const nativeMarket = policies.find(
      (record) => record.path === join(configHome(host), 'plugins/known_marketplaces.json'),
    )?.value.celetis;
    registeredSource = object(nativeMarket) ? nativeMarket.source : undefined;
    let configuredSource: unknown;
    for (const { value } of policies) {
      const markets = value.extraKnownMarketplaces;
      const market = object(markets) ? markets.celetis : value.celetis;
      if (object(market) && Object.hasOwn(market, 'source')) configuredSource = market.source;
    }
    configured = gitSource(configuredSource);
    const registry = await jsonFile(join(configHome(host), 'plugins/installed_plugins.json'), true);
    if (registry.version === 2 && object(registry.plugins)) {
      const records = registry.plugins['celetis@celetis'];
      if (Array.isArray(records)) {
        const matches = await claudeRegistrations(records, record.scope, record.version, root);
        if (matches.length > 1) throw new HostError('update: native installed scope/path/version record is ambiguous');
        const matched = matches[0];
        if (
          matches.length === 1 &&
          matched &&
          typeof matched.gitCommitSha === 'string' &&
          revision.test(matched.gitCommitSha)
        ) {
          const path = join(configHome(host), 'plugins/known_marketplaces.json');
          const market = policies.find((record) => record.path === path)?.value.celetis;
          let registered: ReturnType<typeof gitSource>;
          try {
            registered = gitSource(object(market) ? market.source : undefined);
          } catch {
            throw new HostError(
              `update: native registered source is unavailable in ${path}; repair the native marketplace record`,
            );
          }
          if (registered.source !== configured.source)
            throw new HostError(
              `update: native registered source does not match the effective configured source in ${path}; repair the native marketplace record`,
            );
          nativeRevision = matched.gitCommitSha;
        }
      }
    }
  } else {
    const metadata = await codexPlugin(cwd);
    root = metadata.root;
    const market = metadata.record.marketplaceSource;
    if (!object(market) || market.sourceType !== 'git')
      throw new HostError(
        'update: selected Codex marketplace is not a Git source; no remote update check is available',
      );
    const reply = await codexRequest(cwd, 'config/read', { cwd, includeLayers: true }, metadata.home);
    const config = object(reply) && object(reply.result) && object(reply.result.config) ? reply.result.config : null;
    const markets = config?.marketplaces;
    const effective = object(markets) ? markets.celetis : null;
    if (!object(effective) || effective.source_type !== 'git' || effective.source !== market.source)
      throw new HostError(
        'update: Codex effective marketplace source differs from installed metadata; repair the native configuration',
      );
    configured = gitSource({ source: 'git', url: effective.source, ref: effective.ref });
    if (config?.plugins !== undefined && !object(config.plugins))
      throw new HostError('update: invalid effective Codex plugin configuration; inspect its native sources');
    siblings = [...new Set([...metadata.marketplacePlugins, ...Object.keys(config?.plugins ?? {})])].filter(
      (id) => id.endsWith('@celetis') && id !== 'celetis@celetis',
    );
  }
  const installed = await installedRevision(host, root, configured.source, nativeRevision);
  return {
    host,
    home,
    source: configured.source,
    installed,
    root: await realpath(root),
    ref: configured.ref,
    scope,
    registered: registeredSource,
    siblings,
  };
}

async function remoteTarget(source: string, ref: string, cwd: string): Promise<{ ref: string; target: string }> {
  let remote: string;
  try {
    remote = await git(['ls-remote', '--symref', '--', source, ref, `${ref}^{}`], cwd);
  } catch (error) {
    throw new HostError(`update: cannot resolve configured Git ref ${ref}: ${(error as Error).message}`);
  }
  const names = new Map<string, string>();
  const records: string[][] = [];
  for (const line of remote.split('\n').filter(Boolean))
    if (line.startsWith('ref: ')) {
      const [name = '', base = ''] = line.slice(5).split('\t');
      names.set(base, name);
    } else records.push(line.split('\t'));
  if (records.some(([sha, name]) => !sha || !revision.test(sha) || !name))
    throw new HostError(`update: invalid remote revision for configured ref ${ref}`);
  const base = records.filter(([, name]) => !name?.endsWith('^{}'));
  if (base.length !== 1)
    throw new HostError(`update: configured ref ${ref} is missing or ambiguous; choose one native Git ref`);
  const selected = base[0]?.[1] ?? '';
  const target = records.find(([, name]) => name === `${selected}^{}`)?.[0] ?? base[0]?.[0];
  if (!target) throw new HostError(`update: no full revision for configured ref ${ref}`);
  return { ref: names.get(selected) || selected, target };
}

async function inspect(host: Host, cwd: string): Promise<Installation & { target: string; resolvedRef: string }> {
  const found = await installation(host, cwd);
  const { ref, target } = await remoteTarget(found.source, found.ref, cwd);
  return { ...found, target, resolvedRef: ref };
}

async function settle(part: 'program' | Host, read: () => Promise<Part>): Promise<Part> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof NotInstalled) return { part, skipped: `Celetis is not installed in ${part}` };
    return { part, error: error instanceof Error ? error.message : String(error) };
  }
}

async function programPart(cwd: string): Promise<Part> {
  const program = await readProgram();
  if (!program) return { part: 'program', skipped: 'the celetis program is not installed' };
  const { source, branch, revision: installed } = await programSource(program.root);
  const { ref, target } = await remoteTarget(source, `refs/heads/${branch}`, cwd);
  return { part: 'program', root: program.root, source, ref, installed, target };
}

async function hostPart(host: Host, cwd: string): Promise<Part> {
  if (!Bun.which(host, { PATH: childEnv().PATH })) return { part: host, skipped: `no ${host} command on PATH` };
  if (host === 'codex') {
    const home = configHome(host);
    if (process.env.CODEX_HOME === undefined && !(await lstat(home).catch(() => null)))
      return { part: host, skipped: `Codex has no home folder ${home}` };
    const listed = await nativeJson(host, ['plugin', 'marketplace', 'list', '--json'], cwd);
    if (!object(listed) || !Array.isArray(listed.marketplaces))
      throw new HostError('celetis: invalid Codex marketplace source list');
    if (!listed.marketplaces.some((market) => object(market) && market.name === 'celetis'))
      return { part: host, skipped: 'Celetis is not installed in codex' };
  }
  const { home, root, source, resolvedRef, installed, target } = await withPluginRead(host, () => inspect(host, cwd));
  return { part: host, home, root, source, ref: resolvedRef, installed, target };
}

export async function parts(cwd: string): Promise<Part[]> {
  return [
    await settle('program', () => programPart(cwd)),
    await settle('claude', () => hostPart('claude', cwd)),
    await settle('codex', () => hostPart('codex', cwd)),
  ];
}

async function check(cwd: string): Promise<number> {
  const found = await parts(cwd);
  console.log(JSON.stringify(found, null, 2));
  const [program, ...hosts] = found;
  if (program && 'installed' in program)
    for (const host of hosts)
      if ('installed' in host && host.installed !== program.installed)
        console.error(
          `update: the program is at ${program.installed.slice(0, 12)} and the ${host.part} plugin is at ${host.installed.slice(0, 12)}; run celetis update in a terminal`,
        );
  return found.some((part) => 'error' in part) ? 1 : 0;
}

async function replaceClaudeMarketplace(
  path: string,
  expected: Record<string, unknown>,
  replacement: Record<string, unknown>,
): Promise<void> {
  const registry = await jsonFile(path);
  const current = registry.celetis;
  if (
    !object(current) ||
    !isDeepStrictEqual(current.source, expected.source) ||
    current.installLocation !== expected.installLocation
  )
    throw new HostError(`update: native marketplace identity changed in ${path}: ${JSON.stringify(current)}`);
  const metadata = await lstat(path);
  if (!metadata.isFile()) throw new HostError(`update: ${path} needs a regular file with no symbolic link`);
  const temporary = join(dirname(path), `.celetis.${randomUUID()}.json`);
  try {
    const file = await open(temporary, 'wx', metadata.mode & 0o7777);
    try {
      await file.chmod(metadata.mode & 0o7777);
      await file.writeFile(JSON.stringify({ ...registry, celetis: replacement }));
    } finally {
      await file.close();
    }
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function updatePlugin(ownerPid: number, host: Host, target: UpdateTarget): Promise<string> {
  if (
    !target.home ||
    !target.root ||
    !target.source ||
    !revision.test(target.installed) ||
    !revision.test(target.target)
  )
    throw new HostError(
      'update: apply needs the offered home, root, source and full installed and target revisions',
      2,
    );
  const config = await bindUpdateHome(host, target.home);
  if (config !== target.home || (await realpath(target.root).catch(() => null)) !== target.root)
    throw new HostError('update: offered home and root must be existing canonical paths', 2);
  const env = childEnv();
  const lock = await UpdateLock.acquire(join(config, 'celetis-update.lock'), ownerPid, { refuseBusy: true });
  try {
    const output = await lock.run(process.execPath, bunArgs(import.meta.path, ['--inspect', host]), {
      cwd: process.cwd(),
      env,
    });
    const current = JSON.parse(output) as UpdateOffer;
    if (
      current.home !== target.home ||
      current.root !== target.root ||
      current.source !== target.source ||
      current.installed !== target.installed ||
      current.target !== target.target
    )
      throw new HostError(
        `update: offered home, root, source, installed revision, or target changed; this attempt is consumed. Check again and obtain a new direct user response. Observed: ${JSON.stringify(current)}`,
      );
    const details = current as UpdateOffer & { ref: string; scope?: string; registered?: unknown; siblings: string[] };
    if (host === 'codex' && details.siblings.length)
      throw new HostError(
        `update: native whole-marketplace upgrade would also replace configured plugins ${details.siblings.join(', ')}; no mutation ran. Celetis approval does not include these plugins`,
      );
    const execute: typeof run = async (file, args, options = {}) => ({
      code: 0,
      stdout: await lock.run(file, args, { cwd: options.cwd, env: options.env ?? env }),
      stderr: '',
    });
    const scratch = await mkdtemp(join(tmpdir(), 'celetis-cutover.'));
    let retainScratch = false;
    let operation = 'prepare native target';
    const completed: string[] = [];
    try {
      if (host === 'claude') {
        await lock.run(process.execPath, bunArgs(import.meta.path, ['--policy', host]), {
          cwd: process.cwd(),
          env,
        });
        if (!['user', 'project', 'local'].includes(details.scope ?? '') || !object(details.registered))
          throw new HostError('update: native installed scope/source is unavailable');
        const registryPath = join(config, 'plugins/known_marketplaces.json');
        const original = (await jsonFile(registryPath)).celetis;
        if (
          !object(original) ||
          !object(original.source) ||
          (original.source.source !== 'git' && original.source.source !== 'github')
        )
          throw new HostError('update: native marketplace needs its original Git/GitHub source; recovery is required');
        if (!isDeepStrictEqual(original.source, details.registered))
          throw new HostError('update: native marketplace source changed before replacement; check again');
        if (gitSource(original.source).source !== target.source)
          throw new HostError('update: native marketplace source does not match the approved source');
        const location = original.installLocation;
        if (
          typeof location !== 'string' ||
          !isAbsolute(location) ||
          !(await lstat(location).catch(() => null))?.isDirectory() ||
          !(await lstat(join(location, '.claude-plugin')).catch(() => null))?.isDirectory()
        )
          throw new HostError(
            'update: native marketplace catalog location is missing or invalid; repair the native record',
          );
        const originalCatalog = await jsonFile(join(location, '.claude-plugin/marketplace.json'));
        if (
          originalCatalog.name !== 'celetis' ||
          !Array.isArray(originalCatalog.plugins) ||
          originalCatalog.plugins.filter((plugin) => object(plugin) && plugin.name === 'celetis').length !== 1
        )
          throw new HostError(`update: invalid native marketplace catalog in ${location}`);
        operation = 'claude original marketplace catalog validation';
        await lock.run('claude', ['plugin', 'validate', join(location, '.claude-plugin/marketplace.json'), '--json'], {
          cwd: process.cwd(),
          env,
        });
        operation = 'prepare native target';
        const action = join(scratch, 'target.json');
        const catalog = {
          name: 'celetis',
          owner: { name: 'Celetis' },
          plugins: [
            {
              name: 'celetis',
              source: {
                source: 'url',
                url: target.source,
                ...(details.ref === 'HEAD' ? {} : { ref: details.ref }),
                sha: target.target,
              },
            },
          ],
        };
        const inline = { source: 'settings', ...catalog };
        const staged = { ...original, source: inline, installLocation: scratch, autoUpdate: false };
        await mkdir(join(scratch, '.claude-plugin'));
        await writeFile(join(scratch, '.claude-plugin/marketplace.json'), JSON.stringify(catalog), { mode: 0o600 });
        await writeFile(
          action,
          JSON.stringify({
            extraKnownMarketplaces: { celetis: { autoUpdate: false, source: inline } },
          }),
          { mode: 0o600 },
        );
        await replaceClaudeMarketplace(registryPath, original, staged);
        operation = 'claude target-bound plugin update';
        let installationError: unknown;
        let restorationError: unknown;
        try {
          await lock.run(
            'claude',
            ['--settings', action, 'plugin', 'update', 'celetis@celetis', '--scope', details.scope ?? '', '--json'],
            { cwd: process.cwd(), env },
          );
        } catch (error) {
          installationError = error;
        } finally {
          if (!installationError) completed.push(operation);
          operation = 'claude original marketplace restoration';
          try {
            await replaceClaudeMarketplace(registryPath, staged, original);
            if (!isDeepStrictEqual((await jsonFile(registryPath)).celetis, original))
              restorationError = new HostError('update: native marketplace restoration is incomplete');
            else completed.push(operation);
          } catch (error) {
            restorationError = error;
          }
          if (restorationError) {
            try {
              const remaining = (await jsonFile(registryPath)).celetis;
              const owned = await stat(scratch);
              const referenced =
                object(remaining) && typeof remaining.installLocation === 'string'
                  ? await stat(remaining.installLocation)
                  : null;
              retainScratch =
                !referenced?.isDirectory() || (referenced.dev === owned.dev && referenced.ino === owned.ino);
            } catch {
              retainScratch = true;
            }
          }
        }
        if (restorationError)
          throw new HostError(
            [
              installationError instanceof Error ? installationError.message : '',
              (restorationError as Error).message,
              retainScratch ? `Recovery: retained native marketplace catalog at ${scratch}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          );
        if (installationError) {
          operation = 'claude target-bound plugin update';
          throw installationError;
        }
      } else {
        operation = 'codex target-bound marketplace upgrade';
        await lock.run(
          'codex',
          [
            '-c',
            'marketplaces.celetis.source_type="git"',
            '-c',
            `marketplaces.celetis.source=${JSON.stringify(target.source)}`,
            '-c',
            `marketplaces.celetis.ref=${JSON.stringify(target.target)}`,
            'plugin',
            'marketplace',
            'upgrade',
            'celetis',
            '--json',
          ],
          { cwd: process.cwd(), env },
        );
        completed.push(operation);
      }
      operation = 'fresh enabled installation validation';
      const root = await installedRoot(host, process.cwd(), execute);
      let sha: string | undefined;
      if (host === 'claude') {
        const list = await nativeJson('claude', ['plugin', 'list', '--json'], process.cwd(), env, execute);
        const fresh = await claudeInstallation(list, process.cwd());
        const enabled = fresh.root === root ? fresh.records.filter((record) => record.scope === details.scope) : [];
        const selected = enabled[0];
        if (enabled.length !== 1 || !selected || typeof selected.version !== 'string')
          throw new HostError('update: fresh native enabled scope/path/version is ambiguous');
        const registry = await jsonFile(join(config, 'plugins/installed_plugins.json'));
        const records = object(registry.plugins) ? registry.plugins['celetis@celetis'] : undefined;
        const matching = await claudeRegistrations(records, details.scope, selected.version, root);
        const registered = matching[0];
        if (matching.length !== 1 || !registered)
          throw new HostError(
            'update: fresh native installed scope/path/version record does not match enabled discovery',
          );
        if (typeof registered.gitCommitSha === 'string') sha = registered.gitCommitSha;
      }
      const manifest = await jsonFile(join(root, '.claude-plugin/plugin.json'));
      if (
        manifest.name !== 'celetis' ||
        !(await lstat(join(root, 'engine')).catch(() => null))?.isDirectory() ||
        !(await lstat(join(root, 'engine/hooks/entry.js')).catch(() => null))?.isFile() ||
        !(await lstat(join(root, 'skills/guide/SKILL.md')).catch(() => null))?.isFile()
      )
        throw new HostError(`update: enabled target package is incomplete: ${root}`);
      const installed = await installedRevision(host, root, target.source, sha, execute);
      if (installed !== target.target)
        throw new HostError(`update: enabled revision is ${installed}, expected approved target ${target.target}`);
      if (!(await lstat(join(root, 'step-prompt.md')).catch(() => null))?.isFile())
        throw new HostError(`update: target package has no step-prompt.md: ${root}`);
      return root;
    } catch (error) {
      let state = 'unknown';
      let sourceState: unknown = 'unknown';
      if (host === 'claude') {
        try {
          sourceState = (await jsonFile(join(config, 'plugins/known_marketplaces.json'))).celetis;
        } catch {}
      }
      try {
        state = await installedRoot(host, process.cwd(), execute);
      } catch {}
      throw new HostError(
        [
          `update: ${operation} failed`,
          (error as Error).message,
          `completed: ${completed.join('; ') || 'none'}`,
          `observed enabled root: ${state}`,
          `observed native source state: ${JSON.stringify(sourceState)}`,
          'Recovery: inspect the enabled installation and native source state, then obtain a new concrete offer and user decision. No retry or workflow was started.',
        ].join('\n'),
      );
    } finally {
      if (!retainScratch) await rm(scratch, { recursive: true, force: true });
    }
  } finally {
    await lock.close();
  }
}

const short = (revision: string) => revision.slice(0, 12);

function line(part: Part): string {
  if ('error' in part) return `  ${part.part}  error: ${part.error.split('\n')[0]}`;
  if ('skipped' in part) return `  ${part.part}  skipped: ${part.skipped}`;
  if (part.installed === part.target) return `  ${part.part}  up to date  ${short(part.installed)}`;
  return `  ${part.part}  ${short(part.installed)} -> ${short(part.target)}`;
}

export async function requireSameRevision(host: Host, cwd: string, root: string): Promise<string> {
  const name = host === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME';
  const selected = process.env[name];
  let installed: string;
  let plugin: string;
  try {
    ({ installed, root: plugin } = await withPluginRead(host, () => installation(host, cwd)));
  } finally {
    // bindUpdateHome sets this variable, and a set CLAUDE_CONFIG_DIR makes a step session read another login.
    if (selected === undefined) delete process.env[name];
    else process.env[name] = selected;
  }
  const program = await programRevision(root);
  if (installed !== program)
    throw new HostError(
      `celetis: the ${host} plugin is at ${short(installed)} and this program is at ${short(program)}; run celetis update, then start the runner again`,
    );
  return plugin;
}

export async function update(found: Part[]): Promise<number> {
  const summary = found.map(line).join('\n');
  const stop = (message: string) => {
    console.log(summary);
    return new HostError(message);
  };
  const ready = found.filter((part) => 'installed' in part);
  const program = ready.find((part) => part.part === 'program');
  const hosts = ready.filter((part) => part.part !== 'program');
  if (found.some((part) => 'error' in part)) throw stop('update: fix the errors above; nothing changed');
  if (!program)
    throw stop('update: the celetis program is not installed; run the first install of README.md, "First install"');
  if (!hosts.length)
    throw stop(
      'update: no host has Celetis installed; install the plugin as README.md, "Wire a product project", says',
    );
  if (new Set(ready.map(({ source, ref, target }) => JSON.stringify([source, ref, target]))).size > 1)
    throw stop(
      [
        'update: the parts do not name one source, ref, and revision; nothing changed',
        ...ready.map((part) => `update: ${part.part} uses ${part.source} ${part.ref} at ${short(part.target)}`),
      ].join('\n'),
    );
  const pending = [...hosts, program].filter((part) => part.installed !== part.target);
  if (!pending.length) {
    console.log(`${summary}\nupdate: Celetis is up to date at ${short(program.target)}`);
    return 0;
  }
  console.log(`Celetis update from ${program.source} ${program.ref}\n${summary}`);
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new HostError('update: run celetis update in an interactive terminal to review and confirm the update', 2);
  console.log('Open sessions stay running; the host may replace cached files they still use.');
  if (!/^(y|yes)$/i.test((prompt('Update Celetis now? [y/N] ') ?? '').trim())) {
    console.log('update: cancelled; nothing changed');
    return 0;
  }
  const completed: string[] = [];
  for (const [index, part] of pending.entries()) {
    try {
      const path =
        part.part === 'program'
          ? (
              await installProgram(part.source, {
                source: part.source,
                branch: (await programSource(part.root)).branch,
                revision: part.target,
              })
            ).entry
          : await updatePlugin(process.pid, part.part, part);
      console.log(`  ${part.part}  updated  ${path}`);
      completed.push(part.part);
    } catch (error) {
      const waiting = pending.slice(index + 1).map((part) => part.part);
      console.error(
        [
          error instanceof Error ? error.message : String(error),
          `update: completed: ${completed.join(', ') || 'none'}`,
          `update: not started: ${waiting.join(', ') || 'none'}`,
        ].join('\n'),
      );
      return 1;
    }
  }
  console.log('update: open a fresh session to use the updated skills');
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const { args } = commandInput(argv);
    if (args[0] === '--policy' && args.length === 2 && (args[1] === 'claude' || args[1] === 'codex'))
      await requireUpdatePolicy(args[1], process.cwd());
    else if (args[0] === '--inspect' && args.length === 2 && (args[1] === 'claude' || args[1] === 'codex'))
      console.log(JSON.stringify(await inspect(args[1], process.cwd())));
    else if (args.length === 1 && args[0] === 'check') return await check(process.cwd());
    else if (args.length) throw new HostError(`usage: celetis update [check]\n${updateHint}`, 2);
    else return await update(await parts(process.cwd()));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
