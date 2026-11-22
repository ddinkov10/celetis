# The coordinator session starts assist runs for held issues

## Date

2026-11-21

## Related

- [Issue #361](https://github.com/ddinkov10/celetis/issues/361): the feature, its spec (dated 2026-11-21) in the issue body, its [plan comment](https://github.com/ddinkov10/celetis/issues/361#issuecomment-7068294046), and the Verify evidence on the issue.
- The maintainer decisions of 2026-11-21, recorded as comments on issue #361:
  [denial ends the cover](https://github.com/ddinkov10/celetis/issues/361#issuecomment-7069044817),
  [order is the allow](https://github.com/ddinkov10/celetis/issues/361#issuecomment-7069331310), and
  [any such end ends the cover](https://github.com/ddinkov10/celetis/issues/361#issuecomment-7069565970).
- [ADR-0097](0097-a-coordinator-session-steers-the-runs-for-the-maintainer.md): the coordinator session. Its decision point 2, "the coordinator starts a step only under an instruction of the maintainer", stays true, and it now covers an assist run. The daemon still types only the exit request, the notes, and the sends.
- [ADR-0055](0055-assistance-can-complete-verified-holds.md): the assist session and `issue <n> assisted`. Its hold clearing stays. The allow rule of this record applies only to an assist session that the coordinator session starts.
- [ADR-0101](0101-a-run-session-tab-never-takes-the-focus.md): a run tab opens in the background. The assist tab does too, and this record changes no rule of that record.
- [ADR-0109](0109-a-set-aside-record-keeps-auto-mode-away-from-an-issue.md): a board Stop adds the issue number to the set-aside record. A board Stop of an assist run does the same. This is the shared halt rule.
- [ADR-0075](0075-the-names-of-the-workflow-the-daemon-and-a-run.md): the name map of the commands. This record adds `run assist <n>` and `coordinator end <n>` and changes no name in it.
- [ADR-0126](0126-a-local-tracker-in-the-git-bug-format.md) and [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the contract version rule. This record raises the contract to 12 by that rule. The engine keeps serving contract 11 and 12, and ADR-0126 keeps its text as the record of contract 11.

## Supersedes

Only these sentences change. The accepted records keep their historical text.

- [ADR-0055](0055-assistance-can-complete-verified-holds.md), "Decision", the sentence "It records answers with their sources and acts on those answers without another workflow confirmation.": for an assist session that the coordinator session starts, the removal of the hold waits for an allow of the maintainer (the rule of "The allow" below). The other sentences of that clause stay.
- [ADR-0109](0109-a-set-aside-record-keeps-auto-mode-away-from-an-issue.md), "Decision", "Removal at admission", and in "A fail-closed read" the sentence "An explicit start also fails then, because its removal at admission cannot read the file":
  - An assist run is not an input that removes a number. The list "a number run, a resume run, and each issue that a queue run admits" does not hold an assist run. A start of an assist run reads no set-aside record and removes no number.
  - The other sentences of "Removal at admission" stay. A refused start keeps the record.
- [ADR-0096](0096-the-lanes-of-auto-mode-are-tracked-policy.md), "Decision", point 5, the sentence "A run has one of four input kinds.": a run has one of five input kinds. The kind `assist` has no lane test, as the kinds `number`, `queue`, and `resume` have none. The other sentences of point 5 stay true.
- [ADR-0097](0097-a-coordinator-session-steers-the-runs-for-the-maintainer.md), "Decision":
  - Point 1, the last bullet, the sentence "A run does not act on a relayed order of the maintainer for an act that needs the consent or the authorization of the maintainer.", and point 6, the first bullet, the sentence "A relayed order for such an act makes the session ask first, also while another question of the session is open, and an order is no consent (point 1, the last decision).": in an assist session that the daemon starts for the coordinator session, while the allow question of the hold removal is open, an order of the maintainer for that removal is the allow. With no open question, the order makes the session ask first. An order of `authority: coordinator` never allows it. The other rules of point 1 and point 6 stay.
  - Point 4, the sentence "After the exit request began, no text goes into the session, and the step end reads the turn again before it sends the exit request": the sentence holds only for the exit request of the step end. An assist run has no `exiting` state, so after an accepted `coordinator end <n>` a `coordinator send <n>` is still typed while the host of the session is live (Known limits). The exit request of `coordinator end <n>` uses the same sequence of the terminal as the send. The other sentences of point 4 stay.

## Context

An issue that a step parks with a hold (`needs-info` or `ready-for-human`) waits until the maintainer opens an assist session. The coordinator session only reports the hold. On 2026-11-21 the coordinator did the assist work of #335 itself, but only after the maintainer said "I authorize you to do it". The maintainer wants the coordinator session to start the assist session on request, so that the maintainer opens no assist session for each hold.

## Constraints and evidence

- The daemon watches an assist session the way it watches a resume run. A resume run has no step-end watch. The attention state of an assist run is `turn-ended` by the rule of a resume run (row 6 of the attention state in `engine/README.md`).
- The engine has no session record for an assist run. The record of the stopped step stays, so `run resume <n>` still reopens that step after the assist run ends. An issue lock refuses a second run of the issue. This gives one session for each issue.
- The run input `kind` gets the member `assist`. `unwatched(kind)` in `engine/lib/run/machine.ts` holds the resume and assist kinds, and the run machine in that file uses one scope `unwatched` for both. `engine/lib/run/engine.ts` exports `unwatched` again for the daemon and the coordinator dispatcher.
- `celetis coordinator end <n>` sends the exit request of the host, as the step end does. It refuses each run that is not an assist run.
- The receiving session asks the allow in the text of its message and ends its turn. The guard is the skill text and the `authority` header that the engine writes. The engine does not know who allowed the removal, so the guard is against a confused agent and no security boundary (ADR-0097).
- The project uses only Claude Code. The Codex path is not checked. The exit request works on Codex as ADR-0058 describes, but no assist run ran on Codex.

## Decision

1. **The start.** `celetis --agent <host> run assist <n>` asks the daemon, with `POST /assist`, to open an assist session for an issue. The daemon refuses with no change, and types nothing, when:
   - the issue has no `needs-info` or `ready-for-human` hold (exit 3);
   - the issue is closed (exit 3);
   - the issue lock is taken by a live run or another assist run (exit 3);
   - the issue cannot be read (exit 6);
   - the daemon stops, or the request reaches it before the end of the takeover of its runs (exit 3);
   - no host can start the session, for example when each default agent is blocked or the host program is not available (exit 3);
   - the plugin of the host needs a contract version that the engine does not serve (exit 3);
   - the skill `assist` of that plugin cannot be read (exit 3).

   This is not the whole list. Each failed check of the request admission of the daemon (`engine/lib/daemon/server.ts`) and of `prepareAssist` (`engine/lib/run/activities.ts`), for example a failed setup check of `gh`, `hc`, or the Herdr app, ends the start before a tab opens, with the line and the code of its cause.

   The session runs in the main checkout with the input `#<n> coordinator`. That input tells the skill `assist` that the coordinator session started it. The tab `#<n> assist` opens in the background.
2. **The watch.** The assist run is a run of the daemon. It has a row in `GET /status`, holds the issue lock until the session exits, and gets the attention states and the notes. `coordinator read <n>` and `coordinator send <n>` reach it as they reach a run session.
3. **The allow.** In an assist session that the coordinator session starts, `issue <n> assisted` runs only after an allow of the maintainer. Before the command, the session asks the maintainer in the text of its message: it names the report and each label that it removes, and it ends its turn. Only an `authority: maintainer` text that answers that question allows it. While the question is open, an order of the maintainer for that removal is such an answer. A text with `authority: coordinator` never allows it. A denial keeps the hold, and the session reports the denial. The report of `issue <n> assisted` names the allow and its source: the words of the maintainer with the time of their header.
4. **The end.** `celetis --agent <host> coordinator end <n>` sends the exit request to an assist run that waits at an ended turn. The daemon checks the token, the run, the terminal sequence, and the host status before it sends the request. A `working` or `blocked` session refuses. A failed request exits 6, and the line tells the coordinator session to read the screen before it ends the session again.
5. **The end adds no state.** The end adds no `set-aside` row and starts no step. The hold, or its clear, stays on the issue as the assist session left it. After the clear, the normal run or auto mode starts the next step.
6. **The ending of the cover.** When an assist run ends with the hold still on, for any reason (a denial included), the coordinator session reports the end and the hold. Only a new request of the maintainer that names the issue covers another assist run of that issue. The other instructions of the maintainer stay.
7. **The skills.** The skill `coordinate` starts an assist run on a request of the maintainer that covers the issue. It never answers the allow with `--as coordinator`. The skill `assist`, in a session that the coordinator session started, asks the allow as in point 3. An assist session that the maintainer starts directly keeps the rules of ADR-0055.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: a hold no longer needs the maintainer to open and work an assist session; the maintainer gives one allow in the coordinator session.
- Serves: 1 Intent to release: a held issue moves on sooner to its next step.
- Hard limits and non-goals: none touched. The assist run lands nothing and approves no update.

## Alternatives considered

- **A second record set for assist sessions**, with its own barrier, attention state, and notes. Rejected: it copies the run machinery and needs its own lock against a run of the same issue.
- **The coordinator session opens the existing unwatched tab** of the board press Assist and polls it. Rejected: the daemon types no note, so the coordinator must poll, and no lock keeps a run off the issue. ADR-0097 rejected a coordinator that waits by itself.
- **Host-native helpers** (Claude Code agent teams, a subagent of the coordinator). Rejected: they serve Claude only, they have no board card, and ADR-0014 keeps one workflow for both hosts.
- **An order always allows the act.** Rejected by the maintainer's decision 2: the order allows only while the allow question is open. With no open question, the order makes the session ask first, as ADR-0097 states.

## Consequences

- The maintainer gives one allow for each hold in the coordinator session, and opens no assist session for each hold.
- The daemon and the board show an assist run as a live card with Go, and the maintainer can type into its tab at any time.
- A successor daemon adopts a live assist run from its run record, as it adopts a live resume run.
- The guard of the allow is the skill text and the header. The engine does not check it. A confused assist session that clears a hold with no allow is not stopped by the engine.
- The contract version becomes 12. The engine serves 11 and 12, and the plugin needs 12.

Known limits:

- **No usage record** of an assist run, and no usage-limit recovery.
- **A second `coordinator end <n>`** before the host exits sends a second exit request. An assist run has no `exiting` state.
- **The end of the cover lasts for the rest of the coordinator session.** A later hold of the same issue, which is a different hold, also gets no new assist run until the maintainer makes a new request.
- **A send after the exit request** is typed into the session. The exit request is not checked against a later send.
- **A board Stop of an assist run** adds the issue number to the set-aside record, as a Stop of a resume run does. The issue then stays set aside after the assist run.
- **The start does not check the set-aside record.** An assist run starts for an issue that is set aside, and the set-aside record stays unchanged. The spec decides this behavior ("The start"): "An issue that the maintainer set aside stays set aside after the assist run."
- **The composer draft.** A send can join an unsent draft of the maintainer in the assist tab. The receiving rule treats text before the header as no answer. The exit request of `coordinator end <n>` has no header. On Claude Code it is `hc send <terminal> /exit`, the hc call of a send, so it can join such a draft in the same way (`engine/README.md`, "The limit of the composer"). The draft and `/exit` can then go into the session as one input: the end can exit 0 while the session stays open, and the session reads the draft as words that the maintainer typed. No check observed this case with a real host.
- **A direct assist session takes no issue lock.** `celetis assist <n>` and the board press Assist open a session that is no run, and the daemon does not see it. So `run assist <n>` can start a second assist session for an issue next to a direct session, and `celetis assist <n>` can start one next to an assist run. The refusal of a second session holds only between sessions that take the issue lock: a run and an assist run. The spec keeps the direct path unchanged and unwatched (its call 3), and it names "two assist sessions" as an anti-goal. The maintainer accepted this case as a known limit on 2026-11-22, with no code change ([the decision on the issue](https://github.com/ddinkov10/celetis/issues/361#issuecomment-7076531045)).
- **An exit 6 at the end of a daemon stop.** In the short window between the close of the socket and the exit of the process at the end of a stop, `run assist <n>` can exit 6 with the line of a daemon that does not answer, and nothing starts. The spec says exit 3 for a stopping daemon. The cause is the shared client path of the `run` forms, not code of this record. The maintainer accepted this case as a known limit on 2026-11-22, with no code change ([the decision on the issue](https://github.com/ddinkov10/celetis/issues/361#issuecomment-7077509453)).
- **Codex** is not checked, because the project uses only Claude Code.

## Reconsider when

- The coordinator session starts an assist run for a hold of a different kind, for example a set-aside issue or a dirty tree.
- The engine gets a check of the `authority` header, or the host gives the engine the identity of the person who allowed the removal.
- A second end, or a send after an exit request, causes a lost or duplicated answer in a live run.
- The project starts to use Codex for the coordinator session, or the Codex path of the exit request fails.
