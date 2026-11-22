import type { Host } from '../host/names.ts';
import type { QueueView } from '../queue/types.ts';
import type { IssueRow } from '../resolver/types.ts';
import type { TrackerKind } from '../tracker/grammar.ts';
import type { IssueKey } from '../tracker/key.ts';
import type { Level } from '../workflow/effort.ts';

export type Flow = {
  lanes: Record<string, string[]>;
  stages: { name: string; steps: string[] }[];
  steps: Record<string, { gate: 'manual' | 'auto'; agent: Host | null; hint?: string }>;
  levels: Level[];
};
export type LandedIssue = {
  number: IssueKey;
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
  grammar: TrackerKind;
  flow: Flow;
  issues: IssueRow[];
  agents: Record<Host, { available: boolean; cause: string | null }>;
  queue: QueueView | null;
};
export type QuotaWait = { number: IssueKey; waitId: string; nextResetAt: number | null };
export type QuotaState = { kind: 'waiting'; wait: QuotaWait } | { kind: 'orphaned' };
export type Diff = { files: number; added: number; removed: number };
export type Sample = { at: string; needs: number | null; working: number | null };
export type CacheLine =
  | { sha: string; issue: IssueKey | null; at: string }
  | { issue: IssueKey; createdAt: string | null };
export type DeliveryWindow = { landed: number; medianDays: number | null };
export type Trends = {
  live: { needs: (number | null)[]; working: (number | null)[]; readAt: string | null; error: string | null };
  delivery: { windows: DeliveryWindow[] | null; readAt: string | null; error: string | null };
};
