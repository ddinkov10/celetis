# Task 5 report: Runner, refresh and sessions

Status: DONE_WITH_CONCERNS. The implementation and the macOS checks are complete. Linux runtime acceptance is UNRUN because no Linux executor is available. Live host sessions and real plugin updates are UNRUN under the user's waiver.

Worktree: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`.
Branch: `feat/96-intent-the-whole-toolchain`.
BASE: `2192c298d122db33a2a0d53c8f9800ff03c61edb`.
The first command confirmed the path, branch and HEAD. No main-checkout source was changed. No subagent, full suite, live runner, push, landing or issue mutation ran.

## Change

- `scripts/lib/update-lock.ts` binds system `flock(2)` with `bun:ffi`. It selects libSystem on macOS, or glibc/musl library names on supported Linux architectures. It ships no native binary or interpreter helper.
- `UpdateLock` keeps the per-host advisory lock, a 120-second monotonic total deadline, a 50 ms poll, runner-death checks, and TERM then KILL group cleanup. Child commands receive the same open file description as descriptor 3. Close follows cleanup. The code never explicitly unlocks the descriptor.
- `scripts/plugin-update.ts` keeps the selected host's command order and returns only the installed root on CLI stdout. The existing `installedRoot` and `codexRequest` operations keep their validation and pass descriptor 3 to nested host commands.
- Descriptor-bound Claude lookup stderr now goes straight to the updater's capture file. This keeps the original failure cause if the lookup receives TERM before it can return its result.
- `scripts/lib/session.ts` owns schema 1, its six exact keys, strict UUID checks, atomic private-file replacement, saved-turn checks, host arguments, observation and startup diagnostics. The required `readSession`, `writeSession` and `verifySavedSession` interfaces are exported.
- `scripts/launcher.ts` uses the shared session selection and serialization. The duplicate typed validator was removed. Exact snapshot and explicit-host conflict checks remain.
- `scripts/celetis-flow.ts` exports `main(argv)`. It keeps issue and automatic Git compare-and-swap locks with PID/start identity, the private start signal, foreground stdin and signal handling, the 60-second identity deadline, and repeated resolver/idle checks before `/exit`.
- Resume uses the saved host and exact ID. It takes only its issue lock, performs no refresh, and starts no watcher. The live runner name is `celetis-flow.ts`; the resolver's paired landing name is `land.ts`.
- Sessions still start in the main checkout. The old runner did not call the worktree command, so this change adds no worktree call and parses no setup stdout as a path.
- The old entrypoints remain operational internal references until Task 9. They are not fallbacks for a typed command. The copied delivery file has unchanged bytes against BASE and mode `-rwxr-xr-x`.

The source changes are the seven script files above. The test changes are `tests/host-session.test.ts`, `tests/celetis-flow.test.ts`, `tests/runner-lock.test.ts`, `tests/runner-lifecycle.test.ts` and `tests/lib/runner-fixture.ts`. The current verify gate already classifies TypeScript and type-checks these files, so it needed no new file-type rule.

## TDD evidence

All commands used the worktree above. The pinned executable was:

```text
/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun
```

It reported `bun test v1.4.2 (744846f84)`. Each control/test command used `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1` and `--no-env-file --no-install --config=/dev/null --no-macros`. Child Celetis programs use `process.execPath`.

Initial RED commands used that executable and those flags with `test tests/<file>.test.ts`, separately for the four files. Each returned `0 pass`, `1 fail`, `1 error` because its implementation module was absent:

| File | RED log |
| --- | --- |
| runner-lock | `task-5-lock-red.log`: missing `scripts/lib/update-lock.ts` |
| host-session | `task-5-host-session-red.log`: missing `scripts/lib/session.ts` |
| celetis-flow | `task-5-celetis-flow-red.log`: missing `scripts/celetis-flow.ts` |
| runner-lifecycle | `task-5-runner-lifecycle-red.log`: missing `scripts/lib/session.ts` |

These first RED entry files were minimal. The full parameter and assertion sets were added during the port. This report does not claim that each of the final 205 cases ran before all implementation code existed.

The lock's four real-process checks were written first. Only after their pinned-runtime proof passed did session and runner implementation continue. The first process inspection was denied by the sandbox. That run was not accepted as proof. Authorized escalated access then passed all four checks in 1.64 seconds, in `task-5-lock-proof-escalated.log`.

Two later RED checks found production defects and passed after the fixes:

- `task-5-flow-green.log` contains the failing Claude list-timeout check: the original stderr cause was missing. The descriptor-bound stderr change fixed it. `task-5-flow-fix.log` then passed that check and five related runner cases in 5.23 seconds.
- `task-5-root-path-red.log` contains the moved-root failure with trailing spaces. `trimEnd()` removed valid path characters. The runner now removes only final LF characters. The full final flow file passes the ordered refresh and exact moved-root argument checks.

## Final checks

The four test entries ran separately. Each command had the form:

```text
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 <pinned-bun> --no-env-file --no-install --config=/dev/null --no-macros test tests/<file>.test.ts
```

| File | Result | File time | Final log |
| --- | --- | --- | --- |
| host-session | 80 pass, 0 fail; exit 0 | 28.59 s | `task-5-session-final.log` |
| celetis-flow | 70 pass, 0 fail; exit 0 | 16.37 s | `task-5-flow-final.log` |
| runner-lock | 23 pass, 0 fail; exit 0 | 11.39 s | `task-5-lock-final.log` |
| runner-lifecycle | 32 pass, 0 fail; exit 0 | 20.68 s | `task-5-lifecycle-final.log` |

Total: 205 passing tests. Each file is below 30 seconds. The final lock self-review made the PID-reuse entry a session owner, so process start identity is decisive independently of executable-name rejection. The four ownership cases were then rerun; their final log is `task-5-ownership-final.log`.

The fast gate used the private pinned tools and npm prefix from `worker-context.md`, with the pinned Bun directory first on PATH:

```text
PATH=<pinned-bun-dir>:<private-tools>/bin:<private-npm>/bin:$PATH
npm_config_prefix=<private-npm>
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 scripts/verify.sh
```

The final staged gate ends `verify: PASS` and returns exit 0. Its log is `task-5-gate-final.log`. Biome, strict TypeScript, tracked-file checks, text checks and the existing validators pass. The known Claude directory checks still report the version, license and icon notices. They do not change the validator result. No new warning was introduced.

An earlier gate ran after a denied Git-index write. It is not the staged-gate evidence. Git staging was then completed with authorized escalated access, and the gate ran again on all new tracked files. A final gate also follows the tightened PID-reuse test. No full suite ran.

## Real process and lock evidence

The platform was macOS arm64, with Bun 1.4.2 (744846f84). The following checks use real PIDs, real process groups, Git refs and system advisory locks:

| Check | Observed result |
| --- | --- |
| Independent opens of the same lock | The second open cannot lock until the first descriptor closes. |
| Updater/helper SIGKILL | The real command keeps descriptor 3 and excludes a second updater. |
| Nested Claude and Codex lookup | The lock remains after helper death, lookup-process death and host-process death. The final descriptor-holding descendant must exit before another open can lock. Final ps tables show no processes. |
| Real 400 ms timeout | A TERM-ignoring command and descendant are absent from ps after TERM/KILL cleanup. `descendantsAliveAfterTimeout` is empty. |
| Total 120-second deadline | Private clocks prove the same deadline includes lock wait and later commands. Full runner timeout cases use the real process group cleanup. |
| INT, TERM and HUP during update | Helper status is 1. Each command and descendant stops, and cleanup completes in less than five seconds. |
| Runner death | The surviving helper detects the dead runner and stops its command group. |
| Successful parent with a pipe-holding descendant | Cleanup closes the inherited writers and returns the exact captured stdout without waiting for pipe EOF indefinitely. |
| Two repositories | Updates never overlap, including when the first helper receives SIGKILL while its update survives. Both full runners and direct helpers are covered. |
| Git stale-owner races | Both contenders read the old ref. Compare-and-swap rejects replacement of a new live owner. Git log remains readable and final refs are empty. |
| PID reuse and executable name | Separate cases reject a wrong start identity and a live process with the wrong runner name. |
| Real zombie | A private Bun parent is stopped while its child exits. ps observes Z. The zombie session cannot retain an issue lock. |
| Replacement owner | The previous runner cannot delete a different owner's ref. |
| Parent SIGKILL before registration | `startedBeforeLockRegistration` is false. No host starts. |
| Parent SIGKILL after registration | The foreground keeps the issue ref, and automatic mode keeps the same session in both refs. Exit makes the refs stale and available. |
| Foreground INT, TERM and HUP | Runner statuses are 130, 143 and 129. The issue lock stays held until foreground exit. |
| Codex lookup timeout/interruption | Runner statuses are 1 and 143. The original cause appears once. RPC descendants stop, private temporary files are removed, and both lock types are free. |

The FFI library/API reference is [Bun FFI](https://bun.sh/docs/runtime/ffi). The open-file-description lock rule is in [flock(2)](https://man7.org/linux/man-pages/man2/flock.2.html). The runtime tests above, rather than the documentation alone, establish the local decision point.

## Coverage map and helper changes

`docs/superpowers/plans/96-port-map.md` now has 234 source assertion rows pinned to baseline `4fe5554`: 50 host-session, 141 celetis-flow, 9 runner-lock and 34 runner-lifecycle rows. The extra Codex stderr multiplicity branch is also listed. The map expands every host/status/step/identity/lifecycle parameter and lists each path caller and helper change. This existing map and this report are ignored task artifacts; neither was force-added.

The test helper changes were:

1. A polling semaphore could let new cases take slots before old queued cases. A fair FIFO queue now permits eight private cases at once.
2. A killed process and closed stdout/stderr are separate events. Tests now expose `exited` separately from `result`. The SIGKILL tests first observe process exit, then release the blocked Git operation or finish the foreground. This removes a test deadlock without removing a live-process check.
3. A file-wide `afterEach` child set killed other concurrent cases. Fallback cleanup now runs after all cases, and only for child objects that still run. Per-case cleanup remains.
4. The old sleep stub reduced one-second watcher polls to 50 ms. A private typed wrapper restores that test-only speed. It does not change the 60-second deadline, the 5000 ms herdr wait, or updater clocks.
5. The initial five-second fixture condition bound was too short for eight concurrent starts. The lifecycle baseline permits 30 seconds. The typed condition bound is now ten seconds. Tests keep their 25-second per-case bound and the 30-second file requirement. The isolated start check passes in 2.00 seconds; the full final lifecycle file passes in 20.68 seconds.
6. The first lane-location fixture changed its config without a commit, so the real resolver correctly stopped on a dirty tree. The fixture now commits that config, as the baseline case does.

## Self-review and remaining concerns

The required public interfaces, record keys, command argument arrays, lock ordering, inherited stdin, saved-host selection, snapshot check and failure diagnostics were checked against the old entrypoints. The final diff has no new code comments. The copied launcher bytes and executable mode remain unchanged. The main checkout is untouched.

The initial missing-module RED files were minimal; full case expansion followed during implementation. The controller should use the full assertion map and real-process evidence when reviewing that test sequence.

Linux runtime acceptance remains UNRUN. The parent confirmed that docker, podman, limactl, colima and qemu-system-aarch64 are absent. A Linux executor must still run the pinned-floor lifecycle subset. No weaker lock, interpreter helper or synthetic cleanup check was substituted.

Live host and real plugin update acceptance remain UNRUN under the user's waiver. The old entrypoint removal, final delivery cutover and full CI suite remain assigned to later tasks.

Commit: `0cc9dbf` — `feat(runner): port refresh and session control to Bun`.

The final staged gate after the ownership check ends `verify: PASS` (exit 0). The four tightened ownership cases pass in 2.38 seconds. The post-commit tracked tree is clean.

## Review fix 1

BASE: `0cc9dbf4a06066238e6dbc85054965d04827c3c8`. The first command confirmed the same lane path and branch, this HEAD, and a clean tracked tree. The two Important findings in `task-5-review.md` are fixed.

### Change

`run()` now checks the remaining byte capacity before it appends a chunk in the inherited-descriptor branch. Each full stream ignores later chunks. Only the first overflow sends TERM. The failure is retained as a maxBuffer error, so an empty child stderr gets the error message. A captured child stderr keeps the same precedence as the existing branch. `limitOutput()` shares the existing UTF-8 boundary rule between the two branches. No final-only truncation serves as the capture limit.

Two new real-child cases in `tests/process.test.ts` cover stdout and stderr. The child emits an initial value and an overflow value, handles its first TERM, then writes again. A private marker confirms that the write after TERM completed. Instrumented byte-count reads of the retained strings must stay within the configured 17-byte limit. The returned string must contain eight complete lambda characters, and stdout overflow with no child stderr must retain a maxBuffer diagnostic. A third new case checks a successful UTF-8 character split across two writes on the descriptor path.

The board contract case now reads `issue-4.json.closed_at` and compares `closedAt` with that exact value. The assertion-map row for baseline `tests/celetis-flow.test.sh:928` now names this check. The map also states that the initial truthiness check did not preserve the baseline assertion.

Tracked files changed: `scripts/lib/process.ts`, `tests/process.test.ts`, and `tests/celetis-flow.test.ts`. The existing ignored assertion map was updated. No unrelated source or test file changed.

### RED before the production fix

The complete new buffer regression was written before `scripts/lib/process.ts` changed. The final RED child handles its first TERM only, so repeated parent signals cannot form an output feedback loop. The command was:

```text
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test tests/process.test.ts --test-name-pattern 'descriptor capture'
```

Result: `1 pass`, `2 fail`, exit 1, 0.482 s. Both overflow cases reached the real write-after-TERM marker, then failed with `Expected: <= 17`, `Received: 262`. The successful split-UTF-8 case passed. Log: `task-5-fix-1-process-red.log`.

This is new RED evidence for the buffer defect. It does not change or replace the earlier minimal-RED chronology.

### GREEN and covering checks

The same pinned executable, environment variables and four isolation flags were used for these commands:

```text
<pinned-bun> --no-env-file --no-install --config=/dev/null --no-macros test tests/process.test.ts
<pinned-bun> --no-env-file --no-install --config=/dev/null --no-macros test tests/celetis-flow.test.ts --test-name-pattern 'board contract 1 keeps|installed list failure|update_hang list'
```

- Process file: `26 pass`, `0 fail`, exit 0, 5.01 s. Log: `task-5-fix-1-process-green.log`. This includes the existing 64 MiB limit, smaller limit, UTF-8 boundary, status and process-helper cases, plus all three new descriptor cases.
- Scoped flow cases: `3 pass`, `67 filtered out`, `0 fail`, exit 0, 2.71 s. Log: `task-5-fix-1-flow.log`. Only the restored board contract case and the two affected Claude list lookup cases ran.
- Biome: `Checked 3 files`, `No fixes applied`. Log: `task-5-fix-1-format.log`.
- The staged fast gate used the private tools/npm environment and the pinned Bun directory first on PATH, as in the initial report. The exact gate command is `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 scripts/verify.sh` in that environment. It ends `verify: PASS`, exit 0. Log: `task-5-fix-1-gate.log`. The existing version/license/icon directory notices remain unchanged.

No full suite, complete flow file, unrelated passing file, live host session or real plugin update ran in this fix round.

### Self-review and concerns

The returned capture prefix stays within the byte limit and ends on a complete UTF-8 character. A stream that overflowed cannot append later data, including data written after TERM. The default run branch uses the same UTF-8 truncation helper as before. The restored close-time comparison uses the fixture value directly.

Linux runtime acceptance remains UNRUN. The initial full-port test-first sequence risk remains recorded. This fix does not manufacture retrospective RED evidence for the initial port.

Fix commit: `3669563` — `fix(process): bound inherited command capture`. The tracked worktree is clean after this commit.
