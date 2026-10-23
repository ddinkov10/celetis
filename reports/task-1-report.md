# Task 1: typed config and Bun process foundations

Status: DONE. Commit: `e5643bc` (`feat(runtime): add typed config and Bun process primitives`). The tracked worktree is clean.

Lane: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`

Branch: `feat/96-intent-the-whole-toolchain`

## Implementation

- Export `Config`, `ConfigError`, and `readConfig(checkout)`. Keep CLI output and status 2 under `import.meta.main`. Imports of config and process are silent and return control to their caller. Parsing and vendor code have no behavior change.
- Add `run(file, args, options)` with the board's code/stdout/stderr result. It forces executable-plus-argv, `shell: false`, UTF-8 output, the 64 MiB default, safe child PATH, cache suppression, and crash-report suppression. It retains failed statuses, signal statuses, and timeouts. A failed exit closes captured pipes so a descendant cannot hold the result open. Tests check complete output on failure.
- Add `bunArgs(entry, args)` with `--no-env-file --no-install --config=/dev/null --no-macros`. Callers supply `process.execPath`. Long-lived handles and inherited streams remain direct `spawn` calls, as the brief requires.
- Add private repository/stub fixtures and Bun reader/process tests. Extend strict runtime type checks to Bun tests and add a gate regression for `tests/lib/bad.ts`.

Changed files: `scripts/lib/config.ts`, `scripts/lib/process.ts`, `scripts/tsconfig.json`, `tsconfig.runtime.json`, `scripts/verify.sh`, `tests/lib/fixture.ts`, `tests/config.test.ts`, `tests/process.test.ts`, and `tests/verify.test.sh`.

The [coverage map](/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/docs/superpowers/plans/96-port-map.md) stays ignored on disk per the controller's instruction. It pins every original assertion to `4fe5554c4c09ec522aae410afde6a298787a04a9` and expands every parameter value.

## RED/GREEN and checks

All commands ran in the lane. These are the exact private runtime and tool roots used below:

```sh
task_bun=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun
task_tools=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy
```

The runtime reports Bun `1.4.2` (`744846f84`). Its help supports `--no-macros`.

The first RED and final GREEN used the same focused command:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 "$task_bun" --no-env-file --no-install --config=/dev/null test tests/config.test.ts tests/process.test.ts
```

RED exited 1: the process module was missing, and the reader had no `ConfigError` export; `0 pass, 2 fail, 2 errors`. GREEN exited 0: `174 pass, 0 fail, 749 expect() calls`, 7.72 seconds across both sequential test files. See [focus.log](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.rYt22d/focus.log).

The retained focused shell check used the same private runtime/tool PATH:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH="${task_bun%/*}:$task_tools/tools/bin:$task_tools/npm/bin:$PATH" /bin/bash tests/config.test.sh
```

Result: exit 0, `212 cases; 0 failures`. See [config-shell.log](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.rYt22d/config-shell.log). The old launcher functions and extracted CLI still work together.

The final staged gate used:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH="${task_bun%/*}:$task_tools/tools/bin:$task_tools/npm/bin:$PATH" npm_config_prefix="$task_tools/npm" scripts/verify.sh
```

Result: exit 0, last line `verify: PASS`. See [gate-final.log](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.rYt22d/gate-final.log). Plugin validation retains its existing successful result with directory-submission warnings. The controller's separate gate also passed in `.superpowers/sdd/96/task-1-parent-gate.log`.

The gate regression used:

```sh
env -u npm_config_prefix BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH="${task_bun%/*}:$task_tools/tools/bin:$task_tools/npm/bin:$PATH" NPM_CONFIG_PREFIX="$task_tools/npm" /usr/bin/time -p /bin/bash tests/verify.test.sh
```

With the old scripts-only compiler scope, RED exited 1 with `tsc does not name tests/lib/bad.ts`. With the runtime scope, GREEN exited 0 with `PASS: verify gate`, real time 12.48 seconds. See [RED](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.rYt22d/verify-red-clean.log) and [GREEN](/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.rYt22d/verify-green-final.log). `git diff --cached --check` passes. Vendor diff is empty.

## Findings from failing checks

