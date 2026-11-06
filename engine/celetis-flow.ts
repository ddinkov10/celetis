import { randomUUID } from 'node:crypto';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import type { Level } from './lib/effort.ts';
import type { LockOwner } from './lib/locks.ts';
import type { HostSelection } from './lib/operation.ts';
import type { QueueAction, QueueWake } from './lib/queue-types.ts';
import type { Place, RunHandle } from './lib/run-engine.ts';

const usage =
  "usage: celetis --agent <host> celetis-flow [<issue number> [--effort low|medium|high|xhigh|max]] [--quiet] | --resume <issue number> | --queue action '<QueueAction JSON>' | --queue status | --retry <issue number> <wait id>; with no number, the automatic runner; --quiet opens each session tab in the background";
// The bootstrap loads no module, so it keeps its own copy of `removed` of lib/run-engine.ts.
const removed = 'the program version of this runner was removed after an update; start the runner again';
const here = import.meta.dir;
async function gone(files: string[]) {
  for (const file of files) if (!(await stat(join(here, file)).catch(() => null))?.isFile()) return true;
  return false;
}

export async function main(argv: string[]): Promise<number> {
  if (argv[0] === '--prepare-state') {
    const session =
      argv[1] === 'session' &&
      argv.length === 3 &&
      /^[1-9][0-9]*$/.test(argv[2] ?? '') &&
      Number.isSafeInteger(Number(argv[2]));
    if (!(argv.length === 2 && argv[1] === 'queue') && !session) {
      console.error('state preparation: invalid internal request');
      return 2;
    }
    let owner: LockOwner | undefined;
    try {
      (await import('./lib/host.ts')).requireBun();
      const checkout = await (await import('./lib/operation.ts')).locateCheckouts(process.cwd());
      if (checkout.main === null || checkout.common === null) throw new Error('state preparation: need a Git checkout');
      owner = (await import('./lib/locks.ts')).createLockOwner(checkout.main);
      if (session) {
        const name = `issue-${argv[2]}`;
        const holder = await owner.take(name);
        if (holder !== null)
          throw new Error(
            `session: ${join(checkout.common, 'celetis-flow', 'sessions', `${argv[2]}.json`)}: target schema 2: busy ${name} ownership (PID ${holder}); retry after the owner exits`,
          );
        await (await import('./lib/session.ts')).prepareSession(checkout.main, Number(argv[2]), checkout.common, owner);
      } else await (await import('./lib/queue.ts')).prepareQueue(checkout.main, checkout.common, owner);
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    } finally {
      await owner?.releaseAll();
    }
  }
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
    'lib/state-migration.ts',
    'lib/state-preparation.ts',
    'lib/queue-types.ts',
    'lib/queue-actions.ts',
    'lib/quota-recovery.ts',
    'lib/agent-order.ts',
    'lib/agent-usage.ts',
    'lib/usage-types.ts',
    'lib/usage-claude.ts',
    'lib/usage-codex.ts',
    'lib/process.ts',
    'lib/session.ts',
    'lib/step-end.ts',
    'lib/terminal.ts',
    'lib/workflow.ts',
    'lib/effort.ts',
    'lib/tracker.ts',
    'lib/lines.ts',
    'lib/run-engine.ts',
    'lib/run-record.ts',
    'lib/daemon-types.ts',
    'lib/daemon-server.ts',
    'lib/daemon-client.ts',
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
  let mode: 'numbers' | 'auto' | 'resume' | 'queue' | 'retry' = 'numbers';
  let numbers: string[] = [];
  let action: QueueAction | undefined;
  let queueCommand = '';
  let wake: QueueWake | undefined;
  let claim: { id: string; token: string } | undefined;
  let waitId = '';
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
        claim = { id: argv[2] as string, token: argv[3] as string };
      } else if (queueCommand !== 'status' || argv.length !== 2) throw new Error(usage);
      mode = 'queue';
    } catch {
      console.error(usage);
      return 2;
    }
  } else if (argv.length === 3 && argv[0] === '--retry') {
    mode = 'retry';
    numbers = [(argv[1] ?? '').replace(/^#/, '')];
    waitId = argv[2] as string;
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
    if (mode === 'resume' || mode === 'retry') console.error(`celetis-flow: ${removed}`);
    else console.log(`celetis-flow: stop ${removed}`);
    return 1;
  }
  const { markDefect } = await import('./lib/events.ts');
  const { HostError, requireBun, selectHost } = await import('./lib/host.ts');
  const { createLockOwner } = await import('./lib/locks.ts');
  const { createOperation, locateCheckouts } = await import('./lib/operation.ts');
  const { explicitHost, readQueue, readQueueView, requireQueueChoice } = await import('./lib/queue.ts');
  const { retryQuota } = await import('./lib/quota-recovery.ts');
  const { admitQueue } = await import('./lib/queue-actions.ts');
  const { autoLoop, createRun, requireSetup } = await import('./lib/run-engine.ts');
  let selection: HostSelection = { explicit, environment: process.env.CELETIS_AGENT };
  let signalStatus = 0;
  const handlers = new Map<NodeJS.Signals, () => void>();
  const setup = (place: Place, gh: boolean, halt: (status: number) => void) => async () => {
    await requireSetup(gh);
    await mkdir(place.state, { recursive: true, mode: 0o700 });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const handler = () => {
        signalStatus = 128 + constants.signals[signal];
        halt(signalStatus);
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
  };
  const fatal = () => process.exit(1);
  try {
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null) throw new HostError('celetis: need a Git checkout', 2);
    const { main, common } = checkout;
    const place: Place = { main, common, state: join(common, 'celetis-flow'), root: dirname(here) };
    if (mode === 'retry') {
      await retryQuota(main, Number(numbers[0]), waitId);
      console.log(`celetis-flow: #${numbers[0]}: Retry requested; the waiting runner starts one bounded attempt cycle`);
      return 0;
    }
    if (mode === 'queue') {
      const queue = await readQueue(main, common, createLockOwner(main));
      if (queue?.choice && action?.kind !== 'add') {
        const requested = selection.explicit ?? selection.environment;
        if (queueCommand !== 'status' && requested !== undefined) {
          try {
            requireQueueChoice(queue.choice, { kind: 'explicit', host: selectHost(requested) });
          } catch (cause) {
            throw new HostError((cause as Error).message, 2);
          }
        }
        const pinned = explicitHost(queue.choice);
        selection = pinned === null ? {} : { saved: pinned };
      }
      const operation = createOperation(checkout, selection, 'main');
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
      const pending = wake ?? claim;
      const run: RunHandle = createRun(
        place,
        { kind: 'queue', id: pending?.id ?? '', token: pending?.token ?? '', selection, quiet },
        { hooks: { ready: setup(place, true, (status) => run.halt({ kind: 'signal', status })), fatal } },
      );
      return (await run.done).code;
    }
    if (mode === 'resume' || mode === 'numbers') {
      const number = Number(numbers[0]);
      const run: RunHandle = createRun(
        place,
        mode === 'resume'
          ? { kind: 'resume', number, selection }
          : { kind: 'number', number, selection, effort: override ?? null, quiet },
        { hooks: { ready: setup(place, mode === 'numbers', (status) => run.halt({ kind: 'signal', status })), fatal } },
      );
      return (await run.done).code;
    }
    const stop = new AbortController();
    let current: RunHandle | undefined;
    const loop = autoLoop(
      place,
      { selection, quiet },
      {
        hooks: {
          ready: setup(place, true, (status) => {
            current?.halt({ kind: 'signal', status });
            stop.abort();
          }),
          fatal,
        },
        shared: true,
        active: () => true,
        signal: stop.signal,
        launch: (start) => {
          const run = start();
          current = run.handle;
          return run;
        },
      },
    );
    return (await loop.done) || signalStatus;
  } catch (error) {
    if (mode === 'queue') {
      const reason = error instanceof Error ? error.message : String(error);
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
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

async function waitingSession(args: string[]): Promise<number> {
  const { installRecorder, passOn } = await import('./lib/events.ts');
  installRecorder('session-start');
  const [dir, runner, host, attempt, recovery, ...hostArgs] = args;
  if (
    !dir ||
    !isAbsolute(dir) ||
    !/^[1-9][0-9]*$/.test(runner ?? '') ||
    (host !== 'claude' && host !== 'codex') ||
    !(attempt === '-' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(attempt ?? '')) ||
    !(recovery === '-' || (recovery === 'recovery' && attempt !== '-'))
  )
    return 2;
  const { HostError } = await import('./lib/host.ts');
  const { codexHome } = await import('./lib/plugin-metadata.ts');
  const { childEnv } = await import('./lib/process.ts');
  const { processAlive, processStart } = await import('./lib/process-identity.ts');
  const { sessionEnv } = await import('./lib/session.ts');
  const { spawnConsumer } = await import('./lib/update-lock.ts');
  const record = async (name: string, value: string) => {
    const temp = join(dir, `.${name}.${randomUUID()}`);
    await writeFile(temp, value, { mode: 0o600, flag: 'wx' });
    await rename(temp, join(dir, name));
  };
  await record('pid', `${JSON.stringify({ pid: process.pid, start: await processStart(process.pid) })}\n`);
  while (!(await stat(join(dir, 'go')).catch(() => null))?.isFile()) {
    if ((await processAlive(Number(runner))) === 'gone') return 1;
    await Bun.sleep(50);
  }
  let code = 1;
  try {
    const source: NodeJS.ProcessEnv = { ...process.env, CELETIS_SESSION_AGENT: host };
    delete source.CELETIS_RECOVERY;
    delete source.CELETIS_ATTEMPT;
    if (attempt !== '-') source.CELETIS_ATTEMPT = attempt;
    if (recovery === 'recovery') source.CELETIS_RECOVERY = attempt;
    const env = childEnv(sessionEnv(host, source));
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

if (import.meta.main) {
  if (process.argv[2] === '--daemon' && process.argv.length === 3)
    process.exit(await (await import('./lib/daemon-server.ts')).runDaemon());
  process.exitCode =
    process.argv[2] === '--session-start'
      ? await waitingSession(process.argv.slice(3))
      : await main(process.argv.slice(2));
}
