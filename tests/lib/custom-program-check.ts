import { expect } from 'bun:test';
import { join } from 'node:path';
import { customManualFixture } from './manual-fixture.ts';

export async function rejectsCustom(fault: string, target: string) {
  const f = await customManualFixture();
  try {
    const out = await f.bun(f.custom, ['--output-dir', join(f.dir, 'evidence')], {
      cwd: f.repo,
      env: { ...f.env, CUSTOM_PART_CASES: target, CUSTOM_FAULT: fault },
    });
    expect(out.code).toBe(1);
    expect(out.stdout).toContain(`FAIL: ${target}\n`);
    expect(out.stdout.match(/^FAIL:/gm)).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
}
