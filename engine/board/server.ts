import type { ExecFileOptions } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Board, Card, Command, Config, Diff, Document, Session } from './types.ts';

type Result = { code: number; stdout: string; stderr: string };
export type Execute = (file: string, args: string[], options?: ExecFileOptions) => Promise<Result>;
type HerdrResult = {
  snapshot?: Parameters<typeof sessionsOf>[0];
  workspaces?: { label: string; workspace_id: unknown }[];
  root_pane?: { pane_id: unknown };
  tab?: { tab_id: unknown };
};

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, delimiter, join, relative, resolve, sep } from 'node:path';
import { childEnv } from '../lib/process.ts';
import { AGENT, NUMBER } from './config.ts';
import { readDocument } from './contract.ts';
import { activePresses, place, sessionsOf, stepsOf } from './place.ts';
import { cleanPath } from './runtime.ts';

const HERE = import.meta.dirname;
const STALE_MS = 60_000;
const DIFF_MS = 15_000;
const SCREEN_LINES = 16;
const PANE = /^[\w:.][\w:.-]*$/;
const RULE = /^[\s─━═╌┄-]*$/;
const isPane = (id: unknown): id is string => typeof id === 'string' && PANE.test(id);
const FILES: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/board.css': ['board.css', 'text/css; charset=utf-8'],
  '/board.js': ['board.js', 'text/javascript; charset=utf-8'],
  '/view.mjs': ['view.mjs', 'text/javascript; charset=utf-8'],
  '/ui.mjs': ['ui.mjs', 'text/javascript; charset=utf-8'],
  '/panel.mjs': ['panel.mjs', 'text/javascript; charset=utf-8'],
  '/palette.mjs': ['palette.mjs', 'text/javascript; charset=utf-8'],
  '/fonts/geist.woff2': ['fonts/geist.woff2', 'font/woff2'],
  '/fonts/geist-mono.woff2': ['fonts/geist-mono.woff2', 'font/woff2'],
};
const POSTS = new Set(['/api/run', '/api/resume', '/api/shell', '/api/go', '/api/refresh', '/api/agent']);
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src data:; " +
  "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

class Refusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const firstLine = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';
const cleanCause = (cause: unknown) =>
  firstLine(String(cause ?? ''))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 200);
// PowerShell also reads U+2018 to U+201B as single quotes.
const quote = (text: string) =>
  process.platform === 'win32'
    ? `'${text.replace(/['\u2018-\u201b]/g, (mark) => mark + mark)}'`
    : `'${text.replaceAll("'", "'\\''")}'`;
const lineOf = (items: Command, number: number, agent: string | null = null) => {
  const env = items[0] === process.execPath ? Object.entries(childEnv({})) : null;
  const words = (command: string[]) =>
    command.map((item) => (item === NUMBER ? number : item === AGENT ? quote(agent as string) : quote(item))).join(' ');
  if (process.platform === 'win32')
    return `${(env ?? []).map(([name, value]) => `$env:${name}=${quote(value as string)}; `).join('')}& ${words(items)}; if ($?) { exit }`;
  return `${words(env ? ['/usr/bin/env', ...env.map(([name, value]) => `${name}=${value}`), ...items] : items)} && exit`;
};
const count = (text: string, word: string) => Number(new RegExp(`(\\d+) ${word}`).exec(text)?.[1] ?? 0);
const screenOf = (text: string) =>
  text
    .replaceAll('\t', ' ')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .split('\n')
    .map((line) => line.replace(/^[\s│┃╭╮╰╯]+|[\s│┃╭╮╰╯]+$/g, ''))
    .filter((line) => !RULE.test(line))
    .slice(-SCREEN_LINES);

export const run: Execute = (file, args, options = {}) =>
  new Promise<Result>((done) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...options.env,
      BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0',
      DO_NOT_TRACK: '1',
    };
    if (env.PATH) env.PATH = cleanPath(env.PATH, delimiter);
    execFile(
      file,
      args,
      { maxBuffer: 64 * 1024 * 1024, ...options, env, shell: false, encoding: 'utf8' },
      (error, stdout, stderr) => {
        const isExit = typeof error?.code === 'number';
        done({
          code: error ? (isExit ? (error.code as number) : 1) : 0,
          stdout,
          stderr: stderr || (error?.code === 'ENOENT' ? `spawn ${file} ENOENT` : error && !isExit ? error.message : ''),
        });
      },
    );
  });

