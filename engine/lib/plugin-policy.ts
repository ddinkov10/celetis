import { join } from 'node:path';
import { type Host, HostError, mainCheckout } from './host.ts';
import { codexHome, configHome, jsonFile, object } from './plugin-metadata.ts';
import { run } from './process.ts';

export interface PolicyRecord {
  path: string;
  value: Record<string, unknown>;
}

export function checkClaudePolicy(records: PolicyRecord[]): void {
  let effective: { path: string; value: unknown } | undefined;
  for (const { path, value } of records) {
    const entries = value.extraKnownMarketplaces;
    if (entries !== undefined && !object(entries))
      throw new HostError(`plugin-update: ${path}: extraKnownMarketplaces is invalid; repair the effective policy`);
    const market = object(entries) ? entries.celetis : value.celetis;
    if (market === undefined) continue;
    if (!object(market))
      throw new HostError(`plugin-update: ${path}: Celetis marketplace policy is invalid; repair the effective policy`);
    if (Object.hasOwn(market, 'autoUpdate')) effective = { path, value: market.autoUpdate };
  }
  if (effective && effective.value !== false)
    throw new HostError(
      `plugin-update: ${effective?.path ?? 'native/local/project/user/managed settings'}: Celetis automatic updates are enabled or unknown; set the effective Celetis autoUpdate policy to false`,
    );
}

export async function claudePolicy(cwd: string): Promise<PolicyRecord[]> {
  const lookup = await run('git', ['rev-parse', '--show-toplevel'], { cwd });
  const checkout = lookup.code === 0 ? lookup.stdout.trimEnd() : cwd;
  const managed =
    process.platform === 'darwin'
      ? '/Library/Application Support/ClaudeCode'
      : process.platform === 'win32'
        ? join(process.env.ProgramFiles || 'C:\\Program Files', 'ClaudeCode')
        : '/etc/claude-code';
  const paths = [
    join(configHome('claude'), 'plugins/known_marketplaces.json'),
    join(configHome('claude'), 'settings.json'),
    join(checkout, '.claude/settings.json'),
    ...new Set([
      join(checkout, '.claude/settings.local.json'),
      join(cwd, '.claude/settings.local.json'),
      join(
        await mainCheckout(cwd).catch((error) => {
          if (
            error instanceof HostError &&
            error.code === 128 &&
            error.message.startsWith('fatal: not a git repository')
          )
            return checkout;
          throw error;
        }),
        '.claude/settings.local.json',
      ),
    ]),
    join(managed, 'managed-settings.json'),
  ];
  const fragments = join(managed, 'managed-settings.d');
  const { readdir } = await import('node:fs/promises');
  const names = await readdir(fragments).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw new HostError(`plugin-update: cannot read ${fragments}; obtain access to all managed policy sources`);
  });
  paths.push(
    ...names
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => join(fragments, name)),
  );
  const records: PolicyRecord[] = [];
  for (const path of paths) records.push({ path, value: await jsonFile(path, true) });
  return records;
}

export async function requireUpdatePolicy(host: Host, cwd: string): Promise<void> {
  if (host === 'claude') {
    checkClaudePolicy(await claudePolicy(cwd));
  } else await codexHome();
}
