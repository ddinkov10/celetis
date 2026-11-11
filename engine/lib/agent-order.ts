import { createHash } from 'node:crypto';
import { type BigIntStats, closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import type { AgentOrder, Host } from './config-core.ts';
import { type ExitCode, exits } from './contract.ts';
import { HostError } from './errors.ts';
import { orderVersion } from './fields.ts';
import { isHost } from './host-names.ts';
import {
  checkFolder,
  ensureFolder,
  lockReason,
  privateMode,
  type RepositoryLayout,
  repositoryLayout,
  StateError,
  unsafe,
  withLock,
  writeAtomic,
} from './state.ts';

export class AgentOrderConflict extends Error {
  constructor(readonly latest: AgentOrder) {
    super('agents: the order changed; read the current order and try again');
  }
}

const invalid = (path: string, reason: string, code: ExitCode = exits.blocked) =>
  new HostError(`agents: ${path}: ${reason}`, code);
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

function regular(
  path: string,
  stat: BigIntStats,
  reason = 'need a private regular file owned by the current user (mode 0600)',
): void {
  if (!stat.isFile() || stat.nlink !== 1n || !privateStat(stat)) throw unsafe(path, reason);
}

export function validateAgentOrder(value: unknown): readonly Host[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 2 ||
    Array.from(value).some((host) => !isHost(host)) ||
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
  return readOrder(repositoryLayout(common));
}

function readOrder(layout: RepositoryLayout): AgentOrder {
  const folder = checkFolder(layout.root);
  const path = layout.agents;
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
    const after = checkFolder(layout.root);
    const current = statAt(path);
    if (!after || !folder || !sameFile(folder, after) || !current || !sameFile(opened, current))
      throw new HostError('the record changed during the read', exits.prerequisite);
    return result;
  } catch (error) {
    if (error instanceof StateError) throw error;
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
  const layout = repositoryLayout(common);
  const folder = ensureFolder(layout.root);
  const lock = layout.agentsLock.path;
  const before = statAt(lock);
  if (before) regular(lock, before, lockReason);
  let opened: BigIntStats | undefined;
  const stable = () => {
    const currentFolder = checkFolder(layout.root);
    const currentLock = statAt(lock);
    if (!opened || !currentFolder || !sameFile(folder, currentFolder) || !currentLock || !sameFile(opened, currentLock))
      throw invalid(lock, 'the directory or lock changed during the write', exits.prerequisite);
    regular(lock, currentLock, lockReason);
  };
  const check = (stage: 'opened' | 'locked', file: BigIntStats) => {
    if (stage === 'locked') return stable();
    regular(lock, file, lockReason);
    if (before && !sameFile(before, file)) throw invalid(lock, 'the lock changed during open', exits.prerequisite);
    opened = file;
  };
  return withLock(
    layout.agentsLock,
    async () => {
      const path = layout.agents;
      const previous = readOrder(layout);
      const existed = statAt(path);
      const next = versioned(order);
      if (expectedVersion === null && existed) return previous;
      if (existed && previous.version === next.version) return previous;
      if (expectedVersion !== null && previous.version !== expectedVersion) {
        if (previous.version === next.version) return previous;
        throw new AgentOrderConflict(previous);
      }
      await writeAtomic(path, serialized(order), {
        check: () => {
          stable();
          const current = statAt(path);
          if (existed ? !current || !sameFile(existed, current) : current !== null)
            throw invalid(path, 'the record changed during the write', exits.prerequisite);
          if (readOrder(layout).version !== previous.version)
            throw invalid(path, 'the content changed during the write', exits.prerequisite);
        },
      });
      return next;
    },
    { check },
  );
}

export async function replaceAgentOrder(common: string, order: unknown, expectedVersion: string): Promise<AgentOrder> {
  const validated = validateAgentOrder(order);
  if (typeof expectedVersion !== 'string' || !orderVersion.test(expectedVersion))
    throw new HostError('agents: expectedVersion must be an order version', exits.usage);
  return updateOrder(common, validated, expectedVersion);
}

export async function initializeAgentOrder(common: string, order: readonly Host[]): Promise<AgentOrder> {
  return updateOrder(common, validateAgentOrder(order), null);
}
