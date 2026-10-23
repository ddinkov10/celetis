# Final review repair report for issue 96

Status: DONE. I1, I2 and M1 are fixed in this one repair wave. No full suite or live/token acceptance ran. The parent gate and one scoped re-review remain with the controller.

## Binding and scope

- Checkout: `/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain`.
- Branch: `feat/96-intent-the-whole-toolchain`.
- Repair base: `a8b0d3db5cdc289359c9593b3469a6b83f32e364`.
- The first command confirmed the exact binding and a clean tracked tree. The full final-fix brief, final review, global constraints and active AGENTS.md were read.
- The actual inherited/null-model, max-effort pair stays unchanged, attempt 1. No subagent or external mutation was used.
- Bun is the private pinned 1.4.2 executable above. The private tools prefix is `/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools`. No Node or other tool was installed. The user's Bun was not replaced.

## I1: first Bun environment at the terminal boundary

`bindRuntime` still recognizes only the exact isolated Bun shebang after `parseConfig` validates the actual relative project executable. Its bound array is now:

```text
/usr/bin/env
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
DO_NOT_TRACK=1
<selected process.execPath>
--no-env-file
--no-install
--config=/dev/null
--no-macros
<validated file>
<original arguments>
```

The two fixed assignments come from the existing `childEnv({})` definition. The empty source prevents unrelated environment values from entering the array. The system env operation sets them before it starts the selected Bun. This is the approved runtime binding, with no new config key, compatibility implementation, path resolver or terminal framework. The generic native command path and execute-only case remain unchanged.

The existing server's quoting and completion code is unchanged. It quotes this array for both workspace and tab creation. The Data path also consumes the same array. No terminal needs to inherit the board or herdr CLI environment.

Real regression coverage is in `board/runtime.test.ts` and `tests/board-agent.test.ts`:

- The direct runtime test runs the bound array with a hostile cache path and tracking value before any child helper can reset them. It verifies the selected executable, arguments containing spaces and quotes, both controls, and the full array.
- Four HTTP cases cover workspace/tab creation crossed with absent/hostile controls. Each performs both Run and Resume, so all eight terminal starts execute. The shell environment is built independently of the board process; it has no Bun or Node on its private PATH. A tiny executable with the exact isolated shebang records the first Bun environment and argv before any `childEnv` use.
- Each case checks the actual creation branch, completed process status/output, unchanged `&& exit`, selected Bun, all four exact flags, cwd, agent/number arguments, empty/quoted/Unicode/glob/metacharacter arguments, no injected marker, and both controls. Both starts finish before the final environment assertion, so RED covers Run and Resume rather than stopping after the first action.
- Existing absent/shadow-Bun full runner cases and all original assertions remain. Their exact bound prefix expectation changes from six to nine items to account for the environment operation; selected Bun, flags and validated script stay exact.

These observations establish environment values. They do not claim that a cache write or report upload occurred. Actual herdr/browser acceptance remains UNRUN.

## I2: native compiler caller

`tests/native-modules.test.ts` now gets the compiler descriptor from the existing `findTools` helper and runs `tools.tsc.file` plus `tools.tsc.args`. Thus the selected Bun runs the actual pinned TypeScript JavaScript entrypoint with the isolation flags.

The same original native project is copied into private scratch and contains the real `hooks/probe.ts` Bun-global error. Its private PATH has only symlinks to the actual tsc, Biome and actionlint tools. The test explicitly proves Node is absent. It keeps the old nonzero and specific `Cannot find name 'Bun'` assertions, and checks the source path and pinned compiler's observed type-error status 1. The launch-failure status 127 and missing diagnostic fail this test.

## Complete RED before implementation

Production runtime and compiler calls stayed unchanged until this command completed:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/runtime.test.ts tests/board-agent.test.ts tests/native-modules.test.ts
```

`final-fix-red-final.log`: **16 pass, 6 fail, 170 expectations, 22 tests, 25.10 s**, exit 1. Five failures are the direct runtime case plus all four real Run/Resume environment cases. The first process kept absent values or the hostile cache path and tracking `0`, despite correct executable/argv/quoting/completion. The sixth failure is the old native compiler launch, status **127** without Node, before it can produce a type diagnostic.

Earlier raw test-development logs are retained. `final-fix-red.log` had a missing initial board refresh in the new HTTP fixture, so its HTTP 409 failures are not environment proof. `final-fix-red-complete.log` fixes that fixture and shows the real environment failures; its direct runtime fixture also exposed a `/var` versus canonical `/private/var` expectation. That private path was canonicalized before the final complete RED. No production change occurred between these RED runs.

## GREEN and covering commands

Final per-file covering command:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros -e 'const {suite}=await import("./tests/suite.ts");process.exitCode=(await suite({files:["board/runtime.test.ts","tests/board-agent.test.ts","tests/native-modules.test.ts"],workers:1})).code;'
```

