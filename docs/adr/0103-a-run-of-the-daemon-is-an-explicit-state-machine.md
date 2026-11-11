# A run of the daemon is an explicit state machine

## Date

2026-11-11

## Related

- [Issue #289](https://github.com/ddinkov10/celetis/issues/289): the spec (the body of the issue). In this record,
  "Approaches", "Design probes", "Done when", and the numbered parts of "The design" name parts of that body.
- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md): each request makes one run of the run engine.
  This record changes how the run engine is built, not what a request makes.
- [ADR-0092](0092-the-check-for-a-removed-version-folder-reads-the-engine-entry.md): the wait for a removed version
  folder. It stays inside the activities that find it (`removal` of `engine/lib/run-activities.ts`). Its "Decision",
  item 4, says that the step loop and the preflight then end the run as `stopped`: that statement after each call of
  `removal()` could not run and is gone, and the run ends `detached` after the detach, as before.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the repository tracks no test. The checks of this change are the
  `tsc runtime` job of the verify gate and probes outside the repository.
- `engine/lib/run-machine.ts`, `engine/lib/run-activities.ts`, `engine/lib/run-engine.ts`, and `engine/README.md`,
  "The run machine".
- Records that name the old places stay unchanged. They name `runIssue`, `endWhenDone`, `startSession`, or `begin`
  of `engine/lib/run-engine.ts` as the place of a behavior that this change keeps: the skip rule
  ([ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md), "Decision"), the lane test of an auto run
  ([ADR-0096](0096-the-lanes-of-auto-mode-are-tracked-policy.md), "Decision", item 3), the calls of `removal()`
  (ADR-0092, "Decision", item 4), and the `focus: false` of the session tab
  ([ADR-0101](0101-a-run-session-tab-never-takes-the-focus.md), "Decision", item 3). The new places are the entry
  `resolved` of the state `resolving` (the skip rule and the lane test); `run-activities.ts`, with the three calls of
  `removal()` in `endWhenDone` (which the activity of `live` runs), in the activity of `resolving`, and in the
  activity of `preparing`; and `startSession` of the same file (the session start of `opening`).
  The other records that name these functions list them as files of their time.

## Context

`begin()` of `engine/lib/run-engine.ts` was one closure of about 1,500 lines. Its states were positions of the
code: the string `Phase`, the type `Resumed`, and the parameter `from` of `runIssue` and `resumeRun`. A takeover
re-entered the code at a position, with its own branches. A reader could not list the states of a run, the events
that each one accepts, or the transitions. The type check could not say that a transition was missing. The
decisions of a run (what the next step is, when to stop, what to close) were mixed with the I/O that waits for them.

The need: each state, each event, and each transition of a run is a named value that the type check sees, each
decision is a pure function in one table, and a takeover uses the table of a normal run. The behavior of a run
stays equal: the same acts, the same content, and the same order.

## Constraints and evidence

- The repository has no package dependency, and ADR-0029 forbids a tracked test. So the proof of a decision is the
  type check and probes outside the tree.
- The behavior contract is "What stays equal" of the spec: the admission answer, the daemon log, each record write,
  each terminal act, each hook call, and the status view. A new line in the daemon log, a new package dependency,
  and a new run record schema are outside the change.
