# Triage is a stage before the lanes

## Date

2026-11-22

## Related

- [Issue #365](https://github.com/ddinkov10/celetis/issues/365): the spec (the body of the issue, `Spec: 2026-11-22`), the
  [captures of the look](https://github.com/ddinkov10/celetis/issues/365#issuecomment-7078015899) that the maintainer
  picked, and the [plan comment](https://github.com/ddinkov10/celetis/issues/365#issuecomment-7078169890). In this
  record, "approach <X>" names an item of "Approaches" of the spec.
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md): the `lanes` table stays the only source of the lane
  order, and the definition stays plain `as const` data with pure functions. Its decisions "the four lanes", "the landing
  steps", "`decide`", "`sameResult`", and "A Run of `triage` is always allowed" stay true.
- [ADR-0038](0038-a-bug-session-hands-on-to-plan.md): `handsOn` stays. A `bug` session still hands on to `plan`, and the
  position of `bug` in its own lane is still the position of `plan`. Its Context names the lane `bug` with the step
  `triage`; that text states the old order and stays as history.
- [ADR-0127](0127-the-gates-are-keyed-by-lane.md): the keys of `gates`, the accepted values, the default, and `gateOf` stay.
  Its Alternatives sentence "eight pairs of a lane and a step after `triage`" counts the same eight pairs after this
  record, so it stays as context.
- [ADR-0057](0057-the-step-before-decides-the-effort-of-the-next-step.md): `triage` decides the level of the first step of the lane. The
  rule stays, and it is now the rule of `decisionOf` for a first step.
- [ADR-0096](0096-the-lanes-of-auto-mode-are-tracked-policy.md): `autoLanes` does not change.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md), Decision, "One definition":
  - "the seven steps, which are the union of the lane steps": the seven names stay, and `steps` is now `triage`, then
    the union of the own steps of the lanes.
  - "the stages, from the position of a step in its lane (0 Triage, 1 Define, 2 Plan, 3 Implement)": the Triage stage is
    now its own stage with the step `triage`, and Define, Plan, and Implement come from the position of a step in the
    own steps of its lane (0 Define, 1 Plan, 2 Implement).
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md), Decision, "The skip rule": "When S is not in L (a lane
  change), T must be at position 0 or 1 of L." becomes "T must be the first step of L".
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md), Consequences: "a step at a fifth position needs a stage
  name in `stageNames`" becomes "a step at the fourth position of a lane needs a stage name in `laneStageNames`".
- [ADR-0038](0038-a-bug-session-hands-on-to-plan.md), Decision, "The skip rule only": "T must still be at position 0 or 1
  of L" becomes "T must still be the first step of L". The rest of that paragraph stays.
- [ADR-0127](0127-the-gates-are-keyed-by-lane.md), Decision 2: "which is the gate of each step of the lane after
  `triage`, or a mapping from a step of that lane after `triage` to `manual` or `auto`" becomes "the gate of each step of
  the lane, or a mapping from a step of that lane to `manual` or `auto`".
- [ADR-0127](0127-the-gates-are-keyed-by-lane.md), Decision 4: "a step key that the lane does not have after `triage`"
  becomes "a step key that the lane does not have". The cases `gates.chore.plan`, `gates.feature.bug`, and
  `gates.bug.triage` stay refused.
- [ADR-0127](0127-the-gates-are-keyed-by-lane.md), Decision 7: "from each step of the lane (`triage` too) to its gate" becomes
  "from each own step of the lane to its gate, with no `triage` key", and "the `triage` segment of each lane track shows the
  gate of `triage`" goes, because a lane track has no `triage` segment. The mapping `triage` with the one key `triage`
  stays.
- [ADR-0127](0127-the-gates-are-keyed-by-lane.md), Consequences: "because each of those lanes has one step after `triage`"
  becomes "because each of those lanes has one step".

## Context

The maintainer said: "first is intake, then triage then type lane and the steps inside them". The engine model did not
show that order. At `655ebef`, `lanes` in `engine/lib/workflow/workflow.ts` listed `triage` as the first step of each
lane (lines 5 to 8), and these places took it out again:

- `Gates` of the same file (line 36) excluded it from the step keys of a lane.
- `checkGates` in `engine/lib/config/core.ts` filtered it from the allowed keys (line 322).
- `Decided` and `decidable` in `engine/lib/workflow/effort.ts` excluded it (lines 24 and 25), and `decisionOf` returned
  no decision for it (line 51).
- `skipped` started its slice at index 1 for a step that is not in the lane (`workflow.ts`, line 443).
- `stageOf` was the index of a step in its lane (line 54), so the resolver tested `stageOf(step) > 1` for `started`
  (`engine/lib/resolver/resolver.ts`, line 258).
- The board read gave `triage` in `flow.lanes` and in `flow.gates.<lane>` (`engine/lib/board-read/board-read.ts`,
  lines 94 to 102), and `stepsOf` of `engine/board/place.ts` (line 80) read the step names from `flow.lanes`.

The board showed `triage` as the first segment of each lane track, and the documents said both "after `triage`" and "the
triage of an issue with no lane".

## Constraints and evidence

- The persisted records parse `step` with `z.enum(steps)`. `steps` must keep the same seven names, so that each existing
  record stays valid.
