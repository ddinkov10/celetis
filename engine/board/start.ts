import { randomUUID } from 'node:crypto';
import type { DaemonRequest, DaemonStatus } from '../lib/daemon-types.ts';
import { commonDir, HostError } from '../lib/host.ts';
import { installedProgram, type Program } from '../lib/program.ts';
import { readRefreshHints } from '../lib/refresh-hints.ts';
import type { Adapter } from './adapter.ts';
import { readBoard, readBoardTargets } from './data.ts';
import { createBoard, run } from './server.ts';
import { createUpdates, type UpdateController } from './updates.ts';

export type BoardDaemon = Readonly<{
  send(request: Exclude<DaemonRequest, { kind: 'status' }>): Promise<unknown>;
  status(): Promise<DaemonStatus>;
}>;
export type BoardStart = Readonly<{
  env: NodeJS.ProcessEnv;
  revision: string;
  successor: boolean;
  versioned: boolean;
  restarting(): boolean;
  restart(program: Program): void;
}>;
export type BoardHandle = Readonly<{
  port: number;
  url: string;
  drainUpdateResponse(): Promise<void>;
  close(): Promise<void>;
}>;

export async function startBoard(
  main: string,
  configured: number,
  adapter: Adapter,
  context: BoardStart,
): Promise<BoardHandle> {
  const env = { ...context.env };
  const exact = Number(env.PORT);
  let first = exact || configured;
  let port = first;
  let searching = !exact;
  const common = await commonDir(main);
  const work = new AbortController();
  let updates: UpdateController;
  let closing: Promise<void> | undefined;
  let state: 'selecting' | 'ready' | 'closing' = 'selecting';
  const server = createBoard({
    main,
    read: (signal) => readBoard(main, adapter.reconcileQueue, AbortSignal.any([signal, work.signal])),
    readTargets: (numbers, previous, signal) =>
      readBoardTargets(main, adapter.reconcileQueue, numbers, previous, AbortSignal.any([signal, work.signal])),
    hints: () => readRefreshHints(common),
    adapter,
    updates: () => updates,
    runtime: { revision: context.revision, instance: randomUUID() },
    exec: (file, args, options) => run(file, args, { ...options, signal: work.signal }),
  });
  const close = () => {
    state = 'closing';
    closing ??= (async () => {
      server.stopReads();
      work.abort();
      await updates?.close();
      server.closeAllConnections();
      await new Promise<void>((closed) => server.close(() => closed()));
    })();
    return closing;
  };
  return new Promise<BoardHandle>((resolve, reject) => {
    const refuse = (cause: NodeJS.ErrnoException) => {
      if (state === 'closing') return;
      if (state === 'ready') {
        console.error(`agent-board: ${cause.message}`);
        return;
      }
      if (cause.code === 'EADDRINUSE' && !searching && context.successor) {
        searching = true;
        first = configured;
        port = configured;
        setImmediate(listen);
        return;
      }
      if (searching && cause.code === 'EADDRINUSE' && port < 65535) {
        port++;
        setImmediate(listen);
        return;
      }
      console.error(
        searching && cause.code === 'EADDRINUSE'
          ? `agent-board: cannot listen on 127.0.0.1:${first}-65535: all ports are in use`
          : `agent-board: cannot listen on 127.0.0.1:${port}: ${cause.code === 'EADDRINUSE' ? 'the port is in use' : cause.message}`,
      );
      void close().then(() => reject(new HostError('', 1)));
    };
    server.on('error', refuse);
    server.once('listening', () => {
      if (state !== 'selecting') return;
      const address = server.address();
      if (!address || typeof address === 'string') return refuse(new Error('no listening address'));
      state = 'ready';
      const url = `http://127.0.0.1:${address.port}`;
      updates = createUpdates({
        main,
        env,
        recovery: `From ${main}, run celetis daemon status; when no daemon runs, run celetis daemon start`,
        revision: context.revision,
        versioned: context.versioned,
        busy: () => context.restarting(),
        relaunch: async (target) => {
          await server.drainUpdateResponse();
          context.restart(await installedProgram(target));
        },
      });
      console.log(`agent-board: repository ${main}`);
      console.log(`agent-board: ${url}`);
      resolve({ port: address.port, url, drainUpdateResponse: server.drainUpdateResponse, close });
    });
    function listen() {
      if (state !== 'selecting') return;
      try {
        server.listen(port, '127.0.0.1');
      } catch (cause) {
        refuse(cause as NodeJS.ErrnoException);
      }
    }
    listen();
  });
}
