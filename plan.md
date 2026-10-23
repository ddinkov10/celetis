## Plan

### Your steps

**During the build.** Do these now. The build does not wait for you until it needs them.

1. Provide isolated, signed-in Claude and Codex CLI installations and a disposable GitHub repository for live checks. Needed by: Verify V2, V4, and V6.
   Report: the line `Acceptance ready: <repository>; Claude: <installation>; Codex: <installation>; disposable issue and PR changes authorized` in your `## Human steps done` comment.
2. List all affected product projects before Land. Stop their runners, sessions, and boards. Install Bun 1.4.2 or later. Prepare their reviewed TypeScript setup and owned settings changes. Needed by: Land.
   Report: the line `Cutover ready: <build SHA>; projects: <complete list, or none>; old processes stopped; Bun ready; TypeScript setup and settings reviewed` in your `## Human steps done` comment.

**After the landing.** Run these after the implementation of #96 lands. A FAIL is a new bug: use the `celetis:bug` skill with the result.

1. Run the setup skill in each affected product project to copy the new launcher. Run `scripts/celetis setup check` and `scripts/celetis --agent <host> root`. Expected: setup passes and root names the enabled installation.
2. Run `scripts/celetis --agent <host> board` and `scripts/celetis --agent <host> celetis-flow <issue>` in a terminal. After a saved turn exists, run `scripts/celetis --agent <host> celetis-flow --resume <issue>`. Repeat for each enabled host. Expected: the board works, the new step starts, and Resume opens the exact saved session.

# TypeScript and Bun Toolchain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `celetis:implement` with `superpowers:subagent-driven-development` to implement this plan task by task. Each task uses checkbox steps.

**Goal:** Convert the complete first-party Celetis toolchain to TypeScript on Bun without changing its operational contracts.

**Architecture:** Keep the current command and board boundaries. Introduce typed shared modules, port their consumers in working layers, then switch the standalone launcher and remove the old implementations in one lane. Generate readable JavaScript only for the standalone launcher, browser assets, and native host modules.

**Tech Stack:** Bun >=1.4.2, TypeScript, `bun:test`, the existing vendored `yaml` 2.9.1, standard `node:` APIs on Bun, Git, GitHub CLI, herdr, and the existing host CLIs. Keep the existing Biome, TypeScript, and actionlint checks.

**Spec:** https://github.com/ddinkov10/celetis/issues/96, body beginning `Spec: 2026-10-22`.

**Base:** #85 landed in `4fe5554` through PR #92. This issue worktree was fast-forwarded to that commit during planning. Reuse its strict reader and vendor files. Its final ADR is ADR-0024.

## Global Constraints

- Each first-party command, helper, board module, hook source, test, fixture generator, and maintenance or build program is authored in TypeScript.
- Bun 1.4.2 or later runs Celetis command processes and repository test entries. Browser delivery uses generated JavaScript. Native hook code stays in the host runtime.
- No tracked shell program remains, including extensionless executables and fixture generators. Remove first-party Perl and executable jq programs too.
- External tools receive executable and argument arrays. Use TypeScript for their output processing. Do not embed shell programs, jq expressions, or Bun Shell programs in strings.
- Keep public command basenames, flags, argument boundaries, stdout, exit statuses, and JSON contracts. Exceptions are the runtime, source paths, removed Bash sourcing interface, and TypeScript setup language specified by #96.
- Keep `scripts/celetis` as one copied, executable delivery file. Installed commands use `.ts` paths and local imports. Plugin users install no dependency and run no build.
- Keep `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` and `DO_NOT_TRACK=1`. Disable product Bun configuration, `.env`, preloads, macros, and automatic package installation before control code starts. Child Celetis processes use `process.execPath`.
- Keep the board's realpath, executable, CSP, HTTP, and contract 1 boundaries. Exclude product `node_modules/.bin` entries before executable lookup.
- Keep all current timeouts, output limits, inherited streams, signal behavior, lock ownership checks, exact Resume identity checks, and cleanup rules. Preserve errors before removing any old implementation.
- Each implementation task passes the project verify gate before review. Until Task 9, the gate is `scripts/verify.sh`; extend its tracked-file classification and type checks for each new file. After Task 9, run `bun --no-env-file --no-install --config=/dev/null scripts/verify.ts` with the pinned build runtime. Check both script executability and generated-file bytes.
- Run only each task's focused tests during its TDD cycle. The full suite runs once on the tree that lands, through Land step 3 and CI. The Verify phase does not repeat it.
- Each test file finishes within 30 seconds alone. Tests use private temporary state, bounded concurrency, and explicit cleanup. Preserve the assertions of all old cases.
- Keep old entrypoints working during internal ports. They are comparison references only until Task 9, not compatibility paths in the completed feature. Do not publish or land an intermediate tree.
- Preserve historical ADR text. A new ADR replaces the stated Bash-specific clauses. Do not edit another product repository in this lane.
- `Bash(...)` remains a host permission-tool name. Keep a rule when its executable invocation is still correct; do not replace the tool name with an invented `Bun(...)` permission rule.

## Review Focus

1. A product preload, macro, `.env`, or shadow executable must not run before an invalid configuration fails. Task 1 and Task 2 pin this ordering.
2. A killed updater must not release a surviving update command's lock. A timeout must remove descendants. Task 5 pins both cases.
3. A copied launcher must work alone from a path with spaces, quotes, Unicode, and shell metacharacters. Task 2 pins the bytes of every argument.
4. Setup text must keep its final newlines and inherited input while exposing the absolute main path. Task 4 pins empty, failed, and retried setup.
5. A native entry denial must stop before another access path or model request. Task 8 pins denial, concurrency, and same-session handoffs in the generated module.

## File Map and Coverage Record

Use these mappings. A wildcard means every tracked matching file, not a sample.

