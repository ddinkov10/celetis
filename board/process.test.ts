import { expect, test } from 'bun:test';
import { isolatedArgs } from '../tests/lib/fixture.ts';
import { run } from './server.ts';

for (const stream of ['stdout', 'stderr']) {
  test(`the board ${stream} process output has its exact 64 MiB limit`, async () => {
    const limit = 64 * 1024 * 1024;
    const source = `process.${stream}.write(Buffer.alloc(Number(process.argv[1]),'x'));`;
    const exact = await run(process.execPath, [...isolatedArgs, '-e', source, String(limit)]);
    expect(exact.code).toBe(0);
    expect(Buffer.byteLength(exact[stream as 'stdout' | 'stderr'])).toBe(limit);
    const overflow = await run(process.execPath, [...isolatedArgs, '-e', source, String(limit + 1)]);
    expect(overflow.code).toBe(1);
    expect(Buffer.byteLength(overflow[stream as 'stdout' | 'stderr'])).toBe(limit);
  }, 29_000);
}
