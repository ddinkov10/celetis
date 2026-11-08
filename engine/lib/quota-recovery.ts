import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, readFile, readlink, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { AgentChoice, Host } from './config-core.ts';
import { exits } from './contract.ts';
import { HostError } from './errors.ts';
import { commonDir } from './git.ts';
import { type LockOwner, lockHolder } from './locks.ts';
import { bunArgs, childEnv, run } from './process.ts';
import {
  controllingTerminal,
  daemonScript,
  descendantsOf,
  processesWithEnvironment,
  processRunsScript,
  processState,
  processTable,
  terminateChild,
} from './process-identity.ts';
import { readSession, serializeSession } from './session.ts';
import {
  checkFolder,
  ensureFolder,
  laneFolder,
  privateMode,
  type RepositoryLayout,
  repositoryState,
  StateError,
  unsafe,
  withLock,
  writeAtomic,
} from './state.ts';
import { commitMigration, type LocalRecord, readLocalRecord } from './state-migration.ts';
import { exitGraceMs, requestExit } from './terminal.ts';
import type { UsageAttempt } from './usage-types.ts';
import { type Step, steps } from './workflow.ts';

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
class ChangedRecord extends RecoveryError {}

const issued = new WeakSet<object>();
const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string) => Object.keys(value).sort().join(',') === names;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const host = (value: unknown): value is Host => value === 'claude' || value === 'codex';
const text = (value: unknown, limit = 4096): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= limit;
const fail = (path: string, reason: string) => new RecoveryError(`recovery: ${path}: ${reason}`, exits.blocked);
const refused = (path: string) =>
  new RecoveryError(`recovery: ${path}: invalid or obsolete recovery record; inspect it, then remove it`, exits.usage);
const owners = { 1: 'runner', 2: 'daemon' } as const;
const fields = {
  1: 'attempt,attempted,authority,blocked,choice,common,id,issue,lane,lock,main,nextResetAt,prior,revision,runner,schema,state,waitId,wake',
  2: 'attempt,attempted,authority,blocked,choice,common,daemon,id,issue,lane,lock,main,nextResetAt,prior,revision,schema,state,waitId,wake',
} as const;

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

function validFields(value: unknown, issue: number, schema: 1 | 2): boolean {
  if (
    !object(value) ||
    !keys(value, fields[schema]) ||
    value.schema !== schema ||
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
  const owner = value[owners[schema]];
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

const validRecord = (value: unknown, issue: number): value is QuotaRecovery => validFields(value, issue, 2);

async function recovering<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw error instanceof StateError ? new RecoveryError(error.message, error.code, { cause: error }) : error;
  }
}

const layoutOf = async (main: string) => repositoryState(await realpath(await commonDir(main)));

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

function historical(path: string, source: string, issue: number): boolean {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return false;
  }
  if (!object(value) || value.schema !== 1) return false;
  if (!validFields(value, issue, 1)) throw refused(path);
  return true;
}

function locked<T>(layout: RepositoryLayout, issue: number, work: () => Promise<T>): Promise<T> {
  return withLock(layout.recoveryLock(issue), work);
}

async function convert(layout: RepositoryLayout, issue: number): Promise<void> {
  const path = layout.recoveryRecord(issue);
  const failed = (error: unknown) =>
    fail(path, `schema 1 to 2: ${error instanceof Error ? error.message : String(error)}`);
  let source: LocalRecord | null;
  try {
    source = await readLocalRecord(path, [layout.recovery.path], 'private');
  } catch (error) {
    throw failed(error);
  }
  if (!source || !object(source.value) || source.value.schema !== 1) return;
  if (!validFields(source.value, issue, 1)) throw refused(path);
  const target = Object.fromEntries(
    Object.entries(source.value).map(([key, value]) =>
      key === 'schema' ? [key, 2] : key === owners[1] ? [owners[2], value] : [key, value],
    ),
  );
  if (!validRecord(target, issue)) throw refused(path);
  try {
    await commitMigration(source, 1, `${JSON.stringify(target)}\n`);
  } catch (error) {
    throw failed(error);
  }
}

async function readLocked(layout: RepositoryLayout, issue: number): Promise<QuotaRecovery | null> {
  const path = layout.recoveryRecord(issue);
  let source = await readPrivate(path);
  if (source !== null && historical(path, source, issue)) {
    await convert(layout, issue);
    source = await readPrivate(path);
  }
  return source === null ? null : parse(path, source, issue);
}

async function readOne(layout: RepositoryLayout, issue: number): Promise<QuotaRecovery | null> {
  const path = layout.recoveryRecord(issue);
  try {
    const source = await readPrivate(path);
    if (source === null) return null;
    if (!historical(path, source, issue)) return parse(path, source, issue);
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
  const requested = performance.now();
  if (!(await requestExit(owned.terminal, attempt.host))) return unverified('the exit request failed');
  const deadline = performance.now() + limitMs;
  let signalled = false;
  for (;;) {
    const barrier = await processState(owned.pid, owned.start);
    if (barrier === 'runs' && !signalled && performance.now() - requested >= exitGraceMs) {
      signalled = true;
      await terminateChild(owned);
    }
    if ((await collect(barrier === 'runs')) === null) return unverified('the process table could not be read');
    const running: number[] = [];
    for (const [pid, start] of seen) if ((await processState(pid, start)) !== 'gone') running.push(pid);
    if (barrier === 'gone' && running.length === 0) return { kind: 'quiescent' };
    if (performance.now() >= deadline)
      return unverified('processes of the attempt still run', barrier === 'gone' ? running : [owned.pid, ...running]);
    await Bun.sleep(250);
  }
}
