---
name: assist
description: Help the maintainer complete an issue's current block. Use when the human runs /celetis:assist or opens an assistance session from the board.
argument-hint: "#<issue number>"
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:assist — complete the current block

Input: `#<n>`. This is an interactive helper. Continuation stays with the normal runner.

## 1. Bind the checkout

Start the state reads in the main checkout. If the active binding is a linked checkout, locate
its main checkout with `git worktree list --porcelain` and bind the state reads there.

If machine work needs the existing issue checkout, find its exact path with
`git worktree list --porcelain`. Bind its operations to that path and read its applicable
`AGENTS.md` files before editing. Keep the main checkout's branch. If no issue checkout exists,
explain what is missing and wait; this helper does not create or enter a lane automatically.

## 2. Resolve and complete the block

Read and follow `<plugin>/docs/procedures/assisted-completion.md` for the current block: resolve
its requests, complete permitted machine work, ask for missing human contributions, and record
verified completion. Keep the entry's permission checks and approval procedure. When access
fails, report the exact block and setup action after the approved retry; continue independent
work. End with the confirmed remaining block or next resolver step.