- Probe 1 ([issue #289](https://github.com/ddinkov10/celetis/issues/289), "Design probes") compared three shapes
  on four states and four events. Only a typed table made `tsc` fail on a missing state, a missing pair, an
  unknown pair, and a target outside the graph. A nested `switch` with `never` missed the target outside the
  graph. State functions have no events, so they have no pair to check.
- Probe 2 (the same section) built the table of this design on six states and seven events. It showed that
  `Step<K>` must distribute over `K`, that seven defects fail `tsc`, and that two limits pass (see "What the type
  check covers").
- The build of this change measured the type check on the real table of 17 states. The seven defects of the table
  were applied one at a time, and each ended the verify gate with `verify: FAIL`. The first diagnostic of each was:
  1. a state with no activity: `TS2741` (`Property '"quota-wait"' is missing`);
  2. an accepted event with no entry: `TS2741` (`Property '"lock-held"' is missing`);
  3. an activity that returns another event: `TS2322` (`Type '"resolved"' is not assignable to type '"selected"'`);
  4. an entry that returns a state outside `Targets`: `TS2719` ("Two different types with this name exist, but they
     are unrelated") in the build of #289, and `TS2322` in probe 2 at six states;
  5. an entry for an event that the state does not accept: `TS2353` (`'woke' does not exist`), with `TS7006` for the
     untyped parameter of the entry;
  6. a state with no `failed` entry: `TS2741` (`Property 'failed' is missing`);
  7. a state with no row: `TS2741` (`Property 'opening' is missing`).

  These were observed in the build of #289. The runtime verification report on
  [issue #289](https://github.com/ddinkov10/celetis/issues/289) holds the seven diagnostic lines. The code of the
  diagnostic is not a contract of this record.

## Decision

A run is a table machine that is written by hand, with one activity for each state, pure table entries, and one
driver. It is the model of systemd and of Erlang/OTP `gen_statem`, with the pure update of Elm.

- **Three files.** `engine/lib/run-machine.ts` holds `State`, `Event`, `Effect`, `Own`, `Accepts`, `Targets`,
  `Table`, the table `on`, and its pure helpers. `engine/lib/run-activities.ts` holds the I/O context `Io`, the
  ledger of the resources that the cleanup releases, the activities, and `perform` for the effects.
  `engine/lib/run-engine.ts` keeps its name and its exports, and holds the driver in `begin()`.
- **17 states.** `starting`, `admitting`, `binding`, `resolving`, `selecting`, `quota-wait`, `preparing`,
  `opening`, `live`, `closing`, `advancing`, `reporting`, `adopting`, `observing`, `ended`, `ending`, and
  `finished`. `engine/README.md`, "The run machine", lists what each one waits for.
- **One activity for each state** (`Activities` in `run-activities.ts`). It does I/O, waits, and returns one
  event. It does not choose between two next states. A fault that it finds is a throw with the `HostError` of
  before.
- **One pure entry for each state and event** (`Table` in `run-machine.ts`). It does no I/O, reads no clock, makes
  no random ID, and does not read `Io`. It returns the next state and an ordered list of effects. The activity puts
  each value that an entry needs into the event.
- **One driver** (`begin()`). It runs the activity, calls the entry, performs the effects, and sets the state. It
  is the only code that sets the state of a run. After the first state, which `initial()` gives, it sets only a state
  that an entry returned. A throw of an activity is the event `failed`. A throw of an entry or of an effect makes the
  driver call the `failed` entry of the state that the entry left, and the driver does not enter a state that the
  entry returned.
- **The cleanup has two states.** `closing` ends an issue. `ending` ends the run. A `failed` inside an issue goes to
  `closing`. A `failed` outside an issue goes to `reporting` or `ending`, so the throw of the issue cleanup does not
  run that cleanup again.
- **A takeover starts in `adopting`** and uses the same table. The types `Phase` and `Resumed`, and the parameters
  `from` of `runIssue` and `resumeRun`, are gone. Where a new run and a taken-over run differ, the state holds a
  flag that the entry sets: `adopt` and `keepRow` of `binding`, `fresh` of `live`, and `ready` of a resume
  `preparing`.
- **The status label is an output.** The field `state` of the status row and of the run record keeps its name
  and its nine values. It is not the machine state, and the machine state gives no label.

### What the build changed from the text of the spec

These differences between the built code and the spec are on purpose. A later editor must not change the code
back to the text.

1. **`reporting` and its `failed` entry.** The `failed` entry of `reporting` in `run-machine.ts` goes to `ending`
   with the error, which the driver throws after the cleanup. It does not use the function `failure`, which the
   other `failed` entries of states outside an issue use. In the old `work`, a throw of `closeTabs` inside
   `queueFailure` was a throw inside the `catch`, and it left through the `finally`. The function `failure` would
   give a second `reporting` or a stop line, which is a change of behavior.
2. **The status row of the issue** is written in the activity `admitting` (`admitting` in `run-activities.ts`)
   before the lock of the issue is taken, and again in `binding` unless the flag `keepRow` is set. The plan had it
   in `binding` only.
3. **The wait ID of a kept quota wait** is checked by a throw at the head of the activity `quotaWait`, not by a
   decision of the entry `bound`. The check reads the recovery record after the session acts, as the old code did,
   and its failure is a fault (rule 5 of the spec, "5. The rules of an activity and of a table entry").
4. **The effect `daemon`** reads the process identity of the daemon for the recovery record. It is one more member
   of `Effect` than the spec lists. It is the last effect of the entry `admitted` of `admitting`, because the first
   record write of the issue is an effect of that entry and the read follows it. A throw of it stays outside the
   issue.
5. **`Io` holds more than the spec places there.** It also holds `operation`, `initial`, `selection`, `terminal`,
   `tab`, and `daemon`. The spec puts the first three in the state data and the next two in the session facts. The
   moved helpers read these names live, also in `closing` and `ending`, where no state holds session facts. The
   states keep copies for the entries.
6. **Wiring edits outside the four kinds of the spec.** `removal()` has the return type `Promise<never>` and one
   `throw` that cannot run, so the statement after each call can go (rule 6 of the spec). Moved module values have
   `export`. The handle that `begin()` returns reads `io.told` and `io.shown` inline, because they change during
   the run.
7. **The flag `located`.** The driver reads the checkout once, inside the `try` of the activity of the first pass,
   so that a failure of the read is the event `failed` of the first state. This and item 9 are the two differences
   from the loop in "6. The driver".
8. **The imports of `run-machine.ts`.** The rule is: only types, pure functions, and constants. The file imports
   `selectAgent` from `engine/lib/agent-usage.ts` and `effectiveOrder` from `engine/lib/agent-order.ts`. Both
   modules also hold functions that read files, and `run-machine.ts` calls only the pure ones.
9. **A throw of an entry.** The driver calls the entry inside the `try` of the effects, so that a throw of an
   entry is the event `failed` of the current state, as a throw of an effect is. The loop in "6. The driver" calls
   the entry outside that `try`. There, a throw of an entry leaves the loop with no `closing` and no `ending`, so
   the run keeps its locks and its records. The old `runIssue` and `work` ran their cleanup in a `finally` for each
   throw of the decision code. The effects of a `failed` entry run outside the `try`, as in the spec.
10. **`Targets` holds the targets of `failed`.** `Targets[S]` is the "Next states" cell of the state table of the
    spec for `S`, plus the targets of the `failed` entry of `S`: `closing` inside an issue, `reporting` or `ending`
    outside an issue, and `finished` for `ending`. The spec types the `failed` entry of `S` through `Targets[S]`,
    so a narrower `Targets` does not compile. The cost is a limit of the type check ("What the type check covers").
11. **An empty queue at the start.** The entry `started` of `starting` goes to `ending` when the queue is empty at
    the start of the run. The state table of the spec gives `starting` only the next state `admitting`. The old
    code skipped the drain loop and said the line of the empty queue, and the entry keeps that.

### What the type check covers

The `tsc runtime` job of the verify gate fails on each of the seven defects in the list of "Constraints and
evidence". Only the activity of a state gives that state an event, and the driver adds `failed`. So a pair outside
`Accepts` cannot occur by type, and each pair inside `Accepts` has an entry.

The limits, each with its probe:

- **The check does not say that an entry or an activity is correct.** It checks the shape of the machine.
- **A cast hides a defect.** An entry that ends with `as never` hides a target outside `Targets`. Probe 2 gave no
  error for it. The rerun on the final tree gave the same: the entry `unsaved` of `reporting` (targets: `ending`)
  was set to return `{ state: { kind: 'resolving' }, effects: [] } as never`, and the `tsc runtime` command (the
  arguments of the job, run alone) printed no diagnostic and exited with 0.
- **An entry of an own event can return a target of the `failed` entry of its state.** `Targets[S]` holds both
  (item 10 of "What the build changed from the text of the spec"), so the check does not separate them. The rerun
  on the final tree: the last `return` of the entry `selected` of `selecting` (targets in the spec: `quota-wait`
  and `preparing`) was set to return a `closing` state, and the same command exited with 0. The control returned
  `resolving`, and the command printed `TS2719` and exited with 1.
- **An activity that throws for an outcome, in place of an event, passes.** Probe 2 gave no error. The rerun: the
  last `return` of the activity `quotaWait` was replaced by a `throw`, and the same command exited with 0. That
  outcome goes the way of `failed`.
- **The driver widens the two tables with two casts.** TypeScript does not relate the kind of a state to the kind of
  its event. Probe 2: a driver with no cast fails with `TS2345` and `TS7053`. The rerun on the final tree: with the
  cast of `activities` removed in `begin()`, one diagnostic, `TS2345`; with the cast of `on` removed, two
  diagnostics, `TS7053` and `TS2345`. `run-machine.ts` has no cast. A moved body keeps the casts that it has at the
  base.
- **The 17 states were measured only for the errors above.** Probe 2 had six states and did not load the Bun types.
  The tree of this change type-checks with the Bun types, and the command of the rerun ran in under one second.

## Alternatives considered

- **XState 5.** It is the state of the art for TypeScript. It does not fit: the repository has no package
  dependency, so the library would be vendored. XState drops an event with no transition with no error, so the
  check of "each state and event has an entry" would need an added layer. Its snapshot format would become the run
  record that two engine versions share.
- **Async state functions.** Each state is one async function that returns the next state. It is the smallest edit.
  It has no events, so a pair of a state and an event cannot be checked (probe 1).
- **A replay of an event history (Temporal).** The state stays the position of the code. It does not give an
  explicit state.
- **A control loop from observed state (Kubernetes).** The takeover already does this for one read: it observes
  the `go` file and the barrier process. That read stays, as the activity of `observing`. As the model of the whole
  run it has no explicit transition.
- **A reducer with one effect for each I/O call and an event queue.** It adds states and ordering risk and adds no
  check.
- **A full table of each state with each event.** It holds mostly markers. The type `Accepts` lists only the events
  that a state can get.
- **A nested `switch` with `never`.** It missed a transition outside the declared graph (probe 1).

## Consequences

- A reader lists the states, the events of each state, and the next states from three types. The type check refuses
  the seven defects, and the table has no cast.
- The activities hold the I/O and the table holds the decisions. A decision is read in `run-machine.ts` alone.
- A change of the order of the acts of a path is a change of an `Effect` list or of an activity. The compare of
  the acts is the work of the verify phase of this change, not of the type check.
- The check does not find a wrong entry or a cast. Review and the probes of the build stay the proof of
  correctness.
- The driver has two casts, and the `Io` of `run-activities.ts` is large because it holds the names that the
  moved helpers read live.
- **Not in this change** (non-goals): an explicit machine for the step-end watch (it stays a loop inside the
  activity of `live`); a change of `autoLoop()`, which starts runs and is not a run; a runner port, a split of the
  daemon, and an exception to ADR-0029 for tests of pure functions; a new run record schema; and a status label that
  the machine state gives.
- **Refused** (anti-goals): a change of the behavior of a run with no decision of the maintainer, a new package
  dependency, a decision about the next state inside an activity, a second place that sets the state of a run, and
  a new line in the daemon log (for example a trace of the transitions).
- A known edge stays: a stop while a taken-over run handles an ended session, before the first checkpoint of the
  quota proof, removes the start folder while the record keeps the session.

## Reconsider when

- TypeScript relates the kind of a state to the kind of its event, so the driver needs no cast.
- A run needs two activities at the same time, or the step-end watch needs states of its own.
- The table is too big to read in one file, or a state needs more than one activity.
- The repository takes a package dependency for state machines, or ADR-0029 allows a test of a pure function.
- A transition of a run has to be traced in the daemon log.
