import type {
  Diff,
  Document,
  Flow,
  History,
  IssueItem,
  IssueView,
  LandedIssue,
  QuotaState,
  QuotaWait,
  Trends,
} from '../lib/board-read/types.ts';
import type { AgentDecision, AgentOrder, Host, UsageBlock } from '../lib/config/core.ts';
import type { CoordinatorAction, CoordinatorKey, CoordinatorState } from '../lib/coordinator/types.ts';
import type { PluginHost, Registry } from '../lib/host/names.ts';
import type { QueueView } from '../lib/queue/types.ts';
import type { HeldView, HoldBlocker, IssueRow, ParentEpic, Pull, RowHold } from '../lib/resolver/types.ts';
import type { DialogKind, TerminalStatus } from '../lib/terminal/types.ts';
import type { TrackerKind } from '../lib/tracker/grammar.ts';
import type { IssueKey } from '../lib/tracker/key.ts';
import type { UpdateStage } from '../lib/update/types.ts';
import type { Level, RowSource, StartPair } from '../lib/workflow/effort.ts';

export type {
  Diff,
  Document,
  Flow,
  HeldView,
  History,
  HoldBlocker,
  IssueItem,
  IssueKey,
  IssueRow,
  IssueView,
  LandedIssue,
  ParentEpic,
  Pull,
  QuotaState,
  QuotaWait,
  RowHold,
  Trends,
  UpdateStage,
};
export type BoardOffer = {
  id: string;
  target: string;
  parts: { part: 'engine' | PluginHost; installed: string; target: string }[];
  release: Readonly<{ version: string; revision: string; integrity: string }> | null;
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
  completed: ('engine' | PluginHost)[];
  incomplete: ('engine' | PluginHost)[];
  error: string | null;
  recovery: string | null;
};
export type BoardRuntime = { revision: string; instance: string };
export type UpdateResponse = { runtime: BoardRuntime; update: UpdateView };
export type UpdateCheckRequest = Record<string, never>;
export type UpdateStartRequest = { offerId: string };
export type UpdateRestartRequest = Record<string, never>;
export type UpdateRestartResponse = { runtime: BoardRuntime; target: string };

export type VisualState = 'none' | 'starting' | 'making' | 'ready';
export type HistoryRow = LandedIssue & { visual: VisualState };
export type BoardHistory = Omit<History, 'entries'> & { entries: HistoryRow[] };
export type DaemonView = { pid: number; auto: 'on' | 'off' | 'stopping' };
export type AgentPickerView = {
  order: AgentOrder;
  usage: Record<Host, UsageBlock | null>;
  activeHosts: readonly Host[];
  waits: readonly QuotaWait[];
  error: string | null;
};
export type AgentReplaceRequest = { order: readonly Host[]; expectedVersion: string };
export type AgentReplaceConflict = { error: string; latest: AgentOrder };
export type RunRequest = { number: IssueKey; agent?: Host; effort?: Level } | { number: IssueKey; waitId: string };
export type CoordinatorView = {
  state: CoordinatorState;
  kind: DialogKind | null;
  host: Host | null;
  since: string | null;
  turn: number | null;
  actions: CoordinatorAction[];
  keys: CoordinatorKey[];
  sessionId: string | null;
  readAt: string | null;
  error: string | null;
};
export type CoordinatorChat = {
  view: CoordinatorView;
  chat: { session: string; revision: string; entries: ChatEntry[] | null } | null;
  dialog: { lines: string[]; readAt: string | null; error: string | null } | null;
  readAt: string | null;
  error: string | null;
};
export type ChatInline =
  | string
  | { k: 'strong' | 'em' | 'code'; c: ChatInline[] }
  | { k: 'link'; href: string | null; c: ChatInline[] };
export type ChatBlock =
  | { k: 'p'; c: ChatInline[] }
  | { k: 'h'; level: 1 | 2 | 3 | 4 | 5 | 6; c: ChatInline[] }
  | { k: 'code'; language: string | null; text: string }
  | { k: 'list'; ordered: boolean; start: number | null; items: ChatBlock[][] }
  | { k: 'quote'; c: ChatBlock[] }
  | { k: 'rule' };
export type ChatText = { text: string; cut: number };
export type ChatCall = {
  id: string;
  tool: string;
  summary: string;
  input: ChatText;
  result: ChatText | null;
  state: 'runs' | 'done' | 'failed' | 'waits';
  startedAt: string | null;
  endedAt: string | null;
};
export type ChatEntry =
  | { kind: 'you'; id: string; at: string | null; text: string }
  | { kind: 'agent'; id: string; at: string | null; blocks: ChatBlock[] }
  | { kind: 'steps'; id: string; calls: ChatCall[] }
  | { kind: 'note'; id: string; at: string | null; text: string };
export type Session = {
  sessionId: string;
  agent: Host;
  status: TerminalStatus;
  turn: number;
  stepEnd: 'checking' | 'waiting' | 'exiting' | null;
  issue: IssueKey | null;
  step: string | null;
  label: string;
  cwd: string;
  since?: string;
  screen?: string[];
};
export type Card = {
  sessionId: string | null;
  number: IssueKey | null;
  title: string;
  url: string | null;
  type: string | null;
  agent: string | null;
  step: string | null;
  gate: string | null;
  state: string | null;
  since: string;
  createdAt: string | null;
  comments: number | null;
  act: string | null;
  reason: string | null;
  urgent: boolean;
  assist: boolean;
  run: boolean;
  resume: boolean;
  go: boolean;
  aside: boolean;
  stop?: { reason: string | null };
  epic: ParentEpic | null;
  pr: Pull | null;
  rowHold: RowHold | null;
  waitFor?: string | null;
  turn?: number;
  screen?: string[];
  cwd?: string | null;
  path?: string;
  diff?: Diff | null;
  warning?: string | null;
  effort?: StartPair<RowSource> | null;
  held?: HeldView | null;
  hold?: boolean;
  landing?: 'runs' | 'waits' | null;
};
export type Column = 'needs' | 'waiting' | 'running' | 'idle' | 'human';
export type Columns = Record<Column, Card[]>;
export type Placement = { noRun: string | null; columns: Columns };
export type Board = Placement & {
  history: BoardHistory | null;
  flow: Flow | null;
  tracker: string | null;
  grammar: TrackerKind;
  daemon: DaemonView;
  agents: Document['agents'] | null;
  registry: Registry;
  picker: AgentPickerView | null;
  next: AgentDecision | null;
  starts: Record<string, AgentDecision> | null;
  queue: QueueView | null;
  terminal: { ok: boolean | null; error: string | null };
  coordinator: CoordinatorView;
  source: { readAt: string | null; error: string | null };
  repo: string;
  trends: Trends;
  revisions: Record<string, string>;
};
export type Action = {
  id: string;
  label: string;
  icon: string;
  name: string;
  title: string;
  busy?: string;
  href?: string;
  isBusy?: boolean;
  isDisabled?: boolean;
  isGhost?: boolean;
  isMain?: boolean;
  key?: string;
  group?: string;
  help?: string;
  run?: () => unknown;
};

export type MenuEntry = {
  id?: string;
  icon: string;
  host?: Host;
  label: string;
  tag?: string;
  key?: string;
  title?: string;
  isDisabled?: boolean;
  isInfo?: boolean;
  alert?: 'caution' | 'beacon';
  run: () => unknown;
};
export type MenuSection = { heading: string; entries: MenuEntry[] };
export type PaletteItem = MenuEntry & {
  number: IssueKey | null;
  group: string;
  context?: string;
  tone?: string | null;
  isGoTo?: boolean;
};
