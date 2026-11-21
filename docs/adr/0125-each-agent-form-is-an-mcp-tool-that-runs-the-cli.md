# Each agent form is an MCP tool that runs the CLI

## Date

2026-11-21

## Related

- [Issue #357](https://github.com/ddinkov10/celetis/issues/357): the spec (the body of the issue, `Spec: 2026-11-21`),
  with the design probe, the prior art, the approaches, and the external facts. "The probe of the spec" in this record
  is the design probe of that spec. [Issue #358](https://github.com/ddinkov10/celetis/issues/358) is the follow-up: the
  agent text names the tools.
- [The plan of #357](https://github.com/ddinkov10/celetis/issues/357#issuecomment-7061897076): its section "Decisions in
  the plan session" holds four answers of the maintainer. "Plan decision N" in this record names answer N of that
  section. The plan also holds the external facts and the probe of the SDK that this record cites.
- [ADR-0083](0083-a-library-starts-a-celetis-process-through-the-program-entry.md): a library starts a Celetis process
  through the program entry. The server does the same for each tool call. The three `daemon` starts of that record stay
  as they are, and this record extends the rule to the call of a form. No clause of ADR-0083 is false after this record.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the contract version and its digest. This
  record raises the contract to 10 by that rule and drops 9. The digest now also holds the fields `read`, `names`, and
  `repeats` of the forms, which the declarations of the contract carry. Decision 5 of ADR-0090 stays true.
- [ADR-0097](0097-a-coordinator-session-steers-the-runs-for-the-maintainer.md),
  [ADR-0101](0101-a-run-session-tab-never-takes-the-focus.md), and
  [ADR-0118](0118-versioned-releases-and-a-pin-for-each-machine.md) each say that the engine "serves only" one contract
  version. Each number is the version of its own landing, and later raises changed it with no record that replaces the
  clause. This record replaces none of them.
- [ADR-0117](0117-the-issue-key-is-a-string-that-the-tracker-defines.md): an issue key is a string, so the parameter
  of a placeholder `<n>` is a string.
- [ADR-0114](0114-the-engine-library-groups-its-files-into-feature-folders.md): the files of the server
  are in the folder `engine/lib/mcp/`.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the check of the tool set is a
  function of the gate, not a test file.
- [ADR-0080](0080-a-look-decision-bypasses-the-page-csp-on-its-own-browser-tab.md), Related: "the plugin installs and
  configures no MCP server" restates the decision of ADR-0067, which this record replaces in part. That line is
  context of a record about a browser tab, and the server of this record is no research tool, so the line needs no
  Supersedes item. Its alternative "No source edit and no MCP server" also stays: it is a reason against a design of
  that record.
- [ADR-0122](0122-the-documents-of-a-product-are-a-website-on-github-pages.md), Alternatives: "The engine pins two
  packages" gave a reason in its own time. The engine pins three packages after this record, and the rejection of that
  alternative stands.
- `engine/lib/mcp/tools.ts`, `engine/lib/mcp/mcp.ts`, `engine/lib/mcp/call.ts`, `engine/mcp.ts`,
  `plugins/celetis/.claude-plugin/plugin.json`, and `engine/README.md`, "The MCP server".

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The engine pins its packages in a lockfile and checks the daemon protocol with Zod schemas](0115-the-engine-pins-its-packages-in-a-lockfile.md),
  in part: in "Decision", item 1, "two dependencies, `zod` `4.6.7` and `yaml` `2.9.1`, as exact versions". Now
  `engine/package.json` has three dependencies, with `@modelcontextprotocol/server` `2.4.0` as an exact version. The rest
  of item 1 stays: the lockfile, and no package file in the repository root, in `scripts/`, or in `plugins/`.
- [The gate tools come from the lockfile of the engine](0119-the-gate-tools-come-from-the-lockfile-of-the-engine.md),
  in part: in "Decision", item 2, the words "and gets only `zod` and `yaml`". A user installation gets `zod`, `yaml`, and
  `@modelcontextprotocol/server`, each with its own dependencies. The two install kinds and the rest of item 2 stay.
- [Component research binds behavior and guides looks](0067-component-research-binds-behavior-and-guides-looks.md),
  in part: in "Decision", the first bullet, the sentence "The plugin bundles, installs, and configures no MCP server".
  The Claude manifest of the plugin declares one MCP server of its own, `celetis`. The plugin still bundles and installs
  no MCP server of a research tool, and "and `setup` does not change" stays true. The alternative "The plugin bundles or
  installs the MCP servers" stays rejected: it names the hosted research servers.
- [The check for a removed version folder reads the engine entry](0092-the-check-for-a-removed-version-folder-reads-the-engine-entry.md),
  in part: in "Decision", item 4, the sentence "Seven sites call the one function". The server of this record is one
  more site: it reads `versionFolderGone` before each start, and it gives code 3 and its own line. The other sites keep
  their acts.

## Context

The agents on Claude Code run the commands of the engine as shell commands. A Bash call gives printed lines and a coarse
pattern rule for permission. The maintainer wants an interface that is native to an AI agent: a tool call gives a typed
input, a structured result, and one permission rule for each tool. The target of the maintainer is that the agents on
Claude Code use the tools in place of the shell commands. The work has two issues. This record covers #357, the server.
Issue #358 changes the agent text.

## Constraints and evidence

- The documents of Claude Code 2.1.330 give these facts. A plugin declares an MCP server in `.mcp.json` at the plugin
  root or in the key `mcpServers` of `.claude-plugin/plugin.json`. A plugin tool is named
  `mcp__plugin_<plugin>_<server>__<tool>`, and a character outside `A-Z a-z 0-9 _ -` becomes `_`. A permission rule names
  one tool or `mcp__<server>__*`, and a rule with parentheses on an MCP tool is skipped
  ([plugins reference](https://code.claude.com/docs/en/plugins-reference.md),
  [components](https://code.claude.com/docs/en/plugins/components.md),
  [permissions](https://code.claude.com/docs/en/permissions.md)).
- The plan session read these facts in the page "MCP" of the same documents: a per-server `timeout` in milliseconds is a
  wall-clock limit for one call; a value below 1000 is ignored and `MCP_TOOL_TIMEOUT` applies, which is about 28 hours by
  default; a `timeout` of 1000 or more is also a floor of the idle window; the idle window is 30 minutes for a stdio
  server; a call of the main conversation that runs for more than two minutes moves to a background task; a successful
  text result of more than 50,000 characters goes to a file; and an error text of more than about 11,000 characters keeps
  its first and last 5,000 characters ([MCP](https://code.claude.com/docs/en/mcp.md)). No check of a real session shows
  the effect of the manifest `timeout`.
- The MCP specification 2026-07-28 says that a tool name has 1 to 128 characters of `A-Z a-z 0-9 _ - .`, that a tool with
  `structuredContent` also returns the JSON as text, that a failed execution is a result with `isError: true`, and that a
  client treats annotations as untrusted unless the server is trusted
  ([tools](https://modelcontextprotocol.io/specification/latest/server/tools)).
- `@modelcontextprotocol/server` 2.4.0 needs `@modelcontextprotocol/core` 2.4.0 and zod `^4.2.0`, so the zod 4.6.7 of
  the engine satisfies it. The plan session probed it on Bun 1.4.4 on Windows 11. An input that fails the schema gives a
  result with `isError: true`, and the handler does not run. An unknown tool gives the JSON-RPC error -32602. The handlers
  of concurrent calls run concurrently. The server process exits 0 shortly after its stdin closes.
- The probe of the spec, on Windows 11 with Claude Code 2.1.330: a plugin server whose `command` is a bare name that
  `PATH` finds only as a `.cmd` shim started, and its tool answered with the environment of the session and the start
  folder of the session as its working folder. The probe did not run macOS and Linux, an interactive session, or a step
  session of the daemon.
- `setup check` runs `git fetch` (`engine/setup.ts`, `checkTrunk`), so its `read` value is `false`.
- At the landing, `toolSet(commands)` gives 58 tools, and 14 of them have `readOnlyHint` true: `lesson-store_read`,
  `lesson-store_preview`, `daemon_status`, `coordinator_status`, `coordinator_read`, `issue_view`, `issue_list`,
  `issue_epic-state`, `issue_state`, `next-step`, `events`, `config`, `capscore`, and `setup_status`.
- Probes of the guard (Windows 11, Bun 1.4.4, `argumentsOf` on `commands`):
  - `issue_view` with `n` set to `5` builds `issue 5 view`. With `n` set to `-5` it is refused (a value that starts with
    `-`). With `n` set to `create` it is refused, because `issue create view` matches `issue create <file>` exactly.
  - `issue_comment` with `n` set to `create` and a file builds `issue create comment a.md`, and it is refused: the list
    starts with the words of `issue create <file>`.
  - `worktree` with `n` `5` and `remove` `false` builds `worktree 5`. With `remove` `true` it builds `worktree --remove 5`.
  - `run` with `n`, `model` `opus`, and `effort` `high` builds `run 5 --effort high --model opus`.
  - `issue_comment` with two elements in `attach` builds `--attach` twice, and with an empty array it builds no `--attach`.
- Probes of the gate (Windows 11, Bun 1.4.4, `checkTools`): `commands` as it stands gives no error. Each change below
  gave the error of its rule, and some also gave the error of the sample input: a `names` key for a literal word; an
  agent form that is no tool and not in `notCovered`; a covered form with no `read` value; a placeholder with no name;
  a parameter twice in one form; a parameter `checkout`; a tool name `probe7:x`; two tools `probe8.x` and `probe8_x`;
  `agent: true` on `root`, `update`, `install`, `agents`, and `mcp` in turn; one parameter with two kinds; two forms with
  the inputs `<a> <b>` and `<b> <a>`; and a form `run <n> <x>`, which the sample input of `run resume <n>` also matches.
  A `read: true` on `land` and an empty description of `config` gave no error. So the gate requires a `read` value and
  does not check it, and it does not check a description. The probe scripts were in the scratchpad of the session and are
  not kept, so this list is the record.

## Decision

The engine serves the covered agent forms as MCP tools, one tool for each form name, and each tool call runs one form
of the CLI in a child process. This is approach A of the spec, and the maintainer picked it.

1. **A stdio server in the Claude manifest.** `celetis --agent <host> mcp` serves MCP over stdio with
   `@modelcontextprotocol/server` 2.4.0, an exact pin in `engine/package.json` and `engine/bun.lock`. It needs an explicit
   `--agent <host>`, and it ends when its stdin closes. The key `mcpServers` of `plugins/celetis/.claude-plugin/plugin.json`
   starts it with `celetis --agent claude mcp`. The server is in the Claude manifest and in no `.mcp.json`, because the
   Codex plugin shares the folder `plugins/celetis/` and must not start a server that names the host `claude`. The
   command is the bare name `celetis`, which the probe of the spec started on Windows.
2. **One tool for each name of a covered form.** A form is covered when its entry has `agent: true`, the entry is not
   `internal`, and the form does not hand the terminal to a host session. The name of a tool is the literal words of its
   form, joined by `_` (`issue <n> route ...` gives `issue_route`), and the covered forms with one name make one tool.
   The parameters come from the placeholders, the enum words, and the flags of the forms. The contract declares the names of the placeholders that are not words, and the
   flags that repeat. Each tool has the required parameter `checkout`, the absolute path of an existing folder, because
   the server cannot know the lane worktree that a session enters after its start. The descriptions come from the prose
   of the contract, which the digest does not cover.
3. **Not covered.** `intake`, `assist`, and `visual` start a host session in the terminal of the caller. `update`,
   `install`, `agents`, `root`, and `mcp` have `agent: false` in the contract, so they get no tool, and the agent text that
   runs `agents read` or `update check` keeps the shell command. `update` is also under the hard limit "No agent approval
   of an update". The internal forms of `daemon` are separate entries. `toolSet` builds no tool for the first group and
   for the internal forms, and the gate refuses a tool that holds a form of `update`, `install`, `agents`, `root`, or
   `mcp`.
4. **A child process for each call, through the program entry.** The server starts `process.execPath` with `bunArgs` and
   `<root>/engine/celetis` of its own engine, with `--agent <host>` and the built arguments, with `shell: false`, no
   stdin, `checkout` as the working folder, and the environment of `childEnv`. A tool and a shell command so share the
   launcher, the locks, the exit classes, the outputs, and the daemon requests. The server runs the CLI of its own
   revision, so the schemas and the forms that they run come from one revision.
5. **A structured result.** The result is `{ code, class, stdout, stderr, json }`, with `isError` true for a nonzero
   code, and an `outputSchema`. A call has no timeout and no kill. A call waits for its child, a cancel of the client
   does not end it, and concurrent calls start concurrent children.
6. **The guard (plan decision 2, "Refuse both").** The server refuses with code 2 and starts no process when a string value
   starts with `-`, and when the built argument list also matches a form of the command that the input did not select.
   The review of the build added a third class: the built list starts with the two or more leading literal words of a
   form outside the tool, because the command files route by those words before they check the arity of the act. Forms
   of the same tool are exempt from the third class.
7. **A declared read value (plan decision 3, "Exclude engine logs").** Each covered form declares `read` in the contract,
   with no default. `readOnlyHint` is true only when each form of the tool is a read. A write is a change of the project
   checkout, Git, the tracker, the daemon or its state, a session, the queue, a lesson store, a dispatch record, or an
   installation. The event-record entry that the launcher writes for a nonzero exit, and a transient lock file, do not
   count.
8. **A manifest `timeout` (plan decision 1, "Add timeout").** The entry has `"timeout": 100000000`. By the documents of
   Claude Code, the idle window of 30 minutes would end a call that waits for its child, and a `timeout` of 1000 or more
   is a floor of that window. No check of a real session shows the effect.
9. **One contract version.** The new entry, the names, and the read declarations raise the contract to 10. The old version
   goes: `engine/lib/contract/versions.json` serves only 10, and `plugins/celetis/contract.json` needs 10. An engine
   with this change refuses a plugin that needs 9, and an older engine refuses the new plugin, by the check of ADR-0090.
10. **A gate check of the tool set.** `checkTools` of `engine/lib/mcp/tools.ts` runs in `scripts/verify.ts`, and
    `engine/README.md`, "The MCP server", lists its rules. No file of `plugins/celetis/skills/`,
    `plugins/celetis/references/`, `plugins/celetis/step-prompt.md`, or `plugins/celetis/.codex-plugin/` changes.
11. **The macOS start is a check by hand (plan decision 4, "After the landing").** The start through the POSIX `sh` shim
    runs on the machine of the maintainer after the landing. The build session runs on Windows and cannot run it.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: a step session can read the exit class and the code from a structured result, with no parse
  of printed lines.
- Serves: 4 Product neutrality: the tools name only the commands of the engine and no part of a product.
- Hard limits and non-goals: "One landing path" holds, because the tool `land` runs `celetis --agent claude land` itself,
  through the same command and the same checks. "No agent approval of an update" holds, because `update` has no tool.

## Alternatives considered

- **B. One tool for each form, with in-process handlers.** This is the usual design of the large MCP servers (the GitHub
  server, the reference git server). It was not picked. Each of the command files would become a function that returns
  data, and a long-lived process would hold their state. The launcher wraps each command in the update lock, and the lock
  owners are read by PID and command line, so an in-process path is a second path that can drift. ADR-0083 chose the
  program entry over an in-process call for the same reason.
- **C. One tool for each command, with an `act` enum.** This is the form of the GitHub default tools. It was not picked.
  The permission rules are coarse, because one rule allows each act of the command. The saving of context is small,
  because Claude Code defers the MCP tools by default.
- **A `.mcp.json` at the plugin root.** Both hosts share the folder `plugins/celetis/`, and the server names the host
  `claude`. The key of the Claude manifest keeps the server out of the Codex plugin.
- **A server that runs the CLI that `PATH` finds.** After an update, the schemas of a session would describe one
  revision and the forms that they run another. The server runs the CLI of its own revision instead.
- **Keep contract 9 served.** The maintainer chose that the old version goes, so an engine and a plugin of different
  generations refuse each other at the contract check.
- **A tool for `update`, `install`, `agents`, or `root`.** The contract marks them `agent: false`. The agent text keeps
  the shell command for `agents read` and `update check`, and `update` is under a hard limit.

## Consequences

- A Claude Code session with the plugin has one tool for each name of a covered form, named `mcp__plugin_celetis_celetis__<tool>`.
  One permission rule allows one tool. A rule `mcp__plugin_celetis_celetis__*` allows each tool, the write tools too.
- The agent text names no tool. Until #358 lands, an agent runs the shell commands, and the tools are there for a session
  that picks one. A tool runs the same CLI form as the shell command, so the behavior is the same.
- A new agent form needs a `read` value, and a placeholder that is not a word needs a name in the contract. The gate
  refuses the form until it has both. The gate does not check that a `read` value is true, so a wrong `true` can let a
  write pass a rule that allows only read tools.
- The tool list has 58 names at the landing. Claude Code defers MCP tools by default, so the cost in context is the list
  of names. No check of a real session shows the size of that list in the context.
- The engine has a third dependency. The version folder of each machine holds `@modelcontextprotocol/server` and its
  packages after the next install or update.
- The result is the printed output of the CLI. A form that prints JSON also gives it as `json`. The server holds the whole
  output of a child in memory and sets no limit. Claude Code writes a text result of more than 50,000 characters to a
  file.
- A session that ends during a call leaves its child running, and the output goes nowhere. A shell call that a session
  leaves has the same risk.
- An update can remove the version folder of a running engine. The tools of that session answer with code 3 until a fresh
  session starts.
- Unchecked until the maintainer or a later check runs them: the start through the `sh` shim on macOS and Linux, the
  effect of the manifest `timeout` in a real session, and the six `dispatch_*` tools, which read `CLAUDE_CODE_SESSION_ID`
  from the environment of the server. Whether Claude Code gives that variable to an MCP server is not known.

## Reconsider when

- Claude Code changes the name of a plugin tool, the meaning of the manifest `timeout`, or the idle window of a stdio
  server.
- The start of the server fails on macOS or Linux, or the manifest `timeout` has an effect other than the documents say.
- Codex or OpenCode needs the tools. A shared manifest then needs a server that does not name the host `claude`.
- A form needs stdin, or a tool call needs progress output while its child runs.
- The number of tools costs enough context to change the rule of one tool for each form name.
- A `read` value proves wrong for a form, or a check can derive the value from the code of the form.
