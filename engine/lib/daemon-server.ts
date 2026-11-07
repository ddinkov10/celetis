import { AsyncLocalStorage } from 'node:async_hooks';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync, rmSync } from 'node:fs';
import { realpath, rename, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { format } from 'node:util';
import { celetisAdapter } from '../board/adapter.ts';
import { type BoardDaemon, type BoardHandle, startBoard } from '../board/start.ts';
import { shortRevision } from './daemon-client.ts';
import {
  type DaemonAnswer,
  type DaemonIdentity,
  type DaemonRequest,
  type DaemonStatus,
  daemonPaths,
  parseRequest,
  type QueueAnswer,
  type RunRow,
  requestPaths,
  requestUsage,
  type Selection,
  stopLine,
  textLimit,
} from './daemon-types.ts';
import { installRecorder, recordEvent } from './events.ts';
import { HostError } from './host.ts';
import { createLockOwner, type Identity } from './locks.ts';
import { createOperation, type HostSelection, locateCheckouts, type Operation } from './operation.ts';
import { privateFolderSync, privateRoot, sharedFolderSync } from './private-folder.ts';
import { bunArgs, childEnv } from './process.ts';
import { daemonScript, processStart, processState } from './process-identity.ts';
import { type Program, programPaths, programRevision } from './program.ts';
import { queueSelection, readQueue } from './queue.ts';
import { admitQueue, failQueueLaunch, reconcileQueue } from './queue-actions.ts';
import type { QueueReceipt } from './queue-types.ts';
import { type QuotaRecovery, recoveryOwner, retryQuota } from './quota-recovery.ts';
import {
  type Admission,
  autoLoop,
  createRun,
  gone,
  type Place,
  type RunEnd,
  type RunHandle,
  type RunHooks,
  type RunInput,
  requireSetup,
} from './run-engine.ts';
import { type RunRecord, readRunRecords, removeRunRecord, writeRunRecord } from './run-record.ts';
import { stateFolder } from './state-folder.ts';

type Frame = { id: string; last: string | null };
type Said = Readonly<{ status: number; answer: DaemonAnswer }>;
type Wake = Omit<Extract<DaemonRequest, { kind: 'queue' }>, 'kind'>;
type Answer = 'none' | 'pending' | 'sent' | 'refused';
type Entry = { handle: RunHandle; frame: Frame; outcome: RunRow['outcome']; settled: Promise<void>; answer: Answer };
type Loop = {
  control: { active: boolean; leaving: boolean };
  abort: AbortController;
  admitted: Promise<Admission>;
  done: Promise<void>;
  selection: Selection;
  quiet: boolean;
};
type AutoRequest = Extract<DaemonRequest, { kind: 'auto' }>;
type Successor = Readonly<{ program: Program; auto: Readonly<{ selection: Selection; quiet: boolean }> | null }>;
type Spawn = Successor & Readonly<{ port: number; start: string; main: string; log: string }>;
type Carried = AutoRequest | Readonly<{ refused: string }>;
type Handover = Readonly<{ after: Identity | null; auto: Carried | null }>;

const takeoverLine = 'daemon: the daemon takes over its runs; send the request again after its start';
const removedLine = 'daemon: the program version of this daemon was removed after an update; start the daemon again';
const boardRequests: ReadonlySet<DaemonRequest['kind']> = new Set([
  'run',
  'resume',
  'retry',
  'queue-action',
  'queue-reconcile',
]);
const bodyLimit = 16 * 1024;
const root = resolve(import.meta.dir, '../..');

const clip = (line: string) => line.slice(0, textLimit);
const printable = (text: string) =>
  [...text]
    .map((character) => (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character))
    .join('');
const reply = (status: number, value: DaemonAnswer | QueueAnswer | DaemonStatus) => Response.json(value, { status });
const refused = (status: number, line: string, code: number): Said => ({
  status,
  answer: { accepted: false, line: clip(line), code },
});
const send = ({ status, answer }: Said) => reply(status, answer);
const refusal = (status: number, line: string, code: number) => send(refused(status, line, code));
const codeOf = (error: unknown) => (error instanceof HostError ? error.code : 1);
const described = (error: unknown) => (error instanceof Error ? error.message : String(error));
const crashed = (error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  return refusal(500, `daemon: ${described(error)}`, 1);
};

function routeOutput(frames: AsyncLocalStorage<Frame>): void {
  const decoder = new TextDecoder();
  const tagged = (text: string) => {
    const frame = frames.getStore();
    const tag = `${new Date().toISOString()} ${frame ? frame.id.slice(0, 8) : 'daemon'}`;
    const lines = (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
    for (const line of lines) if (frame && line.startsWith('daemon: ')) frame.last = line;
    return lines.map((line) => `${tag} ${line}`).join('\n');
  };
  const log = console.log;
  const error = console.error;
  console.log = (...args: unknown[]) => Reflect.apply(log, console, [tagged(format(...args))]);
  console.error = (...args: unknown[]) => Reflect.apply(error, console, [tagged(format(...args))]);
  const wrap = (stream: NodeJS.WriteStream) => {
    const write = stream.write;
    stream.write = function (this: unknown, chunk: unknown, ...rest: unknown[]): boolean {
      const text = typeof chunk === 'string' ? chunk : chunk instanceof Uint8Array ? decoder.decode(chunk) : '';
      return Reflect.apply(write, this, [text ? `${tagged(text)}\n` : chunk, ...rest]);
    };
  };
  wrap(process.stdout);
  wrap(process.stderr);
}

async function bodyText(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > bodyLimit) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body)
    for await (const chunk of request.body) {
      size += chunk.byteLength;
      if (size > bodyLimit) return null;
      chunks.push(chunk);
    }
  return Buffer.concat(chunks).toString('utf8');
}

