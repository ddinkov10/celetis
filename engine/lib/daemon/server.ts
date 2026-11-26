import { AsyncLocalStorage } from 'node:async_hooks';
import { rmSync } from 'node:fs';
import { realpath, rm } from 'node:fs/promises';
import { constants } from 'node:os';
import { join, resolve } from 'node:path';
import { format } from 'node:util';
import { type BoardDaemon, celetisAdapter } from '../../board/adapter.ts';
import { type BoardHandle, startBoard } from '../../board/start.ts';
import { HostError } from '../command/errors.ts';
import { createOperation, type HostSelection, locateCheckouts, type Operation } from '../command/operation.ts';
import { readAsDaemon } from '../config/config.ts';
import type { Config } from '../config/core.ts';
import { type ExitCode, exits, signalExit } from '../contract/contract.ts';
import { createCoordinator } from '../coordinator/coordinator.ts';
import { type Engine, enginePaths } from '../install/installation.ts';
import { versionFolderGone } from '../install/version-folder.ts';
import { landingResult, type PressAnswer, type PressIo, pressDiscard, pressLand } from '../landing/press.ts';
import { processStart, processState } from '../process/identity.ts';
import { childEnv } from '../process/process.ts';
import { holdFolder, makePrivateFolder, privateFolderProblem } from '../process/windows.ts';
import { admitQueue, failQueueLaunch, reconcileQueue } from '../queue/actions.ts';
import { queueSelection, readQueue } from '../queue/queue.ts';
import { setAside } from '../queue/set-aside.ts';
import type { QueueReceipt } from '../queue/types.ts';
import { engineRevision } from '../release/release.ts';
import {
  type Admission,
  autoLoop,
  createRun,
  type Place,
  type RunEnd,
  type RunHandle,
  type RunHooks,
  type RunInput,
  type RunState,
  type RunView,
  requireSetup,
  unwatched,
} from '../run/engine.ts';
import { type QuotaRecovery, recoveryOwner, retryQuota } from '../run/quota-recovery.ts';
import { type RunRecord, readRunRecords, removeRunRecord, writeRunRecord } from '../run/record.ts';
import { installRecorder, recordEvent } from '../state/events.ts';
import { createLockOwner, type Identity, issueLock, landLock } from '../state/locks.ts';
import { daemonSockets, ensureFolder, privateState, writeAtomic } from '../state/state.ts';
import type { IssueKey } from '../tracker/key.ts';
import { shortRevision, socketFolderRefusal } from './client.ts';
import { createLandings, type Sink } from './landing.ts';
import { createLifecycle, type LifecycleData } from './lifecycle.ts';
import { daemonArgv, startDetached } from './start.ts';
import {
  type CoordinatorAnswer,
  codexStopLine,
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
  type ScreenAnswer,
  type Selection,
  stopLine,
  textLimit,
} from './types.ts';

type Frame = { tag: string; last: string | null; sink: Sink | null };
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
};
type AutoRequest = Extract<DaemonRequest, { kind: 'auto' }>;
type Successor = Readonly<{ engine: Engine; auto: Readonly<{ selection: Selection }> | null }>;
type Spawn = Successor & Readonly<{ port: number; start: string; main: string; log: string }>;
type Carried = AutoRequest | Readonly<{ refused: string }>;
type Handover = Readonly<{ after: Identity | null; auto: Carried | null }>;

const takeoverLine = 'daemon: the daemon takes over its runs; send the request again after its start';
const removedLine = 'daemon: the engine version of this daemon was removed after an update; start the daemon again';
const boardRequests: ReadonlySet<DaemonRequest['kind']> = new Set([
  'run',
  'resume',
  'assist',
  'retry',
  'aside',
  'halt',
  'queue-action',
  'queue-reconcile',
  'held-land',
  'held-discard',
]);
const bodyLimit = 16 * 1024;
const stoppable: ReadonlySet<RunState> = new Set(['running', 'waiting', 'checking', 'stopping']);

