import type { ExecFileOptions } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Host } from '../lib/config.ts';
import type { Adapter } from './adapter.ts';
import type { Board, Card, Diff, Document, Session } from './types.ts';

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
import { basename, join, relative, resolve, sep } from 'node:path';
import { childEnv } from '../lib/process.ts';
import { readStepEnd } from '../lib/step-end.ts';
import { launchMatches, place, sessionsOf, stepsOf } from './place.ts';

const HERE = import.meta.dirname;
const STALE_MS = 60_000;
const PRESS_MS = 30_000;
const BACKGROUND_MS = 300_000;
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
    execFile(
      file,
      args,
      {
        maxBuffer: 64 * 1024 * 1024,
        ...options,
        env: childEnv({ ...process.env, ...options.env }),
        shell: false,
        encoding: 'utf8',
      },
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

export const createBoard = ({
  main,
  read,
  adapter,
  exec = run,
  now = Date.now,
}: {
  main: string;
  read: (signal: AbortSignal) => Promise<Document>;
  adapter: Adapter;
  exec?: Execute;
  now?: () => number;
}) => {
  let board: Document | null = null;
  let readAt: string | null = null;
  let error: string | null = null;
  let askedAt = -Infinity;
  let checkedFrom = -Infinity;
  let pending: Promise<void> | null = null;
  const presses: Record<string, { step: string | null; at: number }> = {};
  const operations: Record<string, { step: string | null; observed: boolean }> = {};
  let shown = new Set<string>();
  let health: Board['herdr'] = { ok: null, error: null };
  let firstSeen = new Map<string, number>();
  let screens = new Map<string, string[]>();
  const diffs = new Map<string, { at: number; value: Diff | null }>();

  const readData = async () => {
    const from = now();
    const limit = new AbortController();
    const timer = setTimeout(() => limit.abort(), STALE_MS);
    // Some steps of the read (the lock reads, locateCheckouts) do not take the signal.
    const ended = new Promise<never>((_, reject) => limit.signal.addEventListener('abort', reject, { once: true }));
    try {
      board = await Promise.race([read(limit.signal), ended]);
      readAt = new Date(now()).toISOString();
      error = null;
    } catch (cause) {
      error = limit.signal.aborted
        ? 'the issue read did not end in 60 seconds'
        : firstLine(cause instanceof Error ? cause.message : String(cause)) || 'the issue read failed';
    } finally {
      clearTimeout(timer);
      checkedFrom = from;
    }
  };

  const refresh = () => {
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
    const dispositions = new Map(
      await Promise.all(
        [...new Set(sessions.flatMap((session) => (session.issue === null ? [] : [session.issue])))].map(
          async (issue) => [issue, await readStepEnd(main, issue)] as const,
        ),
      ),
    );
    for (const session of sessions) {
      const record = dispositions.get(session.issue as number);
      if (
        !record ||
        record.pane !== session.paneId ||
        record.host !== session.agent ||
        session.agentSessionId === null ||
        session.stateChangeSeq === null
      )
        continue;
      const turn = record.turn;
      session.stepEnd =
        turn?.terminalId === session.sessionId &&
        turn.sessionId === session.agentSessionId &&
        turn.sequence === session.stateChangeSeq
          ? record.state
          : 'checking';
    }
    if (!isLocal) await readScreens(sessions);
    for (const session of sessions) session.screen = screens.get(session.sessionId);
    const busy = new Set(sessions.map((session) => session.issue));
    const launches: Parameters<typeof place>[0]['launches'] = {};
    for (const [number, evidence] of Object.entries({ ...presses, ...operations })) {
      const issue = board?.issues.find((issue) => issue.number === Number(number));
      if (busy.has(Number(number)) || !launchMatches(issue, evidence.step)) {
        delete presses[number];
        if (operations[number]) operations[number].observed = true;
      }
      const operation = operations[number];
      const press = presses[number];
      if (operation ? !operation.observed : press) {
        launches[number] = {
          step: evidence.step,
          expired: !operation && checkedFrom >= (press as { at: number }).at + PRESS_MS,
        };
      }
    }
    const placed = place({ sessions, board, launches });
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
      history: board?.history ?? null,
      flow: board?.flow ?? null,
      tracker: board?.tracker ?? null,
      runner: board?.runner ?? null,
      agents: board?.agents ?? null,
      defaultAgent: board?.defaultAgent ?? null,
      herdr: health,
      source: { readAt, error },
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

  const press = async (
    number: number,
    card: Card | undefined,
    isAllowed: boolean | undefined,
    refusal: string,
    start: () => Promise<void>,
  ) => {
    if (!isAllowed || number in operations || (presses[number] && now() - presses[number].at < PRESS_MS))
      throw new Refusal(409, refusal);
    const operation = { step: (card as Card).step, observed: false };
    operations[number] = operation;
    delete presses[number];
    try {
      await start();
      if (!operation.observed) presses[number] = { step: operation.step, at: now() };
    } finally {
      delete operations[number];
    }
    await refresh();
  };

  const runStep = async (number: number, choice?: unknown) => {
    const isChoice = choice !== undefined && choice !== null;
    const agent = isChoice ? choice : (board?.defaultAgent ?? null);
    const members = board?.agents;
    if (typeof agent !== 'string' || !/^[a-z]+$/.test(agent) || !members || !Object.hasOwn(members, agent))
      throw new Refusal(
        409,
        isChoice ? `#${number} has no agent "${String(choice)}"` : `#${number} has no agent to run with`,
      );
    const member = members[agent] as { available: boolean; cause: string | null };
    if (!member.available) throw new Refusal(409, cleanCause(member.cause));
    const card = await issueCardOf(number);
    await press(number, card, card?.run, `#${number} has no step to start now`, async () => {
      const command = await adapter.run(number, agent as Host).catch((cause: Error) => {
        throw new Refusal(409, cleanCause(cause.message));
      });
      await openTab({
        cwd: main,
        label: `#${number} ${(card as Card).step}`,
        command,
        isQuiet: true,
      });
    });
  };

  const resume = async (number: number) => {
    const card = await issueCardOf(number);
    await press(number, card, card?.resume, `#${number} has no session to resume now`, async () => {
      const command = await adapter.resume(number).catch((cause: Error) => {
        throw new Refusal(409, cleanCause(cause.message));
      });
      await openTab({
        cwd: main,
        label: `#${number} ${(card as Card).step}`,
        command,
      });
    });
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
      const isDue = (press: { at: number }) => now() - press.at >= PRESS_MS && checkedFrom < press.at + PRESS_MS;
      if (!isLocal && Object.values(presses).some(isDue)) await refresh();
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
      throw new Refusal(409, 'The main .celetis.yaml controls the default agent. Change host there.');
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
  let nextCheck: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    if (now() - askedAt >= BACKGROUND_MS) void refresh();
    nextCheck = setTimeout(check, askedAt + BACKGROUND_MS - now());
  };
  server.on('listening', check);
  server.on('close', () => clearTimeout(nextCheck));
  return server;
};
