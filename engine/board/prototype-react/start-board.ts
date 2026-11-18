import { startBoard } from '../start.ts';

const main = '/Users/dinq/Dinq/PROJECTS/celetis';
const port = Number(process.argv[2] ?? 4471);
const no = () => Promise.reject(new Error('read-only prototype'));
const adapter = new Proxy(
  {},
  {
    get: (_t, key) => {
      if (key === 'status')
        return async () => ({
          schema: 1,
          daemon: { schema: 1, pid: 1, start: '0', revision: 'prototype', main, common: `${main}/.git`, socket: '/nonexistent' },
          board: '',
          auto: 'off',
          runs: [],
          landings: [],
          coordinator: false,
        });
      if (key === 'coordinator') return () => null;
      return no;
    },
  },
) as never;
const handle = await startBoard(main, port, adapter, {
  env: { ...process.env, PORT: String(port) },
  revision: 'prototype',
  successor: false,
  versioned: false,
  restarting: () => false,
  restart: () => {},
});
console.log('board', handle.url);
setInterval(() => {}, 1 << 30);
