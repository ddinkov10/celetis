import { expect, test } from 'bun:test';
import { manualFixture } from './lib/manual-fixture.ts';
import { stepFaults } from './lib/step-fixture.ts';

for (const [k, mode, fault] of stepFaults)
  test(`public step program rejects ${fault} in ${k}:${mode}`, async () => {
    const f = await manualFixture();
    try {
      const out = await f.bun(f.step, ['--agent', 'codex', '--only', `${k}:${mode}`], {
        cwd: f.repo,
        env: { ...f.env, MANUAL_FAULT: fault, MANUAL_BINDING_DIR: f.repo },
      });
      expect(out.code).toBe(1);
      expect(out.stdout).toContain(`FAIL: case ${k} ${mode}:`);
    } finally {
      await f.cleanup();
    }
  });
for (const host of ['claude', 'codex'])
  test(`public ${host} stop accepts its exact product binding`, async () => {
    const f = await manualFixture();
    try {
      const out = await f.bun(f.step, ['--agent', host, '--only', '13:step'], {
        cwd: f.repo,
        env: { ...f.env, MANUAL_FAULT: 'bound-stop', MANUAL_BINDING_DIR: f.repo },
      });
      expect(out.code).toBe(0);
      expect(out.stdout).toContain(`PASS: case 13 step (${host})`);
    } finally {
      await f.cleanup();
    }
  });
