### Spec Compliance

- ❌ Issues found. The descriptor path does not keep the existing capture limit in `scripts/lib/process.ts:42`. The board port also weakens an exact baseline assertion at `tests/celetis-flow.test.ts:483`. These conflict with the binding output-limit and assertion-preservation requirements.
- ⚠️ Linux runtime acceptance is UNRUN. Task 5 requires the pinned-floor lifecycle subset on macOS and Linux. The macOS evidence is present; a Linux executor must still supply its result. The live-check waiver covers real host sessions and real plugin updates, not Linux process/FFI proof (`.superpowers/sdd/96/task-5-report.md:127`).
- ⚠️ The prescribed test sequence was not followed in full. The first missing-module RED files were minimal. Full case expansion came during implementation. The report states this at `.superpowers/sdd/96/task-5-report.md:44`; it does not establish RED evidence for every final case.

### Strengths

- Check: All eight requested files are present in the package. The required interfaces are exported at `scripts/lib/session.ts:46`, `scripts/lib/session.ts:81`, `scripts/lib/session.ts:95`, `scripts/plugin-update.ts:8`, and `scripts/celetis-flow.ts:58`.
- Check: Session validation has one owner. It keeps the six exact keys, schema 1, host/checkout checks, and UUID validation. Writes use a private temporary file and atomic rename (`scripts/lib/session.ts:23`, `scripts/lib/session.ts:81`). Exact Resume arguments and the discovery race have direct tests (`tests/host-session.test.ts:274`, `tests/host-session.test.ts:283`).
- Check: The runner keeps Git compare-and-swap registration and the private start signal. Tests kill the real parent before registration and after start (`scripts/celetis-flow.ts:199`, `scripts/celetis-flow.ts:588`, `tests/runner-lifecycle.test.ts:292`).
- Check: The update lock has real descriptor and process-group tests. They cover helper SIGKILL, nested host lookup, a real short timeout, and the shared total deadline (`tests/runner-lock.test.ts:59`, `tests/runner-lock.test.ts:102`, `tests/runner-lock.test.ts:279`, `tests/runner-lock.test.ts:438`). The macOS process tables show no surviving processes (`.superpowers/sdd/96/task-5-lock-final.log:6`, `.superpowers/sdd/96/task-5-lock-final.log:16`).

### Issues

#### Critical (Must Fix)

- No Critical findings.

#### Important (Should Fix)

1. `scripts/lib/process.ts:42` — Stop capture at the buffer limit. The new inherited-descriptor branch appends each chunk to the full stdout/stderr strings. After the limit is reached, it sets `failed` and sends TERM, but later chunks still extend those strings. A TERM-ignoring child can therefore consume memory beyond the existing 64 MiB per-stream limit until the update deadline stops its group. Truncation in the final result does not limit the live capture. This branch now serves Claude installed-root lookup (`scripts/lib/host.ts:207`). A focused Bun 1.4.2 probe used `maxBuffer: 16` and a TERM-ignoring child that wrote two 64-byte chunks. Instrumentation observed a 128-byte capture; the result was `{code:1, stdout:"aaaaaaaaaaaaaaaa", stderr:""}`. Keep retained data bounded after overflow and preserve an overflow diagnostic. Add a focused case that writes again after TERM.

2. `tests/celetis-flow.test.ts:483` — Restore the exact close-time assertion. The baseline assertion compares `closedAt` with the fixture's `closed_at` value. The map records that assertion as ported (`docs/superpowers/plans/96-port-map.md:1654`). The replacement uses `toBeTruthy()`, so a different non-empty timestamp passes. Read the expected timestamp from the issue fixture and compare it exactly. This is a missing assertion under the explicit preservation requirement.

#### Minor (Nice to Have)

- `.superpowers/sdd/96/task-5-parent-gate.log:64` — The gate output still contains version, license, and icon notices, including the directory-profile license refusal at line 85. The controller identified these as baseline output. They are not a Task 5 regression and do not change the PASS result. No Task 5 source change is required for them.

### Checks

- Check: Initial commands confirmed `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`, branch `feat/96-intent-the-whole-toolchain`, and HEAD `0cc9dbf4a06066238e6dbc85054965d04827c3c8`. BASE is `2192c298d122db33a2a0d53c8f9800ff03c61edb`.
- Check: Read the brief and binding global constraints verbatim. Used the Task 5 assertion map. Did not read the whole plan. Reviewed the supplied diff in one pass. One output cut off a function; the missing window was recovered from the same package.
- Check: Compared the four old-file assertion groups and their expanded host, status, step, identity, and lifecycle parameters with the new tests. The close-time check above is the confirmed lost assertion. Runtime changes to source names and test-only clock wrappers match the declared changes (`docs/superpowers/plans/96-port-map.md:1741`).
- Check: For descriptor inheritance and cleanup, checked the changed `installedRoot`, `codexRequest`, and process-helper hunks. Descriptor 3 reaches nested commands (`scripts/lib/host.ts:76`, `scripts/lib/host.ts:199`). Read the cut-off continuation at `scripts/lib/process.ts:71` to compare the existing buffer-error path. The live capture defect above remains.
- Check: For the shared saved-record validator, inspected only the unchanged continuation of `launcher.main`. Its diff hunk ended mid-function. Saved-host selection still precedes package discovery, and the serialized snapshot is passed to the runner (`scripts/launcher.ts:34`, `scripts/launcher.ts:54`). The runner compares it again at `scripts/celetis-flow.ts:423`. No broader caller search was needed.
- Check: Read existing focused results: 80 session passes in 28.59 s; 70 flow passes in 16.37 s; 23 lock passes in 11.39 s; 32 lifecycle passes in 20.68 s. Total: 205 passes. Each file is below 30 s (`.superpowers/sdd/96/task-5-session-final.log:88`, `.superpowers/sdd/96/task-5-flow-final.log:78`, `.superpowers/sdd/96/task-5-lock-final.log:34`, `.superpowers/sdd/96/task-5-lifecycle-final.log:40`).
- Check: The four tightened ownership cases pass on Bun 1.4.2 in 2.38 s (`.superpowers/sdd/96/task-5-ownership-final.log:13`). The initial macOS FFI/process decision point has four passes in 1.64 s (`.superpowers/sdd/96/task-5-lock-proof-escalated.log:13`).
- Check: The controller's gate log at the reviewed HEAD ends `verify: PASS` (`.superpowers/sdd/96/task-5-parent-gate.log:103`). No passing test file or gate was rerun. Only the new buffer-limit probe ran. It used the pinned Bun 1.4.2 executable, disabled configuration/cache flags, an inherited descriptor opened on `/dev/null`, and a bounded 150 ms child.
- Check: No full suite or live acceptance check ran. Final CI owns the full suite. Old entrypoints were not removed by this task. No source, index, HEAD, branch, or issue state was changed by this review. Only this requested report was written.

### Assessment

**Task quality:** Needs fixes.

**Reasoning:** The session and process-lock design has strong local evidence. Fix the unbounded capture and restore the exact baseline assertion. Linux runtime acceptance remains open.

