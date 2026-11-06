---
name: lesson-review
description: Use when the human requests review of pending lessons or maintenance of a selected active lesson, including promotion, merge, supersession, or retirement.
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# Review lessons

This is the optional human review. Agent curation at each landing reviews the pending queue
(`<plugin>/docs/procedures/lesson-curation.md`, "Curation at a landing"); here a person audits,
edits, supersedes, or retires a lesson, or decides a pending proposal. An approval is the
decision of the reviewer, human or agent; in this skill, it is the person's approval of the exact
snapshot below. Review grants no permission to change skills, principles, or project
instructions, push, or start a run.

## 1. Select the records

Read `<plugin>/docs/procedures/lesson-format.md`, then run
`celetis --agent <host> lesson-store read main`. Use its resolved main checkout and exact
contents. List pending candidates by ID, name, origin, date, and summary. Select the requested
candidate or active lesson. An empty queue does not block maintenance of a selected active
lesson. With neither a candidate nor a selected active lesson, report the empty selection.

For each selected record, read its full evidence, inference, diagnosis, and rule. Read related
active guidance from the same result when it can duplicate or contradict the proposal. Report
an encountered contradiction. Ask the reviewer to select the resulting rule, or to reject or
skip the proposal; incompatible rules never stay active together. For a repeated mistake, read
`<plugin>/docs/principles/encode-lessons-in-structure.md`. Keep a structural follow-up proposed
until it has separate authorization and proof; explain why judgment-dependent guidance stays
as text.

Offer the applicable decisions by `<plugin>/docs/procedures/lesson-curation.md`, "The reviewer
rules": **approve**, **edit then approve**, **merge**, **supersede**, **retire**, **reject**, or
**skip**. Use the reviewer's requested decision when already stated;
otherwise ask and wait. Skip changes nothing and calls no mutation command.

## 2. Prepare and show the exact change

Prepare the complete request defined in the lesson format, outside the lesson store. Retain the
decision record in `source`; label test inputs and inferred causes accurately. Prepare every
resulting document before preview, including each historical file. Keep all origins, distinct
incidents, uncertainty, and earlier reviews. Correct an earlier claim with an attributed
addendum in the decision record. Use the project's existing tag vocabulary.

Run `celetis --agent <host> lesson-store preview REQUEST` and save its complete JSON outside the
lesson store. Show the reviewer:

- The selected evidence and diagnosis, including uncertainty and any contradiction.
- The decision and follow-up, with the exact resulting rule and full affected lesson files.
- The exact queue changes, consumed pending records, retained history, and snapshot digest.

An unchanged file in the snapshot needs no repeated display. Every changed file does. In a
linked checkout, tell the reviewer that the approval also makes a lesson commit on its branch
when a live file changes. Ask for approval of this exact snapshot and wait. An edit, a different
outcome, or an incomplete answer requires a new preview and display before another approval
request. Earlier consent or a recurrence cannot supply this approval.

## 3. Apply the approved snapshot

`apply` writes to the checkout where the skill runs. Before apply, record the staged and
unstaged changes of that checkout. A linked checkout must be clean and on a branch: `apply`
refuses a dirty tree or a detached HEAD with exit 2. In the main checkout, record the changes of
the affected lesson paths and the unrelated index entries; if an affected path already has
unrelated edits, report the commit conflict and retain that fact for step 4. Run
`celetis --agent <host> lesson-store apply SNAPSHOT DIGEST` only with the approved snapshot file
and displayed digest. The digest checks the version; it does not prove who approved it.

Exit 3 requires a new read, preview, display, and decision after the reported stale or busy
condition is resolved. Exit 2 requires correction of the named input or of the checkout state.
Exit 6 is an access, commit, or recovery block; report it without a success claim. For an
incomplete transaction, use `celetis --agent <host> lesson-store recover` to complete only its
recorded operation, then read the store again. A successful repeat can be `unchanged`.

## 4. Commit and report

In a linked checkout, `apply` made one lesson commit on its branch for each live change (a
reject makes none), and the result lands with that lane. Report the commit.

In the main checkout, the result is a change of the working tree, and `apply` leaves the index
alone. Follow the project's existing commit and landing permissions. When a commit is permitted,
inspect the diff and commit only the approved live lesson paths with
`git commit --only -m '<subject>' -- <explicit-paths>`. Include a new approved live path in the
index only after confirming it has no unrelated edits. Keep pending paths ignored. Preserve
unrelated staged entries and confirm their blobs are unchanged. Use no unscoped commit. If an
affected path has unrelated staged or unstaged edits, or commit permission is absent, keep the
reviewed result uncommitted in the main checkout and report the paths and cause.

Report the applied, unchanged, rejected, and skipped records, active survivors, retained history,
pending count, and the commit or the uncommitted state.
