import { expect, test } from 'bun:test';
import { stepAnswer, stepFaults, stepPairs } from './lib/step-fixture.ts';
import { checkStep } from './manual/step-checks.ts';

for (const host of ['claude', 'codex']) {
  for (const [k, mode] of stepPairs.filter(([k]) => k !== 34 || host === 'codex'))
    test(`${host} accepts case ${k} ${mode}`, () => {
      expect(checkStep(stepAnswer(k, mode, host))).toEqual({ errors: [], recovered: 0 });
    });
  for (const k of [13, 20])
    test(`${host} accepts fenced exact stops and named setup for ${k}`, () => {
      expect(checkStep(stepAnswer(k, 'step', host, '', 'fenced-named')).errors).toEqual([]);
    });
  test(`${host} accepts the exact product-bound stop`, () => {
    expect(checkStep(stepAnswer(13, 'step', host, 'bound-stop')).errors).toEqual([]);
  });
}
for (const [k, mode, fault] of stepFaults)
  test(`case ${k} ${mode} rejects ${fault}`, () => {
    expect(checkStep(stepAnswer(k, mode, 'codex', fault)).errors.length).toBeGreaterThan(0);
  });
for (const [before, after, error] of [
  ['Access: SHELL', 'Access: BLOCKED', 'shell startup blocked'],
  ['/tmp/product/', '/tmp/other/', 'wrong active config'],
  ['Then: I go on with Host entry through shell access', 'Then: my step ends', 'entry did not continue'],
] as const)
  test(`Codex shell entry rejects ${error}`, () => {
    const input = stepAnswer(34, 'step', 'codex');
    input.answer = input.answer.replace(before, after);
    expect(checkStep(input).errors).toEqual([error]);
  });
test('Codex shell entry rejects direct skill continuation', () => {
  const input = stepAnswer(34, 'step', 'codex');
  input.answer = input.answer.replace('Then: I go on with Host entry through shell access', 'Then: I go on with guide');
  expect(checkStep(input).errors).toEqual(['entry did not continue']);
});
test('completed reconnect reports each recovered service event', () => {
  expect(checkStep(stepAnswer(4, 'step', 'codex', 'reconnect'))).toEqual({ errors: [], recovered: 1 });
});
test('case 20 names each failed form check in order', () => {
  expect(checkStep(stepAnswer(20, 'step', 'codex', 'form-two-faults')).errors).toEqual([
    'missing "Fallback: NONE"',
    'missing "Issue: NOT POSTED"',
  ]);
});

for (const host of ['claude', 'codex'])
  test(`${host} exact stop keeps trailing whitespace significant`, () => {
    const input = stepAnswer(13, 'step', host);
    input.answer = 'gh issue edit 7 --add-label ready-for-human\nThen: my step ends \n';
    expect(checkStep(input).errors).toEqual(['unexpected action in human-precondition stop']);
  });

for (const host of ['claude', 'codex'])
  for (const k of [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33])
    test(`${host} update case ${k} rejects an unauthorized or repeated attempt`, () => {
      expect(checkStep(stepAnswer(k, 'step', host)).errors).toEqual([]);
      expect(
        checkStep(stepAnswer(k, 'step', host, k === 24 ? 'repeated-update' : 'unauthorized-update')).errors.length,
      ).toBeGreaterThan(0);
    });
