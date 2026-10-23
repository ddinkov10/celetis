import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { command, root } from './lib/fixture.ts';

const skills =
  'intake triage feature bug hotfix chore specify plan implement critic-loop polishing-code-comments lesson lesson-review record-architecture-decisions doc-drift-sync prototype writing-for-agents guide setup'.split(
    ' ',
  );
const human = ['guide', 'setup'];
const sourceRepo = 'ddinkov10/fwrh_calculator';
const hostEntry =
  "**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.";
const trackedResult = await command('git', ['ls-files', '-z'], { cwd: root });
if (trackedResult.code) throw new Error(trackedResult.stderr);
const tracked = trackedResult.stdout.split('\0').filter(Boolean).sort();
const files = new Map(
  await Promise.all(tracked.map(async (path) => [path, await readFile(resolve(root, path))] as const)),
);
const text = (path: string) => files.get(path)?.toString('utf8') ?? '';
const entries = [...files]
  .filter(([, bytes]) => !bytes.includes(0))
  .map(([path, bytes]) => [path, bytes.toString('utf8')] as const);
const selected = entries.filter(
  ([path]) => path.startsWith('skills/') || path === 'step-prompt.md' || /^docs\/(?:hosts\/)?[^/]+\.md$/.test(path),
);
const violations = (sources: readonly (readonly [string, string])[], pattern: RegExp) =>
  sources.flatMap(([path, source]) =>
    source.split('\n').flatMap((line, index) => (pattern.test(line) ? [`${path}:${index + 1}:${line}`] : [])),
  );
const required = (path: string, values: string[]) => {
  for (const value of values) expect(text(path), `${path}: ${value}`).toContain(value);
};

function frontmatter(path: string): string[] {
  const lines = text(path).split('\n');
  if (lines.shift() !== '---') return [];
  const end = lines.indexOf('---');
  return end >= 0 && lines.slice(0, end).every((line) => /^[A-Za-z0-9_-]+: ./.test(line)) ? lines.slice(0, end) : [];
}

test('general product words have exact used allowances', () => {
  expect(files.has('tests/product-words.allow')).toBe(true);
  const allow = text('tests/product-words.allow').trimEnd().split('\n');
  const used = new Set<number>();
  const unallowed: string[] = [];
  for (const [path, source] of entries) {
    if (
      /^docs\/adr\/[0-9]+-.*\.md$/.test(path) ||
      [
        'tests/text.test.ts',
        'tests/product-words.allow',
        'tests/fixtures/toolchain-cases.json',
        'tests/fixtures/toolchain-callers.json',
        'tests/fixtures/capscore-reference.json',
        'tests/fixtures/next-step-reference.json',
      ].includes(path)
    )
      continue;
    for (const [n, line] of source.split('\n').entries()) {
      if (!/\b(?:backend|frontend|staging|promote|fwhr|DESIGN\.md|verify\.py)\b/i.test(line)) continue;
      let accepted = false;
      for (const [i, value] of allow.entries()) {
        const tab = value.indexOf('\t');
        if (tab > 0 && value.slice(0, tab) === path && value.slice(tab + 1) && line.includes(value.slice(tab + 1))) {
          used.add(i);
          accepted = true;
        }
      }
      if (!accepted) unallowed.push(`${path}:${n + 1}:${line}`);
    }
  }
  expect(unallowed).toEqual([]);
  expect(allow.filter((_, i) => !used.has(i))).toEqual([]);
});

const records = tracked.filter((path) => /^docs\/adr\/[0-9]+-.*\.md$/.test(path));
const numbers = records.map((path) => path.slice('docs/adr/'.length).split('-')[0]);
test('ADR records start at 0001 with no gap and at least 14 records', () => {
  expect(numbers.length).toBeGreaterThanOrEqual(14);
  expect(numbers).toEqual(numbers.map((_, i) => String(i + 1).padStart(4, '0')));
});
for (let n = 1; n <= 11; n++)
  test(`copied ADR ${String(n).padStart(4, '0')} retains its source line`, () => {
    const path = records[n - 1] ?? '';
    expect(text(path).split('\n')[2]).toBe(
      `Source: ${sourceRepo} ADR-${String(n + 6).padStart(4, '0')}. Each issue number of this record is an issue of that repository.`,
    );
  });
