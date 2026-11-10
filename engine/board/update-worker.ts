import { isDeepStrictEqual } from 'node:util';
import { exits } from '../lib/contract.ts';
import { installRecorder, markDefect } from '../lib/events.ts';
import { revision } from '../lib/fields.ts';
import { isHost } from '../lib/host-names.ts';
import type { PreparedUpdate, UpdateCheck, UpdateResult, UpdateStage } from '../lib/updater.ts';

export const UPDATE_PIPE_LIMIT = 1024 * 1024;
export type WorkerRecord =
  | { type: 'stage'; value: UpdateStage }
  | { type: 'owned'; pid: number; active: boolean }
  | { type: 'result'; value: UpdateCheck | UpdateResult };

const part = (value: unknown) => value === 'engine' || isHost(value);
const text = (value: unknown): value is string => typeof value === 'string' && !value.includes('\0');
const sha = (value: unknown): value is string => text(value) && revision.test(value);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) =>
  Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const parts = (value: unknown) => Array.isArray(value) && value.every(part) && new Set(value).size === value.length;

export function isPreparedUpdate(value: unknown): value is PreparedUpdate {
  if (!object(value) || !sha(value.target) || !isParts(value.parts) || !object(value.engine)) return false;
  const target = (value.parts as Record<string, unknown>[]).find((entry) => entry.part === 'engine')?.target;
  if (target !== value.target) return false;
  const { installed, source } = value.engine;
  if (
    !object(installed) ||
    !['root', 'entry', 'command'].every((key) => text(installed[key])) ||
    !sha(installed.revision) ||
    !object(source) ||
    !text(source.source) ||
    !text(source.branch) ||
    !sha(source.revision) ||
    !Array.isArray(value.plugins) ||
    value.plugins.length > 2
  )
    return false;
  return (
    value.plugins.every(
      (plugin) =>
        object(plugin) &&
        isHost(plugin.host) &&
        ['home', 'root', 'source', 'ref', 'resolvedRef'].every((key) => text(plugin[key])) &&
        sha(plugin.installed) &&
        sha(plugin.target) &&
        (plugin.scope === undefined || text(plugin.scope)) &&
        strings(plugin.siblings),
    ) && new Set(value.plugins.map((plugin) => plugin.host)).size === value.plugins.length
  );
}

function isParts(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= 3 &&
    value.every(
      (entry) =>
        object(entry) &&
        part(entry.part) &&
        (text(entry.error) ||
          text(entry.skipped) ||
          (['root', 'source', 'ref'].every((key) => text(entry[key])) &&
            sha(entry.installed) &&
            sha(entry.target) &&
            (entry.part === 'engine' || text(entry.home)))),
    ) &&
    new Set(value.map((entry) => entry.part)).size === value.length
  );
}

export function isUpdateCheck(value: unknown): value is UpdateCheck {
  return (
    object(value) &&
    keys(value, ['parts', 'offer', 'error']) &&
    isParts(value.parts) &&
    (value.error === null || text(value.error)) &&
    (value.offer === null ||
      (value.error === null && isPreparedUpdate(value.offer) && isDeepStrictEqual(value.offer.parts, value.parts)))
  );
}

export function isUpdateResult(value: unknown): value is UpdateResult {
  return (
    object(value) &&
    keys(value, ['ok', 'target', 'completed', 'incomplete', 'error']) &&
    typeof value.ok === 'boolean' &&
    sha(value.target) &&
    parts(value.completed) &&
    parts(value.incomplete) &&
    (value.error === null || text(value.error)) &&
    (!value.ok || (value.error === null && (value.incomplete as unknown[]).length === 0)) &&
    !(value.completed as unknown[]).some((entry) => (value.incomplete as unknown[]).includes(entry))
  );
}

export function isUpdateStage(value: unknown): value is UpdateStage {
  return (
    object(value) &&
    keys(value, ['part', 'state']) &&
    part(value.part) &&
    (value.state === 'started' || value.state === 'completed')
  );
}

export function isWorkerRecord(value: unknown): value is WorkerRecord {
  if (!object(value)) return false;
  if (value.type === 'owned')
    return (
      keys(value, ['type', 'pid', 'active']) &&
      Number.isSafeInteger(value.pid) &&
      (value.pid as number) > 1 &&
      typeof value.active === 'boolean'
    );
  if (!keys(value, ['type', 'value'])) return false;
  if (value.type === 'stage') return isUpdateStage(value.value);
  return value.type === 'result' && (isUpdateCheck(value.value) || isUpdateResult(value.value));
}

async function main(): Promise<void> {
  const parent = process.ppid;
  const mode = process.argv[2];
  if (process.argv.length !== 3 || (mode !== 'check' && mode !== 'apply'))
    throw new Error('update worker: invalid mode');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > UPDATE_PIPE_LIMIT) throw new Error('update worker: request is too large');
  }
  const request: unknown = JSON.parse(input);
  if (
    !object(request) ||
    (mode === 'check' ? !keys(request, []) : !keys(request, ['offer']) || !isPreparedUpdate(request.offer))
  )
    throw new Error('update worker: invalid request');
  const { inspectUpdate, executeUpdate } = await import('../lib/updater.ts');
  const { observeUpdateChildren } = await import('../lib/update-lock.ts');
  const owned = new Set<number>();
  const send = (value: WorkerRecord) => process.stdout.write(`${JSON.stringify(value)}\n`);
  let stopping = false;
  let force: ReturnType<typeof setTimeout> | undefined;
  const signal = (pid: number, name: NodeJS.Signals) => {
    try {
      process.kill(process.platform === 'win32' ? pid : -pid, name);
    } catch {}
  };
  const stop = () => {
    if (stopping) return;
    stopping = true;
    force = setTimeout(() => {
      console.error('update worker: forced cleanup; native installation state is uncertain');
      for (const pid of owned) signal(pid, 'SIGKILL');
      signal(process.pid, 'SIGKILL');
    }, 5000);
  };
  const removeObserver = observeUpdateChildren((pid, active) => {
    if (active) owned.add(pid);
    else owned.delete(pid);
    send({ type: 'owned', pid, active });
  });
  const lostParent = () => {
    try {
      process.kill(parent, 0);
      if (process.ppid === parent) return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' && process.ppid === parent) return;
    }
    stop();
    signal(process.pid, 'SIGTERM');
  };
  const watch = setInterval(lostParent, 250);
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
  for (const name of signals) process.on(name, stop);
  process.stdout.on('error', stop);
  try {
    lostParent();
    const value =
      mode === 'check'
        ? await inspectUpdate(process.cwd())
        : await executeUpdate(request.offer as PreparedUpdate, (value) => send({ type: 'stage', value }), parent);
    if (!stopping) send({ type: 'result', value });
  } finally {
    clearInterval(watch);
    clearTimeout(force);
    removeObserver();
    for (const name of signals) process.off(name, stop);
    process.stdout.off('error', stop);
  }
}

if (import.meta.main) {
  installRecorder('update-worker');
  main().catch((error) => {
    markDefect(error);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = exits.internal;
  });
}
