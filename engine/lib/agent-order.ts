import { createHash, randomUUID } from 'node:crypto';
import { type BigIntStats, closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentOrder, Host } from './config-core.ts';
import { privateMode, sharedFolderSync, sharedMode } from './private-folder.ts';
import { tryFlock } from './update-lock.ts';
import { openLockFile } from './windows.ts';

export class AgentOrderConflict extends Error {
  constructor(readonly latest: AgentOrder) {
    super('agents: the order changed; read the current order and try again');
  }
}

const invalid = (path: string, reason: string) => new Error(`agents: ${path}: ${reason}`);
const directory = (common: string) => join(common, 'celetis-flow');
const recordPath = (common: string) => join(directory(common), 'agents.json');
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

function checkDirectory(common: string): BigIntStats | null {
  const path = directory(common);
  const stat = statAt(path);
  if (stat && (!stat.isDirectory() || !sharedMode({ uid: Number(stat.uid), mode: Number(stat.mode) })))
    throw invalid(path, 'need a directory owned by the current user with no group or other write access');
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
    throw new Error('agents: order must be a nonempty, unique list of claude or codex');
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

export function readAgentOrder(common: string): AgentOrder {
  const folder = checkDirectory(common);
  const path = recordPath(common);
  const before = folder ? statAt(path) : null;
  if (!before) return versioned(validateAgentOrder(['claude', 'codex']));
  regular(path, before);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd, { bigint: true });
    regular(path, opened);
    if (!sameFile(before, opened)) throw invalid(path, 'the record changed during the read');
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
      throw new Error('need exactly schema: 1 and order');
    const result = versioned(validateAgentOrder(value.order));
    const after = checkDirectory(common);
    const current = statAt(path);
    if (!after || !folder || !sameFile(folder, after) || !current || !sameFile(opened, current))
      throw new Error('the record changed during the read');
    return result;
  } catch (error) {
    throw invalid(path, error instanceof Error ? error.message : String(error));
  } finally {
    closeSync(fd);
  }
}

async function updateOrder(
  common: string,
  order: readonly Host[],
  expectedVersion: string | null,
): Promise<AgentOrder> {
  const dir = directory(common);
  sharedFolderSync(dir, invalid);
  const folder = checkDirectory(common) as BigIntStats;
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
    if (before && !sameFile(before, opened)) throw invalid(lock, 'the lock changed during open');
    const stable = () => {
      const currentFolder = checkDirectory(common);
      const currentLock = statAt(lock);
      if (!currentFolder || !sameFile(folder, currentFolder) || !currentLock || !sameFile(opened, currentLock))
        throw invalid(lock, 'the directory or lock changed during the write');
      regular(lock, currentLock);
    };
    const deadline = performance.now() + 5_000;
    while (!tryFlock(fd)) {
      if (performance.now() >= deadline) throw new Error('agents: write lock is busy; try again');
      await Bun.sleep(50);
    }
    stable();
    const path = recordPath(common);
    const previous = readAgentOrder(common);
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
        throw invalid(path, 'the record changed during the write');
      if (readAgentOrder(common).version !== previous.version)
        throw invalid(path, 'the content changed during the write');
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
    throw new Error('agents: expectedVersion must be an order version');
  return updateOrder(common, validated, expectedVersion);
}

export async function initializeAgentOrder(common: string, order: readonly Host[]): Promise<AgentOrder> {
  return updateOrder(common, validateAgentOrder(order), null);
}
