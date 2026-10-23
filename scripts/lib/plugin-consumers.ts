import { dlopen, FFIType, ptr } from 'bun:ffi';
import { readFile, readlink, realpath } from 'node:fs/promises';
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

const processPaths =
  process.platform === 'darwin'
    ? dlopen('/usr/lib/libproc.dylib', {
        proc_pidpath: { args: [FFIType.i32, FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
      })
    : undefined;

async function executablePath(pid: number): Promise<string | null> {
  if (process.platform === 'linux') return readlink(`/proc/${pid}/exe`).catch(() => null);
  if (!processPaths) return null;
  const buffer = Buffer.alloc(4096);
  if (processPaths.symbols.proc_pidpath(pid, ptr(buffer), buffer.length) <= 0) return null;
  const end = buffer.indexOf(0);
  return buffer.toString('utf8', 0, end < 0 ? buffer.length : end) || null;
}

async function identity(
  pid: number,
  observedExecutable: string | null,
  script?: string,
): Promise<{ executable: string; args: string[]; env: Record<string, string> } | null> {
  if (process.platform === 'linux') {
    if (!observedExecutable) return null;
    const command = await readFile(`/proc/${pid}/cmdline`).catch(() => null);
    if (!command) return null;
    const args = command.toString().split('\0').filter(Boolean);
    if (script && !args.includes(script)) return null;
    const env = await readFile(`/proc/${pid}/environ`).catch(() => null);
    return {
      executable: observedExecutable,
      args,
      env: env ? environment(env.toString().split('\0')) : {},
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
  if (script && !args.includes(script)) return null;
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
  const nativeExecutable = (path: string) =>
    path === executable ||
    path === selected ||
    [host, `${host}.exe`, `${host}-app-server`].includes(basename(path).replace(/ \(deleted\)$/, '')) ||
    (host === 'claude' && path.includes('/claude/versions/'));
  for (const line of table.stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
    const pid = Number(match?.[1]);
    if (!pid || pid === process.pid) continue;
    const processName = basename(match?.[2] ?? '');
    const command = match?.[2] ?? '';
    const located = await executablePath(pid);
    const actual = located ? await realpath(located).catch(() => located) : null;
    const possibleNative = actual
      ? nativeExecutable(actual)
      : nativeExecutable(command) || processName === basename(executable);
    const possibleStub = ['bun', 'node'].includes(basename(actual ?? command)) && selected.endsWith(`/bin/${host}`);
    if (!possibleNative && !possibleStub) continue;
    const state = await identity(pid, actual, possibleNative ? undefined : selected);
    if (!state) {
      if (possibleNative)
        throw new HostError(
          `plugin-update: cannot establish the profile of native consumer PID ${pid}; stop that process before cutover`,
        );
      continue;
    }
    const confirmed = await realpath(state.executable).catch(() => state.executable);
    if (!nativeExecutable(confirmed) && !state.args.includes(selected)) continue;
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
