import { expect, test } from 'bun:test';
import { closeSync, openSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { bunArgs, run } from '../scripts/lib/process.ts';
import { command, isolatedArgs, reader, withFixture } from './lib/fixture.ts';

test(
  'process runs in a private repository',
  withFixture(async (f) => {
    const repo = await f.repository();
    expect(await run('git', ['rev-parse', '--show-toplevel'], { cwd: repo, env: f.env })).toEqual({
      code: 0,
      stdout: `${repo}\n`,
      stderr: '',
    });
  }),
);

test(
  'process preserves argv and failed status',
  withFixture(async (f) => {
    const marker = join(f.dir, 'marker');
    const echo = await f.stub('echo-argv', 'console.log(JSON.stringify(process.argv.slice(2)));');
    const fail = await f.stub('failure', "console.error('child failure'); process.exit(7);");
    const result = await run(echo, ['a b', "a'b", 'λ', '$(touch marker)', ''], { cwd: f.dir, env: f.env });
    const failed = await run(fail, [], { cwd: f.dir, env: f.env });
    expect(JSON.parse(result.stdout)).toEqual(['a b', "a'b", 'λ', '$(touch marker)', '']);
    expect(failed.code).toBe(7);
    expect(failed.stderr).toContain('child failure');
    expect(await Bun.file(marker).exists()).toBe(false);
  }),
);

test(
  'process options cannot enable a shell',
  withFixture(async (f) => {
    const echo = await f.stub('echo-argv', 'console.log(JSON.stringify(process.argv.slice(2)));');
    const result = await run(echo, ['a b', '$(touch marker)'], { cwd: f.dir, env: f.env, shell: true });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(['a b', '$(touch marker)']);
    expect(await Bun.file(join(f.dir, 'marker')).exists()).toBe(false);
  }),
);

test(
  'process collects concurrent stdout and stderr',
  withFixture(async (f) => {
    const child = await f.stub(
      'output',
      "const out = 'o'.repeat(16384); const err = 'e'.repeat(16384); for (let i = 0; i < 128; i++) { await Promise.all([new Promise(resolve => process.stdout.write(out, resolve)), new Promise(resolve => process.stderr.write(err, resolve))]); }",
    );
    const result = await run(child, [], { cwd: f.dir, env: f.env });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('o'.repeat(2 * 1024 * 1024));
    expect(result.stderr).toBe('e'.repeat(2 * 1024 * 1024));
  }),
);

test(
  'process decodes split UTF-8 output',
  withFixture(async (f) => {
    const child = await f.stub(
      'unicode',
      'process.stdout.write(new Uint8Array([0xce])); await Bun.sleep(10); process.stdout.write(new Uint8Array([0xbb]));',
    );
    expect(await run(child, [], { env: f.env })).toEqual({ code: 0, stdout: 'λ', stderr: '' });
  }),
);

test(
  'process keeps complete output on child failure',
  withFixture(async (f) => {
    const child = await f.stub(
      'failed-output',
      "const out = 'o'.repeat(16384); const err = 'e'.repeat(16384); for (let i = 0; i < 128; i++) { await Promise.all([new Promise(resolve => process.stdout.write(out, resolve)), new Promise(resolve => process.stderr.write(err, resolve))]); } process.exit(7);",
    );
    const result = await run(process.execPath, bunArgs(child, []), { env: f.env });
    expect(result.code).toBe(7);
    expect(result.stdout).toBe('o'.repeat(2 * 1024 * 1024));
    expect(result.stderr).toBe('e'.repeat(2 * 1024 * 1024));
  }),
);

test(
  'process keeps the 64 MiB result limit',
  withFixture(async (f) => {
    const child = await f.stub(
      'large',
      "const chunk = 'x'.repeat(1024 * 1024); for (let i = 0; i < 65; i++) await new Promise(resolve => process.stdout.write(chunk, resolve));",
    );
    const result = await run(child, [], { cwd: f.dir, env: f.env });
    expect(result.code).not.toBe(0);
    expect(result.stdout.length).toBe(64 * 1024 * 1024);
    expect(result.stderr).toContain('maxBuffer');
  }),
);

test(
  'process accepts a smaller result limit',
  withFixture(async (f) => {
    const child = await f.stub('large', "process.stdout.write('x'.repeat(2048));");
    const result = await run(child, [], { env: f.env, maxBuffer: 1024 });
    expect(result.code).not.toBe(0);
    expect(result.stdout.length).toBe(1024);
    expect(result.stderr).toContain('maxBuffer');
  }),
);

test(
  'process result limit counts UTF-8 bytes',
  withFixture(async (f) => {
    const child = await f.stub('unicode-limit', "process.stdout.write('λ'.repeat(4));");
    const result = await run(process.execPath, bunArgs(child, []), { env: f.env, maxBuffer: 3 });
    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe('λ');
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(3);
  }),
);

for (const stream of ['stdout', 'stderr'] as const) {
  test(
    `descriptor capture bounds ${stream} after a child writes again after TERM`,
    withFixture(async (f) => {
      const marker = join(f.dir, 'after-term');
      const child = await f.write(
        'overflow.ts',
        `import {writeFileSync} from 'node:fs';
const output=process.${stream};
output.on('error',()=>{});
let wroteAfterTerm=false;
process.on('SIGTERM',()=>{if(wroteAfterTerm)return;wroteAfterTerm=true;output.write('λ'.repeat(64),error=>writeFileSync(${JSON.stringify(marker)},error?.message??'written after TERM'));});
output.write('λ'.repeat(3));
await Bun.sleep(25);
output.write('λ'.repeat(64));
await Bun.sleep(150);
process.exit(0);`,
      );
      const retainedByteCounts: number[] = [];
      const byteLength = Buffer.byteLength;
      const fd = openSync('/dev/null', 'r');
      let result: Awaited<ReturnType<typeof run>>;
      try {
        Buffer.byteLength = (value, encoding) => {
          const length = byteLength(value, encoding);
          if (typeof value === 'string' && /^λ+$/.test(value)) retainedByteCounts.push(length);
          return length;
        };
        result = await run(process.execPath, bunArgs(child, []), {
          env: f.env,
          inheritedFd: fd,
          maxBuffer: 17,
        });
      } finally {
        Buffer.byteLength = byteLength;
        closeSync(fd);
      }
      expect(await f.read('after-term')).toBe('written after TERM');
      expect(retainedByteCounts.length).toBeGreaterThan(0);
      expect(Math.max(...retainedByteCounts)).toBeLessThanOrEqual(17);
      expect(result.code).toBe(1);
      expect(result[stream]).toBe('λ'.repeat(8));
      if (stream === 'stdout') expect(result.stderr).toContain('stdout maxBuffer');
      else expect(result.stdout).toBe('');
    }),
  );
}

test(
  'descriptor capture decodes split UTF-8 without exceeding the limit',
  withFixture(async (f) => {
    const child = await f.write(
      'split.ts',
      'process.stdout.write(new Uint8Array([0xce])); await Bun.sleep(10); process.stdout.write(new Uint8Array([0xbb]));',
    );
    const fd = openSync('/dev/null', 'r');
    try {
      expect(await run(process.execPath, bunArgs(child, []), { env: f.env, inheritedFd: fd, maxBuffer: 2 })).toEqual({
        code: 0,
        stdout: 'λ',
        stderr: '',
      });
    } finally {
      closeSync(fd);
    }
  }),
);

test(
  'process preserves signal exit status',
  withFixture(async (f) => {
    const child = await f.stub('signal', "console.log('before signal'); process.kill(process.pid, 'SIGTERM');");
    const result = await run(child, [], { env: f.env });
    expect(result.code).toBe(143);
    expect(result.stdout).toBe('before signal\n');
  }),
);

test(
  'process reports a missing executable',
  withFixture(async (f) => {
    const result = await run(join(f.dir, 'missing'), [], { env: f.env });
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('ENOENT');
  }),
);

test(
  'process timeout stops its child',
  withFixture(async (f) => {
    const child = await f.stub('timeout', 'console.log(process.pid); setInterval(() => {}, 1000);');
    const result = await run(process.execPath, bunArgs(child, []), { env: f.env, timeout: 150 });
    expect(result.code).toBe(143);
    const pid = Number(result.stdout.trim());
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
  }),
);

for (const stderr of ['', 'warning before cancellation\n', 'The operation was aborted\n'])
  test(
    `process cancellation retains exact child stderr ${JSON.stringify(stderr)}`,
    withFixture(async (f) => {
      const child = await f.write(
        'cancel.ts',
        `process.stderr.write(${JSON.stringify(stderr)});await Bun.write(${JSON.stringify(join(f.dir, 'pid'))},String(process.pid));await Bun.sleep(30_000);`,
      );
      const cancel = new AbortController();
      const result = run(process.execPath, bunArgs(child, []), { env: f.env, signal: cancel.signal });
      try {
        const deadline = performance.now() + 3000;
        while (!(await Bun.file(join(f.dir, 'pid')).exists())) {
          if (performance.now() >= deadline) throw new Error('cancelled child did not start');
          await Bun.sleep(10);
        }
      } finally {
        cancel.abort();
      }
      const actual = await result;
      const pid = Number(await f.read('pid'));
      const deadline = performance.now() + 3000;
      while (performance.now() < deadline) {
        try {
          process.kill(pid, 0);
        } catch {
          break;
        }
        await Bun.sleep(10);
      }
      expect(actual).toEqual({ code: 1, stdout: '', stderr });
      expect(() => process.kill(pid, 0)).toThrow();
    }),
  );

test(
  'failed child does not wait for a descendant output pipe',
  withFixture(async (f) => {
    const holder = await f.write('holder.ts', 'setInterval(() => {}, 1000);\n');
    const child = await f.stub(
      'pipe',
      `import { spawn } from 'node:child_process';\nconst child = spawn(process.execPath, ${JSON.stringify([...isolatedArgs, holder])}, { stdio: ['ignore', 1, 2] });\nconsole.log(child.pid);\nconsole.error('child failure');\nchild.unref();\nprocess.exit(7);`,
    );
    let pid = 0;
    const started = performance.now();
    try {
      const result = await run(process.execPath, bunArgs(child, []), { cwd: f.dir, env: f.env, timeout: 1500 });
      pid = Number(result.stdout.trim());
      expect(result.code).toBe(7);
      expect(result.stderr).toBe('child failure\n');
      expect(pid).toBeGreaterThan(0);
      expect(performance.now() - started).toBeLessThan(1000);
    } finally {
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
      }
    }
  }),
);

