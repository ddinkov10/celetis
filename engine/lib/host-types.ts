import type { Level } from './effort.ts';
import type { RepositoryLayout } from './state.ts';
import type { ObservedUsage, UsageAttempt } from './usage-types.ts';
import type { Step } from './workflow.ts';

export type Claim = { kind: 'none' } | { kind: 'one'; id: string } | { kind: 'many' };
export type StepStart = Readonly<{
  issue: number;
  step: Step;
  cwd: string;
  effort: Level;
  stepText: () => Promise<string>;
}>;
export type StepArguments = { args: string[]; applied: Level; model: string | null };
export type HostAdapter = Readonly<{
  app: string;
  exitKeys: (terminal: string) => string[];
  checkHome: () => Promise<void>;
  homeEnv: () => Promise<Readonly<Record<string, string>>>;
  stepEnv: (source: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
  pin: (main: string) => Promise<string[]>;
  stepPrompt: (step: Step, issue: number) => string;
  stepArguments: (start: StepStart) => Promise<StepArguments>;
  resumeArguments: (session: Readonly<{ session_id: string; effort: Level }>) => string[];
  interactiveArguments: (title: string, prompt: string, attempt: string) => string[];
  startId: () => string | null;
  claim: (checkout: string, prompt: string, announced: string, startedAt: number) => Promise<Claim>;
  verifySession: (checkout: string, sessionId: string | null, startedAt: number) => Promise<boolean>;
  recovery: string;
  prepareUsage: (attempt: UsageAttempt, layout: RepositoryLayout) => Promise<string[]>;
  readUsage: (attempt: UsageAttempt, capture: string) => Promise<ObservedUsage>;
  sessionVariable: string;
  terminatesAfterGrace: boolean;
}>;
