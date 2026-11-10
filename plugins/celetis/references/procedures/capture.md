# The capture record

The record of the work that a chat decided, and the rule of a step that reads it. `capture`
writes the record; `specify`, `bug`, and `plan` read it at their read of the issue.

## The record

A comment on the issue, with this form:

```markdown
## Captured

Source: a chat in a <host> session, <YYYY-MM-DD>, recorded by `/celetis:capture`.

### Decided

- <one decision per line: what to build or what is wrong, why, the picked approach, non-goals,
  details the person decided; the person's own words where the chat has them>

### Plan

<the plan as the chat decided it: its tasks in order, with their files and checks> | None.

### Open

- <a point that the chat left open, or an agent proposal with no explicit yes of the person> | None.
```

Fidelity rules:

- A decision is a point that the person stated or explicitly accepted in the chat. An agent
  proposal with no explicit yes of the person goes under `### Open`: silence is not acceptance.
  When the person changed a point in the chat, only the last version is a decision.
- Quote the person's words where the chat has them. Never invent a decision, a reason, or a
  source.
- The record holds text only: no code, no diff, and no claim that code exists.

## A step with a record

Read the issue with `gh issue view <n> --json body,comments`: in piped output, `--comments`
omits the body. The record is the last comment whose first line is exactly `## Captured`. Only
that newest record counts, because a later capture carries forward each line that it did not
change. Only the lines inside its three parts are answers.

- Each `### Decided` line is an answer of the person. The step does not ask it again.
- Each `### Open` line is a gap. The normal questions of the step start there.
- The step still runs every check and every addition of its skill: the project context, the
  lessons, the external facts, the prior-art research, a look decision with its prototype, the
  builder check, the debugging and the red repro, the plan form, the effort decision, and the
  approval of the written text. The record removes questions, not checks.
- A `### Decided` approach is the person's pick: a binding decision stays above the research
  (`<plugin>/references/procedures/prior-art.md`, "The recommendation"). The research still runs, and
  the step lays out no approaches for a pick. The Approaches part names each found pattern, the
  decided one, and the reason: the person's decision.
- A `### Decided` list of states or platform row is that answer of the look decision
  (`<plugin>/references/procedures/ui.md`, "The look decision"). The prototype and the pick among its
  variants still come, because no variant existed in the chat.
- A finding of a check that contradicts a `### Decided` line goes into the written text as a
  risk and into the list of the hand-over, for example a found pattern that the research
  recommends over the decided approach. The person's approval of the written text decides.
- A published spec, root cause, or plan binds over the record. A `### Decided` line or a
  `### Plan` task that it contradicts is void. The step names each void line to the person in its
  hand-over, and does not ask about it. This covers a spec that `specify` changed after the chat,
  for example after its prior-art research.
- `bug`: a captured root cause is the first hypothesis of the debugging, and the red repro and
  the causal chain decide it. When they do not confirm it, each `### Decided` line that names
  that cause, or a change to it, no longer binds: for a captured root cause, this rule takes the
  place of the risk rule above. The step tells the person, before or with the report, that the
  captured cause is not confirmed, and names each of those lines. A `### Decided` line that
  answers whether the fix needs a new look is the maintainer's answer to that question.
- `plan`: the `### Plan` part gives the tasks, their order, and their decided details, and the
  step keeps them: the task right-sizing of the upstream skill splits a task only into its
  steps. The step writes the Celetis plan around them: `### Your steps`, the
  `Execution:` line, a CAP line per task, the Verify phase, the external facts, and the
  acceptance coverage. Each consent of "Answers before the build" is still asked in the plan
  session. The hand-over of `plan` is its Terminal message, and the person's review of the
  published plan is the approval of its written text.
