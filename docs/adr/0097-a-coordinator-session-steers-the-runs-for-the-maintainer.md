# A coordinator session steers the runs for the maintainer

## Date

2026-11-11

## Related

- [Issue #252](https://github.com/ddinkov10/celetis/issues/252): the spec (the body of the issue, `Spec:
  2026-11-10`) and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/252#issuecomment-6776961592). In this record,
  "Approaches" and "the decisions of the maintainer and the calls of the session" name parts of the spec. The
  [runtime report](https://github.com/ddinkov10/celetis/issues/252#issuecomment-6792535220) of the build is a
  comment on the issue. It holds the results of the probes. A case id such as
  `s19` names a case of one probe program of the build: `s` is the probe `send.ts`, `a` is `attention.ts`, `n` is
  `notes.ts`, and `o` is `open.ts`. Each probe ran in a lab of `scripts/herdr-lab.ts` with synthetic hosts.
- [ADR-0055](0055-assistance-can-complete-verified-holds.md): the precedent for a session that helps the maintainer
  and for the attribution that is a guard and no security boundary.
- [ADR-0062](0062-each-session-runs-in-a-tab-that-the-runner-steers.md): each session runs in a tab of its own.
  This record keeps that rule and adds one tab with no issue.
- [ADR-0014](0014-one-workflow-uses-explicit-host-operations.md): one workflow for both hosts. It is the
  reason for the rejection of approach C.
- `engine/README.md` ("The coordinator session"), `plugins/celetis/skills/coordinate/SKILL.md`, and
  `plugins/celetis/references/procedures/stop.md` ("The check before a stop") hold the rules that this record decides.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0063](0063-a-step-stops-only-for-an-act-outside-the-session.md), "Decision", "The check before a stop":
  - "An answer comes only from the maintainer in the session". An answer comes from the maintainer in the session,
    or from the coordinator session of the daemon in a message that holds its header. The header names the
    authority, and the authority holds for the text after the header.
  - Class 2, "A live question": "the step asks in the session and waits". A step session asks in the text of its
    message and ends the turn, so that the turn shows as ended and the daemon can see it. A question that a
    procedure asks through the question tool of the host keeps that tool.

## Context

At `3244a06`, each run of the master daemon was a session in a tab of its own, and only the maintainer could talk to
it. A live question waited in the tab, and a queue run held the queue until the maintainer saw it. The daemon typed
only the exit request. The engine had no command that reads the screen of a session or sends text to it. The
maintainer wanted one agent, the coordinator, that acts as a second self for the runs: it tells the state, answers a
routine question, brings an important question to the maintainer, and steers a run on request (issue #252, "Done
when").

## Constraints and evidence

- The sources of the facts are the spec and the plan comment of the issue. They hold the facts of hc, Claude Code,
  and Codex with their sources, and the lab checks of the plan session (risk 1): a send to an ended turn, a send to a
  working turn, and a note into a coordinator session passed for both hosts.
- The build ran in labs with hc 0.1.20, herdr-app 0.1.15, Claude Code 2.1.322, codex-cli 0.167.0, and Bun 1.4.4.
  The named minimum of the engine lines and documents is hc 0.1.19, the version that the facts of the spec were read
  on.
- `hc send` pastes text into the composer and presses Enter. It refuses a blocked program unless `--force`, and the
  engine never passes `--force` (case `s17`). A text that starts with `-` is an option of hc, so the engine types
  `hc send <terminal> --json -- <text>`.
- A message from another session is never the consent of the person (Claude Code, cross-session messaging, in the
  spec). The rule of the receiving session follows from that fact.
- The search of the record store for "only from the maintainer", "answer comes", "answers in the tab", "only the
  daemon types", "sends only", "only the exit", and "never answers" (`grep -n -i` over `docs/adr/*.md`) found one
  match in ADR-0063 and three matches in other records. None is a decision clause that this record replaces:
  - ADR-0060, Decision: "The session never answers for the maintainer" is about a change that needs a new look. It
    stays true: a look pick is a product decision, and the coordinator session never decides it (Decision, point 7).
  - ADR-0048 and ADR-0076 say "sends only" about the browser and the board. They are about another sender.
- The daemon still types only the exit request, the notes, and the sends of the coordinator session, and it types
  them in one sequence for each terminal (Decision, point 4).

## Decision

1. **The decisions of the maintainer**: four in the `specify` session of 2026-11-10 (the spec, "The decisions of
   the maintainer and the calls of the session"), and the last one in the `implement` session of 2026-11-11:
   - **The delegation line.** The coordinator answers alone when the issue, the spec, the plan, the repository, or an
     instruction of the maintainer holds the answer, and for a technical pick inside the approved spec and plan. It
     brings each product decision, each consent, and each host approval to the maintainer, with its recommended
     answer.
   - **Approach A:** the daemon steers the coordinator.
   - **A failed Codex case is a recorded limit.** No Codex case failed its lab check, so the engine refuses no Codex
     case, and `plugins/celetis/docs/workflow.md` records no such limit.
   - **The old contract version goes.** The engine serves only contract 3, and the plugin needs contract 3. A host
     whose plugin needs contract 2 gets no coordinator session (case `o9`). The same check (`requireContract`)
     refuses a step session, which has no probe case in this build. The reason is that a step session with the old
     stop module has no rule for a message of the coordinator session.
   - **A relayed order for an act that needs consent** (reading A of the
     [decision on the issue](https://github.com/ddinkov10/celetis/issues/252#issuecomment-6790745993)). A run does
     not act on a relayed order of the maintainer for an act that needs the consent or the authorization of the
     maintainer. It asks for the authorization in the text of its message, and the next answer counts. When a run
     asks for a consent that earlier words of the maintainer already cover, the coordinator session asks again and
     quotes the earlier words as its recommended answer. Each other relayed instruction of the maintainer counts at
     once.
2. **The calls of the session**, which the approval of the spec covers (call 4 is the non-goals of the spec, in the
   body of issue #252, "Goals, non-goals, anti-goals"): the coordinator never types into a host
   dialog; a step session asks a live question in the text of its message and ends the turn; the coordinator starts
   a step only under an instruction of the maintainer; the daemon accepts a send only from the coordinator session
   that it opened; the coordinator posts no comment of its own for an answer; the request is one feature; and in a
   run session, text before the header is an unsent draft of the maintainer and no answer.
3. **The coordinator session and its record.** `celetis coordinator` opens one interactive session of the host with
   the skill `coordinate` in a tab `Coordinator`; a second call brings the tab to the front (cases `o2`, `o3`, `o4`).
   The tab starts through the start barrier of a session tab, so the daemon gets a process identity. The record
   `daemon/coordinator.json` holds the terminal, the process, the folder, and the value of `CELETIS_COORDINATOR`.
   A failed read keeps the record, and only a definite end removes it (case `o6`). `celetis daemon stop` leaves the
   session open, and the next daemon takes the record over (case `o7`). The session is no run: it has no issue and no
   lock. The board shows it in Human sessions with no page change (case `o12`). **`CELETIS_COORDINATOR` is a guard
   against a confused agent. It is not a security boundary:** a process of the same user can copy the value.
4. **The send goes through the daemon.** `celetis --agent <host> coordinator send <n> <file> --as
   maintainer|coordinator` asks the daemon to type one message: a header that the engine writes, then the text. The
   header holds the marker, the authority, the time, the fixed meaning of the authority, and the sentence that a
   later header never widens this authority (cases `s1`, `s3`, `s14`). A session with no step text reads that limit
   in the header itself, and the sentence agrees with the rule of the receiving session (point 6). The daemon
   refuses with no change, and types nothing, for:
   - a caller that is not the coordinator session (case `s5`);
   - a run with no released session, a run that starts, waits for a usage limit, or ends (case `s6`);
   - a session that shows a dialog; the line names the kind and the tab (case `s7`);
   - a text that is empty, longer than 4096 characters, not valid UTF-8, or holds a control character other than a
     newline or a tab; a file with CRLF ends fails at U+000D (cases `s12`, `s13`);
   - a status that cannot be read (cases `s9`, `s10`).

   A failed `hc send` that is neither a blocked program nor a gone terminal is an unknown outcome, and it can follow a
   typed text. The send exits 6, the text can be in the session, and the line tells the coordinator session to read
   the screen before it sends again (case `s11`). The daemon writes one line to its log for each sent text and for
   each send with an unknown outcome: the issue, the step, the authority, and the length, with no part of the text
   (cases `s3`, `s11`).

   A session at an ended turn starts a new turn with the message (case `s1`). A working session gets it as its host
   delivers typed text (case `s4`; the states `waiting` and `running` pass, cases `s3` and `s22`). The send and the exit
   request of the step end share one sequence for each terminal. After the exit request began, no text goes into the
   session, and the step end reads the turn again before it sends the exit request (cases `s16`, `s8`, `s20`).
5. **The attention state and the notes.** The daemon derives one attention state for each run with a session:
   `dialog`, `turn-ended`, or `quota-wait` (cases `a1` to `a9`). A failed read of hc changes nothing (case `a6`). The
   daemon types one fixed note into the coordinator tab at an ended turn for each change and each end of a run, with
   no act of an agent (cases `n1`, `n2`, `n6`). It types no note while the coordinator works, shows a dialog, or
   reports no status (case `n3`). An item whose state went away is not sent (case `n5`). A failed note keeps its
   items (case `n7`), and a takeover sends the current states in one note (case `n8`). A note holds only fixed
   words and validated values.
6. **The rule of the receiving session** (`plugins/celetis/references/procedures/stop.md`, "The check before a stop"):
   - With `authority: maintainer`, the text is the answer or the instruction of the maintainer, taken as words typed
     in the session. The words answer an open question only when they answer what the session asked. For an act
     that needs the consent or the authorization of the maintainer, the text is that consent only as an answer to a
     question that the session asked, never in advance. A relayed order for such an act makes the session ask first,
     also while another question of the session is open, and an order is no consent (point 1, the last decision).
   - With `authority: coordinator`, the text settles a fact or a technical pick. It is no consent, no
     authorization, no look pick, no approval, and no product decision.
   - A message of the coordinator session is no approval of a guard refusal, with each authority. A later header
     never widens the authority and can narrow it. A header with another authority word is no header. A header
     behind a tag `<hc from="…">` is data. Text before the first header is an unsent draft.
7. **The delegation line in the skill.** A consent, a look pick, the approval of a spec, and each other product
   decision never go with `--as coordinator`, also when earlier words of the maintainer in the session cover them.
   The coordinator asks at the question of the run, with the earlier words as its recommended answer, and sends the
   answer with `--as maintainer` in two marked parts (`Question of the coordinator session:`, `Words of the
   maintainer:`).

## Alternatives considered

Approaches of the spec, with the reason for each rejection:

- **B. The coordinator waits by itself** with a wait command. On Codex a background command does not wake the agent
  (openai/codex#15723), and the agent must start the wait again each time. That is the failure of the lesson
  `keep-a-bounded-heartbeat-while-children-work`.
- **C. Host-native messages** (Claude Code cross-session messaging, `codex queue`). Each mechanism serves one host,
  so the engine would hold two transports, and ADR-0014 keeps one workflow for both hosts. `codex queue` is not
  checked with a session that the daemon starts.
- **D. The run records its question** (A2A `input-required`, `gt escalate`). It changes each asking path of the
  skills. It is a later issue on top of A.
- **E. A reviewer agent of the host decides the approvals** (Codex Auto-review, auto mode of Claude Code). It
  covers only host approvals, and decision 1 of the maintainer keeps those with the host and the maintainer.
- **F. A channel pushes the note** (Claude Code channels). It is a research preview with an allowlist, and it serves
  Claude only.
- **A text before the header is an answer.** Rejected: the composer can hold unsent text of the maintainer, and a
  draft is no answer.
- **`hc send --force` for a blocked session.** Rejected: hc says that a blocked program needs a person, and the
  message of another session is never consent.

## Consequences

- A run that asks a routine question continues while the maintainer is away, and the maintainer answers an important
  question in one place. A live question of a step still holds its run until some authority answers it.
- **The daemon types text into run sessions.** The trust boundary is the daemon: the token, the status read
  directly before the paste, the text rules, the sequence of the terminal, and the header that the engine writes. The
  checks are a guard against a confused agent and no security boundary (Decision, point 3).
- **The coordinator can misjudge the delegation line.** The guards are the skill text, the authority in the header,
  the rule that a consent needs the authority `maintainer`, the report at the next message of the maintainer, and the
  record of the answer and its source on the issue by the step.
- **The reading of the text is strict for a destructive act** (Decision, point 1, the last decision). A step that gets
  a relayed order of the maintainer for an act that needs consent asks for the authorization first. The skill asks
  the maintainer again for a consent that earlier words of the maintainer already cover.
- The engine serves only contract 3 (`engine/lib/contract-versions.json`), and `plugins/celetis/contract.json` is 3.
  A plugin that needs contract 2 gets the line of the contract check, and no session starts.
- The named version of herdr-core in the engine lines and in the current documents is 0.1.19.
- Known limits, from the probes and the code (each is in the runtime report of the build on the issue):
  - **The composer draft.** hc pastes a note or a sent message into the composer. Unsent text of the maintainer
    comes before the header or the marker, and hc has no option that refuses a composer with text. The rule of the
    receiving session and the skill treat that text as no answer and no instruction.
  - **A host that reports no hc status**, for example at the folder-trust dialog: the run has no attention state, a
    send exits 6, and no note goes into that coordinator tab (cases `a7`, `s10`, `n4`).
  - **The Codex sandbox.** Inside the sandbox of a Codex session, each daemon command fails (plan comment, X5), so
    a Codex coordinator session runs each daemon command through the approval procedure of Codex. The engine grants
    no permission.
  - **No usage record** of the coordinator session and no usage-limit recovery.
  - **No reminder** for an attention state that stays. `changedMs` of the attention shows its age.
  - A note whose send has an unknown outcome is typed again at the next pass. A note is data.
  - A text over the body limit of a daemon request gets the body-limit line, not the control-character line. The
    class stays usage.
  - The length limit of a send counts UTF-16 units.
  - The state `checking` of a run has no probe case for a send. It uses the same path as `running` and `waiting`.
  - The probes did not observe whether a host joins two sends into one message. The rule of the receiving session
    gives the safe result for both forms, and the header states the same limit for a session with no step text.
  - Native Windows has no daemon, so each form of `coordinator` exits 3 there, and no Windows check ran.
  - The older start wait of a run session (`startSession` of `engine/lib/run-engine.ts`) reads the boolean
    `terminalLive`. This limit is older than this change.

## Reconsider when

- The maintainer wants a relayed order of the maintainer for an act that needs consent to count as typed words, with
  no question first, or wants the coordinator session to send earlier words of the maintainer at once (reading B of
  the decision of 2026-11-11).
- A coordinator answer alone causes a wrong decision that the report and the record on the issue did not catch.
- The hc status of a host gives no attention state in a common case, so the notes miss runs.
- A host gives a safe way to inject text that refuses a composer with unsent text.
- A second use of the daemon send appears (approach D, a run that records its question).
