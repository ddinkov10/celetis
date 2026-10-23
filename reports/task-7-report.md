# Task 7 report

Status: DONE. Commit: `04b3a011a391fa854b77edd170a21b451cf916cc` — `feat(board): run the board on Bun with TypeScript sources`. The final staged gate passed before this commit.

## Binding

The first command checked the active path, branch and HEAD. Work is only in `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`, branch `feat/96-intent-the-whole-toolchain`, starting HEAD `67baa1e503c8dbc9bdfad912307b7f9584741f2b`. The assertion source pin is `4fe5554c4c09ec522aae410afde6a298787a04a9`.

## Change

All first-party board modules and `board.js` now have TypeScript sources. The server keeps its HTTP, filesystem and process design. `board/config.ts` stays independent of the Celetis YAML reader. Only the adapter reads YAML. The package has no dependency or lifecycle script; it declares Bun >=1.4.2 and `cli.ts`.

The port keeps `parseConfig`, `readDocument`, `runData`, `createBoard`, browser exports, contract 1, exact CSP, loopback binding, fixed assets, HTTP status/body limits, stale data, executable modes, path escapes, symlink escapes and lane refusal. Data expiry is 60,000 ms, diff freshness is 15,000 ms, and the process output limit is 64 MiB per stream. Real private process tests cover 64 MiB and 64 MiB + 1. The shell test receives the exact literal `a'b $(touch marker)` and leaves no marker.

`scripts/board.ts` passes the fixed stdin-only `data`, `run`, `resume` and `port` keys. `{n}` and `{agent}` stay separate argv items. PORT wins over YAML `board.port`, then 4403. The adapter uses the selected `process.execPath`, isolated flags, clean PATH, inherited output streams and forwarded signals. The shared session validator, launcher and runner are unchanged; they retain the frozen `CELETIS_RESUME_RECORD` flow. No validator was copied.

`scripts/build.ts` builds the five existing browser URLs and compiles all six delivery targets before any write. Only its generated browser assets were copied back. The public copied `scripts/celetis` is unchanged. The three executable shell board fixtures are replaced by executable TypeScript sources. Old runtime entrypoints stay operational internal references until Task 9.

The interim gate has exact generated roles for the five browser files, syntax/byte/mode checks, and a strict board TypeScript check. All authored TypeScript remains checked by Biome. The existing test-only any rule now includes the board's adversarial test data. No broad generated-file lint exclusion was added.

HTML, CSS, font bytes, layout, storage keys and UI text are unchanged. The board README changes runtime/source/fixture/build facts only.

## TDD

The complete nine board test files, both adapter assertion sets and the build test were authored before production edits. Parameter arrays and exact assertions were present; this was not a missing-module placeholder. At the first RED, only tests, TypeScript fixtures, test support and the local map had been written. Production was still at BASE.

The restricted attempt recorded EPERM on real loopback listeners. The authorized repeat used real private listeners and fixture processes. It had 2 passes, 34 failures and 7 missing-module errors across 12 files in 1.69 seconds. Missing imports prevent case registration; the test bodies were complete. Its exact command and full output follow.

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/config.test.ts board/contract.test.ts board/runtime.test.ts board/package.test.ts board/place.test.ts board/view.test.ts board/words.test.ts board/cli.test.ts board/server.test.ts board/build.test.ts tests/board.test.ts tests/board-agent.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/build.test.ts:
 7 |   const before = await readFile(join(root, 'scripts/celetis'));
 8 |   const outdir = join(f.dir, 'build');
 9 |   const result = await command(process.execPath, [...isolatedArgs, join(root, 'scripts/build.ts'), '--outdir', outdir]);
10 |   expect(result).toEqual({ code: 0, stdout: '', stderr: '' });
11 |   for (const file of ['board.js', 'view.mjs', 'ui.mjs', 'panel.mjs', 'palette.mjs']) {
12 |     const built = await readFile(join(outdir, 'board', file), 'utf8');
                             ^
ENOENT: no such file or directory, open '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis-runtime.9nWeIC/build/board/board.js'
    path: "/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis-runtime.9nWeIC/build/board/board.js",
 syscall: "open",
   errno: -2,
    code: "ENOENT"

      at async <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/build.test.ts:12:25)
      at async <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/lib/fixture.ts:99:13)
(fail) the pinned build emits the browser module graph with its public URLs and identical assets [21.24ms]

board/words.test.ts:
 9 |   const entries = await readdir(import.meta.dirname, { withFileTypes: true });
10 |   const names = entries
11 |     .filter((entry) => entry.isFile() && !entry.name.endsWith('.test.mjs') && !entry.name.endsWith('.md'))
12 |     .map((entry) => entry.name);
13 |   for (const name of ['board.ts', 'server.ts', 'place.ts', 'view.ts', 'ui.ts', 'index.html'])
14 |     assert.ok(names.includes(name), name);
                ^
AssertionError: board.ts
 generatedMessage: false,
     actual: false,
   expected: true,
   operator: "==",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/words.test.ts:14:12
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) no file of the board holds a word of one flow or of one tracker [2.09ms]

board/package.test.ts:
12 |   const { name, type, license, engines, bin } = fields;
13 |   assert.equal(name, 'agent-board');
14 |   assert.equal(Object.hasOwn(fields, 'version'), false);
15 |   assert.equal(type, 'module');
16 |   assert.equal(license, 'UNLICENSED');
17 |   assert.equal(engines?.bun, '>=1.4.2');
              ^
AssertionError: Expected values to be strictly equal:
+ actual - expected

+ undefined
- '>=1.4.2'

 generatedMessage: true,
     actual: undefined,
   expected: ">=1.4.2",
   operator: "strictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/package.test.ts:17:10
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) the package has its name, no version, the module type, the licence, the Bun range, and one command [0.54ms]
(pass) the package is private, so npm does not publish it to the public registry [0.07ms]
(pass) the package has no script, no dependency, and no workspace [0.09ms]
35 |     assert.equal(Object.hasOwn(fields, key), false, key);
36 |   }
37 | });
38 | 
39 | test('the entry starts with the isolated Bun line and has an execute bit', async () => {
40 |   assert.equal((await readFile(ENTRY, 'utf8')).split('\n')[0], '#!/usr/bin/env -S BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros');
                           ^
ENOENT: no such file or directory, open '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts'
    path: "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts",
 syscall: "open",
   errno: -2,
    code: "ENOENT"

      at async <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/package.test.ts:40:23)
      at async within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
(fail) the entry starts with the isolated Bun line and has an execute bit [0.11ms]

board/place.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module './place.ts' from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/place.test.ts'
-------------------------------


board/view.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module './view.ts' from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/view.test.ts'
-------------------------------


board/contract.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module './contract.ts' from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/contract.test.ts'
-------------------------------


board/config.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module './config.ts' from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/config.test.ts'
-------------------------------


board/runtime.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module './runtime.ts' from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/runtime.test.ts'
-------------------------------


board/server.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module './server.ts' from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/server.test.ts'
-------------------------------


board/cli.test.ts:
143 |       stdout += chunk;
144 |       if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
145 |     });
146 |     child
147 |       .on('error', fail)
148 |       .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
                                            ^
error: the entry ended with exit 1 and no URL line: error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:148:39)
      at emit (node:events:124:23)
      at #maybeClose (node:child_process:827:16)
      at #handleOnExit (node:child_process:570:72)
(fail) the fixture repository: the start prints each command, the cards of the producer show, and Run types the run script with the number [46.21ms]
143 |       stdout += chunk;
144 |       if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
145 |     });
146 |     child
147 |       .on('error', fail)
148 |       .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
                                            ^
error: the entry ended with exit 1 and no URL line: error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:148:39)
      at emit (node:events:124:23)
      at #maybeClose (node:child_process:827:16)
      at #handleOnExit (node:child_process:570:72)
(fail) with an empty config, the start prints the repository and the URL, serves the page, and the board shows the sessions of the repository only [42.42ms]
143 |       stdout += chunk;
144 |       if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
145 |     });
146 |     child
147 |       .on('error', fail)
148 |       .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
                                            ^
error: the entry ended with exit 1 and no URL line: error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:148:39)
      at emit (node:events:124:23)
      at #maybeClose (node:child_process:827:16)
      at #handleOnExit (node:child_process:570:72)
(fail) the start prints each command of the config [38.79ms]
273 |     [worktree, `agent-board: start the board in the main checkout: ${folder}`],
274 |     [linked, `agent-board: start the board in the main checkout: ${folder}`],
275 |   ];
276 |   for (const args of CONFIG_FORMS) {
277 |     for (const [cwd, line] of cases) {
278 |       assert.deepEqual(
                   ^
AssertionError: --config-stdin /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-HRIOrX
+ actual - expected

  {
    code: 1,
+   stderr: "error: Cannot find module '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts' from '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/stdin-error.ts'\n" +
+     '\n' +
+     'Bun v1.4.2 (macOS arm64)\n',
-   stderr: 'agent-board: the current folder is not in a git checkout\n',
    stdout: ''
  }

 generatedMessage: false,
     actual: {
  code: 1,
  stdout: "",
  stderr: "error: Cannot find module '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts' from '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/stdin-error.ts'\n\nBun v1.4.2 (macOS arm64)\n",
},
   expected: {
  code: 1,
  stdout: "",
  stderr: "agent-board: the current folder is not in a git checkout\n",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:278:14
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) all config forms enforce the same checkout guards [274.38ms]
143 |       stdout += chunk;
144 |       if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
145 |     });
146 |     child
147 |       .on('error', fail)
148 |       .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
                                            ^
error: the entry ended with exit 1 and no URL line: error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:148:39)
      at emit (node:events:124:23)
      at #maybeClose (node:child_process:827:16)
      at #handleOnExit (node:child_process:570:72)
(fail) a start in a subfolder of the main checkout, or through a symbolic link to it, prints the real path of the repository [37.86ms]
143 |       stdout += chunk;
144 |       if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
145 |     });
146 |     child
147 |       .on('error', fail)
148 |       .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
                                            ^
