---
name: implement
description: "Use when executing a written plan for a feature in the current session. Superset of superpowers:executing-plans and superpowers:subagent-driven-development; the plan's Execution: line picks one. Not for writing the plan (plan) or the design pass (specify)."
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# implement

Superset of `superpowers:executing-plans` (the inline flow) and `superpowers:subagent-driven-development` (the subagent flow) for project plans. The `Execution:` line of the plan picks the flow. This skill gets each task-loop dispatch from `dispatch`, gates each task, and adds the Verify phase and the landing.

## Do this

1. Enter the issue's worktree with `worktree <n>` per `<plugin>/docs/procedures/worktree.md`; on its exit 4, apply **A conflict with the trunk** below first. Then fetch the plan into `docs/superpowers/plans/<n>.md`. A hotfix's micro-plan is already there, written by its lane. Every other lane's plan is the latest `## Plan` comment on the issue, which a local file from the `plan` session can lag: `mkdir -p docs/superpowers/plans && gh issue view <n> --json comments --jq '[.comments[] | select(.body | startswith("## Plan"))][-1].body' > docs/superpowers/plans/<n>.md`.

   **Re-entry**, for each lane but a hotfix (its micro-plan is a local file): run `celetis --agent <host> issue <n> state` and read its lines (`<plugin>/docs/issue-tracker.md`, "Conventions"). Each `open:` line names a `## Before landing` comment of this build that has no completion evidence, and the evidence that is missing. `build: planned` is a plan to build. `build: built` means that an earlier run built the change. Do not build again: run no task of the plan and skip Tail steps 1 to 3. For a plan produced by `celetis:plan`, read `<plugin>/docs/procedures/acceptance-coverage.md` and apply "Reporting" while refreshing runtime evidence before Land. For deferred runtime scenarios or evidence affected by later changes, first read `<plugin>/docs/procedures/runtime-verification.md` and apply "Reports and deferred checks", "Evidence lifetime", and "Usage-limit exception" before skipping old Verify scenarios or going to Land. Then handle the latest `## Landing refused` comment by `<plugin>/docs/procedures/landing.md`, "Re-entry after a refusal", which goes on to Land, step 2. A `## Before landing` comment of this build that names an act of "During the build" with no report keeps its existing rule (the Verify phase below, or Land, step 2). When no `open:` line names that comment, and one or more `## Human steps done` comments after it report each act that it names, run the Verify scenarios that the comment names as waiting for those acts. Go to Land, step 2 when the runtime procedure permits continuation; a FAIL loops back to a fix, as in the Verify phase. Without that evidence, go to Land, step 2. The `build:` line gives the build state, also after a stop, a failed readiness write, or a cleared hold. A new `/celetis:plan` run starts a new build.
   On built re-entry, apply `<plugin>/docs/procedures/behavior-documentation.md`, "Repairs and
   re-entry", before continuing to Land.
2. **Read the flow.** Do this step with `build: planned`, or with a hotfix micro-plan. The plan names its flow on a line of the form `Execution: inline — <one-sentence reason>` or `Execution: subagent — <one-sentence reason>`. Read the first line of the plan file that starts with `Execution: `. The first word after `Execution: `, after any more spaces and up to the next space or the end of the line, is the flow: `Execution:    inline — …` is `inline`. No such line, or a word other than `inline` or `subagent`, is an invalid line. For a hotfix micro-plan with an invalid line, write `Execution: inline — one task` as its first line (step 5 of `/celetis:hotfix`) and go on. Any other invalid line stops `implement` before the first task: show the user this message, with `<n>` and `<found>` filled in, and stop. `<found>` is the first line that starts with `Execution: `, or `none`.
   - A plan from the issue: `implement: the plan of #<n> has no valid Execution: line (found: <found>). Run /celetis:plan #<n> again; the new plan names the build flow.`

   In a step session, hand the stop to the issue by `<plugin>/docs/procedures/stop.md`, "A stop in a step session". Re-entry with `build: built` reads no line, so a built change lands with any plan.
3. **Review acceptance coverage before the first task.** For a plan produced by `celetis:plan`, fetch the current approved source with `gh issue view <n> --comments`. Read `<plugin>/docs/procedures/acceptance-coverage.md` and apply "Review" in the existing pre-build plan review.
4. Invoke `superpowers:executing-plans` for `inline`, or `superpowers:subagent-driven-development` for `subagent`, as the entry contract says, and follow it. The upstream skill owns its task loop, its final whole-branch review, and the fix pass of that review. With `executing-plans`, the session fixes the Critical and Important findings in one pass, each fix test-first, with no second review. The verify gate of the project takes the place of its whole-suite run (Land, step 3). With `subagent-driven-development`, one fix subagent fixes the findings, and one scoped re-review reads the fix. Land (Tail step 5) takes the place of its last step, the skill that finishes the development branch: do not invoke that skill.
5. Layer the project additions below: **Both flows**, and the group of the flow of the plan.

