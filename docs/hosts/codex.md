# Codex operations

Read through [Host entry](entry.md). The skill procedure and project paths are shared with Claude.

## Skills and custom text

Use the installed skill's advertised name and path from the active Codex skill catalog. A human
can select it or explicitly name it; `/celetis:<name>` in the shared text identifies that same
skill, not a requirement for a Claude slash-command tool. To invoke another skill, load its
`SKILL.md` through the available file tool and follow it with the supplied input. Load required
Superpowers skills from their own enabled installation and translate their host operations by
this reference. Do not assume a Skill tool or `$ARGUMENTS` exists.

For `guide` advice, translate a shared `/celetis:<name> <input>` into a supported plain prompt:
`Use the celetis:<name> skill for <input>. Complete its Host entry startup reads before any response, including commentary.`, using the actual advertised name. For example,
`Use the celetis:feature skill for #7. Complete its Host entry startup reads before any response, including commentary.` Recommend that prompt without invoking the target skill;
Claude slash-command notation is not Codex user advice.

Use the active checkout binding supplied in session context as the starting directory.
A rebind replaces that binding even when the tool process cwd still names the main checkout.
Use absolute paths in the bound checkout for root location and the config read. Inspect the
tool process cwd to establish its runtime location; the supplied active binding controls
product access. With no supplied binding, start from the host session cwd. If that start
cannot be established, stop for setup.

At Host entry, inspect this surface's actual tool catalog and supported file operations.
Use the session context and supported file metadata or directory tools to locate `.git`
from that active folder toward its ancestors. A `.git` directory marks a normal checkout.
Do not read a `.git` directory as a file. Only after metadata identifies a regular `.git`
file, read its `gitdir:` value through the file tool: the file's containing
folder is the linked checkout root. Stop at that first Git boundary, including when the lane
is physically below another checkout. An explicit absence through the session's root gives
the shared no-checkout case; another lookup error stops entry.

Read the whole root `.celetis.yaml` once through an available native file tool, then interpret
it against the shared schema. Prefer a dedicated file reader. A documented local Node REPL
can use supported file operations such as `node:fs/promises` metadata and `readFile` when
that runtime reaches the active checkout. Inspect its location and result first. Use file
operations only: no process launch, shell command, YAML library, or new parser operation.
An advertised generic REPL alone proves neither local access nor entry acceptance.

If no usable file-only reader or checkout locator exists with shell access absent, stop with
the tool names, exact limitation, and required file-access setup. Keep that native acceptance
case BLOCKED. `exec_command` with `cat`, `git`, or a parser does not satisfy native no-shell
entry. A denied read stops without another tool or command. Apply these rules to direct calls,
same-session handoffs, and borrowed references. Use the required CLI and optional desktop probes in
[native config acceptance](../../tests/manual/config-entry-codex.md); one surface proves no other.

`guide` and `setup` keep `disable-model-invocation: true` for Claude and
`policy.allow_implicit_invocation: false` in `agents/openai.yaml` for Codex. The command advice of
`guide` uses this host's spellings; it never starts a lane. Unlike `guide`, `setup` runs the
launcher of the plugin in the main checkout and enters no lane worktree.

## Worktree, commands, and files

Write `scripts/celetis --agent codex <command>` on every launcher call. Resolve the bundle from
the loaded skill path, or use `scripts/celetis --agent codex root` in the product checkout.
Neither a Claude environment variable nor an export in a previous tool call establishes it.

Run `scripts/celetis --agent codex worktree <n>` in the active product checkout and wait up to ten
minutes for completion. Record the main checkout as the directory containing the absolute Git
common directory (`git rev-parse --path-format=absolute --git-common-dir`). Bind the exact
successful output path as the lane checkout. A Codex managed or detached app worktree does not
replace that path. Do not call `EnterWorktree` or `ExitWorktree` on this host.

For shell tools with `workdir` or `cwd`, set it to that absolute lane path on **every call**.
For a shell tool without one, begin each call with `cd '<absolute-lane>' && ...`. Use absolute
lane paths in file tools and patch paths; a shell `cd` does not retarget those tools. Verify
`git rev-parse --show-toplevel` and the lane branch there, then read the lane's root, ancestor,
and applicable subsystem `AGENTS.md` files. If the session cannot read or edit that checkout,
stop for access setup rather than switching to a different checkout.

An isolated child gets the exact lane path and the instructions it must read, even when the
spawn API has no cwd field. Its first command verifies that path and branch, and all its file
and command calls use the same binding. A parent working in the main checkout must not let the
child inherit that checkout for lane edits.

