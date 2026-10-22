import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { withFixture } from './lib/fixture.ts';
import { manualClients, manualEnvironment } from './manual/manual-runtime.ts';

for (const kind of ['missing', 'not-executable'])
  test(
    `manual host ${kind} keeps its shell exit status`,
    withFixture(async (f) => {
      const file =
        kind === 'missing' ? join(f.dir, 'absent-host') : await f.write('not-executable', 'host source', 0o644);
      const clients = manualClients(f.env);
      try {
        const result = await clients.run(file, [], { cwd: f.dir });
        expect(result.code).toBe(kind === 'missing' ? 127 : 126);
        expect(result.stderr.length).toBeGreaterThan(0);
      } finally {
        clients.close();
      }
    }),
  );
test('manual environment clears parent session state and product executable paths', () => {
  const saved = { ...process.env };
  try {
    for (const name of [
      'AI_AGENT',
      'CLAUDECODE',
      'CLAUDE_CODE_CHILD_SESSION',
      'CLAUDE_CODE_ENTRYPOINT',
      'CLAUDE_CODE_EXECPATH',
      'CLAUDE_CODE_MESSAGING_SOCKET',
      'CLAUDE_CODE_MESSAGING_TOKEN',
      'CLAUDE_CODE_SESSION_ATTENDED',
      'CLAUDE_CODE_SESSION_ID',
      'CLAUDE_EFFORT',
      'CLAUDE_PID',
    ])
      process.env[name] = 'parent';
    process.env.PATH = '/product/node_modules/.bin:/safe/bin';
    const env = manualEnvironment();
    expect(env.PATH).toBe('/safe/bin');
    expect(env.BUN_RUNTIME_TRANSPILER_CACHE_PATH).toBe('0');
    expect(env.DO_NOT_TRACK).toBe('1');
    expect(env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS).toBe('1');
    for (const name of Object.keys(process.env).filter((name) => process.env[name] === 'parent'))
      expect(env[name]).toBeUndefined();
  } finally {
    for (const name of Object.keys(process.env)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});
