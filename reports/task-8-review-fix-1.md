Observer fixture path conversion — ADDRESSED. Both the observer root and the Read path use `fileURLToPath()` (`tests/native-observer.test.ts:26`, `tests/native-observer.test.ts:34`). The root also removes its trailing separator. A space in the checkout path no longer gives the two values different encodings.

New breakage in the fix diff: None. No new Critical or Important issue was found.

Checks

- The first command confirmed the required worktree, branch `feat/96-intent-the-whole-toolchain`, HEAD `88d7f424e00cd875d99eaf25baa99b5ac58ee6c1`, and a clean tracked tree. Read the fix brief, appended report, scoped re-review instructions, and complete fix package once. The package changes only `tests/native-observer.test.ts`.
- The new regression at `tests/native-observer.test.ts:160` copies the test, helper, source observer, and generated observer into a private `space checkout` path. It starts the pinned test runtime through `process.execPath`, uses the required isolation flags and environment values, and limits the child to `compact observation`. That pattern excludes the regression itself. The child has a five-second timeout, and `finally` removes the copy (`tests/native-observer.test.ts:204`).
- Read `.superpowers/sdd/96/task-8-logs/fix-1-spaced-red.log`. It records the new outer regression failing before the conversion. Its captured child has two failures: the source and generated compact-observation cases have no logged result. This is the original defect.
- Read `.superpowers/sdd/96/task-8-logs/fix-1-observer-final-green.log`. It records all six source cases, all six generated cases, and the new regression passing: 13 pass, 0 fail, 74 assertions, 0.14 seconds.
- Read `.superpowers/sdd/96/task-8-logs/fix-1-spaced-proof-green.log`. The separate spaced copy records both compact-observation cases passing: 2 pass, 0 fail, 11 filtered, exit 0.
- Checked the added inventory pair and the selected summary. The map contains the new spaced-checkout case once and has 651 pairs. The observer summary selects the final GREEN log and retains six source and six generated cases.
- Read the parent gate evidence. `.superpowers/sdd/96/task-8-fix-1-parent-gate.log:101` is `verify: PASS`. Its directory notices match the recorded baseline. No test or gate was rerun for this re-review.

Out-of-scope observations: None. The initial native entry source-RED gap and the live-check waiver remain as recorded. Untouched code was not reviewed again.

Fix round: All findings addressed, no new Critical or Important breakage. Approved.
