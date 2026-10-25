import { dlopen, FFIType, ptr } from 'bun:ffi';
import { HostError } from './host.ts';

function kernelBinding() {
  try {
    return dlopen('kernel32.dll', {
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
    throw new HostError('celetis: cannot load kernel32.dll');
  }
}

function runtimeBinding() {
  try {
    return dlopen(process.execPath, { uv_get_osfhandle: { args: [FFIType.i32], returns: FFIType.ptr } });
  } catch {
    throw new HostError(`celetis: cannot load uv_get_osfhandle from ${process.execPath}`);
  }
}

let kernel: ReturnType<typeof kernelBinding> | undefined;
let runtime: ReturnType<typeof runtimeBinding> | undefined;

export function lockFile(fd: number, shared: boolean): boolean {
  kernel ??= kernelBinding();
  runtime ??= runtimeBinding();
  const api = kernel;
  const handle = runtime.symbols.uv_get_osfhandle(fd);
  if (api.symbols.LockFileEx(handle, (shared ? 0 : 2) | 1, 0, 1, 0, new Uint8Array(32))) return true;
  const error = api.symbols.GetLastError();
  if (error === 33) return false;
  throw new HostError(`plugin-update: cannot acquire the plugin update lock (Windows error ${error})`);
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

export function windowsProcess(pid: number): { start: string; createdMs: number } | null {
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
      );
    const created = times[0] as bigint;
    return { start: String(created), createdMs: Number(created / 10000n) - 11644473600000 };
  } finally {
    api.symbols.CloseHandle(handle);
  }
}
