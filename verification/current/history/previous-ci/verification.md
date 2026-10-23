# Issue #96 verification evidence

Current local result: **DONE** at `d658ce09ab8d1cc68a02a761efed3c3d2bea3a0b`. V1 PASS; V3 macOS PASS. Linux process/native acceptance and final full-suite CI remain PENDING.

CAP: J2 V1 B2 N1 S2 X1 = 9 +b2 → inherit/max

Checkout: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`. Branch: `feat/96-intent-the-whole-toolchain`.
Baseline: `4fe5554c4c09ec522aae410afde6a298787a04a9`.
OS: macOS 26.4.1 (25E253), Darwin 25.4.0, arm64.
Bun: `1.4.2+744846f84` at `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun`.
Observed CLIs: Codex 0.163.0; private Claude Code 2.1.302; GitHub CLI 2.102.1; herdr 0.9.3. These observations are not live acceptance.

| Stage | Result |
| --- | --- |
| Initial head `fc773596aa4d66fbae647789a7040f32a96ad717` | V1 PASS. V3 FAIL: old lifecycle file timed out at 30.104 s, status 124. Thirty cases passed before cutoff; two registration cases remained. Group stopped with no observed owned descendants. |
| Repair head `d658ce09ab8d1cc68a02a761efed3c3d2bea3a0b` | Approved test-only split: lifecycle 26 plus startup 6, one extracted helper, all 32 names and 282 assertions retained. Production timing/deadlines unchanged. Scoped review approves with no findings. |
| Current Final Verify continuation at repaired head | V1 PASS and V3 macOS PASS, using fresh clean copies and every current process entry plus celetis-flow. |

The earlier failure and report remain in `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-new-head.vuga5sx8/history/` and original raw state `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify.s9qkv0f5/`. The report does not treat the old run as a PASS. The two earlier historical RED-order gaps remain documented.

| Scenario | Current status | Evidence/reason |
| --- | --- | --- |
| V1 | PASS | Two new clean exact-HEAD Git copies; all eight outputs equal by direct bytes and modes; source check/gate preserve all 220 tracked records; corrupt refusal does not repair. Fresh gate 1.216993 s, `verify: PASS`. 220 tracked, 109 TS, 49 automatic entries, 690 focused rows; no missing named replacements or live removed-path callers. |
| V2 | UNRUN | User: `ignore live checks`. |
| V3 macOS | PASS | Current six processEntries plus celetis-flow, one file per workers:1 suite call, unchanged 30-second limit. Per-file actual exits/times below and in raw logs. |
| V3 Linux/native realpath | PENDING | Controller owns actual final CI. No macOS inference. |
| V4 | UNRUN | User: `ignore live checks`. |
| V5 | UNRUN | User: `ignore live checks`. |
| V6 | UNRUN | User: `ignore live checks`. |

| Entry | Result | Exit | Seconds | Cases | Assertions | Observed descendants after |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `board/realpath.test.ts` | PASS | 0 | 0.750 | 3 | 8 | 0 |
| `tests/process.test.ts` | PASS | 0 | 4.757 | 26 | 85 | 0 |
| `tests/runner-lock.test.ts` | PASS | 0 | 11.164 | 23 | 160 | 0 |
| `tests/runner-lifecycle.test.ts` | PASS | 0 | 13.166 | 26 | 228 | 0 |
| `tests/runner-startup.test.ts` | PASS | 0 | 5.100 | 6 | 54 | 0 |
| `tests/host-session.test.ts` | PASS | 0 | 22.305 | 80 | 836 | 0 |
| `tests/celetis-flow.test.ts` | PASS | 0 | 16.340 | 70 | 660 | 0 |

Exact primary commands, from the checkout:

```sh
python3 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-new-head.vuga5sx8/v1-proof.py
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-new-head.vuga5sx8/v1-tree-proof.ts
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-new-head.vuga5sx8/v3-proof.ts
```

All Bun commands use both fixed environment controls, private tools/bin first on PATH and all four isolation flags. Exact V1 argv/cwd/status/time records are `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-new-head.vuga5sx8/commands-v1.json`. The V3 driver imports the current processEntries including runner-startup and uses one `suite({files:[file],workers:1,timeoutMs:30000})` call per file. Authorized private-process escalation permitted real ps/loopback. No approval rejection occurred. No source/test repair, full suite or waived live check ran.

Complete report: `.superpowers/sdd/96/final-verify-report.md`.
Current raw logs: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-new-head.vuga5sx8/logs/`.
Manifest, snapshots, versions, role/map closure, V3 results/case/process summaries and final state: `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-new-head.vuga5sx8/proof/`.
One private capture directory remains with zero-byte stdout/stderr files; exact metadata is retained in proof/final-temp-metadata.json. No observed owned process remains. Final tracked source is clean and unchanged.

Remaining gates: actual Linux process/native CI; final full-suite CI; current-build maintainer cutover report before Land. V2/V4/V5/V6 remain UNRUN. The controller owns all external acts.
