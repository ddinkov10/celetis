# Codex operations

Read through [Host entry](entry.md).

## Skills and custom text

Invoke skills through their advertised `SKILL.md` paths and follow them with the supplied input.
For `guide` advice, use this prompt with the actual skill name:
`Use the celetis:<name> skill for <input>. Complete its Host entry startup reads before any response, including commentary.`

Use the active checkout binding even when the tool process cwd differs. Locate its Git boundary
and read `.celetis.yaml` through available supported file access, including shell commands,
dedicated readers, or runtime file APIs. Inspect the active tool catalog and use its actual schema.
A dedicated reader is not required. The existing configuration reader is also supported.
Make a fresh whole-file request for each entry. A programmatic operation's validated values do
not complete this request. Optional absence gives no custom text; required runtime configuration
has a separate full-validation boundary. A denied request ends entry before any alternate read.
If no supported tool can locate or read the checkout, stop with the tool names, exact limitation,
and required file-access setup.

## Worktree, commands, and files

Bind command cwd and file paths to the exact checkout printed by `worktree`. A Codex app
worktree does not replace the lane. Keep `land` alive until its actual exit; it can take thirty
minutes. Retain the command session identifier to observe completion.

For a sandbox-blocked command, request one approved retry with the same command, arguments,
and cwd before reporting a setup stop. Use the tool's escalation mechanism for later calls
with the same access needs. A denied file read retains the Host entry stop rule.

Like `land`, `issue` needs network: it reads the issue from GitHub before any write. In a sandbox
with no network, it exits 6 with `issue: blocked: cannot read #<n> from GitHub`. That is a
sandbox block, not a GitHub that does not answer: request the approved retry first. The approved
retry is the path for `issue`. The personal `issue` rule of `<plugin>/README.md`, "Personal
landing permission", is optional: it skips the review of each call, so a session can post any
file that it can read on the issue. Add it only when Codex cannot ask for approval, for example
with the approval policy `never`.

## Dispatch

With a nonempty `codexProfiles` mapping or an explicit profile, pass fresh model and effort
evidence from the active dispatch tools through `--runtime-models`. Otherwise omit the model field when
`dispatch.model` is null. Always set `dispatch.effort` through the tool's effort field.
A refused pair is a setup stop; do not lower it or substitute another pair.

## Session recovery

For exact recovery, give the human `codex resume --no-daemon <session-id>` from the main checkout,
or reopen that exact chat in the app. An unknown session ID is a setup gap. `guide` runs neither.
