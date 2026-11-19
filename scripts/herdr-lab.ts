import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { constants, tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { bunArgs, childEnv, run } from '../engine/lib/process/process.ts';
import {
  createJob,
  type Job,
  joinJob,
  makePrivateFolder,
  openJob,
  privateFolderProblem,
  terminateWindowsProcess,
  windowsProcess,
} from '../engine/lib/process/windows.ts';
import { privateMode } from '../engine/lib/state/state.ts';

const usage = 'usage: herdr-lab.ts up | run <id> <command> [<argument>...] | down <id>';
const timeout = 30_000;
const windows = process.platform === 'win32';

type LabId = string & { readonly lab: unique symbol };

function labId(value: string): LabId | null {
  return /^celetis-lab-[0-9a-f]{6}$/.test(value) ? (value as LabId) : null;
}

function rootOf(id: LabId): string {
  return windows ? join(tmpdir(), id) : `/tmp/${id}`;
}

function corePipe(session: string): string {
  return `\\\\.\\pipe\\herdr-core-${userInfo().username}-${session}.sock`;
}

function labSocket(id: LabId): string {
  return windows ? corePipe(id) : `${rootOf(id)}/run/herdr-core/${id}.sock`;
}

function jobName(id: LabId): string {
  return `Local\\${id}`;
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
  if (windows) return { ...env, HC_SESSION: id, HERDR_APP_HOME: join(root, 'app') };
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
    const root = rootOf(id);
    const stat = await lstat(root);
    if (!stat.isDirectory() || !privateMode(stat)) return 'unsafe';
    return windows && privateFolderProblem(root) !== null ? 'unsafe' : 'ok';
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
  if (windows) return corePipe(session);
  if (env.XDG_RUNTIME_DIR) return `${env.XDG_RUNTIME_DIR}/herdr-core/${session}.sock`;
  return `${env.XDG_STATE_HOME || `${env.HOME}/.local/state`}/herdr-core/${session}/${session}.sock`;
}

interface Row {
  pid: number;
  ppid: number;
  stat: string;
  args: string;
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
      args: argv ?? '',
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

function appEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const keys = [
    'HC_SESSION',
    'XDG_STATE_HOME',
    'XDG_RUNTIME_DIR',
    'HERDR_APP_HOME',
    'PATH',
    'DO_NOT_TRACK',
    'HERDR_TELEMETRY',
  ];
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = env[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

function bundleOf(binary: string): string | null {
  return /^(.+\.app)\/Contents\/MacOS\/[^/]+$/.exec(binary)?.[1] ?? null;
}

async function labApp(root: string, binary: string): Promise<number> {
  const home = new RegExp(`(^|\\s)HERDR_APP_HOME=${root}/app(\\s|$)`);
  const deadline = Date.now() + timeout;
  for (;;) {
    const rows = await processTable().catch(() => []);
    const app = rows.find(
      (row) =>
        !row.stat.includes('Z') &&
        row.environment !== null &&
        home.test(row.environment) &&
        (row.args === binary || row.args.startsWith(`${binary} `)),
    );
    if (app) return app.pid;
    if (Date.now() > deadline) throw new Error('the Herdr app did not start');
    await Bun.sleep(250);
  }
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
    console.error('herdr-lab: up runs only on macOS and Windows');
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
    const binary = await realpath(app);
    const bundle = bundleOf(binary);
    if (!bundle) throw new Error(`herdr-app is not in an app bundle: ${binary}`);
    const log = `${root}/app.log`;
    const keys = appEnv(env);
    const pairs = Object.entries(keys).flatMap(([key, value]) => ['--env', `${key}=${value}`]);
    // open passes its own environment to the app, so it gets only the lab keys too.
    const opened = Bun.spawn(['open', '-n', '-g', '--stdout', log, '--stderr', log, ...pairs, '-a', bundle], {
      env: keys,
      stdout: 'ignore',
      stderr: 'pipe',
      timeout,
    });
    const code = await opened.exited;
    if (code !== 0) throw new Error(`open: exit ${code}: ${firstLine(await new Response(opened.stderr).text())}`);
    const appPid = await labApp(root, binary);
    await writeFile(`${root}/app.pid`, `${appPid}\n`);
    const deadline = Date.now() + timeout;
    while ((await run(app, ['status'], { env, timeout })).code !== 0) {
      if (Date.now() > deadline) throw new Error('the lab herdr-app status did not answer in 30 s');
      await Bun.sleep(250);
    }
    const spaces = await run(app, ['ls'], { env, timeout });
    if (spaces.code !== 0 || (JSON.parse(spaces.stdout) as { spaces: unknown[] }).spaces.length)
      throw new Error('the lab herdr-app ls is not empty');
    const version = async (file: string) => (await run(file, ['--version'], { env, timeout })).stdout.trim();
    console.log(JSON.stringify({ id, root, socket, appPid, hc: await version(hc), herdrApp: await version(app) }));
    return 0;
  } catch (error) {
    console.error(`herdr-lab: up failed: ${(error as Error).message}`);
    await down(id);
    return 1;
  }
}

interface Window {
  pid: number;
  start: string;
}

async function herdrApps(): Promise<number[]> {
  const list = await run('tasklist.exe', ['/FO', 'CSV', '/NH', '/FI', 'IMAGENAME eq herdr-app.exe'], { timeout });
  if (list.code !== 0) throw new Error(`tasklist: exit ${list.code}: ${firstLine(list.stderr)}`);
  return [...list.stdout.matchAll(/^"herdr-app\.exe","(\d+)"/gim)].map((match) => Number(match[1]));
}

async function keep(id: LabId, env: NodeJS.ProcessEnv): Promise<void> {
  const library = new URL('../engine/lib/process/windows.ts', import.meta.url).href;
  const script = `const { openJob } = await import(${JSON.stringify(library)}); if (!openJob(${JSON.stringify(jobName(id))})) process.exit(1); console.log('ready'); setInterval(() => {}, 1 << 30);`;
  // A job name ends with its last handle, also while its members run; the keeper holds one until down.
  const keeper = Bun.spawn([process.execPath, ...bunArgs('-e', [script])], {
    env: childEnv(env),
    detached: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  keeper.unref();
  const reader = keeper.stdout.getReader();
  let timer: Timer | undefined;
  const first = await Promise.race([
    reader.read(),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeout);
    }),
  ]);
  clearTimeout(timer);
  await reader.cancel();
  if (!first?.value || !new TextDecoder().decode(first.value).startsWith('ready'))
    throw new Error('the job keeper did not start');
}

async function labWindow(job: Job, before: Set<number>): Promise<Window> {
  const self = windowsProcess(process.pid);
  if (self.state !== 'runs') throw new Error('cannot read the start of herdr-lab');
  const deadline = Date.now() + timeout;
  for (;;) {
    const fresh = (await herdrApps()).filter((pid) => !before.has(pid));
    const members = job.members() ?? [];
    const held = fresh.filter((pid) => members.includes(pid));
    const pid = held.length === 1 ? held[0] : fresh.length === 1 ? fresh[0] : undefined;
    const shown = pid === undefined ? null : windowsProcess(pid);
    if (pid !== undefined && shown?.state === 'runs' && BigInt(shown.start) > BigInt(self.start))
      return { pid, start: shown.start };
    if (Date.now() > deadline)
      throw new Error(`cannot tell the lab window: new herdr-app.exe ${fresh.join(' ') || 'none'}`);
    await Bun.sleep(250);
  }
}

async function upWindows(): Promise<number> {
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
    await mkdir(root);
  } catch (error) {
    console.error(`herdr-lab: cannot make ${root}: ${(error as Error).message}`);
    return 1;
  }
  let reason: string | null;
  try {
    reason = makePrivateFolder(root);
  } catch (error) {
    reason = (error as Error).message;
  }
  if (reason) {
    console.error(`herdr-lab: cannot make ${root} private: ${reason}`);
    await rm(root, { recursive: true, force: true });
    return 1;
  }
  console.log(id);
  let job: Job | null = null;
  let member = false;
  try {
    const env = labEnv(process.env, id);
    await mkdir(join(root, 'app'));
    job = createJob(jobName(id), false);
    await writeFile(join(root, 'job'), `${jobName(id)}\n`);
    joinJob(job);
    member = true;
    await keep(id, env);
    const start = await run(hc, ['server', 'start', '--json'], { env, timeout });
    if (start.code !== 0) throw new Error(`hc server start: exit ${start.code}: ${firstLine(start.stderr)}`);
    const socket = labSocket(id);
    if (!(await answers(socket))) throw new Error(`no lab core answers at ${socket}`);
    const terminals = await run(hc, ['ls', '--json'], { env, timeout });
    if (terminals.code !== 0 || (JSON.parse(terminals.stdout) as { terminals: unknown[] }).terminals.length)
      throw new Error('the lab hc ls is not empty');
    const before = new Set(await herdrApps());
    Bun.spawn([app], { env: childEnv(env), detached: true, stdio: ['ignore', 'ignore', 'ignore'] }).unref();
    const deadline = Date.now() + timeout;
    while ((await run(app, ['status'], { env, timeout })).code !== 0) {
      if (Date.now() > deadline) throw new Error('the lab herdr-app status did not answer in 30 s');
      await Bun.sleep(250);
    }
    const window = await labWindow(job, before);
    await writeFile(join(root, 'app.json'), `${JSON.stringify(window)}\n`);
    const spaces = await run(app, ['ls'], { env, timeout });
    if (spaces.code !== 0 || (JSON.parse(spaces.stdout) as { spaces: unknown[] }).spaces.length)
      throw new Error('the lab herdr-app ls is not empty');
    const version = async (file: string) => (await run(file, ['--version'], { env, timeout })).stdout.trim();
    console.log(
      JSON.stringify({ id, root, socket, appPid: window.pid, hc: await version(hc), herdrApp: await version(app) }),
    );
    return 0;
  } catch (error) {
    console.error(`herdr-lab: up failed: ${(error as Error).message}`);
    if (job) await downWindows(id, member);
    else await rm(root, { recursive: true, force: true });
    return 1;
  }
}

