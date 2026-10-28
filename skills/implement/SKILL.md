---
name: implement
description: "Use when executing a written plan for a feature in the current session. Superset of superpowers:executing-plans and superpowers:subagent-driven-development; the plan's Execution: line picks one. Not for writing the plan (plan) or the design pass (specify)."
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# implement

Superset of `superpowers:executing-plans` (the inline flow) and `superpowers:subagent-driven-development` (the subagent flow) for project plans. The `Execution:` line of the plan picks the flow. This skill gets each task-loop dispatch from `dispatch`, gates each task, and adds the Verify phase and the landing.

## Do this

1. Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md`. Then fetch the plan into `docs/superpowers/plans/<n>.md`. A hotfix's micro-plan is already there, written by its lane. Every other lane's plan is the latest `## Plan` comment on the issue, which a local file from the `plan` session can lag: `mkdir -p docs/superpowers/plans && gh issue view <n> --json comments --jq '[.comments[] | select(.body | startswith("## Plan"))][-1].body' > docs/superpowers/plans/<n>.md`.

   **Re-entry**, for each lane but a hotfix (its micro-plan is a local file): run `celetis --agent <host> issue <n> state` and read its lines (`<plugin>/docs/issue-tracker.md`, "Conventions"). Each `open:` line names a `## Before landing` comment of this build that has no completion evidence, and the evidence that is missing. `build: planned` is a plan to build. `build: built` means that an earlier run built the change. Do not build again: run no task of the plan, skip the Tail steps 1 to 4, and handle the latest `## Landing refused` comment by `<plugin>/docs/procedures/landing.md`, "Re-entry after a refusal", which goes on to Land, step 2. The exception is a `## Before landing` comment of this build that names an act of "During the build" with no report (the Verify phase below, or Land, step 2). When no `open:` line names that comment, and one or more `## Human steps done` comments after it report each act that it names, run the Verify scenarios that the comment names as waiting for those acts. Go to Land, step 2 on a PASS; a FAIL loops back to a fix, as in the Verify phase. Without that evidence, go to Land, step 2. A plan without a later `## Built` or `## Before landing` comment stays `planned`, including after a stop or a failed readiness write. Clearing a human hold resumes that state without restoring `ready-for-agent`. A new `/celetis:plan` run starts a new build.
2. **Read the flow.** Do this step with `build: planned`, or with a hotfix micro-plan. The plan names its flow on a line of the form `Execution: inline — <one-sentence reason>` or `Execution: subagent — <one-sentence reason>`. Read the first line of the plan file that starts with `Execution: `. The first word after `Execution: `, after any more spaces and up to the next space or the end of the line, is the flow: `Execution:    inline — …` is `inline`. No such line, or a word other than `inline` or `subagent`, is an invalid line. An invalid line stops `implement` before the first task: show the user this message, with `<n>` and `<found>` filled in, and stop. `<found>` is the first line that starts with `Execution: `, or `none`.
   - A plan from the issue: `implement: the plan of #<n> has no valid Execution: line (found: <found>). Run /celetis:plan #<n> again; the new plan names the build flow.`
   - A hotfix micro-plan: `implement: the micro-plan of #<n> has no valid Execution: line (found: <found>). Write Execution: inline — one task as its first line (step 5 of /celetis:hotfix), then run /celetis:implement #<n>.`

   In a step session, hand the stop to the issue by `<plugin>/docs/procedures/stop.md`, "A stop in a step session". Re-entry with `build: built` reads no line, so a built change lands with any plan.
3. Invoke `superpowers:executing-plans` for `inline`, or `superpowers:subagent-driven-development` for `subagent`, as the entry contract says, and follow it. The upstream skill owns its task loop, its final whole-branch review, and the fix pass of that review. With `executing-plans`, the session fixes the Critical and Important findings in one pass, each fix test-first, with no second review. The verify gate of the project takes the place of its whole-suite run (Land, step 3). With `subagent-driven-development`, one fix subagent fixes the findings, and one scoped re-review reads the fix. Land (Tail step 5) takes the place of its last step, the skill that finishes the development branch: do not invoke that skill.
4. Layer the project additions below: **Both flows**, and the group of the flow of the plan.

## Additions

### Both flows

**Task dispatch — every child in the subagent task loop and fixes after the final review.** Get each dispatch from `celetis --agent <host> dispatch` by `<plugin>/docs/procedures/dispatch.md`, "The task loop".

**Comment policy — append to every implementer prompt (verbatim):**
> Comments: default none; one line only for a constraint the code can't show; never narrate what the next line does or why the change is correct. Style source: the `celetis:polishing-code-comments` skill.

**Commit subject — append to every implementer prompt (verbatim):**
> Commit subject: `<type>(<area>): <what>` — `<area>` is whatever a reader would recognise: the package or concern the task touched (`lib` alone if nothing is clearer). `<type>` is `feat` for new behavior, else `fix`/`refactor`/`test`. Body: what changed and why, naming a symbol a reader can grep, and referencing `#<n>`.

On the inline flow, the session builds each task itself and applies both blocks to its own work.

**TDD** is the method of each task.

**The verify gate of the project at the end of each task.** On the inline flow, the third failed gate of one task stops the session with the failure trail. On the subagent flow, the engine owns escalation and stops. In a step session, hand the stop to the issue by `<plugin>/docs/procedures/stop.md`, "A stop in a step session".

