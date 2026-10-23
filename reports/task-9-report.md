# Task 9 report

Status: DONE_WITH_CONCERNS. The requested cutover is committed after the checks below. The confirmed execute-only realpath regression is corrected below. Native-platform and FFI risk remain for CI review. This report does not claim that the complete feature can land.

The initial sections through Changed paths describe cutover base `b62e1d2`. The final Native path correction section records corrected HEAD `8f7fa40` and supersedes the initial concern. Original snapshot/timing evidence remains in `task-9-cutover-proof.json`.

## Binding and scope

- Worktree: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`.
- Branch: `feat/96-intent-the-whole-toolchain`.
- Starting HEAD: `88d7f424e00cd875d99eaf25baa99b5ac58ee6c1`.
- Baseline: `4fe5554c4c09ec522aae410afde6a298787a04a9`.
- Host: Codex. The writing-for-agents and comment-style references completed their native file startup reads against this worktree. Its whole `.celetis.yaml` has no custom part for either reference. The native reader reported a regular `.git` file and regular, non-symlink config.
- Control/build/test runtime: the private Bun 1.4.2. The user's installed Bun still prints 1.4.3. No user runtime or tool was replaced.
- No full suite, runner against live issues, push, PR, issue mutation, Land, controller Tail, or Final Verify phase was run.

## Changes

The public launcher is now the one generated executable. Installed commands and helpers use TypeScript. The fast gate has tracked-path classification, Biome, strict runtime/browser/native environments, native actionlint, YAML/plugin/text checks, vendor identity and non-writing byte/mode comparison. It has no install or full-suite step.

The private installer uses Bun package argument arrays and the checked official actionlint archive. Surviving pins remain actionlint 1.7.12, Biome 2.5.15, TypeScript 7.0.2, and @types/bun 1.4.2. JavaScript tool entries run through the selected Bun. Metadata locates tool and type roots; no npm-root or Node interpreter check remains.

The suite discovers all 47 automatic entries and excludes both token-using manual programs. Two file workers have a 30-second deadline per file. Failure and signals stop the owned child groups. Frozen-reference fixture cases have separate async state and a two-case bound. All old waits and comparison assertions remain. The 21 per-PR call counters now require one typed call: their former count of two included one old comparison execution.

The board validates the relative main-checkout executable before `bindRuntime` checks its exact declared isolated Bun shebang. Data, Run and Resume use selected Bun with every isolation flag. The four stdin keys and the generic native command path stay intact. A denied declaration read preserves the validated native command. No Bash detector, Bash fallback, runtime JSON knob, or absolute-interpreter validation bypass was added. The producer README now points to its TypeScript source and model.

ADR-0025 replaces only the listed Bash/Node toolchain clauses of ADR-0015, ADR-0018, ADR-0020, ADR-0022 and ADR-0024. The 24 historical records are unchanged. Setup approval and product ownership rules remain. The manual quote source is now named correctly in AGENTS.md; none of the changed setup skill sentences is a verbatim step-case quote. Token checks remain UNRUN under the user's waiver. Permission rules and native module manifest paths remain valid and therefore need no content change.

## RED and intermediate failures

Before production edits, the complete required port ran:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/tools/bin:/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/npm/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/verify.test.ts tests/text.test.ts tests/parallel.test.ts tests/build.test.ts tests/install-tools.test.ts
```

Result: 50 pass, 30 fail, 392 expectations, 80 tests, 9.35 s. The tests had the complete gate/text/pool assertions, installer refusals, final-tree and generated-file checks. Failures named missing final modules, obsolete programs, stale callers and the old launcher. Raw log: `task-9-red.log`. The shell wrapper then rejected its reserved zsh variable `status`; the completed Bun result above is present in that original log. Later wrappers use `task9_code`.

The first board RED was blocked by the loopback sandbox and is not runtime-defect proof (`task-9-board-red.log`). The unrestricted complete board-agent RED was 0 pass / 2 fail in 5.67 s: real producer data failed with absent/shadow Bun before binding (`task-9-board-red-unrestricted.log`). All data/Run/Resume assertions were present before the production correction.

The first immutable capture failed its real-process check without process-table access. The unrestricted baseline capture passed 31/31 with 1451 expectations in 37.75 s across two files. This was an internal comparison capture, not a full suite. It ran actual unchanged 4fe5554 sources from private scratch. No expected output was made from the new implementation.

