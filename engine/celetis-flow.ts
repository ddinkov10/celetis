import { randomUUID } from 'node:crypto';
import { rename, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { DaemonRequest } from './lib/daemon-types.ts';
import type { Level } from './lib/effort.ts';
import type { LockOwner } from './lib/locks.ts';
import type { HostSelection } from './lib/operation.ts';
import type { QueueAction, QueueRecord } from './lib/queue-types.ts';

type QueueForm =
  | { command: 'status' }
  | { command: 'action' | 'admit'; action: QueueAction }
  | { command: 'run'; id: string; token: string };

const usage =
  "usage: celetis --agent <host> celetis-flow <issue number> [--effort low|medium|high|xhigh|max] [--quiet] | --resume <issue number> | --queue action '<QueueAction JSON>' | --queue status | --retry <issue number> <wait id>; each form sends one request to the master daemon of this repository and returns; --quiet opens each session tab of the start in the background; the automatic runner: celetis daemon auto on|off";
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
  let mode: 'numbers' | 'resume' | 'queue' | 'retry' = 'numbers';
  let numbers: string[] = [];
  let form: QueueForm | undefined;
  let waitId = '';
  let override: Level | undefined;
  if (argv[0] === '--queue' && !unavailable) {
    try {
      const { parseQueueAction } = await import('./lib/queue.ts');
      const command = argv[1];
      if ((command === 'action' || command === 'admit') && argv.length === 3)
        form = { command, action: parseQueueAction(JSON.parse(argv[2] as string)) };
      else if (
        command === 'run' &&
        argv.length === 4 &&
        argv
          .slice(2)
          .every((value) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value))
      )
        form = { command, id: argv[2] as string, token: argv[3] as string };
      else if (command === 'status' && argv.length === 2) form = { command };
      else throw new Error(usage);
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
  } else {
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
      console.log(`celetis-flow: #${numbers[0]}: ${removed}`);
      return 0;
    }
    console.error(`celetis-flow: ${removed}`);
    return 1;
  }
  const { markDefect } = await import('./lib/events.ts');
  const { HostError, requireBun, selectHost } = await import('./lib/host.ts');
  const { askDaemon, requestSelection, requireDaemon } = await import('./lib/daemon-client.ts');
  const { createLockOwner } = await import('./lib/locks.ts');
  const { createOperation, locateCheckouts } = await import('./lib/operation.ts');
  const { explicitHost, readQueue, readQueueView, requireQueueChoice } = await import('./lib/queue.ts');
  const { admitQueue } = await import('./lib/queue-actions.ts');
  try {
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null) throw new HostError('celetis: need a Git checkout', 2);
    const { main, common } = checkout;
    const requested = requestSelection(explicit);
    const ask = async (request: Exclude<DaemonRequest, { kind: 'status' | 'stop' | 'auto' }>, subject: string) => {
      const { identity, answer } = await askDaemon(common, request, 'celetis-flow');
      if (!answer.accepted) {
        (answer.code === 0 ? console.log : console.error)(answer.line);
        return answer.code;
      }
      if (request.kind === 'retry') {
        console.log(`celetis-flow: ${subject}: Retry requested; the waiting runner starts one bounded attempt cycle`);
        return 0;
      }
      if (answer.run === null)
        throw new HostError(
          'celetis-flow: the outcome of the request is unknown: daemon: the daemon sent no run ID; read celetis daemon status',
          6,
        );
      console.log(
        `celetis-flow: ${subject}: accepted as run ${answer.run.slice(0, 8)} of the daemon PID ${identity.pid}; read its progress: celetis daemon status`,
      );
      return 0;
    };
    const number = Number(numbers[0]);
    if (mode === 'retry') return await ask({ kind: 'retry', number, waitId }, `#${number}`);
    if (mode === 'resume') return await ask({ kind: 'resume', number, selection: requested }, `#${number}`);
    if (form === undefined)
      return await ask({ kind: 'run', number, selection: requested, effort: override ?? null, quiet }, `#${number}`);
    const queue = await readQueue(main, common, createLockOwner(main));
    let selection: HostSelection = { explicit, environment: process.env.CELETIS_AGENT };
    const adding = (form.command === 'action' || form.command === 'admit') && form.action.kind === 'add';
    if (queue?.choice && !adding) {
      const named = selection.explicit ?? selection.environment;
      if (form.command !== 'status' && named !== undefined) {
        try {
          requireQueueChoice(queue.choice, { kind: 'explicit', host: selectHost(named) });
        } catch (cause) {
          throw new HostError((cause as Error).message, 2);
        }
      }
      const pinned = explicitHost(queue.choice);
      selection = pinned === null ? {} : { saved: pinned };
    }
    const operation = createOperation(checkout, selection, 'main');
    const subject = (record: QueueRecord | null) =>
      record?.numbers[0] === undefined ? 'queue' : `#${record.numbers[0]}`;
    if (form.command === 'status') {
      console.log(JSON.stringify(await readQueueView(operation)));
      return 0;
    }
    if (form.command === 'run')
      return await ask({ kind: 'queue', id: form.id, token: form.token, selection: requested, quiet }, subject(queue));
    const { action } = form;
    if (
      form.command === 'action' &&
      (action.kind === 'continue' || action.kind === 'retry' || (action.kind === 'add' && !queue?.numbers.length))
    )
      await requireDaemon(common, 'celetis-flow');
    const receipt = await admitQueue(operation, action);
    if (form.command === 'admit') {
      console.log(JSON.stringify(receipt));
      return 0;
    }
    console.log(JSON.stringify(receipt.view));
    if (!receipt.wake) return 0;
    return await ask(
      { kind: 'queue', id: receipt.wake.id, token: receipt.wake.token, selection: requested, quiet },
      subject(receipt.view.record),
    );
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
