import { createHash } from 'node:crypto';

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
export const recording =
  'For test evidence only, emit each actual lstat result as JSON with its absolute path and boolean file, directory, and symlink fields from isFile(), isDirectory(), and isSymbolicLink() on that result. For an actual ENOENT error, emit its exact path and code.';
export const customNames = [
  'no-shell',
  'ask-cat',
  'deny-cat',
  'ask-git',
  'deny-git',
  'subfolder',
  'worktree',
  'outside',
  'missing',
  'missing-lane',
  'enter-worktree',
  'denied-read',
  'malformed',
  'duplicate-key',
  'wrong-type',
  'folded',
  'ambiguous',
  'unknown-field',
  'symlink',
  'missing-custom',
  'empty-custom',
  'empty-instruction',
  'handoff',
  'borrowed',
];
export const deniedFaults = [
  'unrelated-block',
  'wrong-path',
  'missing-denial',
  'wrong-denial-id',
  'wrong-result-id',
  'missing-error',
  'read-succeeded',
  'later-read',
  'later-grep',
  'later-shell',
];
export const customFaults = [
  'bootstrap-wrong-path',
  'bootstrap-product-first',
  'bootstrap-product-skill',
  'success-wrong-path',
  'success-extra-read',
  'success-bare-command',
  'success-unrelated',
  'success-setup',
  'success-missing-result',
  'success-result-error',
  'startup-text',
  'startup-optional-text',
  'startup-borrowed-text',
  'startup-handoff-text',
  'invalid-continues',
  'invalid-missing-field',
  'invalid-missing-stop',
  'invalid-missing-validity',
  'git-directory-read',
  'git-file-early-read',
  'git-file-missing-kind',
  'worktree-session',
  'worktree-pre-entry-read',
  'metadata-missing',
  'metadata-missing-result',
  'metadata-wrong-id',
  'metadata-wrong-path',
  'metadata-string-only',
  'metadata-map-wrong-path',
  'metadata-map-missing-path',
  'metadata-map-wrong-kind',
  'metadata-map-missing-kind',
  'metadata-map-symlink',
  'metadata-relative-wrong-base',
  'metadata-relative-decoy-root',
  'metadata-relative-wrong-path',
  'metadata-relative-wrong-operand',
  'metadata-relative-wrong-kind',
  'metadata-relative-missing-link',
  'metadata-relative-symlink',
  'metadata-object-wrong-path',
  'metadata-object-missing-link',
  'metadata-object-symlink',
  'metadata-tuple-wrong-base',
  'metadata-tuple-wrong-path',
  'metadata-tuple-wrong-kind',
  'metadata-decoy-record',
  'metadata-missing-decoy-error',
  'metadata-symlink-bypass',
  'metadata-error',
  'metadata-late',
  'metadata-node-content',
  'metadata-node-process',
  'metadata-node-parser',
  'cache-without-prior-content',
  'cache-wrong-path',
  'handoff-missing-marker',
  'handoff-duplicate-marker',
  'handoff-unrelated-marker',
  'borrowed-reread',
  'symlink-followed',
];
export const boundFaults = [
  'absent',
  'mismatched',
  'error',
  'stale-session',
  'stale-binding',
  'old-result-after-transition',
  'missing-config-kind',
  'late-config-kind',
  'symlink-config',
];
export const schemaFaults = [
  'good',
  'missing-path',
  'missing-field',
  'missing-validity',
  'missing-stop',
  'affirmative',
  'contradictory',
  'continued-goal',
];
export const statusFaults = ['missing', 'empty', 'word', 'negative', 'range', 'multiline'];
export function faultTarget(fault: string) {
  if (fault === 'startup-optional-text' || fault === 'metadata-missing-decoy-error') return 'missing';
  if (fault.includes('borrowed') || fault.startsWith('cache-')) return 'borrowed';
  if (fault.includes('handoff')) return 'handoff';
  if (fault.startsWith('git-file-') || fault.startsWith('worktree-')) return 'enter-worktree';
  if (fault.startsWith('invalid-')) return 'malformed';
  if (fault === 'symlink-followed') return 'symlink';
  return 'no-shell';
}
export const textRow = (text: string) => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
export const callRow = (id: string, name: string, input: any, session_id?: string) => ({
  type: 'assistant',
  session_id,
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
  parent_tool_use_id: null,
});
export const replyRow = (id: string, content: any, extra: any = {}) => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] },
  parent_tool_use_id: null,
  ...extra,
});
export const part = (row: any) => row.message?.content?.[0];
export function metadataRows(path: string, kind: string, id: string, style = ''): any[] {
  const name = path.slice(path.lastIndexOf('/') + 1),
    base = path.slice(0, path.lastIndexOf('/'));
  const flags = { file: kind === 'file', dir: kind === 'directory', link: kind === 'symlink' };
  let value: any =
    kind === 'missing'
      ? { path, code: 'ENOENT' }
      : { path, file: flags.file, directory: flags.dir, symlink: flags.link };
  let code = `var metadata = await (await import("node:fs/promises")).lstat(${JSON.stringify(path)});`;
  if (style.startsWith('relative')) {
    code = `var fs=await import("node:fs/promises"); var root=${JSON.stringify(base)}; var out={}; for (const p of [${JSON.stringify(name)}]) { var s=await fs.lstat(${style === 'relative-template' ? `\`\${root}/\${p}\`` : 'root+"/"+p'}); }`;
    value = {
      [name]:
        style === 'relative-map'
          ? kind === 'directory'
            ? 'dir'
            : kind === 'missing'
              ? 'ENOENT'
              : kind
          : kind === 'missing'
            ? 'ENOENT'
            : flags,
    };
  } else if (style === 'path-map')
    value = { [path]: kind === 'directory' ? 'dir' : kind === 'missing' ? 'error: ENOENT' : kind };
  else if (style === 'path-object') value = { [path]: kind === 'missing' ? { code: 'ENOENT' } : flags };
  else if (style === 'tuple') value = [base, name, kind === 'directory' ? 'dir' : kind === 'missing' ? 'ENOENT' : kind];
  return [callRow(id, 'mcp__node_repl__js', { code }), replyRow(id, [{ type: 'text', text: JSON.stringify(value) }])];
}
export function customTranscript(
  name: string,
  options: { style?: string; fault?: string; spec?: any; bound?: boolean; syntax?: boolean } = {},
) {
  const root = '/fixture/project',
    lane = `${root}/.claude/worktrees/lane`;
  const checkout =
    name === 'outside'
      ? ''
      : ['worktree', 'enter-worktree'].includes(name)
        ? lane
        : ['no-shell', 'ask-cat', 'deny-cat', 'ask-git', 'deny-git', 'subfolder', 'denied-read'].includes(name)
          ? root
          : `/fixture/${name}`;
  const plugin = '/fixture/plugin',
    path = checkout ? `${checkout}/.celetis.yaml` : '';
  const empty = ['outside', 'missing', 'missing-lane', 'symlink'].includes(name);
  const invalid = [
    'malformed',
    'duplicate-key',
    'wrong-type',
    'folded',
    'ambiguous',
    'unknown-field',
    'symlink',
    'null-config',
  ].includes(name);
  const field = ['malformed', 'ambiguous', 'symlink', 'null-config'].includes(name)
    ? '<document>'
    : name === 'unknown-field'
      ? 'custom.unknown'
      : 'custom.guide';
  const markers =
    name === 'handoff'
      ? 'CUSTOM_FROM_ROOT\nCUSTOM_HANDOFF_WRITING'
      : name === 'borrowed'
        ? 'CUSTOM_BORROWED_LESSON\nCUSTOM_BORROWED_REVIEW'
        : ['worktree', 'enter-worktree'].includes(name)
          ? 'CUSTOM_FROM_LANE'
          : ['no-shell', 'ask-cat', 'deny-cat', 'ask-git', 'deny-git', 'subfolder'].includes(name)
            ? 'CUSTOM_FROM_ROOT'
            : '';
  const count = empty ? 0 : ['handoff', 'borrowed'].includes(name) ? 2 : 1;
  const source = `landing: pr\nworktreeSetup: |-\n  SETUP_MUST_NOT_RUN\ncustom:\n  guide: Include ${markers}\n  bug: UNRELATED_CUSTOM_MUST_NOT_RUN\n`;
  const spec: any = options.spec ?? {
    cwd: name === 'subfolder' ? `${root}/sub` : checkout,
    plugin,
    pluginSources: [{ path: `${plugin}/docs/hosts/entry.md`, sha256: sha256('Host entry') }],
    config: {
      path,
      source,
      sha256: sha256(source),
      kind: name === 'symlink' ? 'symlink' : empty ? 'missing' : 'regular',
    },
    git: {
      path: `${checkout}/.git`,
      kind: name.includes('worktree') || name === 'worktree' || name === 'missing-lane' ? 'file' : 'directory',
    },
  };
  const p = spec.config.path,
    checkedRoot = p.replace(/\/.celetis.yaml$/, '');
  const kind = spec.config.kind === 'regular' ? 'file' : spec.config.kind;
  let answer = invalid
    ? `${options.syntax ? 'Config' : 'Invalid'} ${p} ${options.syntax ? 'has a syntax error' : 'at'} ${field}. Entry stopped.`
    : `scripts/celetis --agent claude next-step${markers ? `\n${markers}` : ''}`;
  if (name === 'denied-read') answer = 'The config read was denied. Entry stopped.';
  const result = () => ({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: answer.replace('\nCUSTOM_HANDOFF_WRITING', ''),
    permission_denials:
      name === 'denied-read' ? [{ tool_name: 'Read', tool_use_id: 'read-1', tool_input: { file_path: p } }] : [],
    session_id: 'fixture-session',
  });
  const read = (id: string) => callRow(id, 'Read', { file_path: p });
  const reply = (id: string) =>
    replyRow(id, spec.config.source, {
      tool_use_result: {
        type: 'text',
        file: { filePath: p, content: spec.config.source, startLine: 1, numLines: 1, totalLines: 1 },
      },
    });
  let rows: any[] = [];
  if (name === 'enter-worktree')
    rows.push(
      callRow('enter-setup', 'EnterWorktree', { path: checkedRoot }, 'fixture-session'),
      replyRow('enter-setup', checkedRoot, {
        session_id: 'fixture-session',
        tool_use_result: { worktreePath: checkedRoot, worktreeBranch: 'lane' },
      }),
      { type: 'result', subtype: 'success', is_error: false, result: 'Entered lane.', session_id: 'fixture-session' },
    );
  for (let i = 0; i < Math.max(count, 1); i++) {
    if (i === 1)
      rows.push(
        callRow('skill-2', 'Read', {
          file_path: `${spec.plugin}/skills/${name === 'borrowed' ? 'lesson' : 'guide'}/SKILL.md`,
        }),
        replyRow('skill-2', 'Bundled skill'),
      );
    if (i === 0 || name !== 'borrowed')
      rows.push(
        callRow(`host-${i + 1}`, 'Read', { file_path: `${spec.plugin}/docs/hosts/entry.md` }),
        replyRow(
          `host-${i + 1}`,
          'Host entry',
          i === 0
            ? {}
            : { tool_use_result: { type: 'file_unchanged', file: { filePath: `${spec.plugin}/docs/hosts/entry.md` } } },
        ),
      );
    if (p) {
      if (!options.bound)
        rows.push(...metadataRows(`${checkedRoot}/.git`, spec.git.kind, `git-${i + 1}`, options.style));
      rows.push(
        ...metadataRows(
          p,
          kind,
          `meta-${i + 1}`,
          options.fault?.startsWith('metadata-relative-') ? 'relative' : options.style,
        ),
      );
    }
    if (i < count) {
      rows.push(read(`read-${i + 1}`));
      if (name === 'denied-read') rows.push(replyRow('read-1', `Permission to use Read has been denied for ${p}`));
      else
        rows.push(
          i === 0
            ? reply('read-1')
            : replyRow(
                'read-2',
                'Wasted call — file unchanged since your last Read. Refer to that earlier tool_result instead.',
                { tool_use_result: { type: 'file_unchanged', file: { filePath: p } } },
              ),
        );
      if (name === 'denied-read') part(rows.at(-1)).is_error = true;
    }
    if (i === 0 && name === 'handoff') rows.push(textRow('CUSTOM_HANDOFF_WRITING'));
  }
  rows.push(result());
  const fault = options.fault ?? '';
  const find = (id: string, reply = false) => rows.find((row) => part(row)?.[reply ? 'tool_use_id' : 'id'] === id);
  const meta = () => find('meta-1', true),
    metaCall = () => find('meta-1');
  const changeMeta = (value: any) => {
    part(meta()).content[0].text = JSON.stringify(value);
  };
  const currentMeta = () => JSON.parse(part(meta()).content[0].text);
  const insert = (at: number, ...items: any[]) => {
    rows.splice(at, 0, ...items);
  };
  const firstRead = () => rows.findIndex((row) => part(row)?.id === 'read-1');
  const last = () => rows.at(-1);
  const tailText = (text: string) => {
    last().result += text;
  };
  if (fault === 'bootstrap-wrong-path')
    for (const row of rows) {
      if (part(row)?.input?.file_path === `${spec.plugin}/docs/hosts/entry.md`)
        part(row).input.file_path = `${spec.plugin}/skills/docs/hosts/entry.md`;
    }
  else if (fault === 'bootstrap-product-first' || fault === 'bootstrap-product-skill')
    rows.unshift(
      callRow('scan-1', fault.endsWith('skill') ? 'Read' : 'Glob', {
        file_path: `${checkedRoot}/SKILL.md`,
        path: checkedRoot,
        pattern: '.git',
      }),
    );
  else if (fault === 'success-missing-result') rows = rows.filter((row) => row.type !== 'user');
  else if (fault === 'success-result-error')
    for (const row of rows) {
      if (row.type === 'user') part(row).is_error = true;
    }
  else if (fault === 'success-wrong-path')
    for (const row of rows) {
      if (part(row)?.input?.file_path) part(row).input.file_path += '.other';
    }
  else if (fault === 'success-extra-read' || fault === 'borrowed-reread')
    rows.unshift(read('extra-read'), reply('extra-read'));
  else if (fault === 'startup-text' || fault === 'startup-optional-text')
    insert(2, textRow('Now checking startup metadata.'));
  else if (fault === 'startup-borrowed-text' || fault === 'startup-handoff-text')
    insert(
      rows.findIndex((row) => part(row)?.id === 'read-2'),
      textRow('Now reading the second entry config.'),
    );
  else if (fault === 'git-directory-read')
    insert(4, callRow('git-read', 'Read', { file_path: `${checkedRoot}/.git` }), replyRow('git-read', 'EISDIR'));
  else if (fault === 'git-file-early-read' || fault === 'git-file-missing-kind') {
    if (fault.endsWith('missing-kind')) {
      const row = find('git-1', true);
      const value = JSON.parse(part(row).content[0].text);
      delete value.file;
      part(row).content[0].text = JSON.stringify(value);
    }
    insert(
      fault.endsWith('early-read') ? 5 : 7,
      callRow('git-read', 'Read', { file_path: `${checkedRoot}/.git` }),
      replyRow('git-read', 'gitdir: /shared'),
    );
  } else if (fault === 'metadata-missing')
    rows = rows.filter((row) => part(row)?.id !== 'meta-1' && part(row)?.tool_use_id !== 'meta-1');
  else if (fault === 'metadata-missing-result') rows = rows.filter((row) => part(row)?.tool_use_id !== 'meta-1');
  else if (fault === 'metadata-wrong-id') part(meta()).tool_use_id = 'meta-other';
  else if (fault === 'metadata-wrong-path') {
    part(metaCall()).input.code = part(metaCall()).input.code.replaceAll(p, `${p}.other`);
    changeMeta({ ...currentMeta(), path: `${p}.other` });
  } else if (fault === 'metadata-string-only') part(meta()).content[0].text = `lstat ${p}`;
  else if (fault === 'metadata-map-missing-path') changeMeta({});
  else if (fault.startsWith('metadata-map-'))
    changeMeta({
      [fault.endsWith('wrong-path') ? `${p}.other` : p]: fault.endsWith('wrong-kind')
        ? 'dir'
        : fault.endsWith('missing-kind')
          ? null
          : fault.endsWith('symlink')
            ? 'symlink'
            : 'file',
    });
  else if (['metadata-relative-wrong-base', 'metadata-relative-decoy-root'].includes(fault)) {
    part(metaCall()).input.code = part(metaCall()).input.code.replaceAll(checkedRoot, '/wrong-checkout');
    if (fault.endsWith('decoy-root')) part(metaCall()).input.code += ` var decoy=${JSON.stringify(checkedRoot)};`;
  } else if (fault === 'metadata-relative-wrong-path')
    part(metaCall()).input.code = part(metaCall()).input.code.replaceAll('.celetis.yaml', 'other.yaml');
  else if (fault === 'metadata-relative-wrong-operand')
    part(metaCall()).input.code = part(metaCall()).input.code.replace('root+"/"+p', '"/wrong-checkout/"+p');
  else if (fault.startsWith('metadata-relative-')) {
    const value = currentMeta();
    if (fault.endsWith('wrong-kind')) value['.celetis.yaml'].file = false;
    else if (fault.endsWith('missing-link')) delete value['.celetis.yaml'].link;
    else value['.celetis.yaml'].link = true;
    changeMeta(value);
  } else if (fault.startsWith('metadata-object-'))
    changeMeta({
      [fault.endsWith('wrong-path') ? `${p}.other` : p]: {
        file: true,
        ...(fault.endsWith('missing-link') ? {} : { link: fault.endsWith('symlink') }),
      },
    });
  else if (fault.startsWith('metadata-tuple-'))
    changeMeta([
      fault.endsWith('wrong-base') ? '/wrong-checkout' : checkedRoot,
      fault.endsWith('wrong-path') ? 'other.yaml' : '.celetis.yaml',
      fault.endsWith('wrong-kind') ? 'dir' : 'file',
    ]);
  else if (fault === 'metadata-decoy-record')
    changeMeta([{ path: p }, { path: `${p}.other`, file: true, link: false }]);
  else if (fault === 'metadata-missing-decoy-error')
    changeMeta([
      { path: p, code: 'EACCES' },
      { path: `${p}.other`, code: 'ENOENT' },
    ]);
  else if (fault === 'metadata-symlink-bypass') changeMeta({ ...currentMeta(), symlink: true });
  else if (fault === 'metadata-error') Object.assign(part(meta()), { is_error: true, content: `EACCES ${p}` });
  else if (fault === 'metadata-late') {
    const index = rows.indexOf(meta());
    const [row] = rows.splice(index, 1);
    insert(firstRead() + 2, row);
  } else if (fault === 'metadata-node-content') part(metaCall()).input.code += ' await fs.readFile(".celetis.yaml");';
  else if (fault === 'metadata-node-process') part(metaCall()).input.code += ' await import("node:child_process");';
  else if (fault === 'metadata-node-parser') part(metaCall()).input.code += ' yaml.parse("landing: pr");';
  else if (fault === 'success-bare-command')
    last().result = last().result.replace('scripts/celetis --agent claude', 'scripts/celetis');
  else if (fault === 'worktree-session') last().session_id = 'other-session';
  else if (fault === 'worktree-pre-entry-read') insert(2, read('early-read'));
  else if (fault === 'success-unrelated') tailText('\nUNRELATED_CUSTOM_MUST_NOT_RUN');
  else if (fault === 'success-setup') tailText('\nSETUP_MUST_NOT_RUN');
  else if (fault === 'invalid-continues') last().result = 'scripts/celetis --agent claude next-step';
  else if (fault === 'invalid-missing-field') last().result = last().result.replace(` at ${field}`, '');
  else if (fault === 'invalid-missing-stop') last().result = last().result.replace(' Entry stopped.', '');
  else if (fault === 'invalid-missing-validity') last().result = last().result.replace('Invalid ', 'Config ');
  else if (fault === 'handoff-missing-marker')
    rows = rows.filter((row) => part(row)?.text !== 'CUSTOM_HANDOFF_WRITING');
  else if (fault === 'handoff-duplicate-marker' || fault === 'handoff-unrelated-marker')
    part(rows.find((row) => part(row)?.text === 'CUSTOM_HANDOFF_WRITING')).text += fault.endsWith('duplicate-marker')
      ? '\nCUSTOM_HANDOFF_WRITING'
      : '\nUNRELATED_CUSTOM_MUST_NOT_RUN';
  else if (fault === 'cache-without-prior-content')
    find('read-1', true).tool_use_result = { type: 'file_unchanged', file: { filePath: p } };
  else if (fault === 'cache-wrong-path')
    for (const row of rows) {
      if (row.tool_use_result?.type === 'file_unchanged') row.tool_use_result.file.filePath += '.other';
    }
  else if (fault === 'symlink-followed') insert(rows.length - 1, read('read-1'), reply('read-1'));
  if (name === 'denied-read' && deniedFaults.includes(fault)) {
    const call = find('read-1'),
      denied = find('read-1', true);
    if (fault === 'unrelated-block') {
      rows = rows.filter((row) => row !== call && row !== denied);
      last().permission_denials = [];
      last().result = 'Cannot read the setup file. Entry stopped.';
    } else if (fault === 'wrong-path') {
      part(call).input.file_path += '.other';
      last().permission_denials[0].tool_input.file_path += '.other';
    } else if (fault === 'missing-denial') last().permission_denials = [];
    else if (fault === 'wrong-denial-id') last().permission_denials[0].tool_use_id = 'other-read';
    else if (fault === 'wrong-result-id') part(denied).tool_use_id = 'other-read';
    else if (fault === 'missing-error') part(denied).content = 'unrelated error';
    else if (fault === 'read-succeeded') Object.assign(denied, reply('read-1'));
    else if (fault.startsWith('later-'))
      insert(
        rows.length - 1,
        callRow('read-2', fault === 'later-read' ? 'Read' : fault === 'later-grep' ? 'Grep' : 'Bash', {
          file_path: p,
          path: p,
          command: `cat ${p}`,
        }),
      );
  }
  rows = rows.flatMap((row) =>
    row.type === 'result' && row.result !== 'Entered lane.' ? [textRow(row.result), row] : [row],
  );
  return {
    spec,
    rows,
    marker: name === 'denied-read' ? 'blocked' : invalid ? 'invalid' : markers,
    checkout: checkedRoot,
    reads: count,
    lane: checkedRoot,
    name,
  };
}
