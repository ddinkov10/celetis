import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, readlink, realpath, rename, rm, symlink, utimes } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { liveRevisions } from '../daemon/client.ts';
import { celetisBase } from '../host/homes.ts';
import { writeArchive } from '../package/archive.ts';
import { checkReleaseTag, readRecord, readTarget, writeRecord } from '../package/package.ts';
import { versionTarget } from '../package/registry.ts';
import { installedRevision } from '../plugin/metadata.ts';
import { git } from '../process/git.ts';
import { run } from '../process/process.ts';
import { hasGitEntry, manifestVersion, readStamp, type releaseSource } from '../release/release.ts';
import { revision as fullRevision } from '../state/fields.ts';
import { installLock, withLock, writeAtomic } from '../state/state.ts';
import { resolveRef } from '../update/target.ts';
import { installDependencies } from './dependencies.ts';

export type EnginePaths = Readonly<{
  data: string;
  versions: string;
  bin: string;
  link: string;
  cmd: string;
  current: string;
}>;
export type Engine = Readonly<{ root: string; entry: string; revision: string; command: string }>;
export type GitEngine = Readonly<{
  kind: 'git';
  source: string;
  ref: Readonly<{ kind: 'branch'; name: string }>;
  revision: string;
}>;
export type PackageEngine = Readonly<{
  kind: 'package';
  source: typeof releaseSource;
  version: string;
  revision: string;
  integrity: string;
}>;
export type EngineSource = GitEngine | PackageEngine;

export const engineRefName = (source: EngineSource) =>
  source.kind === 'git' ? `refs/heads/${source.ref.name}` : `refs/tags/v${source.version}`;

const shShim = [
  '#!/bin/sh',
  `base="\${CELETIS_HOME:-$USERPROFILE}"`,
  'read -r revision < "$base/.local/share/celetis/current" || exit 1',
  String.raw`exec env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install '--config=\\.\nul' --no-macros "$base/.local/share/celetis/versions/$revision/engine/celetis" "$@"`,
  '',
].join('\n');

const cmdShim = [
  '@echo off',
  'setlocal',
  'if not defined CELETIS_HOME set "CELETIS_HOME=%USERPROFILE%"',
  String.raw`set /p revision=<"%CELETIS_HOME%\.local\share\celetis\current"`,
  'set BUN_RUNTIME_TRANSPILER_CACHE_PATH=0',
  'set DO_NOT_TRACK=1',
  String.raw`bun --no-env-file --no-install --config=\\.\nul --no-macros "%CELETIS_HOME%\.local\share\celetis\versions\%revision%\engine\celetis" %*`,
  'exit /b %errorlevel%',
  '',
].join('\r\n');

const slow: typeof run = (file, args, options) =>
  run(file, args, { ...options, timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });

export function enginePaths(base = celetisBase()): EnginePaths {
  const data = join(base, '.local/share/celetis');
  const bin = join(base, '.local/bin');
  return {
    data,
    versions: join(data, 'versions'),
    bin,
    link: join(bin, 'celetis'),
    cmd: join(bin, 'celetis.cmd'),
    current: join(data, 'current'),
  };
}

const foreign = (path: string) =>
  new HostError(
    `celetis: ${path} is not a file of the celetis engine; move it away, then run the install again`,
    exits.prerequisite,
  );

async function engineAt(paths: EnginePaths, revision: string, command: string): Promise<Engine | null> {
  const root = join(paths.versions, revision);
  const entry = join(root, 'engine', 'celetis');
  if (
    !fullRevision.test(revision) ||
    !(await lstat(root).catch(() => null))?.isDirectory() ||
    !(await lstat(entry).catch(() => null))?.isFile()
  )
    return null;
  return { root, entry, revision, command };
}

async function content(path: string): Promise<string | null> {
  const found = await lstat(path).catch(() => null);
  if (!found) return null;
  if (!found.isFile()) throw foreign(path);
  return readFile(path, 'utf8');
}

export async function readEngine(paths = enginePaths()): Promise<Engine | null> {
  if (process.platform === 'win32') {
    const [sh, cmd, current] = await Promise.all([content(paths.link), content(paths.cmd), content(paths.current)]);
    if (sh !== null && sh !== shShim) throw foreign(paths.link);
    if (cmd !== null && cmd !== cmdShim) throw foreign(paths.cmd);
    if (current === null) return null;
    const engine = current.endsWith('\n') ? await engineAt(paths, current.slice(0, -1), paths.cmd) : null;
    if (!engine) throw foreign(paths.current);
    return sh === null || cmd === null ? null : engine;
  }
  const link = await lstat(paths.link).catch(() => null);
  if (!link) return null;
  const target = link.isSymbolicLink() ? resolve(paths.bin, await readlink(paths.link)) : '';
  const engine = await engineAt(paths, basename(dirname(dirname(target))), paths.link);
  if (!engine || engine.entry !== target) throw foreign(paths.link);
  return engine;
}

