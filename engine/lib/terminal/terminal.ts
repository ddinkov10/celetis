import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { type ExitCode, exits } from '../contract/contract.ts';
import { hostAdapter } from '../host/hosts.ts';
import { type Host, hosts } from '../host/names.ts';
import { bunArgs, childEnv, run } from '../process/process.ts';
import { repositoryLayout, StateError, withLock } from '../state/state.ts';
import type { DialogKind, Terminal, TerminalStatus } from './types.ts';

type Result = { code: number; stdout: string; stderr: string };
type CallOptions = { signal?: AbortSignal; env?: NodeJS.ProcessEnv; timeout?: number };
export type Exec = (file: string, args: string[], options?: CallOptions) => Promise<Result>;
export type Repository = { main: string; common: string };
export type OpenTab = {
  repository: Repository;
  folder: string;
  name: string;
  argv: string[] | null;
  env: Readonly<Record<string, string>>;
  focus: boolean;
  keepShell: boolean;
};
type Space = { id: string | null; name: unknown; tabs: { id: string | null; terminals: unknown[] }[] };

export class TerminalError extends Error {
  constructor(
    message: string,
    readonly code: ExitCode = exits.blocked,
  ) {
    super(message);
  }
}

export const LINK = 'celetis.link';
export const exitGraceMs = 10_000;
const SAFE_ID = /^[\w:.][\w:.-]*$/;
const POLL_MS = 250;
const POLL_LIMIT_MS = 5_000;
const SPACE_POLL_LIMIT_MS = 10_000;
const STATUSES: Record<TerminalStatus, true> = { idle: true, working: true, done: true, blocked: true, error: true };
const KINDS: Record<DialogKind, true> = { permission: true, question: true, auth: true };
const GONE_KINDS = new Set(['finished', 'not_found']);

export const isSafeId = (value: unknown): value is string => typeof value === 'string' && SAFE_ID.test(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is TerminalStatus => isText(value) && Object.hasOwn(STATUSES, value);
const isKind = (value: unknown): value is DialogKind => isText(value) && Object.hasOwn(KINDS, value);
const hostOf = (app: unknown): Host | null => hosts.find((host) => hostAdapter(host).app === app) ?? null;
const records = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);
const firstLine = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';
const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
const answer = (result: Result): unknown => (result.code === 0 ? parse(result.stdout) : null);
const call = (exec: Exec, file: string, args: string[], options: CallOptions = {}) =>
  exec(file, args, { ...options, timeout: options.timeout ?? 15_000 });

export const tabWrapper = [
  'const { spawn } = require("node:child_process");',
  'const [mode, count, ...rest] = process.argv.slice(1);',
  'const env = { ...process.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", DO_NOT_TRACK: "1" };',
  'for (let at = 0; at < Number(count); at++) env[rest[2 * at]] = rest[2 * at + 1];',
  'const [program, ...args] = rest.slice(2 * Number(count));',
  'for (const name of ["SIGINT", "SIGBREAK"]) process.on(name, () => {});',
  'let ended = false;',
  'const hold = (line, code) => {',
  'if (ended) return; ended = true;',
  // hc keeps the last status of the host while the wrapper holds; a status of no host keeps the card off the board.
  'process.stdout.write("\\x1b]7501;state=idle:app=celetis-hold\\x1b\\\\");',
  'console.log(line + " Press Enter to close this tab.");',
  'process.stdin.once("data", () => process.exit(code)).once("end", () => process.exit(code));',
  '};',
  'const child = spawn(program, args, { stdio: "inherit", env });',
  'child.once("error", (error) => hold(error.message + ".", 127));',
  'child.once("exit", (code) => {',
  'if (mode === "close" && code === 0) process.exit(0);',
  'hold(program + " exited " + (code ?? 1) + ".", code ?? 1);',
  '});',
].join(' ');
const wrapperFlags = bunArgs('-e', []);

// A tab of an older engine keeps its wrapper text, so the strip reads the form of the wrapper, not its text.
const programArgv = (argv: string[]): string[] | null => {
  const mode = argv[wrapperFlags.length + 2];
  if (!wrapperFlags.every((word, at) => argv[at + 1] === word) || (mode !== 'keep' && mode !== 'close')) return argv;
  const count = argv[wrapperFlags.length + 3] ?? '';
  const start = wrapperFlags.length + 4 + 2 * Number(count);
  return /^\d+$/.test(count) && start < argv.length ? argv.slice(start) : null;
};

