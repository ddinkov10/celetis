import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import {
  askDaemon,
  type Found,
  findDaemon,
  readStatus,
  requestSelection,
  sendRequest,
  shortRevision,
} from './lib/daemon-client.ts';
import { type DaemonIdentity, daemonPaths, type RunRow } from './lib/daemon-types.ts';
import { installRecorder, passOn } from './lib/events.ts';
import { HostError, requireBun } from './lib/host.ts';
import type { LockOwner } from './lib/locks.ts';
import { commandInput, locateCheckouts } from './lib/operation.ts';
import { bunArgs, childEnv } from './lib/process.ts';
import { daemonScript, processAlive, processStart, processState } from './lib/process-identity.ts';
import { programRevision } from './lib/program.ts';
import { stateFolder } from './lib/state-folder.ts';
import { requireTerminals, TerminalError } from './lib/terminal.ts';

const usage = 'usage: celetis daemon start | status | stop | auto on|off';
const noDaemon = 'daemon: no daemon runs for this repository';
const root = dirname(import.meta.dir);

function answerless(found: Extract<Found, { kind: 'unknown' }>): HostError {
  return new HostError(`daemon: the daemon of this repository does not answer: ${found.reason}`, 6);
}

async function runsLine(identity: DaemonIdentity): Promise<string> {
  const revision = await programRevision(root);
  const line = `daemon: a daemon of this repository runs: PID ${identity.pid} at ${shortRevision(identity.revision)}`;
  return revision === identity.revision
    ? line
    : `${line}; this program is at ${shortRevision(revision)}; it was not replaced`;
}

async function requireStart(): Promise<void> {
  try {
    requireBun();
    if (!Bun.which('gh', { PATH: childEnv().PATH })) throw new HostError('gh is not on PATH');
    await requireTerminals();
  } catch (error) {
    if (error instanceof TerminalError || error instanceof HostError)
      throw new HostError(`daemon: ${error.message}`, 1);
    throw error;
  }
}

async function start(common: string, main: string): Promise<number> {
  const found = await findDaemon(common);
  if (found.kind === 'unknown') throw answerless(found);
  if (found.kind === 'runs') {
    console.log(await runsLine(found.identity));
    return 0;
  }
  await requireStart();
  const paths = await daemonPaths(common);
  await mkdir(paths.folder, { recursive: true, mode: 0o700 });
  const log = openSync(paths.log, 'a', 0o600);
  const ended: { code: number | null } = { code: null };
  const env = childEnv();
  delete env.HC_SCOPE; // hc kill ends each process whose environment carries the scope of the closed terminal
  const child = spawn(process.execPath, bunArgs(join(root, 'engine', daemonScript), ['--daemon']), {
    detached: true,
    stdio: ['ignore', log, log],
    env,
    cwd: main,
  });
  closeSync(log);
  child.once('error', () => {
    ended.code = 1;
  });
  child.once('exit', (code) => {
    ended.code = code ?? 1;
  });
  child.unref();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const now = await findDaemon(common);
    if (now.kind === 'runs') {
      const answered = await readStatus(common).then(
        () => true,
        () => false,
      );
      if (answered && now.identity.pid === child.pid) {
        console.log(`daemon: started PID ${now.identity.pid} on ${paths.socket}`);
        return 0;
      }
      if (answered) {
        console.log(await runsLine(now.identity));
        return 0;
      }
    } else if (ended.code !== null) {
      console.error(`daemon: the daemon ended with exit ${ended.code} before it served; read ${paths.log}`);
      return 1;
    }
    await Bun.sleep(250);
  }
  console.error(`daemon: the daemon did not answer within 30 seconds; read ${paths.log}`);
  return 1;
}

const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8);
const rowLine = (row: RunRow) =>
  `daemon: run ${row.id.slice(0, 8)} ${row.kind} ${row.issue === null ? '-' : `#${row.issue}`} ${row.step ?? '-'} ${row.host ?? '-'} ${row.state} ${clock(row.changedMs)}: ${row.line ?? '-'}`;

async function status(common: string): Promise<number> {
  const found = await findDaemon(common);
  if (found.kind === 'none') {
    console.error(noDaemon);
    return 3;
  }
  if (found.kind === 'unknown') throw answerless(found);
  let report: Awaited<ReturnType<typeof readStatus>>;
  try {
    report = await readStatus(common);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    throw new HostError(error.message, 6);
  }
  const { daemon } = report;
  console.log(
    `daemon: PID ${daemon.pid} at ${shortRevision(daemon.revision)}, main ${daemon.main}, socket ${daemon.socket}`,
  );
  console.log(`daemon: auto mode ${report.auto}`);
  for (const row of report.runs) console.log(rowLine(row));
  return 0;
}

