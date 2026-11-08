import { bunFloor, type Host } from './config-core.ts';
import { exits } from './contract.ts';
import { HostError } from './errors.ts';

export function requireBun(): void {
  if (Bun.semver.order(Bun.version, bunFloor) < 0) {
    throw new HostError(`celetis: need Bun >=${bunFloor} on PATH, found ${Bun.version}`, exits.prerequisite);
  }
}

export function selectHost(host: string): Host {
  if (host !== 'claude' && host !== 'codex')
    throw new HostError(`celetis: invalid agent ${host}; use claude or codex`, exits.usage);
  return host;
}