export function stopRefusal(
  number: IssueKey,
  view: RunView | null,
  kind: RunInput['kind'] | null,
  landing: boolean,
  terminal: string,
): string | null {
  if (view === null || kind === null)
    return `#${number} has no live run of the daemon; close its tab, then use Set aside`;
  if (landing) return `a landing of #${number} runs. Wait for the landing to end, then stop again.`;
  if (view.terminal !== terminal)
    return `the card of #${number} is stale: its run has another session now; read the board again`;
  if (!stoppable.has(view.state)) return `#${number} has no session that runs now`;
  if (view.host === 'codex') return codexStopLine;
  return null;
}

export function landingStopRefusal(
  number: IssueKey,
  views: readonly Pick<RunView, 'issue' | 'state'>[],
): string | null {
  return views.some((view) => view.issue === number && view.state === 'stopping')
    ? `#${number} is stopping; the landing does not start`
    : null;
}
const root = resolve(import.meta.dir, '../../..');

const clip = (line: string) => line.slice(0, textLimit);
const printable = (text: string) =>
  [...text]
    .map((character) => (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character))
    .join('');
const reply = (status: number, value: DaemonAnswer | QueueAnswer | CoordinatorAnswer | ScreenAnswer | DaemonStatus) =>
  Response.json(value, { status });
const refused = (status: number, line: string, code: ExitCode): Said => ({
  status,
  answer: { accepted: false, line: clip(line), code },
});
const send = ({ status, answer }: Said) => reply(status, answer);
const refusal = (status: number, line: string, code: ExitCode) => send(refused(status, line, code));
const codeOf = (error: unknown) => (error instanceof HostError ? error.code : exits.internal);
const described = (error: unknown) => (error instanceof Error ? error.message : String(error));
const crashed = (error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  return refusal(500, `daemon: ${described(error)}`, exits.internal);
};

function routeOutput(frames: AsyncLocalStorage<Frame>): void {
  const decoder = new TextDecoder();
  const tagged = (text: string) => {
    const frame = frames.getStore();
    const tag = `${new Date().toISOString()} ${frame ? frame.tag : 'daemon'}`;
    const lines = (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
    for (const line of lines) if (frame && line.startsWith('daemon: ')) frame.last = line;
    return lines.map((line) => `${tag} ${line}`).join('\n');
  };
  const sink = (stream: 'out' | 'err', bytes: string | Uint8Array) => {
    if (bytes.length)
      frames.getStore()?.sink?.(stream, Buffer.from(bytes).toString('latin1'), typeof bytes === 'string');
  };
  const log = console.log;
  const error = console.error;
  console.log = (...args: unknown[]) => {
    const text = format(...args);
    sink('out', `${text}\n`);
    return Reflect.apply(log, console, [tagged(text)]);
  };
  console.error = (...args: unknown[]) => {
    const text = format(...args);
    sink('err', `${text}\n`);
    return Reflect.apply(error, console, [tagged(text)]);
  };
  const wrap = (stream: NodeJS.WriteStream, name: 'out' | 'err') => {
    const write = stream.write;
    stream.write = function (this: unknown, chunk: unknown, ...rest: unknown[]): boolean {
      const text = typeof chunk === 'string' ? chunk : chunk instanceof Uint8Array ? decoder.decode(chunk) : '';
      if (typeof chunk === 'string' || chunk instanceof Uint8Array) sink(name, chunk);
      return Reflect.apply(write, this, [text ? `${tagged(text)}\n` : chunk, ...rest]);
    };
  };
  wrap(process.stdout, 'out');
  wrap(process.stderr, 'err');
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
    return (await realpath(root)) === (await realpath(join(enginePaths().versions, revision)));
  } catch {
    return false;
  }
}

async function startSuccessor({ engine, auto, port, start, main, log }: Spawn): Promise<ExitCode> {
  const env = childEnv({ ...process.env, PORT: String(port) });
  delete env.HC_SCOPE;
  const [file, ...args] = daemonArgv(engine.root, [
    '--daemon',
    '--after',
    String(process.pid),
    start,
    ...(auto ? ['--auto', JSON.stringify(auto)] : []),
  ]);
  try {
    await startDetached(file, args, { cwd: main, env, log });
    return exits.done;
  } catch (error) {
    console.error(`daemon: cannot start the successor: ${described(error)}; run celetis daemon start`);
    return exits.blocked;
  }
}

