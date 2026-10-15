# Host entry

The startup file reads are in "Bind the bundle and the host" and "Enter the skill once".
Complete them before any step or response, including commentary or an announcement, on each
invocation and same-session handoff. The later sections apply when the skill reaches that
operation. This file changes host operations, not the lane's order, decisions, or completion criteria.

## Bind the bundle and the host

Resolve this link from the absolute path of the loaded `skills/<name>/SKILL.md`, not from
shell cwd. Its package directory is `<plugin>` in the shared text. Read files cited as
`<plugin>/...` from that directory; this notation is not an environment variable. Relative
Markdown links in bundled references resolve from the containing file. Other unprefixed paths
belong to the product project.

Use the host actually running this session: [Claude Code](claude.md) or [Codex](codex.md).
Read that reference and inspect its returned tool result before constructing any dependent host operation. If the loaded skill path is unavailable, `guide`
reports that setup gap. For another skill, obtain
the enabled installation with `scripts/celetis --host claude root` or
`scripts/celetis --host codex root`, matching the running host. A missing or ambiguous installation
is a setup stop; do not guess a cache path or borrow the other host's install.

In shared procedures, `scripts/celetis <command>` is shorthand. On **every call**, write
`scripts/celetis --host claude <command>` on Claude or
`scripts/celetis --host codex <command>` on Codex, including checklists and retry messages.
The host flag precedes the sub-command. The bare launcher remains the project-default command
for human terminal and board use; skill execution selects the actual host explicitly. A shell's
exports and cwd do not carry into the next tool call.

## Enter the skill once

The invocation input is the text or issue number supplied by the human or calling skill. Keep
that input across a handoff; it is not a shell variable. Follow the host's invocation mechanism
for both `celetis:<name>` and `superpowers:<name>`. When a required Superpowers skill is missing,
stop with its name and the setup action; do not replace its procedure from memory.

At entry, locate the active product checkout root from the session context and the host's
file-access operations, including a linked worktree's `.git` file. Read the whole optional
`.claude/celetis-flow/custom/<name>.md` there once before any step or answer. Apply it as an
addition to the skill. An explicit missing file or no checkout is harmless. Request required
file access through the normal approval flow. Denied access or another read error stops the
entry with a report of the block; do not switch tools or use a shell to bypass it.
Track the skill, its checkout, and its invocation in session context: a same-session
handoff creates a new entry for the target skill; rereading a section of the current invocation
or binding its later lane worktree does not load its custom text again.

When a skill borrows another skill's rules by reading its file, enter that reference and load
its custom part once on first use. Reuse that entry for later sections; reading rules does not
invoke the borrowed procedure. This includes `chore` borrowing `implement` and `lesson-review`
borrowing `lesson`. An intentional new invocation enters again.

`guide` is human-invoked on both hosts. It uses file-access operations for its entry and returns
the matching advice. It runs no workflow command and invokes no other skill. With no checkout,
it gives the common advice without a custom part.

## Bind the project work

Keep the main checkout path and the active checkout path distinct. When a lane runs
`scripts/celetis worktree <n>`, wait for its successful completion and bind the **exact absolute
path it prints** using the host reference. Keep the script's branch and checkout; its existing
`.claude/worktrees/` paths and `.claude/celetis-flow/` configuration are shared by both hosts.

After binding, read `AGENTS.md` in that checkout and the applicable ancestor and subsystem
`AGENTS.md` files before editing. Bind every command, file read, file edit, and child brief to
that checkout. A child receives its absolute path, the relevant instructions, and its task;
an isolated child does not inherit the parent's context. Before landing or removing a lane,
return to the main checkout using the host reference. Re-enter the printed lane path for repairs.

For scratch output, use a temporary directory created in the active shell with
`mktemp -d "${TMPDIR:-/tmp}/celetis.XXXXXX"`, and retain its printed absolute path in session
context. Pass that path explicitly to later calls. Write issue bodies and command output to
files and use `--body-file`; shell quoting must not interpret the text.

## Dispatch and stop

Before every child dispatch, follow [capability binding](../capability.md) and the selected
host's dispatch section. Preserve the parent model. Apply both resolved child model and effort;
a CAP line alone does not set either. A retry or scoped re-review keeps the child identity.
When an escalated pair cannot be applied to that identity, stop with the requested pair, child
identity, actual tool limitation, and failure trail. Do not drop escalation or call a replacement
the same child. A fresh child is permitted only when the procedure explicitly calls for one.

A missing required host tool, denied path, unavailable pair, or unsupported host operation is a setup
stop. In a runner step, use rule 4 of `step-prompt.md` of the plugin `celetis` to hand it to the
issue; by hand, show the exact limitation and the setup action. Permission refusals in Verify
follow rule 5. A skill that says to ask for a human decision still asks in the session; this
includes authorization for a destructive act. Continue independent checks; an unrun scenario
has no PASS.
