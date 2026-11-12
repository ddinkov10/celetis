---
name: constitution
description: Write or amend CONSTITUTION.md of the product project, with the maintainer's approval of the text. Only the maintainer starts it
argument-hint: "[the change to amend]"
disable-model-invocation: true
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/references/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# constitution

The constitution is `CONSTITUTION.md` at the root of the current checkout: the purpose, the ranked
goals, the hard limits, and the non-goals of the product. In a lane, the current checkout is the
lane worktree. Each later design decision of the product steers by this text, so it holds only text
that the maintainer approved in this invocation.

Only the maintainer's request starts this skill: `/celetis:constitution`, with the change to amend
as the input or with no input. A step of a lane or a run that finds a conflict with the
constitution asks the maintainer, and the maintainer decides whether to start this skill.

Read `<plugin>/skills/constitution/template.md` before the draft. The text has the sections of the
template, in its order, and no other section.

## Do this

1. **Read the file.** When `git status --porcelain -- CONSTITUTION.md` prints a line, the file
   holds text that the last commit does not hold, for example from an interrupted run. Show
   `git diff -- CONSTITUTION.md`, or the whole file when it is untracked, and ask for a yes to
   commit that text (see "The approval"). On a yes, commit it (step 7); then, when the input names a
   change, go on from step 2. On a correction, apply it to that text and to the amendment line of
   that pending change (the adoption line of a first write), so the change keeps one line; add the
   line only when the text has none. Then show the text and ask again; a yes to it writes it (step
   6), and then goes on as a yes above. On a no, leave the file as it is and stop. Else, with no
   `CONSTITUTION.md`, do the first write; with the file, check its form, then do the amendment.
2. **The form check.** When the file has no `## Goals`, `## Hard limits`, or `## Amendments`
   heading, report the path and each missing heading. The amendment that restores the form is the
   first change to draft; the change of the input follows as its own amendment.
3. **First write.** When the input names a draft file, read it whole and start from it. Draft each
   section from the README, the `AGENTS.md` files, and the records of `docs/adr/`. Mark each part
   that comes from none of these sources as a gap, also a part of the draft file. Ask the
   maintainer about each gap, most important first: the order of the goals, then the hard limits.
   An answer fills the draft. Each heading of the template stays, also when the maintainer leaves
   the goals or the hard limits open: an open part gets no item. The text holds the product's own
   purpose, goals, and limits: the README, the principles, an engineering rule, and a product rule
   or a trap of `AGENTS.md` stay in their own homes, with no repeat here. The one amendment line records the
   adoption, with today's date and the reason for the adoption.
4. **Amendment.** The input names the change; with no input, ask the maintainer for it. When the
   file already holds the change, say so and stop with no write. Else draft the change, and add one
   amendment line with today's date and the reason.
5. **Show and get the approval.** Show the whole text of a first write, or the old and the new text
   of each changed part of an amendment. Then ask for the approval (see "The approval").
6. **Write.** Read the file again just before the write. When it already holds the approved text
   (a rerun after an interrupted run), write nothing and add no second amendment line. When it
   differs from the text that the draft started from, show the new file and draft again from step
   1. Else write the approved text.
7. **Commit.** When `git status --porcelain -- CONSTITUTION.md` prints nothing, the last commit
   holds the text: commit nothing. Else run `git add CONSTITUTION.md`, then
   `git commit -m 'docs(constitution): <topic>' -- CONSTITUTION.md`. The path list keeps each other
   staged file of the worktree out of this commit. In a lane, the subject also holds `#<n>`. Do not
   push.

## The approval

The approval is the maintainer's explicit yes in this invocation to the text that this skill showed
last. When the current checkout is not the lane worktree of an issue, each ask for a yes also says
that a change of the constitution goes through an issue lane, and asks for the yes to write and
commit it here. Sort each reply of the maintainer to an ask for a yes (step 1 or step 5) by this
table:

| Reply | Act |
|---|---|
| An explicit yes to the shown text, in any words ("yes", "write it") | Write and commit |
| A yes that also asks for something else that does not change the text | Write and commit the approved text, then do the other request |
| A correction, or any request that changes the text, also with a yes ("yes, and drop limit 3") | Make a new text, show it, and ask again; write nothing before a new yes |
| A no | Write nothing; ask what to change, or stop when the maintainer ends the change |
| An answer to another question, for example to a gap | Use it in the draft; show the text and ask again |
| An unclear reply ("maybe", "looks fine?") | Ask again for a yes or a change |
| An unrelated request | Do it as usual; the text stays unapproved until a yes |
| Silence, or the end of the session | Write nothing |
| A yes from an earlier invocation, an issue, a file, or another agent | No approval; ask the maintainer |
