import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, cp, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bunArgs, bunShebang } from '../scripts/lib/process.ts';
import { BUN_NEEDED, cleanPath, isBunOk } from './runtime.ts';
import { test } from './test-support.ts';

test('declared Bun runtime binding sets both controls before its first process starts', async (t) => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'board-bun-entry.')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, "probe ' Ж.ts");
  await writeFile(
    target,
    `${bunShebang}\nconsole.log(JSON.stringify({executable:process.execPath,args:process.argv.slice(1),cache:process.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH,track:process.env.DO_NOT_TRACK}));\n`,
  );
  await chmod(target, 0o755);
  const { bindRuntime } = await import('./runtime.ts');
  const bound = await bindRuntime([target, 'a b', "x'y"]);
  const result = await new Promise<{ code: number; stdout: string; stderr: string }>((done) => {
    execFile(
      bound[0],
      bound.slice(1),
      {
        env: {
          HOME: directory,
          PATH: directory,
          BUN_RUNTIME_TRANSPILER_CACHE_PATH: join(directory, 'terminal-cache'),
          DO_NOT_TRACK: '0',
        },
        encoding: 'utf8',
        timeout: 5000,
      },
      (error, stdout, stderr) =>
        done({ code: typeof error?.code === 'number' ? error.code : error ? 1 : 0, stdout, stderr }),
    );
  });
  assert.deepEqual({ code: result.code, stderr: result.stderr }, { code: 0, stderr: '' });
  assert.deepEqual(JSON.parse(result.stdout), {
    executable: process.execPath,
    args: [target, 'a b', "x'y"],
    cache: '0',
    track: '1',
  });
  assert.deepEqual(bound, [
    '/usr/bin/env',
    'BUN_RUNTIME_TRANSPILER_CACHE_PATH=0',
    'DO_NOT_TRACK=1',
    process.execPath,
    ...bunArgs(target, ['a b', "x'y"]),
  ]);
});

test('runtime binding preserves an execute-only native command without a read permission condition', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'board-runtime.'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const native = join(directory, 'native');
  const source = Bun.which('true');
  assert.ok(source);
  await cp(source, native);
  await chmod(native, 0o111);
  await assert.rejects(readFile(native), { code: 'EACCES' });
  const { bindRuntime } = await import('./runtime.ts');
  assert.deepEqual(await bindRuntime([native, 'an argument']), [native, 'an argument']);
});

for (const version of ['1.4.2', '1.4.3', '1.5.0', '2.0.0']) {
  test(`Bun ${version} meets the board floor`, () => assert.equal(isBunOk(version), true));
}
for (const version of ['1.4.1', '1.3.99', '0.9.0']) {
  test(`Bun ${version} is below the board floor`, () => assert.equal(isBunOk(version), false));
}
test('the Bun floor diagnostic names the supported runtime', () => {
  assert.equal(BUN_NEEDED, 'Bun 1.4.2 or later is necessary');
});

test('the entry removes each node_modules/.bin item from PATH', () => {
  assert.equal(
    cleanPath('/r/node_modules/.bin:/usr/bin:/r/a/node_modules/.bin/:/opt/node_modules/.bin/x:/bin'),
    '/usr/bin:/opt/node_modules/.bin/x:/bin',
  );
  assert.equal(cleanPath(''), '');
});

test('cleanPath splits the value at the delimiter of the caller', () => {
  assert.equal(cleanPath('/usr/bin;/r/node_modules/.bin;/bin', ';'), '/usr/bin;/bin');
});
