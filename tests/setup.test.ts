import { expect, setDefaultTimeout, test } from 'bun:test';
import { chmod, lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, root } from './lib/fixture.ts';
import {
  allLabels,
  exists,
  hook,
  type LaneFixture,
  literal,
  resetLog,
  setupSource,
  withLane,
  writeOptions,
} from './lib/lane-fixture.ts';

setDefaultTimeout(25_000);
const usage =
  'usage: scripts/celetis setup check | write <options> | try <options> | try --remove | lane <path> | push; <options>: --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge [--setup-file <file>] [--ignore <line>]... [--baseline-file <file>]\n';
const heading = '## Celetis flow';
const flow = [
  '- The lanes are the skills of the plugin `celetis`, on the issues of `acme/widgets`.',
  '- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `scripts/celetis land`.',
  '- A lane never skips a step.',
  '- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.',
];
const body = `${flow.join('\n')}\n`;
const agents = `${heading}\n\n${body}`;
const ignores = [
  '.claude/worktrees/',
  '.claude/settings.local.json',
  'docs/superpowers/',
  '.superpowers/',
  'docs/lessons/_pending/',
];
const attributes = 'scripts/celetis text eol=lf\n.celetis.yaml text eol=lf\n';
const indexHead = '# Lessons\n\n| Lesson | Tags | Date | Summary |\n|---|---|---|---|\n';
const subject = 'chore(celetis): wire the project for the celetis lanes';
const configEntries = [{ path: ['host'] }, { path: ['landing'] }];
const allow = [
  'Bash(scripts/celetis land *)',
  'Bash(scripts/celetis --agent claude land *)',
  'Bash(scripts/celetis --agent codex land *)',
];
const deny = ['Bash(gh\u0020pr merge*)', 'PowerShell(gh\u0020pr merge*)'];
const settingsEntries = [
  ...allow.map((item) => ({ path: ['permissions', 'allow'], item })),
  ...deny.map((item) => ({ path: ['permissions', 'deny'], item })),
  { path: ['extraKnownMarketplaces', 'celetis'] },
  { path: ['enabledPlugins', 'superpowers@superpowers-marketplace'] },
  { path: ['enabledPlugins', 'celetis@celetis'] },
];
const settings = {
  permissions: { allow, deny },
  extraKnownMarketplaces: { celetis: { source: { source: 'github', repo: 'ddinkov10/celetis' }, autoUpdate: true } },
  enabledPlugins: { 'superpowers@superpowers-marketplace': true, 'celetis@celetis': true },
};
const rules =
  'prefix_rule(\n    pattern = ["scripts/celetis", "land"],\n    decision = "allow",\n)\nprefix_rule(\n    pattern = ["scripts/celetis", "--agent", ["claude", "codex"], "land"],\n    decision = "allow",\n)\nprefix_rule(\n    pattern = ["gh", "pr", "merge"],\n    decision = "forbidden",\n    justification = "Use scripts/celetis --agent codex land from the main checkout.",\n)\n';
const read = (f: LaneFixture, file: string, cwd = f.repo) => readFile(join(cwd, file), 'utf8');
const record = async (f: LaneFixture, cwd = f.repo) =>
  JSON.parse(await read(f, '.claude/celetis-flow/wiring.json', cwd));
const entries = async (f: LaneFixture, file: string) => (await record(f)).entries[file];
const sorted = (values: unknown[]) =>
  values
    .map((value) =>
      JSON.stringify(
        value,
        value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort() : undefined,
      ),
    )
    .sort();
async function write(f: LaneFixture, options = writeOptions) {
  const r = await f.setup(['write', ...options]);
  expect(r.code, r.stderr).toBe(0);
  expect(r.stderr).toBe('');
  return r;
}
async function stop(f: LaneFixture, args: string[], message: string, cwd?: string, cause = false) {
  const r = await f.setup(args, { cwd });
  expect(r.code, r.stderr).toBe(1);
  expect(r.stderr.trimEnd().split('\n').at(-1)).toBe(`setup: ${message}`);
  if (!cause) expect(r.stderr).toBe(`setup: ${message}\n`);
  return r;
}
const codex = (landing = 'pr') => ['--hosts', 'codex', '--landing', landing];
const claude = ['--hosts', 'claude', '--landing', 'pr'];
async function commitPush(f: LaneFixture, message = 'product') {
  await f.commit(message);
  await f.git(['push', '-q', 'origin', 'main']);
}
async function setupInput(f: LaneFixture, source = setupSource, name = 'setup.ts') {
  return f.write(name, source);
}
const withProject = (fn: (f: LaneFixture) => Promise<void>) => withLane(fn, null);

