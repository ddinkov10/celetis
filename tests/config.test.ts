import { expect, test } from 'bun:test';
import fs from 'node:fs';
import { chmod, cp, mkdir, readdir, readFile, rename, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigError, readConfig } from '../scripts/lib/config.ts';
import { command, isolatedArgs, reader, root, withFixture } from './lib/fixture.ts';

const minimal = '{"host":"codex","landing":"pr","board":{"port":4404}}';
const validCases: [string, string, string][] = [
  ['minimal_config', 'host: codex\nlanding: pr\nboard:\n  port: 4404\n', minimal],
  ['comments', '# Repository defaults.\nhost: codex # Selected host.\nlanding: pr\nboard:\n  port: 4404\n', minimal],
  ['no_reader_defaults', 'landing: merge\n', '{"landing":"merge"}'],
  [
    'yaml_1_2_strings',
    '%YAML 1.2\n---\nlanding: pr\nworktreeSetup: yes\ncustom:\n  bug: on\n',
    '{"landing":"pr","worktreeSetup":"yes","custom":{"bug":"on"}}',
  ],
  ['literal_ends_the_file', 'landing: pr\ncustom:\n  bug: |\n    Keep', '{"landing":"pr","custom":{"bug":"Keep"}}'],
  [
    'literal_keep_ends_the_file',
    'landing: pr\ncustom:\n  bug: |+\n    Keep',
    '{"landing":"pr","custom":{"bug":"Keep"}}',
  ],
  [
    'literal_spaces_end_the_file',
    'landing: pr\ncustom:\n  bug: |\n    Keep\n      ',
    '{"landing":"pr","custom":{"bug":"Keep\\n  "}}',
  ],
  [
    'literal_indent_ends_the_file',
    'landing: pr\ncustom:\n  bug: |\n    Keep\n    ',
    '{"landing":"pr","custom":{"bug":"Keep\\n"}}',
  ],
  [
    'literal_carriage_return_ends_the_file',
    'landing: pr\ncustom:\n  bug: |\n    Keep\r',
    '{"landing":"pr","custom":{"bug":"Keep\\n"}}',
  ],
  [
    'quoted_break_ends_the_file',
    'landing: pr\ncustom:\n  bug: "Keep\\n"',
    '{"landing":"pr","custom":{"bug":"Keep\\n"}}',
  ],
  [
    'literal_tab_after_indent',
    'landing: pr\ncustom:\n  bug: |\n    \ta\n',
    '{"landing":"pr","custom":{"bug":"\\ta\\n"}}',
  ],
  [
    'empty_optional_values',
    'landing: pr\nworktreeSetup: ""\ngates: {}\nboard: {}\ncustom: {}\ncodexProfiles: {}\n',
    '{"landing":"pr","worktreeSetup":"","gates":{},"board":{},"custom":{},"codexProfiles":{}}',
  ],
  ['document_start_alone', '---\nhost: codex\nlanding: pr\n', '{"host":"codex","landing":"pr"}'],
  ['leading_zero_port_without_8_or_9', 'landing: pr\nboard: {port: 04404}\n', '{"landing":"pr","board":{"port":4404}}'],
  [
    'quoted_yaml_1_1_number',
    "landing: pr\ncustom: {bug: '1_000', plan: !!str 0b101}\n",
    '{"landing":"pr","custom":{"bug":"1_000","plan":"0b101"}}',
  ],
  ['leading_underscore_text', 'landing: pr\ncustom: {bug: _1}\n', '{"landing":"pr","custom":{"bug":"_1"}}'],
  [
    'yaml_1_1_directive_keeps_strings',
    '%YAML 1.1\n---\nlanding: pr\nworktreeSetup: yes\n',
    '{"landing":"pr","worktreeSetup":"yes"}',
  ],
];

for (const port of [4403, 65535]) {
  validCases.push([
    `integer_port_${port}`,
    `landing: pr\nboard: {port: ${port}}\n`,
    `{"landing":"pr","board":{"port":${port}}}`,
  ]);
}

for (const [name, source, json] of validCases) {
  test(
    name,
    withFixture(async (f) => {
      await f.config(source);
      expect(readConfig(f.repo)).toEqual(JSON.parse(json));
      expect(await f.bun(reader, [f.repo])).toEqual({ code: 0, stdout: `${json}\n`, stderr: '' });
    }),
  );
}