An overlapped three-file run missed the runner's fixed five-second wait (`task-9-callers-green-2.log`). The same case passed alone in 3.16 s (`task-9-runner-diagnostic.log`). With two file workers, the runner passed 70/70, but the sequential resolver hit the unchanged 30-second deadline, status 124, at 30.105 s (`task-9-callers-green-3.log`). No owned test process survived. The resolver passed alone in 14.513 s before the final bounded fixture scheduling change. After that small change, the same overlapped group passed and each amended file also passed alone. No timeout or behavior assertion was relaxed.

A later gate-fixture run found an unformatted scripts/tsconfig.json after an edit overlapped its checkout copy (`task-9-green-final.log`). Formatting was fixed, the tree was staged and kept stable, and the full requested group and final gate were run again.

The denied runtime-declaration read has its own RED (`task-9-binding-red.log`) and GREEN (`task-9-binding-green.log`, 57/57). The broader execute-only realpath probe is a real unresolved failure, below.

## Final commands and decisive output

Every command ran in the bound worktree. Logs named here are in `.superpowers/sdd/96/`.

Required Task 9 group:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/verify.test.ts tests/text.test.ts tests/parallel.test.ts tests/build.test.ts tests/install-tools.test.ts
```

`task-9-focused-ready.log`: **87 pass, 0 fail, 515 expectations, 12.45 s**.

Final board group:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros -e 'const {suite,discoverTests}=await import("./tests/suite.ts");const root=process.cwd();const files=(await discoverTests(root)).filter(p=>p.startsWith("board/")||["tests/board.test.ts","tests/board-agent.test.ts"].includes(p));process.exitCode=(await suite({root,files})).code;'
```

`task-9-board-binding-final.log`: **293 pass, 0 fail, 13 files, suite: PASS**. Real data, selected Run, exact saved-host Resume and native-binary producer cases passed. Both absent/shadow-Bun agent cases passed. No host account or browser acceptance was used.

Amended caller files measured alone:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros -e 'const {suite}=await import("./tests/suite.ts");process.exitCode=(await suite({files:["tests/capscore.test.ts","tests/next-step.test.ts","tests/celetis-flow.test.ts"],workers:1})).code;'
```

`task-9-callers-solo-final.log`: **101 pass, 0 fail, suite: PASS**. Solo times: 3.137 s, 7.151 s and 18.029 s. The final overlapped group also passed (`task-9-callers-green-4.log`): 4.401 s, 14.081 s and 19.463 s.

Native focused group:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros -e 'const {suite}=await import("./tests/suite.ts");process.exitCode=(await suite({files:["tests/native-entry.test.ts","tests/native-observer.test.ts","tests/native-events-harness.test.ts","tests/native-host.test.ts","tests/native-modules.test.ts"]})).code;'
```

`task-9-native-green.log`: **198 pass, 0 fail, suite: PASS**. Native source/generated identity, minimal native globals, full original entry/observer assertions and no-partial-generation refusal passed.

