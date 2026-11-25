import { existsSync } from 'node:fs';
import { lstat, readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { HostError } from './lib/command/errors.ts';
import { commandInput, locateCheckouts, useProjectGrammar } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import {
  askDaemon,
  type Found,
  findDaemon,
  readStatus,
  requestSelection,
  revisionRefusal,
  sendRequest,
  shortRevision,
  socketFolderRefusal,
} from './lib/daemon/client.ts';
import { startDetached } from './lib/daemon/start.ts';
import { type DaemonIdentity, type DaemonStatus, daemonPaths, type RunRow } from './lib/daemon/types.ts';
import { hostAvailability, requireBun } from './lib/host/host.ts';
import { isHost } from './lib/host/names.ts';
import { daemonScript, processAlive, processStart, processState } from './lib/process/identity.ts';
import { bunArgs, childEnv } from './lib/process/process.ts';
import {
  createJob,
  type Detached,
  joinJob,
  makePrivateFolder,
  privateFolderProblem,
  sessionJobName,
} from './lib/process/windows.ts';
import { engineRevision } from './lib/release/release.ts';
import { projectNeedsGh } from './lib/services/services.ts';
import { installRecorder, passOn } from './lib/state/events.ts';
import { linesAfter, readLines } from './lib/state/lines.ts';
import { issueLock, type LockOwner } from './lib/state/locks.ts';
import {
  checkFolder,
  daemonSockets,
  ensureFolder,
  repositoryLayout,
  startFiles,
  stateOutcome,
  withLockSync,
  writeAtomic,
} from './lib/state/state.ts';
import { requireTerminals, TerminalError } from './lib/terminal/terminal.ts';
import { parseHandle } from './lib/tracker/key.ts';

const noDaemon = 'daemon: no daemon runs for this repository';
const root = dirname(import.meta.dir);

function answerless(found: Extract<Found, { kind: 'unknown' }>): HostError {
  return new HostError(`daemon: the daemon of this repository does not answer: ${found.reason}`, exits.blocked);
}

async function runsLine(identity: DaemonIdentity): Promise<string> {
  const revision = await engineRevision(root);
  const line = `daemon: a daemon of this repository runs: PID ${identity.pid} at ${shortRevision(identity.revision)}`;
  return revision === identity.revision
    ? line
    : `${line}; this engine is at ${shortRevision(revision)}; it was not replaced`;
}

const boardLine = (status: DaemonStatus) => `daemon: board ${status.board}`;

async function report(common: string): Promise<DaemonStatus> {
  try {
    return await readStatus(common);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    throw new HostError(error.message, exits.blocked);
  }
}

async function requireStart(main: string): Promise<void> {
  const gh = projectNeedsGh(main);
  try {
    requireBun();
    if (gh && !Bun.which('gh', { PATH: childEnv().PATH })) throw new HostError('gh is not on PATH', exits.prerequisite);
    await requireTerminals();
  } catch (error) {
    if (error instanceof TerminalError || error instanceof HostError)
      throw new HostError(`daemon: ${error.message}`, error.code);
    throw error;
  }
}

async function start(common: string, main: string): Promise<ExitCode> {
  const found = await findDaemon(common);
  if (found.kind === 'unknown') throw answerless(found);
  if (found.kind === 'runs') {
    console.log(await runsLine(found.identity));
    if ((await revisionRefusal(found.identity, 'daemon')) === null) console.log(boardLine(await report(common)));
    return exits.done;
  }
  await requireStart(main);
  const paths = await daemonPaths(common);
  ensureFolder(paths.layout.root);
  ensureFolder(paths.layout.daemon);
  if (process.platform === 'win32') {
    const socketFolder = await lstat(daemonSockets.path).catch(() => null);
    if (socketFolder?.isSymbolicLink())
      throw new HostError(`daemon: ${daemonSockets.path}: need a folder without a reparse point`, exits.prerequisite);
    if (socketFolder) {
      const refusal = socketFolderRefusal(
        makePrivateFolder(daemonSockets.path) ?? privateFolderProblem(daemonSockets.path),
      );
      if (refusal) throw refusal;
    }
  }
  const env = childEnv();
  delete env.HC_SCOPE; // hc kill ends each process whose environment carries the scope of the closed terminal
  let child: Detached;
  try {
    child = await startDetached(process.execPath, bunArgs(join(root, 'engine', daemonScript), ['--daemon']), {
      cwd: main,
      env,
      log: paths.log,
    });
  } catch (error) {
    if (!(error as NodeJS.ErrnoException | null)?.syscall?.startsWith('spawn')) throw error;
    console.error(`daemon: the daemon ended with exit ${exits.blocked} before it served; read ${paths.log}`);
    return exits.blocked;
  }
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const now = await findDaemon(common);
    if (now.kind === 'runs') {
      if ((await revisionRefusal(now.identity, 'daemon')) !== null) {
        console.log(await runsLine(now.identity));
        return exits.done;
      }
      const status = await readStatus(common).catch(() => null);
      if (status) {
        const started = now.identity.pid === child.pid;
        console.log(
          started ? `daemon: started PID ${now.identity.pid} on ${paths.socket}` : await runsLine(now.identity),
        );
        if (started && child.inJob)
          console.error(
            'daemon: this terminal does not let the daemon leave its job; the daemon ends when this terminal closes',
          );
        console.log(boardLine(status));
        return exits.done;
      }
    } else if (child.exitCode() !== null) {
      console.error(`daemon: the daemon ended with exit ${child.exitCode()} before it served; read ${paths.log}`);
      return exits.blocked;
    }
    await Bun.sleep(250);
  }
  console.error(`daemon: the daemon did not answer within 30 seconds; read ${paths.log}`);
  return exits.blocked;
}

