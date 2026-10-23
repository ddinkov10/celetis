import { lstat, mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { codexRequest, type Host, HostError, installedRoot, mainCheckout, requireBun, selectHost } from './lib/host.ts';
import { codexHome, codexPlugin, configHome, jsonFile, nativeJson, object } from './lib/plugin-metadata.ts';
import { checkClaudePolicy, claudePolicy, requireUpdatePolicy } from './lib/plugin-policy.ts';
import { bunArgs, childEnv, run } from './lib/process.ts';
import { UpdateLock } from './lib/update-lock.ts';

export type UpdateTarget = { source: string; installed: string; target: string };
export type UpdateOffer = UpdateTarget & { host: Host; root: string };
const revision = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

async function git(args: string[], cwd: string): Promise<string> {
  const result = await run(
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

async function installedRevision(root: string, source: string, nativeRevision?: string): Promise<string> {
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
  const common = await git([...args, 'rev-parse', '--path-format=absolute', '--git-common-dir'], root);
  if (
    (await realpath(common).catch(() => '')) !== (await realpath(join(root, '.git'))) ||
    (await lstat(join(root, '.git/objects/info/alternates')).catch(() => null))
  )
    throw new HostError(
      `plugin-update: installed Git witness uses external common state: ${root}; use a package-owned Git record`,
    );
  const installed = await git([...args, 'rev-parse', '--verify', 'HEAD'], root);
  if (nativeRevision && nativeRevision !== installed)
    throw new HostError(
      `plugin-update: native installed revision disagrees with package witness: ${root}; repair the native identity`,
    );
  if (!revision.test(installed)) throw new HostError(`plugin-update: invalid full installed revision in ${root}`);
  if (await git([...args, 'status', '--porcelain', '--untracked-files=normal'], root))
    throw new HostError(
      `plugin-update: installed package is dirty: ${root}; review its local changes before checking an update`,
    );
  const remote = await git([...args, 'config', '--get', 'remote.origin.url'], root);
  if (remote.replace(/\.git$/, '') !== source.replace(/\.git$/, ''))
    throw new HostError(
      `plugin-update: installed Git source does not match configured source: ${remote}; repair the native installation identity`,
    );
  return installed;
}

function gitSource(value: unknown): { source: string; ref: string } {
  if (!object(value))
    throw new HostError('plugin-update: no configured Git source; inspect the native marketplace record');
  let source: unknown;
  if (value.source === 'git') source = value.url;
  else if (value.source === 'github' && typeof value.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(value.repo))
    source = `https://github.com/${value.repo}.git`;
  if (
    typeof source !== 'string' ||
    !source ||
    [...source].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    !(/^(https?|ssh|git|file):\/\//.test(source) || source.startsWith('/') || /^[\w.-]+@[\w.-]+:/.test(source))
  )
    throw new HostError(
      'plugin-update: unsupported configured Git source; use a native Git or GitHub marketplace source',
    );
  const ref = value.ref ?? 'HEAD';
  if (
    typeof ref !== 'string' ||
    !ref ||
    ref.startsWith('-') ||
    [...ref].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  )
    throw new HostError('plugin-update: invalid configured Git ref; repair the native marketplace source');
  return { source, ref };
}

async function inspect(host: Host, cwd: string): Promise<UpdateOffer> {
  let root: string;
  let nativeRevision: string | undefined;
  let configured: { source: string; ref: string };
  if (host === 'claude') {
    const list = await nativeJson(host, ['plugin', 'list', '--json'], cwd);
    if (!Array.isArray(list)) throw new HostError('plugin-update: invalid Claude installation list');
    const records = list.filter((item) => object(item) && item.id === 'celetis@celetis');
    const user = records.filter((item) => item.scope === 'user');
    const selected = user.length ? user : records;
    if (selected.length !== 1 || selected[0].enabled !== true || typeof selected[0].installPath !== 'string')
      throw new HostError(
        'plugin-update: Claude installation is disabled, missing, or ambiguous; repair the enabled Celetis identity',
      );
    root = selected[0].installPath;
    const manifest = await jsonFile(join(root, '.claude-plugin/plugin.json'));
    if (manifest.name !== 'celetis') throw new HostError(`plugin-update: wrong installed plugin identity in ${root}`);
    const policies = await claudePolicy(cwd);
    checkClaudePolicy(policies);
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
        const matches = records.filter(
          (record) =>
            object(record) &&
            record.scope === selected[0].scope &&
            record.installPath === root &&
            record.version === selected[0].version,
        );
        if (
          matches.length === 1 &&
          typeof matches[0].gitCommitSha === 'string' &&
          revision.test(matches[0].gitCommitSha)
        )
          nativeRevision = matches[0].gitCommitSha;
      }
    }
  } else {
    const metadata = await codexPlugin(cwd);
    root = metadata.root;
    const market = metadata.record.marketplaceSource;
    if (!object(market) || market.sourceType !== 'git')
      throw new HostError(
        'plugin-update: selected Codex marketplace is not a Git source; no remote update check is available',
      );
    const reply = await codexRequest(cwd, 'config/read', { cwd, includeLayers: true }, undefined, metadata.home);
    const config = object(reply) && object(reply.result) && object(reply.result.config) ? reply.result.config : null;
    const markets = config?.marketplaces;
    const effective = object(markets) ? markets.celetis : null;
    if (!object(effective) || effective.source_type !== 'git' || effective.source !== market.source)
      throw new HostError(
        'plugin-update: Codex effective marketplace source differs from installed metadata; repair the native configuration',
      );
    configured = gitSource({ source: 'git', url: effective.source, ref: effective.ref });
  }
  const installed = await installedRevision(root, configured.source, nativeRevision);
  let remote: string;
  try {
    remote = await git(
      ['ls-remote', '--exit-code', '--', configured.source, configured.ref, `${configured.ref}^{}`],
      cwd,
    );
  } catch (error) {
    throw new HostError(
      `plugin-update: cannot resolve configured Git ref ${configured.ref}: ${(error as Error).message}`,
    );
  }
  const records = remote.split('\n').map((line) => line.split('\t'));
  if (records.some(([sha, ref]) => !sha || !revision.test(sha) || !ref))
    throw new HostError(`plugin-update: invalid remote revision for configured ref ${configured.ref}`);
  const base = records.filter(([, ref]) => !ref?.endsWith('^{}'));
  if (base.length !== 1)
    throw new HostError(
      `plugin-update: configured ref ${configured.ref} is missing or ambiguous; choose one native Git ref`,
    );
  const selectedRef = base[0]?.[1];
  const target = records.find(([, ref]) => ref === `${selectedRef}^{}`)?.[0] ?? base[0]?.[0];
  if (!target) throw new HostError(`plugin-update: no full revision for configured ref ${configured.ref}`);
  return { host, source: configured.source, installed, target, root };
}

export async function checkUpdate(host: Host, cwd: string): Promise<UpdateOffer | null> {
  const offer = await inspect(host, cwd);
  return offer.installed === offer.target ? null : offer;
}

export async function updatePlugin(ownerPid: number, host: Host, target: UpdateTarget): Promise<string> {
  if (!target.source || !revision.test(target.installed) || !revision.test(target.target))
    throw new HostError('plugin-update: apply needs the offered source and full installed and target revisions', 2);
  const config = host === 'codex' ? await codexHome() : configHome(host);
  const env = host === 'codex' ? childEnv({ ...process.env, CODEX_HOME: config }) : undefined;
  await mkdir(config, { recursive: true });
  const lock = await UpdateLock.acquire(join(config, 'celetis-update.lock'), ownerPid);
  try {
    const output = await lock.run(process.execPath, bunArgs(import.meta.path, ['--inspect', host]), {
      cwd: process.cwd(),
      env,
    });
    const current = JSON.parse(output) as UpdateOffer;
    if (current.source !== target.source || current.installed !== target.installed || current.target !== target.target)
      throw new HostError(
        `plugin-update: offered source, installed revision, or target changed; this attempt is consumed. Check again and obtain a new direct user response. Observed: ${JSON.stringify(current)}`,
      );
    await lock.run(process.execPath, bunArgs(import.meta.path, ['--policy', host]), { cwd: process.cwd(), env });
    throw new HostError(
      host === 'claude'
        ? 'plugin-update: Claude Code has no proved exact-target update and complete consumer lifetime/resource boundary for the offering session and updater. No package was replaced. Stop affected consumers and use a supported native target-bound cutover before a new offer; a restart or the 14-day cleanup period is insufficient. This attempt is consumed.'
        : 'plugin-update: Codex has no proved complete consumer lifetime/resource boundary for the offering session and updater. No package was replaced. Stop affected consumers and use a supported native cutover before a new offer. This attempt is consumed.',
    );
  } finally {
    await lock.close();
  }
}

if (import.meta.main) {
  try {
    requireBun();
    const args = process.argv.slice(2);
    if (args[0] === '--root' && args.length === 2 && (args[1] === 'claude' || args[1] === 'codex'))
      console.log(await installedRoot(args[1], process.cwd(), 3));
    else if (args[0] === '--policy' && args.length === 2 && (args[1] === 'claude' || args[1] === 'codex'))
      await requireUpdatePolicy(args[1], process.cwd());
    else if (args[0] === '--inspect' && args.length === 2 && (args[1] === 'claude' || args[1] === 'codex'))
      console.log(JSON.stringify(await inspect(args[1], process.cwd())));
    else {
      const main = await mainCheckout(process.cwd()).catch(() => null);
      const host = selectHost(undefined, process.env, main);
      if (args.length === 1 && args[0] === 'check') {
        console.log(JSON.stringify(await checkUpdate(host, process.cwd())));
        if (host === 'codex')
          console.error(
            'plugin-update: Codex Git automatic refresh and complete resource lifetime are unsupported; applying this offer or starting an affected consumer is refused until native controls are available',
          );
        else
          console.error(
            'plugin-update: file policy diagnostics do not certify command-line, MDM, or server-managed settings; native lifetime and exact-target application remain unsupported',
          );
      } else if (args.length === 4 && args[0] === 'apply')
        console.log(
          await updatePlugin(process.pid, host, {
            source: args[1] ?? '',
            installed: args[2] ?? '',
            target: args[3] ?? '',
          }),
        );
      else
        throw new HostError(
          'usage: scripts/celetis [--agent claude|codex] plugin-update check | apply <source> <installed> <target>',
          2,
        );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof HostError ? error.code : 1;
  }
}