## Additions

### Both flows

**Incident capture — tasks, reviews, and repairs.** After a substantive correction, after two
failed fixes of the same problem, and before an existing repair limit stops work, apply
`<plugin>/docs/procedures/lesson-capture.md`. This covers inline and child implementation, task
and final review, gate, Verify, and landing repairs, including re-entry. Give children its exact
resolved path and incident return contract; the coordinator owns the task's pending write.
Reuse a checkpoint already handled in the turn. Keep every existing attempt limit and stop.

**Current documentation — tasks, reviews, and repairs.** Before each task, read
`<plugin>/docs/procedures/behavior-documentation.md` and apply "Assessment" and "Change work".
Carry its assessment and exact resolved module path into implementation, task review, and final
review context. Apply "Repairs and re-entry" to gate repairs, final-review fixes, Verify fixes,
and landing fixes, with the affected assessment in each existing repair brief and review.

**Acceptance changes.** For plans produced by `celetis:plan`, apply
`<plugin>/docs/procedures/acceptance-coverage.md`, "Changes", to task and repair context and its
existing review or re-review, including final-review, gate, Verify, and landing repairs.

**Task dispatch — every child in the subagent task loop and fixes after the final review.** Get each dispatch from `celetis --agent <host> dispatch <act>` by `<plugin>/docs/procedures/dispatch.md`, "The task loop".

**Review evidence — both flows and every repair.** Before preparing a review, read
`<plugin>/docs/procedures/review-evidence.md` and apply its "Reviewer" section. Give each reviewer
and fixer the exact resolved paths of that module and
`<plugin>/docs/principles/demonstrate-behavioral-defects.md`, with instructions to read both.
Carry the evidence and dispositions in the existing review record and repair brief.

Apply "Receiving session" before an inline fix pass, before `dispatch review ... findings`,
and before accepting a clean review or `close`. Apply "Repairs and disposition" to fixes and
their existing scoped re-reviews. These requirements cover:

- The combined task spec-compliance and quality review, its fixes, and scoped re-review.
- The inline final review and its one fix pass, with a focused post-fix check and no second reviewer.
- The subagent final review, its one fix wave, and scoped re-review.
- Gate repairs and the task review that follows them.
- `verify-<k>` and `land-<k>` repairs, including saved or reconstructed briefs on re-entry.

Apply the module's material-risk disposition before accepting upstream parking, deferred-minor,
or out-of-scope rulings. Keep the existing review counts, fix limits, and dispatch controls.

**Lesson rules — both flows.** At each task and repair boundary, including the final review and re-entry, apply `<plugin>/docs/procedures/task-lessons.md`, "Refresh" and "Delivery", to implementation and review context.

**Project verification recipes — both flows.** Before building a task, read
`<plugin>/docs/procedures/verification-recipes.md` and apply "Execution and retention". Include
affected recipe edits and optional retention in the task scope before the existing final review.

**Applicable principles — both flows.** Before building a task, read each principle below. Apply each one whose `Applies when` holds for the task, with its `Check`. Derive missing paths, and revise paths for changed scope, from the actual task:

- `<plugin>/docs/principles/boundary-discipline.md`
- `<plugin>/docs/principles/model-the-domain.md`
- `<plugin>/docs/principles/make-operations-idempotent.md`
- `<plugin>/docs/principles/separate-before-serializing-shared-state.md`
- `<plugin>/docs/principles/type-system-discipline.md`
- `<plugin>/docs/principles/test-behavior-not-implementation.md`

Carry the exact applicable paths in every implementer and task reviewer brief, including gate repairs and review fixes. Resolve `<plugin>` to the absolute path bound by the entry. Instruct each recipient to read those files before building or reviewing. The inline session applies the same paths to its own work. An empty applicable set needs no rule read; carry references instead of rule bodies.

**Failed fixes.** Before another already-permitted attempt, read `<plugin>/docs/principles/attack-the-premise.md`. Apply it when its `Applies when` holds, with its `Check`. The check grants no extra attempt and changes no dispatch state or count; every existing stop still applies.

**Comment policy — append to every implementer prompt (verbatim):**
> Comments: default none; one line only for a constraint the code can't show; never narrate what the next line does or why the change is correct. Style source: the `celetis:polishing-code-comments` skill.

**Commit subject — append to every implementer prompt (verbatim):**
> Commit subject: `<type>(<area>): <what>` — `<area>` is whatever a reader would recognise: the package or concern the task touched (`lib` alone if nothing is clearer). `<type>` is `feat` for new behavior, else `fix`/`refactor`/`test`. Body: what changed and why, naming a symbol a reader can grep, and referencing `#<n>`.

