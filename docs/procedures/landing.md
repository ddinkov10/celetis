# The landing

`celetis --agent <host> land` puts the change on the trunk by `landing` in `.celetis.yaml`
(ADR-0008 of the plugin `celetis`). It is the one landing path of an agent. The skill that cites
this module names the step that it starts from, and its fix rule for a refusal that the change
caused (step 4).

## Contents

- **Re-entry after a refusal:** a built change with a `## Landing refused` comment.
- **Step 1: the build mark:** `issue <n> built`.
- **Step 2: the human precondition:** an act that only a human can do before the landing.
- **Step 3: the landing:** the run of `land`, and each exit status.
- **Step 4: a refusal that the change caused:** the fix, then a new landing.
- **Step 5: the third refusal, or a cause outside the change:** `## Landing refused`, and the stop.
- **Claude Code** and **Codex:** the return to the main checkout and the run of `land` on each
  host.

## Re-entry after a refusal

When a skill finds on re-entry that an earlier run built the change, read the latest
`## Landing refused` comment of the issue:

- When the change made the cause that the comment names, fix it as step 4 says.
- When the cause is outside the change and the trunk now holds its fix, the worktree entry brought
  the trunk into the branch: run the verify gate of the project, so that the checks run on a new
  head.

For deferred runtime checks or evidence affected by the repair or trunk changes, read
`<plugin>/docs/procedures/runtime-verification.md` and apply "Evidence lifetime", "Reports
and deferred checks", and "Usage-limit exception" before going to step 2.

## Step 1: the build mark

Run `celetis --agent <host> issue <n> state`. With `build: planned`, run
`celetis --agent <host> issue <n> built`: it posts `## Built` as explicit completion after the
latest `## Plan` comment, then removes `ready-for-agent` when present. A `## Before landing`
comment after that plan also records a built change. With another `build:` (`none` in a hotfix,
or `built` when the change has its mark), go on to step 2.

## Step 2: the human precondition

An act of "During the build" in `### Your steps` of the plan is done when a `## Human steps done`
comment after the latest `## Plan` comment reports it.

Before creating a new runtime hold, apply `<plugin>/docs/procedures/runtime-verification.md`,
"Usage-limit exception". It preserves existing human holds and all other prerequisites.

When the change needs an act that only a human can do before it reaches the trunk, no such report
holds the act, and either the issue has no `## Before landing` comment for this build or the act
is an act of "During the build" that no such comment names: write a file with no heading that
names each such act, with the report form of each act of "During the build", run
`celetis --agent <host> issue <n> before-landing <file>`, with `--during-the-build` after the file
when it names an act of "During the build", and stop. The command posts the file with
`## Before landing` as its first line, then adds `ready-for-human`. The maintainer completes the
act and clears the label.

Before landing on re-entry, read the `open:` lines of `celetis --agent <host> issue <n> state`:
the engine reads the completion evidence of each `## Before landing` comment of this build from
the issue timeline (`<plugin>/docs/issue-tracker.md`, "Completing a human precondition"). An
absent label is not completion evidence. The engine reads that a `## Human steps done` comment
exists, not which acts it reports. So with an `open:` line, or with a `## Before landing` comment
of this build that names an act of "During the build" that no later `## Human steps done` comment
reports, keep the change built, restore the label with
`celetis --agent <host> issue <n> ready-for-human`, using the existing comment as the reason, and
stop. For deferred runtime checks or evidence affected by changes since the previous run, apply
`<plugin>/docs/procedures/runtime-verification.md`, "Reports and deferred checks", "Evidence
lifetime", and "Usage-limit exception", before continuing. With that procedure satisfied,
`open: none`, and a report of each such act, continue to step 3.

## Step 3: the landing

The full suite runs once, on the tree that lands, so the session runs no full suite before
`land`: with the landing `merge`, `land` runs the `suite` file of `.celetis.yaml` in the lane, at
the tip that it lands; with the landing `pr`, the CI of the lane PR runs it.

Return to the main checkout, keeping the lane, and check that the session is in the main checkout
(the part of the host below). Run `celetis --agent <host> land <n> '<type>(<area>): <what>'`
there, as the part of the host below says, and go on when it ends: the checks and one re-run of a
failed check can take 30 minutes.
Wait for its real exit; a yield or a timeout is not completion. Never start a second landing while
one runs. The subject is the squash subject of the change, without the issue number: the script
adds ` (#<n>)`. When the lane branch holds one commit, pass the subject of that commit: the squash
commit can take the subject of that commit in place of the argument.

