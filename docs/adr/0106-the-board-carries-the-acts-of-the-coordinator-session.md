# The board carries the acts of the coordinator session

## Date

2026-11-12

## Related

- [Issue #288](https://github.com/ddinkov10/celetis/issues/288): the spec (the body of the issue, `Spec:
  2026-11-10`), the [plan comment](https://github.com/ddinkov10/celetis/issues/288#issuecomment-6831322244), and the
  [lab check of real host dialogs](https://github.com/ddinkov10/celetis/issues/288#issuecomment-6831840506), and
  the [lab facts of hc with a draft](https://github.com/ddinkov10/celetis/issues/288#issuecomment-6832824328). In
  this record, "call <n>" names a call of the session in the spec ("The decisions of the maintainer and the calls of
  the session"), and "D1" and "D2" name the decisions of that lab check. A case name such as `say-draft` names a case
  of the probe of Task 2 in the plan comment.
- [ADR-0097](0097-a-coordinator-session-steers-the-runs-for-the-maintainer.md): the coordinator session, its record,
  its notes, and the send to a run session. This record keeps each of them, and adds the acts of the board.
- [ADR-0076](0076-the-board-presses-are-requests-of-the-master-daemon.md) and
  [ADR-0077](0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md): each board press is a request
  of the master daemon, through the in-process dispatcher. The acts of this record are methods of that dispatcher,
  so these records stay unchanged.
- [ADR-0080](0080-the-daemon-ends-a-claude-host-with-sigterm-after-a-grace.md): "The daemon sends no SIGKILL, no
  second request, and no key to a dialog" is about the end of a run session. It stays: the key of this record goes
  only into the coordinator session, on a press of a person.
- `engine/README.md`, "The coordinator session"; `coordinator` of `BoardDaemon` in `engine/board/adapter.ts`;
  `act`, `facts`, and the quiet open of `engine/lib/coordinator.ts`; `pressKeys` and `interruptTerminal` of
  `engine/lib/terminal.ts`.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0097](0097-a-coordinator-session-steers-the-runs-for-the-maintainer.md), "Decision":
  - Point 2, "the coordinator never types into a host dialog". The engine still types no text into a host dialog,
    and no key into a run session. One case is new (call 4): one key of the fixed table, on one press of a person on
    the board, into the coordinator session, while its host shows a dialog.
  - Point 3, "The board shows it in Human sessions with no page change (case `o12`)". The coordinator session is no
    item of the strip Human sessions. Its one place on the board is the header control `Coordinator` (call 7).
- [ADR-0101](0101-a-run-session-tab-never-takes-the-focus.md), "Decision":
  - Point 1, "A tab that a person opens (a press or a command of the person, for the person to work in at once)
    takes it." The press of the header control `Coordinator` opens the tab `Coordinator` with no focus move, because
    the person works in the panel of the board, not in the tab. The row of `celetis coordinator` in the table of
    point 1 stays.
  - Point 3, "the open of `engine/lib/coordinator.ts`, pass `focus: true`", and "the bring to front of a live
    coordinator tab call `focusTerminal`". Only `celetis coordinator` passes `focus: true` and brings a live tab to
    the front. The open of the board passes `focus: false` and calls no `focusTerminal`.
  - Point 4, "The matches of the word `quiet` that remain in `engine/` and `scripts/` are another role". `open` of
    `engine/lib/coordinator.ts` has an argument `quiet` with the focus role again: the dispatcher passes it in the
    daemon process for the open of the board. The rest of point 4 stays: no form has `--quiet`, and no request of
    the socket, no run input, and no record has a field `quiet`.
- [ADR-0003](0003-a-local-web-board-starts-each-step-in-herdr.md), "Decision", the trust boundary of the server:
  "the page sends a number or an id, never a command". For the coordinator session, the page also sends one text of
  at most 4096 characters or one key name of the fixed table. It never sends a command, a path, or a terminal id.

## Context

After #252, the coordinator session ran only in the Herdr tab `Coordinator`. The maintainer read it, wrote to it,
and answered a dialog of its host only in that tab. The maintainer said: "i want to manage the coordinator from the
UI in the browser not from herdr tab", because "the board is the entry point of the UI". The spec picked approach A
(decision 2 of the maintainer): the board reads the text of the screen, and the daemon types a message, presses a
key, interrupts a turn, and ends the session, all in the terminal of #252.

## Constraints and evidence

- `hc keys` presses a key in each state of a program, also at `blocked`; `hc send` refuses a blocked program unless
  `--force` (the spec, "Design probes", P1). So the state check of the daemon is the one guard that a key goes only
  into a dialog, and hc itself refuses a message into a dialog.
- `hc send` waits for an unsent draft of a person, for the draft wait of hc (60 seconds by default; the spec,
  "External facts"). `hc interrupt` watches for an effect for 10 seconds by default, and answered
  `{"key":"esc","outcome":"stopped"}` on a working turn of each real host (D1 and D2).
- In a lab of the build (hc 0.1.20, a draft wait of 20 seconds, a synthetic program;
  [lab facts](https://github.com/ddinkov10/celetis/issues/288#issuecomment-6832824328)), a draft of a person held
  `hc send`, also `hc send <terminal> /exit`, for the draft wait. Then hc pasted `/exit` after the draft and
  pressed Enter. It held `hc keys` only for about 2.5 seconds, and `hc interrupt` pressed the stop key at once.
- The seven keys `up`, `down`, `enter`, `esc`, `1`, `2`, and `3` answered each permission dialog of Claude Code
  2.1.322 and each approval dialog of codex-cli 0.167.0 that the lab check opened (D1). Each act passed for Codex
  (D2), so the engine refuses no Codex case.
- The search of the record store for the literals that this record replaces (`grep -n -i` over `docs/adr/0*.md`):
  "host dialog", "key to a dialog", "Human sessions", "no page change", "pane.focus", "focus: true", "takes the
  focus", "to the front", "the page sends", "never a command", "sends no", "no text", "hc keys", "hc interrupt",
  and "quiet". The decision clauses with a match are the six clauses of "Supersedes". The other matches stay:
  - ADR-0003, ADR-0058, and ADR-0062 name `pane.focus` for Go and for a focused press. Both stay. The other
    matches of "to the front" and "takes the focus" are about Go (ADR-0009, ADR-0062), a browser window
    (ADR-0100), a clause of ADR-0062 that ADR-0101 replaced, and the run session tabs of ADR-0101.
  - ADR-0097, Decision, point 3, "a second call brings the tab to the front", is about `celetis coordinator`, and
    it stays.
  - ADR-0058 names `hc keys` as the exit request of Codex. It stays.
  - ADR-0080, "no key to a dialog", is about the end of a run session (Related).
  - The other matches of "sends no" and "no text" are about other parts (a model field, a crash report, a
    notification, status files, a type check).
  - The other matches of "quiet" in ADR-0101 (Supersedes, Context, "Constraints and evidence", the other
    sentences of point 4, point 6, "Alternatives considered", and Consequences) are about the option `--quiet` and
    the field `quiet` of the forms, the socket requests, the run inputs, and `--auto`. They stay gone, and this
    record adds none of them.
  - ADR-0058 and ADR-0062 name the quiet tabs of a Run and a Queue press and the option `--quiet`, and ADR-0073
    and ADR-0077 name its value in a request and in `--auto`. ADR-0101 removed that option and that field. The
    background open of ADR-0058 (`hc run --bg` with `herdr.space`) stays, and the open of the board uses it.
  - ADR-0004 (a quiet button), ADR-0012 (an update that fails quietly), ADR-0075 and ADR-0102 (a quiet machine),
    and ADR-0078 (a quiet stream) use the word with another meaning.

## Decision

1. **The board carries the acts** (calls 1 and 9). The dispatcher of the daemon (`BoardDaemon`) gets three
   methods for the board in its process: `facts`, the quiet open, and `act` with one of four acts: a message
   (`say`), a key (`key`), an interrupt, and an end. They are no paths of the socket: `POST /coordinator/say`,
   `/coordinator/key`, `/coordinator/interrupt`, and `/coordinator/end` get 404 there (case `socket`). While the
   daemon stops or takes over, the open and `act` answer the line of that state with code 3, as a board request
   does (case `act-stopping`). `facts` has the record in the takeover too: the daemon reads the coordinator record
   before it opens the board, so no read of the board shows a live session as no session.
2. **One target, one sequence, the state first.** An act names no terminal: its one target is the terminal of the
   coordinator record. It runs in the sequence of that terminal with the notes, so each act waits for the act before
   it, and a note and a message are two pastes (cases `say-twice`, `note-order`). In the sequence, the daemon reads
   the process of the barrier and `hc get` of the terminal directly before the act. A failed read is no state and no
   end: it refuses with code 6 and keeps the record (case `read-fail`). The state permits the acts:

   | State | hc status | Acts |
   | --- | --- | --- |
   | `none` | no record | the open |
   | `starting` | none | Go only |
   | `dialog` | `blocked` | a key, Go |
   | `works` | `working` | a message, an interrupt, Go |
   | `turn-ended` | `idle`, `done`, or `error` | a message, an end, Go |

   Each other act refuses with code 3 and a line that names the state. A malformed act, a key outside the table,
   and a text that the rule of the send of ADR-0097 refuses get code 2. Each refused act types nothing.
3. **A key into a host dialog** (calls 4 and 5, D1). The key is one of the seven keys of the fixed table, and only
   in the state `dialog`. The daemon presses it with `hc keys <terminal> <key> --json` (case `key-ok`).
4. **A message has no header.** It is the text of the maintainer, typed as the maintainer types it in the tab:
   `hc send <terminal> --json -- <text>`, with no `--force` and no `HC_TERMINAL_ID` (cases `say-ok`, `say-dash`,
   `say-slash`). The call waits at most 90 seconds, above the draft wait of hc. At the bound, the outcome is unknown
   (code 6), and the line tells the maintainer to read the log of the panel before a second send (case
   `say-draft`).
5. **An interrupt and an end** (call 6). An interrupt is accepted when hc names the stop key that it pressed; the
   next read shows the effect. An end sends only the exit request of the host, as the step end does, and is possible
   only at an ended turn. The exit request of Claude is a message, so the end waits with the bound of a message.
   The record goes only when a definite read shows that the barrier is gone (case `end-ok`).
6. **The log of the daemon** gets one line for each act: the act, and the length of the text or the name of the
   key. It never gets the text.
7. **The quiet open.** The open of the board uses the default agent order (call 10) and opens the tab with no focus
   move, as a run session tab opens. With a live session, it answers `opened: false` and moves no focus (case
   `quiet-open`).

## Alternatives considered

- **The terminal in the page, a structured chat over a host protocol, the remote page of the host, and the session
  files of the host** (approaches B to E of the spec). The maintainer picked approach A. B needs the first
  dependency of the page and a weaker Content-Security-Policy, C replaces the terminal of #252 with one protocol
  client for each host, D serves Claude only and is outside the board, and E reads private files of an agent.
- **`hc send --force` to answer a dialog.** Rejected: it types text into a host dialog.
- **A free key name from the page.** Rejected: the page sends one name of the fixed table, and the daemon takes a
  key only from that table.
- **The four acts as socket requests.** Rejected (call 9): each process of the same user, also an agent session,
  could then type into the coordinator session through the daemon.
- **The read of the barrier before the sequence.** Rejected: two acts at once could then enter the sequence in
  another order than their calls, and the read would not be directly before the act.

## Consequences

- The maintainer reads, writes to, answers, interrupts, and ends the coordinator session from the board. The Herdr
  tab stays as a second way.
- **A key can arrive after the dialog closed** (risk 4 of the spec). The daemon reads the status directly before the
  press, and a host can close its dialog in that moment. The key then goes to the prompt of the host.
- **A program of the same user can forge a request of the page** (risk 5 of the spec). The checks are a guard
  against a confused agent, not a security boundary, as for each board press.
- **A message that starts with `/` is a command of the host** (risk 7 of the spec): `/exit` ends the session.
- **End session has no confirmation** (call 6, risk 8 of the spec). The maintainer starts a new session with one
  press.
- A message and an end wait at most 90 seconds, a key 15 seconds, and an interrupt 30 seconds. A draft holds a key
  only for the short pause of hc, and an interrupt not at all.
- **A message or an end with a draft in the tab.** hc waits for the draft, then pastes the text (or `/exit`) after
  it and presses Enter, so the composer submits the draft and the text as one input. What a real host does with
  that input is not observed in this build; the Verify phase checks the real hosts.
- **An act in flight at a stop of the daemon can get no answer.** The build decided that the stop stays as it
  is for an act: it waits at most 5 seconds for an act in flight and does not abort it. A wait for the 90 seconds
  of a message makes each stop and each restart slow, and an abort is a cancel (call 12: a send in flight has no
  cancel). An act that takes longer gets no answer, and its text can still arrive in the session. The page shows a
  failed request and keeps the text; the line of an unknown outcome tells the maintainer to read the log before a
  second send.
- **A note never waits behind an act in flight.** While an act of the board is in flight, the loop types no note
  and keeps its items for a later pass. So a stop of the daemon does not wait, behind a note, for the 90 seconds of
  a message. A daemon that takes over the record gives each run with an attention its item again (ADR-0097).

## Reconsider when

- A common dialog of a host needs a key outside the seven keys (call 21).
- A Codex act fails its lab check (call 16).
- A host gives a protocol for messages and approvals that both hosts share (approach C).
- hc gets an option that refuses a composer with unsent text.
