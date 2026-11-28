import { z } from 'zod';
import { exits } from '../../lib/contract/contract.ts';
import { installRecorder, markDefect } from '../../lib/state/events.ts';
import { fits } from '../../lib/state/schemas.ts';
import {
  type PreparedUpdate,
  preparedUpdate,
  type UpdateCheck,
  type UpdateResult,
  updateCheck,
  updateResult,
} from '../../lib/update/offer.ts';
import { type UpdateStage, updateStage } from '../../lib/update/types.ts';

export const UPDATE_PIPE_LIMIT = 1024 * 1024;
const workerRecord = z.union([
  z.strictObject({ type: z.literal('stage'), value: updateStage }),
  z.strictObject({ type: z.literal('owned'), pid: z.int().gt(1), active: z.boolean() }),
  z.strictObject({ type: z.literal('result'), value: z.union([updateCheck, updateResult]) }),
]);
export type WorkerRecord = z.output<typeof workerRecord>;
const checkRequest = z.strictObject({});
const applyRequest = z.strictObject({ offer: preparedUpdate });

export const isPreparedUpdate = (value: unknown): value is PreparedUpdate => preparedUpdate.safeParse(value).success;
export const isUpdateCheck = (value: unknown): value is UpdateCheck => updateCheck.safeParse(value).success;
export const isUpdateResult = (value: unknown): value is UpdateResult => updateResult.safeParse(value).success;
export const isUpdateStage = (value: unknown): value is UpdateStage => updateStage.safeParse(value).success;
export const isWorkerRecord = (value: unknown): value is WorkerRecord => workerRecord.safeParse(value).success;

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
  const offer = mode === 'apply' && fits(applyRequest, request) ? request.offer : undefined;
  if (mode === 'check' ? !fits(checkRequest, request) : offer === undefined)
    throw new Error('update worker: invalid request');
  const { inspectUpdate, executeUpdate } = await import('../../lib/update/updater.ts');
  const { observeUpdateChildren } = await import('../../lib/update/lock.ts');
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
      offer === undefined
        ? await inspectUpdate(process.cwd())
        : await executeUpdate(offer, (value) => send({ type: 'stage', value }), parent);
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
