# The constitution check

The constitution check compares a design decision with `CONSTITUTION.md` of the product project:
its ranked goals, its hard limits, and its non-goals. `specify`, `plan`, `bug`, and
`record-architecture-decisions` cite this procedure before they decide; the decision document (the
spec, the plan, the `## Root cause` report, or the ADR) holds the result.

## The read

Read `CONSTITUTION.md` at the root of the checkout of the step, whole, in one read, when it exists.
In a lane, that checkout is the lane worktree. With no file, the step does no check and writes no
section.

When the file has no `## Goals`, `## Hard limits`, or `## Amendments` heading, a broken
constitution cannot steer the decision. Report the path and each missing heading to the maintainer,
and stop before the decision document (`<plugin>/references/procedures/stop.md`, "The two modes").
The act that lets the step go on is the maintainer's `/celetis:constitution` in that checkout.

## The section

The decision document holds this section:

```markdown
## Constitution

Read: `CONSTITUTION.md`, amended YYYY-MM-DD.

- Serves: <goal number and name>: <how the decision serves it>.
- Tension: <goal number and name>: <what the decision costs that goal, and why the higher goal wins>.
- Hard limits and non-goals: none touched. | <the limit or non-goal, and the maintainer's answer>.
```

The date of the `Read:` line is the date of the last line of `## Amendments`. Name a goal by its
number and its name, because a later amendment can change the order. List only the goals that the
decision serves or costs; each other goal gets no line. Write a `Tension` line only for a tension.

Sort the relation of the decision to each goal, hard limit, and non-goal into one outcome:

| Outcome | When | Act |
|---|---|---|
| Serves | The decision advances a goal | A `Serves` line for that goal |
| Tension | The decision serves a higher goal at a cost to a lower goal | A `Tension` line for the lower goal ("A tension between goals") |
| Conflict | The decision breaks a hard limit, enters a non-goal, or serves a lower goal at a cost to a higher goal | Stop and ask ("A conflict") |
| Untouched | The decision does not bear on it | No line; with no limit and no non-goal touched, the last line is `Hard limits and non-goals: none touched.` |

## A tension between goals

When the decision serves a higher goal at a cost to a lower goal, the `Tension` line records the
cost and why the higher goal wins. The normal approval of the decision document covers it, with no
question of its own.

## A conflict

A conflict is a decision that breaks a hard limit, enters a non-goal, or serves a lower goal at a
cost to a higher goal. For each decision that the decision document records, also an option or an
approach that the maintainer picks, stop before the decision document is written, or, when the
conflict shows while the step writes it, before the document is final. A pick of the maintainer
before this question does not answer it; only a reply to the question does (the table below). Ask
the maintainer one question that names the decision, the goal, limit, or non-goal by its number or
its name, and the break. The question has two choices: change
the design, or amend the constitution first with `/celetis:constitution`. The question is a product
decision of the maintainer (`<plugin>/references/procedures/stop.md`, "The check before a stop").
The approval of the decision document does not answer it.

Only the maintainer starts `/celetis:constitution`, and only the approval in that invocation changes
`CONSTITUTION.md`. The step reads the file; it never writes it and never invokes the skill.

| Reply | Act |
|---|---|
| Change the design, in any words ("take approach B", "drop the cache") | Revise the design, and run the check again on it |
| Amend first, in any words ("I will change the constitution"), in an interactive session | Wait for the amendment; then read the file again ("The read") and run the check again |
| Amend first, in a step session | Hand the stop to the issue (`<plugin>/references/procedures/stop.md`, "A stop in a step session"); the act outside the session is the maintainer's `/celetis:constitution` in the lane worktree |
| One choice and another request ("change the design, and rename the flag") | Do the act of the choice, then the other request as usual |
| A request that the step amend the file or invoke the skill | Say that only the maintainer starts `/celetis:constitution`, and ask again |
| Both choices, an unclear reply, or a reply that picks no choice | Ask again for one choice |
| An unrelated request | Do it as usual; the question stays open, and the document stays not final |

After "change the design", the last line of the section records the conflict, the answer, and its
source, for each kind of conflict; for a conflict of goal order, it names the higher goal. After an
amendment, the answer is the amendment line that settled the conflict.

## Where an amendment lands

The maintainer runs `/celetis:constitution` in the lane worktree of the issue that found the
conflict, live or through an `assist` session. The amendment commit goes onto that lane branch and
lands together with the change that needs it, so one review sees both. The step reads
`CONSTITUTION.md` of its own lane checkout, so it sees the amendment at once. After the stop, the
next run of the same step reads the file again and writes its `## Constitution` section again.

The reason: an amendment on a separate issue would land later than the stopped change needs it, and
the lane worktree would read the old text until its next update.
