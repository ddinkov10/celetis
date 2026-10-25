import { run } from './process.ts';
import { windowsProcess } from './windows.ts';

async function field(pid: number, name: string): Promise<string> {
  const result = await run('ps', ['-p', String(pid), '-o', name], { env: { ...process.env, LC_ALL: 'C' } });
  return result.code === 0 ? result.stdout.trimEnd() : '';
}

export async function processStart(pid: number): Promise<string> {
  if (process.platform === 'win32') return windowsProcess(pid)?.start ?? '';
  return field(pid, 'lstart=');
}

export async function processRuns(pid: number): Promise<boolean> {
  if (process.platform === 'win32') return windowsProcess(pid) !== null;
  const status = await field(pid, 'stat=');
  return status !== '' && !/[ZX]/.test(status);
}

export async function processRunsScript(pid: number, script: string, since?: number): Promise<boolean> {
  if (process.platform === 'win32') {
    const found = windowsProcess(pid);
    // kernel32 cannot read another process's command line; a PID reused after `since` has a later creation time.
    return found !== null && (since === undefined || found.createdMs <= since);
  }
  return (await field(pid, 'command=')).includes(script);
}
