# The agents on Claude Code call the MCP tools

## Date

2026-11-22

## Related

- [Issue #358](https://github.com/ddinkov10/celetis/issues/358): the spec (the body of the issue, `Spec: 2026-11-22`), with
  the decisions of the maintainer, the external facts, the prior art, and the approaches. "Approach A" in this record is
  approach A of that spec.
- [The plan of #358](https://github.com/ddinkov10/celetis/issues/358#issuecomment-7080374337): its section "Decisions in the
  plan session" holds the answers of the maintainer. "The plan session" in this record names those decisions.
- [The check of Task 1 of #358](https://github.com/ddinkov10/celetis/issues/358#issuecomment-7080696662): the run of a tool
  write under auto mode. `docs/hosts/claude-code.md` holds its result.
- [ADR-0125](0125-each-agent-form-is-an-mcp-tool-that-runs-the-cli.md): the tools and their server. This record keeps its
  server, its tool names, its child process, its guard, its `read` values, and its manifest `timeout`.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the contract version and its digest. This record
  raises the contract to 13 by that rule and drops 11 and 12. The new field `sessionBound` of an entry is in the digest.
  The new field `purpose` of a form is a prose field and is not.
- [ADR-0084](0084-the-agent-text-names-engine-outcomes.md): the agent text names the command and only the outcome that the
  agent acts on. The spans `celetis --agent <host> ...` of the agent text stay, and the Claude Code part of the entry
  says how to run them.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md) and [ADR-0050](0050-standalone-engineering-principles-have-canonical-rules.md)
  are the placement rules that keep a host tool out of a skill: only the host part of a module names a tool.

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [Each agent form is an MCP tool that runs the CLI](0125-each-agent-form-is-an-mcp-tool-that-runs-the-cli.md), in part:
  - "Decision", item 2: the definition of a covered form. A form of a `sessionBound` entry (`dispatch`) is not covered. The
    rest of item 2 stays, with the sentence "The descriptions come from the prose of the contract, which the digest does not
    cover": a form now has its own `purpose` besides its `help` summary, and both stay outside the digest.
  - "Decision", item 3: the sentence "`toolSet` builds no tool for the first group and for the internal forms, and the gate
    refuses a tool that holds a form of `update`, `install`, `agents`, `root`, or `mcp`". `toolSet` builds no tool for
    the forms of `dispatch` too, and the gate refuses a tool that holds one. The first sentences of item 3 stay.
  - "Decision", item 5: the sentence "The result is `{ code, class, stdout, stderr, json }`". The result is
    `{ code, class, saved?, json | stdout, stderr }`. The rest of item 5 stays.
  - "Consequences", the bullet "The agent text names no tool. Until #358 lands, an agent runs the shell commands, and the
    tools are there for a session that picks one": the agent text of Claude Code now names the tools.
  - "Consequences", the bullet "The tool list has 58 names at the landing": the six `dispatch_*` tools are gone, so the
    number is not true. The tool set of `toolSet` is the count.
  - "Consequences", the bullet "The result is the printed output of the CLI. A form that prints JSON also gives it as
    `json`": the result holds the output once. The sentences about memory and the 50,000 characters of Claude Code stay.
  - "Consequences", the last bullet, in the part "and the six `dispatch_*` tools, which read `CLAUDE_CODE_SESSION_ID` from
    the environment of the server. Whether Claude Code gives that variable to an MCP server is not known": there are no
    such tools. The rest of the bullet stays.
- [One celetis program for both hosts](0042-one-celetis-program-for-both-hosts.md), in part: in "Decision", the paragraph
  "The permission rules", the Claude Code rules `Bash(celetis --agent claude land *)` and
  `PowerShell(celetis --agent claude land *)`. The rule is now `mcp__plugin_celetis_celetis__land`. The Codex rule and
  the sentences about `bun` and the shared direct-merge rules stay.
- [A landing re-runs a failed check of GitHub Actions once before it refuses](0023-a-landing-re-runs-a-failed-check-once.md),
  in part: in "Decision", the paragraph "The host waits", the sentences about Claude Code (`run_in_background` and a
  `timeout` of `3600000`), and in "Reconsider when" the last bullet, the part about the maximum `timeout` of a background
  command. On Claude Code, the session calls the tool of `land` and waits for its result. The sentence about Codex stays.
- [A contract version replaces the same-revision rule](0090-a-contract-version-replaces-the-same-revision-rule.md), in part:
  in "Decision", item 5, the list of prose fields `description`, `help`, `meaning`, `prerequisite`, `writes`. The list
  now has `purpose` too.

## Context

ADR-0125 serves the covered agent forms as MCP tools on Claude Code, and it left the agent text as it was: 170 code spans in
38 files send each agent to `celetis --agent claude ...` in the shell. The maintainer chose, in the specify session of
#357, that the agents on Claude Code use the tools and that Codex and OpenCode keep the CLI. The reviews of #357 and the
coordinator session of 2026-11-22 also found tool defects: the 22 `issue_*` tools shared one description, a result held
its output twice, and the tools of `dispatch` read a stale session ID after `/clear`.

## Constraints and evidence

- Claude Code 2.1.330 (installed): an MCP server subprocess keeps the `CLAUDE_CODE_SESSION_ID` of its start, and Bash,
  PowerShell, and hooks get the current ID after `/clear`. Source: https://code.claude.com/docs/en/env-vars.md.
- Claude Code 2.1.330: an MCP tool call of the main conversation that runs longer than two minutes moves to a background
  task, and the result arrives as a notification. Error text of more than about 11,000 characters keeps only its first 5,000
  and its last 5,000 characters. Source: https://code.claude.com/docs/en/mcp.md.
- Claude Code 2.1.330 on Windows 11: a `claude -p` run with `--permission-mode auto` ran the tool write
  `mcp__plugin_celetis_celetis__issue_comment` with no rule and no prompt. The control run with
  `--permission-mode default` was denied. The classifier of auto mode judges each call in its context, so this run does not
  cover an interactive session or a step session of the daemon. See the comment of Task 1 above, and
  `docs/hosts/claude-code.md`.
- A tool call runs outside the Bash sandbox, so the approval procedure for a sandbox block does not apply to it.
- One observation of the coordinator session of 2026-11-22: the model read a tool result as a JSON string in a text block, and
  it parsed the outer object and then `stdout`. No document says whether Claude Code gives `structuredContent` to the model.

## Decision

This is approach A of the spec, and the maintainer picked it. The 170 spans stay as the host-neutral names of the acts. The
Claude Code part of the entry maps each form to its tool, and each other change is limited to the Claude Code parts of the
modules and to the documents.

1. **A mapping rule in the Claude Code part of the entry.** The tool name is `mcp__plugin_celetis_celetis__` and the literal
   words of the form, joined by `_`. Each placeholder, enum word, and flag is a parameter. The parameter `checkout` is the
   absolute path of the checkout of the act. A tool that the session has not loaded is loaded with `ToolSearch` first.
   Codex and OpenCode run each form as a shell command.
2. **The shell stays for a form with no tool.** When the session has no tool of that name, the session runs the form in the
   shell, never one act both ways. A long form in the shell (`land`, `worktree`, `setup`) runs as a background Bash
   command, and the session waits for its real exit.
3. **A call that moves to the background is not complete.** The session waits for the notification, and never calls the act
   again while it waits. A call that ends with no result can have run its act, so the session reads the state with a read act
   before a new attempt.
4. **A denied tool call is a block.** The session never runs the same act in the shell after a denial. The engine adds no
   allow rule at the launch of a session. When a check shows that auto mode asks or denies a tool write in an unattended
   step session, the build stops for the decision of the maintainer.
5. **`dispatch` gets no tool.** The entry of `dispatch` has the contract field `sessionBound`. `toolSet` builds no
   tool for it, and `checkTools` refuses one. It stays `agent: true`, and agents run it in the shell, because the shell
   gives the current session ID after `/clear`.
6. **A result holds its output once.** The result is `{ code, class, saved?, json | stdout, stderr }`, in this order, so the
   cut of a long error never removes the exit. `json` holds the stdout only when `JSON.stringify(value)` or
   `JSON.stringify(value, null, 2)` prints it again, with or without one final newline. Else `stdout` holds the text as it
   is. For a nonzero code whose serialized result is longer than 10,000 characters, the server writes the whole result to a
   file and `saved` is its path, so no line of a long error is lost to the cut. `isError` stays true for each nonzero code.
7. **Each tool has its own description.** A form has a `purpose`, or else its `help` summary, and `checkTools` refuses a
   covered form with neither. A tool of one form opens with that text. A tool of more forms lists each form with its words
   and its required parameters. The description of a tool then gives the descriptions of its entries. The `purpose` is
   outside the digest.
8. **Contract 13, and only 13 is served.** The field `sessionBound` changes the digest. The maintainer chose, in the plan
   session of #358, that versions 11 and 12 go. An engine with this change refuses a plugin that needs 11 or 12, and an older
   engine refuses the new plugin.
9. **The permission documents name the tool.** The personal rule of `land` on Claude Code is
   `mcp__plugin_celetis_celetis__land`, and the optional rule of `issue` is one rule for each `issue_*` tool that writes.
   A rule of an MCP tool has no folder scope: it cannot limit the parameter `checkout`.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: a step session reads the exit from `code` and `class`, with no parse of printed lines, and
  the output once.
- Serves: 4 Product neutrality: the mapping names only the engine and the host, and the skills keep their host-neutral spans.
- Hard limits and non-goals: "One landing path" holds, because the tool `land` runs `celetis --agent claude land` itself.
  "No agent approval of an update" holds, because `update` has no tool.

## Alternatives considered

- **B. Name each tool at its use.** This is the usual rule of the skills best practices. It needs about 170 rewrites, a new
  check of the act words, and about 11 hand tables that can drift from the tool set. It was not picked: the maintainer chose A,
  and the derived rule of ADR-0125 makes the tables redundant.
- **A hook that rewrites Bash calls to tools.** It is a second mapping, and it blocks the shell fallback that `dispatch` and
  the forms with no tool need.
- **A tool result that holds both `stdout` and `json`.** The model reads the output twice, and one observation shows the
  parse of an escaped string inside a string.
- **A server cap or a cut of a long error.** A lost line is an anti-goal. A file that keeps the whole result costs one
  temporary file.
- **Keep contracts 11 and 12 served.** The maintainer chose that the old versions go.
- **An allow rule that the engine adds at the launch of a session.** The maintainer chose "stop and report" for a denial.

## Consequences

- An agent on Claude Code calls a tool for each covered act, and it runs the shell command only for a form with no tool:
  `dispatch`, `update check`, `agents read`, `intake`, `assist`, and `visual`. Codex and OpenCode keep the shell commands.
- A new form needs its tool and its mapping with no change of the agent text, and it needs a `purpose` or a `help` summary.
- A product machine with the old Bash rule of `land` gets a permission prompt, or the review of auto mode, until its
  maintainer adds the new rule.
- The rule of `land` allows `land` in each folder that a call names. A rule `mcp__plugin_celetis_celetis__*` allows the
  write tools too.
- The mapping rule is at the entry, which each skill invocation reads. A child agent that gets no skill invocation uses the
  shell, which runs the same CLI.
- Unchecked: the habit of an agent that reads "Run" and uses Bash, an interactive session, and a step session of the daemon
  under auto mode. The check of Task 1 covers only one `claude -p` run.
- The tool `land` can run longer than two minutes and so moves to a background task. The session waits for the result.

## Reconsider when

- Claude Code gives the current session ID to an MCP server, so `dispatch` can have a tool.
- Auto mode asks or denies a tool write in a step session of the daemon.
- Agents on Claude Code still use the shell for a covered act, so a stronger rule at the entry is needed.
- Codex or OpenCode gets the tools.
- Claude Code changes the background move of a tool call, the cut of a long error, or the name of a plugin tool.