const invalidCases: [string, string | Uint8Array, string][] = [
  ['empty_config', '', '<document>'],
  ['malformed_yaml', 'landing: [pr\n', '<document>'],
  ['two_documents', 'landing: pr\n---\nlanding: merge\n', '<document>'],
  ['empty_second_document', 'landing: pr\n---\n', '<document>'],
  ['bom_directive_after_end', 'landing: pr\n...\n\uFEFF%YAML 1.2\n', '<document>: need one YAML document'],
  ['sequence_root', '- landing\n- pr\n', '<document>'],
  ['null_root', 'null\n', '<document>'],
  ['duplicate_root', 'landing: pr\nlanding: merge\n', 'landing'],
  ['duplicate_nested', 'landing: pr\nboard: {port: 4403, port: 4404}\n', 'board.port'],
  [
    'duplicate_profile',
    'landing: pr\ncodexProfiles:\n  desktop:\n    slots: [a, b, c, d]\n    slots: [a, b, c, e]\n    reviewer: {rank: 1, effort: medium}\n',
    'codexProfiles.desktop.slots',
  ],
  ['numeric_key', 'landing: pr\n12: value\n', '12'],
  ['complex_key', 'landing: pr\n? [a, b]\n: value\n', '<document>'],
  ['boolean_key', 'landing: pr\ntrue: value\n', 'true'],
  ['unknown_root', 'landing: pr\nextra: value\n', 'extra'],
  ['unknown_board', 'landing: pr\nboard: {port: 4403, extra: value}\n', 'board.extra'],
  ['unknown_step', 'landing: pr\ngates: {feature: me}\n', 'gates.feature'],
  ['unknown_skill', 'landing: pr\ncustom: {missing: text}\n', 'custom.missing'],
  ['collection_tag_block', 'landing: pr\ngates: !!null\n  plan: me\n', 'gates'],
  [
    'collection_tag_slots',
    'landing: pr\ncodexProfiles: {r: {slots: !!null [a, a, a, a], reviewer: {rank: 1, effort: low}}}\n',
    'codexProfiles.r.slots: unsupported YAML tag',
  ],
  ['invalid_host', 'landing: pr\nhost: other\n', 'host'],
  ['invalid_landing', 'landing: auto\n', 'landing'],
  ['missing_landing', 'host: codex\n', 'landing'],
  ['invalid_gate', 'landing: pr\ngates: {bug: manual}\n', 'gates.bug'],
  ['gate_type', 'landing: pr\ngates: [bug]\n', 'gates'],
  ['board_type', 'landing: pr\nboard: 4403\n', 'board'],
  ['script_array', 'landing: pr\nworktreeSetup: [echo, hi]\n', 'worktreeSetup'],
  ['instruction_array', 'landing: pr\ncustom: {bug: [one, two]}\n', 'custom.bug'],
  ['null_instruction', 'landing: pr\ncustom: {bug: null}\n', 'custom.bug'],
  ['null_gate', 'landing: pr\ngates: {bug: null}\n', 'gates.bug'],
  ['null_port', 'landing: pr\nboard: {port: null}\n', 'board.port'],
  ['custom_type', 'landing: pr\ncustom: [bug]\n', 'custom'],
  ['nul_script', 'landing: pr\nworktreeSetup: "one\\0two"\n', 'worktreeSetup'],
  ['nul_instruction', 'landing: pr\ncustom: {bug: "one\\0two"}\n', 'custom.bug'],
  ['folded_script', 'landing: pr\nworktreeSetup: >\n  echo one\n  echo two\n', 'worktreeSetup'],
  ['folded_instruction', 'landing: pr\ncustom:\n  bug: >-\n    one\n    two\n', 'custom.bug'],
  ['custom_tag', 'landing: pr\nhost: !host codex\n', 'host'],
  ['timestamp_tag', 'landing: pr\ncustom: {bug: 2026-10-16}\n', 'custom.bug'],
  ['binary_tag', 'landing: pr\ncustom: {bug: !!binary SGVsbG8=}\n', 'custom.bug'],
  ['alias_value', 'landing: pr\nworktreeSetup: &selected codex\nhost: *selected\n', 'host'],
  ['merge_key', 'landing: pr\nboard:\n  <<: {port: 4403}\n', 'board'],
  [
    'empty_runtime',
    'landing: pr\ncodexProfiles:\n  "": {slots: [a, b, c, d], reviewer: {rank: 1, effort: medium}}\n',
    'codexProfiles',
  ],
  ['profile_type', 'landing: pr\ncodexProfiles: {desktop: null}\n', 'codexProfiles.desktop'],
  [
    'negative_zero_rank',
    'landing: pr\ncodexProfiles:\n  desktop:\n    slots: [a, b, c, d]\n    reviewer: {rank: -0, effort: medium}\n',
    'codexProfiles.desktop.reviewer.rank: need an integer',
  ],
  [
    'invalid_reviewer_effort',
    'landing: pr\ncodexProfiles:\n  desktop: {slots: [a, b, c, d], reviewer: {rank: 1, effort: max}}\n',
    'codexProfiles.desktop.reviewer.effort',
  ],
  [
    'unknown_reviewer_key',
    'landing: pr\ncodexProfiles:\n  desktop: {slots: [a, b, c, d], reviewer: {rank: 1, effort: medium, extra: x}}\n',
    'codexProfiles.desktop.reviewer.extra',
  ],
  [
    'null_reviewer',
    'landing: pr\ncodexProfiles:\n  desktop: {slots: [a, b, c, d], reviewer: null}\n',
    'codexProfiles.desktop.reviewer',
  ],
  [
    'null_reviewer_effort',
    'landing: pr\ncodexProfiles:\n  desktop: {slots: [a, b, c, d], reviewer: {rank: 1, effort: null}}\n',
    'codexProfiles.desktop.reviewer.effort',
  ],
  [
    'missing_slots',
    'landing: pr\ncodexProfiles:\n  desktop: {reviewer: {rank: 1, effort: medium}}\n',
    'codexProfiles.desktop.slots',
  ],
  [
    'missing_reviewer',
    'landing: pr\ncodexProfiles:\n  desktop: {slots: [a, b, c, d]}\n',
    'codexProfiles.desktop.reviewer',
  ],
  [
    'missing_reviewer_rank',
    'landing: pr\ncodexProfiles:\n  desktop: {slots: [a, b, c, d], reviewer: {effort: medium}}\n',
    'codexProfiles.desktop.reviewer.rank',
  ],
  [
    'missing_reviewer_effort',
    'landing: pr\ncodexProfiles:\n  desktop: {slots: [a, b, c, d], reviewer: {rank: 1}}\n',
    'codexProfiles.desktop.reviewer.effort',
  ],
  [
    'invalid_utf8',
    new Uint8Array([
      ...new TextEncoder().encode('landing: pr\ncustom: {bug: "'),
      255,
      ...new TextEncoder().encode('"}\n'),
    ]),
    '<document>',
  ],
  ['raw_escape', 'landing: pr\ncustom:\n  bug: |\n    a\x1bb\n', '<document>'],
  ['line_separator', 'landing: pr\ncustom:\n  bug: |\n    a\u2028b\n', '<document>'],
  ['underscore_port', 'landing: pr\nboard: {port: 4_404}\n', 'board.port'],
  [
    'underscore_slot',
    'landing: pr\ncodexProfiles: {r: {slots: [1_000, a, a, a], reviewer: {rank: 1, effort: low}}}\n',
    'codexProfiles.r.slots.0',
  ],
  [
    'underscore_runtime_key',
    'landing: pr\ncodexProfiles: {1_000: {slots: [a, a, a, a], reviewer: {rank: 1, effort: low}}}\n',
    'codexProfiles.1_000',
  ],
  [
    'merge_runtime_key',
    'landing: pr\ncodexProfiles:\n  <<: {slots: [a, a, a, a], reviewer: {rank: 1, effort: low}}\n',
    'codexProfiles.<<: mapping keys must be strings',
  ],
  ['merge_value_text', 'landing: pr\ncustom: {bug: <<}\n', 'custom.bug: unsupported YAML tag'],
  ['lone_surrogate', 'landing: pr\ncustom: {bug: "\\ud800"}\n', 'custom.bug: invalid character U+D800'],
];

