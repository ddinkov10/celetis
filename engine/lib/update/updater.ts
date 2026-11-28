import { lstat, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { HostError, NotInstalled } from '../command/errors.ts';
import { commandInput } from '../command/operation.ts';
import {
  type ExitCode,
  exits,
  pluginContract,
  pluginContractFile,
  servedContracts,
  servedContractsFile,
  usage,
} from '../contract/contract.ts';
import { codexRequest } from '../host/codex/app-server.ts';
import { configHome } from '../host/homes.ts';
import { hostAvailability, requireBun } from '../host/host.ts';
import { isHost, isPluginHost, type PluginHost, pluginHosts } from '../host/names.ts';
import {
  engineIdentity,
  enginePaths,
  engineRefName,
  engineSource,
  holdsEngine,
  installEngine,
  readEngine,
} from '../install/installation.ts';
import { engineTarget } from '../package/package.ts';
import {
  absolute,
  bindUpdateHome,
  claudeInstallation,
  codexMarkets,
  codexPlugin,
  codexRevision,
  hasControl,
  installedRevision,
  installedRoot,
  jsonFile,
  marketplaceCatalog,
  nativeJson,
  nativePath,
} from '../plugin/metadata.ts';
import { checkClaudePolicy, claudePolicy, type PolicyRecord, requireUpdatePolicy } from '../plugin/policy.ts';
import { git } from '../process/git.ts';
import { bunArgs, childEnv, run } from '../process/process.ts';
import { releaseParts } from '../release/release.ts';
import { editJSON, jsonStyle } from '../setup/json-layout.ts';
import { ambiguousJSON } from '../setup/wiring.ts';
import { installRecorder, markDefect } from '../state/events.ts';
import { revision } from '../state/fields.ts';
import { celetisName, fits, revisionText } from '../state/schemas.ts';
import { writeAtomic } from '../state/state.ts';
import { UpdateLock, withPluginRead } from './lock.ts';
import {
  type Part,
  type PluginUpdate,
  type PreparedUpdate,
  pluginInspection,
  type UpdateCheck,
  type UpdateResult,
} from './offer.ts';
import { partDiffers, pendingParts } from './pending.ts';
import { followTarget, newestTarget, requestTarget, resolveRef } from './target.ts';
import type { UpdateStage } from './types.ts';

export type { UpdateCheck };

export type UpdateTarget = { home: string; root: string; source: string; installed: string; target: string };
export type Installation = {
  host: PluginHost;
  home: string;
  root: string;
  source: string;
  ref: string;
  installed: string;
  clone?: string;
  scope?: string;
  registered?: unknown;
  user: Readonly<{ path: string; source: Record<string, unknown> }> | null;
  layer: string | null;
  siblings: string[];
};

const nativeObject = z.looseObject({});
const sourced = z.looseObject({ source: nativeObject });
const declared = z.looseObject({ source: z.unknown() });
const located = z.looseObject({ installLocation: z.string() });
const gitUrl = z
  .string()
  .refine(
    (url) =>
      url.length > 0 &&
      !hasControl(url) &&
      (/^(https?|ssh|git|file):\/\//.test(url) || url.startsWith('/') || /^[\w.-]+@[\w.-]+:/.test(url)),
  );
const gitRef = z.string().refine((ref) => ref.length > 0 && !ref.startsWith('-') && !hasControl(ref, true));
const gitRecord = z.looseObject({ source: z.literal('git') });
const githubRecord = z.looseObject({ source: z.literal('github'), repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/) });
const inlineRecord = z.looseObject({
  source: z.literal('settings'),
  name: z.literal('celetis'),
  plugins: z.array(z.unknown()),
});
const inlinePlugin = z.looseObject({
  source: z.looseObject({ source: z.literal('git-subdir'), path: z.literal('plugins/celetis') }),
});
const githubArg = z.looseObject({ source: z.literal('github'), repo: z.string() });
const gitArg = z.looseObject({ source: z.literal('git'), url: z.string() });
const cloneSource = z.looseObject({ source: z.looseObject({ source: z.enum(['git', 'github']) }) });
const marketsOf = z.looseObject({ extraKnownMarketplaces: nativeObject });
const layerMarket = z.looseObject({ extraKnownMarketplaces: z.looseObject({ celetis: declared }) });
const userMarket = z.looseObject({ extraKnownMarketplaces: z.looseObject({ celetis: sourced }) });
const userEntry = z.looseObject({ extraKnownMarketplaces: z.looseObject({ celetis: nativeObject }) });
const registration = z.looseObject({ installPath: nativePath });
const registrations = z.array(z.unknown());
const registryV2 = z.looseObject({
  version: z.literal(2),
  plugins: z.looseObject({ 'celetis@celetis': registrations }),
});
const pluginsOf = z.looseObject({ plugins: nativeObject });
const scoped = z.looseObject({ scope: z.string() });
const versioned = z.looseObject({ version: z.string() });
const committed = z.looseObject({ gitCommitSha: z.string() });
const knownCommit = z.looseObject({ gitCommitSha: revisionText });
const configReply = z.looseObject({ result: z.looseObject({ config: nativeObject }) });
const effectiveMarket = z.looseObject({
  marketplaces: z.looseObject({ celetis: z.looseObject({ source_type: z.literal('git') }) }),
});
const pluginConfig = z.looseObject({ plugins: nativeObject.optional() });
const skipped = z.looseObject({ skipped: z.string() });

function gitSource(value: unknown): { source: string; ref: string } {
  if (!fits(nativeObject, value))
    throw new HostError('update: no configured Git source; inspect the native marketplace record', exits.prerequisite);
  let source: unknown;
  if (fits(gitRecord, value)) source = value.url;
  else if (fits(inlineRecord, value)) {
    const plugins = value.plugins.filter((plugin) => fits(celetisName, plugin));
    const plugin = plugins[0];
    if (plugins.length !== 1 || !fits(inlinePlugin, plugin))
      throw new HostError('update: invalid native inline marketplace source', exits.prerequisite);
    return gitSource({ source: 'git', url: plugin.source.url, ref: plugin.source.ref });
  } else if (fits(githubRecord, value)) source = `https://github.com/${value.repo}.git`;
  if (!fits(gitUrl, source))
    throw new HostError(
      'update: unsupported configured Git source; use a native Git or GitHub marketplace source',
      exits.prerequisite,
    );
  const ref = value.ref ?? 'HEAD';
  if (!fits(gitRef, ref))
    throw new HostError('update: invalid configured Git ref; repair the native marketplace source', exits.prerequisite);
  return { source, ref };
}

function claudeArg(source: Record<string, unknown>): string {
  if (fits(githubArg, source)) return source.repo;
  if (fits(gitArg, source)) return source.url;
  throw new HostError(
    'update: the Claude user entry of celetis needs a github or git source; repair the user settings',
    exits.prerequisite,
  );
}

async function sameSource(layer: unknown, own: ReturnType<typeof gitSource>, cwd: string): Promise<boolean> {
  let declared: ReturnType<typeof gitSource>;
  try {
    declared = gitSource(layer);
  } catch {
    return false;
  }
  if (declared.source !== own.source) return false;
  if (declared.ref === own.ref) return true;
  const full = (ref: string) =>
    resolveRef(own.source, ref, cwd).then(
      (resolved) => resolved.full,
      (error: unknown) => {
        if (error instanceof HostError && error.code === exits.prerequisite) return null;
        throw error;
      },
    );
  const [a, b] = [await full(declared.ref), await full(own.ref)];
  return a !== null && a === b;
}

async function conflictingLayer(
  policies: PolicyRecord[],
  userPath: string,
  pin: ReturnType<typeof gitSource>,
  cwd: string,
): Promise<string | null> {
  for (const { path, value } of policies) {
    if (
      path === userPath ||
      basename(dirname(path)) !== '.claude' ||
      !['settings.json', 'settings.local.json'].includes(basename(path))
    )
      continue;
    if (fits(layerMarket, value) && !(await sameSource(value.extraKnownMarketplaces.celetis.source, pin, cwd)))
      return path;
  }
  return null;
}

async function claudeRegistrations(records: unknown, scope: unknown, version: unknown, root: string) {
  const matches: Record<string, unknown>[] = [];
  if (fits(registrations, records))
    for (const record of records)
      if (
        fits(registration, record) &&
        record.scope === scope &&
        record.version === version &&
        (await realpath(record.installPath).catch(() => null)) === root
      )
        matches.push(record);
  return matches;
}

const clonePlace = (location: string) => [`--git-dir=${join(location, '.git')}`, `--work-tree=${location}`];

async function cloneRevision(location: string): Promise<string> {
  let head: string;
  let changes: string;
  try {
    head = await git([...clonePlace(location), 'rev-parse', '--verify', 'HEAD'], location);
    if (!revision.test(head)) throw new Error(`invalid HEAD ${head}`);
    changes = await git([...clonePlace(location), 'status', '--porcelain', '--untracked-files=normal'], location);
  } catch (error) {
    const [first, reason] = (error as Error).message.split('\n');
    throw new HostError(
      `update: cannot read the Claude marketplace clone ${location}: ${reason || first}; repair: claude plugin marketplace update celetis`,
      exits.prerequisite,
    );
  }
  // A plugin reload copies the working tree, and `claude plugin marketplace update` keeps a change at the branch head.
  if (changes)
    throw new HostError(
      `update: the Claude marketplace clone ${location} has local changes (${changes.split('\n')[0]?.trim()}); to discard them, run git -C "${location}" reset --hard and git -C "${location}" clean -fd, then run celetis update again`,
      exits.prerequisite,
    );
  return head;
}

// An inline `settings` record, which a stopped update can leave behind, has no clone.
const nativeClone = async (value: unknown): Promise<string | undefined> =>
  fits(located, value) && fits(cloneSource, value) ? cloneRevision(value.installLocation) : undefined;

async function installation(host: PluginHost, cwd: string): Promise<[Installation, PolicyRecord[]]> {
  const home = await bindUpdateHome(host);
  let clone: string | undefined;
  let siblings: string[] = [];
  let user: Installation['user'] = null;
  let policies: PolicyRecord[] = [];
  let scope: string | undefined;
  let registeredSource: unknown;
  let root: string;
  let nativeRevision: string | undefined;
  let configured: { source: string; ref: string };
  let installed: string;
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
    scope = fits(scoped, record) ? record.scope : undefined;
    const manifest = await jsonFile(join(root, '.claude-plugin/plugin.json'));
    if (!fits(celetisName, manifest))
      throw new HostError(`update: wrong installed plugin identity in ${root}`, exits.prerequisite);
    policies = await claudePolicy(cwd);
    checkClaudePolicy(policies);
    const knownPath = join(configHome(host), 'plugins/known_marketplaces.json');
    const nativeMarket = policies.find((record) => record.path === knownPath)?.value.celetis;
    registeredSource = nativeMarket;
    const settingsPath = join(configHome(host), 'settings.json');
    const settings = policies.find((record) => record.path === settingsPath)?.value;
    if (fits(userMarket, settings))
      user = { path: settingsPath, source: settings.extraKnownMarketplaces.celetis.source };
    if (user && fits(sourced, nativeMarket)) {
      const follows = nativeMarket.source.ref ?? 'HEAD';
      const pins = user.source.ref ?? 'HEAD';
      if (follows !== pins)
        throw new HostError(
          `update: the Claude marketplace catalog in ${knownPath} follows ${String(follows)}, and the user entry in ${settingsPath} pins ${String(pins)}; run claude plugin marketplace add ${claudeArg(user.source)}${pins === 'HEAD' ? '' : `#${String(pins)}`} in a folder with no project entry of celetis, then run celetis update again`,
          exits.prerequisite,
        );
    }
    let configuredSource: unknown;
    for (const { value } of policies) {
      const market = fits(marketsOf, value) ? value.extraKnownMarketplaces.celetis : value.celetis;
      if (fits(declared, market)) configuredSource = market.source;
    }
    configured = gitSource(user ? user.source : configuredSource);
    const registry = await jsonFile(join(configHome(host), 'plugins/installed_plugins.json'), true);
    if (fits(registryV2, registry)) {
      const matches = await claudeRegistrations(
        registry.plugins['celetis@celetis'],
        record.scope,
        record.version,
        root,
      );
      if (matches.length > 1)
        throw new HostError('update: native installed scope/path/version record is ambiguous', exits.prerequisite);
      const matched = matches[0];
      if (matches.length === 1 && fits(knownCommit, matched)) {
        const path = join(configHome(host), 'plugins/known_marketplaces.json');
        const market = policies.find((record) => record.path === path)?.value.celetis;
        let registered: ReturnType<typeof gitSource>;
        try {
          registered = gitSource(fits(nativeObject, market) ? market.source : undefined);
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
    installed = await installedRevision(host, root, configured.source, nativeRevision);
    clone = await nativeClone(nativeMarket);
  } else {
    const metadata = await codexPlugin(cwd);
    root = metadata.root;
    const market = metadata.record.marketplaceSource;
    if (market.sourceType !== 'git')
      throw new HostError(
        'update: selected Codex marketplace is not a Git source; no remote update check is available',
        exits.prerequisite,
      );
    registeredSource = {
      source: metadata.record.source,
      marketplaceSource: market,
      root: await realpath(metadata.record.source.path),
    };
    const reply = await codexRequest(cwd, 'config/read', { cwd, includeLayers: true }, metadata.home);
    const config = fits(configReply, reply) ? reply.result.config : null;
    if (!fits(effectiveMarket, config) || config.marketplaces.celetis.source !== market.source)
      throw new HostError(
        'update: Codex effective marketplace source differs from installed metadata; repair the native configuration',
        exits.prerequisite,
      );
    const effective = config.marketplaces.celetis;
    configured = gitSource({ source: 'git', url: effective.source, ref: effective.ref });
    if (!fits(pluginConfig, config))
      throw new HostError(
        'update: invalid effective Codex plugin configuration; inspect its native sources',
        exits.prerequisite,
      );
    siblings = [...new Set([...metadata.marketplacePlugins, ...Object.keys(config.plugins ?? {})])]
      .filter((id) => id.endsWith('@celetis') && id !== 'celetis@celetis')
      .sort();
    installed = await codexRevision(metadata, configured.source);
  }
  return [
    {
      host,
      home,
      source: configured.source,
      installed,
      ...(clone ? { clone } : {}),
      root: await realpath(root),
      ref: configured.ref,
      scope,
      registered: registeredSource,
      user,
      layer: null,
      siblings,
    },
    policies,
  ];
}

const inspectArgs = (host: PluginHost, request: string | null) =>
  bunArgs(import.meta.path, ['--inspect', host, ...(request === null ? [] : [request])]);

async function inspect(host: PluginHost, cwd: string, request: string | null): Promise<PluginUpdate> {
  const [found, policies] = await installation(host, cwd);
  const current = await resolveRef(found.source, found.ref, cwd).catch(async (error: unknown) => {
    if (error instanceof HostError && error.code === exits.prerequisite && releaseParts(found.ref) !== null)
      await newestTarget(found.source, cwd);
    throw error;
  });
  const to =
    request !== null
      ? await requestTarget(found.source, request, cwd)
      : current.ref.kind === 'branch'
        ? current
        : await followTarget(found.source, current.ref, cwd);
  const layer = found.user
    ? await conflictingLayer(policies, found.user.path, { source: found.source, ref: to.full }, cwd)
    : null;
  return { ...found, layer, target: to.target, resolvedRef: current.full, to: to.full, toRef: to.ref };
}

async function settle(part: 'engine' | PluginHost, read: () => Promise<Part>): Promise<Part> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof NotInstalled) return { part, skipped: `Celetis is not installed in ${part}` };
    return { part, error: error instanceof Error ? error.message : String(error) };
  }
}

