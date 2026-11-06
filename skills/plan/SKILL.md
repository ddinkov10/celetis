---
name: plan
description: Use when turning a finished feature spec into an implementation plan. Superset of superpowers:writing-plans. Not for the design/elicitation pass (specify) or executing the plan (implement).
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# plan

Superset of `superpowers:writing-plans` for project features. Delegates to it; adds project context, capability scores, the build flow, and a Verify phase.

## Do this

1. Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md`.
2. Read the spec from the issue per `<plugin>/docs/procedures/capture.md`, "A step with a record": the body when it opens with `Spec:`, else the latest `## Root cause` comment — a bug's debugging report is its spec. In the session that wrote it, the local spec file or the report in context holds the same text. The newest `## Captured` comment holds the person's answers: its `### Plan` part gives the tasks, their order, and their decided details, and the step writes the Celetis plan around them. Then invoke `superpowers:writing-plans` as the entry contract says, and follow it — it owns plan structure, file mapping, task right-sizing, bite-sized TDD steps, frequent commits.
3. Layer the project additions below.

## Additions

**Read the project context** per `<plugin>/docs/procedures/project-context.md`, for the subsystems the spec touches. This closes the fresh-context handoff — a feature's plan runs clean (see `specify` Terminal), so the entry lane's reads do not carry over.

**Carry matched lesson rules into each affected task** per `<plugin>/docs/procedures/task-lessons.md`, "Authoring", after those context reads and before finalizing task text.

**Assess current documentation** after those reads per
`<plugin>/docs/procedures/behavior-documentation.md`, "Assessment" and "Change work". Include
required document work in the task that owns the behavior.

**Map acceptance coverage.** Read `<plugin>/docs/procedures/acceptance-coverage.md` and apply
"Mapping" when authoring the plan, then "Review" in its existing self-review before publication.

**Carry the required behaviors.** Each line of a `### Required behavior` list in the spec or the `## Root cause` report gets a task or a Verify scenario, or the plan states the reason that it drops that line. A `(measured)` line of `## Prior art` is a look reference, never a task target or the bar of the Verify phase. A task copies the code of a source-file finding only when the license in that line permits it.

**Check the external facts.** Read the `## External facts` section of the spec or the `## Root cause` report. Settle per `<plugin>/docs/procedures/docs-lookup.md` each library API a task calls that the section does not cover. Carry the merged section as the plan's `## External facts`; the published `## Plan` comment hands it to `implement`. Copy each fact line a task depends on into that task's text, because an implementer's brief carries only its own task.

**Map applicable principles with the affected tasks.** Read only the files whose conditions hold:

- For external input or validation changes, read `<plugin>/docs/principles/boundary-discipline.md`.
- For unclear state combinations, growing branches, or repeated shape rules, read `<plugin>/docs/principles/model-the-domain.md`.
- For persistent or retryable operations, read `<plugin>/docs/principles/make-operations-idempotent.md`.
- For concurrent writers, read `<plugin>/docs/principles/separate-before-serializing-shared-state.md`.
- For types or signatures in a statically typed language, read `<plugin>/docs/principles/type-system-discipline.md`.
- When designing behavioral checks, read `<plugin>/docs/principles/test-behavior-not-implementation.md`.

Put the exact applicable rule paths in each affected task's text, alongside its external facts. Resolve `<plugin>` to the absolute path bound by the entry. An empty applicable set needs no rule read. The task carries the paths, not copies of the rules.

**Save the plan to `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`** (gitignored scratch; the Terminal step publishes it to the issue).

**Record in the plan header**, after `**Spec:**`:
- `Bias:`, only if the session effort bias ≠ default 0:
  ```
  Bias:         <n>
  ```
- The `Execution:` line, always: `Execution: inline — <one-sentence reason>` or `Execution: subagent — <one-sentence reason>`. `implement` reads the first line of the plan that starts with `Execution: `. It stops on a missing line, or on a word other than `inline` or `subagent`. It has no default flow. Write the line as shown, with no bold.