for (const marker of ['# c', '&r', '!!map']) {
  invalidCases.push([
    `document_start_${marker}`,
    `--- ${marker}\nhost: codex\nlanding: pr\n`,
    '<document>: put nothing after --- on its line',
  ]);
}
for (const directive of ['%YAML 1.2', '%TAG ! tag:x,2026:', '%FOO bar']) {
  invalidCases.push([
    `directive_after_end_${directive}`,
    `landing: pr\n...\n${directive}\n`,
    '<document>: need one YAML document',
  ]);
}
for (const field of ['host', 'landing', 'gates', 'board', 'worktreeSetup', 'custom', 'codexProfiles']) {
  invalidCases.push([`null_${field}`, `${field === 'landing' ? '' : 'landing: pr\n'}${field}: null\n`, field]);
}
for (const port of ['"4403"', 'true', '4403.5', '4403.0', '1023', '65536']) {
  invalidCases.push([`invalid_port_${port}`, `landing: pr\nboard: {port: ${port}}\n`, 'board.port']);
}
for (const port of ['08080', '09999', '+08080']) {
  invalidCases.push([
    `leading_zero_port_${port}`,
    `landing: pr\nboard: {port: ${port}}\n`,
    'board.port: need an integer',
  ]);
}
for (const tag of ['!!null', '!<tag:yaml.org,2002:null>', '!!seq']) {
  invalidCases.push([`collection_tag_${tag}`, `landing: pr\ngates: ${tag} {plan: me}\n`, 'gates']);
}
for (const number of ['.nan', '.inf', '-.Inf']) {
  invalidCases.push([`nonfinite_${number}`, `landing: pr\nboard: {port: ${number}}\n`, 'board.port']);
}
for (const key of ['schema', 'runtime', 'models', 'extra']) {
  invalidCases.push([
    `unknown_profile_${key}`,
    `landing: pr\ncodexProfiles:\n  desktop:\n    slots: [a, b, c, d]\n    reviewer: {rank: 1, effort: medium}\n    ${key}: x\n`,
    `codexProfiles.desktop.${key}`,
  ]);
}
for (const slots of [
  'null',
  '[a, b, c]',
  '[a, b, c, d, e]',
  '[a, b, c, ""]',
  '[a, b, c, true]',
  '[a, b, c, "not a model"]',
  '[a, b, c, "d\\n"]',
]) {
  invalidCases.push([
    `invalid_slots_${slots}`,
    `landing: pr\ncodexProfiles:\n  desktop:\n    slots: ${slots}\n    reviewer: {rank: 1, effort: medium}\n`,
    'codexProfiles.desktop.slots',
  ]);
}
for (const rank of ['null', '"1"', 'true', '1.5', '-1', '4']) {
  invalidCases.push([
    `invalid_reviewer_rank_${rank}`,
    `landing: pr\ncodexProfiles:\n  desktop:\n    slots: [a, b, c, d]\n    reviewer: {rank: ${rank}, effort: medium}\n`,
    'codexProfiles.desktop.reviewer.rank',
  ]);
}
for (const value of ['!!float 12', '!!int abc', '!!bool yes', '!!null abc']) {
  invalidCases.push([`unresolved_tag_${value}`, `landing: pr\ncustom: {bug: ${value}}\n`, 'custom.bug']);
}
for (const [name, value] of [
  ['underscore_text', '1_000'],
  ['binary_text', '0b101'],
  ['upper_hex_text', '0X1A'],
  ['signed_hex_text', '-0x1A'],
  ['underscore_float_text', '1_0.5'],
] as const) {
  invalidCases.push([
    name,
    `landing: pr\ncustom: {bug: ${value}}\n`,
    'custom.bug: quote this value: YAML 1.1 reads it as a number',
  ]);
}