export const runData = async (
  main: string,
  data: Command,
  exec: Execute = run,
): Promise<{ output: string; error: null } | { output: null; error: string }> => {
  const { code, stdout, stderr } = await exec(data[0], data.slice(1), { cwd: main, timeout: STALE_MS });
  if (code === 0) return { output: stdout, error: null };
  return { output: null, error: firstLine(stderr) || firstLine(stdout) || `the data command exited ${code}` };
};

export const createBoard = ({
  main,
  config,
  exec = run,
  now = Date.now,
}: {
  main: string;
  config: Config;
  exec?: Execute;
  now?: () => number;
}) => {
  const can = { run: Boolean(config.run), resume: Boolean(config.resume) };
  let board: Document | null = null;
  let readAt: string | null = null;
  let error: string | null = null;
  let askedAt = -Infinity;
  let pending: Promise<void> | null = null;
  let presses: Record<string, number> = {};
  let shown = new Set<string>();
  let health: Board['herdr'] = { ok: null, error: null };
  let firstSeen = new Map<string, number>();
  let screens = new Map<string, string[]>();
  const diffs = new Map<string, { at: number; value: Diff | null }>();

  const readData = async () => {
    const data = await runData(main, config.data as Command, exec);
    if (data.error !== null) {
      error = data.error;
      return;
    }
    const { doc, failures, isOtherContract } = readDocument(data.output);
    error = failures[0] ?? null;
    if (doc) {
      board = doc;
      readAt = new Date(now()).toISOString();
    } else if (isOtherContract) {
      board = null;
      readAt = null;
    }
  };

  const refresh = () => {
    if (!config.data) return null;
    askedAt = now();
    pending ??= readData().finally(() => {
      pending = null;
    });
    return pending;
  };

  const isInside = (path: unknown): path is string =>
    typeof path === 'string' &&
    (resolve(path) === main || resolve(path).startsWith(`${main}${sep}.claude${sep}worktrees${sep}`));

  const herdr = async (...args: string[]): Promise<HerdrResult | undefined> => {
    const { code, stdout, stderr } = await exec('herdr', args, { timeout: 15_000 });
    let answer: { result?: HerdrResult; error?: { message?: unknown } } | null = null;
    try {
      answer = JSON.parse(code === 0 ? stdout : stderr);
    } catch {}
    if (answer?.error) throw new Refusal(502, firstLine(String(answer.error.message ?? JSON.stringify(answer.error))));
    if (code !== 0) throw new Refusal(502, firstLine(stderr) || firstLine(stdout) || `herdr exited ${code}`);
    return answer?.result;
  };

  const readSessions = async () => {
    const snapshot = (await herdr('api', 'snapshot'))?.snapshot;
    if (!Array.isArray(snapshot?.agents) || !Array.isArray(snapshot.tabs))
      throw new Refusal(502, 'herdr gave no snapshot');
    return sessionsOf(snapshot, isInside, stepsOf(board?.flow));
  };

  const watchSessions = async () => {
    try {
      const sessions = await readSessions();
      health = { ok: true, error: null };
      const seen = new Map<string, number>();
      for (const session of sessions) {
        const key = `${session.sessionId}|${session.status === 'done' ? 'idle' : session.status}`;
        seen.set(key, firstSeen.get(key) ?? now());
        session.since = new Date(seen.get(key) as number).toISOString();
      }
      firstSeen = seen;
      return sessions;
    } catch (cause) {
      health = { ok: false, error: firstLine((cause as Error).message) };
      return [];
    }
  };

  const readScreens = async (sessions: Session[]) => {
    const read = await Promise.all(
      sessions
        .filter((session) => isPane(session.paneId))
        .map(async (session) => {
          const { code, stdout } = await exec(
            'herdr',
            ['agent', 'read', session.paneId as string, '--source', 'visible'],
            {
              timeout: 15_000,
            },
          );
          return [session.sessionId, code === 0 ? screenOf(stdout) : (screens.get(session.sessionId) ?? [])] as const;
        }),
    );
    screens = new Map(read);
  };

  const laneOf = async (number: number) => {
    const dir = join(main, '.claude', 'worktrees');
    const name = (await readdir(dir).catch(() => [])).find((entry) => entry.startsWith(`${number}-`));
    return name ? join(dir, name) : null;
  };

  const diffOf = async (cwd: string) => {
    const known = diffs.get(cwd);
    if (known && now() - known.at < DIFF_MS) return known.value;
    const { code, stdout } = await exec(
      'git',
      ['--no-optional-locks', '-C', resolve(cwd), 'diff', '--shortstat', '--merge-base', 'origin/HEAD'],
      { timeout: 10_000 },
    );
    const files = count(stdout, 'files? changed');
    const value =
      code === 0 && files > 0
        ? { files, added: count(stdout, 'insertions?'), removed: count(stdout, 'deletions?') }
        : null;
    diffs.set(cwd, { at: now(), value });
    return value;
  };

  const placement = async ({ isLocal = false } = {}): Promise<Board> => {
    const sessions = await watchSessions();
    if (!isLocal) await readScreens(sessions);
    for (const session of sessions) session.screen = screens.get(session.sessionId);
    presses = activePresses(presses, sessions, board, now());
    const placed = place({ sessions, board, presses, can });
    const cards = Object.values(placed.columns).flat();
    const ids = new Set(cards.flatMap((card) => (card.sessionId ? [card.sessionId] : [])));
    const hasEnded = [...shown].some((id) => !ids.has(id));
    shown = ids;
    if (hasEnded && !isLocal) void refresh();
    await Promise.all(
      cards
        .filter((card) => card.sessionId)
        .map(async (card) => {
          const folder = (card.number !== null && (await laneOf(card.number))) || card.cwd;
          if (!isInside(folder)) return;
          card.diff = await diffOf(folder);
          card.cwd = relative(main, resolve(folder)) || '.';
        }),
    );
    return {
      ...placed,
      flow: board?.flow ?? null,
      tracker: board?.tracker ?? null,
      runner: board?.runner ?? null,
      agents: board?.agents ?? null,
      defaultAgent: board?.defaultAgent ?? null,
      can,
      herdr: health,
      source: { isSet: Boolean(config.data), readAt, error },
      repo: basename(main),
    };
  };

  const openTab = async ({
    cwd,
    label,
    command,
    isQuiet,
  }: {
    cwd: string;
    label: string;
    command?: string;
    isQuiet?: boolean;
  }) => {
    const name = basename(main);
    const focus = isQuiet ? ['--no-focus'] : [];
    const workspaces = (await herdr('workspace', 'list'))?.workspaces;
    if (!Array.isArray(workspaces)) throw new Refusal(502, 'herdr gave no list of workspaces');
    const workspace = workspaces.find((w) => w.label === name);
    if (workspace && !isPane(workspace.workspace_id)) throw new Refusal(502, 'herdr gave no id for the workspace');
    const made = workspace
      ? await herdr(
          'tab',
          'create',
          '--workspace',
          workspace.workspace_id as string,
          '--cwd',
          cwd,
          '--label',
          label,
          ...focus,
        )
      : await herdr('workspace', 'create', '--cwd', cwd, '--label', name, ...focus);
    if (!isPane(made?.root_pane?.pane_id)) throw new Refusal(502, 'herdr gave no pane for the new tab');
    if (!workspace && made.tab?.tab_id) {
      if (!isPane(made.tab.tab_id)) throw new Refusal(502, 'herdr gave no id for the new tab');
      await herdr('tab', 'rename', made.tab.tab_id, label);
    }
    if (command) await herdr('pane', 'run', made.root_pane.pane_id, command);
  };

  const issueCardOf = async (number: number) =>
    Object.values((await placement()).columns)
      .flat()
      .find((c) => c.sessionId === null && c.number === number);

  const press = async (number: number, isAllowed: boolean | undefined, refusal: string, start: () => Promise<void>) => {
    if (!isAllowed || number in presses) throw new Refusal(409, refusal);
    presses[number] = now();
    try {
      await start();
    } catch (cause) {
      delete presses[number];
      throw cause;
    }
    await refresh();
  };

  const runStep = async (number: number, agent?: unknown) => {
    const card = await issueCardOf(number);
    const needsAgent = config.run?.includes(AGENT) ?? false;
    let effective: string | null = null;
    if (agent !== undefined && agent !== null) {
      if (!needsAgent) throw new Refusal(409, `#${number} has no agent "${String(agent)}"`);
      if (typeof agent !== 'string' || !/^[a-z]+$/.test(agent))
        throw new Refusal(409, `#${number} has no agent "${String(agent)}"`);
      const members = board?.agents;
      if (!board || !members || !Object.hasOwn(members, agent))
        throw new Refusal(409, `#${number} has no agent "${agent}"`);
      if (!(members[agent] as { available: boolean; cause: string | null }).available)
        throw new Refusal(409, cleanCause((members[agent] as { available: boolean; cause: string | null }).cause));
      effective = agent;
    } else if (needsAgent) {
      const def = board?.defaultAgent ?? null;
      if (def === null) throw new Refusal(409, `#${number} has no agent to run with`);
      const members = board?.agents;
      if (!board || !members || !Object.hasOwn(members, def))
        throw new Refusal(409, `#${number} has no agent to run with`);
      if (!(members[def] as { available: boolean; cause: string | null }).available)
        throw new Refusal(409, cleanCause((members[def] as { available: boolean; cause: string | null }).cause));
      effective = def;
    } else {
      const def = board?.defaultAgent ?? null;
      if (def !== null && board?.agents?.[def]?.available === false)
        throw new Refusal(409, cleanCause(board.agents[def].cause));
      effective = def;
    }
    await press(number, card?.run, `#${number} has no step to start now`, () =>
      openTab({
        cwd: main,
        label: `#${number} ${(card as Card).step}`,
        command: lineOf(config.run as Command, number, effective),
        isQuiet: true,
      }),
    );
  };

  const resume = async (number: number) => {
    const card = await issueCardOf(number);
    await press(number, card?.resume, `#${number} has no session to resume now`, () =>
      openTab({
        cwd: main,
        label: `#${number} ${(card as Card).step}`,
        command: lineOf(config.resume as Command, number),
      }),
    );
  };

  const shell = async (number: number) => {
    const card = await issueCardOf(number);
    if (card?.state !== 'dirty-tree' || !isInside(card.act) || resolve(card.act) === main)
      throw new Refusal(409, `#${number} has no dirty worktree`);
    await openTab({ cwd: resolve(card.act), label: `#${number} shell` });
  };

  const go = async (sessionId: string) => {
    const session = (await readSessions()).find((s) => s.sessionId === sessionId);
    if (!session) throw new Refusal(404, 'no herdr agent of this repository has that id');
    if (!isPane(session.paneId)) throw new Refusal(409, 'that agent has no herdr pane id');
    await herdr('agent', 'focus', session.paneId);
  };

  const readBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
    let text = '';
    for await (const chunk of request) {
      text += chunk;
      if (text.length > 1024) throw new Refusal(400, 'the body is too long');
    }
    try {
      return JSON.parse(text) ?? {};
    } catch {
      throw new Refusal(400, 'the body is not JSON');
    }
  };

  const send = (response: ServerResponse, status: number, type: string, content: string | Buffer) => {
    response.writeHead(status, {
      'Content-Type': type,
      'Content-Security-Policy': CSP,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(content);
  };
  const sendJson = (response: ServerResponse, status: number, value: unknown) =>
    send(response, status, 'application/json; charset=utf-8', JSON.stringify(value));

  const answer = async (request: IncomingMessage, response: ServerResponse) => {
    const host = request.headers.host;
    const { port } = server.address() as AddressInfo;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)
      throw new Refusal(403, 'the Host is not this server');
    const url = request.url ?? '/';
    const path = url.split('?')[0] as string;
    if (request.method === 'GET' && Object.hasOwn(FILES, path)) {
      const [name, type] = FILES[path] as [string, string];
      return send(response, 200, type, await readFile(join(HERE, name)));
    }
    if (request.method === 'GET' && path === '/api/board') {
      const isLocal = new URLSearchParams(url.split('?')[1] ?? '').get('local') === '1';
      if (!pending && !isLocal && now() - askedAt > STALE_MS) void refresh();
      if (!board && !error && pending) await pending;
      return sendJson(response, 200, await placement({ isLocal }));
    }
    if (request.method !== 'POST' || !POSTS.has(path)) throw new Refusal(404, 'no such path');
    if (request.headers.origin !== `http://${host}`) throw new Refusal(403, 'the Origin is not this page');
    if (!/^application\/json\s*(;|$)/.test(request.headers['content-type'] ?? ''))
      throw new Refusal(403, 'the content type is not application/json');
    const input = await readBody(request);
    const starts: Record<string, (number: number) => Promise<void>> = {
      '/api/run': runStep,
      '/api/resume': resume,
      '/api/shell': shell,
    };
    if (Object.hasOwn(starts, path)) {
      const { number } = input;
      if (!['number', 'string'].includes(typeof number) || !/^[1-9][0-9]*$/.test(String(number)))
        throw new Refusal(400, 'the number of the issue is not digits');
      if (path === '/api/run') await runStep(Number(number), input.agent);
      else await (starts[path] as (number: number) => Promise<void>)(Number(number));
    } else if (path === '/api/go') {
      await go(String(input.sessionId));
    } else if (path === '/api/agent') {
      throw new Refusal(409, 'The producer controls the default agent. Change it in the producer configuration.');
    } else {
      await refresh();
    }
    sendJson(response, 200, { ok: true });
  };

  const server = createServer((request, response) => {
    request.setEncoding('utf8');
    answer(request, response).catch((cause) => {
      sendJson(response, cause instanceof Refusal ? cause.status : 500, {
        error: firstLine(String(cause.message)) || 'the server failed',
      });
    });
  });
  return server;
};
