# Final branch review for #96

## Binding and method

- Checkout: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`.
- Branch: `feat/96-intent-the-whole-toolchain`.
- Base: `4fe5554c4c09ec522aae410afde6a298787a04a9`.
- Head: `a8b0d3db5cdc289359c9593b3469a6b83f32e364`.
- Dispatch: inherited model, max effort, attempt 1.
- The initial check and the check after the interruption confirmed this binding and a clean tracked tree.

I used the requested code reviewer template. I read the full approved plan, specification, global constraints, review focus, ledger rulings and deferred items. I used the supplied 19-commit, 191-path review package in bounded passes. The passes covered command and shared runtime code; setup and landing; the board server and browser sources; native and manual sources; gate, build, installer and CI; test contracts and the baseline maps; removed programs and live references; generated delivery and vendor identity. Task reports and scoped reviews supplied evidence claims. Their verdicts did not replace inspection of the shared boundaries.

No subagent, full suite, live check, build, gate, push, PR, issue mutation or landing ran during this review. Private probes addressed two concrete doubts: the board terminal environment and the board process capture boundary. A reference Node probe ruled out the second as a port regression. A filesystem read checked the remaining compiler caller. Only this ignored report was written in the checkout.

## Strengths

- The conversion keeps direct module boundaries. The strict reader is an importable API; the launcher replaces its process; setup has one executor; sessions have one strict six-key validator. There is no retained shell, Perl, jq or MSYS compatibility implementation.
- The selected Bun and isolation flags reach the launcher, installed commands, setup, updater and board data path. External commands use argument arrays. The board validates the actual project executable before it binds the declared Bun runtime (`board/config.ts:23`, `board/runtime.ts:15`). Finding I1 is the remaining terminal environment gap.
- Update ownership remains an operating-system lock. Descriptor 3 follows nested installed-root calls. Cleanup precedes descriptor close, with no explicit unlock. Git runner locks use compare-and-swap, PID and start identity. The private start signal follows session registration (`scripts/lib/update-lock.ts:125`, `scripts/lib/host.ts:76`, `scripts/celetis-flow.ts:199`, `scripts/celetis-flow.ts:309`).
- Exact Resume retains the saved host and UUID, detects a changed record during package discovery, starts no watcher, takes no automatic-runner lock, and performs no refresh (`scripts/launcher.ts:34`, `scripts/lib/session.ts:23`, `scripts/celetis-flow.ts:419`).
- Setup keeps the parsed source bytes, including final newlines. Its private 0600 source stays outside canonical main and lane paths; streams remain inherited. Config additions are round-tripped and compared before product writes. New and existing lane failure cleanup have separate ownership rules (`scripts/lib/worktree.ts:15`, `scripts/setup.ts:423`, `scripts/worktree.ts:144`).
- Landing binds checks and the squash request to the same tip. Its abort signal reaches shared removal calls, with checks before later deletes. The three natural test entries retain the hard file deadline without changing production poll constants (`scripts/land.ts:299`, `scripts/land.ts:378`, `scripts/lib/worktree.ts:102`).
- Build compiles all eight targets before delivery writes. Check mode only compares bytes and modes. The gate does not install tools or call the full suite. Runtime, browser and native type environments are separate; the browser fix now excludes automatic Bun/Node types (`scripts/build.ts:34`, `scripts/verify.ts:109`, `board/tsconfig.json:5`, `tsconfig.native.json:17`).
- The native tests now select distinct source and generated exports. Native source uses host file tools and metadata. Its generated modules contain no Bun or Node runtime imports. The test support models the required hook operations rather than copying the entry algorithm (`tests/native-modules.test.ts:15`, `tests/lib/native-host.ts:25`).

## Issues

### Critical

None found.

### Important

### I1 — Set the Bun isolation environment at the board terminal boundary

**Files:** `board/server.ts:66`, `board/server.ts:313`, `board/runtime.ts:25`; covering fixture at `tests/board-agent.test.ts:52` and `:65`.

`bindRuntime` recognizes the full isolated shebang, then replaces it with the selected Bun and four flags. This bypasses the shebang assignments `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` and `DO_NOT_TRACK=1`. The board data executor sets those variables. Run and Resume instead send `lineOf(...)` to a terminal. That string contains no environment assignments, and neither terminal creation path supplies them. The environment of the herdr CLI process is not the environment of an existing terminal shell.

Thus a terminal with absent or different values starts the first Celetis Bun process without the required cache and reporting controls. Later `childEnv()` calls cannot establish a condition that must hold before this process starts. This conflicts with Global Constraint 7 and plan line 39.

**Observed proof:** A private macOS arm64 probe used the actual `parseConfig` and `bindRuntime` on Bun 1.4.2 (744846f84). It validated an executable with the exact `bunShebang` and a body that prints only the two variables. The terminal environment set cache to a private `terminal-cache` path and tracking to `0`.

```json
{"direct shebang":{"code":0,"cache":"0","track":"1"},"board bound argv":{"code":0,"cache":"<private>/terminal-cache","track":"0"}}
```

The bound list was `[process.execPath, --no-env-file, --no-install, --config=/dev/null, --no-macros, validatedFile, {n}]`. This proof shows the lost controls. It does not claim that a cache write or a report upload occurred.

The existing board-agent test hides this case: its pane process and shell inherit the already isolated fixture environment. Its command assertions check the executable and flags, but do not observe the environment at the first Bun entry.

**Required fix:** Put both fixed controls into the terminal invocation, or use an explicit terminal environment operation that covers both workspace and tab creation. Keep the selected Bun, exact argv quoting, completion behavior, and prior executable validation. Add a private Run/Resume case whose terminal environment is independent of the board environment. Observe the variables before launcher child dispatch can reset them.

### I2 — Run the native type probe on the selected Bun

**File:** `tests/native-modules.test.ts:33`.

The native type refusal case calls `command('tsc', ...)` directly. The pinned TypeScript 7.0.2 executable begins with `#!/usr/bin/env node` and imports `../lib/tsc.js`. This was confirmed from the private pinned installation at `.../celetis.nWpXiy/npm/lib/node_modules/typescript/bin/tsc` without executing it.