test('each local ADR reference names a record', () => {
  const dangling = entries.flatMap(([path, source]) =>
    [...source.matchAll(/(?:ddinkov10\/fwrh_calculator )?ADR-([0-9]+)/g)]
      .filter((match) => !match[0].startsWith(sourceRepo) && !numbers.includes(match[1]))
      .map((match) => `${path}: ${match[0]}`),
  );
  expect(dangling).toEqual([]);
});
test('each skill file belongs to a known skill', () => {
  expect(
    tracked.filter(
      (path) =>
        path.startsWith('skills/') && (!path.slice(7).includes('/') || !skills.includes(path.split('/')[1] ?? '')),
    ),
  ).toEqual([]);
});
for (const skill of skills)
  test(`skill ${skill} retains its frontmatter and common Host entry`, () => {
    const path = `skills/${skill}/SKILL.md`;
    expect(files.has(path)).toBe(true);
    const front = frontmatter(path);
    expect(front).toContain(`name: ${skill}`);
    if (human.includes(skill)) expect(front).toContain('disable-model-invocation: true');
    else expect(front.filter((line) => line.startsWith('disable-model-invocation:'))).toEqual([]);
    expect(text(path).split('---')[2]?.trimStart().split('\n')[0]).toBe(hostEntry);
    expect(text(path)).not.toMatch(/!`|```!/);
  });
