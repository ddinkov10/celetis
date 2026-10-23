import { test } from 'bun:test';
import { customFaults, faultTarget } from './lib/custom-fixture.ts';
import { rejectsCustom } from './lib/custom-program-check.ts';

for (const fault of customFaults.filter((fault) => !fault.startsWith('metadata-')))
  test(`public custom program rejects ${fault}`, () => rejectsCustom(fault, faultTarget(fault)));
