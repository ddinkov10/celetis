import { randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync } from 'node:fs';
import { lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { exits } from './contract.ts';
import {
  type CaptureRequest,
  captureChanges,
  completedReview,
  type Decision,
  digest,
  hash,
  ignorePath,
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

export type LessonStore = { main: string; active: string; files: Map<string, string> };
type View = Pick<LessonStore, 'main' | 'active'>;
type Change = {
  path: string;
  before: string | null;
  after: string | null;
  beforeDigest: string | null;
  afterDigest: string | null;
  mode: number;
};
type Lane = { root: string; head: string };
type LaneCommit = 'committed' | 'absent' | 'moved';
type Transaction = { schema: 1; id: string; kind: 'capture' | 'review'; changes: Change[]; lane?: Lane };
const objectId = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
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
  throw new LessonError(exits.blocked, path, message(error));
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
    throw new LessonError(exits.blocked, path, 'need a directory without a symlink');
  return true;
}
async function parents(root: string, path: string, create = false): Promise<boolean> {
  if (!(await directory(root))) throw new LessonError(exits.blocked, root, 'checkout is unavailable');
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
    throw new LessonError(exits.blocked, full, 'need a regular file without a symlink');
  try {
    const handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino)
        throw new LessonError(exits.blocked, full, 'file identity changed during open');
      const bytes = await handle.readFile();
      await parents(root, path);
      const after = await stat(full);
      if (after?.dev !== opened.dev || after?.ino !== opened.ino)
        throw new LessonError(exits.blocked, full, 'file identity changed during read');
      try {
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        throw new LessonError(path === journalPath ? exits.blocked : exits.usage, full, 'invalid UTF-8');
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    blocked(full, error);
  }
}
async function scanFolder(root: string, folder: string, files: Map<string, string>): Promise<void> {
  if (!(await parents(root, `${folder}/placeholder`)) || !(await directory(join(root, folder)))) return;
  let names: string[];
  try {
    names = await readdir(join(root, folder));
  } catch (error) {
    blocked(join(root, folder), error);
  }
  for (const name of names.sort()) {
    if ((folder === lessonsPath && name === '_pending') || (folder === pendingPath && name === '_rejected')) continue;
    const path = `${folder}/${name}`;
    if (folder === lessonsPath && name === 'INDEX.md')
      throw new LessonError(
        exits.usage,
        join(root, path),
        'the lesson catalog INDEX.md is no longer used; delete this file',
      );
    if (path === journalPath) {
      await readLessonFile(root, path);
      continue;
    }
    if (temporary.test(name)) {
      await parents(root, path);
      const leaf = await stat(join(root, path));
      if (!leaf?.isFile() || leaf.isSymbolicLink())
        throw new LessonError(exits.blocked, join(root, path), 'need a regular temporary file without a symlink');
      continue;
    }
    if (!storePath(path)) {
      if (name.startsWith('.')) continue;
      throw new LessonError(exits.usage, join(root, path), 'unrecognized lesson store file; review it explicitly');
    }
    const text = await readLessonFile(root, path);
    if (text === null) throw new LessonError(exits.blocked, join(root, path), 'file disappeared during read');
    files.set(path, text);
  }
}
async function scanLive(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  await scanFolder(root, lessonsPath, files);
  return files;
}
async function scanPending(root: string, files: Map<string, string>): Promise<void> {
  await scanFolder(root, pendingPath, files);
  await scanFolder(root, `${pendingPath}/_rejected`, files);
}
async function scanStore(view: View): Promise<Map<string, string>> {
  const files = await scanLive(view.active);
  await scanPending(view.main, files);
  return files;
}
function pending(path: string): boolean {
  return path.startsWith(`${pendingPath}/`);
}
function rootOf(view: View, path: string): string {
  return pending(path) ? view.main : view.active;
}
async function identity(cwd: string): Promise<CheckoutIdentity & { main: string; active: string; common: string }> {
  try {
    const result = await locateCheckouts(cwd);
    if (!result.main || !result.active || !result.common)
      throw new LessonError(exits.blocked, cwd, 'need the current Git checkout and its main checkout');
    for (const path of [result.main, result.active, result.common])
      if (!(await directory(path)))
        throw new LessonError(exits.blocked, path, 'checkout or common Git directory is unavailable');
    return { ...result, main: result.main, active: result.active, common: result.common };
  } catch (error) {
    blocked(cwd, error);
  }
}
function lockFailure(path: string, reason: string): LessonError {
  return new LessonError(exits.blocked, path, reason);
}
async function lockFolders(): Promise<void> {
  await privateFolder(privateRoot, lockFailure);
  await privateFolder(lockFolder, lockFailure);
}
function tryLessonLock(fd: number, path: string): boolean {
  try {
    return tryFlock(fd);
  } catch {
    throw new LessonError(exits.blocked, path, 'cannot acquire the lesson lock');
  }
}
async function withLock<T>(common: string, act: () => Promise<T>, wait = 10_000): Promise<T> {
  const path = join(lockFolder, `${hash(common)}.lock`);
  await lockFolders();
  const previous = await stat(path);
  if (previous && (!previous.isFile() || previous.isSymbolicLink()))
    throw new LessonError(exits.blocked, path, 'need a regular lock file without a symlink');
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
      throw new LessonError(exits.blocked, path, 'need a private regular lock file owned by the current user');
    const deadline = performance.now() + wait;
    while (!tryLessonLock(fd, path)) {
      if (performance.now() >= deadline)
        throw new LessonError(exits.prerequisite, path, 'busy: timed out waiting for the lesson lock');
      await Bun.sleep(25);
    }
    await lockFolders();
    const current = await stat(path);
    if (!current?.isFile() || current.dev !== opened.dev || current.ino !== opened.ino)
      throw new LessonError(exits.blocked, path, 'lock identity changed');
    return await act();
  } finally {
    closeSync(fd);
  }
}
async function requireComplete(root: string): Promise<void> {
  if ((await readLessonFile(root, journalPath)) !== null)
    throw new LessonError(exits.blocked, join(root, journalPath), 'incomplete transaction; run lesson-store recover');
}
async function withLessonFiles<T>(cwd: string, act: (store: LessonStore) => Promise<T>, wait?: number): Promise<T> {
  const checkout = await identity(cwd);
  const view = { main: checkout.main, active: checkout.active };
  return withLock(
    checkout.common,
    async () => {
      await requireComplete(view.main);
      return act({ ...view, files: await scanStore(view) });
    },
    wait,
  );
}
export async function withLessonStore<T>(
  cwd: string,
  act: (store: LessonStore) => Promise<T>,
  wait?: number,
): Promise<T> {
  return withLessonFiles(
    cwd,
    async (store) => {
      validateStore(store.files);
      return act(store);
    },
    wait,
  );
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
  const { main, active, common } = await identity(cwd);
  return withLock(common, async () => {
    await requireComplete(main);
    const files = scope === 'main' ? await scanStore({ main, active }) : await scanLive(active);
    validateStore(files, scope === 'main');
    return snapshot(scope === 'main' ? main : active, files);
  });
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
      if (!opened.isFile()) throw new LessonError(exits.blocked, tempFull, 'need a regular temporary file');
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
  const row = object(value, path, ['schema', 'id', 'kind', 'changes'], ['lane']);
  if (
    row.schema !== 1 ||
    (row.kind !== 'capture' && row.kind !== 'review') ||
    !Array.isArray(row.changes) ||
    !row.changes.length
  )
    throw new LessonError(exits.blocked, path, 'invalid transaction');
  const id = uuid(row.id, `${path}.id`);
  const seen = new Set<string>();
  const changes = row.changes.map((value: unknown): Change => {
    const item = object(value, path, ['path', 'before', 'after', 'beforeDigest', 'afterDigest', 'mode']);
    if (typeof item.path !== 'string' || !storePath(item.path) || item.path === ignorePath || seen.has(item.path))
      throw new LessonError(exits.blocked, path, 'invalid or duplicate transaction destination');
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
      throw new LessonError(exits.blocked, path, `invalid bytes, digests, or mode for ${item.path}`);
    if (
      row.kind === 'capture' &&
      (lessonFile(item.path) === 'live' || lessonFile(item.path) === 'rejected' || item.after === null)
    )
      throw new LessonError(exits.blocked, path, 'capture transaction can only write pending proposals');
    return {
      path: item.path,
      before: item.before,
      after: item.after,
      beforeDigest: item.beforeDigest as string | null,
      afterDigest: item.afterDigest as string | null,
      mode: item.mode,
    };
  });
  if (row.lane === undefined) return { schema: 1, id, kind: row.kind, changes };
  const lane = object(row.lane, `${path}.lane`, ['root', 'head']);
  if (
    row.kind !== 'review' ||
    typeof lane.root !== 'string' ||
    !isAbsolute(lane.root) ||
    resolve(lane.root) !== lane.root ||
    typeof lane.head !== 'string' ||
    !objectId.test(lane.head) ||
    !changes.some((change) => !pending(change.path))
  )
    throw new LessonError(exits.blocked, path, 'invalid transaction lane');
  return { schema: 1, id, kind: row.kind, changes, lane: { root: lane.root, head: lane.head } };
}
async function requireUntrackedPending(root: string): Promise<void> {
  const result = await run('git', ['ls-files', '-z', '--', pendingPath], { cwd: root });
  if (result.code !== 0)
    throw new LessonError(
      exits.blocked,
      join(root, pendingPath),
      `cannot check Git tracking: ${result.stderr.trim() || `git exited ${result.code}`}`,
    );
  const tracked = result.stdout.split('\0')[0];
  if (tracked)
    throw new LessonError(
      exits.blocked,
      join(root, tracked),
      'pending path is tracked by Git; review its tracking explicitly before a lesson write',
    );
}
function gitError(result: { code: number; stderr: string }): string {
  return result.stderr.trim().split('\n')[0] || `git exited ${result.code}`;
}
async function place(root: string, change: Change, text: string | null): Promise<void> {
  if (text !== null) return replace(root, change.path, text, change.mode);
  await parents(root, change.path);
  try {
    await unlink(join(root, change.path));
  } catch (error) {
    if (!missing(error)) blocked(join(root, change.path), error);
  }
}
async function removeJournal(main: string): Promise<void> {
  await parents(main, journalPath);
  await readLessonFile(main, journalPath);
  try {
    await unlink(join(main, journalPath));
  } catch (error) {
    blocked(join(main, journalPath), error);
  }
}
async function finish(view: View, journal: Transaction): Promise<void> {
  const changes = journal.lane ? journal.changes.filter((change) => pending(change.path)) : journal.changes;
  await requireUntrackedPending(view.main);
  const files = await scanStore(view);
  if (!files.has(ignorePath))
    throw new LessonError(exits.blocked, join(view.main, ignorePath), 'recovery requires the pending ignore file');
  for (const change of changes) {
    const actual = files.get(change.path) ?? null;
    if (actual !== change.before && actual !== change.after)
      throw new LessonError(
        exits.blocked,
        join(rootOf(view, change.path), change.path),
        'recovery conflict: bytes match neither before nor after',
      );
    if (change.after === null) files.delete(change.path);
    else files.set(change.path, change.after);
  }
  validateStore(files);
  for (const change of [
    ...changes.filter((item) => item.after !== null),
    ...changes.filter((item) => item.after === null),
  ]) {
    const root = rootOf(view, change.path);
    const actual = await readLessonFile(root, change.path);
    if (actual !== change.before && actual !== change.after)
      throw new LessonError(exits.blocked, join(root, change.path), 'recovery conflict: target changed');
    if (actual !== change.after) await place(root, change, change.after);
  }
  const completed = await scanStore(view);
  validateStore(completed);
  for (const change of changes)
    if ((completed.get(change.path) ?? null) !== change.after)
      throw new LessonError(
        exits.blocked,
        join(rootOf(view, change.path), change.path),
        'transaction did not reach its after-state',
      );
  await removeJournal(view.main);
}
async function laneHead(root: string): Promise<Lane> {
  const status = await run('git', ['status', '--porcelain'], { cwd: root });
  if (status.code !== 0) throw new LessonError(exits.blocked, root, `cannot read the Git status: ${gitError(status)}`);
  if (status.stdout)
    throw new LessonError(
      exits.usage,
      root,
      'the checkout has uncommitted changes; commit or remove them, then apply again',
    );
  const branch = await run('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: root });
  if (branch.code === 1)
    throw new LessonError(
      exits.usage,
      root,
      'the checkout has a detached HEAD; check out its branch, then apply again',
    );
  if (branch.code !== 0) throw new LessonError(exits.blocked, root, `cannot read the branch: ${gitError(branch)}`);
  const head = await run('git', ['rev-parse', '--verify', '-q', 'HEAD^{commit}'], { cwd: root });
  if (head.code !== 0)
    throw new LessonError(exits.usage, root, 'the branch has no commit; commit once, then apply again');
  return { root, head: head.stdout.trim() };
}
async function rollBack(main: string, journal: Transaction, lane: Lane, anyLiveBytes = false): Promise<string[]> {
  for (const change of journal.changes) {
    const root = pending(change.path) ? main : lane.root;
    const actual = await readLessonFile(root, change.path);
    if (actual !== change.before && (pending(change.path) || (!anyLiveBytes && actual !== change.after)))
      throw new LessonError(
        exits.blocked,
        join(root, change.path),
        'recovery conflict: bytes match neither before nor after',
      );
  }
  const live = journal.changes.filter((change) => !pending(change.path));
  for (const change of live) await place(lane.root, change, change.before);
  const paths = live.map((change) => change.path);
  const reset = await run('git', ['reset', '-q', '--', ...paths], { cwd: lane.root });
  if (reset.code !== 0)
    throw new LessonError(exits.blocked, lane.root, `cannot unstage the lessons: ${gitError(reset)}`);
  await removeJournal(main);
  return paths;
}
async function commitLane(main: string, journal: Transaction, lane: Lane, decision: Decision): Promise<void> {
  const live = journal.changes.filter((change) => !pending(change.path));
  const paths = live.map((change) => change.path);
  let failure: string;
  try {
    for (const change of live) await place(lane.root, change, change.after);
    const add = await run('git', ['add', '--', ...paths], { cwd: lane.root });
    if (add.code !== 0) failure = gitError(add);
    else {
      const names = paths.map((path) => path.slice(lessonsPath.length + 1, -'.md'.length)).join(', ');
      const commit = await run(
        'git',
        ['commit', '-q', '-m', `docs(lessons): ${decision} ${names}`, '-m', `Lesson-Transaction: ${journal.id}`],
        { cwd: lane.root },
      );
      if (commit.code === 0) return;
      failure = gitError(commit);
    }
  } catch (error) {
    failure = message(error);
  }
  let state: LaneCommit;
  try {
    state = await laneCommit(lane, journal.id);
    // The lane was clean under the held lock, so only a commit hook can have changed the live bytes.
    if (state === 'absent') await rollBack(main, journal, lane, true);
  } catch (error) {
    throw new LessonError(
      exits.blocked,
      lane.root,
      `cannot commit the lessons: ${failure}; the rollback stopped: ${message(error)}; run lesson-store recover`,
    );
  }
  if (state === 'committed') return;
  throw new LessonError(
    exits.blocked,
    lane.root,
    `cannot commit the lessons: ${failure}${state === 'moved' ? `; ${moved(lane)}` : ''}`,
  );
}
export async function commitLessons(
  store: LessonStore,
  after: ReadonlyMap<string, string>,
  operation: 'capture' | Decision,
): Promise<string[]> {
  const proposed = new Map(after);
  const oldIgnore = store.files.get(ignorePath);
  if (oldIgnore !== undefined && proposed.get(ignorePath) !== oldIgnore)
    throw new LessonError(exits.usage, join(store.main, ignorePath), 'preserve the existing pending ignore file');
  const paths = [...new Set([...store.files.keys(), ...proposed.keys()])];
  if (!paths.some((path) => store.files.get(path) !== proposed.get(path))) {
    validateStore(proposed);
    return [];
  }
  proposed.set(ignorePath, oldIgnore ?? '*\n');
  validateStore(proposed);
  await requireUntrackedPending(store.main);
  const lane =
    store.active !== store.main && paths.some((path) => !pending(path) && store.files.get(path) !== proposed.get(path))
      ? await laneHead(store.active)
      : undefined;
  after = proposed;
  const infrastructure: string[] = [];
  if (oldIgnore === undefined && proposed.has(ignorePath)) {
    if ((await readLessonFile(store.main, ignorePath)) !== null)
      throw new LessonError(exits.prerequisite, join(store.main, ignorePath), 'stale: pending ignore file changed');
    await replace(store.main, ignorePath, '*\n', 0o600);
    store.files.set(ignorePath, '*\n');
    infrastructure.push(ignorePath);
  }
  const changes: Change[] = [];
  for (const path of [...new Set([...store.files.keys(), ...after.keys()])].sort()) {
    const root = rootOf(store, path);
    if (!storePath(path)) throw new LessonError(exits.usage, join(root, path), 'invalid store destination');
    const before = store.files.get(path) ?? null;
    const content = after.get(path) ?? null;
    if (before === content) continue;
    if ((await readLessonFile(root, path)) !== before)
      throw new LessonError(exits.prerequisite, join(root, path), 'stale: target changed');
    const current = await stat(join(root, path));
    changes.push({
      path,
      before,
      after: content,
      beforeDigest: before === null ? null : hash(before),
      afterDigest: content === null ? null : hash(content),
      mode: current ? current.mode & 0o777 : pending(path) ? 0o600 : 0o644,
    });
  }
  if (!changes.length) return infrastructure;
  const journal = transaction(
    {
      schema: 1,
      id: randomUUID(),
      kind: operation === 'capture' ? 'capture' : 'review',
      changes,
      ...(lane ? { lane } : {}),
    },
    join(store.main, journalPath),
  );
  await requireComplete(store.main);
  await replace(store.main, journalPath, `${JSON.stringify(journal)}\n`, 0o600);
  if (lane && operation !== 'capture') await commitLane(store.main, journal, lane, operation);
  await finish(store, journal);
  return [...infrastructure, ...changes.map((change) => change.path)];
}
export async function captureLesson(cwd: string, input: CaptureRequest): Promise<StoreResult> {
  input = validateCapture(input, 'capture');
  return withLessonStore(
    cwd,
    async (store) => {
      const after = captureChanges(store.files, input);
      if (after === null) return { schema: 1, status: 'unchanged', root: store.main, paths: [] };
      const paths = await commitLessons(store, after, 'capture');
      return { schema: 1, status: 'saved', root: store.main, paths };
    },
    120_000,
  );
}
export async function previewLessonReview(cwd: string, input: ReviewRequest): Promise<ReviewSnapshot> {
  input = validateReviewRequest(input, 'review');
  return withLessonStore(cwd, async (store) => reviewSnapshot(store.main, store.files, input));
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
    throw new LessonError(exits.prerequisite, 'snapshot', 'stale: displayed snapshot digest changed');
  const before = new Map<string, string>();
  for (const [path, text] of Object.entries(snapshot.before)) if (text !== null) before.set(path, text);
  try {
    validateStore(before);
    if (stable(reviewSnapshot(snapshot.root, before, snapshot.request)) !== stable(snapshot))
      throw new LessonError(exits.prerequisite, 'snapshot', 'stale: review result or watched paths changed');
  } catch (error) {
    if (error instanceof LessonError && error.code === exits.usage)
      throw new LessonError(exits.prerequisite, 'snapshot', `stale: review transition changed: ${error.message}`);
    throw error;
  }
  return withLessonFiles(cwd, async (store) => {
    if (store.main !== snapshot.root)
      throw new LessonError(exits.prerequisite, snapshot.root, 'stale: main checkout changed');
    const changed = [...new Set([...store.files.keys(), ...Object.keys(snapshot.watched)])].find((path) => {
      const actual = store.files.get(path);
      return (actual === undefined ? null : hash(actual)) !== snapshot.watched[path];
    });
    try {
      validateStore(store.files);
    } catch (error) {
      if (changed && error instanceof LessonError && error.code === exits.usage)
        throw new LessonError(
          exits.prerequisite,
          join(rootOf(store, changed), changed),
          `stale: reviewed input changed: ${error.message}`,
        );
      throw error;
    }
    if (completedReview(store.files, snapshot.request)) {
      return { schema: 1, status: 'unchanged', root: store.main, paths: [] };
    }
    if (changed)
      throw new LessonError(exits.prerequisite, join(rootOf(store, changed), changed), 'stale: reviewed input changed');
    const after = new Map<string, string>();
    for (const [path, text] of Object.entries(snapshot.after)) if (text !== null) after.set(path, text);
    const paths = await commitLessons(store, after, snapshot.request.decision);
    return { schema: 1, status: 'applied', root: store.main, paths };
  });
}
async function laneCommit(lane: Lane, id: string): Promise<LaneCommit> {
  const head = await run('git', ['rev-parse', '--verify', '-q', 'HEAD^{commit}'], { cwd: lane.root });
  if (head.code !== 0) throw new LessonError(exits.blocked, lane.root, `cannot read the lane HEAD: ${gitError(head)}`);
  const log = await run('git', ['log', '-z', '--format=%B', `${lane.head}..HEAD`], { cwd: lane.root });
  if (log.code !== 0) throw new LessonError(exits.blocked, lane.root, `cannot read the lane history: ${gitError(log)}`);
  const trailer = `Lesson-Transaction: ${id}`;
  if (log.stdout.split('\0').some((body) => body.split('\n').some((line) => line.trimEnd() === trailer)))
    return 'committed';
  return head.stdout.trim() === lane.head ? 'absent' : 'moved';
}
function moved(lane: Lane): string {
  return `the lane HEAD moved without the lesson commit; run git -C ${lane.root} reset --soft ${lane.head}, then lesson-store recover`;
}
export async function recoverLessons(cwd: string): Promise<StoreResult> {
  const checkout = await identity(cwd);
  return withLock(checkout.common, async () => {
    const text = await readLessonFile(checkout.main, journalPath);
    if (text === null) {
      validateStore(await scanStore({ main: checkout.main, active: checkout.active }));
      return { schema: 1, status: 'unchanged', root: checkout.main, paths: [] };
    }
    let journal: Transaction;
    try {
      journal = transaction(JSON.parse(text) as unknown, join(checkout.main, journalPath));
    } catch (error) {
      throw new LessonError(
        exits.blocked,
        join(checkout.main, journalPath),
        `invalid recovery journal: ${message(error)}`,
      );
    }
    const { lane } = journal;
    let active = journal.changes.some((change) => !pending(change.path)) ? checkout.main : checkout.active;
    if (lane) {
      const located = await identity(lane.root);
      if (located.common !== checkout.common || located.active !== lane.root)
        throw new LessonError(exits.blocked, lane.root, 'the recorded lane is not a checkout of this repository');
      active = lane.root;
    }
    try {
      if (lane) {
        const state = await laneCommit(lane, journal.id);
        if (state === 'moved') throw new LessonError(exits.blocked, lane.root, `recovery conflict: ${moved(lane)}`);
        if (state === 'absent') {
          const paths = await rollBack(checkout.main, journal, lane);
          return { schema: 1, status: 'rolled-back', root: checkout.main, paths };
        }
      }
      await finish({ main: checkout.main, active }, journal);
    } catch (error) {
      if (error instanceof LessonError && error.code === exits.usage)
        throw new LessonError(
          exits.blocked,
          join(checkout.main, journalPath),
          `invalid recovery state: ${error.message}`,
        );
      throw error;
    }
    return { schema: 1, status: 'recovered', root: checkout.main, paths: journal.changes.map((change) => change.path) };
  });
}
