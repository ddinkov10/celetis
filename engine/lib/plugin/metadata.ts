import type { Stats } from 'node:fs';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { HostError, NotInstalled } from '../command/errors.ts';
import type { Host } from '../config/core.ts';
import { exits } from '../contract/contract.ts';
import { codexRequest } from '../host/codex/app-server.ts';
import { codexHome, configHome } from '../host/homes.ts';
import type { PluginHost } from '../host/names.ts';
import { git, mainCheckout } from '../process/git.ts';
import { childEnv, run, updateDescriptor } from '../process/process.ts';
import { revision } from '../state/fields.ts';
import { celetisName, fits, named } from '../state/schemas.ts';

const engineRoot = resolve(import.meta.dir, '../../..');

export const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const hasControl = (text: string, space = false) =>
  [...text].some((character) => character.charCodeAt(0) < (space ? 33 : 32) || character.charCodeAt(0) === 127);
// String() accepts a one-item array such as ["local"].
const oneOf = (...names: string[]) => z.custom<unknown>((value) => names.includes(String(value)));
const array = z.array(z.unknown());
export const absolute = z.string().refine((path) => isAbsolute(path));
export const nativePath = absolute.refine((path) => !hasControl(path));
export const marketplaceCatalog = z.looseObject({ name: z.literal('celetis'), plugins: array });

const marketplaceInstall = z.strictObject({
  source_type: z.literal('git'),
  source: z.string(),
  revision: z.string(),
  ref_name: z
    .string()
    .min(1)
    .refine((name) => !hasControl(name, true))
    .nullable(),
  sparse_paths: z.array(
    z
      .string()
      .min(1)
      .refine((path) => !path.includes('\0')),
  ),
});

const claudeEntry = z.looseObject({ id: z.literal('celetis@celetis') });
const claudeProject = z.looseObject({ scope: oneOf('project', 'local'), projectPath: absolute });
const claudePath = z.looseObject({ installPath: nativePath });

const codexList = z.looseObject({ installed: array });
const celetisPlugin = z.looseObject({ pluginId: z.literal('celetis@celetis') });
const marketplacePlugin = z.looseObject({ pluginId: z.string().endsWith('@celetis') });
const enabledPlugin = z.looseObject({ enabled: z.literal(true), installed: z.literal(true) });
const codexSource = z.looseObject({
  name: z.literal('celetis'),
  marketplaceName: z.literal('celetis'),
  source: z.looseObject({ source: z.literal('local'), path: absolute }),
  marketplaceSource: z.looseObject({ sourceType: oneOf('git', 'local'), source: z.string().min(1) }),
});
const gitMarketplace = z.looseObject({ marketplaceSource: z.looseObject({ sourceType: z.literal('git') }) });
const skillsReply = z.looseObject({ result: z.looseObject({ data: array }) });
const skillCatalog = z.looseObject({ errors: array.length(0), skills: array });
const codexSkill = z.looseObject({
  enabled: z.literal(true),
  path: nativePath.refine((path) => /\/skills\/[a-z][a-z0-9-]*\/SKILL\.md$/.test(path.split(sep).join('/'))),
});
export const codexMarkets = z.looseObject({ marketplaces: array });
const codexMarket = z.looseObject({ root: absolute, marketplaceSource: z.looseObject({}) });
const configReply = z.looseObject({
  result: z.looseObject({ config: z.looseObject({ plugins: z.looseObject({}).optional() }) }),
});
const relativeSource = z.looseObject({ source: z.string().refine((source) => !isAbsolute(source)) });
const agentPlugin = z.looseObject({ $schema: z.string().startsWith('https://agent-plugins.org/schemas/') });
const manifestVersion = z.string().trim().min(1).nullish();
const jsonObject = z.looseObject({});

