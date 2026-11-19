import { dlopen, FFIType, type Pointer, ptr, read, toArrayBuffer } from 'bun:ffi';
import { basename, toNamespacedPath } from 'node:path';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';

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
      OpenJobObjectW: { args: [FFIType.u32, FFIType.i32, FFIType.ptr], returns: FFIType.ptr },
      QueryInformationJobObject: {
        args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.u32, FFIType.ptr],
        returns: FFIType.i32,
      },
      IsProcessInJob: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
      SetInformationJobObject: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
      AssignProcessToJobObject: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
      TerminateJobObject: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
      TerminateProcess: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
      CreateProcessW: {
        args: [
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.i32,
          FFIType.u32,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
        ],
        returns: FFIType.i32,
      },
      GetExitCodeProcess: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
      CreateToolhelp32Snapshot: { args: [FFIType.u32, FFIType.u32], returns: FFIType.i64 },
      Process32FirstW: { args: [FFIType.i64, FFIType.ptr], returns: FFIType.i32 },
      Process32NextW: { args: [FFIType.i64, FFIType.ptr], returns: FFIType.i32 },
      CloseHandle: { args: [FFIType.ptr], returns: FFIType.i32 },
      LocalFree: { args: [FFIType.ptr], returns: FFIType.ptr },
      GetLastError: { args: [], returns: FFIType.u32 },
    });
  } catch {
    throw new HostError('celetis: cannot load kernel32.dll', exits.blocked);
  }
}

