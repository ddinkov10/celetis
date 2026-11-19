import { HostError } from '../command/errors.ts';
import { bunFloor, type Host } from '../config/core.ts';
import { exits } from '../contract/contract.ts';
import { childEnv } from '../process/process.ts';
import { hostChoices, isHost } from './names.ts';

export type HostAvailability = { available: true; executable: string } | { available: false; cause: string };

export function requireBun(): void {
  if (Bun.semver.order(Bun.version, bunFloor) < 0) {
    throw new HostError(`celetis: need Bun >=${bunFloor} on PATH, found ${Bun.version}`, exits.prerequisite);
  }
}

export function selectHost(host: string): Host {
  if (!isHost(host)) throw new HostError(`celetis: invalid agent ${host}; use ${hostChoices}`, exits.usage);
  return host;
}

export function hostAvailability(host: Host, env: NodeJS.ProcessEnv = childEnv()): HostAvailability {
  const executable = Bun.which(host, { PATH: env.PATH });
  if (!executable) return { available: false, cause: `celetis: ${host} is not on PATH` };
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable))
    return {
      available: false,
      cause: `celetis: ${host} on PATH is the shim ${executable}; Windows needs the native ${host} program`,
    };
  return { available: true, executable };
}
