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

Use the file-access tool available in this Codex session for the custom read at Host entry.
Prefer a dedicated file reader when one exists. On a CLI that exposes `exec_command` for file
access, use an explicit read-only file command with the active checkout as `workdir`, and
inspect its result. This is an explicit file read, not a native no-shell read or load-time
injection. A denied read is a stop, not permission to try another tool or command. Apply the
shared missing-file, error, and exact-once rules to direct calls and same-session handoffs.

`guide` keeps `disable-model-invocation: true` for Claude and
`policy.allow_implicit_invocation: false` in `agents/openai.yaml` for Codex. Its command advice
uses this host's spellings; it never starts a lane.

## Worktree, commands, and files

Write `scripts/celetis --host codex <command>` on every launcher call. Resolve the bundle from
the loaded skill path, or use `scripts/celetis --host codex root` in the product checkout.
Neither a Claude environment variable nor an export in a previous tool call establishes it.

Run `scripts/celetis --host codex worktree <n>` in the active product checkout and wait up to ten
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
`scripts/celetis --host codex land <n> '<subject>'` there using the command tool's persistent
session/background support. Wait on the returned session identifier until exit; the checks may
take fifteen minutes. A yield is not completion. Do not start another landing while it runs.
With `exec_command`, retain `session_id` and use `write_stdin` to collect completion. When the
tool wrapper itself yields, finish its `wait` first to obtain that session identifier. If the
surface cannot keep a command alive and observe its exit, stop for setup. Repairs rebind the
lane through `worktree`; no new app worktree is needed.

## Dispatch

Inspect the active surface's spawn and follow-up schemas and supported model/effort pairs before
dispatch. Desktop and CLI catalogs can differ. Refresh the runtime allowlist from this same
surface and validate the profile as [capability binding](../capability.md) specifies. Every
scorer call supplies the host and configuration explicitly:

```bash
scripts/celetis --host codex capscore J V B N S X --bias BIAS --attempt N --json \
  --profile /absolute/profile.json --runtime-models /absolute/active-models.json
```

Add `--reviewer` for review dispatches, including the task reviewer, builder check, and final
review. Parse `status` first: `stop` dispatches nothing. On `ready`, record `line`, `dispatch`,
the actual spawn arguments and returned child identity in the execution record. Apply the
scorer's resolved reviewer minimum; the profile owns that minimum.

Create a child with `dispatch.model` and `dispatch.effort` explicitly set in the actual tool's
fields. If overrides require an isolated context, use it. On a surface exposing
`collaboration.spawn_agent`, the fields are `model`, `reasoning_effort`, and `fork_turns: "none"`.
Keep the parent model unchanged. Give the child the exact lane path, relevant project
instructions, its task text (not the whole plan), constraints and external facts, required
skill/reference paths and custom additions, the gate, comment and commit rules, and return
contract. An isolated child must read these instructions before acting.

Repairs and scoped re-review use the same child's follow-up tool and recorded identity. Resolve
the new pair before every retry. On a surface whose `collaboration.followup_task` has only
`target` and `message`, it preserves the original pair: a changed-pair retry is **blocked**.
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
