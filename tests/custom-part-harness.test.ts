import { expect, test } from 'bun:test';
import {
  boundFaults,
  customFaults,
  customNames,
  customTranscript,
  deniedFaults,
  faultTarget,
  part,
  schemaFaults,
  statusFaults,
} from './lib/custom-fixture.ts';
import { withFixture } from './lib/fixture.ts';
import { checkCustomArtifacts, evaluateCustom } from './manual/custom-entry-checks.ts';

for (const name of customNames)
  test(`native custom-entry case ${name}`, () => {
    const f = customTranscript(name);
    expect(evaluateCustom(f.spec, f.rows, f)).toEqual([]);
  });
for (const fault of deniedFaults)
  test(`denied-read rejects ${fault}`, () => {
    const f = customTranscript('denied-read', { fault });
    expect(evaluateCustom(f.spec, f.rows, f).length).toBeGreaterThan(0);
  });
for (const fault of customFaults)
  test(`custom checker rejects ${fault} in ${faultTarget(fault)}`, () => {
    const f = customTranscript(faultTarget(fault), { fault });
    expect(evaluateCustom(f.spec, f.rows, f).length).toBeGreaterThan(0);
  });
for (const style of ['path-map', 'relative', 'relative-template', 'relative-map', 'path-object', 'tuple']) {
  for (const name of style === 'path-map'
    ? customNames
    : ['no-shell', 'worktree', 'missing', 'missing-lane', 'symlink', 'handoff', 'enter-worktree', 'denied-read'])
    test(`metadata ${style} preserves ${name}`, () => {
      const f = customTranscript(name, { style });
      expect(evaluateCustom(f.spec, f.rows, f)).toEqual([]);
    });
}
test('malformed accepts an exact-path syntax rejection', () => {
  const f = customTranscript('malformed', { syntax: true });
  expect(evaluateCustom(f.spec, f.rows, f)).toEqual([]);
});
test('current native worktree binding needs only config metadata', () => {
  const f = customTranscript('enter-worktree', { bound: true });
  expect(evaluateCustom(f.spec, f.rows, f)).toEqual([]);
});
for (const fault of boundFaults)
  test(`bound-root rejects ${fault}`, () => {
    const f = customTranscript('enter-worktree', { bound: true });
    const reply = f.rows.find((row) => part(row)?.tool_use_id === 'enter-setup');
    const meta = f.rows.find((row) => part(row)?.tool_use_id === 'meta-1');
    if (fault === 'absent') delete reply.tool_use_result.worktreePath;
    else if (fault === 'mismatched') reply.tool_use_result.worktreePath += '.other';
    else if (fault === 'error') part(reply).is_error = true;
    else if (fault === 'stale-session') reply.session_id = 'old-session';
    else if (fault === 'stale-binding' || fault === 'old-result-after-transition') {
      const call = structuredClone(f.rows[0]);
      part(call).id = 'enter-other';
      part(call).input.path = '/other-checkout';
      const other = structuredClone(reply);
      part(other).tool_use_id = 'enter-other';
      other.tool_use_result.worktreePath = '/other-checkout';
      f.rows.splice(2, 0, call, other, ...(fault === 'old-result-after-transition' ? [structuredClone(reply)] : []));
    } else if (fault === 'missing-config-kind') f.rows = f.rows.filter((row) => row !== meta);
    else if (fault === 'late-config-kind') {
      f.rows = f.rows.filter((row) => row !== meta);
      f.rows.push(meta);
    } else {
      const value = JSON.parse(part(meta).content[0].text);
      value.symlink = true;
      part(meta).content[0].text = JSON.stringify(value);
    }
    expect(evaluateCustom(f.spec, f.rows, f).length).toBeGreaterThan(0);
  });
for (const name of ['folded', 'unknown-field'])
  for (const fault of schemaFaults)
    test(`${name} schema rejection ${fault}`, () => {
      const f = customTranscript(name);
      const path = f.spec.config.path,
        field = name === 'folded' ? 'custom.guide' : 'custom.unknown';
      let answer = `Config ${path} at ${field}${name === 'folded' ? ": the config schema doesn't accept folded blocks for instruction strings" : " has a field the schema doesn't allow"}. Entry stopped.`;
      if (fault === 'missing-path') answer = answer.replace(path, '');
      else if (fault === 'missing-field') answer = answer.replace(field, '');
      else if (fault === 'missing-validity') answer = `Config ${path} at ${field} was read. Entry stopped.`;
      else if (fault === 'missing-stop') answer = answer.replace(' Entry stopped.', '');
      else if (fault === 'affirmative')
        answer = `Config ${path} at ${field}${name === 'folded' ? ': the config schema accepts folded blocks' : ' has a field the schema allows'}. Entry stopped.`;
      else if (fault === 'contradictory') answer += ' This file is accepted as-is.';
      else if (fault === 'continued-goal') answer += ' scripts/celetis --agent claude next-step';
      for (const row of f.rows) {
        if (row.type === 'result') row.result = answer;
        if (part(row)?.type === 'text') part(row).text = answer;
      }
      expect(evaluateCustom(f.spec, f.rows, f).length === 0).toBe(fault === 'good');
    });
for (const fault of statusFaults)
  test(
    `rejects ${fault} client status before transcript checks`,
    withFixture(async (f) => {
      const values: Record<string, string> = {
        empty: '',
        word: 'status=0\n',
        negative: '-1\n',
        range: '256\n',
        multiline: '0\n7\n',
      };
      if (fault !== 'missing') await f.write('no-shell.status', values[fault] ?? '');
      const actual = await checkCustomArtifacts(f.dir, {
        name: 'no-shell',
        marker: 'CUSTOM_FROM_ROOT',
        checkout: f.dir,
        reads: 1,
      });
      expect(actual.code).toBe(2);
      expect(actual.stdout).toBe(
        `ERROR: no-shell: ${fault === 'missing' ? 'missing' : 'invalid'} client exit status\n`,
      );
    }),
  );

for (const value of ['0 \n', ' 0\n', '0\r\n'])
  test(
    `client status rejects whitespace ${JSON.stringify(value)}`,
    withFixture(async (f) => {
      await f.write('no-shell.status', value);
      const actual = await checkCustomArtifacts(f.dir, {
        name: 'no-shell',
        marker: 'CUSTOM_FROM_ROOT',
        checkout: f.dir,
        reads: 1,
      });
      expect(actual).toEqual({ code: 2, stdout: 'ERROR: no-shell: invalid client exit status\n' });
    }),
  );

test('native worktree replay permits string user message content', () => {
  const f = customTranscript('enter-worktree');
  f.rows.unshift({
    type: 'user',
    session_id: 'fixture-session',
    message: { role: 'user', content: 'Enter the existing lane.' },
  });
  expect(evaluateCustom(f.spec, f.rows, f)).toEqual([]);
});
