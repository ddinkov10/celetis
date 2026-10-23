### Spec Compliance

- ✅ Spec compliant for the second scoped CI/Verify repair. The three changed test lines reset the current session's observation marker, retain a deterministic delay on the real Codex herdr reply, and use native serial scheduling for only the named automatic case. No product program, identity rule, diagnostic, old assertion or timeout changes.
- Binding checked: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`, branch `feat/96-intent-the-whole-toolchain`, HEAD `b6053743e492dde0624207c90fc3a23cdeeca57a`. The complete 6,221-byte package from base `7d9366d5ee04b879bcb75d9a7a91cafb654a3118` was read once. The prior broad review and first CI review were not repeated.
- ⚠️ Cannot verify: new-head Linux timing and full-suite acceptance. The local correction evidence is macOS. The earlier process-subset results and 50 passing files apply to BASE. New-head CI must settle the two failed Linux boundaries.
- ⚠️ Cannot verify: new-head controller Final Verify and total full-suite behavior. No full suite ran in this review.
- ⚠️ Live host, browser, native-loader and token checks remain UNRUN under the waiver. Current-build cutover, publication and Land remain controller gates.

### Strengths

- **The reset matches the fixture protocol.** `tests/lib/runner-fixture.ts:134` adds only `observed` to the existing startup reset list, before the new foreground becomes live. The unchanged herdr helper sets `observed` on its first live get and uses a later observation to release `settled`. A marker from an older session can therefore release the new foreground before its identity is verified. Clearing that per-session marker fixes the fixture instead of changing the product's correct refusal.
- **The evidence proves the ordering defect.** The retained `ci-fix-2-logs/board-red-probe.log` starts Codex with `observed:true`, records its first live get, and records exit 13 ms later with no following thread-read or turns-list RPC. The corrected trace in `board-clear-probe.log` starts with `observed:false`, completes `thread/read` and `thread/turns/list`, then exits. The startup diagnostic remains in the complete tracked RED: 4 pass, 2 fail, code 1, no timeout (`ci-fix-2-logs/board-red.log`).
- **The regression keeps real execution and strict checks.** `tests/board-agent.test.ts:199` still executes the original herdr helper. It inherits stdin, captures its actual stdout/stderr and status, delays only a Codex agent-get reply by 100 ms, then returns those results. The real HTTP routes, selected-Bun terminal command and copied launcher remain. The case retains the selected executable/environment/flags, both Run agents, unchanged YAML and Git values, saved UUID and exact saved-host Resume, wrong-Bun refusal and process cleanup assertions (`tests/board-agent.test.ts:146`, `:256`, `:315`, `:337`, `:364`).
- **The allocation change is narrow.** `tests/celetis-flow.test.ts:341` changes only the named three-session case from `test.concurrent` to `test.serial`. Its body and fixed five-second wait are unchanged; other cases still use the existing pool. The controlled 21-case/164-assertion runs have the same names and output sequence. Their automatic wait changes from 4703 ms to 2134 ms. Both controlled runs pass, and the report correctly keeps them as allocation evidence. The actual Linux CI and macOS V3 failures remain the RED.
- **Preservation is direct.** Independently reversed each single changed line and matched the base hashes in `ci-fix-2-logs/source-preservation.json`. This retains all old case bodies, parameters, waits and assertions. Independently compared the actual CI names, complete GREEN names and inventory: board 6, flow 70 and lifecycle 26, with no missing or duplicate name.
- **The shared reset has covering results.** The complete board, flow and lifecycle files pass 102 cases and 1036 assertions. Their file times are 17.791, 20.145 and 13.273 seconds, all below 30 seconds. Each result has `timedOut:false`, no owned process and empty private scratch (`ci-fix-2-logs/green-driver.log`). The complete lifecycle file covers the shared helper's sequential session handoffs.
- **Delivery and map agree.** All eight generated manifests are identical before and after; every current file hash matches the final manifest. The launcher remains mode 0755, and the seven other outputs remain 0644. The ignored map's second-CI section names the changed bridge, reset, serial registration and lifecycle caller coverage, with counts unchanged at 52 entries and 696 mapped rows (`docs/superpowers/plans/96-port-map.md:7003`). The parent gate ends `verify: PASS` (`.superpowers/sdd/96/ci-fix-2-parent-gate.log:89`).

### Issues

#### Critical (Must Fix)

- None found in this scoped repair.

#### Important (Should Fix)

- None found in this scoped repair.

#### Minor (Nice to Have)

- No new Minor defect found. The previously known manifest warnings and managed-hook notice remain in the parent gate (`.superpowers/sdd/96/ci-fix-2-parent-gate.log:70`, `:76`, `:83`). They remain deferred and prove no live acceptance.

### Evidence and Named Outside Checks

- Read the complete brief, review focus and report, including the source-edit hold, actual CI/macOS failures, both passing controlled allocation runs, complete tracked RED, final GREEN, bookkeeping failure and remaining concerns.
- **Risk: clearing shared state could bypass identity verification or break sequential sessions.** The fixture hunk cuts off its host/herdr function. Read the adjacent existing startup, Codex RPC and herdr observation branches in `tests/lib/runner-fixture.ts:70` through `:123` and `:140` through `:218`. The reset retains the existing current-session handshake. The complete lifecycle GREEN supplies the sequential-handoff check; no product identity validator changes.
- **Risk: the delayed reply could replace the terminal boundary or weaken argv/environment checks.** The board hunk cuts off the case. Read its existing setup before the hunk and its HTTP/terminal, selected-runtime, Run/Resume, state and cleanup assertions after the hunk (`tests/board-agent.test.ts:140` through `:188` and `:210` through `:388`). The new bridge preserves the original helper invocation and results.
- **Risk: the ordering and allocation claims could exceed the evidence.** Read and decoded the complete relevant trace objects in `board-red-probe.log` and `board-clear-probe.log`; checked the complete tracked `board-red.log`; checked both `flow-load-probe.log` and `flow-serial-probe.log`. The board trace proves the stale observation defect. The two passing timing probes support the limited allocation change but do not replace actual CI RED or prove Linux acceptance.
- **Risk: the corrected inventory could omit cases.** Read the complete sanitized CI log as evidence data and matched its anchored entry/name records with each complete GREEN file and `case-inventory.json`. All 102 names match. Independently reversed the three source substitutions and checked their base hashes; all match. No preservation test or application test was rerun.
- **Risk: a test-only repair could hide delivery drift.** Compared the eight before/after manifest records and current hashes. They all match, with no byte or mode change. The supplied parent gate also confirms pinned generated-file comparison.
- No passing test, gate, full suite or live check was rerun. No subagent was used. Only this ignored review report was written; no tracked file, index, HEAD or branch state was changed.

### Assessment

**Task quality:** Approved.

**Reasoning:** The fixture correction restores the intended observation sequence and the retained delayed-reply regression reaches the real failure. The one-case native serial allocation preserves the full oracle and time limits, with measured support. New-head Linux and full-suite acceptance remain with CI.

