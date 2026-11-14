import type { Diff, Document, Flow, History, LandedIssue, QuotaState, QuotaWait } from '../lib/board-read-types.ts';
import type { AgentChoice, AgentDecision, AgentOrder, Host, UsageBlock } from '../lib/config-core.ts';
import type { CoordinatorAction, CoordinatorKey, CoordinatorState } from '../lib/coordinator-types.ts';
import type { Level, RowSource, StartPair } from '../lib/effort.ts';
import type { PluginHost, Registry } from '../lib/host-names.ts';
import type { QueueAction, QueueView } from '../lib/queue-types.ts';
import type { IssueRow, ParentEpic, Pull } from '../lib/resolver-types.ts';
import type { DialogKind, TerminalStatus } from '../lib/terminal-types.ts';
import type { UpdateStage } from '../lib/update-types.ts';

export type {
  Diff,
  Document,
  Flow,
  History,
  IssueRow,
  LandedIssue,
  ParentEpic,
  Pull,
  QuotaState,
  QuotaWait,
  UpdateStage,
};
export type BoardOffer = {
  id: string;
  target: string;
  parts: { part: 'engine' | PluginHost; installed: string; target: string }[];
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
export type RunRequest = { number: number; agent?: Host; effort?: Level } | { number: number; waitId: string };
export type BoardRequest =
  | { path: '/api/intake' }
  | { path: '/api/assist' | '/api/visual' | '/api/resume' | '/api/shell'; number: number }
  | { path: '/api/run'; number: number; agent?: Host; effort?: Level }
  | { path: '/api/run'; number: number; waitId: string }
  | { path: '/api/queue'; action: QueueAction; choice: AgentChoice }
  | { path: '/api/go'; sessionId: string }
  | { path: '/api/agent'; order: Host[]; expectedVersion: string }
  | { path: '/api/refresh' }
  | { path: '/api/update/check' }
  | { path: '/api/update/start'; offerId: string }
  | { path: '/api/update/restart' }
  | { path: '/api/coordinator/open' | '/api/coordinator/interrupt' | '/api/coordinator/end' }
  | { path: '/api/coordinator/say'; text: string }
  | { path: '/api/coordinator/key'; key: CoordinatorKey };
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
export type CoordinatorText = {
  view: CoordinatorView;
  text: string;
  full: boolean;
  readAt: string | null;
  error: string | null;
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
  turn?: number;
  screen?: string[];
  cwd?: string | null;
  diff?: Diff | null;
  warning?: string | null;
  effort?: StartPair<RowSource> | null;
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
  registry: Registry;
  picker: AgentPickerView | null;
  next: AgentDecision | null;
  starts: Record<string, AgentDecision> | null;
  queue: QueueView | null;
  terminal: { ok: boolean | null; error: string | null };
  coordinator: CoordinatorView;
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
  run: () => unknown;
};
export type PaletteItem = MenuEntry & {
  number: number | null;
  group: string;
  context?: string;
  tone?: string | null;
  isGoTo?: boolean;
};