error: the entry ended with exit 1 and no URL line: error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:148:39)
      at emit (node:events:124:23)
      at #maybeClose (node:child_process:827:16)
      at #handleOnExit (node:child_process:570:72)
(fail) a git and a herdr in a node_modules/.bin folder of the start folder do not run, with that folder first on PATH [44.10ms]
333 |   const cwd = await temp(t);
334 |   const bad = JSON.parse(DOCUMENT);
335 |   bad.tracker = 7;
336 |   bad.issues[0].state = 'waiting';
337 |   const check = (input) => cli(['check', '--stdin'], { cwd, input });
338 |   assert.deepEqual(await check(DOCUMENT), OK);
               ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   code: 1,
+   stderr: 'error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"\n',
+   stdout: ''
-   code: 0,
-   stderr: '',
-   stdout: 'agent-board: contract 1, 3 issues, ok\n'
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "error: Module not found \"/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts\"\n",
},
   expected: {
  code: 0,
  stdout: "agent-board: contract 1, 3 issues, ok\n",
  stderr: "",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:338:10
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) issue data stdin stays independent [10.23ms]
367 |     ['check', 'check'],
368 |     ['--config-stdin', 'more'],
369 |     ['check --stdin'],
370 |   ];
371 |   for (const args of lists)
372 |     assert.deepEqual(await cli(args, { cwd, env: { BOARD_READ_FAILURE: READ_FAILURE } }), USAGE, args.join(' '));
                 ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   code: 1,
+   stderr: "error: Cannot find module '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts' from '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/stdin-error.ts'\n" +
+     '\n' +
+     'Bun v1.4.2 (macOS arm64)\n',
-   code: 2,
-   stderr: 'usage: agent-board --config-stdin | check --config-stdin | check --stdin (scripts/celetis board starts the board)\n',
    stdout: ''
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "error: Cannot find module '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts' from '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/stdin-error.ts'\n\nBun v1.4.2 (macOS arm64)\n",
},
   expected: {
  code: 2,
  stdout: "",
  stderr: "usage: agent-board --config-stdin | check --config-stdin | check --stdin (scripts/celetis board starts the board)\n",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:372:12
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) only the three public argument tuples are accepted [17.56ms]
389 |   assert.deepEqual({ code, stdout, stderr }, USAGE);
390 | });
391 | 
392 | for (const args of [['nope'], ...CONFIG_FORMS]) {
393 |   test(`Bun below the floor stops before each other act: ${args.join(' ')}`, async (t) => {
394 |     assert.deepEqual(await cli(args, { cwd: await temp(t), env: { BOARD_OLD_BUN: '1' } }), refusal('agent-board: Bun 1.4.2 or later is necessary'));
                 ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
    code: 1,
+   stderr: `1 | Object.defineProperty(Bun,'version',{value:'1.4.1'});Object.defineProperty(process,'stdin',{get(){throw new Error('stdin read failed')}});await import("/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts");\n` +
+     '           ^\n' +
+     'TypeError: Attempting to change value of a readonly property.\n' +
+     '      at /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/bun-old.ts:1:8\n' +
+     '\n' +
+     'Bun v1.4.2 (macOS arm64)\n',
-   stderr: 'agent-board: Bun 1.4.2 or later is necessary\n',
    stdout: ''
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "1 | Object.defineProperty(Bun,'version',{value:'1.4.1'});Object.defineProperty(process,'stdin',{get(){throw new Error('stdin read failed')}});await import(\"/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts\");\n           ^\nTypeError: Attempting to change value of a readonly property.\n      at /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/bun-old.ts:1:8\n\nBun v1.4.2 (macOS arm64)\n",
},
   expected: {
  code: 1,
  stdout: "",
  stderr: "agent-board: Bun 1.4.2 or later is necessary\n",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:394:12
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) Bun below the floor stops before each other act: nope [11.29ms]
389 |   assert.deepEqual({ code, stdout, stderr }, USAGE);
390 | });
391 | 
392 | for (const args of [['nope'], ...CONFIG_FORMS]) {
393 |   test(`Bun below the floor stops before each other act: ${args.join(' ')}`, async (t) => {
394 |     assert.deepEqual(await cli(args, { cwd: await temp(t), env: { BOARD_OLD_BUN: '1' } }), refusal('agent-board: Bun 1.4.2 or later is necessary'));
                 ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
    code: 1,
+   stderr: `1 | Object.defineProperty(Bun,'version',{value:'1.4.1'});Object.defineProperty(process,'stdin',{get(){throw new Error('stdin read failed')}});await import("/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts");\n` +
+     '           ^\n' +
+     'TypeError: Attempting to change value of a readonly property.\n' +
+     '      at /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/bun-old.ts:1:8\n' +
+     '\n' +
+     'Bun v1.4.2 (macOS arm64)\n',
-   stderr: 'agent-board: Bun 1.4.2 or later is necessary\n',
    stdout: ''
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "1 | Object.defineProperty(Bun,'version',{value:'1.4.1'});Object.defineProperty(process,'stdin',{get(){throw new Error('stdin read failed')}});await import(\"/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts\");\n           ^\nTypeError: Attempting to change value of a readonly property.\n      at /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/bun-old.ts:1:8\n\nBun v1.4.2 (macOS arm64)\n",
},
   expected: {
  code: 1,
  stdout: "",
  stderr: "agent-board: Bun 1.4.2 or later is necessary\n",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:394:12
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) Bun below the floor stops before each other act: --config-stdin [11.40ms]
389 |   assert.deepEqual({ code, stdout, stderr }, USAGE);
390 | });
391 | 
392 | for (const args of [['nope'], ...CONFIG_FORMS]) {
393 |   test(`Bun below the floor stops before each other act: ${args.join(' ')}`, async (t) => {
394 |     assert.deepEqual(await cli(args, { cwd: await temp(t), env: { BOARD_OLD_BUN: '1' } }), refusal('agent-board: Bun 1.4.2 or later is necessary'));
                 ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
    code: 1,
+   stderr: `1 | Object.defineProperty(Bun,'version',{value:'1.4.1'});Object.defineProperty(process,'stdin',{get(){throw new Error('stdin read failed')}});await import("/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts");\n` +
+     '           ^\n' +
+     'TypeError: Attempting to change value of a readonly property.\n' +
+     '      at /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/bun-old.ts:1:8\n' +
+     '\n' +
+     'Bun v1.4.2 (macOS arm64)\n',
-   stderr: 'agent-board: Bun 1.4.2 or later is necessary\n',
    stdout: ''
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "1 | Object.defineProperty(Bun,'version',{value:'1.4.1'});Object.defineProperty(process,'stdin',{get(){throw new Error('stdin read failed')}});await import(\"/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts\");\n           ^\nTypeError: Attempting to change value of a readonly property.\n      at /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/bun-old.ts:1:8\n\nBun v1.4.2 (macOS arm64)\n",
},
   expected: {
  code: 1,
  stdout: "",
  stderr: "agent-board: Bun 1.4.2 or later is necessary\n",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:394:12
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) Bun below the floor stops before each other act: check --config-stdin [11.78ms]
396 | }
397 | 
398 | test('config stdin serves and checks', async (t) => {
399 |   const folder = await fixture(t);
400 |   const input = JSON.stringify(FIXTURE_CONFIG);
401 |   assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, input }), OK);
               ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   code: 1,
+   stderr: 'error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"\n',
+   stdout: ''
-   code: 0,
-   stderr: '',
-   stdout: 'agent-board: contract 1, 3 issues, ok\n'
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "error: Module not found \"/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts\"\n",
},
   expected: {
  code: 0,
  stdout: "agent-board: contract 1, 3 issues, ok\n",
  stderr: "",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:401:10
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) config stdin serves and checks [38.01ms]
423 |         join(folder, 'flow/producer-é.ts'),
424 |         `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`,
425 |         `process.stdout.write(await Bun.file('flow/contract-1.json').text());`,
426 |       );
427 |       const port = await freePort();
428 |       const child = spawn(process.execPath, [...isolatedArgs, env?.BOARD_READ_FAILURE ? join(BIN, 'stdin-error.ts') : CLI, ...args], {
                                                                    ^
ReferenceError: env is not defined
      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:428:63)
      at async within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at async test (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:20:13)
      at async <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:419:13)
      at async within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
(fail) config stdin waits for EOF and accepts chunks [29.81ms]
505 |     ]),
506 |   ];
507 |   for (const args of CONFIG_FORMS)
508 |     for (const [input, message] of inputs) {
509 |       const result = await cli(args, { cwd: folder, input, env: { PORT: String(port), PRODUCER_MARKER: marker } });
510 |       assert.deepEqual(result, refusal(`agent-board: config stdin: ${message}`), `${args.join(' ')}: ${input}`);
                   ^
AssertionError: --config-stdin: 
+ actual - expected

  {
    code: 1,
+   stderr: 'error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"\n',
-   stderr: 'agent-board: config stdin: the input is not JSON\n',
    stdout: ''
  }

 generatedMessage: false,
     actual: {
  code: 1,
  stdout: "",
  stderr: "error: Module not found \"/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts\"\n",
},
   expected: {
  code: 1,
  stdout: "",
  stderr: "agent-board: config stdin: the input is not JSON\n",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:510:14
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) config stdin reports each bad input without starting work [38.69ms]
518 |   const marker = join(dirname(folder), 'producer-marker');
519 |   await script(join(folder, 'flow/record.ts'), `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`, `process.stdout.write(await Bun.file('flow/contract-1.json').text());`);
520 |   const port = await freePort();
521 |   for (const args of CONFIG_FORMS) {
522 |     const env = { PORT: String(port), PRODUCER_MARKER: marker, BOARD_READ_FAILURE: READ_FAILURE };
523 |     assert.deepEqual(await cli(args, { cwd: folder, env }), refusal('agent-board: config stdin: stdin read failed'));
                 ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
    code: 1,
+   stderr: "error: Cannot find module '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts' from '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/stdin-error.ts'\n" +
+     '\n' +
+     'Bun v1.4.2 (macOS arm64)\n',
-   stderr: 'agent-board: config stdin: stdin read failed\n',
    stdout: ''
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "error: Cannot find module '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts' from '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/agent-board-bin-lc2fkd/stdin-error.ts'\n\nBun v1.4.2 (macOS arm64)\n",
},
   expected: {
  code: 1,
  stdout: "",
  stderr: "agent-board: config stdin: stdin read failed\n",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:523:12
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) config stdin catches read failures [46.97ms]
552 |     [['flow/control.ts'], '"data": an item or a path has a control character'],
553 |     [['flow/record.ts', '{agent}'], '"data": an item has "{" or "}"'],
554 |   ];
555 |   for (const args of CONFIG_FORMS)
556 |     for (const [data, message] of cases) {
557 |       assert.deepEqual(
                   ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
    code: 1,
+   stderr: 'error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"\n',
-   stderr: 'agent-board: config stdin: "data": the first item is an absolute path\n',
    stdout: ''
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "error: Module not found \"/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts\"\n",
},
   expected: {
  code: 1,
  stdout: "",
  stderr: "agent-board: config stdin: \"data\": the first item is an absolute path\n",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:557:14
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) config stdin enforces executable security in the real CLI [40.06ms]
143 |       stdout += chunk;
144 |       if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
145 |     });
146 |     child
147 |       .on('error', fail)
148 |       .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
                                            ^