async function writeIdentity(file: string, identity: DaemonIdentity): Promise<void> {
  const temp = join(dirname(file), `.daemon.${randomUUID()}`);
  try {
    await writeFile(temp, `${JSON.stringify(identity)}\n`, { mode: 0o600, flag: 'wx' });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

function handoverOf(argv: readonly string[]): Handover | null {
  if (!argv.length) return { after: null, auto: null };
  const [flag, pid, start, option, value, ...rest] = argv;
  if (
    flag !== '--after' ||
    !/^[1-9][0-9]*$/.test(pid ?? '') ||
    !Number.isSafeInteger(Number(pid)) ||
    !start ||
    rest.length
  )
    return null;
  const after = { pid: Number(pid), start };
  if (option === undefined) return { after, auto: null };
  if (option !== '--auto' || value === undefined) return null;
  return { after, auto: carriedAuto(value) };
}

function carriedAuto(value: string): Carried {
  let carried: unknown = null;
  try {
    carried = JSON.parse(value);
  } catch {}
  if (carried !== null && typeof carried === 'object' && !Array.isArray(carried)) {
    const request = parseRequest('POST', '/auto', { on: true, ...carried });
    if (!('status' in request) && request.kind === 'auto' && request.on) return request;
  }
  return { refused: value };
}

async function outlived({ pid, start }: Identity): Promise<boolean> {
  const deadline = Date.now() + 60_000;
  while ((await processState(pid, start)) !== 'gone') {
    if (Date.now() >= deadline) {
      console.error(`daemon: the daemon PID ${pid} did not exit within 60 seconds; this successor stops`);
      return false;
    }
    await Bun.sleep(250);
  }
  return true;
}

async function inVersionFolder(revision: string): Promise<boolean> {
  try {
    return (await realpath(root)) === (await realpath(join(programPaths().versions, revision)));
  } catch {
    return false;
  }
}

async function startSuccessor({ program, auto, port, start, main, log }: Spawn): Promise<number> {
  const env = childEnv({ ...process.env, PORT: String(port) });
  delete env.HC_SCOPE;
  const args = ['--daemon', '--after', String(process.pid), start, ...(auto ? ['--auto', JSON.stringify(auto)] : [])];
  try {
    const out = openSync(log, 'a', 0o600);
    try {
      const child = spawn(process.execPath, bunArgs(join(program.root, 'engine', daemonScript), args), {
        detached: true,
        stdio: ['ignore', out, out],
        env,
        cwd: main,
      });
      await new Promise<void>((spawned, failed) => {
        child.once('spawn', spawned);
        child.once('error', failed);
      });
      child.unref();
    } finally {
      closeSync(out);
    }
    return 0;
  } catch (error) {
    console.error(`daemon: cannot start the successor: ${described(error)}; run celetis daemon start`);
    return 1;
  }
}

export async function runDaemon(argv: readonly string[]): Promise<number> {
  if (process.platform === 'win32') {
    console.error('daemon: Windows is not a support target');
    return 2;
  }
  installRecorder('daemon');
  const frames = new AsyncLocalStorage<Frame>();
  routeOutput(frames);
  const handover = handoverOf(argv);
  if (handover === null) {
    console.error('daemon: invalid internal request');
    return 2;
  }
  try {
    if (handover.after && !(await outlived(handover.after))) return 1;
    const { code, successor } = await serve(frames, handover);
    return successor ? await startSuccessor(successor) : code;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

async function serve(
  frames: AsyncLocalStorage<Frame>,
  handover: Handover,
): Promise<{ code: number; successor: Spawn | null }> {
  const checkout = await locateCheckouts(process.cwd());
  if (checkout.main === null || checkout.common === null) throw new HostError('celetis: need a Git checkout', 2);
  const { main, common } = checkout;
  const place: Place = { main, common, state: await stateFolder(common), root };
  const paths = await daemonPaths(common);
  const fail = (path: string, reason: string) => new HostError(`daemon: ${path}: ${reason}`);
  sharedFolderSync(place.state, fail);
  for (const folder of [paths.folder, paths.runs, privateRoot, dirname(paths.socket)]) privateFolderSync(folder, fail);
  const start = await processStart(process.pid);
  if (!start)
    throw new HostError(
      'daemon: cannot read the process start of the daemon; allow process access and start the daemon again',
    );
  const identity: DaemonIdentity = {
    schema: 1,
    pid: process.pid,
    start,
    revision: await programRevision(root),
    main,
    common,
    socket: paths.socket,
  };
  const owner = createLockOwner(main, start);
  const holder = await owner.take('daemon');
  if (holder !== null) {
    console.error(`daemon: another daemon of this repository has PID ${holder}; this one stops`);
    return { code: 1, successor: null };
  }

  const entries = new Map<string, Entry>();
  const loops = new Set<Loop>();
  const opened = Promise.withResolvers<BoardHandle>();
  let board: BoardHandle | undefined;
  let taking = true;
  let stopping = false;
  let code = 0;
  const claim: { successor: Successor | null } = { successor: null };
  let wake: () => void = () => {};
  const asked = new Promise<void>((done) => {
    wake = done;
  });
  const stop = (status: number, line?: string) => {
    if (stopping && claim.successor === null) {
      if (status === 1) code = status;
      return;
    }
    code = status;
    if (line) frames.exit(() => console.error(line));
    if (stopping) {
      claim.successor = null;
      frames.exit(() => console.error('daemon: the stop cancels the restart; no successor starts'));
      return;
    }
    stopping = true;
    wake();
  };
  const restart = (program: Program) => {
    if (stopping) return;
    frames.exit(() => console.log(`daemon: restarts on the program at ${shortRevision(program.revision)}`));
    const kept = [...loops].find(({ control }) => control.active && !control.leaving);
    claim.successor = { program, auto: kept ? { selection: kept.selection, quiet: kept.quiet } : null };
    stop(0);
  };
  const fatal = () => stop(1);
  const removed = () => stop(1, removedLine);
  const hooksOf = (gh: boolean): RunHooks => ({ ready: () => requireSetup(gh), removed, fatal });

  const ended = (entry: Entry, end: RunEnd) => {
    if (end.kind === 'detached') return;
    entry.outcome = { kind: end.kind, reason: clip(end.reason), code: end.code };
    if (end.code !== 0)
      recordEvent({
        name: 'run-exit',
        message: entry.frame.last ?? end.reason,
        issue: entry.handle.view().issue,
        code: end.code,
      });
  };
  const failed = (entry: Entry, error: unknown) => {
    const message = described(error);
    frames.run(entry.frame, () => console.error(error instanceof Error ? (error.stack ?? message) : message));
    entry.outcome = { kind: 'stopped', reason: clip(message), code: 1 };
    recordEvent({ name: 'run-defect', message, issue: entry.handle.view().issue, error });
  };
  const journal = (record: RunRecord) =>
    writeRunRecord(paths.runs, record).catch((error: unknown) => {
      throw new HostError(
        `daemon: cannot write the run record ${join(paths.runs, `${record.id}.json`)}: ${described(error)}`,
      );
    });
  const forget = async (entry: Entry, end: RunEnd | null) => {
    if (end?.kind === 'detached' && (entry.answer === 'none' || entry.answer === 'sent')) return;
    await removeRunRecord(paths.runs, entry.handle.id).catch((error: unknown) =>
      frames.run(entry.frame, () => console.error(`daemon: cannot remove the run record: ${described(error)}`)),
    );
  };
  const launch = <T extends Readonly<{ handle: RunHandle }>>(start: () => T, answer: Answer = 'none'): T => {
    const frame: Frame = { id: '', last: null };
    const run = frames.run(frame, start);
    const { handle } = run;
    frame.id = handle.id;
    const entry: Entry = { handle, frame, outcome: null, settled: Promise.resolve(), answer };
    entry.settled = handle.done.then(
      async (end) => {
        ended(entry, end);
        await forget(entry, end);
      },
      async (error: unknown) => {
        failed(entry, error);
        await forget(entry, null);
      },
    );
    entries.set(handle.id, entry);
    if (stopping) handle.detach();
    return run;
  };
  const begin = (input: RunInput, gh: boolean) =>
    launch(() => ({ handle: createRun(place, input, { hooks: hooksOf(gh), journal }) }), 'pending').handle;
  const openLoop = (selection: Selection, quiet: boolean, adopted?: Promise<number>): Loop => {
    const control = { active: true, leaving: false };
    const abort = new AbortController();
    const started = autoLoop(
      place,
      { selection, quiet },
      {
        hooks: { ready: () => requireSetup(true), removed, fatal },
        active: () => control.active,
        signal: abort.signal,
        launch,
        leaving: () => {
          control.leaving = true;
        },
        journal,
        adopted,
      },
    );
    const loop: Loop = {
      control,
      abort,
      admitted: started.admitted,
      done: started.done
        .then(
          () => {},
          (error: unknown) => {
            console.error(error instanceof Error ? (error.stack ?? described(error)) : described(error));
            recordEvent({ name: 'run-defect', message: described(error), error });
          },
        )
        .finally(() => {
          loops.delete(loop);
        }),
      selection,
      quiet,
    };
    loops.add(loop);
    return loop;
  };

  const row = async ({ handle, frame, outcome }: Entry): Promise<RunRow> => {
    const view = handle.view();
    return {
      id: handle.id,
      kind: handle.input.kind,
      issue: view.issue,
      numbers: view.numbers === null ? null : [...view.numbers],
      step: view.step,
      host: view.host,
      tab: view.tab,
      state: view.state,
      line: frame.last === null ? null : clip(frame.last),
      changedMs: view.changedMs,
      session: view.barrier === null ? null : await processState(view.barrier.pid, view.barrier.start),
      outcome,
    };
  };
  const status = async (): Promise<DaemonStatus> => ({
    schema: 1,
    daemon: identity,
    board: (await opened.promise).url,
    auto: [...loops].some(({ control }) => control.active && !control.leaving) ? 'on' : loops.size ? 'stopping' : 'off',
    runs: await Promise.all([...entries.values()].map(row)),
  });
  const verdict = (admission: Admission, run: string | null): Said => {
    if (stopping) return refused(503, stopLine, 1);
    if (admission.ok) return { status: 200, answer: { accepted: true, run } };
    return refused(409, admission.line, admission.code);
  };
  const runVerdict = async (handle: RunHandle): Promise<Said> => {
    const said = verdict(await handle.admitted, handle.id);
    const entry = entries.get(handle.id);
    if (entry) entry.answer = said.status === 200 ? 'sent' : 'refused';
    return said;
  };
  const answerRun = async (handle: RunHandle) => send(await runVerdict(handle));
  const accepted: Said = { status: 200, answer: { accepted: true, run: null } };
  let autoRequests = 0;
  const auto = async ({ on, selection, quiet }: AutoRequest, adopted?: Promise<number>): Promise<Said> => {
    const request = ++autoRequests;
    if (!on) {
      for (const loop of loops) loop.control.active = false;
      return accepted;
    }
    for (;;) {
      if (stopping) return refused(503, stopLine, 1);
      if (request !== autoRequests) return accepted;
      const kept = [...loops].find((each) => !each.control.leaving);
      if (kept) {
        kept.control.active = true;
        return verdict(await kept.admitted, null);
      }
      if (!loops.size) break;
      await Promise.all([...loops].map((each) => each.done));
    }
    return verdict(await openLoop(selection, quiet, adopted).admitted, null);
  };
  const wakeQueue = async ({ id, token, selection, quiet }: Wake) => {
    let pinned: HostSelection;
    try {
      pinned = queueSelection(await readQueue(main, common, createLockOwner(main)), 'act', selection);
    } catch (error) {
      console.error(described(error));
      return refused(409, described(error), codeOf(error));
    }
    return runVerdict(begin({ kind: 'queue', id, token, selection: pinned, quiet }, true));
  };
  const changeQueue = async (
    use: 'add' | 'act' | 'read',
    selection: Selection,
    quiet: boolean,
    change: (operation: Operation) => Promise<QueueReceipt>,
  ) => {
    let operation: Operation;
    let receipt: QueueReceipt;
    try {
      const queue = await readQueue(main, common, createLockOwner(main));
      operation = await createOperation(checkout, queueSelection(queue, use, selection), 'main');
      receipt = await change(operation);
    } catch (error) {
      return refusal(409, described(error), codeOf(error));
    }
    const { view, wake } = receipt;
    if (!wake) return reply(200, { accepted: true, run: null, view });
    const said = await wakeQueue({ id: wake.id, token: wake.token, selection, quiet });
    if (said.answer.accepted) return reply(said.status, { ...said.answer, view });
    if (said.status !== 503)
      await failQueueLaunch(operation, wake.id, wake.token, said.answer.line).catch((error: unknown) =>
        console.error(`daemon: cannot record the launch failure in the queue: ${described(error)}`),
      );
    return send(said);
  };
  const respond = async (request: Request): Promise<Response> => {
    if (stopping && claim.successor === null) return refusal(503, stopLine, 1);
    let body: unknown = null;
    if (request.method === 'POST') {
      const text = await bodyText(request);
      if (text === null) return refusal(413, `daemon: a request body has at most ${bodyLimit} bytes`, 2);
      try {
        body = JSON.parse(text);
      } catch {
        return refusal(400, requestUsage, 2);
      }
    }
    const parsed = parseRequest(request.method, new URL(request.url).pathname, body);
    if ('status' in parsed) return refusal(parsed.status, parsed.line, 2);
    if (stopping && (parsed.kind !== 'stop' || claim.successor === null)) return refusal(503, stopLine, 1);
    if (taking && boardRequests.has(parsed.kind)) return refusal(503, takeoverLine, 1);
    switch (parsed.kind) {
      case 'status':
        return reply(200, await status());
      case 'stop':
        stop(0);
        return reply(200, { accepted: true, run: null });
      case 'auto':
        return send(await auto(parsed));
      case 'queue':
        return send(await wakeQueue(parsed));
      case 'queue-action': {
        const { action, selection, quiet } = parsed;
        return changeQueue(action.kind === 'add' ? 'add' : 'act', selection, quiet, (operation) =>
          admitQueue(operation, action),
        );
      }
      case 'queue-reconcile':
        return changeQueue('read', {}, true, (operation) => reconcileQueue(operation));
      case 'run': {
        const { number, selection, effort, quiet } = parsed;
        return answerRun(begin({ kind: 'number', number, selection, effort, quiet }, true));
      }
      case 'resume':
        return answerRun(begin({ kind: 'resume', number: parsed.number, selection: parsed.selection }, false));
      case 'retry': {
        const { number, waitId } = parsed;
        const waiting = async (record: QuotaRecovery) =>
          record.daemon.pid === identity.pid && record.daemon.start === identity.start
            ? [...entries.values()].some(({ handle }) => {
                const view = handle.view();
                return view.issue === number && view.state !== 'ending' && view.state !== 'finished';
              })
            : recoveryOwner(record);
        try {
          await retryQuota(main, number, waitId, waiting);
        } catch (error) {
          if (!(error instanceof HostError)) throw error;
          return refusal(409, error.message, error.code);
        }
        return reply(200, { accepted: true, run: null });
      }
    }
  };

  const answering = new Set<Promise<Response>>();
  const dispatcher: BoardDaemon = {
    send: async ({ kind, ...fields }) => {
      const request = new Request(`http://daemon${requestPaths[kind]}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const answer = respond(request).catch(crashed);
      answering.add(answer);
      try {
        return await (await answer).json();
      } finally {
        answering.delete(answer);
      }
    },
    status,
  };

  const handlers = new Map<NodeJS.Signals, () => void>();
  try {
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const handler = () => stop(128 + constants.signals[signal]);
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    const port = (await createOperation(checkout, {}, 'main')).mainConfig?.board?.port ?? 4403;
    board = await startBoard(main, port, await celetisAdapter(main, dispatcher), {
      env: process.env,
      revision: identity.revision,
      successor: handover.after !== null,
      versioned: await inVersionFolder(identity.revision),
      restarting: () => stopping,
      restart,
    });
    opened.resolve(board);
    for (const read of await readRunRecords(paths.runs, common)) {
      if ('error' in read) {
        console.error(`daemon: cannot take over ${read.path}: ${read.error}; its session stays in its tab`);
        continue;
      }
      const { record } = read;
      const run = launch(() => ({
        handle: createRun(place, record.input, {
          hooks: hooksOf(record.input.kind !== 'resume'),
          locks: createLockOwner(main),
          journal,
          from: record,
        }),
      }));
      await run.handle.admitted;
    }
    taking = false;
    rmSync(paths.socket, { force: true });
    const server = Bun.serve({ unix: paths.socket, fetch: respond, error: crashed });
    await writeIdentity(paths.identity, identity);
    console.log(`daemon: PID ${process.pid} serves ${paths.socket}`);
    const poll = setInterval(() => {
      void gone(root).then((missing) => {
        if (missing) removed();
      });
    }, 5000);
    if (handover.auto && 'refused' in handover.auto)
      console.error(
        `daemon: this program refuses the carried auto mode ${clip(printable(handover.auto.refused))}; auto mode stays off`,
      );
    else if (handover.auto) {
      const adopted = [...entries.values()].filter(({ handle }) => handle.input.kind === 'auto');
      const endCode = Promise.all(adopted.map(({ settled }) => settled)).then(
        () => adopted.map(({ outcome }) => outcome?.code ?? 0).find((code) => code !== 0) ?? 0,
      );
      const said = await auto(handover.auto, endCode);
      // The loop prints the line of its own refusal; only the stop refusal is not in the log yet.
      if (said.status === 503 && !said.answer.accepted) console.error(said.answer.line);
    }
    await asked;
    clearInterval(poll);
    for (const { handle } of entries.values()) handle.detach();
    for (const loop of loops) {
      loop.control.active = false;
      loop.abort.abort();
    }
    const settle = async () => {
      let waited = -1;
      while (waited < entries.size || loops.size) {
        waited = entries.size;
        await Promise.all([
          ...[...entries.values()].map((each) => each.settled),
          ...[...loops].map((each) => each.done),
        ]);
      }
    };
    await settle();
    await Promise.race([Promise.all(answering), Bun.sleep(5000)]);
    await settle();
    await board.close();
    const closed = await Promise.race([server.stop().then(() => true), Bun.sleep(5000).then(() => false)]);
    if (!closed) await server.stop(true);
    await rm(paths.identity, { force: true });
    const { successor } = claim;
    return { code, successor: successor && { ...successor, port: board.port, start, main, log: paths.log } };
  } finally {
    for (const [signal, handler] of handlers) process.off(signal, handler);
    await board?.close();
    await owner.releaseAll();
  }
}
