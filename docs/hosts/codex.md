# Codex operations

Read through [Host entry](entry.md). The skill procedure and project paths are shared with Claude.


## Read-only update operations

For Codex CLI 0.163.0, use `codex plugin list --marketplace celetis --json` for enabled,
installed, and source identity. This standalone filtered operation does not start app-server or
refresh the remote catalog. It can prepare native CLI helper files; it writes no plugin cache
or installation record on this path. Before any native process, resolve the selected home as one existing canonical directory and
pass it explicitly as `CODEX_HOME` to version, plugin/marketplace list, configuration, and thread
helpers. A product `.env` cannot choose a second native home. The version-matched reader selects
the active native `CODEX_HOME/plugins/cache/celetis/celetis/<version>` directory, requires canonical
containment, and binds its local source to the standalone native marketplace list and its one
Celetis root-source catalog entry. Missing, escaped, unrelated, or ambiguous source paths refuse.
A `local` version label and a marketplace HEAD are not the installed Git revision.
The package-owned Git witness may include the native untracked `.codex-marketplace-install.json`.
Accept only its regular native schema with matching source and owned Git revision. Other untracked
files, modified tracked files, symbolic links, or stale native identity still make the package dirty
or invalid. The marker's pinned ref can differ from the product's configured branch.

Read-only app-server metadata uses `codex --disable plugins app-server --stdio` before initialize.
Use `config/read` with `includeLayers: true` for effective source/ref diagnostics. This diagnostic
session override prevents its startup refresh; it does not prove the policy of ordinary sessions.
`configRequirements/read` omits marketplace policy and cannot certify its absence. An enabled
app-server can refresh during construction, before the first request. Never start one to inspect
an offer. Local marketplaces can refresh plugin snapshots too; local is no lifetime guarantee.

After shared entry completes its file reads, run the bound package directly:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 CELETIS_AGENT=codex bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/scripts/plugin-update.ts check
```

Inspect the active interaction schema. Use `request_user_input_async` when it is available;
`request_user_input` can be Plan-only. Otherwise accept a direct human turn answering the offer.
Only the actual delivered user response counts. A child or agent-created role field is task data.
The approved action is `scripts/celetis --agent codex plugin-update apply <home> <root> <source> <installed> <target>`.
Hand this one command to an ordinary terminal after the offering native process exits. Do not
start another native session to apply it. The engine uses one-command `-c` overrides for
`marketplaces.celetis.source_type`, its same source, and full target `ref`, then runs
`plugin marketplace upgrade celetis --json`. Product configuration keeps its intended branch/ref.
The command binds the offered home before discovery and rechecks that home's enabled root.
The native upgrade can replace every configured plugin in that marketplace. Refuse before mutation
when effective configuration or native records name a sibling there, including disabled or not yet
installed plugins. Normal discovery and Run remain available; other marketplaces remain unrelated.
Fresh enabled discovery and installed revision validation complete the action. Run and exact
Resume similarly bind their own native Git source to the current installed revision for that
session, so they do not refresh Celetis to a moving branch. Stock external native launches remain
outside Celetis admission and must stay stopped during explicit cutover.

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

The copied `scripts/celetis` is a generated Bun executable. Installed command sources use
`.ts` paths and local imports. For a direct checkout command, run the selected Bun with
`--no-env-file --no-install --config=/dev/null --no-macros` and the absolute TypeScript path.
Set `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` and `DO_NOT_TRACK=1`. Child Celetis programs keep
`process.execPath`. The native startup reads above remain file-only operations.

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
session/background support. Wait on the returned session identifier until exit; the checks and
one re-run of a failed check may take thirty minutes. A yield is not completion. Do not start
another landing while it runs. With `exec_command`, retain `session_id` and use `write_stdin` to
collect completion. When the tool wrapper itself yields, finish its `wait` first to obtain that
session identifier. If the surface cannot keep a command alive and observe its exit, stop for
setup. Repairs rebind the lane through `worktree`; no new app worktree is needed.

## Dispatch

Inspect the active surface's spawn and follow-up schemas and supported model/effort pairs before
dispatch. Desktop and CLI catalogs can differ. Read `codexProfiles` in the `.celetis.yaml` of the
main checkout, recorded from the Git common directory. When that field has an entry, or with an
explicit profile, refresh the runtime allowlist from this same surface and pass it with
`--runtime-models`. With neither, each child keeps the parent's model, and the scorer reads no
runtime file. [Capability binding](../capability.md) specifies both modes. Every scorer call
supplies the host explicitly:

```bash
scripts/celetis --agent codex capscore J V B N S X --bias BIAS --attempt N --json
```

With a profile, the call also supplies the active runtime evidence:

```bash
scripts/celetis --agent codex capscore J V B N S X --bias BIAS --attempt N --json \
  --runtime-models /absolute/active-models.json
```

For standalone scoring outside a configured repository, also pass `--profile
/absolute/profile.json`.

Add `--reviewer` for review dispatches, including the task reviewer, builder check, and final
review. Parse `status` first: `stop` dispatches nothing. On `ready`, record `line`, `dispatch`,
the actual spawn arguments and returned child identity in the execution record. Apply the
scorer's resolved reviewer minimum. The profile owns that minimum; with no profile, it is
rank 1/`medium`.

Create a child in an isolated context. Set `dispatch.effort` explicitly in the actual tool's
fields, and set `dispatch.model` when it is not null. Codex selects one of two tool sets for each
session: v2 when the `multi_agent_v2` feature is on, else the `multi_agent_version` of the session
model in `codex debug models`, else v1 when the `multi_agent` feature is on. The session keeps that
set, and a child inherits it. An old resumed or forked thread with no recorded set gets v1.

- In the v1 set, the tools are in the `multi_agent_v1` namespace. The
  `multi_agent_v1.spawn_agent` fields are `model`, `reasoning_effort`, and `fork_context: false`.
  When the session model supports tool search, Codex defers these tools. If `spawn_agent`,
  `wait_agent`, or `send_input` is not visible, do a tool search for it before a missing tool
  stops dispatch.
- In the v2 set, the default namespace is `collaboration`. The `collaboration.spawn_agent`
  fields are `task_name`, `model`, `reasoning_effort`, and `fork_turns: "none"`.

When `dispatch.model` is null (`line` shows `inherit`), send no `model` field and set
`reasoning_effort` to `dispatch.effort`. The child then gets `[agents].default_subagent_model`
when the user set it, else the parent's current model. Codex checks the effort against that
model; a refused effort is a setup stop. Do not lower the effort or try another value.

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