export async function installedEngine(target: string): Promise<Engine> {
  const engine = await readEngine(enginePaths());
  if (!fullRevision.test(target) || !engine || engine.revision !== target)
    throw new HostError('update: the installed engine is not the approved target; check again', exits.prerequisite);
  const source = await engineSource(engine.root);
  if (source.revision !== target || (await engineIdentity(engine.root, source)) !== target)
    throw new HostError(
      'update: the installed engine identity differs from the approved target; check again',
      exits.prerequisite,
    );
  return engine;
}

export async function engineSource(root: string): Promise<EngineSource> {
  if (!(await hasGitEntry(root))) return packageEngine(root, basename(root));
  const source = await git(['config', '--get', 'remote.origin.url'], root);
  const revision = await git(['rev-parse', '--verify', 'HEAD'], root);
  const ref = await engineBranch(root);
  if (await git(['status', '--porcelain', '--untracked-files=normal'], root))
    throw new HostError(
      `celetis: ${root} has changes that are not in a commit; commit or remove them, then run the install again`,
      exits.prerequisite,
    );
  return { kind: 'git', source, ref, revision };
}

async function engineBranch(root: string): Promise<GitEngine['ref']> {
  const branch = await run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: root });
  if (branch.code === 0) return { kind: 'branch', name: branch.stdout.trimEnd() };
  if (branch.code !== 1)
    throw new HostError(`celetis: cannot read the HEAD of ${root}: ${branch.stderr.trimEnd()}`, exits.blocked);
  throw new HostError(
    `celetis: ${root} is on no branch; check out a branch, or install a release with bunx celetis@latest install`,
    exits.prerequisite,
  );
}

async function packageEngine(root: string, name: string): Promise<PackageEngine> {
  const stamp = await readStamp(root);
  const record = await readRecord(root);
  if (
    (await hasGitEntry(root)) ||
    name !== stamp.revision ||
    (await manifestVersion(root)) !== stamp.version ||
    record.version !== stamp.version ||
    record.revision !== stamp.revision
  )
    throw new HostError(`celetis: ${root} is not a valid engine package`, exits.prerequisite);
  return {
    kind: 'package',
    source: stamp.source,
    version: stamp.version,
    revision: stamp.revision,
    integrity: record.integrity,
  };
}

export async function engineIdentity(root: string, source: EngineSource): Promise<string> {
  return source.kind === 'git'
    ? installedRevision('engine', root, source.source)
    : (await packageEngine(root, source.revision)).revision;
}

async function holds(folder: string, wanted: EngineSource): Promise<boolean> {
  if (wanted.kind === 'package') return isDeepStrictEqual(await packageEngine(folder, wanted.revision), wanted);
  return (
    isDeepStrictEqual(await engineSource(folder), wanted) && (await engineIdentity(folder, wanted)) === wanted.revision
  );
}

export const holdsEngine = (folder: string, wanted: EngineSource): Promise<boolean> =>
  holds(folder, wanted).catch((error) => {
    if (error instanceof HostError) return false;
    throw error;
  });

async function cloneEngine(from: string, wanted: GitEngine, staging: string, cwd: string): Promise<void> {
  await git(['clone', '--quiet', '--no-checkout', '--origin', 'origin', '--', from, staging], cwd, slow);
  await git(['remote', 'set-url', 'origin', wanted.source], staging, slow);
  await git(['checkout', '--quiet', '-B', wanted.ref.name, wanted.revision], staging, slow);
}

async function unpackEngine(wanted: PackageEngine, staging: string, cwd: string): Promise<void> {
  const target = await versionTarget(wanted.version);
  if (target.integrity !== wanted.integrity)
    throw new HostError(
      `celetis: the registry integrity of ${wanted.version} differs from the approved value; the engine did not change`,
      exits.prerequisite,
    );
  const { stamp, files } = await readTarget(target, cwd);
  if (stamp.revision !== wanted.revision)
    throw new HostError(
      `celetis: the package ${wanted.version} holds revision ${stamp.revision}, not ${wanted.revision}; the engine did not change`,
      exits.prerequisite,
    );
  if (!files.some(({ path, mode }) => path === 'engine/celetis' && mode === 0o755))
    throw new HostError(
      `celetis: the package ${wanted.version} has no executable engine/celetis; the engine did not change`,
      exits.prerequisite,
    );
  await writeArchive(files, staging);
}

const replace = (path: string, text: string) => writeAtomic(path, text, { mode: 0o644 });

