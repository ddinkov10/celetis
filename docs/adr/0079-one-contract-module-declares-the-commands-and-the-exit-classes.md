# One contract module declares the commands and the exit classes

## Date

2026-11-08

## Related

- [Issue #253](https://github.com/ddinkov10/celetis/issues/253): the spec ("Approaches", "The exit
  classes", "The module", "The generated text", "The gate", "Risks"), the calls of the session,
  and the plan (decisions D1 to D10).
- [ADR-0043](0043-the-help-list-is-the-one-source-of-the-typed-commands.md): the help list. Two
  clauses change ("Supersedes").
- [ADR-0078](0078-the-master-daemon-runs-each-landing.md): `land` is a client of the master daemon.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the verify gate is the only check.
- `engine/lib/contract.ts` (`exitClasses`, `exits`, `commands`, `launcherForms`, `issueActs`,
  `usage`), `scripts/build.ts` (the generated blocks), `scripts/verify.ts` (`checkContract`,
  `bindings`, `otherPrograms`).
- `README.md`, "The commands" and "Checks"; `docs/issue-tracker.md`, "Conventions".

## Supersedes

Only these parts change. The accepted records keep their historical text and evidence.

- ADR-0043, "The help list is the one source of the typed commands", Decision, "One help list":
  `helpCommands` in `engine/lib/help.ts` is gone. The help text is a view of the forms that a
  person types in `engine/lib/contract.ts`, in the same order and with the same bytes.
- ADR-0043, Consequences: "The rest of the commands table of `README.md` stays hand-written."
  `scripts/build.ts` writes the command table and the exit-class table of `README.md` and the act
  table of `docs/issue-tracker.md` from the module. Only the table of the scripts stays
  hand-written.

## Context

Each command chose its exit codes alone. The same number meant different things: a refusal was 1
in `worktree` and `setup`, 3 in `issue`; a busy lock was 3, 5, or 6; `dispatch` used 4 and 5 for
a stop and a setup failure, where `land` used them for a repair and a red check. The skills and
the procedure modules act on these numbers in prose, and no check tied a number of the text to
the command that makes it. The usage lines, the help, the README rows, and the act table were
four hand-kept copies of the same forms.

## Constraints and evidence

- `sysexits.h`, curl, and git each give a code one meaning across the program: curl keeps one
  numbered exit list for every option, and git keeps one `command-list.txt` for its help and its
  documents. cobra makes the help and the Markdown documents from the command definitions, and the
  Kubernetes `verify-generated-docs.sh` fails on a hand edit of a generated document. `usage lint`
  matches each example of a document against its spec.
- The research of the spec found no prior art for a check of exit codes that are written in prose.
- `engine/lib/workflow.ts` is compiled for the browser through `engine/board/queue.ts`, so the
  module imports nothing and uses no Bun or Node API.
- `engine/usage-hook.ts` is the Claude Code `Stop` and `StopFailure` hook of a step session. An
  exit 2 of a `Stop` hook prevents the stop (Claude Code 2.1.319, "Exit code 2 behavior per event").
- `Bun.markdown.render` (Bun 1.4.4) calls each element callback after its children, with their
  rendered string, and gives no source positions.

## Decision

**One module.** `engine/lib/contract.ts` is the one source of the public interface: the exit
classes, each command entry with its forms, flags, description, and declared classes, the
launcher forms, the `issue` acts, the labels, the comment headings, and the printed lines that the
text acts on. The help, the usage line of each command, the README tables, and the act table are
views of it. A printed line that the module declares is the value that the engine prints, not a
second copy (for example the `CAP:` prefix, the closing line of `setup status`, and the path line
of `worktree`), and `usage` alone decides where the update hint goes.

**One class table for every command.** 0 `done`, 1 `internal`, 2 `usage`, 3 `prerequisite`,
4 `repair`, 5 `checks`, 6 `blocked`, 7 `cleanup`, 8 `stop`, and 128+n `signal`. The engine names
a class (`exits.prerequisite`) and never writes an exit code as a digit, except a code that it
passes on and a signal exit. A raw child code, also 128 of git and a child that a signal ended,
is 6. A pass-through form (`intake`, `assist`, `visual`, `setup try`, `daemon --session-start`)
declares only the classes that it decides itself. The daemon clients declare the classes that the
daemon answers.

**The rulings of the build.** There is no `board` command: the daemon starts the board, so a
board port in use is an exit of `daemon start`. `land` is a daemon client: it returns the class
that the daemon decided for the landing, parsed at the socket, and the class of a refusal of the
request (3 with no daemon or another revision, 6 with no answer). Only the final landing record of
`land` is marked as recorded by the daemon in the event record, so a landing has one entry.
`usage-hook` follows the hook protocol (0, or 1 for each failure, never 2), so it is outside the
class table and has a row in the table of the scripts.

**The gate binds each exit of the text to its block.** `checkContract` in `scripts/verify.ts`
reads the files of `checkCitations` with `Bun.markdown.render`:

- A block is a paragraph, a heading, a table row, a list item, or prose outside every other block.
  A list item takes the paragraph just before its list as its lead; a nested item takes its parent
  item. A list after a table, a heading, or a fenced block has no lead.
- A command mention is a code span or a fenced line whose first word is exactly `celetis`, with or
  without `--agent <host>`, or a code span of two or more words that makes a form match with a
  declared command. A skill name such as `celetis:plan` and a path such as `celetis\lessons\…`
  name no command. A launcher form (`celetis`, `celetis --version`) passes the form check and
  names no command. A placeholder in the command position names every command.
- Each `celetis` span and fenced line must match a declared form by position: a literal word, a
  slot, a declared flag with its value; a `<…>` or all-capital word of the text matches any word.
- An exit reference is a number after `exit`, `exits`, `exit status`, `exit code`, `exit codes`,
  `exit with`, `exits with`, or `status` in the prose of the block, outside code, with each further
  number of its list. The code must be a class of an entry that the block or its lead names. With no command, a code span of a listed
  other program (`otherPrograms`: `bun`, `git`, `gh`, `claude`, `codex`, `hc`, `herdr-app`,
  `impeccable`, by the basename of the first word after any `NAME=value` words) skips it. Every
  other reference fails with "name the command of this exit".

## Alternatives considered

- **A. The number only.** Each exit number of the text must be in the class table. It is the
  pattern of the curl and git name checks and needs no text edits, but it misses a code that the
  named command never makes, and an exit of another program passes when its number is in the table.
- **B. Bind to the commands of the Markdown block.** Chosen by the maintainer on 2026-11-07. It
  catches a wrong code for a command and a new reference that names no command, and fails each
  reference that it cannot bind. Its block rule is a heuristic, so some text names its command
  again.
- **C. One fixed written form**, "`land` exit 4". It has the simplest parser, but every reference
  is rewritten, and a reference in another form escapes the check with no message.
- **Classes for only the commands that the plugin text calls.** The maintainer chose the class
  table for each command of the README table.
- **A per-command code table.** It keeps the old codes, but a code keeps several meanings, and a
  reader of the text cannot act on a number without the command's own table.

## Consequences

- A code has one meaning in every command, and the help, the usage lines, the README tables, and
  the act table cannot differ from the module with no failed check.
- A wrong exit code for a named command, an exit that names no command, and a `celetis` form that
  the module cannot match fail the verify gate. An exit of a program outside `otherPrograms`
  fails until its block names a listed program or the list grows.
- The moved codes are a breaking change for a product text and a script that read the old numbers
  (no compatibility path).
- The block rule is a heuristic: a reference binds to any entry of its block that declares the
  code, so a block that names two commands can hide a code that only the other one makes. A line
  number of the gate is located again in the source text, because the renderer gives no positions.
- A new command, flag, act, or class goes into `engine/lib/contract.ts`, and `scripts/build.ts`
  writes the tables.

## Reconsider when

- `Bun.markdown.render` gives source positions or another parser gives a typed syntax tree.
- A command needs a code with a meaning that the class table does not have.
- The plugin text adopts one fixed written form for exit references.
- The README command table or the act table is written by hand again.
