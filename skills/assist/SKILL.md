---
name: assist
description: Help the maintainer complete an issue's current block. Use when the human runs /celetis:assist or opens an assistance session from the board.
argument-hint: "#<issue number>"
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:assist — help with the current block

Input: `#<n>`. This is an interactive helper. It has no lane handoff or completion write.

## 1. Read the current state

Start the reads in the main checkout. If the active binding is a linked checkout, locate the
main checkout with `git worktree list --porcelain` and bind these reads there.

- Read `gh issue view <n> --comments`, including the issue body.
- Run `celetis --agent <host> issue <n> state`.
- Run `celetis --agent <host> next-step <n>`.

Use the resolver's current line, build, plan, and open human steps. A saved runner session or
private transcript is not needed and is not a source for the block.

When a request, clearance, or older plan needs resolution, read the ordered timeline:
`gh api --paginate 'repos/{owner}/{repo}/issues/<n>/timeline?per_page=100'`.
Read "Completing a human precondition" and "Resolving an issue's state" of
`<plugin>/docs/issue-tracker.md` at that point. Resolve the latest-plan boundary and the evidence
of each current request with those rules. Use timeline position when timestamps are equal.
An old request and its completion evidence do not carry into a new build.

If the issue is closed or the resolver has no current assistance block, say so and stop.
If a human label has no current explanation, state that the reason is missing. Ask the
maintainer for the reason and wait. Do not turn an obsolete request into the missing reason.

## 2. Explain the next action

The first useful answer gives, in order:

1. What the issue currently needs.
2. Why that action is required.
3. The next action, with the exact command and expected result when the issue defines them.

Use only the acts that the current build requires. Explain missing report or label-removal
evidence from the resolver, even when the label is absent. Give optional detail after the next
action. Ask only for information or a human decision needed to continue, and wait for the answer.

## 3. Help within the issue's scope

Perform permitted machine work for the current block. Keep the entry's permission checks and
approval procedure. If access fails, report the exact block and setup action after the approved
retry; continue independent work.

If machine work needs the existing issue checkout, find its exact path with
`git worktree list --porcelain`. Bind its operations to that path and read its applicable
`AGENTS.md` files before editing. Keep the main checkout's branch. If no issue checkout exists,
explain what is missing and wait; this helper does not create or enter a lane automatically.

Give the maintainer the report text and required label instructions when completion needs
them. Use observed results, and leave missing values for the maintainer to supply. The
maintainer posts `## Human steps done` and removes `ready-for-human`. The assistance session
never writes that report, removes the hold, invents evidence, starts or resumes the runner,
or lands the change.

After a claimed clearance, re-read the issue, resolver state, and next step before giving
later advice. Resolve any new evidence in timeline order. Explain the remaining block, or
state that no current assistance block remains. Leave continuation to the normal lane at its
actual build state.
