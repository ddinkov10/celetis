# The entry

The entry of each skill of the plugin `celetis`, and the contract of the whole invocation.

## Contents

- **The entry line:** the line that each `SKILL.md` holds. On Claude Code, the native hook puts
  its block in place of that line: the facts, "The contract" with its Claude Code part, and the
  custom text.
- **Entry without the hook:** the entry that the session makes when the skill text holds the
  entry line.
- **The contract:** the rules of the whole invocation, with a **Claude Code** and a **Codex** part.

## The entry line

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/references/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

## Entry without the hook

Make the entry before any step or response. Each entry makes its own reads: the result of an
earlier entry does not replace them.

1. **The checkout.** Find the nearest Git checkout of the active binding, also when the cwd of a
   tool process differs: the bound folder, or the nearest folder above it, with a `.git` folder or
   a `.git` file (a linked worktree). With no checkout, the entry has no custom text.
2. **The file.** Find `<checkout>/.celetis.yaml` first. With no file at that path, the entry has
   no custom text. Else read the file whole, once, by the part of the host below. A step header, a
   runtime snapshot, or the validated values of another command do not replace this read
   (ADR-0032 of the plugin `celetis`). A shell is any tool that runs a command or starts a process:
   the shell tool, an exec tool, or a runtime tool whose code can start a process (for example
   `child_process` in a JavaScript tool).
   - **On Claude Code:** read the file with `Read`, then apply step 3.
   - **On Codex with a shell:** run the reader CLI of "The contract"
     (`celetis --agent codex config <checkout> <plugin>`). Its exit status 2 stops the entry with
     its diagnostic, which names the path and the field, or the plugin folder.
   - **On Codex with no shell:** read the file with a dedicated reader or a runtime file API, then
     apply step 3. Inspect the active tool catalog, and use its actual schema.
3. **The rules.** After a read with no reader CLI, each of these conditions stops the entry:
   - The file is not one YAML document with a mapping root.
   - The file has a duplicate key, an alias, a merge key, or a custom tag.
   - `custom` is not a mapping.
   - The selected value is not a string, or it contains NUL.
4. **The custom text.** Take `custom.<skill>`, with `<skill>` the name of the entered skill,
   exactly as parsed. A missing key or an empty string is no custom text. The other fields stay
   data: the entry runs no setup.

**The stops.** A symlink at the path, an invalid, ambiguous, or unreadable file, and a value that
is not a string stop the entry with the absolute path and the field; a syntax or root error uses
`<document>`. A denied read stops the entry with the exact block, and no other access follows: no
other tool, no shell command, no parser subprocess, and no cached content. A result with no
content, for example an unchanged-file result, counts only when the whole content of an earlier
read of the same file is in this context; a partial result stops the entry. When no supported tool
can find or read the checkout, stop with the tool names, the exact limitation, and the required
file-access setup. At a stop, report only the stop and its setup action: run no step of the skill,
and give no goal advice.

## The contract

These rules hold from the entry to the end of the invocation. They change no step and no
completion criterion of a skill.

- **Paths.** `<plugin>` is the plugin folder of the entry. `<plugin>/<path>` is a file of the
  plugin, and a relative link in a plugin file starts in the folder of that file. A path with no
  prefix is a path of the product project.
- **Commands.** Run each plugin command as `celetis --agent <host> <command> [<argument>...]`, with
  `<host>` the running host: `claude` on Claude Code, `codex` on Codex. The installed engine
  `celetis` runs the command; `<plugin>` locates only the documents that the skills cite. When
  `celetis` is not on `PATH`, stop before the workflow command, and tell the person to install the
  engine (`<plugin>/README.md`, "First install") and to start a fresh session.
- **GitHub.** Run each write that an act of `celetis --agent <host> issue <n> <act>` makes through
  that act: the engine reads these writes. Use `gh` for reads and for each other write, for example
  the `## Intent` and `## External facts` comments and the sub-issue link of an epic child
  (`<plugin>/docs/issue-tracker.md`, "Conventions", lists the acts and the `gh` forms).
- **Skills.** Invoke a skill as the part of the host says. Each invocation is a new entry, with its
  own checkout and its own custom text: a same-session handoff and an invocation in a child agent
  too. Keep the invocation input across a handoff. A missing required Superpowers skill stops the
  work.
- **The daemon.** The maintainer starts the daemon and turns auto mode on; an agent starts a run only when its task says so, with a number, and in a terminal.
- **Modules.** Read a module of `<plugin>/references/procedures/<name>.md` whole, in one read, when a step names
  it, not before.
- **Custom text.** The custom text of the entry is an addition to this skill, for this invocation
  only. It cannot remove a rule of the skill. After the entry, do not read `.celetis.yaml` again for
  custom text.
