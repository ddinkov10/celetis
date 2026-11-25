import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { HostError } from '../engine/lib/command/errors.ts';
import { bunFloor } from '../engine/lib/config/core.ts';
import { type ExitCode, exits } from '../engine/lib/contract/contract.ts';
import { readArchive } from '../engine/lib/package/archive.ts';
import { download, readDocument } from '../engine/lib/package/registry.ts';
import { run } from '../engine/lib/process/process.ts';
import {
  manifests,
  parseStamp,
  type ReleaseStamp,
  releaseParts,
  releaseSource,
} from '../engine/lib/release/release.ts';

const refuse = (reason: string, code: ExitCode = exits.prerequisite) => new HostError(`package: ${reason}`, code);

async function git(args: string[], cwd: string, code: ExitCode = exits.blocked, bytes = false): Promise<string> {
  const result = await run('git', args, { cwd, bytes });
  if (result.code !== 0) throw refuse(`git ${args[0]} failed: ${result.stderr.trim()}`, code);
  return result.stdout;
}

async function releaseCommit(root: string, version: string): Promise<string> {
  const top = (await git(['rev-parse', '--show-toplevel'], root, exits.prerequisite)).trim();
  if ((await realpath(top)) !== (await realpath(root))) throw refuse('run it at the top of a checkout');
  const head = (await git(['rev-parse', 'HEAD'], root)).trim();
  const tag = await run('git', ['rev-parse', '-q', '--verify', `refs/tags/v${version}^{commit}`], { cwd: root });
  if (tag.code !== 0) throw refuse(`the checkout has no tag v${version}`);
  if (tag.stdout.trim() !== head) throw refuse(`HEAD is ${head}, and the tag v${version} is at ${tag.stdout.trim()}`);
  if ((await git(['status', '--porcelain', '--untracked-files=normal'], root)) !== '')
    throw refuse('the checkout has uncommitted changes');
  for (const manifest of manifests) {
    const found: unknown = JSON.parse(await readFile(join(root, manifest), 'utf8')).version;
    if (found !== version) throw refuse(`${manifest} has the version ${String(found)}, not ${version}`);
  }
  return head;
}

async function writePackage(root: string, stamp: ReleaseStamp, folder: string): Promise<void> {
  try {
    await mkdir(folder);
  } catch (error) {
    throw refuse(`cannot create ${folder}: ${(error as Error).message}`);
  }
  const tree = join(folder, 'package');
  const tar = await git(
    ['archive', '--format=tar', stamp.revision, '--', 'engine', 'plugins/celetis'],
    root,
    exits.blocked,
    true,
  );
  await new Bun.Archive(Buffer.from(tar, 'latin1')).extract(tree);
  const { dependencies } = JSON.parse(await readFile(join(tree, 'engine/package.json'), 'utf8'));
  const manifest = {
    name: 'celetis',
    version: stamp.version,
    license: 'UNLICENSED',
    repository: { type: 'git', url: `git+${releaseSource}` },
    bin: { celetis: 'engine/bootstrap' },
    files: ['engine', 'plugins/celetis'],
    engines: { bun: `>=${bunFloor}` },
    dependencies,
  };
  await writeFile(join(tree, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await writeFile(join(tree, 'engine/release.json'), `${JSON.stringify(stamp)}\n`, { flag: 'wx' });
}

async function pack(folder: string, version: string): Promise<string> {
  const result = await run('npm', ['pack', '--ignore-scripts', '--pack-destination', folder, join(folder, 'package')], {
    cwd: folder,
  });
  if (result.code !== 0) throw refuse(`npm pack failed: ${result.stderr.trim()}`, exits.blocked);
  const tarball = join(folder, `celetis-${version}.tgz`);
  const data = await readFile(tarball).catch((error: Error) => {
    throw refuse(`npm pack wrote no ${tarball}: ${error.message}`, exits.blocked);
  });
  const entries = readArchive(new Uint8Array(data));
  for (const entry of ['engine/celetis', 'engine/bootstrap'])
    if (!entries.some(({ path, mode }) => path === entry && mode === 0o755))
      throw refuse(`${tarball} has no executable ${entry}`);
  return tarball;
}

async function published(stamp: ReleaseStamp): Promise<boolean> {
  const target = (await readDocument())?.versions.get(stamp.version);
  if (target === undefined) return false;
  const file = readArchive(await download(target)).find(({ path }) => path === 'engine/release.json');
  if (file === undefined) throw refuse(`npm holds celetis ${stamp.version} with no release stamp`);
  const found = parseStamp(new TextDecoder().decode(file.data));
  if (found.version !== stamp.version || found.revision !== stamp.revision)
    throw refuse(`npm holds celetis ${stamp.version} at ${found.revision}, and the tag is at ${stamp.revision}`);
  return true;
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const [version, folder] = argv;
    if (argv.length !== 2 || version === undefined || !folder || releaseParts(`v${version}`) === null)
      throw refuse('usage: scripts/package.ts <X.Y.Z> <folder>', exits.usage);
    const root = process.cwd();
    const stamp: ReleaseStamp = { version, revision: await releaseCommit(root, version), source: releaseSource };
    const target = resolve(folder);
    await writePackage(root, stamp, target);
    console.log(`package: celetis ${version} at ${stamp.revision} in ${await pack(target, version)}`);
    console.log((await published(stamp)) ? 'package: published' : 'package: publish');
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
