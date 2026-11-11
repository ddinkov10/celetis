# The step before decides the model and the effort of the next step

## Date

2026-11-11

## Related

- [Issue #290](https://github.com/ddinkov10/celetis/issues/290): the spec (the body of the issue) and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/290#issuecomment-6793991413). In this record,
  "Approaches" and "Decisions of the maintainer" name parts of the spec.
- [ADR-0040](0040-the-planner-chooses-the-build-flow.md): the planner chooses the build flow. Its "Reconsider when"
  trigger "The runner starts step sessions with a model flag" holds after this record. Its decision stays: the flow
  is still the choice of `plan`, and an inline task runs on the model and the effort of the session.
- [ADR-0019](0019-a-codex-child-with-no-profile-keeps-the-parent-model.md): a Codex child with no profile keeps the
  parent model. This record keeps that rule and the Codex bands.
- [ADR-0070](0070-automatic-runtime-state-migration.md): the run record converts to its new schema at the read.
- [ADR-0088](0088-one-adapter-for-each-host-holds-the-host-differences.md): the adapter of each host holds the
  difference: Claude Code takes the model, and Codex keeps its model.
- `plugins/celetis/references/procedures/effort.md`, `engine/lib/effort.ts`, and the act `effort` of `engine/issue.ts`.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [The step before decides the effort of the next step](0057-the-step-before-decides-the-effort-of-the-next-step.md),
  in part:
  - In "Decision": "The session model does not change". The step before decides the model of the next step session
    too.
  - In "Decision": the default `high`. The default level is `medium`, with the default model `opus`.
  - In "Decision": the fixed anchor table of levels. The tables of `effort.md` give a model and a level.
  - In "Decision": the act `effort <step> <level> <file>` and the first line `Effort: <step> <level>`. The act takes
    the model, and the first line is `Effort: <step> <model> <level>`. A comment of the old form is no decision.

## Context

A step session that the runner or the board started ran on the model of the host settings, and at the level that
the step before decided, else `high`. On 2026-11-09 and 2026-11-10 the vendor guidance for Claude models changed
the start: most work starts on Opus 5.5 at `medium`, Sonnet 5.5 serves well-scoped work, and Fable 5.2 serves the
hardest work. The maintainer wants the step session and the child bands to follow that guidance, and to keep
a pin in the config (issue #290, "Decisions of the maintainer").

## Constraints and evidence

- The numbers of the vendor article ("Which Claude model should you build with?", 2026-11-09,
  https://claude.dev/blog/which-claude-model-should-you-build-with/) are results of
  Anthropic on its own benchmarks. The article gives no sample size and no spread. This record uses them only as
  the reason of the vendor for its start pairs. It claims no saving and no quality result for Celetis.
- The decision of the maintainer to take the pairs of the vendor guidance replaces the outcome-evidence rule of
  #227 for this band change only. The outcome evidence procedure of `plugins/celetis/docs/capability.md` stays for
  each later claim of a saving or a quality gain and each later change of a band.
- ADR-0057 recorded one run per level on `claude-opus-5-5` as evidence for its level table. The maintainer decided
  that the step before decides the model too, and the vendor article is the basis of the new tables.
- Claude Code takes `--model` for one session, and `--model` outranks the model settings. Codex keeps its
  configured model: a Codex step start adds no model flag.
- The search of the record store for the literals that this record replaces (`` `high` `` as the default of a step
  session, `Effort: <step> <level>`, `effort <step> <level>`, "The session model", "no model flag", `opus/xhigh`,
  `fable/max`, and `haiku/low`; `grep -n -F` over `docs/adr/*.md`) found these matches. Only ADR-0057 holds a
  decision clause:
  - ADR-0057, "Constraints and evidence" and "Decision": replaced in part (see Supersedes).
  - ADR-0040, "Constraints and evidence": "The runner starts each step session with no model flag" is a fact of the
    time of that record. Its "Reconsider when" names the change.
  - ADR-0019, "Decision" and "Consequences": `high` is the minimum effort of a Codex child at attempt 3, and "the
    session model" is the model of a child. Both are about child agents and stay.
  - ADR-0070, "Decision": `high` is the effort policy of a converted saved-session record. It is a migration of a
    record that makes no claim about the effort of a decision, and it stays.
  - `opus/xhigh`, `fable/max`, and `haiku/low`: no record holds them.

## Decision

1. **The step before decides a model and a level** from the tables of `effort.md`. `triage` decides the first step of
   the lane, `specify` and `bug` decide `plan`, and `plan` decides `implement`. The decision holds one model
   (`sonnet`, `opus`, or `fable`), one level, and a reason of one sentence. A reason for `fable`, `xhigh`, or `max`
   states why the pair below it is not enough. The table has no `haiku` row; the engine accepts `haiku` in a
   decision, a pin, and an override.
2. **The default pair is `opus` and `medium`.** A step with no decision starts there.
3. **A value has one source**, from the strongest: `override` (a change of one start), `pinned` (the `sessions`
   field of the config), `decided` (the issue), and `default`. A pin or a change of one start replaces one value and
   keeps the reason of the decision.
4. **Claude Code takes the model.** The step start passes `--model` and `--effort`. **Codex keeps its configured
   model** and raises a decided or default level by the tier of the model of the pair: no level for `haiku` and
   `sonnet`, one for `opus`, and two for `fable`, with `max` as the ceiling. A pinned or an overridden level applies
   as it is. The tier rule is a call of the agent, which the approval of the spec decided, with no measurement.
5. **The child bands of Claude Code take the start pairs of the vendor guidance.** The bands of Codex stay.
6. **The act and the contract.** The act is `issue <n> effort <step> <model> <level> <file>`, and the engine serves
   only the new contract version.

## Alternatives considered

- **The code picks one fixed model for each step** (approach 2 of the spec; `opusplan` of Claude Code and the
  architect mode of aider are fixed splits). It is deterministic, but a migration and a small feature get the same
  model at a step, and ADR-0057 rejected this shape for the level. The pin gives a project this choice for the steps
  that it names.
- **An automatic router** (approach 3; GitHub Copilot auto model selection). Celetis has no outcome data to train
  one, and its child controls are not an API gateway. ADR-0057 and #227 rejected a router for the same reason.

## Consequences

- A step session starts on the model and at the level that fit its work, and the board shows both with their source.
- The pair is judgment, so two agents can choose differently for similar work. The reason on the issue shows a
  surprising pair, and a pin or a change of one start corrects it.
- A `fable` start can bill to usage credits and can show a consent prompt in a terminal tab. The default never gives
  `fable`, and a decision needs a stated reason.
- On a provider other than the Anthropic API, an alias can resolve to an older model or to none. The pin is the
  correction.
- An older comment `Effort: <step> <level>` is no decision, and the step starts at the default pair. The engine has
  no reader for it.
- A sentence that a CAP line gives for a session-executed task stays a recommendation.

## Reconsider when

- Outcome data of Celetis runs shows that a pair of the tables wastes cost or lowers quality.
- The vendor guidance changes the start pairs.
- Codex gives a model flag that a step start can pass.
