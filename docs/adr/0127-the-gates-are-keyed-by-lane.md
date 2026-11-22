# The gates are keyed by lane

## Date

2026-11-21

## Related

- [Issue #363](https://github.com/ddinkov10/celetis/issues/363): the spec (the body of the issue, `Spec: 2026-11-21`),
  and the [plan comment](https://github.com/ddinkov10/celetis/issues/363#issuecomment-7068091382). In this record,
  "rule <k>" names a rule of "Required behavior" of the spec, "Intent", "The done-when case", "Approaches", "Prior art",
  "Principles", "Risks", and "Session calls" name parts of the spec, and "Decision <k> of the plan" names an item of
  "Decisions of this plan" in the plan comment. "Decision <k>" alone names an item of "Decision" of this record.
- [ADR-0096](0096-the-lanes-of-auto-mode-are-tracked-policy.md): its alternative "Gates for each lane" rejected lane
  gates as a replacement of `autoLanes`. This record adds lane gates next to `autoLanes` and does not replace it. Each
  clause of its Decision stays true: the pick still needs the gate `auto`, and a started run still continues by its
  gates.
- [ADR-0015](0015-one-repository-yaml-config.md): its Decision lists `gates` among the root fields of the schema. The
  field stays a root field of the schema; the next section names the one clause that changes.
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md): the workflow definition imports no configuration
  code, and the config reader imports its names from it. The sentence stays true. `Gate`, `Gates`, and `gateOf` are
  defined in the workflow definition, and `engine/lib/config/core.ts` imports `Gates`. Its Decision item "the default
  gate `me`" stays unchanged by this record: `defaultGate` is the default of `gateOf`.
- [ADR-0069](0069-step-agent-preference-is-tracked-policy.md): `agents` is keyed by step. It stays so, and its
  `steps:` alternative is not this decision.
- [ADR-0032](0032-shared-configuration-operation-snapshots.md): the engine reads `gates` from the main checkout, fresh
  at each operation. This record adds no read.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): each product project owns its adoption. This
  record names no step of any product project.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the change edits no declaration of
  `engine/lib/contract/contract.ts`, and the contract digest covers no configuration field, so the contract version
  stays.

## Supersedes

Only this clause changes. The accepted record keeps its historical text.