for (const [name, source, field] of invalidCases) {
  test(
    name,
    withFixture(async (f) => {
      await f.config(source);
      expect(() => readConfig(f.repo)).toThrow(ConfigError);
      try {
        readConfig(f.repo);
      } catch (error) {
        expect(`${(error as ConfigError).field}: ${(error as Error).message}`).toContain(field);
      }
      const result = await f.bun(reader, [f.repo]);
      expect(result.code).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(`celetis: ${f.repo}/.celetis.yaml: ${field}`);
      if (field.includes(': ')) expect(result.stderr).toBe(`celetis: ${f.repo}/.celetis.yaml: ${field}\n`);
    }),
  );
}

test(
  'absent_optional_keys',
  withFixture(async (f) => {
    await f.config('host: codex\nlanding: pr\nboard: {port: 4404}\n');
    const config = readConfig(f.repo);
    for (const key of ['gates', 'custom', 'worktreeSetup', 'codexProfiles'])
      expect(Object.hasOwn(config, key)).toBe(false);
  }),
);

test(
  'literal_bytes, literal_strip, literal_unicode_blank_trailing_lines',
  withFixture(async (f) => {
    await f.config(
      'landing: pr\nworktreeSetup: |\n  A "quote" and \\path.\ncustom:\n  bug: |-\n    A "quote" and \\path.\n  plan: |+\n    Добър ден.\n\n    End.\n\n\n',
    );
    const config = readConfig(f.repo);
    expect(config.worktreeSetup).toBe('A "quote" and \\path.\n');
    expect(config.custom?.bug).toBe('A "quote" and \\path.');
    expect(new TextEncoder().encode(config.custom?.plan)).toEqual(new TextEncoder().encode('Добър ден.\n\nEnd.\n\n\n'));
  }),
);

