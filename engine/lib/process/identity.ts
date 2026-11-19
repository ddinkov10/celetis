import { constants } from 'node:os';
import { basename } from 'node:path';
import { signalExit } from '../contract/contract.ts';
import { run } from './process.ts';
import { terminateWindowsProcess, windowsChildren, windowsProcess } from './windows.ts';

export type ProcessState = 'runs' | 'gone' | 'unknown';

export const daemonScript = 'daemon.ts';

async function field(pid: number, name: string): Promise<string | null> {
  const result = await run('ps', ['-p', String(pid), '-o', name], { env: { ...process.env, LC_ALL: 'C' } });
  return result.code === 0 ? result.stdout.trimEnd() : null;
}

function signalable(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function pidState(pid: number): Promise<ProcessState> {
  if (!signalable(pid)) return 'gone';
  const status = await field(pid, 'stat=');
  if (!status) return 'unknown';
  return /[ZX]/.test(status) ? 'gone' : 'runs';
}

export async function processStart(pid: number): Promise<string> {
  if (process.platform === 'win32') {
    const read = windowsProcess(pid);
    return read.state === 'runs' ? read.start : '';
  }
  return (await field(pid, 'lstart=')) ?? '';
}

export async function processState(pid: number, start: string): Promise<ProcessState> {
  if (process.platform === 'win32') {
    const read = windowsProcess(pid);
    return read.state === 'runs' ? (read.start === start ? 'runs' : 'gone') : read.state;
  }
  const state = await pidState(pid);
  if (state !== 'runs') return state;
  const begun = await field(pid, 'lstart=');
  if (!begun) return 'unknown';
  return begun === start ? 'runs' : 'gone';
}

export type ProcessRow = Readonly<{ pid: number; ppid: number; tty: string; start: string }>;

export async function processTable(): Promise<ProcessRow[] | null> {
  if (process.platform === 'win32') return null;
  const result = await run('ps', ['-A', '-o', 'pid=,ppid=,tty=,lstart='], { env: { ...process.env, LC_ALL: 'C' } });
  if (result.code !== 0) return null;
  return result.stdout.split('\n').flatMap((line) => {
    const row = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S.*\S)\s*$/.exec(line);
    return row ? [{ pid: Number(row[1]), ppid: Number(row[2]), tty: row[3] as string, start: row[4] as string }] : [];
  });
}

export async function terminateChild(
  parent: Readonly<{ pid: number; start: string }>,
  signal?: AbortSignal,
): Promise<number | null> {
  if (process.platform === 'win32') return terminateWindowsChild(parent, signal);
  const rows = await processTable();
  if (!rows?.some((row) => row.pid === parent.pid && row.start === parent.start)) return null;
  const [child, ...others] = rows.filter((row) => row.ppid === parent.pid);
  if (!child || others.length || (await processState(child.pid, child.start)) !== 'runs' || signal?.aborted)
    return null;
  try {
    process.kill(child.pid, 'SIGTERM');
    return child.pid;
  } catch {
    return null;
  }
}

function terminateWindowsChild(parent: Readonly<{ pid: number; start: string }>, signal?: AbortSignal): number | null {
  const host = windowsProcess(parent.pid);
  if (host.state !== 'runs' || host.start !== parent.start) return null;
  const pids = windowsChildren(parent.pid);
  if (!pids) return null;
  const children: { pid: number; start: string }[] = [];
  for (const pid of pids) {
    const read = windowsProcess(pid);
    if (read.state === 'unknown') return null;
    if (read.state === 'runs' && BigInt(read.start) >= BigInt(parent.start)) children.push({ pid, start: read.start });
  }
  const [child, ...others] = children;
  if (!child || others.length || signal?.aborted) return null;
  return terminateWindowsProcess(child.pid, child.start, signalExit(constants.signals.SIGTERM)) ? child.pid : null;
}

export function controllingTerminal(name: string): boolean {
  const trimmed = name.trim();
  return trimmed !== '' && trimmed !== '?' && trimmed !== '??';
}

export function descendantsOf(rows: readonly ProcessRow[], root: number): ProcessRow[] {
  const found: ProcessRow[] = [];
  const pending = [root];
  while (pending.length) {
    const parent = pending.pop() as number;
    for (const child of rows)
      if (child.ppid === parent && !found.some((each) => each.pid === child.pid)) {
        found.push(child);
        pending.push(child.pid);
      }
  }
  return found;
}

export async function processesWithEnvironment(
  entry: string,
): Promise<Readonly<{ proven: ReadonlySet<number>; unsure: ReadonlySet<number> }> | null> {
  if (process.platform === 'win32') return null;
  const env = { ...process.env, LC_ALL: 'C' };
  const [plain, full] = await Promise.all([
    run('ps', ['wwax', '-o', 'pid=,command='], { env }),
    run('ps', ['ewwax', '-o', 'pid=,command='], { env }),
  ]);
  if (plain.code !== 0 || full.code !== 0) return null;
  const rows = (text: string) =>
    new Map(
      text.split('\n').flatMap((line) => {
        const row = /^\s*(\d+) (.*)$/.exec(line);
        return row ? [[Number(row[1]), row[2] as string] as const] : [];
      }),
    );
  const args = rows(plain.stdout);
  const pattern = new RegExp(`(^|\\s)${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  const proven = new Set<number>();
  const unsure = new Set<number>();
  for (const [pid, text] of rows(full.stdout)) {
    const command = args.get(pid);
    if (command !== undefined && text.startsWith(command)) {
      if (pattern.test(text.slice(command.length))) proven.add(pid);
    } else if (pattern.test(text)) unsure.add(pid);
  }
  return { proven, unsure };
}

export async function commandNames(pids: readonly number[]): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (process.platform === 'win32' || pids.length === 0) return names;
  const result = await run('ps', ['-o', 'pid=,comm=', '-p', pids.join(',')], {
    env: { ...process.env, LC_ALL: 'C' },
  });
  for (const line of result.stdout.split('\n')) {
    const row = /^\s*(\d+)\s+(\S.*\S|\S)\s*$/.exec(line);
    if (row) names.set(Number(row[1]), basename(row[2] as string));
  }
  return names;
}

export async function processAlive(pid: number): Promise<ProcessState> {
  if (process.platform === 'win32') return windowsProcess(pid).state;
  return pidState(pid);
}

export async function processScript(pid: number, script: string): Promise<ProcessState> {
  if (process.platform === 'win32') return windowsProcess(pid).state;
  if (!signalable(pid)) return 'gone';
  const command = await field(pid, 'command=');
  if (!command) return 'unknown';
  return command.includes(script) ? 'runs' : 'gone';
}

export async function processRunsScript(pid: number, script: string): Promise<boolean> {
  // kernel32 cannot read another process's command line.
  if (process.platform === 'win32') return windowsProcess(pid).state === 'runs';
  return ((await field(pid, 'command=')) ?? '').includes(script);
}
