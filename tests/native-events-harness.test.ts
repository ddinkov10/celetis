import { expect, test } from 'bun:test';
import { customTranscript, sha256, textRow } from './lib/custom-fixture.ts';
import { evaluateCustom } from './manual/custom-entry-checks.ts';
import { projectEvents } from './manual/native-entry-events.ts';

const origin = { plugin: 'celetis', tier: 'user' };
function observation(event: string, id: string | number, input: any, result: any = null) {
  return {
    type: 'system',
    subtype: 'ui_log',
    plugin: 'celetis-entry-observer',
    session_id: 'fixture',
    text: JSON.stringify({ event, id, input, result, origin }),
  };
}
function read(id: string, path: string, source: string) {
  const input = { tool: 'Read', tool_use_id: id, file_path: path };
  return [
    observation('tool.start', id, input),
    observation('tool.result', id, input, {
      result: {
        type: 'text',
        file: { filePath: path, contentSha256: sha256(source), startLine: 1, numLines: 2, totalLines: 2 },
      },
    }),
  ];
}
function metadata(id: number, path: string, kind: string) {
  const input = { path };
  return [
    observation('fs.stat.start', id, input),
    observation('fs.stat.result', id, input, { value: { kind, isLink: false } }),
  ];
}
const regularFaults = [
  'valid',
  'missing-host-hash',
  'bad-host-hash',
  'missing-config-hash',
  'bad-config-hash',
  'wrong-read-path',
  'missing-meta-start',
  'late-metadata',
  'wrong-meta-path',
  'wrong-result-id',
  'fake-observer',
  'missing-counts',
  'token-cap',
];
for (const fault of regularFaults)
  test(`native projection regular ${fault}`, () => {
    const f = customTranscript('no-shell');
    const p = f.spec.config.path,
      host = `${f.spec.plugin}/docs/hosts/entry.md`;
    const answer = 'scripts/celetis --agent claude next-step <#>\nCUSTOM_FROM_ROOT';
    let rows: any[] = [
      ...read('host', host, 'Host entry'),
      ...metadata(1, `${f.checkout}/.git`, 'dir'),
      ...metadata(2, p, 'file'),
      ...read('config', p, f.spec.config.source),
      textRow(answer),
      { type: 'result', subtype: 'success', is_error: false, result: answer, permission_denials: [] },
    ];
    for (const row of rows)
      if (row.subtype === 'ui_log') {
        const d = JSON.parse(row.text);
        if (d.event === 'tool.result') {
          const file = d.result.result.file;
          if (
            (fault === 'missing-host-hash' && d.id === 'host') ||
            (fault === 'missing-config-hash' && d.id === 'config')
          )
            delete file.contentSha256;
          if ((fault === 'bad-host-hash' && d.id === 'host') || (fault === 'bad-config-hash' && d.id === 'config'))
            file.contentSha256 = '0'.repeat(64);
          if (fault === 'wrong-read-path' && d.id === 'config') file.filePath += '.other';
          if (fault === 'missing-counts' && d.id === 'config') delete file.numLines;
          if (fault === 'token-cap' && d.id === 'config') file.truncatedByTokenCap = true;
          if (fault === 'wrong-result-id' && d.id === 'config') d.id = 'other';
        }
        if (fault === 'wrong-meta-path' && d.event === 'fs.stat.result' && d.id === 2) d.input.path += '.other';
        row.text = JSON.stringify(d);
        if (fault === 'fake-observer') row.plugin = 'model-claim';
      }
    if (fault === 'missing-meta-start')
      rows = rows.filter(
        (row) =>
          !(
            row.subtype === 'ui_log' &&
            JSON.parse(row.text).event === 'fs.stat.start' &&
            JSON.parse(row.text).id === 2
          ),
      );
    if (fault === 'late-metadata')
      rows = [...rows.slice(0, 4), ...rows.slice(6, 8), ...rows.slice(4, 6), ...rows.slice(8)];
    expect(evaluateCustom(f.spec, projectEvents(rows), f).length === 0).toBe(fault === 'valid');
  });
