# The stop

How a step stops when it cannot go on, and which act ends a step. The skills and the step text
cite it.

## Contents

- **The two modes:** a stop in an interactive session, and a stop in a step session.
- **The check before a stop:** agent work, a live question, or a hold.
- **A stop in a step session:** the reason on the issue, and the label that ends the session.
- **A Verify scenario that cannot run:** a guard refusal, the `## Before landing` hold, and its
  re-entry.
- **The act that moves the line:** the last act of the turn.
- **Claude Code** and **Codex:** how the maintainer lifts a guard refusal in the session.

## The two modes

A skill stops when it says to stop, to show the user a message, or to escalate to the user.

Before the terminal message or issue act, when useful task incident evidence exists, apply
`<plugin>/docs/procedures/lesson-capture.md`. Reuse a checkpoint already handled in the turn.
This adds no repair attempt. An entry read denial or another access stop takes precedence:
perform no capture access that the stop prohibits. A capture block leaves the original terminal
act and its order unchanged.

Before a stop in either mode, apply "The check before a stop": a stop stays only for an act
outside the session (its class 3).

- **In an interactive session**, which has no step text: show the user the message, and stop.
- **In a step session**, which the runner started with its step text: hand the stop to the issue
  ("A stop in a step session").

The message of a block (a denied path, a missing tool, or an unsupported operation) names the
exact block and the setup action. The block stops only the work that depends on it: continue each
independent check.

## The check before a stop

Before the step stops, sort each act that the stop would ask of the maintainer into one class:

1. **Agent work.** The session can do the act within its host permissions, the approved spec, and
   the plan: do it, and go on. Examples are a conflict with the trunk, a fix of an error of this
   session, a re-run of a check, and a wait for a resource of this session that frees itself.
2. **A live question.** The maintainer can settle the act with an answer in words (a yes, a no, a
   pick, or a value that the maintainer knows without an act elsewhere), and the answer lets this
   session go on. Ask in the session (in a step session, by rule 2 of the step text): name the
   exact act and why the step needs it, then wait. If the session ends with no answer, the next run of the step asks again.
3. **A hold.** The act needs the maintainer outside the session, or no answer lets this session go
   on: make the stop by the rules of its mode. The acts outside the session are another machine or
   device; an account or an identity that the session does not have; a host trust or confirmation
   prompt that only a person may answer (a Codex hook trust, a `celetis update` confirmation); a
   secret or a passphrase; a change of the maintainer's host settings (for example a `deny` rule);
   an install or a change on the maintainer's machine outside temporary data; an explicit
   deferral by the maintainer; and the `complete it by hand` command of an `issue` act, because a
   label write outside the engine can read as completion evidence. An engine that refuses each
   later act of the session (a dispatch exit 4 or 5) also leaves no way on.

