import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, readFile, readlink, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { HostError } from '../command/errors.ts';
import type { AgentChoice, Host } from '../config/core.ts';
import { exits } from '../contract/contract.ts';
import { isHost } from '../host/names.ts';
import { commonDir } from '../process/git.ts';
import { daemonScript, processRunsScript, processState } from '../process/identity.ts';
import { run } from '../process/process.ts';
import { isSessionId, revision, uuid } from '../state/fields.ts';
import { type LockOwner, lockHolder } from '../state/locks.ts';
import {
  checkFolder,
  ensureFolder,
  laneFolder,
  privateMode,
  type RepositoryLayout,
  repositoryLayout,
  StateError,
  unsafe,
  withLock,
  writeAtomic,
} from '../state/state.ts';
import { type Step, steps } from '../workflow/workflow.ts';
import { readSession, serializeSession } from './session.ts';

export type LaneBinding = Readonly<{ path: string; branch: string; tip: string; dirtySnapshotDigest: string }> | null;
export type RecoveryAuthority = Readonly<{ step: Step; spec: string | null; plan: number | null }>;
export type NativeIdentity = Readonly<{ attemptId: string; host: Host; sessionId: string | null }>;
export type RecoveryAttempt = Readonly<{ id: string; host: Host; startedAt: number; sessionId: string | null }>;
export type QuotaBlock = Readonly<{ host: Host; reason: string; resetAt: number | null }>;
export type QuotaRecovery = Readonly<{
  schema: 2;
  id: string;
  revision: number;
  issue: number;
  authority: RecoveryAuthority;
  main: string;
  common: string;
  lane: LaneBinding;
  choice: AgentChoice;
  attempt: RecoveryAttempt | null;
  prior: readonly NativeIdentity[];
  daemon: Readonly<{ pid: number; start: string }>;
  lock: string;
  attempted: readonly Host[];
  state: 'recovering' | 'waiting';
  waitId: string | null;
  wake: string | null;
  blocked: readonly QuotaBlock[];
  nextResetAt: number | null;
}>;
declare const permitBrand: unique symbol;
export type RecoveryPermit = Readonly<{ issue: number; step: Step; lane: string; attemptId: string }> & {
  readonly [permitBrand]: true;
};

export class RecoveryError extends HostError {}
class ChangedRecord extends RecoveryError {}

const issued = new WeakSet<object>();
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string) => Object.keys(value).sort().join(',') === names;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const text = (value: unknown, limit = 4096): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= limit;
const refused = (path: string) =>
  new RecoveryError(`recovery: ${path}: invalid or obsolete recovery record; inspect it, then remove it`, exits.usage);
const fields =
  'attempt,attempted,authority,blocked,choice,common,daemon,id,issue,lane,lock,main,nextResetAt,prior,revision,schema,state,waitId,wake';

function validChoice(value: unknown): value is AgentChoice {
  return (
    object(value) &&
    ((value.kind === 'default' && keys(value, 'kind')) ||
      (value.kind === 'explicit' && keys(value, 'host,kind') && isHost(value.host)))
  );
}

function validLane(value: unknown): value is LaneBinding {
  return (
    value === null ||
    (object(value) &&
      keys(value, 'branch,dirtySnapshotDigest,path,tip') &&
      text(value.path) &&
      text(value.branch, 255) &&
      typeof value.tip === 'string' &&
      revision.test(value.tip) &&
      typeof value.dirtySnapshotDigest === 'string' &&
      /^[0-9a-f]{64}$/.test(value.dirtySnapshotDigest))
  );
}

function validAttempt(value: unknown): value is RecoveryAttempt {
  return (
    object(value) &&
    keys(value, 'host,id,sessionId,startedAt') &&
    typeof value.id === 'string' &&
    uuid.test(value.id) &&
    isHost(value.host) &&
    positive(value.startedAt) &&
    (value.sessionId === null || isSessionId(value.host, value.sessionId))
  );
}

