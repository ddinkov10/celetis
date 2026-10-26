import { constants } from 'node:os';
import type { Adapter } from './adapter.ts';
import { readBoard } from './data.ts';
import { createBoard, run } from './server.ts';

export async function startBoard(main: string, configured: number, adapter: Adapter): Promise<number> {
  const port = Number(process.env.PORT) || configured;
  return new Promise<number>((done) => {
    const handlers = new Map<NodeJS.Signals, () => void>();
    const work = new AbortController();
    const server = createBoard({
      main,
      read: (signal) => readBoard(main, AbortSignal.any([signal, work.signal])),
      adapter,
      exec: (file, args, options) => run(file, args, { ...options, signal: work.signal }),
    });
    const close = (status: number) => {
      for (const [signal, handler] of handlers) process.off(signal, handler);
      work.abort();
      server.closeAllConnections();
      server.close(() => done(status));
    };
    const refuse = (cause: NodeJS.ErrnoException) => {
      console.error(
        `agent-board: cannot listen on 127.0.0.1:${port}: ${cause.code === 'EADDRINUSE' ? 'the port is in use' : cause.message}`,
      );
      close(1);
    };
    server.once('error', refuse);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const handler = () => close(128 + constants.signals[signal]);
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    try {
      server.listen(port, '127.0.0.1', () => {
        console.log(`agent-board: repository ${main}`);
        console.log(`agent-board: http://127.0.0.1:${port}`);
      });
    } catch (cause) {
      refuse(cause as NodeJS.ErrnoException);
    }
  });
}
