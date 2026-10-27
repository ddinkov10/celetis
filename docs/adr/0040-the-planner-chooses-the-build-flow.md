# The planner chooses the build flow

## Date

2026-10-27

## Related

- [Issue #138](https://github.com/ddinkov10/celetis/issues/138): `implement` runs a small plan
  inline and a long plan with subagents.
- `skills/implement/SKILL.md`, `skills/plan/SKILL.md`, and step 5 of `skills/hotfix/SKILL.md`.
- [ADR-0010](0010-the-superpowers-plugin-stays-and-updates-itself.md): the superpowers plugin
  updates itself.
- [ADR-0011](0011-a-step-session-hands-a-stop-to-the-issue.md): a step session hands a stop to the
  issue.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the repository keeps no tests. TDD stays a
  method.

## Context

`implement` always built a plan with `superpowers:subagent-driven-development`. That skill starts a
new implementer and a new task reviewer for each task, and each one reads the codebase again from
zero. A plan with one task paid for an implementer, a task reviewer, and a final reviewer, and the
two reviewers read the same diff. A hotfix micro-plan always has one task.

`superpowers:executing-plans` builds the tasks in the session itself. It costs one context and one
new review of the whole branch. The maintainer wants a small plan built inline and a long plan built
with the subagent loop. The maintainer's rule for "long": the plan "does many tasks, and it isn't a
simple thing to do". The planner decides which flow the plan uses.

## Constraints and evidence

- The runner starts each step session with no model flag. So an inline task runs on the model and
  effort of the session. `docs/capability.md` already says that a CAP line is only a recommendation
  for a session-executed task.
- The recent plans of this repository have 1 to 9 tasks and are 1 to 61 kB. Of 35 plans, 21 have 3
  tasks or fewer. Each plan with 4 or more tasks has at least one task with a CAP sum of 7 or more.
- The engine posts a plan with no check of its content (act `plan` in `engine/issue.ts`). It checks
  no other part of the plan either.
- superpowers 7.0.1: `executing-plans` ends each task with `scripts/task-done PLAN_FILE N BASE --
  <test command>`, which writes the completion line to the ledger only when the command passes.
  `task-done` runs the command with no shell.
- superpowers 7.0.1: `executing-plans` dispatches one new reviewer for the whole branch. The
  session fixes the Critical and Important findings itself, with no re-review.
- superpowers 7.0.1: `executing-plans` and `subagent-driven-development` share one workspace and
  one ledger, so a plan can change executors.
- A `me` gate holds the step that it names (`docs/celetis-flow.md`). So only the gate of
  `implement` holds the build after `plan` publishes.
- The re-entry rule of `implement` with `build: built` runs no task. A new `/celetis:plan` run adds
  `ready-for-agent` again, so a built change must not need a new plan run to land.

## Decision

**The `Execution:` line.** The plan header has one line, `Execution: inline — <one-sentence
reason>` or `Execution: subagent — <one-sentence reason>`. `implement` reads the first line of the
plan file that starts with `Execution: `. The first word after it is the flow. The header comes
before the tasks, so a task that quotes such a line does not change the result.

**The rule of the planner.** The flow is `subagent` when the plan has many tasks and at least one
task is not simple. Each other plan is `inline`, so a plan with one task is always `inline`. The
planner judges "many" and "not simple" from the number of tasks, the CAP line of each task, and how
much a task depends on the interfaces of an earlier task. The rule sets no number. `plan` asks no
person to choose the flow. This replaces the question of the execution method of
`superpowers:writing-plans`. In a project where the gate of `implement` is `me`, the maintainer
reads the line in the plan review and can correct it before the build starts.

**The flows.** `implement` invokes `superpowers:executing-plans` for `inline`, and
`superpowers:subagent-driven-development` for `subagent`. The additions of `implement` are in three
groups: both flows, the subagent flow only, and the inline flow only. Land takes the place of the
last step of each upstream skill.

**The gate.** The verify gate of the project runs at the end of each task in both flows. On the
inline flow, it is the test command of `task-done`. A gate that starts with variable assignments
starts with `/usr/bin/env`. A gate with a shell operator (`&&`, `;`, a pipe, a redirection) runs as
`/bin/sh -c '<the verify gate of the project>'`. The third failed gate of one task stops the session
in both flows, and rule 4 of the step text hands the stop to the issue (ADR-0011). So `plan` and the
hotfix micro-plan carry no gate line, and `plan` deletes its addition "Tasks are gated".

**A fix after the final review.** A Verify FAIL and a refusal that the change caused use the task
loop of `superpowers:subagent-driven-development` in both flows, with the fix as its one task. A
re-entry session that runs Verify has no build context, so the fix must not depend on the
`Execution:` line.

**An invalid line.** No `Execution:` line, or a word other than `inline` or `subagent`, stops
`implement` before the first task, with a message that names `/celetis:plan #<n>`. There is no
default flow. Re-entry with `build: built` reads no line, so a built change lands with any plan.

**The hotfix micro-plan.** Its first line is `Execution: inline — one task`. It names its task
`### Task 1: <title>`.

This is the practical choice: it changes skill and document text only. The engine does not read the
flow, and both upstream skills stay in use.

## Alternatives considered

- **A rule in `implement` that counts tasks and reads the CAP sums.** It is deterministic, but the
  maintainer wants the planner to decide. Rejected.
- **Two build skills, for example `/celetis:implement-inline`.** The resolver and the runner would
  have to read the plan to select the command. That changes `engine/lib/workflow.ts`, the runner,
  and the board for the same result. Rejected.
- **An issue label such as `inline`.** The engine has no use for the choice. A label adds an
  eleventh label to the workflow, to `setup`, and to the board. Rejected.
- **An engine check in `issue <n> plan` that refuses a plan with no `Execution:` line.** The engine
  checks no other part of the plan. Plans published before the change still need the stop in
  `implement`. Rejected.

## Consequences

- A small plan costs one context and one final review.
- A plan with many tasks, of which one or more are not simple, keeps a review and a new context for
  each task.
- The choice and its reason are visible in the `## Plan` comment.
- Plans published before the change have no `Execution:` line. They stop `implement` until a new
  `/celetis:plan` run (#104 and #81 at the time).
- The planner can misjudge the flow, and nothing checks the choice. With the gate `me` on
  `implement`, the maintainer can correct the line before the build.
- An inline build runs on the model and effort of the session. The premise that this is good enough
  for a small or simple plan is not verified. The first real inline build checks it.
- The inline flow depends on `executing-plans`, its `task-done` script, and the shared ledger of
  superpowers 7.0.1. ADR-0010 lets that plugin update itself.

## Reconsider when

- `executing-plans`, `task-done`, or the shared ledger of superpowers changes.
- Inline builds prove weaker than subagent builds of plans of the same size.
- The runner starts step sessions with a model flag.
