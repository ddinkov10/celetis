# The lane worktree

The entry into the worktree of an issue, which each step that works on the issue's branch runs
first (`bug`, `chore`, `feature`, `hotfix`, `specify`, `plan`, `implement`), a conflict with the
trunk at the entry, the return to the main checkout, and the removal in the cases with no landing
by the script.

## The entry

Run `celetis --agent <host> worktree <n>` with a 10-minute timeout, and wait for it to exit: a
new worktree runs the worktree setup of the project. The script re-enters the issue's branch and
brings it up to the trunk, or creates `<prefix>/<n>-<slug>` from the title when the issue has
none, with the prefix of the lane label (`feat`, `fix`, `hotfix`, `chore`). Exit 4 is a conflict
with the trunk: follow "A conflict with the trunk" below. When it refuses with another status, show
the user its message and stop (`<plugin>/docs/issue-tracker.md`, "Branches, PRs, merge", gives
each refusal).

Bind the exact path that it prints, also on exit 4, to every later command, file operation,
instruction read, and child task: every later step runs there, and the main checkout never changes
branch. Reuse the binding when the session is already in that worktree, as it is after a
same-session handoff. Read the applicable `AGENTS.md` files of that checkout before editing. Keep
the script's branch and worktree: only `celetis --agent <host> land` and the removal below remove
a lane worktree, so a session-end offer to remove it gets no.

## A conflict with the trunk

On exit 4, the merge of the trunk into the lane branch stopped on a conflict. The script aborted
the merge: the branch is at its tip, the tree is clean, and no merge is in progress. Its last line
names the trunk, the branch, and the checkout. The session resolves the conflict itself: it is
integration work, not a task of the plan, and no stop. A skill can name another fix rule for a
conflict after its final review. In order:

1. Enter the printed checkout (the part of the host below).
2. Read the other side: the trunk commits after the merge base (`git log HEAD..origin/<trunk>`),
   and each issue that their subjects name (`gh issue view <m>`).
3. Merge `origin/<trunk>` with the subject `Merge origin/<trunk> into <branch> (#<n>)`. Resolve
   each conflict, and keep the behavior of both sides. Resolve a conflict on a path of
   `docs/lessons/` by `<plugin>/docs/procedures/lesson-curation.md`, "Lesson conflicts".
4. Commit the merge.
5. Run `celetis --agent <host> worktree <n>` again: it completes the entry and the worktree setup.
   Another exit 4 starts again at step 2.
6. Run the verify gate of the project, and renew the affected runtime evidence
   (`<plugin>/docs/procedures/runtime-verification.md`, "Evidence lifetime").

When the two sides change one behavior in ways that exclude each other, and the spec, the plan,
and the other issue do not settle the choice, ask a live question with the two behaviors
(`<plugin>/docs/procedures/stop.md`, "The check before a stop", class 2).

## Before a landing or a removal

Return to the main checkout, keeping the lane, and check that the session is in the main
checkout before `land` or `worktree --remove`.

## The removal

When the issue ends with no landing by the script (`specify` closes it as `wontfix`, or makes it
an epic), run `celetis --agent <host> worktree --remove <n>` from the main checkout. It deletes the
worktree, the lane branch, and the issue's `prototype/<n>-*` branches. The script refuses → show
the user its message and keep the worktree.

## Claude Code

Enter the exact printed checkout with `EnterWorktree`, unless already there. Before a landing or
a removal, use `ExitWorktree` with keep, then verify the main checkout.

## Codex

Bind the command cwd and each file path to the exact printed checkout. A Codex app worktree does
not replace the lane. `worktree` needs network on each entry: it reads the trunk from GitHub and
fetches it from `origin`. In a sandbox with no network, request one approved retry with the same
command, arguments, and cwd before reporting a setup stop.
