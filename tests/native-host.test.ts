import { expect, test } from 'bun:test';
import { nativeHost } from './lib/native-host.ts';

test('hook chains retain registration order, filtered calls, and plugin origins', async () => {
  const seen: unknown[] = [];
  const { $, on } = nativeHost([
    {
      register(on) {
        on('tool.call', { tool: 'Read' }, async (_$, e, next) => {
          seen.push(['outer', e.file_path, next.origin]);
          const result = await next({ ...e, file_path: '/changed' });
          seen.push('return');
          return { ...result, context: ['outer'] };
        });
      },
    },
  ]);
  on('tool.call', (_$, e) => {
    seen.push(['inner', e.file_path]);
    return { text: 'native result' };
  });
  expect(await $.tool.call({ tool: 'Read', file_path: '/initial' })).toEqual({
    text: 'native result',
    context: ['outer'],
  });
  expect(seen).toEqual([['outer', '/initial', { plugin: 'celetis', tier: 'user' }], ['inner', '/changed'], 'return']);
  seen.length = 0;
  expect(await $.tool.call({ tool: 'Write', file_path: '/other' })).toEqual({ text: 'native result' });
  expect(seen).toEqual([['inner', '/other']]);
});

test('caught downstream exceptions retain called state and error details', async () => {
  const failure = new Error('native failure');
  const { $, on } = nativeHost([
    {
      register(on) {
        on('tool.call', async (_$, e, next) => next(e)).catch((_$, e, next) => ({
          text: `${e.file_path}:${next.error.kind}:${next.error.message}:${next.called}`,
        }));
      },
    },
  ]);
  on('tool.call', () => {
    throw failure;
  });
  expect(await $.tool.call({ tool: 'Read', file_path: '/failure' })).toEqual({
    text: '/failure:throw:native failure:true',
  });
});

test('metadata denials reject while denied tool replies stay intact', async () => {
  const { $, on } = nativeHost([]);
  on('fs.stat', () => ({ deny: 'EACCES' }));
  on('tool.call', () => ({ deny: 'Exact native Read denial' }));
  await expect($.fs.stat('/denied')).rejects.toThrow('fs.stat: EACCES');
  expect(await $.tool.call({ tool: 'Read', file_path: '/denied' })).toEqual({ deny: 'Exact native Read denial' });
});

test('session delivery preserves its complete input and nested destination', async () => {
  const seen: unknown[] = [];
  const { $, on } = nativeHost([
    {
      register(on) {
        on('session.append', async ($, e, next) => {
          await $.tool.call({ tool: 'Read', file_path: '/nested' });
          return next(e);
        });
      },
    },
  ]);
  on('tool.call', (_$, e) => {
    seen.push(e.agentId);
    return { text: 'read' };
  });
  const row = {
    agentId: 'child',
    uuid: 'row',
    door: 'note',
    origin: { kind: 'engine' },
    message: {
      type: 'user',
      role: 'user',
      isMeta: true,
      content: [{ type: 'text', text: 'Native preload.' }],
    },
  };
  expect(await $.session.append(row)).toEqual(row);
  expect(seen).toEqual(['child']);
});

test('turn chains preserve every yielded chunk and the generator return value', async () => {
  const { $, on } = nativeHost([
    {
      register(on) {
        on('turn.step', async function* (_$, e, next) {
          return yield* next(e);
        });
      },
    },
  ]);
  on('turn.step', async function* () {
    yield { kind: 'text', index: 0, text: 'answer' };
    return { turnId: 'turn', index: 0, answer: 'answer', toolUses: [], stopReason: 'end_turn', usage: null };
  });
  const stream = $.turn.step({ turnId: 'turn', index: 0, model: 'model', messageCount: 0 });
  expect(await stream.next()).toEqual({ done: false, value: { kind: 'text', index: 0, text: 'answer' } });
  expect(await stream.next()).toEqual({
    done: true,
    value: { turnId: 'turn', index: 0, answer: 'answer', toolUses: [], stopReason: 'end_turn', usage: null },
  });
});

test('uncaught turn failures propagate after the hook catch yields no replacement', async () => {
  const { $, on } = nativeHost([
    {
      register(on) {
        on('turn.step', async function* (_$, e, next) {
          return yield* next(e);
        }).catch(async function* () {});
      },
    },
  ]);
  on('turn.step', async function* () {
    yield await Promise.reject(new Error('model failed'));
  });
  const stream = $.turn.step({ turnId: 'turn', index: 0, model: 'model', messageCount: 0 });
  await expect(stream.next()).rejects.toThrow('model failed');
});
