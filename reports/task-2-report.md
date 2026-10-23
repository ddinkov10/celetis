# Task 2: standalone TypeScript launcher

Status: DONE. Commit: `1ccb532ca9d69376f8857b69d33d2a1aa3530784` (`feat(launcher): build the standalone Bun launcher from TypeScript`). The tracked worktree is clean.

Lane: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`

Branch: `feat/96-intent-the-whole-toolchain`. Base: `e5643bc853712795eeb859f0b05559460818b2da`.

## Result and scope

The launcher selects the host, discovers its enabled installation, checks the whole main config before project commands, and starts the installed `.ts` command with the selected Bun and exact argument boundaries. `process.execve` keeps the launcher PID, inherited streams, and native signal behavior. There is no launcher parent after dispatch. Resume uses the exact Git common directory, validates the complete saved record, selects its recorded host, and passes the sorted record to the runner.

`host.ts` exports the required `Host`, `selectHost`, `installedRoot`, and `codexRequest` interfaces. It also exports the shared error, runtime, and Git helpers. Codex replies retain the two ten-second request deadlines, notification and unrelated-ID handling, fragmented reads, original error text, and bounded TERM/KILL cleanup. Only its own process is stopped.

`build.ts` has one delivery target. Bun 1.4.2 produces a readable ESM bundle with a stable name and the complete isolated shebang. It has no dependency install, source map, clock input, install hook, or runtime build. `--check` compares bytes and mode without writes. Build failure, missing imports, missing/stale output, mode 0644 versus 0755, another checkout path, and the exact generation pin have tests. The build binds cwd to its source root because Bun's readable source labels use cwd.

New files: `scripts/launcher.ts`, `scripts/lib/host.ts`, `scripts/root.ts`, `scripts/build.ts`, `tests/build.test.ts`, and `tests/launcher.test.ts`. Existing helpers changed: `scripts/lib/config.ts` exports its floor and snapshot reader; `scripts/lib/process.ts` exports its existing child environment logic; `tests/lib/fixture.ts` handles a Bun path with spaces. No vendor code changed. Existing `*.ts` gate classification and strict runtime compilation cover all new files.

The public `scripts/celetis`, `tests/config.test.sh`, and `tests/launcher.test.sh` have no diff. The proposed executable exists only in [private scratch](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/proposed/scripts/celetis), mode 0755, 219,990 bytes. [Generation log](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/build-final.log).

The [ignored coverage map](/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/docs/superpowers/plans/96-port-map.md) now maps all 47 deferred config assertions, both conditional sourced-function guards, and all 123 expanded legacy launcher assertions. It also records the production and test path callers. Both old test files stay intact until Task 9.

## RED, GREEN, and gate evidence

All commands ran in the lane. The private runtime is:

```text
/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun
```

Each Bun control/test command used `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1` and `--no-env-file --no-install --config=/dev/null --no-macros`.

- Initial RED: `bun <isolation flags> test tests/build.test.ts tests/launcher.test.ts`. The missing `scripts/build.ts` stops launcher bootstrap and the build assertions fail. [Raw RED](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/red.log).
- The saved-record type regression was RED when a one-item host array was accepted. The final code requires actual host and step strings. [Raw RED](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/record-red.log).
- The copied-launcher PID/SIGKILL regression was RED: launcher PID 63887 started command PID 63901, which survived. Direct `process.execve` made this test GREEN. The same focused run checked arguments, a Bun path with spaces, stdin, and HUP/INT/TERM. [RED](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/pid-red.log), [GREEN](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/pid-green.log).
- The separate Git common-directory Resume case was RED before the path fix. [Raw RED](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/common-red.log).
- Final GREEN: `bun <isolation flags> test tests/build.test.ts tests/launcher.test.ts tests/config.test.ts tests/process.test.ts`. Result: **245 pass, 0 fail, 1,169 assertions, 20.62 seconds**. This includes 71 launcher/build cases and 174 affected foundation cases. Every file is below the 30-second limit. [Raw final GREEN](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/focus-final-4.log).
- Final gate: `scripts/verify.sh`, with the private Bun bin first on PATH, then the private `tools/bin` and `npm/bin`, and `npm_config_prefix` set to that private npm directory. Result: exit 0, last line **verify: PASS**. [Raw final gate](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/gate-final-2.log). The existing plugin-directory version/icon/LICENSE messages remain; validation succeeds. `git diff --cached --check` passes.

## Startup and process findings

The copied launcher runs in a private product with no adjacent plugin files or node_modules. Tests check both hosts, strict reads before dispatch, exact arguments including quotes, Unicode, a shell payload, and an empty string, plus selected Bun identity. The shell payload creates no marker.

The full generated shebang was executed with BSD `/usr/bin/env` on macOS 26.4.1 and GNU `/opt/homebrew/bin/genv` 9.12. The GNU test changes only the interpreter path and runs the same `--agent claude root` invocation. Both return the enabled installation. The test uses `env` on Linux and skips the extra GNU comparison on a Mac without `genv`. [OS record](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/os-version.log), [GNU version](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/gnu-env-version.log). The final GREEN log contains both successful cases.

Quotes around a literal space in a macOS `env -S` shebang failed before the fixture body. A quoted `\_` escape works. The selected-Bun-path test proves both native launcher dispatch and fixture execution with that path. The original failure is in [focus-2.log](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/focus-2.log).

Some early checks hit the test helper's five-second startup limit before a host stub started. Native fixture starts cost more than repeat starts in the direct probe. The final harness shares immutable host programs, keeps case state private, limits product fixtures to four, and checks readiness of the fresh copied Bun and cygpath programs. Most behavior cases execute the copied bytes with the selected Bun and argument arrays. Separate cases still execute the native copied shebang. This leaves the production ten-second request deadlines unchanged. [Early boundary failure](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/boundary-probe.log), [early deadline/signal GREEN](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/deadline-focus.log).

The successful discovery test checks this exact order: start `codex app-server --stdio`; send initialize ID 1; accept notifications and ignore unrelated IDs; send initialized; send skills/list ID 2 with the current cwd and forceReload; receive its result; stop and reap the app-server; then dispatch. PID checks prove cleanup. EOF, bad JSON, protocol errors, flood, initialize timeout, and request timeout have separate cases.

An early missing-stub check could reach a real Codex metadata query through inherited PATH. The fixture now has only private Bun, Git, and host entries. Final checks use deterministic stubs. No live host session was started. An orphan stub from an early failed timeout was stopped; final cases check their own process cleanup. The final [process audit](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/processes-final.log) has no remaining fixture process.

The macro control uses the exact generated shebang with a small source payload and a positive control without macro suppression. Appending that payload to an already built Bun bundle was an invalid control because the bundle has Bun's build pragma. The revised test checks startup compilation directly. Product preload, environment-file, cache, crash-report, and shadow-executable checks also pass.

## Runtime exception and limits

The controller approved the missing/broken-runtime exception. The required Bun shebang runs before Celetis code. On this macOS host, missing Bun returns native status 127; the broken fixture returns 1; a nonexecutable Bun returns 126. All stop before discovery, config payloads, or dispatch. The cost is a native interpreter diagnostic instead of the old Bash-owned status-2 message. A below-floor Bun that can execute the launcher still returns the Celetis status-2 diagnostic. Each old assertion and its replacement is in the map.

Linux kernel execution and live acceptance are **UNRUN**, under the user's waiver. Portable shebang, PID, signal, timeout, and cleanup tests remain for final Linux CI. The full suite is **UNRUN**, as assigned to the final tree and CI. No runner, issue change, push, or landing was performed.

## External facts and self-review

- Bun 1.4.2 (pinned): readable ESM, Bun target, banner, and stable naming are supported. Source: Context7 `/oven-sh/bun/bun-v1.4.2`, [build reference](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/bundler/index.mdx).
- Bun 1.4.2 (observed): `process.execve` is a function and the PID test proves replacement on this Mac. [API probe](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/execve-api.log). The installed Node types state the argv/env contract. The [Bun 1.4 notes](https://bun.com/blog/bun-v1.4) confirm its failure behavior. There is no alternate dispatch path.
- Codex 0.163.0 and Claude Code 2.1.306 (installed): current CLI help supports the discovery commands. The generated Codex schema confirms initialize capabilities and skills/list cwds, forceReload, enabled, and pluginId. [CLI help](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/host-help.log), [private schema directory](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.PZJhJ8/codex-schema).

Self-review checked the required interfaces, source callers, all assertion rows, trust boundaries, exact Resume routing, PID preservation, error output/status, signal/stream behavior, build determinism, modes, and the unchanged public file. New production code has no comments. No new dependency or system runtime was installed. The remaining limits are the explicitly unrun checks above.

## Review fix 1

Fix base: `1ccb532ca9d69376f8857b69d33d2a1aa3530784`. Fix commit: `886317d9ff6c4fa5289a2c4f2feaf3c388741b28` (`fix(launcher): retain signals through host cleanup`). Status: DONE. The tracked worktree is clean.

Changed tracked files: `scripts/lib/host.ts` and `tests/launcher.test.ts`. The ignored map and this report also have updates.

`codexRequest` now stores the first interruption and applies it after app-server cleanup. It keeps the existing stderr handling and signal status. A later signal cannot replace the first status. The new tests wait until the server receives cleanup TERM, then send SIGHUP, SIGINT, or SIGTERM and a later different signal. Each case checks the first status (129, 130, or 143), server removal, and no installed command dispatch. The existing pending-reply signal case remains.

The obsolete `nativePath` helper, all `cygpath` calls, and the conversion test are removed. Host discovery uses native paths. The map records the old Bash/MSYS conversion assertion as removed with that runtime dependency. The two Windows Git-output data cases remain, as the controller ruled. Native path validation, enabled-installation checks, and all other host behavior remain covered.

All commands below used the same private Bun 1.4.2, `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1`, and `--no-env-file --no-install --config=/dev/null --no-macros`.

- RED: `bun <isolation flags> test tests/launcher.test.ts --test-name-pattern 'Codex cleanup preserves'`. Result: **0 pass, 3 fail**. Every case returned 0 and dispatched the installed command after the signal; the server was removed. [Raw RED](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.NahLHe/cleanup-red.log).
- GREEN: `bun <isolation flags> test tests/launcher.test.ts --test-name-pattern 'Codex cleanup preserves|a signal during Codex discovery'`. Result: **4 pass, 0 fail**, 2.05 seconds. [Raw GREEN](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.NahLHe/cleanup-green.log).
- Covering check after converter removal: `bun <isolation flags> test tests/launcher.test.ts tests/build.test.ts`. Result: **73 pass, 0 fail, 421 assertions**, 16.41 seconds. Both files remain below 30 seconds. This covers the native installation paths, all three cleanup signals, request deadlines, process replacement, startup isolation, Resume, and generated bytes/modes. Config and process helpers did not change. [Raw final check](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.NahLHe/focus-final.log).
- Staged gate: `scripts/verify.sh`, with the same private Bun/tool PATH and npm prefix as above. Result: exit 0, last line **verify: PASS**. The existing version/icon/LICENSE directory messages remain; no new warning was found. [Raw gate](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.NahLHe/gate-final.log).

`git diff --cached --check` passes. The public launcher and both old reference test files have no diff. The updated proposed executable is only in [private scratch](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.NahLHe/proposed/scripts/celetis); [generation log](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.NahLHe/build-final.log).

Self-review found no remaining code concern in this fix. The production ten-second request deadlines and 500 ms cleanup wait did not change. Linux kernel execution, live acceptance, and the full suite remain UNRUN under the existing instructions. No runner, issue change, push, or landing was performed.