function securityBinding() {
  try {
    return dlopen('advapi32.dll', {
      GetNamedSecurityInfoW: {
        args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr],
        returns: FFIType.u32,
      },
      SetNamedSecurityInfoW: {
        args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr],
        returns: FFIType.u32,
      },
      ConvertStringSecurityDescriptorToSecurityDescriptorW: {
        args: [FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.ptr],
        returns: FFIType.i32,
      },
      GetSecurityDescriptorDacl: {
        args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr],
        returns: FFIType.i32,
      },
      GetAclInformation: { args: [FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.i32], returns: FFIType.i32 },
      GetAce: { args: [FFIType.ptr, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
      ConvertSidToStringSidW: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
      OpenProcessToken: { args: [FFIType.i64, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
      GetTokenInformation: {
        args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.u32, FFIType.ptr],
        returns: FFIType.i32,
      },
    });
  } catch {
    throw new HostError('celetis: cannot load advapi32.dll', exits.blocked);
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
let security: ReturnType<typeof securityBinding> | undefined;
let currentUser: string | undefined;

const pointer = (cell: BigUint64Array) => Number(cell[0]) as Pointer;
const wide = (text: string) => Buffer.from(`${text}\0`, 'utf16le');
const fileName = (path: string) => wide(toNamespacedPath(path));

function sidText(api: ReturnType<typeof kernelBinding>, sid: Pointer): string {
  security ??= securityBinding();
  const out = new BigUint64Array(1);
  if (!security.symbols.ConvertSidToStringSidW(sid, out))
    throw new HostError(`celetis: cannot read a SID (Windows error ${api.symbols.GetLastError()})`, exits.blocked);
  const text = pointer(out);
  try {
    let length = 0;
    while (read.u16(text, length * 2)) length++;
    return Buffer.from(toArrayBuffer(text, 0, length * 2)).toString('utf16le');
  } finally {
    api.symbols.LocalFree(text);
  }
}

function userSid(api: ReturnType<typeof kernelBinding>): string {
  security ??= securityBinding();
  const failure = () =>
    new HostError(
      `celetis: cannot read the user of this process (Windows error ${api.symbols.GetLastError()})`,
      exits.blocked,
    );
  const token = new BigUint64Array(1);
  if (!security.symbols.OpenProcessToken(-1n, 0x8, token)) throw failure();
  const handle = pointer(token);
  try {
    const size = new Uint32Array(1);
    security.symbols.GetTokenInformation(handle, 1, null, 0, size);
    const user = new BigUint64Array(Math.ceil((size[0] as number) / 8));
    if (!security.symbols.GetTokenInformation(handle, 1, user, user.byteLength, size)) throw failure();
    return sidText(api, pointer(user));
  } finally {
    api.symbols.CloseHandle(handle);
  }
}

function securityFailure(path: string, act: string, error: number): HostError {
  return new HostError(`celetis: cannot ${act} ${path} (Windows error ${error})`, exits.blocked);
}

const denied = 'access denied to the current user';

export function holdFolder(path: string): string | null {
  kernel ??= kernelBinding();
  const api = kernel;
  const handle = api.symbols.CreateFileW(fileName(path), 0x1, 3, null, 3, 0x02000000 | 0x00200000, null);
  if (handle === -1n) {
    const error = api.symbols.GetLastError();
    if (error === 5) return denied;
    throw securityFailure(path, 'open the folder', error);
  }
  const info = new Uint32Array(2);
  const known = api.symbols.GetFileInformationByHandleEx(handle, 9, info, info.byteLength);
  const error = api.symbols.GetLastError();
  if (known && ((info[0] as number) & (0x400 | 0x10)) === 0x10) return null;
  api.symbols.CloseHandle(handle);
  if (!known) throw securityFailure(path, 'read the attributes of', error);
  throw new HostError(`celetis: ${path}: need a folder without a reparse point`, exits.prerequisite);
}

export function makePrivateFolder(path: string): string | null {
  kernel ??= kernelBinding();
  security ??= securityBinding();
  const api = kernel;
  currentUser ??= userSid(api);
  const user = currentUser;
  const owner = new BigUint64Array(1);
  const current = new BigUint64Array(1);
  const error = security.symbols.GetNamedSecurityInfoW(fileName(path), 1, 0x1, owner, null, null, null, current);
  if (error === 5) return denied;
  if (error) throw securityFailure(path, 'read the owner of', error);
  try {
    const ownerSid = sidText(api, pointer(owner));
    if (ownerSid !== user) return `owner ${ownerSid}`;
  } finally {
    api.symbols.LocalFree(pointer(current));
  }
  const wanted = new BigUint64Array(1);
  const sddl = Buffer.from(`D:P(A;OICI;FA;;;${user})(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)\0`, 'utf16le');
  if (!security.symbols.ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl, 1, wanted, null))
    throw securityFailure(path, 'build the access list for', api.symbols.GetLastError());
  try {
    const present = new Int32Array(1);
    const dacl = new BigUint64Array(1);
    const defaulted = new Int32Array(1);
    if (!security.symbols.GetSecurityDescriptorDacl(pointer(wanted), present, dacl, defaulted) || !dacl[0])
      throw securityFailure(path, 'build the access list for', api.symbols.GetLastError());
    const result = security.symbols.SetNamedSecurityInfoW(
      fileName(path),
      1,
      0x4 | 0x80000000,
      null,
      null,
      pointer(dacl),
      null,
    );
    if (result) throw securityFailure(path, 'set the access list of', result);
    return null;
  } finally {
    api.symbols.LocalFree(pointer(wanted));
  }
}

export function privateFolderProblem(path: string): string | null {
  kernel ??= kernelBinding();
  security ??= securityBinding();
  const api = kernel;
  currentUser ??= userSid(api);
  const owners = [currentUser, 'S-1-5-18', 'S-1-5-32-544'];
  const owner = new BigUint64Array(1);
  const dacl = new BigUint64Array(1);
  const descriptor = new BigUint64Array(1);
  const error = security.symbols.GetNamedSecurityInfoW(
    fileName(path),
    1,
    0x1 | 0x4,
    owner,
    null,
    dacl,
    null,
    descriptor,
  );
  if (error === 5) return denied;
  if (error) throw securityFailure(path, 'read the access list of', error);
  try {
    const ownerSid = sidText(api, pointer(owner));
    if (!owners.includes(ownerSid)) return `owner ${ownerSid}`;
    if (!dacl[0]) return 'no access list';
    const acl = pointer(dacl);
    const size = new Uint32Array(3);
    if (!security.symbols.GetAclInformation(acl, size, size.byteLength, 2))
      throw securityFailure(path, 'read the access list of', api.symbols.GetLastError());
    const ace = new BigUint64Array(1);
    for (let index = 0; index < (size[0] as number); index++) {
      if (!security.symbols.GetAce(acl, index, ace))
        throw securityFailure(path, `read ACE ${index} of`, api.symbols.GetLastError());
      const type = read.u8(pointer(ace), 0);
      if (type === 4 || type === 5 || type === 11) return `ACE type ${type}`;
      if (type !== 0 && type !== 9) continue;
      const sid = sidText(api, (pointer(ace) + 8) as Pointer);
      if (![...owners, 'S-1-3-0'].includes(sid)) return `allow ACE for ${sid}`;
    }
    return null;
  } finally {
    api.symbols.LocalFree(pointer(descriptor));
  }
}

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
  terminate(): boolean;
  terminateOthers(spare?: number): number[];
  close(): void;
  members(): number[] | null;
}

const jobHandles = new WeakMap<Job, Pointer | bigint>();

