# Issue #96 CI repair

Status: **DONE**. Commit `7d9366d5ee04b879bcb75d9a7a91cafb654a3118`. BASE `d658ce09ab8d1cc68a02a761efed3c3d2bea3a0b`. Current-head Linux CI remains pending for the controller.

CAP: J2 V1 B2 N2 S2 X2 = 11 +b2 → inherit/max. Actual binding: null/inherited model, max effort, attempt 1. The controller keeps review, final verification and the next CI push.

Binding: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`, branch `feat/96-intent-the-whole-toolchain`. The first command confirmed this path, branch, HEAD and an empty tracked status. The current AGENTS.md, CI repair brief, global constraints and systematic-debugging skill were read. No subagent ran.

## Supplied CI RED

Both full sanitized logs were read: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/ci-macos-clean.log` and `ci-test-clean.log`. Original downloads remain beside them. Workflow `39930716439` on draft PR 108 checked merge commit `ef13a281099321c90f5897fa6a797220c73a559e`, which contains the fix BASE. Linux process subset passed. macOS process subset and Linux full suite failed. The gate passed. This is not CI green, and no landing ran.

| Failed boundary | Actual CI result |
| --- | --- |
| macOS host-session, `codex_only and launcher_resume use the saved host with no Claude and ignore obsolete Git defaults` | code 0; stderr `The operation was aborted`; 79 other cases passed |
| Linux flow, `auto selects ordered auto gates, reloads lists, records rows and keeps inherited stdin` | the unchanged 5-second output wait ended after plan and implement started; no stderr |
| Linux host-session | file code 124 at 30.126 s; 78 case passes printed; no file completion |
| Linux land-checks | file code 124 at 30.131 s; four unchanged 25-second case limits ended |
| Linux launcher, `Resume reads the exact Git common directory` | code 128; original assertion did not print stderr |
| Linux startup, `registration codex auto starts only after both refs commit` | `started-1` wait ended after the plan-start line; five other cases passed |

The four land cases are `checks_not_green/checks_none/checks_pending: `, `checks_not_green/checks_none/checks_pending: pending pass`, `status_pending/checks_not_green: pending` and `gh_call_fails: status`. They cover sixty real polling rounds; their assertions and 25-second limit remain requirements.

## Environment and commands

Pinned Bun: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun` (1.4.2, revision 744846f84). Private tools prefix: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools`. User tools were not replaced.

