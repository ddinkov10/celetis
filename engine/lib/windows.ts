import { dlopen, FFIType, ptr } from 'bun:ffi';
import { toNamespacedPath } from 'node:path';
import { exits } from './contract.ts';
import { HostError } from './host.ts';

function kernelBinding() {
  try {
    return dlopen('kernel32.dll', {
      CreateFileW: {
        args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr],
        returns: FFIType.i64,
      },
      GetFileInformationByHandleEx: {
        args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.u32],
        returns: FFIType.i32,
      },
      LockFileEx: {
        args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.u32, FFIType.u32, FFIType.ptr],
        returns: FFIType.i32,
      },
      OpenProcess: { args: [FFIType.u32, FFIType.i32, FFIType.u32], returns: FFIType.ptr },
      WaitForSingleObject: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.u32 },
      GetProcessTimes: {
        args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr],
        returns: FFIType.i32,
      },
      CreateJobObjectW: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
      SetInformationJobObject: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
      AssignProcessToJobObject: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
      TerminateJobObject: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
      CloseHandle: { args: [FFIType.ptr], returns: FFIType.i32 },
      GetLastError: { args: [], returns: FFIType.u32 },
    });
  } catch {
    throw new HostError('celetis: cannot load kernel32.dll', exits.blocked);
  }
}

function runtimeBinding() {
  try {
    return dlopen(process.execPath, {
      uv_get_osfhandle: { args: [FFIType.i32], returns: FFIType.ptr },
      uv_open_osfhandle: { args: [FFIType.ptr], returns: FFIType.i32 },
    });
  } catch {
    throw new HostError(
      `celetis: cannot load Windows file descriptor operations from ${process.execPath}`,
      exits.blocked,
    );
  }
}

let kernel: ReturnType<typeof kernelBinding> | undefined;
let runtime: ReturnType<typeof runtimeBinding> | undefined;

export function openLockFile(path: string): number {
  kernel ??= kernelBinding();
  runtime ??= runtimeBinding();
  const api = kernel;
  const failure = () =>
    new HostError(
      `celetis: cannot open lock file ${path} (Windows error ${api.symbols.GetLastError()})`,
      exits.blocked,
    );
  const handle = api.symbols.CreateFileW(
    Buffer.from(`${toNamespacedPath(path)}\0`, 'utf16le'),
    0xc0000000,
    3,
    null,
    4,
    0x00200080,
    null,
  );
  if (handle === -1n) throw failure();
  let transferred = false;
  try {
    const info = new Uint32Array(2);
    if (!api.symbols.GetFileInformationByHandleEx(handle, 9, info, info.byteLength)) throw failure();
    if ((info[0] as number) & (0x400 | 0x10))
      throw new HostError(`celetis: ${path}: need a regular lock file without a reparse point`, exits.blocked);
    const fd = runtime.symbols.uv_open_osfhandle(handle);
    if (fd < 0) throw new HostError(`celetis: cannot assign a file descriptor to lock file ${path}`, exits.blocked);
    transferred = true;
    return fd;
  } finally {
    if (!transferred) api.symbols.CloseHandle(handle);
  }
}

export function lockFile(fd: number, shared: boolean): boolean {
  kernel ??= kernelBinding();
  runtime ??= runtimeBinding();
  const api = kernel;
  const handle = runtime.symbols.uv_get_osfhandle(fd);
  if (api.symbols.LockFileEx(handle, (shared ? 0 : 2) | 1, 0, 1, 0, new Uint8Array(32))) return true;
  const error = api.symbols.GetLastError();
  if (error === 33) return false;
  throw new HostError(`update: cannot acquire the plugin update lock (Windows error ${error})`, exits.blocked);
}

export interface Job {
  terminate(): void;
  close(): void;
}

export function containProcess(pid: number): Job | null {
  kernel ??= kernelBinding();
  const api = kernel;
  const failure = () =>
    new HostError(
      `celetis: cannot contain process ${pid} in a job object (Windows error ${api.symbols.GetLastError()})`,
      exits.blocked,
    );
  const target = api.symbols.OpenProcess(0x0100 | 0x0001 | 0x00100000, 0, pid);
  if (!target) throw failure();
  try {
    const job = api.symbols.CreateJobObjectW(null, null);
    if (!job) throw failure();
    const limits = new Uint8Array(144);
    new DataView(limits.buffer).setUint32(16, 0x2000, true);
    if (
      api.symbols.SetInformationJobObject(job, 9, limits, limits.byteLength) &&
      api.symbols.AssignProcessToJobObject(job, target)
    )
      return {
        terminate() {
          api.symbols.TerminateJobObject(job, 1);
        },
        close() {
          api.symbols.CloseHandle(job);
        },
      };
    const error = failure();
    api.symbols.CloseHandle(job);
    if (api.symbols.WaitForSingleObject(target, 0) === 0) return null;
    throw error;
  } finally {
    api.symbols.CloseHandle(target);
  }
}

export function windowsProcess(pid: number): { start: string } | null {
  kernel ??= kernelBinding();
  const api = kernel;
  const handle = api.symbols.OpenProcess(0x1000 | 0x00100000, 0, pid);
  if (!handle) return null;
  try {
    if (api.symbols.WaitForSingleObject(handle, 0) !== 258) return null;
    const times = new BigUint64Array(4);
    if (!api.symbols.GetProcessTimes(handle, ptr(times), ptr(times, 8), ptr(times, 16), ptr(times, 24)))
      throw new HostError(
        `celetis: cannot read the start time of process ${pid} (Windows error ${api.symbols.GetLastError()})`,
        exits.blocked,
      );
    return { start: String(times[0] as bigint) };
  } finally {
    api.symbols.CloseHandle(handle);
  }
}
