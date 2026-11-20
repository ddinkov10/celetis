import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CodeHostError } from './lib/code-host/code-host.ts';
import { HostError } from './lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/command/operation.ts';
import type { Config } from './lib/config/core.ts';
import { type ExitCode, exits, usage, worktreePathLine } from './lib/contract/contract.ts';
import { hostAdapter } from './lib/host/hosts.ts';
import { run } from './lib/process/process.ts';
import { RecoveryError, validateRecovery } from './lib/run/quota-recovery.ts';
import { services } from './lib/services/services.ts';
import { installRecorder, markDefect } from './lib/state/events.ts';
import { laneFolder } from './lib/state/state.ts';
import { type IssueKey, parseHandle } from './lib/tracker/key.ts';
import { TrackerError } from './lib/tracker/tracker.ts';
import { branchGlobs, branchPattern, laneBranch, laneOf, prototypeGlob } from './lib/workflow/workflow.ts';
import { checkoutOf, markerOf, removeCheckout, removeLane, runSetup, updateLane } from './lib/workflow/worktree.ts';

const recoveryLine =
  'the quota recovery keeps the dirty lane; trunk integration waits until the lane is clean. Inspect the existing changes and the issue before you edit.';

async function fromGitHub<T>(call: Promise<T>, message: string): Promise<T> {
  return call.catch((error: unknown) => {
    if (!(error instanceof TrackerError || error instanceof CodeHostError)) throw error;
    throw new HostError([(error.stderr ?? error.text).trimEnd(), message].filter(Boolean).join('\n'), exits.blocked);
  });
}

async function recovered(main: string, n: IssueKey, path: string): Promise<boolean> {
  const key = process.env.CELETIS_RECOVERY;
  if (!key) return false;
  const permit = await validateRecovery(main, n, key).catch((error: unknown) => {
    if (error instanceof RecoveryError) {
      console.error(`worktree: ${error.message}; the normal entry applies`);
      return null;
    }
    throw error;
  });
  return permit?.lane === path;
}

