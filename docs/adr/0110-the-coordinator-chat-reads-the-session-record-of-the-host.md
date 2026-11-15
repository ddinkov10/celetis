# The coordinator chat reads the session record of the host

## Date

2026-11-15

## Related

- [Issue #326](https://github.com/ddinkov10/celetis/issues/326): the spec (the body of the issue, `Spec:
  2026-11-15`). In this record, "call <n>" names a call of the session in the spec ("The decisions of the
  maintainer and the calls of the session"), and "P2" names the live probe of the hosts (Claude Code 2.1.325,
  codex-cli 0.169.0): [its result](https://github.com/ddinkov10/celetis/issues/326#issuecomment-6895016716) and
  [its correction](https://github.com/ddinkov10/celetis/issues/326#issuecomment-6895070431).
- [ADR-0097](0097-a-coordinator-session-steers-the-runs-for-the-maintainer.md): the coordinator session, its
  record, its notes, and the send to a run session. This record keeps each of them. The record of the session
  gets the field `session` (schema 2), and an old record with no such field is no valid record.
- [ADR-0106](0106-the-board-carries-the-acts-of-the-coordinator-session.md): the acts of the board (a message, a
  key, an interrupt, an end) and their state table. They stay as they are. The chat shows the result of each of
  them.
- `engine/board/chat.ts`, `engine/board/chat-claude.ts`, `engine/board/chat-codex.ts`, and `engine/board/coordinator.ts`
  (the read and the entry model); `createCodexClient` of `engine/lib/codex-app-server.ts`; `engine/board/README.md`,
  "Limits".

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0106](0106-the-board-carries-the-acts-of-the-coordinator-session.md), "Alternatives considered": the
  rejection of "the session files of the host" (approach E of the spec of #288, "E reads private files of an
  agent"). The board now reads the session record of the coordinator session, under the narrowed rule of
  "Decision", point 3. The other rejected approaches (B, C, D) stay rejected.
- [ADR-0106](0106-the-board-carries-the-acts-of-the-coordinator-session.md), "Context": "the board reads the text
  of the screen", for the log of the panel. The board builds the log from the session record. It reads the text of
  the screen only for the dialog lines of the state `dialog`.

## Context

After #288, the panel of the coordinator session showed the cleaned screen text of the Herdr tab (`hc read`) in one
`<pre>`: the box chrome, the status lines, and the spinner of the host TUI, only the visible screen while a turn
works, and the last 200 lines at an ended turn. The maintainer said: "the chat coordinator shown in the UI should
use some UI component not window of the CLI terminal", and "we need to have a web app chat ui in the browser using
the session messsages".

## Constraints and evidence

- ADR-0097 and ADR-0106 keep the session in its Herdr terminal, and a message, a key, an interrupt, and an end go
  through `hc`. The chat must not replace that transport (the research of the spec, "Approaches").
- Probe P2 (Claude Code 2.1.325, codex-cli 0.169.0, hc 0.1.19):
  - Claude transcript rows show during a turn. The `tool_use` row is in the file while hc reports `working` or
    `blocked`, before its `tool_result` row. The transcript holds no row for a dialog.
  - The Codex item list shows a call item (`commandExecution`) only when it completes. `userMessage`, `reasoning`,
    and `agentMessage` show during the turn.
  - The Codex thread `preview` equals the whole prompt of the launch, with its `Launcher attempt: <uuid>.` line,
    and one thread of `thread/list` matched.
- Rows of a real Claude transcript (the fix round of the read):
  - A text that a person sends while a tool runs reaches the transcript only as an `attachment` row of the type
    `queued_command`.
  - The bash mode of the host writes `<bash-input>` and `<bash-stdout>` rows. A background task writes a
    `<task-notification>` row.
  - A slash command writes a `<command-name>` row and a row with `isMeta: true`. Neither is a message of a person.
  - Only the first user entry that equals the launch prompt gives the launch note. A later equal text is a message.
- The Claude transcript format is internal to the host and has no promise of stability.
- The search of the record store for the literals that this record replaces (`grep -n -i` over
  `docs/adr/0*.md`): "private file", "session files", "text of the screen", "screen", "hc read", "200 lines",
  "log of the panel", "session record", and "rollout". The decision clauses with a match are the two clauses of
  "Supersedes". The other matches stay:
  - ADR-0097, "Context" and point 1, say that the engine had no command that reads the screen of a session. It is
    history and a rule of the commands, and the read of the board is no such command.
  - ADR-0106, "Decision", point 4, tells the maintainer to read the log of the panel before a second send. The
    chat is that log, so the clause stays true.
  - ADR-0076 and ADR-0058 name the screen read of a run or a hidden terminal. They are about other parts.
  - The other matches of "session record" (ADR-0033, ADR-0038, ADR-0039, ADR-0041, ADR-0075, ADR-0090, ADR-0102,
    ADR-0104) are about the session record of the engine, not the record of an agent.

## Decision

1. **The source of the messages is the session record of the host** (decision 7 of the maintainer, approach 1 of
   the spec). The session stays in its terminal. The engine knows its native session ID, and the board reads the
   new part of the record and turns it into one model of entries. A message that reaches the session in another way
   (the Herdr tab, or Remote Control of Claude Code) is in the record, so it shows as a message of the maintainer.
2. **The identity of the session.** The record of the coordinator session has the field `session`
   (`engine/lib/coordinator.ts`, schema 2). For Claude, the open chooses a UUID and passes it as the session ID. For
   Codex, the daemon finds the one thread of `thread/list` whose `cwd` is the main checkout and whose `preview`
   equals the launch prompt, and writes the ID into the record. The daemon is the one writer of the record (call 9).
   The board gets the ID only from `facts()` and checks it with `isSessionId` of its host before each read.
3. **The narrowed rule of the private files.** The board reads no private file of an agent, except the record of
   the coordinator session, found by the session ID from the engine. For Claude, the path comes from one scan of
   the folders of `projects/` under the config home for `<session-id>.jsonl` (call 10). The read refuses a symbolic
   link, a file outside that folder, and a file that changed during the read. For Codex, the board reads only
   through the app server, and never resumes, starts, or interrupts a thread.
4. **Two read mechanisms.**
   - **Claude:** the board keeps the byte offset of the transcript. Each poll reads the bytes after the offset, up
     to the last full line, and a row that does not parse is skipped.
   - **Codex:** the board uses one long-lived app server (`createCodexClient`), started at the first read and ended
     with the board. Each poll re-reads the last page of `thread/items/list`. An item anchor needs a `turnId` and
     does not reach an item of a later turn, so the read keeps a cursor of the list and not an anchor. The read
     sends no `thread/turns/list`.
5. **One model of entries for both hosts.** A message of the maintainer, a message of the coordinator, a step run
   (the calls between two messages, folded into one row), a note of the daemon (a small system line, never a
   message of the maintainer), and a dialog. Reasoning (`thinking`, `reasoning`), the subagent rows, and an
   unknown row give no entry (calls 2 and 6). The launch prompt, the injected skill text, and the command rows,
   the queued text, the bash rows, and the task rows of the transcript are classified by `claudeEvents` and
   `codexEvents` (call 12). An unknown row gives no entry and adds to a count that the board prints.
6. **The state comes from hc.** The state of the panel (works, dialog, ended turn) comes from the hc status, never
   from the turn status of the record. A failed read keeps the last good entries and shows its cause and its time.
   While the state is `dialog`, the read also gets the dialog lines from the visible screen, with an own error
   (call 11).
7. **The build way of the page** (call 1). The page builds the DOM with `createElement` and `textContent` in the
   style of the board, and has no new dependency. The server parses the Markdown of a message with
   `Bun.markdown.react`, which gives a plain tree of elements, and maps it to a tree of allowed nodes. A raw HTML
   node is text, and a link keeps only an `http:` or `https:` target. A tool input and a tool result are text with
   a length limit, and a cut text says how many characters it left out.

## Alternatives considered

- **Run the session under a protocol of the host** (the Codex app server with `codex --remote`, the Claude Agent
  SDK or `stream-json`). It gives live deltas and approvals as data. Rejected: it replaces the terminal transport of
  ADR-0097 and ADR-0106, needs two protocol clients and the first engine dependency for Claude, loses Remote Control
  for a session that the daemon runs that way, and has an open premise (a second client of a TUI thread).
- **Parse the screen text into a chat.** Rejected: each host TUI draws differently, and a parser of its chrome
  breaks with each release. No product of the research does it.
- **A chat library in the page** (deep-chat renders Markdown as HTML and so changes the rule of the page; assistant-ui
  and Vercel AI Elements bring React and more for one panel). Rejected: the board DOM and `Bun.markdown.react` need
  no dependency and keep the Content-Security-Policy.
- **A Markdown renderer that gives HTML.** Rejected: the page would then set HTML from a model text. The tree of
  allowed nodes needs no sanitizer.
- **A path of the transcript from the folder name rule of the host.** Rejected (call 10): the engine would copy an
  internal rule. The scan of `verifySession` finds the file.

## Consequences

- The panel shows the conversation of the coordinator, not the screen. A new entry shows within 3 seconds of the
  poll that finds it.
- **A Codex call shows when its item completes** (P2). A long Codex command is not in the chat while it runs. The
  state `works` still shows from the hc status. `plugins/celetis/docs/workflow.md`, "Acceptance status", records
  this limit.
- **The Claude transcript format is internal and can change.** An unknown row gives no entry and a logged count. A
  change of the known fields gives an empty or partial chat, not a wrong one. The Verify phase reads a real
  transcript of the installed version.
- **The dialog lines come from the visible screen.** The card shows what the screen shows, as plain text. The
  record has no pending approval, so the card takes the pending call from the last call with no result.
- A Codex coordinator has an empty chat ("The session starts") until `thread/list` shows its thread.
- The first read of an existing Claude session reads the whole file once. Later polls read only new bytes.
- The board now reads one file of an agent. The narrowed rule keeps that to the record of the coordinator session
  by an ID from the engine, so a request of the page cannot name another file.

## Reconsider when

- A host publishes a stable format or API for its session record, or for approvals and messages that both hosts
  share (approach 2 of the spec).
- A change of the Claude transcript or the Codex item list breaks the normalizer in a release.
- Codex lists a running call item before it completes.
- The board needs the record of a session other than the coordinator session.
