# The landing

`celetis --agent <host> land` puts the change on the trunk by `landing` in `.celetis.yaml`
(ADR-0008 of the plugin `celetis`). It is the one landing path of an agent. The skill that cites
this module names the step that it starts from, and its fix rule for a refusal that the change
caused (step 4).

## Contents

- **Re-entry after a refusal:** a built change with a `## Landing refused` comment.
- **Step 1: the build mark:** `issue <n> built`.
- **Step 2: the human precondition:** an act that only a human can do before the landing.
- **Step 3: the landing:** the curation of the lesson queue, the run of `land`, and each exit
  status.
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
latest `## Plan` comment. A `## Before landing`
comment after that plan also records a built change. With another `build:` (`none` in a hotfix,
or `built` when the change has its mark), go on to step 2.

## Step 2: the human precondition

An act of "During the build" in `### Your steps` of the plan is done when a `## Human steps done`
comment after the latest `## Plan` comment reports it. A consent of "Answers before the build" is
no human act of the landing: use the recorded answer.

Before creating a new runtime hold, apply `<plugin>/docs/procedures/runtime-verification.md`,
"Usage-limit exception". It preserves existing human holds and all other prerequisites.

Before the file below is written, sort each act by `<plugin>/docs/procedures/stop.md`, "The check
before a stop": do the agent work, and ask each answer in words in the session. The file names only
acts outside the session.

When the change needs an act that only a human can do before it reaches the trunk, no such report
holds the act, and either the issue has no `## Before landing` comment for this build or the act
is an act of "During the build" that no such comment names: write a file with no heading that
names each such act, with the report form of each act of "During the build", run
`celetis --agent <host> issue <n> before-landing <file>`, with `--during-the-build` after the file
when it names an act of "During the build", as the last act of the turn, and stop. The command
posts the file with `## Before landing` as its first line. The maintainer supplies the
required contribution. Assistance can record verified completion
and clear the hold by `<plugin>/docs/procedures/assisted-completion.md`; lane sessions keep this
precondition and its evidence requirements.

Before landing on re-entry, read the `open:` lines of `celetis --agent <host> issue <n> state`:
the engine reads the completion evidence of each `## Before landing` comment of this build from
the issue timeline (`<plugin>/docs/issue-tracker.md`, "Completing a human precondition"). An
absent label is not completion evidence. The engine reads that a `## Human steps done` comment
exists, not which acts it reports. So with an `open:` line, or with a `## Before landing` comment
of this build that names an act of "During the build" that no later `## Human steps done` comment
reports, keep the change built, run `celetis --agent <host> issue <n> ready-for-human` as the
last act of the turn, using the existing comment as the reason, and stop. That act needs no new
approval. For deferred runtime checks or evidence affected by changes since the previous run, apply
`<plugin>/docs/procedures/runtime-verification.md`, "Reports and deferred checks", "Evidence
lifetime", and "Usage-limit exception", before continuing. With that procedure satisfied,
`open: none`, and a report of each such act, continue to step 3.

## Step 3: the landing

While the change is not on the trunk, each run of this step starts in the lane checkout, before
the return to the main checkout, with the curation of the lesson queue by
`<plugin>/docs/procedures/lesson-curation.md`, "Curation at a landing". A run after a refusal
curates again. An empty queue starts no child, and a curation failure goes into the report: the
step goes on to `land`. A run of `land <n> '<subject>'` again after the change is on the trunk curates nothing:
after exit 7, after a landing that stopped once a `land:` line said that the change is on the
trunk, and after the run that follows a 128+n (the 128+n bullet below says why).

The full suite runs once, on the tree that lands, so the session runs no full suite before
`land`: with the landing `merge`, `land` runs the `suite` file of `.celetis.yaml` in the lane, at
the tip that it lands; with the landing `pr`, the CI of the lane PR runs it.

The master daemon of the repository runs the landing, with the environment of the shell that
started it, except `PORT`, which only its board reads, and `land` prints its output and exits with
its status. So `land <n> '<subject>'` needs a running daemon of the same program revision: with no
daemon, or a daemon of another revision, it exits 3 with a line that names
`celetis daemon start` or the restart of the daemon (exit 3 below).

The daemon runs one landing at a time for the repository, in the order of the requests. A landing
that waits behind another prints `land: #<n> waits for the landing of #<m> in the daemon PID
<pid>` first and nothing more until its turn. That is no stall: wait for its exit. At its turn it
starts from the state that the earlier landing left, so `land <n> '<subject>'` can end with exit
4 (`repair`) at its start, as step 4 says.

Return to the main checkout, keeping the lane, and check that the session is in the main checkout
(the part of the host below). Run `celetis --agent <host> land <n> '<subject>'`
there, as the part of the host below says, and go on when it ends: the checks and one re-run of a
failed check can take 30 minutes.
Wait for its real exit; a yield or a timeout is not completion. Never start a second landing of
the same issue while one runs or waits. The subject, `<type>(<area>): <what>`, is the squash subject of the change, without
the issue number: the script adds ` (#<n>)`. When the lane branch holds one commit, pass the
subject of that commit: the squash commit can take the subject of that commit in place of the
argument.

The exit status of `land <n> '<subject>'` gives the result (`<plugin>/docs/workflow.md`, "A landing", gives each class):

