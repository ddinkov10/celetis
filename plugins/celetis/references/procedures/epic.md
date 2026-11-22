# The epic

The scope check of a feature. `feature` runs it at its start, and `specify` runs it in place of
the upstream one-at-a-time brainstorm of several independent projects, and again after the lock of
a whole-app skeleton.

## The scope check

Does the idea span several independent features: an epic, too big for one
specify → plan → implement pass? One feature: continue the step. Several: agree the children and
the parent's acceptance with the maintainer, then make the issue an epic.

Read `<plugin>/docs/issue-tracker.md`, "Epic acceptance declaration". Agree either an independent
rationale or combined scenarios with their criterion, contributing children, preparation, target,
expected behavior, timing, both loading links, and independent oracle. Keep each part of a
compound outcome. A missing declaration stays unresolved; a question opt-out selects no mode.
Record the maintainer's decision and source before publishing or changing acceptance meaning.

## A whole-app revision

A revision of the layout of a whole web app (`<plugin>/references/procedures/ui.md`, "The whole
app") is one feature at the start of the lane, because the split needs the skeleton. After the
maintainer locks the skeleton and the look decision ends with step 10 of "The procedure" of that
file, run the scope check again, with the skeleton:

- **One change** when the skeleton and all its screens can land as one change: continue the
  step. The design review of the plan covers each key of the inventory.
- **An epic** when the screens can land one by one. The first child is the shell. Each other
  child is one screen or one group of screens. The parent body holds the `## Diagnosis` section
  and the `## Prototype` record of the locked skeleton, as decisions that bind each child. Agree
  the acceptance of the parent as for each epic.

## Make the issue an epic

1. Read the current parent body and complete child list. On re-entry, inspect and reuse existing
   children and links before creating anything.
2. Create and link the agreed missing children with the recipe in "The children" (a one-line
   intent each). Use their actual full URLs in combined scenarios. Each child continues to read
   the current parent body during design.
3. Prepare the complete parent body in a file. Preserve text outside the acceptance section and
   use the agreed declaration. Record the decision and child links before the final act.
4. Run `celetis --agent <host> issue <n> epic <file>` as the final state-moving act. Follow
   "A partial write" for a partial write.
5. Report the children and acceptance mode, and stop. Each child runs its own feature lane.

The definition publication moves the line (`<plugin>/references/procedures/stop.md`, "The act that
moves the line"). Only each later act that the citing skill names, and the report, follow it in
the same turn. This procedure also resolves scope for an existing unresolved epic; it does not
start a parent run or replace explicit acceptance.

## The children

Make each child from a one-line intent file whose first line is `# Intent: <title>`. `<child>`
is the key at the end of the URL that `issue create` prints
(`<plugin>/references/procedures/entry.md`, "The contract", **Tracker.**). The route sets the lane
label of the child:

```bash
celetis --agent <host> issue create <child intent>
celetis --agent <host> issue <epic> link <child>
celetis --agent <host> issue <child> route feature
```

`link` exits 3 for a child with another parent, a closed issue, or a pull request: report the
line and stop. Exit 6: report the line and stop; when it says that the link can exist, run `link`
again (it writes nothing when the link exists) or read `issue <child> view` before another write.

- **List all children**: the `children` of `celetis --agent <host> issue <epic> view` (each has `key`, `title`, `url`, `state`).
- **Find a child's parent**: the `parent` of `celetis --agent <host> issue <n> view` (the key, `null` when standalone).

## A partial write

Follow this section when `celetis --agent <host> issue <n> epic <file>` or
`celetis --agent <host> issue <n> complete-epic <file>` exits 6: an access or write failure.

- For a partial definition write, inspect the actual body and labels.
- For an uncertain report or close, inspect current history and state before retrying.
- A published record with an open parent is partial completion.
- Repair the specific access or write failure, retain valid evidence, and re-enter explicit
  acceptance for fresh checks.
- Never bypass the guard with a direct close, blindly repeat an uncertain comment, or claim that
  an unacknowledged write failed to reach the tracker.
- Existing human-repair requirements remain binding.