for (const scope of ['product', 'global']) {
  test(
    `invalid config starts no ${scope} preload`,
    withFixture(async (f) => {
      await f.config('host: codex\n');
      const marker = join(f.dir, 'preload-ran');
      const preload = await f.write('preload.ts', `await Bun.write(${JSON.stringify(marker)}, 'ran');\n`);
      await f.write(
        scope === 'product' ? 'repo dir/bunfig.toml' : 'home/.bunfig.toml',
        `preload = [${JSON.stringify(preload)}]\n`,
      );
      await f.write('repo dir/.env', 'CELETIS_INJECTED=loaded\n');
      expect(await run(process.execPath, bunArgs(reader, [f.repo]), { cwd: f.repo, env: f.env })).toEqual({
        code: 2,
        stdout: '',
        stderr: `celetis: ${f.repo}/.celetis.yaml: landing: required field\n`,
      });
      expect(await Bun.file(marker).exists()).toBe(false);
      await f.config('landing: pr\n');
      expect(await run(process.execPath, bunArgs(reader, [f.repo]), { cwd: f.repo, env: f.env })).toEqual({
        code: 0,
        stdout: '{"landing":"pr"}\n',
        stderr: '',
      });
      expect(await Bun.file(marker).exists()).toBe(false);
      const controlArgs = ['--no-env-file', '--no-install', '--no-macros'];
      if (scope === 'global') {
        expect((await command(process.execPath, [...controlArgs, '-e', '1'], { cwd: f.repo, env: f.env })).code).toBe(
          0,
        );
        expect(await Bun.file(marker).exists()).toBe(false);
        controlArgs.push('--preload', preload);
      }
      const control = await command(process.execPath, [...controlArgs, '-e', '1'], {
        cwd: f.repo,
        env: f.env,
      });
      expect(control.code).toBe(0);
      expect(await Bun.file(marker).exists()).toBe(true);
    }),
  );
}