This automatic repository test therefore still requires Node on PATH. With the stated Bun toolchain and no Node, the compiler cannot start; the test fails before it can produce the required `Cannot find name 'Bun'` diagnostic. Task 9 requires JavaScript tool entrypoints to run on Bun. ADR-0025 line 69 states the same rule. The gate and the new browser refusal tests already use the selected-Bun compiler descriptor.

**Required fix:** Resolve the compiler through the existing tool helper and invoke its selected-Bun executable/arguments. Keep the native project and its specific unknown-global assertion. Add a private check with no Node executable on PATH, so a launch error cannot stand in for the native type refusal. Do not add a Node dependency or a compatibility wrapper.

### Minor

- **M1 — Open, small correction:** `tests/manual/live-acceptance.md:40` still says “lane refusal before node.” Replace this with “lane refusal before board startup.” The old runtime name gives the manual check the wrong target. This is one sentence and can join the repair wave.
- **M2 — Retain as baseline:** `.superpowers/sdd/96/comment-polish-gate.log:70`, `:76` and `:83` contain unversioned-manifest warnings and the managed-hook notice. Validation still passes at line 88 and the gate ends `verify: PASS` at line 89. The old gate evidence also has the unversioned and directory policy notices. The manifests and managed-host acceptance limits did not change. Do not add a plugin version or claim managed-host acceptance to remove these messages.
- **Earlier fixture-path minor — Closed:** `tests/lib/fixture.ts:61` now quotes the selected executable for `env -S`, including spaces. Task 2 records the real path-with-space RED/GREEN evidence.
- **Earlier board README minor — Closed:** `board/README.md:376` now names `board/fixtures/producer.ts`. The obsolete producer path is no longer the live model link.
- The Task 4 exact stderr and ownership assertion omissions were restored in their scoped fix. I found no new open minor from those records.

## Named boundary and evidence assessment

### Native canonical paths

