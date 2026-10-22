import assert from 'node:assert/strict';
import { BUN_NEEDED, cleanPath, isBunOk } from './runtime.ts';
import { test } from './test-support.ts';

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