// hc gives a tab the environment of its server, not of the caller.
function tabArgv({ argv, env, keepShell }: OpenTab & { argv: string[] }): string[] {
  const pairs = Object.entries(env);
  if (process.platform === 'win32')
    return [
      process.execPath,
      ...bunArgs('-e', [tabWrapper, keepShell ? 'keep' : 'close', String(pairs.length), ...pairs.flat(), ...argv]),
    ];
  const shell = process.env.SHELL || '/bin/sh';
  const script = keepShell ? '"$@"; exec "$0" -li' : '"$@" || exec "$0" -li';
  const variables = pairs.length ? ['env', ...pairs.map(([key, value]) => `${key}=${value}`)] : [];
  return [shell, '-lic', script, shell, ...variables, ...argv];
}

function failure(file: string, { code, stdout, stderr }: Result): string {
  const errors = [stderr, stdout].map((text) => {
    const value = parse(text);
    return isRecord(value) ? value.error : undefined;
  });
  const texts = [...errors.map((error) => (isRecord(error) ? error.message : undefined)), ...errors, stderr, stdout];
  return texts.filter(isText).map(firstLine).find(Boolean) ?? `${file} exited ${code}`;
}

async function poll<T>(read: () => Promise<T | null>, limitMs = POLL_LIMIT_MS): Promise<T | null> {
  const until = performance.now() + limitMs;
  for (;;) {
    const value = await read();
    if (value !== null || performance.now() >= until) return value;
    await Bun.sleep(POLL_MS);
  }
}

export async function readTerminal(
  id: string,
  { exec = run, signal }: { exec?: Exec; signal?: AbortSignal } = {},
): Promise<Terminal | null> {
  if (!isSafeId(id)) return null;
  const value = answer(await call(exec, 'hc', ['get', id, '--json'], { signal }));
  if (!isRecord(value) || value.address !== id || !isCount(value.turn)) return null;
  const status = isRecord(value.status) ? value.status : {};
  const foreground = isRecord(value.foreground) ? value.foreground : {};
  const cwd = [foreground.cwd, value.cwd].find(isText);
  if (cwd === undefined) return null;
  const labels = Object.fromEntries(
    Object.entries(isRecord(value.labels) ? value.labels : {}).filter((entry): entry is [string, string] =>
      isText(entry[1]),
    ),
  );
  const where = labels.where ?? '';
  const at = where.indexOf(' / ');
  return {
    id,
    host: hostOf(status.app),
    status: isStatus(status.state) ? status.state : null,
    kind: isKind(status.kind) ? status.kind : null,
    statusMs: isCount(value.status_ms) ? value.status_ms : null,
    turn: value.turn,
    labels,
    cwd,
    foreground: Array.isArray(foreground.argv) && foreground.argv.every(isText) ? programArgv(foreground.argv) : null,
    tab: at < 0 ? null : where.slice(at + 3) || null,
  };
}

async function terminalIds(exec: Exec): Promise<string[]> {
  const result = await call(exec, 'hc', ['ls', '--json']);
  if (result.code !== 0) throw new TerminalError(failure('hc', result));
  const value = parse(result.stdout);
  if (!isRecord(value) || !Array.isArray(value.terminals)) throw new TerminalError('hc gave no list of terminals');
  return records(value.terminals)
    .map((entry) => entry.address)
    .filter(isSafeId);
}

export async function listTerminals(exec: Exec = run): Promise<Terminal[]> {
  const terminals = await Promise.all((await terminalIds(exec)).map((id) => readTerminal(id, { exec })));
  return terminals.filter((terminal) => terminal !== null);
}

const errorKinds = (result: Result) =>
  [result.stderr, result.stdout].map((output) => {
    const value = parse(output);
    const error = isRecord(value) ? value.error : undefined;
    return isRecord(error) ? error.kind : undefined;
  });
const isGone = (kind: unknown) => isText(kind) && GONE_KINDS.has(kind);
const goneOrUnknown = (result: Result) => (errorKinds(result).some(isGone) ? 'gone' : 'unknown');
const withoutTerminal = () => {
  const env = { ...process.env };
  delete env.HC_TERMINAL_ID;
  return env;
};

export type TerminalState = 'live' | 'ended' | 'unknown';