The exit status gives the result (`<plugin>/docs/celetis-flow.md`, "A landing", gives each class):

- **0** ends the step: the change is on the trunk, and the worktree and the branch are gone.
  **An act of the maintainer** (each `land:` line other than `land: #<n> is on <trunk>` and
  `land: <branch> and its worktree are gone`, for example
  `land: the main checkout did not move to origin/<trunk>; run git pull on <trunk> there`) is no
  stop: quote each such line verbatim in the last message of the step, run no command for it, and
  post no comment and add no label for it. **A check by hand** (an item of "After the landing" in
  `### Your steps` of the plan) is no stop either: quote that list verbatim in the last message of
  the step, after the quoted `land:` lines, run no command for it, and post no comment and add no
  label for it.
- **2** (`usage`) is **an error that the session caused** (the usage line, a run from inside the
  lane worktree, a lane worktree that is dirty). It is no refusal, and step 5 does not count it:
  correct it, and run the script again. A second 2 with the same line is a cause outside the
  change (step 5).
- **3** (`prerequisite`): the issue is not ready to land, and the line quotes the line of the
  resolver. Run `celetis --agent <host> issue <n> state`. When its `line:` is
  `run /celetis:implement #<n>` with `build: planned`, step 1 did not complete: go to step 1. Each
  other `line:` is a stop: show the user the output, and stop. In a step session, hand it to the
  issue with a `## Stopped` comment by
  `<plugin>/docs/procedures/stop.md`, "A stop in a step session": the `## Landing refused` comment
  of step 5 needs a landing step on that line.
- **4** (`repair`) is a refusal that the change caused: step 4.
- **5** (`checks`) is a red check or a failed suite. Decide whether the diff caused it: step 4
  when it did, else step 5.
- **6** (`blocked`) and **1** are causes outside the change: step 5.
- **7** (`cleanup`) is **a stop after the landing** (a `land:` line that says
  `run celetis --agent <host> land again`). It is no refusal, and step 5 does not count it: the
  change is on the trunk, so do what the line says and run the script again. A second 7 with the
  same line is a cause outside the change (step 5).
- **128+n** is **a signal that stopped `land`** before it put the change on the trunk, for
  example the time limit of a background `land`. It is no refusal, and step 5 does not count it:
  run the script again once. A second 128+n is a cause outside the change (step 5).

## Step 4: a refusal that the change caused

Status 4, or a status 5 that the diff caused, before the change is on the trunk: a check or the
suite that fails on the diff, a conflict with the trunk, a branch that does not contain the trunk
head, a trunk head or a lane tip that changed during the landing.

Enter the issue's worktree again (`<plugin>/docs/procedures/worktree.md`, "The entry"). Fix the
cause by the fix rule of the skill that runs the landing and commit. Before going to step 3,
renew affected runtime confirmation and scenarios per
`<plugin>/docs/procedures/runtime-verification.md`, "Evidence lifetime", then apply its
"Usage-limit exception" before a new runtime hold or continuation. Debug a red
check or a failed suite with `superpowers:systematic-debugging`, and start from the test that
failed in CI or in the suite. For a stale branch or a moved trunk, the worktree entry brought the
trunk in: run the verify gate of the project and renew affected runtime evidence as above, then
go to step 3. When the entry refuses, for
example on a conflict with the trunk, show the user its message and stop.

## Step 5: the third refusal, or a cause outside the change

The third refusal in one session, or a cause outside the change (status 6 or 1, a status 5 that
the diff did not cause, a second 2 or 7 with the same line, or a second 128+n): a check that fails
on an advisory for a dependency that the change did not touch, no check that ran, checks that did
not finish, GitHub that does not answer, a main checkout that is dirty or off the trunk.

Write the output of the script to a file in a temporary directory outside the checkout, run
`celetis --agent <host> issue <n> landing-refused <file>`, which posts it with `## Landing refused`
as its first line, show the user the output, and stop. Do not pass the output as a quoted
argument: a message of `gh` can hold a backtick, and the shell runs it inside double quotes.

## Claude Code

Before `land`, use `ExitWorktree` with keep, then verify the main checkout. Run `land` in
background Bash with `run_in_background: true` and `timeout: 3600000`. Wait for its real exit; the
checks can take thirty minutes.

## Codex

Before `land`, bind the command cwd and each file path back to the main checkout; the lane stays.
Keep `land` alive until its real exit; it can take thirty minutes. Keep the command session
identifier to observe completion. `land` needs network: in a sandbox with no network, request one
approved retry with the same command, arguments, and cwd before you report a setup stop or count
the exit as a cause outside the change (step 5).
