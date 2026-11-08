import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Host } from './lib/config-core.ts';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { installRecorder, markDefect } from './lib/events.ts';
import { codexRequest, HostError, installedRoot, NotInstalled, requireBun } from './lib/host.ts';
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
import { bunArgs, childEnv, run } from './lib/process.ts';
import {
  installProgram,
  type Program,
  type ProgramSource,
  programRevision,
  programSource,
  readProgram,
} from './lib/program.ts';
import { UpdateLock, withPluginRead } from './lib/update-lock.ts';
import type { UpdateStage } from './lib/update-types.ts';

export type { UpdateStage };

export type UpdateTarget = { home: string; root: string; source: string; installed: string; target: string };
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
export type PreparedUpdate = {
  parts: Part[];
  program: { installed: Program; source: ProgramSource };
  plugins: (Installation & { target: string; resolvedRef: string })[];
  target: string;
};
export type UpdateCheck = { parts: Part[]; offer: PreparedUpdate | null; error: string | null };
export type UpdateResult = {
  ok: boolean;
  target: string;
  completed: ('program' | Host)[];
  incomplete: ('program' | Host)[];
  error: string | null;
};
type PluginUpdate = PreparedUpdate['plugins'][number];
const revision = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

function gitSource(value: unknown): { source: string; ref: string } {
  if (!object(value))
    throw new HostError('update: no configured Git source; inspect the native marketplace record', exits.prerequisite);
  let source: unknown;
  if (value.source === 'git') source = value.url;
  else if (value.source === 'settings' && value.name === 'celetis' && Array.isArray(value.plugins)) {
    const plugins = value.plugins.filter((plugin) => object(plugin) && plugin.name === 'celetis');
    const plugin = plugins[0];
    if (plugins.length !== 1 || !object(plugin) || !object(plugin.source) || plugin.source.source !== 'url')
      throw new HostError('update: invalid native inline marketplace source', exits.prerequisite);
    return gitSource({ source: 'git', url: plugin.source.url, ref: plugin.source.ref });
  } else if (value.source === 'github' && typeof value.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(value.repo))
    source = `https://github.com/${value.repo}.git`;
  if (
    typeof source !== 'string' ||
    !source ||
    [...source].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    !(/^(https?|ssh|git|file):\/\//.test(source) || source.startsWith('/') || /^[\w.-]+@[\w.-]+:/.test(source))
  )
    throw new HostError(
      'update: unsupported configured Git source; use a native Git or GitHub marketplace source',
      exits.prerequisite,
    );
  const ref = value.ref ?? 'HEAD';
  if (
    typeof ref !== 'string' ||
    !ref ||
    ref.startsWith('-') ||
    [...ref].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  )
    throw new HostError('update: invalid configured Git ref; repair the native marketplace source', exits.prerequisite);
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
        exits.prerequisite,
      );
    root = installation.root;
    scope = typeof record.scope === 'string' ? record.scope : undefined;
    const manifest = await jsonFile(join(root, '.claude-plugin/plugin.json'));
    if (manifest.name !== 'celetis')
      throw new HostError(`update: wrong installed plugin identity in ${root}`, exits.prerequisite);
    const policies = await claudePolicy(cwd);
    checkClaudePolicy(policies);
    const nativeMarket = policies.find(
      (record) => record.path === join(configHome(host), 'plugins/known_marketplaces.json'),
    )?.value.celetis;
    registeredSource = nativeMarket;
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
        if (matches.length > 1)
          throw new HostError('update: native installed scope/path/version record is ambiguous', exits.prerequisite);
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
              exits.prerequisite,
            );
          }
          if (registered.source !== configured.source)
            throw new HostError(
              `update: native registered source does not match the effective configured source in ${path}; repair the native marketplace record`,
              exits.prerequisite,
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
        exits.prerequisite,
      );
    registeredSource = {
      source: metadata.record.source,
      marketplaceSource: market,
      root: await realpath((metadata.record.source as { path: string }).path),
    };
    const reply = await codexRequest(cwd, 'config/read', { cwd, includeLayers: true }, metadata.home);
    const config = object(reply) && object(reply.result) && object(reply.result.config) ? reply.result.config : null;
    const markets = config?.marketplaces;
    const effective = object(markets) ? markets.celetis : null;
    if (!object(effective) || effective.source_type !== 'git' || effective.source !== market.source)
      throw new HostError(
        'update: Codex effective marketplace source differs from installed metadata; repair the native configuration',
        exits.prerequisite,
      );
    configured = gitSource({ source: 'git', url: effective.source, ref: effective.ref });
    if (config?.plugins !== undefined && !object(config.plugins))
      throw new HostError(
        'update: invalid effective Codex plugin configuration; inspect its native sources',
        exits.prerequisite,
      );
    siblings = [...new Set([...metadata.marketplacePlugins, ...Object.keys(config?.plugins ?? {})])]
      .filter((id) => id.endsWith('@celetis') && id !== 'celetis@celetis')
      .sort();
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
    throw new HostError(`update: cannot resolve configured Git ref ${ref}: ${(error as Error).message}`, exits.blocked);
  }
  const names = new Map<string, string>();
  const records: string[][] = [];
  for (const line of remote.split('\n').filter(Boolean))
    if (line.startsWith('ref: ')) {
      const [name = '', base = ''] = line.slice(5).split('\t');
      names.set(base, name);
    } else records.push(line.split('\t'));
  if (records.some(([sha, name]) => !sha || !revision.test(sha) || !name))
    throw new HostError(`update: invalid remote revision for configured ref ${ref}`, exits.blocked);
  const base = records.filter(([, name]) => !name?.endsWith('^{}'));
  if (base.length !== 1)
    throw new HostError(
      `update: configured ref ${ref} is missing or ambiguous; choose one native Git ref`,
      exits.prerequisite,
    );
  const selected = base[0]?.[1] ?? '';
  const target = records.find(([, name]) => name === `${selected}^{}`)?.[0] ?? base[0]?.[0];
  if (!target) throw new HostError(`update: no full revision for configured ref ${ref}`, exits.blocked);
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

