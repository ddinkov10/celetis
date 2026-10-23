import { expect } from 'bun:test';
import type { RunnerFixture } from './runner-fixture.ts';

export const managed = { HERDR_ENV: '1', HERDR_PANE_ID: 'w1:p1' };
export async function start(f: RunnerFixture, host: string, automatic = false) {
  await f.put('hold-session');
  await f.put('skip-input');
  await f.put('dynamic-id');
  await f.put('initial-status', (await f.read('initial-status')) || 'working');
  await f.issue();
  const running = f.start(automatic ? [] : ['7'], { host, env: managed });
  await f.wait('started-1').catch((error) => {
    throw new Error(`${(error as Error).message}: ${JSON.stringify(running.output())}`);
  });
  await identity(f, 1);
  return running;
}
export async function identity(f: RunnerFixture, k: number) {
  const id = `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`;
  const deadline = performance.now() + 5000;
  while ((await f.record().catch(() => ({}))).session_id !== id) {
    if (performance.now() >= deadline) throw new Error('identity was not saved');
    await Bun.sleep(10);
  }
}
export async function held(f: RunnerFixture, host: string) {
  const r = await f.run(['7'], { host: host === 'claude' ? 'codex' : 'claude', env: managed });
  expect(r.code, r.stderr).toBe(0);
  expect(r.stdout).toContain('another celetis-flow.ts');
  expect(await f.read('count')).toBe('1');
}
export async function finish(f: RunnerFixture, r: ReturnType<RunnerFixture['start']>) {
  await f.put('finish-1');
  return r.result;
}