for (const family of ['absent', 'denied'])
  for (const fault of family === 'absent'
    ? ['good', 'no-result', 'wrong-id', 'non-enoent', 'early-text', 'wrong-origin', 'wrong-path']
    : [
        'good',
        'no-result',
        'wrong-id',
        'wrong-path',
        'not-permission',
        'model-claim',
        'later-read',
        'missing-start',
        'not-error',
      ])
    test(`native projection ${family} ${fault}`, () => {
      const f = customTranscript(family === 'absent' ? 'missing' : 'denied-read');
      const p = f.spec.config.path,
        host = `${f.spec.plugin}/docs/hosts/entry.md`;
      const rows: any[] = [...read('host', host, 'Host entry'), ...metadata(1, `${f.checkout}/.git`, 'dir')];
      let answer = 'scripts/celetis --agent claude next-step <#>';
      if (family === 'absent') {
        const input = { path: p },
          record: any = { event: 'fs.stat.result', id: 2, input, result: { deny: 'Error: fs.stat: ENOENT' }, origin };
        if (fault === 'wrong-id') record.id = 3;
        if (fault === 'wrong-origin') record.origin = { plugin: 'other' };
        if (fault === 'wrong-path') record.input.path += '.other';
        if (fault === 'non-enoent') record.result.deny = 'Error: fs.stat: EACCES';
        rows.push(observation('fs.stat.start', 2, { path: p }));
        if (fault === 'early-text') rows.push(textRow('Checking the config.'));
        if (fault !== 'no-result') rows.push({ ...observation('', 2, {}), text: JSON.stringify(record) });
      } else {
        rows.push(...metadata(2, p, 'file'));
        const input = { tool: 'Read', tool_use_id: 'config', file_path: p };
        const record: any = {
          event: 'tool.result',
          id: 'config',
          input,
          result: {
            result: 'Error: File is in a directory that is denied by your permission settings.',
            text: '<tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>',
            isError: true,
          },
          origin,
        };
        if (fault === 'wrong-id') record.id = 'other';
        if (fault === 'wrong-path') record.input.file_path += '.other';
        if (fault === 'not-permission') {
          record.result.result = 'Unrelated error';
          record.result.text = 'Data validation denied';
        }
        if (fault === 'not-error') record.result.isError = false;
        if (fault !== 'missing-start')
          rows.push(observation('tool.start', 'config', { tool: 'Read', tool_use_id: 'config', file_path: p }));
        if (fault !== 'no-result')
          rows.push({
            ...observation('', 0, {}),
            plugin: fault === 'model-claim' ? 'model-claim' : 'celetis-entry-observer',
            text: JSON.stringify(record),
          });
        if (fault === 'later-read') rows.push(...read('retry', `${p}.other`, f.spec.config.source));
        answer = 'The config read was denied. Entry stopped.';
      }
      rows.push(textRow(answer), {
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: answer,
        permission_denials: [],
      });
      expect(evaluateCustom(f.spec, projectEvents(rows), f).length === 0).toBe(fault === 'good');
    });

test('projectEvents retains native IDs, compact results, denials, and deduplicates ordinary calls', () => {
  const input: any[] = [
    observation('tool.start', 'read', { tool: 'Read', tool_use_id: 'read', file_path: '/file', agentId: 'child' }),
    observation(
      'tool.result',
      'read',
      { tool: 'Read', tool_use_id: 'read', file_path: '/file', agentId: 'child' },
      { result: 'exact denial', text: 'Permission denied', isError: true },
    ),
    observation(
      'tool.check',
      'read',
      { tool_use_id: 'read', input: { file_path: '/file' } },
      { decision: 'deny', reason: 'Permission denied', rule: 'Read(/file)' },
    ),
    {
      type: 'result',
      permission_denials: [{ tool_name: 'Read', tool_use_id: 'read', tool_input: { file_path: '/file' } }],
    },
  ];
  const expectedEvents = [
    {
      type: 'assistant',
      native: true,
      session_id: 'fixture',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'read', name: 'Read', input: { file_path: '/file' } }],
      },
    },
    {
      type: 'user',
      native: true,
      session_id: 'fixture',
      tool_use_result: 'exact denial',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'read', is_error: true, content: 'Permission denied' }],
      },
    },
    { type: 'native_denial', id: 'read', path: '/file', reason: 'Permission denied', rule: 'Read(/file)' },
    {
      type: 'result',
      permission_denials: [{ tool_name: 'Read', tool_use_id: 'read', tool_input: { file_path: '/file' } }],
    },
  ];
  expect(projectEvents(input)).toEqual(expectedEvents);
  const ordinary = {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id: 'read', name: 'Read', input: { file_path: '/file' } }] },
  };
  expect(projectEvents([ordinary, ...input.slice(0, 2)])).toEqual([ordinary, ...input.slice(0, 2)]);
});
for (const fault of ['origin', 'session', 'input', 'later-start', 'malformed'])
  test(`projector rejects an unmatched ${fault} observation`, () => {
    const start = observation('tool.start', 'read', { tool: 'Read', tool_use_id: 'read', file_path: '/file' }),
      result = observation(
        'tool.result',
        'read',
        { tool: 'Read', tool_use_id: 'read', file_path: '/file' },
        { text: 'native' },
      );
    if (fault === 'origin') {
      const d = JSON.parse(result.text);
      d.origin = { plugin: 'other' };
      result.text = JSON.stringify(d);
    }
    if (fault === 'session') result.session_id = 'other';
    if (fault === 'input') {
      const d = JSON.parse(result.text);
      d.input.file_path = '/other';
      result.text = JSON.stringify(d);
    }
    if (fault === 'malformed') result.text = '{';
    const rows = fault === 'later-start' ? [result, start] : [start, result];
    expect(projectEvents(rows)).toContainEqual(result);
  });
