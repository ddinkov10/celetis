import assert from 'node:assert/strict';
import { chmod, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUN_NEEDED, cleanPath, isBunOk } from './runtime.ts';
import { test } from './test-support.ts';

test('runtime binding preserves an execute-only native command without a read permission condition', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'board-runtime.'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const native = join(directory, 'native');
  const source = Bun.which('true');
  assert.ok(source);
  await cp(source, native);
  await chmod(native, 0o111);
  await assert.rejects(readFile(native), { code: 'EACCES' });
  const { bindRuntime } = await import('./runtime.ts');
  assert.deepEqual(await bindRuntime([native, 'an argument']), [native, 'an argument']);
});

for (const version of ['1.4.2', '1.4.3', '1.5.0', '2.0.0']) {
  test(`Bun ${version} meets the board floor`, () => assert.equal(isBunOk(version), true));
}
for (const version of ['1.4.1', '1.3.99', '0.9.0']) {
  test(`Bun ${version} is below the board floor`, () => assert.equal(isBunOk(version), false));
}
test('the Bun floor diagnostic names the supported runtime', () => {
  assert.equal(BUN_NEEDED, 'Bun 1.4.2 or later is necessary');
});

test('the entry removes each node_modules/.bin item from PATH', () => {
  assert.equal(
    cleanPath('/r/node_modules/.bin:/usr/bin:/r/a/node_modules/.bin/:/opt/node_modules/.bin/x:/bin'),
    '/usr/bin:/opt/node_modules/.bin/x:/bin',
  );
  assert.equal(cleanPath(''), '');
});

test('cleanPath splits the value at the delimiter of the caller', () => {
  assert.equal(cleanPath('/usr/bin;/r/node_modules/.bin;/bin', ';'), '/usr/bin;/bin');
});
