import { createHash, randomBytes } from 'node:crypto';
import { closeSync, constants, fstatSync, mkdirSync, openSync, readSync, renameSync, writeSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { format } from 'node:util';
import { HostError } from './host.ts';
import { revision as fullRevision } from './plugin-metadata.ts';
import { privateFolderSync, privateMode } from './private-folder.ts';
import { celetisBase } from './program.ts';
import { tryFlock } from './update-lock.ts';
import { openLockFile } from './windows.ts';

type Cut = 'message' | 'exception.stacktrace' | 'argv';
type Host = 'claude' | 'codex';

type Common = {
  schema: 1;
  id: string;
  time: string;
  name: string;
  command: string;
  argv: string[];
  cwd: string;
  host: Host | null;
  revision: string | null;
  pid: number;
  issue: number | null;
  code: number | null;
  message: string;
  fingerprint: string;
  truncated?: Cut[];
};

export type EventEntry =
  | (Common & { kind: 'refusal' | 'workflow' })
  | (Common & { kind: 'defect'; 'exception.type': string; 'exception.stacktrace': string });

type Report = { name: string; issue: number | null; code: number | null } & (
  | { kind: 'refusal' | 'workflow'; message: string }
  | { kind: 'defect'; error: unknown }
);

export const eventFile = { current: 'events.jsonl', rotated: 'events.1.jsonl', lock: 'events.lock' } as const;

const lineLimit = 16_384;
const captureLimit = 16_384;
const rotateSize = 5_242_880;
const signalCodes = new Set([0, 129, 130, 143]);
const root = resolve(import.meta.dir, '../..');
const programRevision =
  fullRevision.test(basename(root)) && basename(dirname(root)) === 'versions' ? basename(root) : null;
const decoder = new TextDecoder();

let installed: { command: string; write: typeof process.stderr.write } | undefined;
let captured = '';
let marked: { value: unknown } | undefined;
let crashed: { value: unknown } | undefined;
const passed = new Set<number>();

export function eventFolder(): string {
  return join(celetisBase(), '.local/state/celetis');
}

export function withEventLock<T>(folder: string, shared: boolean, work: () => T): T {
  const path = join(folder, eventFile.lock);
  const fd =
    process.platform === 'win32'
      ? openLockFile(path)
      : openSync(path, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || !privateMode(stat)) throw new HostError(`celetis: ${path}: need a private regular lock file`);
    const deadline = performance.now() + 2_000;
    while (!tryFlock(fd, shared)) {
      if (performance.now() >= deadline) throw new HostError('celetis: the record lock is busy after 2 seconds');
      Bun.sleepSync(20);
    }
    return work();
  } finally {
    closeSync(fd);
  }
}

function keep(text: () => string): void {
  try {
    captured = (captured + text()).slice(-captureLimit);
    const first = captured.charCodeAt(0);
    if (first >= 0xdc00 && first <= 0xdfff) captured = captured.slice(1);
  } catch {}
}

export function installRecorder(name: string): void {
  if (installed !== undefined) return;
  const write = process.stderr.write;
  installed = { command: name, write };
  process.stderr.write = function (this: unknown, chunk: unknown, ...rest: unknown[]): boolean {
    keep(() => (typeof chunk === 'string' ? chunk : chunk instanceof Uint8Array ? decoder.decode(chunk) : ''));
    return Reflect.apply(write, this, [chunk, ...rest]);
  };
  const error = console.error;
  console.error = (...args: unknown[]) => {
    keep(() => `${format(...args)}\n`);
    Reflect.apply(error, console, args);
  };
  process.on('uncaughtExceptionMonitor', (value) => {
    crashed = { value };
  });
  process.on('exit', (code) => {
    if (signalCodes.has(code) || passed.has(code)) return;
    const defect = marked ?? (crashed && !(crashed.value instanceof HostError) ? crashed : undefined);
    record(
      defect
        ? { kind: 'defect', name: 'exit', issue: null, code, error: defect.value }
        : { kind: 'refusal', name: 'exit', issue: null, code, message: captured.trimEnd() },
    );
  });
}

export function markDefect(error: unknown): void {
  if (!(error instanceof HostError)) marked = { value: error };
}

export function passOn(code: number): number {
  passed.add(code);
  return code;
}

export function recordEvent(event: {
  name: string;
  message: string;
  issue?: number | null;
  code?: number | null;
  error?: unknown;
}): void {
  const site = { name: event.name, issue: event.issue ?? null, code: event.code ?? null };
  record(
    event.error === undefined
      ? { ...site, kind: 'workflow', message: event.message }
      : { ...site, kind: 'defect', error: event.error },
  );
}

function record(report: Report): void {
  if (installed === undefined) return;
  const { command, write } = installed;
  try {
    append(serialize(entry(command, report)));
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error)).replace(/^celetis: /, '');
    try {
      write.call(process.stderr, `celetis: cannot record the event: ${reason}\n`);
    } catch {}
  }
}