const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8);
const rowLine = (row: RunRow) =>
  `daemon: run ${row.id.slice(0, 8)} ${row.kind} ${row.issue === null ? '-' : `#${row.issue}`} ${row.step ?? '-'} ${row.host ?? '-'} ${row.state} ${clock(row.changedMs)}: ${row.line ?? '-'}`;

async function status(common: string): Promise<ExitCode> {
  const found = await findDaemon(common);
  if (found.kind === 'none') {
    console.error(noDaemon);
    return exits.prerequisite;
  }
  if (found.kind === 'unknown') throw answerless(found);
  const refusal = await revisionRefusal(found.identity, 'daemon');
  if (refusal !== null) throw new HostError(refusal, exits.prerequisite);
  const read = await report(common);
  const { daemon } = read;
  console.log(
    `daemon: PID ${daemon.pid} at ${shortRevision(daemon.revision)}, main ${daemon.main}, socket ${daemon.socket}`,
  );
  console.log(boardLine(read));
  console.log(`daemon: auto mode ${read.auto}`);
  for (const row of read.runs) console.log(rowLine(row));
  for (const row of read.landings)
    console.log(`daemon: landing #${row.issue} ${row.state} since ${clock(row.changedMs)}`);
  return exits.done;
}

async function auto(common: string, on: boolean, explicit: string | undefined): Promise<ExitCode> {
  const selection = requestSelection(explicit);
  const { answer } = await askDaemon(common, { kind: 'auto', on, selection }, 'daemon');
  if (!answer.accepted) {
    (answer.code === exits.done ? console.log : console.error)(answer.line);
    return answer.code;
  }
  console.log(`daemon: auto mode ${(await report(common)).auto}`);
  return exits.done;
}

async function stop(common: string): Promise<ExitCode> {
  const found = await findDaemon(common);
  if (found.kind === 'none') {
    console.log(noDaemon);
    return exits.done;
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
      return exits.blocked;
    }
    await Bun.sleep(250);
  }
  console.log(`daemon: stopped PID ${pid}`);
  return exits.done;
}

function events(common: string, after: string | null): ExitCode {
  const log = repositoryLayout(common).lifecycleLog;
  try {
    if (!checkFolder(log.folder) || !(existsSync(log.current) || existsSync(log.rotated))) return exits.done;
    const kept = withLockSync(log.lock, 'shared', () => readLines(log, 'daemon'));
    const shown = linesAfter(kept, after, 'daemon');
    if (shown.length) console.log(shown.map((item) => item.line).join('\n'));
    return exits.done;
  } catch (error) {
    if (stateOutcome(error)?.kind !== 'busy') throw error;
    throw new HostError('daemon: the lifecycle log lock is busy after 2 seconds; try again', exits.prerequisite);
  }
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    const form = args[0];
    const word = form === 'auto' ? args[1] : undefined;
    const valid =
      form === 'auto'
        ? args.length === 2 && (word === 'on' || word === 'off')
        : form === 'events'
          ? args.length === 1 || (args.length === 3 && args[1] === '--after')
          : args.length === 1 && (form === 'start' || form === 'status' || form === 'stop');
    if (!valid) {
      console.error(usage('daemon'));
      return exits.usage;
    }
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.common === null || checkout.main === null)
      throw new HostError('daemon: this folder is no Git checkout', exits.usage);
    if (form === 'events') return events(checkout.common, args[2] ?? null);
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

