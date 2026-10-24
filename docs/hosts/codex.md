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
If no supported tool can locate or read the checkout, stop with the tool names, exact limitation,
and required file-access setup.

## Worktree, commands, and files

Bind command cwd and file paths to the exact checkout printed by `worktree`. A Codex app
worktree does not replace the lane. Keep `land` alive until its actual exit; it can take thirty
minutes. Retain the command session identifier to observe completion.

For a sandbox-blocked command, request one approved retry with the same command, arguments,
and cwd before reporting a setup stop. Use the tool's escalation mechanism for later calls
with the same access needs. A denied file read retains the Host entry stop rule.

## Dispatch

With a nonempty `codexProfiles` mapping or an explicit profile, pass fresh model and effort
evidence from the active dispatch tools through `--runtime-models`. Otherwise omit the model field when
`dispatch.model` is null. Always set `dispatch.effort` through the tool's effort field.
A refused pair is a setup stop; do not lower it or substitute another pair.

## Session recovery

For exact recovery, give the human `codex resume --no-daemon <session-id>` from the main checkout,
or reopen that exact chat in the app. An unknown session ID is a setup gap. `guide` runs neither.