Private real installation:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools --claude
```

`task-9-install.log`: exit 0, `install-tools: /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin`. `task-9-tools-proof.log` reports the retained package pins, the selected Bun argument arrays, and actionlint 1.7.12 as a **Mach-O 64-bit executable arm64**, built with Go. Official hashes came from [actionlint's pinned release checksums](https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_checksums.txt). Stubbed installer cases also pass hash mismatch, failed download/package/extraction and unchanged existing-executable checks.

Final fast gate and generation check:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts --check
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

`task-9-build-ready.log`: exit 0, empty output. `task-9-gate-ready.log`: exit 0, final line **verify: PASS**. Final proof measured 23.293 ms for build check and 766.432 ms for the fast gate. Existing unversioned/managed-hook validator messages remain warnings; no directory policy is bypassed. The exact tracked bytes/modes before and after both checks match.

## Final-tree, map and installer proof

- `task-9-cutover-proof.json`: 215 tracked paths; all classified. Roles: 105 TypeScript, 8 generated, 20 Biome, 13 explicit roles, 67 text, one workflow and one YAML config.
- Prohibited tracked programs: **0**. Live removed-path callers: **0**. Unmapped Task 9 assertion rows: **0**. Historical ADR changes: **0**. Build/gate changed tracked bytes or modes: **0**.
- 54 comparison programs were removed in this task; the caller inventory includes 58 removed baseline paths, including earlier-task fixture removals. Extensionless interpreter checks are explicit. Generated JavaScript and unchanged vendor identity have exact roles. Four baseline JSON evidence files have exact non-executed roles.
- `tests/fixtures/toolchain-cases.json`: 323 expanded gate/text/pool assertion rows, recorded before old source removal. Obsolete language-specific diagnostics have explicit dispositions and new-runtime refusal equivalents.
- `tests/fixtures/toolchain-callers.json`: 85 exact baseline caller rows, with current replacements. The extensionless path check uses a real path boundary, so a new .ts suffix is not mistaken for the removed executable.
- `tests/fixtures/capscore-reference.json`: 151 exact baseline records. Source SHA-256 `4aa2ebd19996ea610bdab0f4b426b4bb81f805cdbd000dcce5ec726b296dfb7e`.
- `tests/fixtures/next-step-reference.json`: 103 exact baseline records. Source SHA-256 `e2ca6431dbe194686e887c9259ad8eaa6cac45317ba53ecad55cf6807794e11c`.
- Expected reference values keep their code/stdout/stderr comparisons. Only private checkout and input-date identities are substituted; dates come from the current fixture input. Every saved record must be consumed. Approved safe-integer and reviewer-effort changes remain explicit typed assertions.
- `docs/superpowers/plans/96-port-map.md` retains all earlier maps and adds the complete 47-entry inventory, all 679 current focused case-to-file rows, final callers, runtime permission cases and obsolete diagnostic dispositions. This ignored controller evidence is not forced into the product commit. The tracked JSON records supply reviewable source-pin evidence.
- CI has one Linux full-suite step and a separate Linux/macOS actual process/lock subset. Linux CI is **UNRUN** here and belongs to the controller. Neither token program has a test suffix. Discovery includes all three landing entries and every board/native/manual harness entry.

Generated delivery identity:

| File | Mode | SHA-256 |
| --- | --- | --- |
| `board/board.js` | `644` | `d1178deb52b11692c58684e4d11aa5fadf0b1ede45100637cf9415cf41127cea` |
| `board/palette.mjs` | `644` | `94356aba91faa10901a6359edb68bb1be2e1e842bae821c64bf377f7d30c8cfb` |
| `board/panel.mjs` | `644` | `28db0a974a1bef62aa73d37fa2dd420c0e0df10039f1aa6f8a376fb0bd89ce3b` |
| `board/ui.mjs` | `644` | `44b8e3527b71c4d4f6354f59d4bde3ff69c62297d96b79d1c52d209f8cae94c2` |
| `board/view.mjs` | `644` | `381cf2d817e05baf3e33f7d65cec3f5a812d47dfea19b2b6d6623d9748765a5a` |
| `hooks/entry.js` | `644` | `ced46e6e8d23e1f7347a4bf001c91596c21d4a385125bdd36097b70f2658cef7` |
| `scripts/celetis` | `755` | `4cc706526107eab248d729e8ace1d5295ae8dd87d1c823c6bddb5c0990244b30` |
| `tests/manual/native-observer/hooks/register.js` | `644` | `87f049f260b59ef1bdf4846db7b87b226064878cd417eb9cea3b4bd59dc0637b` |

## Per-file timings

Each final measured focused file is below 30 seconds. The caller files and the three last amended boundary/gate files also have solo measurements. Other board/native timings are from their bounded focused group.

| Entry | Seconds | Raw log |
| --- | ---: | --- |
| `board/build.test.ts` | 0.447 | `task-9-board-binding-final.log` |
| `board/cli.test.ts` | 12.271 | `task-9-board-binding-final.log` |
| `board/config.test.ts` | 0.340 | `task-9-amended-solo-ready.log` |
| `board/contract.test.ts` | 0.128 | `task-9-board-binding-final.log` |
| `board/package.test.ts` | 0.114 | `task-9-board-binding-final.log` |
| `board/place.test.ts` | 0.128 | `task-9-board-binding-final.log` |
| `board/process.test.ts` | 0.745 | `task-9-board-binding-final.log` |
| `board/runtime.test.ts` | 0.119 | `task-9-amended-solo-ready.log` |
| `board/server.test.ts` | 0.860 | `task-9-board-binding-final.log` |
| `board/view.test.ts` | 0.117 | `task-9-board-binding-final.log` |
| `board/words.test.ts` | 0.115 | `task-9-board-binding-final.log` |
| `tests/board-agent.test.ts` | 18.115 | `task-9-board-binding-final.log` |
| `tests/board.test.ts` | 3.273 | `task-9-board-binding-final.log` |
| `tests/build.test.ts` | 0.621 | `task-9-focused-solo-final.log` |
| `tests/capscore.test.ts` | 3.137 | `task-9-callers-solo-final.log` |
| `tests/celetis-flow.test.ts` | 18.029 | `task-9-callers-solo-final.log` |
| `tests/install-tools.test.ts` | 0.141 | `task-9-focused-solo-final.log` |
| `tests/native-entry.test.ts` | 0.170 | `task-9-native-green.log` |
| `tests/native-events-harness.test.ts` | 0.140 | `task-9-native-green.log` |
| `tests/native-host.test.ts` | 0.143 | `task-9-native-green.log` |
| `tests/native-modules.test.ts` | 0.843 | `task-9-native-green.log` |
| `tests/native-observer.test.ts` | 0.175 | `task-9-native-green.log` |
| `tests/next-step.test.ts` | 7.151 | `task-9-callers-solo-final.log` |
| `tests/parallel.test.ts` | 3.423 | `task-9-focused-solo-final.log` |
| `tests/text.test.ts` | 0.156 | `task-9-focused-solo-final.log` |
| `tests/verify.test.ts` | 6.348 | `task-9-amended-solo-ready.log` |

## Self-review and named concerns

1. **Resolved by the correction below: execute-only native producer realpath on pinned Bun/macOS.** This is a deterministic runtime incompatibility, not an acceptance PASS. The actual `board/config.mjs` from 4fe5554 accepts a private regular 0111 executable under Node 26.12.0. Node promise, sync and native realpath all return its canonical path; readFile fails EACCES; execution exits 0. Pinned Bun 1.4.2 rejects all three realpath forms with EACCES, and the same original config reports `"data": native does not exist`; direct execution still exits 0. Evidence: `task-9-realpath-node.log`, `task-9-realpath-bun.log`, and `task-9-realpath-probe.ts`. The earlier exploratory failures are `task-9-native-producer-red.log` and `task-9-native-producer-red-unrestricted.log`. Task 7's Bun refusal is not baseline compatibility proof. The new `bindRuntime` read condition is corrected and directly tested, and the controller then required an unconditional native correction. The repair below closes the local regression without a resolver algorithm or error-triggered fallback. Linux execution remains unmeasured locally and is required by CI.
2. The overlapped deadline/wait failures remain in the report. Final bounded overlap and all requested solo timings pass. The controller's full-suite/Linux CI remains required and is not inferred from these focused groups.
3. Actual host/browser/native-loader/token acceptance is **UNRUN** under the user's instruction `ignore live checks`. Existing installed-resource lifetime, changed-pair child retry, managed setup and bootstrap gaps remain open. No live result is inferred from source or fixtures.
4. Historical ADRs and vendor sources are unchanged. The generic board validation order, first-item rules, HTTP/CSP boundaries, four-key stdin, exact Resume, startup flags, locks, signals, streams and setup approval/ownership rules were checked against the changed paths and focused tests. Source comments add no narration. No other product or main-checkout file was edited.

Final tree review: the fast gate and generated-file checks pass, every tracked file has a role, and no old runtime program or live caller remains. The native correction below settles the local execute-only case. Linux CI and the controller's final review still own readiness to land.

## Changed paths

```text
M	.editorconfig
M	.gitattributes
M	.github/workflows/test.yml
M	.gitignore
D	.shellcheckrc
M	AGENTS.md
M	README.md
M	biome.jsonc
M	board/README.md
D	board/cli.mjs
D	board/cli.test.mjs
D	board/config.mjs
D	board/config.test.mjs
M	board/config.test.ts
M	board/config.ts
D	board/contract.mjs
D	board/contract.test.mjs
D	board/package.test.mjs
D	board/place.mjs
D	board/place.test.mjs
D	board/runtime.mjs
D	board/runtime.test.mjs
M	board/runtime.test.ts
M	board/runtime.ts
D	board/server.mjs
D	board/server.test.mjs
M	board/tsconfig.json
D	board/view.test.mjs
D	board/words.test.mjs
A	docs/adr/0025-the-toolchain-runs-on-typescript-and-bun.md
M	docs/capability.md
M	docs/celetis-flow.md
M	docs/configuration.md
M	docs/hosts/claude.md
M	docs/hosts/codex.md
M	docs/issue-tracker.md
D	scripts/board.sh
M	scripts/build.ts
D	scripts/capscore.sh
M	scripts/celetis
D	scripts/celetis-flow.sh
A	scripts/install-tools.ts
D	scripts/land.sh
D	scripts/lib/host.sh
A	scripts/lib/parallel.ts
M	scripts/lib/process.ts
D	scripts/lib/session.sh
M	scripts/lib/vendor/README.md
D	scripts/next-step.sh
D	scripts/plugin-update.pl
D	scripts/root.sh
D	scripts/setup.sh
M	scripts/tsconfig.json
D	scripts/verify.sh
A	scripts/verify.ts
D	scripts/worktree-lib.sh
D	scripts/worktree.sh
M	skills/setup/SKILL.md
D	tests/board-agent.test.sh
M	tests/board-agent.test.ts
D	tests/board.test.sh
D	tests/capscore.test.sh
M	tests/capscore.test.ts
D	tests/celetis-flow.test.sh
M	tests/celetis-flow.test.ts
D	tests/config.test.sh
D	tests/custom-part-harness.test.sh
A	tests/fixtures/capscore-reference.json
A	tests/fixtures/next-step-reference.json
A	tests/fixtures/toolchain-callers.json
A	tests/fixtures/toolchain-cases.json
D	tests/host-session.test.sh
A	tests/install-tools.test.ts
D	tests/land.test.sh
D	tests/launcher.test.sh
D	tests/lib/pool.sh
A	tests/lib/reference.ts
M	tests/lib/tools.txt
D	tests/manual-harness.test.sh
M	tests/manual/config-entry-codex.md
D	tests/manual/custom-part.test.sh
M	tests/manual/live-acceptance.md
D	tests/manual/native-entry-events.jq
D	tests/manual/step-prompt.test.sh
D	tests/native-entry.test.sh
D	tests/native-events-harness.test.sh
D	tests/native-observer.test.sh
D	tests/next-step.test.sh
M	tests/next-step.test.ts
A	tests/parallel.test.ts
D	tests/pool.test.sh
D	tests/runner-lifecycle.test.sh
D	tests/runner-lock.test.sh
D	tests/setup.test.sh
D	tests/suite.sh
A	tests/suite.ts
D	tests/text.test.sh
A	tests/text.test.ts
M	tests/types/native-host.d.ts
D	tests/verify.test.sh
A	tests/verify.test.ts
D	tests/worktree.test.sh
M	tsconfig.native.json
M	tsconfig.runtime.json
```

## Native path correction after controller review

The correction base stays `b62e1d2cb71412eb59ba312f97435209bfb9ee21`. Review covers the whole range from `88d7f424e00cd875d99eaf25baa99b5ac58ee6c1` through corrected HEAD. The native-binding scope was re-scored as `J2 V1 B2 N2 S2 X2 = 11 +b2 → inherit/max`; the actual null-model/max-effort pair and attempt 1 stayed unchanged. No child was spawned.

Commits:

```text
8f7fa40 fix(board): resolve execute-only producers without source reads
e105389 docs(adr): resolve board executable paths with libc
b62e1d2 feat(toolchain): switch all Celetis entrypoints to TypeScript on Bun
```

The installed record-architecture-decisions skill completed its own Host entry and Codex native config read. It found no custom part. I read `docs/adr/README.md` and `template.md`, and consulted the Decision and Reconsider clauses of ADR-0020 and ADR-0024 plus proposed ADR-0025. ADR-0020's producer trust boundary stays in force. ADR-0024's Bun floor is retained, but the new standard-API compatibility premise failed on actual proof. ADR-0026 records the durable native choice with every template section, five rejected standard alternatives, allocation ownership, FFI/platform cost, and a condition for reconsideration. The ADR has its own `docs(adr)` commit; code/tests have their separate `fix(board)` commit.

Exact baseline, RED and prototype evidence:

- `task-9-0111-baseline-node.log`: actual 4fe5554 board config on Node 26.12.0 accepts a regular mode-0111 native producer through `scripts/native-link`, and returns the canonical data/Run/Resume arrays. `readFile` is EACCES; execution exits 0. This uses the same four-key shape as the regression, with private path identities changed only.
- `task-9-0111-baseline-bun.log` and `task-9-realpath-all-bun.log`: private Bun 1.4.2 rejects all five standard forms with EACCES: promise, callback, callback.native, sync and sync.native. The original config fails on the symlink as a missing executable.
- `task-9-0111-red.log`: the exact mode-0111 data/Run/Resume+symlink case ran before the native production correction on b62e1d2; 0 pass, 1 fail, 46 other cases filtered. It failed with `ConfigError: "data": scripts/native-link does not exist`. The regression moved without changing its contract from `board/config.test.ts` into the small acceptance entry `board/realpath.test.ts`.
- `task-9-native-realpath-prototype.ts` and `.log`: before the production choice, a private pinned-Bun prototype of POSIX libc `realpath(path, NULL)` resolves the same execute-only file and its symlink, returns native ENOENT for a missing path, and leaves content reads EACCES. It copies CString before free. The controller approved this API before the production edit.
- `task-9-0111-green-initial.log`: the original RED case then passed with the unconditional native primitive.
- `task-9-realpath-focused-green-2.log`: 60/60 across native paths, full config refusals and runtime checks. This includes the direct no-read binding case, source mode 0111, canonical symlink, real producer execution, unchanged denial after execution, missing path, symlink loop, NUL, lazy import, and missing system primitive failure.

Implementation and covering checks:

`board/realpath.ts` is one lazy wrapper of POSIX libc realpath. It uses the existing Darwin/glibc/musl library selection pattern. The returned path is copied before `free` in finally, and errors keep native errno. No library loads during import. `board/config.ts` calls this primitive unconditionally at its existing canonicalization point, and retains every later main/lane, regular-file, execute-permission and control-character check. A native-library setup failure is reported, rather than relabeled as a missing file. There is no permission-error resolution fallback, second resolver or hand-written symlink algorithm.

The exact execute-only regression is now in `board/realpath.test.ts`, which is part of the existing Linux/macOS `--process` subset. It adds no second full suite. It is also discovered by the normal automatic entry scan. `tests/parallel.test.ts` requires that entry in the process subset and checks the full tracked entry set. The explicit board count is now 12 board entries, plus two adapters; total automatic entries are 48.

Command for each amended boundary entry alone (same private prefix as above):

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros -e 'const {suite}=await import("./tests/suite.ts");process.exitCode=(await suite({files:["board/realpath.test.ts","board/config.test.ts","board/cli.test.ts","board/runtime.test.ts","tests/board.test.ts","tests/board-agent.test.ts"],workers:1})).code;'
```

