# A step session hands a stop to the issue: a comment, then `ready-for-human`

Source: ddinkov10/fwrh_calculator ADR-0017. Each issue number of this record is an issue of that repository.

## Date

2026-10-12

## Related

- #394 (this change): its `## Root cause` report holds the states of a session at the end of a
  turn, the two decisions, and the red repro
- #402: rule 2 of the step text. Its "Not now" puts the fix of #394 into the step text
- #415 and ADR-0008 (`docs/adr/0008-the-build-step-lands-the-change.md`): the stop after a refused
  landing stands. A step session now adds a label after the `## Landing refused` comment
- #418, on the trunk as `040f54c`: the resolver gives the card of a refused landing a reason of its
  own
- ADR-0002 (`docs/adr/0002-loop-script-and-mod-run-the-agent-flow.md`) and ADR-0005
  (`docs/adr/0005-herdr-gives-the-session-state-and-ends-each-step.md`): the step-end rule stands,
  unchanged
- ADR-0007 (`docs/adr/0007-specify-is-a-step-of-the-runner.md`): a `specify` session has no step
  text
- `.claude/agent-flow/step-prompt.md`, `.claude/agent-flow/step-prompt.test.sh`
- `docs/agents/agent-flow.md`, `docs/agents/issue-tracker.md`

## Context

A step session is a session that the runner, `scripts/agent-flow.sh`, starts with the step text,
`.claude/agent-flow/step-prompt.md`: each session of the runner apart from `specify` (ADR-0007).

