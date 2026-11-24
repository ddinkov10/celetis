# Land finishes when GitHub refuses a branch deletion

## Date

2026-11-23

## Related

- Issue: https://github.com/ddinkov10/celetis/issues/40
- The observed refusal: https://github.com/ddinkov10/celetis/issues/40#issuecomment-7110705599
- `engine/lib/workflow/worktree.ts`, `engine/lib/landing/landing.ts`, `engine/worktree.ts`

## Supersedes

- [The build step lands the change](0008-the-build-step-lands-the-change.md), in part: in "Decision", the clause "A delete that fails for another cause stops the script: the branch is still on `origin`, or `origin` does not answer the read after the delete." A delete that GitHub refuses with HTTP 403, with the branch still on `origin`, no longer stops the script.

## Context

The GitHub proxy of a Claude Code cloud session refuses each branch deletion. `land` read that
refusal as a cleanup that a new run can complete, so it exited 7 after the change was on the trunk.
Each new run failed the same way, and the local lane stayed. The removal of a pushed prototype
branch had the same failure, in `land` and in `worktree --remove`.

## Constraints and evidence

- In a cloud session on Claude Code 2.1.330, `git push origin --delete` printed
  `error: RPC failed; HTTP 403 curl 22 The requested URL returned error: 403`, and the branch stayed
  on the remote (the comment of the observed refusal above).
- The text of a `remote:` line, the reason of a `! [remote rejected]` line, and the text of an `ERR`
  packet (`fatal: remote error:`) come from the remote, so they can hold the words `HTTP 403` with no
  refusal by the proxy.
- `gh pr merge --delete-branch` of GitHub CLI v2.104.0 treats a 404 or 422 on the deletion as
  already deleted, and returns an error for each other failure:
  https://github.com/cli/cli/blob/v2.104.0/pkg/cmd/pr/merge/merge.go

## Decision

The maintainer decided on 2026-11-23 that a landed change with a leftover remote branch is complete.
One helper deletes the remote branches for `land` and `worktree --remove`:

| Push | `ls-remote` | Git stderr | Result |
| --- | --- | --- | --- |
| Exit 0 | Not read | Any | Finished |
| Failed | Failed | Any | Stop |
| Failed | No named branch | Any | Finished |
| Failed | A named branch stays | A line starts with `error: RPC failed; HTTP 403 `, or is `fatal: unable to access <url>: The requested URL returned error: 403` | Finished, with a warning for each branch that stays |
| Failed | A named branch stays | No match | Stop |

A stop after the change is on the trunk keeps exit 7 in `land`. On a refusal, the command removes the
local lane and prints one warning line that names each branch that stays.

## Constitution

This decision serves "Autonomous steps": a refusal that no retry can clear no longer creates a hold.
`land` stays the one landing path, and the suite still runs on the tip before the push.

## Alternatives considered

- **Keep exit 7, as the GitHub CLI keeps an error.** Each run in a cloud session then ends in a hold
  that no new run can clear.
- **Finish on each failed deletion.** A network failure then hides a cleanup that a new run can
  complete.
- **Delete through the REST API.** The proxy refuses that write with HTTP 403 too.

## Consequences

- A landing in a cloud session can leave its branch on the remote. A session with write access
  deletes it.
- The rule depends on the text of the Git error. When that text changes, a refusal exits 7 again,
  which is the safe result.
- A server that puts a line break inside its own error text can still imitate a refusal. The result
  is a visible warning and a leftover branch, on a change that is already on the trunk.

## Reconsider when

- The cloud proxy allows branch deletions.
- Git prints a refused deletion in another form.