export async function installEngine(
  from: string,
  wanted: EngineSource,
  paths = enginePaths(),
  expected?: Readonly<{ engine: Engine; source: EngineSource }>,
): Promise<Engine> {
  if (!fullRevision.test(wanted.revision))
    throw new HostError(`celetis: invalid engine revision ${wanted.revision}`, exits.internal);
  await readEngine(paths);
  await mkdir(paths.versions, { recursive: true });
  return withLock(installLock(paths.data), async () => {
    const validateExpected = async () => {
      if (!expected) return;
      const installed = await readEngine(paths);
      if (!isDeepStrictEqual(installed, expected.engine))
        throw new HostError(
          'update: installed engine changed; check again and obtain a new direct user response',
          exits.prerequisite,
        );
      const source = await engineSource(expected.engine.root);
      const full = engineRefName(wanted);
      const unchanged =
        wanted.kind === 'git'
          ? await resolveRef(wanted.source, full, expected.engine.root).then(
              (remote) => source.source === wanted.source && remote.full === full && remote.target === wanted.revision,
            )
          : (await versionTarget(wanted.version)).integrity === wanted.integrity;
      if (!isDeepStrictEqual(source, expected.source) || source.revision !== expected.engine.revision || !unchanged)
        throw new HostError(
          'update: engine source, ref, or target changed; check again and obtain a new decision',
          exits.prerequisite,
        );
    };
    await validateExpected();
    if (wanted.kind === 'package') await checkReleaseTag(wanted, paths.versions);
    for (const name of await readdir(paths.versions))
      if (name.startsWith('.')) await rm(join(paths.versions, name), { recursive: true, force: true });
    const root = join(paths.versions, wanted.revision);
    if (await lstat(root).catch(() => null)) {
      if (!(await holdsEngine(root, wanted)))
        throw new HostError(
          `celetis: ${root} holds another engine; remove it, then run the install again`,
          exits.prerequisite,
        );
    } else {
      const staging = join(paths.versions, `.${wanted.revision}.${randomUUID()}`);
      try {
        if (wanted.kind === 'git') await cloneEngine(from, wanted, staging, paths.versions);
        else await unpackEngine(wanted, staging, paths.versions);
        if ((await lstat(join(staging, 'engine', 'celetis')).catch(() => null))?.isFile()) {
          const dependencies = await installDependencies(staging, 'user');
          if (dependencies.kind === 'no-lock')
            throw new HostError(
              `celetis: revision ${wanted.revision} has no engine/bun.lock file; the engine did not change`,
              exits.prerequisite,
            );
          if (dependencies.kind === 'failed') {
            process.stderr.write(dependencies.output);
            throw new HostError(
              `celetis: bun install --frozen-lockfile --production --ignore-scripts failed in engine/ of revision ${wanted.revision} with status ${dependencies.status}; the engine did not change`,
              exits.blocked,
            );
          }
        }
        if (wanted.kind === 'package')
          await writeRecord(staging, {
            version: wanted.version,
            revision: wanted.revision,
            integrity: wanted.integrity,
          });
        if (!(await holds(staging, wanted)))
          throw new HostError(
            `celetis: the staged engine is not ${wanted.source} ${engineRefName(wanted)} at ${wanted.revision}`,
            exits.blocked,
          );
        await rename(staging, root);
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    }
    if (!(await lstat(join(root, 'engine', 'celetis')).catch(() => null))?.isFile())
      throw new HostError(
        `celetis: revision ${wanted.revision} has no engine/celetis file; the engine did not change`,
        exits.prerequisite,
      );
    await validateExpected();
    await mkdir(paths.bin, { recursive: true });
    if (process.platform === 'win32') {
      await replace(paths.current, `${wanted.revision}\n`);
      if (!(await lstat(paths.link).catch(() => null))) await replace(paths.link, shShim);
      if (!(await lstat(paths.cmd).catch(() => null))) await replace(paths.cmd, cmdShim);
    } else {
      const temporary = join(paths.bin, `.celetis.${randomUUID()}`);
      try {
        await symlink(join(root, 'engine', 'celetis'), temporary);
        await rename(temporary, paths.link);
      } finally {
        await rm(temporary, { force: true });
      }
    }
    const now = new Date();
    await utimes(root, now, now);
    const folders: { name: string; time: number }[] = [];
    for (const name of await readdir(paths.versions))
      if (fullRevision.test(name)) folders.push({ name, time: (await lstat(join(paths.versions, name))).mtimeMs });
    folders.sort((one, two) => two.time - one.time);
    const versions = await realpath(paths.versions);
    const running = resolve(import.meta.dir, '../../..');
    const daemons = folders.length > 3 ? await liveRevisions() : null;
    if (daemons)
      for (const { name } of folders.slice(3))
        if (name !== wanted.revision && join(versions, name) !== running && !daemons.has(name)) {
          // A running engine reads only the entry of its version folder, so that folder must be complete or absent.
          const renamed = join(paths.versions, `.${name}.${randomUUID()}`);
          await rename(join(paths.versions, name), renamed);
          await rm(renamed, { recursive: true, force: true });
        }
    const engine = await readEngine(paths);
    if (!engine) throw new HostError(`celetis: the install did not make ${paths.link}`, exits.blocked);
    return engine;
  });
}
