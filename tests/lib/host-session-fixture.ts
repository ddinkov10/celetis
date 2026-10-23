import { expect } from 'bun:test';
import { type RunnerFixture, uuid } from './runner-fixture.ts';

export const managed = { HERDR_ENV: '1', HERDR_PANE_ID: 'w1:p1' };
export const hosts = ['claude', 'codex'] as const;
export const codexSourceArgs = (root: string) => [
  '-c',
  'marketplaces.celetis.source_type="local"',
  '-c',
  `marketplaces.celetis.source=${JSON.stringify(root)}`,
];
export const resumeArgs = (host: string, root: string, id = uuid) =>
  host === 'codex' ? [...codexSourceArgs(root), 'resume', '--no-daemon', id] : ['--resume', id];
export async function saved(f: RunnerFixture, host: string, step = 'plan', extra: NodeJS.ProcessEnv = {}) {
  await f.put('step', step);
  const result = await f.run(['7'], { host, env: { ...managed, ...extra } });
  expect(result.code, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(await f.record()).toEqual({
    schema: 1,
    host,
    issue: 7,
    step: step === 'feature' ? 'specify' : step,
    checkout: f.repo,
    session_id: uuid,
  });
}
