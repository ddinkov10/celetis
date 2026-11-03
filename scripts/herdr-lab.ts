import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { constants } from 'node:os';
import { privateMode } from '../engine/lib/private-folder.ts';
import { run } from '../engine/lib/process.ts';

const usage = 'usage: herdr-lab.ts up | run <id> <command> [<argument>...] | down <id>';
const timeout = 30_000;

type LabId = string & { readonly lab: unique symbol };

function labId(value: string): LabId | null {
  return /^celetis-lab-[0-9a-f]{6}$/.test(value) ? (value as LabId) : null;
}

function rootOf(id: LabId): string {
  return `/tmp/${id}`;
}

function labSocket(id: LabId): string {
  return `${rootOf(id)}/run/herdr-core/${id}.sock`;
}

function token(id: LabId): RegExp {
  return new RegExp(`(^|\\s)HC_SESSION=${id}(\\s|$)`);
}

function labEnv(source: NodeJS.ProcessEnv, id: LabId): NodeJS.ProcessEnv {
  const env = { ...source };
  for (const key of [
    'HC_TERMINAL_ID',
    'HC_TERMINAL_SOCKET',
    'HC_SCOPE',
    'HC_SOCKET',
    'HC_SESSION',
    'HERDR_APP_HOME',
    'CLAUDE_CODE_CHILD_SESSION',
  ])
    delete env[key];
  const root = rootOf(id);
  return {
    ...env,
    HC_SESSION: id,
    XDG_STATE_HOME: `${root}/state`,
    XDG_RUNTIME_DIR: `${root}/run`,
    HERDR_APP_HOME: `${root}/app`,
  };
}

async function checkRoot(id: LabId): Promise<'missing' | 'ok' | 'unsafe'> {
  try {
    const stat = await lstat(rootOf(id));
    return stat.isDirectory() && privateMode(stat) ? 'ok' : 'unsafe';
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unsafe';
  }
}

function inLab(): boolean {
  return process.env.HC_SESSION?.startsWith('celetis-lab-') ?? false;
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0] ?? '';
}

function answers(socket: string): Promise<boolean> {
  return new Promise((resolve) => {
    const connection = createConnection({ path: socket });
    const done = (ok: boolean) => {
      clearTimeout(timer);
      connection.destroy();
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), 1000);
    connection.once('connect', () => done(true));
    connection.once('error', () => done(false));
  });
}

function realSocket(env: NodeJS.ProcessEnv): string {
  if (env.HC_SOCKET) return env.HC_SOCKET;
  if (env.HC_TERMINAL_SOCKET) return env.HC_TERMINAL_SOCKET;
  const session = env.HC_SESSION || 'default';
  if (env.XDG_RUNTIME_DIR) return `${env.XDG_RUNTIME_DIR}/herdr-core/${session}.sock`;
  return `${env.XDG_STATE_HOME || `${env.HOME}/.local/state`}/herdr-core/${session}/${session}.sock`;
}

interface Row {
  pid: number;
  ppid: number;
  stat: string;
  environment: string | null;
}

function environmentOf(withEnvironment: string, args: string): string | null {
  const text = withEnvironment.trimStart();
  const argv = args.trimStart();
  return text.startsWith(argv) ? text.slice(argv.length) : null;
}

async function processTable(): Promise<Row[]> {
  const env = { ...process.env, LC_ALL: 'C' };
  const [full, plain] = await Promise.all([
    run('ps', ['ewwax', '-o', 'pid=,ppid=,stat=,command='], { env }),
    run('ps', ['wwax', '-o', 'pid=,command='], { env }),
  ]);
  if (full.code !== 0 || plain.code !== 0) throw new Error(`ps failed: ${firstLine(full.stderr || plain.stderr)}`);
  const args = new Map<number, string>();
  for (const line of plain.stdout.split('\n')) {
    const match = /^\s*(\d+)\s(.*)$/.exec(line);
    if (match) args.set(Number(match[1]), match[2] ?? '');
  }
  const rows: Row[] = [];
  for (const line of full.stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s(.*)$/.exec(line);
    if (!match) continue;
    const pid = Number(match[1]);
    const argv = args.get(pid);
    rows.push({
      pid,
      ppid: Number(match[2]),
      stat: match[3] ?? '',
      environment: argv === undefined ? null : environmentOf(match[4] ?? '', argv),
    });
  }
  return rows;
}

function labProcesses(rows: Row[], id: LabId): Row[] {
  const parents = new Map(rows.map((row) => [row.pid, row.ppid]));
  const own = new Set<number>();
  for (let pid: number | undefined = process.pid; pid && !own.has(pid); pid = parents.get(pid)) own.add(pid);
  const lab = token(id);
  return rows.filter((row) => lab.test(row.environment ?? '') && !row.stat.includes('Z') && !own.has(row.pid));
}

