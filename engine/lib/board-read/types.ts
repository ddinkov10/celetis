import type { Host } from '../host/names.ts';
import type { QueueView } from '../queue/types.ts';
import type { IssueRow } from '../resolver/types.ts';
import type { TrackerKind } from '../tracker/grammar.ts';
import type { IssueKey } from '../tracker/key.ts';
import type { Level } from '../workflow/effort.ts';
import type { Gate } from '../workflow/workflow.ts';

export type { CacheLine, Sample } from './trend-lines.ts';

export type Flow = {
  lanes: Record<string, string[]>;
  stages: { name: string; steps: string[] }[];
  gates: Record<string, Record<string, Gate>>;
  steps: Record<string, { agent: Host | null; hint?: string }>;
  levels: Level[];
};
export type LandedIssue = {
  number: IssueKey;
  title: string;
  url: string | null;
  sha: string;
  commitUrl: string | null;
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
export type IssueItem =
  | { kind: 'comment'; id: string; at: string; author: string | null; body: string }
  | { kind: 'label'; id: string; at: string; change: 'added' | 'removed'; name: string };
export type IssueView = {
  number: IssueKey;
  title: string;
  url: string;
  state: 'open' | 'closed';
  labels: string[];
  body: string;
  updatedAt: string;
  closedAt: string | null;
  items: IssueItem[];
  images: Record<string, string>;
};
export type QuotaWait = { number: IssueKey; waitId: string; nextResetAt: number | null };
export type QuotaState = { kind: 'waiting'; wait: QuotaWait } | { kind: 'orphaned' };
export type Diff = { files: number; added: number; removed: number };
export type DeliveryWindow = { landed: number; medianDays: number | null };
export type Trends = {
  live: { needs: (number | null)[]; working: (number | null)[]; readAt: string | null; error: string | null };
  delivery: { windows: DeliveryWindow[] | null; readAt: string | null; error: string | null };
};