**The rule of the planner** chooses the flow of the `Execution:` line (ADR-0040 of the plugin `celetis`):
- `subagent` when the plan has many tasks and at least one task is not simple.
- `inline` for each other plan. A plan with one task is always `inline`: its task review and its final review would read the same diff.

Judge "many" and "not simple" from the number of tasks, the CAP line of each task, and how much a task depends on the interfaces of an earlier task. The rule sets no number. Ask no person to choose the flow. The line replaces the question of the execution method of `superpowers:writing-plans`. In a project where the gate of `implement` is `me`, the maintainer reads the line in the plan review and can correct it before the build starts.

**Per task:**
- **Capability score.** Apply `<plugin>/docs/capability.md`, "The rubric — six dimensions, each 0–2" and "Scorecard format — MANDATORY", to the task's digits and evidence reason. Emit the CAP line with the script — never hand-compute the tier:
  ```bash
  celetis --agent <host> capscore J V B N S X [--bias N]
  ```
  Put the emitted `CAP: J_ V_ B_ N_ S_ X_ = n [+bN] → model/effort` line in the task header, in both flows. The user reviews the scores with the plan. On the subagent flow, `implement` reuses the digits and written bias, resolves the current host's model and effort, and re-scores only a task whose scope materially changed. On the inline flow, the line recommends the session model and is evidence for the choice of the flow; the effort decision of Terminal sets the level of an `implement` session that the runner or the board starts. An absent `+bN` means bias 0; the model label is a historical binding.

**Add the design-review task to a web or mobile UI change.** When the change touches a web or mobile screen (the spec has a look decision, or the plan edits a UI file of those kinds), the last task of the plan, before the Verify phase, is the review of `<plugin>/docs/procedures/design.md`, "The design review". It reviews the rendered screen in each state of the spec, at each size of the platform row (`<plugin>/docs/procedures/ui.md`, "The platform rows"), in at most two rounds. Its task report keeps each finding that it does not fix, for the task reviewer. A desktop or terminal change gets no review task. The task text cites the module by its absolute path and says: when `impeccable` is missing at build time, print the one line of its "Missing", and complete the task with no change and no commit.

