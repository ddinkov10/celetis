import { devNull } from 'node:os';
import { type CodeHost, CodeHostError, type PullDetails, type Repository } from '../code-host/code-host.ts';
import { run } from '../process/process.ts';

const base = ['--no-optional-locks', '-c', `core.hooksPath=${devNull}`];
const noPullRequests = 'the merge landing has no pull requests';

async function unsupported(): Promise<never> {
  throw new CodeHostError(noPullRequests, null, noPullRequests);
}

function fullName(url: string): string {
  const path = /^[a-z][a-z\d+.-]*:\/\//i.test(url)
    ? decodeURIComponent(new URL(url).pathname)
    : url.replaceAll('\\', '/');
  return path.replace(/^\/+/, '').replace(/\.git$/, '');
}

export function gitCodeHost(main: string, signal?: AbortSignal, env?: NodeJS.ProcessEnv): CodeHost {
  let stderr = '';

  async function git(args: string[]): Promise<string> {
    const result = await run('git', [...base, ...args], { cwd: main, signal, env });
    stderr += result.stderr;
    if (result.code !== 0) {
      const output = `${result.stdout}${result.stderr}`.trimEnd() || null;
      throw new CodeHostError(`git ${args.join(' ')} failed`, output, `git ${args.join(' ')} failed`);
    }
    return result.stdout;
  }

  async function repository(): Promise<Repository> {
    const head = await git(['ls-remote', '--symref', 'origin', 'HEAD']);
    const branch = /^ref: refs\/heads\/(.+)\tHEAD\r?$/m.exec(head)?.[1];
    if (branch === undefined)
      throw new CodeHostError('origin HEAD names no branch', head.trimEnd() || null, 'origin HEAD names no branch');
    const url = (await git(['remote', 'get-url', 'origin'])).trimEnd();
    return { fullName: fullName(url), defaultBranch: branch, url };
  }

  return {
    name: 'git',
    repository,
    pulls: async () => [],
    pullDetails: async () => new Map<number, PullDetails>(),
    pull: unsupported,
    createPull: unsupported,
    mergePull: unsupported,
    checkRuns: unsupported,
    statuses: unsupported,
    workflowRuns: unsupported,
    workflowRun: unsupported,
    rerunFailedJobs: unsupported,
    stderr: () => stderr,
  };
}
