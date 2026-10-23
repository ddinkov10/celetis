# Task 3 report

Status: DONE. All 44 focused tests pass. The staged gate ends `verify: PASS`.

Commit: `eedb92e` — `feat(commands): port resolution and scoring to Bun`.

## Change

Created `scripts/next-step.ts` and `scripts/capscore.ts`. Each exports `main(argv: string[]): Promise<number>` and runs it only under `import.meta.main`.

The resolver keeps the number, `--open`, and `--json` contracts, exact stdout, state order, current refusal rule, dirty-tree order, landing lock behavior, PR selection, check and review state, metadata, and 14-day closed window. GitHub list calls use argument arrays with `--paginate --slurp`; TypeScript reads all pages in order. Comments above 32 KiB stay in captured data. A duplicate issue keeps the first record, as in the baseline. A live landing uses `land.ts`. A failed ps query gives an unowned lock; the recovery covers that query only.

The scorer keeps its arithmetic, floors, bias, attempts, reviewer rules, host selection, main and explicit profiles, parent-model mode, same-model retry floor, text output, schema-1 JSON, and all 27 built-in self-test vectors. STOP occurs before host, config, profile, runtime, or database lookup. The opencode lookup keeps sqlite3 argument arrays, the cwd-first SQL query, quote escaping, the fallback query, and model fallback on a failed query. No database dependency was added.

The shared `run()` capture helper now closes child stdin. Its contract has no input payload. `tests/lib/fixture.ts` makes the same correction in its test capture helper. Existing callers `commonDir()` and `installedRoot()` need no stdin. Host operations with writable or inherited input use their existing spawn/execve paths.

The approved schema correction rejects `reviewer.effort: ["medium"]`. The published schema requires a string. The old jq program accepts that array because `index(array)` matches a subarray. The controller approved strict string validation. A separate test records old status 0 and typed status 2. Malformed array-valued profiles now fail; valid profiles are unchanged. No other new schema rule was added.

## TDD evidence

All test commands use the private Bun 1.4.2 executable:

`/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun`

The prefix is `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1`. The flags are `--no-env-file --no-install --config=/dev/null --no-macros`.

RED command: `<prefix> <bun> <flags> test tests/next-step.test.ts tests/capscore.test.ts tests/process.test.ts`.

[RED log](logs/task-3-red.log) records 22 pass and 17 fail. The new command paths were absent and returned `Module not found`. The EOF regression timed out with status 143 instead of returning `0\n`. The test capture helper was corrected before the recorded RED run so the baseline could drain stdin. No command implementation existed in that run.

The final direct-runtime EOF test also has a separate mutation check. Removing only `child.stdin?.end()` made it fail with status 143; restoring the line made it pass in 16.73 ms. See [EOF RED](logs/task-3-eof-red.log) and [EOF GREEN](logs/task-3-eof-green.log). The restored production file has no unstaged diff.

[Duplicate-page RED log](logs/task-3-duplicate-red.log) records a later regression. The first implementation kept the last issue record; the baseline kept the first. The log shows `bug` versus `chore` for the same issue. The final resolver keeps the first record and the regression passes.

[Combined GREEN log](logs/task-3-green.log) records the earlier 42/42 pass, including actual ps inspection of a private Bun child. The final per-file runs below add the failed-query and approved array-profile cases.

## Final verification

| Command suffix after the shared prefix and runtime flags | Result | Log |
| --- | --- | --- |
| `test tests/next-step.test.ts` | 12 pass, 0 fail; 583 assertions; 26.98 s | [resolver](logs/task-3-next-step-final.log) |
| `test tests/capscore.test.ts` | 9 pass, 0 fail; 821 assertions; 8.76 s | [scorer](logs/task-3-capscore-final.log) |
| `test tests/process.test.ts` | 23 pass, 0 fail; 72 assertions; 5.62 s | [process](logs/task-3-process-final.log) |

Each test file finishes within 30 seconds alone. The tests use private repositories, JSON records, and typed executable stubs. Cases with shared mutable state run in sequence. All fixture state is removed.

New files were staged before the final gate. The gate ran with the private tool PATH and npm prefix from `worker-context.md`, plus the same Bun cache/report environment. `scripts/verify.sh` returned 0 and ended `verify: PASS`. See the [final gate log](logs/task-3-gate-final.log). Strict TypeScript, Biome, shell checks, text checks, config checks, and plugin validation pass. Plugin validation has only the known directory submission warnings. No new warning appeared. `git diff --cached --check` also passed.

The full suite is UNRUN, as the task requires. Live host, GitHub, and installation acceptance is UNRUN under the user waiver. No runner was started, and no issue, PR, remote branch, or real host state was changed.

## Baseline and coverage

`docs/superpowers/plans/96-port-map.md` now has 280 Task 3 assertion rows, pinned to `4fe5554`, plus the expanded parameter sets, allowed runtime/path changes, approved schema exception, and caller map. It remains ignored evidence and was not force-added.

The old resolver, scorer, and both shell test files have no diff from `4fe5554`. Every ordinary fixture is sent to both versions. Resolver stdout and stderr match exactly, including JSON formatting. Scorer stdout and exit status match; successful stderr is empty. Error cases retain the asserted status, empty stdout, field or repair detail. Native JSON parser errors replace jq-internal diagnostic text. The array-valued reviewer profile is compared separately under the controller ruling.

