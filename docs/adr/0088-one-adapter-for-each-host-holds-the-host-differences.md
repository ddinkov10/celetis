# One adapter for each host holds the host differences

## Date

2026-11-09

## Related

- [Issue #267](https://github.com/ddinkov10/celetis/issues/267): the spec (body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/267#issuecomment-6737391894), which holds the plan
  with its "Decisions of the plan session" and its "Reader list".
- Labels in this record: "Task N" names a task of that plan. "Risk 2" and "Done when" name parts of the spec.
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195): finding F10, marked "take" on 2026-11-05.
- [Issue #26](https://github.com/ddinkov10/celetis/issues/26): a new host.
- [Issue #262](https://github.com/ddinkov10/celetis/issues/262): replaces `requireSameRevision` and the home
  binding of `bindUpdateHome`.
- [Issue #251](https://github.com/ddinkov10/celetis/issues/251): replaces the install path.
- [Issue #269](https://github.com/ddinkov10/celetis/issues/269): owns the board structure.
- [ADR-0080](0080-the-daemon-ends-a-claude-host-with-sigterm-after-a-grace.md): the end of a Claude host after its
  grace, which is now a part of the adapter.
- [ADR-0081](0081-the-resolver-and-the-updater-are-libraries-and-no-library-imports-a-command.md): no library
  imports a command. The adapter modules follow it.

## Supersedes

Only this clause changes. The accepted record keeps its historical text and evidence.

- [ADR-0087](0087-the-board-reads-engine-state-through-one-read-model.md), decision 3, "the checks `isHost`,
  `isCommit`, `isIssueNumber`, and `isIssueField`": `engine/lib/fields.ts` holds the checks `isCommit`,
  `isIssueNumber`, and `isIssueField`. `isHost` lives in `engine/lib/host-names.ts` (decision 1 of this record),
  and each module that imported it from `engine/lib/fields.ts` imports it from there.

## Context

Each module that starts, resumes, checks, or measures a host session asked `host === 'claude'` itself. At
`d3779b1` the spec counted 91 host comparisons in 39 files, by a grep of `engine/` and the entry for
`=== '<host>'` and `!== '<host>'` with each line read. They are input guards (25 copies in 17 files, and 5 local
predicates), session behavior (arguments, pin, environment, identity, native check, recovery text, usage capture,
session variable, end after grace, terminal app and exit keys), and installation, update, capability, and
dispatch-record rules. A change of a host CLI had to find every branch.

The spec also counted 10 writes of a host home into the global `process.env` in `engine/`. Nine wrote the result
of `codexHome()` into `process.env.CODEX_HOME` for the host codex: eight behind an `if` that compares the host with
`'codex'` (`root.ts`, `issue.ts`, `worktree.ts`, `next-step.ts`, `setup.ts`, `lib/interactive.ts`, `lib/landing.ts`,
`lib/run-engine.ts`), and `lib/capability-binding.ts` inside its `codex` branch. The tenth is `bindUpdateHome`
(`lib/plugin-metadata.ts`). `lib/landing.ts` and `lib/run-engine.ts` ran inside the master daemon, so their write
outlived the run that made it. `scripts/` held three more writes behind such an `if` (`verify.ts`, `build.ts`,
`install-tools.ts`), so a grep over `engine/` and `scripts/` at `d3779b1` finds 13 writes into `process.env`.
`daemon.ts` wrote a local `env` object, and `updater.ts:292` is a read: neither is a write into `process.env`.

## Constraints and evidence

- Risk 2 of the spec was real. The plan session probed the static run-time imports at `d3779b1`: `events.ts`
  loads 11 modules and no `config-core.ts`, and `update-worker.ts` (12 modules) and `run.ts` load `events.ts`
  before any module that loads `config-core.ts` and its YAML parser. A `isHost` in `config-core.ts` would add that
  load to those starts. The result is in the plan comment, "Decisions of the plan session".
- The browser `tsc` (`engine/board/page/tsconfig.json`, `types: []`) compiles `config-core.ts` through the page
  imports of `Host`. A leaf module that names a Node type, or imports `session.ts`, breaks that compile.
- The adapters import `homes.ts`, so a `configHome` inside an adapter would make that import circular.
- The "Reader list" of the plan lists, for each removed write, the child processes and modules that run after it
  and what each one reads. No host child needs the global value after the change: the `session-start` form of
  `daemon.ts` (Task 2) and the interactive spawn (Task 3) get the home as a value.
- The plan comment names "Task 4" as the task of this change. It expects, for a relative and a missing
  `CODEX_HOME`, the same message and exit code 2 as on `d3779b1`, and for a linked home one difference: the
  product worktree setup sees the link path, not the realpath. The Verify report on
  [issue #267](https://github.com/ddinkov10/celetis/issues/267) records the observed result (scenario V6 of the plan).

## Decision

1. **The modules.** `engine/lib/host-names.ts` is a leaf that holds `hosts`, `Host`, and `isHost` and imports
   nothing. `engine/lib/host-types.ts` declares `HostAdapter`. `engine/lib/host-claude.ts` and
   `engine/lib/host-codex.ts` each export one adapter object. `engine/lib/hosts.ts` holds the table
   `{ claude, codex } satisfies Record<Host, HostAdapter>` and `hostAdapter(host)`, so the compiler requires each
   part for each host. `config-core.ts` re-exports `type Host`.
2. **The parts.** An adapter holds the terminal app and exit keys, the home check and the home environment, the
   step environment, the plugin pin, the step prompt and arguments, the resume and interactive arguments, the
   start ID and the claim, the native session check, the recovery text, the usage capture (prepare and read), the
   session variable, and the end after the exit grace.
3. **The home.** No module of `engine/` or `scripts/` writes `CODEX_HOME` into `process.env`, except
   `bindUpdateHome` and its undo in `requireSameRevision`. Each command that needs a valid home calls
   `hostAdapter(host).checkHome()` where it wrote the variable, so an invalid home gives the same message and exit
   code at the same point. The home goes into each session host child as a value: `homeEnv()` of the adapter is the
   only place that puts it into the environment of the `session-start` form of `daemon.ts` and of the interactive
   spawn. Other children already set the home as a value and stay: `codex-app-server.ts` and
   `plugin-metadata.ts` (the children of the plugin inspection and update), and `updater.ts` (the children of
   `updatePlugin`). `configHome` in `homes.ts` reads a `Record<Host, () => string>` table.
4. **The usage modules.** `usage-claude.ts` and `usage-codex.ts` are the usage part of their adapters (a
   maintainer decision, 2026-11-09, recorded in the plan comment). Their record checks stay.
5. **The modules that keep a host comparison.** A grep of `[!=]== '(claude|codex)'` in `engine/` and the entry,
   without `engine/board/page/`, run on the final tree of Task 4, finds lines only in these modules:
   `updater.ts`, `plugin-metadata.ts`, `plugin-policy.ts`, `update-lock.ts`, `setup-status.ts`, `capability.ts`,
   `capability-binding.ts`, `dispatch-record.ts`, `usage-claude.ts`, and `usage-codex.ts`. The first five are the
   installation and update modules, which already split by function, and #262 and #251 replace parts of them. The
   capability binding is a model of its own. The dispatch record names native tool calls of a child dispatch, not
   a session. `usage-codex.ts:123` compares a rate-limit ID, not a host.

## Alternatives considered

- **An abstract base class with one subclass for each host.** The engine has no classes outside its error types,
  and the two hosts share no state. It adds a hierarchy and removes nothing that the table keeps.
- **The Agent Client Protocol.** It drives an agent over JSON-RPC, not its native terminal UI. Celetis runs the
  native interactive sessions in herdr tabs (decision 4 of #195).
- **A `Record<Host, …>` table at each site, with no adapter.** It removes the branches, but the facts of one host
  stay in many files. It remains only for text that one command owns.
- **`isHost` in `config-core.ts`.** It adds the YAML parser to the start of commands that load `events.ts` today
  (see "Constraints and evidence").
- **`isHost` in `engine/lib/fields.ts`**, where ADR-0087 put a copy. The test then lives apart from the list
  `hosts` and the type `Host` that it checks, which `config-core.ts` and `terminal.ts` import from
  `host-names.ts`. So the merge of #269 kept the copy in `host-names.ts`, next to the list and the type. Both
  copies accept the same values: exactly `claude` and `codex`.

## Consequences

- A host CLI change edits one adapter module.
- A child that is not a host child and inherits `process.env` after a removed write sees the parent value of
  `CODEX_HOME`, not the realpath: the product worktree setup, Git hooks, the landing suite, and a successor daemon.
- A Claude host child that inherits `process.env` also sees the parent value of `CODEX_HOME`, not the realpath that
  an earlier write left: `claude plugin validate` of `scripts/verify.ts` when the gate runs with `--agent codex` or
  `CELETIS_AGENT=codex`, and `claude plugin list --json` (`nativeJson`, which `installation` calls in
  `requireSameRevision` of a Claude run) in the daemon after a Codex run or landing. Claude Code documents no use of
  `CODEX_HOME`, and no behavior change is known. The maintainer accepted this change on 2026-11-09 as a part of the
  second exception to "Done when" 6, which the plan states in its "Global Constraints". The Verify report on
  [issue #267](https://github.com/ddinkov10/celetis/issues/267) records the decision.
- A successor daemon gets the start value of `CODEX_HOME`. With the variable unset and no `~/.codex`, its update
  check no longer depends on earlier Codex work in the old daemon.
- Each command that checks the home now loads `hosts.ts` and both adapters, where it loaded `homes.ts` only.
- The home check stays at each old site, so an invalid home still stops a command at the same point.

## Reconsider when

- #26 adds a host: it adds one adapter and one row of the table.
- #262 or #251 replaces the update home binding: the rule of "no global write" can then lose its one exception.
