import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanPath, isNodeOk, NODE_NEEDED } from './runtime.mjs';

test('the board needs Node 22 from 22.18, or Node 24.2 or later', () => {
  for (const version of ['22.18.0', '22.23.3', '24.2.0', '25.0.0', '26.8.2'])
    assert.equal(isNodeOk(version), true, version);
  for (const version of ['18.20.4', '20.19.0', '22.17.1', '23.11.0', '24.1.0'])
    assert.equal(isNodeOk(version), false, version);
  assert.equal(NODE_NEEDED, 'Node 22.18, or Node 24.2 or later, is necessary');
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