function jobOf(api: ReturnType<typeof kernelBinding>, handle: Pointer | bigint): Job {
  const job: Job = {
    terminate() {
      return api.symbols.TerminateJobObject(handle, 1) !== 0;
    },
    terminateOthers(spare) {
      const ended: number[] = [];
      for (const pid of job.members() ?? []) {
        if (pid === process.pid || pid === spare) continue;
        const target = api.symbols.OpenProcess(0x0001 | 0x1000, 0, pid);
        if (!target) continue;
        const inside = new Int32Array(1);
        if (
          api.symbols.IsProcessInJob(target, handle, inside) &&
          inside[0] &&
          api.symbols.TerminateProcess(target, 1) !== 0
        )
          ended.push(pid);
        api.symbols.CloseHandle(target);
      }
      return ended;
    },
    close() {
      api.symbols.CloseHandle(handle);
    },
    members() {
      for (let size = 64; ; ) {
        const list = new Uint8Array(8 + 8 * size);
        const view = new DataView(list.buffer);
        if (api.symbols.QueryInformationJobObject(handle, 3, list, list.byteLength, null))
          return Array.from({ length: view.getUint32(4, true) }, (_, index) =>
            Number(view.getBigUint64(8 + 8 * index, true)),
          );
        if (api.symbols.GetLastError() !== 234) return null;
        size = Math.max(size * 2, view.getUint32(0, true) + 16);
      }
    },
  };
  jobHandles.set(job, handle);
  return job;
}

export function createJob(name: string, breakaway: boolean): Job {
  kernel ??= kernelBinding();
  const api = kernel;
  const handle = api.symbols.CreateJobObjectW(null, Buffer.from(`${name}\0`, 'utf16le'));
  const error = api.symbols.GetLastError();
  if (!handle) throw new HostError(`celetis: cannot create job object ${name} (Windows error ${error})`, exits.blocked);
  if (error === 183) {
    api.symbols.CloseHandle(handle);
    throw new HostError(`celetis: job object ${name} already exists`, exits.blocked);
  }
  if (breakaway) {
    const limits = new Uint8Array(144);
    new DataView(limits.buffer).setUint32(16, 0x800, true);
    if (!api.symbols.SetInformationJobObject(handle, 9, limits, limits.byteLength)) {
      const failure = new HostError(
        `celetis: cannot allow breakaway from job object ${name} (Windows error ${api.symbols.GetLastError()})`,
        exits.blocked,
      );
      api.symbols.CloseHandle(handle);
      throw failure;
    }
  }
  return jobOf(api, handle);
}

export function sessionJobName(attempt: string, folder: string): string {
  return attempt === '-' ? `Local\\celetis-session-${basename(folder)}` : `Local\\celetis-attempt-${attempt}`;
}

export function joinJob(job: Job): void {
  kernel ??= kernelBinding();
  const api = kernel;
  const handle = jobHandles.get(job);
  const self = api.symbols.OpenProcess(0x0100 | 0x0001, 0, process.pid);
  try {
    if (!handle || !self || !api.symbols.AssignProcessToJobObject(handle, self))
      throw new HostError(
        `celetis: cannot join a job object (Windows error ${api.symbols.GetLastError()})`,
        exits.blocked,
      );
  } finally {
    if (self) api.symbols.CloseHandle(self);
  }
}

export function openJob(name: string): Job | null {
  kernel ??= kernelBinding();
  const handle = kernel.symbols.OpenJobObjectW(0x0001 | 0x0004 | 0x0008, 0, Buffer.from(`${name}\0`, 'utf16le'));
  return handle ? jobOf(kernel, handle) : null;
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
      return jobOf(api, job);
    const error = failure();
    api.symbols.CloseHandle(job);
    if (api.symbols.WaitForSingleObject(target, 0) === 0) return null;
    throw error;
  } finally {
    api.symbols.CloseHandle(target);
  }
}

export type WindowsProcess = { state: 'runs'; start: string } | { state: 'gone' } | { state: 'unknown' };

function creationTime(api: ReturnType<typeof kernelBinding>, handle: Pointer | bigint, pid: number): string {
  const times = new BigUint64Array(4);
  if (!api.symbols.GetProcessTimes(handle, ptr(times), ptr(times, 8), ptr(times, 16), ptr(times, 24)))
    throw new HostError(
      `celetis: cannot read the start time of process ${pid} (Windows error ${api.symbols.GetLastError()})`,
      exits.blocked,
    );
  return String(times[0] as bigint);
}