export async function terminalState(id: string, exec: Exec = run): Promise<TerminalState> {
  if (!isSafeId(id)) return 'ended';
  const result = await call(exec, 'hc', ['get', id, '--json']);
  const value = answer(result);
  if (isRecord(value) && value.address === id && isText(value.state)) return value.state === 'live' ? 'live' : 'ended';
  return result.code !== 0 && errorKinds(result).some(isGone) ? 'ended' : 'unknown';
}

export async function terminalLive(id: string, exec: Exec = run): Promise<boolean> {
  return (await terminalState(id, exec)) === 'live';
}

export async function waitTerminal(id: string, seconds: number, signal?: AbortSignal): Promise<boolean> {
  if (!isSafeId(id)) return false;
  const { code } = await run('hc', ['wait', id, '--timeout', String(seconds), '--json'], { signal });
  return code === 0 && !signal?.aborted;
}

export async function requestExit(
  id: string,
  host: Host,
  signal?: AbortSignal,
  exec: Exec = run,
  timeout?: number,
): Promise<boolean> {
  if (!isSafeId(id)) return false;
  const env = withoutTerminal();
  return (await call(exec, 'hc', [...hostAdapter(host).exitKeys(id), '--json'], { signal, env, timeout })).code === 0;
}

export async function closeTerminal(id: string, exec: Exec = run): Promise<void> {
  if (!isSafeId(id)) return;
  await call(exec, 'hc', ['kill', id, '--json']).catch(() => null);
  await call(exec, 'hc', ['rm', id, '--json']).catch(() => null);
}

export type ScreenRead = Readonly<{ text: string; complete: boolean; why: string | null }>;

export async function readHistory(id: string, lines: number, exec: Exec = run): Promise<ScreenRead | null> {
  if (!isSafeId(id)) return null;
  const value = answer(await call(exec, 'hc', ['read', id, '--lines', String(lines), '--json']));
  if (!isRecord(value) || !isText(value.text) || typeof value.complete !== 'boolean') return null;
  return { text: value.text, complete: value.complete, why: isText(value.why) ? value.why : null };
}

export async function readScreen(id: string, history: number, exec: Exec = run): Promise<string | null> {
  return (await readHistory(id, history, exec))?.text ?? null;
}

export type Sent = 'sent' | 'blocked' | 'gone' | 'unknown';

export async function sendText(
  id: string,
  text: string,
  { signal, exec = run, timeout }: { signal?: AbortSignal; exec?: Exec; timeout?: number } = {},
): Promise<Sent> {
  if (!isSafeId(id)) return 'gone';
  const result = await call(exec, 'hc', ['send', id, '--json', '--', text], {
    signal,
    env: withoutTerminal(),
    timeout,
  });
  if (result.code === 0) return 'sent';
  return errorKinds(result).includes('blocked') ? 'blocked' : goneOrUnknown(result);
}

export async function pressKeys(id: string, keys: readonly string[], exec: Exec = run): Promise<Sent> {
  if (!isSafeId(id)) return 'gone';
  const result = await call(exec, 'hc', ['keys', id, ...keys, '--json'], { env: withoutTerminal() });
  return result.code === 0 ? 'sent' : goneOrUnknown(result);
}

export async function interruptTerminal(id: string, exec: Exec = run): Promise<Sent> {
  if (!isSafeId(id)) return 'gone';
  const result = await call(exec, 'hc', ['interrupt', id, '--json'], { env: withoutTerminal(), timeout: 30_000 });
  const value = answer(result);
  if (isRecord(value) && isText(value.key)) return 'sent';
  return result.code === 0 ? 'unknown' : goneOrUnknown(result);
}

const sequences = new Map<string, Promise<void>>();

export function inSequence<T>(id: string, work: () => Promise<T>): Promise<T> {
  const result = (sequences.get(id) ?? Promise.resolve()).then(work);
  const tail = result.then(
    () => {},
    () => {},
  );
  sequences.set(id, tail);
  void tail.then(() => {
    if (sequences.get(id) === tail) sequences.delete(id);
  });
  return result;
}

