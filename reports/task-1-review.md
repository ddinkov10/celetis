### Spec Compliance

- ✅ Spec compliant with the approved Task 2 sequence. `scripts/lib/config.ts:345` exports the typed reader. `scripts/lib/config.ts:358` limits CLI output and exit 2 to the main entry. The diff does not change parsing or vendor code.
- ✅ `scripts/lib/process.ts:10` keeps the 64 MiB default. `scripts/lib/process.ts:25` forces argument-array execution, UTF-8, and `shell: false`. `scripts/lib/process.ts:35` keeps numeric and signal exit statuses. `scripts/lib/process.ts:44` closes failed-child output pipes. `scripts/lib/process.ts:53` supplies the startup isolation flags.
- ✅ All nine required implementation and gate files have changes. `tsconfig.runtime.json:2` includes scripts and Bun tests. `tests/verify.test.sh:100` adds the test-fixture type error. The parent gate evidence ends with `verify: PASS` at `.superpowers/sdd/96/task-1-parent-gate.log:103`.
- ✅ `docs/superpowers/plans/96-port-map.md:5` records 165 ported assertions and 47 retained assertions. Each retained assertion has its own Task 2 row. `docs/superpowers/plans/96-port-map.md:228` records both conditional guard obligations. This meets the approved sequence change.
- ⚠️ Final replacement of the 47 launcher assertions and both guards belongs to Task 2. This diff cannot prove that later work. The full suite belongs to the final tree. Live acceptance is UNRUN, as the user instructed.

### Strengths

- `scripts/lib/config.ts:345` adds an API around the existing reader with a small change. `scripts/lib/config.ts:358` keeps import and CLI behavior separate.
- `scripts/lib/process.ts:11` forces cache and crash-report settings in the child environment. `scripts/lib/process.ts:16` removes ordinary `node_modules/.bin` PATH entries. `scripts/lib/process.ts:27` bounds oversized output by UTF-8 bytes without keeping an incomplete final character.
- `tests/process.test.ts:1` and `tests/config.test.ts:1` use the real reader and child processes. The recorded focused run has 174 passes, zero failures, and 749 assertions. It checks output, error statuses, startup payload controls, and cleanup.
- `tests/lib/fixture.ts:35` creates private temporary state. `tests/lib/fixture.ts:90` removes it in a `finally` block.

### Issues

#### Critical (Must Fix)

- None.

#### Important (Should Fix)

- None.

#### Minor (Nice to Have)

- `tests/lib/fixture.ts:58`: The stub shebang puts `process.execPath` into an `env -S` argument string without quotes. A Bun installation path with a space is split into separate arguments. These tests then fail before they reach the behavior under test. Quote the executable for `env -S`, or launch stubs with the selected Bun executable and argument arrays.
- `.superpowers/sdd/96/task-1-parent-gate.log:64`: The gate evidence contains existing plugin validation warnings. `.superpowers/sdd/96/task-1-parent-gate.log:85` also contains the existing directory-submission LICENSE message. The gate still passes at line 103. This is baseline output noise, outside the changed code. It does not block Task 1.

### Checks

- The first command confirmed the requested path and `feat/96-intent-the-whole-toolchain` branch. The checkout and index were not changed. Only this review report was written.
- The diff output was truncated on its first read. The missing middle section was read from the diff package. No changed source file was read separately.
- Named risk: The new helper could change the board's result contract. One focused check read `board/server.mjs:61`. The new helper keeps its result fields, UTF-8 output, default byte limit, and fallback error message.
- Named risk: Destroying pipes on a failed exit could drop output that remains in a pipe. One focused Bun 1.4.2 probe used synchronous writes to both output streams, followed by exit 7. `run` returned exit 7 and exactly 2,097,152 bytes from each stream. The recorded tests also cover concurrent output and a descendant that holds the output pipe open.
- Named risk: The approved sequence could leave an old assertion without a destination. The assertion map was checked. It gives a separate destination for all 47 retained assertions and both guards.
- The recorded focused test log and the parent gate log were read. Successful tests and the gate were not repeated.

### Assessment

**Task quality:** Approved.

**Reasoning:** The change meets Task 1 and the approved sequence. The reader API, process limits, failure output, startup isolation, and gate coverage have direct evidence. The remaining fixture-path issue is minor.