The ADR-0026 choice is justified for this floor. `board/realpath.ts:26` uses one unconditional resolver. It rejects NUL, binds lazily, calls `realpath(path, NULL)`, copies the CString into a JavaScript string and frees the allocation in `finally`. Failure reads thread-local errno before constructing the Node-style error. Library or symbol failure stops the operation. There is no permission-error resolver fallback or handwritten symlink walker.

Canonical main/lane containment, regular-file status, execute permission and control-character checks remain after the native resolution. Optional shebang inspection adds no read permission condition for a valid native executable. The real mode-0111 and symlink case is in `board/realpath.test.ts:10` and the Linux/macOS process subset (`tests/suite.ts:7`).

The ABI, libc names and experimental FFI remain real platform costs. The supplied RED, native prototype and GREEN establish the local macOS case. They do not establish Linux. The current code gives no reason to weaken this boundary or add a second resolver. Linux CI must execute it.

### Frozen expected results and assertion records

The private capture helper records the result of the actual old command before comparing the new result. Its normalization changes only scratch checkout identity and fixture dates. I checked the retained capture sources and helper in the named private `task9-baseline` directory. The two original programs are byte-identical to base `4fe5554`:

- `scripts/capscore.sh`: SHA-256 `4aa2ebd19996ea610bdab0f4b426b4bb81f805cdbd000dcce5ec726b296dfb7e`.
- `scripts/next-step.sh`: SHA-256 `e2ca6431dbe194686e887c9259ad8eaa6cac45317ba53ecad55cf6807794e11c`.

These match the tracked reference metadata. The frozen records contain 151 scorer results and 103 resolver results. The capture log records 31 passing cases and 1,451 assertions. The current helper restores only the stated identity/date tokens and rejects missing or unused records. The approved malformed-effort and safe-integer changes stay explicit exceptions.

The ignored assertion/caller map spans all nine tasks and records expanded parameters, caller changes, removed-language cases, fixes and final entry inventories. Its later sections supersede the earlier intermediate counts and native-path concern; they do not erase those records. The tracked gate/text/pool map has 323 rows. A static check found every recorded replacement file and test name. The caller inventory has 58 removed paths. The final tracked set has 218 paths, 107 TypeScript files and 48 automatic entries. All three landing files and the real native-path process case are discoverable. The token programs have no test suffix.

A row count alone does not prove semantic equivalence. I also checked the exact Resume, closedAt, setup ownership/refusal, landing SHA/rerun, process descriptor and native source/generated boundaries against their code and test assertions. I found no additional unmapped assertion in this broad pass. I1 and I2 are gaps that the current focused evidence does not close.

### Generated and vendor identity

All eight delivery modes and SHA-256 values match the supplied final proof. The launcher is 0755; the other seven outputs are 0644. Source roles and output names match `scripts/build.ts` and `.gitattributes`. I did not rebuild or edit generated files.

The vendor parser, API declaration and licence are byte-identical to base. Parser SHA-256 is `4ff31df191fa26a9cf07ef43fd233964e554426bd0dd314009bd9e1a377f0bd7`. The gate checks that identity. Historical ADRs remain unchanged; ADR-0025 names the clauses it replaces, and ADR-0026 records the extra native boundary.

### Rulings and process gaps

| Ledger line | Assessment |
| --- | --- |
| 70 | Focused checks during tasks, one full suite through final CI: sound; followed in this review. CI remains pending. |
| 71 | Old entrypoints only during internal layers: sound; the final tree removes them. |
| 85 | Move launcher-only config assertions to Task 2: sound sequencing; their final replacements and the two import guards are recorded. |
| 109 | Use native env/kernel failures when Bun cannot start: a stated runtime change with no wrapper. Below-floor Bun keeps status 2. Linux kernel proof remains for CI. |
| 133 | Remove cygpath/MSYS conversion: correct for the supported platforms and the no-compatibility rule. |
| 162 | Reject non-string reviewer effort: correct schema enforcement; the accidental jq acceptance is not retained. |
| 170 | Use safe integer bias/attempt bounds: correct for schema-1 JavaScript numbers; the documentation and validation agree. |
| 245 | Keep the true Task 5 chronology: correct. Minimal missing-module RED cases do not prove a full test-first port. Current tests and process evidence reduce the product risk, but cannot repair that historical deviation. |
| 273, 280 | Split landing tests into three natural entries: justified by measured file deadlines; one private helper and discovery retain the cases. |
| 330, 371 | Defer the public board runtime binding until cutover, then validate the executable before binding: sound. Selected executable and flags are now bound, but I1 leaves the environment part incomplete. |
| 391 | Use one unconditional lazy libc realpath primitive: justified by the five failed standard floor APIs and actual native proof. Allocation/errno handling is small and clear; Linux execution remains required. |