test(
  'Bun children ignore the product environment file',
  withFixture(async (f) => {
    await f.write('repo dir/.env', 'CELETIS_INJECTED=loaded\n');
    const probe = await f.write('repo dir/environment.ts', "console.log(process.env.CELETIS_INJECTED ?? 'absent');\n");
    const env = { ...f.env };
    delete env.CELETIS_INJECTED;
    expect(await run(process.execPath, bunArgs(probe, []), { cwd: f.repo, env })).toEqual({
      code: 0,
      stdout: 'absent\n',
      stderr: '',
    });
    expect(
      (
        await command(process.execPath, ['--no-install', '--config=/dev/null', '--no-macros', probe], {
          cwd: f.repo,
          env,
        })
      ).stdout,
    ).toBe('loaded\n');
  }),
);

test(
  'invalid config starts no product macro',
  withFixture(async (f) => {
    await f.config('host: codex\n');
    const marker = join(f.dir, 'macro-ran');
    await f.write(
      'repo dir/macro.ts',
      `import fs from 'node:fs'; export function mark() { fs.writeFileSync(${JSON.stringify(marker)}, 'ran'); return null; }\n`,
    );
    const entry = await f.write(
      'repo dir/macros.ts',
      `import { mark } from './macro.ts' with { type: 'macro' };\nimport { readConfig } from ${JSON.stringify(reader)};\nmark(); readConfig(process.argv[2]);\n`,
    );
    const result = await run(process.execPath, bunArgs(entry, [f.repo]), { cwd: f.repo, env: f.env });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('macro');
    expect(await Bun.file(marker).exists()).toBe(false);
    const control = await command(
      process.execPath,
      ['--no-env-file', '--no-install', '--config=/dev/null', entry, f.repo],
      { cwd: f.repo, env: f.env },
    );
    expect(control.code).not.toBe(0);
    expect(await Bun.file(marker).exists()).toBe(true);
  }),
);