Before landing or removal, set command context to the recorded main checkout, verify its root
and trunk, and read its applicable instructions. Keep the lane on disk. Run
`scripts/celetis --agent codex land <n> '<subject>'` there using the command tool's persistent
session/background support. Wait on the returned session identifier until exit; the checks may
take fifteen minutes. A yield is not completion. Do not start another landing while it runs.
With `exec_command`, retain `session_id` and use `write_stdin` to collect completion. When the
tool wrapper itself yields, finish its `wait` first to obtain that session identifier. If the
surface cannot keep a command alive and observe its exit, stop for setup. Repairs rebind the
lane through `worktree`; no new app worktree is needed.

## Dispatch

Inspect the active surface's spawn and follow-up schemas and supported model/effort pairs before
dispatch. Desktop and CLI catalogs can differ. Refresh the runtime allowlist from this same
surface and validate the main checkout's `codexProfiles` entry as
[capability binding](../capability.md) specifies. Every scorer call supplies the host and active
runtime evidence explicitly:

```bash
scripts/celetis --agent codex capscore J V B N S X --bias BIAS --attempt N --json \
  --runtime-models /absolute/active-models.json
```

For standalone scoring outside a configured repository, also pass `--profile
/absolute/profile.json`.

Add `--reviewer` for review dispatches, including the task reviewer, builder check, and final
review. Parse `status` first: `stop` dispatches nothing. On `ready`, record `line`, `dispatch`,
the actual spawn arguments and returned child identity in the execution record. Apply the
scorer's resolved reviewer minimum; the profile owns that minimum.

Create a child with `dispatch.model` and `dispatch.effort` explicitly set in the actual tool's
fields, in an isolated context. Codex selects one of two tool sets for each session: v2 when the
`multi_agent_v2` feature is on, else the `multi_agent_version` of the session model in
`codex debug models`, else v1 when the `multi_agent` feature is on. The session keeps that set,
and a child inherits it.

- In the v1 set, the tools are in the `multi_agent_v1` namespace. The `spawn_agent` fields are
  `model`, `reasoning_effort`, and `fork_context: false`. When the model supports tool search,
  these tools are deferred: do a tool search for `spawn_agent` before a missing tool stops
  dispatch.
- In the v2 set, the default namespace is `collaboration`. The `collaboration.spawn_agent`
  fields are `task_name`, `model`, `reasoning_effort`, and `fork_turns: "none"`.

Keep the parent model unchanged. Give the child the exact lane path, relevant project
instructions, its task text (not the whole plan), constraints and external facts, required
skill/reference paths and custom additions, the gate, comment and commit rules, and return
contract. An isolated child must read these instructions before acting.

Repairs and scoped re-review use the same child's follow-up tool and recorded identity. Resolve
the new pair before every retry. The two follow-up tools take no model and no effort:
`multi_agent_v1.send_input` has `target`, `message` or `items`, and `interrupt`, and
`collaboration.followup_task` has only `target` and `message`. Each keeps the original pair, so a
changed-pair retry is **blocked**.
A CAP line in that message does not change runtime settings. Stop with the old and required
pairs and the tool limitation; retain the failure trail. Do not spawn a replacement and call it
the same child. If a later surface supports changing both values on the same identity, verify
those controls and record their application before resuming. Unchanged-pair repair and re-review
still use the existing identity. Full retry parity remains unverified until a changed-pair
same-child run succeeds on the active surface.

Missing dispatch tools or a rejected configuration stop the dependent work. Do not substitute
main-session implementation for the Superpowers child loop. This setup stop follows Host entry;
in a runner step the issue receives `## Stopped` and `ready-for-human` under the step text.

## Lookup and session recovery

Discover available lookup tools through the surface's tool catalog or search mechanism; call
only tools in its returned schema. Read installed docs, use Context7 if connected, then the
available web search/open tools on primary sources. Claude's `ToolSearch`, `WebSearch`, and
`WebFetch` names do not imply Codex tools exist. With no lookup, record an unsettled fact.

For recovery, the human runs `codex resume --no-daemon <session-id>` from the main checkout with the
recorded Codex ID, or reopens that exact chat in the app. `guide` returns that command or app
method and runs nothing. An unknown session ID is a setup gap; do not resume an unrelated chat.

The native skill selector, command binding, and child controls must be checked on the actual
surface. A CLI dry run does not prove desktop selector behavior. Invocation metadata is
documented in [Build skills](https://learn.chatgpt.com/docs/build-skills); current runtime tool
schemas remain the authority for dispatch fields.

Desktop automation acceptance is optional under [Acceptance status](../celetis-flow.md#acceptance-status).
The shared skills remain callable manually or inline. Actual-surface checks and setup stops
still apply to the requested desktop operation; its limit does not block required CLI acceptance
or a change that satisfies its required checks.