function validRecord(value: unknown, issue: number): value is QuotaRecovery {
  if (
    !object(value) ||
    !keys(value, fields) ||
    value.schema !== 2 ||
    typeof value.id !== 'string' ||
    !uuid.test(value.id) ||
    !positive(value.revision) ||
    value.issue !== issue ||
    !text(value.main) ||
    !text(value.common) ||
    value.lock !== `issue-${issue}` ||
    !validLane(value.lane) ||
    !validChoice(value.choice) ||
    !(value.attempt === null || validAttempt(value.attempt)) ||
    !(value.state === 'recovering' || value.state === 'waiting') ||
    !(value.nextResetAt === null || positive(value.nextResetAt))
  )
    return false;
  const { authority, prior, attempted, blocked, waitId, wake } = value;
  const owner = value.daemon;
  return (
    object(authority) &&
    keys(authority, 'plan,spec,step') &&
    typeof authority.step === 'string' &&
    steps.includes(authority.step as Step) &&
    (authority.spec === null || (typeof authority.spec === 'string' && /^[0-9a-f]{64}$/.test(authority.spec))) &&
    (authority.plan === null || positive(authority.plan)) &&
    object(owner) &&
    keys(owner, 'pid,start') &&
    positive(owner.pid) &&
    text(owner.start, 128) &&
    Array.isArray(prior) &&
    prior.length <= 64 &&
    prior.every(
      (item: unknown) =>
        object(item) &&
        keys(item, 'attemptId,host,sessionId') &&
        typeof item.attemptId === 'string' &&
        uuid.test(item.attemptId) &&
        isHost(item.host) &&
        (item.sessionId === null || isSessionId(item.host, item.sessionId)),
    ) &&
    Array.isArray(attempted) &&
    attempted.every(isHost) &&
    new Set(attempted).size === attempted.length &&
    Array.isArray(blocked) &&
    blocked.every(
      (item: unknown) =>
        object(item) &&
        keys(item, 'host,reason,resetAt') &&
        isHost(item.host) &&
        text(item.reason) &&
        (item.resetAt === null || positive(item.resetAt)),
    ) &&
    (value.state === 'waiting'
      ? typeof waitId === 'string' && uuid.test(waitId) && (wake === null || wake === waitId)
      : (waitId === null || (typeof waitId === 'string' && uuid.test(waitId))) && (wake === null || wake === waitId))
  );
}

async function recovering<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw error instanceof StateError ? new RecoveryError(error.message, error.code, { cause: error }) : error;
  }
}

const layoutOf = async (main: string) => repositoryLayout(await realpath(await commonDir(main)));

async function existingFolder(main: string): Promise<RepositoryLayout | null> {
  const layout = await layoutOf(main);
  return checkFolder(layout.root) && checkFolder(layout.recovery) ? layout : null;
}

async function recoveryFolder(main: string): Promise<RepositoryLayout> {
  const layout = await layoutOf(main);
  ensureFolder(layout.root);
  ensureFolder(layout.recovery);
  return layout;
}

async function readPrivate(path: string): Promise<string | null> {
  const before = await lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!before) return null;
  if (!before.isFile() || before.nlink !== 1 || !privateMode(before) || before.size > 65536)
    throw unsafe(path, 'need a private regular file owned by the current user (mode 0600)');
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino)
      throw new ChangedRecord(`recovery: ${path}: the record changed during the read`, exits.prerequisite);
    return new TextDecoder('utf-8', { fatal: true }).decode(await handle.readFile());
  } finally {
    await handle.close();
  }
}

function parse(path: string, source: string, issue: number): QuotaRecovery {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {}
  if (!validRecord(value, issue)) throw refused(path);
  return value;
}

function locked<T>(layout: RepositoryLayout, issue: number, work: () => Promise<T>): Promise<T> {
  return withLock(layout.recoveryLock(issue), work);
}

async function readLocked(layout: RepositoryLayout, issue: number): Promise<QuotaRecovery | null> {
  const path = layout.recoveryRecord(issue);
  const source = await readPrivate(path);
  return source === null ? null : parse(path, source, issue);
}

async function readOne(layout: RepositoryLayout, issue: number): Promise<QuotaRecovery | null> {
  const path = layout.recoveryRecord(issue);
  try {
    const source = await readPrivate(path);
    if (source === null) return null;
    return parse(path, source, issue);
  } catch (error) {
    if (!(error instanceof ChangedRecord)) throw error;
  }
  return locked(layout, issue, () => readLocked(layout, issue));
}

export async function readRecovery(main: string, issue: number): Promise<QuotaRecovery | null> {
  if (!positive(issue)) throw new RecoveryError('recovery: invalid issue number', exits.usage);
  return recovering(async () => {
    const layout = await existingFolder(main);
    return layout === null ? null : readOne(layout, issue);
  });
}

