import type { Host } from './config-core.ts';

export type TerminalStatus = 'idle' | 'working' | 'done' | 'blocked' | 'error';
export type Terminal = {
  id: string;
  host: Host | null;
  status: TerminalStatus | null;
  statusMs: number | null;
  turn: number;
  labels: Record<string, string>;
  cwd: string;
  foreground: string[] | null;
  tab: string | null;
};
