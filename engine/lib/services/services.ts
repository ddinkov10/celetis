import type { CodeHost } from '../code-host/code-host.ts';
import { githubCodeHost } from '../github/code-host.ts';
import { client } from '../github/github.ts';
import { githubTracker } from '../github/tracker.ts';
import type { Tracker } from '../tracker/tracker.ts';

export type Services = Readonly<{ tracker: Tracker; codeHost: CodeHost }>;

export function services(cwd: string, signal?: AbortSignal, env?: NodeJS.ProcessEnv): Services {
  const shared = client(cwd, signal, env);
  return { tracker: githubTracker(shared), codeHost: githubCodeHost(shared) };
}
