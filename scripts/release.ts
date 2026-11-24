import { spawn } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HostError } from '../engine/lib/command/errors.ts';
import { type ExitCode, exits } from '../engine/lib/contract/contract.ts';
import { installArgs, installDependencies } from '../engine/lib/install/dependencies.ts';
import { bunArgs, run } from '../engine/lib/process/process.ts';
import { manifests, newestRelease, releaseParts } from '../engine/lib/release/release.ts';

const nameLine = '  "name": "celetis",';

const refuse = (reason: string, code: ExitCode = exits.prerequisite) => new HostError(`release: ${reason}`, code);

async function git(args: string[], cwd: string, code: ExitCode = exits.blocked): Promise<string> {
  const result = await run('git', args, { cwd });
  if (result.code !== 0) throw refuse(`git ${args[0]} failed: ${result.stderr.trim()}`, code);
  return result.stdout.trim();
}

async function remoteRefs(cwd: string, pattern: string): Promise<Map<string, string>> {
  const refs = new Map<string, string>();
  for (const line of (await git(['ls-remote', '--', 'origin', pattern], cwd)).split('\n')) {
    const [sha, ref] = line.split('\t');
    if (sha && ref) refs.set(ref, sha);
  }
  return refs;
}

async function addVersion(root: string, version: string): Promise<void> {
  for (const manifest of manifests) {
    const file = join(root, manifest);
    const text = await readFile(file, 'utf8');
    const lines = text.split('\n');
    const at = lines.flatMap((line, index) => (line === nameLine ? [index] : []));
    if (at.length !== 1 || 'version' in JSON.parse(text))
      throw refuse(`${manifest} must hold one line ${nameLine.trim()} and no version`);
    lines.splice((at[0] as number) + 1, 0, `  "version": "${version}",`);
    await writeFile(file, lines.join('\n'));
  }
}

function gate(cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, bunArgs('scripts/verify.ts', []), {
      cwd,
      env: process.env,
      stdio: ['inherit', 'pipe', 'inherit'],
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (text: string) => {
      process.stdout.write(text);
      output += text;
    });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0 && output.trimEnd().split('\n').pop() === 'verify: PASS'));
  });
}

async function release(version: string): Promise<string> {
  const tag = `v${version}`;
  const root = process.cwd();
  const top = await git(['rev-parse', '--show-toplevel'], root, exits.prerequisite);
  if ((await realpath(top)) !== (await realpath(root))) throw refuse('run it at the top of the main checkout');
  const branch = await run('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: root });
  if (branch.stdout.trim() !== 'main') throw refuse('the checkout is not on main');
  if ((await git(['status', '--porcelain', '--untracked-files=normal'], root, exits.prerequisite)) !== '')
    throw refuse('the checkout has uncommitted changes');
  const head = await git(['rev-parse', 'HEAD'], root, exits.prerequisite);
  if ((await remoteRefs(root, 'refs/heads/main')).get('refs/heads/main') !== head)
    throw refuse('main is not the same commit as origin main; pull or push first');

  const tags = [...(await remoteRefs(root, 'refs/tags/v*')).keys()].map((ref) => ref.slice('refs/tags/'.length));
  const newest = newestRelease(tags);
  if (newest !== null && newestRelease([newest, tag]) === newest)
    throw refuse(`${tag} is not newer than the greatest tag of origin, ${newest}`);
  if ((await run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: root })).code === 0)
    throw refuse(`the local tag ${tag} exists; push it: git push origin refs/tags/${tag}`);

  const dir = await mkdtemp(join(tmpdir(), 'celetis-release-'));
  const tree = join(dir, 'tree');
  try {
    await git(['worktree', 'add', '-q', '--detach', tree, head], root);
    await addVersion(tree, version);
    await git(['commit', '-q', '-a', '-m', `release: ${tag}`], tree);
    const commit = await git(['rev-parse', 'HEAD'], tree);
    const dependencies = await installDependencies(tree, 'development');
    if (dependencies.kind === 'no-lock')
      throw refuse(`the release commit ${commit} has no engine/bun.lock; nothing was tagged`);
    if (dependencies.kind === 'failed') {
      process.stderr.write(dependencies.output);
      throw refuse(
        `bun ${installArgs.development.join(' ')} failed in the release commit ${commit}; nothing was tagged`,
      );
    }
    if (!(await gate(tree))) throw refuse(`the verify gate failed on the release commit ${commit}; nothing was tagged`);
    await git(['tag', '-a', tag, '-m', tag, commit], root);
    const push = await run('git', ['push', 'origin', `refs/tags/${tag}`], { cwd: root });
    if (push.code !== 0)
      throw refuse(`the push failed; the local tag stays; push it: git push origin refs/tags/${tag}`, exits.blocked);
    return commit;
  } finally {
    await run('git', ['worktree', 'remove', '--force', tree], { cwd: root });
    await rm(dir, { recursive: true, force: true });
  }
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const version = argv[0];
    if (argv.length !== 1 || version === undefined || releaseParts(`v${version}`) === null)
      throw refuse('usage: scripts/release.ts <X.Y.Z>', exits.usage);
    console.log(`release: v${version} -> ${await release(version)}`);
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
