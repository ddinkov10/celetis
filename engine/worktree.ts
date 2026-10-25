import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Config } from './lib/config.ts';
import { HostError } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { codexHome } from './lib/plugin-metadata.ts';
import { run } from './lib/process.ts';
import { branchGlobs, branchPattern, laneOf, lanes } from './lib/workflow.ts';
import { checkoutOf, markerOf, removeCheckout, removeLane, runSetup } from './lib/worktree.ts';

const usage =
  'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree [--remove] <issue number>, e.g. 302 or #302';
type Issue = { title: string; state: string; labels: { name: string }[] };
type Pull = { head: { ref: string; sha: string }; state: string; merged_at: string | null };

async function execute(argv: string[], explicit: string | undefined): Promise<number> {
  const remove = argv[0] === '--remove';
  const args = remove ? argv.slice(1) : argv;
  const n = args[0]?.replace(/^#/, '');
  if (args.length !== 1 || !n || !/^[1-9][0-9]*$/.test(n)) throw new HostError(usage, 2);
  const cwd = process.cwd();
  const operation = createOperation(
    await locateCheckouts(cwd),
    { explicit, environment: process.env.CELETIS_AGENT },
    'main',
  );
  const main = operation.checkout.main as string;
  if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
  const git = async (args: string[], output = false) => {
    const result = await run('git', args, { cwd });
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
    if (output) process.stderr.write(result.stdout + result.stderr);
    return result.stdout.trimEnd();
  };
  const api = async <T>(endpoint: string, message: string, paginate = false): Promise<T> => {
    const result = await run(
      'gh',
      ['api', ...(paginate ? ['--paginate', '--slurp'] : []), `repos/{owner}/{repo}${endpoint}`],
      { cwd },
    );
    if (result.code !== 0) throw new HostError([result.stderr.trimEnd(), message].filter(Boolean).join('\n'));
    return JSON.parse(result.stdout) as T;
  };
  await git(['worktree', 'prune']);
  let branch = await git(['branch', '--list', '--format=%(refname:lstrip=2)', ...branchGlobs(n)]);
  if (branch.includes('\n'))
    throw new HostError(`several branches match #${n}: ${branch.replaceAll('\n', ' ')}; keep one`);
  let fromPr = false;
  if (!branch) {
    if (remove) return 0;
    const pulls = (
      await api<Pull[][]>('/pulls?state=open&per_page=100', 'cannot list the open PRs on GitHub', true)
    ).flat();
    branch = pulls
      .map((pull) => pull.head.ref)
      .filter((ref) => branchPattern(n).test(ref))
      .join('\n');
    if (branch.includes('\n')) throw new HostError(`several open PRs match #${n}: ${branch.replaceAll('\n', ' ')}`);
    fromPr = branch !== '';
    if (!branch) {
      const issue = await api<Issue>(`/issues/${n}`, `cannot read #${n} on GitHub`);
      const found = laneOf(issue.labels.map(({ name }) => name));
      if (found.kind === 'epic')
        throw new HostError(`#${n} is an epic: an epic has no branch; run each child's own lane`);
      if (found.kind === 'none') throw new HostError(`#${n} has no lane label; run /celetis:triage #${n} first`);
      if (found.kind === 'several')
        throw new HostError(`#${n} has several lane labels (${found.labels.join(' ')}); keep one`);
      let slug = (issue.title.split('\n')[0] as string)
        .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (slug.length > 30) {
        slug = slug.slice(0, 31);
        slug = slug.includes('-') ? slug.slice(0, slug.lastIndexOf('-')) : slug.slice(0, 30);
      }
      branch = `${lanes[found.lane].prefix}/${n}-${slug || 'issue'}`;
    }
  }
  let path = join(main, '.claude/worktrees', branch.slice(branch.indexOf('/') + 1));
  const current = await checkoutOf(branch, cwd);
  const hasBranch = (await run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd })).code === 0;
  if (current === main) throw new HostError(`switch the main checkout off ${branch} first`);
  if (remove) {
    const pulls = (
      await api<Pull[][]>(
        `/pulls?head={owner}:${encodeURIComponent(branch)}&state=all&per_page=100`,
        `cannot list the PRs of ${branch} on GitHub`,
        true,
      )
    ).flat();
    const tip = await git(['rev-parse', `refs/heads/${branch}`]);
    if (pulls.some((pull) => !pull.merged_at && pull.state === 'open'))
      throw new HostError(`the PR for ${branch} is OPEN; remove its worktree only after the merge`);
    const merged = pulls.filter((pull) => pull.merged_at).map((pull) => pull.head.sha);
    if (merged.length) {
      if (!merged.includes(tip))
        throw new HostError(
          `local ${branch} is at ${tip}, its merged PR at ${merged.join('\n')}: the local branch has commits the merged PR does not contain`,
        );
    } else {
      const issue = await api<Issue>(`/issues/${n}`, `cannot read #${n} on GitHub`);
      if (issue.state !== 'closed' && laneOf(issue.labels.map(({ name }) => name)).kind !== 'epic')
        throw new HostError(
          `#${n} is open and ${branch} has no merged PR; remove its worktree after the merge, or after the issue closes`,
        );
      if (
        await git([
          'rev-list',
          '-n',
          '1',
          `refs/heads/${branch}`,
          '--not',
          `--exclude=origin/prototype/${n}-*`,
          '--remotes=origin',
        ])
      )
        throw new HostError(
          `${branch} has commits that no origin branch contains; run git push origin ${branch}, then remove its worktree`,
        );
    }
    if (current && resolve(await git(['rev-parse', '--show-toplevel'])) === current)
      throw new HostError(`leave ${current} before removing it`);
    await removeLane(n, branch, current, cwd);
    return 0;
  }
  if (current) path = current;
  else if (hasBranch) await git(['worktree', 'add', path, branch], true);
  else if (fromPr) {
    await git(['fetch', '-q', 'origin', branch], true);
    await git(['worktree', 'add', '--track', '-b', branch, path, `origin/${branch}`], true);
  } else {
    const repo = await api<{ default_branch: string }>('', 'cannot read the default branch from GitHub');
    await git(['fetch', '-q', 'origin', repo.default_branch], true);
    await git(['worktree', 'add', '--no-track', '-b', branch, path, `origin/${repo.default_branch}`], true);
  }
  let setupRan = false;
  let validatingConfig = false;
  try {
    const checkout = await locateCheckouts(path);
    validatingConfig = true;
    const target = createOperation(checkout, operation.selection, 'active');
    validatingConfig = false;
    const config = target.activeConfig as Config;
    if (!(await stat(await markerOf(path)).catch(() => null))?.isFile()) {
      setupRan = (config.worktreeSetup ?? '') !== '';
      const status = await runSetup(path, config, main);
      if (status !== 0) throw new HostError('.celetis.yaml worktreeSetup');
    }
  } catch (error) {
    let detail = '.celetis.yaml worktreeSetup';
    if (error instanceof HostError && error.message !== '.celetis.yaml worktreeSetup') {
      console.error(error.message);
      if (error.code === 2) detail = '.celetis.yaml';
    }
    if (!current) {
      await removeCheckout(path, main, true).catch((failure: Error) => console.error(failure.message));
      if (!hasBranch) {
        const result = await run('git', ['branch', '-D', branch], { cwd: main });
        process.stderr.write(result.stdout + result.stderr);
      }
    }
    throw new HostError(
      `worktree setup failed: ${detail}`,
      validatingConfig && error instanceof HostError && error.code === 2 ? 2 : 1,
    );
  }
  process.stdout.write(`${setupRan ? '\n' : ''}${path}\n`);
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    return await execute(args, explicit);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
