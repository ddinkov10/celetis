import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Config } from './config.ts';
import { HostError } from './host.ts';
import { bunArgs, childEnv, run } from './process.ts';

export async function markerOf(checkout: string): Promise<string> {
  const result = await run('git', ['rev-parse', '--path-format=absolute', '--git-dir'], { cwd: checkout });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
  return join(result.stdout.trimEnd(), 'celetis-flow-setup-done');
}

export async function runSetup(checkout: string, config: Config, main: string): Promise<number> {
  const setup = config.worktreeSetup ?? '';
  if (setup === '') return 0;
  try {
    const base = await realpath(tmpdir());
    for (const root of [checkout, main]) {
      const path = relative(await realpath(root), base);
      if (!path || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))) {
        throw new HostError('worktree setup temporary directory must be outside the checkout');
      }
    }
    const temp = await mkdtemp(join(base, 'celetis-setup.'));
    let code: number;
    try {
      const file = join(temp, 'setup.ts');
      await writeFile(file, setup, { mode: 0o600, flag: 'wx' });
      code = await new Promise<number>((resolveCode) => {
        const child = spawn(process.execPath, bunArgs(file, [resolve(main)]), {
          cwd: checkout,
          env: childEnv(),
          stdio: 'inherit',
        });
        const handlers = new Map<NodeJS.Signals, () => void>();
        let interrupted = 0;
        for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
          const handler = () => {
            interrupted = 128 + constants.signals[signal];
            child.kill(signal);
          };
          handlers.set(signal, handler);
          process.on(signal, handler);
        }
        let failed = false;
        child.once('error', (error) => {
          failed = true;
          console.error(error.message);
        });
        child.once('close', (status, signal) => {
          for (const [name, handler] of handlers) process.off(name, handler);
          resolveCode(interrupted || (failed ? 1 : (status ?? (signal ? 128 + constants.signals[signal] : 1))));
        });
      });
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
    if (code === 0) await writeFile(await markerOf(checkout), '', { flag: 'a' });
    return code;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export async function worktrees(cwd: string, signal?: AbortSignal): Promise<{ path: string; branch?: string }[]> {
  signal?.throwIfAborted();
  const result = await run('git', ['worktree', 'list', '--porcelain', '-z'], { cwd, signal });
  signal?.throwIfAborted();
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
  return result.stdout
    .split('\0\0')
    .filter(Boolean)
    .map((record) => {
      const fields = record.split('\0');
      return {
        path: resolve((fields.find((field) => field.startsWith('worktree ')) as string).slice(9)),
        branch: fields.find((field) => field.startsWith('branch refs/heads/'))?.slice(18),
      };
    });
}

export async function checkoutOf(branch: string, cwd = process.cwd(), signal?: AbortSignal): Promise<string> {
  return (await worktrees(cwd, signal)).find((tree) => tree.branch === branch)?.path ?? '';
}

export async function removeCheckout(
  checkout: string,
  cwd: string,
  force = false,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const result = await run('git', ['worktree', 'remove', ...(force ? ['--force'] : []), checkout], { cwd, signal });
  signal?.throwIfAborted();
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
  process.stderr.write(result.stdout + result.stderr);
}

export async function removeLane(
  n: string,
  branch: string,
  checkout: string,
  cwd: string,
  signal?: AbortSignal,
): Promise<void> {
  const git = async (args: string[], output = false) => {
    signal?.throwIfAborted();
    const result = await run('git', args, { cwd, signal });
    signal?.throwIfAborted();
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
    if (output) process.stderr.write(result.stdout + result.stderr);
    return result.stdout.trimEnd();
  };
  const prototypes = await git(['branch', '--list', '--format=%(refname:lstrip=2)', `prototype/${n}-*`]);
  const pushed = await git(['ls-remote', '--heads', 'origin', `refs/heads/prototype/${n}-*`]);
  for (const prototype of prototypes.split('\n').filter(Boolean)) {
    const at = await checkoutOf(prototype, cwd, signal);
    if (at) {
      signal?.throwIfAborted();
      await run('git', ['worktree', 'unlock', at], { cwd, signal });
      await removeCheckout(at, cwd, false, signal);
    }
    await git(['branch', '-D', prototype], true);
  }
  if (pushed)
    await git(
      ['push', '-q', 'origin', '--delete', ...pushed.split('\n').map((line) => line.slice(line.indexOf('\t') + 1))],
      true,
    );
  if (checkout) {
    signal?.throwIfAborted();
    await run('git', ['worktree', 'unlock', checkout], { cwd, signal });
    await removeCheckout(checkout, cwd, false, signal);
  }
  await git(['branch', '-D', branch], true);
}