Coverage includes all 25 resolver precedence fixtures, all former number/open parity cases, all usage values, config failures, dirty main/lane/subfolder cases, unrelated lanes, live/stale/unrelated/failed-query landing states, large plan comments, multiple pages of every list, first PR selection, mixed CI states, all failed check conclusions, latest effective review per user, all refusal-heading fixtures, closed metadata and window filtering, PR exclusion, and every GitHub read failure.

Scorer coverage includes every built-in score and rejection vector, all original host inputs, obsolete-input guards, explicit/config/env profile order, main-over-lane selection, missing and invalid setup, parent-model mode, all eight three-attempt sequences, reviewer promotion and cap, unavailable effort/model pairs, all missing-value flags, float rejection, STOP-before-lookup, current-model precedence, cwd quote escaping, missing database and failed-query fallback, and command import guards.

Callers remain on the old public entrypoints until Task 9. Task 5 will use the resolver from the runner; Task 6 will use `land.ts`; Task 7 will update the board path. Public basenames, flags, and result shapes stay unchanged. Existing gate classification and TypeScript include rules already cover the new files, so the gate required no source change.

## Self-review and concerns

I read the staged source and tests, checked the source state order and scoring order against the behavior documents, checked process helper callers, and confirmed that no old assertion file changed. New production code has no comments, embedded shell program, jq program, Bun Shell program, new package, or runtime deadline change. The new commands reuse `readConfig`, `ConfigError`, `selectHost`, `mainCheckout`, `commonDir`, `run`, `bunArgs`, and `childEnv`.

The first test fixture parser skipped a nonpaginated endpoint at argument index 0. That fixture error was corrected. An initial native fixture launch made the short EOF regression depend on shebang startup time; the regression now starts its private TypeScript child with `process.execPath` and the existing isolated flags. Its 250 ms deadline did not increase.

The sandbox blocks ps with EPERM. [The initial local diagnostic](logs/task-3-landing-debug.log) records that limit. The final real-process oracle ran through approved `require_escalated` access and passed. Synthetic ownership cases keep typed ps fixtures. Staging also needed approved access to the linked worktree index in the main `.git` directory. There was no automatic approval rejection. No blocked check remains.

There is no unresolved correctness concern. The approved malformed-profile rejection is an intentional behavior correction. Linux runtime acceptance is UNRUN; no claim is made beyond the deterministic local evidence above.

## Review fix 1: reject unsafe numeric inputs

Status: DONE. The Important finding about rounded attempt inputs is fixed. Commit: `cf55153` — `fix(capscore): reject unsafe numeric inputs`.

The review identified `--attempt 9223372036854775808`: `Number()` rounded the value before schema-1 output. The line kept the original decimal text. The old scorer rejected that attempt. The controller ruled that bias and attempt must be JavaScript safe integers: bias 0 through 9007199254740991 and attempt 1 through 9007199254740991, inclusive. The same bias range applies to CAP_EFFORT_BIAS. Oversized values that Bash sometimes accepted now fail. This explicit range is recorded in the ignored assertion map for the Task 9 documentation switch.

Changed `scripts/capscore.ts` and `tests/capscore.test.ts`. The three numeric validation paths in `main()` now also require `Number.isSafeInteger(Number(value))`. Existing decimal syntax checks, lower limits, argument/environment diagnostic text, input precedence, scoring arithmetic, digit range, and STOP order are unchanged. No arbitrary-precision type or serialization path was added.

The new tests cover the exact maximum for both flags and the bias environment input; the first unsafe integer (9007199254740992), the reported overflow (9223372036854775808), and a decimal with 400 nines for all three sources; and a valid explicit bias overriding an invalid environment bias. Every rejected value must return status 2, exact existing stderr, and empty stdout, so no rounded or null numeric field escapes. A private Git trap and invalid host/config/profile data prove rejection before lookup. A valid maximum attempt still returns exact STOP data before lookup.

RED and GREEN command, with output saved to separate logs:

```text
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/capscore.test.ts
```

[Fix 1 RED](logs/task-3-fix-1-red.log): 10 pass, 9 fail; 859 assertions; 10.04 s. All nine unsafe inputs were accepted. The large decimal emitted a null numeric JSON field. The exact-maximum and lookup-order test passed before the fix.

[Fix 1 GREEN](logs/task-3-fix-1-green.log): 19 pass, 0 fail; 868 assertions; 9.61 s. The full scorer file, including all original comparison cases and built-in score vectors, passes. No other production file changed, so no unrelated test file was repeated.

The final gate ran after both files were staged, with the private PATH/npm prefix from `worker-context.md` and the cache/report environment. `scripts/verify.sh` returned 0 and ended `verify: PASS`. See [Fix 1 gate](logs/task-3-fix-1-gate.log). Only the known plugin directory warnings remain. Strict TypeScript, Biome, and `git diff --cached --check` pass.

Self-review checked all Number conversions in the scorer. The digits already reject values outside 0 through 2. The new bias/attempt guards run before scoring and host/config/profile lookup. The ignored map expands all 13 new boundary and precedence obligations and records the intentional bound instead of claiming Bash overflow parity. No old source or assertion was removed, no shared process interface changed, and no runtime deadline changed.

Concerns: none remain. The new upper bound is an approved runtime rule. Full-suite and live acceptance remain UNRUN as instructed. No issue, PR, remote, runner, or host account was changed.
