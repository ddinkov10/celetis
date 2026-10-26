import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join } from 'node:path';
import type { Config } from './lib/config.ts';
import type { Host } from './lib/host.ts';
import type { LockOwner } from './lib/locks.ts';
import type { Operation } from './lib/operation.ts';
import type { SessionRecord } from './lib/session.ts';
import type { Run } from './lib/workflow.ts';

const usage =
  'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow [<issue number>...] | --resume <issue number>, e.g. BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow 373 374; with no number, the automatic runner';
const removed = 'the plugin version of this runner was removed after an update; start the runner again';
const here = import.meta.dir;
const required = [
  'next-step.ts',
  '../bin/celetis.ts',
  'launcher.ts',
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
  'lib/workflow.ts',
  'lib/tracker.ts',
  'lib/lines.ts',
  'lib/process.ts',
  'lib/vendor/yaml.mjs',
];
async function gone(files = required) {
  for (const file of files) if (!(await stat(join(here, file)).catch(() => null))?.isFile()) return true;
  return false;
}
function parsed(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

export async function main(argv: string[]): Promise<number> {
  const unavailable = await gone([
    'lib/config.ts',
    'lib/host.ts',
    'lib/locks.ts',
    'lib/operation.ts',
    'lib/plugin-metadata.ts',
    'lib/plugin-policy.ts',
    'lib/update-lock.ts',
    'lib/windows.ts',
    'lib/process-identity.ts',
    'lib/process.ts',
    'lib/session.ts',
    'lib/workflow.ts',
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
  let mode: 'numbers' | 'auto' | 'resume' = 'numbers';
  let numbers: string[] = [];
  if (argv.length === 2 && argv[0] === '--resume') {
    mode = 'resume';
    numbers = [(argv[1] ?? '').replace(/^#/, '')];
  } else {
    numbers = argv.map((arg) => arg.replace(/^#/, ''));
    if (!numbers.length) mode = 'auto';
  }
  if (numbers.some((n) => !/^[1-9][0-9]*$/.test(n)) || (argv[0] === '--resume' && mode === 'numbers')) {
    console.error(usage);
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
  const { bunArgs, childEnv, run } = await import('./lib/process.ts');
  const {
    hostArguments,
    manualRecovery,
    observeSession,
    readSession,
    reportedSessionId,
    selectSavedSession,
    sessionIdle,
    startupError,
    writeSession,
  } = await import('./lib/session.ts');
  const { defaultGate, invocation, sameResult, skipped } = await import('./lib/workflow.ts');
  const root = dirname(here);
  let common = '',
    main = '',
    state = '';
  let operation: Operation;
  let initial: Operation | undefined;
  const selection = { explicit, environment: process.env.CELETIS_AGENT };
  let managed = false;
  let pane = '';
  let savedId = '';
  let said = '';
  let locks: LockOwner | undefined;
  let session: ChildProcess | undefined;
  let signalStatus = 0;
  let watcher: AbortController | undefined;
  let watchDir = '';
  const handlers = new Map<NodeJS.Signals, () => void>();
  const die = (message: string): never => {
    throw new HostError(`celetis-flow: ${message}`);
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
  const nextOf = async (n: string, current: Operation, abort?: AbortSignal) => {
    const { nextIssue } = await import('./next-step.ts');
    const { lineOf } = await import('./lib/lines.ts');
    const { next, stderr } = await nextIssue(n, current, abort);
    process.stderr.write(stderr);
    return { next, line: lineOf(n, next) };
  };
  const herdr = async (args: string[], abort?: AbortSignal) =>
    run('herdr', args, { cwd: main, env: childEnv(), signal: abort });
  const idle = async (id: string, sessionHost: Host, abort: AbortSignal) =>
    sessionIdle(parsed((await herdr(['agent', 'get', pane], abort)).stdout), sessionHost, id);
  const endWhenDone = async (
    n: string,
    start: Run,
    record: SessionRecord,
    prior: string,
    startedAt: number,
    abort: AbortSignal,
  ) => {
    const deadline = performance.now() + 60_000;
    let saved = false;
    while (!abort.aborted) {
      const reply = await herdr(['agent', 'get', pane], abort);
      if (reply.code === 0) {
        const result = await observeSession(record, parsed(reply.stdout), prior, startedAt);
        if (result === 0) {
          saved = true;
          break;
        }
        if (result === 2) {
          await writeFile(join(watchDir, 'error'), '');
          await startupError(Number(n), record.host, 'herdr returned an invalid identity');
          return;
        }
      }
      if (performance.now() >= deadline) {
        await writeFile(join(watchDir, 'error'), '');
        await startupError(Number(n), record.host, 'no saved turn with a verified identity after 60 seconds');
        return;
      }
      await Bun.sleep(1000);
    }
    if (!saved || abort.aborted) return;
    const id = (await readSession(main, Number(n))).session_id ?? '';
    while (
      !abort.aborted &&
      (await herdr(['agent', 'wait', pane, '--until', 'idle', '--until', 'done'], abort)).code === 0
    ) {
      if (await gone()) {
        say(`#${n}: ${removed}`);
        return;
      }
      if (await idle(id, record.host, abort)) {
        const { next: first } = await nextOf(n, fresh(), abort);
        if (first.kind !== 'observed' && !sameResult(first, start)) {
          const { next: second } = await nextOf(n, fresh(), abort);
          if (second.kind !== 'observed' && sameResult(second, first) && (await idle(id, record.host, abort))) {
            if ((await herdr(['agent', 'prompt', pane, '/exit'], abort)).code !== 0 && !abort.aborted)
              console.error(
                `celetis-flow: #${n} cannot submit /exit; the session stays open. Exit it in this pane when ready.`,
              );
            return;
          }
        }
      }
      await herdr(['agent', 'wait', pane, '--until', 'working', '--until', 'blocked', '--timeout', '5000'], abort);
      if (!abort.aborted) await Bun.sleep(1000);
    }
  };
  const startSession = async (args: string[], sessionHost: Host) => {
    if (sessionHost === 'codex')
      args = [...(await (await import('./lib/plugin-metadata.ts')).codexSessionPin(root, main)), ...args];
    watchDir = await mkdtemp(join(state, 'start.'));
    session = spawn(
      process.execPath,
      bunArgs(import.meta.path, ['--session-start', watchDir, String(process.pid), sessionHost, ...args]),
      {
        cwd: main,
        env: childEnv({ ...process.env, CELETIS_AGENT: sessionHost }),
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
  const runIssue = async (n: string, first: 'any' | 'gated') => {
    const holder = await locks?.take(`issue-${n}`);
    if (holder !== null) {
      say(`another celetis-flow.ts or its session (PID ${holder}) works on #${n}`);
      return false;
    }
    let lastHost: Host = 'claude';
    let last: Run | null = null;
    let started = false,
      exitCode = 0;
    try {
      for (;;) {
        if (signalStatus) throw new HostError('', signalStatus);
        if (await gone()) {
          say(`#${n}: ${removed}`);
          break;
        }
        const current = nextOperation();
        const config = current.mainConfig as Config;
        const stepHost = current.host;
        if (stepHost === 'codex') process.env.CODEX_HOME = await (await import('./lib/plugin-metadata.ts')).codexHome();
        await (await import('./lib/plugin-policy.ts')).requireUpdatePolicy(stepHost, main);
        if (!Bun.which(stepHost, { PATH: childEnv().PATH })) throw new HostError(`celetis: ${stepHost} is not on PATH`);
        const { next, line } = await nextOf(n, current);
        if (next.kind !== 'run') {
          say(line);
          break;
        }
        const { step } = next;
        const prompt = invocation(step, Number(n));
        if (last && sameResult(next, last)) {
          if (exitCode !== 0)
            die(
              `${lastHost} session exited with status ${exitCode} before issue progress; check startup output, then run ${manualRecovery(lastHost)} from the main checkout or start the step again`,
            );
          say(`no progress: ${prompt}`);
          await addRecord(common, n, line);
          break;
        }
        const skips = last ? skipped(last.step, step, next.lane) : [];
        if (last && skips.length > 0) {
          say(
            `#${n}: ${step} skips ${skips.join(', ')} after ${last.step}; fix the issue, or start ${step} by hand: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow ${n}`,
          );
          await addRecord(common, n, line);
          break;
        }
        if (first !== 'any' && (config.gates?.[step] ?? defaultGate) !== 'auto') {
          say(
            `the gate of ${step} is me: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow ${n} starts ${prompt}`,
          );
          break;
        }
        first = 'gated';
        say(`start: ${prompt}`);
        started = true;
        if ((await gone()) || !(await stat(join(root, 'step-prompt.md')).catch(() => null))?.isFile()) {
          say(`#${n}: ${removed}`);
          break;
        }
        const args = await hostArguments(stepHost, Number(n), step, root, main);
        const record: SessionRecord = {
          schema: 1,
          host: stepHost,
          issue: Number(n),
          step,
          checkout: main,
          session_id: null,
        };
        await writeSession(main, record);
        const { ended } = await startSession(args, stepHost);
        let watching: Promise<void> | undefined;
        let watchError: unknown;
        if (managed) {
          if (process.env.HERDR_TAB_ID) await herdr(['tab', 'rename', process.env.HERDR_TAB_ID, `#${n} ${step}`]);
          const prior = reportedSessionId(parsed((await herdr(['agent', 'get', pane])).stdout));
          const startedAt = Math.floor(Date.now() / 1000);
          watcher = new AbortController();
          watching = endWhenDone(n, next, record, prior, startedAt, watcher.signal).catch((error: unknown) => {
            watchError = error;
          });
        }
        await writeFile(join(watchDir, 'go'), '');
        exitCode = await ended;
        session = undefined;
        watcher?.abort();
        await watching;
        watcher = undefined;
        if (watchError !== undefined) throw watchError;
        if (managed && (await readSession(main, Number(n))).session_id === null) {
          if (!(await stat(join(watchDir, 'error')).catch(() => null)))
            await startupError(Number(n), stepHost, 'the session ended before a saved turn had a verified identity');
          throw new HostError('', 1);
        }
        await rm(watchDir, { recursive: true, force: true });
        watchDir = '';
        if (signalStatus) throw new HostError('', signalStatus);
        last = next;
        lastHost = stepHost;
      }
      return started;
    } finally {
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
    const saved = mode === 'resume' ? await selectSavedSession(main, Number(numbers[0]), explicit, common) : undefined;
    operation = createOperation(checkout, { ...selection, saved: saved?.host }, 'main');
    const host = operation.host;
    savedId = saved?.session_id ?? '';
    if (host === 'codex') process.env.CODEX_HOME = await (await import('./lib/plugin-metadata.ts')).codexHome();
    initial = mode === 'resume' ? undefined : operation;
    const { requireUpdatePolicy } = await import('./lib/plugin-policy.ts');
    await (await import('./lib/update-lock.ts')).withPluginRead(host, async () => {
      await requireUpdatePolicy(host, operation.checkout.cwd);
      if (operation.checkout.cwd !== main) await requireUpdatePolicy(host, main);
    });
    if (!Bun.which(host, { PATH: childEnv().PATH })) throw new HostError(`celetis: ${host} is not on PATH`);
    if (mode !== 'resume') {
      if (!Bun.which('gh', { PATH: childEnv().PATH })) die('gh is not on PATH');
      if (process.env.HERDR_ENV === '1') {
        pane = process.env.HERDR_PANE_ID ?? '';
        if (!/^w[A-Za-z0-9]+:p[A-Za-z0-9]+$/.test(pane))
          die('HERDR_ENV=1 needs a valid HERDR_PANE_ID; start from a herdr pane');
        if (!Bun.which('herdr', { PATH: childEnv().PATH })) die('herdr is not on PATH');
        managed = true;
      }
    }
    await mkdir(state, { recursive: true });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const handler = () => {
        signalStatus = 128 + constants.signals[signal];
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    if (mode === 'resume') {
      const holder = await locks.take(`issue-${numbers[0]}`);
      if (holder !== null) die(`another celetis-flow.ts or its session (PID ${holder}) works on #${numbers[0]}`);
      const { ended } = await startSession(
        host === 'claude' ? ['--resume', savedId] : ['resume', '--no-daemon', savedId],
        host,
      );
      await writeFile(join(watchDir, 'go'), '');
      const code = await ended;
      session = undefined;
      return signalStatus || code;
    }
    if (mode === 'numbers') {
      for (const n of numbers) await runIssue(n, 'any');
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
        if (pick) started = await runIssue(pick, 'gated');
        else say('no auto step can start; the runner asks again each 60 seconds');
      } else say('stop cannot read the open issues from GitHub');
      if (!started) {
        const until = performance.now() + 60_000;
        while (!signalStatus && performance.now() < until) await Bun.sleep(50);
      }
    }
    return signalStatus;
  } catch (error) {
    if (error instanceof HostError) {
      if (error.message) console.error(error.message);
      return error.code;
    }
    throw error;
  } finally {
    watcher?.abort();
    if (session?.pid && session.exitCode === null && session.signalCode === null) {
      session.kill('SIGTERM');
      await new Promise<void>((done) => session?.once('exit', () => done()));
    }
    if (watchDir) await rm(watchDir, { recursive: true, force: true });
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
