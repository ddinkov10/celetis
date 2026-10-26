# The board is a part of the engine

## Date

2026-10-26

## Related

- [Issue #102](https://github.com/ddinkov10/celetis/issues/102): the approved spec (approaches A,
  B, and C, the twelve calls, and the risks) and the plan with its Findings.
- [ADR-0009](0009-the-board-is-a-package-of-its-own.md),
  [ADR-0015](0015-one-repository-yaml-config.md),
  [ADR-0020](0020-the-board-is-a-part-of-the-plugin.md),
  [ADR-0025](0025-the-toolchain-runs-on-typescript-and-bun.md),
  [ADR-0026](0026-the-board-resolves-executables-with-libc.md),
  [ADR-0029](0029-the-repository-keeps-no-tests.md),
  [ADR-0030](0030-the-installed-plugin-owns-the-entrypoint.md),
  [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md), and
  [ADR-0034](0034-native-windows-uses-kernel32-and-spawned-children.md): the clauses that this
  record replaces ("Supersedes"). ADR-0034 also gives the Windows paths that the lock module and
  the adapter keep.
- [ADR-0032](0032-shared-configuration-operation-snapshots.md): operation snapshots. A board
  refresh still takes one fresh operation for its resolution and its policy values.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): an install is a separate
  operation (Finding 5).
- `engine/board.ts`, `engine/board/adapter.ts`, `engine/board/data.ts`, `engine/board/server.ts`,
  `engine/board/start.ts`, `engine/lib/locks.ts`, `engine/lib/process-identity.ts`,
  `engine/celetis-flow.ts`, `engine/next-step.ts`, and `AGENTS.md`, "The board".

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- ADR-0009, "The board is a package of its own, and a contract with a version is its input":
  contract 1 as the input of the board, and a board that knows no Celetis.
  - Decision 2 now holds for the page and the placement of the cards only. They still take the
    lanes, the steps, the stages, the reasons, and the tracker name from the document, and the
    board still owns the six states. The data module of the board (`engine/board/data.ts`)
    imports the workflow definition and the resolver of the engine, and it names the tracker
    `GitHub`.
  - Decision 5, and the stdin config that took its place (ADR-0015 and ADR-0020): the board has no
    config. `board.port` of the main `.celetis.yaml` is its one setting.
  - Decision 6: "The config names scripts of the repository. Each of `data`, `run`, and `resume`
    is an argument list whose first item is a file inside the main checkout, and `{n}` is the one
    placeholder. The board knows no agent CLI." A press types one of two fixed lines that start
    `celetis-flow` of the board's own package, and the data lists the agents `claude` and `codex`.
  - The calls of the session, the decisions of the plan, the rules of the build, and the
    consequences that rest on contract 1, its version, its checker `agent-board check`, the config
    keys, or the producer go with them. The five trust rules change as "The trust boundary" below
    says. The six states, the flat layout, and the start in the main checkout with a clean `PATH`
    stay.
- ADR-0015, "One repository YAML file owns Celetis setup", the board paragraph of its Decision:
  "`scripts/celetis board` validates the main config, refuses a lane start, and supplies the fixed
  data, Run, and Resume argument lists to the exact released board through stdin. Only its port
  comes from YAML, below inherited `PORT`. The separate board package keeps its command/path
  validator and contract 1; it does not know YAML or Celetis field names." The start still
  validates the main config, refuses a lane start, and takes its port from YAML below `PORT`. It
  sends no lists and no stdin. The board reads `host` and `gates` of the main YAML through the
  engine at each refresh.
