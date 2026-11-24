import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';

export type PackageFile = Readonly<{ path: string; mode: 0o644 | 0o755; data: Uint8Array }>;

export const recordFile = '.celetis-package.json';
export const tarballLimit = 32 * 1024 * 1024;
const unpackedLimit = 128 * 1024 * 1024;
const entryLimit = 5_000;
const block = 512;
const segment = /^[A-Za-z0-9._@+-]+$/;
// Windows opens a device for these names and drops a trailing dot, so each one aliases another path.
const windowsAlias = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$|\.$/i;

const refuse = (detail: string, cause?: unknown) =>
  new HostError(`celetis: the package archive is not valid: ${detail}`, exits.prerequisite, { cause });

const latin1 = (field: Uint8Array) => Buffer.from(field).toString('latin1');

function text(field: Uint8Array): string {
  const end = field.indexOf(0);
  if (end === -1) return latin1(field);
  if (field.subarray(end).some((byte) => byte !== 0)) throw refuse('a header field has bytes after its end');
  return latin1(field.subarray(0, end));
}

function octal(field: Uint8Array): number {
  const digits = /^([0-7]+)[ \0]*$/.exec(latin1(field))?.[1];
  if (digits === undefined) throw refuse('a numeric header field is not octal');
  return Number.parseInt(digits, 8);
}

function fileMode(header: Uint8Array): PackageFile['mode'] {
  const mode = octal(header.subarray(100, 108));
  if (mode === 0o644 || mode === 0o755) return mode;
  throw refuse('an entry has a mode other than 644 and 755');
}

function checkHeader(header: Uint8Array): void {
  const sum = header.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 32 : byte), 0);
  if (sum !== octal(header.subarray(148, 156))) throw refuse('a header checksum is wrong');
  if (latin1(header.subarray(257, 265)) !== 'ustar\x0000') throw refuse('a header has no ustar magic');
  if (header[156] !== 0 && header[156] !== 0x30) throw refuse('an entry is not a regular file');
}

function entryPath(header: Uint8Array): string {
  const name = text(header.subarray(0, 100));
  const prefix = text(header.subarray(345, 500));
  const [top, ...segments] = (prefix ? `${prefix}/${name}` : name).split('/');
  if (top !== 'package' || segments.length === 0) throw refuse('an entry is outside package/');
  for (const part of segments)
    if (
      !segment.test(part) ||
      part === '.' ||
      part === '..' ||
      part.toLowerCase() === '.git' ||
      windowsAlias.test(part)
    )
      throw refuse('an entry has an unsafe path');
  const path = segments.join('/');
  if (path.toLowerCase() === recordFile) throw refuse('an entry has the name of the install record');
  return path;
}

// The keys fold case because a case-insensitive file system writes both spellings to one file.
function claim(path: string, files: Set<string>, folders: Set<string>): void {
  const key = path.toLowerCase();
  if (files.has(key) || folders.has(key)) throw refuse('a path repeats, or is both a file and a folder');
  for (let at = key.indexOf('/'); at !== -1; at = key.indexOf('/', at + 1)) {
    const folder = key.slice(0, at);
    if (files.has(folder)) throw refuse('a path repeats, or is both a file and a folder');
    folders.add(folder);
  }
  files.add(key);
}

export function readArchive(tarball: Uint8Array): PackageFile[] {
  if (tarball.length > tarballLimit) throw refuse('the tarball is over its size limit');
  let data: Uint8Array;
  try {
    data = gunzipSync(tarball, { maxOutputLength: unpackedLimit });
  } catch (error) {
    throw refuse('it does not gunzip within its size limit', error);
  }
  const entries: PackageFile[] = [];
  const files = new Set<string>();
  const folders = new Set<string>();
  let offset = 0;
  for (;;) {
    const header = data.subarray(offset, offset + block);
    if (header.length < block) throw refuse('it has no end marker');
    if (header.every((byte) => byte === 0)) break;
    if (entries.length === entryLimit) throw refuse('it has too many entries');
    checkHeader(header);
    const mode = fileMode(header);
    const size = octal(header.subarray(124, 136));
    const start = offset + block;
    const next = start + Math.ceil(size / block) * block;
    if (next > data.length) throw refuse('an entry runs past the end of the data');
    const path = entryPath(header);
    claim(path, files, folders);
    entries.push({ path, mode, data: data.subarray(start, start + size) });
    offset = next;
  }
  if (data.length < offset + 2 * block || data.subarray(offset).some((byte) => byte !== 0))
    throw refuse('it has no clean end marker');
  return entries;
}

export async function writeArchive(files: readonly PackageFile[], root: string): Promise<void> {
  for (const file of files) {
    const target = join(root, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.data, { flag: 'wx', mode: file.mode });
    await chmod(target, file.mode);
  }
}