A hold comment names only the acts of class 3. The step records each answer of class 2 and its
source (the maintainer's message in this session, with the date) on the issue: in the next comment
that it posts (the plan, the runtime report), or in a short comment with no `## ` first line
(`gh issue comment <n> --body-file <file>`) before the act that moves the line.

At a repair limit, ask a live question with the options and the failure trail only when an option
lets this session go on. The count of the limit stays. When each option needs a new plan or a fresh
session, the stop is a hold.

An answer comes only from the maintainer in this session: silence is no yes, and the step invents
no answer and no consent. A question asks for a decision, never for a go-ahead or a review of the
step's own result. The approval of a guard refusal comes from the host's own control, or from an
answer that names the exact action (the part of the host below). Take no other route around a
guard.

## A stop in a step session

A stop is not a question. Where a skill says to ask, the step text says which decisions to ask
for: ask, and wait for the answer. When the step cannot go on and no such decision is open, hand
the stop to the issue:

- **The issue holds the reason:** a comment that the skill posts for this stop
  (`## Landing refused`, `## Before landing`) is the reason. Then, when the skill adds no label for
  this stop, run `celetis --agent <host> issue <n> ready-for-human` as the last act of the turn,
  after each other act that the skill names for the stop.
- **Else** write the step, the exact message or the failure trail, and each act outside the
  session that lets the step go on to a file, with no heading. Run
  `celetis --agent <host> issue <n> stopped <file>` as the last act of the turn, after each other
  act that the skill names for the stop. It posts the file with `## Stopped` as its first line,
  then adds `ready-for-human` and removes `ready-for-agent` when present.

A successful human hold leaves only `ready-for-human` from the readiness pair. It preserves build
completion: only a `## Built` or `## Before landing` comment after the latest plan records a built
change. Clearing the hold resumes that build state without restoring an agent label.

The label ends this session.

An `issue` act that exits 6 with `complete it by hand: <command>` stopped partway. That command is
an act of the maintainer: run no part of it, and hand the stop to the issue with the line as the
message.

When GitHub does not answer, or the issue is closed, show the message in this session and stop. A
command that the host sandbox keeps from the network is no such case: first follow the approval
procedure for a sandbox block of the host part of `<plugin>/docs/procedures/entry.md`, "The
contract".

## A Verify scenario that cannot run

In a step session, a Verify scenario that the session cannot run has no PASS. The `detect`
scenario of `<plugin>/docs/procedures/design.md` is the exception: when `impeccable` is missing by
its "Missing", print its one line, and go on with no hold. Before creating a hold, apply
`<plugin>/docs/procedures/runtime-verification.md`, "Usage-limit exception".
When it permits continuation, publish its report and continue the normal landing path.
Otherwise the change does not land without the scenario. A guard that refuses its command
(the host's approval review, the auto-mode classifier, the worktree guard, a `deny` rule) is a
limit: try one safer form of the command, and take no other route. Run each other scenario. When
the safer form also fails and the maintainer can lift the guard in the session (the part of the
host below), ask a live question that names the exact command, why the scenario needs it, and how
to approve it. After an approval, run that command once more. A "no", a second refusal, or a guard
that the maintainer cannot lift in the session (a `deny` rule, or the worktree guard after its
safer form) makes the hold of this section.

Then the scenario is a human precondition of the landing. Write a new `## Before landing` comment
for this build to a file, with no heading: the scenario, its commands, the expected result, and the
refusal. For missing runtime proof, read `<plugin>/docs/procedures/runtime-verification.md` and
apply "Reports and deferred checks" to the report and precondition. Then run
`celetis --agent <host> issue <n> before-landing <file>` as the last act of the
turn. It posts the comment, then adds `ready-for-human` and removes `ready-for-agent`. The comment
records the change as built; the removal of `ready-for-agent` changes readiness only.

On a later run, keep the built change and follow the skill's re-entry rule. Require a trusted
completion report or a label-removal event after the `## Before landing` comment for
this build. Assistance completion follows `<plugin>/docs/procedures/assisted-completion.md`.
An absent `ready-for-human` label is not completion evidence.

- Without evidence, restore that label with `celetis --agent <host> issue <n> ready-for-human` as
  the last act, using the existing comment as the reason, and stop.
- With workflow completion evidence, apply `<plugin>/docs/procedures/runtime-verification.md`,
  "Reports and deferred checks", before skipping deferred runtime scenarios. Continue to the
  human precondition of the landing only when that procedure permits it
  (`<plugin>/docs/procedures/landing.md`, "Step 2: the human precondition").
- A `## Before landing` comment that names an act of "During the build" of the plan is the
  exception: follow the re-entry rule of the skill, which runs the scenarios that waited for that
  act.

## The act that moves the line

These acts move the line of the issue in the runner's resolver
(`celetis --agent <host> next-step`): a label, a comment with a heading that the resolver reads, a
published spec, and a closed issue. A session that the runner started ends at its first idle moment
after such an act (`<plugin>/docs/celetis-flow.md`, "The step end"). So, in each session:

- Get each answer from the user before the act.
- Do each other act of the skill in the same turn, before the act: the act is the last act of the
  turn.
- The exception is an act that the skill names after the act, for example the removal of a lane
  worktree, which needs a closed issue or an epic, or the report of the result. It comes after the
  act, in the same turn.

Each skill that cites this section names its acts that move the line, and the acts after each.

## Claude Code

In auto mode, the maintainer lifts a refusal of the classifier in the session in one of two ways:
approve the blocked action in the **Recently blocked** tab of `/permissions` (press `r`), or
answer with a message that names the exact action. A general "yes" is no explicit intent, so the
question names the exact command and both ways. The approval adds no permission rule, and the retry
goes through the classifier again. After 3 blocks in a row or 20 in total, auto mode pauses, and
Claude Code asks the maintainer for each action: that prompt is the host's own control. The
refusal of the classifier tells the session to try a safer method; the refusal of a `deny` rule
says only that the permission has been denied, and the maintainer cannot lift it in the session.

## Codex

With the approval policy `on-request`, Codex asks the maintainer for the approval itself: its
prompt is the live question, and a refusal there is a "no". With `never`, no prompt can come, so a
sandbox refusal stays a setup stop (`<plugin>/docs/procedures/entry.md`, "The contract"), and a
guard refusal is a hold.