On the inline flow, the session builds each task itself and applies both blocks to its own work.

**TDD** is the method of each task.

**The verify gate of the project at the end of each task.** On the inline flow, the third failed gate of one task stops the repair of that task. Then apply `<plugin>/docs/procedures/stop.md`, "The check before a stop": a pick between repair options that lets this session go on is a live question with the options and the failure trail. Else the session stops with the failure trail. On the subagent flow, the engine owns escalation and stops. In a step session, hand the stop to the issue by `<plugin>/docs/procedures/stop.md`, "A stop in a step session".

**A conflict with the trunk.** Exit 4 of `worktree <n>` is a conflict with the trunk. On exit 4 at step 1, read the build state before any act of the merge: for each lane but a hotfix, run `celetis --agent <host> issue <n> state` and pick the rule below by its `build:` line; a hotfix entry at step 1 is before the final review. Before the final review (an entry with `build: planned`, or a hotfix micro-plan before Tail step 2), the session resolves the conflict by `<plugin>/docs/procedures/worktree.md`, "A conflict with the trunk", in both flows, and the build or its re-entry goes on. Build the final review package from `git merge-base origin/<trunk> HEAD`, so it covers the resolution. Task ranges that were reviewed before the merge keep their reviews. After the final review (an entry with `build: built`, or Land, step 4), the merge is a `land-<k>` fix task by **A fix after the final review** below: its implementer resolves the conflict by steps 2 to 5 of the same section, then the verify gate of the project and a task review run, and the session renews the affected runtime evidence by `<plugin>/docs/procedures/runtime-verification.md`, "Evidence lifetime". A merge with no conflict makes no fix task.

**Tail — after every task is review-clean, in order:**
1. `celetis:polishing-code-comments` sweep over the full branch diff (once per branch).
2. Broad final whole-branch review (the final review of the upstream skill). Give each final reviewer the exact applicable principle paths for the reviewed changes, with instructions to read them. Refresh lesson rules for the final review and each review fix per `<plugin>/docs/procedures/task-lessons.md`. For each repair, derive paths from the changed repair scope and retain applicable task constraints in its brief:
   - On the inline flow, score the whole branch with `celetis --agent <host> capscore J V B N S X --bias BIAS --attempt 1 --reviewer --json`, and dispatch the reviewer by `<plugin>/docs/procedures/dispatch.md`, "One child", with the full diff in its brief. The session fixes Critical and Important findings in one pass, each fix test-first, with no second review.
   - On the subagent flow, score the whole branch, then run `celetis --agent <host> dispatch next <n> final reviewer J V B N S X --bias N`. Send findings to `review <n> final findings`; its returned action starts the one fix wave. After each implementer `DONE`, run the gate and report it with `gate`; on a pass, the engine issues the scoped re-review. Apply the upstream skill's rulings for each residual finding, then use `close <n> final`.
3. A re-run of the verify gate of the project.
4. The **Verify phase** (below) — apply `<plugin>/docs/procedures/runtime-verification.md`, "Usage-limit exception", before treating an incomplete check as a landing hold.
5. **Land** by `<plugin>/docs/procedures/landing.md`, from its step 1, after publishing the runtime
   evidence per `<plugin>/docs/procedures/runtime-verification.md`, "Reports and deferred checks".
   "Land, step <k>" in this skill is step <k> of that module. Land, step 3, curates the lesson queue by `<plugin>/docs/procedures/lesson-curation.md`, "Curation at a landing". The fix rule of its step 4 is **A fix after the final review** below: the fix is a new `land-<k>` task through `<plugin>/docs/procedures/dispatch.md`, "The task loop".

**A fix after the final review.** A Verify FAIL, a refusal that the change caused (Land, step 4), and a conflict with the trunk after the final review use one rule in both flows. The rule needs no `Execution:` line, so it also works on re-entry. The fix runs the task loop of `superpowers:subagent-driven-development` with the fix as its one task: an implementer, the verify gate of the project, a task review, and `close`. The loop follows **Task dispatch** and **Gate each task before its review**. A session that did not invoke that skill invokes it now, for its task loop only. The plan has no task for the fix, and a clean final review deletes the plan's workspace. So the session writes the fix brief to a file in the workspace that `sdd-workspace PLAN_FILE` of that skill prints. The brief holds the cause (the failed scenario and its output, the `land:` lines, or the output of the worktree entry and its checkout path), the Global Constraints of the plan (for a micro-plan, the constraints of its task), the applicable task constraints, the exact applicable principle paths derived from the repair scope, and the verify gate of the project. The session scores the fix as a new `verify-<k>` or `land-<k>` task; no published digits exist for it. The task reviewer takes that task's digits and bias through the engine. It gets the brief, the report, and a review package over the fix range. No review follows such a fix, so its task review is its only review.