export async function installedRevision(
  host: PluginHost | 'engine',
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
      !fits(marketplaceInstall, metadata) ||
      metadata.source !== source ||
      metadata.revision !== installed
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

export async function bindUpdateHome(host: PluginHost, selected = configHome(host)): Promise<string> {
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
    if (!fits(jsonObject, value)) throw new Error('need a JSON object');
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
  host: PluginHost,
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
  marketplaceRoot: string;
  record: z.output<typeof codexSource>;
  marketplacePlugins: string[];
}

export async function claudeInstallation(
  list: unknown,
  cwd: string,
): Promise<{ root: string; records: Record<string, unknown>[] }> {
  const missing =
    'celetis: no enabled Celetis installation; run: claude plugin marketplace add ddinkov10/celetis && claude plugin install celetis@celetis';
  if (!fits(array, list)) throw new HostError('celetis: invalid Claude installation list', exits.blocked);
  const project = await realpath(
    await mainCheckout(cwd).catch((error) => {
      if (error instanceof HostError && error.message.startsWith('fatal: not a git repository')) return cwd;
      throw error;
    }),
  );
  const records: Record<string, unknown>[] = [];
  const roots = new Set<string>();
  for (const item of list) {
    if (!fits(claudeEntry, item)) continue;
    if (item.scope !== 'user') {
      if (!fits(claudeProject, item))
        throw new HostError(
          'celetis: invalid Claude installation scope; repair the native plugin record',
          exits.prerequisite,
        );
      const applicable = await realpath(item.projectPath).catch(() => null);
      if (applicable !== project) continue;
    }
    if (item.enabled === false) continue;
    if (item.enabled !== true) throw new HostError(missing, exits.prerequisite);
    if (!fits(claudePath, item))
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
  if (!fits(celetisName, manifest))
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
    if (fits(agentPlugin, await jsonFile(rootManifest)))
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
    if (fits(agentPlugin, manifest))
      throw new HostError(
        `celetis: unsupported agent-plugin schema for an installed session source: ${join(root, folder)}`,
        exits.prerequisite,
      );
    if (!fits(named(name), manifest))
      throw new HostError(`celetis: unsupported native legacy manifest identity in ${root}`, exits.prerequisite);
    const version = manifestVersion.safeParse(manifest.version);
    if (version.success) return version.data ?? 'local';
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
  if (!fits(codexList, value)) throw new HostError('celetis: invalid Codex plugin list', exits.blocked);
  const records = value.installed.filter((item) => fits(celetisPlugin, item));
  if (records.length > 1)
    throw new HostError(
      'celetis: Codex reports multiple celetis installations; fix the native registry',
      exits.prerequisite,
    );
  const record = records[0];
  if (!fits(enabledPlugin, record))
    throw new NotInstalled(
      'celetis: Codex has no enabled celetis@celetis installation; install and enable the plugin in Codex',
      exits.prerequisite,
    );
  if (!fits(codexSource, record))
    throw new HostError(
      'celetis: unsupported Codex celetis source metadata; repair the source-backed installation',
      exits.prerequisite,
    );
  const scoped = await realpath(cwd);
  const response = await codexRequest(scoped, 'skills/list', { cwds: [scoped], forceReload: true }, home, execute);
  const data = fits(skillsReply, response) ? response.result.data : [];
  const here = z.looseObject({ cwd: z.literal(scoped) });
  const catalogs = data.filter((item) => fits(here, item));
  const catalog = catalogs[0];
  if (catalogs.length !== 1 || !fits(skillCatalog, catalog))
    throw new HostError(
      'celetis: invalid Codex skill catalog for this project; repair the native skill discovery',
      exits.prerequisite,
    );
  const roots = new Set<string>();
  for (const skill of catalog.skills) {
    if (!fits(celetisPlugin, skill) || skill.enabled === false) continue;
    if (!fits(codexSkill, skill))
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
  if (!fits(codexMarkets, marketplaces))
    throw new HostError('celetis: invalid Codex marketplace source list', exits.blocked);
  const markets = marketplaces.marketplaces.filter((item) => fits(celetisName, item));
  const market = markets[0];
  if (
    markets.length !== 1 ||
    !fits(codexMarket, market) ||
    market.marketplaceSource.sourceType !== record.marketplaceSource.sourceType ||
    market.marketplaceSource.source !== record.marketplaceSource.source
  )
    throw new HostError(
      'celetis: Codex marketplace source is missing, changed, or ambiguous; repair the native source chain',
      exits.prerequisite,
    );
  const marketplaceRoot = await realpath(market.root).catch(() => null);
  const sourceRoot = await realpath(record.source.path).catch(() => null);
  if (!marketplaceRoot || sourceRoot !== join(marketplaceRoot, 'plugins/celetis'))
    throw new HostError(
      'celetis: Codex plugin source does not match its native marketplace root; repair the native source chain',
      exits.prerequisite,
    );
  const marketplace = await jsonFile(
    await contained(marketplaceRoot, join(marketplaceRoot, '.claude-plugin/marketplace.json')),
  );
  const plugins = fits(marketplaceCatalog, marketplace)
    ? marketplace.plugins.filter((item) => fits(celetisName, item))
    : [];
  if (plugins.length !== 1 || plugins[0]?.source !== './plugins/celetis')
    throw new HostError(
      'celetis: unsupported or ambiguous Codex Celetis root source; repair the native marketplace catalog',
      exits.prerequisite,
    );
  const manifest = await jsonFile(await contained(root, join(root, '.claude-plugin/plugin.json')));
  if (!fits(celetisName, manifest))
    throw new HostError('celetis: Codex reports an invalid celetis package; reinstall the plugin', exits.prerequisite);
  const marketplacePlugins = value.installed
    .filter((item) => fits(marketplacePlugin, item))
    .map((item) => item.pluginId);
  return { host: 'codex', home, root, marketplaceRoot, record, marketplacePlugins };
}

export async function codexRevision(
  metadata: PluginMetadata,
  source: string,
  execute: typeof run = run,
): Promise<string> {
  if (!fits(gitMarketplace, metadata.record))
    throw new HostError(
      'update: selected Codex marketplace is not a Git source; no remote update check is available',
      exits.prerequisite,
    );
  const clone = metadata.marketplaceRoot;
  const installed = await installedRevision('codex', clone, source, undefined, execute);
  const gitDir = `--git-dir=${join(clone, '.git')}`;
  const prefix = 'plugins/celetis/';
  const tree = new Map<string, string | null>();
  const listed = await git(
    [gitDir, 'ls-tree', '-r', '-z', '--full-tree', installed, '--', 'plugins/celetis'],
    clone,
    execute,
  );
  for (const entry of listed.split('\0')) {
    if (!entry) continue;
    const tab = entry.indexOf('\t');
    const [mode, , id] = entry.slice(0, tab).split(' ');
    tree.set(entry.slice(tab + 1 + prefix.length), (mode === '100644' || mode === '100755') && id ? id : null);
  }
  const cache = new Map<string, boolean>();
  const walk = async (folder: string, base: string): Promise<void> => {
    for (const name of await readdir(folder)) {
      const path = join(folder, name);
      const stats = await lstat(path);
      if (stats.isDirectory()) await walk(path, `${base}${name}/`);
      else cache.set(`${base}${name}`, stats.isFile());
    }
  };
  await walk(metadata.root, '');
  const refuse = (problem: string) =>
    new HostError(
      `celetis: the Codex plugin cache ${metadata.root} does not match plugins/celetis at ${installed.slice(0, 12)}: ${problem}; run codex plugin marketplace upgrade celetis, or reinstall the plugin`,
      exits.prerequisite,
    );
  const paths = [...new Set([...tree.keys(), ...cache.keys()])].sort();
  for (const path of paths) {
    if (!cache.has(path)) throw refuse(`${path} is missing`);
    if (!tree.has(path)) throw refuse(`${path} is extra`);
    if (!cache.get(path) || !tree.get(path)) throw refuse(`${path} is not a regular file`);
  }
  const hashed = await git([gitDir, 'hash-object', '--no-filters', '--', ...paths], metadata.root, execute);
  const objects = hashed.split('\n');
  const changed = paths.find((path, at) => objects[at] !== tree.get(path));
  if (changed !== undefined) throw refuse(`${changed} is changed`);
  return installed;
}

export async function codexSessionPin(cwd: string): Promise<string[]> {
  const metadata = await codexPlugin(cwd);
  const args = [
    '-c',
    'marketplaces.celetis.source_type="local"',
    '-c',
    `marketplaces.celetis.source=${JSON.stringify(metadata.root)}`,
  ];
  const env = childEnv({ ...process.env, CODEX_HOME: metadata.home });
  const listed = await nativeJson('codex', [...args, 'plugin', 'marketplace', 'list', '--json'], cwd, env);
  const markets = fits(codexMarkets, listed) ? listed.marketplaces.filter((market) => fits(celetisName, market)) : [];
  const selected = z.looseObject({
    root: z.literal(metadata.root),
    marketplaceSource: z.looseObject({ sourceType: z.literal('local'), source: z.literal(metadata.root) }),
  });
  if (markets.length !== 1 || !fits(selected, markets[0]))
    throw new HostError(
      'celetis: native policy or marketplace discovery did not select the installed local session source',
      exits.prerequisite,
    );
  const catalog = await nativeCatalog(metadata.root);
  const original = await nativeCatalog(metadata.marketplaceRoot);
  if (!fits(marketplaceCatalog, catalog) || !fits(marketplaceCatalog, original))
    throw new HostError('celetis: invalid installed session marketplace catalog', exits.prerequisite);
  const top = await realpath(await git(['rev-parse', '--show-toplevel'], cwd));
  const scopedRoot = await realpath(cwd);
  const direct = await nativeCatalog(scopedRoot);
  const scoped = direct ?? (await nativeCatalog(top));
  const scope = direct ? scopedRoot : top;
  if (fits(celetisName, scoped) && scope !== metadata.root && pathBefore(scope, metadata.root))
    throw new HostError(
      `celetis: mutable session marketplace precedes the installed source: ${scope}`,
      exits.prerequisite,
    );
  const response = await codexRequest(cwd, 'config/read', { cwd, includeLayers: true }, metadata.home);
  if (!fits(configReply, response))
    throw new HostError('celetis: cannot inspect configured plugins for the installed session source', exits.blocked);
  const configured = [
    ...new Set([...metadata.marketplacePlugins, ...Object.keys(response.result.config.plugins ?? {})]),
  ];
  for (const id of configured) {
    const separator = id.lastIndexOf('@');
    if (separator < 0 || id.slice(separator + 1) !== 'celetis') continue;
    const name = id.slice(0, separator);
    if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(name))
      throw new HostError(`celetis: invalid native plugin ID ${id}`, exits.prerequisite);
    const plugin = named(name);
    const entries = catalog.plugins.filter((entry) => fits(plugin, entry));
    const previous = original.plugins.filter((entry) => fits(plugin, entry));
    if (name !== 'celetis' && !isDeepStrictEqual(entries, previous))
      throw new HostError(
        `celetis: installed session catalog changes configured plugin ${id}; retain its native source before starting`,
        exits.prerequisite,
      );
    if (entries.length === 0 && name !== 'celetis') continue;
    const entry = entries[0];
    if (entries.length !== 1 || !fits(relativeSource, entry))
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
  if (host === 'opencode') return join(engineRoot, 'plugins', 'celetis');
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
    if (!fits(array, records))
      throw new HostError(`celetis: invalid plugin list JSON\n${result.stdout.trimEnd()}`, exits.blocked);
    return (await claudeInstallation(records, cwd)).root;
  }
  return (await codexPlugin(cwd, execute)).root;
}
