import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, readlink, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { AgentChoice, Host } from './config-core.ts';
import { commonDir, HostError } from './host.ts';
import { type LockOwner, lockHolder } from './locks.ts';
import { privateFolder, privateMode, sharedFolderSync, sharedMode } from './private-folder.ts';
import { bunArgs, childEnv, run } from './process.ts';
import {
  controllingTerminal,
  descendantsOf,
  processesWithEnvironment,
  processRunsScript,
  processState,
  processTable,
} from './process-identity.ts';
import { readSession, serializeSession } from './session.ts';
import { requestExit } from './terminal.ts';
import { tryFlock } from './update-lock.ts';
import type { UsageAttempt } from './usage-types.ts';
import { openLockFile } from './windows.ts';
import { type Step, steps } from './workflow.ts';

export type LaneBinding = Readonly<{ path: string; branch: string; tip: string; dirtySnapshotDigest: string }> | null;
export type RecoveryAuthority = Readonly<{ step: Step; spec: string | null; plan: number | null }>;
export type NativeIdentity = Readonly<{ attemptId: string; host: Host; sessionId: string | null }>;
export type RecoveryAttempt = Readonly<{ id: string; host: Host; startedAt: number; sessionId: string | null }>;
export type QuotaBlock = Readonly<{ host: Host; reason: string; resetAt: number | null }>;
export type QuotaRecovery = Readonly<{
  schema: 1;
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
  runner: Readonly<{ pid: number; start: string }>;
  lock: string;
  attempted: readonly Host[];
  state: 'recovering' | 'waiting';
  waitId: string | null;
  wake: string | null;
  blocked: readonly QuotaBlock[];
  nextResetAt: number | null;
}>;
export type OwnedSession = Readonly<{
  pid: number;
  start: string;
  terminal: string;
  shell: number | null;
  tty: string | null;
}>;
declare const permitBrand: unique symbol;
export type RecoveryPermit = Readonly<{ issue: number; step: Step; lane: string; attemptId: string }> & {
  readonly [permitBrand]: true;
};

export class RecoveryError extends HostError {}

const issued = new WeakSet<object>();
const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string) => Object.keys(value).sort().join(',') === names;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const host = (value: unknown): value is Host => value === 'claude' || value === 'codex';
const text = (value: unknown, limit = 4096): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= limit;
const fail = (path: string, reason: string) => new RecoveryError(`recovery: ${path}: ${reason}`);

function validChoice(value: unknown): value is AgentChoice {
  return (
    object(value) &&
    ((value.kind === 'default' && keys(value, 'kind')) ||
      (value.kind === 'explicit' && keys(value, 'host,kind') && host(value.host)))
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
      /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(value.tip) &&
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
    host(value.host) &&
    positive(value.startedAt) &&
    (value.sessionId === null || (typeof value.sessionId === 'string' && uuid.test(value.sessionId)))
  );
}

