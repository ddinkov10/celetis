# One workflow definition and the skip rule

## Date

2026-10-25

## Related

- [Issue #101](https://github.com/ddinkov10/celetis/issues/101): the approved spec, the decisions
  of the maintainer, and the plan with its Findings 1 and 2.
- [ADR-0002](0002-loop-script-and-mod-run-the-agent-flow.md),
  [ADR-0005](0005-herdr-gives-the-session-state-and-ends-each-step.md), and
  [ADR-0008](0008-the-build-step-lands-the-change.md): the step-end rule, "no progress", and the
  reason why a landing ends no session, which this record changes ("Supersedes").
- [ADR-0011](0011-a-step-session-hands-a-stop-to-the-issue.md): a step session hands a stop to the
  issue. A stop of the issue still ends the session.
- [ADR-0020](0020-the-board-is-a-part-of-the-plugin.md): the trust boundary of the board, which
  does not change.
- [ADR-0029](0029-the-repository-keeps-no-tests.md) and
  [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): scratch checks, and no
  product adoption.
- [ADR-0032](0032-shared-configuration-operation-snapshots.md): operation snapshots and the
  in-process resolver. One clause changes ("Supersedes").
- #102 (a fixed board adapter) and #103 (lifecycle and landing guards) start from this record.
- `engine/lib/workflow.ts`, `engine/next-step.ts`, `engine/celetis-flow.ts`,
  `engine/lib/config.ts`, `engine/lib/session.ts`, `engine/worktree.ts`, `engine/land.ts`, and
  `engine/setup.ts`.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- The line test of the step-end rule. ADR-0002, "A loop script in a Terminal tab runs the agent
  flow, and a mod ends each step session", Decision: "when the resolver gives another line than the
  line that the session started with, and that line is a `run` line or starts with `stop #<n> `".
  ADR-0005, "herdr gives the state of each session and ends each step, and the mod goes", Decision,
  "The script ends each step through herdr", keeps that test. The job now compares typed decisions
  by result ("Decision", "The same result"). herdr, the tab label, the background job, and `/exit`
  stay.
- The test of "no progress" in the Decision of ADR-0002: "A step that ends with no new line". No
  progress is now a Run of the same step after the session. The record and its effect on the
  automatic runner stay. The record also holds each refused skip.
- The reason in ADR-0008, "The build step lands the change, by the mechanism that the repository
  names", Decision, "A lock holds the step end while the script runs": "The line does not start
  with `stop #<n> `, so the step-end rule of `scripts/agent-flow.sh` (ADR-0005) stays as it is and
  types no `/exit`." The reason is now that a live landing is an observation stop (`Observed`,
  reason `landing`), which never permits an exit check. The result stays the same: the job types
  no `/exit` while the landing runs. The lock stays.
- ADR-0032, "Shared configuration parsing and operation snapshots", Decision: "Internal resolution
  uses `resolveNext` in-process." Internal resolution now uses the typed in-process results
  `nextIssue`, `nextOpen`, and `nextBoard`. `resolveNext` is private to the command boundary of
  `next-step`. The operation, freshness, and shared-refresh rules of ADR-0032 stay.

## Context

Several parts of the engine kept their own copy of the workflow facts:

- The step names were in `engine/lib/config.ts` (the gate keys), `engine/lib/session.ts` (the
  session record), and the `flow` constant of `engine/celetis-flow.ts`.
- The lane labels and the branch prefixes were in `engine/next-step.ts`, `engine/worktree.ts`,
  `engine/land.ts`, `engine/setup.ts`, and the board row `type`.
- The lanes, the stages, and the landing hints were only in the `flow` constant.

For an issue with two lane labels, the copies disagreed. The resolver took `enhancement`, then
`bug`, then `chore`, then `hotfix`. The board `type` took `bug` first. `worktree` refused the issue.

The runner also read control data out of human text. `stepOf()` found the step in a
`run /celetis:<command> #<n>` line. `startsWith('run ')` and `startsWith('stop #<n> ')` found a
decision. `JSON.parse` of the `next-step --json` text gave the board rows.

The runner had no rule for allowed transitions. After a step, it continued to each changed `run`
line, also when the lane skipped a step. The harness rule "A lane never skips a step" had no check
in the runner.

