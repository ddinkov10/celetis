import type { Stats } from 'node:fs';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { codexRequest } from './codex-app-server.ts';
import type { Host } from './config-core.ts';
import { exits } from './contract.ts';
import { HostError, NotInstalled } from './errors.ts';
import { git, mainCheckout, revision } from './git.ts';
import { codexHome, configHome } from './homes.ts';
import { childEnv, run, updateDescriptor } from './process.ts';

export const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export async function installedRevision(
  host: Host | 'program',
  root: string,
  source: string,
  nativeRevision?: string,
  execute: typeof run = run,
): Promise<string> {
  const witness = await lstat(join(root, '.git')).catch(() => null);
  if (witness && !witness.isDirectory())
    throw new HostError(
      `update: Git witness is not package-owned: ${root}; repair the native installation`,
      exits.prerequisite,
    );
  if (!witness) {
    if (nativeRevision) return nativeRevision;
    throw new HostError(
      `update: ${root} has no package-owned Git revision witness; reinstall from a source with verifiable full installed identity`,
      exits.prerequisite,
    );
  }
  const args = [`--git-dir=${join(root, '.git')}`, `--work-tree=${root}`];
  const common = await git([...args, 'rev-parse', '--path-format=absolute', '--git-common-dir'], root, execute);
  if (
    (await realpath(common).catch(() => '')) !== (await realpath(join(root, '.git'))) ||
    (await lstat(join(root, '.git/objects/info/alternates')).catch(() => null))
  )
    throw new HostError(
      `update: installed Git witness uses external common state: ${root}; use a package-owned Git record`,
      exits.prerequisite,
    );
  const installed = await git([...args, 'rev-parse', '--verify', 'HEAD'], root, execute);
  if (nativeRevision && nativeRevision !== installed)
    throw new HostError(
      `update: native installed revision disagrees with package witness: ${root}; repair the native identity`,
      exits.prerequisite,
    );
  if (!revision.test(installed))
    throw new HostError(`update: invalid full installed revision in ${root}`, exits.prerequisite);
  const metadataName = '.codex-marketplace-install.json';
  const metadataPath = join(root, metadataName);
  const metadataFile = host === 'codex' ? await lstat(metadataPath).catch(() => null) : null;
  if (metadataFile) {
    let metadata: Record<string, unknown>;
    try {
      metadata = await jsonFile(metadataPath);
    } catch (error) {
      throw new HostError(
        `update: invalid native marketplace metadata: ${(error as Error).message}`,
        error instanceof HostError ? error.code : exits.internal,
      );
    }
    if (
      !metadataFile.isFile() ||
      Object.keys(metadata).sort().join(',') !== 'ref_name,revision,source,source_type,sparse_paths' ||
      metadata.source_type !== 'git' ||
      metadata.source !== source ||
      metadata.revision !== installed ||
      !(
        metadata.ref_name === null ||
        (typeof metadata.ref_name === 'string' &&
          metadata.ref_name.length > 0 &&
          ![...metadata.ref_name].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127))
      ) ||
      !Array.isArray(metadata.sparse_paths) ||
      metadata.sparse_paths.some((path) => typeof path !== 'string' || !path || path.includes('\0'))
    )
      throw new HostError(
        `update: invalid native marketplace metadata identity in ${metadataPath}`,
        exits.prerequisite,
      );
  }
  const changes = await git([...args, 'status', '--porcelain', '-z', '--untracked-files=normal'], root, execute);
  if (changes.split('\0').some((change) => change && !(metadataFile && change === `?? ${metadataName}`)))
    throw new HostError(
      `update: installed package is dirty: ${root}; review its local changes before checking an update`,
      exits.prerequisite,
    );
  const remote = await git([...args, 'config', '--get', 'remote.origin.url'], root, execute);
  if (remote !== source)
    throw new HostError(
      `update: installed Git source does not match configured source: ${remote}; repair the native installation identity`,
      exits.prerequisite,
    );
  return installed;
}

