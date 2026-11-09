import { basename } from 'node:path';
import { type ExitCode, exits } from './contract.ts';
import { type Host, hosts } from './host-names.ts';
import { hostAdapter } from './hosts.ts';
import { childEnv, run } from './process.ts';
import { repositoryState, StateError, withLock } from './state.ts';
import type { Terminal, TerminalStatus } from './terminal-types.ts';

type Result = { code: number; stdout: string; stderr: string };
type CallOptions = { signal?: AbortSignal; env?: NodeJS.ProcessEnv };
export type Exec = (file: string, args: string[], options?: CallOptions & { timeout?: number }) => Promise<Result>;
export type Repository = { main: string; common: string };
export type OpenTab = {
  repository: Repository;
  folder: string;
  name: string;
  argv: string[] | null;
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
const STATUSES: Record<TerminalStatus, true> = { idle: true, working: true, done: true, blocked: true, error: true };

export const isSafeId = (value: unknown): value is string => typeof value === 'string' && SAFE_ID.test(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is TerminalStatus => isText(value) && Object.hasOwn(STATUSES, value);
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
  exec(file, args, { timeout: 15_000, ...options });
const inShell = (script: string, argv: string[]) => {
  if (process.platform === 'win32') return argv;
  const shell = process.env.SHELL || '/bin/sh';
  return [shell, '-lic', script, shell, ...argv];
};

function failure(file: string, { code, stdout, stderr }: Result): string {
  const errors = [stderr, stdout].map((text) => {
    const value = parse(text);
    return isRecord(value) ? value.error : undefined;
  });
  const texts = [...errors.map((error) => (isRecord(error) ? error.message : undefined)), ...errors, stderr, stdout];
  return texts.filter(isText).map(firstLine).find(Boolean) ?? `${file} exited ${code}`;
}

async function poll<T>(read: () => Promise<T | null>): Promise<T | null> {
  const until = performance.now() + POLL_LIMIT_MS;
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
    statusMs: isCount(value.status_ms) ? value.status_ms : null,
    turn: value.turn,
    labels,
    cwd,
    foreground: Array.isArray(foreground.argv) && foreground.argv.every(isText) ? foreground.argv : null,
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

export async function terminalLive(id: string, exec: Exec = run): Promise<boolean> {
  if (!isSafeId(id)) return false;
  const value = answer(await call(exec, 'hc', ['get', id, '--json']));
  return isRecord(value) && value.address === id && value.state === 'live';
}

export async function waitTerminal(id: string, seconds: number, signal?: AbortSignal): Promise<boolean> {
  if (!isSafeId(id)) return false;
  const { code } = await run('hc', ['wait', id, '--timeout', String(seconds), '--json'], { signal });
  return code === 0 && !signal?.aborted;
}

export async function requestExit(id: string, host: Host, signal?: AbortSignal, exec: Exec = run): Promise<boolean> {
  if (!isSafeId(id)) return false;
  const env = { ...process.env };
  delete env.HC_TERMINAL_ID;
  return (await call(exec, 'hc', [...hostAdapter(host).exitKeys(id), '--json'], { signal, env })).code === 0;
}

export async function closeTerminal(id: string, exec: Exec = run): Promise<void> {
  if (!isSafeId(id)) return;
  await call(exec, 'hc', ['kill', id, '--json']).catch(() => null);
  await call(exec, 'hc', ['rm', id, '--json']).catch(() => null);
}

async function setLink(id: string, link: string, exec: Exec): Promise<void> {
  if (isSafeId(id)) await call(exec, 'hc', ['label', id, `${LINK}=${link}`, '--json']);
}

export async function readScreen(id: string, history: number, exec: Exec = run): Promise<string | null> {
  if (!isSafeId(id)) return null;
  const value = answer(await call(exec, 'hc', ['read', id, '--lines', String(history), '--json']));
  return isRecord(value) && isText(value.text) ? value.text : null;
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
    throw new TerminalError('hc is not on PATH; install herdr-core 0.1.16, then start again', exits.prerequisite);
  await terminalIds(exec).catch((error: unknown) => {
    throw new TerminalError(`the hc server does not answer: ${reason(error)}; start the Herdr app, then start again`);
  });
  if (!Bun.which('herdr-app', { PATH }))
    throw new TerminalError(
      'herdr-app is not on PATH; install the Herdr app 0.1.11, then start again',
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

async function newSpace(request: OpenTab, space: string, exec: Exec): Promise<string> {
  const argv = request.argv === null ? [] : ['--argv', JSON.stringify(request.argv)];
  const result = await call(exec, 'herdr-app', [
    'do',
    'space.new',
    '--name',
    space,
    '--folder',
    request.folder,
    '--tab',
    request.name,
    ...argv,
  ]);
  if (result.code !== 0) throw new TerminalError(failure('herdr-app', result));
  const reply = parse(result.stdout);
  const id =
    isRecord(reply) && isSafeId(reply.terminal)
      ? reply.terminal
      : await poll(async () => {
          const spaces = await readSpaces(exec).catch(() => []);
          const terminals = spaceNamed(spaces, space)?.tabs[0]?.terminals ?? [];
          const [only] = terminals;
          return terminals.length === 1 && isSafeId(only) ? only : null;
        });
  if (id === null) throw new TerminalError('herdr gave no terminal for the new space');
  await setLink(id, request.name, exec);
  return id;
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

async function startTab(request: OpenTab, exec: Exec): Promise<{ id: string; shown: boolean }> {
  const name = basename(request.repository.main);
  const space = spaceNamed(await readSpaces(exec), name);
  if (!space) return { id: await newSpace(request, name, exec), shown: true };
  const script = request.keepShell ? '"$@"; exec "$0" -li' : '"$@" || exec "$0" -li';
  const id = await runTerminal(
    exec,
    [
      ...(process.platform === 'win32' || request.keepShell ? [] : ['--rm']),
      '--cwd',
      request.folder,
      '--label',
      `herdr.space=${space.id}`,
      '--label',
      `${LINK}=${request.name}`,
    ],
    request.argv === null ? [] : inShell(script, request.argv),
  );
  return { id, shown: false };
}

async function holdingSpaceLock<T>(common: string, work: () => Promise<T>): Promise<T> {
  try {
    return await withLock((await repositoryState(common)).spaceLock, work);
  } catch (error) {
    if (error instanceof StateError) throw new TerminalError(error.message, error.code);
    throw error;
  }
}

let opening: Promise<unknown> = Promise.resolve();

export async function openTab(request: OpenTab, exec: Exec = run): Promise<string> {
  const started = opening.then(() => holdingSpaceLock(request.repository.common, () => startTab(request, exec)));
  opening = started.catch(() => {});
  const { id, shown } = await started;
  if (shown) return id;
  const tab = await poll(() => tabOf(id, exec));
  if (tab) await rename(tab, request.name, exec);
  if (request.focus) await focusTerminal(id, exec).catch(() => {});
  return id;
}