test(
  'process lookup excludes product node_modules/.bin',
  withFixture(async (f) => {
    const marker = join(f.dir, 'shadow-ran');
    await f.stub('tool', "console.log('safe');");
    const shadow = await f.stub('shadow', `await Bun.write(${JSON.stringify(marker)}, 'ran'); console.log('shadow');`);
    await f.write('repo dir/node_modules/.bin/tool', await f.read('bin/shadow'), 0o755);
    const env = {
      ...f.env,
      PATH: [join(f.repo, 'node_modules/.bin/'), join(f.dir, 'bin'), process.env.PATH].join(delimiter),
    };
    expect(await run('tool', [], { cwd: f.repo, env })).toEqual({ code: 0, stdout: 'safe\n', stderr: '' });
    expect(await Bun.file(marker).exists()).toBe(false);
    expect((await command(shadow, [], { cwd: f.dir, env: f.env })).stdout).toBe('shadow\n');
    expect(await Bun.file(marker).exists()).toBe(true);
  }),
);

test(
  'invalid config starts no shadow executable',
  withFixture(async (f) => {
    await f.config('host: codex\n');
    const marker = join(f.dir, 'shadow-ran');
    await f.stub('shadow', `await Bun.write(${JSON.stringify(marker)}, 'ran');`);
    await f.write('repo dir/node_modules/.bin/bun', await f.read('bin/shadow'), 0o755);
    expect(
      (
        await run(process.execPath, bunArgs(reader, [f.repo]), {
          cwd: f.repo,
          env: { ...f.env, PATH: join(f.repo, 'node_modules/.bin') },
        })
      ).code,
    ).toBe(2);
    expect(await Bun.file(marker).exists()).toBe(false);
  }),
);

test(
  'Bun child arguments preserve entry and argument boundaries',
  withFixture(async (f) => {
    const entry = await f.write('repo dir/entry file.ts', 'console.log(JSON.stringify(process.argv.slice(2)));\n');
    const result = await run(process.execPath, bunArgs(entry, ['a b', "a'b", 'λ', '']), { cwd: f.repo, env: f.env });
    expect(result).toEqual({ code: 0, stdout: '["a b","a\'b","λ",""]\n', stderr: '' });
  }),
);

test(
  'Bun children write no cache and send no crash report',
  withFixture(async (f) => {
    await f.config('landing: pr\n');
    const probe = await f.write(
      'cache.ts',
      'console.log(JSON.stringify([process.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH, process.env.DO_NOT_TRACK]));\n',
    );
    const env = { ...f.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: undefined, DO_NOT_TRACK: undefined };
    expect(await run(process.execPath, bunArgs(reader, [f.repo]), { cwd: f.repo, env })).toEqual({
      code: 0,
      stdout: '{"landing":"pr"}\n',
      stderr: '',
    });
    expect(await run(process.execPath, bunArgs(probe, []), { cwd: f.repo, env })).toEqual({
      code: 0,
      stdout: '["0","1"]\n',
      stderr: '',
    });
    expect(await readdir(f.home, { recursive: true })).toEqual([]);
  }),
);

test(
  'Bun children do not install missing packages',
  withFixture(async (f) => {
    const entry = await f.write('repo dir/dependency.ts', "import 'celetis-missing-package-that-does-not-exist';\n");
    const result = await run(process.execPath, bunArgs(entry, []), { cwd: f.repo, env: f.env });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Cannot find package');
    expect(await readdir(f.repo)).toEqual(['dependency.ts']);
    expect(await readdir(f.home, { recursive: true })).toEqual([]);
  }),
);

test(
  'captured commands receive stdin EOF',
  withFixture(async (f) => {
    const child = await f.stub('stdin-eof', 'console.log((await Bun.stdin.text()).length);');
    expect(await run(process.execPath, bunArgs(child, []), { env: f.env, timeout: 250 })).toEqual({
      code: 0,
      stdout: '0\n',
      stderr: '',
    });
  }),
);
