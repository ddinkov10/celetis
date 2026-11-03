import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import type { Config, Host } from './lib/config-core.ts';
import type { Level } from './lib/effort.ts';
import type { Next } from './lib/lines.ts';
import type { LockOwner } from './lib/locks.ts';
import type { HostSelection, Operation } from './lib/operation.ts';
import type { QueueAction, QueueRecord, QueueWake } from './lib/queue-types.ts';
import type { Claim, SessionRecord } from './lib/session.ts';
import type { StepEndRecord, StepEndState, TurnKey } from './lib/step-end.ts';
import type { TerminalStatus } from './lib/terminal-types.ts';
import type { Run, Step } from './lib/workflow.ts';

const usage =
  "usage: celetis --agent <host> celetis-flow [<issue number> [--effort low|medium|high|xhigh|max]] [--quiet] | --resume <issue number> | --queue action '<QueueAction JSON>' | --queue status; with no number, the automatic runner; --quiet opens each session tab in the background";
const removed = 'the program version of this runner was removed after an update; start the runner again';
const here = import.meta.dir;
const required = [
  'next-step.ts',
  'update.ts',
  '../celetis',
  'launcher.ts',
  'lib/help.ts',
  'lib/config-core.ts',
  'lib/config.ts',
  'lib/events.ts',
  'lib/host.ts',
  'lib/locks.ts',
  'lib/operation.ts',
  'lib/plugin-metadata.ts',
  'lib/plugin-policy.ts',
  'lib/update-lock.ts',
  'lib/windows.ts',
  'lib/process-identity.ts',
  'lib/session.ts',
  'lib/step-end.ts',
  'lib/terminal.ts',
  'lib/workflow.ts',
  'lib/effort.ts',
  'lib/tracker.ts',
  'lib/lines.ts',
  'lib/process.ts',
  'lib/program.ts',
  'lib/queue.ts',
  'lib/queue-types.ts',
  'lib/queue-actions.ts',
  'lib/vendor/yaml.mjs',
];
const idle: Record<TerminalStatus, boolean> = { idle: true, done: true, error: true, working: false, blocked: false };
async function gone(files = required) {
  for (const file of files) if (!(await stat(join(here, file)).catch(() => null))?.isFile()) return true;
  return false;
}