The saved fix brief also carries the lesson rules refreshed for the repair scope per
`<plugin>/docs/procedures/task-lessons.md`. On re-entry or after workspace cleanup, rebuild them
from the current plan by its "Refresh". Give the implementer and reviewer that same context.

Carry the affected documentation assessment by
`<plugin>/docs/procedures/behavior-documentation.md`, "Repairs and re-entry", in that saved or
reconstructed brief and its task review.

**Verify phase — prove the plan's Verify scenarios on the project's own runtime.** Read
`<plugin>/docs/procedures/verification-recipes.md` and apply "Execution and retention" to the
required scenarios. Read
`<plugin>/docs/procedures/runtime-verification.md` and apply "Confirming a target", "Evidence
lifetime", "Reports and deferred checks", and "Usage-limit exception" to each runtime scenario
and its report, including a deferred scenario on re-entry. Execute the plan's Verify phase per the project's runtime shape (on-device for an app, a browser flow for web, a script for a backend). The phase runs no full suite: the CI of the lane PR runs it with the landing `pr`, and `land` runs it with the landing `merge` (Land step 3). A scenario whose consent is in "Answers before the build" of `### Your steps` uses that answer and does not ask again. A consent that the plan does not hold is a live question by `<plugin>/docs/procedures/stop.md`, "The check before a stop". A scenario that needs an act of "During the build" reads the value of the act from a `## Human steps done` comment after the latest `## Plan` comment. With no report of the act, the scenario cannot run and has no PASS: run each other scenario. Before the `## Before landing` comment, apply `<plugin>/docs/procedures/stop.md`, "The check before a stop": the comment names only acts outside the session. Then write one `## Before landing` comment for this build to a file, with no heading. It names each act with no report, its report form, and the scenarios that wait for it, not the commands of a scenario that waits for an act. In a step session, it also holds each scenario that a guard refused and that no approval in the session lets run (`<plugin>/docs/procedures/stop.md`, "A Verify scenario that cannot run"). Publish the available runtime evidence before this completion record. Then run `celetis --agent <host> issue <n> before-landing <file> --during-the-build` as the last act, and stop. This lane session never invents a human contribution or writes its completion report. An assistance report follows `<plugin>/docs/procedures/assisted-completion.md`; read its sourced evidence under the same current-build and runtime rules.

In Verify, before relying on a result, read `<plugin>/docs/principles/explain-the-number.md`. Apply it when its `Applies when` holds, with its `Check`.

A FAIL starts a new scored `verify-<k>` task through the dispatch task loop above (implementer, the verify gate of the project, task review, and `close`). Then run the failed scenarios again. Renew affected evidence and apply `<plugin>/docs/procedures/runtime-verification.md`, "Usage-limit exception", before a new hold or continuation to Land. The Tail above sequences this phase.

### Subagent flow only

**Capability tier of each task.** Each task carries a `CAP: … → model/effort` line (plan scored it). Use its digits and bias with **Task dispatch** above; the engine resolves the implementer and reviewer pairs.

**Gate each task before its review.** The base loop is implementer → task review; insert a deterministic gate between them:
1. Implementer returns `DONE` → run the verify gate of the project and save its report.
2. Report the result with `celetis --agent <host> dispatch gate <n> <task> pass|fail <gate> <report>`.
3. Send the returned `ready` dispatch once. A pass returns the task reviewer; a fail returns the implementer for repair. Include `GATE FAIL: <name>` and the report path in the repair prompt. The engine owns escalation and stops. After review findings or `BLOCKED`, use the corresponding `review` act; after a clean review, use `close`.

### Inline flow only

**The verify gate of the project is the test command of `task-done`.** End each task with the helper `task-done` of `superpowers:executing-plans`, run as that skill says: by its absolute path in the folder of that skill, from the lane worktree, as `<the folder of that skill>/scripts/task-done PLAN_FILE N BASE -- <the verify gate of the project>`. The folder of that skill is the folder of its loaded `SKILL.md`. A task is complete only when the gate passes. `task-done` runs the command with no shell. A gate that starts with variable assignments starts with `/usr/bin/env`. A gate with a shell operator (`&&`, `;`, a pipe, a redirection) runs as `/bin/sh -c '<the verify gate of the project>'`.

**A failed gate** goes to `superpowers:systematic-debugging`, a fix, and a new run of `task-done`. Nothing raises the model or the effort, because no child runs.

**The CAP line of each task** is a recommendation for the session model.