async function signal(
  pid: number,
  name: 'SIGTERM' | 'SIGKILL',
  owned: (args: string, environment: string) => boolean,
): Promise<boolean> {
  const env = { ...process.env, LC_ALL: 'C' };
  const args = await run('ps', ['-ww', '-o', 'command=', '-p', String(pid)], { env });
  const full = await run('ps', ['eww', '-o', 'command=', '-p', String(pid)], { env });
  if (args.code !== 0 || full.code !== 0) return false;
  const argv = args.stdout.trim();
  const environment = environmentOf(full.stdout.trim(), argv);
  if (environment === null || !owned(argv, environment)) return false;
  try {
    process.kill(pid, name);
    console.log(`herdr-lab: ${name} ${pid} ${argv}`);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    return false;
  }
}

async function sweep(id: LabId, signalled: Set<number>): Promise<string[]> {
  const lab = token(id);
  const owned = (_args: string, environment: string) => lab.test(environment);
  const first = new Map<number, number>();
  const killed = new Set<number>();
  const start = Date.now();
  for (;;) {
    const rows = labProcesses(await processTable(), id);
    // The macOS core runs as a launchd job without the lab environment, so only its socket shows it.
    const core = await answers(labSocket(id));
    if (!rows.length && !core) return [];
    if (Date.now() - start >= 90_000)
      return [
        ...(rows.length ? [`processes ${rows.map((row) => row.pid).join(' ')} still run`] : []),
        ...(core ? [`a core still answers at ${labSocket(id)}`] : []),
      ];
    for (const { pid } of rows) {
      const since = first.get(pid);
      if (since === undefined) {
        first.set(pid, Date.now());
        if (!signalled.has(pid)) await signal(pid, 'SIGTERM', owned);
      } else if (!killed.has(pid) && Date.now() - since >= 10_000) {
        killed.add(pid);
        await signal(pid, 'SIGKILL', owned);
      }
    }
    await Bun.sleep(500);
  }
}

async function realReads(id: LabId): Promise<string[]> {
  const problems: string[] = [];
  const socket = realSocket(process.env);
  if (!(await answers(socket))) console.log(`herdr-lab: skipped the real hc ls: no core answers at ${socket}`);
  else {
    const list = await run('hc', ['ls', '--json'], { env: process.env, timeout });
    if (list.code !== 0) console.log(`herdr-lab: skipped the real hc ls: exit ${list.code}: ${firstLine(list.stderr)}`);
    else if (list.stdout.includes(id)) problems.push(`the real hc ls holds ${id}`);
    else {
      const terminals = (JSON.parse(list.stdout) as { terminals: unknown[] }).terminals.length;
      console.log(`herdr-lab: real hc ls: ${terminals} terminals, no lab text`);
    }
  }
  const spaces = await run('herdr-app', ['ls'], { env: process.env, timeout });
  if (spaces.code !== 0)
    console.log(`herdr-lab: skipped the real herdr-app ls: exit ${spaces.code}: ${firstLine(spaces.stderr)}`);
  else if (spaces.stdout.includes(id)) problems.push(`the real herdr-app ls holds ${id}`);
  else {
    const count = (JSON.parse(spaces.stdout) as { spaces: unknown[] }).spaces.length;
    console.log(`herdr-lab: real herdr-app ls: ${count} spaces, no lab text`);
  }
  return problems;
}

async function herdrBinary(): Promise<string | null> {
  const link = Bun.which('herdr-app');
  return link ? realpath(link) : null;
}

async function down(id: LabId): Promise<number> {
  const root = rootOf(id);
  const state = await checkRoot(id);
  if (state === 'unsafe') {
    console.error(`herdr-lab: refused: ${root} is not a private folder of this user`);
    return 2;
  }
  if (state === 'missing' && !labProcesses(await processTable(), id).length) {
    console.log(`herdr-lab: no lab ${id}`);
    return 0;
  }
  const signalled = new Set<number>();
  if (state === 'ok') {
    const pid = Number((await readFile(`${root}/app.pid`, 'utf8').catch(() => '')).trim());
    const binary = await herdrBinary();
    if (Number.isInteger(pid) && pid > 1 && binary) {
      const home = new RegExp(`(^|\\s)HERDR_APP_HOME=${root}/app(\\s|$)`);
      const app = (args: string, environment: string) =>
        (args === binary || args.startsWith(`${binary} `)) && home.test(environment);
      if (await signal(pid, 'SIGTERM', app)) signalled.add(pid);
    }
    if (await answers(labSocket(id)))
      await run('hc', ['server', 'stop', '--json'], { env: labEnv(process.env, id), timeout });
  }
  const survivors = await sweep(id, signalled);
  const problems = [...(await realReads(id)), ...survivors];
  if (problems.length) {
    for (const problem of problems) console.error(`herdr-lab: ${problem}`);
    console.error(`herdr-lab: kept ${root}`);
    return 1;
  }
  await rm(root, { recursive: true, force: true });
  console.log(`herdr-lab: removed lab ${id}`);
  return 0;
}

