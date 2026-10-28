# The epic

The scope check of a feature. `feature` runs it at its start, and `specify` runs it in place of
the upstream one-at-a-time brainstorm of several independent projects.

## The scope check

Does the idea span several independent features: an epic, too big for one
specify → plan → implement pass? One feature: continue the step. Several: agree the list of
children with the user, then make the issue an epic.

## Make the issue an epic

1. Make `epic` its only lane label: `celetis --agent <host> issue <n> epic`, which adds `epic`
   and removes `enhancement`.
2. Create one sub-issue per feature with the Epics recipe of `<plugin>/docs/issue-tracker.md`,
   "Epics" (label `enhancement`, a one-line intent each).
3. Report the children, and stop. Each child runs its own `/celetis:feature #<child>`.

The relabel moves the line (`<plugin>/docs/procedures/stop.md`, "The act that moves the line").
Its later acts come in its turn: the sub-issues, each later act that the citing skill names, and
then the report.