error: the entry ended with exit 1 and no URL line: error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:148:39)
      at emit (node:events:124:23)
      at #maybeClose (node:child_process:827:16)
      at #handleOnExit (node:child_process:570:72)
(fail) config stdin keeps port selection and listen errors [37.69ms]
143 |       stdout += chunk;
144 |       if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
145 |     });
146 |     child
147 |       .on('error', fail)
148 |       .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
                                            ^
error: the entry ended with exit 1 and no URL line: error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:148:39)
      at emit (node:events:124:23)
      at #maybeClose (node:child_process:827:16)
      at #handleOnExit (node:child_process:570:72)
(fail) config stdin preserves missing data and producer results [37.72ms]
676 |   await put(join(folder, 'flow/contract-1.json'), JSON.stringify(document));
677 |   const planted = join(folder, 'node_modules/.bin');
678 |   const marker = join(dirname(folder), 'planted');
679 |   for (const name of ['git', 'herdr']) await script(join(planted, name), `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PLANTED,process.argv[1]+'\\n');`);
680 |   const env = { PATH: `${planted}:${ENV.PATH}`, PLANTED: marker, HERDR_WORKSPACE: basename(folder) };
681 |   assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, env, input: JSON.stringify(config) }), {
               ^
AssertionError: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   code: 1,
+   stderr: 'error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"\n',
+   stdout: ''
-   code: 0,
-   stderr: '',
-   stdout: 'agent-board: contract 1, 4 issues, ok\n'
  }

 generatedMessage: true,
     actual: {
  code: 1,
  stdout: "",
  stderr: "error: Module not found \"/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts\"\n",
},
   expected: {
  code: 0,
  stdout: "agent-board: contract 1, 4 issues, ok\n",
  stderr: "",
},
   operator: "deepStrictEqual",
       diff: "simple",
       code: "ERR_ASSERTION"

      at /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:681:10
      at within (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/test-support.ts:23:15)
      at processTicksAndRejections (native:7:39)
(fail) stdin config keeps startup safeguards and terminal actions [38.78ms]
143 |       stdout += chunk;
144 |       if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
145 |     });
146 |     child
147 |       .on('error', fail)
148 |       .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
                                            ^
error: the entry ended with exit 1 and no URL line: error: Module not found "/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.ts"

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/cli.test.ts:148:39)
      at emit (node:events:124:23)
      at #maybeClose (node:child_process:827:16)
      at #handleOnExit (node:child_process:570:72)
(fail) default changes leave producer configuration unchanged [498.13ms]

