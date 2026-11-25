import {
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { ensureFolder, type Folder, type Lock, privateMode, unsafe, withLockSync } from './state.ts';

export type LineLog = Readonly<{ folder: Folder; current: string; rotated: string; lock: Lock }>;

export const lineLimit = 16_384;
const rotateSize = 5_242_880;

function jsonBytes(point: number): number {
  if (point === 0x22 || point === 0x5c) return 2;
  if (point < 0x20) return [0x08, 0x09, 0x0a, 0x0c, 0x0d].includes(point) ? 2 : 6;
  if (point < 0x80) return 1;
  if (point < 0x800) return 2;
  if (point >= 0xd800 && point <= 0xdfff) return 6;
  return point < 0x10000 ? 3 : 4;
}

export function shorten(text: string, excess: number): string {
  let budget = -excess;
  for (const char of text) budget += jsonBytes(char.codePointAt(0) ?? 0);
  let end = 0;
  for (const char of text) {
    budget -= jsonBytes(char.codePointAt(0) ?? 0);
    if (budget < 0) break;
    end += char.length;
  }
  return text.slice(0, end);
}

export function appendLine(log: LineLog, line: string): void {
  const { folder, current, rotated, lock } = log;
  mkdirSync(dirname(folder.path), { recursive: true });
  ensureFolder(folder);
  withLockSync(lock, 'exclusive', () => {
    const fd = openSync(
      current,
      constants.O_RDWR | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
      0o600,
    );
    let size: number;
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || !privateMode(stat))
        throw new HostError(`${current}: need a private regular file`, exits.blocked);
      const last = Buffer.alloc(1);
      const ended = stat.size === 0 || (readSync(fd, last, 0, 1, stat.size - 1) === 1 && last[0] === 0x0a);
      const bytes = Buffer.from(ended ? line : `\n${line}`);
      if (writeSync(fd, bytes) !== bytes.length) throw new HostError(`${current}: incomplete write`, exits.blocked);
      size = fstatSync(fd).size;
    } finally {
      closeSync(fd);
    }
    if (size > rotateSize) renameSync(current, rotated);
  });
}

function readFile(path: string): string {
  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    const { code, message } = error as NodeJS.ErrnoException;
    if (code === 'ENOENT') return '';
    throw unsafe(path, code === 'ELOOP' ? 'need a private regular file' : `cannot read the file: ${message}`);
  }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || !privateMode(stat)) throw unsafe(path, 'need a private regular file');
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
}

export function readLines({ rotated, current }: LineLog, prefix: string): { id: string; line: string }[] {
  const kept: { id: string; line: string }[] = [];
  for (const path of [rotated, current]) {
    const lines = readFile(path).split('\n');
    lines.pop();
    lines.forEach((text, index) => {
      try {
        const value: unknown = JSON.parse(text);
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SyntaxError();
        const id: unknown = Reflect.get(value, 'id');
        if (typeof id !== 'string') throw new SyntaxError();
        kept.push({ id, line: JSON.stringify(value) });
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        console.error(`${prefix}: ${path}:${index + 1}: not a valid entry; the read continues`);
      }
    });
  }
  return kept;
}

export function linesAfter(
  kept: { id: string; line: string }[],
  after: string | null,
  prefix: string,
): { id: string; line: string }[] {
  if (after === null) return kept;
  const index = kept.findLastIndex((item) => item.id === after);
  if (index >= 0) return kept.slice(index + 1);
  console.error(`${prefix}: no kept entry has the id ${after}; the output starts at the oldest kept entry`);
  return kept;
}
