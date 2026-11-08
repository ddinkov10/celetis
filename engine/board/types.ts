import type { AgentDecision, AgentOrder, Host, UsageBlock } from '../lib/config-core.ts';
import type { Effort, Level } from '../lib/effort.ts';
import type { QueueView } from '../lib/queue-types.ts';
import type { IssueRow, ParentEpic, Pull } from '../lib/resolver-types.ts';
import type { TerminalStatus } from '../lib/terminal-types.ts';
import type { UpdateStage } from '../lib/update-types.ts';

export type { IssueRow, ParentEpic, Pull, UpdateStage };
export type BoardOffer = {
  id: string;
  target: string;
  parts: { part: 'program' | Host; installed: string; target: string }[];
};
export type UpdateView = {
  phase:
    | 'checking'
    | 'current'
    | 'available'
    | 'restart-needed'
    | 'updating'
    | 'restarting'
    | 'updated'
    | 'check-failed'
    | 'update-failed';
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
export type UpdateRestartRequest = Record<string, never>;
export type UpdateRestartResponse = { runtime: BoardRuntime; target: string };

export type Flow = {
  lanes: Record<string, string[]>;
  stages: { name: string; steps: string[] }[];
  steps: Record<string, { gate: 'me' | 'auto'; hint?: string }>;
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
export type VisualState = 'none' | 'starting' | 'making' | 'ready';
export type HistoryRow = LandedIssue & { visual: VisualState };
export type BoardHistory = Omit<History, 'entries'> & { entries: HistoryRow[] };
export type Document = {
  history: History;
  tracker: string;
  flow: Flow;
  noRun: string | null;
  issues: IssueRow[];
  agents: Record<string, { available: boolean; cause: string | null }>;
  queue: QueueView | null;
};
export type DaemonView = { pid: number; auto: 'on' | 'off' | 'stopping' };
export type QuotaWait = { number: number; waitId: string; nextResetAt: number | null };
export type QuotaState = { kind: 'waiting'; wait: QuotaWait } | { kind: 'orphaned' };
export type AgentPickerView = {
  order: AgentOrder;
  usage: Record<Host, UsageBlock | null>;
  activeHosts: readonly Host[];
  waits: readonly QuotaWait[];
  error: string | null;
};
export type AgentReplaceRequest = { order: readonly Host[]; expectedVersion: string };
export type AgentReplaceConflict = { error: string; latest: AgentOrder };
export type RunRequest = { number: number; agent?: Host; effort?: Level } | { number: number; waitId: string };
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
  epic: ParentEpic | null;
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
  history: BoardHistory | null;
  flow: Flow | null;
  tracker: string | null;
  daemon: DaemonView;
  agents: Document['agents'] | null;
  picker: AgentPickerView | null;
  next: AgentDecision | null;
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
