import { randomUUID } from 'node:crypto';
import { constants } from 'node:os';
import type { Host } from '../lib/config-core.ts';
import { commonDir } from '../lib/host.ts';
import { readRefreshHints } from '../lib/refresh-hints.ts';
import type { Adapter } from './adapter.ts';
import { readBoard, readBoardTargets } from './data.ts';
import { installedBoard, restartBoard } from './restart.ts';
import { createBoard, run } from './server.ts';
import { createUpdates, type UpdateController } from './updates.ts';

export type BoardStart = { host: Host; env: NodeJS.ProcessEnv; revision: string };

export async function startBoard(
  main: string,
  configured: number,
  adapter: Adapter,
  context: BoardStart,
): Promise<number> {
  context = { ...context, env: { ...context.env } };
  const exact = Number(context.env.PORT);
  const first = exact || configured;
  let port = first;
  const common = await commonDir(main);
  return new Promise<number>((done) => {
    const handlers = new Map<NodeJS.Signals, () => void>();
    const work = new AbortController();
    let updates: UpdateController;
    let closing: Promise<void> | undefined;
    let state: 'selecting' | 'ready' | 'closing' = 'selecting';
    let interrupted = false;
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
        for (const [signal, handler] of handlers) process.off(signal, handler);
        server.closeAllConnections();
        await new Promise<void>((closed) => server.close(() => closed()));
      })();
      return closing;
    };
    const refuse = (cause: NodeJS.ErrnoException) => {
      if (state === 'closing') return;
      if (state === 'selecting' && !exact && cause.code === 'EADDRINUSE') {
        if (port < 65535) {
          port++;
          setImmediate(listen);
          return;
        }
        console.error(`agent-board: cannot listen on 127.0.0.1:${first}-65535: all ports are in use`);
      } else {
        console.error(
          `agent-board: cannot listen on 127.0.0.1:${port}: ${cause.code === 'EADDRINUSE' ? 'the port is in use' : cause.message}`,
        );
      }
      void close().then(() => done(1));
    };
    server.on('error', refuse);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const handler = () => {
        interrupted = true;
        void close().then(() => done(128 + constants.signals[signal]));
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    server.once('listening', () => {
      if (state !== 'selecting') return;
      state = 'ready';
      const address = server.address();
      if (!address || typeof address === 'string') return refuse(new Error('no listening address'));
      const actual = address.port;
      const recovery = `From ${main}, run PORT=${actual} celetis --agent ${context.host} board`;
      updates = createUpdates({
        main,
        env: context.env,
        recovery,
        ready: async (target) => {
          await server.drainUpdateResponse();
          await installedBoard(target, context.env);
          if (interrupted) return;
          await close();
          if (interrupted) return;
          try {
            done(await restartBoard(main, actual, context, target));
          } catch (cause) {
            console.error(`agent-board: cannot restart: ${(cause as Error).message}`);
            console.error(`agent-board: ${recovery}`);
            done(1);
          }
        },
      });
      console.log(`agent-board: repository ${main}`);
      console.log(`agent-board: http://127.0.0.1:${actual}`);
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