test.concurrent(
  'clean, subfolder, unrelated file, repository failure and Git fatal diagnostics',
  withProject(async (f) => {
    expect(await f.setup(['check'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await f.calls()).toEqual([['api', 'repos/{owner}/{repo}']]);
    await mkdir(join(f.repo, 'sub'));
    expect((await f.setup(['check'], { cwd: join(f.repo, 'sub') })).code).toBe(0);
    await f.write('repo dir/unrelated', 'keep');
    expect((await f.setup(['check'])).code).toBe(0);
    await f.update({ repoFail: true });
    expect(
      (await stop(f, ['check'], 'origin is not a GitHub repository that gh can read', undefined, true)).stderr,
    ).toContain('HTTP 404');
    const plain = join(f.dir, 'plain');
    await mkdir(plain);
    const outside = await f.setup(['check'], { cwd: plain, env: { GIT_CEILING_DIRECTORIES: f.dir } });
    expect(outside.code).toBe(1);
    expect(outside.stderr.startsWith('fatal:')).toBe(true);
  }),
);

test.concurrent(
  'trees and branch: linked checkout, other branch, detached HEAD and trunk mismatch',
  withProject(async (f) => {
    const linked = join(f.dir, 'linked');
    await f.git(['worktree', 'add', '-q', '-b', 'side', linked]);
    for (const args of [['check'], ['try', ...writeOptions], ['try', '--remove'], ['lane', linked]])
      await stop(f, args, `run setup in the main checkout, not in a linked worktree: ${linked}`, linked);
    await f.git(['checkout', '-qb', 'other']);
    await stop(f, ['check'], 'the main checkout is on other, not on main; switch to main first');
    await f.git(['checkout', '-q', '--detach']);
    await stop(f, ['check'], 'the main checkout is on a detached HEAD, not on main; switch to main first');
    await f.git(['checkout', '-q', 'main']);
    await f.update({ trunk: 'trunk' });
    await stop(f, ['check'], 'the main checkout is on main, not on trunk; switch to trunk first');
  }),
);

test.concurrent(
  'fetch, behind and diverged trunk stop without writes',
  withProject(async (f) => {
    await f.git(['remote', 'set-url', 'origin', join(f.dir, 'missing.git')]);
    expect((await stop(f, ['check'], 'cannot fetch main from origin', undefined, true)).stderr).toContain(
      'does not appear to be a git repository',
    );
    await f.git(['remote', 'set-url', 'origin', f.origin]);
    const other = join(f.dir, 'other');
    await f.git(['clone', '-q', f.origin, other]);
    await f.git(['commit', '-q', '--allow-empty', '-m', 'upstream'], other);
    await f.git(['push', '-q', 'origin', 'HEAD:main'], other);
    const message = 'the local main is behind origin/main or has diverged from it; run git pull first';
    await stop(f, ['check'], message);
    await f.git(['commit', '-q', '--allow-empty', '-m', 'local']);
    await stop(f, ['check'], message);
    await f.clean();
  }),
);

test.concurrent(
  'ahead: one and two commits print exact warnings on stdout',
  withProject(async (f) => {
    await f.git(['commit', '-q', '--allow-empty', '-m', 'one']);
    expect(await f.setup(['check'])).toEqual({
      code: 0,
      stderr: '',
      stdout: 'setup: warning: the local main is 1 commit ahead of origin/main; the push carries it:\n  one\n',
    });
    await f.git(['commit', '-q', '--allow-empty', '-m', 'two']);
    expect(await f.setup(['check'])).toEqual({
      code: 0,
      stderr: '',
      stdout:
        'setup: warning: the local main is 2 commits ahead of origin/main; the push carries them:\n  one\n  two\n',
    });
  }),
);

test.concurrent(
  'dirty and staged checks preserve unrelated state',
  withProject(async (f) => {
    await f.write('repo dir/.gitignore', 'node_modules/\n');
    await f.commit();
    await f.write('repo dir/.gitignore', 'node_modules/\ndist/\n');
    await f.write('repo dir/AGENTS.md', 'notes\n');
    await f.config('landing: pr\n');
    const message = 'commit or drop the uncommitted changes of these files first: .gitignore .celetis.yaml AGENTS.md';
    await stop(f, ['check'], message);
    await mkdir(join(f.repo, 'sub'));
    await stop(f, ['check'], message, join(f.repo, 'sub'));
    await f.git(['reset', '--hard', 'HEAD']);
    await rm(join(f.repo, 'AGENTS.md'));
    await rm(join(f.repo, '.celetis.yaml'));
    await f.write('repo dir/other.txt', 'x');
    await f.git(['add', 'other.txt']);
    await stop(f, ['check'], 'the index holds staged changes; commit or unstage them first');
  }),
);

const invalidArguments = [
  [],
  ['bogus'],
  ['check', 'extra'],
  ['push', 'extra'],
  ['write', '--hosts', 'claude,codex', '--landing', 'pr'],
  ['write', '--hosts', 'claude', '--default', 'codex', '--landing', 'pr'],
  ['write', '--hosts', 'claude', '--landing', 'squash'],
  ['write', '--hosts', 'gitlab', '--landing', 'pr'],
  ['write', '--hosts', 'claude'],
  ['write', '--landing', 'pr'],
  ['write', '--hosts', 'claude', '--landing', 'pr', 'extra'],
  ['write', '--hosts', 'claude,codex', '--default', 'gitlab', '--landing', 'pr'],
  ...['--setup-file', '--ignore', '--baseline-file'].flatMap((flag) => [
    ['write', ...codex(), flag],
    ['write', ...codex(), flag, ''],
  ]),
  ['try'],
  ['try', '--hosts', 'codex'],
  ['try', ...codex(), '--remove'],
  ['try', '--remove', 'extra'],
  ['try', '--remove', '--hosts', 'codex'],
  ['lane'],
  ['lane', 'a', 'b'],
  ['lane', ''],
];
test.concurrent(
  'usage: all original argument boundaries',
  withProject(async (f) => {
    for (const args of invalidArguments)
      expect(await f.setup(args), args.join(' ')).toEqual({ code: 2, stdout: '', stderr: usage });
  }),
);

test.concurrent(
  'empty: exact files, ownership, executable launcher, changed paths and idempotent rerun',
  withProject(async (f) => {
    const r = await write(f);
    expect(await read(f, 'scripts/celetis')).toBe(await readFile(join(root, 'scripts/celetis'), 'utf8'));
    expect((await lstat(join(f.repo, 'scripts/celetis'))).mode & 0o111).toBe(0o111);
    expect(await read(f, '.celetis.yaml')).toBe('host: codex\nlanding: merge\n');
    expect(await exists(join(f.repo, '.claude/celetis-flow/landing.json'))).toBe(false);
    expect((await command('git', ['config', 'celetis-flow.agent'], { cwd: f.repo, env: f.env })).code).toBe(1);
    expect(await read(f, '.codex/rules/celetis.rules')).toBe(rules);
    expect(await read(f, '.gitignore')).toBe(`${ignores.join('\n')}\n`);
    expect(await read(f, '.gitattributes')).toBe(attributes);
    expect(await read(f, 'AGENTS.md')).toBe(agents);
    expect(await exists(join(f.repo, '.claude/settings.json'))).toBe(false);
    const own = await record(f);
    expect(own).toEqual({
      schema: 1,
      answers: { hosts: ['codex'], tracker: 'github' },
      files: ['.claude/celetis-flow/wiring.json', '.codex/rules/celetis.rules', 'scripts/celetis'],
      entries: {
        '.gitignore': expect.arrayContaining(ignores),
        '.gitattributes': attributes.trimEnd().split('\n').sort(),
        'AGENTS.md': expect.arrayContaining([heading, ...flow]),
        '.celetis.yaml': configEntries,
      },
    });
    expect(await read(f, '.claude/celetis-flow/wiring.json')).toBe(
      `${JSON.stringify({ answers: { hosts: ['codex'], tracker: 'github' }, entries: { '.celetis.yaml': configEntries, '.gitattributes': attributes.trimEnd().split('\n').sort(), '.gitignore': [...ignores].sort(), 'AGENTS.md': [heading, ...flow].sort() }, files: ['.claude/celetis-flow/wiring.json', '.codex/rules/celetis.rules', 'scripts/celetis'], schema: 1 }, null, 2)}\n`,
    );
    const changed = (await f.git(['status', '--porcelain', '--untracked-files=all']))
      .split('\n')
      .map((s) => s.slice(3))
      .sort();
    expect(
      r.stdout
        .trimEnd()
        .split('\n')
        .map((s) => {
          expect(s.startsWith('setup: changed ')).toBe(true);
          return s.slice(15);
        })
        .sort(),
    ).toEqual(changed);
    const before = await read(f, '.claude/celetis-flow/wiring.json');
    await commitPush(f, 'wiring');
    expect((await write(f)).stdout).toBe('setup: no file changed\n');
    await f.clean();
    expect(await read(f, '.claude/celetis-flow/wiring.json')).toBe(before);
  }),
);

const agentCases: [string, string, string][] = [
  ['agents1', '# P\n- x\n', `# P\n- x\n\n${agents}`],
  ['agents2', '# P\n\n', `# P\n\n${agents}`],
  ['agents3', '## Celetis flow\n\n## Deploy\n', `${agents}\n## Deploy\n`],
  ['agents4', '## Celetis flow\n\n### Notes\n- note\n\n# Next\n', `${heading}\n\n### Notes\n- note\n${body}\n# Next\n`],
  [
    'agents5',
    '## Celetis flow\n- A lane never skips a step.',
    `${heading}\n${flow[2]}\n${flow[0]}\n${flow[1]}\n${flow[3]}\n`,
  ],
  [
    'agents6',
    '## Celetis flow\n\n- The maintainer starts the runner; an agent starts it only when its task says\n  so, with a number, and in a terminal.\n',
    `${heading}\n\n- The maintainer starts the runner; an agent starts it only when its task says\n  so, with a number, and in a terminal.\n${body}`,
  ],
  [
    'agents7',
    '## Celetis flow\n\n  *   A lane never skips a step.  \r\n',
    `${heading}\n\n  *   A lane never skips a step.  \r\n${flow[0]}\n${flow[1]}\n${flow[3]}\n`,
  ],
  ['agents8', '# P\n\n- A lane never skips a step.\n', `# P\n\n- A lane never skips a step.\n\n${agents}`],
  [
    'agents9',
    '## Celetis flow\n\n- A lane never skips a step.\n\nThe config:\n\n```yaml\n# pr: green\nlanding: pr\n```\n\n- Run the gate.\n',
    `## Celetis flow\n\n- A lane never skips a step.\n\nThe config:\n\n\x60\x60\x60yaml\n# pr: green\nlanding: pr\n\x60\x60\x60\n\n- Run the gate.\n${flow[0]}\n${flow[1]}\n${flow[3]}\n`,
  ],
  [
    'agents10',
    '# P\n\n```markdown\n## Celetis flow\n\n- A lane never skips a step.\n```\n',
    `# P\n\n\x60\x60\x60markdown\n## Celetis flow\n\n- A lane never skips a step.\n\x60\x60\x60\n\n${agents}`,
  ],
  [
    'agents11',
    '## Celetis flow\n\n~~~\n- A lane never skips a step.\n~~~\n',
    `${heading}\n\n~~~\n- A lane never skips a step.\n~~~\n${body}`,
  ],
  [
    'agents12',
    '## Celetis flow\n\n````markdown\n~~~~~\n# One\n```\n# Two\n````\n',
    `${heading}\n\n\x60\x60\x60\x60markdown\n~~~~~\n# One\n\x60\x60\x60\n# Two\n\x60\x60\x60\x60\n${body}`,
  ],
  ['agents13', '# P\n\n```sh\nmake\n', `# P\n\n\x60\x60\x60sh\nmake\n\n${agents}`],
];
for (const [name, before, after] of agentCases)
  test.concurrent(
    `${name}: section insertion, fences and byte preservation`,
    withProject(async (f) => {
      await f.write('repo dir/AGENTS.md', before);
      await f.commit();
      await write(f, codex());
      expect(await read(f, 'AGENTS.md')).toBe(after as string);
      expect(sorted(await entries(f, 'AGENTS.md'))).toEqual(sorted([heading, ...flow]));
      if (name === 'agents13') {
        await f.commit();
        await write(f, codex());
        expect(await read(f, 'AGENTS.md')).toBe(after as string);
      }
    }),
  );

test.concurrent(
  'own: replace launcher and preserve product lines and section order',
  withProject(async (f) => {
    await f.write('repo dir/scripts/celetis', 'old');
    await f.write('repo dir/.gitignore', 'node_modules/\ndocs/superpowers/');
    await f.write(
      'repo dir/AGENTS.md',
      '# P\n## Build\n- make\n## Celetis flow\n\n* A lane never skips a step.\n\n## Deploy\n- ship\n',
    );
    await f.commit();
    await write(f, codex());
    expect(await read(f, '.gitignore')).toBe(
      'node_modules/\ndocs/superpowers/\n.claude/worktrees/\n.claude/settings.local.json\n.superpowers/\ndocs/lessons/_pending/\n',
    );
    expect(await read(f, 'AGENTS.md')).toBe(
      `# P\n## Build\n- make\n${heading}\n\n* A lane never skips a step.\n${flow[0]}\n${flow[1]}\n${flow[3]}\n\n## Deploy\n- ship\n`,
    );
    expect(sorted(await entries(f, '.gitignore'))).toEqual(sorted(ignores));
    expect(await read(f, 'scripts/celetis')).toBe(await readFile(join(root, 'scripts/celetis'), 'utf8'));
  }),
);

for (const name of ['claude', 'claudedot', 'codexclaude', 'symlink', 'symlinkignored', 'agentslink', 'claudelink'])
  test.concurrent(
    `${name}: Claude file ownership and link identity`,
    withProject(async (f) => {
      if (['claude', 'codexclaude', 'agentslink'].includes(name)) await f.write('repo dir/CLAUDE.md', '# C');
      if (['claude', 'claudedot'].includes(name)) await f.write('repo dir/.claude/CLAUDE.md', '# Dot\n@AGENTS.md\n');
      if (name.startsWith('symlink')) {
        await f.write('repo dir/AGENTS.md', '# P\n');
        await symlink('AGENTS.md', join(f.repo, 'CLAUDE.md'));
        if (name === 'symlinkignored') await f.write('repo dir/.gitignore', 'CLAUDE.md\n');
      }
      if (name === 'agentslink') await symlink('CLAUDE.md', join(f.repo, 'AGENTS.md'));
      if (name === 'claudelink') {
        await f.write('repo dir/docs/claude.md', '# C\n');
        await symlink('docs/claude.md', join(f.repo, 'CLAUDE.md'));
      }
      await f.commit();
      const r = await write(f, name === 'codexclaude' ? codex() : claude);
      if (name === 'claude') {
        expect(await read(f, 'CLAUDE.md')).toBe('# C\n@AGENTS.md\n');
        expect(await entries(f, 'CLAUDE.md')).toEqual(['@AGENTS.md']);
      }
      if (name === 'claudedot') expect(await exists(join(f.repo, 'CLAUDE.md'))).toBe(false);
      if (name === 'claude' || name === 'claudedot')
        expect(await entries(f, '.claude/CLAUDE.md')).toEqual(['@AGENTS.md']);
      if (name === 'codexclaude') {
        expect(await read(f, 'CLAUDE.md')).toBe('# C');
        expect(await entries(f, 'CLAUDE.md')).toBeUndefined();
      }
      if (name.startsWith('symlink')) {
        expect((await lstat(join(f.repo, 'CLAUDE.md'))).isSymbolicLink()).toBe(true);
        expect(r.stdout).not.toContain('is a symbolic link');
        expect(await entries(f, 'CLAUDE.md')).toBeUndefined();
      }
      if (name === 'agentslink') {
        expect((await lstat(join(f.repo, 'AGENTS.md'))).isSymbolicLink()).toBe(true);
        expect(await read(f, 'CLAUDE.md')).toBe(`# C\n\n${agents}`);
        expect(await entries(f, 'CLAUDE.md')).toBeUndefined();
      }
      if (name === 'claudelink') {
        expect(r.stdout).toContain('CLAUDE.md is a symbolic link to a file other than AGENTS.md; setup leaves it');
        expect(await read(f, 'docs/claude.md')).toBe('# C\n');
      }
    }),
  );

test.concurrent(
  'crlf: existing ignore bytes remain unchanged',
  withProject(async (f) => {
    const bytes = `${ignores.join('\r\n')}\r\n`;
    await f.write('repo dir/.gitignore', bytes);
    await f.commit();
    await write(f, codex());
    expect(await read(f, '.gitignore')).toBe(bytes);
    expect(sorted(await entries(f, '.gitignore'))).toEqual(sorted(ignores));
  }),
);

test.concurrent(
  'settings: exact default settings, entries and README forms',
  withProject(async (f) => {
    await write(f, claude);
    expect(await read(f, '.claude/settings.json')).toBe(`${JSON.stringify(settings, null, 2)}\n`);
    expect(sorted(await entries(f, '.claude/settings.json'))).toEqual(sorted(settingsEntries));
    expect((await record(f)).files).not.toContain('.claude/settings.json');
    const readme = await readFile(join(root, 'README.md'), 'utf8');
    const fence = (title: string) => (readme.split(title)[1] as string).match(/```[^\n]*\n([\s\S]*?)```/)?.[1] ?? '';
    expect(JSON.parse(fence('### Claude permissions'))).toEqual(settings);
    expect(fence('### Codex permissions')).toBe(rules);
    expect(fence('### `.gitignore`')).toBe(`${ignores.join('\n')}\n`);
  }),
);

for (const name of ['settingsproduct', 'settingstab', 'settingshand', 'settingsdiffers', 'settingsrecorded'])
  test.concurrent(
    `${name}: preserve settings data, indentation and recorded ownership`,
    withProject(async (f) => {
      const source =
        name === 'settingsproduct'
          ? '{\n    "permissions": {"allow": ["Bash(npm test)"]},\n    "env": {"CI": "1"},\n    "enabledPlugins": {}\n}\n'
          : name === 'settingstab'
            ? '{\n\t"env": {"CI": "1"}\n}\n'
            : name === 'settingshand'
              ? await readFile(join(root, '.claude/settings.json'), 'utf8')
              : '{"enabledPlugins":{"celetis@celetis":false}}\n';
      if (name === 'settingsrecorded') {
        await write(f, claude);
        const v = JSON.parse(await read(f, '.claude/settings.json'));
        v.enabledPlugins['celetis@celetis'] = false;
        await f.write('repo dir/.claude/settings.json', JSON.stringify(v));
      } else await f.write('repo dir/.claude/settings.json', source);
      await f.commit();
      const r = await write(f, claude);
      const text = await read(f, '.claude/settings.json');
      const value = JSON.parse(text);
      if (name === 'settingsproduct') {
        expect(value.permissions.allow).toEqual(['Bash(npm test)', ...allow]);
        expect(Object.keys(value)).toEqual(['permissions', 'env', 'enabledPlugins', 'extraKnownMarketplaces']);
        expect(value.env).toEqual({ CI: '1' });
        expect(text.split('\n')[1]).toMatch(/^ {4}"/);
      }
      if (name === 'settingstab') expect(text.split('\n')[1]).toMatch(/^\t"env"/);
      if (name === 'settingshand') expect(text).toBe(source);
      if (name === 'settingsdiffers' || name === 'settingsrecorded') {
        expect(r.stdout).toContain('enabledPlugins.celetis@celetis differs from the current form; setup leaves it');
        expect(value.enabledPlugins).toEqual({ 'celetis@celetis': false, 'superpowers@superpowers-marketplace': true });
      }
      const want =
        name === 'settingsdiffers'
          ? settingsEntries.filter((e) => e.path.join('.') !== 'enabledPlugins.celetis@celetis')
          : settingsEntries;
      expect(sorted(await entries(f, '.claude/settings.json'))).toEqual(sorted(want));
      if (name === 'settingsrecorded') await f.git(['push', '-q', 'origin', 'main']);
      else await commitPush(f, 'wiring');
      const again = await write(f, claude);
      expect(await read(f, '.claude/settings.json')).toBe(text);
      if (!name.includes('differs') && !name.includes('recorded'))
        expect(again.stdout).toBe('setup: no file changed\n');
    }),
  );

test.concurrent(
  'settingsbad and badrecord: all malformed inputs fail before any file or label',
  withProject(async (f) => {
    for (const [source, message] of [
      ['{', ' is no JSON object'],
      ['[]', ' is no JSON object'],
      ['{"permissions":{"allow":"x"}}', ': permissions.allow is no array'],
      ['{"enabledPlugins":[]}', ': enabledPlugins is no object'],
    ]) {
      await f.write('repo dir/.claude/settings.json', source as string);
      await f.commit();
      await stop(f, ['write', ...claude], `.claude/settings.json${message}; fix it first`);
      await f.clean();
    }
    expect((await f.setup(['write', ...codex()])).code).toBe(0);
    await f.commit();
    for (const bad of [
      '[]',
      'not json',
      '{"schema":2,"files":[],"entries":{}}',
      '{"schema":1}',
      '{"schema":1,"files":[1],"entries":{}}',
      '{"schema":1,"files":[],"entries":{"a":"b"}}',
    ]) {
      await f.write('repo dir/.claude/celetis-flow/wiring.json', bad);
      await f.commit();
      await stop(
        f,
        ['write', ...codex()],
        '.claude/celetis-flow/wiring.json is no record of setup; fix or remove it first',
      );
      await f.clean();
    }
  }),
);

for (const [name, ignore, path] of [
  ['ignored', '.claude/', '.claude/celetis-flow/wiring.json'],
  ['ignoredconfig', '.celetis.yaml', '.celetis.yaml'],
  ['ignoredscripts', 'scripts/', 'scripts/celetis'],
  ['ignoredstore', 'docs/adr/', 'docs/adr/README.md'],
])
  test.concurrent(
    `${name}: refused ignored path and tracked exception`,
    withProject(async (f) => {
      await f.write('repo dir/.gitignore', `${ignore}\n`);
      await f.commit();
      await f.update({ names: '' });
      await stop(f, ['write', ...codex()], `git ignores ${path}; make git track it first`);
      await f.clean();
      expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
      if (name === 'ignoredscripts') {
        await f.write('repo dir/scripts/celetis', 'old');
        await f.git(['add', '-f', 'scripts/celetis']);
        await f.git(['commit', '-qm', 'tracked']);
        await f.update({ names: allLabels });
        await write(f, codex());
      }
      if (name === 'ignoredstore') {
        await f.write('repo dir/docs/adr/README.md', '# Our decisions\n');
        await f.write('repo dir/docs/adr/template.md', '# Our template\n');
        await f.git(['add', '-f', 'docs/adr']);
        await f.git(['commit', '-qm', 'tracked']);
        await f.update({ names: allLabels });
        await write(f, codex());
        expect(await read(f, path as string)).toBe('# Our decisions\n');
      }
    }),
  );

for (const name of ['linkedfolder', 'linkedagents', 'submodule'])
  test.concurrent(
    `${name}: trust boundary before file and label writes`,
    withProject(async (f) => {
      let message = '';
      if (name === 'linkedfolder') {
        await f.write('repo dir/config/claude/settings.json', '{}\n');
        await symlink('config/claude', join(f.repo, '.claude'));
        message =
          '.claude/celetis-flow/wiring.json lies beyond a symbolic link or in a submodule; setup writes no file there';
      }
      if (name === 'linkedagents') {
        await f.write('repo dir/docs/agents.md', '# Rules\n');
        await symlink('docs/agents.md', join(f.repo, 'AGENTS.md'));
        message = 'AGENTS.md is a symbolic link; setup writes no file through a link';
      }
      if (name === 'submodule') {
        const docs = join(f.dir, 'subdocs');
        await f.git(['init', '-q', '-b', 'main', docs]);
        await writeFile(join(docs, 'index.md'), 'docs');
        await f.commit('docs', docs);
        await f.git(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', docs, 'docs']);
        message = 'docs/adr/README.md lies beyond a symbolic link or in a submodule; setup writes no file there';
      }
      await f.commit();
      await f.update({ names: '' });
      const r = await stop(
        f,
        ['write', ...(name === 'linkedfolder' ? claude : codex())],
        message,
        undefined,
        name !== 'linkedagents',
      );
      if (name === 'linkedfolder') expect(r.stderr).toContain('is beyond a symbolic link');
      if (name === 'submodule') expect(r.stderr).toContain("is in submodule 'docs'");
      await f.clean();
      expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
      if (name === 'submodule') {
        for (const p of ['docs/adr/README.md', 'docs/adr/template.md', 'docs/lessons/INDEX.md'])
          await f.write(`repo dir/${p}`, '');
        await f.update({ names: allLabels });
        await write(f, codex());
      }
    }),
  );

test.concurrent(
  'union: hosts change without loss of prior ownership or product values',
  withProject(async (f) => {
    await write(f, ['--hosts', 'claude,codex', '--default', 'codex', '--landing', 'merge']);
    await f.write('repo dir/.codex/rules/celetis.rules', `${rules}# own\n`);
    await commitPush(f, 'wiring');
    const r = await write(f, claude);
    expect(await read(f, '.codex/rules/celetis.rules')).toBe(`${rules}# own\n`);
    expect((await record(f)).files).toContain('.codex/rules/celetis.rules');
    expect((await record(f)).answers.hosts).toEqual(['claude']);
    expect(await read(f, '.celetis.yaml')).toBe('host: codex\nlanding: merge\n');
    expect(r.stdout).toContain('host is codex, not claude; setup leaves it');
    expect(r.stdout).toContain('landing is merge, not pr; setup leaves it');
    expect(await entries(f, '.celetis.yaml')).toEqual(configEntries);
  }),
);

for (const name of ['stores', 'productstores', 'producttemplate'])
  test.concurrent(
    `${name}: seed only absent stores and do not own them`,
    withProject(async (f) => {
      if (name === 'productstores') await f.write('repo dir/docs/adr/README.md', '# Our decisions\n');
      if (name === 'producttemplate') {
        await f.write('repo dir/docs/adr/template.md', '# Our template\n');
        await f.write('repo dir/docs/lessons/INDEX.md', '# Our lessons\n');
      }
      if (name !== 'stores') await f.commit();
      await write(f, codex());
      expect(await read(f, 'docs/adr/README.md')).toBe(
        name === 'productstores' ? '# Our decisions\n' : await readFile(join(root, 'docs/adr/README.md'), 'utf8'),
      );
      expect(await read(f, 'docs/adr/template.md')).toBe(
        name === 'producttemplate' ? '# Our template\n' : await readFile(join(root, 'docs/adr/template.md'), 'utf8'),
      );
      expect(await read(f, 'docs/lessons/INDEX.md')).toBe(name === 'producttemplate' ? '# Our lessons\n' : indexHead);
      const own = await record(f);
      expect([...own.files, ...Object.keys(own.entries)].some((p: string) => p.startsWith('docs/'))).toBe(false);
      expect(await read(f, 'docs/adr/README.md')).not.toContain('harness');
    }),
  );

test.concurrent(
  'handwired: adopt files and entries without rewriting existing product content',
  withProject(async (f) => {
    const files: Record<string, string> = {
      '.claude/settings.json': `${JSON.stringify(settings, null, 2)}\n`,
      '.codex/rules/celetis.rules': rules,
      'scripts/celetis': await readFile(join(root, 'scripts/celetis'), 'utf8'),
      '.gitignore': `${ignores.join('\n')}\n`,
      '.celetis.yaml': 'host: claude\nlanding: pr\n',
      '.gitattributes': '* text=auto eol=lf\n',
      'AGENTS.md': agents,
      'docs/adr/README.md': await readFile(join(root, 'docs/adr/README.md'), 'utf8'),
      'docs/adr/template.md': await readFile(join(root, 'docs/adr/template.md'), 'utf8'),
      'docs/lessons/INDEX.md': indexHead,
    };
    for (const [p, text] of Object.entries(files)) await f.write(`repo dir/${p}`, text);
    await chmod(join(f.repo, 'scripts/celetis'), 0o755);
    await commitPush(f, 'hand');
    await write(f, ['--hosts', 'claude,codex', '--default', 'claude', '--landing', 'pr']);
    expect(await f.git(['status', '--porcelain', '--untracked-files=all'])).toBe(
      ' M .gitattributes\n?? .claude/celetis-flow/wiring.json',
    );
    expect(await read(f, '.gitattributes')).toBe(`* text=auto eol=lf\n${attributes}`);
    for (const [p, text] of Object.entries(files)) if (p !== '.gitattributes') expect(await read(f, p), p).toBe(text);
    expect((await record(f)).answers).toEqual({ hosts: ['claude', 'codex'], tracker: 'github' });
    expect(sorted(await entries(f, '.claude/settings.json'))).toEqual(sorted(settingsEntries));
  }),
);

for (const [name, source, after] of [
  ['configref', 'host: codex\nlanding: pr\nboard:\n  port: 4404\n', 'host: codex\nlanding: pr\nboard:\n  port: 4404\n'],
  [
    'configappend',
    '# ours\nlanding: pr\ncustom:\n  bug: |-\n    Keep it small.',
    '# ours\nlanding: pr\ncustom:\n  bug: |-\n    Keep it small.\nhost: codex\n',
  ],
  ['configdiffers', 'host: codex\nlanding: merge\n', 'host: codex\nlanding: merge\n'],
])
  test.concurrent(
    `${name}: preserve bytes, comments, key order and unrelated parsed values`,
    withProject(async (f) => {
      await f.config(source as string);
      await commitPush(f);
      const r = await write(f, name === 'configdiffers' ? claude : codex());
      expect(await read(f, '.celetis.yaml')).toBe(after as string);
      if (name === 'configappend') expect(f.configValue().custom?.bug).toBe('Keep it small.');
      if (name === 'configdiffers') {
        expect(await entries(f, '.celetis.yaml')).toBeUndefined();
        expect(r.stdout).toContain('host is codex, not claude');
        expect(r.stdout).toContain('landing is merge, not pr');
      } else expect(await entries(f, '.celetis.yaml')).toEqual(configEntries);
      await commitPush(f, 'wiring');
      if (name === 'configref') expect((await write(f, codex())).stdout).toBe('setup: no file changed\n');
    }),
  );

for (const [name, source, message, cause] of [
  [
    'configinvalid',
    'landing: squash\n',
    'cannot read .celetis.yaml; fix the cause above first',
    'landing: invalid value',
  ],
  [
    'configmissinglanding',
    'host: codex\n',
    'cannot read .celetis.yaml; fix the cause above first',
    'landing: required field',
  ],
  ['confignoappend', '{landing: pr}\n', 'cannot add the line host: codex to .celetis.yaml; add it by hand first', ''],
  [
    'configvalue',
    'landing: pr\ncustom:\n  bug: |\n    Keep',
    'cannot add the line host: codex to .celetis.yaml; add it by hand first',
    '',
  ],
])
  test.concurrent(
    `${name}: plan fails before any write`,
    withProject(async (f) => {
      await f.config(source as string);
      await commitPush(f);
      await f.update({ names: '' });
      const r = await stop(f, ['write', ...codex()], message as string, undefined, Boolean(cause));
      if (cause) expect(r.stderr).toContain(cause);
      expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
      await f.clean();
    }),
  );

test.concurrent(
  'selected Bun: product PATH bun cannot replace the active reader or setup runtime',
  withProject(async (f) => {
    await f.stub('bun', 'process.exit(1);');
    await write(f, codex());
    await f.commit();
    const input = await setupInput(f, 'void 0;\n');
    await write(f, [...codex(), '--setup-file', input]);
    expect(f.configValue().worktreeSetup).toBe('void 0;\n');
  }),
);

for (const source of ['host: claude\r\nlanding: pr\r\n', 'host: claude\nlanding: pr\r\n'])
  test.concurrent(
    `configcrlf: ${JSON.stringify(source)} index rejected`,
    withProject(async (f) => {
      await f.config(source);
      await commitPush(f);
      await f.update({ names: '' });
      const message = 'the index holds .celetis.yaml with CRLF line endings; convert it to LF and commit it first';
      await stop(f, ['check'], message);
      await stop(f, ['write', ...claude], message);
      expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
      await f.clean();
    }),
  );

test.concurrent(
  'configcrlfcheckout: LF index with a CRLF checkout can append an owned field',
  withProject(async (f) => {
    await f.git(['config', 'core.autocrlf', 'true']);
    await f.git(['config', 'core.safecrlf', 'false']);
    await f.config('landing: pr\n');
    await f.commit();
    await rm(join(f.repo, '.celetis.yaml'));
    await f.git(['checkout', '--', '.celetis.yaml']);
    expect(await read(f, '.celetis.yaml')).toBe('landing: pr\r\n');
    await write(f, claude);
    expect(await read(f, '.celetis.yaml')).toBe('landing: pr\r\nhost: claude\n');
  }),
);

const setupCases: [string, string, string][] = [
  [
    'setup1',
    "const kept = 'kept';\nconsole.log(kept);\n",
    "worktreeSetup: |\n  const kept = 'kept';\n  console.log(kept);\n",
  ],
  [
    'setup2',
    "const kept = 'kept';\nconsole.log(kept);",
    "worktreeSetup: |-\n  const kept = 'kept';\n  console.log(kept);\n",
  ],
  ['setup3', "console.log('hi');\n\n\n", "worktreeSetup: |+\n  console.log('hi');\n\n\n"],
  [
    'setup4',
    "   console.log('lead');\nconsole.log('next');\n",
    "worktreeSetup: |2\n     console.log('lead');\n  console.log('next');\n",
  ],
  ['setup5', '', 'worktreeSetup: |-\n'],
  ['setup6', "\n\nconsole.log('hi');\n\tvoid 0;\n", "worktreeSetup: |\n\n\n  console.log('hi');\n  \tvoid 0;\n"],
  [
    'setup7',
    "const text = '# not a comment';\nconsole.log('a: b');\n\nconsole.log(text);\n",
    "worktreeSetup: |\n  const text = '# not a comment';\n  console.log('a: b');\n\n  console.log(text);\n",
  ],
  ['setup8', '\n   \n  void 0;\n', 'worktreeSetup: |2\n\n     \n    void 0;\n'],
];
for (const [name, source, block] of setupCases)
  test.concurrent(
    `${name}: literal block bytes and parsed trailing line breaks`,
    withProject(async (f) => {
      const input = await setupInput(f, source);
      await write(f, [...writeOptions, '--setup-file', input]);
      expect(await read(f, '.celetis.yaml')).toBe(`host: codex\nlanding: merge\n${block}`);
      expect(f.configValue().worktreeSetup).toBe(source);
      expect(await entries(f, '.celetis.yaml')).toEqual(configEntries);
    }),
  );

for (const name of ['setupappend', 'setupblockonly', 'setupdiffers', 'setupsame', 'setupnone'])
  test.concurrent(
    `${name}: setup append preserves unrelated content and ownership`,
    withProject(async (f) => {
      const source = "const kept = 'kept';\nconsole.log(kept);\n";
      const input = await setupInput(f, source);
      const config =
        name === 'setupappend'
          ? 'landing: pr\ncustom:\n  bug: |-\n    Keep it small.'
          : name === 'setupblockonly'
            ? 'host: codex\nlanding: pr\nboard:\n  port: 4404'
            : `host: codex\nlanding: merge\n${name === 'setupsame' ? literal(source) : 'worktreeSetup: ""\n'}`;
      await f.config(config);
      await commitPush(f);
      const opts =
        name === 'setupnone'
          ? writeOptions
          : [...codex(name === 'setupappend' || name === 'setupblockonly' ? 'pr' : 'merge'), '--setup-file', input];
      const r = await write(f, opts);
      if (name === 'setupappend') {
        expect(await read(f, '.celetis.yaml')).toBe(`${config}\nhost: codex\n${literal(source)}`);
        expect(f.configValue().custom?.bug).toBe('Keep it small.');
      }
      if (name === 'setupblockonly') expect(await read(f, '.celetis.yaml')).toBe(`${config}\n${literal(source)}`);
      if (name === 'setupdiffers') {
        expect(r.stdout).toContain('worktreeSetup differs from the setup file; setup leaves it');
        expect(await read(f, '.celetis.yaml')).toBe(config);
      }
      if (name === 'setupsame' || name === 'setupnone') {
        expect(r.stdout).not.toContain('worktreeSetup');
        expect(await read(f, '.celetis.yaml')).toBe(config);
      }
      expect(await entries(f, '.celetis.yaml')).toEqual(configEntries);
      await commitPush(f, 'wiring');
      if (name !== 'setupdiffers') expect((await write(f, opts)).stdout).toBe('setup: no file changed\n');
      if (name === 'setupdiffers') {
        const other = 'host: codex\nlanding: merge\nworktreeSetup: |-\n  void 0;\n';
        await f.config(other);
        await f.commit();
        const next = await write(f, opts);
        expect(next.stdout).toContain('worktreeSetup differs');
        expect(await read(f, '.celetis.yaml')).toBe(other);
      }
    }),
  );

test.concurrent(
  'setuprelative and baselinemissing: caller-relative and Windows absolute input paths',
  withProject(async (f) => {
    await mkdir(join(f.repo, 'sub'));
    await f.write('repo dir/sub/rel.ts', "console.log('hi');\n");
    const r = await f.setup(['write', ...codex(), '--setup-file', 'rel.ts'], { cwd: join(f.repo, 'sub') });
    expect(r.code, r.stderr).toBe(0);
    expect(f.configValue().worktreeSetup).toBe("console.log('hi');\n");
    await f.commit();
    await f.update({ names: '' });
    await stop(
      f,
      ['write', ...codex(), '--setup-file', 'missing.ts'],
      `cannot read ${f.repo}/sub/missing.ts`,
      join(f.repo, 'sub'),
    );
    for (const path of ['Z:/missing/x', 'Z:\\missing\\x'])
      for (const flag of ['--setup-file', '--baseline-file'])
        await stop(f, ['write', ...codex(), flag, path], `cannot read ${path}`, join(f.repo, 'sub'));
    await stop(
      f,
      ['write', ...codex(), '--baseline-file', join(f.dir, 'missing.md')],
      `cannot read ${f.dir}/missing.md`,
    );
    await stop(f, ['write', ...codex(), '--baseline-file', f.dir], `cannot read ${f.dir}`);
    expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
    await f.clean();
  }),
);

for (const [name, source, config, cause] of [
  ['setupcrlf-new', "console.log('hi');\r\n", null, ''],
  ['setupcrlf-existing', "console.log('hi');\r\n", 'host: codex\nlanding: pr\n', ''],
  ['setupesc', "console.log('\x1b[1mhi');\n", null, 'invalid character U+001B'],
  ['setupend', 'void 0;\n', 'host: codex\nlanding: pr\n...\n', 'need one YAML document'],
  ['setupvalue', 'void 0;\n', 'host: codex\nlanding: pr\ncustom:\n  bug: |\n    Keep', ''],
] as const)
  test.concurrent(
    `${name}: invalid append leaves no files or labels`,
    withProject(async (f) => {
      if (config !== null) {
        await f.config(config);
        await f.commit();
      }
      const input = await setupInput(f, source);
      await f.update({ names: '' });
      const r = await stop(
        f,
        ['write', ...codex(), '--setup-file', input],
        'cannot add worktreeSetup to .celetis.yaml; add it by hand first',
        undefined,
        Boolean(cause),
      );
      if (cause) expect(r.stderr).toContain(cause);
      expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
      await f.clean();
      if (name === 'setupend') {
        await f.update({ names: allLabels });
        await write(f, codex());
      }
    }),
  );

test.concurrent(
  'ignorelines and ignorenew: unowned lines, CRLF and duplicate input',
  withProject(async (f) => {
    await f.write('repo dir/.gitignore', 'node_modules/\r\n.venv/');
    await f.commit();
    const opts = [
      ...codex(),
      '--ignore',
      '.venv/',
      '--ignore',
      '.mypy_cache/',
      '--ignore',
      '.claude/worktrees/',
      '--ignore',
      '.mypy_cache/',
    ];
    await write(f, opts);
    expect(await read(f, '.gitignore')).toBe(`node_modules/\r\n.venv/\n${ignores.join('\n')}\n.mypy_cache/\n`);
    expect(sorted(await entries(f, '.gitignore'))).toEqual(sorted(ignores));
    await commitPush(f, 'wiring');
    expect((await write(f, opts)).stdout).toBe('setup: no file changed\n');
  }),
);
test.concurrent(
  'ignorenew: extra ignore on a new file is unowned',
  withProject(async (f) => {
    await write(f, [...codex(), '--ignore', '.venv/']);
    expect(await read(f, '.gitignore')).toBe(`${ignores.join('\n')}\n.venv/\n`);
    expect(sorted(await entries(f, '.gitignore'))).toEqual(sorted(ignores));
  }),
);

const baseline = '## Baseline of the checks\n\n- mypy src/: 28 errors on 2026-10-20.\n';
for (const name of ['baseline', 'baselinenew', 'baselineopen', 'baselinenonl', 'baselineblank', 'baselinethere'])
  test.concurrent(
    `${name}: append unowned baseline once`,
    withProject(async (f) => {
      const before =
        name === 'baseline'
          ? '# P\n- x\n'
          : name === 'baselineopen'
            ? '# P\n'
            : name === 'baselinenonl'
              ? `${agents}- own rule`
              : name === 'baselineblank'
                ? `${agents}\n`
                : name === 'baselinethere'
                  ? `${agents}\n## Baseline of the checks\n\n- own rule\n`
                  : null;
      if (before !== null) {
        await f.write('repo dir/AGENTS.md', before);
        await f.commit();
      }
      const input = await f.write('baseline.md', name === 'baselineopen' ? baseline.trimEnd() : baseline);
      const r = await write(f, [...codex(), '--baseline-file', input]);
      const expected =
        name === 'baseline'
          ? `# P\n- x\n\n${agents}\n${baseline}`
          : name === 'baselineopen'
            ? `# P\n\n${agents}\n${baseline}`
            : name === 'baselinenonl'
              ? `${agents}- own rule\n\n${baseline}`
              : name === 'baselinethere'
                ? before
                : `${agents}\n${baseline}`;
      expect(await read(f, 'AGENTS.md')).toBe(expected as string);
      expect(sorted(await entries(f, 'AGENTS.md'))).toEqual(sorted([heading, ...flow]));
      if (name === 'baselinethere') expect(r.stdout).toContain('## Baseline of the checks is there; setup leaves it');
      await commitPush(f, 'wiring');
      const again = await write(f, [...codex(), '--baseline-file', input]);
      expect(again.stdout).toContain('## Baseline of the checks is there; setup leaves it');
      await f.clean();
    }),
  );

test.concurrent(
  'labels, labelsall, labelcase and labelpages: REST pagination and exact missing labels',
  withProject(async (f) => {
    await f.update({ names: 'bug enhancement wontfix', pages: 2 });
    const r = await write(f, codex());
    const expected =
      'needs-triage|not yet classified|FBCA04\nhotfix|production broken, the fix ships now|FEF2C0\nchore|zero-behavior-change edit|006B75\nepic|parent of several feature sub-issues|0052CC\nneeds-info|the report lacks what its lane needs; the questions are in a comment|FEF2C0\nready-for-agent|plan posted; `/celetis:implement #<n>` can start|D93F0B\nready-for-human|a step only a human runs|C2E0C6\n';
    expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe(expected as string);
    expect(r.stdout.split('\n').filter((s) => s.startsWith('setup: made the label '))).toEqual(
      expected
        .trimEnd()
        .split('\n')
        .map((s) => `setup: made the label ${s.split('|')[0]}`),
    );
    await f.commit();
    await writeFile(f.env.LABEL_LOG, '');
    await f.update({ names: allLabels });
    expect((await write(f, codex())).stdout).not.toContain('made the label');
    expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
    await f.update({ names: allLabels.replace(' bug ', ' Bug ') });
    expect((await write(f, codex())).stdout).toContain('the label Bug differs in case from bug; setup leaves it');
    expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
    expect((await f.calls()).every((a) => a[0] === 'api')).toBe(true);
  }),
);
for (const [key, message] of [
  ['labelFail', 'cannot make the label needs-triage'],
  ['listFail', 'cannot list the labels'],
])
  test.concurrent(
    `labelfail: ${key}`,
    withProject(async (f) => {
      await f.update({ names: '', [key as string]: true });
      const r = await stop(f, ['write', ...codex()], message as string, undefined, true);
      expect(r.stderr).toContain('HTTP 403');
      await f.clean();
    }),
  );

test.concurrent(
  'push: only owned paths, executable index mode and clean no-op',
  withProject(async (f) => {
    await f.git(['config', 'core.fileMode', 'false']);
    const changes = await write(f, ['--hosts', 'claude,codex', '--default', 'claude', '--landing', 'pr']);
    await chmod(join(f.repo, 'scripts/celetis'), 0o644);
    await f.write('repo dir/notes.txt', 'product');
    expect(await f.setup(['push'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await f.git(['log', '-1', '--format=%s'])).toBe(subject);
    expect((await f.git(['show', '--name-only', '--format=', 'HEAD'])).split('\n').sort()).toEqual(
      changes.stdout
        .trimEnd()
        .split('\n')
        .map((s) => s.slice(15))
        .sort(),
    );
    expect(await f.git(['ls-tree', 'HEAD', 'scripts/celetis'])).toMatch(/^100755/);
    const head = await f.git(['rev-parse', 'HEAD']);
    expect((await f.git(['ls-remote', 'origin', 'refs/heads/main'])).split('\t')[0]).toBe(head);
    expect(await f.git(['status', '--porcelain'])).toBe('?? notes.txt');
    expect((await f.setup(['push'])).stdout).toBe('setup: no file changed; nothing to commit\n');
    expect(await f.git(['rev-parse', 'HEAD'])).toBe(head);
  }),
);

test.concurrent(
  'pushahead: existing local commits reach the private origin',
  withProject(async (f) => {
    for (const name of ['one', 'two']) await f.git(['commit', '-q', '--allow-empty', '-m', name]);
    await write(f, codex());
    const r = await f.setup(['push']);
    expect(r.code, r.stderr).toBe(0);
    expect(await f.git(['log', '--format=%s', 'main'], f.origin)).toBe(`${subject}\ntwo\none\nbase\nfixture`);
  }),
);

test.concurrent(
  'pushrefused and pushhook: hook errors propagate, staged state resets, retry preserves commits',
  withProject(async (f) => {
    await write(f, codex());
    await hook(f, '.git/hooks/pre-commit', "console.error('the hook refuses the commit'); process.exit(1);");
    const head = await f.git(['rev-parse', 'HEAD']);
    const dirty = await f.git(['status', '--porcelain']);
    expect(
      (await stop(f, ['push'], 'the commit failed; the files stay uncommitted', undefined, true)).stderr,
    ).toContain('the hook refuses the commit');
    expect(await f.git(['diff', '--cached', '--name-only'])).toBe('');
    expect(await f.git(['rev-parse', 'HEAD'])).toBe(head);
    expect(await f.git(['status', '--porcelain'])).toBe(dirty);
    await rm(join(f.repo, '.git/hooks/pre-commit'));
    await hook(f, '../origin.git/hooks/pre-receive', 'process.exit(1);');
    expect(
      (await stop(f, ['push'], 'the push failed; the commit stays on the local main', undefined, true)).stderr,
    ).toContain('pre-receive hook declined');
    const local = await f.git(['rev-parse', 'HEAD']);
    expect(local).not.toBe(head);
    expect((await f.git(['ls-remote', 'origin', 'refs/heads/main'])).split('\t')[0]).toBe(head);
    await rm(join(f.origin, 'hooks/pre-receive'));
    const retry = await f.setup(['push']);
    expect(retry.code, retry.stderr).toBe(0);
    expect(retry.stdout).toContain('setup: no file changed; nothing to commit');
    expect(await f.git(['rev-parse', 'HEAD'])).toBe(local);
    expect((await f.git(['ls-remote', 'origin', 'refs/heads/main'])).split('\t')[0]).toBe(local);
  }),
);

test.concurrent(
  'pushstaged and pushbranch: no commit on refused input',
  withProject(async (f) => {
    await write(f, codex());
    const head = await f.git(['rev-parse', 'HEAD']);
    await f.write('repo dir/other.txt', 'x');
    await f.git(['add', 'other.txt']);
    await stop(f, ['push'], 'the index holds staged changes; commit or unstage them first');
    expect(await f.git(['rev-parse', 'HEAD'])).toBe(head);
    await f.git(['reset', '-q', '--', 'other.txt']);
    await f.git(['checkout', '-qb', 'other']);
    await stop(f, ['push'], 'the main checkout is on other, not on main; switch to main first');
    expect(await f.git(['rev-parse', 'HEAD'])).toBe(head);
  }),
);

test.concurrent(
  'try: detached plumbing commit, hooks, signing, identity, no remote writes, replacement, failure path and remove',
  withProject(async (f) => {
    const input = await setupInput(f);
    const opts = [...writeOptions, '--setup-file', input];
    const lane = join(f.repo, '.claude/worktrees/setup-try');
    await hook(f, '.git/hooks/pre-commit', 'process.exit(1);');
    await hook(f, '.git/hooks/prepare-commit-msg', 'process.exit(1);');
    for (const [key, value] of [
      ['hook.block.event', 'pre-commit'],
      ['hook.block.command', 'false'],
      ['hook.message.event', 'prepare-commit-msg'],
      ['hook.message.command', 'false'],
      ['commit.gpgsign', 'true'],
      ['gpg.program', 'false'],
    ])
      await f.git(['config', key as string, value as string]);
    const head = await f.git(['rev-parse', 'HEAD']);
    const refs = await f.git(['for-each-ref', '--format=%(refname)']);
    const r = await f.setup(['try', ...opts], { env: { SETUP_STDOUT: 'script-stdout' } });
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe(`script-stdout\n${lane}\n`);
    expect(r.stderr).toContain('noise "quoted"');
    expect(await f.git(['rev-parse', '--abbrev-ref', 'HEAD'], lane)).toBe('HEAD');
    expect(await f.git(['rev-parse', 'HEAD^'], lane)).toBe(head);
    await f.clean(lane);
    expect(await f.git(['log', '-1', '--format=%an <%ae>|%cn <%ce>'], lane)).toBe(
      'celetis <setup@celetis.invalid>|celetis <setup@celetis.invalid>',
    );
    expect(await f.git(['log', '-1', '--format=%s'], lane)).toBe(subject);
    expect(await f.git(['ls-tree', 'HEAD', 'scripts/celetis'], lane)).toMatch(/^100755/);
    expect(await f.setupRows()).toEqual([{ cwd: lane, main: f.repo, kept: 'kept' }]);
    expect(await exists(await f.marker(lane))).toBe(true);
    expect(f.configValue(lane).worktreeSetup).toBe(setupSource);
    await f.tempRemoved();
    expect(await f.git(['rev-parse', 'HEAD'])).toBe(head);
    expect(await f.git(['branch', '--show-current'])).toBe('main');
    expect(await f.git(['for-each-ref', '--format=%(refname)'])).toBe(refs);
    await f.clean();
    expect(await exists(join(f.repo, '.celetis.yaml'))).toBe(false);
    expect(await exists(join(f.repo, 'scripts/celetis'))).toBe(false);
    expect(await readFile(f.env.LABEL_LOG, 'utf8')).toBe('');
    expect(await f.calls()).toEqual([['api', 'repos/{owner}/{repo}']]);
    await mkdir(join(lane, '.venv/bin'), { recursive: true });
    await writeFile(join(lane, '.venv/bin/python'), 'x');
    await writeFile(join(lane, 'untracked.txt'), 'junk');
    await resetLog(f, 'SETUP_LOG');
    expect((await f.setup(['try', ...opts])).stdout).toBe(`\n${lane}\n`);
    expect(await exists(join(lane, '.venv'))).toBe(false);
    expect(await exists(join(lane, 'untracked.txt'))).toBe(false);
    expect(
      (await f.git(['worktree', 'list', '--porcelain'])).split('\n').filter((line) => line === `worktree ${lane}`),
    ).toHaveLength(1);
    expect((await f.setupRows()).length).toBe(1);
    expect(await f.git(['rev-parse', 'HEAD^'], lane)).toBe(head);
    await f.write('repo dir/sub/rel.ts', setupSource);
    const relative = await f.setup(['try', ...writeOptions, '--setup-file', 'rel.ts'], { cwd: join(f.repo, 'sub') });
    expect(relative.code, relative.stderr).toBe(0);
    expect(relative.stdout).toBe(`\n${lane}\n`);
    const failed = await f.setup(['try', ...opts], {
      env: { FAIL_SETUP: '7', SETUP_STDOUT: 'failed-without-newline' },
    });
    expect(failed.code).toBe(7);
    expect(failed.stdout).toBe(`failed-without-newline\n${lane}\n`);
    expect(await exists(lane)).toBe(true);
    expect(await exists(await f.marker(lane))).toBe(false);
    await f.clean(lane);
    await f.tempRemoved();
    await resetLog(f, 'GH_LOG');
    await resetLog(f, 'SETUP_LOG');
    for (let i = 0; i < 2; i++) expect(await f.setup(['try', '--remove'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await exists(lane)).toBe(false);
    expect(await f.git(['worktree', 'list', '--porcelain'])).not.toContain('setup-try');
    expect(await f.calls()).toEqual([]);
    expect(await f.setupRows()).toEqual([]);
  }),
);

test.concurrent(
  'trynotworktree: preserve unowned path and recreate a manually deleted registered lane',
  withProject(async (f) => {
    const lane = join(f.repo, '.claude/worktrees/setup-try');
    await mkdir(lane, { recursive: true });
    await writeFile(join(lane, 'keep'), 'keep');
    for (const args of [
      ['try', ...writeOptions],
      ['try', '--remove'],
    ])
      await stop(f, args, '.claude/worktrees/setup-try is no worktree of git; remove it first');
    expect(await readFile(join(lane, 'keep'), 'utf8')).toBe('keep');
    expect(await f.setupRows()).toEqual([]);
    await rm(lane, { recursive: true });
    await f.git(['worktree', 'add', '-q', '--detach', lane]);
    await rm(lane, { recursive: true });
    const r = await f.setup(['try', ...writeOptions]);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe(`${lane}\n`);
    expect(await f.git(['worktree', 'list', '--porcelain'])).toContain(`worktree ${lane}`);
    expect((await f.setup(['try', '--remove'])).code).toBe(0);
  }),
);

test.concurrent(
  'tryahead, trywired and trysame: local HEAD, no extra commit and exact write equivalence',
  withProject(async (f) => {
    const input = await setupInput(f);
    const opts = [...writeOptions, '--setup-file', input];
    const lane = join(f.repo, '.claude/worktrees/setup-try');
    await f.git(['commit', '-q', '--allow-empty', '-m', 'one']);
    const head = await f.git(['rev-parse', 'HEAD']);
    const r = await f.setup(['try', ...opts]);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe(`\n${lane}\n`);
    expect(r.stderr).toContain('the local main is 1 commit ahead');
    expect(await f.git(['rev-parse', 'HEAD^'], lane)).toBe(head);
    await write(f, opts);
    const paths = (await f.git(['diff', '--name-only', 'HEAD^', 'HEAD'], lane)).split('\n');
    expect(paths.sort()).toEqual(
      (await f.git(['status', '--porcelain', '--untracked-files=all']))
        .split('\n')
        .map((s) => s.slice(3))
        .sort(),
    );
    for (const path of paths) expect(await read(f, path, lane), path).toBe(await read(f, path));
    await commitPush(f, 'wiring');
    const wired = await f.git(['rev-parse', 'HEAD']);
    await resetLog(f, 'SETUP_LOG');
    expect((await f.setup(['try', ...writeOptions])).stdout).toBe(`\n${lane}\n`);
    expect(await f.git(['rev-parse', 'HEAD'], lane)).toBe(wired);
    expect(await f.setupRows()).toEqual([{ cwd: lane, main: f.repo, kept: 'kept' }]);
  }),
);

for (const source of [null, ''])
  test.concurrent(
    `trywired: ${source === null ? 'omitted' : 'empty'} setup prints only path and no marker`,
    withProject(async (f) => {
      const opts = [...writeOptions];
      if (source !== null) opts.push('--setup-file', await setupInput(f, source ?? ''));
      await write(f, opts);
      await commitPush(f, 'wiring');
      const head = await f.git(['rev-parse', 'HEAD']);
      const lane = join(f.repo, '.claude/worktrees/setup-try');
      expect((await f.setup(['try', ...writeOptions])).stdout).toBe(`${lane}\n`);
      expect(await f.git(['rev-parse', 'HEAD'], lane)).toBe(head);
      expect(await exists(await f.marker(lane))).toBe(false);
      expect(await f.setupRows()).toEqual([]);
      await f.clean(lane);
    }),
  );

async function productLane(f: LaneFixture) {
  const lane = join(f.repo, '.claude/worktrees/1-x');
  await f.git(['worktree', 'add', '-q', '-b', 'feat/1-x', lane]);
  return lane;
}
test.concurrent(
  'lane: main setup, exact paths, inherited streams and input, repair marker, relative subfolders and no gh',
  withProject(async (f) => {
    const lane = await productLane(f);
    const input = await setupInput(f);
    await write(f, [...writeOptions, '--setup-file', input]);
    await mkdir(join(lane, 'sub'));
    await mkdir(join(f.repo, 'sub'));
    await f.git(['remote', 'set-url', 'origin', join(f.dir, 'missing.git')]);
    await writeFile(await f.marker(lane), '');
    await resetLog(f, 'GH_LOG');
    const r = await f.setup(['lane', lane], { env: { SETUP_STDOUT: 'script-stdout' } });
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe('script-stdout');
    expect(r.stderr).toContain('noise "quoted"');
    expect(await exists(await f.marker(lane))).toBe(true);
    for (const [path, cwd] of [
      ['.claude/worktrees/1-x/sub', f.repo],
      [join(lane, 'sub'), f.repo],
      ['../.claude/worktrees/1-x', join(f.repo, 'sub')],
    ]) {
      const next = await f.setup(['lane', path as string], { cwd });
      expect(next.code, next.stderr).toBe(0);
    }
    expect(await f.setupRows()).toEqual(Array.from({ length: 4 }, () => ({ cwd: lane, main: f.repo, kept: 'kept' })));
    expect(await f.calls()).toEqual([]);
    await f.clean(lane);
    await f.tempRemoved();
    const failed = await f.setup(['lane', lane], { env: { FAIL_SETUP: '7', SETUP_STDOUT: 'failed lane output' } });
    expect(failed.stdout).toBe('failed lane output');
    expect(failed.code).toBe(1);
    expect(failed.stderr).toContain(`the worktree setup failed in ${lane}`);
    expect(await exists(lane)).toBe(true);
    expect(await exists(await f.marker(lane))).toBe(false);
    await f.clean(lane);
    await f.tempRemoved();
    const observed = `import {writeFileSync} from 'node:fs'; writeFileSync(process.env.SETUP_LOG!, JSON.stringify({main:process.argv[2],cwd:process.cwd(),input:await Bun.stdin.text()}));`;
    await f.config(`landing: merge\n${literal(observed)}`);
    const inputRun = await f.setup(['lane', lane], { input: 'input from caller\n' });
    expect(inputRun.code, inputRun.stderr).toBe(0);
    expect(JSON.parse(await readFile(f.env.SETUP_LOG, 'utf8'))).toEqual({
      main: f.repo,
      cwd: lane,
      input: 'input from caller\n',
    });
  }),
);

test.concurrent(
  'lanestops: repository ownership and exact lane membership',
  withProject(async (f) => {
    const lane = await productLane(f);
    const testLane = join(f.repo, '.claude/worktrees/setup-try');
    await f.git(['worktree', 'add', '-q', '--detach', testLane]);
    const outside = join(f.dir, 'outside');
    await f.git(['worktree', 'add', '-q', '--detach', outside]);
    await mkdir(join(f.dir, 'elsewhere'));
    await mkdir(join(f.repo, 'sub'));
    const other = join(f.dir, 'clean');
    await f.git(['clone', '-q', f.origin, other]);
    for (const path of [
      f.repo,
      join(f.repo, 'sub'),
      testLane,
      outside,
      join(f.dir, 'elsewhere'),
      join(f.dir, 'missing'),
      other,
      join(f.repo, 'app.txt'),
      join(f.repo, '.claude/worktrees'),
    ])
      await stop(f, ['lane', path], `${path} is no lane worktree in .claude/worktrees/ of this repository`);
    expect(await f.setupRows()).toEqual([]);
    await stop(f, ['lane', lane], `run setup in the main checkout, not in a linked worktree: ${lane}`, lane);
  }),
);

test.concurrent(
  'lanenone: missing, omitted, empty and one-line setup',
  withProject(async (f) => {
    const lane = await productLane(f);
    const missing = await stop(
      f,
      ['lane', lane],
      'cannot read .celetis.yaml; fix the cause above first',
      undefined,
      true,
    );
    expect(missing.stderr).toContain('need a regular, readable file');
    for (const config of ['landing: merge\n', 'landing: merge\nworktreeSetup: ""\n']) {
      await f.config(config);
      await stop(f, ['lane', lane], 'the main .celetis.yaml has no worktreeSetup to run');
      expect(await exists(await f.marker(lane))).toBe(false);
    }
    await f.config('landing: merge\nworktreeSetup: process.exit(0)\n');
    expect((await f.setup(['lane', lane])).code).toBe(0);
    expect(await exists(await f.marker(lane))).toBe(true);
  }),
);

for (const [name, source, code] of [
  ['syntax', 'const bad: = 0;', 1],
  ['throw', 'throw new Error("boom");', 1],
  ['exit', 'process.exit(7);', 7],
  [
    'external',
    'const c = Bun.spawnSync([process.execPath,"--no-env-file","--no-install","--config=/dev/null","--no-macros","-e","process.exit(9)"]); if(c.exitCode!==0)process.exit(c.exitCode);',
    9,
  ],
] as const)
  test.concurrent(
    `try failure status and lane preservation: ${name}`,
    withProject(async (f) => {
      const input = await setupInput(f, source);
      const lane = join(f.repo, '.claude/worktrees/setup-try');
      const r = await f.setup(['try', ...writeOptions, '--setup-file', input]);
      expect(r.code).toBe(code);
      expect(r.stdout).toBe(`\n${lane}\n`);
      expect(await exists(await f.marker(lane))).toBe(false);
      await f.clean(lane);
    }),
  );

for (const ending of ['', '\n', '\n\n\n'])
  test.concurrent(
    `try preserves main, cwd, stdin and exact source with ${ending.length} final line breaks`,
    withProject(async (f) => {
      const originalText = `import { readFileSync, writeFileSync } from 'node:fs';\nwriteFileSync(process.env.SETUP_LOG!, JSON.stringify({main: process.argv[2], cwd: process.cwd(), input: await Bun.stdin.text()}));\nwriteFileSync(process.env.SETUP_BYTES!, readFileSync(import.meta.path));${ending}`;
      const input = await setupInput(f, originalText);
      const lane = join(f.repo, '.claude/worktrees/setup-try');
      const result = await f.setup(['try', ...writeOptions, '--setup-file', input], { input: 'input from caller\n' });
      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toBe(`\n${lane}\n`);
      const observed = JSON.parse(await readFile(f.env.SETUP_LOG, 'utf8'));
      expect(observed.main).toBe(f.repo);
      expect(observed.cwd).toBe(lane);
      expect(observed.input).toBe('input from caller\n');
      expect(f.configValue(lane).worktreeSetup).toBe(originalText);
      expect(await readFile(f.env.SETUP_BYTES, 'utf8')).toBe(originalText);
      await f.clean(lane);
    }),
  );

test.concurrent(
  'try retains its path after a setup preparation failure',
  withProject(async (f) => {
    const input = await setupInput(f, 'void 0;\n');
    const lane = join(f.repo, '.claude/worktrees/setup-try');
    const result = await f.setup(['try', ...writeOptions, '--setup-file', input], { env: { TMPDIR: f.repo } });
    expect(result.code).toBe(1);
    expect(result.stdout).toBe(`\n${lane}\n`);
    expect(result.stderr).toContain('temporary directory must be outside the checkout');
    expect(await exists(await f.marker(lane))).toBe(false);
    await f.clean(lane);
    await f.clean();
  }),
);

test.concurrent(
  'equivalent Git checkout paths still identify an owned setup lane',
  withProject(async (f) => {
    const lane = await productLane(f);
    await f.config('landing: merge\nworktreeSetup: void 0;\n');
    await f.aliasGitPaths();
    const result = await f.setup(['lane', lane]);
    expect(result.code, result.stderr).toBe(0);
    expect(await exists(await f.marker(lane))).toBe(true);
    await f.clean(lane);
  }),
);
