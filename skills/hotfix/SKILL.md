---
name: hotfix
description: Type-axis lane for a hotfix — production is broken and the fix must ship now. Use when the human runs /celetis:hotfix, or when a request is a prod-down / blocking-regression fire needing immediate ship — as opposed to a normal bug with no fire (/celetis:bug), new behavior (/celetis:feature), or a zero-behavior-change edit (/celetis:chore). Ends by printing a manual ship checklist for you to run.
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:hotfix — production hotfix lane

Production is broken; the fix ships now. Type declared at entry; if undeclared, the signal is
**prod-broken + ship-now** (a normal bug with no fire is `/celetis:bug`).

## The Iron Law

```
NO STEP SKIPPED. NO STEP REORDERED. THE FIRE IS NOT A WAIVER.
```

Each step is the next one's precondition — no debugging without exploring, no fix without the
root cause, no ship without the verify. If you have not completed step N, you cannot start step
N+1. Too little time for the lane → the change does not ship tonight.

1. **Confirm classification.** Fire needing ship-now → continue. No fire → `/celetis:bug`. New behavior →
   `/celetis:feature`. Zero behavior change → `/celetis:chore`. Then start the lane per
   `<plugin>/docs/procedures/lane-start.md`, with `hotfix` as `<lane>` and `hotfix` as `<label>`.
2. **Worktree.** Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md`; a new
   branch is `hotfix/<n>-<slug>`.
3. **Explore project context.** Explore files, docs, recent commits, and read the project context
   per `<plugin>/docs/procedures/project-context.md`. Its traps are the constraints on the fix.
4. **Invoke `superpowers:systematic-debugging`** — MANDATORY. The red repro is the micro-plan's
   Verify probe. After two failed fixes that share a premise, read
   `<plugin>/docs/principles/attack-the-premise.md` before another already-permitted attempt;
   every existing attempt limit and stop still applies. When a hypothesis relies on a measured
   performance or quality result, read `<plugin>/docs/principles/explain-the-number.md`.
   A hypothesis that rests on library, platform, or vendor behavior is checked per
   `<plugin>/docs/procedures/docs-lookup.md` before the report names it the root cause. Post the report, with
   its `## External facts` section, with `celetis --agent <host> issue <n> root-cause <report>`:
   it posts the report with `## Root cause` as its first line, so the report file has no heading.
5. **Author a one-task micro-plan in `docs/superpowers/plans/<n>.md`** (gitignored scratch; the
   fire's substitute for `plan`):
   - The first line of the micro-plan is `Execution: inline — one task`. A micro-plan has no
     `### Your steps` and no `Bias:` line, so this line is its header.
   - The task is the root-cause fix under `### Task 1: <title>`, with step 3's traps as its
     constraints. Both build flows of `implement` find a task by its `Task <N>` heading.
   - Each library call the fix adds is checked per `<plugin>/docs/procedures/docs-lookup.md`; the facts go
     in the micro-plan's `## External facts` section.
   - Put the exact applicable principle paths in the task text, alongside its external facts.
     Resolve `<plugin>` to the absolute path bound by the entry. Read only the files whose
     conditions hold: for external input or validation changes,
     `<plugin>/docs/principles/boundary-discipline.md`; for unclear state combinations, growing
     branches, or repeated shape rules, `<plugin>/docs/principles/model-the-domain.md`; for
     persistent or retryable operations, `<plugin>/docs/principles/make-operations-idempotent.md`;
     for concurrent writers, `<plugin>/docs/principles/separate-before-serializing-shared-state.md`;
     for types or signatures in a statically typed language,
     `<plugin>/docs/principles/type-system-discipline.md`; for behavioral verification checks,
     `<plugin>/docs/principles/test-behavior-not-implementation.md`.
   - CAP line via `celetis --agent <host> capscore J V B N S X` — never hand-computed. It is a recommendation for the session, because `implement` builds a micro-plan inline.
   - Verify phase: the red repro re-run post-fix, plus one error branch of any newly-enabled
     path (widened allow-list / enum / dispatch literal / flag).
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
   - The landing stopped with a `## Before landing` comment, and `implement` added `ready-for-human`: print the checklist, and stop.
     - [ ] Do the act that the `## Before landing` comment names.
     - [ ] Remove `ready-for-human`.
     - [ ] Run `celetis --agent <host> land <n> '<subject>'` in your own shell.
     - [ ] Do the ship acts of the project.

   In each checklist, the removal of `ready-for-human` comes before `land`: `land` refuses while the label is on, and after the removal the card reads `land by hand` until the landing.