export function windowsProcess(pid: number): WindowsProcess {
  kernel ??= kernelBinding();
  const api = kernel;
  const handle = api.symbols.OpenProcess(0x1000 | 0x00100000, 0, pid);
  if (!handle) return { state: api.symbols.GetLastError() === 87 ? 'gone' : 'unknown' };
  try {
    const wait = api.symbols.WaitForSingleObject(handle, 0);
    if (wait === 0) return { state: 'gone' };
    if (wait !== 258) return { state: 'unknown' };
    return { state: 'runs', start: creationTime(api, handle, pid) };
  } finally {
    api.symbols.CloseHandle(handle);
  }
}

export function windowsChildren(pid: number): number[] | null {
  kernel ??= kernelBinding();
  const api = kernel;
  const snapshot = api.symbols.CreateToolhelp32Snapshot(2, 0);
  if (snapshot === -1n || snapshot === 0n) return null;
  try {
    const entry = new Uint8Array(568);
    const view = new DataView(entry.buffer);
    view.setUint32(0, 568, true);
    const children: number[] = [];
    let more = api.symbols.Process32FirstW(snapshot, entry);
    while (more) {
      if (view.getUint32(32, true) === pid) children.push(view.getUint32(8, true));
      more = api.symbols.Process32NextW(snapshot, entry);
    }
    return api.symbols.GetLastError() === 18 ? children : null;
  } finally {
    api.symbols.CloseHandle(snapshot);
  }
}

export function terminateWindowsProcess(pid: number, start: string, code: number): boolean {
  kernel ??= kernelBinding();
  const api = kernel;
  const handle = api.symbols.OpenProcess(0x0001 | 0x1000, 0, pid);
  if (!handle) return false;
  try {
    return creationTime(api, handle, pid) === start && api.symbols.TerminateProcess(handle, code) !== 0;
  } catch {
    return false;
  } finally {
    api.symbols.CloseHandle(handle);
  }
}

export type Detached = { pid: number; exitCode(): number | null; inJob: boolean };

const quoted = (arg: string) =>
  arg && !/[\s"]/.test(arg)
    ? arg
    : `"${arg.replace(/(\\*)("|$)/g, (_, slashes: string, quote: string) => `${slashes}${slashes}${quote && '\\"'}`)}"`;

export function createDetachedProcess(
  file: string,
  args: string[],
  { cwd, env, log }: { cwd: string; env: NodeJS.ProcessEnv; log: string },
): Detached {
  kernel ??= kernelBinding();
  const api = kernel;
  const inheritable = new BigUint64Array([24n, 0n, 1n]);
  const out = api.symbols.CreateFileW(fileName(log), 0x4, 3, inheritable, 4, 0x80, null);
  if (out === -1n)
    throw new HostError(`celetis: cannot open ${log} (Windows error ${api.symbols.GetLastError()})`, exits.blocked);
  try {
    const startupInfo = new BigUint64Array(13);
    startupInfo[0] = 104n;
    startupInfo[7] = 0x100n << 32n;
    startupInfo[11] = out;
    startupInfo[12] = out;
    const line = wide([file, ...args].map(quoted).join(' '));
    const block = Object.entries(env)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .sort(([a], [b]) => (a.toUpperCase() < b.toUpperCase() ? -1 : 1))
      .map(([key, value]) => `${key}=${value}\0`)
      .join('');
    const environment = wide(block);
    const information = new BigUint64Array(3);
    const create = (flags: number) =>
      api.symbols.CreateProcessW(
        wide(file),
        line,
        null,
        null,
        1,
        flags,
        environment,
        wide(cwd),
        startupInfo,
        information,
      );
    const detached = 0x08000000 | 0x200 | 0x400;
    if (!create(detached | 0x01000000)) {
      const error = api.symbols.GetLastError();
      if (error !== 5 || !create(detached))
        throw new HostError(
          `celetis: cannot start ${file} (Windows error ${error === 5 ? api.symbols.GetLastError() : error})`,
          exits.blocked,
        );
    }
    const child = pointer(information);
    const inside = new Int32Array(1);
    const inJob = !api.symbols.IsProcessInJob(child, null, inside) || inside[0] !== 0;
    api.symbols.CloseHandle(Number(information[1]) as Pointer);
    const code = new Uint32Array(1);
    return {
      pid: new DataView(information.buffer).getUint32(16, true),
      exitCode: () => (api.symbols.GetExitCodeProcess(child, code) && code[0] !== 259 ? (code[0] as number) : null),
      inJob,
    };
  } finally {
    api.symbols.CloseHandle(out);
  }
}