tests/board.test.ts:
 8 | test('board adapter keeps its stdin contract, main path, port, child status, and clean PATH', async () => {
 9 |   const f = await boardFixture();
10 |   try {
11 |     const expected = { data: ['scripts/celetis', 'celetis-flow', '--board'], run: ['scripts/celetis', '--agent', '{agent}', 'celetis-flow', '{n}'], resume: ['scripts/celetis', 'celetis-flow', '--resume', '{n}'], port: 4404 };
12 |     const before = await f.git('status', '--porcelain', '--untracked-files=all');
13 |     expect(await f.run()).toEqual({ code: 0, stdout: '', stderr: '' });
                               ^
error: expect(received).toEqual(expected)

  {
-   "code": 0,
-   "stderr": "",
+   "code": 1,
+   "stderr": 
+ "error: Module not found "/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis-runtime.yX1reY/installed package/scripts/board.ts"
+ "
+ ,
    "stdout": "",
  }

- Expected  - 2
+ Received  + 5

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/board.test.ts:13:27)
(fail) board adapter keeps its stdin contract, main path, port, child status, and clean PATH [105.06ms]
50 |     expect(await Bun.file(f.capture).exists()).toBe(false);
51 |     return result;
52 |   };
53 |   try {
54 |     await rm(join(f.plugin, 'board/cli.ts'));
55 |     expect(await refused()).toEqual({ code: 1, stdout: '', stderr: `celetis-board: the plugin has no board/cli.ts: ${f.plugin}; reinstall the plugin\n` });
                                 ^
error: expect(received).toEqual(expected)

  {
    "code": 1,
    "stderr": 
- "celetis-board: the plugin has no board/cli.ts: /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis-runtime.mH8CU7/installed package; reinstall the plugin
+ "error: Module not found "/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis-runtime.mH8CU7/installed package/scripts/board.ts"
  "
  ,
    "stdout": "",
  }

- Expected  - 1
+ Received  + 1

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/board.test.ts:55:29)
(fail) board adapter refuses a missing entry, lane starts, extra arguments, and invalid main YAML [90.97ms]
73 | 
74 | test('the board adapter checks the real producer and refuses executable escapes without running them', async () => {
75 |   const f = await boardFixture();
76 |   try {
77 |     const result = await f.run(f.repo, { BOARD_CHECK: '1' });
78 |     expect(result).toEqual({ code: 0, stdout: 'agent-board: contract 1, 0 issues, ok\n', stderr: '' });
                        ^
error: expect(received).toEqual(expected)

  {
-   "code": 0,
-   "stderr": "",
-   "stdout": 
- "agent-board: contract 1, 0 issues, ok
+   "code": 1,
+   "stderr": 
+ "error: Module not found "/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis-runtime.QJ777M/installed package/scripts/board.ts"
  "
  ,
+   "stdout": "",
  }

- Expected  - 4
+ Received  + 4

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/board.test.ts:78:20)
(fail) the board adapter checks the real producer and refuses executable escapes without running them [88.98ms]

tests/board-agent.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module '../board/server.ts' from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/board-agent.test.ts'
-------------------------------


 2 pass
 34 fail
 7 errors
 6 expect() calls
Ran 36 tests across 12 files. [1.69s]
```

The first GREEN attempts found port fixture errors: a `.sh` filename made Bun parse a private TypeScript executable as shell; direct assignment to readonly Bun.version failed; the chunking fixture had an undefined variable; the fixture PATH could find the user's Codex executable after hiding the stub; and the data-URI fixture emitted no data. The corrected port uses `.ts` paths, the existing `--define Bun.version` method, corrected local variables, a private executable PATH, and typed result modes. No real user host was started. Bun's ENOENT text also differed; `run` keeps the exact baseline diagnostic. These attempts remain in `task-7-green-1.log`, `task-7-green-2.log` and `task-7-green-3.log`.

Node-only version partitions and the old no-Node adapter error are removed under #96. The port map lists every disposition. New Bun version partitions and real CLI processes defined as Bun 1.4.1 verify refusal before invalid argv, stdin, Git or producer work. This is a controlled runtime-floor oracle, not an old Bun installation claim.

The no-partial-output build oracle then found a real defect: a browser failure left a launcher output. Both missing-source and syntax-error cases ran RED before the build changed to collect all compiled bytes before delivery.

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/build.test.ts --test-name-pattern 'browser build failure'
```

```text
bun test v1.4.2 (744846f84)

board/build.test.ts:
33 |     const outdir = join(f.dir, 'out');
34 |     const result = await command(process.execPath, [...isolatedArgs, join(checkout, 'scripts/build.ts'), '--outdir', outdir]);
35 |     expect(result.code).toBe(1);
36 |     expect(result.stderr.length).toBeGreaterThan(0);
37 |     for (const file of ['scripts/celetis', 'board/board.js', 'board/view.mjs', 'board/ui.mjs', 'board/panel.mjs', 'board/palette.mjs']) {
38 |       expect(await Bun.file(join(outdir, file)).exists(), file).toBe(false);
                                                                     ^
error: scripts/celetis

Expected: false
Received: true

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/build.test.ts:38:65)
      at async <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/lib/fixture.ts:99:13)
(fail) a browser build failure (missing source) delivers no partial output [71.94ms]
33 |     const outdir = join(f.dir, 'out');
34 |     const result = await command(process.execPath, [...isolatedArgs, join(checkout, 'scripts/build.ts'), '--outdir', outdir]);
35 |     expect(result.code).toBe(1);
36 |     expect(result.stderr.length).toBeGreaterThan(0);
37 |     for (const file of ['scripts/celetis', 'board/board.js', 'board/view.mjs', 'board/ui.mjs', 'board/panel.mjs', 'board/palette.mjs']) {
38 |       expect(await Bun.file(join(outdir, file)).exists(), file).toBe(false);
                                                                     ^
error: scripts/celetis

Expected: false
Received: true

      at <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/board/build.test.ts:38:65)
      at async <anonymous> (/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/lib/fixture.ts:99:13)
(fail) a browser build failure (syntax error) delivers no partial output [51.27ms]

 0 pass
 1 filtered out
 2 fail
 6 expect() calls
Ran 2 tests across 1 file. [161.00ms]
```

The process-limit tests were added as characterization checks after the port. They passed on their first run, with no production fix. No RED is claimed for them. The raw result is `task-7-process-first.log`.

## Focused GREEN and file timing

The final focused run used one file at a time. It ran no full repository suite. All 296 cases in 14 files passed. Every file finished below 30 seconds. No allocation split, scheduler or clone pool was needed.

| File | Cases | Wall seconds | Exit |
| --- | ---: | ---: | ---: |
| `board/config.test.ts` | 45 | 0.167 | 0 |
| `board/contract.test.ts` | 60 | 0.020 | 0 |
| `board/runtime.test.ts` | 10 | 0.012 | 0 |
| `board/package.test.ts` | 4 | 0.012 | 0 |
| `board/place.test.ts` | 28 | 0.016 | 0 |
| `board/view.test.ts` | 23 | 0.013 | 0 |
| `board/words.test.ts` | 1 | 0.016 | 0 |
| `board/cli.test.ts` | 20 | 11.858 | 0 |
| `board/server.test.ts` | 90 | 0.858 | 0 |
| `board/build.test.ts` | 3 | 0.123 | 0 |
| `board/process.test.ts` | 2 | 0.355 | 0 |
| `tests/board.test.ts` | 3 | 3.271 | 0 |
| `tests/board-agent.test.ts` | 1 | 11.206 | 0 |
| `tests/build.test.ts` | 6 | 0.334 | 0 |

### board/config.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/config.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/config.test.ts:
(pass) refusal 0: the input is not JSON [9.57ms]
(pass) refusal 1: the input is not a JSON object [3.97ms]
(pass) refusal 2: "shell" is not a key of the config [3.05ms]
(pass) refusal 3: "a\nb" is not a key of the config [3.66ms]
(pass) refusal 4: "data" is not a list of strings with one item or more [3.67ms]
(pass) refusal 5: "run" is not a list of strings with one item or more [4.11ms]
(pass) refusal 6: "run" is not a list of strings with one item or more [3.87ms]
(pass) refusal 7: "resume" is not a list of strings with one item or more [3.65ms]
(pass) refusal 8: "port" is not an integer from 1024 to 65535 [3.07ms]
(pass) refusal 9: "port" is not an integer from 1024 to 65535 [3.15ms]
(pass) refusal 10: "port" is not an integer from 1024 to 65535 [3.07ms]
(pass) refusal 11: "port" is not an integer from 1024 to 65535 [2.86ms]
(pass) refusal 12: "port" is not an integer from 1024 to 65535 [3.04ms]
(pass) refusal 13: "data": the first item is an absolute path [2.79ms]
(pass) refusal 14: "data": the first item has a ".." part [2.74ms]
(pass) refusal 15: "data": scripts/none.sh does not exist [4.01ms]
(pass) refusal 16: "data": scripts is not a regular file [2.93ms]
(pass) refusal 17: "data": scripts/plain.txt is not executable [3.08ms]
(pass) refusal 18: "data": scripts/out.sh resolves to a place outside the main checkout [3.05ms]
(pass) refusal 19: "data": .claude/worktrees/7-x/data.sh resolves into a lane worktree [2.74ms]
(pass) refusal 20: "data": scripts/lane.sh resolves into a lane worktree [2.69ms]
(pass) refusal 21: "run": an item or a path has a control character [2.61ms]
(pass) refusal 22: "run": an item or a path has a control character [2.73ms]
(pass) refusal 23: "data": an item or a path has a control character [2.94ms]
(pass) refusal 24: "data": an item or a path has a control character [2.89ms]
(pass) refusal 25: "run": an item has "{" or "}" and is not {n} [2.99ms]
(pass) refusal 26: "resume": an item has "{" or "}" and is not {n} [2.81ms]
(pass) refusal 27: "run" has no {n} item [2.62ms]
(pass) refusal 28: "run" has no {n} item [2.50ms]
(pass) refusal 29: "resume" has no {n} item [2.87ms]
(pass) refusal 30: "data": an item has "{" or "}" [2.62ms]
(pass) refusal 31: "run": an item has "{" or "}" and is not {n} [2.47ms]
(pass) refusal 32: "run": an item has "{" or "}" and is not {n} [2.42ms]
(pass) refusal 33: "run": an item has "{" or "}" and is not {n} [2.64ms]
(pass) refusal 34: "resume": an item has "{" or "}" and is not {n} [2.89ms]
(pass) refusal 35: "data": an item has "{" or "}" [3.28ms]
(pass) refusal 36: "run" has no {n} item [2.75ms]
(pass) shared config uses the supplied subject for JSON and root refusals [2.95ms]
(pass) shared config keeps optional fields and resolves commands [4.99ms]
(pass) shared config rejects supplied invalid fields [2.67ms]
(pass) shared config keeps placeholder rules [2.99ms]
(pass) shared config keeps executable boundaries [4.26ms]
(pass) shared config rejects control characters [4.96ms]
(pass) shared config keeps the port range [3.34ms]
(pass) the status text of a board with no data says that the config has no data [0.89ms]

 45 pass
 0 fail
Ran 45 tests across 1 file. [159.00ms]
```

### board/contract.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/contract.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/contract.test.ts:
(pass) the example of the spec is a document of contract 1 [2.00ms]
(pass) rule 0: a bad tracker is refused at its place [0.14ms]
(pass) rule 1: a bad tracker is refused at its place [0.06ms]
(pass) rule 2: a bad flow.lanes is refused at its place [0.04ms]
(pass) rule 3: a bad flow.lanes.Bug is refused at its place [0.04ms]
(pass) rule 4: a bad flow.lanes.chore is refused at its place [0.04ms]
(pass) rule 5: a bad flow.lanes.chore[1] is refused at its place [0.04ms]
(pass) rule 6: a bad flow.stages is refused at its place [0.03ms]
(pass) rule 7: a bad flow.stages[0].name is refused at its place [0.05ms]
(pass) rule 8: a bad flow.stages[1].steps[0] is refused at its place [0.04ms]
(pass) rule 9: a bad flow.lanes.chore[2] is refused at its place [0.04ms]
(pass) rule 10: a bad flow.stages[2].steps[1] is refused at its place [0.04ms]
(pass) rule 11: a bad flow.steps.review is refused at its place [0.03ms]
(pass) rule 12: a bad flow.steps.plan.gate is refused at its place [0.04ms]
(pass) rule 13: a bad flow.steps.plan.hint is refused at its place [0.03ms]
(pass) rule 14: a bad noRun is refused at its place [0.03ms]
(pass) rule 15: a bad noRun is refused at its place [0.03ms]
(pass) rule 16: a bad runner is refused at its place [0.03ms]
(pass) rule 17: a bad issues is refused at its place [0.02ms]
(pass) rule 18: a bad issues[0] is refused at its place [0.02ms]
(pass) rule 19: a bad issues[0].number is refused at its place [0.03ms]
(pass) rule 20: a bad issues[0].number is refused at its place [0.02ms]
(pass) rule 21: a bad issues[0].number is refused at its place [0.02ms]
(pass) rule 22: a bad issues[1].number is refused at its place [0.02ms]
(pass) rule 23: a bad issues[0].title is refused at its place [0.03ms]
(pass) rule 24: a bad issues[0].url is refused at its place [0.02ms]
(pass) rule 25: a bad issues[0].type is refused at its place [0.02ms]
(pass) rule 26: a bad issues[0].step is refused at its place [0.02ms]
(pass) rule 27: a bad issues[0].step is refused at its place [0.03ms]
(pass) rule 28: a bad issues[0].step is refused at its place [0.03ms]
(pass) rule 29: a bad issues[0].started is refused at its place [0.04ms]
(pass) rule 30: a bad issues[0].urgent is refused at its place [0.22ms]
(pass) rule 31: a bad issues[0].updatedAt is refused at its place [0.05ms]
(pass) rule 32: a bad issues[2].closedAt is refused at its place [0.04ms]
(pass) rule 33: a bad issues[0].path is refused at its place [0.03ms]
(pass) rule 34: a bad issues[0].path is refused at its place [0.04ms]
(pass) rule 35: a bad issues[1].reason is refused at its place [0.03ms]
(pass) rule 36: a bad issues[1].reason is refused at its place [0.02ms]
(pass) rule 37: a bad issues[1].act is refused at its place [0.01ms]
(pass) rule 38: a bad issues[0].pr is refused at its place [0.02ms]
(pass) rule 39: a bad issues[0].pr.number is refused at its place [0.02ms]
(pass) rule 40: a bad issues[0].pr.url is refused at its place [0.02ms]
(pass) rule 41: a bad issues[0].pr.draft is refused at its place [0.02ms]
(pass) rule 42: a bad issues[0].pr.checks is refused at its place [0.01ms]
(pass) rule 43: a bad issues[0].pr.review is refused at its place [0.02ms]
(pass) rule 44: a bad agents is refused at its place [0.20ms]
(pass) rule 45: a bad agents.Claude is refused at its place [0.04ms]
(pass) rule 46: a bad agents.claude.available is refused at its place [0.03ms]
(pass) rule 47: a bad agents.claude.available is refused at its place [0.02ms]
(pass) rule 48: a bad agents.claude.cause is refused at its place [0.02ms]
(pass) rule 49: a bad agents.claude.cause is refused at its place [0.02ms]
(pass) rule 50: a bad agents.claude.cause is refused at its place [0.02ms]
(pass) rule 51: a bad defaultAgent is refused at its place [0.02ms]
(pass) rule 52: a bad defaultAgent is refused at its place [0.02ms]
(pass) rule 53: a bad defaultAgent is refused at its place [0.02ms]
(pass) a failure names the place and the rule, and each failure has its own line [0.34ms]
(pass) a step is in a lane one time at most, and in the stages one time at most [0.08ms]
(pass) readDocument tells a document of another contract from each other failure [0.13ms]
(pass) an absent field, a null, an unknown field, and a step outside the lane of its type pass [0.09ms]
(pass) agents and defaultAgent pass when absent, good, and fail at their place when bad [0.06ms]

 60 pass
 0 fail
Ran 60 tests across 1 file. [15.00ms]
```

### board/runtime.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/runtime.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/runtime.test.ts:
(pass) Bun 1.4.2 meets the board floor [0.15ms]
(pass) Bun 1.4.3 meets the board floor
(pass) Bun 1.5.0 meets the board floor
(pass) Bun 2.0.0 meets the board floor
(pass) Bun 1.4.1 is below the board floor
(pass) Bun 1.3.99 is below the board floor
(pass) Bun 0.9.0 is below the board floor
(pass) the Bun floor diagnostic names the supported runtime
(pass) the entry removes each node_modules/.bin item from PATH [0.36ms]
(pass) cleanPath splits the value at the delimiter of the caller [0.02ms]

 10 pass
 0 fail
Ran 10 tests across 1 file. [7.00ms]
```

### board/package.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/package.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/package.test.ts:
(pass) the package has its name, no version, the module type, the licence, the Bun range, and one command [0.34ms]
(pass) the package is private, so npm does not publish it to the public registry [0.06ms]
(pass) the package has no script, no dependency, and no workspace [0.12ms]
(pass) the entry starts with the isolated Bun line and has an execute bit [0.37ms]

 4 pass
 0 fail
Ran 4 tests across 1 file. [7.00ms]
```

### board/place.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/place.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/place.test.ts:
(pass) done is in Done, with closedAt as its time [0.41ms]
(pass) starting is in Running [0.03ms]
(pass) dirty is in Needs you with its path [0.02ms]
(pass) stuck is in Needs you with the act of its row [0.04ms]
(pass) blocked is in Needs you with its reason [0.02ms]
(pass) ready and started is in Needs you [0.04ms]
(pass) ready and urgent is in Needs you [0.07ms]
(pass) ready is in Idle [0.01ms]
(pass) a working session is in Running and a waiting session is in Needs you [0.12ms]
(pass) each state of a herdr agent has its column, its state, and what it waits for [1.06ms]
(pass) a state of a herdr agent that is a key that each object inherits is an unknown state [0.04ms]
(pass) sessionsOf reads the issue and the step from the tab label, and keeps only the agents in the repository [0.53ms]
(pass) the state of a session wins over the state of its issue, Done included [0.04ms]
(pass) two live sessions on one issue make two cards, and the issue makes none [0.03ms]
(pass) a session card names the agent that herdr found, and an issue card names none [0.91ms]
(pass) a session card carries the screen lines and the folder of its pane [0.07ms]
(pass) each card carries the pull request of its issue [0.07ms]
(pass) an urgent card is before every other card in Needs you, and a dialog comes before other waits [0.07ms]
(pass) a session with no issue shows its tab label [0.05ms]
(pass) a session whose issue is not in the data keeps its number [0.03ms]
(pass) no card has Run or Resume while the data gives a noRun text, and Run and Resume each need their entry of the config [0.11ms]
(pass) an urgent card is first in Needs you, and the session of an urgent issue too [0.05ms]
(pass) a card has no Run or Resume after a press [0.04ms]
(pass) a press holds Run for 30 seconds, or until the starting row or a session of the issue shows [0.09ms]
(pass) Needs you has the longest wait first [0.05ms]
(pass) Running has the newest first [0.05ms]
(pass) Idle has the highest number first, and Done has the last close first [0.07ms]
(pass) no data of the issues gives the session cards only [0.03ms]

 28 pass
 0 fail
Ran 28 tests across 1 file. [11.00ms]
```

### board/view.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/view.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/view.test.ts:
(pass) Needs you groups its cards by reason and keeps their order inside each group [0.30ms]
(pass) the lane track marks the steps before the current one as done [0.08ms]
(pass) the title of Run adds the hint of the step [0.04ms]
(pass) a blocked card shows its reason [0.06ms]
(pass) the lane track is absent when the lane or the step is unknown [0.02ms]
(pass) a card with no type has no lane track when a lane has the key null
(pass) an agent shows its name and letter, and an unknown agent shows its own id [0.04ms]
(pass) an agent whose id is a key that each object inherits shows its own id
(pass) an age is coarse by default and counts seconds when it is fine [0.51ms]
(pass) a key is a valid identifier from the issue number, else from the session id [0.23ms]
(pass) the tab names the repository and counts what needs you [0.02ms]
(pass) the tone of the tab icon follows the most urgent column [0.15ms]
(pass) the input and ready groups of Needs you are compact rows, and the others are full cards [0.08ms]
(pass) a waiting session names what it waits for, and a session that herdr cannot read says so [0.03ms]
(pass) the signature of a card changes with its column, its state, its step, and what it waits for [0.04ms]
(pass) a notice names the issue and the reason, and its body is the title [0.06ms]
(pass) the tail counts the cards below the fold by group, and is empty when none is [0.06ms]
(pass) the diff text and the facts of a pull request [0.07ms]
(pass) the pipeline places each issue at its step, holds the issues with no step, and keeps the sessions with no issue apart [0.17ms]
(pass) the search matches a number from its first digits, the exact number first, and words anywhere [0.17ms]
(pass) a worktree path shows from .claude/worktrees on, and another path stays whole [0.01ms]
(pass) palette search finds Run choices and the unavailable default action [0.02ms]
(pass) a cause shows its first line with no controls and 200 characters at most [0.10ms]

 23 pass
 0 fail
Ran 23 tests across 1 file. [9.00ms]
```

### board/words.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/words.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/words.test.ts:
(pass) no file of the board holds a word of one flow or of one tracker [5.44ms]

 1 pass
 0 fail
Ran 1 test across 1 file. [11.00ms]
```

### board/cli.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/cli.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/cli.test.ts:
(pass) the fixture repository: the start prints each command, the cards of the producer show, and Run types the run script with the number [1117.18ms]
(pass) with an empty config, the start prints the repository and the URL, serves the page, and the board shows the sessions of the repository only [110.62ms]
(pass) the start prints each command of the config [437.77ms]
(pass) all config forms enforce the same checkout guards [1460.72ms]
(pass) a start in a subfolder of the main checkout, or through a symbolic link to it, prints the real path of the repository [102.76ms]
(pass) a git and a herdr in a node_modules/.bin folder of the start folder do not run, with that folder first on PATH [91.35ms]
(pass) issue data stdin stays independent [74.71ms]
(pass) only the three public argument tuples are accepted [529.37ms]
(pass) Bun below the floor stops before each other act: nope [21.63ms]
(pass) Bun below the floor stops before each other act: --config-stdin [20.47ms]
(pass) Bun below the floor stops before each other act: check --config-stdin [21.40ms]
(pass) config stdin serves and checks [579.99ms]
(pass) config stdin waits for EOF and accepts chunks [1369.54ms]
(pass) config stdin reports each bad input without starting work [1820.17ms]
(pass) config stdin catches read failures [102.32ms]
(pass) config stdin enforces executable security in the real CLI [1299.99ms]
(pass) config stdin keeps port selection and listen errors [392.61ms]
(pass) config stdin preserves missing data and producer results [879.48ms]
(pass) stdin config keeps startup safeguards and terminal actions [571.49ms]
(pass) default changes leave producer configuration unchanged [825.89ms]

 20 pass
 0 fail
Ran 20 tests across 1 file. [11.85s]
```

### board/server.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/server.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/server.test.ts:
(pass) GET /api/board reads the data with the data command of the config and places the cards [10.70ms]
(pass) the first request waits for the first read of the data [2.12ms]
(pass) the data of the issues is read again only when it is older than 60 seconds [2.21ms]
(pass) the end of a session starts one read of the issues, and the card of the issue gets Run [3.40ms]
(pass) a read that fails keeps the last good data and names the error [2.62ms]
(pass) a data command that gives a row with a state outside the six keeps the cards of the last good read, and the error is its first cause [1.90ms]
(pass) a data command that gives a URL that is not https:// or http:// keeps the cards of the last good read, and the error is its first cause [2.68ms]
(pass) a data command that gives a lane key that is not lowercase letters keeps the cards of the last good read, and the error is its first cause [2.05ms]
(pass) a data command that gives a step name that is not lowercase letters keeps the cards of the last good read, and the error is its first cause [1.73ms]
(pass) a data command that exits 0 with no output keeps the cards of the last good read, and the error is its first cause [1.59ms]
(pass) a data command that exits 0 with a text line before the JSON keeps the cards of the last good read, and the error is its first cause [1.65ms]
(pass) a data command that exits 1 with a line on stdout and no stderr keeps the cards of the last good read, and the error is its first cause [1.58ms]
(pass) a data command that exits 3 with no output keeps the cards of the last good read, and the error is its first cause [2.11ms]
(pass) a document with another contract drops the last good read: no issue card, and the session cards stay [3.65ms]
(pass) a first read that fails gives the error and no issue card [1.42ms]
(pass) with no data entry in the config, the board reads nothing and shows the session cards only [1.89ms]
(pass) a herdr agent of the repository takes the place of its issue, and an agent of another folder makes no card [1.35ms]
(pass) the step word of a tab label counts only when the flow of the data names that step [2.34ms]
(pass) each session card shows the last lines of its pane with no rule, box, or control characters, and a local read does not read them again [2.44ms]
(pass) a session keeps its since while its state stays, idle and done count as one state, and a new state starts a new since [2.73ms]
(pass) Run makes one tab with no focus and runs the run command of the config in it [2.52ms]
(pass) Run on a card with the step specify runs the run command, as on each other card [1.90ms]
(pass) POST /api/run with absent agent uses the default in every {agent} item [2.18ms]
(pass) POST /api/run with an available override substitutes the override [3.20ms]
(pass) an in-flight Run keeps its resolved agent while the next press uses the new default [85.31ms]
(pass) POST /api/run with unknown/unavailable/no-effective agent gets 409 with no herdr call [23.58ms]
(pass) POST /api/run with absent agent and legacy config runs the legacy line [4.08ms]
(pass) POST /api/run with an explicit agent and legacy config gets 409 with no herdr call [2.33ms]
(pass) with an {agent} run, the current 409s still hold with no herdr call [4.15ms]
(pass) the shell of a pane reads each item of the line as one word: a path with a space and a quote, and items with shell characters [426.88ms]
(pass) Run makes the workspace of the repository when no workspace has its label [10.71ms]
(pass) Run is refused for a card with no Run, with no herdr call [10.30ms]
(pass) with no run entry in the config, no card has that press, and the press gets 409 with no herdr call [10.92ms]
(pass) with no resume entry in the config, no card has that press, and the press gets 409 with no herdr call [15.48ms]
(pass) with a noRun text in the data, the board passes it on, no card has Run or Resume, and each press gets 409 with no herdr call [11.59ms]
(pass) a press that the state of the row does not allow, and a press on an issue with a session, get 409 with no herdr call [8.39ms]
(pass) two Run presses at the same moment make one tab [2.45ms]
(pass) a run press and a run press on one issue make one tab when each reads its card before the other starts [3.97ms]
(pass) a resume press and a resume press on one issue make one tab when each reads its card before the other starts [3.09ms]
(pass) a run press and a resume press on one issue make one tab when each reads its card before the other starts [2.14ms]
(pass) a herdr call that exits with an error gives 502 with its first line, and the card keeps Run [2.08ms]
(pass) a herdr call that is not on PATH gives 502 with its first line, and the card keeps Run [1.97ms]
(pass) a herdr call that prints an error as JSON gives 502 with its first line, and the card keeps Run [1.46ms]
(pass) a herdr call that exits 1 with an error as JSON on stderr gives 502 with its first line, and the card keeps Run [1.52ms]
(pass) a herdr call that gives a list with no workspaces array gives 502 with its first line, and the card keeps Run [1.62ms]
(pass) a herdr call that gives a list that is not JSON gives 502 with its first line, and the card keeps Run [1.56ms]
(pass) the id of the workspace goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run [1.82ms]
(pass) the pane id of a new tab goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run [1.61ms]
(pass) the pane id of a new workspace goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run [1.63ms]
(pass) the tab id of a new workspace goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run [1.58ms]
(pass) Go focuses the pane of the agent, found again in herdr by its terminal id [2.02ms]
(pass) GET /api/board passes on agents and defaultAgent, null when the document lacks them [1.90ms]
(pass) the board passes on the flow, the runner, and the state of herdr, and reads herdr at each request [1.20ms]
(pass) a herdr that does not run shows as down with the first line of its error, and the issue cards stay [1.16ms]
(pass) a herdr that gives an error as JSON shows as down with the first line of its error, and the issue cards stay [1.01ms]
(pass) a herdr that gives no snapshot shows as down with the first line of its error, and the issue cards stay [0.98ms]
(pass) a local read uses the data it has: no read of the issues when it is old, and none when a session ends [2.02ms]
(pass) a session shows the lines changed in the lane worktree of its issue, or else in its folder, read each 15 seconds at most [3.58ms]
(pass) Resume makes one tab with the focus and runs the resume command of the config in it [2.00ms]
(pass) Open shell opens a tab in the dirty lane worktree of the issue, and nowhere else [2.25ms]
(pass) a press takes the number or the session id of the request, and no other field of it [2.07ms]
(pass) another Host gets 403 and one line, with no herdr call [1.63ms]
(pass) the right name with another port gets 403 and one line, with no herdr call [1.23ms]
(pass) a POST with no Origin gets 403 and one line, with no herdr call [1.42ms]
(pass) a POST with another Origin gets 403 and one line, with no herdr call [1.19ms]
(pass) a POST of a DNS-rebinding page gets 403 and one line, with no herdr call [1.26ms]
(pass) a POST with a form content type gets 403 and one line, with no herdr call [1.18ms]
(pass) a POST with a content type that only starts with application/json gets 403 and one line, with no herdr call [1.28ms]
(pass) a body that is not JSON gets 400 and one line, with no herdr call [1.32ms]
(pass) a body of null gets 400 and one line, with no herdr call [1.14ms]
(pass) a number that is not digits gets 400 and one line, with no herdr call [1.02ms]
(pass) a Resume number that is not digits gets 400 and one line, with no herdr call [1.01ms]
(pass) an Open shell number that is not digits gets 400 and one line, with no herdr call [0.94ms]
(pass) a Resume POST with another Origin gets 403 and one line, with no herdr call [1.28ms]
(pass) a number of zero gets 400 and one line, with no herdr call [1.24ms]
(pass) a number of 24 digits gets 409 and one line, with no herdr call [1.23ms]
(pass) a body over 1024 characters gets 400 and one line, with no herdr call [1.89ms]
(pass) a path that the table does not name gets 404 and one line, with no herdr call [1.27ms]
(pass) a file of the board that is not of the page gets 404 and one line, with no herdr call [1.12ms]
(pass) a GET of a POST path gets 404 and one line, with no herdr call [1.15ms]
(pass) a POST of the page gets 404 and one line, with no herdr call [1.03ms]
(pass) the Host localhost with the port of the server is accepted [1.24ms]
(pass) the content type application/json with a parameter is accepted [1.28ms]
(pass) run starts a command with no shell, and gives its exit status, its output, and the cause of a command that does not start [19.15ms]
(pass) runData starts the data command in the main checkout with the limit of 60 seconds, and gives its output or its first cause [0.17ms]
(pass) each read and each press starts herdr, git, or the data command only, with no shell, and writes nothing in the main checkout [5.20ms]
(pass) the server serves the files of the page with the policy of the page [5.28ms]
(pass) the page writes text only [0.45ms]
(pass) POST /api/agent refuses default changes without a write [41.36ms]
(pass) POST /api/agent joins the trust checks with no git call [12.89ms]

 90 pass
 0 fail
Ran 90 tests across 1 file. [852.00ms]
```

### board/build.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/build.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/build.test.ts:
(pass) the pinned build emits the browser module graph with its public URLs and identical assets [42.02ms]
(pass) a browser build failure (missing source) delivers no partial output [39.57ms]
(pass) a browser build failure (syntax error) delivers no partial output [29.82ms]

 3 pass
 0 fail
 48 expect() calls
Ran 3 tests across 1 file. [117.00ms]
```

### board/process.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/process.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/process.test.ts:
(pass) the board stdout process output has its exact 64 MiB limit [181.26ms]
(pass) the board stderr process output has its exact 64 MiB limit [152.85ms]

 2 pass
 0 fail
 8 expect() calls
Ran 2 tests across 1 file. [347.00ms]
```

### tests/board.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/board.test.ts
```

```text
bun test v1.4.2 (744846f84)

tests/board.test.ts:
(pass) board adapter keeps its stdin contract, main path, port, child status, and clean PATH [1227.74ms]
(pass) board adapter refuses a missing entry, lane starts, extra arguments, and invalid main YAML [291.12ms]
(pass) the board adapter checks the real producer and refuses executable escapes without running them [1736.65ms]

 3 pass
 0 fail
 81 expect() calls
Ran 3 tests across 1 file. [3.27s]
```

### tests/board-agent.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/board-agent.test.ts
```

```text
bun test v1.4.2 (744846f84)

tests/board-agent.test.ts:
(pass) board Run selection and saved-host Resume keep YAML and Git settings unchanged [11187.25ms]

 1 pass
 0 fail
 8 expect() calls
Ran 1 test across 1 file. [11.20s]
```

### tests/build.test.ts

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/build.test.ts
```

```text
bun test v1.4.2 (744846f84)

tests/build.test.ts:
(pass) build creates one deterministic executable without changing the public launcher [59.18ms]
(pass) a build from another checkout path has the same bytes [64.59ms]
(pass) check reports missing, stale, and nonexecutable outputs without writes [138.34ms]
(pass) build fails before delivery for a missing import [23.57ms]
(pass) build fails before delivery for a syntax error [22.36ms]
(pass) generation rejects a Bun version other than the exact pin [14.77ms]

 6 pass
 0 fail
 28 expect() calls
Ran 6 tests across 1 file. [329.00ms]
```

## Self-review and latest checks

The source diff and type-erased browser source were compared with baseline 4fe5554. This caught an optional DOM method call that the first type pass had made direct. The final source retains the original optional call. `Action.id` states the existing invariant, so no optional startsWith fallback is needed. The remaining source differences are formatting, equivalent DOM string coercion/defaults and equivalent typed filter callbacks. The full comparison is `task-7-browser-source-compare.log`.

Self-review also found a private pane fixture cleanup gap. The fixture now records each detached process group, kills it on every exit path, and checks that each group is absent before removing the fixture. The latest agent run verifies that all four recorded private pane groups are absent: each `process.kill(-pid, 0)` call throws after cleanup. It passes with 12 expectations in 8.91 seconds. The cleanup source was staged before the final gate; that exact staged gate ends `verify: PASS`.

The latest browser/HTTP run follows.

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/build.test.ts board/server.test.ts board/view.test.ts board/words.test.ts
```

```text
bun test v1.4.2 (744846f84)

board/build.test.ts:
(pass) the pinned build emits the browser module graph with its public URLs and identical assets [78.46ms]
(pass) a browser build failure (missing source) delivers no partial output [83.57ms]
(pass) a browser build failure (syntax error) delivers no partial output [42.31ms]

board/words.test.ts:
(pass) no file of the board holds a word of one flow or of one tracker [4.07ms]

board/view.test.ts:
(pass) Needs you groups its cards by reason and keeps their order inside each group [1.04ms]
(pass) the lane track marks the steps before the current one as done [0.12ms]
(pass) the title of Run adds the hint of the step [0.05ms]
(pass) a blocked card shows its reason [0.25ms]
(pass) the lane track is absent when the lane or the step is unknown [0.06ms]
(pass) a card with no type has no lane track when a lane has the key null [0.01ms]
(pass) an agent shows its name and letter, and an unknown agent shows its own id [0.05ms]
(pass) an agent whose id is a key that each object inherits shows its own id [0.01ms]
(pass) an age is coarse by default and counts seconds when it is fine [0.11ms]
(pass) a key is a valid identifier from the issue number, else from the session id [0.07ms]
(pass) the tab names the repository and counts what needs you [0.02ms]
(pass) the tone of the tab icon follows the most urgent column [0.14ms]
(pass) the input and ready groups of Needs you are compact rows, and the others are full cards [0.05ms]
(pass) a waiting session names what it waits for, and a session that herdr cannot read says so [0.04ms]
(pass) the signature of a card changes with its column, its state, its step, and what it waits for [0.04ms]
(pass) a notice names the issue and the reason, and its body is the title [0.06ms]
(pass) the tail counts the cards below the fold by group, and is empty when none is [0.07ms]
(pass) the diff text and the facts of a pull request [0.09ms]
(pass) the pipeline places each issue at its step, holds the issues with no step, and keeps the sessions with no issue apart [0.21ms]
(pass) the search matches a number from its first digits, the exact number first, and words anywhere [0.58ms]
(pass) a worktree path shows from .claude/worktrees on, and another path stays whole [0.02ms]
(pass) palette search finds Run choices and the unavailable default action [0.03ms]
(pass) a cause shows its first line with no controls and 200 characters at most [0.09ms]

board/server.test.ts:
(pass) GET /api/board reads the data with the data command of the config and places the cards [91.16ms]
(pass) the first request waits for the first read of the data [7.04ms]
(pass) the data of the issues is read again only when it is older than 60 seconds [6.55ms]
(pass) the end of a session starts one read of the issues, and the card of the issue gets Run [11.95ms]
(pass) a read that fails keeps the last good data and names the error [10.40ms]
(pass) a data command that gives a row with a state outside the six keeps the cards of the last good read, and the error is its first cause [13.20ms]
(pass) a data command that gives a URL that is not https:// or http:// keeps the cards of the last good read, and the error is its first cause [14.59ms]
(pass) a data command that gives a lane key that is not lowercase letters keeps the cards of the last good read, and the error is its first cause [8.42ms]
(pass) a data command that gives a step name that is not lowercase letters keeps the cards of the last good read, and the error is its first cause [29.61ms]
(pass) a data command that exits 0 with no output keeps the cards of the last good read, and the error is its first cause [5.72ms]
(pass) a data command that exits 0 with a text line before the JSON keeps the cards of the last good read, and the error is its first cause [10.85ms]
(pass) a data command that exits 1 with a line on stdout and no stderr keeps the cards of the last good read, and the error is its first cause [5.74ms]
(pass) a data command that exits 3 with no output keeps the cards of the last good read, and the error is its first cause [9.46ms]
(pass) a document with another contract drops the last good read: no issue card, and the session cards stay [10.35ms]
(pass) a first read that fails gives the error and no issue card [3.04ms]
(pass) with no data entry in the config, the board reads nothing and shows the session cards only [6.45ms]
(pass) a herdr agent of the repository takes the place of its issue, and an agent of another folder makes no card [4.89ms]
(pass) the step word of a tab label counts only when the flow of the data names that step [8.93ms]
(pass) each session card shows the last lines of its pane with no rule, box, or control characters, and a local read does not read them again [7.34ms]
(pass) a session keeps its since while its state stays, idle and done count as one state, and a new state starts a new since [14.02ms]
(pass) Run makes one tab with no focus and runs the run command of the config in it [13.46ms]
(pass) Run on a card with the step specify runs the run command, as on each other card [7.16ms]
(pass) POST /api/run with absent agent uses the default in every {agent} item [9.49ms]
(pass) POST /api/run with an available override substitutes the override [13.17ms]
(pass) an in-flight Run keeps its resolved agent while the next press uses the new default [105.31ms]
(pass) POST /api/run with unknown/unavailable/no-effective agent gets 409 with no herdr call [141.67ms]
(pass) POST /api/run with absent agent and legacy config runs the legacy line [6.58ms]
(pass) POST /api/run with an explicit agent and legacy config gets 409 with no herdr call [5.81ms]
(pass) with an {agent} run, the current 409s still hold with no herdr call [11.94ms]
(pass) the shell of a pane reads each item of the line as one word: a path with a space and a quote, and items with shell characters [550.25ms]
(pass) Run makes the workspace of the repository when no workspace has its label [2.55ms]
(pass) Run is refused for a card with no Run, with no herdr call [2.61ms]
(pass) with no run entry in the config, no card has that press, and the press gets 409 with no herdr call [3.22ms]
(pass) with no resume entry in the config, no card has that press, and the press gets 409 with no herdr call [2.49ms]
(pass) with a noRun text in the data, the board passes it on, no card has Run or Resume, and each press gets 409 with no herdr call [2.64ms]
(pass) a press that the state of the row does not allow, and a press on an issue with a session, get 409 with no herdr call [8.19ms]
(pass) two Run presses at the same moment make one tab [3.06ms]
(pass) a run press and a run press on one issue make one tab when each reads its card before the other starts [4.32ms]
(pass) a resume press and a resume press on one issue make one tab when each reads its card before the other starts [4.98ms]
(pass) a run press and a resume press on one issue make one tab when each reads its card before the other starts [3.22ms]
(pass) a herdr call that exits with an error gives 502 with its first line, and the card keeps Run [2.82ms]
(pass) a herdr call that is not on PATH gives 502 with its first line, and the card keeps Run [2.45ms]
(pass) a herdr call that prints an error as JSON gives 502 with its first line, and the card keeps Run [2.53ms]
(pass) a herdr call that exits 1 with an error as JSON on stderr gives 502 with its first line, and the card keeps Run [2.48ms]
(pass) a herdr call that gives a list with no workspaces array gives 502 with its first line, and the card keeps Run [2.09ms]
(pass) a herdr call that gives a list that is not JSON gives 502 with its first line, and the card keeps Run [1.80ms]
(pass) the id of the workspace goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run [2.33ms]
(pass) the pane id of a new tab goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run [1.90ms]
(pass) the pane id of a new workspace goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run [1.92ms]
(pass) the tab id of a new workspace goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run [1.76ms]
(pass) Go focuses the pane of the agent, found again in herdr by its terminal id [2.66ms]
(pass) GET /api/board passes on agents and defaultAgent, null when the document lacks them [2.59ms]
(pass) the board passes on the flow, the runner, and the state of herdr, and reads herdr at each request [1.76ms]
(pass) a herdr that does not run shows as down with the first line of its error, and the issue cards stay [1.36ms]
(pass) a herdr that gives an error as JSON shows as down with the first line of its error, and the issue cards stay [1.24ms]
(pass) a herdr that gives no snapshot shows as down with the first line of its error, and the issue cards stay [1.30ms]
(pass) a local read uses the data it has: no read of the issues when it is old, and none when a session ends [2.51ms]
(pass) a session shows the lines changed in the lane worktree of its issue, or else in its folder, read each 15 seconds at most [5.56ms]
(pass) Resume makes one tab with the focus and runs the resume command of the config in it [4.09ms]
(pass) Open shell opens a tab in the dirty lane worktree of the issue, and nowhere else [3.29ms]
(pass) a press takes the number or the session id of the request, and no other field of it [2.85ms]
(pass) another Host gets 403 and one line, with no herdr call [2.25ms]
(pass) the right name with another port gets 403 and one line, with no herdr call [1.42ms]
(pass) a POST with no Origin gets 403 and one line, with no herdr call [1.56ms]
(pass) a POST with another Origin gets 403 and one line, with no herdr call [1.80ms]
(pass) a POST of a DNS-rebinding page gets 403 and one line, with no herdr call [1.76ms]
(pass) a POST with a form content type gets 403 and one line, with no herdr call [1.78ms]
(pass) a POST with a content type that only starts with application/json gets 403 and one line, with no herdr call [1.75ms]
(pass) a body that is not JSON gets 400 and one line, with no herdr call [1.90ms]
(pass) a body of null gets 400 and one line, with no herdr call [2.11ms]
(pass) a number that is not digits gets 400 and one line, with no herdr call [1.99ms]
(pass) a Resume number that is not digits gets 400 and one line, with no herdr call [1.91ms]
(pass) an Open shell number that is not digits gets 400 and one line, with no herdr call [2.00ms]
(pass) a Resume POST with another Origin gets 403 and one line, with no herdr call [2.04ms]
(pass) a number of zero gets 400 and one line, with no herdr call [1.87ms]
(pass) a number of 24 digits gets 409 and one line, with no herdr call [1.66ms]
(pass) a body over 1024 characters gets 400 and one line, with no herdr call [2.69ms]
(pass) a path that the table does not name gets 404 and one line, with no herdr call [1.93ms]
(pass) a file of the board that is not of the page gets 404 and one line, with no herdr call [1.53ms]
(pass) a GET of a POST path gets 404 and one line, with no herdr call [1.33ms]
(pass) a POST of the page gets 404 and one line, with no herdr call [1.75ms]
(pass) the Host localhost with the port of the server is accepted [2.30ms]
(pass) the content type application/json with a parameter is accepted [1.91ms]
(pass) run starts a command with no shell, and gives its exit status, its output, and the cause of a command that does not start [20.81ms]
(pass) runData starts the data command in the main checkout with the limit of 60 seconds, and gives its output or its first cause [0.20ms]
(pass) each read and each press starts herdr, git, or the data command only, with no shell, and writes nothing in the main checkout [5.56ms]
(pass) the server serves the files of the page with the policy of the page [6.52ms]
(pass) the page writes text only [1.43ms]
(pass) POST /api/agent refuses default changes without a write [53.21ms]
(pass) POST /api/agent joins the trust checks with no git call [23.29ms]

 117 pass
 0 fail
 48 expect() calls
Ran 117 tests across 4 files. [1.64s]
```

The final private pane cleanup run follows.

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/board-agent.test.ts
```

```text
bun test v1.4.2 (744846f84)

tests/board-agent.test.ts:
(pass) board Run selection and saved-host Resume keep YAML and Git settings unchanged [8888.53ms]

 1 pass
 0 fail
 12 expect() calls
Ran 1 test across 1 file. [8.91s]
```

The old internal CLI also passed `node board/cli.mjs check --stdin < board/fixtures/contract-1.json` on Node v26.12.0, with exact output `agent-board: contract 1, 3 issues, ok` and exit 0.

## Generated bytes

Generation used only the pinned build program with `--outdir /private/tmp/celetis-board-build-96`. Only its five browser outputs were copied into the checkout. The build test regenerates and compares each byte and exact mode 0644, rejects TypeScript import URLs, resolves the local graph, and dynamically imports view, UI, panel and palette modules. It checks the real `pageTitle` result and exported functions. The shared six build cases also verify deterministic bytes across checkout paths, stale/missing/nonexecutable refusals, compile failures and the exact build pin.

Generation command:

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts --outdir /private/tmp/celetis-board-build-96
```

```text
d1178deb52b11692c58684e4d11aa5fadf0b1ede45100637cf9415cf41127cea  board/board.js
381cf2d817e05baf3e33f7d65cec3f5a812d47dfea19b2b6d6623d9748765a5a  board/view.mjs
44b8e3527b71c4d4f6354f59d4bde3ff69c62297d96b79d1c52d209f8cae94c2  board/ui.mjs
28db0a974a1bef62aa73d37fa2dd420c0e0df10039f1aa6f8a376fb0bd89ce3b  board/panel.mjs
94356aba91faa10901a6359edb68bb1be2e1e842bae821c64bf377f7d30c8cfb  board/palette.mjs
launcher current: b2c6ab5ce2dbd6e4ce1d89ede685538e9eb224cc
launcher BASE: b2c6ab5ce2dbd6e4ce1d89ede685538e9eb224cc
unchanged HTML/CSS/fonts/contract names: 
```

## Current assertion and caller inventory

`docs/superpowers/plans/96-port-map.md` contains 540 baseline assertion locations, baseline path callers, all 296 final case/file pairs, 367 explicit nested input rows, and the expanded 37 config, 54 contract, 8 placement, 20 HTTP and 26 inline server parameter rows. The machine-readable parameter inventory is `task-7-parameter-inventory.json`.

Task 9 must discover all 13 board/adapter TypeScript entries and keep the six shared build cases. It must remove old internal `.mjs` and shell test callers. The old runtime entries remain operational until then. This intermediate tree is not a landing tree. The map and report are in the existing ignored work records.

## Final staged gate

Command:

```bash
PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin:/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/tools/bin:/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/npm/bin:$PATH npm_config_prefix=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/npm scripts/verify.sh
```

The first gate found only a formatting error in the extended build test. That was corrected. The final staged gate passes. Its complete output follows. Existing Claude directory warnings for version, license and icon are the documented baseline warnings; the validator still exits 0. No new validator warning was introduced.

```text
== shellcheck 0.11.0
== shfmt 3.14.1
== actionlint 1.7.12
== biome 2.5.15
== tsc 7.0.2
== @types/bun 1.4.2
== shfmt -l
== biome check
Checked 100 files in 331ms. No fixes applied.
== shellcheck: scripts/board.sh
== shellcheck: scripts/capscore.sh
== shellcheck: scripts/celetis
== shellcheck: scripts/celetis-flow.sh
== shellcheck: scripts/land.sh
== shellcheck: scripts/lib/host.sh
== shellcheck: scripts/lib/session.sh
== shellcheck: scripts/next-step.sh
== shellcheck: scripts/root.sh
== shellcheck: scripts/setup.sh
== shellcheck: scripts/verify.sh
== shellcheck: scripts/worktree-lib.sh
== shellcheck: scripts/worktree.sh
== shellcheck: tests/board-agent.test.sh
== shellcheck: tests/board.test.sh
== shellcheck: tests/capscore.test.sh
== shellcheck: tests/celetis-flow.test.sh
== shellcheck: tests/config.test.sh
== shellcheck: tests/custom-part-harness.test.sh
== shellcheck: tests/host-session.test.sh
== shellcheck: tests/land.test.sh
== shellcheck: tests/launcher.test.sh
== shellcheck: tests/lib/pool.sh
== shellcheck: tests/manual-harness.test.sh
== shellcheck: tests/manual/custom-part.test.sh
== shellcheck: tests/manual/step-prompt.test.sh
== shellcheck: tests/native-entry.test.sh
== shellcheck: tests/native-events-harness.test.sh
== shellcheck: tests/native-observer.test.sh
== shellcheck: tests/next-step.test.sh
== shellcheck: tests/pool.test.sh
== shellcheck: tests/runner-lifecycle.test.sh
== shellcheck: tests/runner-lock.test.sh
== shellcheck: tests/setup.test.sh
== shellcheck: tests/suite.sh
== shellcheck: tests/text.test.sh
== shellcheck: tests/verify.test.sh
== shellcheck: tests/worktree.test.sh
== bash -n
== node --check
== jq -f
== actionlint
== celetis_config_read
== tsc
== generated browser assets
== perl -c scripts/plugin-update.pl
scripts/plugin-update.pl syntax OK
== tests/text.test.sh
PASS
== claude plugin validate
Validating marketplace manifest: /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/.claude-plugin/marketplace.json

⚠ Found 1 warning:

  ❯ plugins[0] plugin.json → version: No version specified. Consider adding a version following semver (e.g., "1.0.0")

Validating plugin: /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/.claude-plugin/plugin.json

⚠ Found 1 warning:

  ❯ version: No version specified. Consider adding a version following semver (e.g., "1.0.0")

Validating hooks: /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/hooks/hooks.json

  ❯ ./entry.js hooks: turn.step, skill.prompt, session.append, tool.call{tool=Read}
  ❯ ./entry.js gating hook with .catch: session.append
  ❯ ./entry.js gating hook with .catch: tool.call{tool=Read}
  ❯ ./entry.js calls: $.fs.stat (via metadata), $.session.cwd (via checkout), $.session.root (via checkout), $.tool.call (via read)

Plugin directory checks for /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain. The plugin directory is the catalog that plugins are submitted to; this is a subset of what it runs.

✘ Found 1 problem the plugin directory refuses a submission for:

  ❯ LICENSE: License missing (LICENSE_MISSING). This plugin has no LICENSE file and plugin.json has no `license`. The directory requires one of them.
    Fix: Add a LICENSE file to the plugin folder, or set `license` (an SPDX id) in plugin.json. A LICENSE at the repository root also counts for a plugin in a sub-folder.

⚠ Found 1 plugin directory warning:

  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
    Fix: Add a square PNG to the plugin folder at .claude-plugin/icon.png, or set `icon` in plugin.json to the path of a square PNG or JPEG in the plugin: 512 to 2048 px on each side, under 2 MB. SVG and WebP are not accepted. That file may become the listing icon only once: the first time the plugin is saved or submitted in the developer portal. Adding or changing it later does not change the icon.

About these checks:

  ❯ This folder also holds a marketplace manifest. The plugin directory treats such a folder as a plugin, so these checks cover only the plugin in this folder. To check another plugin that the marketplace lists, run validate on that plugin's folder.
  ❯ hooks/hooks.json names a hooks module (a code file listed under `modules`). The plugin directory has rules of its own for such code, and these checks apply none of them, so passing here does not mean the directory accepts the plugin. The developer portal's own validation applies those rules.

These plugin directory checks do not change the result below. To fail on problems the directory refuses a submission for, run this command with --profile directory.

The directory also runs a safety scan and a policy review that this command does not.

✔ Validation passed with warnings
verify: PASS
```

## Acceptance and concerns

Actual Chromium at desktop width and 375×812 is UNRUN. Native desktop acceptance is UNRUN. The real herdr terminal boundary is UNRUN. The user said to ignore live checks. No sign-in, live host or real pane was requested or started. Help and stub argv do not prove the real terminal boundary.

Read-only terminal evidence:

```text
herdr --version
herdr 0.9.3

herdr pane run --help
Run a command in a pane

Usage: herdr pane run <PANE_ID> <COMMAND>...

Arguments:
  <PANE_ID>
          

  <COMMAND>...

```

Current codex-cli 0.163.0 version and Resume help were also read before relying on that host operation. The implementation retains the established text command boundary and POSIX per-argument quoting. Private real shell execution verifies literal arguments and no marker execution. It is not live herdr acceptance.

`board/board.ts` remains large because this port preserves the established structure. No known deterministic failure remains. No push, landing, PR, issue mutation or full-suite run was done. Final CI owns the full suite.

## Files

```text
 biome.jsonc                |    3 +-
 board/README.md            |   71 ++-
 board/board.js             | 1460 +++++++++++++++++++++----------------------
 board/board.ts             | 1270 ++++++++++++++++++++++++++++++++++++++
 board/build.test.ts        |   78 +++
 board/cli.test.ts          |  834 +++++++++++++++++++++++++
 board/cli.ts               |  100 +++
 board/config.test.ts       |  225 +++++++
 board/config.ts            |   73 +++
 board/contract.test.ts     |  337 ++++++++++
 board/contract.ts          |  218 +++++++
 board/fixtures/herdr       |   14 -
 board/fixtures/herdr.ts    |   31 +
 board/fixtures/producer.sh |    2 -
 board/fixtures/producer.ts |    5 +
 board/fixtures/run.sh      |    2 -
 board/fixtures/run.ts      |    2 +
 board/package.json         |    4 +-
 board/package.test.ts      |   45 ++
 board/palette.mjs          |  161 ++---
 board/palette.ts           |  134 ++++
 board/panel.mjs            |  283 ++++-----
 board/panel.ts             |  222 +++++++
 board/place.test.ts        |  456 ++++++++++++++
 board/place.ts             |  182 ++++++
 board/process.test.ts      |   16 +
 board/runtime.test.ts      |   25 +
 board/runtime.ts           |    9 +
 board/server.test.ts       | 1467 ++++++++++++++++++++++++++++++++++++++++++++
 board/server.ts            |  474 ++++++++++++++
 board/test-support.ts      |   50 ++
 board/tsconfig.json        |    5 +
 board/types.ts             |  116 ++++
 board/ui.mjs               |  383 ++++++------
 board/ui.ts                |  350 +++++++++++
 board/view.mjs             |  280 ++++-----
 board/view.test.ts         |  327 ++++++++++
 board/view.ts              |  210 +++++++
 board/words.test.ts        |   16 +
 scripts/board.ts           |   62 ++
 scripts/build.ts           |   30 +-
 scripts/verify.sh          |   25 +
 tests/board-agent.test.ts  |  235 +++++++
 tests/board.test.ts        |  142 +++++
 tests/build.test.ts        |    3 +
 tests/lib/board-fixture.ts |   92 +++
 46 files changed, 9134 insertions(+), 1395 deletions(-)
```
