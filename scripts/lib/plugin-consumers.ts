import { dlopen, FFIType, ptr } from 'bun:ffi';
import { readFile, realpath } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { type Host, HostError } from './host.ts';
import { run, updateDescriptor } from './process.ts';

const kernel =
  process.platform === 'darwin'
    ? dlopen('/usr/lib/libSystem.B.dylib', {
        sysctl: {
          args: [FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u64],
          returns: FFIType.i32,
        },
      })
    : undefined;

async function identity(
  pid: number,
): Promise<{ executable: string; args: string[]; env: Record<string, string> } | null> {
  if (process.platform === 'linux') {
    const [executable, args, env] = await Promise.all([
      realpath(`/proc/${pid}/exe`),
      readFile(`/proc/${pid}/cmdline`),
      readFile(`/proc/${pid}/environ`),
    ]).catch(() => []);
    if (!executable || !args || !env) return null;
    return {
      executable,
      args: args.toString().split('\0').filter(Boolean),
      env: environment(env.toString().split('\0')),
    };
  }
  if (!kernel) return null;
  const request = new Int32Array([1, 49, pid]);
  const size = new BigUint64Array(1);
  if (kernel.symbols.sysctl(ptr(request), 3, null, ptr(size), null, 0) !== 0) return null;
  const length = Number(size[0]);
  if (!length || length > 4 * 1024 * 1024) return null;
  const buffer = Buffer.alloc(length);
  if (kernel.symbols.sysctl(ptr(request), 3, ptr(buffer), ptr(size), null, 0) !== 0) return null;
  const count = buffer.readInt32LE(0);
  let at = 4;
  const next = () => {
    const end = buffer.indexOf(0, at);
    if (end < 0) return '';
    const value = buffer.toString('utf8', at, end);
    at = end + 1;
    return value;
  };
  const executable = next();
  while (at < buffer.length && buffer[at] === 0) at++;
  const args: string[] = [];
  for (let n = 0; n < count; n++) args.push(next());
  return { executable, args, env: environment(buffer.toString('utf8', at, Number(size[0])).split('\0')) };
}

function environment(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const value of values) {
    const at = value.indexOf('=');
    if (at < 1) continue;
    const key = value.slice(0, at);
    if (['HOME', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR'].includes(key)) result[key] = value.slice(at + 1);
  }
  return result;
}

export async function requireStoppedConsumers(
  host: Host,
  home: string,
  root: string,
  execute: typeof run = run,
): Promise<void> {
  const selected = Bun.which(host);
  if (!selected) throw new HostError(`plugin-update: ${host} is not on PATH`);
  const executable = await realpath(selected);
  const packageRoot = await realpath(root);
  const table = await execute('ps', ['-axo', 'pid=,comm='], {
    stderr: updateDescriptor() === undefined ? undefined : 'inherit',
  });
  if (table.code !== 0)
    throw new HostError(
      'plugin-update: cannot inspect native consumers; obtain process-inspection access before cutover',
    );
  const blockers: number[] = [];
  for (const line of table.stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
    const pid = Number(match?.[1]);
    if (!pid || pid === process.pid) continue;
    const processName = basename(match?.[2] ?? '');
    const command = match?.[2] ?? '';
    const exactSelected = command === executable || command === selected;
    const possibleNative =
      exactSelected ||
      [host, `${host}.exe`, `${host}-app-server`].includes(processName) ||
      (host === 'claude' && command.includes('/claude/versions/'));
    const possibleStub = ['bun', 'node'].includes(processName) && selected.endsWith(`/bin/${host}`);
    if (!possibleNative && !possibleStub) continue;
    const state = await identity(pid);
    if (!state) {
      if (possibleNative && (await realpath(match?.[2] ?? '').catch(() => '')) === executable)
        throw new HostError(
          `plugin-update: cannot establish the profile of native consumer PID ${pid}; stop that process before cutover`,
        );
      continue;
    }
    const actual = await realpath(state.executable).catch(() => state.executable);
    if (actual !== executable && !state.args.includes(selected) && !possibleNative) continue;
    const profile =
      host === 'claude'
        ? (state.env.CLAUDE_CONFIG_DIR ?? (state.env.HOME ? join(state.env.HOME, '.claude') : undefined))
        : (state.env.CODEX_HOME ?? (state.env.HOME ? join(state.env.HOME, '.codex') : undefined));
    const pluginDirs: string[] = [];
    for (let at = 0; at < state.args.length; at++) {
      const arg = state.args[at] ?? '';
      if (arg.startsWith('--plugin-dir=')) pluginDirs.push(arg.slice('--plugin-dir='.length));
      else if (arg === '--plugin-dir')
        for (let next = at + 1; next < state.args.length && !state.args[next]?.startsWith('-'); next++)
          pluginDirs.push(state.args[next] ?? '');
    }
    let sharesPackage = state.args.includes(root);
    for (const dir of pluginDirs) {
      if (!isAbsolute(dir))
        throw new HostError(
          `plugin-update: cannot establish relative --plugin-dir resource identity for PID ${pid}; stop that consumer before cutover`,
        );
      if ((await realpath(dir).catch(() => null)) === packageRoot) sharesPackage = true;
    }
    const profileRoot = profile ? await realpath(profile).catch(() => profile) : undefined;
    if (!profileRoot)
      throw new HostError(
        `plugin-update: cannot establish the profile of native consumer PID ${pid}; stop that process before cutover`,
      );
    if (profileRoot === home || sharesPackage) blockers.push(pid);
  }
  if (blockers.length)
    throw new HostError(
      `plugin-update: active ${host} package consumers: PID ${blockers.join(', ')}; end the offering session and these consumers before running one approved terminal command. No process was stopped and no update was queued`,
    );
}
