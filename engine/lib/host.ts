import { bunFloor, type Host } from './config-core.ts';
import { exits } from './contract.ts';
import { HostError } from './errors.ts';
import { hostChoices, isHost } from './host-names.ts';
import { childEnv } from './process.ts';

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
  return executable ? { available: true, executable } : { available: false, cause: `celetis: ${host} is not on PATH` };
}