async function execute(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  const remove = argv[0] === '--remove';
  const args = remove ? argv.slice(1) : argv;
  const n = args.length === 1 ? parseHandle(args[0] as string) : null;
  if (n === null) throw new HostError(usage('worktree'), exits.usage);
  const cwd = process.cwd();
  const operation = await createOperation(
    await locateCheckouts(cwd),
    { explicit, environment: process.env.CELETIS_AGENT },
    'main',
  );
  const main = operation.checkout.main as string;
  await hostAdapter(operation.host).checkHome();
  const git = async (args: string[], output = false) => {
    const result = await run('git', args, { cwd });
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
    if (output) process.stderr.write(result.stdout + result.stderr);
    return result.stdout.trimEnd();
  };
  const { tracker, codeHost } = services(cwd);
  await git(['worktree', 'prune']);
  let branch = await git(['branch', '--list', '--format=%(refname:lstrip=2)', ...branchGlobs(n)]);
  if (branch.includes('\n'))
    throw new HostError(`several branches match #${n}: ${branch.replaceAll('\n', ' ')}; keep one`, exits.prerequisite);
  let fromPr = false;
  if (!branch) {
    if (remove) return exits.done;
    const pulls = await fromGitHub(codeHost.pulls({ state: 'open' }), 'cannot list the open PRs on GitHub');
    branch = pulls
      .map((pull) => pull.head.ref)
      .filter((ref) => branchPattern(n).test(ref))
      .join('\n');
    if (branch.includes('\n'))
      throw new HostError(`several open PRs match #${n}: ${branch.replaceAll('\n', ' ')}`, exits.prerequisite);
    fromPr = branch !== '';
    if (!branch) {
      const issue = await fromGitHub(tracker.issue(n), `cannot read #${n} on GitHub`);
      const found = laneOf(issue.labels);
      if (found.kind === 'epic')
        throw new HostError(`#${n} is an epic: an epic has no branch; run each child's own lane`, exits.prerequisite);
      if (found.kind === 'none')
        throw new HostError(`#${n} has no lane label; run /celetis:triage #${n} first`, exits.prerequisite);
      if (found.kind === 'several')
        throw new HostError(`#${n} has several lane labels (${found.labels.join(' ')}); keep one`, exits.prerequisite);
      let slug = (issue.title.split('\n')[0] as string)
        .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (slug.length > 30) {
        slug = slug.slice(0, 31);
        slug = slug.includes('-') ? slug.slice(0, slug.lastIndexOf('-')) : slug.slice(0, 30);
      }
      branch = laneBranch(found.lane, n, slug || 'issue');
    }
  }
  let path = join(laneFolder(main), branch.slice(branch.indexOf('/') + 1));
  const current = await checkoutOf(branch, cwd);
  const hasBranch = (await run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd })).code === 0;
  if (current === main) throw new HostError(`switch the main checkout off ${branch} first`, exits.prerequisite);
  if (remove) {
    const pulls = await fromGitHub(
      codeHost.pulls({ head: branch, state: 'all' }),
      `cannot list the PRs of ${branch} on GitHub`,
    );
    const tip = await git(['rev-parse', `refs/heads/${branch}`]);
    if (pulls.some((pull) => !pull.mergedAt && pull.state === 'open'))
      throw new HostError(`the PR for ${branch} is OPEN; remove its worktree only after the merge`, exits.prerequisite);
    const merged = pulls.filter((pull) => pull.mergedAt).map((pull) => pull.head.sha);
    if (merged.length) {
      if (!merged.includes(tip))
        throw new HostError(
          `local ${branch} is at ${tip}, its merged PR at ${merged.join('\n')}: the local branch has commits the merged PR does not contain`,
          exits.prerequisite,
        );
    } else {
      const issue = await fromGitHub(tracker.issue(n), `cannot read #${n} on GitHub`);
      if (issue.state !== 'closed' && laneOf(issue.labels).kind !== 'epic')
        throw new HostError(
          `#${n} is open and ${branch} has no merged PR; remove its worktree after the merge, or after the issue closes`,
          exits.prerequisite,
        );
      if (
        await git([
          'rev-list',
          '-n',
          '1',
          `refs/heads/${branch}`,
          '--not',
          `--exclude=origin/${prototypeGlob(n)}`,
          '--remotes=origin',
        ])
      )
        throw new HostError(
          `${branch} has commits that no origin branch contains; run git push origin ${branch}, then remove its worktree`,
          exits.prerequisite,
        );
    }
    if (current && resolve(await git(['rev-parse', '--show-toplevel'])) === current)
      throw new HostError(`leave ${current} before removing it`, exits.prerequisite);
    await removeLane(n, branch, current, cwd);
    return exits.done;
  }
  const trunk = (await fromGitHub(codeHost.repository(), 'cannot read the default branch from GitHub')).defaultBranch;
  await git(['fetch', '-q', 'origin', trunk], true);
  if (current) path = current;
  else if (hasBranch) await git(['worktree', 'add', path, branch], true);
  else if (fromPr) {
    await git(['fetch', '-q', 'origin', branch], true);
    await git(['worktree', 'add', '--track', '-b', branch, path, `origin/${branch}`], true);
  } else await git(['worktree', 'add', '--no-track', '-b', branch, path, `origin/${trunk}`], true);
  const discard = async () => {
    if (current) return;
    await removeCheckout(path, main, true).catch((failure: Error) => console.error(failure.message));
    if (!hasBranch) {
      const result = await run('git', ['branch', '-D', branch], { cwd: main });
      process.stderr.write(result.stdout + result.stderr);
    }
  };
  try {
    if (await recovered(main, n, path)) console.error(`worktree: #${n}: ${recoveryLine}`);
    else await updateLane(path, branch, trunk, n);
  } catch (error) {
    if (error instanceof HostError && error.code === exits.repair) process.stdout.write(`${worktreePathLine(path)}\n`);
    else await discard();
    throw error;
  }
  let setupRan = false;
  let validatingConfig = false;
  try {
    const checkout = await locateCheckouts(path);
    validatingConfig = true;
    const target = await createOperation(checkout, operation.selection, 'active');
    validatingConfig = false;
    const config = target.activeConfig as Config;
    if (!(await stat(await markerOf(path)).catch(() => null))?.isFile()) {
      setupRan = (config.worktreeSetup ?? '') !== '';
      const status = await runSetup(path, config, main);
      if (status !== 0) throw new HostError('.celetis.yaml worktreeSetup', exits.blocked);
    }
  } catch (error) {
    let detail = '.celetis.yaml worktreeSetup';
    if (error instanceof Error && error.message !== '.celetis.yaml worktreeSetup') {
      console.error(error.message);
      if (validatingConfig && error instanceof HostError && error.code === exits.usage) detail = '.celetis.yaml';
    }
    await discard();
    throw new HostError(`worktree setup failed: ${detail}`, error instanceof HostError ? error.code : exits.internal);
  }
  process.stdout.write(`${setupRan ? '\n' : ''}${worktreePathLine(path)}\n`);
  return exits.done;
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    return await execute(args, explicit);
  } catch (error) {
    markDefect(error);
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('worktree');
  process.exitCode = await main(process.argv.slice(2));
}
