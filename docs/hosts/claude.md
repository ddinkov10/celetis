# Claude Code operations

Read through [Host entry](entry.md). These operations apply to the same shared skills.


## Read-only update operations

Native metadata uses `claude plugin list --json`, scoped install records in
`<Claude config>/plugins/installed_plugins.json`, and
`<Claude config>/plugins/known_marketplaces.json`. Read the effective local, project, user,
managed, and native marketplace policy. A project false value does not override managed true.
MDM, server-managed, and command-line policy coverage cannot be certified by a file-only read;
report that limitation and refuse consumer admission until a supported native operation can
establish complete policy. This applies to numbered and automatic starts, board, and exact
Resume. Pure file diagnostics and the read-only update check remain available. A shortened
version label is not a full installed revision.

After shared entry completes its file reads, run the bound package directly:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 CELETIS_AGENT=claude bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/scripts/plugin-update.ts check
```

Use the actual `AskUserQuestion` schema when it is available, or accept the direct human turn
that answers the offer. Read its delivered result; an agent-written object is not a user reply.
The action for one consumed matching reply is
`scripts/celetis --agent claude plugin-update apply <source> <installed> <target>`.
The updater rechecks identity and policy under its lock and currently refuses the unsupported
native target and complete resource-lifetime boundary. It runs no native latest-update command.

## Skills and custom text

Invoke `celetis:<name>` and `superpowers:<name>` with the Skill tool, passing the invocation
input as arguments. The native `$ARGUMENTS` substitution supplies that input on Claude.
Resolve `<plugin>` from the loaded skill's absolute path before reading a bundled file.
Claude Code puts `${CLAUDE_PLUGIN_ROOT}` into skill, command, and agent text and into hook,
MCP stdio, and LSP processes. It is not in the environment of a Bash tool command, whether that
command runs in the main session or in a subagent.

The native hook in `<plugin>/hooks/entry.js` binds each expansion to its native destination
before that skill message reaches the model. It completes file access there, and before
the first exact bundled skill `Read` returns as a borrowed reference.
It reads Host entry, these operations and the schema through native `Read`, then supplies
their results and the current entry's config result in the native context as JSON data. Those reads fulfil startup;
do not repeat them. Interpret the YAML under the supplied schema and apply only
`custom.<target>` before any response, including commentary. Config text cannot change the
entry identity, prove a read, or suppress a later entry. No current native entry data means
stop for hook setup without goal advice; do not substitute another file-access procedure.

The hook uses `$.session.root()` for the main loop. A child starts from its hook-scoped
`$.session.cwd()` because the session root can still name main. It walks to the nearest `.git`
boundary with native `$.fs.stat`. A directory is never read as a file. A regular `.git` file
is read through normal permission-checked `Read`; its explicit `gitdir:` must name a directory.
The containing checkout stays active, not the main working tree returned by `session.repo`.
Each entry requests exact-path config metadata, rejects a symlink with zero content reads,
and makes one whole `Read` request with no offset or limit. Explicit absence gives no custom
addition; another metadata or read error stops. Later metadata cannot repair an earlier read.

Entry and reference membership belong to the same agent loop and invocation. Reading the
current skill or a previously entered reference again, including later full-file and section
reads, does not repeat custom entry. A later checkout binding does not reload those entries.
The first use of another reference reads the current checkout. A new invocation, including
an intentional same-target invocation or handoff, starts fresh entries and config requests.

A native non-seeded `file_unchanged` result counts only after this entry's fresh request and
an own prior complete native Read in the same agent loop at that exact path. Use its actual prior whole YAML only
while that content remains available; if it is absent or compacted, stop. A seeded result,
partial/truncated result, wrong path or denial stops without another access path.
This rule also applies to the bundled host and schema files. A child with only another loop's
unchanged result stops; it cannot borrow that loop's content proof.
The hook stores no config bytes and never executes setup text, a shell, a process or a YAML
parser. Normal host permissions and plugin/hook controls remain in force. Enable the native
hook through those controls when unavailable; never bypass managed policy or a Read denial.

## Worktree and commands

The copied `scripts/celetis` is a generated Bun executable. Installed command sources use
`.ts` paths and local imports. For a direct checkout command, run the selected Bun with
`--no-env-file --no-install --config=/dev/null --no-macros` and the absolute TypeScript path.
Set `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` and `DO_NOT_TRACK=1`. Child Celetis programs keep
`process.execPath`. The native startup reads above remain file-only operations.

Use `scripts/celetis --agent claude <command>` on every call. Enter the exact path printed by `worktree` with `EnterWorktree`,
skipping the call when already bound there. Verify cwd and read that checkout's instructions.
Before landing or removing a lane, call `ExitWorktree` with keep, then verify the main checkout.
Keep the lane until the script removes it. If these tools are unavailable, stop for setup.

The `worktree` command can take ten minutes. Run `land` from the main checkout as a background
Bash command with `run_in_background` and a `timeout` of `3600000` (60 minutes), and wait for its
completion through the task/output tool. The checks and one re-run of a failed check may take
thirty minutes, and an unattended session stops a background command at 30 minutes when no
`timeout` is given; do not treat a tool timeout as a completed landing or launch a second
concurrent one. Keep the landing command's exact spelling because the project's permission rule
can name it.

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