- [ADR-0015](0015-one-repository-yaml-config.md), Decision: "Omitted gates use `me`;" (the clause ends there, and "no
  Codex profile is bundled" stays). The default is now stated for
  the shape of this record: an omitted `gates`, an omitted key, an empty mapping, and an omitted step give `manual`
  (rule 4). The value `me` is already invalid, and there is no automatic conversion
  (`plugins/celetis/docs/configuration.md`, "Fields and defaults"). The field list of the same Decision stays.

## Context

`gates` mapped a step name to `manual` or `auto`, and that one value held in each lane that has the step. The lanes
`feature` and `bug` share the steps `plan` and `implement`. So a project could not let the `bug` lane run with no stop
while the `feature` lane stops before `plan` for a review (spec, "Intent"). The maintainer asked for "one proper
decision how this would look for long term and maintability".

## Constraints and evidence

- The gate has two jobs (ADR-0096, "Constraints and evidence"): auto mode starts a step only when its gate is `auto`
  (`autoLoop` of `engine/lib/run/engine.ts`), and a started run always starts its first step and continues into each
  next step only when that step's gate is `auto` (`resolve` of `engine/lib/run/machine.ts`).
- Each reader of the gate has the lane. A decision of the resolver is a `Run` with `lane` and `step` in
  `engine/lib/workflow/workflow.ts`, and the lane is `null` for the `triage` step of an issue with no lane. The card of
  the board carries `type`, the lane name.
- `bug`, `chore`, and `hotfix` are each the name of a lane and of a step, so a key of `gates` is a lane name and never
  a step name.
- Before this record, `checkSchema` validated `gates` with `keysOnly(gates, steps, ['gates'])` and then required
  `manual` or `auto` for each value (`engine/lib/config/core.ts` at `8365fe7`, lines 326 to 332). A key such as
  `feature` is no step, so `keysOnly` refused it with `unknown field` (same file, lines 247 to 250).
- `checkSchema` is the one point that validates the field, and `plugins/celetis/hooks/entry.js` holds a generated copy
  of it. The verify gate runs the config check on the `.celetis.yaml` of this repository.
- The contract digest covers no configuration field (ADR-0096).

## Decision

1. **The field.** `gates` is a mapping. Its keys are `triage` and the lane names `feature`, `bug`, `chore`, and
   `hotfix`: the names of `autoLaneNames` in `engine/lib/workflow/workflow.ts`, the same as `autoLanes`. A label name,
   for example `enhancement`, is no key.
2. **The values.** The value of `triage` is `manual` or `auto`: the gate of the triage of an issue with no lane. The
   value of a lane is `manual` or `auto`, which is the gate of each step of the lane after `triage`, or a mapping from
   a step of that lane after `triage` to `manual` or `auto`. The steps are `specify`, `plan`, and `implement` for
   `feature`; `bug`, `plan`, and `implement` for `bug`; `chore` for `chore`; and `hotfix` for `hotfix`. So each gate
   has one home, one lane and one step, and a lane that is all `auto` takes one line.
3. **The default.** An omitted `gates`, an omitted key, an empty mapping, and an omitted step give `manual`.
4. **The refusals.** The config is refused, with the path of the field and the accepted names or values, for a key
   under `gates` that is none of the five names (the step-keyed form `gates: {plan: auto}` is one case); a step key
   that the lane does not have after `triage` (`gates.chore.plan`, `gates.feature.bug`, and `gates.bug.triage` are
   cases); a lane value that is not `manual`, `auto`, or a mapping, which includes an empty value; a mapping as the
   value of `triage`; and each gate value other than `manual` or `auto`. There is no conversion of the old form and no
   fallback to it.
5. **One lookup.** `gateOf(gates, run)` of `engine/lib/workflow/workflow.ts` gives the gate of a decision from its lane
   and its step: `gates.triage` for a decision with no lane or the step `triage`, else the value of the lane by
   Decisions 2 and 3. `Gate` and `Gates` are defined in the same file, because that file imports no configuration code
   (ADR-0033). The auto pick (`autoLoop`), the continue check of a run (`resolve`), and the board read
   (`readDocument` of `engine/lib/board-read/board-read.ts`) call `gateOf` and read `gates` by no other path.
6. **Auto mode and runs.** The two jobs of a gate keep their meaning, with the gate of Decision 5. The stop line of a
   `manual` gate in a run names the lane when the decision has one: `the gate of <step> in the lane <lane> is manual:
   celetis --agent <host> run <n> starts <invocation>`. A decision with no lane keeps the line `the gate of triage is
   manual: ...`.
7. **The board data.** `Flow` of `engine/lib/board-read/types.ts` has no `steps.<step>.gate`. It has `gates`: one
   mapping for each lane, from each step of the lane (`triage` too) to its gate, and a mapping `triage` with the one
   key `triage`. The server computes each value with `gateOf`, and the page reads `flow.gates[<lane> or 'triage'][<step>]`
   (`gateOf` of `engine/board/view.ts`). The `auto` mark of a card and the marks of the lane track show the gate of the
   own lane and step of the card, and the `triage` segment of each lane track shows the gate of `triage`. The look of
   each mark does not change.
8. **Unchanged.** `autoLanes` has the same field, values, and behavior (ADR-0096). `agents` and `sessions` stay keyed
   by step. This repository moves its `.celetis.yaml` to the new shape with the same effective gates: `auto` for
   `triage` and for each of the four lanes.

## Alternatives considered

- **Step defaults with lane overrides** (pattern B of "Approaches"): `gates` stays keyed by step, and a new field
  overrides a step for one lane. It is the shortest form when the lanes mostly agree, and it keeps the step keys of
  `agents` and `sessions`. Rejected: one gate has two homes and a precedence rule, and the key `bug` would name a step
  in one field that sets gates and a lane in the other. The set of pairs is closed and small: eight pairs of a lane and a step after
  `triage`.
- **A step value that names its auto lanes** (pattern C): a value is `manual`, `auto`, or a list of lanes. It is the
  smallest change to existing files. Rejected: the value has mixed types, a list has a meaning only for `plan` and
  `implement`, and a lane that gains a shared step needs an edit in many lists.
- **Ordered rules, first match wins**, as the `rules:` of a GitLab CI job, which are evaluated in order until the first match
  (spec, "Prior art"; https://docs.gitlab.com/ci/jobs/job_rules/). They fit conditions on many variables. A
  gate depends on two keys only, so an ordered list adds an order that the domain does not need.
- **Fold `autoLanes` into the lane map.** A project needs "run the whole feature when I start it", which is each gate
  of `feature` as `auto`, together with "auto mode does not start a feature". One value for each lane cannot hold both
  (ADR-0096, "Alternatives considered").

## Consequences

- A project can let the `bug` lane run from its first step to the landing while the `plan` gate of the `feature` lane
  stays `manual`, and the daemon follows both settings (spec, "The done-when case").
- `gates.bug` names the lane, while `agents.bug` and `sessions.bug` name the step. The maintainer accepted this in the
  session (spec, "Risks"). `plugins/celetis/docs/configuration.md` states it.
- `plan` and `implement` repeat for each lane that mixes values in the mapping form.
- Each product project with a `gates` field must rewrite it at its own update, because the old form is refused, except
  a file with keys only from `triage`, `bug`, `chore`, and `hotfix`, which stays valid and changes meaning for `bug`.
  Its maintainer owns that adoption (ADR-0031).
- An engine from before this record refuses a file with the key `feature` as `gates.feature: unknown field`. The new
  engine refuses the old form, for example `gates: {plan: auto}`, because `plan` is none of the five names. A file with
  keys only from `triage`, `bug`, `chore`, and `hotfix` and the plain values `manual` or `auto` is valid for both. The
  two engines read `gates.bug: auto` differently: the old engine sets the step `bug` only, and the new engine sets each
  step of the lane `bug`, also `plan` and `implement`, which lands the change. `chore` and `hotfix` keep their meaning,
  because each of those lanes has one step after `triage`.
- This repository moved its `.celetis.yaml` to the new shape in the change. After the landing, the installed engine of
  the maintainer refuses that file until the maintainer runs `celetis update`: the daemon ends auto mode at its next
  operation, as for each invalid field, and the board, `run`, and `land` stop. The landing runs the installed engine,
  and the plan read found no configuration read after the push (Decision 2 of the plan).
- The stop line of a `manual` gate names the lane, so the maintainer sees which lane setting stopped the run.
- An invalid file is refused whole, before any side effect (spec, "Principles").

## Reconsider when

- `agents` and `sessions` also need a value for each lane. The key clash then grows, and the step key of those fields
  needs a new decision.
- A gate needs a condition other than the lane and the step, for example a label or an author.
- A lane gains a step, or the set of lanes changes. The keys of `gates` follow `lanes` and `autoLaneNames` of
  `engine/lib/workflow/workflow.ts` with no other list.