`task-9-native-correction-solo.log`: **85 pass, 0 fail, suite: PASS**. This runs the existing CLI floor-ordering probes before product/stdin/Git work, every canonical-path refusal, and real absent/shadow-Bun data/Run/Resume. Per-file timings:

| Entry | Seconds |
| --- | ---: |
| `board/realpath.test.ts` | 0.871 |
| `board/config.test.ts` | 0.841 |
| `board/cli.test.ts` | 12.043 |
| `board/runtime.test.ts` | 0.126 |
| `tests/board.test.ts` | 3.382 |
| `tests/board-agent.test.ts` | 17.647 |

The requested five-file toolchain group was repeated after the correction: `task-9-native-correction-toolchain.log`, **87 pass, 0 fail, 516 expectations, 9.28 s**. The native correction gate passes: `task-9-native-correction-gate-1.log`, final line `verify: PASS`. Final build/gate/snapshot proof is `task-9-native-correction-final-proof.log` and `task-9-final-proof.json`; the initial cutover proof is retained separately as `task-9-cutover-proof.json`.

Latest proof: 218 tracked files, 107 TypeScript files, 48 automatic entries; no prohibited program, no live removed caller, no changed historical ADR, and no tracked byte/mode change during checks. Generated bytes/modes remain exactly the table above. Build check and gate exit 0. Measured final check times: build 49.442 ms, gate 1177.609 ms.

