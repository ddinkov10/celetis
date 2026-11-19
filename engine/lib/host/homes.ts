import { lstat, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import type { PluginHost } from './names.ts';

const configHomes: Record<PluginHost, () => string> = {
  claude: () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'),
  codex: () => process.env.CODEX_HOME ?? join(homedir(), '.codex'),
};

export function configHome(host: PluginHost): string {
  return configHomes[host]();
}

export async function codexHome(selected = configHome('codex')): Promise<string> {
  if (!isAbsolute(selected))
    throw new HostError(`celetis: CODEX_HOME must be an existing absolute directory: ${selected}`, exits.usage);
  const home = await realpath(selected).catch(() => null);
  if (!home || !(await lstat(home)).isDirectory())
    throw new HostError(
      `celetis: cannot resolve CODEX_HOME directory: ${selected}; repair the selected native home`,
      exits.usage,
    );
  return home;
}

export function celetisBase(): string {
  const selected = process.env.CELETIS_HOME;
  if (selected && !isAbsolute(selected))
    throw new HostError(`celetis: CELETIS_HOME must be an absolute path: ${selected}`, exits.usage);
  return selected || homedir();
}