test('active instructions use current folders, flow name, and public commands', () => {
  expect(violations(selected, /\.claude\/(?:scripts|skills|commands)\/|docs\/agents\//)).toEqual([]);
  expect(violations(selected, /agent[-_ ]flow/i)).toEqual([]);
  const procedures = selected.filter(([path]) => path.startsWith('skills/') || path === 'step-prompt.md');
  for (const script of tracked.filter((path) => /^scripts\/[^/]+\.ts$/.test(path)))
    expect(procedures.filter(([, source]) => source.includes(script))).toEqual([]);
  expect(
    violations(
      selected,
      /(^|[ `("']|→)\/(intake|triage|feature|bug|hotfix|chore|plan|implement|guide|setup|critic-loop|lesson|lesson-review|record-architecture-decisions|doc-drift-sync)([^A-Za-z0-9_-]|$)/,
    ),
  ).toEqual([]);
});
test('commands use REST without GraphQL or search paths', () => {
  expect(
    violations(
      entries.filter(([path]) => path.startsWith('scripts/')),
      /(^|[^A-Za-z0-9_])gh ((issue|pr|repo|label|search) |api .*(graphql|search\/))/,
    ),
  ).toEqual([]);
});
test('plugin citations resolve and borrowed skills include their custom entry', () => {
  for (const [from, source] of entries.filter(([path]) => path.startsWith('skills/'))) {
    for (const match of source.matchAll(/<plugin>\/([A-Za-z0-9._/-]*[A-Za-z0-9])/g)) {
      expect(files.has(match[1] ?? ''), `${from}: ${match[0]}`).toBe(true);
      const skill = /^skills\/([^/]+)\/SKILL\.md$/.exec(from)?.[1];
      const other = /^skills\/([^/]+)\/SKILL\.md$/.exec(match[1] ?? '')?.[1];
      if (skill && other && skill !== other) expect(source).toContain(`custom.${other}`);
    }
  }
  expect(
    violations(
      entries.filter(([path]) => path.startsWith('skills/') && !/^skills\/[^/]+\/SKILL\.md$/.test(path)),
      /<plugin>\//,
    ),
  ).toEqual([]);
  expect(
    violations(
      entries.filter(([path]) => path.startsWith('skills/') || path.startsWith('docs/hosts/')),
      /\.claude\/celetis-flow\/custom\//,
    ),
  ).toEqual([]);
});
test('bundled Markdown links resolve to tracked files', () => {
  for (const [path, source] of entries.filter(
    ([path]) => path.startsWith('skills/') || path.startsWith('docs/hosts/') || path === 'docs/docs-lookup.md',
  )) {
    for (const match of source.matchAll(/\]\(([./A-Za-z0-9_-]+[.]md)\)/g))
      expect(files.has(relative(root, resolve(root, dirname(path), match[1] ?? ''))), `${path}: ${match[1]}`).toBe(
        true,
      );
  }
});
test('Host entry preserves its native YAML contract', () => {
  required('docs/hosts/entry.md', [
    '.celetis.yaml',
    'custom.<name>',
    'configuration.md',
    'whole',
    'once',
    'parsed string',
    'absolute directory containing',
    'before any product-path scan',
  ]);
  for (const host of ['claude', 'codex']) required(`docs/hosts/${host}.md`, ['.git', 'shell', 'context']);
  required('hooks/entry.js', ['.celetis.yaml']);
  required('docs/hosts/codex.md', [
    '.celetis.yaml',
    'active checkout binding',
    'tool process cwd',
    'Do not read a `.git` directory',
    'multi_agent_v1.spawn_agent',
    'fork_context: false',
    'multi_agent_v1.send_input',
    'codex debug models',
    'tool search',
    'collaboration.followup_task',
  ]);
  required('docs/hosts/claude.md', [
    'hooks/entry.js',
    'native destination',
    '$.session.root()',
    '$.session.cwd()',
    '$.fs.stat',
    'permission-checked',
    'zero content reads',
    'one whole `Read` request',
    'including commentary',
    'file_unchanged',
    'seeded result',
    'compacted',
    'another access path',
    'hook setup',
    'later full-file',
    'new invocation',
    'same agent loop',
    'not in the environment of a Bash tool command',
  ]);
});
test('host resources and human guide contracts remain available', () => {
  for (const path of [
    'docs/hosts/entry.md',
    'docs/hosts/claude.md',
    'docs/hosts/codex.md',
    'skills/guide/agents/openai.yaml',
    'skills/setup/agents/openai.yaml',
  ])
    expect(files.has(path), path).toBe(true);
  required('skills/guide/SKILL.md', [
    'launcher recommendation',
    '--agent claude <command>',
    '--agent codex <command>',
    "person's terminal",
    'After Host entry succeeds',
    'If entry stops',
    'conditional commands',
  ]);
  required('README.md', ['Claude Code 2.1.299 or later', 'Codex CLI 0.162.1 or later']);
  expect(
    violations(
      entries.filter(([path]) => path.startsWith('skills/') || path === 'step-prompt.md'),
      /\$ARGUMENTS|CLAUDE_PLUGIN_ROOT|EnterWorktree|ExitWorktree|\(Skill tool\)|scratchpad directory/,
    ),
  ).toEqual([]);
  for (const skill of human)
    expect(text(`skills/${skill}/agents/openai.yaml`).trimEnd()).toBe('policy:\n  allow_implicit_invocation: false');
});
test('plugin and marketplace manifests preserve one unversioned root package', () => {
  const plugin = JSON.parse(text('.claude-plugin/plugin.json'));
  expect(plugin.name).toBe('celetis');
  expect(typeof plugin.description).toBe('string');
  expect(plugin.description.length).toBeGreaterThan(0);
  expect(Object.hasOwn(plugin, 'version')).toBe(false);
  const market = JSON.parse(text('.claude-plugin/marketplace.json'));
  expect(market.name).toBe('celetis');
  expect(typeof market.owner.name).toBe('string');
  expect(market.owner.name.length).toBeGreaterThan(0);
  expect(market.plugins).toHaveLength(1);
  expect(market.plugins[0].name).toBe('celetis');
  expect(market.plugins[0].source).toBe('./');
  expect(Object.hasOwn(market.plugins[0], 'version')).toBe(false);
});
test('all shared package resources are tracked', () => {
  for (const path of [
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    'scripts/celetis',
    'scripts/celetis-flow.ts',
    'scripts/next-step.ts',
    'scripts/worktree.ts',
    'scripts/land.ts',
    'scripts/setup.ts',
    'scripts/capscore.ts',
    'scripts/plugin-update.ts',
    'scripts/lib/host.ts',
    'scripts/lib/session.ts',
    'scripts/lib/config.ts',
    'scripts/lib/vendor/yaml.mjs',
    'scripts/lib/vendor/yaml.LICENSE',
    'step-prompt.md',
    'docs/capability.md',
    'docs/docs-lookup.md',
    'docs/adr/README.md',
    'docs/adr/template.md',
  ])
    expect(files.has(path), path).toBe(true);
});
test('Claude permission rules retain landing forms and deny direct merges', () => {
  const { permissions } = JSON.parse(text('.claude/settings.json'));
  expect(Array.isArray(permissions.allow)).toBe(true);
  expect(Array.isArray(permissions.deny)).toBe(true);
  for (const rule of [
    'Bash(scripts/celetis land *)',
    'Bash(scripts/celetis --agent claude land *)',
    'Bash(scripts/celetis --agent codex land *)',
  ])
    expect(permissions.allow).toContain(rule);
  for (const rule of ['Bash(gh pr merge*)', 'PowerShell(gh pr merge*)']) expect(permissions.deny).toContain(rule);
});
