# The effort decision

How a step decides the effort level of the next step of its lane, and records the decision on the
issue. The runner and the board start the next step session at the decided level, else at `high`.
`triage`, `specify`, `bug`, and `plan` cite it before the act that moves the line.

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
the level of `bug` for both the root cause and the plan.

## The level

Judge the work of the next step from what this step knows now: `triage` from the request,
`specify` from the approved spec, `bug` from the root-cause report, and `plan` from its tasks and
its `Execution:` line. Pick the row that fits:

| Level | Fits |
| --- | --- |
| low | A mechanical edit that a deterministic check catches: a rename, a format, a dependency bump with a passing gate. |
| medium | A clear, small change in one place with few choices. On the subagent flow, an `implement` session that only coordinates children. |
| high | Small, clear work with some choices: a bug fix with a known cause, a plan with few tasks in one subsystem. |
| xhigh | Larger work: design choices, several subsystems, a durable steering surface (skills, text that agents read), or a failure that only human review catches. |
| max | Only with a stated reason that xhigh is not enough, for example a change of permission or security semantics. |

The result is one level and a reason of one sentence that names the fact of the work that fits the
row. `max` needs a reason that states why xhigh is not enough.

**The level of `implement`.** On the inline flow, the session builds each task, so the level fits
the hardest task. On the subagent flow, the session coordinates, and each child gets its own effort
from `dispatch`, so the level fits the work of the session itself, not the tasks of the children.
The table sets the level, also when a CAP line names another effort: the rubric is calibrated for
child agents.

## The record

Write the reason to a file, with no `## ` first line, and run:

```sh
celetis --agent <host> issue <n> effort <step> <level> <reason-file>
```

`<step>` is the step that the decision is for, and `<level>` is `low`, `medium`, `high`, `xhigh`, or
`max`. The command posts a comment whose first line is `Effort: <step> <level>`, then the reason,
and changes no label. The newest decision for a step replaces each earlier one.

- **0**: the decision is on the issue.
- **2** (`usage`): a bad step, level, or reason file, and nothing is posted. Correct the arguments
  or the file, and run the command again.
- **3** (`prerequisite`): the issue is not open, so no next step starts. Decide nothing, and go on
  with the skill.
- **6** (`blocked`): a GitHub read or write failed, and nothing changed. Report the
  `issue: blocked:` line to the user, and go on with the skill: the act that moves the line still
  follows, and the next step starts with no new decision.

## The order

Run the command in the same turn as the act that moves the line of the citing skill, before that
act: `triage` before `issue <n> route`, `specify` before `issue <n> spec`, `bug` before
`issue <n> root-cause`, and `plan` before `issue <n> plan`. In a step session, the completion
watcher can end the session at its first idle moment after that act, so a decision after it can be
lost (`<plugin>/docs/procedures/stop.md`, "The act that moves the line").