function entry(command: string, report: Report): EventEntry {
  const argv = process.argv.slice(2);
  const head = {
    schema: 1 as const,
    id: `${Date.now()}-${process.pid}-${randomBytes(4).toString('hex')}`,
    time: new Date().toISOString(),
  };
  const site = {
    name: report.name,
    command,
    argv,
    cwd: process.cwd(),
    host: host(argv),
    revision: programRevision,
    pid: process.pid,
    issue: report.issue,
    code: report.code,
  };
  if (report.kind === 'defect') {
    const { type, message, stacktrace } = describe(report.error);
    return {
      ...head,
      kind: 'defect',
      ...site,
      message,
      'exception.type': type,
      'exception.stacktrace': stacktrace,
      fingerprint: fingerprint(['defect', command, type, frame(stacktrace)]),
    };
  }
  const key =
    report.kind === 'refusal'
      ? ['refusal', command, String(report.code), firstLine(report.message)]
      : ['workflow', command, report.name];
  return { ...head, kind: report.kind, ...site, message: report.message, fingerprint: fingerprint(key) };
}

function isHost(value: unknown): value is Host {
  return value === 'claude' || value === 'codex';
}

function host(argv: string[]): Host | null {
  if (argv[0] === '--agent' && isHost(argv[1])) return argv[1];
  const agent = process.env.CELETIS_SESSION_AGENT ?? process.env.CELETIS_AGENT;
  return isHost(agent) ? agent : null;
}

function describe(value: unknown): { type: string; message: string; stacktrace: string } {
  let type: string = typeof value;
  let stacktrace = '';
  if (value !== null && typeof value === 'object') {
    const made: unknown = Reflect.get(value, 'constructor');
    if (typeof made === 'function' && made.name) type = made.name;
    const stack: unknown = Reflect.get(value, 'stack');
    if (typeof stack === 'string') stacktrace = stack;
  }
  return { type, message: value instanceof Error ? value.message : String(value), stacktrace };
}

const framePattern = /^\s*at (?:(.*) \((.+):\d+:\d+\)|(.+):\d+:\d+)$/;

function frame(stack: string): string {
  for (const line of stack.split('\n')) {
    const match = framePattern.exec(line);
    const path = match?.[2] ?? match?.[3];
    if (path?.startsWith(root + sep)) return `${relative(root, path).split(sep).join('/')} ${match?.[1] ?? ''}`;
  }
  return '';
}

function firstLine(message: string): string {
  return (message.split('\n', 1)[0] ?? '').replaceAll(root, '<program>').replace(/\d+/g, '0');
}

function fingerprint(key: string[]): string {
  return createHash('sha256').update(key.join('\n')).digest('hex').slice(0, 16);
}

function jsonBytes(point: number): number {
  if (point === 0x22 || point === 0x5c) return 2;
  if (point < 0x20) return [0x08, 0x09, 0x0a, 0x0c, 0x0d].includes(point) ? 2 : 6;
  if (point < 0x80) return 1;
  if (point < 0x800) return 2;
  if (point >= 0xd800 && point <= 0xdfff) return 6;
  return point < 0x10000 ? 3 : 4;
}

function shorten(text: string, excess: number): string {
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

function serialize(entry: EventEntry): string {
  const truncated: Cut[] = [];
  const excess = () => Buffer.byteLength(JSON.stringify(entry)) + 1 - lineLimit;
  const cut = (field: Cut) => {
    truncated.push(field);
    entry.truncated = truncated;
    return excess();
  };
  if (excess() > 0 && entry.message) entry.message = shorten(entry.message, cut('message'));
  if (entry.kind === 'defect' && excess() > 0 && entry['exception.stacktrace'])
    entry['exception.stacktrace'] = shorten(entry['exception.stacktrace'], cut('exception.stacktrace'));
  if (excess() > 0 && entry.argv.length) {
    let over = cut('argv');
    while (over > 0 && entry.argv.length) over -= Buffer.byteLength(JSON.stringify(entry.argv.pop() ?? '')) + 1;
  }
  return `${JSON.stringify(entry)}\n`;
}

function append(line: string): void {
  const folder = eventFolder();
  mkdirSync(dirname(folder), { recursive: true });
  privateFolderSync(folder, (path, reason) => new HostError(`${path}: ${reason}`));
  withEventLock(folder, false, () => {
    const current = join(folder, eventFile.current);
    const fd = openSync(
      current,
      constants.O_RDWR | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
      0o600,
    );
    let size: number;
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || !privateMode(stat)) throw new HostError(`${current}: need a private regular file`);
      const last = Buffer.alloc(1);
      const ended = stat.size === 0 || (readSync(fd, last, 0, 1, stat.size - 1) === 1 && last[0] === 0x0a);
      const bytes = Buffer.from(ended ? line : `\n${line}`);
      if (writeSync(fd, bytes) !== bytes.length) throw new HostError(`${current}: incomplete write`);
      size = fstatSync(fd).size;
    } finally {
      closeSync(fd);
    }
    if (size > rotateSize) renameSync(current, join(folder, eventFile.rotated));
  });
}
