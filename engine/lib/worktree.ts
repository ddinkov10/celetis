import { lstat, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type Config, validateWorktreeSetup } from './config-core.ts';
import { exits } from './contract.ts';
import { HostError } from './errors.ts';
import { run, runBun } from './process.ts';
import { projectFile } from './setup-wiring.ts';
import { setupMarker } from './state.ts';

export async function markerOf(checkout: string): Promise<string> {
  const result = await run('git', ['rev-parse', '--path-format=absolute', '--git-dir'], { cwd: checkout });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
  const dir = result.stdout.trimEnd();
  const { current: marker, old } = setupMarker(dir);
  const present = (path: string) =>
    lstat(path).then(
      () => true,
      () => false,
    );
  if (await present(old)) {
    if (await present(marker)) await rm(old, { force: true });
    else
      await rename(old, marker).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
  }
  return marker;
}

export async function setupFile(checkout: string, reference: string): Promise<string> {
  let target = resolve(checkout, reference);
  try {
    if (validateWorktreeSetup(reference) === '') throw new Error('need a nonempty file reference');
    target = join(await realpath(checkout), reference);
    return await projectFile(checkout, reference);
  } catch (error) {
    throw new HostError(
      `worktreeSetup ${target}: ${error instanceof Error ? error.message : String(error)}`,
      exits.usage,
    );
  }
}

export async function runSetup(checkout: string, config: Config, main: string): Promise<number> {
  const setup = config.worktreeSetup ?? '';
  if (setup === '') return exits.done;
  const file = await setupFile(checkout, setup);
  const code = await runBun(file, [resolve(main)], checkout);
  if (code === 0) await writeFile(await markerOf(checkout), '', { flag: 'a' });
  return code;
}

export async function worktrees(cwd: string, signal?: AbortSignal): Promise<{ path: string; branch?: string }[]> {
  signal?.throwIfAborted();
  const result = await run('git', ['worktree', 'list', '--porcelain', '-z'], { cwd, signal });
  signal?.throwIfAborted();
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
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
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
  process.stderr.write(result.stdout + result.stderr);
}

export async function updateLane(checkout: string, branch: string, trunk: string, n: string): Promise<void> {
  const git = (args: string[]) => run('git', args, { cwd: checkout });
  const upstream = `origin/${trunk}`;
  const contains = async (ancestor: string, descendant: string) => {
    const result = await git(['merge-base', '--is-ancestor', ancestor, descendant]);
    if (result.code > 1) throw new HostError(result.stderr.trimEnd(), exits.blocked);
    return result.code === 0;
  };
  if (await contains(upstream, 'HEAD')) return;
  const status = await git(['status', '--porcelain']);
  if (status.code !== 0) throw new HostError(status.stderr.trimEnd(), exits.blocked);
  if (status.stdout) throw new HostError(`the lane worktree is dirty: ${checkout}; commit first`, exits.prerequisite);
  const merge = (await contains('HEAD', upstream))
    ? await git(['merge', '-q', '--ff-only', upstream])
    : await git(['merge', '--no-ff', '--no-edit', '-m', `Merge ${upstream} into ${branch} (#${n})`, upstream]);
  if (merge.code === 0) return;
  const unmerged = await git(['ls-files', '-u']);
  const abort = await git(['merge', '--abort']);
  const conflict = unmerged.code === 0 && unmerged.stdout !== '' && abort.code === 0;
  throw new HostError(
    [
      merge.stdout.trim(),
      merge.stderr.trim(),
      conflict
        ? `cannot merge ${upstream} into ${branch}: a conflict; merge it in ${checkout} and commit, then run celetis --agent <host> worktree ${n} again`
        : `cannot merge ${upstream} into ${branch}; merge it by hand and commit, then run the step again`,
    ]
      .filter(Boolean)
      .join('\n'),
    conflict ? exits.repair : exits.blocked,
  );
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
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
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
