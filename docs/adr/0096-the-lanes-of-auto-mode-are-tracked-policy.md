# The lanes of auto mode are tracked policy

## Date

2026-11-10

## Related

- [Issue #139](https://github.com/ddinkov10/celetis/issues/139): the spec (the body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/139#issuecomment-6778947159). In this record, "rule
  <k>" names a rule of "Required behavior" of the spec, "Approaches", "Prior art", and "Session calls" name parts of
  the spec, and "V<k>" names a scenario of the Verify phase of that plan. The runtime report of the build, a comment
  of the same issue, holds the result of each scenario.
- [ADR-0069](0069-step-agent-preference-is-tracked-policy.md): `agents` is tracked policy of the same file, read
  from the main checkout "as `gates` is". This record follows it and replaces no clause of it.
- [ADR-0015](0015-one-repository-yaml-config.md): its Decision lists the root fields of the schema at its date, and
  ADR-0069 added `agents` after it. This record adds `autoLanes` under its rule "Reject invalid supplied config
  rather than substitute defaults" and replaces no clause of it.
- [ADR-0032](0032-shared-configuration-operation-snapshots.md): each new workflow step reads the main configuration
  fresh. The live read of the list uses that read and adds none.
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md): "The first step of `celetis-flow <n>`, and the
  first step that the automatic runner takes, have no skip check." The sentence stays. The lane test of a run comes
  before the skip check.
- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md) and
  [ADR-0077](0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md): the master daemon, and the
  carry of auto mode over a restart. The successor reads the list from the file, so the carry holds no list, and no
  clause of the two records changes.
- [ADR-0007](0007-specify-is-a-step-of-the-runner.md), Consequences: "With `specify` as `auto` on a machine, the
  automatic runner opens a design session for the lowest feature with no spec". It is a consequence of its date and
  no decision clause, so it stays out of `## Supersedes`. With a list that does not name `feature`, auto mode opens
  no such session.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the change adds no declaration to
  `engine/lib/contract.ts`, so the contract version stays.

## Supersedes

Only this clause changes. The accepted record keeps its historical text.

- [ADR-0002](0002-loop-script-and-mod-run-the-agent-flow.md), Decision: "with no number it runs each `auto` step of
  each open issue, one issue at a time." With `autoLanes`, auto mode runs an `auto` step only for an open issue
  whose lane the list names. With no `autoLanes`, the clause holds as before.

## Context

Auto mode of the daemon takes the lowest open issue whose next step has the gate `auto`, in each lane. The gates
are set for each step, and the lanes share the steps `triage`, `plan`, and `implement`. So a project cannot let one
lane run by itself while the other lanes wait. In this repository each gate is `auto`: auto mode would triage each
issue with no lane, and specify, plan, build, and land each feature. The maintainer did not turn it on for that
reason (spec, "Intent").

## Constraints and evidence

- The maintainer asked for a configuration of auto mode by lane, and decided that the list accepts `triage` for
  the issues with no lane (spec, "Session calls").
- The pattern is a list in the tracked configuration of an automatic worker: Sidekiq `:queues:`, the tags of a
  GitLab runner with the switch "Run untagged jobs", and `label_trigger` of claude-code-action ("Prior art").
- A decision of the resolver carries its lane: `Run.lane` of `decide` in `engine/lib/workflow.ts`, which is `null`
  for the `triage` step of an issue with no lane.
- `createOperation` reads the main configuration before each pick of auto mode and before each step of a run
  (ADR-0032), so a list in the file needs no new read and no signal to the daemon.
- The input kind `auto` marks a run that auto mode started, and a takeover continues a run with its saved input.
- A gate also decides whether a started run continues. One gate value cannot say that a start with a number
  continues through a step and that auto mode does not start it.
- The contract digest covers no configuration field: the verify gate of the build printed no new digest.

## Decision