test(
  'setup_is_data, setup_is_not_executed',
  withFixture(async (f) => {
    const marker = join(f.dir, 'executed');
    const setup = `await Bun.write(${JSON.stringify(marker)}, "ran");\n`;
    await f.config(`landing: pr\nworktreeSetup: |\n  ${setup}`);
    expect(readConfig(f.repo).worktreeSetup).toBe(setup);
    expect((await f.bun(reader, [f.repo])).code).toBe(0);
    expect(await Bun.file(marker).exists()).toBe(false);
  }),
);

test(
  'complete_config, profile_has_no_added_fields',
  withFixture(async (f) => {
    await f.config(
      'landing: merge\nhost: claude\nboard: {port: 1024}\ngates: {triage: me, specify: auto, bug: me, chore: auto, hotfix: me, plan: auto, implement: me}\ncodexProfiles:\n  codex-desktop:\n    slots: [gpt-6-luna, gpt-6.1-sol, org/model-v2, gpt-6-astra]\n    reviewer: {rank: 3, effort: xhigh}\n',
    );
    expect(readConfig(f.repo)).toEqual({
      landing: 'merge',
      host: 'claude',
      board: { port: 1024 },
      gates: { triage: 'me', specify: 'auto', bug: 'me', chore: 'auto', hotfix: 'me', plan: 'auto', implement: 'me' },
      codexProfiles: {
        'codex-desktop': {
          slots: ['gpt-6-luna', 'gpt-6.1-sol', 'org/model-v2', 'gpt-6-astra'],
          reviewer: { rank: 3, effort: 'xhigh' },
        },
      },
    });
    expect((await f.bun(reader, [f.repo])).stderr).toBe('');
  }),
);

test(
  'current_skill_allowlist, skill_inventory_count, all_skill_values_retained',
  withFixture(async (f) => {
    const skills = (await readdir(join(root, 'skills'))).sort();
    expect(skills).toHaveLength(19);
    await f.config(`landing: pr\ncustom:\n${skills.map((skill) => `  ${skill}: "Instruction."\n`).join('')}`);
    const config = readConfig(f.repo);
    expect(Object.keys(config.custom ?? {}).sort()).toEqual(skills);
    expect(Object.values(config.custom ?? {})).toEqual(Array(19).fill('Instruction.'));
    expect((await f.bun(reader, [f.repo])).code).toBe(0);
  }),
);

for (const kind of ['missing', 'directory', 'fifo', 'symlink']) {
  test(
    `${kind}_config`,
    withFixture(async (f) => {
      const file = join(f.repo, '.celetis.yaml');
      if (kind === 'directory') await mkdir(file);
      if (kind === 'fifo') expect((await command('mkfifo', [file])).code).toBe(0);
      if (kind === 'symlink') await symlink(await f.write('external.yaml', 'landing: pr\n'), file);
      expect(() => readConfig(f.repo)).toThrow(ConfigError);
      const result = await f.bun(reader, [f.repo]);
      expect(result.code).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(`${file}: <document>`);
    }),
  );
}

