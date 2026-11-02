import { randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync } from 'node:fs';
import { lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type CaptureRequest,
  captureChanges,
  completedReview,
  digest,
  hash,
  ignorePath,
  indexPath,
  journalPath,
  LessonError,
  type LessonSnapshot,
  lessonFile,
  lessonsPath,
  object,
  parseLesson,
  pendingPath,
  type ReviewRequest,
  type ReviewSnapshot,
  reviewSnapshot,
  type StoreResult,
  stable,
  storePath,
  uuid,
  validateCapture,
  validateReviewRequest,
  validateReviewSnapshot,
  validateStore,
} from './lesson-record.ts';
import { type CheckoutIdentity, locateCheckouts } from './operation.ts';
import { privateFolder, privateMode, privateRoot } from './private-folder.ts';
import { run } from './process.ts';
import { tryFlock } from './update-lock.ts';
import { openLockFile } from './windows.ts';

export type LessonStore = { root: string; files: Map<string, string> };
type Change = {
  path: string;
  before: string | null;
  after: string | null;
  beforeDigest: string | null;
  afterDigest: string | null;
  mode: number;
};
type Transaction = { schema: 1; id: string; kind: 'capture' | 'review'; changes: Change[] };
const temporary = /^\.celetis-lessons-[0-9a-f-]{36}\.tmp$/;
const lockFolder = join(privateRoot, 'lessons');

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}
function blocked(path: string, error: unknown): never {
  if (error instanceof LessonError) throw error;
  throw new LessonError(6, path, message(error));
}
async function stat(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (missing(error)) return null;
    blocked(path, error);
  }
}
async function directory(path: string, create = false, mode = 0o755): Promise<boolean> {
  let current = await stat(path);
  if (!current && create) {
    try {
      await mkdir(path, { mode });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') blocked(path, error);
    }
    current = await stat(path);
  }
  if (!current) return false;
  if (!current.isDirectory() || current.isSymbolicLink())
    throw new LessonError(6, path, 'need a directory without a symlink');
  return true;
}
async function parents(root: string, path: string, create = false): Promise<boolean> {
  if (!(await directory(root))) throw new LessonError(6, root, 'checkout is unavailable');
  let at = root;
  for (const part of path.split('/').slice(0, -1)) {
    at = join(at, part);
    if (!(await directory(at, create, at.includes(`${join(root, pendingPath)}`) ? 0o700 : 0o755))) return false;
  }
  return true;
}
export async function readLessonFile(root: string, path: string): Promise<string | null> {
  const full = join(root, path);
  if (!(await parents(root, path))) return null;
  const before = await stat(full);
  if (!before) return null;
  if (!before.isFile() || before.isSymbolicLink())
    throw new LessonError(6, full, 'need a regular file without a symlink');
  try {
    const handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino)
        throw new LessonError(6, full, 'file identity changed during open');
      const bytes = await handle.readFile();
      await parents(root, path);
      const after = await stat(full);
      if (after?.dev !== opened.dev || after?.ino !== opened.ino)
        throw new LessonError(6, full, 'file identity changed during read');
      try {
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        throw new LessonError(path === journalPath ? 6 : 2, full, 'invalid UTF-8');
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    blocked(full, error);
  }
}
async function scan(root: string, pending: boolean): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const folders = [lessonsPath, ...(pending ? [pendingPath, `${pendingPath}/_rejected`] : [])];
  for (const folder of folders) {
    if (!(await parents(root, `${folder}/placeholder`)) || !(await directory(join(root, folder)))) continue;
    let names: string[];
    try {
      names = await readdir(join(root, folder));
    } catch (error) {
      blocked(join(root, folder), error);
    }
    for (const name of names.sort()) {
      if ((folder === lessonsPath && name === '_pending') || (folder === pendingPath && name === '_rejected')) continue;
      const path = `${folder}/${name}`;
      if (path === journalPath) {
        await readLessonFile(root, path);
        continue;
      }
      if (temporary.test(name)) {
        await parents(root, path);
        const leaf = await stat(join(root, path));
        if (!leaf?.isFile() || leaf.isSymbolicLink())
          throw new LessonError(6, join(root, path), 'need a regular temporary file without a symlink');
        continue;
      }
      if (!storePath(path)) {
        if (name.startsWith('.')) continue;
        throw new LessonError(2, join(root, path), 'unrecognized lesson store file; review it explicitly');
      }
      const text = await readLessonFile(root, path);
      if (text === null) throw new LessonError(6, join(root, path), 'file disappeared during read');
      files.set(path, text);
    }
  }
  return files;
}
async function identity(cwd: string): Promise<CheckoutIdentity & { main: string; active: string; common: string }> {
  try {
    const result = await locateCheckouts(cwd);
    if (!result.main || !result.active || !result.common)
      throw new LessonError(6, cwd, 'need the current Git checkout and its main checkout');
    for (const path of [result.main, result.active, result.common])
      if (!(await directory(path))) throw new LessonError(6, path, 'checkout or common Git directory is unavailable');
    return { ...result, main: result.main, active: result.active, common: result.common };
  } catch (error) {
    blocked(cwd, error);
  }
}
function lockFailure(path: string, reason: string): LessonError {
  return new LessonError(6, path, reason);
}
async function lockFolders(): Promise<void> {
  await privateFolder(privateRoot, lockFailure);
  await privateFolder(lockFolder, lockFailure);
}
function tryLessonLock(fd: number, path: string): boolean {
  try {
    return tryFlock(fd);
  } catch {
    throw new LessonError(6, path, 'cannot acquire the lesson lock');
  }
}
async function withLock<T>(common: string, act: () => Promise<T>): Promise<T> {
  const path = join(lockFolder, `${hash(common)}.lock`);
  await lockFolders();
  const previous = await stat(path);
  if (previous && (!previous.isFile() || previous.isSymbolicLink()))
    throw new LessonError(6, path, 'need a regular lock file without a symlink');
  let fd: number;
  try {
    fd =
      process.platform === 'win32'
        ? openLockFile(path)
        : openSync(path, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  } catch (error) {
    blocked(path, error);
  }
  try {
    const opened = fstatSync(fd);
    if (
      !opened.isFile() ||
      (previous && (previous.dev !== opened.dev || previous.ino !== opened.ino)) ||
      !privateMode(opened)
    )
      throw new LessonError(6, path, 'need a private regular lock file owned by the current user');
    const deadline = performance.now() + 10_000;
    while (!tryLessonLock(fd, path)) {
      if (performance.now() >= deadline) throw new LessonError(3, path, 'busy: timed out waiting for the lesson lock');
      await Bun.sleep(25);
    }
    await lockFolders();
    const current = await stat(path);
    if (!current?.isFile() || current.dev !== opened.dev || current.ino !== opened.ino)
      throw new LessonError(6, path, 'lock identity changed');
    return await act();
  } finally {
    closeSync(fd);
  }
}
async function requireComplete(root: string): Promise<void> {
  if ((await readLessonFile(root, journalPath)) !== null)
    throw new LessonError(6, join(root, journalPath), 'incomplete transaction; run lesson-store recover');
}
async function withLessonFiles<T>(cwd: string, act: (store: LessonStore) => Promise<T>): Promise<T> {
  const checkout = await identity(cwd);
  return withLock(checkout.common, async () => {
    await requireComplete(checkout.main);
    const files = await scan(checkout.main, true);
    return act({ root: checkout.main, files });
  });
}
export async function withLessonStore<T>(cwd: string, act: (store: LessonStore) => Promise<T>): Promise<T> {
  return withLessonFiles(cwd, async (store) => {
    validateStore(store.files);
    return act(store);
  });
}
function snapshot(root: string, files: Map<string, string>): LessonSnapshot {
  const result: LessonSnapshot = { schema: 1, root, active: [], history: [], pending: [], files: {} };
  for (const [path, content] of files) {
    const digest = hash(content);
    result.files[path] = { content, digest };
    const kind = lessonFile(path);
    if (!kind) continue;
    const lesson = parseLesson(content, path);
    const entry = { ...lesson, path, digest };
    if (kind === 'pending') result.pending.push(entry);
    else if (lesson.status === 'active') result.active.push(entry);
    else result.history.push(entry);
  }
  return result;
}
export async function readLessons(cwd: string, scope: 'main' | 'active'): Promise<LessonSnapshot> {
  const checkout = await identity(cwd);
  if (scope === 'main' || checkout.active === checkout.main)
    return withLock(checkout.common, async () => {
      await requireComplete(checkout.main);
      const files = await scan(checkout.main, scope === 'main');
      validateStore(files, scope === 'main');
      return snapshot(checkout.main, files);
    });
  const files = await scan(checkout.active, false);
  validateStore(files, false);
  return snapshot(checkout.active, files);
}
async function replace(root: string, path: string, text: string, mode: number): Promise<void> {
  const full = join(root, path);
  await parents(root, path, true);
  await readLessonFile(root, path);
  const temp = `${path.slice(0, path.lastIndexOf('/') + 1)}.celetis-lessons-${randomUUID()}.tmp`;
  const tempFull = join(root, temp);
  let created = false;
  try {
    const handle = await open(
      tempFull,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      mode,
    );
    created = true;
    try {
      const opened = await handle.stat();
      if (!opened.isFile()) throw new LessonError(6, tempFull, 'need a regular temporary file');
      await handle.chmod(mode);
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await parents(root, path);
    await readLessonFile(root, path);
    await readLessonFile(root, temp);
    await rename(tempFull, full);
    created = false;
  } catch (error) {
    blocked(full, error);
  } finally {
    if (created) {
      await parents(root, temp);
      await unlink(tempFull).catch((error: unknown) => {
        if (!missing(error)) blocked(tempFull, error);
      });
    }
  }
}
function transaction(value: unknown, path: string): Transaction {
  const row = object(value, path, ['schema', 'id', 'kind', 'changes']);
  if (
    row.schema !== 1 ||
    (row.kind !== 'capture' && row.kind !== 'review') ||
    !Array.isArray(row.changes) ||
    !row.changes.length
  )
    throw new LessonError(6, path, 'invalid transaction');
  const id = uuid(row.id, `${path}.id`);
  const seen = new Set<string>();
  const changes = row.changes.map((value: unknown): Change => {
    const item = object(value, path, ['path', 'before', 'after', 'beforeDigest', 'afterDigest', 'mode']);
    if (typeof item.path !== 'string' || !storePath(item.path) || item.path === ignorePath || seen.has(item.path))
      throw new LessonError(6, path, 'invalid or duplicate transaction destination');
    seen.add(item.path);
    if (
      (item.before !== null && typeof item.before !== 'string') ||
      (item.after !== null && typeof item.after !== 'string') ||
      item.before === item.after ||
      item.beforeDigest !== (item.before === null ? null : hash(item.before)) ||
      item.afterDigest !== (item.after === null ? null : hash(item.after)) ||
      typeof item.mode !== 'number' ||
      !Number.isInteger(item.mode) ||
      item.mode < 0 ||
      item.mode > 0o777
    )
      throw new LessonError(6, path, `invalid bytes, digests, or mode for ${item.path}`);
    if (
      row.kind === 'capture' &&
      (item.path === indexPath ||
        lessonFile(item.path) === 'live' ||
        lessonFile(item.path) === 'rejected' ||
        item.after === null)
    )
      throw new LessonError(6, path, 'capture transaction can only write pending proposals');
    return {
      path: item.path,
      before: item.before,
      after: item.after,
      beforeDigest: item.beforeDigest as string | null,
      afterDigest: item.afterDigest as string | null,
      mode: item.mode,
    };
  });
  return { schema: 1, id, kind: row.kind, changes };
}
async function requireUntrackedPending(root: string): Promise<void> {
  const result = await run('git', ['ls-files', '-z', '--', pendingPath], { cwd: root });
  if (result.code !== 0)
    throw new LessonError(
      6,
      join(root, pendingPath),
      `cannot check Git tracking: ${result.stderr.trim() || `git exited ${result.code}`}`,
    );
  const tracked = result.stdout.split('\0')[0];
  if (tracked)
    throw new LessonError(
      6,
      join(root, tracked),
      'pending path is tracked by Git; review its tracking explicitly before a lesson write',
    );
}
async function finish(root: string, journal: Transaction): Promise<void> {
  await requireUntrackedPending(root);
  const files = await scan(root, true);
  if (!files.has(ignorePath))
    throw new LessonError(6, join(root, ignorePath), 'recovery requires the pending ignore file');
  for (const change of journal.changes) {
    const actual = files.get(change.path) ?? null;
    if (actual !== change.before && actual !== change.after)
      throw new LessonError(6, join(root, change.path), 'recovery conflict: bytes match neither before nor after');
    if (change.after === null) files.delete(change.path);
    else files.set(change.path, change.after);
  }
  validateStore(files);
  for (const change of [
    ...journal.changes.filter((item) => item.after !== null),
    ...journal.changes.filter((item) => item.after === null),
  ]) {
    const actual = await readLessonFile(root, change.path);
    if (actual !== change.before && actual !== change.after)
      throw new LessonError(6, join(root, change.path), 'recovery conflict: target changed');
    if (actual === change.after) continue;
    if (change.after !== null) await replace(root, change.path, change.after, change.mode);
    else {
      await parents(root, change.path);
      try {
        await unlink(join(root, change.path));
      } catch (error) {
        blocked(join(root, change.path), error);
      }
    }
  }
  const completed = await scan(root, true);
  validateStore(completed);
  for (const change of journal.changes)
    if ((completed.get(change.path) ?? null) !== change.after)
      throw new LessonError(6, join(root, change.path), 'transaction did not reach its after-state');
  await parents(root, journalPath);
  await readLessonFile(root, journalPath);
  try {
    await unlink(join(root, journalPath));
  } catch (error) {
    blocked(join(root, journalPath), error);
  }
}
export async function commitLessons(
  store: LessonStore,
  after: ReadonlyMap<string, string>,
  kind: 'capture' | 'review',
): Promise<string[]> {
  const proposed = new Map(after);
  const oldIgnore = store.files.get(ignorePath);
  if (oldIgnore !== undefined && proposed.get(ignorePath) !== oldIgnore)
    throw new LessonError(2, join(store.root, ignorePath), 'preserve the existing pending ignore file');
  if (
    ![...new Set([...store.files.keys(), ...proposed.keys()])].some(
      (path) => store.files.get(path) !== proposed.get(path),
    )
  ) {
    validateStore(proposed);
    return [];
  }
  proposed.set(ignorePath, oldIgnore ?? '*\n');
  validateStore(proposed);
  await requireUntrackedPending(store.root);
  after = proposed;
  const infrastructure: string[] = [];
  if (oldIgnore === undefined && proposed.has(ignorePath)) {
    if ((await readLessonFile(store.root, ignorePath)) !== null)
      throw new LessonError(3, join(store.root, ignorePath), 'stale: pending ignore file changed');
    await replace(store.root, ignorePath, '*\n', 0o600);
    store.files.set(ignorePath, '*\n');
    infrastructure.push(ignorePath);
  }
  const changes: Change[] = [];
  for (const path of [...new Set([...store.files.keys(), ...after.keys()])].sort()) {
    if (!storePath(path)) throw new LessonError(2, join(store.root, path), 'invalid store destination');
    const before = store.files.get(path) ?? null;
    const content = after.get(path) ?? null;
    if (before === content) continue;
    if ((await readLessonFile(store.root, path)) !== before)
      throw new LessonError(3, join(store.root, path), 'stale: target changed');
    const current = await stat(join(store.root, path));
    changes.push({
      path,
      before,
      after: content,
      beforeDigest: before === null ? null : hash(before),
      afterDigest: content === null ? null : hash(content),
      mode: current ? current.mode & 0o777 : path.startsWith(`${pendingPath}/`) ? 0o600 : 0o644,
    });
  }
  if (!changes.length) return infrastructure;
  const journal = transaction({ schema: 1, id: randomUUID(), kind, changes }, join(store.root, journalPath));
  await requireComplete(store.root);
  await replace(store.root, journalPath, `${JSON.stringify(journal)}\n`, 0o600);
  await finish(store.root, journal);
  return [...infrastructure, ...changes.map((change) => change.path)];
}
export async function captureLesson(cwd: string, input: CaptureRequest): Promise<StoreResult> {
  input = validateCapture(input, 'capture');
  return withLessonStore(cwd, async (store) => {
    const after = captureChanges(store.files, input);
    if (after === null) return { schema: 1, status: 'unchanged', root: store.root, paths: [] };
    const paths = await commitLessons(store, after, 'capture');
    return { schema: 1, status: 'saved', root: store.root, paths };
  });
}
export async function previewLessonReview(cwd: string, input: ReviewRequest): Promise<ReviewSnapshot> {
  input = validateReviewRequest(input, 'review');
  return withLessonStore(cwd, async (store) => reviewSnapshot(store.root, store.files, input));
}
export async function applyLessonReview(
  cwd: string,
  snapshot: ReviewSnapshot,
  approvedDigest: string,
): Promise<StoreResult> {
  snapshot = validateReviewSnapshot(snapshot, 'snapshot');
  digest(approvedDigest, 'approved digest');
  const { digest: snapshotDigest, ...content } = snapshot;
  if (approvedDigest !== snapshotDigest || snapshotDigest !== hash(stable(content)))
    throw new LessonError(3, 'snapshot', 'stale: displayed snapshot digest changed');
  const before = new Map<string, string>();
  for (const [path, text] of Object.entries(snapshot.before)) if (text !== null) before.set(path, text);
  try {
    validateStore(before);
    if (stable(reviewSnapshot(snapshot.root, before, snapshot.request)) !== stable(snapshot))
      throw new LessonError(3, 'snapshot', 'stale: review result or watched paths changed');
  } catch (error) {
    if (error instanceof LessonError && error.code === 2)
      throw new LessonError(3, 'snapshot', `stale: review transition changed: ${error.message}`);
    throw error;
  }
  return withLessonFiles(cwd, async (store) => {
    if (store.root !== snapshot.root) throw new LessonError(3, snapshot.root, 'stale: main checkout changed');
    const changed = [...new Set([...store.files.keys(), ...Object.keys(snapshot.watched)])].find((path) => {
      const actual = store.files.get(path);
      return (actual === undefined ? null : hash(actual)) !== snapshot.watched[path];
    });
    try {
      validateStore(store.files);
    } catch (error) {
      if (changed && error instanceof LessonError && error.code === 2)
        throw new LessonError(3, join(store.root, changed), `stale: reviewed input changed: ${error.message}`);
      throw error;
    }
    if (completedReview(store.files, snapshot.request)) {
      return { schema: 1, status: 'unchanged', root: store.root, paths: [] };
    }
    if (changed) throw new LessonError(3, join(store.root, changed), 'stale: reviewed input changed');
    const after = new Map<string, string>();
    for (const [path, text] of Object.entries(snapshot.after)) if (text !== null) after.set(path, text);
    const paths = await commitLessons(store, after, 'review');
    return { schema: 1, status: 'applied', root: store.root, paths };
  });
}
export async function recoverLessons(cwd: string): Promise<StoreResult> {
  const checkout = await identity(cwd);
  return withLock(checkout.common, async () => {
    const text = await readLessonFile(checkout.main, journalPath);
    if (text === null) {
      validateStore(await scan(checkout.main, true));
      return { schema: 1, status: 'unchanged', root: checkout.main, paths: [] };
    }
    let journal: Transaction;
    try {
      journal = transaction(JSON.parse(text) as unknown, join(checkout.main, journalPath));
    } catch (error) {
      throw new LessonError(6, join(checkout.main, journalPath), `invalid recovery journal: ${message(error)}`);
    }
    try {
      await finish(checkout.main, journal);
    } catch (error) {
      if (error instanceof LessonError && error.code === 2)
        throw new LessonError(6, join(checkout.main, journalPath), `invalid recovery state: ${error.message}`);
      throw error;
    }
    return { schema: 1, status: 'recovered', root: checkout.main, paths: journal.changes.map((change) => change.path) };
  });
}