export async function bindUpdateHome(host: Host, selected = configHome(host)): Promise<string> {
  if (!isAbsolute(selected)) throw new HostError(`update: ${host} home must be absolute: ${selected}`, exits.usage);
  const home = await realpath(selected).catch(() => null);
  if (!home || !(await lstat(home)).isDirectory())
    throw new HostError(`update: cannot resolve offered ${host} home: ${selected}`, exits.usage);
  process.env[host === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'] = home;
  return home;
}

async function contained(root: string, path: string): Promise<string> {
  const target = await realpath(path).catch(() => null);
  if (target === null)
    throw new HostError(
      `celetis: cannot resolve native Codex identity path: ${path}; repair the selected installation`,
      exits.prerequisite,
    );
  const part = relative(root, target);
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`))
    throw new HostError(
      `celetis: native Codex identity path is outside ${root}: ${path} resolves to ${target}; repair the selected installation`,
      exits.prerequisite,
    );
  return target;
}

export async function jsonFile(path: string, optional = false): Promise<Record<string, unknown>> {
  try {
    if (!(await lstat(path)).isFile()) throw new HostError('need a regular file with no symbolic link', exits.blocked);
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!object(value)) throw new Error('need a JSON object');
    return value;
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new HostError(
      `update: cannot read ${path}: ${(error as Error).message}; repair this native record`,
      error instanceof HostError
        ? error.code
        : typeof (error as NodeJS.ErrnoException).errno === 'number'
          ? exits.blocked
          : exits.prerequisite,
    );
  }
}

export async function nativeJson(
  host: Host,
  args: string[],
  cwd: string,
  env = childEnv(),
  execute: typeof run = run,
): Promise<unknown> {
  const inheritedFd = updateDescriptor();
  if (host === 'codex') env = childEnv({ ...env, CODEX_HOME: await codexHome(env.CODEX_HOME) });
  const result = await execute(host, args, {
    cwd,
    env,
    inheritedFd,
    timeout: 10_000,
    stderr: inheritedFd === undefined ? undefined : 'inherit',
  });
  if (result.code !== 0)
    throw new HostError(
      [
        `celetis: ${host} ${args.join(' ')} failed (exit ${result.code})`,
        result.stderr.trimEnd(),
        result.stdout.trimEnd(),
      ]
        .filter(Boolean)
        .join('\n'),
      exits.blocked,
    );
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new HostError(`celetis: invalid ${host} ${args.join(' ')} JSON\n${result.stdout.trimEnd()}`, exits.blocked);
  }
}

export interface PluginMetadata {
  host: Host;
  home: string;
  root: string;
  record: Record<string, unknown>;
  marketplacePlugins: string[];
}

export async function claudeInstallation(
  list: unknown,
  cwd: string,
): Promise<{ root: string; records: Record<string, unknown>[] }> {
  const missing =
    'celetis: no enabled Celetis installation; run: claude plugin marketplace add ddinkov10/celetis && claude plugin install celetis@celetis';
  if (!Array.isArray(list)) throw new HostError('celetis: invalid Claude installation list', exits.blocked);
  const project = await realpath(
    await mainCheckout(cwd).catch((error) => {
      if (error instanceof HostError && error.message.startsWith('fatal: not a git repository')) return cwd;
      throw error;
    }),
  );
  const records: Record<string, unknown>[] = [];
  const roots = new Set<string>();
  for (const item of list) {
    if (!object(item) || item.id !== 'celetis@celetis') continue;
    if (item.scope !== 'user') {
      if (
        !['project', 'local'].includes(String(item.scope)) ||
        typeof item.projectPath !== 'string' ||
        !isAbsolute(item.projectPath)
      )
        throw new HostError(
          'celetis: invalid Claude installation scope; repair the native plugin record',
          exits.prerequisite,
        );
      const applicable = await realpath(item.projectPath).catch(() => null);
      if (applicable !== project) continue;
    }
    if (item.enabled === false) continue;
    if (item.enabled !== true) throw new HostError(missing, exits.prerequisite);
    if (
      typeof item.installPath !== 'string' ||
      !isAbsolute(item.installPath) ||
      [...item.installPath].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    )
      throw new HostError(
        'celetis: invalid Claude installation path; repair the native plugin record',
        exits.prerequisite,
      );
    const canonical = await realpath(item.installPath).catch(() => null);
    if (!canonical)
      throw new HostError(
        `celetis: cannot resolve Claude installation: ${item.installPath}; repair the native plugin record`,
        exits.prerequisite,
      );
    roots.add(canonical);
    records.push(item);
  }
  if (roots.size > 1)
    throw new HostError(
      'celetis: Claude installation is ambiguous; keep one enabled Celetis root for this project',
      exits.prerequisite,
    );
  const root = [...roots][0];
  if (!root) throw new NotInstalled(missing, exits.prerequisite);
  const manifest = await jsonFile(join(root, '.claude-plugin/plugin.json'));
  if (manifest.name !== 'celetis')
    throw new HostError('celetis: Claude reports an invalid celetis package; reinstall the plugin', exits.prerequisite);
  return { root, records };
}

async function cachedPlugin(home: string, name: string): Promise<{ root: string; version: string } | null> {
  const path = join(home, 'plugins/cache/celetis', name);
  if (!(await lstat(path).catch(() => null))) return null;
  const store = await contained(home, path);
  const entries = await readdir(store, { withFileTypes: true });
  const versions = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name);
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
  versions.sort((a, b) => (semver.test(a) && semver.test(b) ? Bun.semver.order(a, b) : a < b ? -1 : a > b ? 1 : 0));
  const version = versions.includes('local') ? 'local' : versions.at(-1);
  return version ? { root: await contained(home, join(store, version)), version } : null;
}

async function nativeCatalog(root: string): Promise<Record<string, unknown> | null> {
  for (const name of [
    '.agents/plugins/marketplace.json',
    '.agents/plugins/api_marketplace.json',
    '.claude-plugin/marketplace.json',
    '.cursor-plugin/marketplace.json',
  ]) {
    const path = join(root, name);
    if (await lstat(path).catch(() => null)) return jsonFile(await contained(root, path));
  }
  return null;
}

async function legacySourceVersion(root: string, name: string): Promise<string> {
  const rootManifest = join(root, 'plugin.json');
  if (await lstat(rootManifest).catch(() => null)) {
    const manifest = await jsonFile(rootManifest);
    if (typeof manifest.$schema === 'string' && manifest.$schema.startsWith('https://agent-plugins.org/schemas/'))
      throw new HostError(
        `celetis: unsupported agent-plugin schema for an installed session source: ${rootManifest}`,
        exits.prerequisite,
      );
  }
  for (const folder of ['.codex-plugin', '.claude-plugin', '.cursor-plugin']) {
    let parent: Stats;
    const candidate = join(root, folder, 'plugin.json');
    try {
      parent = await lstat(join(root, folder));
      if (parent.isDirectory()) await lstat(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (!parent.isDirectory())
      throw new HostError(`celetis: invalid native manifest directory: ${join(root, folder)}`, exits.prerequisite);
    const manifest = await jsonFile(candidate);
    if (typeof manifest.$schema === 'string' && manifest.$schema.startsWith('https://agent-plugins.org/schemas/'))
      throw new HostError(
        `celetis: unsupported agent-plugin schema for an installed session source: ${join(root, folder)}`,
        exits.prerequisite,
      );
    if (manifest.name !== name)
      throw new HostError(`celetis: unsupported native legacy manifest identity in ${root}`, exits.prerequisite);
    if (manifest.version === undefined || manifest.version === null) return 'local';
    if (typeof manifest.version === 'string' && manifest.version.trim()) return manifest.version.trim();
    throw new HostError(`celetis: invalid native plugin version in ${root}`, exits.prerequisite);
  }
  throw new HostError(`celetis: no native legacy manifest in ${root}`, exits.prerequisite);
}

function pathBefore(one: string, two: string): boolean {
  const a = one.split(sep),
    b = two.split(sep);
  for (let at = 0; at < Math.min(a.length, b.length); at++) {
    const order = Buffer.compare(Buffer.from(a[at] ?? ''), Buffer.from(b[at] ?? ''));
    if (order) return order < 0;
  }
  return a.length < b.length;
}

export async function codexPlugin(cwd: string, execute: typeof run = run): Promise<PluginMetadata> {
  const home = await codexHome();
  const env = childEnv({ ...process.env, CODEX_HOME: home });
  const value = await nativeJson('codex', ['plugin', 'list', '--marketplace', 'celetis', '--json'], cwd, env, execute);
  if (!object(value) || !Array.isArray(value.installed))
    throw new HostError('celetis: invalid Codex plugin list', exits.blocked);
  const records = value.installed.filter((item) => object(item) && item.pluginId === 'celetis@celetis');
  if (records.length > 1)
    throw new HostError(
      'celetis: Codex reports multiple celetis installations; fix the native registry',
      exits.prerequisite,
    );
  const record: unknown = records[0];
  if (!object(record) || record.enabled !== true || record.installed !== true)
    throw new NotInstalled(
      'celetis: Codex has no enabled celetis@celetis installation; install and enable the plugin in Codex',
      exits.prerequisite,
    );
  if (
    record.name !== 'celetis' ||
    record.marketplaceName !== 'celetis' ||
    !object(record.source) ||
    record.source.source !== 'local' ||
    typeof record.source.path !== 'string' ||
    !isAbsolute(record.source.path) ||
    !object(record.marketplaceSource) ||
    !['git', 'local'].includes(String(record.marketplaceSource.sourceType)) ||
    typeof record.marketplaceSource.source !== 'string' ||
    !record.marketplaceSource.source
  )
    throw new HostError(
      'celetis: unsupported Codex celetis source metadata; repair the source-backed installation',
      exits.prerequisite,
    );
  const scoped = await realpath(cwd);
  const response = await codexRequest(scoped, 'skills/list', { cwds: [scoped], forceReload: true }, home, execute);
  const data =
    object(response) && object(response.result) && Array.isArray(response.result.data) ? response.result.data : [];
  const catalogs = data.filter((item) => object(item) && item.cwd === scoped);
  const catalog = catalogs[0];
  if (
    catalogs.length !== 1 ||
    !object(catalog) ||
    !Array.isArray(catalog.errors) ||
    catalog.errors.length ||
    !Array.isArray(catalog.skills)
  )
    throw new HostError(
      'celetis: invalid Codex skill catalog for this project; repair the native skill discovery',
      exits.prerequisite,
    );
  const roots = new Set<string>();
  for (const skill of catalog.skills) {
    if (!object(skill) || skill.pluginId !== 'celetis@celetis' || skill.enabled === false) continue;
    if (
      skill.enabled !== true ||
      typeof skill.path !== 'string' ||
      !isAbsolute(skill.path) ||
      [...skill.path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
      !/\/skills\/[a-z][a-z0-9-]*\/SKILL\.md$/.test(skill.path.split(sep).join('/'))
    )
      throw new HostError(
        'celetis: invalid Codex Celetis skill identity; repair the native skill discovery',
        exits.prerequisite,
      );
    const path = dirname(dirname(dirname(skill.path)));
    const canonical = await realpath(path).catch(() => null);
    if (!canonical)
      throw new HostError(
        `celetis: cannot resolve Codex skill root: ${path}; repair the native skill discovery`,
        exits.prerequisite,
      );
    roots.add(canonical);
  }
  if (roots.size > 1)
    throw new HostError(
      'celetis: Codex installation is ambiguous; keep one enabled Celetis root for this project',
      exits.prerequisite,
    );
  const root = [...roots][0];
  if (!root)
    throw new HostError(
      'celetis: Codex has no enabled Celetis skill root; install and enable the plugin',
      exits.prerequisite,
    );
  await contained(home, root);
  if (record.version !== basename(root))
    throw new HostError(
      `celetis: Codex registry does not match its installed version ${String(record.version)}; repair the native installation`,
      exits.prerequisite,
    );
  const marketplaces = await nativeJson('codex', ['plugin', 'marketplace', 'list', '--json'], cwd, env, execute);
  if (!object(marketplaces) || !Array.isArray(marketplaces.marketplaces))
    throw new HostError('celetis: invalid Codex marketplace source list', exits.blocked);
  const markets = marketplaces.marketplaces.filter((item) => object(item) && item.name === 'celetis');
  const market: unknown = markets[0];
  if (
    markets.length !== 1 ||
    !object(market) ||
    typeof market.root !== 'string' ||
    !isAbsolute(market.root) ||
    !object(market.marketplaceSource) ||
    market.marketplaceSource.sourceType !== record.marketplaceSource.sourceType ||
    market.marketplaceSource.source !== record.marketplaceSource.source
  )
    throw new HostError(
      'celetis: Codex marketplace source is missing, changed, or ambiguous; repair the native source chain',
      exits.prerequisite,
    );
  const marketplaceRoot = await realpath(market.root).catch(() => null);
  const sourceRoot = await realpath(record.source.path).catch(() => null);
  if (!marketplaceRoot || sourceRoot !== marketplaceRoot)
    throw new HostError(
      'celetis: Codex plugin source does not match its native marketplace root; repair the native source chain',
      exits.prerequisite,
    );
  const marketplaceCatalog = await jsonFile(
    await contained(marketplaceRoot, join(marketplaceRoot, '.claude-plugin/marketplace.json')),
  );
  const plugins = Array.isArray(marketplaceCatalog.plugins)
    ? marketplaceCatalog.plugins.filter((item) => object(item) && item.name === 'celetis')
    : [];
  if (marketplaceCatalog.name !== 'celetis' || plugins.length !== 1 || !['.', './'].includes(plugins[0]?.source))
    throw new HostError(
      'celetis: unsupported or ambiguous Codex Celetis root source; repair the native marketplace catalog',
      exits.prerequisite,
    );
  const manifest = await jsonFile(await contained(root, join(root, '.claude-plugin/plugin.json')));
  if (manifest.name !== 'celetis')
    throw new HostError('celetis: Codex reports an invalid celetis package; reinstall the plugin', exits.prerequisite);
  const marketplacePlugins = value.installed
    .filter((item) => object(item) && typeof item.pluginId === 'string' && item.pluginId.endsWith('@celetis'))
    .map((item) => item.pluginId as string);
  return { host: 'codex', home, root, record, marketplacePlugins };
}

export async function codexSessionPin(cwd: string): Promise<string[]> {
  const metadata = await codexPlugin(cwd);
  const source = metadata.record.marketplaceSource;
  if (!object(source) || typeof source.source !== 'string')
    throw new HostError('celetis: native source is missing', exits.prerequisite);
  if (source.sourceType === 'git') await installedRevision('codex', metadata.root, source.source);
  const args = [
    '-c',
    'marketplaces.celetis.source_type="local"',
    '-c',
    `marketplaces.celetis.source=${JSON.stringify(metadata.root)}`,
  ];
  const env = childEnv({ ...process.env, CODEX_HOME: metadata.home });
  const listed = await nativeJson('codex', [...args, 'plugin', 'marketplace', 'list', '--json'], cwd, env);
  const markets =
    object(listed) && Array.isArray(listed.marketplaces)
      ? listed.marketplaces.filter((market) => object(market) && market.name === 'celetis')
      : [];
  const selected = markets[0];
  if (
    markets.length !== 1 ||
    !object(selected) ||
    selected.root !== metadata.root ||
    !object(selected.marketplaceSource) ||
    selected.marketplaceSource.sourceType !== 'local' ||
    selected.marketplaceSource.source !== metadata.root
  )
    throw new HostError(
      'celetis: native policy or marketplace discovery did not select the installed local session source',
      exits.prerequisite,
    );
  const catalog = await nativeCatalog(metadata.root);
  const originalRoot = await realpath(String((metadata.record.source as Record<string, unknown>).path));
  const original = await nativeCatalog(originalRoot);
  if (
    catalog?.name !== 'celetis' ||
    !Array.isArray(catalog.plugins) ||
    original?.name !== 'celetis' ||
    !Array.isArray(original.plugins)
  )
    throw new HostError('celetis: invalid installed session marketplace catalog', exits.prerequisite);
  const top = await realpath(await git(['rev-parse', '--show-toplevel'], cwd));
  const scopedRoot = await realpath(cwd);
  const direct = await nativeCatalog(scopedRoot);
  const scoped = direct ?? (await nativeCatalog(top));
  const scope = direct ? scopedRoot : top;
  if (scoped?.name === 'celetis' && scope !== metadata.root && pathBefore(scope, metadata.root))
    throw new HostError(
      `celetis: mutable session marketplace precedes the installed source: ${scope}`,
      exits.prerequisite,
    );
  const response = await codexRequest(cwd, 'config/read', { cwd, includeLayers: true }, metadata.home);
  const config =
    object(response) && object(response.result) && object(response.result.config) ? response.result.config : null;
  if (!config || (config.plugins !== undefined && !object(config.plugins)))
    throw new HostError('celetis: cannot inspect configured plugins for the installed session source', exits.blocked);
  const configured = [...new Set([...metadata.marketplacePlugins, ...Object.keys(config.plugins ?? {})])];
  for (const id of configured) {
    const separator = id.lastIndexOf('@');
    if (separator < 0 || id.slice(separator + 1) !== 'celetis') continue;
    const name = id.slice(0, separator);
    if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(name))
      throw new HostError(`celetis: invalid native plugin ID ${id}`, exits.prerequisite);
    const entries = catalog.plugins.filter((entry) => object(entry) && entry.name === name);
    const previous = original.plugins.filter((entry) => object(entry) && entry.name === name);
    if (name !== 'celetis' && !isDeepStrictEqual(entries, previous))
      throw new HostError(
        `celetis: installed session catalog changes configured plugin ${id}; retain its native source before starting`,
        exits.prerequisite,
      );
    if (entries.length === 0 && name !== 'celetis') continue;
    const entry = entries[0];
    if (entries.length !== 1 || !object(entry) || typeof entry.source !== 'string' || isAbsolute(entry.source))
      throw new HostError(`celetis: configured plugin ${id} has no immutable local session source`, exits.prerequisite);
    const path = await contained(metadata.root, join(metadata.root, entry.source));
    if (name === 'celetis' && path !== metadata.root)
      throw new HostError('celetis: session Celetis source is not the active installed root', exits.prerequisite);
    const version = await legacySourceVersion(path, name);
    const cached = await cachedPlugin(metadata.home, name);
    if (!cached || version !== cached.version)
      throw new HostError(
        `celetis: native session would install or replace configured plugin ${id} (${cached?.version ?? 'missing'} -> ${version})`,
        exits.prerequisite,
      );
  }
  return args;
}

export async function installedRoot(host: Host, cwd: string, execute: typeof run = run): Promise<string> {
  if (host === 'claude') {
    const missing =
      'celetis: no enabled Celetis installation; run: claude plugin marketplace add ddinkov10/celetis && claude plugin install celetis@celetis';
    if (!Bun.which('claude', { PATH: childEnv().PATH })) throw new HostError(missing, exits.prerequisite);
    const result = await execute('claude', ['plugin', 'list', '--json'], { cwd });
    if (result.code !== 0) {
      throw new HostError(
        [
          result.stderr.trimEnd(),
          `celetis: claude plugin list --json failed (exit ${result.code})`,
          result.stdout.trimEnd(),
        ]
          .filter(Boolean)
          .join('\n'),
        exits.blocked,
      );
    }
    let records: unknown;
    try {
      records = JSON.parse(result.stdout);
    } catch {}
    if (!Array.isArray(records))
      throw new HostError(`celetis: invalid plugin list JSON\n${result.stdout.trimEnd()}`, exits.blocked);
    return (await claudeInstallation(records, cwd)).root;
  }
  return (await codexPlugin(cwd, execute)).root;
}