test(
  'permission_fixture_denies_actual_read, unreadable_config',
  withFixture(async (f) => {
    const file = await f.config('landing: pr\n');
    await chmod(file, 0);
    try {
      if (process.getuid?.() === 0) {
        await chmod(f.dir, 0o755);
        await chmod(f.repo, 0o755);
        const bun = join(f.dir, 'bun');
        await cp(process.execPath, bun);
        await chmod(bun, 0o755);
        await cp(join(root, 'scripts/lib'), join(f.dir, 'reader'), { recursive: true });
        const result = await command(bun, [...isolatedArgs, join(f.dir, 'reader/config.ts'), f.repo], {
          uid: 65534,
          gid: 65534,
        });
        expect(result.code).toBe(2);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain(`${file}: <document>: cannot open the file`);
      } else {
        await expect(readFile(file)).rejects.toHaveProperty('code', 'EACCES');
        expect(() => readConfig(f.repo)).toThrow('cannot open the file');
        const result = await f.bun(reader, [f.repo]);
        expect(result.code).toBe(2);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain(`${file}: <document>: cannot open the file`);
      }
    } finally {
      await chmod(file, 0o600);
    }
  }),
);

test(
  'file_changed_during_read',
  withFixture(async (f) => {
    const file = await f.config('landing: pr\n');
    const replacement = await f.write('other.yaml', 'landing: merge\n');
    const open = fs.openSync;
    fs.openSync = (...args: Parameters<typeof fs.openSync>) => {
      if (String(args[0]) === file) fs.renameSync(replacement, file);
      return open(...args);
    };
    try {
      expect(() => readConfig(f.repo)).toThrow('the file changed during the read');
    } finally {
      fs.openSync = open;
    }
    await rename(file, replacement);
    await f.config('landing: pr\n');
    const preload = await f.write(
      'swap.ts',
      `import fs from 'node:fs';\nconst open = fs.openSync;\nfs.openSync = (...args) => { if (String(args[0]) === ${JSON.stringify(file)}) fs.renameSync(${JSON.stringify(replacement)}, ${JSON.stringify(file)}); return open(...args); };\n`,
    );
    const result = await command(process.execPath, [...isolatedArgs, '--preload', preload, reader, f.repo], {
      cwd: f.dir,
      env: f.env,
    });
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`${file}: <document>: the file changed during the read`);
  }),
);

for (const version of ['0.9.0', '1.2.10', '1.4.1', '1.4.2-canary.1']) {
  test(
    `old_bun_${version}`,
    withFixture(async (f) => {
      await f.config('landing: pr\n');
      const result = await command(
        process.execPath,
        [...isolatedArgs, '--define', `Bun.version:${JSON.stringify(version)}`, reader, f.repo],
        { cwd: f.dir, env: f.env },
      );
      expect(result).toEqual({
        code: 2,
        stdout: '',
        stderr: `celetis: ${f.repo}/.celetis.yaml: <document>: need Bun >=1.4.2 on PATH, found ${version}\n`,
      });
    }),
  );
}
for (const version of ['1.4.3', '1.5.0-canary.1', '2.0.0']) {
  test(
    `newer_bun_${version}`,
    withFixture(async (f) => {
      await f.config('landing: pr\n');
      expect(
        await command(
          process.execPath,
          [...isolatedArgs, '--define', `Bun.version:${JSON.stringify(version)}`, reader, f.repo],
          { cwd: f.dir, env: f.env },
        ),
      ).toEqual({ code: 0, stdout: '{"landing":"pr"}\n', stderr: '' });
    }),
  );
}

test(
  'reader import is silent and does not exit',
  withFixture(async (f) => {
    const entry = await f.write(
      'import.ts',
      `await import(${JSON.stringify(reader)}); await import(${JSON.stringify(join(root, 'scripts/lib/process.ts'))}); console.log('import complete');\n`,
    );
    expect(await f.bun(entry)).toEqual({ code: 0, stdout: 'import complete\n', stderr: '' });
  }),
);
