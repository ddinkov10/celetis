import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type Found, findDaemon, readStatus, sendRequest } from './lib/daemon-client.ts';
import { type DaemonIdentity, daemonPaths, type RunRow } from './lib/daemon-types.ts';
import { installRecorder } from './lib/events.ts';
import { HostError, requireBun } from './lib/host.ts';
import { commandInput, locateCheckouts } from './lib/operation.ts';
import { bunArgs, childEnv } from './lib/process.ts';
import { processState } from './lib/process-identity.ts';
import { programRevision } from './lib/program.ts';
import { requireTerminals, TerminalError } from './lib/terminal.ts';

const usage = 'usage: celetis daemon start | status | stop';
const noDaemon = 'daemon: no daemon runs for this repository';
const root = dirname(import.meta.dir);
const short = (revision: string) => revision.slice(0, 12);

function answerless(found: Extract<Found, { kind: 'unknown' }>): HostError {
  return new HostError(`daemon: the daemon of this repository does not answer: ${found.reason}`, 6);
}

async function runsLine(identity: DaemonIdentity): Promise<string> {
  const revision = await programRevision(root);
  const line = `daemon: a daemon of this repository runs: PID ${identity.pid} at ${short(identity.revision)}`;
  return revision === identity.revision ? line : `${line}; this program is at ${short(revision)}; it was not replaced`;
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
  const paths = daemonPaths(common);
  await mkdir(paths.folder, { recursive: true, mode: 0o700 });
  const log = openSync(paths.log, 'a', 0o600);
  const ended: { code: number | null } = { code: null };
  const env = childEnv();
  delete env.HC_SCOPE; // hc kill ends each process whose environment carries the scope of the closed terminal
  const child = spawn(process.execPath, bunArgs(join(root, 'engine/celetis-flow.ts'), ['--daemon']), {
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
  console.log(`daemon: PID ${daemon.pid} at ${short(daemon.revision)}, main ${daemon.main}, socket ${daemon.socket}`);
  console.log(`daemon: automatic runner ${report.auto}`);
  for (const row of report.runs) console.log(rowLine(row));
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
    const { args } = commandInput(argv);
    if (process.platform === 'win32') throw new HostError('daemon: Windows is not a support target', 2);
    const form = args[0];
    if (args.length !== 1 || (form !== 'start' && form !== 'status' && form !== 'stop')) {
      console.error(usage);
      return 2;
    }
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.common === null || checkout.main === null)
      throw new HostError('daemon: this folder is no Git checkout', 2);
    if (form === 'start') return await start(checkout.common, checkout.main);
    if (form === 'status') return await status(checkout.common);
    return await stop(checkout.common);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) {
  installRecorder('daemon');
  process.exitCode = await main(process.argv.slice(2));
}
