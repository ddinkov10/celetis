### Spec Compliance

- ✅ Spec compliant for this scoped CI repair. The diff addresses synthetic abort stderr, carries the already resolved Git common directory through exact Resume, changes only the suite's default file-worker count, and divides the host checks into the four approved concern groups. Existing case bodies, helpers, waits, record validation and file limits are retained.
- Binding checked: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`, branch `feat/96-intent-the-whole-toolchain`, HEAD `7d9366d5ee04b879bcb75d9a7a91cafb654a3118`. Review base is `d658ce09ab8d1cc68a02a761efed3c3d2bea3a0b`. The complete 57,434-byte package was read once in bounded passes. No second branch review was done.
- ⚠️ Cannot verify: whether the new allocation closes the Linux fixed-wait, case-limit and file-deadline failures. The controlled measurements and final covering runs are macOS evidence. New-head Linux CI must supply that result.
- ⚠️ Cannot verify: current-head full-suite acceptance and its total wall time. No full suite ran in this review or in the worker's local repair. The earlier Linux process PASS is historical.
- ⚠️ Live host, browser, native-loader and token acceptance remain UNRUN under `ignore live checks`. The current-build product cutover report remains required before Land. These are controller gates, not missing worker deliverables.

### Strengths

- **Cancellation metadata stays separate from real output.** `scripts/lib/process.ts:102` excludes only synthetic error metadata whose code is `ABORT_ERR`. It retains nonzero cancellation status and uses actual child stderr first. It does not filter text by its contents. `tests/process.test.ts:221` checks empty stderr, an actual warning and literal child text `The operation was aborted\n`, then verifies child death. The retained pre-fix log fails only the empty-stderr case; the other two already pass (`ci-fix-logs/cancellation-red-final.log`). The native callback record in `ci-fix-logs/causes.log` confirms empty child stderr and a separate AbortError.
- **The runner regression reaches the real failing boundary.** `tests/host-identity.test.ts:58` holds each host's foreground until the watcher resolver has started, then ends it. The cases require exact successful stdout, empty stderr, the saved UUID, resolver death and released issue locks. The actual pre-fix run fails both empty-stderr assertions (`ci-fix-logs/watcher-red.log`); the focused GREEN records all 18 assertions passing (`ci-fix-logs/causes-green.log`).
- **Resume reuses a proven location.** `scripts/launcher.ts:13` passes the Git common directory obtained from the original cwd. `scripts/lib/session.ts:46` and `:74` carry it to the existing reader without another Git lookup from its derived parent. The same validator, exact checkout comparison, host/UUID checks and sorted handoff remain. Other callers keep their existing discovery. `tests/launcher.test.ts:676` adds only stderr as the failure message; its code and exact-record assertions remain. The recorded RED exposes the actual Git status 128 and fatal stderr. The complete launcher file later passes 67 cases and 393 assertions.
- **The allocation change has measured support.** `tests/suite.ts:36` defaults to one file worker; explicit workers and the generic process runner are unchanged. `tests/parallel.test.ts:154` calls the effective default with two real test entries and a shared exclusive resource. The retained RED shows the second entry failing with EEXIST under the old default. Existing explicit-count, deadline, child-failure and signal cases remain. The same unchanged land/host pair improves from 23.541/29.658 seconds to 15.052/22.138 seconds in the one-worker measurement. The proposed ADR records both the cost and the need for Linux CI (`docs/adr/0025-the-toolchain-runs-on-typescript-and-bun.md:73`).
- **The split retains the checks.** The new entries at `tests/host-observation.test.ts:1`, `tests/host-identity.test.ts:1` and `tests/host-resume.test.ts:1` have clear concerns. `tests/host-session.test.ts:1` keeps launch and unmanaged checks. Only the existing shared values and `saved` helper move to `tests/lib/host-session-fixture.ts:4`. All four use the existing runner fixture. All 22 registration forms and bodies are retained; the expanded allocation is 26/16/24/16 cases. The four raw logs total 82 distinct names and 854 assertions, equal to the original 836 plus the two new watcher cases' 18.
- **Discovery and delivery agree.** `tests/suite.ts:12` selects all four host entries for process acceptance. `tests/parallel.test.ts:114` and `:134` require the added entries in discovery and process selection. The map records 52 automatic entries and all 82 host locations. Only generated launcher bytes change; its mode remains 0755. The seven browser/native outputs retain their bytes and modes. Current delivery hashes match `ci-fix-logs/generated-after.json`.
- **The report keeps contrary evidence.** The unsplit 82-case standalone run reaches status 124 at 30.110 seconds, with five case timeouts and eight leftover fixture folders. The driver reports cleanup failure instead of a PASS (`ci-fix-logs/after-initial-driver.log`). The subsequent change is the approved file allocation. The final split runs have no owned-process or scratch residue. No old wait or timeout was increased.

### Issues

#### Critical (Must Fix)

- None found in this scoped repair.

#### Important (Should Fix)

- None found in this scoped repair.

#### Minor (Nice to Have)

- No new Minor defect found. The parent gate retains the previously known unversioned-manifest warnings and managed-hook notice (`.superpowers/sdd/96/ci-fix-parent-gate.log:70`, `:76`, `:83`). They remain deferred; they do not establish managed-host acceptance.

### Evidence and Named Outside Checks

- Read the full repair brief, review focus, implementer report including its failures and concerns, current lane instructions, global constraints and supplied parent gate log. The gate ends with `verify: PASS` at `.superpowers/sdd/96/ci-fix-parent-gate.log:89`.
- **Risk: a cancellation fix could hide a real command error or change runner state.** Checked the unchanged resolver/foreground cancellation consumers in `scripts/celetis-flow.ts:213` and `:388`. The resolver prints returned stderr; foreground exit aborts and awaits the watcher before checking the saved record. The changed shared helper removes only the unwanted metadata. Recorded real process and interrupted landing checks cover the callers.
- **Risk: a split could drop bodies, parameters or checks.** Read `ci-fix-logs/preserve.ts`, the pre-split block and source records, the source-preservation result and the case inventory. An independent read-only comparison found all 22 complete registration-call bodies byte-identical between the pre-split source and allocated blocks. The three reconstructed outer host loops account for the different grouping; no case body changes. The recorded pinned-transpiler check ties each allocated group and helper to its current source. Independently compared all 80 original host names from the supplied macOS CI log with the inventory: none missing. Compared the four final raw log name sets with the inventory: all 82 unique names match, with 854 assertions.
- **Risk: moving entries could change fixture admission or cleanup.** Checked `tests/lib/runner-fixture.ts:312`: the existing pool remains eight, and its cleanup/release path is unchanged. The four entries keep `setDefaultTimeout(25_000)`; the suite keeps the 30-second file deadline. Read `ci-fix-logs/after.ts` to confirm it uses the effective suite default, isolated scratch per entry, the selected Bun flags and actual process-table checks.
- **Risk: failure evidence could describe a different boundary.** Checked the sanitized macOS abort failure at `ci-macos-clean.log:361` and the Linux automatic-flow, host cutoff, landing timeouts, exact-common-directory and registration failure sections in `ci-test-clean.log`. Read the actual focused RED logs, the controlled pair measurements, the standalone cutoff and the focused GREEN summaries. These agree with the report; they do not prove new-head Linux timing.
- **Risk: generated delivery could omit the runtime repair.** Compared the before/after generated manifests and current file hashes. All eight current hashes match the final record; only `scripts/celetis` changes bytes, with all modes retained. The generated diff contains the same cancellation and common-directory changes as the authored source.
- The 11 covering entry results total **303 cases and 2927 assertions**, with zero failures. Each recorded final file is below 30 seconds and has `timedOut:false`. The final driver records no owned process or scratch residue. The final annotation-only correction has its own effective-default GREEN and passing gate.
- No passing test, gate, full suite or live check was rerun. No subagent was used. Only this ignored review report was written; no tracked file, index, HEAD or branch state was changed.

### Assessment

**Task quality:** Approved.

**Reasoning:** The production corrections are narrow and preserve diagnostics and exact Resume validation. The allocation changes retain the original checks and have real RED/GREEN and preservation evidence; current-head Linux CI still owns the remaining timing and full-suite proof.

