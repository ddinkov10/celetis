import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JobResult } from '../scripts/lib/parallel.ts';
import { command, isolatedArgs, root, withFixture } from './lib/fixture.ts';

const parallel = join(root, 'scripts/lib/parallel.ts');

test(
  'pool output stays in start order',
  withFixture(async (f) => {
    const { runJobs, printJobs } = await import(parallel);
    const results = await runJobs(
      [
        {
          label: 'first',
          file: process.execPath,
          args: [...isolatedArgs, '-e', "await Bun.sleep(300); console.log('a')"],
        },
        { label: 'second', file: process.execPath, args: [...isolatedArgs, '-e', "console.log('b')"] },
        { label: 'third', file: process.execPath, args: [...isolatedArgs, '-e', "console.log('c')"] },
      ],
      { workers: 3 },
    );
    let output = '';
    expect(
      printJobs(results, (text: string) => {
        output += text;
      }),
    ).toBe(0);
    expect(output).toBe('a\nb\nc\n');
    expect(results.map((value: { label: string }) => value.label)).toEqual(['first', 'second', 'third']);
    expect(await Bun.file(join(f.dir, 'unused')).exists()).toBe(false);
  }),
);

test('pool reports failed children and resets for a passing phase', async () => {
  const { runJobs, printJobs } = await import(parallel);
  const jobs = (code: number) => [
    { label: code ? 'bad' : 'good', file: process.execPath, args: [...isolatedArgs, '-e', `process.exit(${code})`] },
  ];
  let output = '';
  expect(
    printJobs(await runJobs([...jobs(0), ...jobs(1)]), (text: string) => {
      output += text;
    }),
  ).toBe(1);
  expect(output).toBe('FAIL: bad (exit 1)\n');
  expect(printJobs(await runJobs(jobs(0)), () => {})).toBe(0);
});

test('pool stops a failing program before its later output', async () => {
  const { runJobs } = await import(parallel);
  const result = await runJobs([
    {
      label: 'stops',
      file: process.execPath,
      args: [...isolatedArgs, '-e', "throw new Error('stop'); console.log('after')"],
    },
  ]);
  expect(result[0].code).not.toBe(0);
  expect(result[0].output).not.toContain('\nafter\n');
});

test(
  'pool limits six independent jobs to two active children',
  withFixture(async (f) => {
    const { runJobs } = await import(parallel);
    const entry = await f.write(
      'busy.ts',
      `import {writeFile,readdir,rm} from 'node:fs/promises';import {join} from 'node:path';
const name=process.argv[2]!;await writeFile(join(process.cwd(),name),'');console.log((await readdir(process.cwd())).length);await Bun.sleep(200);await rm(join(process.cwd(),name));`,
    );
    const results = await runJobs(
      Array.from({ length: 6 }, (_, i) => ({
        label: `busy ${i + 1}`,
        file: process.execPath,
        args: [...isolatedArgs, entry, String(i + 1)],
        cwd: f.repo,
      })),
      { workers: 2 },
    );
    expect(results.every((r: { code: number }) => r.code === 0)).toBe(true);
    expect(Math.max(...results.map((r: { output: string }) => Number(r.output.trim())))).toBeLessThanOrEqual(2);
  }),
);

test('pool second phase prints only the new output', async () => {
  const { runJobs, printJobs } = await import(parallel);
  const job = (name: string) => [
    { label: name, file: process.execPath, args: [...isolatedArgs, '-e', `console.log(${JSON.stringify(name)})`] },
  ];
  await runJobs(job('one'));
  let output = '';
  printJobs(await runJobs(job('two')), (text: string) => {
    output += text;
  });
  expect(output).toBe('two\n');
});

test('suite discovers every automatic entry and excludes token programs', async () => {
  const { discoverTests } = await import(join(root, 'tests/suite.ts'));
  const files: string[] = await discoverTests(root);
  const listed = await command('git', ['ls-files', '-z'], { cwd: root });
  expect(listed.code).toBe(0);
  expect(files).toEqual(
    listed.stdout
      .split('\0')
      .filter((path) => /(?:[._](?:test|spec))\.ts$/.test(path))
      .sort(),
  );
  for (const file of [
    'tests/runner-startup.test.ts',
    'tests/host-observation.test.ts',
    'tests/host-identity.test.ts',
    'tests/host-resume.test.ts',
    'tests/land.test.ts',
    'tests/land-pr.test.ts',
    'tests/land-checks.test.ts',
    'board/cli.test.ts',
    'board/build.test.ts',
    'tests/native-entry.test.ts',
    'tests/native-observer.test.ts',
    'tests/native-events-harness.test.ts',
    'tests/custom-part-harness.test.ts',
    'tests/manual-harness.test.ts',
    'tests/manual-cleanup.test.ts',
  ])
    expect(files).toContain(file);
  expect(files.filter((file) => file.startsWith('board/'))).toHaveLength(12);
  const { processEntries } = await import(join(root, 'tests/suite.ts'));
  expect(processEntries).toContain('board/realpath.test.ts');
  expect(processEntries).toContain('tests/runner-startup.test.ts');
  expect(processEntries).toContain('tests/host-observation.test.ts');
  expect(processEntries).toContain('tests/host-identity.test.ts');
  expect(processEntries).toContain('tests/host-resume.test.ts');
  expect(files).not.toContain('tests/manual/step-prompt.ts');
  expect(files).not.toContain('tests/manual/custom-part.ts');
  expect(new Set(files).size).toBe(files.length);
});

