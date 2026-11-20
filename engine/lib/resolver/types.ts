import type { IssueKey } from '../tracker/key.ts';
import type { RowSource, StartPair } from '../workflow/effort.ts';
import type { Lane, Step } from '../workflow/workflow.ts';

export type Pull = {
  number: number;
  url: string;
  draft: boolean;
  checks: string | null;
  review: string | null;
};
export type ParentEpic = { number: IssueKey; title: string };
export type IssueRow = {
  number: IssueKey;
  title: string;
  url: string;
  type: Lane | null;
  state: 'ready' | 'starting' | 'aside' | 'stuck' | 'dirty' | 'blocked';
  step: Step | null;
  started: boolean;
  urgent: boolean;
  updatedAt: string;
  path?: string;
  reason: string | null;
  act: string | null;
  effort: StartPair<RowSource> | null;
  epic: ParentEpic | null;
  pr: Pull | null;
};