export async function listRecoveries(main: string): Promise<QuotaRecovery[]> {
  return recovering(async () => {
    const layout = await existingFolder(main);
    if (layout === null) return [];
    const records: QuotaRecovery[] = [];
    for (const name of (await readdir(layout.recovery.path)).sort()) {
      const issue = /^([1-9][0-9]*)\.json$/.exec(name)?.[1];
      if (!issue) continue;
      const record = await readOne(layout, Number(issue));
      if (record !== null) records.push(record);
    }
    return records;
  });
}

export async function updateRecovery(
  main: string,
  issue: number,
  change: (current: QuotaRecovery | null) => Promise<QuotaRecovery | null> | QuotaRecovery | null,
): Promise<QuotaRecovery | null> {
  if (!positive(issue)) throw new RecoveryError('recovery: invalid issue number', exits.usage);
  return recovering(async () => {
    const layout = await recoveryFolder(main);
    return locked(layout, issue, async () => {
      const path = layout.recoveryRecord(issue);
      const current = await readLocked(layout, issue);
      const next = await change(current);
      if (next === current) return current;
      if (next === null) {
        await rm(path, { force: true });
        return null;
      }
      const record = { ...next, revision: (current?.revision ?? 0) + 1 };
      if (!validRecord(record, issue))
        throw new RecoveryError(`recovery: ${path}: refused an invalid recovery record`, exits.internal);
      await writeAtomic(path, `${JSON.stringify(record)}\n`);
      return record;
    });
  });
}

export async function recoveryOwner(record: QuotaRecovery): Promise<boolean> {
  const { pid, start } = record.daemon;
  return (await processState(pid, start)) === 'runs' && (await processRunsScript(pid, daemonScript));
}

export async function retryQuota(
  main: string,
  issue: number,
  expectedWaitId: string,
  waiting: (record: QuotaRecovery) => Promise<boolean>,
): Promise<void> {
  if (!uuid.test(expectedWaitId)) throw new RecoveryError('recovery: invalid wait ID', exits.usage);
  const seen = await readRecovery(main, issue);
  if (!seen?.waitId) throw new RecoveryError(`recovery: #${issue} has no quota wait`, exits.prerequisite);
  if (seen.waitId !== expectedWaitId)
    throw new RecoveryError(
      `recovery: #${issue} waits with another wait ID; refresh, then use its Retry`,
      exits.prerequisite,
    );
  await updateRecovery(main, issue, async (current) => {
    if (!current?.waitId) throw new RecoveryError(`recovery: #${issue} has no quota wait`, exits.prerequisite);
    if (current.waitId !== expectedWaitId)
      throw new RecoveryError(
        `recovery: #${issue} waits with another wait ID; refresh, then use its Retry`,
        exits.prerequisite,
      );
    if (!(await waiting(current)))
      throw new RecoveryError(`recovery: the run of #${issue} no longer runs; start the run again`, exits.prerequisite);
    if (current.wake === expectedWaitId) return current;
    if (current.state !== 'waiting')
      throw new RecoveryError(
        `recovery: #${issue} waits with another wait ID; refresh, then use its Retry`,
        exits.prerequisite,
      );
    return { ...current, wake: expectedWaitId };
  });
}

export function quotaWake(
  record: Pick<QuotaRecovery, 'waitId' | 'wake' | 'nextResetAt'>,
  now: number,
): 'retry' | 'timer' | null {
  if (record.waitId !== null && record.wake === record.waitId) return 'retry';
  return record.nextResetAt !== null && now >= record.nextResetAt ? 'timer' : null;
}

async function git(path: string, args: string[]): Promise<string | null> {
  const result = await run('git', ['-C', path, '--no-optional-locks', ...args]);
  return result.code === 0 ? result.stdout : null;
}