Every Bun command below starts with this exact prefix, from the bound checkout:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros
```

Raw logs and private drivers are in `.superpowers/sdd/96/ci-fix-logs/`. The focused driver uses the existing `runJobs`, selected Bun, the four isolation flags, `test --timeout 29000`, and a 30000 ms file deadline. Real process checks use authorized escalation. No approval rejection occurred.

## Root cause evidence before implementation

`focused.ts 1 'tests/host-session.test.ts=successful .* foreground exit cancels'` returns 1 in 1.972 s: two new real-runner cases fail with exact stderr `The operation was aborted` after successful foreground exit. Each case holds the foreground, waits for the actual watcher resolver to start, then ends the foreground. It does not depend on the original timing race. The expected exit code remains 0 and expected stderr remains empty. Log: `watcher-red.log`.

`focused.ts 1 'tests/launcher.test.ts=Resume reads the exact Git common directory'` returns 1 in 0.239 s. Adding only the stderr assertion message exposes `fatal: not a git repository (or any of the parent directories): .git` and code 128. Log: `common-dir-red.log`.

`causes.ts` captures the native callback: `AbortError`, code `ABORT_ERR`, message `The operation was aborted`, child stdout `ready\n`, child stderr empty. The foreground-exit watcher abort causes this expected cancellation. `run()` synthesizes the error message as stderr, and `resolve()` prints it. The callback output is distinct from actual child stderr. The same driver runs real Git against a separate Git directory: query from the original cwd returns the exact `shared/control`; query from its derived parent returns 128 and the exact fatal stderr. Log: `causes.log`.

The launcher already resolves the correct common directory, but `selectSavedSession` calls `readSession`, which repeats Git discovery from `dirname(common)`. That directory need not contain a Git marker. Proposed correction: carry the already resolved common directory through the existing typed reader. Keep record validation, checkout equality, saved host, UUID and sorted handoff intact.

Proposed cancellation correction: omit only the synthetic `ABORT_ERR` diagnostic for explicit cancellation. Preserve actual child stderr, including text equal to the abort message, plus every unrelated error. Shared-helper regression cases precede that implementation.

## Work allocation measurements before implementation

These are targeted failed-file measurements, not a local full suite or unchanged retries for a lucky result. The same land-checks file and unchanged 80 host-session cases run once with two file workers and once with one. The new deterministic cancellation cases are filtered out because they are separately known RED.

| Driver arguments | land-checks | host-session | Result |
| --- | ---: | ---: | --- |
| `focused.ts 2 tests/land-checks.test.ts 'tests/host-session.test.ts=^(?!successful )'` | 23.541 s | 29.658 s | 36 / 80 pass; `overlap-two.log` |
| `focused.ts 1 tests/land-checks.test.ts 'tests/host-session.test.ts=^(?!successful )'` | 15.052 s | 22.138 s | 36 / 80 pass; `separate-one.log` |

macOS reports eight available cores. File isolation reduces these per-file times by 36% and 25%. Linux CI has broad process-throughput slowdown, sixty-poll cases at their case limit, and unrelated fixed-wait cases that have already started their expected work. This supports separating process-heavy file workers before changing any product protocol. The proposed default is one suite file worker, with existing per-file concurrency and every wait/timeout unchanged. The controller must rule on that allocation before implementation. The proposed ADR-0025 is unmerged; no landed ADR will be edited.

## Phase diagnostics and approved allocation

The controller approved the default of one file worker as Ruling 16 before implementation. Explicit worker support, the pool of eight runner fixtures, the pool of eight landing fixtures, every fixed wait and all existing 25-second/30-second limits stay intact. Proposed ADR-0025 records the decision and cost. The architecture decision skill's own Codex Host entry was completed with native metadata and one whole active-checkout config read. There was no custom addition. The store README and template were read. This changes the unmerged proposal only; no landed ADR or unrelated acceptance state changed.

One private diagnostic copy selected the failed automatic case, two registration cases and four long landing cases. It added timestamps and counters only. The case bodies, assertions and waits stayed intact. `phases.ts` first failed to import the flow copy's relative board module; no flow case executed. That setup failure stays in `phases.log`. After the private import paths were fixed, `phases.ts flow.test.ts` ran only the previously unexecuted flow probe, with output in `phases-flow.log`. No completed case was rerun for a lucky result.

| Phase | Observed result before production changes |
| --- | --- |
| Automatic ordered three-session sequence | Fixed `no auto step can start` wait completes in 2146.278 ms; all old exact stdout, stdin, order, no-progress rows and lock checks pass; complete case file 2.991 s. |
| Registration package copy / repository setup | 7.079–7.719 ms / 87.240–87.651 ms. |
| First registration transaction, Claude / Codex | 2020.690 / 2128.183 ms; foreground has not started before registration. |
| Second verified saved session, Claude / Codex | 3191.097 / 3459.630 ms. |
| Registration lock recovery, Claude / Codex | 3686.994 / 4134.885 ms; both old cases pass, file 4.389 s. |
| Four long landing cases | Each completes all 60 polls and 183 real gh calls; bodies 5.636–6.122 s, gh command spans 5.109–5.171 s; all unchanged refusal/retention assertions pass; file 6.477 s. |

Both private phase groups finish with empty private scratch and no owned processes. These results establish protocol progress and unchanged oracles in isolation on macOS. They do not prove Linux timing causality. The CI logs, the controlled two-file/one-file measurements and these command phases support the scheduling diagnosis. New-head Linux CI must validate it.

## Complete regression RED and narrow runtime correction

The new `tests/process.test.ts` cases cover empty stderr, a real warning, and literal child text `The operation was aborted\n`. The first diagnostic expected immediate process death after the abort callback; native execFile resolves that callback before the child exit is observed. `cancellation-red.log` retains that fixture-check error. The final pre-fix version waits up to three seconds for actual child death, without changing any old test limit. In `cancellation-red-final.log`, the warning and literal-text cases pass; only empty stderr fails because synthetic abort metadata was added. This is the meaningful shared-helper RED: 2 pass, 1 fail, 0.240 s.

The new effective-default case starts two real test-file processes that use the same exclusive resource. Before the default change, the second file gets EEXIST. `allocation-red.log` records 1 fail in 0.443 s. It tests the effective file-worker default, while the existing explicit worker-count, child failure, deadline and signal cases remain.

The production changes are small:

- `run()` keeps nonzero cancellation status and actual child stderr. Its synthetic diagnostic excludes only code `ABORT_ERR`; missing executables, byte-limit errors, timeout status and unrelated failures keep their existing behavior.
- `launcher.ts:resume()` passes its already resolved common directory through `selectSavedSession()` to `readSession()`. Other reader callers retain their current main-checkout discovery. The same validator checks every field and exact checkout; saved host, UUID and sorted discovery snapshot stay intact.
- `suite()` defaults to one file worker. Its explicit worker parameter and generic `runJobs()` behavior stay intact.

`causes-green.log` records all three process cases, both real watcher cases and the effective-default case passing after these changes. The full launcher entry later passes all 67 cases, including the existing exact-common-directory test that was RED. Its original assertion now includes actual stderr only as the failure message.

## Actual standalone cutoff and second approved allocation

The first covering driver runs each file alone with the new default and real process samples every 500 ms. Process, pool and launcher files pass. The then-unsplit 82-case host file reaches code 124 at 30.110 s. It prints **26 passes and five 25-second case timeouts**. This is a new actual failure; it was not erased or retried unchanged. Logs: `after-initial-driver.log`, `pre-split_tests_host-session.test.ts.log` and its matching JSON/process log.

Eight admitted fixture folders remain at the cutoff. Their state and real process rows show work in package discovery, plugin updates and session-start/identity reads, with no protocol refusal. Six fixtures can be identified from their markers: prior_host Claude/Codex, old_session Claude/Codex, old_pane_identity Claude and project_default Claude. Two other fixtures have no unique case marker; their case names cannot be proved from the captured state. Later identity, exact-Resume and new cancellation groups have no fixture state. The five timeout lines alone do not show whether a particular callback was running or queued. This distinction is retained, rather than assigning every timeout to its body.

The private `queue-clock.test.ts` probe uses the same await-before-admission pattern with a short native test clock. First is admitted at 5.905 ms and releases at 91.164 ms; second entered at 9.388 ms but waits until 91.619 ms; third remains queued. Both second and third time out at their 150 ms case limit, and third is never admitted. Thus Bun's case clock includes fixture-queue time. This probe is runtime-mechanism evidence, not a product RED or a change to the required 25-second clock. Log: `queue-clock.log`.

The bounded `launch-probe.ts` creates fresh private executable stubs. Their real shebang execution costs 591.214/405.858 ms; the same selected Bun and isolated arguments with direct execution cost 15.622/18.673 ms. This observation supports workload sensitivity. The public executable and real stub boundaries remain unchanged. No Bash fallback, new launcher wrapper or runtime shortcut was added.

The group cutoff leaves **no owned process**, but eight private fixture folders remain because the file was forcibly stopped. Their exact state is retained in `standalone-cutoff-state.json` and the original scratch tree; no cleanup PASS is claimed for that failed file.

Before layout changes, the controller approved four natural concern groups:

| Current file | Case allocation | Cases / assertions |
| --- | --- | ---: |
| tests/host-session.test.ts | Launch, unmanaged use, recovery, startup failure, existing instructions and invalid config | 26 / 215 |
| tests/host-observation.test.ts | Saved statuses, valid panes, prior hosts, old sessions and old pane identity | 16 / 120 |
| tests/host-identity.test.ts | Identity refusals, Codex persistence, identity deadline and watcher cancellation | 24 / 204 |
| tests/host-resume.test.ts | Exact Resume, changed/malformed records, obsolete rows, Codex-only use, project defaults and invalid panes | 16 / 315 |

Only existing `managed`, `hosts`, `resumeArgs` and `saved` moved to `tests/lib/host-session-fixture.ts`. The runner fixture and its pool of eight are unchanged. The new entries are in processEntries and discovery checks. Cost: three extra automatic files and shared helper imports. Every old case body, expanded parameter, wait and assertion remains.

`host-session-before-split.ts` and `host-session-split-blocks.json` hold the exact pre-split source and original blocks. The initial source-preservation probe tried to load the JavaScript API absent from the pinned TypeScript CLI-only package; `preserve-initial.log` retains that setup error. No package was installed. The corrected proof uses the available pinned Bun.Transpiler: each original/current group and the shared helpers have identical compiled code, and all 22 registration forms/names match. `host-session-source-preservation.json` records all checks true. `host-session-case-inventory.json` independently compares all 80 supplied CI case names plus the two new regressions with all 82 completed names: no missing name or duplicate. The assertion sum is 854, exactly the passing original 836 plus 18 new watcher assertions.

Before the split, `assertion-preservation.json` also proves the original process, parallel and host case code is byte-identical after removing the added test blocks. The launcher change is only its stderr failure message. The later discovery additions and erased concrete result type add checks and type information only.

## Final covering checks

The initial `after.ts` driver stopped on the actual unsplit host failure. Its final version runs only the amended split files and the remaining covering entries; completed unrelated files are not rerun. Each suite call specifies exactly one file and uses the new default, `test --timeout 29000`, the existing 25-second case defaults where present, and the unchanged 30000 ms file deadline. The last landing check selects only the two real interrupted-cleanup cases to cover the shared cancellation helper.

Exact covering commands, with raw logs separate:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros .superpowers/sdd/96/ci-fix-logs/after.ts
```

