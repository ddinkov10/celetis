### Spec Compliance

- ✅ Spec compliant for this scoped Verify repair. The fix follows the approved six/26 allocation in `.superpowers/sdd/96/progress.md:445`. Four update cases and two registration cases move to `tests/runner-startup.test.ts:9` and `tests/runner-startup.test.ts:46`. The remaining 26 lifecycle cases stay in their original entry.
- Check: All 32 exact names remain, with no duplicate or missing name. The source-preservation record confirms the shared helpers, four update cases, two registration cases, and remaining case bodies (`.superpowers/sdd/96/verify-fix-source-preservation.json:2`). The complete before/after inventory has 32 before, 32 after, and 32 in the paired run (`.superpowers/sdd/96/verify-fix-case-inventory.json:2`).
- Check: All 282 assertions remain. The raw solo and paired output records 228 lifecycle assertions and 54 startup assertions (`.superpowers/sdd/96/verify-fix-solo-driver.log:35`, `.superpowers/sdd/96/verify-fix-solo-driver.log:59`, `.superpowers/sdd/96/verify-fix-pair-driver.log:35`, `.superpowers/sdd/96/verify-fix-pair-driver.log:51`).
- Check: The fix changes only five test files. Runtime source and production waits are unchanged. Both entries retain the 25,000 ms test default (`tests/runner-lifecycle.test.ts:3`, `tests/runner-startup.test.ts:7`). The existing 30,000 ms file deadline is unchanged.
- ⚠️ Cannot verify the remaining local Final Verify entries, Linux acceptance, or the full CI suite from this repair. These remain open. The live-check waiver remains in force. This approval is not a Final Verify or full-suite PASS.

### Strengths

- Check: The new private helper is a direct extraction of the existing managed/start/identity/held/finish implementation. It adds no timing control or framework. Its relative type import resolves in `tests/lib/`; its functions keep the fixture paths supplied by the caller (`tests/lib/runner-lifecycle-fixture.ts:2`, `tests/lib/runner-lifecycle-fixture.ts:4`). Both entries import that one implementation (`tests/runner-lifecycle.test.ts:10`, `tests/runner-startup.test.ts:5`).
- Check: The existing `runnerCase` pool and cleanup are reused. The new helper introduces no pool or cleanup state. The moved registration cases retain the Git barriers, real parent SIGKILL checks, saved identity checks, lock recovery, and explicit foreground finish (`tests/runner-startup.test.ts:51`).
- Check: The new automatic entry is in `processEntries`, and discovery coverage checks both automatic discovery and process-subset membership (`tests/suite.ts:11`, `tests/parallel.test.ts:112`, `tests/parallel.test.ts:129`).
- Check: The ignored assertion/caller map names the new allocation and shared helper, including the moved update and registration assertions (`docs/superpowers/plans/96-port-map.md:1718`, `docs/superpowers/plans/96-port-map.md:1730`, `docs/superpowers/plans/96-port-map.md:6835`). The map is absent from the five-file tracked fix package.
- Check: The actual failure and focused diagnostic support a workload allocation repair. The original run reached status 124 at 30.104 s after 30 passing cases. The two remaining registration cases completed in the one recorded focused diagnostic at 4.463 s. These are the real before-fix evidence (`.superpowers/sdd/96/progress.md:440`, `.superpowers/sdd/96/verify-fix-probe.log:1`). No retrospective test-first replay is required.

### Issues

#### Critical (Must Fix)

- None.

#### Important (Should Fix)

- None.

#### Minor (Nice to Have)

- Non-blocking baseline output: The parent gate still prints the known unversioned-manifest and managed-hook notices (`.superpowers/sdd/96/verify-fix-parent-gate.log:70`, `.superpowers/sdd/96/verify-fix-parent-gate.log:83`). They do not change its PASS result. No source change is requested for this repair.

### Checks

- Check: Initial commands confirmed `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`, branch `feat/96-intent-the-whole-toolchain`, and HEAD `d658ce09ab8d1cc68a02a761efed3c3d2bea3a0b`. BASE is `fc773596aa4d66fbae647789a7040f32a96ad717`.
- Check: Read current `AGENTS.md`, the repair brief, global constraints, the implementer report, and the allocation ruling. No nested `AGENTS.md` was found under the affected test/script/artifact paths. Read the supplied 18,887-byte fix package once. No diff was regenerated.
- Check: One focused unchanged-caller inspection answered the named deadline/default-worker risk. `suite()` still defaults to two workers and a 30,000 ms file deadline, and launches each test with `--timeout 29000` (`tests/suite.ts:33`, `tests/suite.ts:55`). The evidence driver imports this actual suite, sets one worker for each solo run, and leaves workers undefined for the paired run (`.superpowers/sdd/96/verify-fix-after.ts:4`, `.superpowers/sdd/96/verify-fix-after.ts:9`). No unrelated source was inspected.
- Check: The report gives the exact pinned Bun 1.4.2 command, cache/report controls, private tools prefix, and four isolation flags for `verify-fix-after.ts solo`, `verify-fix-after.ts pair`, the covering discovery case, and the fast gate (`.superpowers/sdd/96/verify-fix-report.md:89`). The raw logs identify Bun 1.4.2 (744846f84).
- Check: Solo results are lifecycle 26/26 in 13.801 s and startup 6/6 in 5.049 s. Both return 0 with `timedOut: false` (`.superpowers/sdd/96/verify-fix-solo-driver.log:40`, `.superpowers/sdd/96/verify-fix-solo-driver.log:64`).
- Check: Default two-worker paired results are lifecycle 26/26 in 16.373 s and startup 6/6 in 9.081 s. Both return 0 with `timedOut: false` (`.superpowers/sdd/96/verify-fix-pair-driver.log:56`). Each amended entry is below the unchanged 30-second limit in both required boundaries.
- Check: Final real process captures show no owned processes. Each solo boundary and the paired boundary log empty private state (`.superpowers/sdd/96/verify-fix-solo-driver.log:42`, `.superpowers/sdd/96/verify-fix-solo-driver.log:44`, `.superpowers/sdd/96/verify-fix-solo-driver.log:66`, `.superpowers/sdd/96/verify-fix-solo-driver.log:68`, `.superpowers/sdd/96/verify-fix-pair-driver.log:58`, `.superpowers/sdd/96/verify-fix-pair-driver.log:60`).
- Check: Covering discovery passes 1/1 with 20 assertions (`.superpowers/sdd/96/verify-fix-discovery.log:6`). The controller's gate at this HEAD ends `verify: PASS` (`.superpowers/sdd/96/verify-fix-parent-gate.log:89`).
- Check: No test, probe, gate, or full suite was rerun. No subagent ran. No source, index, HEAD, branch, PR, issue, or landing state was changed. Only this requested ignored report was written.
- Non-blocking process observation: The earlier Task 5 test-order risk remains recorded. This allocation repair does not change that history or extend the completed broad-review repair wave.

### Assessment

**Task quality:** Approved.

**Reasoning:** The fix makes the exact approved test allocation and preserves the case logic, assertions, runtime behavior, and deadlines. Recorded solo and default-paired runs satisfy the required time and cleanup boundaries. No actionable finding remains in this scoped repair.

