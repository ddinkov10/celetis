import type { AgentChoice, Host } from '../config/core.ts';
import type { Next } from '../resolver/lines.ts';
import type { Run, Step } from '../workflow/workflow.ts';

export type QueueExpected = { id: string | null; revision: number; current: number | null };
export type QueueAction = { expected: QueueExpected } & (
  | { kind: 'add'; number: number; step: Step }
  | { kind: 'move'; number: number; direction: 'up' | 'down' }
  | { kind: 'remove'; number: number }
  | { kind: 'continue'; step: Step }
  | { kind: 'retry'; step: Step | null }
);
export type QueueRecord = {
  schema: 3;
  id: string;
  revision: number;
  choice: AgentChoice | null;
  activeHost: Host | null;
  numbers: number[];
  state: 'empty' | 'starting' | 'running' | 'quota-wait' | 'me-gate' | 'error';
  waitId: string | null;
  current: Run | null;
  last: Run | null;
  reason: string | null;
  act: string | null;
  launch: { token: string; authorization: { number: number; step: Step | null; retry: boolean } | null } | null;
};
export type QueueView = {
  record: QueueRecord | null;
  owner: string | null;
  next: Next | null;
  error: string | null;
  actions: { add: boolean; edit: boolean; continue: boolean; retry: boolean };
};
export type QueueWake = { id: string; token: string; choice: AgentChoice };
export type QueueReceipt = { view: QueueView; wake: QueueWake | null };