export async function runDaemon(argv: readonly string[]): Promise<ExitCode> {
  installRecorder('daemon');
  readAsDaemon();
  const frames = new AsyncLocalStorage<Frame>();
  routeOutput(frames);
  const handover = handoverOf(argv);
  if (handover === null) {
    console.error('daemon: invalid internal request');
    return exits.usage;
  }
  try {
    if (handover.after && !(await outlived(handover.after))) return exits.prerequisite;
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
): Promise<{ code: ExitCode; successor: Spawn | null }> {
  const checkout = await locateCheckouts(process.cwd());
  if (checkout.main === null || checkout.common === null)
    throw new HostError('celetis: need a Git checkout', exits.usage);
  const { main, common } = checkout;
  const paths = await daemonPaths(common);
  const { layout } = paths;
  const place: Place = { main, common, state: layout, root };
  ensureFolder(layout.root);
  for (const folder of [layout.daemon, layout.runs, privateState, daemonSockets]) ensureFolder(folder);
  if (process.platform === 'win32') {
    // Held until the process exits: a handle without FILE_SHARE_DELETE stops a rename of the folder.
    const refusal = socketFolderRefusal(
      holdFolder(daemonSockets.path) ??
        makePrivateFolder(daemonSockets.path) ??
        privateFolderProblem(daemonSockets.path),
    );
    if (refusal) throw refusal;
  }
  const start = await processStart(process.pid);
  if (!start)
    throw new HostError(
      'daemon: cannot read the process start of the daemon; allow process access and start the daemon again',
      exits.blocked,
    );
  const identity: DaemonIdentity = {
    schema: 1,
    pid: process.pid,
    start,
    revision: await engineRevision(root),
    main,
    common,
    socket: paths.socket,
  };
  const owner = createLockOwner(main, start);
  const holder = await owner.take('daemon');
  if (holder !== null) {
    console.error(`daemon: another daemon of this repository has PID ${holder}; this one stops`);
    return { code: exits.prerequisite, successor: null };
  }
  const lifecycle = createLifecycle(layout.lifecycleLog, { pid: process.pid, revision: identity.revision }, (line) =>
    frames.exit(() => console.error(line)),
  );
  const daemonSite = { run: null, issue: null };
  lifecycle.record(daemonSite, () => [{ type: 'daemon.started', data: { successor: handover.after !== null } }]);

  const entries = new Map<string, Entry>();
  const coordinator = createCoordinator(place, checkout, () =>
    [...entries.values()].map(({ handle, outcome, answer }) => ({
      id: handle.id,
      kind: handle.input.kind,
      refused: answer === 'refused',
      view: handle.view(),
      outcome,
    })),
  );
  const loops = new Set<Loop>();
  const landings = createLandings({
    main,
    start,
    pid: process.pid,
    lifecycle,
    enter: (issue, sink, work) => frames.run({ tag: landLock(issue), last: null, sink }, work),
  });
  const opened = Promise.withResolvers<BoardHandle>();
  let board: BoardHandle | undefined;
  let taking = true;
  let stopping = false;
  let code: ExitCode = exits.done;
  const claim: { successor: Successor | null } = { successor: null };
  let wake: () => void = () => {};
  const asked = new Promise<void>((done) => {
    wake = done;
  });
  const stop = (status: ExitCode, line?: string) => {
    if (stopping && claim.successor === null) {
      if (status === exits.blocked || status === exits.prerequisite) code = status;
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
  const restart = (engine: Engine) => {
    if (stopping) return;
    frames.exit(() => console.log(`daemon: restarts on the engine at ${shortRevision(engine.revision)}`));
    const kept = [...loops].find(({ control }) => control.active && !control.leaving);
    claim.successor = { engine, auto: kept ? { selection: kept.selection } : null };
    stop(exits.done);
  };
  const autoNow = (): DaemonStatus['auto'] =>
    [...loops].some(({ control }) => control.active && !control.leaving) ? 'on' : loops.size ? 'stopping' : 'off';
  let autoWritten: DaemonStatus['auto'] = 'off';
  const noteAuto = (code: ExitCode | null) => {
    const from = autoWritten;
    const to = autoNow();
    if (to === from) return;
    autoWritten = to;
    lifecycle.record(daemonSite, () => [{ type: 'auto.status', data: { from, to, code: to === 'off' ? code : null } }]);
  };
  const fatal = () => stop(exits.blocked);
  const removed = () => stop(exits.prerequisite, removedLine);
  const hooksOf = (gh: boolean): RunHooks => ({ ready: () => requireSetup(gh, main), removed, fatal });

  const ended = (entry: Entry, end: RunEnd) => {
    if (end.kind === 'detached') return;
    entry.outcome = { kind: end.kind, reason: clip(end.reason), code: end.code };
    if (end.code !== exits.done)
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
    entry.outcome = { kind: 'stopped', reason: clip(message), code: exits.internal };
    recordEvent({ name: 'run-defect', message, issue: entry.handle.view().issue, error });
  };
  const journal = (record: RunRecord) =>
    writeRunRecord(layout.runs.path, record).catch((error: unknown) => {
      throw new HostError(
        `daemon: cannot write the run record ${layout.runRecord(record.id)}: ${described(error)}`,
        exits.blocked,
      );
    });
  const forget = async (entry: Entry, end: RunEnd | null) => {
    if (end?.kind === 'detached' && (entry.answer === 'none' || entry.answer === 'sent')) return;
    await removeRunRecord(layout.runs.path, entry.handle.id).catch((error: unknown) =>
      frames.run(entry.frame, () => console.error(`daemon: cannot remove the run record: ${described(error)}`)),
    );
  };
  const launch = <T extends Readonly<{ handle: RunHandle }>>(start: () => T, answer: Answer = 'none'): T => {
    const frame: Frame = { tag: '', last: null, sink: null };
    const run = frames.run(frame, start);
    const { handle } = run;
    frame.tag = handle.id.slice(0, 8);
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
    launch(() => ({ handle: createRun(place, input, { hooks: hooksOf(gh), journal, lifecycle }) }), 'pending').handle;
  const openLoop = (selection: Selection, adopted?: Promise<ExitCode>): Loop => {
    const control = { active: true, leaving: false };
    const abort = new AbortController();
    const started = autoLoop(
      place,
      { selection },
      {
        hooks: { ready: () => requireSetup(true, main), removed, fatal },
        active: () => control.active,
        signal: abort.signal,
        launch,
        leaving: () => {
          control.leaving = true;
          noteAuto(null);
        },
        journal,
        lifecycle,
        adopted,
      },
    );
    let exit: ExitCode = exits.internal;
    const loop: Loop = {
      control,
      abort,
      admitted: started.admitted,
      done: started.done
        .then(
          (code) => {
            exit = code;
          },
          (error: unknown) => {
            console.error(error instanceof Error ? (error.stack ?? described(error)) : described(error));
            recordEvent({ name: 'run-defect', message: described(error), error });
          },
        )
        .finally(() => {
          loops.delete(loop);
          noteAuto(exit);
        }),
      selection,
    };
    loops.add(loop);
    noteAuto(null);
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
      terminal: view.terminal,
      state: view.state,
      line: frame.last === null ? null : clip(frame.last),
      changedMs: view.changedMs,
      session: view.barrier === null ? null : await processState(view.barrier.pid, view.barrier.start),
      attention: coordinator.attention(handle.id),
      outcome,
    };
  };
  const status = async (): Promise<DaemonStatus> => ({
    schema: 1,
    daemon: identity,
    board: (await opened.promise).url,
    auto: autoNow(),
    runs: await Promise.all([...entries.values()].map(row)),
    landings: landings.rows(),
    coordinator: coordinator.live(),
  });
  const verdict = (admission: Admission, run: string | null): Said => {
    if (stopping) return refused(503, stopLine, exits.prerequisite);
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
  const auto = async ({ on, selection }: AutoRequest, adopted?: Promise<ExitCode>): Promise<Said> => {
    const request = ++autoRequests;
    if (!on) {
      for (const loop of loops) loop.control.active = false;
      noteAuto(null);
      return accepted;
    }
    for (;;) {
      if (stopping) return refused(503, stopLine, exits.prerequisite);
      if (request !== autoRequests) return accepted;
      const kept = [...loops].find((each) => !each.control.leaving);
      if (kept) {
        kept.control.active = true;
        noteAuto(null);
        return verdict(await kept.admitted, null);
      }
      if (!loops.size) break;
      await Promise.all([...loops].map((each) => each.done));
    }
    return verdict(await openLoop(selection, adopted).admitted, null);
  };
  const wakeQueue = async ({ id, token, selection }: Wake) => {
    let pinned: HostSelection;
    try {
      pinned = queueSelection(await readQueue(main, common, createLockOwner(main)), 'act', selection);
    } catch (error) {
      console.error(described(error));
      return refused(409, described(error), codeOf(error));
    }
    return runVerdict(begin({ kind: 'queue', id, token, selection: pinned }, true));
  };
  const changeQueue = async (
    use: 'add' | 'act' | 'read',
    selection: Selection,
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
    const said = await wakeQueue({ id: wake.id, token: wake.token, selection });
    if (said.answer.accepted) return reply(said.status, { ...said.answer, view });
    if (said.status !== 503)
      await failQueueLaunch(operation, wake.id, wake.token, said.answer.line).catch((error: unknown) =>
        console.error(`daemon: cannot record the launch failure in the queue: ${described(error)}`),
      );
    return send(said);
  };
  const pressing = new Set<IssueKey>();
  const pressIo = (config: Config): PressIo => ({
    main,
    config,
    owner: createLockOwner(main, start),
    busy: (number) =>
      landings.rows().some(({ issue }) => issue === number) ||
      [...entries.values()].some(({ handle, outcome }) => outcome === null && handle.view().issue === number)
        ? `daemon: #${number} has a landing or a run now; wait for its end, then press again`
        : null,
    land: async ({ number, subject }) =>
      stopping
        ? { code: exits.prerequisite, line: stopLine }
        : landingResult(
            landings.answer({ kind: 'land', number, subject, selection: {}, from: main }, new AbortController().signal),
          ),
  });
  const press = async (number: IssueKey, act: (io: PressIo) => Promise<PressAnswer>) => {
    if (pressing.has(number))
      return refusal(409, `daemon: a press of #${number} runs; wait for its answer`, exits.prerequisite);
    pressing.add(number);
    try {
      const { mainConfig } = await createOperation(checkout, {}, 'main');
      if (!mainConfig) return refusal(409, 'daemon: the main checkout has no configuration', exits.prerequisite);
      const answer = await act(pressIo(mainConfig));
      return answer.ok ? reply(200, { accepted: true, run: null }) : refusal(409, answer.line, answer.code);
    } catch (error) {
      if (!(error instanceof HostError)) throw error;
      return refusal(409, error.message, error.code);
    } finally {
      pressing.delete(number);
    }
  };
  const respond = async (request: Request): Promise<Response> => {
    if (stopping && claim.successor === null) return refusal(503, stopLine, exits.prerequisite);
    let body: unknown = null;
    if (request.method === 'POST') {
      const text = await bodyText(request);
      if (text === null) return refusal(413, `daemon: a request body has at most ${bodyLimit} bytes`, exits.usage);
      try {
        body = JSON.parse(text);
      } catch {
        return refusal(400, requestUsage, exits.usage);
      }
    }
    const parsed = parseRequest(request.method, new URL(request.url).pathname, body);
    if ('status' in parsed) return refusal(parsed.status, parsed.line, exits.usage);
    if (stopping && (parsed.kind !== 'stop' || claim.successor === null))
      return refusal(503, stopLine, exits.prerequisite);
    if (taking && boardRequests.has(parsed.kind)) return refusal(503, takeoverLine, exits.prerequisite);
    switch (parsed.kind) {
      case 'status':
        return reply(200, await status());
      case 'stop':
        stop(exits.done);
        return reply(200, { accepted: true, run: null });
      case 'auto':
        return send(await auto(parsed));
      case 'queue':
        return send(await wakeQueue(parsed));
      case 'queue-action': {
        const { action, selection } = parsed;
        return changeQueue(action.kind === 'add' ? 'add' : 'act', selection, (operation) =>
          admitQueue(operation, action),
        );
      }
      case 'queue-reconcile':
        return changeQueue('read', {}, (operation) => reconcileQueue(operation));
      case 'land': {
        const line = landingStopRefusal(
          parsed.number,
          [...entries.values()].map(({ handle }) => handle.view()),
        );
        if (line !== null) return refusal(409, `daemon: ${line}`, exits.prerequisite);
        return landings.answer(parsed, request.signal);
      }
      case 'held-land':
        return press(parsed.number, (io) => pressLand(parsed, io));
      case 'held-discard':
        return press(parsed.number, (io) => pressDiscard(parsed.number, io));
      case 'coordinator-open': {
        const { status, answer } = await coordinator.open(parsed.selection);
        return reply(status, answer);
      }
      case 'coordinator-read': {
        const { status, answer } = await coordinator.read(parsed.number);
        return reply(status, answer);
      }
      case 'coordinator-send': {
        const { status, answer } = await coordinator.send(parsed);
        return reply(status, answer);
      }
      case 'coordinator-end-assist': {
        const { status, answer } = await coordinator.end(parsed);
        return reply(status, answer);
      }
      case 'run': {
        const { number, selection, effort, model } = parsed;
        return answerRun(begin({ kind: 'number', number: number, selection, effort, model }, true));
      }
      case 'resume':
        return answerRun(begin({ kind: 'resume', number: parsed.number, selection: parsed.selection }, false));
      case 'assist':
        return answerRun(begin({ kind: 'assist', number: parsed.number, selection: parsed.selection }, true));
      case 'aside': {
        const { number } = parsed;
        const asideOwner = createLockOwner(main, start);
        const holder = await asideOwner.take(issueLock(number));
        try {
          if (
            holder !== null ||
            [...entries.values()].some(({ handle }) => {
              const view = handle.view();
              return view.issue === number && view.state !== 'finished';
            })
          )
            return refusal(409, `daemon: #${number} runs now; use Stop`, exits.prerequisite);
          await setAside(common, number);
        } finally {
          const name = issueLock(number);
          const cause = (await asideOwner.release(name)) === null ? null : await asideOwner.release(name);
          if (cause !== null)
            console.error(
              `daemon: cannot release the lock ${name}: ${cause}; restart the daemon: celetis daemon stop, then celetis daemon start`,
            );
        }
        return reply(200, { accepted: true, run: null });
      }
      case 'halt': {
        const { number, terminal } = parsed;
        const entry = [...entries.values()].find(({ handle }) => {
          const view = handle.view();
          return view.issue === number && view.state !== 'ending' && view.state !== 'finished';
        });
        const line = stopRefusal(
          number,
          entry?.handle.view() ?? null,
          entry?.handle.input.kind ?? null,
          landings.rows().some(({ issue }) => issue === number),
          terminal,
        );
        if (line !== null) return refusal(409, `daemon: ${line}`, exits.prerequisite);
        try {
          await entry?.handle.halt(terminal);
        } catch (error) {
          if (!(error instanceof HostError)) throw error;
          return refusal(409, error.message, error.code);
        }
        return reply(200, { accepted: true, run: null });
      }
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
  const answered = async (answer: Promise<Response>) => {
    answering.add(answer);
    try {
      return await (await answer).json();
    } finally {
      answering.delete(answer);
    }
  };
  const inProcess = async (work: () => Promise<{ status: number; answer: DaemonAnswer | CoordinatorAnswer }>) => {
    if (stopping) return refusal(503, stopLine, exits.prerequisite);
    if (taking) return refusal(503, takeoverLine, exits.prerequisite);
    const { status, answer } = await work();
    return reply(status, answer);
  };
  const dispatcher: BoardDaemon = {
    send: ({ kind, ...fields }) => {
      const request = new Request(`http://daemon${requestPaths[kind]}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fields),
      });
      return answered(respond(request).catch(crashed));
    },
    status,
    coordinator: {
      facts: () => coordinator.facts(),
      open: () => answered(inProcess(() => coordinator.open({}, true)).catch(crashed)),
      act: (request) => answered(inProcess(() => coordinator.act(request)).catch(crashed)),
    },
  };

  const handlers = new Map<NodeJS.Signals, () => void>();
  let closing: LifecycleData['daemon.ended'] = { code: exits.internal, restart: false };
  try {
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const handler = () => stop(signalExit(constants.signals[signal]));
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    const port = (await createOperation(checkout, {}, 'main')).mainConfig?.board?.port ?? 4403;
    const env = { ...process.env };
    // PORT is the port of the board only, so runs and landings never get it.
    delete process.env.PORT;
    // The record is read before the board opens, so no read of the board sees a live session with no record.
    await coordinator.adopt();
    board = await startBoard(main, port, await celetisAdapter(main, dispatcher), {
      env,
      revision: identity.revision,
      successor: handover.after !== null,
      versioned: await inVersionFolder(identity.revision),
      restarting: () => stopping,
      restart,
    });
    opened.resolve(board);
    for (const read of await readRunRecords(layout.runs.path)) {
      if ('error' in read) {
        console.error(`daemon: cannot take over ${read.path}: ${read.error}; its session stays in its tab`);
        continue;
      }
      const { record } = read;
      const run = launch(() => ({
        handle: createRun(place, record.input, {
          hooks: hooksOf(!unwatched(record.input.kind)),
          locks: createLockOwner(main),
          journal,
          lifecycle,
          from: record,
        }),
      }));
      await run.handle.admitted;
    }
    coordinator.watch();
    taking = false;
    rmSync(paths.socket, { force: true });
    const server = Bun.serve({ unix: paths.socket, fetch: respond, error: crashed });
    await writeAtomic(paths.identity, `${JSON.stringify(identity)}\n`);
    console.log(`daemon: PID ${process.pid} serves ${paths.socket}`);
    const poll = setInterval(() => {
      void versionFolderGone(root).then((missing) => {
        if (missing) removed();
      });
    }, 5000);
    if (handover.auto && 'refused' in handover.auto)
      console.error(
        `daemon: this engine refuses the carried auto mode ${clip(printable(handover.auto.refused))}; auto mode stays off`,
      );
    else if (handover.auto) {
      const adopted = [...entries.values()].filter(({ handle }) => handle.input.kind === 'auto');
      const endCode = Promise.all(adopted.map(({ settled }) => settled)).then(
        () =>
          adopted.map(({ outcome }) => outcome?.code ?? exits.done).find((code) => code !== exits.done) ?? exits.done,
      );
      const said = await auto(handover.auto, endCode);
      // The loop prints the line of its own refusal; only the stop refusal is not in the log yet.
      if (said.status === 503 && !said.answer.accepted) console.error(said.answer.line);
    }
    await asked;
    await coordinator.close();
    clearInterval(poll);
    for (const { handle } of entries.values()) handle.detach();
    for (const loop of loops) {
      loop.control.active = false;
      loop.abort.abort();
    }
    noteAuto(null);
    const landed = landings.stop();
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
    await landed;
    await board.close();
    const closed = await Promise.race([server.stop().then(() => true), Bun.sleep(5000).then(() => false)]);
    if (!closed) await server.stop(true);
    await rm(paths.identity, { force: true });
    const { successor } = claim;
    closing = { code, restart: successor !== null };
    return { code, successor: successor && { ...successor, port: board.port, start, main, log: paths.log } };
  } catch (error) {
    closing = { code: codeOf(error), restart: false };
    throw error;
  } finally {
    for (const [signal, handler] of handlers) process.off(signal, handler);
    await board?.close();
    lifecycle.record(daemonSite, () => [{ type: 'daemon.ended', data: closing }]);
    await owner.releaseAll();
  }
}