## Constraints and evidence

- The GitHub issue is the state store (`docs/issue-tracker.md`). The resolver reads a snapshot of
  the issue. The tracker gives no events that a state machine can use.
- #100 landed as `c9337c0` (ADR-0032). Its in-process `resolveNext(argv, operation, signal)` still
  returned `{ code, stdout, stderr }` text. The resolver and the runner of `c9337c0` are the
  reference for each behavior that does not change.
- `engine/lib/config.ts`, `engine/lib/session.ts`, and `engine/worktree.ts` need the vocabulary.
  A command module carries `gh` and process code, so these modules must not import one.
- These must stay: the public lines of `next-step <n>`, `--open`, and `--json`; the format
  `<n>\t<line>` of the `no-progress` record; the lock basenames `land.ts` and `celetis-flow.ts`;
  and contract 1 of the board. The board contract, server, config, and browser modules do not
  change, because #102 owns the board wiring.
- Finding 1 of the plan: `laneOf` returns `epic` before it reads the lanes, because the resolver
  and `worktree` need that order. Decision 4 of the maintainer takes the board `type` from `laneOf`
  in every row. So the row of an issue with `epic` and a lane label (a closed issue, or an issue
  with `needs-info` or `ready-for-human`) changes its `type` from that lane to `null`.
  `docs/issue-tracker.md`, "Epics", says that an epic has no lane label. The plan accepts this
  change as a second exception to the byte equality of `--json`.
- Finding 2 of the plan: `codexSessionPin` in `engine/lib/plugin-metadata.ts` refuses a runner
  whose package root is not the enabled installed Codex root. So a checkout runner cannot start a
  Codex step session, and an install is a separate operation (ADR-0031).
- ADR-0029 forbids a tracked test. The checks are scratch programs outside the checkout. They
  compare the lane with `c9337c0` on the same fake GitHub, `gh`, and `herdr`. A fake herdr cannot
  prove a typed step end on a real host.

## Decision

**One definition.** `engine/lib/workflow.ts` holds the workflow as plain `as const` data and pure
functions. It imports no process, file-system, `gh`, configuration, or host code. It has no
setting, registry, or loader, so a product project cannot change it. It holds:

- the ten labels;
- the four lanes `feature`, `bug`, `chore`, and `hotfix`, each with its label, its branch prefix,
  and its ordered steps. This `lanes` table is the only source of the lane order;
- the seven steps, which are the union of the lane steps, and the command of each step
  (`specify` runs `/celetis:feature`);
- the stages, from the position of a step in its lane (0 Triage, 1 Define, 2 Plan, 3 Implement),
  and the landing steps, which are the last step of each lane;
- the default gate `me`;
- `laneOf(labels)`: one lane, `epic`, none, or several, with the labels that conflict;
- `decide(issue)`: a typed decision from the issue data only, by the ordered state table of the
  spec. Row 6, two or more lane labels, is a new stop after `epic` and before the unrouted row;
- `sameResult(a, b)` and `skipped(from, to, lane)`.

The config reader (the gate keys), the session record (the steps and the host command),
`worktree` and `land` (the prefixes, the branch globs, and the PR pattern), `setup` (the labels),
the resolver, and the runner import it. They keep no list of their own.

**A typed boundary.** A decision is a Run, with the step, the lane, and the state, or a Stop, with
the reason, its variant, and its data. `engine/next-step.ts` keeps the GitHub collection, the
boundary validation of each field that the resolver reads, the local observations, and the text
format. A dirty checkout, a live landing, and a failed read are a separate `Observed` type. The
module exports typed results for the three forms: `nextIssue`, `nextOpen`, and `nextBoard`. The
text format (`lineOf`, `jsonRow`) makes each line and row from a decision, and it covers each case
of the union. So a new reason with no text fails the type check. The control flow of the runner
and of `--board` reads only the types. `--board` is typed against the board `Document`.
`stepOf()`, the `startsWith` checks, the `flow` constant, and the parse of `--json` text go.

**The same result.** The runner compares two decisions in three places: "no progress", the step
end, and the second read of the step end. Two Runs have the same result when they have the same
step. Two Stops have the same result when they have the same reason, variant, and data. The state
and the lane are not part of the result. So when an issue goes from planned to built during
`implement`, the session stays open.

