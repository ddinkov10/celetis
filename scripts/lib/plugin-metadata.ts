import type { Stats } from 'node:fs';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { codexRequest, type Host, HostError } from './host.ts';
import { childEnv, run, updateDescriptor } from './process.ts';

const revision = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

export const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export async function git(args: string[], cwd: string, execute: typeof run = run): Promise<string> {
  const result = await execute(
    'git',
    ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args],
    { cwd, timeout: 10_000 },
  );
  if (result.code !== 0)
    throw new HostError(
      [`plugin-update: git ${args[0]} failed (exit ${result.code})`, result.stderr.trimEnd(), result.stdout.trimEnd()]
        .filter(Boolean)
        .join('\n'),
    );
  return result.stdout.trimEnd();
}

export async function installedRevision(
  host: Host,
  root: string,
  source: string,
  nativeRevision?: string,
  execute: typeof run = run,
): Promise<string> {
  const witness = await lstat(join(root, '.git')).catch(() => null);
  if (witness && !witness.isDirectory())
    throw new HostError(`plugin-update: Git witness is not package-owned: ${root}; repair the native installation`);
  if (!witness) {
    if (nativeRevision) return nativeRevision;
    throw new HostError(
      `plugin-update: ${root} has no package-owned Git revision witness; reinstall from a source with verifiable full installed identity`,
    );
  }
  const args = [`--git-dir=${join(root, '.git')}`, `--work-tree=${root}`];
  const common = await git([...args, 'rev-parse', '--path-format=absolute', '--git-common-dir'], root, execute);
  if (
    (await realpath(common).catch(() => '')) !== (await realpath(join(root, '.git'))) ||
    (await lstat(join(root, '.git/objects/info/alternates')).catch(() => null))
  )
    throw new HostError(
      `plugin-update: installed Git witness uses external common state: ${root}; use a package-owned Git record`,
    );
  const installed = await git([...args, 'rev-parse', '--verify', 'HEAD'], root, execute);
  if (nativeRevision && nativeRevision !== installed)
    throw new HostError(
      `plugin-update: native installed revision disagrees with package witness: ${root}; repair the native identity`,
    );
  if (!revision.test(installed)) throw new HostError(`plugin-update: invalid full installed revision in ${root}`);
  const metadataName = '.codex-marketplace-install.json';
  const metadataPath = join(root, metadataName);
  const metadataFile = host === 'codex' ? await lstat(metadataPath).catch(() => null) : null;
  if (metadataFile) {
    let metadata: Record<string, unknown>;
    try {
      metadata = await jsonFile(metadataPath);
    } catch (error) {
      throw new HostError(`plugin-update: invalid native marketplace metadata: ${(error as Error).message}`);
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
      throw new HostError(`plugin-update: invalid native marketplace metadata identity in ${metadataPath}`);
  }
  const changes = await git([...args, 'status', '--porcelain', '-z', '--untracked-files=normal'], root, execute);
  if (changes.split('\0').some((change) => change && !(metadataFile && change === `?? ${metadataName}`)))
    throw new HostError(
      `plugin-update: installed package is dirty: ${root}; review its local changes before checking an update`,
    );
  const remote = await git([...args, 'config', '--get', 'remote.origin.url'], root, execute);
  if (remote !== source)
    throw new HostError(
      `plugin-update: installed Git source does not match configured source: ${remote}; repair the native installation identity`,
    );
  return installed;
}

export function configHome(host: Host): string {
  return host === 'claude'
    ? process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
    : (process.env.CODEX_HOME ?? join(homedir(), '.codex'));
}

export async function codexHome(selected = configHome('codex')): Promise<string> {
  if (!isAbsolute(selected))
    throw new HostError(`celetis: CODEX_HOME must be an existing absolute directory: ${selected}`);
  const home = await realpath(selected).catch(() => null);
  if (!home || !(await lstat(home)).isDirectory())
    throw new HostError(`celetis: cannot resolve CODEX_HOME directory: ${selected}; repair the selected native home`);
  return home;
}

export async function bindUpdateHome(host: Host, selected = configHome(host)): Promise<string> {
  if (!isAbsolute(selected)) throw new HostError(`plugin-update: ${host} home must be absolute: ${selected}`, 2);
  const home = await realpath(selected).catch(() => null);
  if (!home || !(await lstat(home)).isDirectory())
    throw new HostError(`plugin-update: cannot resolve offered ${host} home: ${selected}`, 2);
  process.env[host === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'] = home;
  return home;
}

async function contained(root: string, path: string): Promise<string> {
  const target = await realpath(path).catch(() => null);
  if (target === null)
    throw new HostError(
      `celetis: cannot resolve native Codex identity path: ${path}; repair the selected installation`,
    );
  const part = relative(root, target);
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`))
    throw new HostError(
      `celetis: native Codex identity path is outside ${root}: ${path} resolves to ${target}; repair the selected installation`,
    );
  return target;
}

export async function jsonFile(path: string, optional = false): Promise<Record<string, unknown>> {
  try {
    if (!(await lstat(path)).isFile()) throw new Error('need a regular file with no symbolic link');
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!object(value)) throw new Error('need a JSON object');
    return value;
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new HostError(`plugin-update: cannot read ${path}: ${(error as Error).message}; repair this native record`);
  }
}

export async function nativeJson(
  host: Host,
  args: string[],
  cwd: string,
  inheritedFd?: number,
  env = childEnv(),
  execute: typeof run = run,
): Promise<unknown> {
  inheritedFd ??= updateDescriptor();
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
      result.code,
    );
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new HostError(`celetis: invalid ${host} ${args.join(' ')} JSON\n${result.stdout.trimEnd()}`);
  }
}

export interface PluginMetadata {
  host: Host;
  home: string;
  root: string;
  record: Record<string, unknown>;
  marketplacePlugins: string[];
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
      throw new HostError(`celetis: unsupported agent-plugin schema for an installed session source: ${rootManifest}`);
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
    if (!parent.isDirectory()) throw new HostError(`celetis: invalid native manifest directory: ${join(root, folder)}`);
    const manifest = await jsonFile(candidate);
    if (typeof manifest.$schema === 'string' && manifest.$schema.startsWith('https://agent-plugins.org/schemas/'))
      throw new HostError(
        `celetis: unsupported agent-plugin schema for an installed session source: ${join(root, folder)}`,
      );
    if (manifest.name !== name) throw new HostError(`celetis: unsupported native legacy manifest identity in ${root}`);
    if (manifest.version === undefined || manifest.version === null) return 'local';
    if (typeof manifest.version === 'string' && manifest.version.trim()) return manifest.version.trim();
    throw new HostError(`celetis: invalid native plugin version in ${root}`);
  }
  throw new HostError(`celetis: no native legacy manifest in ${root}`);
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

export async function codexPlugin(
  cwd: string,
  inheritedFd?: number,
  execute: typeof run = run,
): Promise<PluginMetadata> {
  const home = await codexHome();
  const env = childEnv({ ...process.env, CODEX_HOME: home });
  const value = await nativeJson(
    'codex',
    ['plugin', 'list', '--marketplace', 'celetis', '--json'],
    cwd,
    inheritedFd,
    env,
    execute,
  );
  if (!object(value) || !Array.isArray(value.installed)) throw new HostError('celetis: invalid Codex plugin list');
  const records = value.installed.filter((item) => object(item) && item.pluginId === 'celetis@celetis');
  if (records.length > 1)
    throw new HostError('celetis: Codex reports multiple celetis installations; fix the native registry');
  const record: unknown = records[0];
  if (!object(record) || record.enabled !== true || record.installed !== true)
    throw new HostError(
      'celetis: Codex has no enabled celetis@celetis installation; install and enable the plugin in Codex',
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
    throw new HostError('celetis: unsupported Codex celetis source metadata; repair the source-backed installation');
  const active = await cachedPlugin(home, 'celetis');
  if (!active || record.version !== active.version)
    throw new HostError(
      `celetis: Codex registry does not match its installed version ${String(record.version)}; repair the native installation`,
    );
  const root = active.root;
  const marketplaces = await nativeJson(
    'codex',
    ['plugin', 'marketplace', 'list', '--json'],
    cwd,
    inheritedFd,
    env,
    execute,
  );
  if (!object(marketplaces) || !Array.isArray(marketplaces.marketplaces))
    throw new HostError('celetis: invalid Codex marketplace source list');
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
    );
  const marketplaceRoot = await realpath(market.root).catch(() => null);
  const sourceRoot = await realpath(record.source.path).catch(() => null);
  if (!marketplaceRoot || sourceRoot !== marketplaceRoot)
    throw new HostError(
      'celetis: Codex plugin source does not match its native marketplace root; repair the native source chain',
    );
  const catalog = await jsonFile(
    await contained(marketplaceRoot, join(marketplaceRoot, '.claude-plugin/marketplace.json')),
  );
  const plugins = Array.isArray(catalog.plugins)
    ? catalog.plugins.filter((item) => object(item) && item.name === 'celetis')
    : [];
  if (catalog.name !== 'celetis' || plugins.length !== 1 || !['.', './'].includes(plugins[0]?.source))
    throw new HostError(
      'celetis: unsupported or ambiguous Codex Celetis root source; repair the native marketplace catalog',
    );
  const manifest = await jsonFile(await contained(root, join(root, '.claude-plugin/plugin.json')));
  if (manifest.name !== 'celetis' || !(await lstat(join(root, 'scripts')).catch(() => null))?.isDirectory())
    throw new HostError('celetis: Codex reports an invalid celetis package; reinstall the plugin');
  if (!(await lstat(join(root, 'skills/guide/SKILL.md')).catch(() => null))?.isFile())
    throw new HostError('celetis: Codex reports a missing installed skill; reinstall the plugin');
  await contained(root, join(root, 'skills/guide/SKILL.md'));
  const marketplacePlugins = value.installed
    .filter((item) => object(item) && typeof item.pluginId === 'string' && item.pluginId.endsWith('@celetis'))
    .map((item) => item.pluginId as string);
  return { host: 'codex', home, root, record, marketplacePlugins };
}

export async function codexSessionPin(root: string, cwd: string): Promise<string[]> {
  const metadata = await codexPlugin(cwd);
  if (metadata.root !== (await realpath(root)))
    throw new HostError('celetis: enabled package changed before session start; start a fresh runner');
  const source = metadata.record.marketplaceSource;
  if (!object(source) || typeof source.source !== 'string') throw new HostError('celetis: native source is missing');
  if (source.sourceType === 'git') await installedRevision('codex', root, source.source);
  const args = [
    '-c',
    'marketplaces.celetis.source_type="local"',
    '-c',
    `marketplaces.celetis.source=${JSON.stringify(metadata.root)}`,
  ];
  const env = childEnv({ ...process.env, CODEX_HOME: metadata.home });
  const listed = await nativeJson('codex', [...args, 'plugin', 'marketplace', 'list', '--json'], cwd, undefined, env);
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
    throw new HostError('celetis: invalid installed session marketplace catalog');
  const top = await realpath(await git(['rev-parse', '--show-toplevel'], cwd));
  const scopedRoot = await realpath(cwd);
  const direct = await nativeCatalog(scopedRoot);
  const scoped = direct ?? (await nativeCatalog(top));
  const scope = direct ? scopedRoot : top;
  if (scoped?.name === 'celetis' && scope !== metadata.root && pathBefore(scope, metadata.root))
    throw new HostError(`celetis: mutable session marketplace precedes the installed source: ${scope}`);
  const response = await codexRequest(cwd, 'config/read', { cwd, includeLayers: true }, undefined, metadata.home);
  const config =
    object(response) && object(response.result) && object(response.result.config) ? response.result.config : null;
  if (!config || (config.plugins !== undefined && !object(config.plugins)))
    throw new HostError('celetis: cannot inspect configured plugins for the installed session source');
  const configured = [...new Set([...metadata.marketplacePlugins, ...Object.keys(config.plugins ?? {})])];
  for (const id of configured) {
    const separator = id.lastIndexOf('@');
    if (separator < 0 || id.slice(separator + 1) !== 'celetis') continue;
    const name = id.slice(0, separator);
    if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(name))
      throw new HostError(`celetis: invalid native plugin ID ${id}`);
    const entries = catalog.plugins.filter((entry) => object(entry) && entry.name === name);
    const previous = original.plugins.filter((entry) => object(entry) && entry.name === name);
    if (name !== 'celetis' && !isDeepStrictEqual(entries, previous))
      throw new HostError(
        `celetis: installed session catalog changes configured plugin ${id}; retain its native source before starting`,
      );
    if (entries.length === 0 && name !== 'celetis') continue;
    const entry = entries[0];
    if (entries.length !== 1 || !object(entry) || typeof entry.source !== 'string' || isAbsolute(entry.source))
      throw new HostError(`celetis: configured plugin ${id} has no immutable local session source`);
    const path = await contained(metadata.root, join(metadata.root, entry.source));
    if (name === 'celetis' && path !== metadata.root)
      throw new HostError('celetis: session Celetis source is not the active installed root');
    const version = await legacySourceVersion(path, name);
    const cached = await cachedPlugin(metadata.home, name);
    if (!cached || version !== cached.version)
      throw new HostError(
        `celetis: native session would install or replace configured plugin ${id} (${cached?.version ?? 'missing'} -> ${version})`,
      );
  }
  return args;
}
