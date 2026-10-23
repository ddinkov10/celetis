import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { type Host, HostError } from './host.ts';
import { childEnv, run } from './process.ts';

export const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

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
): Promise<unknown> {
  if (host === 'codex') env = childEnv({ ...env, CODEX_HOME: await codexHome(env.CODEX_HOME) });
  const result = await run(host, args, {
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
}

export async function codexPlugin(cwd: string, inheritedFd?: number): Promise<PluginMetadata> {
  const home = await codexHome();
  const env = childEnv({ ...process.env, CODEX_HOME: home });
  const version = await run('codex', ['--version'], { cwd, env, inheritedFd, timeout: 10_000 });
  if (version.code !== 0) throw new HostError(`celetis: codex is not available: ${version.stderr.trimEnd()}`);
  if (version.stdout.trim() !== 'codex-cli 0.163.0')
    throw new HostError(
      `celetis: read-only plugin discovery is unverified for ${version.stdout.trim()}; verify its native registry before use`,
    );
  const value = await nativeJson(
    'codex',
    ['plugin', 'list', '--marketplace', 'celetis', '--json'],
    cwd,
    inheritedFd,
    env,
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
  const store = await contained(home, join(home, 'plugins/cache/celetis/celetis'));
  const entries = await readdir(store, { withFileTypes: true }).catch(() => []);
  const versions = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name);
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
  versions.sort((a, b) => (semver.test(a) && semver.test(b) ? Bun.semver.order(a, b) : a < b ? -1 : a > b ? 1 : 0));
  const active = versions.includes('local') ? 'local' : versions.at(-1);
  if (!active || record.version !== active)
    throw new HostError(
      `celetis: Codex registry does not match its installed version ${String(record.version)}; repair the native installation`,
    );
  const root = await contained(home, join(store, active));
  const marketplaces = await nativeJson('codex', ['plugin', 'marketplace', 'list', '--json'], cwd, inheritedFd, env);
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
  return { host: 'codex', home, root, record };
}
