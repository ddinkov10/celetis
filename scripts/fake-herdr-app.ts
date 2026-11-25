import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../engine/lib/process/process.ts';
import { isSafeId } from '../engine/lib/terminal/terminal.ts';

const timeout = 15_000;
const version = 'herdr-app 0.1.18 (celetis fake)';

type Live = { terminal: string; space: string };

class Failure extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0] ?? '';
}

function stateFolder(env: NodeJS.ProcessEnv): string | null {
  const id = env.HC_SESSION ?? '';
  return /^celetis-lab-[0-9a-f]{6}$/.test(id) && env.HERDR_APP_HOME === `/tmp/${id}/app`
    ? `${env.HERDR_APP_HOME}/celetis-fake-app`
    : null;
}

async function spaceOf(terminal: string): Promise<string | null> {
  const result = await run('hc', ['get', '--json', terminal], { env: process.env, timeout });
  if (result.code !== 0) return null;
  const value = parse(result.stdout);
  if (!isRecord(value) || value.state !== 'live' || !isRecord(value.labels)) return null;
  const space = value.labels['herdr.space'];
  return isSafeId(space) ? space : null;
}

async function liveTerminals(): Promise<Live[]> {
  const list = await run('hc', ['ls', '--json'], { env: process.env, timeout });
  if (list.code !== 0) throw new Failure(`hc ls failed: ${firstLine(list.stderr)}`);
  const value = parse(list.stdout);
  if (!isRecord(value) || !Array.isArray(value.terminals)) throw new Failure('hc ls failed: no list of terminals');
  const ids = value.terminals.map((entry) => (isRecord(entry) ? entry.address : undefined)).filter(isSafeId);
  const spaces = await Promise.all(ids.map(spaceOf));
  return ids.flatMap((terminal, at) => {
    const space = spaces[at];
    return space ? [{ terminal, space }] : [];
  });
}

async function stored(folder: string, kind: 'space' | 'tab', id: string): Promise<string | null> {
  try {
    return await readFile(join(folder, `${kind}-${id}.name`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function store(folder: string, file: string, text: string): Promise<void> {
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const temporary = join(folder, `.${randomUUID()}.tmp`);
  await writeFile(temporary, text);
  await rename(temporary, join(folder, file));
}

async function list(folder: string, live: Live[]): Promise<string> {
  const ids = [...new Set(live.map((entry) => entry.space))];
  const spaces = await Promise.all(
    ids.map(async (id) => ({
      id,
      name: (await stored(folder, 'space', id)) ?? id,
      machine: null,
      tabs: live
        .filter((entry) => entry.space === id)
        .map((entry) => ({ id: `tab-${entry.terminal}`, terminals: [{ terminal: entry.terminal }] })),
    })),
  );
  return JSON.stringify({ spaces });
}

function notFound(kind: string, id: string): [number, string] {
  return [1, JSON.stringify({ error: { message: `${kind} not found: ${id}` } })];
}

async function spaceRename(folder: string, text: string): Promise<[number, string]> {
  const request = parse(text);
  if (!isRecord(request) || typeof request.id !== 'string' || typeof request.name !== 'string')
    return [1, JSON.stringify({ error: { message: 'invalid space.rename JSON' } })];
  const { id, name } = request;
  if (!isSafeId(id) || !(await liveTerminals()).some((entry) => entry.space === id)) return notFound('space', id);
  await store(folder, `space-${id}.name`, name);
  return [0, '{}'];
}

async function tabRename(folder: string, tab: string, name: string): Promise<[number, string]> {
  const found = (await liveTerminals()).find((entry) => `tab-${entry.terminal}` === tab);
  if (!found) return notFound('tab', tab);
  await store(folder, `tab-${found.terminal}.name`, name);
  return [0, '{}'];
}

async function paneFocus(folder: string, terminal: string): Promise<[number, string]> {
  if (!(await liveTerminals()).some((entry) => entry.terminal === terminal)) return notFound('terminal', terminal);
  await store(folder, 'focus', terminal);
  return [0, '{}'];
}

async function dispatch(folder: string, argv: string[]): Promise<[number, string] | null> {
  const [command, form = '', ...rest] = argv;
  if (argv.length === 1 && command === '--version') return [0, version];
  if (argv.length === 1 && command === 'status') return [0, ''];
  if (argv.length === 1 && command === 'ls') return [0, await list(folder, await liveTerminals())];
  if (command !== 'do') return null;
  if (form === 'space.rename' && rest.length === 1) return spaceRename(folder, rest[0] ?? '');
  if (form === 'tab.rename' && rest.length === 4 && rest[0] === '--id' && rest[2] === '--name')
    return tabRename(folder, rest[1] ?? '', rest[3] ?? '');
  if (form === 'pane.focus' && rest.length === 2 && rest[0] === '--terminal') return paneFocus(folder, rest[1] ?? '');
  return null;
}

async function main(argv: string[]): Promise<number> {
  const folder = stateFolder(process.env);
  if (!folder) {
    console.error('herdr-app (celetis fake): refused: not in a lab');
    return 2;
  }
  try {
    const answer = await dispatch(folder, argv);
    if (!answer) {
      console.error(`herdr-app (celetis fake): unsupported: ${argv.join(' ')}`);
      return 2;
    }
    if (answer[1]) console.log(answer[1]);
    return answer[0];
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    console.log(JSON.stringify({ error: { message: error.message } }));
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
