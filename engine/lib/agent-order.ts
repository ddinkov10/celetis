import { createHash, randomUUID } from 'node:crypto';
import { type BigIntStats, closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentOrder, Host } from './config-core.ts';
import { type ExitCode, exits } from './contract.ts';
import { HostError } from './host.ts';
import { privateMode, sharedFolderSync, sharedMode } from './private-folder.ts';
import { stateFolder } from './state-folder.ts';
import { tryFlock } from './update-lock.ts';
import { openLockFile } from './windows.ts';

export class AgentOrderConflict extends Error {
  constructor(readonly latest: AgentOrder) {
    super('agents: the order changed; read the current order and try again');
  }
}

const invalid = (path: string, reason: string, code: ExitCode = exits.blocked) =>
  new HostError(`agents: ${path}: ${reason}`, code);
const recordPath = (folder: string) => join(folder, 'agents.json');
const sameFile = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino;
const privateStat = (stat: BigIntStats) => privateMode({ uid: Number(stat.uid), mode: Number(stat.mode) });

function statAt(path: string): BigIntStats | null {
  try {
    return lstatSync(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function checkDirectory(folder: string): BigIntStats | null {
  const stat = statAt(folder);
  if (stat && (!stat.isDirectory() || !sharedMode({ uid: Number(stat.uid), mode: Number(stat.mode) })))
    throw invalid(folder, 'need a directory owned by the current user with no group or other write access');
  return stat;
}

function regular(path: string, stat: BigIntStats): void {
  if (!stat.isFile() || stat.nlink !== 1n || !privateStat(stat))
    throw invalid(path, 'need a private regular file owned by the current user (mode 0600)');
}

export function validateAgentOrder(value: unknown): readonly Host[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 2 ||
    Array.from(value).some((host) => host !== 'claude' && host !== 'codex') ||
    new Set(value).size !== value.length
  )
    throw new HostError('agents: order must be a nonempty, unique list of claude or codex', exits.usage);
  return Object.freeze([...value]) as readonly Host[];
}

export function effectiveOrder(order: readonly Host[], preferred: Host | undefined): readonly Host[] {
  if (preferred === undefined || !order.includes(preferred)) return order;
  return [preferred, ...order.filter((host) => host !== preferred)];
}

function serialized(order: readonly Host[]): string {
  return `${JSON.stringify({ schema: 1, order })}\n`;
}

function versioned(order: readonly Host[]): AgentOrder {
  return Object.freeze({ schema: 1, order, version: createHash('sha256').update(serialized(order)).digest('hex') });
}

export async function readAgentOrder(common: string): Promise<AgentOrder> {
  return readOrder(await stateFolder(common));
}

function readOrder(dir: string): AgentOrder {
  const folder = checkDirectory(dir);
  const path = recordPath(dir);
  const before = folder ? statAt(path) : null;
  if (!before) return versioned(validateAgentOrder(['claude', 'codex']));
  regular(path, before);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd, { bigint: true });
    regular(path, opened);
    if (!sameFile(before, opened)) throw invalid(path, 'the record changed during the read', exits.prerequisite);
    const source = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(fd));
    const value: unknown = JSON.parse(source);
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'order,schema' ||
      !('schema' in value) ||
      value.schema !== 1 ||
      !('order' in value)
    )
      throw new HostError('need exactly schema: 1 and order', exits.usage);
    const result = versioned(validateAgentOrder(value.order));
    const after = checkDirectory(dir);
    const current = statAt(path);
    if (!after || !folder || !sameFile(folder, after) || !current || !sameFile(opened, current))
      throw new HostError('the record changed during the read', exits.prerequisite);
    return result;
  } catch (error) {
    throw invalid(
      path,
      error instanceof Error ? error.message : String(error),
      error instanceof HostError
        ? error.code
        : typeof (error as NodeJS.ErrnoException).errno === 'number'
          ? exits.blocked
          : exits.usage,
    );
  } finally {
    closeSync(fd);
  }
}

async function updateOrder(
  common: string,
  order: readonly Host[],
  expectedVersion: string | null,
): Promise<AgentOrder> {
  const dir = await stateFolder(common);
  sharedFolderSync(dir, invalid);
  const folder = checkDirectory(dir) as BigIntStats;
  const lock = join(dir, 'agents-write.lock');
  const before = statAt(lock);
  if (before) regular(lock, before);
  const fd =
    process.platform === 'win32'
      ? openLockFile(lock)
      : openSync(lock, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    const opened = fstatSync(fd, { bigint: true });
    regular(lock, opened);
    if (before && !sameFile(before, opened)) throw invalid(lock, 'the lock changed during open', exits.prerequisite);
    const stable = () => {
      const currentFolder = checkDirectory(dir);
      const currentLock = statAt(lock);
      if (!currentFolder || !sameFile(folder, currentFolder) || !currentLock || !sameFile(opened, currentLock))
        throw invalid(lock, 'the directory or lock changed during the write', exits.prerequisite);
      regular(lock, currentLock);
    };
    const deadline = performance.now() + 5_000;
    while (!tryFlock(fd)) {
      if (performance.now() >= deadline)
        throw new HostError('agents: write lock is busy; try again', exits.prerequisite);
      await Bun.sleep(50);
    }
    stable();
    const path = recordPath(dir);
    const previous = readOrder(dir);
    const existed = statAt(path);
    const next = versioned(order);
    if (expectedVersion === null && existed) return previous;
    if (existed && previous.version === next.version) return previous;
    if (expectedVersion !== null && previous.version !== expectedVersion) {
      if (previous.version === next.version) return previous;
      throw new AgentOrderConflict(previous);
    }
    const temp = join(dir, `.agents.${randomUUID()}`);
    try {
      await writeFile(temp, serialized(order), { mode: 0o600, flag: 'wx' });
      stable();
      const current = statAt(path);
      if (existed ? !current || !sameFile(existed, current) : current !== null)
        throw invalid(path, 'the record changed during the write', exits.prerequisite);
      if (readOrder(dir).version !== previous.version)
        throw invalid(path, 'the content changed during the write', exits.prerequisite);
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true });
    }
    return next;
  } finally {
    closeSync(fd);
  }
}

export async function replaceAgentOrder(common: string, order: unknown, expectedVersion: string): Promise<AgentOrder> {
  const validated = validateAgentOrder(order);
  if (typeof expectedVersion !== 'string' || !/^[a-f0-9]{64}$/.test(expectedVersion))
    throw new HostError('agents: expectedVersion must be an order version', exits.usage);
  return updateOrder(common, validated, expectedVersion);
}

export async function initializeAgentOrder(common: string, order: readonly Host[]): Promise<AgentOrder> {
  return updateOrder(common, validateAgentOrder(order), null);
}