export async function main(argv: string[]): Promise<number> {
  const unavailable = await gone([
    'lib/config-core.ts',
    'lib/config.ts',
    'lib/events.ts',
    'lib/host.ts',
    'lib/locks.ts',
    'lib/operation.ts',
    'lib/plugin-metadata.ts',
    'lib/plugin-policy.ts',
    'lib/update-lock.ts',
    'lib/windows.ts',
    'lib/process-identity.ts',
    'lib/queue.ts',
    'lib/queue-types.ts',
    'lib/queue-actions.ts',
    'lib/process.ts',
    'lib/session.ts',
    'lib/step-end.ts',
    'lib/terminal.ts',
    'lib/workflow.ts',
    'lib/effort.ts',
    'lib/tracker.ts',
    'lib/lines.ts',
    'lib/vendor/yaml.mjs',
  ]);
  if (!unavailable) (await import('./lib/events.ts')).installRecorder('celetis-flow');
  let explicit: string | undefined;
  if (!unavailable) {
    try {
      const input = (await import('./lib/operation.ts')).commandInput(argv);
      argv = input.args;
      explicit = input.explicit;
    } catch (error) {
      const { HostError } = await import('./lib/host.ts');
      if (!(error instanceof HostError)) throw error;
      if (error.message) console.error(error.message);
      return error.code;
    }
  } else if (argv[0] === '--agent') argv = argv.slice(2);
  const quiet = argv.includes('--quiet');
  if (quiet) argv = argv.toSpliced(argv.indexOf('--quiet'), 1);
  let mode: 'numbers' | 'auto' | 'resume' | 'queue' = 'numbers';
  let numbers: string[] = [];
  let action: QueueAction | undefined;
  let queueCommand = '';
  let wake: QueueWake | undefined;
  let override: Level | undefined;
  if (argv[0] === '--queue' && !unavailable) {
    try {
      const { parseQueueAction } = await import('./lib/queue.ts');
      queueCommand = argv[1] ?? '';
      if ((queueCommand === 'action' || queueCommand === 'admit') && argv.length === 3)
        action = parseQueueAction(JSON.parse(argv[2] as string));
      else if (
        queueCommand === 'run' &&
        argv.length === 4 &&
        argv
          .slice(2)
          .every((value) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value))
      ) {
        wake = { id: argv[2] as string, token: argv[3] as string, host: explicit === 'codex' ? 'codex' : 'claude' };
      } else if (queueCommand !== 'status' || argv.length !== 2) throw new Error(usage);
      mode = 'queue';
    } catch {
      console.error(usage);
      return 2;
    }
  } else if (argv.length === 2 && argv[0] === '--resume') {
    mode = 'resume';
    numbers = [(argv[1] ?? '').replace(/^#/, '')];
  } else if (!argv.length) mode = 'auto';
  else {
    const at = argv.indexOf('--effort');
    if (at !== -1) {
      const level = argv[at + 1];
      if (unavailable) argv = argv.toSpliced(at, 2);
      else if ((await import('./lib/effort.ts')).isLevel(level)) {
        override = level;
        argv = argv.toSpliced(at, 2);
      }
    }
    numbers = argv.map((arg) => arg.replace(/^#/, ''));
  }
  if (
    numbers.some((n) => !/^[1-9][0-9]*$/.test(n)) ||
    (mode === 'numbers' && (numbers.length !== 1 || argv[0] === '--resume'))
  ) {
    console.error(usage);
    if (!unavailable) console.error((await import('./lib/host.ts')).updateHint);
    return 2;
  }
  if (unavailable) {
    if (mode === 'numbers') {
      for (const n of numbers) console.log(`celetis-flow: #${n}: ${removed}`);
      return 0;
    }
    if (mode === 'resume') console.error(`celetis-flow: ${removed}`);
    else console.log(`celetis-flow: stop ${removed}`);
    return 1;
  }
  const { markDefect, passOn, recordEvent } = await import('./lib/events.ts');
  const { HostError, requireBun } = await import('./lib/host.ts');
  const { addRecord, createLockOwner, isRecorded, lockHolder } = await import('./lib/locks.ts');
  const { createOperation, locateCheckouts } = await import('./lib/operation.ts');
  const { readQueue, readQueueView, queueOwner, updateQueue } = await import('./lib/queue.ts');
  const { admitQueue, emptyQueue } = await import('./lib/queue-actions.ts');
  const { describe } = await import('./lib/lines.ts');
  const { bunArgs, childEnv } = await import('./lib/process.ts');
  const { processRunsScript, processStart, processState } = await import('./lib/process-identity.ts');
  const { removeStepEnd, verdictOf, writeStepEnd } = await import('./lib/step-end.ts');
  const {
    codexClaim,
    codexPrompt,
    hostArguments,
    manualRecovery,
    observeSession,
    readSession,
    resumeArguments,
    selectSavedSession,
    startLine,
    startupError,
    writeSession,
  } = await import('./lib/session.ts');
  const {
    closeTerminal,
    openTab,
    readTerminal,
    requestExit,
    requireTerminals,
    TerminalError,
    terminalLive,
    waitTerminal,
  } = await import('./lib/terminal.ts');
  const { defaultLevel } = await import('./lib/effort.ts');
  const { defaultGate, invocation, sameResult, skipped } = await import('./lib/workflow.ts');
  const root = dirname(here);
  let common = '',
    main = '',
    state = '';
  let operation: Operation;
  let initial: Operation | undefined;
  let selection: HostSelection = { explicit, environment: process.env.CELETIS_AGENT };
  let queue: QueueRecord | null = null;
  let queueWritable = false;
  let storageFailed = false;
  let terminal = '';
  let tab = '';
  let unreleased = '';
  let finished = '';
  let said = '';
  let locks: LockOwner | undefined;
  let signalStatus = 0;
  const halt = new AbortController();
  const halted = new Promise<null>((done) => halt.signal.addEventListener('abort', () => done(null), { once: true }));
  const rest = (ms: number) => pause(ms, undefined, { signal: halt.signal }).catch(() => {});
  let watcher: AbortController | undefined;
  let watching: Promise<void> | undefined;
  let stepEndIssue: number | undefined;
  let stepEndOwner: StepEndRecord['runner'];
  let watchDir = '';
  const handlers = new Map<NodeJS.Signals, () => void>();
  const die = (message: string): never => {
    throw new HostError(`celetis-flow: ${message}`);
  };
  const saveQueue = async (change: Partial<QueueRecord>) => {
    if (queue === null) throw new HostError('celetis-flow: queue: no submitted queue', 2);
    const expected = queue;
    try {
      queue = await updateQueue(common, async (current) => {
        if (!current || current.id !== expected.id || current.numbers[0] !== expected.numbers[0])
          throw new Error('queue: the current issue changed; refresh the queue');
        return { ...current, ...change };
      });
    } catch (error) {
      storageFailed = true;
      throw new HostError(
        `celetis-flow: queue: cannot save recovery state: ${(error as Error).message}; no further session will start. Repair access to the queue record, then use Try again.`,
      );
    }
  };
  const say = (message: string) => {
    if (mode === 'auto' && message === said) return false;
    said = message;
    console.log(`celetis-flow: ${message}`);
    return true;
  };
  const fresh = () => createOperation(operation.checkout, selection, 'main');
  const nextOperation = () => {
    const current = initial ?? fresh();
    initial = undefined;
    return current;
  };
  const requireStart = async (current: Operation) => {
    const host = current.host;
    if (host === 'codex') process.env.CODEX_HOME = await (await import('./lib/plugin-metadata.ts')).codexHome();
    const { requireUpdatePolicy } = await import('./lib/plugin-policy.ts');
    await (await import('./lib/update-lock.ts')).withPluginRead(host, async () => {
      await requireUpdatePolicy(host, current.checkout.cwd);
      if (current.checkout.cwd !== main) await requireUpdatePolicy(host, main);
    });
    if (!Bun.which(host, { PATH: childEnv().PATH })) throw new HostError(`celetis: ${host} is not on PATH`);
  };
  const nextOf = async (n: string, current: Operation, abort?: AbortSignal) => {
    const { nextIssue } = await import('./next-step.ts');
    const { lineOf } = await import('./lib/lines.ts');
    const { next, effort, stderr } = await nextIssue(n, current, abort);
    process.stderr.write(stderr);
    return { next, effort, line: lineOf(n, next) };
  };
  const clearStepEnd = async () => {
    if (stepEndIssue === undefined) return;
    try {
      await removeStepEnd(main, stepEndIssue);
    } catch (error) {
      console.error(`celetis-flow: #${stepEndIssue} cannot remove step-end: ${(error as Error).message}`);
      console.error(
        `celetis-flow: cannot revoke watcher ownership; the runner stops. Exit the session in the tab ${tab} when ready.`,
      );
      process.exit(1);
    }
  };
  const publish = async (host: Host, state: StepEndState, turn: TurnKey | null) => {
    try {
      await writeStepEnd(main, stepEndIssue as number, { runner: stepEndOwner, terminal, host, state, turn });
      return true;
    } catch (error) {
      await clearStepEnd();
      const line = `celetis-flow: #${stepEndIssue} cannot write step-end: ${(error as Error).message}`;
      console.error(line);
      recordEvent({ name: 'step-end-write', message: line, issue: stepEndIssue });
      return false;
    }
  };
  const sessionTurn = async (
    id: string,
    host: Host,
    startedMs: number,
    abort: AbortSignal,
  ): Promise<{ turn: TurnKey; idle: boolean } | null> => {
    const view = await readTerminal(terminal, { signal: abort });
    if (!view || view.host !== host || view.status === null || view.statusMs === null || view.statusMs < startedMs)
      return null;
    return { turn: { terminalId: terminal, sessionId: id, sequence: view.turn }, idle: idle[view.status] };
  };
  const sameTurn = (a: TurnKey | null, b: TurnKey | null) =>
    a !== null &&
    b !== null &&
    a.terminalId === b.terminalId &&
    a.sessionId === b.sessionId &&
    a.sequence === b.sequence;
  const endWhenDone = async (
    n: string,
    start: Run,
    record: SessionRecord,
    announced: string,
    startedMs: number,
    ended: Promise<number | null>,
    abort: AbortSignal,
  ) => {
    const startedAt = Math.floor(startedMs / 1000);
    const deadline = performance.now() + 60_000;
    let saved = false;
    let warned = false;
    while (!abort.aborted) {
      const claim: Claim =
        record.host === 'claude'
          ? { kind: 'one', id: announced }
          : await codexClaim(main, codexPrompt(record.step, Number(n)), startedAt);
      const result = await observeSession(record, claim, startedAt);
      if (result === 0) {
        saved = true;
        break;
      }
      if (result === 2) {
        await writeFile(join(watchDir, 'error'), '');
        await startupError(Number(n), record.host, 'no single session identity can be saved', terminal, tab);
        return;
      }
      if (!warned && performance.now() >= deadline) {
        warned = true;
        console.error(
          `celetis-flow: #${n} ${record.host} startup: no saved turn with a verified identity after 60 seconds; monitoring continues. Check setup prompts in the tab ${tab}.`,
        );
      }
      await Bun.sleep(1000);
    }
    if (!saved || abort.aborted) return false;
    const id = (await readSession(main, Number(n))).session_id ?? '';
    let retained: TurnKey | null = null;
    while (!abort.aborted && (await waitTerminal(terminal, 60, abort))) {
      if (await gone()) {
        say(`#${n}: ${removed}`);
        return;
      }
      const observed = await sessionTurn(id, record.host, startedMs, abort);
      const turn = observed?.turn;
      if (observed && !observed.idle) {
        retained = null;
        if (!(await publish(record.host, 'checking', observed.turn))) return false;
      } else if (turn) {
        if (!sameTurn(turn, retained) && !(await publish(record.host, 'checking', turn))) return false;
        const { next: first } = await nextOf(n, fresh(), abort);
        let changed = false;
        if (first.kind !== 'observed' && !sameResult(first, start)) {
          const { next: second } = await nextOf(n, fresh(), abort);
          changed = second.kind !== 'observed' && sameResult(second, first);
        }
        const current = await sessionTurn(id, record.host, startedMs, abort);
        if (!current) {
          retained = null;
          await clearStepEnd();
        } else if (!current.idle || !sameTurn(turn, current.turn)) {
          retained = null;
          if (!(await publish(record.host, 'checking', current.turn))) return false;
          if (current.idle) continue;
        } else if (!abort.aborted) {
          const verdict = verdictOf(first, changed);
          if (verdict === 'exiting') {
            if (!(await publish(record.host, 'exiting', turn))) return false;
            if (!(await requestExit(terminal, record.host, abort))) {
              if (!abort.aborted) {
                await publish(record.host, 'waiting', turn);
                const line = `celetis-flow: #${n} cannot request ${record.host} exit; the session stays open. Exit it in the tab ${tab} when ready.`;
                console.error(line);
                recordEvent({ name: 'exit-request', message: line, issue: Number(n) });
              }
              return false;
            }
            const timer = setTimeout(() => {
              if (abort.aborted) return;
              const line = `celetis-flow: #${n} ${record.host} did not exit within 10 seconds; the session stays open. Exit it in the tab ${tab} when ready.`;
              console.error(line);
              recordEvent({ name: 'exit-timeout', message: line, issue: Number(n) });
            }, 10_000);
            try {
              await Promise.race([ended, halted]);
            } finally {
              clearTimeout(timer);
            }
            return true;
          }
          if (!(await publish(record.host, verdict, turn))) return false;
          retained = verdict === 'waiting' ? turn : null;
        }
      } else {
        retained = null;
        await clearStepEnd();
      }
      await pause(5000, undefined, { signal: abort }).catch(() => {});
    }
  };
  const barrierOf = async (source: string) => {
    let value: unknown;
    try {
      value = JSON.parse(source);
    } catch {
      return null;
    }
    if (typeof value !== 'object' || value === null) return null;
    const { pid, start } = value as Record<string, unknown>;
    if (typeof pid !== 'number' || !Number.isSafeInteger(pid) || pid <= 0 || typeof start !== 'string' || !start)
      return null;
    const barrier = { pid, start };
    return (await processState(pid, start)) === 'runs' && (await processRunsScript(pid, 'celetis-flow.ts'))
      ? barrier
      : null;
  };
  const closeFinished = async () => {
    const id = finished;
    finished = '';
    if (id) await closeTerminal(id);
  };
  const closeUnreleased = async () => {
    const id = unreleased;
    unreleased = '';
    if (id) await closeTerminal(id);
  };
  const closeTabs = async () => {
    await closeUnreleased();
    await closeFinished();
  };
  const startSession = async (n: string, step: Step, host: Host, args: string[], focus: boolean) => {
    if (host === 'codex') args = [...(await (await import('./lib/plugin-metadata.ts')).codexSessionPin(main)), ...args];
    const dir = await mkdtemp(join(state, 'start.'));
    watchDir = dir;
    tab = `#${n} ${step}`;
    try {
      terminal = await openTab({
        repository: { main, common },
        folder: main,
        name: tab,
        argv: [
          // hc gives the tab the environment of its server, not of this runner.
          ...(process.platform === 'win32' ? [] : ['env', 'BUN_RUNTIME_TRANSPILER_CACHE_PATH=0', 'DO_NOT_TRACK=1']),
          process.execPath,
          ...bunArgs(import.meta.path, ['--session-start', dir, String(process.pid), host, ...args]),
        ],
        focus,
        keepShell: true,
      });
    } catch (error) {
      if (!(error instanceof TerminalError)) throw error;
      die(`#${n} cannot open the session tab: ${error.message}`);
    }
    unreleased = terminal;
    await closeFinished();
    const waited = performance.now();
    let checked = waited;
    let warned = false;
    let source: string | null = null;
    for (;;) {
      if (signalStatus) throw new HostError('', signalStatus);
      source = await readFile(join(dir, 'pid'), 'utf8').catch(() => null);
      if (source !== null) break;
      const now = performance.now();
      if (now - checked >= 1000) {
        checked = now;
        if (!(await terminalLive(terminal)))
          die(
            `#${n} ${host} startup: the tab ${tab} ended before its start barrier reported; check the login files of $SHELL, then start the step again`,
          );
      }
      if (!warned && now - waited >= 60_000) {
        warned = true;
        console.error(
          `celetis-flow: #${n} ${host} startup: the start barrier of the tab ${tab} did not report after 60 seconds; waiting continues. Check the login files of $SHELL in that tab.`,
        );
      }
      await rest(250);
    }
    const barrier =
      (await barrierOf(source)) ??
      die(`#${n} ${host} startup: the start barrier record of the tab ${tab} is not valid; start the step again`);
    await locks?.registerSession(barrier.pid);
    if (signalStatus) throw new HostError('', signalStatus);
    const ended = (async (): Promise<number | null> => {
      while (!halt.signal.aborted && (await processState(barrier.pid, barrier.start)) !== 'gone') await rest(500);
      const status = await readFile(join(dir, 'status'), 'utf8').catch(() => '');
      return /^\d+\n$/.test(status) ? Number(status) : null;
    })();
    return { ended };
  };
  const releaseBarrier = async () => {
    if (signalStatus) throw new HostError('', signalStatus);
    await writeFile(join(watchDir, 'go'), '');
    unreleased = '';
  };
  const sessionEnd = async (ended: Promise<number | null>) => {
    const code = await Promise.race([ended, halted]);
    if (!signalStatus) return code;
    // The released barrier can still be waiting to read go in the start folder.
    watchDir = '';
    throw new HostError('', signalStatus);
  };
  const normalEnd = (code: number | null) => {
    if (code === 0) finished = terminal;
  };
  type IssueOutcome = {
    kind: 'closed' | 'gate' | 'stopped';
    started: boolean;
    next: Next | null;
    last: Run | null;
    exitCode: number | null;
    reason: string;
    act: string | null;
  };
  const runIssue = async (
    n: string,
    first: 'any' | 'gated',
    request?: {
      step: Step | null;
      retry: boolean;
    },
    beforeStart?: (next: Run) => Promise<void>,
    override?: Level,
  ): Promise<IssueOutcome> => {
    let lastHost: Host = queue?.host ?? 'claude';
    let last: Run | null = queue?.last ?? null;
    let started = false;
    let exitCode: number | null = 0;
    let resolved: Next | null = null;
    const outcome = (kind: IssueOutcome['kind'], reason: string, act: string | null = null): IssueOutcome => ({
      kind,
      started,
      next: resolved,
      last,
      exitCode,
      reason,
      act,
    });
    const holder = await locks?.take(`issue-${n}`);
    if (holder !== null) {
      const reason = `another celetis-flow.ts or its session (PID ${holder}) works on #${n}`;
      say(reason);
      return outcome('stopped', reason, 'Wait for that session to exit, then use Try again.');
    }
    try {
      for (;;) {
        if (signalStatus) throw new HostError('', signalStatus);
        if (await gone()) {
          say(`#${n}: ${removed}`);
          return outcome('stopped', removed, 'Start the runner again.');
        }
        const current = nextOperation();
        const config = current.mainConfig as Config;
        const stepHost = current.host;
        const { next, effort, line } = await nextOf(n, current);
        resolved = next;
        if (request && (next.kind === 'run' ? next.step : null) !== request.step) {
          const reason = `#${n}: the displayed decision changed: ${line}; no step was started`;
          say(reason);
          return outcome('stopped', reason, 'Refresh the queue, then use its displayed action.');
        }
        if (next.kind !== 'run') {
          say(line);
          return outcome(
            next.kind === 'stop' && (next.reason === 'finished' || next.reason === 'wontfix') ? 'closed' : 'stopped',
            line,
            describe(n, next).row?.act ?? 'Fix the cause, then use Try again.',
          );
        }
        await requireStart(current);
        const { step } = next;
        const prompt = invocation(step, Number(n));
        if (last && !request?.retry && sameResult(next, last)) {
          if (exitCode !== 0)
            die(
              `${lastHost} session exited with status ${exitCode ?? 'unknown'} before issue progress; check startup output, then run ${manualRecovery(lastHost)} from the main checkout or start the step again`,
            );
          const reason = `no progress: ${prompt}`;
          if (say(reason)) recordEvent({ name: 'no-progress', message: `celetis-flow: ${reason}`, issue: Number(n) });
          await addRecord(common, n, line);
          return outcome('stopped', reason, 'Open the saved session, or use Try again for this step.');
        }
        const skips = last ? skipped(last.step, step, next.lane) : [];
        if (last && !request?.retry && skips.length > 0) {
          const reason = `#${n}: ${step} skips ${skips.join(', ')} after ${last.step}; fix the issue, or start ${step} by hand: celetis --agent <host> celetis-flow ${n}`;
          if (say(reason)) recordEvent({ name: 'step-skip', message: `celetis-flow: ${reason}`, issue: Number(n) });
          await addRecord(common, n, line);
          return outcome('stopped', reason, 'Fix the issue, or use Try again for this displayed step.');
        }
        if (first !== 'any' && (config.gates?.[step] ?? defaultGate) !== 'auto') {
          const reason = `the gate of ${step} is me: celetis --agent <host> celetis-flow ${n} starts ${prompt}`;
          say(reason);
          return outcome('gate', reason, 'Use Continue queue to start this displayed step.');
        }
        const pluginRoot = await (await import('./update.ts')).requireSameRevision(stepHost, main, root);
        first = 'gated';
        if ((await gone()) || !(await stat(join(root, 'step-prompt.md')).catch(() => null))?.isFile()) {
          say(`#${n}: ${removed}`);
          return outcome('stopped', removed, 'Start the runner again.');
        }
        const { level: chosen, source } =
          override === undefined
            ? (effort ?? { level: defaultLevel, source: 'default' })
            : { level: override, source: 'override' as const };
        const { args, applied, model } = await hostArguments(
          stepHost,
          Number(n),
          step,
          root,
          main,
          { pluginRoot, landing: config.landing },
          chosen,
        );
        say(startLine(prompt, chosen, source, applied, model));
        const announced = stepHost === 'claude' ? randomUUID() : '';
        const record: SessionRecord = {
          schema: 2,
          host: stepHost,
          issue: Number(n),
          step,
          checkout: main,
          session_id: null,
          effort: applied,
        };
        await writeSession(main, record);
        const { ended } = await startSession(
          n,
          step,
          stepHost,
          announced ? ['--session-id', announced, ...args] : args,
          !quiet,
        );
        let watchError: unknown;
        stepEndIssue = Number(n);
        stepEndOwner = { pid: process.pid, start: await processStart(process.pid) };
        await publish(stepHost, 'checking', null);
        const startedMs = Date.now();
        watcher = new AbortController();
        watching = endWhenDone(n, next, record, announced, startedMs, ended, watcher.signal)
          .then(async (exiting) => {
            if (!exiting) await clearStepEnd();
          })
          .catch(async (error: unknown) => {
            await clearStepEnd();
            watchError = error;
          });
        await beforeStart?.(next);
        request = undefined;
        override = undefined;
        last = next;
        lastHost = stepHost;
        await releaseBarrier();
        started = true;
        exitCode = await sessionEnd(ended);
        watcher?.abort();
        await watching;
        watching = undefined;
        watcher = undefined;
        await clearStepEnd();
        stepEndIssue = undefined;
        if (watchError !== undefined) throw watchError;
        if ((await readSession(main, Number(n))).session_id === null) {
          if (!(await stat(join(watchDir, 'error')).catch(() => null)))
            await startupError(
              Number(n),
              stepHost,
              'the session ended before a saved turn had a verified identity',
              terminal,
              tab,
            );
          throw new HostError('', 1);
        }
        normalEnd(exitCode);
        await rm(watchDir, { recursive: true, force: true });
        watchDir = '';
        if (signalStatus) throw new HostError('', signalStatus);
      }
    } finally {
      watcher?.abort();
      await watching;
      await clearStepEnd();
      stepEndIssue = undefined;
      await closeUnreleased();
      await locks?.release(`issue-${n}`);
    }
  };
  try {
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null) throw new HostError('celetis: need a Git checkout', 2);
    common = checkout.common;
    main = checkout.main;
    locks = createLockOwner(main);
    state = join(common, 'celetis-flow');
    if (mode === 'queue') {
      queue = await readQueue(common);
      if (queue?.host && action?.kind !== 'add') {
        if (explicit !== undefined && explicit !== queue.host)
          throw new HostError(`queue: recorded host is ${queue.host}`, 2);
        selection = { ...selection, saved: queue.host };
      }
    }
    if (mode === 'resume') {
      const holder = await locks.take(`issue-${numbers[0]}`);
      if (holder !== null) die(`another celetis-flow.ts or its session (PID ${holder}) works on #${numbers[0]}`);
    }
    const saved = mode === 'resume' ? await selectSavedSession(main, Number(numbers[0]), explicit, common) : undefined;
    operation = createOperation(checkout, saved ? { ...selection, saved: saved.host } : selection, 'main');
    if (mode === 'queue') {
      if (queueCommand === 'status') {
        console.log(JSON.stringify(await readQueueView(operation)));
        return 0;
      }
      if (action) {
        const receipt = await admitQueue(operation, action);
        if (queueCommand === 'admit') {
          console.log(JSON.stringify(receipt));
          return 0;
        }
        if (!receipt.wake) {
          console.log(JSON.stringify(receipt.view));
          return 0;
        }
        wake = receipt.wake;
      }
      const pending = wake;
      queue = await updateQueue(common, async (current) => {
        if (!current || !pending || current.id !== pending.id || current.launch?.token !== pending.token)
          throw new HostError('queue: stale launch token; no session started', 2);
        if (await queueOwner(main, current))
          throw new HostError('queue: a runner or its foreground still owns this work', 2);
        const holder = await locks?.take('queue');
        if (holder !== null) throw new HostError('queue: another runner owns this work', 2);
        return current;
      });
      queueWritable = true;
      selection = { ...selection, saved: queue.host ?? undefined };
      operation = fresh();
    }
    const host = operation.host;
    initial = mode === 'resume' || mode === 'queue' ? undefined : operation;
    if (mode !== 'queue') await requireStart(operation);
    if (mode !== 'resume' && !Bun.which('gh', { PATH: childEnv().PATH })) die('gh is not on PATH');
    try {
      await requireTerminals();
    } catch (error) {
      if (!(error instanceof TerminalError)) throw error;
      die(error.message);
    }
    await mkdir(state, { recursive: true });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const handler = () => {
        signalStatus = 128 + constants.signals[signal];
        watcher?.abort();
        halt.abort();
        void clearStepEnd();
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    if (saved) {
      const { ended } = await startSession(numbers[0] as string, saved.step, host, resumeArguments(saved), true);
      await releaseBarrier();
      const code = await sessionEnd(ended);
      normalEnd(code);
      return signalStatus || (code === null ? 1 : passOn(code));
    }
    if (mode === 'numbers') {
      await runIssue(numbers[0] as string, 'any', undefined, undefined, override);
      return 0;
    }
    if (mode === 'queue' && queue) {
      const authorization = queue.launch?.authorization;
      let request: Parameters<typeof runIssue>[2] =
        authorization && authorization.number === queue.numbers[0]
          ? { step: authorization.step, retry: authorization.retry }
          : undefined;
      await saveQueue({ state: 'running', launch: null });
      while (queue.numbers.length) {
        const n = String(queue.numbers[0]);
        const result = await runIssue(n, request ? 'any' : 'gated', request, (next) =>
          saveQueue({ state: 'running', current: next, last: next, reason: null, act: null }),
        );
        request = undefined;
        if (result.kind !== 'closed') {
          await saveQueue({
            state: result.kind === 'gate' ? 'me-gate' : 'error',
            current: result.next?.kind === 'run' ? result.next : null,
            last: result.last,
            reason: result.reason,
            act: result.act,
          });
          if (result.kind !== 'gate') recordEvent({ name: 'queue-error', message: result.reason, issue: Number(n) });
          return 0;
        }
        for (;;) {
          const snapshot = await readQueue(common);
          if (!snapshot || snapshot.id !== queue.id || snapshot.numbers[0] !== Number(n))
            throw new Error('queue: current issue changed during drain');
          const { next } = await nextOf(n, fresh());
          if (next.kind !== 'stop' || (next.reason !== 'finished' && next.reason !== 'wontfix'))
            die('queue: cannot advance without a fresh closed resolver result');
          let drained = false;
          try {
            queue = await updateQueue(common, async (current) => {
              if (!current || current.id !== snapshot.id) throw new Error('queue: identity changed during drain');
              if (current.revision !== snapshot.revision) return current;
              const numbers = current.numbers.slice(1);
              if (!numbers.length) await locks?.release('queue');
              drained = true;
              return numbers.length
                ? { ...current, numbers, current: null, last: null, reason: null, act: null }
                : emptyQueue(current);
            });
          } catch (error) {
            storageFailed = true;
            throw error;
          }
          if (drained) break;
        }
      }
      queueWritable = false;
      say('queue: empty; Add starts the next issue');
      return 0;
    }
    const holder = await locks.take('runner');
    if (holder !== null) die(`another automatic runner or its session has PID ${holder}`);
    while (!signalStatus) {
      if (await gone()) {
        say(`stop ${removed}`);
        return 1;
      }
      const current = nextOperation();
      const config = current.mainConfig as Config;
      await (await import('./lib/plugin-policy.ts')).requireUpdatePolicy(current.host, main);
      const { nextOpen } = await import('./next-step.ts');
      const { lineOf } = await import('./lib/lines.ts');
      const { rows, stderr } = await nextOpen(current);
      process.stderr.write(stderr);
      let started = false;
      if (rows) {
        let pick = '';
        for (const { number, next } of rows) {
          const n = String(number);
          if (next.kind !== 'run' || (config.gates?.[next.step] ?? defaultGate) !== 'auto') continue;
          if ((await lockHolder(main, `issue-${n}`)) || (await isRecorded(common, n, lineOf(n, next)))) continue;
          pick = n;
          break;
        }
        if (pick) started = (await runIssue(pick, 'gated')).started;
        else say('no auto step can start; the runner asks again each 60 seconds');
      } else if (say('stop cannot read the open issues from GitHub'))
        recordEvent({ name: 'issues-read', message: 'celetis-flow: stop cannot read the open issues from GitHub' });
      if (!started) {
        const until = performance.now() + 60_000;
        while (!signalStatus && performance.now() < until) await Bun.sleep(50);
      }
    }
    return signalStatus;
  } catch (error) {
    if (mode === 'queue') {
      const reason = signalStatus
        ? `queue: interrupted with status ${signalStatus}; use Try again after the foreground exits`
        : error instanceof Error
          ? error.message
          : String(error);
      if (queueWritable && !storageFailed) {
        await closeTabs();
        try {
          await saveQueue({
            state: 'error',
            launch: null,
            reason,
            act: 'Fix the cause, then use Try again for the displayed step.',
          });
        } catch (failure) {
          console.error((failure as Error).message);
          return 1;
        }
        if (reason) console.error(reason);
        if (!signalStatus)
          recordEvent({
            name: 'queue-error',
            message: reason,
            issue: queue?.numbers[0] ?? null,
            error: error instanceof HostError ? undefined : error,
          });
        return signalStatus || 0;
      }
      if (reason) console.error(reason);
      markDefect(error);
      return error instanceof HostError ? error.code : 1;
    }
    if (error instanceof HostError) {
      if (error.message) console.error(error.message);
      return error.code;
    }
    throw error;
  } finally {
    watcher?.abort();
    await watching;
    await closeTabs();
    if (watchDir) await rm(watchDir, { recursive: true, force: true });
    await clearStepEnd();
    await locks?.releaseAll();
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

async function waitingSession(args: string[]): Promise<number> {
  const { installRecorder, passOn } = await import('./lib/events.ts');
  installRecorder('session-start');
  const [dir, runner, host, ...hostArgs] = args;
  if (!dir || !isAbsolute(dir) || !/^[1-9][0-9]*$/.test(runner ?? '') || (host !== 'claude' && host !== 'codex'))
    return 2;
  const { HostError } = await import('./lib/host.ts');
  const { codexHome } = await import('./lib/plugin-metadata.ts');
  const { childEnv } = await import('./lib/process.ts');
  const { processRuns, processStart } = await import('./lib/process-identity.ts');
  const { sessionEnv } = await import('./lib/session.ts');
  const { spawnConsumer } = await import('./lib/update-lock.ts');
  const record = async (name: string, value: string) => {
    const temp = join(dir, `.${name}.${randomUUID()}`);
    await writeFile(temp, value, { mode: 0o600, flag: 'wx' });
    await rename(temp, join(dir, name));
  };
  await record('pid', `${JSON.stringify({ pid: process.pid, start: await processStart(process.pid) })}\n`);
  while (!(await stat(join(dir, 'go')).catch(() => null))?.isFile()) {
    if (!(await processRuns(Number(runner)))) return 1;
    await Bun.sleep(50);
  }
  let code = 1;
  try {
    const env = childEnv(sessionEnv(host, { ...process.env, CELETIS_AGENT: host }));
    if (host === 'codex') env.CODEX_HOME = await codexHome();
    const executable = Bun.which(host, { PATH: env.PATH });
    if (!executable) throw new HostError(`celetis: ${host} is not on PATH`);
    code = passOn(await spawnConsumer(executable, [executable, ...hostArgs], env));
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    console.error(error.message);
  }
  await record('status', `${code}\n`).catch(() => {});
  return code;
}

if (import.meta.main)
  process.exitCode =
    process.argv[2] === '--session-start'
      ? await waitingSession(process.argv.slice(3))
      : await main(process.argv.slice(2));
