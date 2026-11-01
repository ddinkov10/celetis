# The step before decides the effort of the next step

## Date

2026-11-01

## Related

- [Issue #202](https://github.com/ddinkov10/celetis/issues/202), its approved spec and plan.
- [ADR-0038](0038-a-bug-session-hands-on-to-plan.md): a `bug` session hands on to `plan`, so the
  plan of the lane `bug` normally runs in the `bug` session.
- [ADR-0040](0040-the-planner-chooses-the-build-flow.md): the planner chooses the build flow, and
  an inline build runs on the effort of the session.
- [ADR-0041](0041-the-engine-owns-the-attempts-and-checks-each-dispatch.md): the effort of a child
  agent comes from `capscore` and `dispatch`.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): text that two or more skills need is
  a procedure module.
- `docs/procedures/effort.md`, `engine/lib/effort.ts`, the act `effort` of `engine/issue.ts`, and
  `hostArguments` of `engine/lib/session.ts`.

## Context

A step session that the runner or the board started ran at the effort level of the maintainer's
host settings: `hostArguments` gave the host no effort level. The maintainer wants each step done
well the first time, and asked whether a step before can decide the level of the next step.

The work of one step differs from issue to issue. Each step knows more of the work than the step
before it: `triage` knows only the request, `specify` and `bug` know the design or the cause, and
`plan` knows each task and the build flow. A large feature can need xhigh for `specify` and `plan`,
and less for an `implement` session that only coordinates children.

## Constraints and evidence

- The maintainer compared the levels on `claude-opus-5-5`, one run per level with two prompts:
  high was enough for small, clear work, xhigh gave the most complete result for larger work, and
  max cost about 4 to 6 times as much as xhigh and was not better.
- The maintainer decided on 2026-11-01: two issues at the same step can get different levels; a
  decision can use each of the five levels of the host; the step before decides; a person can
  change the level of one start from the board or with a runner flag; and the decision is a level
  and a reason that the step agent names.
- Claude Code 2.1.316 takes `--effort <level>` for a session; `CLAUDE_CODE_EFFORT_LEVEL` and a level
  picked in the session come before it. Codex CLI 0.166.0 takes `-c model_reasoning_effort=<level>`,
  and the supported levels differ by model.
- The rubric of `docs/capability.md` is calibrated for child agents. With the default bias 2, a sum
  of 7 or more gives max. The session model stays the user's choice.
- The completion watcher can end a step session at its first idle moment after an act that moves
  the line of the issue.
- Claude Code, Codex, and the Anthropic and OpenAI APIs set effort from an ordered list of sources
  with a per-run override, and the models think adaptively inside a level. Copilot Auto, Cursor
  Auto, the GPT-5 router, and RouteLLM route by a trained classifier or preference data. No product
  found records a reason for each choice or lets the step before decide.

## Decision

`triage` decides the level of the first step of the lane, `specify` and `bug` decide the level of
`plan`, and `plan` decides the level of `implement`. Nothing decides `triage`, and the last steps
`chore`, `hotfix`, and `implement` decide nothing. The deciding agent picks one level from a fixed
anchor table and writes a reason of one sentence; max needs a stated reason that xhigh is not
enough. For `implement`, an inline flow gets the level of its hardest task, and a subagent flow
gets the level of the coordination, because each child gets its own effort from `dispatch`.

The agent records the decision with `issue <n> effort <step> <level> <file>`, before the act that
moves the line. The act posts one comment whose first line is `Effort: <step> <level>`, then the
reason. It is a comment, not a line in the spec, the plan, or the root-cause report, because
`triage` publishes no such text. The first line is not a `## ` heading, so the heading reads of the
resolver ignore it.

One read, `effortOf`, gives the runner and the board the newest exact marker for the step of a
`run` line, else the default `high`. The runner starts the session at that level and prints the
level and its source. An override of the runner or the board applies to one start and writes no
decision. The session model does not change.

This is the practical choice: the step with the newest knowledge of the work names the level, and
the reason shows the person why before a press.

## Alternatives considered

- **The step scores the rubric, and `capscore` computes the level.** The arithmetic gives the same
  level each time, but the rubric is calibrated for child agents: with the default bias 2, many
  sessions would get max. A session band table or bias rule would give the six digits a second
  meaning. Rejected.
- **The runner computes the level from what the issue has.** It is deterministic and needs no agent
  work. But the first lane steps have only the request text, so they get an almost fixed level, and
  a router needs a trained classifier and data that Celetis does not have. Rejected.
- **One fixed level for each step.** Two issues at the same step can need different levels, and the
  maintainer decided that they can get them. Rejected.

## Consequences

- Each step session that the runner or the board starts has an explicit level, and the board shows
  the level and its reason before a press.
- The level is judgment, so two agents can choose differently for similar work. The reason on the
  issue and the board shows a surprising level, and an override corrects one start.
- A decision after the act that moves the line can be lost. Each deciding skill runs the command
  before that act (`docs/procedures/effort.md`, "The order").
- In the lane `bug`, the `bug` session normally writes the plan in the same turn (ADR-0038), so the
  plan runs at the level that `triage` chose for `bug`. The `plan` decision of `bug` applies only to
  a `plan` step that starts in a new session, after a session that ended between `## Root cause`
  and `## Plan`.
- A host setting or cap can apply another level than the chosen one. The runner does not read or
  change it.
- Sessions that a person starts by hand, assistance sessions, and intake sessions keep the level of
  the host settings.

## Reconsider when

- A host chooses the effort of each session adaptively, so that a level chosen before the start
  adds nothing.
- The comparison of the levels changes: for example, max becomes better than xhigh for its cost,
  or high becomes enough for larger work.
