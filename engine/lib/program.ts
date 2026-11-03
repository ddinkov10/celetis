import { randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { HostError } from './host.ts';
import { revision as fullRevision, git, installedRevision } from './plugin-metadata.ts';
import { run } from './process.ts';
import { tryFlock } from './update-lock.ts';

export type ProgramPaths = Readonly<{
  data: string;
  versions: string;
  bin: string;
  link: string;
  cmd: string;
  current: string;
}>;
export type Program = Readonly<{ root: string; entry: string; revision: string; command: string }>;
export type ProgramSource = Readonly<{ source: string; branch: string; revision: string }>;

const shShim = [
  '#!/bin/sh',
  `base="\${CELETIS_HOME:-$USERPROFILE}"`,
  'read -r revision < "$base/.local/share/celetis/current" || exit 1',
  String.raw`exec env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install '--config=\\.\nul' --no-macros "$base/.local/share/celetis/versions/$revision/celetis" "$@"`,
  '',
].join('\n');

const cmdShim = [
  '@echo off',
  'setlocal',
  'if not defined CELETIS_HOME set "CELETIS_HOME=%USERPROFILE%"',
  String.raw`set /p revision=<"%CELETIS_HOME%\.local\share\celetis\current"`,
  'set BUN_RUNTIME_TRANSPILER_CACHE_PATH=0',
  'set DO_NOT_TRACK=1',
  String.raw`bun --no-env-file --no-install --config=\\.\nul --no-macros "%CELETIS_HOME%\.local\share\celetis\versions\%revision%\celetis" %*`,
  'exit /b %errorlevel%',
  '',
].join('\r\n');

const slow: typeof run = (file, args, options) =>
  run(file, args, { ...options, timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });

export async function programRevision(root: string): Promise<string> {
  const result = await run('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
  return result.stdout.trimEnd();
}

export function celetisBase(): string {
  const selected = process.env.CELETIS_HOME;
  if (selected && !isAbsolute(selected))
    throw new HostError(`celetis: CELETIS_HOME must be an absolute path: ${selected}`, 2);
  return selected || homedir();
}

export function programPaths(base = celetisBase()): ProgramPaths {
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
  new HostError(`celetis: ${path} is not a file of the celetis program; move it away, then run the install again`);

async function programAt(paths: ProgramPaths, revision: string, command: string): Promise<Program | null> {
  const root = join(paths.versions, revision);
  const entry = join(root, 'celetis');
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

export async function readProgram(paths = programPaths()): Promise<Program | null> {
  if (process.platform === 'win32') {
    const [sh, cmd, current] = await Promise.all([content(paths.link), content(paths.cmd), content(paths.current)]);
    if (sh !== null && sh !== shShim) throw foreign(paths.link);
    if (cmd !== null && cmd !== cmdShim) throw foreign(paths.cmd);
    if (current === null) return null;
    const program = current.endsWith('\n') ? await programAt(paths, current.slice(0, -1), paths.cmd) : null;
    if (!program) throw foreign(paths.current);
    return sh === null || cmd === null ? null : program;
  }
  const link = await lstat(paths.link).catch(() => null);
  if (!link) return null;
  const target = link.isSymbolicLink() ? resolve(paths.bin, await readlink(paths.link)) : '';
  const program = await programAt(paths, basename(dirname(target)), paths.link);
  if (!program || program.entry !== target) throw foreign(paths.link);
  return program;
}

export async function programSource(root: string): Promise<ProgramSource> {
  const source = await git(['config', '--get', 'remote.origin.url'], root);
  const branch = await git(['symbolic-ref', '--short', 'HEAD'], root);
  const revision = await git(['rev-parse', '--verify', 'HEAD'], root);
  if (await git(['status', '--porcelain', '--untracked-files=normal'], root))
    throw new HostError(
      `celetis: ${root} has changes that are not in a commit; commit or remove them, then run the install again`,
    );
  return { source, branch, revision };
}

async function holds(folder: string, wanted: ProgramSource): Promise<boolean> {
  const found = await programSource(folder);
  return (
    found.source === wanted.source &&
    found.branch === wanted.branch &&
    found.revision === wanted.revision &&
    (await installedRevision('program', folder, wanted.source)) === wanted.revision
  );
}

async function replace(path: string, text: string): Promise<void> {
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}`);
  try {
    await writeFile(temporary, text, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function installProgram(
  from: string,
  wanted: ProgramSource,
  paths = programPaths(),
  expected?: Program,
): Promise<Program> {
  if (!fullRevision.test(wanted.revision)) throw new HostError(`celetis: invalid program revision ${wanted.revision}`);
  await readProgram(paths);
  await mkdir(paths.versions, { recursive: true });
  const lock = openSync(join(paths.data, 'install.lock'), 'a+', 0o600);
  try {
    if (!tryFlock(lock))
      throw new HostError('celetis: another celetis install or update runs; try again after it ends');
    const validateExpected = async () => {
      if (!expected) return;
      const installed = await readProgram(paths);
      if (!isDeepStrictEqual(installed, expected))
        throw new HostError('update: installed program changed; check again and obtain a new direct user response');
      const source = await programSource(expected.root);
      const remote = await git(['ls-remote', '--', wanted.source, `refs/heads/${wanted.branch}`], expected.root);
      if (
        source.source !== wanted.source ||
        source.branch !== wanted.branch ||
        source.revision !== expected.revision ||
        remote !== `${wanted.revision}\trefs/heads/${wanted.branch}`
      )
        throw new HostError('update: program source, ref, or target changed; check again and obtain a new decision');
    };
    await validateExpected();
    for (const name of await readdir(paths.versions))
      if (name.startsWith('.')) await rm(join(paths.versions, name), { recursive: true, force: true });
    const root = join(paths.versions, wanted.revision);
    if (await lstat(root).catch(() => null)) {
      const same = await holds(root, wanted).catch((error) => {
        if (error instanceof HostError) return false;
        throw error;
      });
      if (!same) throw new HostError(`celetis: ${root} holds another program; remove it, then run the install again`);
    } else {
      const staging = join(paths.versions, `.${wanted.revision}.${randomUUID()}`);
      try {
        await git(
          ['clone', '--quiet', '--no-checkout', '--origin', 'origin', '--', from, staging],
          paths.versions,
          slow,
        );
        await git(['remote', 'set-url', 'origin', wanted.source], staging, slow);
        await git(['checkout', '--quiet', '-B', wanted.branch, wanted.revision], staging, slow);
        if (!(await holds(staging, wanted)))
          throw new HostError(
            `celetis: the clone of ${from} is not ${wanted.source} ${wanted.branch} at ${wanted.revision}`,
          );
        await rename(staging, root);
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    }
    if (!(await lstat(join(root, 'celetis')).catch(() => null))?.isFile())
      throw new HostError(
        `celetis: revision ${wanted.revision} has no celetis program file; the program did not change`,
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
        await symlink(join(root, 'celetis'), temporary);
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
    const running = resolve(import.meta.dir, '../..');
    for (const { name } of folders.slice(3))
      if (name !== wanted.revision && join(versions, name) !== running)
        await rm(join(paths.versions, name), { recursive: true, force: true });
    const program = await readProgram(paths);
    if (!program) throw new HostError(`celetis: the install did not make ${paths.link}`);
    return program;
  } finally {
    closeSync(lock);
  }
}