- ADR-0020, "The board is a part of the plugin":
  - In its Supersedes: the words "contract 1, the config keys `data`, `run`, `resume`, and `port`"
    of the parts that it keeps. The flat layout stays, now in `engine/board/`.
  - In its Supersedes: the sentences "The validator and contract 1 stay, now in `board/` of the
    plugin. The board still does not know YAML or Celetis field names." The command/path validator
    and contract 1 are gone. The board reads `host` and `gates` of the main YAML through the engine.
  - Decision, "Stdin is the only config source.": the board has no config source.
  - Decision, "`board/package.json` has no `version`.": the file is gone, with its `bin` entry,
    its `engines` range, and its role as a separate package.
  - Calls of the plan: the usage line
    `usage: agent-board --config-stdin | check --config-stdin | check --stdin (...)`, the status
    text `no issue data: the config has no "data"`, and the rule to keep the trust boundaries of
    `server.mjs` and `config.mjs`. `AGENTS.md`, "The board", now names `engine/board/server.ts` and
    the fixed adapter `engine/board/adapter.ts`.
  - The rest stands: the board is a part of the plugin, and a plugin install or update gives each
    product project the board.
- ADR-0025, "The toolchain runs on TypeScript and Bun":
  - In its Supersedes: the words "and the generic producer and contract 1 stay unchanged".
  - In its Decision: the paragraph from "The board accepts the same four stdin keys." to "The main
    checkout stays trusted, as it was before this decision." The board has no stdin keys and starts
    no producer. The rule that a child Celetis program uses the selected `process.execPath` with
    all isolation flags stays, and the Run and Resume lines follow it.
- ADR-0026, "The board resolves executables with libc", as a whole. Its wrapper served the
  canonical path of a generic producer, which can have mode 0111 and no read permission. No such
  producer exists now. The adapter calls the standard `realpath` of `node:fs/promises` only on the
  entrypoint after its read check, and on directories. It checks the selected Bun with `stat` and
  an execute check, with no canonical path.
- ADR-0029, "The repository keeps no tests, and the verify gate is its only check", in its
  Supersedes: "`agent-board check` stays the contract check of a producer." and "Contract 1 and
  the board command `check` stay." Contract 1 and `check` are gone. The rest of the record stands.
- ADR-0030, "The installed plugin owns the entrypoint": in its Supersedes, "The generic board
  boundary stays project-only."; in its Decision, "Generic stdin keeps its project-only executable
  boundary." The generic stdin path is gone. The adapter still builds its lines in process and
  validates the package entrypoint and the selected Bun, and an HTTP request still selects only the
  host and the issue.
- ADR-0033, "One workflow definition and the skip rule", in its Decision: "`--board` is typed
  against the board `Document`.", and the words "and of `--board`" of "The control flow of the
  runner and of `--board` reads only the types." The form `--board` is gone. `readBoard` of
  `engine/board/data.ts` builds the `Document` from the typed rows of `nextBoard`, so the type check
  still covers the data of the board.