**Open the plan with `### Your steps`.** It is the first section of the plan, before the header of `superpowers:writing-plans`. The publish of Terminal writes the `## Plan` line above it, so the plan file starts with `### Your steps`. It names each human act of the lane that the plan can see, in three lists, in this order:
- **Answers before the build**: each consent that a Verify scenario or Land needs. A consent is needed for an act that disturbs the maintainer's live tools (the terminal app, a browser profile), changes an account or a shared resource (repository settings, a temporary repository), or sends data to a service beyond the normal use of the session. An act on temporary data in the lane or in a scratch folder needs no consent. Ask each consent in this session before the publish (in a step session, as a question of rule 2 of the step text), and wait for the answer: silence is no yes, and the plan invents no answer. Ask no go-ahead or review of the plan itself. A "no" makes the plan choose another check, or keep the act in "During the build" when only the maintainer can do it. A notice, such as "do not use the terminal app while these checks run", is a line of the consent, not an act with a report.
- **During the build**: only acts outside the session (`<plugin>/docs/procedures/stop.md`, "The check before a stop", class 3), never a consent. Each act prepares an agent check (for example a secret, or an install on the maintainer's machine), or is a precondition of the landing (for example an environment variable that the new code reads). An item names the act, the step that needs it (a Verify scenario, or Land), and its report: a line of a completed-step report whose first line is `## Human steps done`. The maintainer can post it, or assistance can record verified work and sourced human answers by `<plugin>/docs/procedures/assisted-completion.md`.
- **After the landing**: each check by hand on the built change. An item names its commands and its expected result.

A list with no item is one line: `**Answers before the build.** None.`, `**During the build.** None.`, or `**After the landing.** None.` A list with items has this form:

```markdown
### Your steps

**Answers before the build.** The maintainer gave these in the plan session. The build uses them and does not ask again.

1. <the act, and what it disturbs, changes, or sends>. Needed by: <Verify Vn, or Land>.
   Answer: <yes, or no and the check that replaces it>. Source: the maintainer's message in the plan session, <YYYY-MM-DD>.
   <A notice of the consent, when it has one.>

**During the build.** Do these now. The build does not wait for you until it needs them.

1. <the act>. Needed by: <Verify Vn, or Land>.
   Report: the line `<the line>` in the `## Human steps done` report.

**After the landing.** Run these after `/celetis:implement #<n>` lands the change.

1. <the check>: <the commands>. Expected: <the result>.
```

**Sort each check by its kind, not by the abilities of one session.** A check by hand needs what only a person has: the person's own signed-in account or a second identity, the person's own machine or device, or the person's judgment of a live result. It goes to "After the landing", never to the Verify phase. Each other check is a Verify scenario, also when it needs an act of "During the build". When you are not sure, the check stays in the Verify phase: a wrong sort to Verify costs a wait, and a wrong sort to "After the landing" removes a gate.

**Add a final Verify phase — how the feature is proven on the project's own runtime.** Read
`<plugin>/docs/procedures/verification-recipes.md` and apply "Planning" to reuse relevant project
instructions when defining runtime scenarios. Read
`<plugin>/docs/procedures/runtime-verification.md` and apply "Planning" when defining its runtime
scenarios and "Usage-limit exception" before requiring a new runtime hold or quota waiver. The concrete shape is project-specific (on-device E2E for an app, a live browser flow for web, a script that exercises the service for a backend). State the scenario(s) and the below-the-UI oracle (probes/disk/logcat/HTTP) in this phase. An agent runs each scenario. A scenario that needs an act of "During the build" names that act. Only such a scenario can wait for the maintainer: with no report of the act, `implement` stops with `## Before landing`. The Verify phase names no run of the full suite: the full suite runs once, on the tree that lands. `land` runs the `suite` of `.celetis.yaml` with the landing `merge`, and the CI of the lane PR runs it with the landing `pr`. When the `## Root cause` report links a capture repro, the Verify phase has a scenario for it: a capture at the same state and size after the fix, posted on the issue per `<plugin>/docs/procedures/ui.md`, "Captures", and compared with the repro. A web UI change gets the scenario of `<plugin>/docs/procedures/design.md`, "The detect scenario", at each size of the platform row, on the page started the way the `AGENTS.md` of the product says; its exit code is the oracle. The scenario names its condition: when `impeccable` is missing at Verify, print the one line of that module's "Missing"; the scenario then has no PASS and is no hold.

**Name the reference.** State the external, named behavior the fix is measured against. When the spec or the `## Root cause` report has a `## Prior art` section, the reference is the found pattern that the design follows: the chosen approach of a spec, or the fix of a report. Use the platform's own native flow for the same action, a shipped sibling feature, or a competitor's equivalent in its place when the document has no such section, when the design follows no found pattern, when the section says "None found", or when the pattern has no behavior to measure against (for example a data format). The phase exits only when the fix is at least as good as that reference; never leave the bar as an adjective.

**Carry unverified premises as risks.** If the spec flagged any load-bearing claim as unverified (specify), the plan names it in a Global Constraint or the Verify phase as a decision point: the claim is checked on the runtime, and the fallback path is pre-decided so the plan does not depend on the claim being true.

**Keep TDD** as the per-task discipline.

## Terminal

The execution method is supplied: `/celetis:implement #<n>` in a fresh context, which follows the `Execution:` line of the plan. Get each answer of "Answers before the build" before the publish, and record it in the plan. Once the plan is written and self-reviewed, record the effort level of `implement` per `<plugin>/docs/procedures/effort.md`. Then publish the plan in the same turn with `celetis --agent <host> issue <n> plan <plan>`: it posts the plan with `## Plan` as its first line. With no `ready-for-human`, it adds `ready-for-agent`. With that human hold, it keeps the hold and removes `ready-for-agent` when present. The new plan starts a new build; earlier completion does not complete it. Then tell the user that the plan is on the issue for their review, name each void line of the record (step 2), repeat the three lists of `### Your steps` verbatim, and then tell the user to run `/celetis:implement #<n>` in a fresh context.