async function up(): Promise<number> {
  if (process.platform !== 'darwin') {
    console.error('herdr-lab: up runs only on macOS');
    return 2;
  }
  if (inLab()) {
    console.error('herdr-lab: refused: HC_SESSION already names a lab');
    return 2;
  }
  const hc = Bun.which('hc');
  const app = Bun.which('herdr-app');
  if (!hc || !app) {
    console.error('herdr-lab: refused: hc and herdr-app must be on PATH');
    return 2;
  }
  const id = labId(`celetis-lab-${randomBytes(3).toString('hex')}`);
  if (!id) return 1;
  const root = rootOf(id);
  try {
    await mkdir(root, { mode: 0o700 });
  } catch (error) {
    console.error(`herdr-lab: cannot make ${root}: ${(error as Error).message}`);
    return 1;
  }
  console.log(id);
  try {
    const env = labEnv(process.env, id);
    for (const name of ['state', 'run', 'app']) await mkdir(`${root}/${name}`, { mode: 0o700 });
    const start = await run(hc, ['server', 'start', '--json'], { env, timeout });
    if (start.code !== 0) throw new Error(`hc server start: exit ${start.code}: ${firstLine(start.stderr)}`);
    const socket = labSocket(id);
    if (!(await lstat(socket).catch(() => null))?.isSocket()) throw new Error(`no lab socket at ${socket}`);
    const terminals = await run(hc, ['ls', '--json'], { env, timeout });
    if (terminals.code !== 0 || (JSON.parse(terminals.stdout) as { terminals: unknown[] }).terminals.length)
      throw new Error('the lab hc ls is not empty');
    const log = openSync(`${root}/app.log`, 'a', 0o600);
    const child = spawn(await realpath(app), [], { detached: true, stdio: ['ignore', log, log], env });
    closeSync(log);
    child.once('error', () => {});
    if (!child.pid) throw new Error('the Herdr app did not start');
    await writeFile(`${root}/app.pid`, `${child.pid}\n`);
    child.unref();
    const deadline = Date.now() + timeout;
    while ((await run(app, ['status'], { env, timeout })).code !== 0) {
      if (Date.now() > deadline) throw new Error('the lab herdr-app status did not answer in 30 s');
      await Bun.sleep(250);
    }
    const spaces = await run(app, ['ls'], { env, timeout });
    if (spaces.code !== 0 || (JSON.parse(spaces.stdout) as { spaces: unknown[] }).spaces.length)
      throw new Error('the lab herdr-app ls is not empty');
    const version = async (file: string) => (await run(file, ['--version'], { env, timeout })).stdout.trim();
    console.log(
      JSON.stringify({ id, root, socket, appPid: child.pid, hc: await version(hc), herdrApp: await version(app) }),
    );
    return 0;
  } catch (error) {
    console.error(`herdr-lab: up failed: ${(error as Error).message}`);
    await down(id);
    return 1;
  }
}

async function runIn(id: LabId, command: string, args: string[]): Promise<number> {
  const state = await checkRoot(id);
  if (state !== 'ok') {
    console.error(
      state === 'missing'
        ? `herdr-lab: no lab ${id}`
        : `herdr-lab: refused: ${rootOf(id)} is not a private folder of this user`,
    );
    return 2;
  }
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { stdio: 'inherit', env: labEnv(process.env, id) });
    } catch (error) {
      console.error(`herdr-lab: cannot run ${command}: ${(error as Error).message}`);
      return resolve(127);
    }
    const forward = new Map<NodeJS.Signals, () => void>();
    for (const name of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
      const handler = () => child.kill(name);
      forward.set(name, handler);
      process.on(name, handler);
    }
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      for (const [name, handler] of forward) process.off(name, handler);
      resolve(code);
    };
    child.once('error', (error) => {
      console.error(`herdr-lab: cannot run ${command}: ${error.message}`);
      finish(127);
    });
    child.once('close', (code, name) => finish(code ?? (name ? 128 + constants.signals[name] : 1)));
  });
}

async function main(argv: string[]): Promise<number> {
  const [command, value = '', ...rest] = argv;
  if (command === 'up' && argv.length === 1) return up();
  if ((command === 'down' && argv.length === 2) || (command === 'run' && rest.length)) {
    const id = labId(value);
    if (!id) {
      console.error(`herdr-lab: refused lab id ${JSON.stringify(value)}`);
      return 2;
    }
    if (command === 'run') return runIn(id, rest[0] ?? '', rest.slice(1));
    if (inLab()) {
      console.error('herdr-lab: refused: HC_SESSION already names a lab');
      return 2;
    }
    return down(id);
  }
  console.error(usage);
  return 2;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(`herdr-lab: ${(error as Error).message}`);
  process.exitCode = 1;
}