- ADR-0034, "Native Windows uses kernel32 and spawned children":
  - In its Supersedes: "The board now has one resolver for each platform: libc `realpath` on macOS
    and Linux, and Bun `fs.promises.realpath` on Windows.", and the sentence that ADR-0026 keeps
    "the lazy binding, the NUL refusal, native errors, no second resolver after a permission error,
    and the checks of `board/config.ts`". ADR-0026 is superseded as a whole (above).
  - In its Decision, "The board": "On Windows, `realpath` is Bun `fs.promises.realpath`; macOS and
    Linux keep libc." The adapter calls the `realpath` of `node:fs/promises` on each platform, and
    `engine/board/realpath.ts` is gone. Each fixed line starts with `process.execPath`, so each
    Windows line has the `$env:` pairs.
  - In its Consequences: "A board config author must not use an empty item, an item with `"` or
    with a space and a trailing `\`, or a `.cmd` or `.bat` first item with `&`, `^`, or `%`." The
    board has no config, and the two fixed lines have none of these forms.
  - The rest stands. The adapter types the Windows PowerShell 5.1 line of that record, with its
    quote, and `engine/lib/locks.ts` checks a lock owner through `engine/lib/process-identity.ts`.

Older records name `--board`, `next-step --json`, `board.json`, the stdin config, contract 1, and
`agent-board check` in the words of their time: ADR-0003, ADR-0004, ADR-0007, ADR-0012, ADR-0014,
and the Context and the Constraints and evidence of the records above. Except for the clauses
above, that text is history, and this record changes none of it.

## Context

The board shipped inside the plugin (ADR-0020), but it still acted as a generic tool. It received
three command lists (`data`, `run`, `resume`) with `{n}` and `{agent}` templates. It ran the data
command, `celetis-flow --board`, as a subprocess and checked its JSON against contract 1. A generic
stdin CLI (`engine/board/cli.ts --config-stdin`) and a validator for product executables
(`engine/board/config.ts`, with the libc `realpath` wrapper of ADR-0026) existed only for producers
that are not Celetis. No such producer existed. Each extra layer was one more boundary to keep in
step with the engine.

After #101 (ADR-0033), the engine has one typed workflow definition and typed resolver results. The
board must use the same snapshot and the same configuration rules as the runner, with no second
state model, no JSON contract, and no command templates.

## Constraints and evidence

- #101 landed as `8187df9`, and the lane of #102 started there. The runner and the board of
  `8187df9` are the reference for each behavior that does not change.
- #125 (ADR-0034) landed on the trunk as `266a05c` while the lane ran. It gave the lock closures,
  the land-lock check, and the board line a native Windows path. The lane merged it, and the
  checks ran again with `266a05c` as the reference.
- The lock helpers were closures in `main()` of `engine/celetis-flow.ts`. The liveness check of an
  owner must stay exact: on macOS and Linux, a runner owner counts only when its process command
  line holds `celetis-flow.ts`, the process is not a zombie, and its start time equals the
  recorded start. On Windows, the PID and the creation time identify the owner (ADR-0034). A
  mistake makes a live owner look stale, or the reverse (`AGENTS.md`, "Traps").
- The landing lock is a different mechanism: a PID file `<common>/celetis-flow/land-<n>.lock` that
  `land.ts` owns, with its own `land.ts` command check in the resolver.
- Finding 1 of the plan: `celetis-flow --board` ran the start checks of the runner first. So the
  whole read failed when the selected host was not on `PATH`, when `gh` was not on `PATH`, or on an
  update policy conflict. The in-process read has none of these checks.
- Finding 4 of the plan: reports for Bun 1.3.13 to 1.3.14 say that `AbortSignal.timeout` inside
  `AbortSignal.any` did not fire in some cases (oven-sh/bun#29546; nodejs/node#57736 is a similar
  report for Node). `AbortSignal.any` of controller signals aborted in a probe on Bun 1.4.3.
- Finding 5 of the plan: `codexSessionPin` refuses a runner whose package root is not the enabled
  installed Codex root (`celetis: enabled package changed before session start; start a fresh
  runner`). A lane board types the lane entrypoint, so a live Codex Run or Resume from the lane
  stops at that refusal. An install is a separate operation (ADR-0031).
- The standard `realpath` APIs of Bun add a read condition on macOS (ADR-0026). A probe of this
  change on Bun 1.4.3: `realpath` of a mode-0000 file and of a mode-0111 file gives EACCES. `stat`
  and an execute check of a mode-0111 Bun copy succeed, and that copy runs.
- herdr 0.9.3: the board keeps its eight calls (`api snapshot`, `workspace list`,
  `workspace create`, `tab create`, `tab rename`, `pane run`, `agent read`, and `agent focus`). This
  change adds no call.
- ADR-0029 forbids a tracked test. The checks are scratch programs outside the checkout. They
  compare the lane with `8187df9`, and after the merge with `266a05c`, on the same fake `gh` and
  `herdr`.

## Decision

Approach A of the spec: a data module in the board, with shared lock reads.

**The board reads its data in its own process.** `readBoard(main, signal)` of
`engine/board/data.ts` makes one read for each refresh. It creates a fresh operation,
`createOperation(await locateCheckouts(main), { environment: process.env.CELETIS_AGENT }, 'main')`,
with no explicit host. So the Run default is `CELETIS_AGENT`, then `host` of the main YAML, then
`claude`. The `--agent` that started the board selects the host of the board process only (its
update policy check and `CODEX_HOME`). The read calls `nextBoard` of the resolver with that
operation and the signal, reads the issue locks, the runner lock, and the no-progress record, and
builds the typed `Document` of `engine/board/types.ts` with no `contract` field.

**One lock module.** `engine/lib/locks.ts` owns the lock refs `refs/celetis-flow/locks/<name>`, the
owner blob, the liveness check of an owner, the take, the release, and the session registration of
a lock, and the path, the read, and the write of the no-progress record. The runner and the board
use it. The write side moved too, so one module owns the lock format. The liveness check and the
owner start use `processRunsScript`, `processRuns`, and `processStart` of
`engine/lib/process-identity.ts` (ADR-0034). The landing PID file stays in the resolver.

**Static imports, one policy check.** Each module of the data path is a static import. A refresh
loads no plugin file, takes no plugin read lock, and checks no update policy. The board checks the
policy once, at its start. Each Run and Resume starts a new `celetis-flow` process, which makes its
own check, so the engine still enforces the policy.

**A limit, and one line for a failure.** A read has a limit of 60 seconds: an `AbortController`
and a `setTimeout` that the read clears. At the limit, the board stops its wait for the read, also
when a step of the read (a lock read, `locateCheckouts`) does not take the signal. The shutdown of
the board also aborts a running read, and an abort ends the `gh` child. One read runs at a time. On
a failure, the board keeps its last document and shows one line: the first line of the `HostError`
of the operation; the first line of the stderr of the resolver, else
`cannot read the issues from GitHub`; `the issue read did not end in 60 seconds`; or
`the issue read failed` for a failure with no message.

**A fixed adapter.** `celetisAdapter(main)` of `engine/board/adapter.ts` checks two paths once, at
the start, with the messages of the old adapter. The entrypoint `bin/celetis.ts` of the running
package must be a readable regular file, with its canonical path outside the main checkout and
outside each lane worktree. `process.execPath` must be an executable regular file. A path with a
control character is refused. The adapter types two lines, byte for byte the lines of the old
lists:

- Run: `/usr/bin/env`, the two isolation assignments, `process.execPath`, the isolated Bun flags,
  the entrypoint, `--agent <agent>`, `celetis-flow`, and the issue number.
- Resume: the same prefix, then `celetis-flow`, `--resume`, and the issue number, with no
  `--agent`. The saved record gives the host and the exact session ID.

Each item is in single quotes for the pane shell, and ` && exit` ends each line. On Windows, the
adapter types the Windows PowerShell 5.1 form of ADR-0034: `$env:` pairs in place of
`/usr/bin/env` and its assignments, `&` before the items, and `; if ($?) { exit }`. The server
receives `read` and the adapter, not command lists. Before Run and Resume, it checks that the
entrypoint still exists. When it does not, the press returns 409 with
`the plugin version of this board was removed after an update; start the board again`. This check
and the agent check of Run come before any herdr call.

**The trust boundary.** CSP, the loopback binding, the Host and Origin checks, the content type
check, the 1024-byte body limit, the `FILES` containment, the entrypoint and runtime checks, and
the removal of `node_modules/.bin` from `PATH` (`childEnv` of `engine/lib/process.ts`) stay. The
five rules of ADR-0009 become these: the start checks the two paths once; a press types one of the
two fixed lines; only the issue digits and an agent of the last document's `agents` go into a
line; the data comes from the engine in the process of the board, with no checker; and the start
runs in the main checkout only, with a clean `PATH`.

**HTTP.** `can` and `source.isSet` of `GET /api/board` are always true now, so they go with their
page branches and with the status text `no issue data: the config has no "data"`. `POST /api/agent`
keeps its 409 with the text `The main .celetis.yaml controls the default agent. Change host there.`
The page shows the same reason.

**Removed.** `engine/board/config.ts`, `cli.ts`, `contract.ts`, `realpath.ts`, `runtime.ts`, and
`package.json`; the `Config` and `Command` types and the substitution of `{n}` and `{agent}`; the
`contract` field of `Document`; the `--board` form of `celetis-flow`; the `--json` form of
`next-step`; and the data, run, and resume lines of the start. The start prints the repository and
the URL.

**The calls of the spec.** The maintainer can override each one.

1. Remove contract 1, its checker, `cli.ts`, `celetis-flow --board`, and `next-step --json`. The
   maintainer named no use for them.
2. Remove the libc `realpath` wrapper and supersede ADR-0026.
3. Remove the always-true HTTP fields `can` and `source.isSet`.
4. Change the `/api/agent` 409 text to name `host` in the main `.celetis.yaml`.
5. Keep the Run default: the board's own `--agent` does not set it.
6. Keep the Run and Resume text byte for byte.
7. Check that the entrypoint exists before Run and Resume, and refuse with the removal message.
8. Remove `engine/board/package.json`, because its `bin` entry and its separate-package role go.
9. Leave the landing PID-file check in the resolver. The lock module owns only the lock refs of the
   runner and the no-progress record.
10. Use static imports only in the data path of the board.
11. Check the plugin update policy at the board start only. Run and Resume check it in their own
    processes.
12. Remove the `contract` field of `Document`.

## Alternatives considered

- **B. Export the document builder from `engine/celetis-flow.ts`.** This adds fewer files. But the
  lock helpers are closures in `main()`, so they must move anyway, and the runner command module
  becomes a library that the board loads. Rejected: it mixes the runner and the board in one
  module.
- **C. Keep the data subprocess with fixed arguments, and remove only the templates.** This is the
  smallest diff, and each refresh runs fresh code. But it keeps a JSON contract, its checker, and a
  producer process for one producer, and the issue asks for imported functions. Rejected.
- **`AbortSignal.timeout` for the limit.** Rejected by Finding 4: an `AbortController` with a
  cleared timer does not depend on the reported defect.
- **A policy check at each refresh.** Rejected by call 11: the runner of each press makes the same
  check, so a check at each refresh adds the plugin read lock to each read and protects no act.
- **Keep the libc wrapper for the adapter.** Rejected by call 2: the entrypoint must be readable,
  and the runtime needs no canonical path, so no path of the adapter needs it.

The maintainer asked for the cleanest long-term shape. A is that shape: one owner for each concern,
one typed boundary that the compiler checks, and one home for the lock reads.

## Consequences

- The board and the runner use the same workflow definition, the same resolver, the same
  `createOperation` rules, and the same lock module. A change of the document is a change of a
  type that the compiler checks, not a new contract version.
- The board knows Celetis. A second tracker, or a producer outside Celetis, needs a new data module
  and a new adapter.
- Finding 1 gives intended differences. With the default host off `PATH`, the document still
  comes, `agents` reports the missing host, and Run with no choice refuses with its cause. A missing
  `gh` shows the first line of the stderr of the resolver. A policy conflict that starts while the
  board runs shows in the pane of the next Run or Resume, not on the status line of the board.
- A long-lived process runs the data code that it loaded at its start (Risk 3 of the spec). A
  plugin update needs a board restart for new data code, as it already needs for the server code
  (ADR-0020). A refresh still works after the plugin folder goes, and Run and Resume then give the
  removal 409.
- The read names its limit, and the limit and the shutdown end the `gh` child. The old data command
  trapped the SIGTERM of its exec timeout, so a slow `gh` held the read past 60 seconds.
- `jsonRow`, `JsonRow`, `BoardRow`, and `nextBoard` stay in `engine/next-step.ts`. Their one user is
  `engine/board/data.ts`.
- The lock code moved (Risk 4 of the spec). The checks compared the `starting`, `stuck`, and
  `runner` values of the runner and the board with `8187df9`, and after the merge with `266a05c`,
  for a live owner, a dead PID, a process with another command, and a changed start time. These
  checks ran on macOS only; the Windows path of the lock module has no check.
- A live Codex Run or Resume from a lane build stops at `codexSessionPin` (Finding 5). The board's
  part ends at the typed line. The full Codex session is a check by hand of an installed package.
- No board without Celetis is possible now: the generic stdin CLI, contract 1, and
  `agent-board check` are gone.

## Reconsider when

- A second tracker, or a producer outside Celetis, needs the board.
- A running board must take new data code from a plugin update with no restart.