- `process keeps the 64 MiB result limit` received 67,174,400 bytes for a 67,108,864-byte limit. A direct Bun probe confirmed `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`. The helper now bounds that error's output in bytes.
- `process result limit counts UTF-8 bytes` received `λ�` instead of `λ` at a three-byte limit. The helper now retains complete characters within the limit. Its focused RED then GREEN passed.
- `process timeout stops its child` and the elapsed-time check in `failed child does not wait for a descendant output pipe` caught shebang launch cost in the fixture. Their selected-Bun launches now check the intended timeout and pipe behavior directly.
- `invalid config starts no global preload` had an incorrect positive-control assumption. On 1.4.2, an implicit global runtime preload did not run. The custom-config eval control also did not run it. The final case keeps the global file present and uses explicit `--preload` as its positive payload control.
- An inherited lowercase `npm_config_prefix` made `tools_missing_bun_types` fail by overriding its fixture setting. The regression command now isolates that inherited variable. A transient `clean_drift` failure reported test formatting; Biome fixed it before the final passing checks. Explicit `NodeJS.ProcessEnv` annotations resolved the development type errors for dynamic keys.

## Startup evidence

All payloads run only in private scratch state. Product bunfig, `.env`, macro, and shadow-executable cases have positive controls. Valid and invalid reader starts remain isolated. Separate checks cover auto-install, cache writes, and crash-report settings.

For the global-file test, HOME and XDG_CONFIG_HOME name the private home containing `.bunfig.toml`. With private product cwd, Bun 1.4.2 received `--no-env-file --no-install --no-macros -e 1`: exit 0, marker absent. The same command with `--preload <private preload.ts>` before `-e` returned 0 with the marker present. `invalid config starts no global preload` passes. It does not claim that runtime starts implicitly load that file. The primary [Bun config reference](https://bun.com/docs/runtime/bunfig#global-vs-local) says package-manager commands read global bunfig; the test is the direct evidence at the 1.4.2 floor.

## Deferred Task 2 assertions

The controller approved the sequence: port strict-reader/process boundaries now; retain launcher-only assertions in the working shell test until Task 2 supplies their interfaces. Of 212 original assertions, 165 are ported and 47 remain in that test. No assertion is dropped. The coverage map gives every row and its replacement obligation. These are the exact deferred names:

```text
source_does_not_discover main_checkout main_from_subdir main_from_lane main_git_failure main_git_failure_stdout
host_hint_6 host_hint_9 host_hint_11 host_hint_13 host_hint_15 host_hint_19 host_hint_21 host_hint_23 host_hint_25 host_hint_27
host_hint_29 host_hint_31 host_hint_33 host_hint_35 host_hint_38 host_hint_41 host_hint_43 host_hint_45 host_hint_62 host_hint_97
host_hint_171 host_hint_173 host_hint_181 bun_floor_is_set bun_floor_agrees start_folder_has_no_effect
product_copy_names_the_plugin_launcher product_copy_message drive_path_C:/Users/me/repo drive_path_c:\Users\me\repo
bun_sends_no_crash_report missing_bun old_bun_host_hint_0.9.0 old_bun_host_hint_1.2.10 old_bun_host_hint_1.4.1
old_bun_host_hint_1.4.2-canary.1 host_hint_203 host_hint_205 host_hint_207 broken_bun broken_bun_host_hint
```

The source's two conditional guards, `celetis_config_main_exists` and `celetis_config_read_exists`, report only missing functions and are not in the 212 passing results. The map records both for Task 2's sourced-interface removal and replacement consumer checks. The compound startup/crash-report rows retain their host-hint part for Task 2; Task 1 checks the reader/process part.

## Self-review and limits

The concrete risks are covered: config byte/metadata parity, exact CLI output and status, silent imports, argument boundaries, concurrent output, complete failed output, UTF-8 limits, signals, timeout cleanup, held output pipes, and startup injection. No new test executes a shell fixture. Executable stubs are TypeScript. New production code adds no comments.

The runtime compiler scope includes all new files. Existing Claude native tests retain a separate host environment for the later hook task. Old command implementations stay working until Task 9 removes them. The ignored map remains for the controller's final publication. There is no open Task 1 code concern; the listed Task 2 obligations remain part of the complete feature.

The full suite is reserved for the final landing tree and CI. No runner, live installation, issue mutation, push, or landing ran. The user said to ignore live checks.
