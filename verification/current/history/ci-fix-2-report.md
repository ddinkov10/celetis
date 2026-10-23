# Issue #96 second CI repair

Status: **DONE**. Commit `b6053743e492dde0624207c90fc3a23cdeeca57a`. BASE `7d9366d5ee04b879bcb75d9a7a91cafb654a3118`. New-head CI remains for the controller.

Bound checkout: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`; branch `feat/96-intent-the-whole-toolchain`. The first command confirmed the exact path, branch, HEAD and empty tracked status. The CI brief, current AGENTS.md, worker context, global constraints and systematic-debugging skill were read. No subagent ran. CAP J2 V1 B2 N2 S2 X2 = 11 +b2 → inherit/max; actual null/inherited model, max effort, attempt 1.

The source-edit hold was honored. The controller cleared edits only after the verifier had captured exact BASE, clean status and all 224 tracked byte/mode records unchanged at `2026-10-23T10:22:09.374770Z`. Initial diagnosis changed only ignored evidence and private copies.

## Actual current-head RED

The complete sanitized log `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/ci-second-test-clean.log` was read. Original `ci-second-test.log` remains beside it. Workflow `39937967098` tests merge commit `a22869afc6fa1fc7021ae526cb8df00e9349f1a7`, which contains BASE. Both Linux/macOS process subsets pass 169 cases across nine entries. The fast gate passes. The full Linux suite has exactly these two failed files; all other 50 automatic entries pass. No unchanged workflow retry or local full suite runs in this task.

| Actual failed boundary | Decisive output |
| --- | --- |
| `tests/board-agent.test.ts`, shadow-Bun case | Run #6 and #7 complete, Run #8 Codex ends before a saved turn has verified identity; expected status `0`, actual `1`; startup/trust diagnostic remains. File 5 pass / 1 fail, 8.634 s. |
| `tests/celetis-flow.test.ts`, ordered auto selection | Fixed 5 s wait misses `no auto step can start`; output has plan #7, implement #7, no progress implement #7, plan #8; stderr empty. File 69 pass / 1 fail, 649 assertions, 18.945 s. |

Current local macOS RED is independent evidence: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci-head.3jyqlkwu/logs/v3-tests_celetis-flow.test.ts.log`. It has the same auto failure, 69 pass / 1 fail, 649 assertions, 26.069 s. Its output reaches no-progress implement #7 but not the no-auto line. All nine process entries and all four host groups pass; owned-process and failed-flow scratch captures are empty. The previous isolated 2.991 s auto result did not close this boundary.

## Runtime and private diagnostics

Every Bun call uses cache/report controls, the private task9 tools prefix and all four isolation flags. Exact prefix:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros
```

Raw new logs and private drivers are in `.superpowers/sdd/96/ci-fix-2-logs/`. `probe.ts` creates private copies, preserves real commands, HTTP, terminal execution and original assertions, uses the existing runJobs mechanism and unchanged 30000 ms file deadline, and checks actual process/scratch cleanup. No user runtime or tool is replaced. Escalated owned-process/loopback checks are authorized; no approval rejection occurred.

## Board fixture ordering proof before correction

The fixture's host startup clears settled/exit/wait/prior markers but keeps `observed` from an older session. A later first live `herdr agent get` sees that stale marker and sets `settled`. The fake foreground then exits. Codex's real thread/read and turns/list calls have not yet completed, so the product correctly refuses its unverified identity.

`probe.ts board` adds a bounded 100 ms delay to the actual Codex herdr reply, preserving its exact response/status and the real terminal. It deterministically reproduces the exact CI startup failure in 7.937 s. Trace:

- Run #6 starts with observed false.
- Run #7 starts with observed true from the prior Run.
- Run #8 Codex starts at 1792751265033 ms with observed true. Its first get is at 1792751265035 ms; it exits at 1792751265048 ms, only 13 ms later.
- No thread/read or thread/turns/list RPC follows Run #8 startup. The terminal returns 1 and the genuine startup diagnostic prints.

The private proof has no owned process or scratch left afterward. Log: `board-red-probe.log`. Before production changes, the controller approved clearing only `observed` in the existing per-session reset list, retaining the delayed real reply regression and every identity/terminal assertion. No product identity rule or diagnostic is to change.

## Automatic case workload evidence before correction

The named-load probe selects the ordered auto case with its original installed/gate/chain/checkout peers. It runs 21 actual cases under the same pool of eight. The auto wait takes 4703 ms, with the complete unchanged sequence; all 21 pass in 10.999 s. This result has only 297 ms of margin under the fixed 5 s wait. It is diagnostic evidence, not a replacement for the actual Linux/macOS RED. No owned process or scratch remains. Log: `flow-load-probe.log`.

The controlled `probe.ts flow-serial` changes only this case to Bun's native test.serial scheduling. The pinned bun-types Test interface documents this existing primitive. Its fixed wait completes in 2134 ms and all 21 cases / 164 assertions pass, file 9.863 s, with no owned process or scratch left. No fixture pool or default changes. Both measured variants pass: these are allocation evidence, not fabricated RED. The actual full-file Linux/macOS failures remain the RED. Before tracked edits, the controller approved only this case's concurrent-to-serial registration change. Its cost is exclusive file time for this one case; all 70 names/bodies and file layout stay intact.

## Complete board RED, correction and retained contracts

The private `probe.ts board-clear` changes only the existing reset list to include observed. The delayed shadow-Bun case then passes every original Run/Resume assertion, 8.787 s, with empty owned-process and scratch checks. Its corrected trace starts Codex with observed false, receives the first live get, performs thread/read at 1792751387098 ms and thread/turns/list at 1792751387121 ms, and exits afterward at 1792751387186 ms. This confirms the observation belongs to the current session and the saved-turn RPCs can finish.

The actual tracked regression is strengthened before the shared fixture change. Its real herdr bridge captures the original child's output/status, retains inherited stdin, delays only the actual Codex agent-get reply by 100 ms, and writes the exact stdout/stderr back. It still executes the real helper, board HTTP routes, copied launcher, selected Bun and terminal command. No execution boundary is replaced with a mock.

Exact complete RED command, from the bound checkout:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros .superpowers/sdd/96/ci-fix-logs/focused.ts 1 tests/board-agent.test.ts
```

