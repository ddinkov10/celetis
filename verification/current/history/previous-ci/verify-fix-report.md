# Final Verify repair: runner lifecycle deadline

Status: DONE after the commit recorded below. Scope: the actual macOS runner-lifecycle file deadline failure.

Lane: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`.
Branch: `feat/96-intent-the-whole-toolchain`.
BASE: `fc773596aa4d66fbae647789a7040f32a96ad717`.
The first command confirmed this binding and a clean tracked tree. The current AGENTS.md, original Task 5 brief/report, global constraints and systematic-debugging skill were read. No subagent ran.

## Actual before-fix failure

The failed Final Verify entry ran alone through `suite({root: <exact lane>, files: ['tests/runner-lifecycle.test.ts'], workers: 1, timeoutMs: 30000})`. That uses the pinned Bun command with `test --timeout 29000 <absolute entry>`. A real process table was recorded every 200 ms.

The original command was:

```text
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify.s9qkv0f5/v3-proof.ts
```

Decisive output from the supplied raw log:

```text
30 passing case lines; no assertion failure before cutoff
FAIL: tests/runner-lifecycle.test.ts (exit 124)
-- tests/runner-lifecycle.test.ts: 30.104 s
suite: FAIL
```

Raw log: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify.s9qkv0f5/logs/v3-tests_runner-lifecycle.test.ts.log`.
Process tables: `v3-process-tables.log` in the same directory. The two unfinished cases were:

- `registration claude issue starts only after both refs commit`
- `registration codex auto starts only after both refs commit`

The process tables and the remaining private markers show progress near the cutoff. The Claude fixture first appears at 08:37:47.585Z; its first registration was released at 08:37:56.932Z. The Codex fixture first appears at 08:37:48.392Z; its first registration was released at 08:37:57.380Z. Both then entered their second runner. The final process table at 08:37:58.154Z has no observed test descendants. `verify-fix-before.json` preserves the marker times and the complete 32-name inventory.

The unchanged complete file was not rerun to seek a passing sample.

## Hypothesis and one focused diagnostic

Hypothesis: the aggregate real-process workload in one file exceeded its 30-second allocation. The registration cases run two foreground startup phases, real Git transactions and parent-death checks. They need enough file time after they leave the fixture queue. A local 20.68-second Task 5 pass did not establish a fixed upper bound for that aggregate workload.

The case file, common fixture and runtime runner are byte-identical to their earlier Task 5 versions at `0cc9dbf`:

| Source | SHA-256 at both versions |
| --- | --- |
| tests/runner-lifecycle.test.ts | 26c12e21b22bfc9a9c8f40fda494af7712ae6b34fe90f9a70ae4524a500235c7 |
| tests/lib/runner-fixture.ts | 04a5563376d1178d4ef7d48f29e73b639931c390aeff3c9b5c9d8eb27dffb532 |
| scripts/celetis-flow.ts | 37280e8213e1f7325c9f88c7dc0b077b579966d497e4386d0b54565c7b2483dc |

The generated launcher grew from 13,000 to 222,559 bytes. The fixture still starts the source runner or source launcher with `process.execPath`; its managed wrapper is unchanged. The diagnostic measured package copy and repository setup rather than assigning the failure to the generated file size.

One private diagnostic copy selected only the two unfinished cases. It kept the original case logic and runtime/fixture paths and added phase timing plus a count of real Git wrapper calls. It ran through the existing `runJobs` mechanism with one file worker, the unchanged 30-second file deadline, and real ps snapshots every 200 ms. No tracked file was changed before this diagnostic.

Exact command:

```text
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros .superpowers/sdd/96/verify-fix-probe.ts
```

| Diagnostic phase | Claude issue | Codex automatic |
| --- | ---: | ---: |
| Package copied | 9.670 ms | 9.482 ms |
| Private repository ready | 82.920 ms | 82.513 ms |
| First registration reached | 2034.907 ms | 2150.159 ms |
| Second saved session verified | 3203.618 ms | 3480.987 ms |
| Final lock recovery checked | 3710.577 ms | 4181.437 ms |
| Real Git wrapper calls | 43 | 64 |