function validRecord(value: unknown, issue: number): value is QuotaRecovery {
  if (
    !object(value) ||
    !keys(
      value,
      'attempt,attempted,authority,blocked,choice,common,id,issue,lane,lock,main,nextResetAt,prior,revision,runner,schema,state,waitId,wake',
    ) ||
    value.schema !== 1 ||
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
  const { authority, runner, prior, attempted, blocked, waitId, wake } = value;
  return (
    object(authority) &&
    keys(authority, 'plan,spec,step') &&
    typeof authority.step === 'string' &&
    steps.includes(authority.step as Step) &&
    (authority.spec === null || (typeof authority.spec === 'string' && /^[0-9a-f]{64}$/.test(authority.spec))) &&
    (authority.plan === null || positive(authority.plan)) &&
    object(runner) &&
    keys(runner, 'pid,start') &&
    positive(runner.pid) &&
    text(runner.start, 128) &&
    Array.isArray(prior) &&
    prior.length <= 64 &&
    prior.every(
      (item: unknown) =>
        object(item) &&
        keys(item, 'attemptId,host,sessionId') &&
        typeof item.attemptId === 'string' &&
        uuid.test(item.attemptId) &&
        host(item.host) &&
        (item.sessionId === null || (typeof item.sessionId === 'string' && uuid.test(item.sessionId))),
    ) &&
    Array.isArray(attempted) &&
    attempted.every(host) &&
    new Set(attempted).size === attempted.length &&
    Array.isArray(blocked) &&
    blocked.every(
      (item: unknown) =>
        object(item) &&
        keys(item, 'host,reason,resetAt') &&
        host(item.host) &&
        text(item.reason) &&
        (item.resetAt === null || positive(item.resetAt)),
    ) &&
    (value.state === 'waiting'
      ? typeof waitId === 'string' && uuid.test(waitId) && (wake === null || wake === waitId)
      : (waitId === null || (typeof waitId === 'string' && uuid.test(waitId))) && (wake === null || wake === waitId))
  );
}

async function existingFolder(main: string): Promise<string | null> {
  const flow = join(await realpath(await commonDir(main)), 'celetis-flow');
  const absent = (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  };
  const shared = await lstat(flow).catch(absent);
  if (!shared) return null;
  if (!shared.isDirectory() || !sharedMode(shared))
    throw fail(flow, 'need a directory owned by the current user with no group or other write access');
  const dir = join(flow, 'recovery');
  const own = await lstat(dir).catch(absent);
  if (!own) return null;
  if (!own.isDirectory() || !privateMode(own))
    throw fail(dir, 'need a private directory owned by the current user (mode 0700)');
  return dir;
}

async function recoveryFolder(main: string): Promise<{ common: string; dir: string }> {
  const common = await realpath(await commonDir(main));
  const flow = join(common, 'celetis-flow');
  sharedFolderSync(flow, fail);
  const dir = join(flow, 'recovery');
  await privateFolder(dir, fail);
  return { common, dir };
}

async function readPrivate(path: string): Promise<string | null> {
  const before = await lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!before) return null;
  if (!before.isFile() || before.nlink !== 1 || !privateMode(before) || before.size > 65536)
    throw fail(path, 'need a private regular file');
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino)
      throw fail(path, 'the record changed during the read');
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
  if (!validRecord(value, issue)) throw fail(path, 'invalid or obsolete recovery record; inspect it, then remove it');
  return value;
}

export async function readRecovery(main: string, issue: number): Promise<QuotaRecovery | null> {
  if (!positive(issue)) throw new RecoveryError('recovery: invalid issue number', 2);
  const dir = await existingFolder(main);
  if (dir === null) return null;
  const path = join(dir, `${issue}.json`);
  const source = await readPrivate(path);
  return source === null ? null : parse(path, source, issue);
}

export async function listRecoveries(main: string): Promise<QuotaRecovery[]> {
  const dir = await existingFolder(main);
  if (dir === null) return [];
  const records: QuotaRecovery[] = [];
  for (const name of (await readdir(dir)).sort()) {
    const issue = /^([1-9][0-9]*)\.json$/.exec(name)?.[1];
    if (!issue) continue;
    const path = join(dir, name);
    const source = await readPrivate(path);
    if (source !== null) records.push(parse(path, source, Number(issue)));
  }
  return records;
}

export async function updateRecovery(
  main: string,
  issue: number,
  change: (current: QuotaRecovery | null) => Promise<QuotaRecovery | null> | QuotaRecovery | null,
): Promise<QuotaRecovery | null> {
  if (!positive(issue)) throw new RecoveryError('recovery: invalid issue number', 2);
  const { dir } = await recoveryFolder(main);
  const lock = join(dir, `${issue}.lock`);
  const fd =
    process.platform === 'win32'
      ? openLockFile(lock)
      : openSync(lock, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || !privateMode(stat)) throw fail(lock, 'need a private regular lock file');
    const deadline = performance.now() + 5000;
    while (!tryFlock(fd)) {
      if (performance.now() >= deadline) throw fail(lock, 'the recovery lock is busy; try again');
      await Bun.sleep(25);
    }
    const path = join(dir, `${issue}.json`);
    const source = await readPrivate(path);
    const current = source === null ? null : parse(path, source, issue);
    const next = await change(current);
    if (next === current) return current;
    if (next === null) {
      await rm(path, { force: true });
      return null;
    }
    const record = { ...next, revision: (current?.revision ?? 0) + 1 };
    if (!validRecord(record, issue)) throw fail(path, 'refused an invalid recovery record');
    const temp = join(dir, `.${issue}.${randomUUID()}`);
    try {
      await writeFile(temp, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true });
    }
    return record;
  } finally {
    closeSync(fd);
  }
}