async function inspectPlugin(host: Host, cwd: string, ownerPid?: number): Promise<PluginUpdate | string> {
  if (!Bun.which(host, { PATH: childEnv().PATH })) return `no ${host} command on PATH`;
  if (host === 'codex') {
    const home = configHome(host);
    if (process.env.CODEX_HOME === undefined && !(await lstat(home).catch(() => null)))
      return `Codex has no home folder ${home}`;
    const listed = await nativeJson(host, ['plugin', 'marketplace', 'list', '--json'], cwd);
    if (!object(listed) || !Array.isArray(listed.marketplaces))
      throw new HostError('celetis: invalid Codex marketplace source list', exits.blocked);
    if (!listed.marketplaces.some((market) => object(market) && market.name === 'celetis'))
      return 'Celetis is not installed in codex';
  }
  const decoded = (output: string): PluginUpdate | string => {
    const value = JSON.parse(output) as PluginUpdate | { skipped: string };
    return 'skipped' in value ? value.skipped : value;
  };
  const args = bunArgs(import.meta.path, ['--inspect', host]);
  if (ownerPid !== undefined) {
    const home = await realpath(configHome(host));
    const lock = await UpdateLock.acquire(join(home, 'celetis-update.lock'), ownerPid, { refuseBusy: true });
    try {
      return decoded(await lock.run(process.execPath, args, { cwd, env: childEnv() }));
    } finally {
      await lock.close();
    }
  }
  return withPluginRead(host, async () => {
    const result = await run(process.execPath, args, { cwd, timeout: 120_000 });
    if (result.code !== 0) {
      throw new HostError(result.stderr.trimEnd(), exits.blocked);
    }
    return decoded(result.stdout);
  });
}

function pluginPart({ host, home, root, source, resolvedRef, installed, target }: PluginUpdate): Part {
  return { part: host, home, root, source, ref: resolvedRef, installed, target };
}

