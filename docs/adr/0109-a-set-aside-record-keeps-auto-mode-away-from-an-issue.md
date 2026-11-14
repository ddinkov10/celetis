# A set-aside record keeps auto mode away from an issue

## Date

2026-11-14

## Related

- [Issue #322](https://github.com/ddinkov10/celetis/issues/322): the spec (the body of the issue) and the plan in its
  comments. In this record, "approach A" names the first item of the section "Approaches" of that body.
- [A run of the daemon is an explicit state machine](0103-a-run-of-the-daemon-is-an-explicit-state-machine.md): the
  admission of a run, where the removal happens.
- `engine/lib/set-aside.ts`, `engine/lib/resolver.ts` (`boardRow`, `nextBoard`), `engine/lib/run-engine.ts`
  (`autoLoop`), `engine/lib/run-machine.ts` (`admitting`), and `engine/board/place.ts` (`PLACERS`).

## Supersedes

Only this clause changes. The record keeps its other text.

- [The board is a package of its own, and a contract with a version is its input](0009-the-board-is-a-package-of-its-own.md),
  in part, in "Decision": the sentence "The first state that matches wins, in this order: `done`, `starting`, `dirty`,
  `stuck`, `blocked`, `ready`." The state `aside` now comes after `starting` and before `dirty`.

## Context

A step that makes no progress shows as a stuck card in "Needs you", and the maintainer had no way
to say "not now". The no-progress record keeps auto mode away from that step only while the issue
stays at the same state line. The maintainer asked for an act that sets an issue aside: the card
goes to Idle, auto mode never starts the issue, and only the maintainer starts it again with Run or
Resume. A later Stop of a running session sets the issue aside too, also after a step that made
progress.

## Constraints and evidence

- The no-progress record is keyed by the issue and its state line (`<n>\t<line>`), so a step change
  ends its effect. A Stop after a step that made progress must still keep auto mode away.
- The board presses run in the master daemon, and `celetis run` reaches the daemon through its
  socket. So one process can own each write of a local file.
- The board and the auto loop read the record while the daemon can write it. A rename of a whole
  temporary file gives each reader one whole state.
- The probe of case R4 of Task 1 of the plan (30 concurrent calls in one process: 20 adds and 10
  removals) lost writes when each write read the file with no order, and kept each write when the
  writes ran one at a time.
- The maintainer picked approach A: a local record, not a GitHub label.

## Decision

The file `set-aside` in `<git common dir>/celetis/`, next to `no-progress`, holds one issue number
per line. It is keyed by the issue only, not by its state line, so it holds across a step change.

- **One writer.** Only the master daemon process writes the file. The writes of one process run one
  at a time, and each write replaces the whole file (a temporary file and a rename). Adding a
  present number and removing an absent number write nothing.
- **One precedence.** The board row of an issue takes the first state that matches: a held issue
  lock gives `starting`; a number in the record gives `aside`, which keeps the path of a dirty lane
  worktree; then a dirty lane worktree, the no-progress record (`stuck`), and the state of the
  resolver. The board places an `aside` row in Idle with Run and Resume.
- **Removal at admission.** A run of the issue with an input other than auto mode (a number run, a
  resume run, and each issue that a queue run admits) removes the number when the run takes the
  issue lock, before the session starts. So a refused start keeps the record, and the removal has
  one home.
- **A fail-closed read.** A missing file holds no issue, and a line that is not a positive integer
  has no effect. Each other read failure is an error: the board read shows its read error, and the
  auto loop starts no issue in that pass and tries again after 60 seconds. An explicit start also
  fails then, because its removal at admission cannot read the file; the run ends with that error
  before a session starts.
- **A second read under the issue lock.** A run of auto mode reads the record again after it takes
  the issue lock. When the record holds the issue, or the read fails, the run ends with the outcome
  `stopped`, which is no failure, releases the lock, and starts nothing. The pick of the auto loop
  reads the record with no lock, so a Set aside between the pick and the admission would otherwise
  let auto mode start the issue. A Set aside that writes the record while it holds the issue lock
  makes the two exclusive.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: auto mode never starts a step that the maintainer chose not to run, so "Needs you" holds
  only what needs an act.
- Serves: 1 Intent to release: a set-aside issue keeps its spec, its branch, and its saved session, so one press of Run
  or Resume continues its path.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **A GitHub label set by an `issue` act (approach B).** Visible on GitHub and on each machine.
  Rejected by the maintainer: a new label in `engine/lib/contract.ts` and a new contract version, a
  GitHub write for each act, and new label acts in the plugin text.
- **Clear the no-progress row only (approach C).** The card would go to "Needs you → Ready to run",
  and auto mode would start the issue. Rejected: the maintainer asked for Idle and no auto start.
- **A row of the no-progress record with a special line.** Rejected: that record is keyed by the
  state line and no code deletes a row, so a step change would end the effect, and a removal would
  need a second writer rule for that file.
- **Removal by each start path.** Rejected: the board Run, the board Resume, `celetis run`, the
  resume run, and the queue would each need the removal. The admission of the run state machine is
  the one point that each of them passes.

## Consequences

- An issue that the maintainer set aside stays out of auto mode across daemon restarts and step
  changes, until an explicit start.
- The record is local to the machine of the daemon. GitHub and other machines do not show it.
- A number of a closed issue stays in the file and has no effect, because the resolver reads only
  open issues. The removal at admission keeps the file small.
- An unreadable file stops auto mode from starting any issue until the file is readable again.
- A process other than the master daemon must not write the file, because the order of writes is
  kept only inside one process.

## Reconsider when

- More than one process must write the record, for example a board that runs outside the daemon.
- The maintainer needs the set-aside state on GitHub or on more than one machine.
- A timer must bring an issue back (a snooze), which the record does not hold.