| Owner | Source | Replacement |
| --- | --- | --- |
| Task 1 | `scripts/lib/config.ts` | Exported typed reader plus its existing CLI contract |
| Task 1 | Process and fixture glue | `scripts/lib/process.ts`, `tests/lib/fixture.ts`, `tests/process.test.ts` |
| Task 2 | `scripts/celetis`, `scripts/lib/host.sh`, `scripts/root.sh` | `scripts/launcher.ts`, `scripts/lib/host.ts`, `scripts/root.ts`, generated `scripts/celetis` |
| Task 2 | Build delivery | `scripts/build.ts`, `tests/build.test.ts` |
| Task 3 | `scripts/next-step.sh`, `scripts/capscore.sh` | `scripts/next-step.ts`, `scripts/capscore.ts` |
| Task 4 | `scripts/worktree-lib.sh`, `scripts/worktree.sh`, `scripts/setup.sh` | `scripts/lib/worktree.ts`, `scripts/worktree.ts`, `scripts/setup.ts` |
| Task 5 | `scripts/celetis-flow.sh`, `scripts/lib/session.sh`, `scripts/plugin-update.pl` | `scripts/celetis-flow.ts`, `scripts/lib/session.ts`, `scripts/plugin-update.ts`, `scripts/lib/update-lock.ts` |
| Task 6 | `scripts/land.sh` | `scripts/land.ts` |
| Task 7 | `scripts/board.sh`, `board/*.mjs`, `board/board.js` | `scripts/board.ts`, same-basename `board/*.ts`, generated browser delivery files |
| Task 7 | `board/fixtures/{producer.sh,run.sh,herdr}` | TypeScript fixtures and Bun executable fixture output in private scratch folders |
| Task 8 | `hooks/entry.js`, observer `hooks/register.js` | Same-basename `.ts` sources and generated `.js` delivery files |
| Task 8 | `tests/manual/{custom-part,step-prompt}.test.sh`, `native-entry-events.jq` | `tests/manual/{custom-part,step-prompt}.ts`, `tests/manual/native-entry-events.ts` |
| Task 9 | `scripts/verify.sh`, `tests/suite.sh`, `tests/lib/pool.sh` | `scripts/verify.ts`, `tests/suite.ts`; bounded Bun subprocess work replaces the shell pool |
| All | `tests/*.test.sh`, `board/*.test.mjs` | Same-basename `bun:test` files; combine wrapper-only files as stated below |
| Task 9 | Live documents, skills, settings, manifests, workflow | Updated runtime and paths; new ADR; no obsolete caller |

Before deleting a source, update `docs/superpowers/plans/96-port-map.md`. Pin the baseline to `4fe5554`. Give every test case its original file, case/function name or source range, assertion purpose, replacement test name, task, and result. Expand parameterized cases. Give every live path caller its replacement. Explain an obsolete case by the removed behavior it tested. A language-specific assertion gets a new-runtime equivalent, not an unexplained deletion. Publish this record with implementation evidence before Land; it is scratch evidence, not a new runtime subsystem.

## External facts

