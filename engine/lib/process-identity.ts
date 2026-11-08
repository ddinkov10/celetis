import { run } from './process.ts';
import { windowsProcess } from './windows.ts';

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
  if (process.platform === 'win32') return windowsProcess(pid)?.start ?? '';
  return (await field(pid, 'lstart=')) ?? '';
}

export async function processState(pid: number, start: string): Promise<ProcessState> {
  if (process.platform === 'win32') return windowsProcess(pid)?.start === start ? 'runs' : 'gone';
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

export async function processesWithEnvironment(entry: string): Promise<Set<number> | null> {
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
  const found = new Set<number>();
  for (const [pid, text] of rows(full.stdout)) {
    const command = args.get(pid);
    const environment = command !== undefined && text.startsWith(command) ? text.slice(command.length) : text;
    if (pattern.test(environment)) found.add(pid);
  }
  return found;
}

export async function processAlive(pid: number): Promise<ProcessState> {
  if (process.platform === 'win32') return windowsProcess(pid) === null ? 'gone' : 'runs';
  return pidState(pid);
}

export async function processScript(pid: number, script: string): Promise<ProcessState> {
  if (process.platform === 'win32') return (await processRunsScript(pid, script)) ? 'runs' : 'gone';
  if (!signalable(pid)) return 'gone';
  const command = await field(pid, 'command=');
  if (!command) return 'unknown';
  return command.includes(script) ? 'runs' : 'gone';
}

export async function processRunsScript(pid: number, script: string): Promise<boolean> {
  // kernel32 cannot read another process's command line.
  if (process.platform === 'win32') return windowsProcess(pid) !== null;
  return ((await field(pid, 'command=')) ?? '').includes(script);
}