async function discoverUpdate(
  cwd: string,
  ownerPid?: number,
): Promise<{ parts: Part[]; prepared: PreparedUpdate | null; error: string | null }> {
  let program: PreparedUpdate['program'] | null = null;
  const plugins: PluginUpdate[] = [];
  const found = [
    await settle('program', async () => {
      const installed = await readProgram();
      if (!installed) return { part: 'program', skipped: 'the celetis program is not installed' };
      const source = await programSource(installed.root);
      if (installed.revision !== source.revision)
        throw new HostError(
          'update: installed program link and Git revision disagree; repair the program',
          exits.prerequisite,
        );
      const resolved = await remoteTarget(source.source, `refs/heads/${source.branch}`, cwd);
      program = { installed, source };
      return {
        part: 'program',
        root: installed.root,
        source: source.source,
        ref: resolved.ref,
        installed: source.revision,
        target: resolved.target,
      };
    }),
  ];
  for (const host of ['claude', 'codex'] as const)
    found.push(
      await settle(host, async () => {
        const inspected = await inspectPlugin(host, cwd, ownerPid);
        if (typeof inspected === 'string') return { part: host, skipped: inspected };
        plugins.push(inspected);
        return pluginPart(inspected);
      }),
    );
  const ready = found.filter((part) => 'installed' in part);
  let error: string | null = null;
  if (found.some((part) => 'error' in part)) error = 'update: fix the errors above; nothing changed';
  else if (!program)
    error = 'update: the celetis program is not installed; run the first install of README.md, "First install"';
  else if (!plugins.length)
    error = 'update: no host has Celetis installed; install the plugin as README.md, "Wire a product project", says';
  else if (new Set(ready.map(({ source, ref, target }) => JSON.stringify([source, ref, target]))).size > 1)
    error = [
      'update: the parts do not name one source, ref, and revision; nothing changed',
      ...ready.map((part) => `update: ${part.part} uses ${part.source} ${part.ref} at ${short(part.target)}`),
    ].join('\n');
  const target = ready[0]?.target;
  return {
    parts: found,
    prepared: !error && program && target ? { parts: found, program, plugins, target } : null,
    error,
  };
}

export async function inspectUpdate(cwd: string): Promise<UpdateCheck> {
  const { parts, prepared, error } = await discoverUpdate(cwd);
  return {
    parts,
    offer: prepared?.parts.some((part) => 'installed' in part && part.installed !== part.target) ? prepared : null,
    error,
  };
}

export async function parts(cwd: string): Promise<Part[]> {
  return (await inspectUpdate(cwd)).parts;
}

