Spec compliance: Issues found. The source meets the Task 4 setup contract, but two required old assertion sets are incomplete.

Strengths:

- `scripts/lib/worktree.ts:15` runs the exact parsed setup text with the selected Bun, isolation flags, inherited streams, lane cwd, and an absolute main argument. `scripts/lib/worktree.ts:19` checks canonical temporary and checkout roots before the source write. `scripts/lib/worktree.ts:58` removes the private source directory before `scripts/lib/worktree.ts:60` writes a success marker.
- `scripts/setup.ts:423` preserves YAML bytes and checks the complete parsed config before product writes. Planning finishes before labels and files are written at `scripts/setup.ts:746`. `scripts/setup.ts:694` checks native path containment and registered lane membership. `scripts/worktree.ts:89` retains branch ownership for failure cleanup.
- `scripts/setup.ts:247` gives normal Git commit and push inherited input and output. `scripts/setup.ts:666` uses plumbing and disables commit signing for try. This preserves the old input, hook, and signing boundaries.
- `tests/worktree.test.ts:198`, `tests/setup.test.ts:1394`, and `tests/worktree.test.ts:490` use real child processes for source bytes, stdin, final line breaks, and signal cleanup. The unsafe temporary-root and path-identity cases also use real private Git repositories.

Important findings:

1. `tests/setup.test.ts:664`: Restore the complete ownership-record check in the handwired case. Old `tests/setup.test.sh:743` checks the full schema, answers, file set, and entry set. Line 744 also excludes store ownership. The new case checks only answers and settings entries. A wrong launcher/config ownership record or an owned product store can pass this case. Restore the complete expected record and store exclusion. The map marks these assertions as ported at `docs/superpowers/plans/96-port-map.md:1145`, but the diff does not retain their checks.

2. `tests/worktree.test.ts:424`: Restore the protected-ref checks after each refused closed-issue removal. Old `tests/worktree.test.sh:205` checks the lane branch and prototype immediately after the caller-inside refusal. Line 211 also checks the origin prototype after the later refusal. The new test checks only the first status, then force-creates and pushes the prototype at lines 426–427. Those operations can hide a prototype deletion caused by the first refusal. The later refusal also has no origin-ref check. Assert the lane, lane branch, local prototype, and origin prototype before the next mutation. After success, also check that the origin prototype is gone, as old line 217 requires. This is a required removal-safety assertion set, not a request for broader coverage.

Minor finding:

- `tests/worktree.test.ts:47`: The old stderr check at `tests/worktree.test.sh:154` requires the complete literal line, including the backslash suffix. The new substring check accepts changed or truncated stderr. Restore an exact line check for `noise "quoted" \slash`. The approved stdout change does not change this stderr contract.

- `tests/worktree.test.ts:367`: The refusal loop omits the old diagnostic assertion at `tests/worktree.test.sh:414`. For the open issue with no PR, check that stderr names `#1 is open` and `no merged PR`. A status-only check accepts the wrong failure cause.

Checks and limits:

- The initial path, branch, and HEAD checks match the assigned lane, `feat/96-intent-the-whole-toolchain`, and `8fd80bf2b6f32d0733f53cacabff603fbcbaa9a4`. I read the full supplied diff in bounded sections. I did not read the changed source files separately or run tests again.
- The map has 618 expanded source assertion rows: 162 worktree rows and 456 setup rows. It declares seven runtime replacements. The parameter and caller records cover the requested conversion scope. The two important findings above are gaps between the record and the actual assertions.
- Focused unchanged-code checks covered four named risks: setup subprocess isolation in `scripts/lib/process.ts:5` and `:59`; full config comparison in `scripts/lib/config.ts:317` and `:347`; removed ownership, refusal, and exact-stderr assertions in the old focused tests; and inherited Git commit/push streams in `scripts/setup.sh:597` and `:603`. No further source crawl was needed.
- `.superpowers/sdd/96/task-4-red.log:2586` records 0 pass and 147 fail before the commands existed. The complete focused files record 47 pass in 8.83 s at `task-4-worktree-final.log:52` and 109 pass in 20.67 s at `task-4-setup-final.log:114`. The final scoped run records 22 pass and no failures at `task-4-identity-final.log:29`. The reference logs and helper logs also match the report.
- `.superpowers/sdd/96/task-4-parent-gate.log:103` ends with `verify: PASS`. Its version, LICENSE, and icon messages are the stated existing validator messages at lines 66, 72, 85, and 90. They are not new Task 4 findings.
- Public entrypoints and setup prose remain assigned to Task 9. The full suite and the waived live acceptance checks remain UNRUN. This review does not require those live checks.

Task quality: Needs fixes. The source follows the required boundaries and the recorded local tests pass. Restore the two required assertion sets before approval.