- **Exit 0** ends the step: the change is on the trunk, and the worktree and the branch are gone.
  **An act of the maintainer** (each `land:` line other than `land: #<n> is on <trunk>` and
  `land: <branch> and its worktree are gone`, for example
  `land: the main checkout did not move to origin/<trunk>; run git pull on <trunk> there`) is no
  stop: quote each such line verbatim in the last message of the step, run no command for it, and
  post no comment and add no label for it. **A check by hand** (an item of "After the landing" in
  `### Your steps` of the plan) is no stop either: quote that list verbatim in the last message of
  the step, after the quoted `land:` lines, run no command for it, and post no comment and add no
  label for it.
- **Exit 2** (`usage`) is **an error that the session caused** (the usage line, a run from inside the
  lane worktree, a lane worktree that is dirty). It is no refusal, and step 5 does not count it:
  correct it, and run the script again. A second exit 2 with the same line is a cause outside the
  change (step 5).
- **Exit 3** (`prerequisite`): `land <n> '<subject>'` finds that the state does not permit the
  landing, and the line starts with `land: prerequisite:`.
  - `the lock land-<n> has the owner PID …`: another landing of the issue still runs. Wait until
    it ends, then run the script again. It is no refusal, and step 5 does not count it.
  - `no daemon runs …` or `the daemon runs the program at …`: the maintainer starts or restarts
    the daemon (`celetis daemon start`, or `celetis daemon stop` and then `celetis daemon start`).
    Show the user the line, and stop. In a step session, hand it to the issue with a `## Stopped`
    comment by `<plugin>/docs/procedures/stop.md`, "A stop in a step session".
  - `#<n> is not ready to land`: the issue is not ready to land, and the line quotes the line of
    the resolver. Run `celetis --agent <host> issue <n> state`. When its `line:` is
    `run /celetis:implement #<n>` with `build: planned`, step 1 did not complete: go to step 1.
    Each other `line:` is a stop: show the user the output, and stop. In a step session, hand it
    to the issue with a `## Stopped` comment by `<plugin>/docs/procedures/stop.md`, "A stop in a
    step session": the `## Landing refused` comment of step 5 needs a landing step on that line.
- **Exit 4** (`repair`) is a refusal that the change caused: step 4.
- **Exit 5** (`checks`) is a red check or a failed suite. Decide whether the diff caused it: step 4
  when it did, else step 5.
- **Exit 6** (`blocked`) and **Exit 1** are causes outside the change: step 5. Two lines of status 6 from
  the lesson check of `land` first get one retry. The retry is no refusal of the change, and
  step 5 does not count it:
  - `incomplete transaction`: a lesson write stopped. Run
    `celetis --agent <host> lesson-store recover` once, then run the script again. A nonzero exit
    of `recover` is a cause outside the change (step 5).
  - `busy: timed out waiting for the lesson lock`: a lesson write still runs. Run the script again
    once.

  A second 6 with the same line is a cause outside the change (step 5).
- **Exit 7** (`cleanup`) is **a stop after the landing** (a `land:` line that says
  `run celetis --agent <host> land again`). It is no refusal, and step 5 does not count it: the
  change is on the trunk, so do what the line says and run the script again. A second exit 7 with the
  same line is a cause outside the change (step 5).
- **Exit 128+n** is **a signal that stopped `land`**, for example the time limit of a background
  `land`, or a stop of the daemon (143). The change can be on the trunk or not: a signal to the
  client after the push prints no cleanup line to the client. It is no refusal, and step 5 does
  not count it: run the script again once, and curate nothing on that run (the first run already
  curated the queue, and a lesson commit of the lane after the push would land again). A second
  exit 128+n is a cause outside the change (step 5).

## Step 4: a refusal that the change caused

Status 4 of `land <n> '<subject>'`, or a status 5 that the diff caused, before the change is on the trunk: a check or the
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
go to step 3. On exit 4 of `worktree <n>`, the merge is the fix: resolve it by the fix rule of the skill
and `<plugin>/docs/procedures/worktree.md`, "A conflict with the trunk", then go on as for a moved
trunk. When `worktree <n>` refuses with another status, show the user its message and stop.

A refusal whose line names the lessons of the lane (`the lessons of <branch> do not validate`) is
fixed by `<plugin>/docs/procedures/lesson-curation.md`, "Lesson conflicts"; a fix task brief
carries that path.

## Step 5: the third refusal, or a cause outside the change

The third refusal in one session, or a cause outside the change (status 1 of `land <n> '<subject>'`, a status 6 that
step 3 does not retry, a status 5 that the diff did not cause, a second exit 2, 3, 6, or 7 with the
same line, a failed `recover`, or a second exit 128+n): a check that fails on an advisory for a dependency that the
change did not touch, no check that ran, checks that did not finish, GitHub that does not answer,
a main checkout that is dirty, off the trunk, or with commits that the trunk does not have.

Before the stop, apply `<plugin>/docs/procedures/stop.md`, "The check before a stop". At the third
refusal, a pick between repair options that lets this session go on is a live question with the
options and the `land:` lines, and the count of refusals stays. Post the `## Landing refused`
comment only for a stop of class 3; the comment is the verbatim output.

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
