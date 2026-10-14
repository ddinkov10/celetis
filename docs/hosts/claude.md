# Claude Code operations

Read through [Host entry](entry.md). These operations apply to the same shared skills.

## Skills and custom text

Invoke `celetis:<name>` and `superpowers:<name>` with the Skill tool, passing the invocation
input as arguments. The native `$ARGUMENTS` substitution supplies that input on Claude.
The bundle may be identified by `CLAUDE_PLUGIN_ROOT`; the loaded skill's absolute path also
identifies it. Resolve `<plugin>` before reading a bundled file.

Use `Read` for the custom file and `Glob` or `Grep` to locate the active checkout root. These
file tools also serve borrowed skill references. Loading a skill runs no custom shell command;
the one read at Host entry supplies the custom text. Keep this read on the native file tools,
including when Bash is unavailable or a shell permission rule blocks `cat` or `git`.

## Worktree and commands

Use `scripts/celetis --host claude <command>` on every call. Enter the exact path printed by `worktree` with `EnterWorktree`,
skipping the call when already bound there. Verify cwd and read that checkout's instructions.
Before landing or removing a lane, call `ExitWorktree` with keep, then verify the main checkout.
Keep the lane until the script removes it. If these tools are unavailable, stop for setup.

The `worktree` command can take ten minutes. Run `land` from the main checkout as a background
Bash command and wait for its completion through the task/output tool. Checks may take fifteen
minutes; do not treat a tool timeout as a completed landing or launch a second concurrent one.
Keep the landing command's exact spelling because the project's permission rule can name it.

## Dispatch

Use `capscore --json`, the published digits and explicit bias, and `--reviewer` for a reviewer.
Apply `dispatch.model` through the actual Agent model parameter and `dispatch.effort` through
the supported effort control; put `line` first in the prompt. Check the current tool schema:
if effort is conveyed only by a CAP instruction, it is a recommendation, not proof of the
applied effort. Stop for setup when the resolved pair cannot be set. Resume the existing Agent
identity for repairs and scoped re-review, applying any newly resolved pair with supported
controls. If resume cannot change the required pair, use the stop in Host entry.

A child brief includes the exact checkout, relevant `AGENTS.md` instructions, its task and
constraints, required skill paths and custom additions, test commands, and return contract.
Keep the upstream implementer/reviewer roles and the comment/commit rules.

## Lookup and session recovery

For external facts, use installed docs, then available Context7 tools, then `WebSearch` and
`WebFetch` on primary sources. Use `ToolSearch` for deferred tools when it is available. A missing
lookup tool leaves an unsettled fact under the shared lookup procedure.

To reopen a named runner session, the human runs `claude --resume '#<n> <step>'` from the main
checkout. `guide` only returns that command.