The coverage/caller map adds the exact baseline/RED/GREEN, all three new acceptance case names, the unconditional `readList → board/realpath.ts` binding, and the Linux/macOS process-subset caller. The current case-to-file count is 682 and the automatic entry count is 48. Earlier maps and the original failure evidence remain.

Remaining risk: Bun FFI is an experimental C ABI boundary, with libc symbol availability and allocation ownership. Local pinned-runtime native proof is macOS arm64. Actual Linux execution is **UNRUN locally** and must pass the configured Linux CI subset/full suite before landing. No actual host/browser/token result is inferred. The confirmed local execute-only regression is fixed; no local deterministic failure remains open. No full suite, push, PR, issue mutation, Land or controller Final Verify was run by this worker.

Final bookkeeping: commits `b62e1d2`, `e105389`, and `8f7fa40` are complete. The final tree is clean. The native correction adds `board/realpath.ts`, `board/realpath.test.ts`, and ADR-0026, and updates the existing config/discovery/process-subset callers. No known local deterministic failure remains. The report and map stay as ignored controller evidence; raw logs remain separate.

## Task 9 fix round 1: Important findings I1 and I2

Fix base: `8f7fa406badea020428a1d5d61ca322e3ea788ba`. The assigned worktree and branch match. The full task review was read before edits. The actual null-model/max-effort pair is unchanged, attempt 1. No child or external mutation was used.

