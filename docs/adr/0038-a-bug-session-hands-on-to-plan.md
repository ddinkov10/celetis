# A `bug` session hands on to `plan` in the skip rule

## Date

2026-10-27

## Related

- [Issue #143](https://github.com/ddinkov10/celetis/issues/143): the `## Root cause` report (the
  spec, with the red repro and the intended behavior) and the plan.
- [Issue #137](https://github.com/ddinkov10/celetis/issues/137): the runner evidence of the
  refused skip.
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md): one workflow definition and the
  skip rule. One clause changes ("Supersedes"). Its Consequences and its "Reconsider when" name a
  transition that needs a named exception.
- Step 7 of `skills/bug/SKILL.md`: "Post the report, then invoke `celetis:plan #<n>`".
- Rule 1 of `step-prompt.md`: "/celetis:bug hands on to plan".
- `handsOn` and `skipped` in `engine/lib/workflow.ts`, and the one call of `skipped` in
  `engine/celetis-flow.ts`.

## Supersedes

Only this clause changes. The accepted record keeps its historical text and evidence.

- ADR-0033, "One workflow definition and the skip rule", Decision, "The skip rule": "T is allowed
  when its position in L is at most one more than the position of S". For S = `bug` in the lane
  `bug`, the position of S is now the position of `plan`. The rest of ADR-0033 stays.

## Context

The skip rule measures the next step T from the step S that the session started with. The runner
takes S from the decision that it read before it started the session. For a `bug` session, S is
always `bug`.

A `bug` session also writes the plan. Step 7 of the `bug` skill posts the report, then invokes
`celetis:plan #<n>`. Rule 1 of the step text says that `/celetis:bug` hands on to `plan`. This
hand-on predates the skip rule, which came with #101 (`8187df9`). In the lane `bug` (`triage`,
`bug`, `plan`, `implement`), the rule read `bug` → `implement` as a skip of `plan`, and
`docs/celetis-flow.md` listed `bug` → `implement` as a transition that cannot start.

The runner evidence of #137 shows the result. The session record had `"step":"bug"`. The session
posted `## Root cause` at 22:42:37Z, and `## Plan` with `ready-for-agent` at 22:47:43Z. The runner
then refused `implement` and added the row `137\trun /celetis:implement #137` to the
`no-progress` record of the main checkout, a row that the board shows as `stuck`, with the label
`no progress`. So a complete `bug` session stopped the chain of its issue.

## Constraints and evidence

- A scratch program called `decide`, `sameResult`, and `skipped` of `5d70983` on the issue data
  before and after a `bug` session. `## Root cause`, `## Plan`, and `ready-for-agent` gave a Run of
  `implement` and the skipped steps `["plan"]`: refused. Only `## Root cause` gave a Run of `plan`
  and no skipped step: allowed. A plan with no `ready-for-agent` gave the stop `plan-order`.
- No other step session covers a second step. `specify` and `plan` send the next step to a fresh
  context. `triage` does not hand on to the lane in a runner step (rule 2 of the step text).
  `chore` and `hotfix` are the last step of their lanes.
- `engine/lib/workflow.ts` stays pure, and the `lanes` table stays the only source of the lane
  order (ADR-0033, "One definition"). The rule reads no session record and no history of the issue
  (ADR-0033, decision 1 of the maintainer).
- ADR-0033, Consequences: "A transition that the lane order cannot express needs a named exception
  on top of the definition."
- The step end (`endWhenDone` in `engine/celetis-flow.ts`) compares each decision with the Run of
  `bug` that the session started with. After `## Root cause`, the decision is a Run of `plan`, so
  an idle moment permits `/exit`. The `bug` skill invokes `plan` in the same turn as the post of
  `## Root cause` (the trap of `AGENTS.md`). In #137 the plan ran in that turn.

## Decision

The maintainer's words: "bug and plan are together only implement is different".

**A named exception.** `engine/lib/workflow.ts` holds the module-private constant
`handsOn = { bug: 'plan' }`. When S is a step of L, `skipped` measures T from the position of
`handsOn[S]`, or of S when it has no entry. So in the lane `bug`, `implement` can follow a `bug`
session that also wrote the plan. `bug` → `plan` stays allowed, for a session that ended after
`## Root cause` and before `## Plan`.

**The skip rule only.** The exception applies to the skip rule only, and only when S is a step of
L. When S is not a step of L (a lane change), T must still be at position 0 or 1 of L. So a `bug`
session that relabels the issue to `enhancement` cannot reach `implement` of the lane `feature`.
These do not change: the refusal line, the `no-progress` record and its format, the "no progress"
check, the gate check, the first step of a start with no skip check, `sameResult`, and the step
end.

**One definition.** The exception is named data in `engine/lib/workflow.ts`. It is not a second
copy of the lane order, and not a check of the step name in the runner. `engine/celetis-flow.ts`
keeps its one call of `skipped`.

This is the practical choice: it encodes the one fact that makes a step session run a second step,
and the `bug` skill keeps its hand-on.

## Alternatives considered

- **The `bug` skill stops after `## Root cause`, and `plan` runs in a fresh session.** The
  maintainer rejected it.
- **The runner records the step that a session reached, from the decisions that it observed.** A
  run outside a herdr pane has no step end, so it observes no decision during the session. In a
  herdr pane, the step end reads the decision only at an idle moment. When the session writes the
  plan, the `bug` skill runs `plan` in the same turn, so the step end does not see the Run of
  `plan` either. The rule must also read no history (ADR-0033, decision 1 of the maintainer).
  Rejected.
- **A from→to transition table.** ADR-0033 rejected this as alternative C. Rejected.
- **`sameResult` takes a Run of `plan` as the same result as a Run of `bug`.** A session that posted
  only `## Root cause` would then get a "no progress" row. Rejected.
- **The step end also keeps a `bug` session open while the decision is a Run of `plan`.** A session
  that ends its turn after `## Root cause` would then stay open with no `/exit`. The `bug` skill
  runs `plan` in the same turn (the trap of `AGENTS.md`), and an exit at a Run of `plan` leads to a
  `plan` step, which the rule allows. Rejected.

## Consequences

- `bug` → `implement` can start inside one start. With the gate `auto` of `implement`, the runner
  starts it. With the gate `me`, the runner stops at the gate line and writes no row.
- A relabel during a `bug` session does not get the exception. The rule of a lane change applies.
- The step end does not change. So an idle moment at a Run of `plan` can still end a `bug` session.
  The next step is then `plan`, which the rule allows.
- An issue that moved to the lane `bug` can keep an old `## Plan` with `ready-for-agent`, because
  the act `route` does not remove `ready-for-agent`. After a `bug` session that posted
  `## Root cause` and no new `## Plan`, `decide` takes the latest `## Plan`, so the chain can reach
  `implement` on that old plan. The skip rule never told an old plan from a new one. The resolver
  owns that case, and an explicit start reaches it today.
- A new hand-on to a later step of each lane that holds the source step is one entry of
  `handsOn`, plus its text in `docs/celetis-flow.md`.

## Reconsider when

- Another step session hands on to a second step.
- The `bug` skill stops handing on to `plan`.
- The step end must keep a `bug` session open through `plan`.
- The resolver tells an old plan from a new one.
