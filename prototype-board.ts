import type { Adapter } from './engine/board/adapter.ts';
import { startBoard } from './engine/board/start.ts';

const reject = () => Promise.reject(new Error('prototype: the adapter refuses this method'));
const adapter = new Proxy({} as Adapter, {
  get: (_, name) =>
    name === 'status'
      ? async () => ({
          schema: 1,
          daemon: { schema: 1, pid: process.pid, start: 'prototype', revision: 'a'.repeat(40), main: 'C:/Users/ddink/PROJECTS/celetis', common: 'C:/Users/ddink/PROJECTS/celetis', socket: 'C:/Users/ddink/PROJECTS/celetis' },
          board: 'http://127.0.0.1:4472',
          auto: 'off',
          runs: [],
          landings: [],
          coordinator: false,
        })
      : name === 'coordinator'
        ? () => null
        : reject,
});
const handle = await startBoard('C:/Users/ddink/PROJECTS/celetis', 4472, adapter, {
  env: process.env,
  revision: 'a'.repeat(40),
  successor: false,
  versioned: false,
  restarting: () => false,
  restart: () => {},
});
console.log('prototype board at', handle.url);
setInterval(() => {}, 1 << 30);
