# Issue #96 verification evidence

Current local result: **DONE** at `b6053743e492dde0624207c90fc3a23cdeeca57a`. V1 PASS. V3 macOS PASS: ten files, 239 cases, zero failures, 2,055 assertions. Controller-provided exact-head CI 39941193404 now passes: all three jobs succeed.

CAP: J2 V1 B2 N1 S2 X1 = 9 +b2 → inherit/max

Same agent; model=null/inherited, effort=max, attempt=1; no subagents.
Checkout: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`; branch `feat/96-intent-the-whole-toolchain`.
Final source capture: 2026-10-23T10:47:11.255416+00:00; exact HEAD/branch, clean tracked state, all 224 byte/mode records unchanged. All tracked-source reads ended at that capture.
OS: macOS 26.4.1 (25E253), Darwin 25.4.0, arm64. Private Bun `1.4.2+744846f84` at `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun`. Observed CLIs: Codex 0.163.0, private Claude 2.1.302, gh 2.102.1, herdr 0.9.3; version reads are not live acceptance.

| Scenario | Status | Evidence/reason |
| --- | --- | --- |
| V1 | PASS | Two new clean exact-HEAD copies; all eight bytes/modes equal and unchanged from 7d9366d; source check/gate preserve 224 tracked records; separate corruption refusal does not repair. Fresh gate 1.213715 s, verify: PASS. Actual closure 224 paths/113 TS/52 automatic/696 focused rows/82 host locations/323 named replacements; zero live removed-path callers. |
| V2 | UNRUN | User: ignore live checks. |
| V3 macOS | PASS | All current nine process entries plus celetis-flow; effective default one worker; all under 30 s; 239 cases/2055 assertions; no owned survivor. |
| V3 Linux | PASS from CI provider | Exact-head run 39941193404: ubuntu-24.04 process job, nine entries/169 cases; no local inference. |
| V4 | UNRUN | User: ignore live checks. |
| V5 | UNRUN | User: ignore live checks. |
| V6 | UNRUN | User: ignore live checks. |

| Entry | Exit | Seconds | Cases | Assertions | Owned after | Scratch items |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `board/realpath.test.ts` | 0 | 0.839 | 3 | 8 | 0 | 0 |
| `tests/process.test.ts` | 0 | 4.812 | 29 | 91 | 0 | 0 |
| `tests/runner-lock.test.ts` | 0 | 11.257 | 23 | 160 | 0 | 3 |
| `tests/runner-lifecycle.test.ts` | 0 | 13.317 | 26 | 228 | 0 | 0 |
| `tests/runner-startup.test.ts` | 0 | 5.092 | 6 | 54 | 0 | 0 |
| `tests/host-session.test.ts` | 0 | 5.097 | 26 | 215 | 0 | 0 |
| `tests/host-observation.test.ts` | 0 | 6.165 | 16 | 120 | 0 | 0 |
| `tests/host-identity.test.ts` | 0 | 9.149 | 24 | 204 | 0 | 0 |
| `tests/host-resume.test.ts` | 0 | 4.845 | 16 | 315 | 0 | 0 |
| `tests/celetis-flow.test.ts` | 0 | 19.891 | 70 | 660 | 0 | 0 |

Prior history stays visible: initial lifecycle cutoff at 30.104 s/status 124 on fc773596; local PASS at d658ce09; CI 39930716439 FAIL; actual unsplit host cutoff at 30.110 s/status 124 with 26 passes/five case timeouts/eight retained fixture folders; local 7d9366d V1/nine process PASS but auto FAIL (26.069 s, 69/1); CI 39937967098 full-suite FAIL in board-agent shadow-Bun identity and the fixed 5 s auto wait. Those past results are not rewritten as current PASS. Task 5/8 test-order gaps remain. The three-line second repair and its approved review are separate evidence.

All setup/probe errors remain in report/history, including the second repair's unanchored inventory separator error and this verifier's greedy elapsed-time parser error. Only the private name parser was corrected; no test/source retry ran. The corrected parser checks all 70 exact flow names, 26 lifecycle names and 82 host name/location pairs from saved current logs. Raw tests remained 239 pass/0 fail. Current source snapshot completed before that bookkeeping error.

Exact primary commands, cwd=the bound checkout:

```sh
python3 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1/v1-proof.py
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1/v1-tree-proof.ts
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1/v3-proof.ts
```

Python is private V1 orchestration, not a product runtime/dependency. Every product build/check/gate uses selected Bun, both fixed environment controls, private tools/bin first and all four flags. Exact V1 argv/cwd/status/time: `commands-v1.json`. V3 imports current processEntries plus flow, uses one file per call with the effective default one worker and unchanged 30 s file bound. Native test.serial for only the auto case remains. Pools/waits/25 s case limits remain unchanged. Authorized ps/loopback escalation succeeded; no approval rejection occurred. Only task-owned process rows are saved.

Current raw logs: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1/logs/`.
Proof/manifests/name checks/final source capture: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1/proof/`.
Complete report: `.superpowers/sdd/96/final-verify-report.md`.
Reusable drivers and private-publication index: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1/proof-manifest.json`.
Historical reports/errors and prior manifest links: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1/history/`.

Every current post-entry owned-process table is empty. Nine entries have empty scratch; lock tests retain one capture directory with two zero-byte files. Historical forced-cutoff scratch remains recorded without a cleanup PASS.

No local full suite, live/token/browser/native-loader acceptance, source/test/index/HEAD edit, install, external mutation, push, issue edit or Land ran. Controller-provided current-head CI and Linux full-suite proof now pass. Current-build cutover report remains required before merge. V2/V4/V5/V6 stay UNRUN.

Controller-provided current-head CI: [run 39941193404](https://github.com/ddinkov10/celetis/actions/runs/39941193404), head b6053743e492dde0624207c90fc3a23cdeeca57a, conclusion SUCCESS. All three jobs succeed. Linux full suite: 52 files/1851 cases/13924 reported expect() calls/zero failures, max file 27.477 s (celetis-flow). Gate verify:PASS and suite:PASS. Linux/macOS process jobs each pass 169 cases across nine entries. Raw/sanitized logs and metadata are in the private proof ci/ directory, with provenance in proof/controller-ci-summary.json. Bun 1.4.2 (744846f84). No local full suite was run. Prior CI/local failures remain recorded. The current-build cutover report remains required before merge.