1. **The field.** `.celetis.yaml` accepts the root field `autoLanes`: a sequence with one or more of the names
   `triage`, `feature`, `bug`, `chore`, and `hotfix`. The four last names are the keys of `lanes` in
   `engine/lib/workflow.ts`; a label name, for example `enhancement`, is no lane name. `triage` stands for a Run
   with no lane. A repeated name has the meaning of one. `checkSchema` of `engine/lib/config-core.ts` is the one
   point that validates the field. A value that is no sequence, an empty sequence, and an element that is none of
   the five names are an invalid configuration, and the refusal names the field and the accepted names.
2. **The pick.** With a list, auto mode takes an open issue only when its decision is a Run whose lane is in the
   list (`autoTakes` of `engine/lib/workflow.ts`). Each other condition of the pick stays: the gate `auto`, no row
   in the record, a free issue lock, and the lowest number first.
3. **The run.** A run that auto mode started applies the same test before each step that it starts, the first step
   too. Before a step whose lane is outside the list, it prints one line with the issue, the name, and the start by
   hand, and ends the issue with the end kind `gate` and the code of a done run. It adds no row to the record. The
   test is the first statement of the branch of `runIssue` that holds the checks for no progress, a refused skip,
   and the gate. The quota recovery of a started step skips that branch, so it has no lane test.
4. **No list.** With no `autoLanes`, auto mode takes each lane and each issue with no lane, as before. An empty
   list is refused: auto off already says "take nothing".
5. **Only auto mode.** A run has one of four input kinds. Only the kind `auto` has the lane test. A start with a
   number and a Run press (the kind `number`), a queue run (`queue`), and `run resume` (`resume`) have none.
6. **A live read.** The engine reads the list from the main checkout at each pick and before each step of a run of
   auto mode. The decision adds no state, lock, record, request field, command, or contract declaration.

## Alternatives considered

The first one is pattern 2 of "Approaches". The others are the ways that "Approaches" lists after its patterns.

- **An option of the turn-on command**, for example `celetis daemon auto on bug`, as the option `-Q` of a Celery
  worker. The limit would be state of one daemon process that no file shows. The carry of auto mode over a restart
  (ADR-0077) and the status of the daemon would need the lanes too.
- **Gates for each lane** (`gates.<lane>.<step>`). A gate also decides whether a started run continues. A feature
  that the maintainer starts with a number must continue through its `auto` gates, while auto mode must not start
  it.
- **The gate of `triage` decides the triage of auto mode with a list.** That gate also stops a queue at a later
  member with no lane. One gate value cannot say that the queue triages and auto mode does not.
- **A list with lane names only**, with no automatic triage when a list is set. A project could then not combine an
  automatic triage with a limit on the lanes.

## Consequences

- A project can let one lane run from the triage to the landing, while each issue of another lane waits for a Run
  press, the queue, or a start with a number.
- With `triage` and a lane in the list, a triage of auto mode decides alone what runs: a wrong route to that lane
  starts the lane with no check by the maintainer. A project that wants the check leaves `triage` out of the list.
- Auto mode takes each open issue of a listed lane, the lowest number first. There is no order by priority.
- A session by hand and auto mode can work on one issue, because a session by hand holds no issue lock. The list
  does not change this risk. The spec inferred it from the code, and no probe ran.
- An edit to an invalid list while auto mode is on ends auto mode at its next operation, as each other invalid
  field does.
- Two titles of the board become imprecise with a list: the title of the `auto` mark of a card, and the title of
  the item `Daemon`. The page does not change with this record.
- An engine from before this record refuses the field as unknown. A project adds the line only when each engine
  that reads its file has the field. For this repository, the maintainer adds `autoLanes: [triage, bug]` after the
  update of the installed engine (rule 10; the plan, "Decisions of this plan", 1).

## Reconsider when

- A project needs an order of the issues by priority, or a limit on the number of sessions
  ([#156](https://github.com/ddinkov10/celetis/issues/156)).
- The board gets a control or a display for the lanes of auto mode.
- A session by hand gets an issue lock.
- A lane filter is wanted for a start with a number, a Run press, or the queue.