The runner ends a session only when the line of the issue moves: its step-end job types `/exit`
only when `.claude/scripts/next-step.sh <n>` prints another line than the line that started the
session (ADR-0005). The skills were written for a session with a person at the terminal: at a stop
they "show the user" a message or "escalate to the user", and they write nothing that the resolver
reads. The step text, the one text that fits a skill to a session of the runner, had a rule for a
question (rule 2) and a rule for the landing (rule 3), and no rule for a stop or for a Verify
scenario that the session cannot run. So a stopped session stayed open, `claude` stayed in the
foreground of the script, and the script waited (#394).

Three states had no rule that moved the line:

- **A stop with the reason only in the chat**: a refusal of `scripts/worktree.sh`, gate attempt 4
  of `implement`, and a blocked hotfix.
- **A stop with a comment that moved no line**: the `## Landing refused` comment of `implement` and
  `chore`. After the maintainer left the session, the script printed `no progress`.
- **A Verify scenario that the session cannot run.** `implement` makes the Verify phase a hard gate
  with two results, PASS and FAIL, and no text covered a scenario that did not run. The
  `/implement` run of #387 asked the maintainer to run the scenario. The run of #385 recorded it as
  not run and went on.

## Constraints and evidence

Read on 2026-10-12 in the lane worktree of #394, with Claude Code 2.1.296, superpowers 7.0.0, and
herdr 0.9.3, where a line gives no other date.

The runner:

- `end_when_done` of `scripts/agent-flow.sh` runs the resolver at each `idle` or `done` of the
  agent. It types `/exit` only for a line that differs from the line that started the session and
  that is a `run` line or starts with `stop #<n> `. `run_issue` holds `claude` in its foreground
  (`scripts/agent-flow.sh:161`).
- herdr gives an agent that waits at a question in prose the state `idle` or `done`, and `blocked`
  only for a dialog (ADR-0005, of 2026-10-10; not read again). So a stop and a question have the
  same herdr state and the same line. The runner cannot tell them apart, so the session must.
- `bash scripts/agent-flow.test.sh` and `bash .claude/scripts/next-step.test.sh` print `PASS`. In
  their fixture world, an open issue with `ready-for-human` gives the line
  `stop #<n> is ready-for-human. …`, and the runner types `/exit` only after the line of the issue
  changes.
- Two stops moved the line with the label `ready-for-human` before this change, each after a
  comment: the human precondition of Land step 2 of `implement`
  (`.claude/skills/implement/SKILL.md:43`, #415), and the Terminal of `/hotfix` after a refused
  landing (`.claude/skills/hotfix/SKILL.md:58`).

Claude Code:

- Claude Code 2.1.296 returns this text to a session for a command that the auto-mode classifier
  denies: "If you believe this capability is essential to complete the user's request, first try a
  safer method. Get as much of the rest of the task done as you can, then STOP and explain to the
  user what you were trying to do and why you need this permission. Let the user decide how to
  proceed." So the platform sends a session to the person when it denies the command of a Verify
  scenario (a tool result of the `/bug` session of #394).
- "Auto mode also nudges Claude to keep working without stopping for clarifying questions, though
  Claude still asks when your prompt or a skill explicitly relies on it."
  (https://code.claude.com/docs/en/permission-modes)
- "A blocked action: Claude Code shows a notification and lists the action in `/permissions` under
  the **Recently denied** tab, where you can press `r` to retry it with a manual approval." (the
  same page, "When auto mode falls back")
- **The worktree guard.** In Claude Code 2.1.296, a session that entered a worktree refuses a Bash
  command when it cannot show that the command runs no git outside the worktree ("a
  worktree-isolated session's git operations must target its own worktree"). It refused
  `bash <file in the scratchpad>` and a `for` loop that ran `gh` with a variable (two tool results
  of the `/bug` session of #394). Rule 5 of the step text names this guard.
- `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`: "Set to `1` to remove built-in commit and PR workflow
  instructions and the git status snapshot from Claude's context."
  (https://code.claude.com/docs/en/env-vars)
- `claude -p --no-session-persistence --tools ""` runs one headless turn with no tools, and
  `--append-system-prompt-file <file>` appends a text to its system prompt (`claude --help`, and the
  turns below).
- `--permission-mode auto` is the flag with which `run_issue` of `scripts/agent-flow.sh` starts
  each session. A headless turn takes the flag. On 2026-10-12, two probe turns with the flag and no
  tools found no text on auto mode in their context: the first answered "no" to that question, and
  the second quoted each sentence of its context with the words "auto mode", "permission mode", or
  "clarifying questions", and none was on auto mode. So a headless turn does not show how auto mode
  acts on a session.

The headless turns. A case is a step, a verbatim excerpt of its skill, and the state at the stop. A
turn answers with its next acts and one end line for each case. A turn with the step text stands
for a step session, and a turn without it stands for a session that a person starts by hand. The
report of #394 ran three turns: the red repro and the second control each held four cases in one
turn. Each other turn below, of the build of #394 and of the test, held one case.

- **The red repro of the report of #394**: one turn that held the four cases, on the step text of
  `5ea974f` (rules 1 to 3). The cases are a refusal of `scripts/worktree.sh`, gate attempt 4, a
  refused landing, and a Verify scenario that the classifier denied. 0 of 4 cases added
  `ready-for-human`, and 4 of 4 waited for the person.
- **The two controls of the report**, one turn each. With the step text, one case with a state that
  the issue does not define (step 6 of `/bug`) gave a question and a wait, with no label. Without
  the step text, one turn that held the four cases gave 4 waits and no label.
- **The git status snapshot can change an answer.** A headless turn holds the git status snapshot
  of its checkout: the branch name, and the subjects of the last commits. The turns of the report
  did not remove it. After the first commit of the fix was on the lane branch, its subject stated
  the behavior that the cases assert, and 2 of 4 turns without the step text added the label. With
  `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`, 0 of 16 such turns added it, so the test sets the
  variable. The cause is supported and not proven: no turn changed only the commit subject. Each
  turn below ran with the variable.
- **The red repro with no snapshot**, one turn for each of the four cases on the step text of
  `5ea974f`: 0 of 4 added the label. Three cases waited for the person. The refused landing posted
  its `## Landing refused` comment and ended its turn with no label, so the line did not move.
- **A "stop and ask" of a skill went to the issue.** `superpowers:subagent-driven-development` names
  four stops, a destructive operation among them, and says "For those, stop and ask." The case is a
  task of a plan that deletes a database table. With a rule 4 that started with "A stop is not a
  question." and no more, 7 of 8 turns handed the stop to the issue and did not wait. On the step
  text of `5ea974f`, 3 of 3 turns waited. With the clause "where a skill says to ask, rule 2
  holds", 4 of 4 turns waited.
- **A stop with a label of its skill got a second label.** For the `needs-info` stop of `/triage`,
  2 of 4 turns added `ready-for-human` after `needs-info`. With the condition "when the skill adds
  no label for this stop", 0 of 4 turns added it.
- **The order of rule 5.** The first words of rule 5 gave the order of Land of `implement`: the
  removal of `ready-for-agent`, the comment, the label. No turn was read for that order. With the
  final words, the comment and then one command for the two labels, 2 of 2 turns on 2026-10-12, one
  for each case of a Verify scenario, posted the `## Before landing` comment and then ran
  `gh issue edit 7 --remove-label ready-for-agent --add-label ready-for-human` as their last act.
- **The run after a rule 5 stop lands.** The case is a built issue (a `## Plan` comment, no
  `ready-for-agent`, no `ready-for-human`) whose last comment is the `## Before landing` comment of
  a scenario that a session could not run. On 2026-10-12, 3 of 3 turns ran
  `scripts/land.sh 7 '<subject>'`, added no label, and did not wait. So rule 5 has no sentence on
  the next run: the re-entry rule of `implement` gives the landing.
- **A step that is done is no stop.** The end of `/plan` ("tell the user the plan is on the issue")
  and the last step of `/triage` ("Ask the human whether to proceed. … On no, stop"): on
  2026-10-12, 3 of 3 turns for each did the acts of the skill, added no `ready-for-human`, posted
  no `## Stopped` comment, asked nothing, and ended the step.
- **The two guards of a real question, with `--permission-mode auto`.** The state that the issue
  does not define (step 6 of `/bug`) and the task that deletes a table: 2 turns for each on
  2026-10-12. 4 of 4 asked and waited, with no label. The flag adds no text on auto mode to a
  headless turn (above), so these turns do not show the force of auto mode on a real question.
- **The final step text and the final `AGENTS.md`**: `bash .claude/agent-flow/step-prompt.test.sh`
  printed `PASS` in 2 of 2 runs on 2026-10-12. One run is 16 turns: cases 1 to 12 with the step
  text, and cases 1 to 4 without it.

## Decision

The maintainer made two decisions in the `/bug` session of #394 on 2026-10-12, each among four
options.

- **A stop that is not a question goes to the issue.** When its step cannot go on and no decision
  of rule 2 is open, a step session puts the reason on the issue and then adds `ready-for-human` as
  the last act of its turn. The comment that the skill posts for the stop (`## Landing refused`,
  `## Before landing`) is the reason. For a stop with no such comment, the session posts one
  comment with `## Stopped` as its first line: the step, the exact message or the failure trail,
  and the act of the maintainer that lets the step go on. The label moves the line to
  `stop #<n> is ready-for-human. …`, so the step-end rule ends the session, and the script goes on.
- **A Verify scenario that the session cannot run has no PASS, and the change does not land without
  it.** A guard that refuses the command of a scenario is a limit: the session tries one safer form
  of the command and takes no other route. It runs each other scenario. Then the scenario is a
  human precondition of the landing: the session posts a new `## Before landing` comment for this
  build, and then it runs one command,
  `gh issue edit <n> --remove-label ready-for-agent --add-label ready-for-human`, as the last act
  of its turn. The comment holds the scenario, its commands, the expected result, and the refusal.
  The removal marks the change as built, as Land step 1 of `implement` does.

The other parts of the decision:

- **The two rules live in the step text only**, as rules 4 and 5 of
  `.claude/agent-flow/step-prompt.md`. This change touches no skill, and it does not touch the
  resolver, the runner, `scripts/land.sh`, or the label set. So the rules reach each step session
  and no other session. `AGENTS.md` names that home and states no act of the two rules, because it
  loads in each session, also in a session that a person starts by hand.
- **Rule 4 has three limits.** A stop is not a question: where a skill says to ask, rule 2 holds,
  and a session that asks for a decision waits in its pane. The session adds `ready-for-human` only
  when the skill adds no label for the stop: a stop with a label of its skill (`needs-info` or
  `wontfix` of `/triage`, `ready-for-human` of `/hotfix` and of Land step 2) stays as the skill
  says. When GitHub does not answer, the session shows the message in its pane and stops.
- **Rule 5 posts the comment before it changes a label, and it changes the two labels in one
  command.** An issue with a `## Plan` comment and no `ready-for-agent` label reads as built: the
  next run of `/implement` lands it and runs no scenario. In the order of Land of `implement` (the
  removal, then the comment, then the label), a session that ends after the removal leaves a built
  issue with no stop, and the next run lands a change whose scenario did not run. With the comment
  first, a session that ends before the command leaves `ready-for-agent`, so the next run builds
  and verifies the change again.
- **The resolver names no `## Stopped` heading.** The label moves the line, and the card of the
  issue reads `ready for your step`.
- **The step text does not tell what the maintainer does after a stop.** A sentence such as "the
  maintainer starts the step again" directs no act of the session, and it is not true for each
  lane: after a stop of a hotfix whose landing stopped, the maintainer lands in their own shell
  (ADR-0008). `docs/agents/agent-flow.md` holds the acts of the maintainer.
- **The step text has a test, `.claude/agent-flow/step-prompt.test.sh`.** It is hand-run, as each
  other test of the harness is. It reads fixed strings in the answer of each headless turn, such
  as a label command, a heading, and the end line. It sets
  `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`, and it starts each turn with the step text with
  `--permission-mode auto`, as the runner starts a step session.

## Alternatives considered

For a stop that is not a question, the maintainer rejected three options:

- **The label only for a stop with the reason in the chat**, and no label after a
  `## Landing refused` comment. A refused landing then holds its script, as before.
- **A comment with no label.** The reason is then on the issue, but no line moves, and each stopped
  session still holds its script.
- **No change.** A stopped session holds its script until the maintainer leaves it, and the reason
  of three stops is in the chat only. This is the defect that #394 reports.

For a Verify scenario that the session cannot run, the maintainer rejected three options:

- **A record and a landing.** The session records the scenario as not run and lands. An unverified
  change then reaches the trunk.
- **A question in the pane.** The session asks the maintainer to run the scenario and waits. It
  holds its script.
- **An issue of its own.** The maintainer rejected it on 2026-10-12, as one of the four options. The
  report of #394 records the rejection and no reason, and this ADR adds none.

One more option, for the home of the two rules:

- **A rule in each skill, in place of the step text.** A skill also reaches a session that a person
  starts by hand, and the "Done when" of the report of #394 keeps the behavior of that session.
  #402 names the step text as the home of this fix.

## Consequences

- A stopped step session frees its script, and the reason of each stop is on the issue.
- A refused landing of `/implement` or `/chore` in a step session gives a `blocked` card with the
  reason `landing refused` (#418), not a `stuck` card with `no progress`. Each other stop at which
  the session adds `ready-for-human` gives a `blocked` card with `ready for your step`. The row for
  `no progress` with a `## Landing refused` comment goes from `docs/agents/agent-flow.md`.
- A new landing after a refusal needs two acts of the maintainer: the removal of the label, and a
  Run press. Before, it needed the exit from the session and a Run press. A label that the
  maintainer does not remove holds the issue.
- After a `## Before landing` stop for a Verify scenario, the next run of `/implement` lands the
  built change and runs no scenario: the PASS of that scenario is an act of the maintainer. After a
  FAIL, the maintainer keeps the label, puts the result on the issue, runs `/plan #<n>` in a
  session of their own, and removes the label when the new plan is on the issue: a Run press on a
  built issue with no label lands the change.
- A session that a person starts by hand and a `specify` session stay open at a stop, and they add
  no label.
- A session that asks for a decision still waits in its pane and holds its script. A rule that
  moves a real question to the issue is the "Not now" of #394.
- A stop that leaves a file that is not committed, in the lane worktree or in the main checkout,
  keeps the dirty-tree line: the resolver reads the working trees before the labels
  (`.claude/scripts/next-step.sh:102-104`). So the label does not end that session, and it stays
  open until `/exit`, as before.
- The rules reach a session only after they are on the trunk and the main checkout has them
  (`git pull`): the runner takes the step text from the checkout that holds the script.
- A run of the test costs model turns and needs a `claude` that is logged in. Each turn reads the
  instruction files of the checkout, so a change of the section "Agent flow" of `AGENTS.md` can
  change an answer.
- The two rules depend on how a model reads a skill: a stop or a question, a stop or a step that is
  done, and a label of the skill or none. The test has a case for the go-ahead question of
  `/triage`, and none for that of `/intake`, which is no step of the runner. It has no case for the
  `wontfix` stop of `/triage`, for a hotfix that landed, for a command of a task that a guard
  refuses, for a rule 5 stop of a change that also needs another act of the maintainer, or for a
  GitHub that does not answer.
- Three premises are not verified:
  - A headless turn with no tools gives what a session says that it does. It is not a live session
    of the runner. When a live session adds no label at a stop, it stays open as before, which is
    no regression: the fallback is a `/bug` with the transcript, and a new case of the test.
  - The answer of a model differs between runs. A case that passes in two runs can fail in a third.
  - No live session showed that the runner ends a session after the label `ready-for-human`. The
    fixture tests show the two halves: the resolver gives the `stop` line for the label
    (`.claude/scripts/next-step.test.sh`), and the runner types `/exit` when the line of the issue
    changes (`scripts/agent-flow.test.sh`). No fixture ends a session on an `is ready-for-human`
    line. ADR-0007 holds the live proof of the step end for other lines. If the premise is false,
    the session stays open until `/exit`, as before.

## Reconsider when

- A step session stays open after it added `ready-for-human`: the premise on the step end is then
  false.
- A step session adds the label at a real question in place of asking, or it asks at a stop.
- The resolver gives the comment of a stop a `stop` line of its own. Since #418 it reads
  `## Landing refused` only for the reason of an issue that has the label. With a line for the
  comment, the label is not the only signal that ends a session.
- Claude Code gives a session a supported way to end itself.
- `specify` gets the step text: rules 4 and 5 then reach a session that waits for the approval of a
  design.
