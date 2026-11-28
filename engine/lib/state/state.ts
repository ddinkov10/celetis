import { createHash, randomUUID } from 'node:crypto';
import { type BigIntStats, closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { HostError } from '../command/errors.ts';
import type { Host } from '../config/core.ts';
import { exits } from '../contract/contract.ts';
import { celetisBase } from '../host/homes.ts';
import { openLockFile } from '../process/windows.ts';
import { type IssueKey, parseKey } from '../tracker/key.ts';
import { tryFlock } from '../update/lock.ts';

export type FolderRule = 'shared' | 'private';
export type Folder = Readonly<{ path: string; rule: FolderRule }>;
export type LockName =
  | 'queue'
  | 'agents'
  | 'trends'
  | 'usage'
  | 'recovery'
  | 'epic'
  | 'space'
  | 'capture'
  | 'sequence'
  | 'dispatch'
  | 'event'
  | 'lifecycle'
  | 'lesson'
  | 'lessonCapture'
  | 'install';
export type Lock = Readonly<{ name: LockName; path: string; folders: readonly Folder[] }>;
export type LockCheck = (stage: 'opened' | 'locked', file: BigIntStats) => void;

export class StateError extends HostError {
  constructor(
    readonly kind: 'busy' | 'unsafe',
    readonly lock: LockName | null,
    readonly path: string,
    readonly reason: string,
    message = `state: ${path}: ${reason}`,
  ) {
    super(message, kind === 'busy' ? exits.prerequisite : exits.blocked);
  }
}

export function unsafe(path: string, reason: string): StateError {
  return new StateError('unsafe', null, path, reason);
}

export function stateOutcome(error: unknown): StateError | null {
  if (error instanceof StateError) return error;
  return error instanceof Error && error.cause instanceof StateError ? error.cause : null;
}

const policies: Readonly<Record<LockName, Readonly<{ wait: number; line: (path: string) => string }>>> = {
  queue: { wait: 10_000, line: (path) => `queue: ${path}: the write lock is busy after 10 seconds; try again` },
  agents: { wait: 10_000, line: (path) => `agents: ${path}: the write lock is busy after 10 seconds; try again` },
  trends: { wait: 10_000, line: (path) => `trends: ${path}: the write lock is busy after 10 seconds; try again` },
  usage: { wait: 10_000, line: (path) => `usage: ${path}: the write lock is busy after 10 seconds; try again` },
  recovery: {
    wait: 10_000,
    line: (path) => `recovery: ${path}: the recovery lock is busy after 10 seconds; try again`,
  },
  epic: { wait: 10_000, line: (path) => `epic: ${path}: the completion lock is busy after 10 seconds; try again` },
  capture: { wait: 10_000, line: (path) => `usage: ${path}: the capture lock is busy after 10 seconds; try again` },
  sequence: {
    wait: 10_000,
    line: (path) => `usage: ${path}: the sequence lock is busy after 10 seconds; try again`,
  },
  dispatch: {
    wait: 10_000,
    line: (path) => `dispatch: ${path}: the dispatch lock is busy after 10 seconds; try again`,
  },
  lesson: { wait: 10_000, line: (path) => `${path}: busy: timed out waiting for the lesson lock` },
  // The holder waits on Herdr while it opens a tab.
  space: { wait: 60_000, line: (path) => `terminal: ${path}: the space lock is busy after 60 seconds; try again` },
  // The capture waits for a lesson apply, which holds the lock for a whole Git transaction.
  lessonCapture: { wait: 120_000, line: (path) => `${path}: busy: timed out waiting for the lesson lock` },
  // The wait blocks the whole process, and engine/README.md states 2 s.
  event: { wait: 2_000, line: () => 'celetis: the record lock is busy after 2 seconds' },
  lifecycle: { wait: 2_000, line: () => 'daemon: the lifecycle log lock is busy after 2 seconds' },
  // A second install must refuse at once.
  install: {
    wait: 0,
    line: (path) => `celetis: ${path}: the install lock is busy; try again after the other install or update ends`,
  },
};

const busy = (lock: Lock) => new StateError('busy', lock.name, lock.path, 'busy', policies[lock.name].line(lock.path));

export function fromChild(code: number, line: string, lock: Lock): StateError | null {
  if (code === exits.prerequisite && line === policies[lock.name].line(lock.path)) return busy(lock);
  const [, path, reason] = (code === exits.blocked && /^state: (.+): (need a .+)$/.exec(line)) || [];
  return path && reason ? unsafe(path, reason) : null;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const shared = (path: string): Folder => ({ path, rule: 'shared' });
const owned = (path: string): Folder => ({ path, rule: 'private' });
const lockAt = (name: LockName, path: string, folders: readonly Folder[]): Lock => ({ name, path, folders });

export type RepositoryLayout = ReturnType<typeof repositoryLayout>;

export function repositoryLayout(common: string) {
  const root = shared(join(common, 'celetis'));
  const sessions = shared(join(root.path, 'sessions'));
  const stepEnds = shared(join(root.path, 'step-end'));
  const recovery = owned(join(root.path, 'recovery'));
  const limits = owned(join(root.path, 'limits'));
  const usageCaptures = owned(join(root.path, 'usage-captures'));
  const usageSequences = owned(join(root.path, 'usage-sequences'));
  const usageSequence = (attemptId: string) => owned(join(usageSequences.path, sha256(attemptId)));
  const daemon = owned(join(root.path, 'daemon'));
  const runs = owned(join(daemon.path, 'runs'));
  const sessionArchive = (issue: IssueKey) => owned(join(sessions.path, issue));
  const attempts = owned(join(root.path, 'attempts'));
  const attemptFolder = (issue: IssueKey) => owned(join(attempts.path, issue));
  return Object.freeze({
    root,
    queue: join(root.path, 'queue.json'),
    queueLock: lockAt('queue', join(root.path, 'queue-write.lock'), [root]),
    agents: join(root.path, 'agents.json'),
    agentsLock: lockAt('agents', join(root.path, 'agents-write.lock'), [root]),
    trendSamples: join(root.path, 'trend-samples.jsonl'),
    trendCache: join(root.path, 'trend-cache.jsonl'),
    trendsLock: lockAt('trends', join(root.path, 'trends-write.lock'), [root]),
    sessions,
    session: (issue: IssueKey) => join(sessions.path, `${issue}.json`),
    sessionArchive,
    archivedSession: (issue: IssueKey, attemptId: string) => join(sessionArchive(issue).path, `${attemptId}.json`),
    attempts,
    attemptFolder,
    attemptEntry: (issue: IssueKey, id: string) => join(attemptFolder(issue).path, `${id}.json`),
    stepEnds,
    stepEnd: (issue: IssueKey) => join(stepEnds.path, `${issue}.json`),
    recovery,
    recoveryRecord: (issue: IssueKey) => join(recovery.path, `${issue}.json`),
    recoveryLock: (issue: IssueKey) => lockAt('recovery', join(recovery.path, `${issue}.lock`), [root, recovery]),
    limits,
    limit: (host: Host) => join(limits.path, `${host}.json`),
    limitLock: (host: Host) => lockAt('usage', join(limits.path, `${host}.lock`), [root, limits]),
    epicLock: (issue: IssueKey) => lockAt('epic', join(root.path, `epic-${issue}.lock`), [root]),
    spaceLock: lockAt('space', join(root.path, 'space.lock'), [root]),
    noProgress: join(root.path, 'no-progress'),
    setAside: join(root.path, 'set-aside'),
    refresh: shared(join(root.path, 'refresh')),
    usageCaptures,
    usageCapture: (attemptId: string) => owned(join(usageCaptures.path, attemptId)),
    usageSequences,
    usageSequence,
    sequenceState: (attemptId: string) => join(usageSequence(attemptId).path, 'state.json'),
    sequenceLock: (attemptId: string) => {
      const folder = usageSequence(attemptId);
      return lockAt('sequence', join(folder.path, 'write.lock'), [root, usageSequences, folder]);
    },
    daemon,
    daemonIdentity: join(daemon.path, 'daemon.json'),
    daemonLog: join(daemon.path, 'daemon.log'),
    lifecycleLog: Object.freeze({
      folder: daemon,
      current: join(daemon.path, 'events.jsonl'),
      rotated: join(daemon.path, 'events.1.jsonl'),
      lock: lockAt('lifecycle', join(daemon.path, 'events.lock'), [root, daemon]),
    }),
    coordinator: join(daemon.path, 'coordinator.json'),
    runs,
    runRecord: (id: string) => join(runs.path, `${id}.json`),
    refused: owned(join(daemon.path, 'refused')),
    startPrefix: join(root.path, 'start.'),
  });
}

export function recordKey(name: string, suffix: '.json'): IssueKey | null {
  return name.endsWith(suffix) ? parseKey(name.slice(0, -suffix.length)) : null;
}

export function captureFiles(dir: string) {
  return Object.freeze({
    attempt: join(dir, 'attempt.json'),
    events: join(dir, 'events.json'),
    settings: join(dir, 'settings.json'),
    lock: lockAt('capture', join(dir, 'write.lock'), []),
  });
}

export function startFiles(dir: string) {
  return Object.freeze({
    pid: join(dir, 'pid'),
    status: join(dir, 'status'),
    go: join(dir, 'go'),
    terminated: join(dir, 'terminated'),
    error: join(dir, 'error'),
    env: join(dir, 'env'),
    jobEmpty: join(dir, 'job-empty'),
  });
}

const privateRoot = process.platform === 'win32' ? join(tmpdir(), 'celetis') : `/tmp/celetis-${process.getuid?.()}`;

export const privateState: Folder = owned(privateRoot);

export function dispatchRecord(host: Host, session: string) {
  const folder = owned(join(privateState.path, 'dispatch'));
  const file = join(folder.path, `${host}-${session}.json`);
  return Object.freeze({
    folder,
    file,
    lock: lockAt('dispatch', `${file}.lock`, [privateState, folder]),
  });
}

export function lessonLock(common: string, operation: 'capture' | 'other'): Lock {
  const folder = owned(join(privateState.path, 'lessons'));
  return lockAt(operation === 'capture' ? 'lessonCapture' : 'lesson', join(folder.path, `${sha256(common)}.lock`), [
    privateState,
    folder,
  ]);
}

export const daemonSockets: Folder = owned(join(privateState.path, 'daemon'));

export function daemonSocketPath(common: string): string {
  return join(daemonSockets.path, `${sha256(common).slice(0, 16)}.sock`);
}

export function eventLayout() {
  const folder = owned(join(celetisBase(), '.local/state/celetis'));
  return Object.freeze({
    folder,
    current: join(folder.path, 'events.jsonl'),
    rotated: join(folder.path, 'events.1.jsonl'),
    lock: lockAt('event', join(folder.path, 'events.lock'), [folder]),
  });
}

export function installLock(data: string): Lock {
  return lockAt('install', join(data, 'install.lock'), []);
}

export const laneFolderName = '.claude/worktrees';
export const laneIgnore = '.claude/worktrees/';

export function laneFolder(main: string): string {
  return join(main, laneFolderName);
}

export function setupMarker(gitDir: string) {
  return join(gitDir, 'celetis-setup-done');
}

export function privateMode(stat: { uid: number; mode: number }): boolean {
  return process.platform === 'win32' || (stat.uid === process.getuid?.() && (stat.mode & 0o077) === 0);
}

export function sharedMode(stat: { uid: number; mode: number }): boolean {
  return process.platform === 'win32' || (stat.uid === process.getuid?.() && (stat.mode & 0o022) === 0);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const numbers = (stat: BigIntStats) => ({ uid: Number(stat.uid), mode: Number(stat.mode) });
const rules: Readonly<Record<FolderRule, Readonly<{ holds: (stat: BigIntStats) => boolean; reason: string }>>> = {
  shared: {
    holds: (stat) => sharedMode(numbers(stat)),
    reason: 'need a directory owned by the current user with no group or other write access',
  },
  private: {
    holds: (stat) => privateMode(numbers(stat)),
    reason: 'need a private directory owned by the current user (mode 0700)',
  },
};

function ruled(folder: Folder, stat: BigIntStats): BigIntStats {
  const rule = rules[folder.rule];
  if (!stat.isDirectory() || stat.isSymbolicLink() || !rule.holds(stat)) throw unsafe(folder.path, rule.reason);
  return stat;
}

export function ensureFolder(folder: Folder): BigIntStats {
  try {
    mkdirSync(folder.path, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
      throw unsafe(folder.path, `cannot create the folder: ${message(error)}`);
  }
  let stat: BigIntStats;
  try {
    stat = lstatSync(folder.path, { bigint: true });
  } catch (error) {
    throw unsafe(folder.path, `cannot read the folder: ${message(error)}`);
  }
  return ruled(folder, stat);
}

export function checkFolder(folder: Folder): BigIntStats | null {
  let stat: BigIntStats;
  try {
    stat = lstatSync(folder.path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw unsafe(folder.path, `cannot read the folder: ${message(error)}`);
  }
  return ruled(folder, stat);
}

export const lockReason = 'need a private regular lock file owned by the current user (mode 0600)';

function openLock(lock: Lock): { fd: number; stat: BigIntStats } {
  for (const folder of lock.folders) ensureFolder(folder);
  let fd: number;
  try {
    fd =
      process.platform === 'win32'
        ? openLockFile(lock.path)
        : openSync(
            lock.path,
            constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK,
            0o600,
          );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const reason = ['ELOOP', 'ENXIO', 'EISDIR', 'ENOTDIR'].includes(code ?? '')
      ? lockReason
      : `cannot open the lock file: ${message(error)}`;
    throw new StateError('unsafe', lock.name, lock.path, reason);
  }
  try {
    const stat = fstatSync(fd, { bigint: true });
    if (!stat.isFile() || !privateMode(numbers(stat))) throw new StateError('unsafe', lock.name, lock.path, lockReason);
    return { fd, stat };
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

export const acquireReason = 'cannot acquire the lock';

function acquired(lock: Lock, fd: number, mode: 'shared' | 'exclusive'): boolean {
  try {
    return tryFlock(fd, mode === 'shared');
  } catch {
    throw new StateError('unsafe', lock.name, lock.path, acquireReason);
  }
}

export async function withLock<T>(
  lock: Lock,
  work: () => Promise<T>,
  options: { signal?: AbortSignal; check?: LockCheck } = {},
): Promise<T> {
  const { fd, stat } = openLock(lock);
  try {
    options.check?.('opened', stat);
    const deadline = performance.now() + policies[lock.name].wait;
    while (!acquired(lock, fd, 'exclusive')) {
      if (performance.now() >= deadline) throw busy(lock);
      await Bun.sleep(25);
      options.signal?.throwIfAborted();
    }
    options.check?.('locked', fstatSync(fd, { bigint: true }));
    return await work();
  } finally {
    closeSync(fd);
  }
}

export function withLockSync<T>(lock: Lock, mode: 'shared' | 'exclusive', work: () => T): T {
  const { fd } = openLock(lock);
  try {
    const deadline = performance.now() + policies[lock.name].wait;
    while (!acquired(lock, fd, mode)) {
      if (performance.now() >= deadline) throw busy(lock);
      Bun.sleepSync(25);
    }
    return work();
  } finally {
    closeSync(fd);
  }
}

export async function writeAtomic(
  path: string,
  data: string | Uint8Array,
  options: { mode?: number; check?: () => void | Promise<void> } = {},
): Promise<void> {
  const mode = options.mode ?? 0o600;
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}`);
  try {
    const handle = await open(temp, 'wx', mode);
    try {
      await handle.chmod(mode);
      await handle.writeFile(data);
    } finally {
      await handle.close();
    }
    await options.check?.();
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}
