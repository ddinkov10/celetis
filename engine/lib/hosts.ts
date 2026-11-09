import { claude } from './host-claude.ts';
import { codex } from './host-codex.ts';
import type { Host } from './host-names.ts';
import type { HostAdapter } from './host-types.ts';

const adapters = { claude, codex } satisfies Record<Host, HostAdapter>;

export function hostAdapter(host: Host): HostAdapter {
  return adapters[host];
}
