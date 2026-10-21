import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

const HERE = import.meta.dirname
const ENTRY = join(HERE, 'cli.mjs')
const readPackage = async () => JSON.parse(await readFile(join(HERE, 'package.json'), 'utf8'))

test('the package has its name, no version, the module type, the licence, the Node range, and one command', async () => {
  const fields = await readPackage()
  const { name, type, license, engines, bin } = fields
  assert.equal(name, 'agent-board')
  assert.equal(Object.hasOwn(fields, 'version'), false)
  assert.equal(type, 'module')
  assert.equal(license, 'UNLICENSED')
  assert.equal(engines?.node, '^22.18.0 || >=24.2.0')
  assert.deepEqual(bin, { 'agent-board': 'cli.mjs' })
})

test('the package is private, so npm does not publish it to the public registry', async () => {
  assert.equal((await readPackage()).private, true)
})

test('the package has no script, no dependency, and no workspace', async () => {
  const fields = await readPackage()
  for (const key of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'workspaces']) {
    assert.equal(Object.hasOwn(fields, key), false, key)
  }
})

test('the entry starts with the node line and has an execute bit', async () => {
  assert.equal((await readFile(ENTRY, 'utf8')).split('\n')[0], '#!/usr/bin/env node')
  assert.notEqual((await stat(ENTRY)).mode & 0o111, 0)
})
