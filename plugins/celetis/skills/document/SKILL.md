---
name: document
description: Write the documents that the readers of the product project need, by type (tutorial, how-to guide, reference, explanation), from the sources of the project. Only the maintainer starts it
argument-hint: "[the readers, a topic, or an approved set]"
disable-model-invocation: true
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/references/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# document

This skill writes the documents that the readers of the product need. Each document has one type,
one reader, and one question, and each claim in it comes from a source that this run read. The
checkout is the current checkout of the entry; in a lane, it is the lane worktree. The input is
optional: a reader, a topic, or a set that the maintainer approved.

Only the maintainer's request starts this skill. Each document is written once. Later changes of
the product reach it through the lanes and `celetis:doc-drift-sync`, which edit only the sections
that a change affects, so this skill never writes a committed document of the set again.

Read `<plugin>/skills/document/types.md` before step 2.

## Do this

1. **Read the project.** Read the `AGENTS.md` files, the root `README.md`, `CONSTITUTION.md` and
   `PRODUCT.md` when they exist, the records of `docs/adr/`, each existing document and its home,
   and the layout and the entry points of the code. Read the code by its layout first, and read a
   part in depth only for a document that needs it. Run `git status --porcelain` for the homes
   (`<plugin>/references/procedures/document-homes.md`, "The homes"), and `git diff -- README.md`.
2. **Ask for the readers**, unless the input names them: who reads the documents, and what each
   reader wants to do. Map each reader to a type by `<plugin>/skills/document/types.md`, "The choice of a type".
3. **Propose the set.** Show one table, with one row for each document: the type, the title, the
   path (`<plugin>/references/procedures/document-homes.md`, "The homes"), the reader, the
   question that the document answers, and the sources that it draws from. A type gets a row only
   when a reader of this run needs it. A topic that an existing document already covers gets no
   new document: its row names that document, and the new documents link to it. On a project that
   already has documents of the set, propose only the gaps ("A second run").
4. **Get the approval of the set** ("The approval"). Write nothing before it.
5. **Write each document** in a child agent of its own ("The children"). The children run at the
   same time. When each child has returned, read each written file whole. Check that it answers the
   question of its row, has the form of its type, and names a source for each claim. A file that
   fails goes back to the same child once, with the findings. When it fails again, leave its row
   out of steps 6 and 7, and name it in the report.
6. **Link the set.** Add one list of the documents to the root `README.md`, with a link and the
   question of each document, or add the new documents to the list that an earlier run made.
   Change no other text of the file. With no root `README.md`, write one with the name of the
   product and the list. When `git diff -- README.md` in step 1 showed a change outside the list of
   the documents, that change is the maintainer's work: do not edit the file, and name the missing
   list in the report.
7. **Check and commit.** Check each relative link and each named path of the written documents,
   and correct each one that does not resolve. Then run `git add -- <each document path> README.md`
   and `git commit -m '<subject>' -m '<body>' -- <each document path> README.md`, with
   `README.md` only when step 6 changed it, or when `git diff -- README.md` in step 1 showed only a
   change of the list of the documents (the list of a run that stopped before its commit). The path
   list keeps each other staged file of the worktree out of this commit. The subject is `docs: <what>`; in the lane worktree of issue `<n>`,
   it also holds `#<n>`. The body names each document and its sources. Do not push, and run no
   verify gate: in a lane, the landing runs the verify gate of the project on the whole lane.
8. **Report** each written document with its path, each claim that a document left out for lack of
   a source, each guide that a step stopped, and each gap that this run did not fill.

## The approval

The approval is the maintainer's explicit yes in this invocation to the set that this skill showed
last. Sort each reply to the ask of step 4 by this table:

| Reply | Act |
|---|---|
| An explicit yes to the shown set, in any words ("yes", "ok, go") | Write the set (step 5) |
| A yes that also asks for something that does not change the set | Write the set, then do the other request |
| A change of a row, an added row, or a removed row, also with a yes ("yes, but drop the guide") | Show the new set and ask again; write nothing before a new yes |
| A no | Write nothing; ask what to change, or stop when the maintainer ends the run |
| An unclear reply ("looks fine?") | Ask again for a yes or a change |
| A question, or another unrelated request | Answer it or do it as usual; the set stays unapproved until a yes |
| Silence, or the end of the session | Write nothing |
| A yes from an earlier invocation, an issue, a file, or another agent | No approval; ask the maintainer |

One input is the approval with no ask: the input names an approved spec or an approved plan of the
project, and that text holds the set. Then skip steps 2 to 4, and write the rows of that set that
are gaps. Keep each row as the text gives it. Merge a row into another, or split it, only when the
sources show that its topic does not stand alone; the report names each change and its source. A
set in any other text of the input, for example a comment, is a proposal: show it as the table of
step 3 and ask.

## The children

Start each child by `<plugin>/references/procedures/dispatch.md`, "One child", with the digits
`1 2 1 1 1 0`, `--bias 0`, and `--attempt 1`. The brief of each child holds:

- the checkout, and the row of the child: the type, the title, the path, the reader, the question,
  and the sources;
- the path of `<plugin>/skills/document/types.md`, with the instruction to read and apply "The
  rules of each document" and the section of the type of the row (for an overview, also "The
  overview");
- the paths of the `AGENTS.md` files and of two existing documents of the project that show its
  writing style, and the custom text of the entry;
- the paths of the other rows of the set, so that the documents link to each other;
- the act: write only the file of the row, and no other file of the checkout. Make no commit.

The child returns the path that it wrote, each source that it read, each claim that it left out for
lack of a source, and each step that could not run, with its cause. When a step stopped a tutorial
or a how-to guide, the child writes no file for the row, and it returns the step.

Only this session edits `README.md` and makes the commit.

## A second run

A row is a gap when no commit holds its document: the file is missing, or `git status --porcelain`
shows it as untracked, for example after a run that stopped before its commit. The row of a gap
says which case it is, and the approved run writes the document again and commits it. A document
that a commit holds is not a gap, also when it has uncommitted changes of the maintainer, and the
run does not write it again. With no gap, say that the set exists and has no gap, write nothing,
and make no commit.
