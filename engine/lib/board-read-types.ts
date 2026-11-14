import type { Level } from './effort.ts';
import type { Host } from './host-names.ts';
import type { QueueView } from './queue-types.ts';
import type { IssueRow } from './resolver-types.ts';

export type Flow = {
  lanes: Record<string, string[]>;
  stages: { name: string; steps: string[] }[];
  steps: Record<string, { gate: 'manual' | 'auto'; agent: Host | null; hint?: string }>;
  levels: Level[];
};
export type LandedIssue = {
  number: number;
  title: string;
  url: string;
  sha: string;
  commitUrl: string;
  committedAt: string;
};
export type History = {
  trunk: string;
  url: string;
  head: string;
  entries: LandedIssue[];
};
export type Document = {
  history: History;
  tracker: string;
  flow: Flow;
  noRun: string | null;
  issues: IssueRow[];
  agents: Record<Host, { available: boolean; cause: string | null }>;
  queue: QueueView | null;
};
export type QuotaWait = { number: number; waitId: string; nextResetAt: number | null };
export type QuotaState = { kind: 'waiting'; wait: QuotaWait } | { kind: 'orphaned' };
export type Diff = { files: number; added: number; removed: number };
