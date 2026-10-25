import { CString, dlopen, FFIType, read } from 'bun:ffi';
import { realpath as resolvePath } from 'node:fs/promises';
import { getSystemErrorName } from 'node:util';

const errnoName = process.platform === 'darwin' ? '__error' : '__errno_location';
const architecture = process.arch === 'arm64' ? 'aarch64' : process.arch === 'x64' ? 'x86_64' : process.arch;
const libraries =
  process.platform === 'darwin'
    ? ['/usr/lib/libSystem.B.dylib']
    : ['libc.so.6', `libc.musl-${architecture}.so.1`, `/lib/ld-musl-${architecture}.so.1`];

function binding() {
  for (const library of libraries) {
    try {
      return dlopen(library, {
        realpath: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
        free: { args: [FFIType.ptr], returns: FFIType.void },
        [errnoName]: { args: [], returns: FFIType.ptr },
      });
    } catch {}
  }
  throw new Error('board: cannot load the system realpath library');
}

let native: ReturnType<typeof binding> | undefined;

export async function realpath(path: string): Promise<string> {
  if (path.includes('\0')) throw new TypeError('realpath: path contains NUL');
  if (process.platform === 'win32') return resolvePath(path);
  native ??= binding();
  const api = native;
  const pointer = api.symbols.realpath(Buffer.from(`${path}\0`), null);
  if (!pointer) {
    const address = api.symbols[errnoName]?.();
    if (!address) throw new Error('board: cannot read realpath errno');
    const errno = read.i32(address);
    const code = getSystemErrorName(-errno);
    throw Object.assign(new Error(`${code}: realpath '${path}'`), { code, errno: -errno, syscall: 'realpath', path });
  }
  try {
    return String(new CString(pointer));
  } finally {
    api.symbols.free(pointer);
  }
}
