import { test } from 'bun:test';
import { deniedFaults } from './lib/custom-fixture.ts';
import { rejectsCustom } from './lib/custom-program-check.ts';

for (const fault of deniedFaults)
  test(`public denied-read rejects ${fault}`, () => rejectsCustom(fault, 'denied-read'));
