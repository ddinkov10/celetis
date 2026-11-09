---
name: hotfix
description: Type-axis lane for a hotfix — production is broken and the fix must ship now. Use when the human runs /celetis:hotfix, or when a request is a prod-down / blocking-regression fire needing immediate ship — as opposed to a normal bug with no fire (/celetis:bug), new behavior (/celetis:feature), or a zero-behavior-change edit (/celetis:chore). Ends by printing a manual ship checklist for you to run.
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:hotfix — production hotfix lane

Production is broken; the fix ships now. Type declared at entry; if undeclared, the signal is
**prod-broken + ship-now** (a normal bug with no fire is `/celetis:bug`).

## The Iron Law

Apply `<plugin>/docs/procedures/lane-start.md`, "The Iron Law".

```
THE FIRE IS NOT A WAIVER.
```

No debugging without exploring, no fix without the root cause, no ship without the verify. Too
little time for the lane → the change does not ship tonight.

**Before step 1.** Check the wiring per `<plugin>/docs/procedures/lane-start.md`, "Before step 1".
Only the exit 0 of `setup status` starts step 1.

1. **Confirm classification.** Fire needing ship-now → continue. No fire → `/celetis:bug`. New behavior →
   `/celetis:feature`. Zero behavior change → `/celetis:chore`. Then start the issue per
   `<plugin>/docs/procedures/lane-start.md`, "Start the issue", with `hotfix` as `<lane>`.
2. **Worktree.** Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md`.
3. **Explore project context.** Read the project context per
   `<plugin>/docs/procedures/project-context.md`, then explore per
   `<plugin>/docs/procedures/diagnosis.md`, "The explore".
4. **Invoke `superpowers:systematic-debugging`** — MANDATORY. The red repro is the micro-plan's
   Verify probe. Apply
   `<plugin>/docs/procedures/diagnosis.md`, "The diagnosis". Post the report, with
   its `## External facts` section, with `celetis --agent <host> issue <n> root-cause <report>`:
   it posts the report with `## Root cause` as its first line, so the report file has no heading.
5. **Author a one-task micro-plan in `docs/superpowers/plans/<n>.md`** (gitignored scratch; the
   fire's substitute for `plan`):
   - The first line of the micro-plan is `Execution: inline — one task`. A micro-plan has no
     `### Your steps` and no `Bias:` line, so this line is its header.
   - The task is the root-cause fix under `### Task 1: <title>`, with step 3's traps as its
     constraints. Both build flows of `implement` find a task by its `Task <N>` heading.
   - Carry matched lesson rules into that task per `<plugin>/docs/procedures/task-lessons.md`,
     "Authoring".
   - Assess current documentation per `<plugin>/docs/procedures/behavior-documentation.md`,
     "Assessment" and "Change work", and include the affected sections in that task.
   - Each library call the fix adds is checked per `<plugin>/docs/procedures/docs-lookup.md`; the facts go
     in the micro-plan's `## External facts` section.
   - Read each principle below. Apply each one whose `Applies when` holds for the task, with its
     `Check`. Put the exact path of each principle that applies in the task text, alongside its
     external facts. Resolve `<plugin>` to the absolute path bound by the entry. An empty applicable
     set needs no path:
     - `<plugin>/docs/principles/boundary-discipline.md`
     - `<plugin>/docs/principles/model-the-domain.md`
     - `<plugin>/docs/principles/make-operations-idempotent.md`
     - `<plugin>/docs/principles/separate-before-serializing-shared-state.md`
     - `<plugin>/docs/principles/type-system-discipline.md`
     - `<plugin>/docs/principles/test-behavior-not-implementation.md`
   - Apply `<plugin>/docs/capability.md`, "The rubric — six dimensions, each 0–2" and "Scorecard format — MANDATORY", to the task's digits and evidence reason. Emit its CAP line via `celetis --agent <host> capscore J V B N S X` — never hand-computed. It is a recommendation for the session, because `implement` builds a micro-plan inline.
   - Verify phase: the red repro re-run post-fix, plus one error branch of any newly-enabled
     path (widened allow-list / enum / dispatch literal / flag). Read
     `<plugin>/docs/procedures/runtime-verification.md` and apply "Planning" to its runtime
     scenarios.
   Fix crosses subsystems or unrolls a chain → not shim-able: route the issue to `bug` with
   `celetis --agent <host> issue <n> route bug`
   (the plan of a `bug` reads its `## Root cause` comment, which stays on the issue), then run the
   full `celetis:plan`; or the change does not ship tonight.
6. **Run `celetis:implement #<n>` on the micro-plan** — its Land step lands the fix, as each lane
   does. A micro-plan is a local file, so the re-entry rule of `implement` does not apply to it.
   Window too small to verify → the change does not ship tonight: stop, report blocked.
7. **Terminal.** When the entry of `hotfix` gave custom text (`custom.hotfix`), that text names the ship acts of the project. Only an entry that found no custom text (the facts line `- custom: none`, or that result on the path without the hook) means that the project has no ship act. When the session cannot see its entry result, the checklist says that the ship acts are not known and tells the maintainer to do the ship acts of the project.
   - The fix landed: print the acts of the maintainer, and stop.
     - [ ] Do the ship acts of the project.
   - The landing stopped with a `## Landing refused` comment: run `celetis --agent <host> issue <n> ready-for-human`, print the checklist, and stop.
     - [ ] Fix the cause that the `## Landing refused` comment names.
     - [ ] Remove `ready-for-human`.
     - [ ] Run `celetis --agent <host> land <n> '<subject>'` in your own shell.
     - [ ] Do the ship acts of the project.
   - The landing stopped with a `## Before landing` comment: print the checklist, and stop.
     - [ ] Do the act that the `## Before landing` comment names.
     - [ ] Remove `ready-for-human`.
     - [ ] Run `celetis --agent <host> land <n> '<subject>'` in your own shell.
     - [ ] Do the ship acts of the project.

   In each checklist, the removal of `ready-for-human` comes before `land`: `land` refuses while the label is on, and after the removal the card reads `land by hand` until the landing.
