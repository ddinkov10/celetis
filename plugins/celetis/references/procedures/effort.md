# The effort decision

How a step decides the model and the effort level of the next step of its lane, and records the
decision on the issue. The daemon and the board start the next step session at the pair of the
decision, else at `opus` and `medium`. A pin of the config or a change of one start can replace a
value (`<plugin>/docs/configuration.md`, "Fields and defaults"). `triage`, `specify`, `bug`, and
`plan` cite it before the act that moves the line.

## The deciding step

| Deciding step | Decides for |
| --- | --- |
| `triage` | the first step of the lane: `specify` (lane `feature`), `bug`, `chore`, or `hotfix` |
| `specify` | `plan` |
| `bug` | `plan` |
| `plan` | `implement` |

Nothing decides `triage`. `chore`, `hotfix`, and `implement` are the last steps of their lanes and
decide nothing. In the lane `bug`, the `bug` session normally writes the plan in the same turn, so
its `plan` decision applies only to a `plan` step that starts in a new session, and `triage` chooses
the pair of `bug` for both the root cause and the plan.

## The model and the level

Judge the work of the next step from what this step knows now: `triage` from the request,
`specify` from the approved spec, `bug` from the root-cause report, and `plan` from its tasks and
its `Execution:` line. Pick the model row that fits, then the level row that fits:

| Model | Fits |
| --- | --- |
| `sonnet` | Well-scoped work: the spec, the plan, or the known cause leaves few choices, and the change is in one place. For example a mechanical edit that a deterministic check catches, a bug fix with a known cause, or a plan with few tasks in one subsystem. |
| `opus` | The start model: work with design choices, an unknown cause, several subsystems, or a session that coordinates children. Use it also when no other row clearly fits. |
| `fable` | Only with a stated reason that `opus` at `high` is not enough: a major refactor or migration, an architecture decision across the system, or a long build with many coupled tasks. |

A clear spec alone does not select `sonnet`: hard work with a clear spec, for example a migration,
stays on `opus`. The table has no `haiku` row, because a step session is a long agentic loop.

| Level | Fits |
| --- | --- |
| `low` | A mechanical edit that a deterministic check catches. |
| `medium` | The start level: work with a clear scope. |
| `high` | Verification matters or edge cases are likely: a durable steering surface (skills, text that agents read), a change of permission or security semantics, or a failure that only human review catches. |
| `xhigh`, `max` | Only on `fable`, and only with a stated reason that `fable` at `high` is not enough. On `sonnet` or `opus`, pick the next model at `medium` in place of a level above `high`. |

The result is one model, one level, and a reason of one sentence that names the fact of the work
that fits the rows. A reason for `fable`, `xhigh`, or `max` states why the pair below it is not
enough.

**The pair of `implement`.** On the inline flow, the session builds each task, so the pair fits the
hardest task. On the subagent flow, the session coordinates, and each child gets its own pair from
`dispatch`, so the pair fits the work of the session itself, not the tasks of the children. The
tables set the pair, also when a CAP line names another model or effort: the rubric is an
allocation policy for child agents.

## The record

Write the reason to a file, with no `## ` first line, and run:

```sh
celetis --agent <host> issue <n> effort <step> <model> <level> <reason-file>
```

`<step>` is the step that the decision is for, `<model>` is `haiku`, `sonnet`, `opus`, or `fable`,
and `<level>` is `low`, `medium`, `high`, `xhigh`, or `max`. `issue <n> effort <step> <model> <level> <file>`
posts a comment whose first line is `Effort: <step> <model> <level>`, then the reason.
The newest decision for a step replaces each earlier one.

- **Exit 0**: the decision is on the issue.
- **Exit 2** (`usage`): a bad step, model, level, or reason file, and nothing is posted. Correct the
  arguments or the file, and run the command again.
- **Exit 3** (`prerequisite`): the issue is not open, so no next step starts. Decide nothing, and go on
  with the skill.
- **Exit 6** (`blocked`): a GitHub read or write failed, and nothing changed. Report the
  `issue: blocked:` line to the user, and go on with the skill: the act that moves the line still
  follows, and the next step starts with no new decision.

## The order

Run the command in the same turn as the act that moves the line of the citing skill, before that
act: `triage` before `issue <n> route`, `specify` before `issue <n> spec`, `bug` before
`issue <n> root-cause`, and `plan` before `issue <n> plan`. In a step session, the completion
watcher can end the session at its first idle moment after that act, so a decision after it can be
lost (`<plugin>/references/procedures/stop.md`, "The act that moves the line").