- `plugins/celetis/hooks/entry.js` holds a generated copy of the config check and of `lanes`. `scripts/build.ts` writes it
  again, and the verify gate compares the bytes.
- The behavior of a run must stay the same: the same decisions, gates, effort pairs, allowed and refused skips, and the same
  `started` flag of a board row. The spec names no change of the question rules or of the default gates.
- Intake runs before an issue exists. The resolver never decides it, and no issue state holds it.
- The research of the spec found one pattern in four sources (Linear, Kubernetes, Jira, and BPMN): a classification stage
  before the typed workflows, which picks the workflow and is not a step of it. The four stepper components that the spec
  read derive each state only from the steps in their list.

## Decision

1. **The model.** `lanes` holds only the own steps of each lane: `feature` has `specify`, `plan`, `implement`; `bug` has
   `bug`, `plan`, `implement`; `chore` has `chore`; `hotfix` has `hotfix`. `LaneStep` is the union of the lane steps, and
   `Step` is `'triage' | LaneStep`. `laneSteps` is the union in lane order, and `steps` is `triage`, then `laneSteps`: the same
   seven names in the same order. No lane lists `triage`.
2. **The stages.** `stages` is the Triage stage (`triage`), then one stage for each position of a lane step: Define
   (`specify`, `bug`, `chore`, `hotfix`), Plan, and Implement. The names and the order of the four stages stay. `stageOf` is
   the index of the stage that holds the step: `triage` 0, a define step 1, `plan` 2, `implement` 3. These are the old
   values, so the `started` test keeps its result.
3. **The skip rule.** In the lane L, T may start when its position in L is at most one more than the position of S, with
   the position of `handsOn[S]` for S. When S is not a step of L, T must be the first step of L, and `triage` can always
   start. `skipped` returns no step for a start of `triage`. So the pairs of the engine stay the same: `bug` to `implement`
   is allowed, `triage` to `plan` and `triage` to `implement` are refused, and a relabel from `specify` to `bug` is allowed.
4. **The decider.** `Decided` is `LaneStep`, and `decidable` is `laneSteps`. `decisionOf` gives no decision for a run of
   `triage`. For a lane step, the deciding step is the step before it in its lane, and `triage` for the first step of the
   lane. The `by` of each pair stays: `Effort: specify ...` is decided by `triage`.
5. **The config.** `checkGates` takes the allowed step keys of a lane from `lanes[name].steps` with no filter. `Gates` maps a
   lane to a gate or to a partial mapping of its own steps. The accepted and refused files and the refusal messages do not
   change: `gates.bug.triage` is refused with `need one of bug, plan, implement`.
6. **The board data.** `flow.lanes` gives the own steps of each lane, `flow.stages` gives the four stages, and `flow.gates.<lane>`
   holds a gate for each own step of the lane, with no `triage` key. `flow.gates.triage.triage` stays, and `flow.steps` keeps a
   row for each of the seven steps. `stepsOf` of `engine/board/place.ts` reads `flow.steps`, so a session tab `#<n> triage`
   keeps its step.
7. **The track.** The lane track of a card and the Lane section of the details panel show only the steps of the lane, and
   they count "Step N of M" over those steps. A card at the step `triage` has no lane track, also a triage session tab
   whose issue already has its lane label. The page `gateOf` follows the engine: `flow.gates.triage.triage` for the step
   `triage` or a card with no lane, else `flow.gates.<lane>.<step>`. The Lane list has the accessible name
   `Steps of the lane <lane>`, and a step after the current step carries the visually hidden text `not started`. The look of
   the board does not change beyond the removal of the `triage` segment.
8. **Unchanged.** `decide`, `gateOf` of the engine, `lands`, `autoLanes`, the labels, the config keys, the question rules, the
   default gates, and the persisted records. Intake stays out of the engine model: it is a board control and a skill, and
   only the documents name it as the first stage.

The consumers read one shape. None of them filters `triage` out of a lane.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: the model states the real path of a change, from intent through triage to the lane and the
  trunk.
- Serves: 4 Product neutrality: the order is a role of the harness (a classification stage, then a typed lane), with no part
  of a product.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **Approach B: intake is a stage of the engine model too.** Rejected: intake runs before an issue exists, so no decision of
  the resolver and no issue state can hold it. A stage with no state is a second list that nothing checks.
- **Approach C: keep the model, and change only the documents.** Rejected: it fails the done-when ("No lane lists triage as one
  of its steps"), and the six special cases stay.

## Consequences

- A new consumer of `lanes` needs no rule about `triage`. A lane step that a consumer reads is always a step of that lane.
- A reader of `flow.lanes` that expects `triage` in it finds none. The board and its page come from one build, so the
  repository has no such reader after the change.
- The step list of a lane in the generated `plugins/celetis/hooks/entry.js` has no `triage`. `scripts/build.ts` writes it.
- A lane that gains a step at a fourth position needs a name in `laneStageNames`.
- The documents state one order: intake, then triage, then the lane with its own steps.

## Reconsider when

- Intake needs a state of its own that the resolver can read. A stage for it then enters the model.
- A lane needs `triage` to run again after it starts, for example a second classification of the same issue.