**I1 — Browser type checks admit server runtime globals.** `board/tsconfig.json` now sets `types: []` and keeps `ESNext`, `DOM`, and `DOM.Iterable`. Runtime and native configurations are unchanged. Three real compiler cases append a probe to `board/board.ts` in a private tracked-checkout copy. That file is one of the browser project's six included sources. The cases require unknown-global errors for `Bun`, `process`, and `Buffer`. The existing `board/bad.ts` fault remains a runtime-project type-error case; it is not the browser boundary oracle.

RED command, before the production config change:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/verify.test.ts --test-name-pattern 'browser project rejects'
```

`task-9-fix1-browser-red.log`: **0 pass, 3 fail, 19 filtered out, 9 expectations, 1.435 s**, exit 1. All three cases failed because the actual compiler returned **0**, which proved the old project admitted every injected global. The complete probe assertions were present before changing the config.

The same command after `types: []`:

`task-9-fix1-browser-green.log`: **3 pass, 0 fail, 19 filtered out, 15 expectations, 1.335 s**, exit 0. Each case checks the included source path and its specific `Cannot find name` diagnostic.

Clean compilation of the unchanged browser sources:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/node_modules/typescript/bin/tsc -p board/tsconfig.json --typeRoots /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/node_modules/@types
```

Exit **0**, empty compiler output (`task-9-fix1-browser-compile.log`). The same pinned compiler with `--showConfig` records `types: []`, libraries `esnext`, `dom`, `dom.iterable`, and exactly `board.ts`, `view.ts`, `ui.ts`, `panel.ts`, `palette.ts`, `types.ts` (`task-9-fix1-browser-showconfig.json`).

