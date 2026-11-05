import { createHash, randomUUID } from 'node:crypto';
import { type BigIntStats, constants } from 'node:fs';
import { type FileHandle, link, lstat, open, readdir, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { privateMode, sharedMode } from './private-folder.ts';
import { processStart, processState } from './process-identity.ts';

export interface LocalRecord {
  readonly path: string;
  readonly bytes: Buffer;
  readonly value: unknown;
  readonly stat: BigIntStats;
  readonly directories: readonly { path: string; stat: BigIntStats }[];
}

const startToken = (start: string) => createHash('sha256').update(start).digest('hex').slice(0, 16);
const privacyOf = new WeakMap<LocalRecord, 'shared' | 'private'>();
const identity = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino;
const properties = (a: BigIntStats, b: BigIntStats) =>
  identity(a, b) && a.uid === b.uid && a.gid === b.gid && a.mode === b.mode && a.nlink === b.nlink;
const safeMode = (stat: BigIntStats, privacy: 'shared' | 'private') =>
  (privacy === 'shared' ? sharedMode : privateMode)({ uid: Number(stat.uid), mode: Number(stat.mode) });
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));
const fail = (path: string, cause: string) => new Error(`state migration: ${path}: ${cause}`);

async function statAt(path: string): Promise<BigIntStats | null> {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function regular(path: string, stat: BigIntStats, links = 1n): void {
  if (!stat.isFile() || stat.nlink !== links || !safeMode(stat, 'private'))
    throw fail(path, 'unsafe storage; need a private regular file owned by the current user with no extra links');
}

async function directoriesAt(paths: readonly string[], privacy: 'shared' | 'private') {
  const result: { path: string; stat: BigIntStats }[] = [];
  for (const path of paths) {
    const stat = await statAt(path);
    if (!stat) return null;
    if (!stat.isDirectory() || !safeMode(stat, privacy))
      throw fail(path, `unsafe storage; need an owner-safe ${privacy} directory`);
    result.push({ path, stat });
  }
  return result;
}

async function checkDirectories(source: LocalRecord): Promise<void> {
  const privacy = privacyOf.get(source);
  if (!privacy) throw fail(source.path, 'snapshot was not produced by readLocalRecord');
  const current = await directoriesAt(
    source.directories.map((entry) => entry.path),
    privacy,
  );
  if (
    !current ||
    current.some((entry, index) => {
      const previous = source.directories[index];
      return (
        !previous ||
        !identity(entry.stat, previous.stat) ||
        entry.stat.mode !== previous.stat.mode ||
        entry.stat.uid !== previous.stat.uid ||
        entry.stat.gid !== previous.stat.gid
      );
    })
  )
    throw fail(source.path, 'unsafe storage; a directory changed during migration');
}

async function openRecord(path: string, links = 1n) {
  const before = await statAt(path);
  if (!before) throw fail(path, 'the record is missing');
  regular(path, before, links);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat({ bigint: true });
    regular(path, stat, links);
    if (!properties(before, stat)) throw fail(path, 'the record changed during open');
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const current = await statAt(path);
    if (
      !current ||
      !properties(stat, current) ||
      !properties(stat, after) ||
      stat.size !== after.size ||
      stat.mtimeNs !== after.mtimeNs ||
      stat.ctimeNs !== after.ctimeNs
    )
      throw fail(path, 'the record changed during the read');
    return { handle, stat: after, bytes };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export async function readLocalRecord(
  file: string,
  directories: readonly string[],
  privacy: 'shared' | 'private',
): Promise<LocalRecord | null> {
  try {
    const checked = await directoriesAt(directories, privacy);
    if (!checked || !(await statAt(file))) return null;
    const opened = await openRecord(file);
    try {
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(opened.bytes));
      const source: LocalRecord = { path: file, bytes: opened.bytes, value, stat: opened.stat, directories: checked };
      privacyOf.set(source, privacy);
      await checkDirectories(source);
      return source;
    } finally {
      await opened.handle.close();
    }
  } catch (error) {
    throw fail(file, reason(error));
  }
}

async function checkRecord(path: string, handle: FileHandle, expected: BigIntStats, bytes: Buffer): Promise<void> {
  const held = await handle.stat({ bigint: true });
  regular(path, held);
  if (!properties(held, expected)) throw fail(path, 'the opened record changed during migration');
  const current = await openRecord(path);
  try {
    if (!properties(current.stat, expected) || !current.bytes.equals(bytes))
      throw fail(path, 'the record identity or content changed during migration');
  } finally {
    await current.handle.close();
  }
}

type Temporary = { path: string; stat: BigIntStats };

async function removeTemporary(temp: Temporary, source: LocalRecord, archive?: string): Promise<void> {
  await checkDirectories(source);
  const current = await statAt(temp.path);
  if (!current) return;
  if (!identity(current, temp.stat) || !current.isFile() || !safeMode(current, 'private'))
    throw fail(temp.path, 'cleanup cannot establish temporary-file identity; preserved');
  if (current.nlink !== 1n) {
    const retained = archive ? await statAt(archive) : null;
    if (current.nlink !== 2n || !retained || !identity(current, retained))
      throw fail(temp.path, 'cleanup cannot establish the additional link; preserved');
  }
  await unlink(temp.path);
}

async function recoverTemporaries(source: LocalRecord, prefix: string, archive: string, target: Buffer): Promise<void> {
  for (const name of await readdir(dirname(source.path))) {
    if (!name.startsWith(prefix)) continue;
    const path = join(dirname(source.path), name);
    const fields = /^([a-z0-9]+)\.([a-f0-9]{16})\.([A-Za-z0-9_-]{22})\.(a|t)$/.exec(name.slice(prefix.length));
    if (!fields) throw fail(path, 'uncertain migration fragment; preserved');
    const pid = Number.parseInt(fields[1] as string, 36);
    const start = await processStart(pid);
    const state = start && startToken(start) !== fields[2] ? 'gone' : await processState(pid, start);
    if (!Number.isSafeInteger(pid) || pid < 1 || state !== 'gone')
      throw fail(path, 'cannot establish an interrupted migration owner; preserved');
    const stat = await statAt(path);
    if (!stat?.isFile() || !safeMode(stat, 'private')) throw fail(path, 'unsafe migration fragment; preserved');
    if (stat.nlink !== 1n) {
      if (fields[4] !== 'a') throw fail(path, 'uncertain linked migration fragment; preserved');
      const retained = await statAt(archive);
      if (stat.nlink !== 2n || !retained || !identity(stat, retained))
        throw fail(path, 'uncertain archive alias; preserved');
    }
    const opened = await openRecord(path, stat.nlink);
    try {
      const expected = fields[4] === 'a' ? source.bytes : target;
      if (
        !identity(opened.stat, stat) ||
        (stat.nlink === 2n && opened.bytes.length !== expected.length) ||
        opened.bytes.length > expected.length ||
        !opened.bytes.equals(expected.subarray(0, opened.bytes.length))
      )
        throw fail(path, 'uncertain migration fragment content; preserved');
      await removeTemporary({ path, stat: opened.stat }, source, archive);
    } finally {
      await opened.handle.close();
    }
  }
}

async function writeTemporary(path: string, bytes: Buffer, pending: Temporary[]): Promise<Temporary> {
  const handle = await open(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    const temp = { path, stat: await handle.stat({ bigint: true }) };
    pending.push(temp);
    regular(path, temp.stat);
    await handle.writeFile(bytes);
    return temp;
  } finally {
    await handle.close();
  }
}

export async function commitMigration(
  source: LocalRecord,
  sourceSchema: number,
  serializedTarget: string,
): Promise<void> {
  const pending: Temporary[] = [];
  const handles: FileHandle[] = [];
  const failures: string[] = [];
  const digest = createHash('sha256').update(source.bytes).digest('hex');
  const archive = `${source.path}.schema-${sourceSchema}.${digest}.bak`;
  const compactDigest = createHash('sha256').update(source.bytes).digest('base64url');
  const prefix = `.celetis-migrate-${basename(source.path)}.${sourceSchema}.${compactDigest}.`;
  try {
    if (!Number.isSafeInteger(sourceSchema) || sourceSchema < 1) throw new Error('invalid source schema');
    await checkDirectories(source);
    const live = await openRecord(source.path);
    handles.push(live.handle);
    if (!properties(live.stat, source.stat) || !live.bytes.equals(source.bytes))
      throw new Error('the source identity or content changed before migration');
    const targetBytes = Buffer.from(serializedTarget);
    await recoverTemporaries(source, prefix, archive, targetBytes);
    const start = await processStart(process.pid);
    if (!start) throw new Error('cannot establish migration process identity');
    const stem = join(
      dirname(source.path),
      `${prefix}${process.pid.toString(36)}.${startToken(start)}.${Buffer.from(randomUUID().replaceAll('-', ''), 'hex').toString('base64url')}`,
    );
    if (!(await statAt(archive))) {
      const temp = await writeTemporary(`${stem}.a`, source.bytes, pending);
      const written = await openRecord(temp.path);
      try {
        if (!identity(written.stat, temp.stat) || !written.bytes.equals(source.bytes))
          throw fail(temp.path, 'the archive temporary changed');
        await checkDirectories(source);
        try {
          await link(temp.path, archive);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
      } finally {
        await written.handle.close();
      }
      await removeTemporary(temp, source, archive);
      pending.splice(pending.indexOf(temp), 1);
    }
    const saved = await openRecord(archive);
    handles.push(saved.handle);
    if (!saved.bytes.equals(source.bytes)) throw fail(archive, 'conflicting source archive; preserved');
    const target = await writeTemporary(`${stem}.t`, targetBytes, pending);
    const written = await openRecord(target.path);
    handles.push(written.handle);
    if (!identity(written.stat, target.stat) || !written.bytes.equals(targetBytes))
      throw fail(target.path, 'the target temporary changed');
    await checkDirectories(source);
    await checkRecord(source.path, live.handle, source.stat, source.bytes);
    await checkRecord(archive, saved.handle, saved.stat, source.bytes);
    await checkRecord(target.path, written.handle, written.stat, targetBytes);
    await checkDirectories(source);
    await rename(target.path, source.path);
    pending.splice(pending.indexOf(target), 1);
  } catch (error) {
    failures.push(reason(error));
  } finally {
    for (const handle of handles) {
      try {
        await handle.close();
      } catch (error) {
        failures.push(`failed to close migration file: ${reason(error)}`);
      }
    }
    for (const temp of pending) {
      try {
        await removeTemporary(temp, source, archive);
      } catch (error) {
        failures.push(`temporary preserved at ${temp.path}: ${reason(error)}`);
      }
    }
  }
  if (failures.length)
    throw fail(source.path, `failed persistence from schema ${sourceSchema}: ${failures.join('; ')}`);
}
