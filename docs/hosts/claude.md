# Claude Code operations

Read through [Host entry](entry.md).

## Skills and custom text

Invoke skills with the Skill tool and pass the invocation input as arguments.

The native hook in `<plugin>/engine/hooks/entry.js` supplies startup reads and the current entry's
config result. Apply that entry before any response. Missing native entry data stops for
hook setup; do not replace the hook's reads with another access path.

Accept `file_unchanged` only after this entry's fresh request and a prior complete native Read
at the same path in the same agent loop. The prior content must remain available in context.
A seeded, partial, denied, or unavailable result stops entry.

## Worktree and commands

Enter the exact checkout printed by `worktree` with `EnterWorktree`, unless already there.
Before landing or removal, use `ExitWorktree` with keep and verify the main checkout.

Run `land` in background Bash with `run_in_background: true` and `timeout: 3600000`.
Wait for actual completion; the checks can take thirty minutes.

## Session recovery

Give the human `claude --resume '#<n> <step>'` from the main checkout. `guide` runs nothing.
