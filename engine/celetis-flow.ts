import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join } from 'node:path';
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
  "usage: celetis --agent <host> celetis-flow [<issue number> [--effort low|medium|high|xhigh|max]] | --resume <issue number> | --queue action '<QueueAction JSON>' | --queue status; with no number, the automatic runner";
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
  const { HostError, requireBun } = await import('./lib/host.ts');
  const { addRecord, createLockOwner, isRecorded, lockHolder } = await import('./lib/locks.ts');
  const { createOperation, locateCheckouts } = await import('./lib/operation.ts');
  const { readQueue, readQueueView, queueOwner, updateQueue } = await import('./lib/queue.ts');
  const { admitQueue, emptyQueue } = await import('./lib/queue-actions.ts');
  const { describe } = await import('./lib/lines.ts');
  const { bunArgs, childEnv } = await import('./lib/process.ts');
  const { processStart } = await import('./lib/process-identity.ts');
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
    sessionEnv,
    startLine,
    startupError,
    writeSession,
  } = await import('./lib/session.ts');
  const { ownTerminal, readTerminal, renameTab, requestExit, setLink, TerminalError, waitTerminal } = await import(
    './lib/terminal.ts'
  );
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
  let managed = false;
  let terminal = '';
  let said = '';
  let locks: LockOwner | undefined;
  let session: ChildProcess | undefined;
  let signalStatus = 0;
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
    if (mode === 'auto' && message === said) return;
    said = message;
    console.log(`celetis-flow: ${message}`);
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
        'celetis-flow: cannot revoke watcher ownership; the runner stops. Exit the session in this pane when ready.',
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
      console.error(`celetis-flow: #${stepEndIssue} cannot write step-end: ${(error as Error).message}`);
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
    ended: Promise<number>,
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
        await startupError(Number(n), record.host, 'no single session identity can be saved', terminal);
        return;
      }
      if (!warned && performance.now() >= deadline) {
        warned = true;
        console.error(
          `celetis-flow: #${n} ${record.host} startup: no saved turn with a verified identity after 60 seconds; monitoring continues. Check setup prompts in this pane.`,
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
                console.error(
                  `celetis-flow: #${n} cannot request ${record.host} exit; the session stays open. Exit it in this pane when ready.`,
                );
              }
              return false;
            }
            const timer = setTimeout(() => {
              if (!abort.aborted)
                console.error(
                  `celetis-flow: #${n} ${record.host} did not exit within 10 seconds; the session stays open. Exit it in this pane when ready.`,
                );
            }, 10_000);
            try {
              await ended;
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
  const startSession = async (args: string[], sessionHost: Host) => {
    if (sessionHost === 'codex')
      args = [...(await (await import('./lib/plugin-metadata.ts')).codexSessionPin(main)), ...args];
    watchDir = await mkdtemp(join(state, 'start.'));
    session = spawn(
      process.execPath,
      bunArgs(import.meta.path, ['--session-start', watchDir, String(process.pid), sessionHost, ...args]),
      {
        cwd: main,
        env: childEnv(sessionEnv(sessionHost, { ...process.env, CELETIS_AGENT: sessionHost })),
        stdio: ['inherit', 'inherit', 'inherit'],
      },
    );
    const ended = new Promise<number>((done) => {
      session?.once('error', (error) => {
        console.error(error.message);
        done(1);
      });
      session?.once('exit', (code, signal) => done(code ?? (signal ? 128 + constants.signals[signal] : 1)));
    });
    await locks?.registerSession(session.pid);
    if (signalStatus) {
      session.kill('SIGTERM');
      await ended;
      session = undefined;
      throw new HostError('', signalStatus);
    }
    return { ended };
  };
  type IssueOutcome = {
    kind: 'closed' | 'gate' | 'stopped';
    started: boolean;
    next: Next | null;
    last: Run | null;
    exitCode: number;
    reason: string;
    act: string | null;
  };
  const finishSession = async () => {
    if (session?.pid && session.exitCode === null && session.signalCode === null) {
      session.kill('SIGTERM');
      await new Promise<void>((done) => session?.once('exit', () => done()));
    }
    session = undefined;
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
    let started = false,
      exitCode = 0;
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
              `${lastHost} session exited with status ${exitCode} before issue progress; check startup output, then run ${manualRecovery(lastHost)} from the main checkout or start the step again`,
            );
          const reason = `no progress: ${prompt}`;
          say(reason);
          await addRecord(common, n, line);
          return outcome('stopped', reason, 'Open the saved session, or use Try again for this step.');
        }
        const skips = last ? skipped(last.step, step, next.lane) : [];
        if (last && !request?.retry && skips.length > 0) {
          const reason = `#${n}: ${step} skips ${skips.join(', ')} after ${last.step}; fix the issue, or start ${step} by hand: celetis --agent <host> celetis-flow ${n}`;
          say(reason);
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
        const announced = managed && stepHost === 'claude' ? randomUUID() : '';
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
        const { ended } = await startSession(announced ? ['--session-id', announced, ...args] : args, stepHost);
        let watchError: unknown;
        if (managed) {
          stepEndIssue = Number(n);
          stepEndOwner = { pid: process.pid, start: await processStart(process.pid) };
          await publish(stepHost, 'checking', null);
          await setLink(terminal, `#${n} ${step}`);
          await renameTab(terminal, `#${n} ${step}`);
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
        }
        await beforeStart?.(next);
        request = undefined;
        override = undefined;
        last = next;
        lastHost = stepHost;
        await writeFile(join(watchDir, 'go'), '');
        started = true;
        exitCode = await ended;
        session = undefined;
        watcher?.abort();
        await watching;
        watching = undefined;
        watcher = undefined;
        if (managed) await setLink(terminal, null);
        await clearStepEnd();
        stepEndIssue = undefined;
        if (watchError !== undefined) throw watchError;
        if (managed && (await readSession(main, Number(n))).session_id === null) {
          if (!(await stat(join(watchDir, 'error')).catch(() => null)))
            await startupError(
              Number(n),
              stepHost,
              'the session ended before a saved turn had a verified identity',
              terminal,
            );
          throw new HostError('', 1);
        }
        await rm(watchDir, { recursive: true, force: true });
        watchDir = '';
        if (signalStatus) throw new HostError('', signalStatus);
      }
    } finally {
      watcher?.abort();
      await watching;
      await clearStepEnd();
      stepEndIssue = undefined;
      await finishSession();
      if (managed) await setLink(terminal, null);
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
    if (mode !== 'resume') {
      if (!Bun.which('gh', { PATH: childEnv().PATH })) die('gh is not on PATH');
      try {
        terminal = (await ownTerminal()) ?? '';
      } catch (error) {
        if (!(error instanceof TerminalError)) throw error;
        die(error.message);
      }
      managed = terminal !== '';
    }
    await mkdir(state, { recursive: true });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const handler = () => {
        signalStatus = 128 + constants.signals[signal];
        watcher?.abort();
        void clearStepEnd();
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    if (saved) {
      const { ended } = await startSession(resumeArguments(saved), host);
      await writeFile(join(watchDir, 'go'), '');
      const code = await ended;
      session = undefined;
      return signalStatus || code;
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
      } else say('stop cannot read the open issues from GitHub');
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
        await finishSession();
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
        return signalStatus || 0;
      }
      if (reason) console.error(reason);
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
    await finishSession();
    if (watchDir) await rm(watchDir, { recursive: true, force: true });
    await clearStepEnd();
    await locks?.releaseAll();
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

async function waitingSession(args: string[]): Promise<number> {
  const [dir, runner, host, ...hostArgs] = args;
  if (!dir || !runner || (host !== 'claude' && host !== 'codex')) return 2;
  const { childEnv } = await import('./lib/process.ts');
  const { processRuns } = await import('./lib/process-identity.ts');
  while (!(await stat(join(dir, 'go')).catch(() => null))?.isFile()) {
    if (!(await processRuns(Number(runner)))) return 1;
    await Bun.sleep(50);
  }
  const executable = Bun.which(host, { PATH: childEnv().PATH });
  if (!executable) return 1;
  return (await import('./lib/update-lock.ts')).execConsumer(executable, [executable, ...hostArgs], childEnv());
}

if (import.meta.main)
  process.exitCode =
    process.argv[2] === '--session-start'
      ? await waitingSession(process.argv.slice(3))
      : await main(process.argv.slice(2));
