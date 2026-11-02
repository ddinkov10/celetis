import { run } from './process.ts';
import { windowsProcess } from './windows.ts';

type ProcessState = 'runs' | 'gone' | 'unknown';

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

export async function processRuns(pid: number): Promise<boolean> {
  if (process.platform === 'win32') return windowsProcess(pid) !== null;
  return (await pidState(pid)) === 'runs';
}

export async function processRunsScript(pid: number, script: string, since?: number): Promise<boolean> {
  if (process.platform === 'win32') {
    const found = windowsProcess(pid);
    // kernel32 cannot read another process's command line; a PID reused after `since` has a later creation time.
    return found !== null && (since === undefined || found.createdMs <= since);
  }
  return ((await field(pid, 'command=')) ?? '').includes(script);
}