async function check(cwd: string): Promise<ExitCode> {
  const found = await parts(cwd);
  console.log(JSON.stringify(found, null, 2));
  const [program, ...hosts] = found;
  if (program && 'installed' in program)
    for (const host of hosts)
      if ('installed' in host && host.installed !== program.installed)
        console.error(
          `update: the program is at ${program.installed.slice(0, 12)} and the ${host.part} plugin is at ${host.installed.slice(0, 12)}; run celetis update in a terminal`,
        );
  return found.some((part) => 'error' in part) ? exits.blocked : exits.done;
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
    throw new HostError(
      `update: native marketplace identity changed in ${path}: ${JSON.stringify(current)}`,
      exits.prerequisite,
    );
  const metadata = await lstat(path);
  if (!metadata.isFile())
    throw new HostError(`update: ${path} needs a regular file with no symbolic link`, exits.blocked);
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

async function updatePlugin(ownerPid: number, host: Host, target: PluginUpdate): Promise<PluginUpdate> {
  if (
    !target.home ||
    !target.root ||
    !target.source ||
    !revision.test(target.installed) ||
    !revision.test(target.target)
  )
    throw new HostError(
      'update: apply needs the offered home, root, source and full installed and target revisions',
      exits.usage,
    );
  const config = await realpath(configHome(host)).catch(() => null);
  if (config !== target.home || (await realpath(target.root).catch(() => null)) !== target.root)
    throw new HostError('update: offered home and root must be existing canonical paths', exits.usage);
  const env = childEnv({
    ...process.env,
    [host === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME']: config,
  });
  const lock = await UpdateLock.acquire(join(config, 'celetis-update.lock'), ownerPid, { refuseBusy: true });
  try {
    const revalidate = async () => {
      const output = await lock.run(process.execPath, bunArgs(import.meta.path, ['--inspect', host]), {
        cwd: process.cwd(),
        env,
      });
      const current = JSON.parse(output) as PluginUpdate;
      if (!isDeepStrictEqual(current, target))
        throw new HostError(
          `update: offered installation identity or target changed; this attempt is consumed. Check again and obtain a new direct user response. Observed: ${JSON.stringify(current)}`,
          exits.prerequisite,
        );
      return current;
    };
    const details = await revalidate();
    if (host === 'codex' && details.siblings.length)
      throw new HostError(
        `update: native whole-marketplace upgrade would also replace configured plugins ${details.siblings.join(', ')}; no mutation ran. Celetis approval does not include these plugins`,
        exits.prerequisite,
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
          throw new HostError('update: native installed scope/source is unavailable', exits.prerequisite);
        const registryPath = join(config, 'plugins/known_marketplaces.json');
        const original = (await jsonFile(registryPath)).celetis;
        if (
          !object(original) ||
          !object(original.source) ||
          (original.source.source !== 'git' && original.source.source !== 'github')
        )
          throw new HostError(
            'update: native marketplace needs its original Git/GitHub source; recovery is required',
            exits.prerequisite,
          );
        if (!isDeepStrictEqual(original, details.registered))
          throw new HostError(
            'update: native marketplace source changed before replacement; check again',
            exits.prerequisite,
          );
        if (gitSource(original.source).source !== target.source)
          throw new HostError(
            'update: native marketplace source does not match the approved source',
            exits.prerequisite,
          );
        const location = original.installLocation;
        if (
          typeof location !== 'string' ||
          !isAbsolute(location) ||
          !(await lstat(location).catch(() => null))?.isDirectory() ||
          !(await lstat(join(location, '.claude-plugin')).catch(() => null))?.isDirectory()
        )
          throw new HostError(
            'update: native marketplace catalog location is missing or invalid; repair the native record',
            exits.prerequisite,
          );
        const originalCatalog = await jsonFile(join(location, '.claude-plugin/marketplace.json'));
        if (
          originalCatalog.name !== 'celetis' ||
          !Array.isArray(originalCatalog.plugins) ||
          originalCatalog.plugins.filter((plugin) => object(plugin) && plugin.name === 'celetis').length !== 1
        )
          throw new HostError(`update: invalid native marketplace catalog in ${location}`, exits.prerequisite);
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
        await revalidate();
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
              restorationError = new HostError('update: native marketplace restoration is incomplete', exits.blocked);
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
            exits.blocked,
          );
        if (installationError) {
          operation = 'claude target-bound plugin update';
          throw installationError;
        }
      } else {
        operation = 'codex target-bound marketplace upgrade';
        await revalidate();
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
          throw new HostError('update: fresh native enabled scope/path/version is ambiguous', exits.blocked);
        const registry = await jsonFile(join(config, 'plugins/installed_plugins.json'));
        const records = object(registry.plugins) ? registry.plugins['celetis@celetis'] : undefined;
        const matching = await claudeRegistrations(records, details.scope, selected.version, root);
        const registered = matching[0];
        if (matching.length !== 1 || !registered)
          throw new HostError(
            'update: fresh native installed scope/path/version record does not match enabled discovery',
            exits.blocked,
          );
        if (typeof registered.gitCommitSha === 'string') sha = registered.gitCommitSha;
      }
      const manifest = await jsonFile(join(root, '.claude-plugin/plugin.json'));
      if (manifest.name !== 'celetis')
        throw new HostError(`update: enabled target package is incomplete: ${root}`, exits.blocked);
      const installed = await installedRevision(host, root, target.source, sha, execute);
      if (installed !== target.target)
        throw new HostError(
          `update: enabled revision is ${installed}, expected approved target ${target.target}`,
          exits.blocked,
        );
      const fresh = JSON.parse(
        await lock.run(process.execPath, bunArgs(import.meta.path, ['--inspect', host]), {
          cwd: process.cwd(),
          env,
        }),
      ) as PluginUpdate;
      if (
        fresh.root !== root ||
        fresh.installed !== target.target ||
        !isDeepStrictEqual({ ...fresh, root: target.root, installed: target.installed }, target)
      )
        throw new HostError(
          'update: fresh installation does not match the approved source, ref, scope, or target',
          exits.blocked,
        );
      return fresh;
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
        exits.blocked,
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
      `celetis: the ${host} plugin is at ${short(installed)} and this program is at ${short(program)}; run celetis update, then start the daemon again`,
      exits.prerequisite,
    );
  return plugin;
}

export async function executeUpdate(
  offer: PreparedUpdate,
  stage: (value: UpdateStage) => void,
  ownerPid: number,
): Promise<UpdateResult> {
  const pending: ('program' | Host)[] = offer.plugins
    .filter((plugin) => plugin.installed !== offer.target)
    .map((plugin) => plugin.host);
  if (offer.program.source.revision !== offer.target) pending.push('program');
  const completed: ('program' | Host)[] = [];
  const expected = structuredClone(offer);
  try {
    const before = await discoverUpdate(process.cwd(), ownerPid);
    if (before.error || !isDeepStrictEqual(before.prepared, offer))
      throw new HostError(
        [
          'update: offered installation identity, inventory, or target changed; check again and obtain a new direct user response',
          ...before.parts.filter((part) => 'error' in part).map((part) => part.error),
          before.error,
        ]
          .filter(Boolean)
          .join('\n'),
        exits.prerequisite,
      );
    if (!pending.length)
      throw new HostError('update: the offer has no differing part; check again', exits.prerequisite);
    for (const part of pending) {
      stage({ part, state: 'started' });
      if (part === 'program') {
        const installed = await installProgram(
          offer.program.source.source,
          { ...offer.program.source, revision: offer.target },
          undefined,
          offer.program.installed,
        );
        const source = await programSource(installed.root);
        if (
          source.source !== offer.program.source.source ||
          source.branch !== offer.program.source.branch ||
          source.revision !== offer.target ||
          (await installedRevision('program', installed.root, source.source)) !== offer.target
        )
          throw new HostError(
            'update: fresh program does not match the approved source, ref, or target',
            exits.blocked,
          );
        expected.program = { installed, source };
        expected.parts = expected.parts.map((value) =>
          value.part === part && 'installed' in value
            ? { ...value, root: installed.root, installed: offer.target }
            : value,
        );
      } else {
        const plugin = offer.plugins.find((plugin) => plugin.host === part);
        if (!plugin) throw new HostError(`update: the offer has no ${part} installation`, exits.internal);
        const fresh = await updatePlugin(ownerPid, part, plugin);
        expected.plugins = expected.plugins.map((value) => (value.host === part ? fresh : value));
        expected.parts = expected.parts.map((value) => (value.part === part ? pluginPart(fresh) : value));
      }
      completed.push(part);
      stage({ part, state: 'completed' });
    }
    const final = await discoverUpdate(process.cwd(), ownerPid);
    if (final.error || !isDeepStrictEqual(final.prepared, expected))
      throw new HostError(
        [
          'update: final installation validation found a changed identity, inventory, or target; check again',
          ...final.parts.map((part) => ('error' in part ? part.error : line(part))),
        ].join('\n'),
        exits.blocked,
      );
    return { ok: true, target: offer.target, completed, incomplete: [], error: null };
  } catch (error) {
    return {
      ok: false,
      target: offer.target,
      completed,
      incomplete: pending.filter((part) => !completed.includes(part)),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function update(checked: UpdateCheck): Promise<ExitCode> {
  const summary = checked.parts.map(line).join('\n');
  if (checked.error) {
    console.log(summary);
    throw new HostError(
      checked.error,
      checked.parts.some((part) => 'error' in part) ? exits.blocked : exits.prerequisite,
    );
  }
  const program = checked.parts.find((part) => part.part === 'program');
  if (!program || !('installed' in program))
    throw new HostError('update: no installed program was inspected', exits.blocked);
  const offer = checked.offer;
  if (!offer) {
    console.log(`${summary}\nupdate: Celetis is up to date at ${short(program.target)}`);
    return exits.done;
  }
  console.log(`Celetis update from ${program.source} ${program.ref}\n${summary}`);
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new HostError(
      'update: run celetis update in an interactive terminal to review and confirm the update',
      exits.prerequisite,
    );
  console.log('Open sessions stay running; the host may replace cached files they still use.');
  if (!/^(y|yes)?$/i.test((prompt('Update Celetis now? [Y/n] ') ?? 'n').trim())) {
    console.log('update: cancelled; nothing changed');
    return exits.done;
  }
  const result = await executeUpdate(
    offer,
    ({ part, state }) => {
      if (state === 'completed') console.log(`  ${part}  updated  ${short(offer.target)}`);
    },
    process.pid,
  );
  if (!result.ok) {
    console.error(
      [
        result.error,
        `update: completed: ${result.completed.join(', ') || 'none'}`,
        `update: incomplete: ${result.incomplete.join(', ') || 'none'}`,
      ].join('\n'),
    );
    return exits.blocked;
  }
  console.log('update: open a fresh session to use the updated skills');
  return exits.done;
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args } = commandInput(argv);
    if (args[0] === '--policy' && args.length === 2 && (args[1] === 'claude' || args[1] === 'codex'))
      await requireUpdatePolicy(args[1], process.cwd());
    else if (args[0] === '--inspect' && args.length === 2 && (args[1] === 'claude' || args[1] === 'codex')) {
      try {
        console.log(JSON.stringify(await inspect(args[1], process.cwd())));
      } catch (error) {
        if (!(error instanceof NotInstalled)) throw error;
        console.log(JSON.stringify({ skipped: `Celetis is not installed in ${args[1]}` }));
      }
    } else if (args.length === 1 && args[0] === 'check') return await check(process.cwd());
    else if (args.length) throw new HostError(usage('update'), exits.usage);
    else return await update(await inspectUpdate(process.cwd()));
    return exits.done;
  } catch (error) {
    markDefect(error);
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('update');
  process.exitCode = await main(process.argv.slice(2));
}
