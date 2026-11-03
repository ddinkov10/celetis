import type { ExecFileOptions } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Host } from '../lib/config-core.ts';
import type { OpenTab } from '../lib/terminal.ts';
import type { Terminal } from '../lib/terminal-types.ts';
import type { Adapter } from './adapter.ts';
import type {
  Board,
  BoardHistory,
  BoardRuntime,
  Card,
  Diff,
  Document,
  LandedIssue,
  Session,
  VisualState,
} from './types.ts';
import type { UpdateController } from './updates.ts';

type Result = { code: number; stdout: string; stderr: string };
export type Execute = (file: string, args: string[], options?: ExecFileOptions) => Promise<Result>;

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, join, relative, resolve, sep } from 'node:path';
import { isLevel, type Level, levels } from '../lib/effort.ts';
import { commonDir } from '../lib/host.ts';
import { createOperation, locateCheckouts } from '../lib/operation.ts';
import { childEnv } from '../lib/process.ts';
import { parseQueueAction, queueView as projectQueue, queueOwner, readQueue, readQueueView } from '../lib/queue.ts';
import { failQueueLaunch } from '../lib/queue-actions.ts';
import type { QueueAction, QueueView, QueueWake } from '../lib/queue-types.ts';
import { readStepEnd } from '../lib/step-end.ts';
import {
  focusTerminal,
  LINK,
  listTerminals,
  openTab as openTerminalTab,
  readScreen,
  requireTerminals,
  startHidden,
  TerminalError,
} from '../lib/terminal.ts';
import { hasPage, isCommit, visualLink, visualPage } from '../lib/visual.ts';
import { launchMatches, place, sessionsOf, stepsOf } from './place.ts';

const HERE = import.meta.dirname;
const STALE_MS = 60_000;
const PRESS_MS = 30_000;
const BACKGROUND_MS = 300_000;
const DIFF_MS = 15_000;
const SCREEN_LINES = 16;
const RULE = /^[\s─━═╌┄-]*$/;
const FILES: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/board.css': ['board.css', 'text/css; charset=utf-8'],
  '/board.js': ['board.js', 'text/javascript; charset=utf-8'],
  '/view.mjs': ['view.mjs', 'text/javascript; charset=utf-8'],
  '/ui.mjs': ['ui.mjs', 'text/javascript; charset=utf-8'],
  '/panel.mjs': ['panel.mjs', 'text/javascript; charset=utf-8'],
  '/palette.mjs': ['palette.mjs', 'text/javascript; charset=utf-8'],
  '/queue.mjs': ['queue.mjs', 'text/javascript; charset=utf-8'],
  '/update-dialog.mjs': ['update-dialog.mjs', 'text/javascript; charset=utf-8'],
  '/fonts/geist.woff2': ['fonts/geist.woff2', 'font/woff2'],
  '/fonts/geist-mono.woff2': ['fonts/geist-mono.woff2', 'font/woff2'],
};
const POSTS = new Set([
  '/api/intake',
  '/api/assist',
  '/api/visual',
  '/api/run',
  '/api/resume',
  '/api/queue',
  '/api/shell',
  '/api/go',
  '/api/refresh',
  '/api/agent',
  '/api/update/check',
  '/api/update/start',
]);
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src data:; " +
  "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const VISUAL_CSP = 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox';

class Refusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const refused = (cause: unknown): never => {
  throw cause instanceof TerminalError ? new Refusal(502, cause.message) : cause;
};
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
  readTargets,
  hints,
  adapter,
  updates,
  runtime,
  exec = run,
  now = Date.now,
}: {
  main: string;
  read: (signal: AbortSignal) => Promise<Document>;
  readTargets: (numbers: readonly number[], previous: Document, signal: AbortSignal) => Promise<Document>;
  hints: () => Promise<ReadonlyMap<string, number> | null>;
  adapter: Adapter;
  updates: () => UpdateController;
  runtime: BoardRuntime;
  exec?: Execute;
  now?: () => number;
}) => {
  let board: Document | null = null;
  let readAt: string | null = null;
  let fullError: string | null = null;
  let targetError: string | null = null;
  const readError = () => targetError ?? fullError;
  let askedAt = -Infinity;
  let checkedFrom = -Infinity;
  let pending: Promise<void> | null = null;
  const targets = new Set<number>();
  let fullRequest: { promise: Promise<void>; done: () => void } | null = null;
  let fullQueued = false;
  let ready = false;
  let stopped = false;
  let activeRead: AbortController | null = null;
  let nextCheck: ReturnType<typeof setTimeout> | undefined;
  let nextHint: ReturnType<typeof setTimeout> | undefined;
  let seenHints = new Set<string>();
  let queuePress = false;
  let intakePending = false;
  const visualPresses = new Set<number>();
  const presses: Record<string, { step: string | null; at: number }> = {};
  const operations: Record<string, { step: string | null | undefined; observed: boolean }> = {};
  let shown = new Map<string, number | null>();
  let firstSeen = new Map<string, number>();
  let screens = new Map<string, string[]>();
  const diffs = new Map<string, { at: number; value: Diff | null }>();

  const readData = async (full: boolean, numbers: number[]) => {
    const from = now();
    const limit = new AbortController();
    activeRead = limit;
    const timer = setTimeout(() => limit.abort(), STALE_MS);
    // Some steps of the read (the lock reads, locateCheckouts) do not take the signal.
    const ended = new Promise<never>((_, reject) => limit.signal.addEventListener('abort', reject, { once: true }));
    try {
      const next = await Promise.race([
        full ? read(limit.signal) : readTargets(numbers, board as Document, limit.signal),
        ended,
      ]);
      if (stopped) return;
      if (
        board?.queue?.record &&
        next.queue?.record?.id === board.queue.record.id &&
        next.queue.record.revision < board.queue.record.revision
      )
        next.queue = board.queue;
      board = next;
      if (next.queueWake) dispatchWake(next.queueWake);
      next.queueWake = null;
      targetError = null;
      if (full) {
        readAt = new Date(now()).toISOString();
        fullError = null;
      }
    } catch (cause) {
      if (stopped) return;
      const error = limit.signal.aborted
        ? 'the issue read did not end in 60 seconds'
        : firstLine(cause instanceof Error ? cause.message : String(cause)) || 'the issue read failed';
      if (full) {
        fullError = error;
        for (const number of numbers) targets.add(number);
      } else targetError = error;
    } finally {
      clearTimeout(timer);
      activeRead = null;
      if (full) checkedFrom = from;
    }
  };

  const drain = () => {
    if (stopped || !ready || pending || (!fullQueued && (!board || targets.size === 0))) return;
    const full = fullQueued;
    if (full) {
      fullQueued = false;
      askedAt = now();
      clearTimeout(nextCheck);
      nextCheck = setTimeout(check, BACKGROUND_MS);
    }
    const numbers = [...targets].sort((a, b) => a - b);
    targets.clear();
    pending = readData(full, numbers).finally(() => {
      pending = null;
      if (full) {
        fullRequest?.done();
        fullRequest = null;
      }
      drain();
    });
  };

  const refresh = () => {
    if (stopped) return Promise.resolve();
    if (!fullRequest) {
      let done = () => {};
      const promise = new Promise<void>((resolve) => {
        done = resolve;
      });
      fullRequest = { promise, done };
      fullQueued = true;
    }
    const request = fullRequest.promise;
    drain();
    return request;
  };

  const target = (numbers: Iterable<number>) => {
    if (stopped) return;
    const received = [...numbers];
    if (!received.length) return;
    for (const number of received) targets.add(number);
    if (!board) void refresh();
    else drain();
  };

  const queueView = async (): Promise<QueueView | null> => {
    const projected = board?.queue;
    try {
      const { common } = await locateCheckouts(main);
      if (common === null) throw new Error('queue: need a Git checkout');
      const record = await readQueue(common);
      const owner = await queueOwner(main, record);
      const matches = record?.id === projected?.record?.id && record?.revision === projected?.record?.revision;
      if (board && (!matches || owner !== projected?.owner)) void refresh();
      const next = matches ? (projected?.next ?? null) : null;
      const actions = projectQueue(record, owner, next).actions;
      if (!matches || fullError || (projected?.next?.kind === 'observed' && projected.next.reason === 'unreadable')) {
        actions.continue = false;
        actions.retry = false;
        if (fullError) {
          actions.add = false;
          actions.edit = false;
        }
      }
      return { record, owner, next, error: matches ? (projected?.error ?? null) : null, actions };
    } catch (cause) {
      return projected
        ? {
            ...projected,
            next: null,
            error: firstLine(cause instanceof Error ? cause.message : String(cause)),
            actions: { add: false, edit: false, continue: false, retry: false },
          }
        : null;
    }
  };

  const isInside = (path: unknown): path is string =>
    typeof path === 'string' &&
    (resolve(path) === main || resolve(path).startsWith(`${main}${sep}.claude${sep}worktrees${sep}`));

  const sessionsIn = (terminals: Terminal[]) => sessionsOf(terminals, isInside, stepsOf(board?.flow));
  const readSessions = async () => sessionsIn(await listTerminals(exec).catch(refused));

  const watchSessions = async () => {
    try {
      const terminals = await listTerminals(exec);
      const sessions = sessionsIn(terminals);
      const seen = new Map<string, number>();
      for (const session of sessions) {
        const status = session.status === 'done' || session.status === 'error' ? 'idle' : session.status;
        const key = `${session.sessionId}|${status}`;
        seen.set(key, firstSeen.get(key) ?? now());
        session.since = new Date(seen.get(key) as number).toISOString();
      }
      firstSeen = seen;
      return { terminals, sessions, health: { ok: true, error: null } };
    } catch (cause) {
      return { terminals: [], sessions: [], health: { ok: false, error: firstLine((cause as Error).message) } };
    }
  };

  const visualOf = async (row: LandedIssue, terminals: Terminal[], isPressed: boolean): Promise<VisualState> => {
    if (await hasPage(main, row.sha)) return 'ready';
    if (isPressed) return 'starting';
    const link = visualLink(row.number);
    if (terminals.some((terminal) => terminal.labels[LINK] === link && isInside(terminal.cwd))) return 'making';
    return 'none';
  };

  const historyOf = async (terminals: Terminal[]): Promise<BoardHistory | null> => {
    const history = board?.history;
    if (!history) return null;
    const entries = await Promise.all(
      history.entries.map(async (row) => ({
        ...row,
        visual: await visualOf(row, terminals, visualPresses.has(row.number)),
      })),
    );
    return { ...history, entries };
  };

  const readScreens = async (sessions: Session[]) => {
    const read = await Promise.all(
      sessions.map(async (session) => {
        const text = await readScreen(session.sessionId, 0, exec);
        return [session.sessionId, text === null ? (screens.get(session.sessionId) ?? []) : screenOf(text)] as const;
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
    const queue = await queueView();
    const { terminals, sessions: found, health } = await watchSessions();
    const dispositions = new Map(
      await Promise.all(
        [...new Set(found.flatMap((session) => (session.issue === null ? [] : [session.issue])))].map(
          async (issue) => [issue, await readStepEnd(main, issue)] as const,
        ),
      ),
    );
    const sessions: Session[] = [];
    for (const session of found) {
      const record = dispositions.get(session.issue as number);
      if (record?.terminal === session.sessionId) {
        session.stepEnd =
          record.turn?.terminalId === session.sessionId && record.turn.sequence === session.turn
            ? record.state
            : 'checking';
      }
      sessions.push(session);
    }
    if (!isLocal) await readScreens(sessions);
    for (const session of sessions) session.screen = screens.get(session.sessionId);
    const busy = new Set(sessions.map((session) => session.issue));
    const launches: Parameters<typeof place>[0]['launches'] = {};
    for (const number of new Set([...Object.keys(presses), ...Object.keys(operations)])) {
      const operation = operations[number];
      const active = operation?.step !== undefined;
      const evidence = active ? operation : presses[number];
      if (!evidence || evidence.step === undefined) continue;
      const issue = board?.issues.find((issue) => issue.number === Number(number));
      if (busy.has(Number(number)) || !launchMatches(issue, evidence.step)) {
        delete presses[number];
        if (active) operation.observed = true;
      }
      const press = presses[number];
      if (active ? !operation.observed : press) {
        launches[number] = {
          step: evidence.step,
          expired: !active && checkedFrom >= (press as { at: number }).at + PRESS_MS,
        };
      }
    }
    const placed = place({ sessions, board, launches });
    const cards = Object.values(placed.columns).flat();
    const ids = new Map(cards.flatMap((card) => (card.sessionId ? [[card.sessionId, card.number] as const] : [])));
    const ended = [...shown].filter(([id]) => !ids.has(id)).map(([, number]) => number);
    shown = ids;
    target(ended.filter((number) => number !== null));
    if (ended.includes(null) && !isLocal) void refresh();
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
    const history = await historyOf(terminals);
    return {
      ...placed,
      history,
      flow: board?.flow ?? null,
      tracker: board?.tracker ?? null,
      runner: board?.runner ?? null,
      agents: board?.agents ?? null,
      defaultAgent: board?.defaultAgent ?? null,
      queue,
      terminal: health,
      source: { readAt, error: readError() },
      repo: basename(main),
    };
  };

  const openTab = async (request: Omit<OpenTab, 'repository' | 'keepShell'>) =>
    openTerminalTab({ repository: { main, common: await commonDir(main) }, keepShell: false, ...request }, exec).catch(
      refused,
    );

  const startRunner = async (label: string, argv: string[]) => {
    await requireTerminals(exec).catch(refused);
    await startHidden({ folder: main, label, argv }, exec).catch(refused);
  };

  const issueCardOf = async (number: number) =>
    Object.values((await placement()).columns)
      .flat()
      .find((c) => c.sessionId === null && c.number === number);

  const press = async (
    number: number,
    refusal: string,
    prepare: () => Promise<{ card: Card; start: () => Promise<void> }>,
  ) => {
    if (number in operations || (presses[number] && now() - presses[number].at < PRESS_MS))
      throw new Refusal(409, refusal);
    const operation: { step: string | null | undefined; observed: boolean } = { step: undefined, observed: false };
    operations[number] = operation;
    try {
      const { card, start } = await prepare();
      operation.step = card.step;
      delete presses[number];
      await start();
      if (!operation.observed) presses[number] = { step: operation.step, at: now() };
    } finally {
      delete operations[number];
    }
    await refresh();
  };

  const agentOf = (number: number, choice?: unknown): Host => {
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
    return agent as Host;
  };

  const intake = async () => {
    if (intakePending) throw new Refusal(409, 'an intake tab is already opening');
    intakePending = true;
    try {
      const argv = await (async () => {
        const operation = createOperation(
          await locateCheckouts(main),
          { environment: process.env.CELETIS_AGENT },
          'main',
        );
        if (!Bun.which(operation.host, { PATH: childEnv().PATH })) throw new Error(`${operation.host} is not on PATH`);
        return adapter.intake(operation.host);
      })().catch((cause: Error) => {
        throw new Refusal(409, cleanCause(cause.message));
      });
      await openTab({ folder: main, name: 'Intake', argv, focus: true });
    } finally {
      intakePending = false;
    }
  };

  const assist = async (number: number) => {
    const refusal = `#${number} has no blocked issue to assist now`;
    await press(number, refusal, async () => {
      await pending;
      await refresh();
      if (readError()) throw new Refusal(409, cleanCause(readError()));
      let observed: Document | null;
      let current: Board;
      do {
        observed = board;
        current = await placement();
      } while (board !== observed);
      if (readError()) throw new Refusal(409, cleanCause(readError()));
      if (board?.noRun) throw new Refusal(409, cleanCause(board.noRun));
      const agent = agentOf(number);
      if (!current.terminal.ok) throw new Refusal(502, current.terminal.error ?? 'hc gave no terminal list');
      const cards = Object.values(current.columns).flat();
      const card = cards.find((card) => card.sessionId === null && card.number === number);
      if (!card) {
        throw new Refusal(
          409,
          cards.some((card) => card.number === number)
            ? `#${number} already has a session; use Go`
            : `#${number} is not on the board`,
        );
      }
      if (card.state !== 'blocked' || !card.assist || current.noRun !== null)
        throw new Refusal(409, current.noRun ?? `#${number} is ${card.state ?? 'ready'}; ${refusal}`);
      return {
        card,
        start: async () => {
          const argv = await adapter.assist(number, agent).catch((cause: Error) => {
            throw new Refusal(409, cleanCause(cause.message));
          });
          await openTab({ folder: main, name: `#${number} assist`, argv, focus: true });
        },
      };
    });
  };

  const visual = async (number: number) => {
    if (visualPresses.has(number)) throw new Refusal(409, `a Make visual press of #${number} is in flight`);
    visualPresses.add(number);
    try {
      const row = board?.history.entries.find((entry) => entry.number === number);
      if (!row) throw new Refusal(409, `#${number} has no row in History`);
      const state = await visualOf(row, await listTerminals(exec).catch(refused), false);
      if (state === 'ready') throw new Refusal(409, `#${number} already has a visual; use Open visual`);
      if (state === 'making') throw new Refusal(409, `the tab ${visualLink(number)} is still open`);
      const agent = agentOf(number);
      const argv = await adapter.visual(number, row.sha, agent).catch((cause: Error) => {
        throw new Refusal(409, cleanCause(cause.message));
      });
      await openTab({ folder: main, name: visualLink(number), argv, focus: true });
    } finally {
      visualPresses.delete(number);
    }
  };

  const runStep = async (number: number, choice?: unknown, effort?: Level) => {
    const refusal = `#${number} has no step to start now`;
    await press(number, refusal, async () => {
      await pending;
      await refresh();
      if (!board || readError() || board.noRun !== null) throw new Refusal(409, readError() || board?.noRun || refusal);
      const card = await issueCardOf(number);
      if (!card?.run) throw new Refusal(409, refusal);
      const view = await queueView();
      if (readError() || !view || (view.error && !view.next))
        throw new Refusal(409, readError() || view?.error || 'queue: no successful initial read');
      const record = view.record;
      if (record?.state === 'me-gate' && record.numbers[0] === number) {
        if (effort) throw new Refusal(409, 'The queue starts this step at the decided level');
        if (choice !== undefined && choice !== null && choice !== record.host)
          throw new Refusal(409, `queue: recorded host is ${record.host}`);
        if (!view.actions.continue || view.next?.kind !== 'run' || view.next.step !== card.step)
          throw new Refusal(409, 'queue: that action is not available; refresh the queue');
        const action: QueueAction = {
          kind: 'continue',
          expected: { id: record.id, revision: record.revision, current: number },
          step: view.next.step,
        };
        return {
          card,
          start: async () => {
            await queue(action);
          },
        };
      }
      const agent = agentOf(number, choice);
      return {
        card,
        start: async () => {
          const argv = await adapter.run(number, agent, effort).catch((cause: Error) => {
            throw new Refusal(409, cleanCause(cause.message));
          });
          await startRunner(`#${number}`, argv);
        },
      };
    });
  };

  const resume = async (number: number) => {
    const refusal = `#${number} has no session to resume now`;
    await press(number, refusal, async () => {
      const card = await issueCardOf(number);
      if (!card?.resume) throw new Refusal(409, refusal);
      return {
        card,
        start: async () => {
          const argv = await adapter.resume(number).catch((cause: Error) => {
            throw new Refusal(409, cleanCause(cause.message));
          });
          await startRunner(`#${number}`, argv);
        },
      };
    });
  };

  const dispatchWake = (wake: QueueWake) => {
    let sent = false;
    void (async () => {
      const argv = await adapter.queueRun(wake);
      await requireTerminals(exec);
      sent = true;
      await startHidden({ folder: main, label: 'queue', argv }, exec);
    })().catch(async (cause) => {
      try {
        const operation = createOperation(await locateCheckouts(main), { saved: wake.host }, 'main');
        if (!sent) {
          const view = await failQueueLaunch(operation, wake.id, wake.token, cleanCause(cause.message));
          if (board) board.queue = view;
        } else {
          await queueView();
        }
      } catch (failure) {
        fullError = `queue: launch recovery failed: ${cleanCause(failure)}`;
      }
    });
  };

  const queue = async (action: QueueAction, choice?: Host): Promise<QueueView> => {
    if (queuePress) throw new Refusal(409, 'queue: another press is active');
    queuePress = true;
    try {
      const { common } = await locateCheckouts(main);
      if (!common) throw new Refusal(409, 'queue: need a Git checkout');
      const record = await readQueue(common);
      const agent = action.kind === 'add' ? choice : record?.host;
      if (agent !== 'claude' && agent !== 'codex') throw new Refusal(409, 'queue: no recorded host');
      const receipt = await adapter.queue(action, agent).catch((cause: Error) => {
        throw new Refusal(409, cleanCause(cause.message));
      });
      if (board) board.queue = receipt.view;
      if (receipt.wake) setTimeout(() => dispatchWake(receipt.wake as QueueWake), 0);
      return receipt.view;
    } finally {
      queuePress = false;
    }
  };

  const shell = async (number: number) => {
    const card = await issueCardOf(number);
    if (card?.state !== 'dirty-tree' || !isInside(card.act) || resolve(card.act) === main)
      throw new Refusal(409, `#${number} has no dirty worktree`);
    await openTab({ folder: resolve(card.act), name: `#${number} shell`, argv: null, focus: true });
  };

  const go = async (sessionId: string) => {
    if (!(await readSessions()).some((session) => session.sessionId === sessionId))
      throw new Refusal(404, 'no herdr agent of this repository has that id');
    await focusTerminal(sessionId, exec).catch(refused);
  };

  const readBody = async (request: IncomingMessage): Promise<unknown> => {
    let text = '';
    for await (const chunk of request) {
      text += chunk;
      if (Buffer.byteLength(text, 'utf8') > 1024) throw new Refusal(400, 'the body is too long (maximum 1024 bytes)');
    }
    try {
      return JSON.parse(text);
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
  const sendVisual = (response: ServerResponse, content: Buffer) => {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': VISUAL_CSP,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(content);
  };

  const answer = async (request: IncomingMessage, response: ServerResponse) => {
    const host = request.headers.host;
    const { port } = server.address() as AddressInfo;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)
      throw new Refusal(403, 'the Host is not this server');
    if (request.headers.origin === 'null') throw new Refusal(403, 'the Origin is opaque');
    const url = request.url ?? '/';
    const path = url.split('?')[0] as string;
    if (request.method === 'GET' && Object.hasOwn(FILES, path)) {
      const [name, type] = FILES[path] as [string, string];
      return send(response, 200, type, await readFile(join(HERE, name)));
    }
    if (request.method === 'GET' && path === '/api/queue') {
      const operation = createOperation(await locateCheckouts(main), {}, 'main');
      return sendJson(response, 200, await readQueueView(operation));
    }
    if (request.method === 'GET' && path === '/api/update')
      return sendJson(response, 200, { runtime, update: updates().snapshot() });
    if (request.method === 'GET' && path === '/api/board') {
      const isLocal = new URLSearchParams(url.split('?')[1] ?? '').get('local') === '1';
      if (!isLocal && now() - askedAt > BACKGROUND_MS) void refresh();
      if (!board && !readError() && pending) await pending;
      const isDue = (press: { at: number }) => now() - press.at >= PRESS_MS && checkedFrom < press.at + PRESS_MS;
      if (!isLocal && Object.values(presses).some(isDue)) await refresh();
      return sendJson(response, 200, await placement({ isLocal }));
    }
    if (request.method === 'GET' && path.startsWith('/visual/')) {
      const sha = path.slice('/visual/'.length);
      if (isCommit(sha) && (await hasPage(main, sha)))
        return sendVisual(response, await readFile(visualPage(main, sha)));
    }
    if (request.method !== 'POST' || !POSTS.has(path)) throw new Refusal(404, 'no such path');
    if (request.headers.origin !== `http://${host}`) throw new Refusal(403, 'the Origin is not this page');
    if (!/^application\/json\s*(;|$)/.test(request.headers['content-type'] ?? ''))
      throw new Refusal(403, 'the content type is not application/json');
    const body = await readBody(request);
    if (
      (path.startsWith('/api/update/') || path === '/api/assist' || path === '/api/visual' || path === '/api/intake') &&
      (body === null || typeof body !== 'object' || Array.isArray(body))
    )
      throw new Refusal(400, 'the body is not an object');
    const input = (body ?? {}) as Record<string, unknown>;
    if (path === '/api/intake') {
      if (Object.keys(input).length) throw new Refusal(400, 'intake takes an empty object');
      await intake();
      return sendJson(response, 200, { ok: true });
    }
    if (path === '/api/assist' && (Object.keys(input).length !== 1 || !Object.hasOwn(input, 'number')))
      throw new Refusal(400, 'assistance takes only the issue number');
    if (path === '/api/visual' && (Object.keys(input).length !== 1 || !Object.hasOwn(input, 'number')))
      throw new Refusal(400, 'making a visual takes only the issue number');
    if (path === '/api/update/check') {
      if (Object.keys(input).length) throw new Refusal(400, 'the update check takes an empty object');
      void updates().check();
      return sendJson(response, 200, { runtime, update: updates().snapshot() });
    }
    if (path === '/api/update/start') {
      if (Object.keys(input).length !== 1 || typeof input.offerId !== 'string' || !input.offerId)
        throw new Refusal(400, 'the update start takes one offerId string');
      const finished = new Promise<void>((done) => {
        response.once('finish', done);
        response.once('close', done);
      });
      try {
        updates().start(input.offerId);
      } catch (cause) {
        if ((cause as { status?: number }).status === 409) throw new Refusal(409, (cause as Error).message);
        throw cause;
      }
      updateResponse = finished;
      return sendJson(response, 202, { runtime, update: updates().snapshot() });
    }
    const starts: Record<string, (number: number) => Promise<void>> = {
      '/api/assist': assist,
      '/api/visual': visual,
      '/api/run': runStep,
      '/api/resume': resume,
      '/api/shell': shell,
    };
    if (path === '/api/queue') {
      let action: QueueAction;
      try {
        action = parseQueueAction(input.action);
      } catch {
        throw new Refusal(400, 'queue: invalid action');
      }
      if (
        !input ||
        Array.isArray(input) ||
        Object.keys(input).sort().join(',') !== (action.kind === 'add' ? 'action,agent' : 'action') ||
        (action.kind === 'add' && input.agent !== 'claude' && input.agent !== 'codex')
      )
        throw new Refusal(400, 'queue: invalid request fields or host');
      return sendJson(response, 200, await queue(action, input.agent as Host | undefined));
    } else if (Object.hasOwn(starts, path)) {
      const { number } = input;
      if (
        !['number', 'string'].includes(typeof number) ||
        !/^[1-9][0-9]*$/.test(String(number)) ||
        !Number.isSafeInteger(Number(number))
      )
        throw new Refusal(400, 'the number of the issue is not digits');
      if (path === '/api/run') {
        const { effort } = input;
        if (effort !== undefined && !isLevel(effort))
          throw new Refusal(400, `the effort is not one of ${levels.join(', ')}`);
        await runStep(Number(number), input.agent, effort);
      } else await (starts[path] as (number: number) => Promise<void>)(Number(number));
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
  let updateResponse = Promise.resolve();
  const check = () => {
    if (stopped) return;
    if (now() - askedAt >= BACKGROUND_MS) void refresh();
    else nextCheck = setTimeout(check, askedAt + BACKGROUND_MS - now());
  };
  const pollHints = async (initial = false) => {
    const listed = await hints();
    if (stopped) return;
    if (listed !== null) {
      const numbers = [...listed].filter(([name]) => !seenHints.has(name)).map(([, number]) => number);
      seenHints = new Set(listed.keys());
      if (!initial) target(numbers);
    }
    if (initial) {
      ready = true;
      void refresh();
    }
    nextHint = setTimeout(() => void pollHints(), 1_000);
  };
  const stopReads = () => {
    stopped = true;
    clearTimeout(nextCheck);
    clearTimeout(nextHint);
    activeRead?.abort();
    fullRequest?.done();
  };
  server.on('listening', () => void pollHints(true));
  server.on('close', stopReads);
  return Object.assign(server, {
    drainUpdateResponse: () => updateResponse,
    stopReads,
  });
};