- Bun 1.4.2 (pinned): `Bun.spawn` accepts argument arrays, `cwd`, inherited streams, timeout and signal options, and an exit promise. Source: [child processes](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/child-process.mdx), Context7 `/oven-sh/bun/bun-v1.4.2`.
- Bun 1.4.2 (pinned): `Bun.build` accepts TypeScript entrypoints, `bun` and `browser` targets, ESM format, and a banner. A Bun-target bundle carries `// @bun`. Source: [bundler](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/bundler/index.mdx), Context7 `/oven-sh/bun/bun-v1.4.2`.
- Bun 1.4.2 (pinned): `new Bun.Transpiler({loader: 'ts', target: 'browser'}).transformSync(source)` returns JavaScript without resolving imports or executing the source. Use it only for the pre-decided native-delivery alternative. Source: [transpiler](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/transpiler.mdx).
- Bun 1.4.2 (pinned): `bun test` has a default per-test timeout of 5000 ms; individual tests can set a timeout. `node:test` support is partial. Source: [tests](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/test/writing-tests.mdx), [Node compatibility](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/nodejs-compat.mdx), Context7 `/oven-sh/bun/bun-v1.4.2`.
- Bun 1.4.2 (pinned): local `bunfig.toml` can run preloads. Global bunfig files apply to package manager commands. `--no-env-file` stops automatic `.env` loading. Missing imports can otherwise trigger automatic installation. Source: [bunfig](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/bunfig.mdx), [environment](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/environment-variables.mdx), [auto-install](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/auto-install.mdx).
- Bun 1.4.2 (pinned): its `node:child_process` implementation handles `detached` and numeric stdio descriptors. This is source evidence, not proof of process cleanup on either OS. Source: [implementation](https://github.com/oven-sh/bun/blob/bun-v1.4.2/src/js/node/child_process.ts).
- Bun 1.4.2 (pinned): `bun:ffi` can call system C functions through `dlopen`. Its documentation marks FFI experimental and advises against production use. Preserve this as a runtime decision point for the update lock, not a settled reliability claim. Source: [FFI](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/ffi.mdx).
- POSIX advisory locking (current manual): a `flock` lock lasts until all descriptors for its open file description close. An explicit unlock would also release a surviving child's lock. Source: [flock(2)](https://man7.org/linux/man-pages/man2/flock.2.html).
- Bun 1.3.14 (historical spec observation) was below the floor. Bun 1.4.3 (installed during planning) now reports `1.4.3`. A planning probe on macOS used a copied executable with `#!/usr/bin/env -S bun --no-env-file --no-install --config=/dev/null`; the product preload did not run, the `.env` marker was absent, and the product cwd stayed intact. Source: `bun --version`, `bun --help`, and private planning probe, 2026-10-22. Repeat at 1.4.2; this is not floor acceptance.
- Claude Code 2.1.306 and Codex CLI 0.163.0 (installed): current observed host versions. Claude's `plugin test <dir>` discovers `*.test.ts` and `*.test.tsx` and loads `claude-code/testing` in its own binary. Source: `claude --version`, `codex --version`, `claude plugin test --help`, 2026-10-22. Native generated-module loading remains unverified.
- GitHub CLI 2.102.1 (installed): `gh api --paginate --slurp` returns an outer array of JSON pages; `--input -` accepts a JSON request body. Source: `gh --version`, `gh api --help`, 2026-10-22.
- herdr 0.9.3 (installed): `pane run` advertises `<PANE_ID> <COMMAND>...`; `tab create` accepts `--cwd` and `--env`. Help does not prove how command arguments reach the terminal. Source: `herdr --version`, `herdr pane run --help`, `herdr tab create --help`, 2026-10-22. Verify the actual terminal boundary in V4 and V5.

## Task 1: Add typed configuration and process foundations

CAP: J2 V1 B2 N1 S2 X2 = 10 +b2 → inherit/max

**Files:** Modify `scripts/lib/config.ts`, `scripts/tsconfig.json`, and the current gate's TypeScript coverage. Create `tsconfig.runtime.json`, `scripts/lib/process.ts`, `tests/lib/fixture.ts`, `tests/process.test.ts`, and `tests/config.test.ts`. Start the coverage record above.

**Interfaces:** Export `readConfig(checkout: string): Config` and `ConfigError` from the existing reader. Keep CLI printing and exit 2 behind `import.meta.main`. Define `Config` from the current schema. Export `run(file: string, args: string[], options?: ExecFileOptions): Promise<{code: number; stdout: string; stderr: string}>` with shell execution disabled. Reuse the board's existing `execFile` result contract and 64 MiB default limit. Export `bunArgs(entry: string, args: string[]): string[]` for child Celetis launches, with the selected executable supplied as `process.execPath` by callers.

**External facts used:** Bun 1.4.2 supports argument-array child processes and inherited streams. Local bunfig preloads and automatic `.env` loading occur before program logic. CLI flags must suppress them at startup.

- [ ] **Step 1:** Port every `tests/config.test.sh` case to `bun:test`, including the #85 byte, YAML metadata, host-hint, cache, and crash-report cases. Add `process preserves argv and failed status` with these assertions:

  ```ts
  expect(JSON.parse(result.stdout)).toEqual(['a b', "a'b", 'λ', '$(touch marker)', '']);
  expect(failed.code).toBe(7);
  expect(failed.stderr).toContain('child failure');
  expect(await exists(marker)).toBe(false);
  ```

  Use TypeScript executable stubs. Add startup cases with a product preload, macro, `.env`, global bunfig, and `node_modules/.bin` shadow. Assert that invalid config starts none of them. Test concurrent stdout/stderr output and a failed child that leaves its output pipe open.
- [ ] **Step 2:** Run `bun --no-env-file --no-install --config=/dev/null test tests/config.test.ts tests/process.test.ts`. Expect failure on the missing exports or unsafe startup, not an unrelated tool error.
- [ ] **Step 3:** Extract the reader API without changing parsing or vendor sources. Add the small process helpers. Use `node:child_process.spawn` directly where a caller needs a long-lived handle; do not build a generic supervisor framework. Preserve signal exit statuses. Provide private repository/stub creation and cleanup in `tests/lib/fixture.ts`.
- [ ] **Step 4:** Run the focused tests and the current verify gate. Expect all cases to pass. Add each new tracked file before the gate. Confirm an import of the reader prints nothing and exits no process.
- [ ] **Step 5:** Commit with `feat(runtime): add typed config and Bun process primitives`.

## Task 2: Build the standalone launcher from TypeScript

CAP: J2 V1 B2 N1 S2 X2 = 10 +b2 → inherit/max

**Files:** Create `scripts/launcher.ts`, `scripts/lib/host.ts`, `scripts/root.ts`, `scripts/build.ts`, `tests/build.test.ts`, and `tests/launcher.test.ts`. Read every caller of the old launcher and `scripts/lib/host.sh`. Keep the public file unchanged until Task 9.

**Interfaces:** Export `selectHost(explicit: string | undefined, env: NodeJS.ProcessEnv, main: string | null): Host`, `installedRoot(host: Host, cwd: string): Promise<string>`, and `codexRequest(cwd: string, method: string, params: unknown): Promise<unknown>`. Export `main(argv: string[]): Promise<number>` from `scripts/launcher.ts`. `scripts/root.ts` prints the selected installed root. `scripts/build.ts` accepts `--outdir DIR` or `--check`; `--check` compares bytes and executable modes without changing the checkout.

**External facts used:** Bun 1.4.2 builds readable ESM bundles with a Bun target and banner. Product configuration can execute before the launcher body. The copied executable must therefore carry startup isolation in its shebang.

- [ ] **Step 1:** Port all launcher tests. Test precedence, ambiguous/missing installations, malicious skill paths, app-server notifications, invalid JSON, EOF, and the 10-second request deadline. Add a private product containing only the copied output, with no adjacent plugin files or `node_modules`. Assert:

  ```ts
  expect(root.stdout.trim()).toBe(enabledInstallation);
  expect(dispatched.argv).toEqual(['a b', "a'b", 'λ', '$(touch marker)', '']);
  expect(dispatched.executable).toBe(selectedBun);
  expect(dispatched.entry.endsWith('/scripts/next-step.ts')).toBe(true);
  expect(await exists(marker)).toBe(false);
  expect(buildA.bytes).toEqual(buildB.bytes);
  ```

  Test missing and below-floor Bun separately. Test a copied launcher outside a Git checkout where the command permits it. Reject unsafe command basenames before dispatch.
- [ ] **Step 2:** Run the two new test files. Expect failure because no standalone TypeScript launcher exists.
- [ ] **Step 3:** Port the current host discovery and host-hint behavior. Keep the strict full read before mutating commands. Keep disabled skills, enabled-installation identity, and exact saved Resume routing. Use only built-in and local imports. Generate a standalone launcher in scratch during this task. Use the isolated Bun shebang from the planning probe, adding startup cache/crash-report environment assignments and macro suppression; prove the complete shebang on both supported OSes. Child launches use the same flags and `process.execPath`.
- [ ] **Step 4:** Add the build manifest inside `scripts/build.ts`. Pin generation to Bun 1.4.2, readable ESM, stable filenames, no sourcemap or clock input, and no install hook. Initially generate the launcher; Tasks 7 and 8 add their delivery targets. Test stale bytes, missing outputs, mode 0644 versus 0755, missing imports, build failure, and a second build from another checkout path. Run focused tests and the current gate.
- [ ] **Step 5:** Commit with `feat(launcher): build the standalone Bun launcher from TypeScript`.

## Task 3: Port issue resolution and capability scoring

CAP: J1 V0 B2 N1 S2 X0 = 6 +b2 → inherit/xhigh

**Files:** Create `scripts/next-step.ts`, `scripts/capscore.ts`, `tests/next-step.test.ts`, and `tests/capscore.test.ts`. Update the coverage record. Keep `docs/issue-tracker.md` and `docs/capability.md` as the behavior references.

**Interfaces:** Each command exports `main(argv: string[]): Promise<number>` and starts it only at its entrypoint. Keep `next-step` number, `--open`, and `--json` modes. Keep scorer flags, text output, schema-1 JSON, attempts, profile selection, opencode behavior, reviewer floors, and the built-in `--test` mode.

**External facts used:** GitHub CLI 2.102.1 supports paginated JSON through `--paginate --slurp`. Parse these pages in TypeScript. Do not use `--jq` or output templates as embedded programs. Keep the current `sqlite3` argument-array lookup for opencode, its cwd-first query, and its fallback query. It is an external database tool, not a Celetis interpreter. Missing sqlite3 or a failed query still takes the current model fallback; this port adds no database dependency.

- [ ] **Step 1:** Port every resolver and scorer case, including the scorer's internal self-test vectors. Add large plan comments above 32 KiB, multiple GitHub pages, multiple reviews by one user, mixed check statuses, missing host profiles, and dirty main/lane state. Pin the existing values:

  ```ts
  expect(score.digits).toEqual({J: 1, V: 0, B: 2, N: 1, S: 1, X: 0});
  expect(score.dispatch).toMatchObject({model: null, effort: 'xhigh'});
  expect(resolveFinished.stdout).toBe('stop #7 is finished.\n');
  expect(attempt4.status).toBe('stop');
  ```

  Keep all current refusal and landing-state precedence assertions. Add landing ownership tests using `land.ts` as the recognized executable.
- [ ] **Step 2:** Run `bun --no-env-file --no-install --config=/dev/null test tests/next-step.test.ts tests/capscore.test.ts`. Expect missing-entry failures.
- [ ] **Step 3:** Translate the existing resolver and scoring logic into direct typed values. Send JSON through stdin or files where size requires it. Preserve pagination ordering, the 14-day closed-issue window, floating-point/integer rejection rules, and STOP-before-lookup behavior. Keep the current model arithmetic; this feature does not tune it.
- [ ] **Step 4:** Run focused tests and the current gate. Compare the baseline commands and replacements against the same fixture corpus. Record only the allowed runtime/path differences.
- [ ] **Step 5:** Commit with `feat(commands): port resolution and scoring to Bun`.

## Task 4: Port worktrees and TypeScript setup

CAP: J2 V1 B2 N1 S2 X2 = 10 +b2 → inherit/max

**Files:** Create `scripts/lib/worktree.ts`, `scripts/worktree.ts`, `scripts/setup.ts`, `tests/worktree.test.ts`, and `tests/setup.test.ts`. Update `docs/configuration.md` and the setup contract examples with the new setup language when the entrypoints switch in Task 9.

**Interfaces:** Export `runSetup(checkout: string, config: Config, main: string): Promise<number>` and `markerOf(checkout: string): Promise<string>` from `scripts/lib/worktree.ts`. Share existing checkout lookup and removal operations between worktree, setup, and landing. Commands export `main(argv: string[]): Promise<number>`.

**Setup decision:** Put the exact parsed setup text in a private mode-0600 temporary `.ts` file outside the checkout. Start the selected Bun with that absolute file, inherited stdin/stdout/stderr, and `cwd: checkout`. The setup accesses the absolute main path as `process.argv[2]`. Remove the temporary file in all exit paths. Local imports in setup must be explicit absolute paths derived from `process.cwd()` or `process.argv[2]`; no hidden helper or product preload runs.

**External facts used:** Bun accepts a file entrypoint with argument arrays, explicit cwd, and inherited streams. Bun does not supply Bash `set -e`; each setup must check the exit status of an external command.

- [ ] **Step 1:** Port every worktree and setup case. Replace valid Bash setup fixtures with TypeScript; retain old Bash text only as non-executed rejection data. Pin:

  ```ts
  expect(observed.main).toBe(main);
  expect(observed.cwd).toBe(lane);
  expect(observed.input).toBe('input from caller\n');
  expect(readBack.worktreeSetup).toBe(originalText);
  expect(await exists(marker)).toBe(false); // empty or failed setup
  ```

  Expand the newline cases to zero, one, and multiple final line breaks. Test syntax errors, uncaught exceptions, `process.exit(7)`, checked external failure, existing-lane repair, new-branch cleanup, prior branches, marker retry, and all three setup entry paths. Preserve ownership, symlink, staged/dirty checkout, hooks, and signing tests.
- [ ] **Step 2:** Run the two focused test files. Expect missing TypeScript command failures.
- [ ] **Step 3:** Port setup's ownership record and file planning before writes. Append missing YAML fields and literal blocks while preserving existing comments, order, and unrelated bytes. Reuse the vendored YAML package where it replaces parser logic; never serialize the whole shared product config. Round-trip the proposed file through `readConfig` and compare all unrelated values before any write. Keep `setup try` detached and its stdout path even after failed setup. Keep `setup lane` validation, marker behavior, and plumbing commits that avoid commit hooks. Preserve the 30-character worktree slug and current branch selection.
- [ ] **Step 4:** Run focused tests and the current gate. Exercise `worktree`, `setup try`, and `setup lane` in real private Git repositories. Assert clean tracked state and no leftover setup file after each path.
- [ ] **Step 5:** Commit with `feat(setup): run worktree setup as TypeScript on Bun`.

## Task 5: Port session tracking, plugin refresh, and the runner

CAP: J2 V1 B2 N2 S2 X2 = 11 +b2 → inherit/max

**Files:** Create `scripts/lib/session.ts`, `scripts/lib/update-lock.ts`, `scripts/plugin-update.ts`, `scripts/celetis-flow.ts`, `tests/host-session.test.ts`, `tests/celetis-flow.test.ts`, `tests/runner-lock.test.ts`, and `tests/runner-lifecycle.test.ts`. Reuse Task 2's host operations and Task 3's resolver.

**Interfaces:** Keep session schema 1 and its exact keys: `schema`, `host`, `issue`, `step`, `checkout`, `session_id`. Export `readSession(main: string, issue: number): Promise<SessionRecord>`, `writeSession(main: string, record: SessionRecord): Promise<void>`, and `verifySavedSession(record: SessionRecord, startedAt: number): Promise<boolean>`. Export `updatePlugin(runnerPid: number, host: Host): Promise<string>`; its CLI prints only the installed root. The runner exports `main(argv: string[]): Promise<number>`.

**External facts used:** Bun 1.4.2's Node-compatible spawn supports detached processes and numeric descriptors in source. `flock(2)` locks belong to open file descriptions. Bun FFI is experimental. Actual lifecycle behavior is a required runtime decision point.

- [ ] **Step 1:** Port all four test files, preserving every parameterized host and lifecycle case. Use independent Bun stubs to record real PIDs and child groups. Pin schema and ordering:

  ```ts
  expect(Object.keys(record).sort()).toEqual(['checkout', 'host', 'issue', 'schema', 'session_id', 'step']);
  expect(updateOverlap).toBe(false);
  expect(resumeCalls).toEqual([exactSavedHostInvocation]);
  expect(startedBeforeLockRegistration).toBe(false);
  expect(descendantsAliveAfterTimeout).toEqual([]);
  ```

  Keep tests for zombie owners, PID reuse, stale executable names, replacement owners, SIGINT/SIGTERM/SIGHUP, parent SIGKILL before registration, helper SIGKILL while an update survives, pipe closure, host mismatch, malformed identity, no saved turn, and plugin update failure.
- [ ] **Step 2:** Run the focused test files separately. Expect the missing runner and update-lock implementations to fail.
- [ ] **Step 3:** Implement the update lock first. Preserve the existing per-host `celetis-update.lock`, advisory lock inheritance, 120-second monotonic total deadline including lock wait, 50 ms polling, TERM then KILL cleanup, and runner-death detection. The selected approach is a small TypeScript binding to system `flock` through `bun:ffi`, with an inherited descriptor in child commands. Resolve system libraries for macOS and supported Linux libc variants; ship no native binary or new package. Close the parent's descriptor after cleanup; do not explicitly unlock while a child can still hold it. Prove descriptor inheritance and descendant cleanup on Bun 1.4.2 before continuing. If FFI or descriptor behavior fails, stop this task and revise the design; do not replace it with a weaker stale-time lock or an interpreter helper.
- [ ] **Step 4:** Port sessions and the runner. Keep atomic record writes, saved-host selection, exact UUID validation, startup trust diagnostics, and the 60-second identity deadline. Keep Git ref compare-and-swap locks with PID plus process start identity. Change live runner recognition to `celetis-flow.ts` and landing recognition to `land.ts` together. Preserve registration-before-start with a Bun child waiting for a private start signal. Preserve the 5000 ms herdr wait and the idle/done plus repeated resolver checks before `/exit`. Resume starts no watcher, takes no runner lock, and performs no plugin refresh.
- [ ] **Step 5:** Run the four focused files and the current gate. Run the lifecycle subset at the pinned floor on macOS and Linux. Use a test clock where a 120-second wait would break the 30-second file limit; also prove the real timeout option on a short child. Record process tables, lock state, and exit statuses. Commit with `feat(runner): port refresh and session control to Bun`.

## Task 6: Port landing without changing the merge contract

CAP: J2 V0 B2 N1 S1 X1 = 7 +b2 → inherit/max

**Files:** Create `scripts/land.ts` and `tests/land.test.ts`. Reuse `scripts/lib/worktree.ts`, the typed reader, and shared process operations. Read ADR-0008 and ADR-0023 before porting.

**Interfaces:** Export `main(argv: string[]): Promise<number>`. Keep both `pr` and `merge` landings, conventional subjects, exact-head squash, issue/epic closure, remote branch removal, and worktree cleanup ordering.

**External facts used:** GitHub CLI supports structured JSON input and paginated JSON pages. Process argument arrays keep subjects and bodies intact. Parse all results in TypeScript.

- [ ] **Step 1:** Port every landing case. Retain partial-success recovery, dirty and stale branch refusals, multiple lane matches, fetch/push errors, branch-delete races, parent-issue failures, and cleanup errors. Pin:

  ```ts
  expect(mergeRequest.sha).toBe(verifiedHead);
  expect(mergeRequest.merge_method).toBe('squash');
  expect(failedJobReruns).toHaveLength(1);
  expect(worktreeRemovedAfterFailedPush).toBe(false);
  expect(alreadyAttempt2Reruns).toHaveLength(0);
  ```

  Keep neutral/skipped-only, external status, cancelled, stale PR head, and mixed workflow completion cases from ADR-0023.
- [ ] **Step 2:** Run `bun --no-env-file --no-install --config=/dev/null test tests/land.test.ts`. Expect the new command to be missing.
- [ ] **Step 3:** Port the existing state transitions directly. Keep 60 polls at 15 seconds, one further 15-minute wait only for eligible reruns, and a merge request bound to the verified SHA. Keep a live `land.ts` lock until all landing work ends. Propagate every failed Git or GitHub operation before destructive cleanup.
- [ ] **Step 4:** Run the focused tests and the current gate. Use shortened test timers without changing production constants. Record raw request arguments and Git refs as the oracle.
- [ ] **Step 5:** Commit with `feat(land): port checked landing to Bun`.

## Task 7: Port the board and generate its browser assets

CAP: J1 V1 B2 N1 S2 X2 = 9 +b2 → inherit/max

**Files:** Port every first-party `board/*.mjs` and `board/board.js` to TypeScript. Port every `board/*.test.mjs`, plus `tests/board.test.sh` and `tests/board-agent.test.sh`, to `bun:test`. Create `scripts/board.ts` and `board/tsconfig.json`. Update `board/package.json`, `board/README.md`, and `scripts/build.ts`. Replace all three executable board fixtures.

**Interfaces:** Keep `parseConfig`, `readDocument`, `runData`, `createBoard`, and browser exports with their existing inputs and return shapes, now typed. Keep stdin-only adapter keys `data`, `run`, `resume`, and `port`; `{n}` and `{agent}` stay separate argv items. `PORT` keeps precedence over YAML `board.port`, then default 4403.

**External facts used:** Bun 1.4.2 supports standard Node-compatible server/process APIs and browser ESM builds. herdr 0.9.3 advertises command arguments but needs an actual boundary check.

- [ ] **Step 1:** Port all board assertions without changing fixture documents or UI copy for style. Assert contract 1, CSP, loopback binding, HTTP status/body limits, stale cache behavior, fixed asset allowlist, path escapes, symlink escapes, lane executable refusal, invalid executable modes, selected Run agent, and saved-host Resume. Add:

  ```ts
  expect(contract).toBe(1);
  expect(response.headers.get('content-security-policy')).toBe(baselineCsp);
  expect(await escapedExecutableStarted()).toBe(false);
  expect(receivedArgument).toBe("a'b $(touch marker)");
  expect(await exists(marker)).toBe(false);
  ```

  Preserve the baseline API timing constants, including 60,000 ms data expiry, 15,000 ms diff freshness, and the 64 MiB process output limit.
- [ ] **Step 2:** Run the ported board tests and the two adapter tests. Expect failure on missing `.ts` entrypoints and generated assets.
- [ ] **Step 3:** Use the existing HTTP/filesystem design on Bun. Keep board validation separate from Celetis YAML. Remove the Node version guard and update the package bin/runtime metadata. Use the selected Bun and clean PATH for child commands. Build `board.ts` and the current browser module graph into the existing browser URLs; generated outputs come only from the build program. Keep HTML, CSS, fonts, layout, and storage keys.
- [ ] **Step 4:** Verify the terminal API's real argument behavior. Use structured argv when the API supports it. Where a terminal accepts only text, quote each argument as one executable invocation and preserve current pane completion behavior. Put no Celetis branching, loops, or setup code into the string. Run focused tests, a browser asset import smoke check, and the current gate.
- [ ] **Step 5:** Commit with `feat(board): run the board on Bun with TypeScript sources`.

## Task 8: Port native sources and manual checks

CAP: J2 V1 B2 N1 S2 X2 = 10 +b2 → inherit/max

**Files:** Create `hooks/entry.ts`, `tests/manual/native-observer/hooks/register.ts`, `tests/lib/native-host.ts`, `tsconfig.native.json`, `tests/types/native-host.d.ts`, and the three TypeScript manual programs in the file map. Update `scripts/build.ts`. Port `tests/{native-entry,native-observer,native-events-harness,custom-part-harness,manual-harness}.test.sh` to Bun test entries. Convert the existing `tests/native-entry.test.ts` and observer `projection.case.ts` assertions to `bun:test` in `tests/native-entry.test.ts` and `tests/native-observer.test.ts`. Remove the old host-test-kit source after its assertions have replacements.

**Interfaces:** Keep the host's `register(on)` interface and native `Read`/metadata protocol. Generate `hooks/entry.js` and observer `hooks/register.js` as readable ESM at their existing paths; `hooks.json` keeps module loading. Export `nativeHost(plugins: {register: Register}[]): {$: NativeTools; on: NativeOn}` from the test helper, with types for the operations the current tests use. Export the event projector as `projectEvents(rows: unknown[]): unknown[]` from `tests/manual/native-entry-events.ts`. Manual programs keep existing flags, host choice, output artifacts, and exit statuses.

**External facts used:** Claude 2.1.306 provides `claude-code/testing` only in its own runtime. Replace that test-kit dependency so every repository test runs on Bun. The generated native module format still needs live proof. Bun 1.4.2 can emit browser-target ESM without Bun-specific runtime imports.

- [ ] **Step 1:** Preserve every native entry test and observer assertion in `bun:test`. Introduce only the event-test operations those assertions need in `tests/lib/native-host.ts`: hook chains and catches, tool results, native origins, session deliveries, and turn generators. Use the real hook's `register`, not a copy of its logic. Test this fixture's chain ordering, caught exceptions, denied tools, and generator return values independently. Port the projector fixtures and assert:

  ```ts
  expect(nativeReadsAfterDenial).toEqual([]);
  expect(modelCallsAfterDenial).toEqual([]);
  expect(configReadsForOneEntry).toHaveLength(1);
  expect(projectEvents(input)).toEqual(expectedEvents);
  expect(nativeModuleText).not.toMatch(/(?:from|import\s*\()\s*['"](?:bun:|node:)/);
  ```

  Keep partial/cached/seeded reads, Git boundaries, same-session handoffs, borrowed skills, concurrent references, stale entry completions, wrong delivery origins, exact denials, and observer hashing. Include both source and generated-module contract checks.
- [ ] **Step 2:** Run the new deterministic harness and projector tests. Expect missing generated output or new program entrypoints to fail.
- [ ] **Step 3:** Add native TypeScript interfaces for the API the hook uses, with no Bun globals. Generate ESM with the browser target. Run the deterministic assertions against source and generated exports, then prove actual module loading through the live manual entry flow in V6. A test double is not native-host acceptance. If bundling changes native module behavior, use Bun's TypeScript-only transpilation for this delivery target and retain the same public exports. If neither output loads, stop; never replace native entry with a Bun parser or command.
- [ ] **Step 4:** Port manual orchestration and fixtures to TypeScript with argument arrays, native file APIs, typed JSON projections, and process cleanup. Keep the token-use warning and manual checks outside the full suite. Update every changed verbatim skill quote in the same commit. Run deterministic harness tests and the current gate. Bun runs all test entries and assertions; the external host runs only the actual hook and live acceptance sessions. Mark unavailable live checks BLOCKED, never PASS.
- [ ] **Step 5:** Commit with `feat(native): author hooks and manual checks in TypeScript`.

## Task 9: Switch the toolchain, gate, CI, and live references

CAP: J2 V1 B2 N1 S2 X1 = 9 +b2 → inherit/max

**Files:** Create `scripts/verify.ts`, `scripts/install-tools.ts`, `tests/install-tools.test.ts`, and `tests/suite.ts`. Port `tests/{verify,text,pool}.test.sh` to `tests/{verify,text,parallel}.test.ts`; combine wrapper-only native test files as Task 8 specifies. Update the three type environments introduced earlier, `scripts/tsconfig.json`, `tests/lib/tools.txt`, `scripts/lib/vendor/README.md`, `.github/workflows/test.yml`, `biome.jsonc`, `.editorconfig`, `.gitignore`, `.gitattributes`, `AGENTS.md`, README, `docs/{configuration,celetis-flow,capability,issue-tracker}.md`, host documents, all affected skills, settings/rules, manifests, and manual instructions. Remove `.shellcheckrc`. Add the next numbered ADR, expected `0025-the-toolchain-runs-on-typescript-and-bun.md`; inspect the trunk numbering before writing it.

**Interfaces:** The new gate ends with `verify: PASS`; the suite ends with `suite: PASS`. `tests/suite.ts` discovers all repository Bun test entries, starts bounded independent file workers, enforces each file's 30-second deadline, fails on any child failure, and cleans children on signals. It excludes token-using manual programs. `scripts/verify.ts` classifies every `git ls-files -z` path and checks every first-party TypeScript source.

**External facts used:** Bun's default test timeout is 5000 ms, so long cases need explicit values below the file deadline. Pinned generation uses Bun 1.4.2. Native production modules run in the host; their unit tests and all manual orchestration run on Bun.

- [ ] **Step 1:** Port the existing gate, pool, and general-text assertions. Replace Bash syntax/runtime-specific cases with equivalent Bun failures. Add final-tree assertions:

  ```ts
  expect(trackedShellPrograms).toEqual([]);
  expect(firstPartyPerlOrJqPrograms).toEqual([]);
  expect(unmappedBaselineCases).toEqual([]);
  expect(liveRemovedPathCallers).toEqual([]);
  expect(await buildCheckChangesCheckout()).toBe(false);
  expect(failedWorkerSuite.code).not.toBe(0);
  ```

  Check extensionless executables by content as well as extension. Distinguish generated JavaScript, untouched vendor sources, historical ADR text, and non-executed negative data by explicit paths and roles. Reject new unexplained exceptions. In `tests/install-tools.test.ts`, use a private install destination and stub downloads/processes; assert the pinned tool arguments, a hash mismatch refusal, and no replaced executable after download failure.
- [ ] **Step 2:** Run `bun --no-env-file --no-install --config=/dev/null test tests/verify.test.ts tests/text.test.ts tests/parallel.test.ts tests/build.test.ts tests/install-tools.test.ts`. Expect the old shell tree and missing final gate to fail.
- [ ] **Step 3:** Implement the fast gate with tracked-file coverage, Biome, strict type checks, actionlint, config validation, plugin validation, text rules, and non-mutating generated-file comparison. Use `tsconfig.runtime.json` for Bun commands, server modules, tests, and manual programs; use `board/tsconfig.json` for DOM modules; use `tsconfig.native.json` and the native declarations for hook sources. Give the native environment only its actual host globals and API types. Remove the blanket TypeScript-test lint exemption where it no longer applies; scope native test doubles precisely. Do not execute the full suite from the gate. Retain exact tool pins for surviving tools. Port tool installation orchestration to `scripts/install-tools.ts`; use Bun's package manager through arrays and use Bun to run JavaScript tool entrypoints. Download actionlint's official pinned native binary with a checked hash; do not retain its Python installer wrapper. Remove shellcheck/shfmt pins and all Perl/jq/Node interpreter checks. Resolve installed tool/type paths through filesystem metadata rather than `npm root -g`. No check downloads or installs anything.
- [ ] **Step 4:** Generate and switch `scripts/celetis`, browser assets, and hook modules. Change all installed command paths, direct checkout instructions, permission invocations where paths change, lock-name checks, package metadata, and manual commands together. Delete every superseded first-party `.sh`, `.pl`, `.jq`, server `.mjs`, and executable fixture. Keep only generated browser/native JavaScript and the vendor exception. Complete the coverage record and run each migrated focused group after any final integration fix.
- [ ] **Step 5:** Replace CI's Bash matrix/build with Bun 1.4.2 on Linux. Keep `Verify gate` and `Full suite` as distinct steps. Use installation actions and one-line Bun entry invocations; move repository-owned install logic into TypeScript. Add the macOS/Linux process acceptance subset to CI or record the pinned macOS run in Verify V3; Linux CI must run that subset. Do not add a second full-suite run. Verify generated bytes with the pinned Bun, then the focused gate tests and the new project gate.
- [ ] **Step 6:** Apply the writing-for-agents rules to live instructions. Document `process.argv[2]`, failure checks, new runtime paths, build commands, and manual cutover. Keep setup's current proposal approval and product-file ownership rules. The new ADR replaces the Bash setup/sourcing clauses of ADR-0015 and ADR-0018, the Node board clauses of ADR-0020, the Bash matrix/tool/pool clauses of ADR-0022, and the launcher/runtime clauses of ADR-0024 that this conversion changes. Preserve the fast-gate/full-suite split and all unrelated host acceptance gaps. Commit with `feat(toolchain): switch all Celetis entrypoints to TypeScript on Bun`.

## Final Verify Phase

CAP: J2 V1 B2 N1 S2 X1 = 9 +b2 → inherit/max

**Reference:** The shipped toolchain at `4fe5554`, its complete test corpus, board contract 1, and the selected host's native entry and exact Resume flows. The converted toolchain must match that reference except for #96's stated changes. No screenshot, source inspection, or API lookup replaces a below-the-UI oracle.

**Decision points:** Startup isolation, updater locks/descendant cleanup, deterministic generation, native module loading, and herdr quoting remain load-bearing runtime checks. V1/V3/V4/V5/V6 settle them. A failure returns to the owning task. The fallback for an unsupported platform primitive is to stop and revise that task before cutover, never a shell helper or weaker lock. Native output may use the transpilation alternative in Task 8. Existing installed-resource lifetime gaps remain open; stopping old processes before this cutover does not claim to solve them.

- [ ] **V1 — Build and final-tree proof.** Obtain Bun 1.4.2 in private scratch if the active executable differs; do not replace the user's Bun. Build twice from clean copies in different absolute paths and compare bytes and modes. Run `scripts/build.ts --check` and the new gate. Corrupt a copied generated file and confirm `--check` fails without repairing it. Inspect tracked files and the coverage/caller map. Oracle: zero prohibited programs/callers, zero unmapped assertions, identical delivery bytes, executable launcher, `verify: PASS`, and a clean checkout after checks.
- [ ] **V2 — Copied launcher and setup.** Needs the acceptance installation report above for real enabled-package lookup. In a disposable product with only the copied launcher, run both hosts' `root`, valid and invalid commands, configuration failures, TypeScript setup, `setup try`, and `setup lane`. Add product preload, macro, `.env`, shadow tools, and metacharacters. Oracle: exact argv logs, selected Bun path, enabled package identity, no injection marker/cache, correct stdout/status, main-path/input capture, marker state, branch cleanup, and clean Git state. No runtime dependency installation occurs.
- [ ] **V3 — Processes on macOS and Linux.** Run the focused process and runner lifecycle scenarios at Bun 1.4.2 on each OS. Include concurrent updates from two repositories, hung update, dead runner, helper SIGKILL with a surviving command, TERM-ignoring grandchild, stale PID/start identity, session registration race, and signal interruption. Oracle: process tables show no unwanted survivors; no overlapping updates; inherited locks remain held until all relevant descriptors close; Git lock refs retain the correct owner; exact child statuses reach the caller. Keep every file within 30 seconds. This scenario needs no human report when an agent can run both environments.
- [ ] **V4 — Live host and landing flow.** Needs the acceptance repository and both signed-in isolated installations above. Inspect current host/herdr help first. Use only disposable issues and PRs. Start a new step, observe its saved identity, stop it, then Resume that exact identity for each host. Exercise a passing landing and one controlled external-command failure without touching production issues. Oracle: saved records match host/session/cwd, expected argv reaches the actual process, no accidental refresh on Resume, PR head/merge SHA and check states match, and failed operations preserve the lane.
- [ ] **V5 — Browser proof.** Start the checkout board through a scratch product adapter with isolated fixture producers. Check Chromium at desktop width and 375×812. Exercise refresh, Run host selection, Resume, errors, and text with control characters. Oracle: HTTP contract/CSP responses, actual process argv, session record identity, no injected marker, and matching baseline layout and keyboard behavior. Confirm all browser imports return generated assets. If herdr's real terminal boundary is used, apply V4's acceptance environment.
- [ ] **V6 — Native entry and quoted manual checks.** Needs both isolated signed-in installations above. Run `bun --no-env-file --no-install --config=/dev/null tests/manual/step-prompt.ts --agent claude --output-dir <scratch>` and the same command with `--agent codex`. Run `bun --no-env-file --no-install --config=/dev/null tests/manual/custom-part.ts --output-dir <scratch>` for Claude, plus the required Codex CLI cases of `tests/manual/config-entry-codex.md`. Use the checkout package in an isolated installation. Oracle: current source hashes, native metadata/Read records, exact denials, no parser/shell substitution, one config read per entry, and preserved quoted-step outcomes. Keep token-use evidence and host versions. Desktop acceptance remains optional under ADR-0016.

Record each scenario as PASS, FAIL, UNRUN, or BLOCKED with its command, OS, Bun/host versions, and artifact paths. Only a scenario that needs a listed human act can wait for that report under `## Before landing`. Report other missing runtime access as a setup stop. Do not mark an unrun scenario PASS.

After Verify, require the current-build cutover report before Land. A code change that invalidates the prepared product setup or launcher requires a new report. Land step 3 owns the full suite on the final head; CI must be green before the landing command merges. Publish the coverage record and runtime evidence before that last act.

