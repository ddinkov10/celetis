import { realpath } from 'node:fs/promises';
import { exits } from './contract.ts';
import { HostError } from './errors.ts';
import { run } from './process.ts';

export async function git(args: string[], cwd: string, execute: typeof run = run): Promise<string> {
  const result = await execute(
    'git',
    ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args],
    { cwd, timeout: 10_000 },
  );
  if (result.code !== 0)
    throw new HostError(
      [
        `git ${args.find((arg) => !arg.startsWith('-'))} failed (exit ${result.code})`,
        result.stderr.trimEnd(),
        result.stdout.trimEnd(),
      ]
        .filter(Boolean)
        .join('\n'),
      exits.blocked,
    );
  return result.stdout.trimEnd();
}

export async function commonDir(cwd: string): Promise<string> {
  const result = await run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
  return result.stdout.replace(/\n$/, '');
}

export async function mainCheckout(cwd: string): Promise<string> {
  const gitPath = async (args: string[], at = cwd) => {
    const result = await run('git', ['rev-parse', ...args], { cwd: at });
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
    return realpath(result.stdout.replace(/\n$/, ''));
  };
  const active = await gitPath(['--show-toplevel']);
  const common = await realpath(await commonDir(cwd));
  if ((await gitPath(['--absolute-git-dir'])) === common) return active;
  const listed = await run('git', ['worktree', 'list', '--porcelain', '-z'], { cwd });
  if (listed.code !== 0) throw new HostError(listed.stderr.trimEnd(), exits.blocked);
  const first = listed.stdout.split('\0\0')[0]?.split('\0') ?? [];
  const candidate = first[0]?.startsWith('worktree ') ? first[0].slice(9) : '';
  const message = `celetis: cannot identify the main checkout from Git metadata: ${common}`;
  if (!candidate || first.includes('bare')) throw new HostError(message, exits.prerequisite);
  try {
    const main = await gitPath(['--show-toplevel'], candidate);
    if ((await gitPath(['--absolute-git-dir'], main)) === common) return main;
  } catch (error) {
    throw new HostError(`${message}\n${error instanceof Error ? error.message : String(error)}`, exits.prerequisite);
  }
  throw new HostError(message, exits.prerequisite);
}

export async function programRevision(root: string): Promise<string> {
  const result = await run('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
  return result.stdout.trimEnd();
}