**I2 — The changed live-check commands cannot find a normal Bun install.** The three model-suite commands in `tests/manual/live-acceptance.md` now use the selected `bun` from PATH. Every command keeps all four isolation flags and adds `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1`. The obsolete `/bin/bun` path and `PATH="/bin:$PATH"` prefix are removed from those commands. The text states which executable is selected. No prose mirror test was added, and no token program was executed.

Covering file and final gate commands:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/verify.test.ts
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

- `task-9-fix1-verify-green.log`: **22 pass, 0 fail, 90 expectations, 7.02 s**, exit 0. This is the complete amended test file, below its 30-second deadline.
- `task-9-fix1-gate.log`: exit **0**, final line **verify: PASS**. The gate includes strict runtime/browser/native compilation, generated comparison and general text. Expected validator warnings remain.
- Biome checked `board/tsconfig.json` and `tests/verify.test.ts` with no remaining findings. `git diff --cached --check` passed.

Changed files: `board/tsconfig.json`, `tests/verify.test.ts`, `tests/manual/live-acceptance.md`. Coverage map: three expanded included-browser cases; current Task 9 focused case-to-file count 685. Automatic test entry count remains 48. Deferred Minors M1/M2 were not expanded into this fix. No unrelated test group, full suite, live check, token check, push, PR, issue mutation or landing was run.

Fix round 1 commit: `63e566c fix(toolchain): isolate browser types and correct manual Bun paths`. Final tracked tree is clean. I1 and I2 are complete; deferred checks and Minors remain with the controller.
