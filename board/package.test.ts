import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from './test-support.ts';

const HERE = import.meta.dirname;
const ENTRY = join(HERE, 'cli.ts');
const readPackage = async () => JSON.parse(await readFile(join(HERE, 'package.json'), 'utf8'));

test('the package has its name, no version, the module type, the licence, the Bun range, and one command', async () => {
  const fields = await readPackage();
  const { name, type, license, engines, bin } = fields;
  assert.equal(name, 'agent-board');
  assert.equal(Object.hasOwn(fields, 'version'), false);
  assert.equal(type, 'module');
  assert.equal(license, 'UNLICENSED');
  assert.equal(engines?.bun, '>=1.4.2');
  assert.deepEqual(bin, { 'agent-board': 'cli.ts' });
});

test('the package is private, so npm does not publish it to the public registry', async () => {
  assert.equal((await readPackage()).private, true);
});

test('the package has no script, no dependency, and no workspace', async () => {
  const fields = await readPackage();
  for (const key of [
    'scripts',
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
    'workspaces',
  ]) {
    assert.equal(Object.hasOwn(fields, key), false, key);
  }
});

test('the entry starts with the isolated Bun line and has an execute bit', async () => {
  assert.equal(
    (await readFile(ENTRY, 'utf8')).split('\n')[0],
    '#!/usr/bin/env -S BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros',
  );
  assert.notEqual((await stat(ENTRY)).mode & 0o111, 0);
});
