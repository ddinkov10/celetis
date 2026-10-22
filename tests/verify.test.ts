import { expect, test } from 'bun:test';
import { cp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { command, isolatedArgs, root, withFixture } from './lib/fixture.ts';

const gate = 'scripts/verify.ts';
const tracked = async (cwd = root) => {
  const result = await command('git', ['ls-files', '-z'], { cwd });
  if (result.code) throw new Error(result.stderr);
  return result.stdout.split('\0').filter(Boolean);
};
async function gateCopy(f: Awaited<ReturnType<typeof import('./lib/fixture.ts').fixture>>) {
  const checkout = join(f.dir, 're po');
  await mkdir(checkout);
  for (const file of await tracked()) {
    await mkdir(dirname(join(checkout, file)), { recursive: true });
    await cp(join(root, file), join(checkout, file));
  }
  for (const args of [
    ['init', '-q'],
    ['add', '-A'],
  ])
    expect((await command('git', args, { cwd: checkout })).code).toBe(0);
  return checkout;
}
const runGate = (cwd: string, env = process.env) =>
  command(process.execPath, [...isolatedArgs, join(cwd, gate)], { cwd, env, timeout: 25_000 });
const output = (result: { stdout: string; stderr: string }) => result.stdout + result.stderr;
const hasLine = (text: string, line: string) => expect(text.split('\n')).toContain(line);

test(
  'clean_drift: gate reports each installed pin, warns on drift, and ends with PASS',
  withFixture(async (f) => {
    const checkout = await gateCopy(f);
    await writeFile(join(checkout, 'scripts/lib/ok.ts'), 'export const version: string = Bun.version;\n');
    await command('git', ['add', '-A'], { cwd: checkout });
    const actual = Bun.which('actionlint') ?? '';
    await f.stub(
      'actionlint',
      `if(process.argv[2]==='--version'){console.log('1.7.11');process.exit(0);}const{spawnSync}=await import('node:child_process');const r=spawnSync(${JSON.stringify(actual)},process.argv.slice(2),{stdio:'inherit'});process.exitCode=r.status??1;`,
    );
    const result = await runGate(checkout, { ...process.env, PATH: `${join(f.dir, 'bin')}:${process.env.PATH}` });
    expect(result.code, output(result)).toBe(0);
    hasLine(output(result), '== actionlint 1.7.11');
    hasLine(output(result), 'verify: warning: actionlint 1.7.11 is not the pin 1.7.12 (tests/lib/tools.txt)');
    for (const tool of ['actionlint', 'biome', 'tsc', '@types/bun'])
      expect(output(result)).toMatch(new RegExp(`^== ${tool} [0-9]+\\.[0-9]+\\.[0-9]+$`, 'm'));
    hasLine(output(result), '== tsc');
    expect(result.stdout.trimEnd().split('\n').at(-1)).toBe('verify: PASS');
  }),
  29_000,
);

test(
  'tools_missing: gate stops before checks when a pinned executable is absent',
  withFixture(async (f) => {
    const checkout = await gateCopy(f);
    await mkdir(join(f.dir, 'missing-bin'));
    for (const name of ['git', 'claude', 'tsc', 'biome']) {
      const found = Bun.which(name);
      if (found) await symlink(found, join(f.dir, 'missing-bin', name));
    }
    const result = await runGate(checkout, { ...process.env, PATH: join(f.dir, 'missing-bin') });
    expect(result.code).toBe(1);
    expect(
      output(result)
        .split('\n')
        .filter((line) => line.startsWith('verify: actionlint')),
    ).toHaveLength(1);
    hasLine(
      output(result),
      'verify: actionlint is missing: install the pinned tools with scripts/install-tools.ts (AGENTS.md, "Verify gate")',
    );
    expect(output(result)).not.toContain('verify: PASS');
    expect(output(result)).not.toContain('== biome check');
  }),
  29_000,
);

test(
  'tools_missing_bun_types: gate names the missing package directory before checks',
  withFixture(async (f) => {
    const checkout = await gateCopy(f);
    await f.write('tools/node_modules/typescript/package.json', '{"name":"typescript","version":"7.0.2"}');
    await f.write('tools/node_modules/typescript/bin/tsc', 'console.log("7.0.2");', 0o755);
    await mkdir(join(f.dir, 'tools/bin'));
    await symlink('../node_modules/typescript/bin/tsc', join(f.dir, 'tools/bin/tsc'));
    const result = await runGate(checkout, { ...process.env, PATH: `${join(f.dir, 'tools/bin')}:${process.env.PATH}` });
    expect(result.code).toBe(1);
    expect(output(result)).toContain(`verify: @types/bun is missing from ${join(f.dir, 'tools/node_modules')}`);
    expect(output(result)).not.toContain('verify: PASS');
    expect(output(result)).not.toContain('== biome check');
  }),
  29_000,
);

test(
  'unknown_path: gate refuses a tracked file without a check or a role',
  withFixture(async (f) => {
    const checkout = await gateCopy(f);
    await writeFile(join(checkout, 'notes.xyz'), '');
    await command('git', ['add', '-A'], { cwd: checkout });
    const result = await runGate(checkout);
    expect(result.code).toBe(1);
    hasLine(output(result), 'verify: no check for notes.xyz: add a row or an exemption in scripts/verify.ts');
    expect(output(result)).not.toContain('verify: PASS');
  }),
  29_000,
);

test(
  'faults: gate propagates independent formatting, workflow, runtime, DOM, native, config, plugin, and text failures',
  withFixture(async (f) => {
    const checkout = await gateCopy(f);
    for (const [path, source] of [
      ['bad-format.ts', 'export const a = {b:1}\n'],
      ['.github/workflows/bad.yml', 'on: push\njobs:\n  a:\n    steps:\n      - run: echo x\n'],
      ['scripts/lib/bad.ts', "export const n: number = 'a';\n"],
      ['tests/lib/bad.ts', "export const value: number = 'a';\n"],
      ['board/bad.ts', "export const value: number = 'a';\n"],
      ['hooks/bad.ts', 'export const value = Bun.version;\n'],
      ['.celetis.yaml', 'landing: [\n'],
      ['.claude-plugin/plugin.json', '{"name":""}\n'],
      ['bad-text.md', `A ${'back' + 'end'} detail.\n`],
    ] as const) {
      await writeFile(join(checkout, path), source);
    }
    await command('git', ['add', '-A'], { cwd: checkout });
    const result = await runGate(checkout);
    expect(result.code, output(result)).toBe(1);
    expect(output(result)).toContain('bad-format.ts');
    hasLine(output(result), 'verify: fix each file that Biome names above with biome check --write <file>');
    expect(output(result)).toMatch(/\.github\/workflows\/bad\.yml:[0-9]+:[0-9]+: .*\[syntax-check\]/);
    hasLine(output(result), 'FAIL: actionlint (exit 1)');
    for (const path of ['scripts/lib/bad.ts', 'tests/lib/bad.ts', 'board/bad.ts'])
      expect(output(result)).toContain(`${path}(1,14): error TS2322`);
    expect(output(result)).toContain("Cannot find name 'Bun'");
    hasLine(output(result), 'FAIL: tsc (exit 1)');
    expect(output(result)).toContain('re po/.celetis.yaml: <document>: invalid YAML');
    hasLine(output(result), 'FAIL: config (exit 1)');
    hasLine(output(result), 'FAIL: plugin (exit 1)');
    hasLine(output(result), 'FAIL: text (exit 1)');
    expect(output(result)).not.toContain('verify: PASS');
  }),
  29_000,
);

test(
  'parse_fault: gate reports Bun parse and Biome lint failures',
  withFixture(async (f) => {
    const checkout = await gateCopy(f);
    await writeFile(join(checkout, 'scripts/bad-parse.ts'), 'export const = ;\n');
    await writeFile(join(checkout, 'scripts/bad-lint.ts'), "const a = 'x';\nexport const b = a + 'y';\n");
    await command('git', ['add', '-A'], { cwd: checkout });
    const result = await runGate(checkout);
    expect(result.code).toBe(1);
    expect(output(result)).toContain('bad-parse.ts');
    expect(output(result)).toContain('bad-lint.ts');
    hasLine(output(result), 'FAIL: biome (exit 1)');
    hasLine(output(result), 'FAIL: tsc (exit 1)');
    expect(output(result)).not.toContain('verify: PASS');
  }),
  29_000,
);

test('final tracked tree contains no obsolete language programs or unexplained JavaScript', async () => {
  const paths = await tracked();
  const generated = [
    'scripts/celetis',
    'board/board.js',
    'board/view.mjs',
    'board/ui.mjs',
    'board/panel.mjs',
    'board/palette.mjs',
    'hooks/entry.js',
    'tests/manual/native-observer/hooks/register.js',
  ];
  const shellPrograms: string[] = [];
  const otherPrograms: string[] = [];
  const unexplained: string[] = [];
  for (const path of paths) {
    const source = (await readFile(join(root, path))).toString('utf8');
    if (/\.sh$/.test(path) || /^#![^\n]*\b(?:bash|sh|zsh|dash)\b/.test(source)) shellPrograms.push(path);
    if (/\.(?:pl|jq)$/.test(path) || /^#![^\n]*\b(?:perl|jq)\b/.test(source)) otherPrograms.push(path);
    if (/\.(?:mjs|cjs|js)$/.test(path) && !generated.includes(path) && path !== 'scripts/lib/vendor/yaml.mjs')
      unexplained.push(path);
  }
  expect(shellPrograms).toEqual([]);
  expect(otherPrograms).toEqual([]);
  expect(unexplained).toEqual([]);
  expect((await stat(join(root, 'scripts/celetis'))).mode & 0o777).toBe(0o755);
});

test('final assertion map has no missing replacement or live removed-path caller', async () => {
  const cases = JSON.parse(await readFile(join(root, 'tests/fixtures/toolchain-cases.json'), 'utf8')) as {
    source: string;
    line: number;
    replacement: string;
    test: string;
  }[];
  const unmapped: string[] = [];
  for (const row of cases)
    if (
      !(await Bun.file(join(root, row.replacement)).exists()) ||
      !(await readFile(join(root, row.replacement), 'utf8')).includes(row.test)
    )
      unmapped.push(`${row.source}:${row.line}`);
  expect(unmapped).toEqual([]);
  expect(cases.length).toBeGreaterThan(100);
  const { removedPaths } = JSON.parse(await readFile(join(root, 'tests/fixtures/toolchain-callers.json'), 'utf8')) as {
    removedPaths: string[];
  };
  const callers: string[] = [];
  for (const path of await tracked()) {
    if (
      /^docs\/adr\/00(?:0[1-9]|1[0-9]|2[0-4])-/.test(path) ||
      [
        'tests/fixtures/toolchain-cases.json',
        'tests/fixtures/toolchain-callers.json',
        'tests/fixtures/capscore-reference.json',
        'tests/fixtures/next-step-reference.json',
      ].includes(path)
    )
      continue;
    const source = await readFile(join(root, path), 'utf8');
    for (const old of removedPaths) {
      const pattern = new RegExp(`${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_./-])`);
      if (pattern.test(source)) callers.push(`${path}: ${old}`);
    }
  }
  expect(callers).toEqual([]);
});

test(
  'build --check preserves every tracked byte and mode',
  withFixture(async (f) => {
    const checkout = await gateCopy(f);
    const snapshot = async () =>
      Promise.all(
        (await tracked(checkout)).map(async (path) => [
          path,
          (await stat(join(checkout, path))).mode & 0o777,
          Bun.hash(await readFile(join(checkout, path))).toString(),
        ]),
      );
    const before = await snapshot();
    const result = await command(process.execPath, [...isolatedArgs, join(checkout, 'scripts/build.ts'), '--check'], {
      cwd: checkout,
    });
    expect(result.code, output(result)).toBe(0);
    expect(JSON.stringify(await snapshot()) !== JSON.stringify(before)).toBe(false);
  }),
);

for (const [path, content] of [
  ['hidden-executable', '#!/bin/sh\necho bad\n'],
  ['hidden-perl', '#!/usr/bin/env perl\n'],
  ['hidden-jq', '#!/usr/bin/env jq\n'],
  ['hidden-node', '#!/usr/bin/env node\n'],
  ['obsolete.sh', ''],
  ['obsolete.pl', ''],
  ['obsolete.jq', ''],
  ['authored.mjs', 'export const source = true;\n'],
  ['script.js', 'console.log(1);\n'],
  ['extra.txt', 'unclassified\n'],
])
  test(`classifier refuses unexplained ${path}`, async () => {
    const { classify } = await import(join(root, gate));
    expect(() => classify(path, Buffer.from(content ?? ''))).toThrow();
  });