async function readSpaces(exec: Exec): Promise<Space[]> {
  const result = await call(exec, 'herdr-app', ['ls']);
  if (result.code !== 0) throw new TerminalError(failure('herdr-app', result));
  const value = parse(result.stdout);
  if (!isRecord(value) || !Array.isArray(value.spaces)) throw new TerminalError('herdr gave no list of spaces');
  return records(value.spaces)
    .filter((space) => space.machine === null)
    .map((space) => ({
      id: isSafeId(space.id) ? space.id : null,
      name: space.name,
      tabs: records(space.tabs).map((tab) => ({
        id: isSafeId(tab.id) ? tab.id : null,
        terminals: records(tab.terminals).map((terminal) => terminal.terminal),
      })),
    }));
}

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function requireTerminals(exec: Exec = run, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const PATH = childEnv(env).PATH ?? '';
  if (!Bun.which('hc', { PATH }))
    throw new TerminalError('hc is not on PATH; install herdr-core 0.1.19, then start again', exits.prerequisite);
  await terminalIds(exec).catch((error: unknown) => {
    throw new TerminalError(`the hc server does not answer: ${reason(error)}; start the Herdr app, then start again`);
  });
  if (!Bun.which('herdr-app', { PATH }))
    throw new TerminalError(
      'herdr-app is not on PATH; install the Herdr app 0.1.18, then start again',
      exits.prerequisite,
    );
  await readSpaces(exec).catch((error: unknown) => {
    throw new TerminalError(
      `the Herdr app does not answer: ${reason(error)}; open the Herdr app window, then start again`,
    );
  });
}

const spaceNamed = (spaces: Space[], name: string) =>
  spaces.find((space): space is Space & { id: string } => space.name === name && space.id !== null);

async function tabOf(id: string, exec: Exec): Promise<string | null> {
  const spaces = await readSpaces(exec).catch(() => []);
  return spaces.flatMap((space) => space.tabs).find((tab) => tab.terminals.includes(id))?.id ?? null;
}

const rename = (tab: string, name: string, exec: Exec) =>
  call(exec, 'herdr-app', ['do', 'tab.rename', '--id', tab, '--name', name]);

export async function focusTerminal(id: string, exec: Exec = run): Promise<void> {
  if (!isSafeId(id)) throw new TerminalError('the terminal id is not safe');
  const result = await call(exec, 'herdr-app', ['do', 'pane.focus', '--terminal', id]);
  if (result.code !== 0) throw new TerminalError(failure('herdr-app', result));
}

async function runTerminal(exec: Exec, options: string[], argv: string[]): Promise<string> {
  const result = await call(exec, 'hc', [
    'run',
    '--bg',
    '--json',
    '--no-parent',
    '--no-notify',
    ...options,
    '--',
    ...argv,
  ]);
  if (result.code !== 0) throw new TerminalError(failure('hc', result));
  const reply = parse(result.stdout);
  if (!isRecord(reply) || !isSafeId(reply.address)) throw new TerminalError('hc gave no terminal id');
  return reply.address;
}

async function startTab(request: OpenTab, exec: Exec): Promise<string> {
  const name = basename(request.repository.main);
  const found = spaceNamed(await readSpaces(exec), name)?.id;
  const space = found ?? `celetis-${randomUUID()}`;
  const id = await runTerminal(
    exec,
    [
      ...(request.keepShell ? [] : ['--rm']),
      '--cwd',
      request.folder,
      '--label',
      `herdr.space=${space}`,
      '--label',
      `${LINK}=${request.name}`,
    ],
    request.argv === null ? [] : tabArgv({ ...request, argv: request.argv }),
  );
  if (found === undefined) {
    const shown = await poll(
      async () => (await readSpaces(exec).catch(() => [])).some((each) => each.id === space) || null,
      SPACE_POLL_LIMIT_MS,
    );
    if (shown) await call(exec, 'herdr-app', ['do', 'space.rename', JSON.stringify({ id: space, name })]);
  }
  return id;
}

async function holdingSpaceLock<T>(common: string, work: () => Promise<T>): Promise<T> {
  try {
    return await withLock(repositoryLayout(common).spaceLock, work);
  } catch (error) {
    if (error instanceof StateError) throw new TerminalError(error.message, error.code);
    throw error;
  }
}

let opening: Promise<unknown> = Promise.resolve();

export async function openTab(request: OpenTab, exec: Exec = run): Promise<string> {
  const started = opening.then(() => holdingSpaceLock(request.repository.common, () => startTab(request, exec)));
  opening = started.catch(() => {});
  const id = await started;
  const tab = await poll(() => tabOf(id, exec));
  if (tab) await rename(tab, request.name, exec);
  if (request.focus) await focusTerminal(id, exec).catch(() => {});
  return id;
}
