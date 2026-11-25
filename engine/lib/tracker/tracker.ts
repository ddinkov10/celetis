import type { Label } from '../contract/contract.ts';
import type { EpicForms } from '../epic/acceptance.ts';
import type { Entry, EpicSnapshot, IssueData } from '../workflow/workflow.ts';
import type { IssueKey } from './key.ts';

export type Issue = Readonly<{
  key: IssueKey;
  title: string;
  url: string;
  parent: IssueKey | null;
  state: 'open' | 'closed';
  labels: readonly string[];
  body: string | null;
  comments: number;
  updatedAt: string;
  closedAt: string | null;
  pull: boolean;
}>;

export type Edit = Readonly<{
  body?: string;
  state?: 'closed';
  state_reason?: 'completed' | 'not_planned';
}>;

type Comment = Extract<Entry, { kind: 'comment' }>;
export type Authored = Exclude<Entry, Comment> | Readonly<Omit<Comment, 'own'> & { author: string | null }>;
export type Parent = Readonly<{ key: IssueKey; url: string }>;
export type Child = Readonly<{ key: IssueKey; title: string; url: string; state: 'open' | 'closed' }>;
export type NewLabel = Readonly<{ name: string; description: string; color: string }>;
export type NewIssue = Readonly<{ title: string; body: string; labels: readonly Label[] }>;

export type Tracker = Readonly<{
  name: string;
  forms: EpicForms;
  project(): Promise<string>;
  read(n: IssueKey): Promise<Readonly<{ issue: Issue; data: IssueData }>>;
  issue(n: IssueKey): Promise<Issue>;
  issues(state: Issue['state'], label?: string): Promise<readonly Issue[]>;
  history(n: IssueKey): Promise<readonly Authored[]>;
  children(n: IssueKey): Promise<readonly Child[]>;
  link(epic: IssueKey, child: IssueKey): Promise<void>;
  timelines(issues: readonly Issue[]): Promise<ReadonlyMap<IssueKey, readonly Entry[]>>;
  epic(n: IssueKey): Promise<EpicSnapshot>;
  parent(n: IssueKey): Promise<Parent>;
  labels(): Promise<readonly string[]>;
  createLabel(fields: NewLabel): Promise<void>;
  createIssue(fields: NewIssue): Promise<Issue>;
  comment(n: IssueKey, text: string): Promise<void>;
  commentIssue(n: IssueKey, file: string, attachments: readonly string[]): Promise<string>;
  addLabels(n: IssueKey, names: readonly string[]): Promise<void>;
  removeLabel(n: IssueKey, name: string): Promise<void>;
  edit(n: IssueKey, fields: Edit): Promise<void>;
  pull(command: string): Promise<void>;
  synced<T>(command: string, work: () => Promise<T>): Promise<T>;
  sync(): Promise<boolean>;
  stderr(): string;
}>;

type TrackerFailure = Readonly<{
  text: string;
  stderr: string | null;
  notFound: boolean;
  refused: boolean;
  missing: IssueKey | null;
}>;

export class TrackerError extends Error {
  readonly text: string;
  readonly stderr: string | null;
  readonly notFound: boolean;
  readonly refused: boolean;
  readonly missing: IssueKey | null;

  constructor(message: string, failure: TrackerFailure) {
    super(message);
    this.text = failure.text;
    this.stderr = failure.stderr;
    this.notFound = failure.notFound;
    this.refused = failure.refused;
    this.missing = failure.missing;
  }
}

export function owned(history: readonly Authored[], self: string | null): Entry[] {
  return history.map((entry) =>
    entry.kind === 'comment'
      ? { kind: entry.kind, id: entry.id, at: entry.at, body: entry.body, own: self !== null && entry.author === self }
      : entry,
  );
}

export function issueData(issue: Issue, history: readonly Entry[]): IssueData {
  return { state: issue.state, labels: issue.labels, body: issue.body, history };
}
