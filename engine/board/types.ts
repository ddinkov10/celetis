import type { Host } from '../lib/config-core.ts';
import type { Effort } from '../lib/effort.ts';
import type { QueueView, QueueWake } from '../lib/queue-types.ts';
import type { TerminalStatus } from '../lib/terminal-types.ts';
import type { UpdateStage } from '../lib/update-types.ts';

export type { UpdateStage };
export type BoardOffer = {
  id: string;
  target: string;
  parts: { part: 'program' | Host; installed: string; target: string }[];
};
export type UpdateView = {
  phase: 'checking' | 'current' | 'available' | 'updating' | 'restarting' | 'check-failed' | 'update-failed';
  offer: BoardOffer | null;
  target: string | null;
  stage: UpdateStage | null;
  completed: ('program' | Host)[];
  incomplete: ('program' | Host)[];
  error: string | null;
  recovery: string | null;
};
export type BoardRuntime = { revision: string; instance: string };
export type UpdateResponse = { runtime: BoardRuntime; update: UpdateView };
export type UpdateCheckRequest = Record<string, never>;
export type UpdateStartRequest = { offerId: string };

export type Flow = {
  lanes: Record<string, string[]>;
  stages: { name: string; steps: string[] }[];
  steps: Record<string, { gate: 'me' | 'auto'; hint?: string }>;
};
export type Pull = {
  number: number;
  url: string;
  draft: boolean;
  checks: string | null;
  review: string | null;
};
export type Issue = {
  number: number;
  title: string;
  url: string;
  type: string | null;
  state: 'ready' | 'starting' | 'stuck' | 'dirty' | 'blocked';
  step: string | null;
  started: boolean;
  urgent: boolean;
  updatedAt: string;
  path?: string;
  reason: string | null;
  act: string | null;
  effort: Effort | null;
  pr: Pull | null;
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
  runner: boolean;
  issues: Issue[];
  agents: Record<string, { available: boolean; cause: string | null }>;
  defaultAgent: string;
  queue: QueueView | null;
  queueWake: QueueWake | null;
};
export type Session = {
  sessionId: string;
  agent: Host;
  status: TerminalStatus;
  turn: number;
  stepEnd: 'checking' | 'waiting' | 'exiting' | null;
  issue: number | null;
  step: string | null;
  label: string;
  cwd: string;
  since?: string;
  screen?: string[];
};
export type Diff = { files: number; added: number; removed: number };
export type Card = {
  sessionId: string | null;
  number: number | null;
  title: string;
  url: string | null;
  type: string | null;
  agent: string | null;
  step: string | null;
  gate: string | null;
  state: string | null;
  since: string;
  act: string | null;
  reason: string | null;
  urgent: boolean;
  assist: boolean;
  run: boolean;
  resume: boolean;
  go: boolean;
  pr: Pull | null;
  waitFor?: string | null;
  screen?: string[];
  cwd?: string | null;
  diff?: Diff | null;
  warning?: string | null;
  effort?: Effort | null;
};
export type Column = 'needs' | 'running' | 'idle' | 'human';
export type Columns = Record<Column, Card[]>;
export type Placement = { noRun: string | null; columns: Columns };
export type Board = Placement & {
  history: History | null;
  flow: Flow | null;
  tracker: string | null;
  runner: boolean | null;
  agents: Document['agents'] | null;
  defaultAgent: string | null;
  queue: QueueView | null;
  terminal: { ok: boolean | null; error: string | null };
  source: { readAt: string | null; error: string | null };
  repo: string;
};
export type Action = {
  id: string;
  label: string;
  icon: string;
  name: string;
  title: string;
  busy?: string;
  href?: string;
  isDisabled?: boolean;
  isGhost?: boolean;
  isMain?: boolean;
  key?: string;
  run?: () => unknown;
};

export type MenuEntry = {
  icon: string;
  label: string;
  key?: string;
  title?: string;
  isDisabled?: boolean;
  isDanger?: boolean;
  run: () => unknown;
};
export type PaletteItem = MenuEntry & { number: number | null; group: string; context?: string; tone?: string | null };
