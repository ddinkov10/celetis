import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import type { Host } from './config-core.ts';
import { contractVersions, exits, pluginContract, pluginContractFile } from './contract.ts';
import { HostError } from './errors.ts';
import { installedRoot } from './plugin-metadata.ts';
import { withPluginRead } from './update-lock.ts';

const absent = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);
const retry = 'run celetis update, then start the daemon again';

export function requireContract(host: Host, cwd: string): Promise<string> {
  return withPluginRead(host, async () => {
    const root = await realpath(await installedRoot(host, cwd));
    const file = join(root, pluginContractFile);
    let text = '';
    try {
      text = await readFile(file, 'utf8');
    } catch (error) {
      if (!absent.has((error as NodeJS.ErrnoException).code ?? ''))
        throw new HostError(`celetis: cannot read ${file}: ${(error as Error).message}`, exits.blocked);
    }
    const needed = pluginContract(text);
    if (needed === null)
      throw new HostError(
        `celetis: the ${host} plugin declares no valid contract version in ${file}; ${retry}`,
        exits.prerequisite,
      );
    const served = contractVersions.serves.map((entry) => entry.contract).sort((a, b) => a - b);
    if (!served.includes(needed))
      throw new HostError(
        `celetis: the ${host} plugin needs contract ${needed} and this engine serves ${served.join(', ')}; ${retry}`,
        exits.prerequisite,
      );
    return root;
  });
}
