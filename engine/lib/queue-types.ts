import type { Next } from './lines.ts';
import type { Run, Step } from './workflow.ts';

export type QueueAction =
  | { kind: 'start'; numbers: number[]; step: Step }
  | { kind: 'continue'; id: string; revision: number; step: Step }
  | { kind: 'retry'; id: string; revision: number; step: Step | null }
  | { kind: 'reset'; id: string; revision: number };

export type QueueRecord = {
  schema: 1;
  id: string;
  revision: number;
  host: 'claude' | 'codex';
  numbers: number[];
  position: number;
  results: ('finished' | 'wontfix' | 'already-closed')[];
  state: 'running' | 'me-gate' | 'error' | 'complete';
  current: Run | null;
  last: Run | null;
  reason: string | null;
  act: string | null;
};

export type QueueView = {
  record: QueueRecord | null;
  owner: string | null;
  next: Next | null;
  error: string | null;
  actions: { continue: boolean; retry: boolean; reset: boolean };
};