| Covering entry | Cases / assertions | File-runner time | Result |
| --- | ---: | ---: | --- |
| tests/process.test.ts | 29 / 91 | 13.899 s | PASS; original initial-driver result |
| tests/launcher.test.ts | 67 / 393 | 17.987 s | PASS; original initial-driver result |
| tests/host-session.test.ts | 26 / 215 | 6.186 s | PASS |
| tests/host-observation.test.ts | 16 / 120 | 7.593 s | PASS |
| tests/host-identity.test.ts | 24 / 204 | 10.831 s | PASS |
| tests/host-resume.test.ts | 16 / 315 | 6.376 s | PASS |
| tests/parallel.test.ts | 11 / 54 | 4.098 s | PASS |
| tests/celetis-flow.test.ts | 70 / 660 | 21.818 s | PASS |
| tests/runner-startup.test.ts | 6 / 54 | 7.248 s | PASS |
| tests/land-checks.test.ts | 36 / 755 | 18.781 s | PASS |
| tests/land-pr.test.ts, interrupted cleanup only | 2 / 66 | 2.864 s | PASS |

Total: **303 covering cases, 2927 assertions**, with zero failures and every file below 30 seconds. Each passing entry has `timedOut:false`, an empty captured owned-process table, and empty private temporary state after completion. Per-entry logs, JSON results and real process tables are named `tests_<entry>.log`, `.json` and `-processes.log`. Summaries are in `after-initial-driver.log` and `after-split-driver.log`. These are focused checks of 11 entries out of the current 52, not the full suite.