async function windowOf(root: string): Promise<Window | null> {
  const file = join(root, 'app.json');
  try {
    const window = JSON.parse(await readFile(file, 'utf8')) as Window;
    if (Number.isInteger(window.pid) && /^\d+$/.test(window.start)) return window;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
  }
  throw new Error(`a bad record in ${file}`);
}

async function downWindows(id: LabId, member = false): Promise<number> {
  const root = rootOf(id);
  const state = await checkRoot(id);
  if (state === 'unsafe') {
    console.error(`herdr-lab: refused: ${root} is not a private folder of this user`);
    return 2;
  }
  const job = openJob(jobName(id));
  if (state === 'missing' && !job) {
    console.log(`herdr-lab: no lab ${id}`);
    return 0;
  }
  try {
    const problems: string[] = [];
    const record = join(root, 'job');
    if (await answers(labSocket(id)))
      await run(Bun.which('hc') ?? 'hc', ['server', 'stop', '--json'], { env: labEnv(process.env, id), timeout });
    // A job name goes with its last handle, so a lost keeper hides the members; only a down that saw the job empty removes this record.
    if (!job && state === 'ok' && existsSync(record))
      problems.push(`the lab job ${jobName(id)} cannot be opened, and no down saw it empty`);
    const window =
      state === 'ok'
        ? await windowOf(root).catch((error: Error) => {
            problems.push(error.message);
            return null;
          })
        : null;
    const deadline = Date.now() + 90_000;
    let emptied = false;
    for (;;) {
      if (job && member) job.terminateOthers();
      else job?.terminate();
      const shown = window ? windowsProcess(window.pid) : null;
      if (window && shown?.state === 'runs' && shown.start === window.start)
        terminateWindowsProcess(window.pid, window.start, 1);
      const others = job ? (job.members()?.filter((pid) => pid !== process.pid) ?? null) : [];
      emptied = others?.length === 0;
      const open = shown?.state === 'unknown' || (shown?.state === 'runs' && shown.start === window?.start);
      const core = await answers(labSocket(id));
      if (others?.length === 0 && !open && !core) break;
      if (Date.now() >= deadline) {
        if (others === null) problems.push(`cannot read the members of the lab job ${jobName(id)}`);
        else if (others.length) problems.push(`processes ${others.join(' ')} still run in the lab job`);
        if (shown?.state === 'unknown') problems.push(`cannot read the lab window process ${window?.pid}`);
        else if (open) problems.push(`the lab window process ${window?.pid} still runs`);
        if (core) problems.push(`a core still answers at ${labSocket(id)}`);
        break;
      }
      await Bun.sleep(500);
    }
    if (job && emptied && state === 'ok') await rm(record, { force: true });
    problems.push(...(await realReads(id)));
    const local = process.env.LOCALAPPDATA;
    if (!local) problems.push('LOCALAPPDATA is not set, so the lab core folder is unknown');
    if (problems.length) {
      for (const problem of problems) console.error(`herdr-lab: ${problem}`);
      console.error(`herdr-lab: kept ${root}`);
      return 1;
    }
    await rm(join(local as string, 'herdr-core', id), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
    console.log(`herdr-lab: removed lab ${id}`);
    return 0;
  } finally {
    job?.close();
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
  if (windows) {
    const job = openJob(jobName(id));
    if (!job) {
      console.error(`herdr-lab: no lab job ${jobName(id)}`);
      return 2;
    }
    joinJob(job);
    job.close();
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
  if (command === 'up' && argv.length === 1) return windows ? upWindows() : up();
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
    return windows ? downWindows(id) : down(id);
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