**Tail — after every task is review-clean, in order:**
1. `celetis:polishing-code-comments` sweep over the full branch diff (once per branch).
2. Broad final whole-branch review (the final review of the upstream skill):
   - On the inline flow, score the whole branch with `celetis --agent <host> capscore J V B N S X --bias BIAS --attempt 1 --reviewer --json`, and dispatch the reviewer by `<plugin>/docs/procedures/dispatch.md`, "One child", with the full diff in its brief. The session fixes Critical and Important findings in one pass, each fix test-first, with no second review.
   - On the subagent flow, score the whole branch, then run `celetis --agent <host> dispatch next <n> final reviewer J V B N S X --bias N`. Send findings to `review <n> final findings`; its returned action starts the one fix wave. After each implementer `DONE`, run the gate and report it with `gate`; on a pass, the engine issues the scoped re-review. Apply the upstream skill's rulings for each residual finding, then use `close <n> final`.
3. A re-run of the verify gate of the project.
4. The **Verify phase** (below) — its PASS/FAIL is a hard gate.
5. **Land** by `<plugin>/docs/procedures/landing.md`, from its step 1. "Land, step <k>" in this skill is step <k> of that module. The fix rule of its step 4 is **A fix after the final review** below: the fix is a new `land-<k>` task through `<plugin>/docs/procedures/dispatch.md`, "The task loop".

**A fix after the final review.** A Verify FAIL and a refusal that the change caused (Land, step 4) use one rule in both flows. The rule needs no `Execution:` line, so it also works on re-entry. The fix runs the task loop of `superpowers:subagent-driven-development` with the fix as its one task: an implementer, the verify gate of the project, a task review, and `close`. The loop follows **Task dispatch** and **Gate each task before its review**. A session that did not invoke that skill invokes it now, for its task loop only. The plan has no task for the fix, and a clean final review deletes the plan's workspace. So the session writes the fix brief to a file in the workspace that `sdd-workspace PLAN_FILE` of that skill prints. The brief holds the cause (the failed scenario and its output, or the `land:` lines), the Global Constraints of the plan (for a micro-plan, the constraints of its task), and the verify gate of the project. The session scores the fix as a new `verify-<k>` or `land-<k>` task; no published digits exist for it. The task reviewer takes that task's digits and bias through the engine. It gets the brief, the report, and a review package over the fix range. No review follows such a fix, so its task review is its only review.

**Verify phase — prove the plan's Verify scenarios on the project's own runtime.** Execute the plan's Verify phase per the project's runtime shape (on-device for an app, a browser flow for web, a script for a backend). The phase runs no full suite: the CI of the lane PR runs it with the landing `pr`, and `land` runs it with the landing `merge` (Land step 3). A scenario that needs an act of "During the build" reads the value of the act from a `## Human steps done` comment after the latest `## Plan` comment. With no report of the act, the scenario cannot run and has no PASS: run each other scenario, then write one `## Before landing` comment for this build to a file, with no heading. It names each act with no report, its report form, and the scenarios that wait for it, not the commands of a scenario that waits for an act. In a step session, it also holds each scenario that a guard refused (`<plugin>/docs/procedures/stop.md`, "A Verify scenario that cannot run"). Then run `celetis --agent <host> issue <n> before-landing <file> --during-the-build` as the last act, and stop. It posts the comment with the marker of an act of "During the build", then adds `ready-for-human` and removes `ready-for-agent`. A session never writes a `## Human steps done` comment.

A FAIL starts a new scored `verify-<k>` task through the dispatch task loop above (implementer, the verify gate of the project, task review, and `close`). Then run the failed scenarios again. The Tail above sequences this phase; its PASS is the hard gate before Land.

### Subagent flow only

**Capability tier of each task.** Each task carries a `CAP: … → model/effort` line (plan scored it). Use its digits and bias with **Task dispatch** above; the engine resolves the implementer and reviewer pairs.

**Gate each task before its review.** The base loop is implementer → task review; insert a deterministic gate between them:
1. Implementer returns `DONE` → run the verify gate of the project and save its report.
2. Report the result with `celetis --agent <host> dispatch gate <n> <task> pass|fail <gate> <report>`.
3. Send the returned `ready` dispatch once. A pass returns the task reviewer; a fail returns the implementer for repair. Include `GATE FAIL: <name>` and the report path in the repair prompt. The engine owns escalation and stops. After review findings or `BLOCKED`, use the corresponding `review` act; after a clean review, use `close`.

### Inline flow only

**The verify gate of the project is the test command of `task-done`.** End each task with `scripts/task-done PLAN_FILE N BASE -- <the verify gate of the project>` of `superpowers:executing-plans`. A task is complete only when the gate passes. `task-done` runs the command with no shell. A gate that starts with variable assignments starts with `/usr/bin/env`. A gate with a shell operator (`&&`, `;`, a pipe, a redirection) runs as `/bin/sh -c '<the verify gate of the project>'`.

**A failed gate** goes to `superpowers:systematic-debugging`, a fix, and a new run of `task-done`. Nothing raises the model or the effort, because no child runs.

**The CAP line of each task** is a recommendation for the session model.