async function operationInProgress(path: string): Promise<boolean | null> {
  for (const name of ['MERGE_HEAD', 'REBASE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    const found = await git(path, ['rev-parse', '--path-format=absolute', '--git-path', name]);
    if (found === null) return null;
    if (await lstat(found.trimEnd()).catch(() => null)) return true;
  }
  return false;
}

async function laneState(path: string): Promise<Omit<NonNullable<LaneBinding>, 'path'> | null> {
  if ((await operationInProgress(path)) !== false) return null;
  const branch = (await git(path, ['symbolic-ref', '--quiet', '--short', 'HEAD']))?.trimEnd();
  const tip = (await git(path, ['rev-parse', '--verify', 'HEAD']))?.trimEnd();
  const status = await git(path, ['status', '--porcelain=v2', '-z', '--untracked-files=all']);
  const diff = await git(path, ['diff', '--binary', '--no-ext-diff', 'HEAD']);
  const untracked = await git(path, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (!branch || !tip || status === null || diff === null || untracked === null) return null;
  const hash = createHash('sha256').update(status).update('\0').update(diff).update('\0');
  for (const name of untracked.split('\0').filter(Boolean).sort()) {
    const file = join(path, name);
    const stat = await lstat(file).catch(() => null);
    hash.update(name).update('\0');
    if (stat?.isFile()) hash.update(await readFile(file));
    else if (stat?.isSymbolicLink()) hash.update(`link:${await readlink(file)}`);
    hash.update('\0');
  }
  return { branch, tip, dirtySnapshotDigest: hash.digest('hex') };
}

export async function snapshotLane(main: string, issue: number): Promise<LaneBinding> {
  const parent = laneFolder(main);
  const names = (await readdir(parent).catch(() => [] as string[])).filter((name) => name.startsWith(`${issue}-`));
  const dirty: string[] = [];
  for (const name of names) {
    const path = join(parent, name);
    const status = await git(path, ['status', '--porcelain']);
    if (status === null || status !== '') dirty.push(path);
  }
  const [path] = dirty;
  if (dirty.length !== 1 || path === undefined) return null;
  const state = await laneState(path);
  return state && { path, ...state };
}

export async function validateRecovery(main: string, issue: number, attemptId: string): Promise<RecoveryPermit> {
  const refuse = (reason: string): never => {
    throw new RecoveryError(`recovery: #${issue}: ${reason}`, exits.prerequisite);
  };
  const canonical = await realpath(main);
  const record = (await readRecovery(canonical, issue)) ?? refuse('no recovery record');
  const common = await realpath(await commonDir(canonical));
  if (record.main !== canonical || record.common !== common) refuse('the record names another checkout');
  if (record.attempt?.id !== attemptId) refuse('the record names another attempt');
  if (!(await recoveryOwner(record))) refuse('its daemon no longer runs');
  if ((await lockHolder(canonical, record.lock)) !== String(record.daemon.pid))
    refuse('its daemon does not hold the issue lock');
  const lane = record.lane ?? refuse('no dirty lane is bound');
  if (dirname(lane.path) !== laneFolder(canonical) || !basename(lane.path).startsWith(`${issue}-`))
    refuse('the bound lane is not a lane of this issue');
  if ((await realpath(lane.path).catch(() => null)) !== lane.path) refuse('the bound lane is missing');
  const laneCommon = await git(lane.path, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (laneCommon === null || (await realpath(laneCommon.trimEnd())) !== common)
    refuse('the bound lane belongs to another repository');
  const state = (await laneState(lane.path)) ?? refuse('the lane has an unresolved Git operation or cannot be read');
  if (state.branch !== lane.branch) refuse(`the lane branch changed from ${lane.branch} to ${state.branch}`);
  if (state.tip !== lane.tip) refuse('the lane HEAD changed');
  if (state.dirtySnapshotDigest !== lane.dirtySnapshotDigest)
    refuse('the lane changes differ from the recovery snapshot');
  const permit = Object.freeze({ issue, step: record.authority.step, lane: lane.path, attemptId }) as RecoveryPermit;
  issued.add(permit);
  return permit;
}

export async function permitHolds(main: string, permit: RecoveryPermit): Promise<boolean> {
  if (!issued.has(permit)) return false;
  try {
    const current = await validateRecovery(main, permit.issue, permit.attemptId);
    return current.lane === permit.lane && current.step === permit.step;
  } catch (error) {
    if (error instanceof RecoveryError) return false;
    throw error;
  }
}

export async function archiveSession(
  main: string,
  issue: number,
  attemptId: string,
  owner?: LockOwner,
): Promise<NativeIdentity> {
  if (!uuid.test(attemptId)) throw new RecoveryError('recovery: invalid attempt ID', exits.internal);
  const record = await readSession(main, issue, undefined, owner);
  return recovering(async () => {
    const layout = await layoutOf(main);
    ensureFolder(layout.root);
    ensureFolder(layout.sessions);
    ensureFolder(layout.sessionArchive(issue));
    const path = layout.archivedSession(issue, attemptId);
    const text = `${serializeSession(record)}\n`;
    const previous = await readPrivate(path);
    if (previous === null) await writeFile(path, text, { mode: 0o600, flag: 'wx' });
    else if (previous !== text)
      throw new RecoveryError(`recovery: ${path}: an archived session differs`, exits.prerequisite);
    return { attemptId, host: record.host, sessionId: record.session_id };
  });
}
