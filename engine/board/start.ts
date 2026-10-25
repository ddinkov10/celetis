import { constants } from 'node:os';
import { createBoard, run } from './server.ts';
import type { Config } from './types.ts';

export async function startBoard(main: string, config: Config): Promise<number> {
  const port = Number(process.env.PORT) || config.port || 4403;
  return new Promise<number>((done) => {
    const handlers = new Map<NodeJS.Signals, () => void>();
    const work = new AbortController();
    const server = createBoard({
      main,
      config,
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
        for (const key of ['data', 'run', 'resume'] as const)
          if (config[key]) console.log(`agent-board: ${key.padEnd(8)}${config[key].join(' ')}`);
        console.log(`agent-board: http://127.0.0.1:${port}`);
      });
    } catch (cause) {
      refuse(cause as NodeJS.ErrnoException);
    }
  });
}
