export const registry = Object.freeze({
  claude: { name: 'Claude Code', short: 'Claude' },
  codex: { name: 'Codex', short: 'Codex' },
} as const satisfies Record<string, { name: string; short: string }>);
export type Host = keyof typeof registry;
export type Registry = Readonly<Record<Host, Readonly<{ name: string; short: string }>>>;
export const hosts: readonly Host[] = Object.freeze(Object.keys(registry) as Host[]);

export function isHost(value: unknown): value is Host {
  return (hosts as readonly unknown[]).includes(value);
}