export async function recoveryOwner(record: QuotaRecovery): Promise<boolean> {
  const { pid, start } = record.runner;
  return (await processState(pid, start)) === 'runs' && (await processRunsScript(pid, 'celetis-flow.ts'));
}

export async function retryQuota(main: string, issue: number, expectedWaitId: string): Promise<void> {
  if (!uuid.test(expectedWaitId)) throw new RecoveryError('recovery: invalid wait ID', 2);
  const seen = await readRecovery(main, issue);
  if (!seen?.waitId) throw new RecoveryError(`recovery: #${issue} has no quota wait`, 2);
  if (seen.waitId !== expectedWaitId)
    throw new RecoveryError(`recovery: #${issue} waits with another wait ID; refresh, then use its Retry`, 2);
  await updateRecovery(main, issue, async (current) => {
    if (!current?.waitId) throw new RecoveryError(`recovery: #${issue} has no quota wait`, 2);
    if (current.waitId !== expectedWaitId)
      throw new RecoveryError(`recovery: #${issue} waits with another wait ID; refresh, then use its Retry`, 2);
    if (!(await recoveryOwner(current)))
      throw new RecoveryError(`recovery: the runner of #${issue} no longer runs; start the runner again`, 2);
    if (current.wake === expectedWaitId) return current;
    if (current.state !== 'waiting')
      throw new RecoveryError(`recovery: #${issue} waits with another wait ID; refresh, then use its Retry`, 2);
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
  const parent = join(main, '.claude', 'worktrees');
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
    throw new RecoveryError(`recovery: #${issue}: ${reason}`);
  };
  const canonical = await realpath(main);
  const record = (await readRecovery(canonical, issue)) ?? refuse('no recovery record');
  const common = await realpath(await commonDir(canonical));
  if (record.main !== canonical || record.common !== common) refuse('the record names another checkout');
  if (record.attempt?.id !== attemptId) refuse('the record names another attempt');
  if (!(await recoveryOwner(record))) refuse('its runner no longer runs');
  if ((await lockHolder(canonical, record.lock)) !== String(record.runner.pid))
    refuse('its runner does not hold the issue lock');
  const lane = record.lane ?? refuse('no dirty lane is bound');
  if (dirname(lane.path) !== join(canonical, '.claude', 'worktrees') || !basename(lane.path).startsWith(`${issue}-`))
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
  if (!uuid.test(attemptId)) throw new RecoveryError('recovery: invalid attempt ID');
  const record = await readSession(main, issue, undefined, owner);
  const flow = join(await realpath(await commonDir(main)), 'celetis-flow');
  sharedFolderSync(flow, fail);
  const dir = join(flow, 'sessions', String(issue));
  await mkdir(dirname(dir), { recursive: true, mode: 0o700 });
  await privateFolder(dir, fail);
  const path = join(dir, `${attemptId}.json`);
  const text = `${serializeSession(record)}\n`;
  const previous = await readPrivate(path);
  if (previous === null) await writeFile(path, text, { mode: 0o600, flag: 'wx' });
  else if (previous !== text) throw fail(path, 'an archived session differs');
  return { attemptId, host: record.host, sessionId: record.session_id };
}

export type AttemptEnd = { kind: 'quiescent' } | { kind: 'unverified'; reason: string; running: readonly number[] };

const attemptMarker = (attemptId: string) => `CELETIS_ATTEMPT=${attemptId}`;
const unverified = (reason: string, running: readonly number[] = []): AttemptEnd => ({
  kind: 'unverified',
  reason,
  running,
});

async function endedAttempt(attempt: UsageAttempt, shell: number, tty: string, deadline: number): Promise<AttemptEnd> {
  const marker = randomUUID();
  const life = Math.ceil(deadline - performance.now()) + 5000;
  // ps shows no environment that it cannot read, so a control child must prove that the marker read sees one.
  const control = spawn(process.execPath, bunArgs('-e', [`setTimeout(() => {}, ${life})`]), {
    env: { ...childEnv(), CELETIS_ATTEMPT: marker },
    stdio: 'ignore',
  });
  let ended = false;
  control.on('error', () => {
    ended = true;
  });
  control.on('exit', () => {
    ended = true;
  });
  const spawned = performance.now();
  try {
    for (;;) {
      const [rows, marked, controls] = await Promise.all([
        processTable(),
        processesWithEnvironment(attemptMarker(attempt.id)),
        processesWithEnvironment(attemptMarker(marker)),
      ]);
      if (rows && marked && controls) {
        if (control.pid !== undefined && controls.has(control.pid)) {
          const tree = new Set([shell, ...descendantsOf(rows, shell).map((row) => row.pid)]);
          const running: number[] = [];
          for (const row of rows)
            if (
              row.pid !== control.pid &&
              (marked.has(row.pid) || (row.tty === tty && !tree.has(row.pid))) &&
              (await processState(row.pid, row.start)) !== 'gone'
            )
              running.push(row.pid);
          return running.length ? unverified('processes of the attempt still run', running) : { kind: 'quiescent' };
        }
        if (ended) return unverified('the control process ended before the process table showed it');
        if (performance.now() - spawned >= 1000)
          return unverified('the process table shows no environment of a control process');
      } else if (performance.now() >= deadline) return unverified('the process table could not be read');
      await Bun.sleep(250);
    }
  } finally {
    control.kill('SIGKILL');
  }
}

export async function endOwnedAttempt(
  attempt: UsageAttempt,
  owned: OwnedSession,
  limitMs = 20_000,
): Promise<AttemptEnd> {
  if (process.platform === 'win32' || attempt.host !== 'claude')
    return unverified(`no proved termination path for ${attempt.host} on ${process.platform}`);
  const readUntil = performance.now() + limitMs;
  const recorded = owned.shell !== null && owned.tty !== null;
  let rows = await processTable();
  while (!rows && recorded && performance.now() < readUntil) {
    await Bun.sleep(250);
    rows = await processTable();
  }
  if (!rows && recorded) return unverified('the process table could not be read');
  const first = rows?.find((row) => row.pid === owned.pid && row.start === owned.start);
  if (rows && !first && owned.shell !== null && owned.tty !== null)
    return endedAttempt(attempt, owned.shell, owned.tty, readUntil);
  if (!first) return unverified('the session process could not be read');
  if (!controllingTerminal(first.tty)) return unverified('the session has no controlling terminal');
  const seen = new Map<number, string>();
  const collect = async (barrierRuns: boolean): Promise<number | null> => {
    const [rows, marked] = await Promise.all([processTable(), processesWithEnvironment(attemptMarker(attempt.id))]);
    if (!rows || !marked) return null;
    const shell = new Set([first.ppid, ...descendantsOf(rows, first.ppid).map((row) => row.pid)]);
    const tree = barrierRuns ? new Set(descendantsOf(rows, owned.pid).map((row) => row.pid)) : new Set<number>();
    // macOS ps hides the environment of platform binaries such as /bin/sh, so the terminal also identifies writers.
    for (const row of rows)
      if (
        row.pid !== owned.pid &&
        (tree.has(row.pid) || marked.has(row.pid) || (row.tty === first.tty && !shell.has(row.pid)))
      )
        seen.set(row.pid, row.start);
    return [...marked].filter((pid) => pid !== owned.pid).length;
  };
  const marked = await collect(true);
  if (marked === null) return unverified('the process table could not be read');
  if (marked === 0) return unverified('no process carries the attempt marker');
  if (!(await requestExit(owned.terminal, attempt.host))) return unverified('the exit request failed');
  const deadline = performance.now() + limitMs;
  for (;;) {
    const barrier = await processState(owned.pid, owned.start);
    if ((await collect(barrier === 'runs')) === null) return unverified('the process table could not be read');
    const running: number[] = [];
    for (const [pid, start] of seen) if ((await processState(pid, start)) !== 'gone') running.push(pid);
    if (barrier === 'gone' && running.length === 0) return { kind: 'quiescent' };
    if (performance.now() >= deadline)
      return unverified('processes of the attempt still run', barrier === 'gone' ? running : [owned.pid, ...running]);
    await Bun.sleep(250);
  }
}
