import type { Host } from './config-core.ts';
import { childEnv, run } from './process.ts';
import type { Terminal, TerminalStatus } from './terminal-types.ts';

type Result = { code: number; stdout: string; stderr: string };
export type Exec = (
  file: string,
  args: string[],
  options?: { timeout?: number; signal?: AbortSignal },
) => Promise<Result>;
export type OpenTab = {
  space: string;
  folder: string;
  name: string;
  argv: string[] | null;
  focus: boolean;
  beforeStart?: () => void;
};
type Space = { id: string | null; name: unknown; tabs: { id: string | null; terminals: unknown[] }[] };

export class TerminalError extends Error {}

export const LINK = 'celetis.link';
const SAFE_ID = /^[\w:.][\w:.-]*$/;
const POLL_MS = 250;
const POLL_LIMIT_MS = 5_000;
const STATUSES: Record<TerminalStatus, true> = { idle: true, working: true, done: true, blocked: true, error: true };
const HOSTS: Record<Host, { app: string; exit: (id: string) => string[] }> = {
  claude: { app: 'claude-code', exit: (id) => ['send', id, '/exit'] },
  codex: { app: 'codex', exit: (id) => ['keys', id, 'ctrl+c', 'ctrl+c'] },
};

export const isSafeId = (value: unknown): value is string => typeof value === 'string' && SAFE_ID.test(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is TerminalStatus => isText(value) && Object.hasOwn(STATUSES, value);
const hostOf = (app: unknown): Host | null =>
  (Object.keys(HOSTS) as Host[]).find((host) => HOSTS[host].app === app) ?? null;
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
const call = (exec: Exec, file: string, args: string[], signal?: AbortSignal) =>
  exec(file, args, { timeout: 15_000, signal });

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

export async function ownTerminal(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const id = env.HC_TERMINAL_ID;
  if (!id) return null;
  if (!isSafeId(id)) throw new TerminalError('HC_TERMINAL_ID needs a safe terminal id; start from an hc terminal');
  if (!Bun.which('hc', { PATH: childEnv(env).PATH ?? '' })) throw new TerminalError('hc is not on PATH');
  // hc reports the previous foreground for a moment after a new job takes the terminal.
  const leads = await poll(async () => {
    const result = await call(run, 'hc', ['get', id, '--json']);
    if (result.code !== 0) throw new TerminalError(`cannot read hc terminal ${id}: ${failure('hc', result)}`);
    const value = parse(result.stdout);
    if (!isRecord(value) || value.address !== id)
      throw new TerminalError(`cannot read hc terminal ${id}: hc gave no terminal`);
    return isRecord(value.foreground) && value.foreground.pid === process.pid ? true : null;
  });
  if (!leads)
    throw new TerminalError(
      `this runner does not lead hc terminal ${id}; start it in a terminal of its own, for example with hc run --bg`,
    );
  return id;
}

export async function readTerminal(
  id: string,
  { exec = run, signal }: { exec?: Exec; signal?: AbortSignal } = {},
): Promise<Terminal | null> {
  if (!isSafeId(id)) return null;
  const value = answer(await call(exec, 'hc', ['get', id, '--json'], signal));
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

export async function listTerminals(exec: Exec = run): Promise<Terminal[]> {
  const result = await call(exec, 'hc', ['ls', '--json']);
  if (result.code !== 0) throw new TerminalError(failure('hc', result));
  const value = parse(result.stdout);
  if (!isRecord(value) || !Array.isArray(value.terminals)) throw new TerminalError('hc gave no list of terminals');
  const ids = records(value.terminals)
    .filter((entry) => isText(entry.status))
    .map((entry) => entry.address)
    .filter(isSafeId);
  const terminals = await Promise.all(ids.map((id) => readTerminal(id, { exec })));
  return terminals.filter((terminal) => terminal !== null);
}

export async function waitTerminal(id: string, seconds: number, signal?: AbortSignal): Promise<boolean> {
  if (!isSafeId(id)) return false;
  const { code } = await run('hc', ['wait', id, '--timeout', String(seconds), '--json'], { signal });
  return code === 0 && !signal?.aborted;
}

export async function requestExit(id: string, host: Host, signal?: AbortSignal): Promise<boolean> {
  if (!isSafeId(id)) return false;
  return (await call(run, 'hc', [...HOSTS[host].exit(id), '--json'], signal)).code === 0;
}

export async function setLink(id: string, link: string | null, exec: Exec = run): Promise<boolean> {
  if (!isSafeId(id)) return false;
  return (await call(exec, 'hc', ['label', id, `${LINK}=${link ?? ''}`, '--json'])).code === 0;
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

const spaceNamed = (spaces: Space[], name: string) =>
  spaces.find((space): space is Space & { id: string } => space.name === name && space.id !== null);

async function tabOf(id: string, exec: Exec): Promise<string | null> {
  const spaces = await readSpaces(exec).catch(() => []);
  return spaces.flatMap((space) => space.tabs).find((tab) => tab.terminals.includes(id))?.id ?? null;
}

const rename = (tab: string, name: string, exec: Exec) =>
  call(exec, 'herdr-app', ['do', 'tab.rename', '--id', tab, '--name', name]);

export async function renameTab(id: string, name: string, exec: Exec = run): Promise<void> {
  const tab = await poll(() => tabOf(id, exec));
  if (tab) await rename(tab, name, exec);
}

export async function focusTerminal(id: string, exec: Exec = run): Promise<void> {
  if (!isSafeId(id)) throw new TerminalError('the terminal id is not safe');
  const result = await call(exec, 'herdr-app', ['do', 'pane.focus', '--terminal', id]);
  if (result.code !== 0) throw new TerminalError(failure('herdr-app', result));
}

async function newSpace(request: OpenTab, exec: Exec): Promise<string> {
  const argv = request.argv === null ? [] : ['--argv', JSON.stringify(request.argv)];
  const result = await call(exec, 'herdr-app', [
    'do',
    'space.new',
    '--name',
    request.space,
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
          const terminals = spaceNamed(spaces, request.space)?.tabs[0]?.terminals ?? [];
          const [only] = terminals;
          return terminals.length === 1 && isSafeId(only) ? only : null;
        });
  if (id === null) throw new TerminalError('herdr gave no terminal for the new space');
  await setLink(id, request.name, exec);
  return id;
}

async function startTab(request: OpenTab, exec: Exec): Promise<{ id: string; shown: boolean }> {
  const space = spaceNamed(await readSpaces(exec), request.space);
  request.beforeStart?.();
  if (!space) return { id: await newSpace(request, exec), shown: true };
  const isWindows = process.platform === 'win32';
  const shell = process.env.SHELL || '/bin/sh';
  const wrap = (argv: string[]) => (isWindows ? argv : [shell, '-lic', '"$@" || exec "$0" -li', shell, ...argv]);
  const result = await call(exec, 'hc', [
    'run',
    '--bg',
    '--json',
    '--no-parent',
    '--no-notify',
    ...(isWindows ? [] : ['--rm']),
    '--cwd',
    request.folder,
    '--label',
    `herdr.space=${space.id}`,
    '--label',
    `${LINK}=${request.name}`,
    '--',
    ...(request.argv === null ? [] : wrap(request.argv)),
  ]);
  if (result.code !== 0) throw new TerminalError(failure('hc', result));
  const reply = parse(result.stdout);
  if (!isRecord(reply) || !isSafeId(reply.address)) throw new TerminalError('hc gave no terminal id');
  return { id: reply.address, shown: false };
}

let opening: Promise<unknown> = Promise.resolve();

export async function openTab(request: OpenTab, exec: Exec = run): Promise<string> {
  const started = opening.then(() => startTab(request, exec));
  opening = started.catch(() => {});
  const { id, shown } = await started;
  if (shown) return id;
  const tab = await poll(() => tabOf(id, exec));
  if (tab) await rename(tab, request.name, exec);
  if (request.focus) await focusTerminal(id, exec).catch(() => {});
  return id;
}
