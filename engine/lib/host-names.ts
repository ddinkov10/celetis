export const hosts = ['claude', 'codex'] as const;
export type Host = (typeof hosts)[number];

export function isHost(value: unknown): value is Host {
  return (hosts as readonly unknown[]).includes(value);
}
