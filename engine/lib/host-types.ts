import type { Level, StartPair } from './effort.ts';
import type { RepositoryLayout } from './state.ts';
import type { ObservedUsage, UsageAttempt } from './usage-types.ts';
import type { Step } from './workflow.ts';

export type Claim = { kind: 'none' } | { kind: 'one'; id: string } | { kind: 'many' };
export type StepStart = Readonly<{
  issue: number;
  step: Step;
  cwd: string;
  start: StartPair;
  stepText: () => Promise<string>;
  sessionId: string | null;
}>;
export type StepArguments = { args: string[]; applied: Level | null; model: string | null };
export type Capability = Readonly<{
  steps: 'all' | readonly Step[];
  interactive: boolean;
  dispatch: boolean;
  landing: boolean;
  setup: boolean;
}>;
export type SessionStart = Readonly<{
  plugin: () => Promise<string>;
  folder: string;
  stepText: (() => Promise<string>) | null;
}>;
export type HostAdapter = Readonly<{
  app: string;
  capability: Capability;
  appliesEffort: boolean;
  exitKeys: (terminal: string) => string[];
  checkHome: () => Promise<void>;
  homeEnv: () => Promise<Readonly<Record<string, string>>>;
  stepEnv: (source: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
  pin: (main: string) => Promise<string[]>;
  sessionEnv: (session: SessionStart) => Promise<Readonly<Record<string, string>>>;
  stepPrompt: (step: Step, issue: number) => string;
  stepArguments: (start: StepStart) => Promise<StepArguments>;
  resumeArguments: (session: Readonly<{ session_id: string; effort: Level | null }>) => string[];
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