Task 8 also has a real historical gap: its first source-labelled native entry checks reached generated delivery twice. The current typed URL map, distinct export identities and dual contract runs correct the final test target. They do not prove source RED before implementation. The report says this clearly. I do not require a false retrospective RED replay. Each new repair must have a complete failing regression before its implementation.

## Declined to judge

Each item below is explicit. Required checks stay open where stated.

- **Live installed-host lookup, refresh, new session, exact live Resume and disposable landing:** UNRUN under the user's “ignore live checks” instruction. Deterministic stubs do not prove current signed-in host behavior.
- **Actual herdr terminal protocol and browser actions at desktop and 375×812:** UNRUN under that same waiver. The environment defect in I1 is still judged from code and an independent private process boundary; no live terminal success is inferred.
- **Actual generated native-module loading and token-using step/custom checks:** UNRUN under the waiver. Bun import/contract tests do not prove native-host loading.
- **Linux glibc/musl FFI, descriptor inheritance, signals and descendant cleanup:** no Linux runtime result is supplied yet. This is required plan evidence assigned to final CI, not a waived or passed check.
- **Current-head two-path final build, final macOS process acceptance and final full-suite result:** these belong to the controller's Final Verify and final PR CI. The earlier focused/build evidence is not relabelled as these final checks. I did not repeat them.
- **Affected-product list, stopped old processes, installed product Bun, reviewed setup/settings and current-build cutover readiness:** no maintainer report exists. The review has no basis to approve these external product acts, and it changes no other product. This remains a separate before-Land precondition.
- **Native Windows/MSYS runner support:** a stated non-goal. Native host path strings do not establish runner support.
- **Existing installed-resource lifetime, changed-pair retry, managed setup/bootstrap and organization-managed hook limits:** the plan retains these earlier acceptance gaps. No new solution or acceptance claim is judged here.
- **A stricter multibyte capture postcondition for the old board executor:** a private 17-byte probe returned 17 lambda characters, or 34 bytes, on both Bun 1.4.2 and reference Node 26.12.0 with the same execFile API shape. An odd-byte default-boundary Bun probe also retained one extra byte; an aligned default probe kept the limit. This is a pre-existing truncation defect, not a proved port regression. I set aside changing that old behavior in #96. The executor must rule on this disposition if it treats the stated byte cap as a new strict postcondition. The earlier provisional Important classification was withdrawn after the reference check.

## Recommendations

Use one repair wave for I1, I2 and the small M1 text correction. Use the existing runtime and tool helpers. Keep the board executable trust checks and generic native producer contract. Then use one scoped re-review of those repairs.

Retain the honest Task 5 and Task 8 test-order records. Publish the ignored assertion map and runtime evidence before the last landing act, as the plan requires; do not force-add the map. Run the full suite only through the final CI path. Require the current-build maintainer cutover report before Land.

## Assessment

**Spec compliance: Issues found.** I1 loses two required controls at the board terminal start. I2 leaves a Node interpreter requirement in an automatic test. The conversion otherwise follows the approved structure and recorded scope rulings. The two historical test-order deviations remain recorded.

**Code quality: Needs fixes.** The shared modules, ownership checks, generation boundary and trust checks are clear. The two remaining caller gaps are small, concrete corrections.

**Ready to merge: No.** Repair I1 and I2, then complete their scoped review. Final required process/build/full-suite CI evidence and the current-build maintainer cutover report also remain open. Waived live checks remain UNRUN. No result in this report declares them passed.