async function prepareState(argv: string[]): Promise<ExitCode> {
  const session = argv[1] === 'session' && argv.length === 3 ? parseHandle(argv[2] as string) : null;
  if (!(argv.length === 2 && argv[1] === 'queue') && session === null) {
    console.error('state preparation: invalid internal request');
    return exits.usage;
  }
  let owner: LockOwner | undefined;
  try {
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null)
      throw new HostError('state preparation: need a Git checkout', exits.usage);
    owner = (await import('./lib/state/locks.ts')).createLockOwner(checkout.main);
    if (session !== null) {
      const name = issueLock(session);
      const holder = await owner.take(name);
      if (holder !== null)
        throw new HostError(
          `session: ${repositoryLayout(checkout.common).session(session)}: target schema 3: busy ${name} ownership (PID ${holder}); retry after the owner exits`,
          exits.prerequisite,
        );
      await (await import('./lib/run/session.ts')).prepareSession(checkout.main, session, checkout.common, owner);
    } else await (await import('./lib/queue/queue.ts')).prepareQueue(checkout.main, checkout.common, owner);
    return exits.done;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : exits.internal;
  } finally {
    await owner?.releaseAll();
  }
}

// z.record drops a __proto__ key with no issue, so the key is refused before the record parse.
const sessionFile = z
  .custom((value) => !Object.hasOwn(Object(value), '__proto__'))
  .pipe(z.record(z.string(), z.string()));

async function sessionEnv(files: ReturnType<typeof startFiles>): Promise<Readonly<Record<string, string>>> {
  const value: unknown = await readFile(files.env, 'utf8')
    .then((text) => JSON.parse(text))
    .catch(() => null);
  const parsed = sessionFile.safeParse(value);
  if (parsed.success) return parsed.data;
  await writeAtomic(files.error, '');
  throw new HostError(
    `celetis: the session environment file ${files.env} is not valid; start the step again`,
    exits.internal,
  );
}

async function waitingSession(args: string[]): Promise<ExitCode> {
  installRecorder('session-start');
  const [dir, daemon, host, attempt, recovery, ...hostArgs] = args;
  if (
    !dir ||
    !isAbsolute(dir) ||
    !/^[1-9][0-9]*$/.test(daemon ?? '') ||
    !isHost(host) ||
    !attempt ||
    !(attempt === '-' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(attempt)) ||
    !(recovery === '-' || (recovery === 'recovery' && attempt !== '-'))
  )
    return exits.usage;
  const adapter = (await import('./lib/host/hosts.ts')).hostAdapter(host);
  const { spawnConsumer } = await import('./lib/update/lock.ts');
  const files = startFiles(dir);
  await writeAtomic(files.pid, `${JSON.stringify({ pid: process.pid, start: await processStart(process.pid) })}\n`);
  while (!(await stat(files.go).catch(() => null))?.isFile()) {
    if ((await processAlive(Number(daemon))) === 'gone') return exits.prerequisite;
    await Bun.sleep(50);
  }
  let code: ExitCode;
  try {
    const session = await sessionEnv(files);
    const source: NodeJS.ProcessEnv = { ...process.env, CELETIS_SESSION_AGENT: host };
    delete source.CELETIS_RECOVERY;
    delete source.CELETIS_ATTEMPT;
    if (attempt !== '-') source.CELETIS_ATTEMPT = attempt;
    if (recovery === 'recovery') source.CELETIS_RECOVERY = attempt;
    const env = { ...childEnv(adapter.stepEnv(source)), ...(await adapter.homeEnv()), ...session };
    const availability = hostAvailability(host, env);
    if (!availability.available) throw new HostError(availability.cause, exits.prerequisite);
    const { executable } = availability;
    // The handle stays open to the exit of the starter: the name of a job ends with its last handle.
    const job = process.platform === 'win32' ? createJob(sessionJobName(attempt, dir), false) : null;
    if (job) joinJob(job);
    code = passOn(await spawnConsumer(executable, [executable, ...hostArgs], env));
    const members = job?.members();
    if (members?.length === 1 && members[0] === process.pid) await writeAtomic(files.jobEmpty, '').catch(() => {});
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    console.error(error.message);
    code = error.code;
  }
  await writeAtomic(files.status, `${code}\n`).catch(() => {});
  return code;
}

if (import.meta.main) {
  useProjectGrammar();
  const form = process.argv[2];
  if (form === '--daemon')
    process.exit(await (await import('./lib/daemon/server.ts')).runDaemon(process.argv.slice(3)));
  if (form === '--session-start') process.exitCode = await waitingSession(process.argv.slice(3));
  else if (form === '--prepare-state') process.exitCode = await prepareState(process.argv.slice(2));
  else {
    installRecorder('daemon');
    process.exitCode = await main(process.argv.slice(2));
  }
}
