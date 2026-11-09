# The epic

The scope check of a feature. `feature` runs it at its start, and `specify` runs it in place of
the upstream one-at-a-time brainstorm of several independent projects.

## The scope check

Does the idea span several independent features: an epic, too big for one
specify → plan → implement pass? One feature: continue the step. Several: agree the children and
the parent's acceptance with the maintainer, then make the issue an epic.

Read `<plugin>/docs/issue-tracker.md`, "Epic acceptance declaration". Agree either an independent
rationale or combined scenarios with their criterion, contributing children, preparation, target,
expected behavior, timing, both loading links, and independent oracle. Keep each part of a
compound outcome. A missing declaration stays unresolved; a question opt-out selects no mode.
Record the maintainer's decision and source before publishing or changing acceptance meaning.

## Make the issue an epic

1. Read the current parent body and complete child list. On re-entry, inspect and reuse existing
   children and links before creating anything.
2. Create and link the agreed missing children with the recipe in `<plugin>/docs/issue-tracker.md`,
   "Epics" (a one-line intent each). Use their actual full URLs in combined
   scenarios. Each child continues to read the current parent body during design.
3. Prepare the complete parent body in a file. Preserve text outside the acceptance section and
   use the agreed declaration. Record the decision and child links before the final act.
4. Run `celetis --agent <host> issue <n> epic <file>` as the final state-moving act. Follow
   "Epic completion and repair" in `<plugin>/docs/issue-tracker.md` for a partial write.
5. Report the children and acceptance mode, and stop. Each child runs its own feature lane.

The definition publication moves the line (`<plugin>/docs/procedures/stop.md`, "The act that
moves the line"). Only each later act that the citing skill names, and the report, follow it in
the same turn. This procedure also resolves scope for an existing unresolved epic; it does not
start a parent run or replace explicit acceptance.