async function auto(common: string, on: boolean, explicit: string | undefined): Promise<number> {
  const selection = requestSelection(explicit);
  const { answer } = await askDaemon(common, { kind: 'auto', on, selection, quiet: false }, 'daemon');
  if (!answer.accepted) {
    (answer.code === 0 ? console.log : console.error)(answer.line);
    return answer.code;
  }
  let report: Awaited<ReturnType<typeof readStatus>>;
  try {
    report = await readStatus(common);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    throw new HostError(error.message, 6);
  }
  console.log(`daemon: auto mode ${report.auto}`);
  return 0;
}

async function stop(common: string): Promise<number> {
  const found = await findDaemon(common);
  if (found.kind === 'none') {
    console.log(noDaemon);
    return 0;
  }
  if (found.kind === 'unknown') throw answerless(found);
  const { pid, start } = found.identity;
  try {
    const answer = await sendRequest(common, { kind: 'stop' });
    if (!answer.accepted) console.error(answer.line);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    console.error(error.message);
  }
  const deadline = Date.now() + 60_000;
  while ((await processState(pid, start)) !== 'gone') {
    if (Date.now() >= deadline) {
      console.error(`daemon: PID ${pid} did not exit within 60 seconds`);
      return 6;
    }
    await Bun.sleep(250);
  }
  console.log(`daemon: stopped PID ${pid}`);
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    if (process.platform === 'win32') throw new HostError('daemon: Windows is not a support target', 2);
    const form = args[0];
    const word = form === 'auto' ? args[1] : undefined;
    const valid =
      form === 'auto'
        ? args.length === 2 && (word === 'on' || word === 'off')
        : args.length === 1 && (form === 'start' || form === 'status' || form === 'stop');
    if (!valid) {
      console.error(usage);
      return 2;
    }
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.common === null || checkout.main === null)
      throw new HostError('daemon: this folder is no Git checkout', 2);
    if (form === 'start') return await start(checkout.common, checkout.main);
    if (form === 'status') return await status(checkout.common);
    if (form === 'auto') return await auto(checkout.common, word === 'on', explicit);
    return await stop(checkout.common);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

async function prepareState(argv: string[]): Promise<number> {
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
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null) throw new Error('state preparation: need a Git checkout');
    owner = (await import('./lib/locks.ts')).createLockOwner(checkout.main);
    if (session) {
      const name = `issue-${argv[2]}`;
      const holder = await owner.take(name);
      if (holder !== null)
        throw new Error(
          `session: ${join(await stateFolder(checkout.common), 'sessions', `${argv[2]}.json`)}: target schema 2: busy ${name} ownership (PID ${holder}); retry after the owner exits`,
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

async function waitingSession(args: string[]): Promise<number> {
  installRecorder('session-start');
  const [dir, daemon, host, attempt, recovery, ...hostArgs] = args;
  if (
    !dir ||
    !isAbsolute(dir) ||
    !/^[1-9][0-9]*$/.test(daemon ?? '') ||
    (host !== 'claude' && host !== 'codex') ||
    !(attempt === '-' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(attempt ?? '')) ||
    !(recovery === '-' || (recovery === 'recovery' && attempt !== '-'))
  )
    return 2;
  const { codexHome } = await import('./lib/plugin-metadata.ts');
  const { sessionEnv } = await import('./lib/session.ts');
  const { spawnConsumer } = await import('./lib/update-lock.ts');
  const record = async (name: string, value: string) => {
    const temp = join(dir, `.${name}.${randomUUID()}`);
    await writeFile(temp, value, { mode: 0o600, flag: 'wx' });
    await rename(temp, join(dir, name));
  };
  await record('pid', `${JSON.stringify({ pid: process.pid, start: await processStart(process.pid) })}\n`);
  while (!(await stat(join(dir, 'go')).catch(() => null))?.isFile()) {
    if ((await processAlive(Number(daemon))) === 'gone') return 1;
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
  const form = process.argv[2];
  if (form === '--daemon' && process.argv.length === 3)
    process.exit(await (await import('./lib/daemon-server.ts')).runDaemon());
  if (form === '--session-start') process.exitCode = await waitingSession(process.argv.slice(3));
  else if (form === '--prepare-state') process.exitCode = await prepareState(process.argv.slice(2));
  else {
    installRecorder('daemon');
    process.exitCode = await main(process.argv.slice(2));
  }
}
