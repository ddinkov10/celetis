export const registry = Object.freeze({
  claude: { name: 'Claude Code', short: 'Claude' },
  codex: { name: 'Codex', short: 'Codex' },
  opencode: { name: 'OpenCode', short: 'OpenCode' },
} as const satisfies Record<string, { name: string; short: string }>);
export type Host = keyof typeof registry;
export type Registry = Readonly<Record<Host, Readonly<{ name: string; short: string }>>>;
export const hosts: readonly Host[] = Object.freeze(Object.keys(registry) as Host[]);
export const hostChoices =
  hosts.length < 3 ? hosts.join(' or ') : `${hosts.slice(0, -1).join(', ')}, or ${hosts[hosts.length - 1]}`;

const { opencode: _opencode, ...plugins } = registry;
export type PluginHost = keyof typeof plugins;
export const pluginHosts: readonly PluginHost[] = Object.freeze(Object.keys(plugins) as PluginHost[]);

export function isHost(value: unknown): value is Host {
  return (hosts as readonly unknown[]).includes(value);
}

export function isPluginHost(value: unknown): value is PluginHost {
  return (pluginHosts as readonly unknown[]).includes(value);
}