test(
  'suite fails on a worker test failure',
  withFixture(async (f) => {
    const { suite } = await import(join(root, 'tests/suite.ts'));
    await f.write('repo dir/one.test.ts', "import {test,expect} from 'bun:test';test('bad',()=>expect(1).toBe(2));");
    const result = await suite({ root: f.repo, workers: 1, output: () => {} });
    expect(result.code).not.toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].output).toContain('1 fail');
  }),
);

test(
  'suite default runs one file worker at a time',
  withFixture(async (f) => {
    const { suite } = await import(join(root, 'tests/suite.ts'));
    const source = `import {test,expect} from 'bun:test';import {mkdir,rm} from 'node:fs/promises';import {join} from 'node:path';test('exclusive file allocation',async()=>{const active=join(process.cwd(),'active');await mkdir(active);try{await Bun.sleep(200);expect(true).toBe(true);}finally{await rm(active,{recursive:true});}});`;
    await f.write('repo dir/one.test.ts', source);
    await f.write('repo dir/two.test.ts', source);
    const result: { code: number; results: JobResult[] } = await suite({ root: f.repo, output: () => {} });
    expect(result.code, result.results.map((entry) => entry.output).join('\n')).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((entry) => entry.code === 0)).toBe(true);
  }),
);

test(
  'pool preserves a passing child when the parent deadline clock advances',
  withFixture(async (f) => {
    const driver = await f.write(
      'driver.ts',
      `import {runJobs} from ${JSON.stringify(parallel)};
const schedule=globalThis.setTimeout;
globalThis.setTimeout=((callback,delay,...args)=>schedule(callback,0,...args)) as typeof setTimeout;
const results=await runJobs([{label:'passing',file:process.execPath,args:${JSON.stringify([...isolatedArgs, '-e', "await Bun.sleep(25); console.log('passed')"])} }]);
console.log(JSON.stringify(results));`,
    );
    const result = await f.bun(driver);
    expect(result.code, result.stderr).toBe(0);
    const results: JobResult[] = JSON.parse(result.stdout);
    expect(results).toHaveLength(1);
    expect(results[0]?.code).toBe(0);
    expect(results[0]?.output).toBe('passed\n');
  }),
);

test(
  'pool reports a spawn failure',
  withFixture(async (f) => {
    const { runJobs } = await import(parallel);
    const missing = join(f.dir, 'missing');
    const results = await runJobs([{ label: 'missing', file: missing, args: [] }]);
    expect(results[0].code).toBe(127);
    expect(results[0].output).toContain('ENOENT');
  }),
);

test(
  'pool cleans a TERM-ignoring descendant after its parent exits successfully',
  withFixture(async (f) => {
    const { runJobs } = await import(parallel);
    const pidFile = join(f.dir, 'pid');
    const descendant = await f.write(
      'descendant.ts',
      `import {writeFileSync} from 'node:fs';process.on('SIGTERM',()=>{});writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000);`,
    );
    const worker = await f.write(
      'worker.ts',
      `import {spawn} from 'node:child_process';spawn(process.execPath,${JSON.stringify(isolatedArgs)}.concat(${JSON.stringify(descendant)}),{stdio:'inherit'});while(!(await Bun.file(${JSON.stringify(pidFile)}).exists()))await Bun.sleep(10);process.exit(0);`,
    );
    const results = await runJobs([{ label: 'parent', file: process.execPath, args: [...isolatedArgs, worker] }]);
    expect(results[0].code).toBe(0);
    const pid = Number(await readFile(pidFile, 'utf8'));
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
  }),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  test(
    `pool ${signal} stops active children and does not start queued jobs`,
    withFixture(async (f) => {
      const { spawn } = await import('node:child_process');
      const child = await f.write(
        'child.ts',
        `import {writeFileSync} from 'node:fs';process.on('SIGTERM',()=>{});writeFileSync(${JSON.stringify(join(f.dir, 'pid'))},String(process.pid));setInterval(()=>{},1000);`,
      );
      const driver = await f.write(
        'driver.ts',
        `import {runJobs} from ${JSON.stringify(parallel)};const results=await runJobs([{label:'active',file:process.execPath,args:${JSON.stringify([...isolatedArgs, child])}},{label:'queued',file:process.execPath,args:${JSON.stringify([...isolatedArgs, '-e', `await Bun.write(${JSON.stringify(join(f.dir, 'queued'))},'ran')`])}}],{workers:1});process.exitCode=results.some(r=>r.code!==0)?1:0;`,
      );
      const processChild = spawn(process.execPath, [...isolatedArgs, driver], { env: f.env, stdio: 'ignore' });
      const closed = new Promise<number | null>((done) => processChild.once('close', done));
      try {
        const deadline = performance.now() + 3000;
        while (!(await Bun.file(join(f.dir, 'pid')).exists()) && performance.now() < deadline) await Bun.sleep(10);
        const pid = Number(await readFile(join(f.dir, 'pid'), 'utf8'));
        processChild.kill(signal);
        expect(await closed).not.toBe(0);
        expect(() => process.kill(pid, 0)).toThrow();
        expect(await Bun.file(join(f.dir, 'queued')).exists()).toBe(false);
      } finally {
        processChild.kill('SIGKILL');
        await closed;
      }
    }),
  );
