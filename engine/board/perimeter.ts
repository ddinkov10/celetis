import type { ExecFileOptions } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Adapter } from './adapter.ts';
import type { BoardRuntime, Document, UpdateRestartResponse } from './types.ts';
import type { UpdateController } from './updates.ts';

type Result = { code: number; stdout: string; stderr: string };
export type Execute = (file: string, args: string[], options?: ExecFileOptions) => Promise<Result>;

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { AgentOrderConflict } from '../lib/agent-order.ts';
import { queueReadView, readVisualPage } from '../lib/board-read.ts';
import { createCodexClient } from '../lib/codex-app-server.ts';
import { recordEvent } from '../lib/events.ts';
import { childEnv } from '../lib/process.ts';
import { createCoordinatorReads } from './coordinator.ts';
import { createPlacement } from './place.ts';
import { createPressBook, createPresses } from './presses.ts';
import { createReads } from './reads.ts';
import { firstLine, POSTS, parseRequest, Refusal } from './requests.ts';

const HERE = import.meta.dirname;
const FILES: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/board.css': ['board.css', 'text/css; charset=utf-8'],
  '/board.js': ['board.js', 'text/javascript; charset=utf-8'],
  '/fonts/geist.woff2': ['fonts/geist.woff2', 'font/woff2'],
  '/fonts/geist-mono.woff2': ['fonts/geist-mono.woff2', 'font/woff2'],
};
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src data:; " +
  "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const VISUAL_CSP = 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox';
// A text of 4096 UTF-16 units, each written as a \u escape of 6 bytes, fits with its field name.
const SAY_BYTES = 32_768;
const SINCE = /^[A-Za-z0-9._:-]{1,80}$/;

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
  const reads = createReads({ read, readTargets, hints, now });
  const book = createPressBook({ now, target: reads.target });
  const coordinator = createCoordinatorReads({ adapter, exec, now, codex: () => createCodexClient(main) });
  const placer = createPlacement({
    main,
    reads,
    presses: book,
    status: () => adapter.status(),
    coordinator,
    facts: () => adapter.coordinator(),
    exec,
    now,
  });
  const presses = createPresses({ main, reads, book, placer, adapter, exec, now });

  const readBody = async (request: IncomingMessage, limit: number): Promise<unknown> => {
    let text = '';
    for await (const chunk of request) {
      text += chunk;
      if (Buffer.byteLength(text, 'utf8') > limit)
        throw new Refusal(400, `the body is too long (maximum ${limit} bytes)`);
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
    if (request.method === 'GET' && path === '/api/queue') return sendJson(response, 200, await queueReadView(main));
    if (request.method === 'GET' && path === '/api/coordinator') {
      const since = new URLSearchParams(url.split('?')[1] ?? '').get('since');
      return sendJson(response, 200, await coordinator.chat(since !== null && SINCE.test(since) ? since : null));
    }
    if (request.method === 'GET' && path === '/api/update')
      return sendJson(response, 200, { runtime, update: updates().snapshot() });
    if (request.method === 'GET' && path === '/api/board') {
      const isLocal = new URLSearchParams(url.split('?')[1] ?? '').get('local') === '1';
      await reads.beforeBoard(isLocal, book.hasDuePress);
      return sendJson(response, 200, await placer.placement({ isLocal }));
    }
    if (request.method === 'GET' && path.startsWith('/visual/')) {
      const page = await readVisualPage(main, path.slice('/visual/'.length));
      if (page !== null) return sendVisual(response, page);
    }
    if (request.method !== 'POST' || !POSTS.has(path)) throw new Refusal(404, 'no such path');
    if (request.headers.origin !== `http://${host}`) throw new Refusal(403, 'the Origin is not this page');
    if (!/^application\/json\s*(;|$)/.test(request.headers['content-type'] ?? ''))
      throw new Refusal(403, 'the content type is not application/json');
    const body = await readBody(request, path === '/api/coordinator/say' ? SAY_BYTES : 1024);
    const input = parseRequest(path, body);
    if (input.path === '/api/intake') {
      await presses.intake();
      return sendJson(response, 200, { ok: true });
    }
    if (input.path === '/api/update/check') {
      void updates().check();
      return sendJson(response, 200, { runtime, update: updates().snapshot() });
    }
    if (input.path === '/api/update/start') {
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
    if (input.path === '/api/update/restart') {
      const finished = new Promise<void>((done) => {
        response.once('finish', done);
        response.once('close', done);
      });
      updateResponse = Promise.all([updateResponse, finished]).then(() => {});
      let target: string;
      try {
        target = await updates().restart();
      } catch (cause) {
        const status = (cause as { status?: number }).status;
        if (status === 409 || status === 503) throw new Refusal(status, (cause as Error).message);
        throw cause;
      }
      return sendJson(response, 202, { runtime, target } satisfies UpdateRestartResponse);
    }
    if (input.path === '/api/queue') return sendJson(response, 200, await presses.queue(input.action, input.choice));
    if (input.path === '/api/run' && 'waitId' in input) await presses.retry(input.number, input.waitId);
    else if (input.path === '/api/run') await presses.run(input.number, input.agent, input.effort);
    else if (input.path === '/api/assist') await presses.assist(input.number);
    else if (input.path === '/api/visual') await presses.visual(input.number);
    else if (input.path === '/api/resume') await presses.resume(input.number);
    else if (input.path === '/api/shell') await presses.shell(input.number);
    else if (input.path === '/api/go') await presses.go(input.sessionId);
    else if (input.path === '/api/aside') await presses.aside(input.number);
    else if (input.path === '/api/stop') await presses.stop(input.number, input.sessionId);
    else if (input.path === '/api/coordinator/open') await presses.openCoordinator();
    else if (input.path === '/api/coordinator/say') await presses.actCoordinator({ kind: 'say', text: input.text });
    else if (input.path === '/api/coordinator/key') await presses.actCoordinator({ kind: 'key', key: input.key });
    else if (input.path === '/api/coordinator/interrupt') await presses.actCoordinator({ kind: 'interrupt' });
    else if (input.path === '/api/coordinator/end') await presses.actCoordinator({ kind: 'end' });
    else if (input.path === '/api/agent') {
      try {
        return sendJson(response, 200, { order: await presses.replaceOrder(input.order, input.expectedVersion) });
      } catch (cause) {
        if (cause instanceof AgentOrderConflict)
          return sendJson(response, 409, { error: cause.message, latest: cause.latest });
        throw cause;
      }
    } else {
      input.path satisfies '/api/refresh';
      await reads.refresh();
    }
    sendJson(response, 200, { ok: true });
  };

  const server = createServer((request, response) => {
    request.setEncoding('utf8');
    answer(request, response).catch((cause) => {
      const status = cause instanceof Refusal ? cause.status : 500;
      const error =
        (cause instanceof Refusal && cause.keepsLines ? cause.message : firstLine(String(cause.message))) ||
        'the server failed';
      sendJson(response, status, { error });
      if (!(cause instanceof Refusal)) recordEvent({ name: 'board-request', message: '', code: 500, error: cause });
      else if (status === 502) recordEvent({ name: 'board-terminal', message: error, code: 502 });
    });
  });
  let updateResponse = Promise.resolve();
  server.on('listening', () => reads.start());
  server.on('close', reads.stop);
  return Object.assign(server, {
    drainUpdateResponse: () => updateResponse,
    stopReads: reads.stop,
    closeCoordinator: coordinator.close,
  });
};
