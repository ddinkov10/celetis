import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { HostError } from '../../lib/command/errors.ts';
import { stopLine } from '../../lib/daemon/types.ts';
import type { PluginHost } from '../../lib/host/names.ts';
import { engineSource, installedEngine, readEngine } from '../../lib/install/installation.ts';
import { bunArgs, childEnv } from '../../lib/process/process.ts';
import { containProcess, type Job } from '../../lib/process/windows.ts';
import { recordEvent } from '../../lib/state/events.ts';
import type { PreparedUpdate, UpdateCheck, UpdateResult } from '../../lib/update/updater.ts';
import type { BoardOffer, UpdateStage, UpdateView } from '../types.ts';
import { isUpdateCheck, isUpdateResult, isWorkerRecord, UPDATE_PIPE_LIMIT } from './worker.ts';

export interface UpdateController {
  snapshot(): UpdateView;
  check(): Promise<UpdateView>;
  start(id: string): void;
  restart(): Promise<string>;
  close(): Promise<void>;
}

class WorkerFailure extends Error {
  constructor(
    message: string,
    readonly publicMessage: string,
  ) {
    super(message);
  }
}

type Worker = { done: Promise<UpdateCheck | UpdateResult>; stop(reason: string): void };
type Component = 'engine' | PluginHost;
const pendingParts = (offer: PreparedUpdate): Component[] => [
  ...offer.plugins.filter((plugin) => plugin.installed !== plugin.target).map((plugin) => plugin.host),
  ...(offer.engine.source.revision !== offer.target ? (['engine'] as const) : []),
];

function worker(
  mode: 'check' | 'apply',
  main: string,
  env: NodeJS.ProcessEnv,
  offer: PreparedUpdate | null,
  stage: (value: UpdateStage) => void,
  failed: (reason: string) => void,
): Worker {
  const input = `${JSON.stringify(mode === 'apply' ? { offer } : {})}\n`;
  if (Buffer.byteLength(input) > UPDATE_PIPE_LIMIT) throw new Error('update worker: request is too large');
  const child = spawn(process.execPath, bunArgs(join(import.meta.dir, 'worker.ts'), [mode]), {
    cwd: main,
    env: childEnv({ ...env }),
    shell: false,
    detached: process.platform !== 'win32',
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const owned = new Set<number>();
  let job: Job | null | undefined;
  let failure: string | null = null;
  let result: UpdateCheck | UpdateResult | undefined;
  let buffer = '';
  let diagnostic = '';
  let bytes = 0;
  let exited = false;
  let closed = false;
  let forced = false;
  let settled = false;
  let force: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let drain: ReturnType<typeof setTimeout> | undefined;
  let cleanupCheck: ReturnType<typeof setInterval> | undefined;
  let resolve: (value: UpdateCheck | UpdateResult) => void;
  let reject: (reason: Error) => void;
  const done = new Promise<UpdateCheck | UpdateResult>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const kill = (pid: number, signal: NodeJS.Signals) => {
    try {
      if (process.platform === 'win32') return child.kill(signal);
      return process.kill(-pid, signal);
    } catch {
      return false;
    }
  };
  const groupAlive = () => {
    if (process.platform === 'win32' || !child.pid) return false;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== 'ESRCH';
    }
  };
  const settle = () => {
    if (settled || !exited || (!closed && !forced) || (!forced && (owned.size || groupAlive()))) return;
    settled = true;
    clearTimeout(deadline);
    clearTimeout(force);
    clearTimeout(drain);
    clearInterval(cleanupCheck);
    job?.close();
    if (failure || !result)
      reject(
        new WorkerFailure(
          [failure || 'update worker: no result', diagnostic.trimEnd()].filter(Boolean).join('\n'),
          failure || 'update worker: no result',
        ),
      );
    else resolve(result);
  };
  const stop = (reason?: string) => {
    if (settled) return;
    if (reason && !failure) {
      failure = reason;
      failed(reason);
    }
    if (force !== undefined) return;
    clearTimeout(deadline);
    force = setTimeout(() => {
      forced = true;
      failure = `${failure || 'update worker: owned processes remain after exit'}; forced cleanup; native installation state is uncertain`;
      for (const pid of owned) kill(pid, 'SIGKILL');
      job?.terminate();
      if (child.pid) kill(child.pid, 'SIGKILL');
      child.stdout.destroy();
      child.stderr.destroy();
      child.stdin.destroy();
      settle();
    }, 5000);
    cleanupCheck = setInterval(settle, 50);
    if (child.pid) kill(child.pid, 'SIGTERM');
    settle();
  };
  child.once('error', (error) => {
    exited = true;
    diagnostic += `${error.message}\n`;
    stop('update worker: cannot start');
  });
  child.once('exit', (code, signal) => {
    exited = true;
    if (code !== 0 || signal) stop(`update worker: unexpected exit (${signal || code})`);
    drain = setTimeout(() => stop('update worker: output did not close after exit'), 5000);
    settle();
  });
  child.once('close', () => {
    closed = true;
    clearTimeout(drain);
    if (buffer || !result) stop('update worker: incomplete result');
    if (owned.size) stop('update worker: owned native processes remain after exit');
    if (groupAlive()) stop();
    settle();
  });
  child.stdin.on('error', (error) => {
    diagnostic += `${error.message}\n`;
    stop('update worker: request pipe failed');
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on('error', (error) => {
      diagnostic += `${error.message}\n`;
      stop('update worker: output pipe failed');
    });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  const completed: Component[] = [];
  const pending = offer ? pendingParts(offer) : [];
  let current: Component | null = null;
  child.stdout.on('data', (chunk: string) => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > UPDATE_PIPE_LIMIT) return stop('update worker: output is too large');
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        const record: unknown = JSON.parse(line);
        if (!isWorkerRecord(record) || result) throw new Error('invalid record');
        if (record.type === 'owned') {
          if (record.pid === child.pid || record.pid === process.pid || owned.has(record.pid) === record.active)
            throw new Error('invalid owned process');
          if (record.active) owned.add(record.pid);
          else owned.delete(record.pid);
        } else if (record.type === 'stage') {
          if (mode !== 'apply') throw new Error('stage during check');
          const { part, state } = record.value;
          if (state === 'started') {
            if (current || pending[completed.length] !== part) throw new Error('invalid component start');
            current = part;
          } else {
            if (current !== part) throw new Error('invalid component completion');
            completed.push(part);
            current = null;
          }
          stage(record.value);
        } else {
          if (mode === 'check' ? !isUpdateCheck(record.value) : !isUpdateResult(record.value))
            throw new Error('result has the wrong mode');
          if (mode === 'apply') {
            const value = record.value as UpdateResult;
            if (
              value.target !== offer?.target ||
              !isDeepStrictEqual(value.completed, completed) ||
              !isDeepStrictEqual(
                value.incomplete,
                pending.filter((part) => !completed.includes(part)),
              ) ||
              (value.ok && current !== null)
            )
              throw new Error('result does not match component progress');
          }
          result = record.value;
        }
      } catch {
        stop('update worker: invalid protocol');
        return;
      }
    }
  });
  child.stderr.on('data', (chunk: string) => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > UPDATE_PIPE_LIMIT) stop('update worker: output is too large');
    else diagnostic += chunk;
  });
  if (process.platform === 'win32' && child.pid) {
    try {
      job = containProcess(child.pid);
    } catch (error) {
      diagnostic += `${error instanceof Error ? error.message : String(error)}\n`;
      stop('update worker: cannot contain child processes');
    }
  }
  if (mode === 'check') deadline = setTimeout(() => stop('update worker: check timed out after 120 seconds'), 120000);
  child.stdin.end(input);
  return { done, stop };
}