Result: **4 pass / 2 fail**, 102 expect calls, code 1, 15.815 s, timedOut false. Both absent/shadow variants fail at the existing Run #8 completion assertion with the exact startup/trust diagnostic. Log: `ci-fix-2-logs/board-red.log`. Only then does `tests/lib/runner-fixture.ts:hostSource` add observed to the existing startup reset list.

The correction changes no product source, identity rule, diagnostic, executable validation, producer schema, argument vector, saved-host/UUID check, signal/lock rule, output limit or timeout. It clears stale test-session state. The one automatic case uses the existing native serial primitive; the pool of eight and one-file suite default stay intact. No configuration knob, fallback or scheduling framework is added. No new ADR is needed for these routine test corrections.

## Complete covering GREEN and preservation

The covering driver runs only the two changed complete entries and the complete lifecycle entry. The latter covers the shared marker's real sequential handoffs and foreground/identity/signal/lock behavior. The other current-CI passing entries are not repeated locally. Each call specifies one file, uses suite's one-file default, the same test flags, unchanged case limits and a 30000 ms file deadline. It captures real owned processes every 500 ms and checks the private temporary directory after each file.

Exact GREEN command:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros .superpowers/sdd/96/ci-fix-2-logs/green.ts
```

| Complete covering entry | Cases / assertions | File-runner time | Result |
| --- | ---: | ---: | --- |
| tests/board-agent.test.ts | 6 / 148 | 17.791 s | PASS |
| tests/celetis-flow.test.ts | 70 / 660 | 20.145 s | PASS |
| tests/runner-lifecycle.test.ts | 26 / 228 | 13.273 s | PASS |

Total: **102 cases / 1036 assertions PASS**. Every file reports code 0, timedOut false, no owned process and empty scratch. Per-file logs, JSON timings and real process tables are `tests_<file>.log`, `.json` and `-processes.log` in the new log directory. `green-driver.log` holds the complete summary. The startup diagnostic was exposed in RED and remains available; no error was suppressed.

`source-preservation.json` reverses only the three approved substitutions and compares exact bytes with BASE: the board bridge's bounded reply delay, the one scheduling modifier and the one reset item. All checks pass. Thus all old assertions, expanded parameters and waits remain. `case-inventory.json` compares complete expanded names with the actual current-head CI: 6 / 70 / 26, no missing name or duplicate. The first private inventory extractor stopped because an unanchored separator matched the failed assertion's !== operator before its case line; `inventory-setup-error.txt` keeps that bookkeeping error. The corrected extractor anchors entry headers and reads all original names. No inventory PASS was inferred from a partial read.

## Gate and generated delivery

The three existing files are staged before the fast gate. No new automatic entry or classification role is needed. Exact gate command:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

Result: code 0, final line **verify: PASS**. Log: `ci-fix-2-logs/gate.log`. Existing unversioned-manifest and managed-hook notices remain; no new warning appears. The gate checks formatting, strict runtime/browser/native types, native actionlint, configuration, text, plugin metadata and exact generated bytes/modes.

All eight generated outputs compare directly byte-for-byte with BASE and keep their modes. `scripts/celetis` stays 222631 bytes, mode 0755, SHA-256 `4b5d8b0c0ccd9c639925136f64eebee9c6677f659242375b85b339aaacc77918`. All seven other outputs stay mode 0644. No generator source or product import graph changed, so no regeneration was needed. `generated-before.json`, `generated-after.json` and `generated-proof.json` record the manifests and direct comparisons; the gate's pinned build --check also passes.

## Map, callers and self-review

The ignored port map has the second-CI repair section at its end. It records both expanded board runtime-path cases, the unchanged auto case, the lifecycle covering group, and these callers: board real herdr bridge → actual helper response → selected-Bun terminal; runner fixture hostSource → current-session marker reset; flow registration → native test.serial; lifecycle handoffs → the same runner fixture. Existing case locations stay valid. Current counts remain 52 automatic entries and 696 focused map rows.

Self-review checked the three-line staged diff, exact source reversals and expanded names, fixed waits and all deadlines, real terminal/identity execution, selected Bun/environment/argv, complete Run/Resume assertions, inherited stdin and exact stdout/stderr replay, genuine failure diagnostics, shared handoff behavior, process/scratch cleanup, unchanged generated delivery and the passing gate. No comment, product source, live instruction, historical ADR, public contract or other product changed.

The remaining concern is current-head CI timing on Linux; the controller owns the next push and workflow. Prior CI PASS results remain evidence for BASE only. The actual host/browser/native-loader/token checks remain UNRUN under the waiver. No local full suite, subagent, live check, external issue/PR mutation, push or Land ran in this task.

Final binding: HEAD `b6053743e492dde0624207c90fc3a23cdeeca57a`, branch `feat/96-intent-the-whole-toolchain`, empty tracked status. Commit subject: `test(runner): reset session observations and isolate timed auto work`. Only the three approved test files are committed, with three insertions and three deletions. This report, port map and raw diagnostics remain ignored evidence; none was force-added.