The first worker gate fails only the new default test's implicit-any suite result. `gate-initial.log` retains TS7006/TS2769 and shows all other gate phases passing. The erased result type now uses the existing JobResult type. Only its effective-default case is rerun: `focused.ts 1 'tests/parallel.test.ts=suite default runs one file worker'`, 1 pass, 3 assertions, 0.823 s, followed by the gate. Log: `allocation-final-green.log`.

## Generation and final fast gate

New files were staged before discovery and the gate. Only the pinned generator writes delivery:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

Build returns 0 with empty output. The final gate returns 0 and ends **verify: PASS**. Log: `gate.log`. It checks 133 source files, strict runtime/browser/native types, exact generated bytes/modes, formatting, workflow, config, text and plugin metadata. Existing unversioned-manifest and managed-hook notices remain.

The generated `scripts/celetis` grows from 222559 to 222631 bytes, keeps mode 0755, and has SHA-256 `4b5d8b0c0ccd9c639925136f64eebee9c6677f659242375b85b339aaacc77918`. The seven browser/native outputs keep exact prior bytes and mode 0644. Manifests: `generated-before.json` / `generated-after.json`. No generated file was hand-edited.

## Callers, map and self-review

`docs/superpowers/plans/96-port-map.md` now has six new expanded regression rows, all 82 current host-case locations, the shared helper, every affected runtime/suite/build caller, 696 focused case rows and 52 automatic entries. Its top note explicitly resolves every earlier host-session replacement row through the current relocation table. The old assertion/caller data and frozen baseline results stay unchanged.

Affected callers are launcher Resume → selected common directory → existing typed session reader/validator; flow watcher resolve/herdr → run capture; land Git/API and worktree signal calls → the same capture helper; the full/process CI suite and default-allocation test → one file worker; all four host entries → one existing helper extraction and runner pool; pinned build → copied launcher delivery. The matching covering checks are listed above and in the map.

Self-review checked the staged source diff, unchanged record validation, cancellation-only metadata condition, exact real stderr tests, selected Bun/argv/isolation, private PATH/no-Node coverage in the existing launcher/gate paths, fixed waits/deadlines, all source-block/name comparisons, process/scratch cleanup, generated manifests, and tracked-file discovery. No source comment was added. No public/stub execution boundary, board producer, live instruction or other product was changed. No fallback or new configuration knob was added.

The remaining concern is platform timing: all new-head evidence here is local macOS. The earlier Linux process subset PASS remains historical, and the current-head Linux CI must prove the new serial/default and file allocation. Total suite time increases. The actual host/browser/native-loader/token checks remain UNRUN under the user's waiver. The multibyte cap and other declined review items remain outside this task. No local full suite, PR edit, push, issue mutation, Land or other-product edit ran.

Final binding check: HEAD is `7d9366d5ee04b879bcb75d9a7a91cafb654a3118`, branch `feat/96-intent-the-whole-toolchain`, with empty tracked status. Commit subject: `fix(toolchain): preserve session output and bound CI checks`. The 14 scoped files are committed. This report, the map and raw diagnostics stay as ignored evidence; none was force-added.