**The skip rule.** After the session of step S ends, the runner reads the next decision. When it is
a Run of a step T other than S, in lane L, T is allowed when its position in L is at most one more
than the position of S. When S is not in L (a lane change), T must be at position 0 or 1 of L. A
Run of `triage` is always allowed. The check runs only between two steps of one chain of
`runIssue`, after the "no progress" check and before the gate check. A refusal prints one line,
appends `<n>\t<run line of T>` to the `no-progress` record, and ends the issue. The automatic
runner then does not take that row, and the board shows the card as `stuck`.

**The explicit start is the override.** The first step of `celetis-flow <n>`, and the first step
that the automatic runner takes, have no skip check. So a start with the number by the maintainer
runs T. The rule reads no session record and no history of the issue.

**One lane label.** An issue with two or more lane labels stops before a session starts. Its board
row is `blocked` with the reason `several lane labels`. The board `type` and `urgent` come from
`laneOf` in every row. So such an issue, and an issue with `epic` (Finding 1), has `type: null`
and `urgent: false`.

## Alternatives considered

- **B. The definition in `engine/next-step.ts`.** This has one file fewer. It was rejected, because
  `config.ts`, `session.ts`, and `worktree.ts` would import a command module with `gh` and process
  code. Also, collection, resolution, and format would not stay apart.
- **C. An explicit state-machine table.** A from→to list is the transition data. It was rejected,
  because it writes the lane order a second time, next to the `lanes` table, and nothing checks
  that the two agree. GitHub is the state store and the resolver reads a snapshot, so no events
  drive a machine. This approach also comes near a workflow language, which the issue forbids.
- **Keep the text interface.** The runner continues to parse resolver lines and JSON text. It was
  rejected: a change of the words of a line can change the control flow, and nothing finds a new
  reason with no text.
- **Compare the whole decision.** It was rejected, because the state is not part of the result. A
  change from planned to built during `implement` would end the session at its next idle moment.
- **A skip check from the session record or the history of the issue.** It was rejected by
  decision 1 of the maintainer. The rule applies only inside one chain, and it must not refuse an
  explicit start.
- **A board state of its own for a refused skip.** It was rejected, because it changes contract 1
  and the page, and #102 owns the board. The maintainer accepted `stuck`, which the page labels
  `no progress`.

## Consequences

- The step order of a lane is one edit of the `lanes` table. The stages, the landing steps and
  their hints, the branch prefixes, the gate keys, the steps of the session record, and the skip
  rule follow from it. A new lane needs more: its rows in `decide` (else its issue falls through
  to a Run of `plan`), and its label in `labels`, with a description and a color in `setup`. A new
  step also needs its row in `decide`, and a step at a fifth position needs a stage name in
  `stageNames`. The type check finds a new reason with no text, and a board status that the
  contract does not know.
- Two lane labels give one result: the resolver stops, `worktree` refuses with its message, and
  the board shows `type: null`.
- The `--json` output changes for an issue with two or more lane labels, and for an issue with
  `epic` and a lane label (Finding 1). The other public lines stay byte-for-byte, apart from the
  new line of row 6.
- The two variants of `ready-for-human` print the same line, but they are two results. When the
  variant changes between the two reads of one step-end check, `/exit` waits for the next idle
  check. The old compare of lines submitted `/exit` at that check.
- A refused skip shows on the board as `stuck`, with the label `no progress` and the resume act.
  That label is less precise than a state of its own. A row of the record never expires; this is
  the current behavior.
- A transition that the lane order cannot express needs a named exception on top of the
  definition.
- The live Codex step end of this change is an open runtime check (Finding 2), in
  `docs/celetis-flow.md`, "Acceptance status".

## Reconsider when

- A transition needs a named exception that the lane order cannot express. Two examples: a lane
  change to the `plan` step of the new lane when the define evidence of that lane is already on
  the issue, or `plan` after `triage` for an issue whose spec a person wrote by hand.
- The tracker gives events that a state machine can use, or Celetis gets a second state store.
- A product project must define its own lanes, steps, or labels.
- The board contract gets a state of its own for a refused skip (#102), or a lifecycle guard needs
  the history of the issue (#103).
