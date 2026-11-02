# The stop

How a step stops when it cannot go on, and which act ends a step. The skills and the step text
cite it.

## The two modes

A skill stops when it says to stop, to show the user a message, or to escalate to the user.

Before the terminal message or issue act, when useful task incident evidence exists, apply
`<plugin>/docs/procedures/lesson-capture.md`. Reuse a checkpoint already handled in the turn.
This adds no repair attempt. An entry read denial or another access stop takes precedence:
perform no capture access that the stop prohibits. A capture block leaves the original terminal
act and its order unchanged.

- **In an interactive session**, which has no step text: show the user the message, and stop.
- **In a step session**, which the runner started with its step text: hand the stop to the issue
  ("A stop in a step session").

The message of a block (a denied path, a missing tool, or an unsupported operation) names the
exact block and the setup action. The block stops only the work that depends on it: continue each
independent check.

## A stop in a step session

A stop is not a question. Where a skill says to ask, the step text says which decisions to ask
for: ask, and wait for the answer. When the step cannot go on and no such decision is open, hand
the stop to the issue:

- **The issue holds the reason:** a comment that the skill posts for this stop
  (`## Landing refused`, `## Before landing`) is the reason. Then, when the skill adds no label for
  this stop, run `celetis --agent <host> issue <n> ready-for-human` as the last act of the turn,
  after each other act that the skill names for the stop.
- **Else** write the step, the exact message or the failure trail, and the act of the maintainer
  that lets the step go on to a file, with no heading. Run
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

In a step session, a Verify scenario that the session cannot run has no PASS. Before creating a
hold, apply `<plugin>/docs/procedures/runtime-verification.md`, "Usage-limit exception".
When it permits continuation, publish its report and continue the normal landing path.
Otherwise the change does not land without the scenario. A guard that refuses its command
(the host's approval review, the auto-mode classifier, the worktree guard, a `deny` rule) is a
limit: try one safer form of the command, and
take no other route. Run each other scenario.

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
