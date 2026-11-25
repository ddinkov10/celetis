import type { CodeHost } from '../code-host/code-host.ts';
import { readConfig } from '../config/config.ts';
import { ConfigError } from '../config/core.ts';
import { gitCodeHost } from '../git-host/git-host.ts';
import { githubCodeHost } from '../github/code-host.ts';
import { type Client, client } from '../github/github.ts';
import { githubTracker } from '../github/tracker.ts';
import { localTracker } from '../local/local.ts';
import type { TrackerKind } from '../tracker/grammar.ts';
import type { Tracker } from '../tracker/tracker.ts';

export type Choice = Readonly<{ tracker: TrackerKind; landing: 'pr' | 'merge' }>;
export type Services = Readonly<{ tracker: Tracker; codeHost: CodeHost }>;

export function needsGh(choice: Choice): boolean {
  return choice.tracker === 'github' || choice.landing === 'pr';
}

export function projectNeedsGh(main: string): boolean {
  try {
    return needsGh(readConfig(main));
  } catch (error) {
    if (error instanceof ConfigError) return true;
    throw error;
  }
}

export function services(choice: Choice, cwd: string, signal?: AbortSignal, env?: NodeJS.ProcessEnv): Services {
  let shared: Client | undefined;
  const github = () => {
    shared ??= client(cwd, signal, env);
    return shared;
  };
  return {
    tracker: choice.tracker === 'local' ? localTracker(cwd, signal) : githubTracker(github()),
    codeHost: choice.landing === 'merge' ? gitCodeHost(cwd, signal, env) : githubCodeHost(github()),
  };
}