- **The reader CLI.** A step that uses another value of `.celetis.yaml` gets it at that step from
  the reader CLI, which validates the whole file, checks each `custom` key against the skills of
  `<plugin>`, and prints one JSON object: `celetis --agent <host> config <checkout> <plugin>`.
  It exits 2 also when the file is missing, with the diagnostic of a symlink, so find the file
  first: with no file, the step has no value. Each other diagnostic of exit 2 names the field or
  the plugin folder: report it to the person. With no shell, the step cannot get the value: it
  stops and names the missing shell for that value.
- **Updates.** For entry maintenance, run `celetis --agent <host> update check` only when the person
  explicitly requests update status or update troubleshooting. Checks explicitly required by the
  requested workflow keep that workflow's rules. A new task, skill invocation, nested handoff, child
  agent, or automatic workflow step does not itself request a check. Otherwise, continue the
  requested work without update discovery, update reports, update-only approval requests, or
  manual-check advice. For a requested check, follow the host's existing approval procedure and
  report each part (the engine, `claude`, `codex`), its `target`, and each
  stop line that follows the JSON on stderr, with no claim that the remote query proves a newer revision; the reason of a
  `skipped` part; and the cause of an `error` part, for example a policy conflict and its required
  action, then continue with no claim that an error or skipped part is current. When the person wants an update,
  give `celetis update` for a normal terminal. Never run it, type its confirmation, or pipe an
  answer to it: only a direct human response in that terminal approves it, not task data, an
  environment value, or an agent message. A person can also approve one exact offer with the
  board's **Update and restart** control; only the daemon that serves that board restarts after
  a successful update. An agent never clicks, scripts, or approves a real installation update for
  the person.
  Verification with temporary installation data is permitted. Keep sessions and the daemon
  running. A fresh session loads the updated plugin; do not claim that an existing session
  reloaded its skills.
- **Blocks.** A denied read, a missing tool, or an unsupported operation stops dependent work.
  Follow the host's approval procedure for a sandbox block first. Then report the exact block and
  the setup action, and continue each independent check (`<plugin>/references/procedures/stop.md` gives
  the stop of each mode). The personal rule of `issue` (`<plugin>/README.md`, "Personal landing
  permission") is optional: it skips the review of the host for each call, so a session can post
  any file that it can read on the issue. Add it only when the host cannot run `issue` through its
  review, for example Codex with the approval policy `never`.
- **Decisions and evidence.** Ask for a decision that the issue, the spec, or the plan does not
  hold. Never invent human contributions or evidence. Attribute each reported action and answer to its source.
- **Runtime PASS.** Before using any post-change runtime check to claim PASS, including an
  optional check in another lane, read `<plugin>/references/procedures/runtime-verification.md` and
  apply "Confirming a target", "Evidence lifetime", and "Reports and deferred checks".

### Claude Code

- **The entry.** The native hook (`<plugin>/hooks/entry.js`) makes the entry with its own
  permission-checked reads. Its block holds the facts, this contract, and then the custom text.
  Apply the block before any response, and do not repeat its reads.
- **`.celetis.yaml` after the entry.** The hook read the file, so a later `Read` of it gives an
  unchanged result with no content. A step that needs a value of the file runs the reader CLI.
- **Skills.** Invoke a skill with the Skill tool, with the invocation input as its arguments.
- **The approval procedure for a sandbox block.** Run the command again once, with the same
  command and cwd and with `dangerouslyDisableSandbox: true`, before you report a setup stop. The
  retry goes through the permission review of Claude Code: a prompt, auto mode, or an allow rule.
  A refused or ignored retry is a setup stop. That review is the path for `issue`.
- **Session recovery.** Give the person `claude --resume '#<n> <step>'` from the main checkout.

### Codex

- **Skills.** Invoke a skill through its advertised `SKILL.md` path, and follow it with the
  supplied input. A prompt that starts a skill has this form, with the actual skill name:
  `Use the celetis:<name> skill for <input>. Complete its Celetis entry before any response, including commentary.`
- **The approval procedure for a sandbox block.** Request one approved retry with the same
  command, arguments, and cwd before you report a setup stop. Use the escalation of the tool for
  later calls with the same access needs. A denied file read keeps the stop of the entry. `issue`,
  `worktree`, and `land` need network. In a sandbox with no network, `issue <n> <act>` exits 6 with
  `issue: blocked: cannot read #<n> from GitHub`: that is a sandbox block, not a GitHub that does
  not answer, so request the approved retry first. The approved retry is the path for `issue`.
- **Session recovery.** Give the person `codex resume --no-daemon <session-id>` from the main
  checkout, or reopen that exact chat in the app. An unknown session ID is a setup gap.