Result: `2 pass`, `30 filtered out`, `0 fail`, 26 assertions. The test body finished in 4.35 seconds; the file runner took **4.463 seconds**, returned 0 and did not time out. The after table has no owned processes. Raw files: `verify-fix-probe.log`, `verify-fix-probe-processes.log`, `verify-fix-diagnostic-path.txt` and `verify-fix-before.json` beside this report.

Conclusion: the evidence supports a file-work allocation failure. The original cutoff shows these cases progressing; the focused diagnostic completes their exact protocol and checks. The measured copy cost is small. This evidence does not require a production lock, signal or wait change.

## Approved correction

Before implementation, the controller approved exactly this allocation change:

- Move the two registration cases and four update-startup cases to `tests/runner-startup.test.ts`.
- Keep the other 26 cases in `tests/runner-lifecycle.test.ts`.
- Move the existing `managed`, `start`, `identity`, `held` and `finish` helpers to `tests/lib/runner-lifecycle-fixture.ts`, and import that one implementation from both entries.
- Add the new entry to `tests/suite.ts:processEntries` and to the covering discovery assertions in `tests/parallel.test.ts`.

The five tracked changed files are those listed above. Product runtime code is unchanged. All waits, all timeouts and all case names/checks remain unchanged. No general framework or new timing control was added.

`verify-fix-source-preservation.json` records four passing mechanical comparisons: shared helper logic, the four update cases, the two registration cases, and the remaining 26 case bodies. The comparison permits formatting whitespace and added helper exports only. The original blocks are retained in `verify-fix-original-blocks.json` and `verify-fix-original-lifecycle.ts`.

All **282 assertions** remain: 228 in the lifecycle entry and 54 in the startup entry. `verify-fix-case-inventory.json` compares the 32 original names with both the solo and paired results. It reports 32 before, 32 after and 32 in the paired run, with no name change or duplicate.

## After-fix commands and results

All commands below ran from the exact lane, using Bun 1.4.2 (744846f84), the four isolation flags, cache/report controls, and the private tools prefix. The after driver uses the actual `suite()` from the lane. Its `solo` mode runs the two amended files in separate one-worker suite calls. Its `pair` mode leaves the worker count unspecified, so the suite uses its default two file workers. Every call keeps `timeoutMs: 30000` and records actual owned processes every 200 ms.

```text
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros .superpowers/sdd/96/verify-fix-after.ts solo
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros .superpowers/sdd/96/verify-fix-after.ts pair
```

| Boundary | Entry | Cases | Assertions | File-runner time | Status |
| --- | --- | ---: | ---: | ---: | --- |
| Alone, workers 1 | tests/runner-lifecycle.test.ts | 26 | 228 | 13.801 s | exit 0; suite PASS |
| Alone, workers 1 | tests/runner-startup.test.ts | 6 | 54 | 5.049 s | exit 0; suite PASS |
| Together, default workers 2 | tests/runner-lifecycle.test.ts | 26 | 228 | 16.373 s | exit 0; suite PASS |
| Together, default workers 2 | tests/runner-startup.test.ts | 6 | 54 | 9.081 s | exit 0; suite PASS |

Every amended file is below 30 seconds in both boundaries. Every result has `timedOut: false`. After each solo run and the paired run, the process table has no owned processes and the private temporary directory is empty.

Raw logs: `verify-fix-solo-driver.log`, `verify-fix-lifecycle-solo.log`, `verify-fix-startup-solo.log`, `verify-fix-pair-driver.log`, `verify-fix-pair.log`, their matching `.json` results, and the three `*-processes.log` files.

Discovery check:

```text
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test --timeout 29000 tests/parallel.test.ts --test-name-pattern 'suite discovers every automatic'
```

Result: `1 pass`, `9 filtered out`, `0 fail`, 20 assertions, 0.055 s, exit 0. The case compares discovery with tracked automatic entries and checks new process-subset membership. Log: `verify-fix-discovery.log`.

The new files were staged before discovery coverage and before the gate. Exact gate command:

```text
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

Result: `verify: PASS`, exit 0. Log: `verify-fix-gate.log`. The existing unversioned-manifest and managed-hook notices remain. No new warning appeared. The gate also keeps the generated byte/mode check.

## Complete retained case inventory

The before file for every row is `tests/runner-lifecycle.test.ts`. These exact names appear in both the after solo logs and the paired log.

| Retained name | Current file |
| --- | --- |
| after_wait claude blocked blocks exit | tests/runner-lifecycle.test.ts |
| after_wait codex unknown blocks exit | tests/runner-lifecycle.test.ts |
| crash preserves exit status 23 without a no-progress row | tests/runner-lifecycle.test.ts |
| ending claude done failed waits for foreground exit | tests/runner-lifecycle.test.ts |
| ending claude idle accepted waits for foreground exit | tests/runner-lifecycle.test.ts |
| ending codex done accepted waits for foreground exit | tests/runner-lifecycle.test.ts |
| ending codex idle failed waits for foreground exit | tests/runner-lifecycle.test.ts |
| guard claude dirty blocks exit | tests/runner-lifecycle.test.ts |
| guard claude unchanged blocks exit | tests/runner-lifecycle.test.ts |
| guard codex landing blocks exit | tests/runner-lifecycle.test.ts |
| guard codex missing blocks exit | tests/runner-lifecycle.test.ts |
| handoff claude starts the next saved session exactly once | tests/runner-lifecycle.test.ts |
| handoff codex starts the next saved session exactly once | tests/runner-lifecycle.test.ts |
| idle claude pins all accepted and unsafe replies | tests/runner-lifecycle.test.ts |
| idle codex pins all accepted and unsafe replies | tests/runner-lifecycle.test.ts |
| late claude blocked repeats resolver and checks idle again | tests/runner-lifecycle.test.ts |
| late codex unknown repeats resolver and checks idle again | tests/runner-lifecycle.test.ts |
| registration claude issue starts only after both refs commit | tests/runner-startup.test.ts |
| registration codex auto starts only after both refs commit | tests/runner-startup.test.ts |
| resume claude holds the issue without watcher, runner lock or refresh | tests/runner-lifecycle.test.ts |
| resume codex holds the issue without watcher, runner lock or refresh | tests/runner-lifecycle.test.ts |
| saved claude blocked stays open | tests/runner-lifecycle.test.ts |
| saved claude unknown stays open | tests/runner-lifecycle.test.ts |
| saved codex blocked stays open | tests/runner-lifecycle.test.ts |
| saved codex unknown stays open | tests/runner-lifecycle.test.ts |
| term SIGHUP holds lock until the foreground exits | tests/runner-lifecycle.test.ts |
| term SIGINT holds lock until the foreground exits | tests/runner-lifecycle.test.ts |
| term SIGTERM holds lock until the foreground exits | tests/runner-lifecycle.test.ts |
| update claude failure keeps exact host sequence and stop behavior | tests/runner-startup.test.ts |
| update claude success keeps exact host sequence and stop behavior | tests/runner-startup.test.ts |
| update codex failure keeps exact host sequence and stop behavior | tests/runner-startup.test.ts |
| update codex success keeps exact host sequence and stop behavior | tests/runner-startup.test.ts |

## Callers, cleanup and limits

The old update/registration assertion-map rows now point to `tests/runner-startup.test.ts`. The shared identity/held rows point to `tests/lib/runner-lifecycle-fixture.ts`. Both test entries import those existing helpers. `processEntries` and discovery coverage include the new automatic entry. The final ignored map lists all 32 current case allocations and records 49 automatic entries; the case count is unchanged. The map was not force-added.

Private fixture creation, process handles, SIGKILL tests, TERM/INT/HUP checks, Git locks, saved identity checks and explicit cleanup retain their original implementations. The source-preservation checks and the unchanged sum of 282 assertions confirm the retained checks. The solo and paired owned-process tables and empty private temporary directories provide the cleanup evidence.

The actual failed Final Verify log and the single focused diagnostic are the before-fix evidence. No retrospective RED was manufactured. The original Task 5 test-first sequence remains recorded in its report. No full suite, live host check, PR, push, issue mutation, Land, or other-product edit ran here. Linux acceptance and continuation of Final Verify remain with the controller.

Commit: `d658ce0` — `test(runner): split startup lifecycle checks`. The tracked worktree is clean after this commit.