async function inspectPlugin(
  host: PluginHost,
  cwd: string,
  request: string | null,
  ownerPid?: number,
): Promise<PluginUpdate | string> {
  if (!hostAvailability(host).available) return `no ${host} command on PATH`;
  if (host === 'codex') {
    const home = configHome(host);
    if (process.env.CODEX_HOME === undefined && !(await lstat(home).catch(() => null)))
      return `Codex has no home folder ${home}`;
    const listed = await nativeJson(host, ['plugin', 'marketplace', 'list', '--json'], cwd);
    if (!fits(codexMarkets, listed))
      throw new HostError('celetis: invalid Codex marketplace source list', exits.blocked);
    if (!listed.marketplaces.some((market) => fits(celetisName, market))) return 'Celetis is not installed in codex';
  }
  const decoded = (output: string): PluginUpdate | string => {
    const value: unknown = JSON.parse(output);
    if (fits(skipped, value)) return value.skipped;
    if (fits(pluginInspection, value)) return value;
    throw new HostError(`update: the ${host} inspection printed an invalid answer`, exits.blocked);
  };
  const args = inspectArgs(host, request);
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

function pluginPart({ host, home, root, source, resolvedRef, to, installed, target, clone }: PluginUpdate): Part {
  return { part: host, home, root, source, ref: resolvedRef, to, installed, target, ...(clone ? { clone } : {}) };
}

const slow: typeof run = (file, args, options) =>
  run(file, args, { ...options, timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
const absent = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);
type Scratch = { folder: string | null; fetched: Set<string> };

async function fileOnDisk(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (absent.has((error as NodeJS.ErrnoException).code ?? '')) return null;
    throw new HostError(`update: cannot read ${path}: ${(error as Error).message}`, exits.blocked);
  }
}

async function fileAt(scratch: Scratch, source: string, revision: string, path: string): Promise<string | null> {
  try {
    if (!scratch.folder) scratch.folder = await mkdtemp(join(tmpdir(), 'celetis-contract.'));
    const folder = scratch.folder;
    const fetched = JSON.stringify([source, revision]);
    if (!scratch.fetched.has(fetched)) {
      if (!scratch.fetched.size) await git(['init', '-q'], folder, slow);
      await git(['fetch', '-q', '--depth', '1', '--no-tags', '--', source, revision], folder, slow);
      scratch.fetched.add(fetched);
    }
    if (!/^100(644|755) blob /.test(await git(['ls-tree', revision, '--', path], folder, slow))) return null;
    return await git(['cat-file', 'blob', `${revision}:${path}`], folder, slow);
  } catch (error) {
    const [first, reason] = (error as Error).message.split('\n');
    throw new HostError(
      `update: cannot read ${path} of ${source} at ${short(revision)}: ${reason || first}`,
      exits.blocked,
    );
  }
}

function pairLines(
  serves: ReadonlyMap<number, string> | null,
  target: string,
  plugins: PluginUpdate[],
  needs: Map<PluginHost, number | null>,
  changed: boolean,
): string[] {
  const action = `${changed ? '' : 'nothing changed; '}set one compatible source and ref for the parts (plugins/celetis/README.md, "Updates")`;
  if (!serves) return [`update: the engine at ${short(target)} declares no served contract versions; ${action}`];
  const list = [...serves.keys()].sort((a, b) => a - b).join(', ');
  return plugins.flatMap(({ host, target: at }) => {
    const needed = needs.get(host) ?? null;
    if (needed === null)
      return [`update: the ${host} plugin at ${short(at)} declares no valid contract version; ${action}`];
    return serves.has(needed)
      ? []
      : [
          `update: the ${host} plugin at ${short(at)} needs contract ${needed} and the engine at ${short(target)} serves ${list}; ${action}`,
        ];
  });
}

function claudeStops(plugins: PluginUpdate[]): string[] {
  return plugins.flatMap((plugin) => {
    if (plugin.host !== 'claude') return [];
    if (plugin.layer !== null && plugin.user !== null)
      return [
        `update: ${plugin.layer} declares the marketplace celetis with another source or ref than ${plugin.user.path}; remove that entry (setup removes an entry that it owns), then run celetis update again`,
      ];
    if (plugin.user === null && plugin.to !== plugin.resolvedRef)
      return [
        `update: the user settings of Claude Code hold no marketplace celetis; add it as plugins/celetis/README.md, "Each machine: Claude Code", says: claude plugin marketplace add ${plugin.source}#${plugin.toRef.name}`,
      ];
    return [];
  });
}

async function discoverUpdate(
  cwd: string,
  request: string | null,
  ownerPid?: number,
  changed = false,
): Promise<{ parts: Part[]; prepared: PreparedUpdate | null; error: string | null }> {
  let engine: PreparedUpdate['engine'] | null = null;
  let serves: ReadonlyMap<number, string> | null = null;
  const plugins: PluginUpdate[] = [];
  const needs = new Map<PluginHost, number | null>();
  const scratch: Scratch = { folder: null, fetched: new Set() };
  try {
    const found = [
      await settle('engine', async () => {
        const installed = await readEngine();
        if (!installed) return { part: 'engine', skipped: 'the celetis engine is not installed' };
        const source = await engineSource(installed.root);
        if (installed.revision !== source.revision)
          throw new HostError(
            'update: installed engine link and revision disagree; repair the engine',
            exits.prerequisite,
          );
        const { to, full, contract } = await engineTarget(source, request, cwd);
        const ref = engineRefName(source);
        if (to.revision === source.revision && full !== ref)
          throw new HostError(
            `update: the engine follows ${ref} at ${short(source.revision)}, and ${full} is the same commit; the engine cannot move between two refs at one commit`,
            exits.prerequisite,
          );
        const folder = join(enginePaths().versions, to.revision);
        if (
          to.revision !== source.revision &&
          (await lstat(folder).catch(() => null)) &&
          !(await holdsEngine(folder, to))
        )
          throw new HostError(
            `update: ${folder} holds another engine than ${full}; move it away, then run celetis update again`,
            exits.prerequisite,
          );
        const text =
          source.revision === to.revision
            ? await fileOnDisk(join(installed.root, servedContractsFile))
            : to.kind === 'package'
              ? contract
              : await fileAt(scratch, to.source, to.revision, servedContractsFile);
        serves = text === null ? null : servedContracts(text);
        engine = { installed, source, to };
        return {
          part: 'engine',
          root: installed.root,
          source: source.source,
          ref,
          to: full,
          installed: source.revision,
          target: to.revision,
        };
      }),
    ];
    for (const host of pluginHosts)
      found.push(
        await settle(host, async () => {
          const inspected = await inspectPlugin(host, cwd, request, ownerPid);
          if (typeof inspected === 'string') return { part: host, skipped: inspected };
          const text =
            inspected.installed === inspected.target
              ? await fileOnDisk(join(inspected.root, pluginContractFile))
              : await fileAt(scratch, inspected.source, inspected.target, `plugins/celetis/${pluginContractFile}`);
          needs.set(host, text === null ? null : pluginContract(text));
          plugins.push(inspected);
          return pluginPart(inspected);
        }),
      );
    const first = found[0];
    const target = first && 'target' in first ? first.target : undefined;
    let error: string | null = null;
    const stops = claudeStops(plugins);
    if (found.some((part) => 'error' in part))
      error = `update: fix the errors above${changed ? '' : '; nothing changed'}`;
    else if (stops.length) error = stops.join('\n');
    else if (!engine || !target)
      error =
        'update: the celetis engine is not installed; run the first install of plugins/celetis/README.md, "First install"';
    else if (!plugins.length)
      error =
        'update: no host has Celetis installed; install the plugin as plugins/celetis/README.md, "Wire a product project", says';
    else error = pairLines(serves, target, plugins, needs, changed).join('\n') || null;
    return {
      parts: found,
      prepared: !error && engine && target ? { parts: found, engine, plugins, target, request } : null,
      error,
    };
  } finally {
    if (scratch.folder) await rm(scratch.folder, { recursive: true, force: true });
  }
}

export async function inspectUpdate(cwd: string, request: string | null = null): Promise<UpdateCheck> {
  const { parts, prepared, error } = await discoverUpdate(cwd, request);
  return {
    parts,
    offer: prepared?.parts.some((part) => 'installed' in part && partDiffers(part)) ? prepared : null,
    error,
  };
}

async function replaceClaudeMarketplace(
  path: string,
  expected: Record<string, unknown>,
  replacement: Record<string, unknown>,
): Promise<void> {
  const registry = await jsonFile(path);
  const current = registry.celetis;
  if (
    !fits(nativeObject, current) ||
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
  await writeAtomic(path, JSON.stringify({ ...registry, celetis: replacement }), { mode: metadata.mode & 0o7777 });
}

async function moveClaude(
  lock: UpdateLock,
  env: NodeJS.ProcessEnv,
  config: string,
  target: PluginUpdate,
  completed: string[],
): Promise<PluginUpdate> {
  const user = target.user;
  if (!user)
    throw new HostError(
      `update: ${join(config, 'settings.json')} has no user entry extraKnownMarketplaces.celetis to move; add the marketplace at user scope`,
      exits.prerequisite,
    );
  const name = target.toRef.name;
  const text = await readFile(user.path, 'utf8');
  if (ambiguousJSON(text))
    throw new HostError(`update: ${user.path} holds ambiguous JSON; repair it, then check again`, exits.prerequisite);
  const doc: unknown = JSON.parse(text);
  if (!fits(userEntry, doc) || !isDeepStrictEqual(doc.extraKnownMarketplaces.celetis.source, user.source))
    throw new HostError(`update: the user entry of celetis in ${user.path} changed; check again`, exits.prerequisite);
  const arg = claudeArg(user.source);
  const source = { ...user.source, ref: name };
  doc.extraKnownMarketplaces.celetis.source = source;
  const next = editJSON(text, doc, jsonStyle(text, text), []);
  if (!isDeepStrictEqual(JSON.parse(next), doc))
    throw new HostError(`update: cannot keep the layout of ${user.path}; no change was written`, exits.internal);
  const metadata = await lstat(user.path);
  if (!metadata.isFile())
    throw new HostError(`update: ${user.path} needs a regular file with no symbolic link`, exits.blocked);
  await writeAtomic(user.path, next, {
    mode: metadata.mode & 0o7777,
    check: async () => {
      if ((await readFile(user.path, 'utf8')) !== text)
        throw new HostError(`update: another writer changed ${user.path}; no change was written`, exits.blocked);
    },
  });
  completed.push(`claude user entry ref ${name}`);
  try {
    await lock.run('claude', ['plugin', 'marketplace', 'add', '--scope', 'user', '--json', '--', `${arg}#${name}`], {
      cwd: process.cwd(),
      env,
    });
  } catch (error) {
    throw new HostError(
      [
        `update: the user entry in ${user.path} pins ${name}, and the marketplace add failed: ${(error as Error).message}`,
        `repair: claude plugin marketplace add ${arg}#${name}`,
      ].join('\n'),
      exits.blocked,
    );
  }
  completed.push(`claude marketplace add ${arg}#${name}`);
  const registryPath = join(config, 'plugins/known_marketplaces.json');
  const registered = (await jsonFile(registryPath)).celetis;
  if (
    !fits(nativeObject, registered) ||
    !isDeepStrictEqual(registered.source, source) ||
    !fits(nativeObject, target.registered) ||
    registered.installLocation !== target.registered.installLocation
  )
    throw new HostError(
      `update: the Claude marketplace record in ${registryPath} does not follow ${name} after the add: ${JSON.stringify(registered)}`,
      exits.blocked,
    );
  const clone = await nativeClone(registered);
  return {
    ...target,
    ref: name,
    resolvedRef: target.to,
    user: { path: user.path, source },
    registered,
    ...(clone ? { clone } : {}),
  };
}

async function moveCodex(
  lock: UpdateLock,
  env: NodeJS.ProcessEnv,
  target: PluginUpdate,
  completed: string[],
): Promise<PluginUpdate> {
  const name = target.toRef.name;
  await lock.run('codex', ['plugin', 'marketplace', 'remove', 'celetis'], { cwd: process.cwd(), env });
  completed.push('codex marketplace remove celetis');
  try {
    await lock.run('codex', ['plugin', 'marketplace', 'add', '--ref', name, '--', target.source], {
      cwd: process.cwd(),
      env,
    });
  } catch (error) {
    throw new HostError(
      [
        (error as Error).message,
        `update: codex has no marketplace celetis; repair: codex plugin marketplace add ${target.source} --ref ${name}, then run celetis update --to ${name} again`,
      ].join('\n'),
      exits.blocked,
    );
  }
  completed.push(`codex marketplace add ${target.source} --ref ${name}`);
  return { ...target, ref: name, resolvedRef: target.to };
}

async function updatePlugin(
  ownerPid: number,
  host: PluginHost,
  target: PluginUpdate,
  request: string | null,
): Promise<PluginUpdate> {
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
    let expected = target;
    const revalidate = async () => {
      const output = await lock.run(process.execPath, inspectArgs(host, request), {
        cwd: process.cwd(),
        env,
      });
      const current: unknown = JSON.parse(output);
      if (!fits(pluginInspection, current) || !isDeepStrictEqual(current, expected))
        throw new HostError(
          `update: offered installation identity or target changed; this attempt is consumed. Check again and obtain a new direct user response. Observed: ${JSON.stringify(current)}`,
          exits.prerequisite,
        );
      return current;
    };
    let details = await revalidate();
    const moving = target.to !== target.resolvedRef;
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
        if (moving) {
          operation = 'claude marketplace ref move';
          expected = await moveClaude(lock, env, config, target, completed);
          details = await revalidate();
          operation = 'prepare native target';
        }
        if (!['user', 'project', 'local'].includes(details.scope ?? '') || !fits(nativeObject, details.registered))
          throw new HostError('update: native installed scope/source is unavailable', exits.prerequisite);
        const registryPath = join(config, 'plugins/known_marketplaces.json');
        const original = (await jsonFile(registryPath)).celetis;
        if (!fits(cloneSource, original))
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
          !fits(absolute, location) ||
          !(await lstat(location).catch(() => null))?.isDirectory() ||
          !(await lstat(join(location, '.claude-plugin')).catch(() => null))?.isDirectory()
        )
          throw new HostError(
            'update: native marketplace catalog location is missing or invalid; repair the native record',
            exits.prerequisite,
          );
        const originalCatalog = await jsonFile(join(location, '.claude-plugin/marketplace.json'));
        if (
          !fits(marketplaceCatalog, originalCatalog) ||
          originalCatalog.plugins.filter((plugin) => fits(celetisName, plugin)).length !== 1
        )
          throw new HostError(`update: invalid native marketplace catalog in ${location}`, exits.prerequisite);
        operation = 'claude original marketplace catalog validation';
        await lock.run('claude', ['plugin', 'validate', join(location, '.claude-plugin/marketplace.json'), '--json'], {
          cwd: process.cwd(),
          env,
        });
        operation = 'prepare native target';
        if (details.clone !== target.target) {
          operation = 'claude marketplace clone pin';
          const pin: typeof run = (file, args, options) =>
            execute(file, args, {
              ...options,
              env: {
                ...env,
                GIT_TERMINAL_PROMPT: '0',
                GCM_INTERACTIVE: 'false',
                GIT_ASKPASS: '',
                SSH_ASKPASS_REQUIRE: 'never',
              },
            });
          const place = clonePlace(location);
          try {
            await git([...place, 'fetch', '-q', '--depth', '1', '--no-tags', 'origin', target.target], location, pin);
            await git([...place, 'checkout', '-q', '--detach', target.target], location, pin);
          } catch (error) {
            throw new HostError(
              `${(error as Error).message}\nrepair: claude plugin marketplace update celetis, then run celetis update again`,
              exits.blocked,
            );
          }
          completed.push(operation);
          expected = { ...expected, clone: target.target };
          details = await revalidate();
          operation = 'prepare native target';
        }
        if (details.installed !== target.target || moving) {
          const action = join(scratch, 'target.json');
          const catalog = {
            name: 'celetis',
            owner: { name: 'Celetis' },
            plugins: [
              {
                name: 'celetis',
                source: {
                  source: 'git-subdir',
                  url: target.source,
                  path: 'plugins/celetis',
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
                const referenced = fits(located, remaining) ? await stat(remaining.installLocation) : null;
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
        if (moving) {
          operation = 'codex marketplace ref move';
          expected = await moveCodex(lock, env, target, completed);
        }
      }
      operation = 'fresh enabled installation validation';
      const metadata = host === 'codex' ? await codexPlugin(process.cwd(), execute) : null;
      const root = metadata ? metadata.root : await installedRoot(host, process.cwd(), execute);
      let sha: string | undefined;
      if (host === 'claude') {
        const list = await nativeJson('claude', ['plugin', 'list', '--json'], process.cwd(), env, execute);
        const fresh = await claudeInstallation(list, process.cwd());
        const enabled = fresh.root === root ? fresh.records.filter((record) => record.scope === details.scope) : [];
        const selected = enabled[0];
        if (enabled.length !== 1 || !fits(versioned, selected))
          throw new HostError('update: fresh native enabled scope/path/version is ambiguous', exits.blocked);
        const registry = await jsonFile(join(config, 'plugins/installed_plugins.json'));
        const records = fits(pluginsOf, registry) ? registry.plugins['celetis@celetis'] : undefined;
        const matching = await claudeRegistrations(records, details.scope, selected.version, root);
        const registered = matching[0];
        if (matching.length !== 1 || !registered)
          throw new HostError(
            'update: fresh native installed scope/path/version record does not match enabled discovery',
            exits.blocked,
          );
        if (fits(committed, registered)) sha = registered.gitCommitSha;
      }
      const manifest = await jsonFile(join(root, '.claude-plugin/plugin.json'));
      if (!fits(celetisName, manifest))
        throw new HostError(`update: enabled target package is incomplete: ${root}`, exits.blocked);
      const installed = metadata
        ? await codexRevision(metadata, target.source, execute)
        : await installedRevision(host, root, target.source, sha, execute);
      if (installed !== target.target)
        throw new HostError(
          `update: enabled revision is ${installed}, expected approved target ${target.target}`,
          exits.blocked,
        );
      const fresh: unknown = JSON.parse(
        await lock.run(process.execPath, inspectArgs(host, request), {
          cwd: process.cwd(),
          env,
        }),
      );
      if (
        !fits(pluginInspection, fresh) ||
        fresh.root !== root ||
        fresh.installed !== target.target ||
        !isDeepStrictEqual({ ...fresh, root: expected.root, installed: expected.installed }, expected)
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

export const short = (revision: string) => revision.slice(0, 12);

export function line(part: Part): string {
  if ('error' in part) return `  ${part.part}  error: ${part.error.split('\n')[0]}`;
  if ('skipped' in part) return `  ${part.part}  skipped: ${part.skipped}`;
  const from = part.ref === part.to ? `${part.source} ${part.ref}` : `${part.source} ${part.ref} -> ${part.to}`;
  if (!partDiffers(part)) return `  ${part.part}  up to date  ${short(part.installed)}  ${from}`;
  if (part.installed === part.target && part.ref === part.to && 'clone' in part && part.clone)
    return `  ${part.part}  marketplace clone ${short(part.clone)} -> ${short(part.target)}  ${from}`;
  return `  ${part.part}  ${short(part.installed)} -> ${short(part.target)}  ${from}`;
}

export async function executeUpdate(
  offer: PreparedUpdate,
  stage: (value: UpdateStage) => void,
  ownerPid: number,
): Promise<UpdateResult> {
  const pending = pendingParts(offer);
  const completed: ('engine' | PluginHost)[] = [];
  const expected = structuredClone(offer);
  try {
    const before = await discoverUpdate(process.cwd(), offer.request, ownerPid);
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
      if (part === 'engine') {
        const installed = await installEngine(offer.engine.to.source, offer.engine.to, undefined, {
          engine: offer.engine.installed,
          source: offer.engine.source,
        });
        const source = await engineSource(installed.root);
        if (
          !isDeepStrictEqual(source, offer.engine.to) ||
          (await engineIdentity(installed.root, source)) !== offer.target
        )
          throw new HostError('update: fresh engine does not match the approved source, ref, or target', exits.blocked);
        expected.engine = { installed, source, to: offer.engine.to };
        expected.parts = expected.parts.map((value) =>
          value.part === 'engine' && 'to' in value
            ? { ...value, root: installed.root, source: source.source, ref: value.to, installed: offer.target }
            : value,
        );
      } else {
        const plugin = offer.plugins.find((plugin) => plugin.host === part);
        if (!plugin) throw new HostError(`update: the offer has no ${part} installation`, exits.internal);
        const fresh = await updatePlugin(ownerPid, part, plugin, offer.request);
        expected.plugins = expected.plugins.map((value) => (value.host === part ? fresh : value));
        expected.parts = expected.parts.map((value) => (value.part === part ? pluginPart(fresh) : value));
      }
      completed.push(part);
      stage({ part, state: 'completed' });
    }
    const final = await discoverUpdate(process.cwd(), offer.request, ownerPid, true);
    if (final.error || !isDeepStrictEqual(final.prepared, expected))
      throw new HostError(
        [
          'update: final installation validation found a changed identity, inventory, or target; check again',
          ...final.parts.map((part) => ('error' in part ? part.error : line(part))),
          final.error,
        ]
          .filter(Boolean)
          .join('\n'),
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

async function child(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args } = commandInput(argv);
    if (args[0] === '--policy' && args.length === 2 && isHost(args[1]))
      await requireUpdatePolicy(args[1], process.cwd());
    else if (args[0] === '--inspect' && (args.length === 2 || args.length === 3) && isPluginHost(args[1])) {
      try {
        console.log(JSON.stringify(await inspect(args[1], process.cwd(), args[2] ?? null)));
      } catch (error) {
        if (!(error instanceof NotInstalled)) throw error;
        console.log(JSON.stringify({ skipped: `Celetis is not installed in ${args[1]}` }));
      }
    } else throw new HostError(usage('update'), exits.usage);
    return exits.done;
  } catch (error) {
    markDefect(error);
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('update');
  process.exitCode = await child(process.argv.slice(2));
}