export function createUpdates({
  main,
  env,
  recovery,
  revision,
  versioned,
  busy,
  relaunch,
}: {
  main: string;
  env: NodeJS.ProcessEnv;
  recovery: string;
  revision: string;
  versioned: boolean;
  busy(): boolean;
  relaunch(target: string): Promise<void>;
}): UpdateController {
  main = realpathSync(main);
  const startupEnv = childEnv({ ...env });
  let view: UpdateView = {
    phase: 'checking',
    offer: null,
    target: null,
    stage: null,
    completed: [],
    incomplete: [],
    error: null,
    recovery,
  };
  let prepared: PreparedUpdate | null = null;
  let offered: PreparedUpdate | null = null;
  let offerId: string | null = null;
  let active: Worker | undefined;
  let checking: Promise<UpdateView> | undefined;
  let applying: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let manual = false;
  let installed: string | null = null;
  let reads = 0;
  let applied = 0;
  let watch: ReturnType<typeof setTimeout> | undefined;
  const shown = (): UpdateView =>
    versioned &&
    installed !== null &&
    installed !== revision &&
    (view.phase === 'current' || view.phase === 'check-failed')
      ? {
          phase: 'restart-needed',
          offer: null,
          target: installed,
          stage: null,
          completed: [],
          incomplete: [],
          error: null,
          recovery,
        }
      : view;
  const snapshot = () => structuredClone(shown());
  const publicFailure = (error: unknown, fallback: string, report = false) => {
    const line = error instanceof Error ? error.message : String(error);
    console.error(line);
    if (report) recordEvent({ name: 'board-update', message: line });
    return error instanceof WorkerFailure ? error.publicMessage : fallback;
  };
  const refusal = (status: 409 | 503, message: string) => Object.assign(new Error(message), { status });
  const unavailable = () => refusal(409, 'this update offer is unavailable or consumed; check again');
  const readInstalled = async () => {
    const read = ++reads;
    try {
      const engine = await readEngine();
      if (engine && engine.revision !== revision && (await engineSource(engine.root)).revision !== engine.revision)
        return;
      if (read > applied) {
        applied = read;
        installed = engine?.revision ?? null;
      }
    } catch {}
  };
  const watchInstalled = async () => {
    await readInstalled();
    if (!closed) watch = setTimeout(() => void watchInstalled(), 5000);
  };
  const restartOn = async (target: string, fallback: string) => {
    try {
      await relaunch(target);
    } catch (error) {
      const line = publicFailure(error, fallback, true);
      view = {
        ...view,
        phase: 'update-failed',
        offer: null,
        error: error instanceof HostError && error.message ? error.message : line,
        recovery,
      };
    }
  };
  const cancelTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    cancelTimer();
    if (!closed && !manual)
      timer = setTimeout(() => {
        void check();
      }, 600000);
  };
  const check = (): Promise<UpdateView> => {
    if (closed || applying || view.phase === 'restarting') return Promise.resolve(snapshot());
    if (checking) return checking;
    cancelTimer();
    manual = false;
    prepared = null;
    view = { ...view, phase: 'checking', offer: null, error: null, recovery };
    const failed = (error: string) => {
      view = { ...view, phase: 'check-failed', offer: null, error, recovery };
    };
    const operation = worker('check', main, startupEnv, null, () => {}, failed);
    active = operation;
    checking = operation.done
      .then((value) => {
        const checked = value as UpdateCheck;
        if (checked.error)
          failed(
            publicFailure(
              checked.error,
              'update: check failed; inspect the installation in a terminal, then check again',
            ),
          );
        else if (checked.offer) {
          prepared = checked.offer;
          if (!offerId || !isDeepStrictEqual(offered, prepared)) offerId = randomUUID();
          offered = structuredClone(prepared);
          const offer: BoardOffer = {
            id: offerId,
            target: prepared.target,
            parts: prepared.parts.flatMap((part) =>
              'installed' in part ? [{ part: part.part, installed: part.installed, target: part.target }] : [],
            ),
          };
          view = {
            phase: 'available',
            offer,
            target: offer.target,
            stage: null,
            completed: [],
            incomplete: [],
            error: null,
            recovery,
          };
        } else {
          offerId = null;
          offered = null;
          view = {
            phase: 'current',
            offer: null,
            target: checked.parts.find((part) => 'target' in part)?.target ?? null,
            stage: null,
            completed: [],
            incomplete: [],
            error: null,
            recovery,
          };
        }
      })
      .catch((error) => failed(publicFailure(error, 'update: check failed')))
      .then(() => {
        active = undefined;
        checking = undefined;
        schedule();
        return snapshot();
      });
    return checking;
  };
  const start = (id: string) => {
    if (
      closed ||
      checking ||
      applying ||
      !prepared ||
      typeof id !== 'string' ||
      id !== offerId ||
      view.phase !== 'available'
    )
      throw unavailable();
    const approved = prepared;
    prepared = null;
    offered = null;
    offerId = null;
    cancelTimer();
    manual = true;
    view = {
      phase: 'updating',
      offer: null,
      target: approved.target,
      stage: null,
      completed: [],
      incomplete: pendingParts(approved),
      error: null,
      recovery,
    };
    const fail = (error: string) => {
      view = { ...view, phase: 'update-failed', offer: null, error, recovery };
    };
    const operation = worker(
      'apply',
      main,
      startupEnv,
      approved,
      (stage) => {
        view.stage = stage;
        if (stage.state === 'completed') {
          view.completed.push(stage.part);
          view.incomplete = view.incomplete.filter((part) => part !== stage.part);
        }
      },
      fail,
    );
    active = operation;
    const finished = operation.done
      .then((value) => {
        const result = value as UpdateResult;
        view.completed = result.completed;
        view.incomplete = result.incomplete;
        if (!result.ok)
          fail(
            publicFailure(
              result.error || 'update failed',
              'update: replacement failed; inspect the installation in a terminal, then check again',
              true,
            ),
          );
        else view = { ...view, phase: versioned ? 'restarting' : 'updated', error: null, recovery };
      })
      .catch((error) => fail(publicFailure(error, 'update: replacement failed', true)))
      .then(() => {
        active = undefined;
        applying = undefined;
      });
    applying = finished;
    void finished.then(async () => {
      if (view.phase !== 'restarting' || closed) return;
      await restartOn(
        approved.target,
        'update: installation completed, but the daemon could not restart; use the recovery command',
      );
    });
  };
  const stopping = () => closed || busy() || view.phase === 'restarting';
  const restart = async () => {
    if (stopping()) throw refusal(503, stopLine);
    await readInstalled();
    const needed = shown();
    if (needed.phase !== 'restart-needed' || needed.target === null)
      throw refusal(409, 'update: no restart is needed; check again');
    const target = needed.target;
    try {
      await installedEngine(target);
    } catch (error) {
      throw refusal(409, error instanceof Error ? error.message : String(error));
    }
    if (stopping()) throw refusal(503, stopLine);
    if (shown().phase !== 'restart-needed') throw refusal(409, 'update: no restart is needed; check again');
    cancelTimer();
    manual = true;
    view = {
      phase: 'restarting',
      offer: null,
      target,
      stage: null,
      completed: [],
      incomplete: [],
      error: null,
      recovery,
    };
    void restartOn(target, 'update: the daemon could not restart; check again');
    return target;
  };
  const close = async () => {
    closed = true;
    cancelTimer();
    clearTimeout(watch);
    active?.stop('update worker: board closed');
    await Promise.all([checking, applying]);
  };
  void check();
  if (versioned) void watchInstalled();
  return { snapshot, check, start, restart, close };
}