`final-fix-green-final.log`: **22 pass, 0 fail, suite: PASS**. The selector runs only the three covering entries. It does not run the full suite. Each file stays below 30 seconds:

| Entry | Cases | Seconds |
| --- | ---: | ---: |
| `board/runtime.test.ts` | 12 | 0.146 |
| `tests/board-agent.test.ts` | 6 | 17.014 |
| `tests/native-modules.test.ts` | 4 | 0.260 |

The first post-fix run (`final-fix-green.log`) passed every terminal case but found that my added exact native-error status assertion assumed 2. The pinned compiler actually returns **1** with `hooks/probe.ts(1,24): error TS2868: Cannot find name 'Bun'`. `final-fix-native-diagnostic.log` records that actual diagnostic. The status assertion was corrected to the pinned compiler's observed value; the original nonzero and specific unknown-Bun checks and new source-path assertion remain. A launch failure cannot pass as type-refusal proof.

Generic native producer, quoted terminal, HTTP and executable-validation contracts:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros test board/server.test.ts board/config.test.ts
```

`final-fix-native-contracts-green.log`: **136 pass, 0 fail, 1.57 s**, exit 0. The generic native command assertions, canonical refusal cases, execute permission, first-item trust rules, shell completion and HTTP/CSP checks remain intact. The existing board executor's multibyte cap behavior was not changed.

Final gate:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 PATH=/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/task9-tools/bin:$PATH /private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/bun-floor/node_modules/@oven/bun-darwin-aarch64/bin/bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

`final-fix-gate.log`: exit **0**, last line **verify: PASS**. This includes strict compilation, Biome, configuration/plugin/text validation and pinned generated-byte comparison. Existing validator notices remain. Biome checked the four amended TypeScript files and `git diff --cached --check` passed.

## M1 and affected callers

The one manual sentence in `tests/manual/live-acceptance.md:40` now says lane refusal before **board startup**. No prose mirror or token test was added. Native file entry for this instruction edit read the regular linked-checkout boundary and the whole regular non-symlink config; it has no custom writing instructions.

Caller inventory:

| Caller | Repaired target or contract |
| --- | --- |
| `board/config.ts:readList` | Unchanged validation precedes `bindRuntime`; JSON stays four keys and its first item stays relative. |
| `board/runtime.ts:bindRuntime` | Exact declared Bun commands bind system env assignments, selected Bun and original isolated argv. Native/execute-only commands retain their old arrays. |
| `board/server.ts:runData` | Unchanged executor consumes the bound array with both fixed controls before Bun starts. |
| `board/server.ts:lineOf/openTab` | Unchanged quoting/completion consumes the bound Run/Resume arrays on both workspace and tab creation paths. |
| `tests/board-agent.test.ts` | Four new independent terminal environments plus the retained complete runner/Resume fixtures. Bound-prefix assertion names all nine required items. |
| `tests/native-modules.test.ts` | Direct tsc shebang call is replaced with `findTools`' selected-Bun executable/arguments; real type error is required on a PATH without Node. |
| `tests/manual/live-acceptance.md:40` | Manual lane-refusal observation targets board startup. |

The shared `childEnv`, `bunArgs`, `bunShebang` and `findTools` implementations did not change. They are reused at the missed caller boundaries. No other runtime helper, lock, stream, output limit, Resume identity or producer policy changed.

## Generated bytes, map and concerns

None of the eight generated delivery files differs from repair base a8b0d3d. The fast gate's pinned build comparison passes, so no regeneration was needed and no generated file was edited. Vendor files and historical ADRs are unchanged.

The ignored port map records all five new expanded first-Bun cases, the stronger no-Node compiler oracle, all affected caller edges and the one M1 text change. Current focused case-to-file rows: 690; automatic entries remain 48. Raw logs stay separate from this report. The broader baseline board truncation issue remains outside #96, as ruled by the parent.

No known local repair failure remains. Linux process/native CI and the controller's final checks remain required. Live host/browser/native-loader/token scenarios stay UNRUN under the user's waiver. No full suite, PR, push, issue mutation, Land, other product edit or additional review ran in this wave.

Final commit: `fc773596aa4d66fbae647789a7040f32a96ad717` — `fix(toolchain): preserve Bun isolation at terminal startup`. Final tracked state: clean. All requested repair bookkeeping is complete; the controller owns the next gate and scoped final re-review.
