import type { RowSource, StartPair } from './effort.ts';
import type { Lane, Step } from './workflow.ts';

export type Pull = {
  number: number;
  url: string;
  draft: boolean;
  checks: string | null;
  review: string | null;
};
export type ParentEpic = { number: number; title: string };
export type IssueRow = {
  number: number;
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
