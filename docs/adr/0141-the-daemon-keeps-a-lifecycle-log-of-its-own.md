# The daemon keeps a lifecycle log of its own

## Date

2026-11-24

## Related

- [Issue #388](https://github.com/ddinkov10/celetis/issues/388): the approved specification. This record cites its
  `## Prior art` section ("Prior art"), its "Approaches", and its "The design", parts 1 to 7.
- [ADR-0066](0066-one-shared-event-record-with-a-lock.md) stays: the event record stays the record of failures. The
  lifecycle log reuses its lock, its line limit, and its rotation, and does not replace any of its decisions.
- [ADR-0103](0103-a-run-of-the-daemon-is-an-explicit-state-machine.md) stays. It refuses "a new line in the daemon log
  (for example a trace of the transitions)", and its "Reconsider when" names a transition that has to be traced in the
  daemon log. This record keeps that refusal true (see "Decision").
- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md): the master daemon is the one process that runs the work
  that the log describes, so it is the one writer.
- [ADR-0124](0124-land-runs-the-landing-when-no-daemon-runs.md): a direct landing, which runs in the `land` process,
  writes no lifecycle entry.
- [ADR-0079](0079-one-contract-module-declares-the-commands-and-the-exit-classes.md) and
  [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the new form `daemon events` is a declared
  form, so the contract gets a new version, and the engine serves it beside the versions that it serves now.
- `engine/lib/state/lines.ts` (the shared writer and reader), `engine/lib/daemon/lifecycle.ts` (the entries), and
  `engine/README.md`, "The lifecycle log".

## Context

The maintainer asked for "a form of events primitives when daemon does steps, such as run.start and such for observing
and monitoring", and for "an event log to see what happens underneath with explicit states". Before this change, the
event record of the user kept failures only. A run, a step, or a landing that succeeded wrote no entry. The other views
were snapshots that a reader must poll: the run records, `daemon status`, and `queue status`. A snapshot loses each
change between two reads.

## Constraints and evidence

- The prior-art study is the `## Prior art` section of [issue #388](https://github.com/ddinkov10/celetis/issues/388). It
  read the raw files of the default branch of each source on 2026-11-24, with no commit SHA, and it lists the sources
  that the session network blocked. Four patterns came from it: one append-only stream for each daemon beside a status
  field (Docker, journald, Nomad; Kubernetes, GitHub, Airflow); the transition in the type and the state in a field
  (GitHub, Temporal, OpenTelemetry); a resume position that the writer issues, with a defined answer when it is no
  longer kept (journald, Kubernetes, Nomad, Temporal); a start and an end for each unit with a duration (Temporal,
  OpenTelemetry).
- A step gives about 30 lifecycle entries, and a failure gives one entry. This is an estimate in the specification, not a
  measurement.
- The event record has a 5 MiB rotation, a 16 KiB line, and a 2-second lock bound, and each entry of it carries `argv`
  and `cwd`. It collects the failures of every repository of the user.
- The writer is synchronous, as the writer of the event record is, so it can wait up to 2 seconds for the lock while a
  reader holds the shared lock. No probe measured a read of 10 MiB.
- The build ran the writer, the reader, the entries of the daemon, and the entries of the landings in a fixture
  repository on Linux, with no `hc` and no Herdr app. No check ran a live step session, so `step.started`,
  `step.ended`, the `detached` end of a run, the adopted run after a takeover, and the `run.status` of a Stop request
  have been checked from the code and by probes of the pure parts only. No check ran these either: `daemon.ended` with
  `restart: true`; the `auto.status` changes that need an admitted auto loop (`on` to `stopping` to `off` with code 0,
  the off request, and the stop with a live loop); and a landing that reaches its suite. Each fixture landing ended with
  exit 6 before its suite, and `landing.waits` ran through a timing shim of `git ls-remote`. Windows has no runtime
  evidence, as for the event record.

## Decision

The master daemon keeps one lifecycle log for each repository, in its daemon folder
(`<git common dir>/celetis/daemon/events.jsonl`, with `events.1.jsonl` and `events.lock`). The maintainer picked this
approach (issue #388, "Approaches", approach 2, 2026-11-24).

- **One writer.** Only the master daemon writes. It makes its writer right after it takes the lock `daemon`, and its
  first entry is `daemon.started` with `seq` 1.
- **Shared code.** The writer and the reader use the lock, the line limit, and the rotation of the event record, as one
  module (`engine/lib/state/lines.ts`), with no copy.
- **The entry.** It takes the attribute names `id`, `type`, and `time` of CloudEvents, the form of a transition and a
  state of GitHub and Temporal, and an explicit state in `data`. `seq` orders the entries of one daemon and resets at
  each daemon start, and `id` is the resume position.
- **Two state axes with one writer site each.** The machine state of a run comes from the driver loop of `begin()`,
  which is the only code that sets it. The status label comes from `mark` only. `step.started` and `step.ended` derive
  from the machine transition.
- **The reader.** `celetis --agent <host> daemon events [--after <id>]` works with no daemon. It follows the reader of
  `celetis events`, and an unknown `--after` id gives all kept entries with one stderr line (the Nomad pattern).
- **A failed write changes nothing.** It changes no run, no landing, no exit code, and no answer of the daemon. The daemon
  prints one line, `daemon: cannot record the lifecycle event: <reason>`, for the first failure of each reason. This is
  the one new line that the daemon process prints, and it is no trace: it prints outside the frame of a run, and it
  records no transition. The trace of the transitions goes to the lifecycle log. So the refusal of ADR-0103 and its
  "Reconsider when" line stay true.
- **Not logged:** the coordinator session, the board, the queue record, and the direct landing.

The event record stays the record of failures (ADR-0066).

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: the maintainer sees what the daemon did in its autonomous runs from one ordered read, with
  no session open and no poll of snapshots.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **A `lifecycle` kind in the shared event record of the user** (approach 1). One file and one command. Rejected: a step
  gives about 30 lifecycle entries and a failure gives one, so the 5 MiB rotation pushes the failures out in days. The
  record also mixes the repositories of the user, and each entry carries `argv` and `cwd`.
- **A live stream from the socket of the daemon only** (approach 3, the Docker model). Rejected: the entries are gone at
  each restart of the daemon, and a tool cannot read what happened while it did not watch.
- **OpenTelemetry spans for runs and steps.** It is the state of the art for the run and step model, and it is not the
  recommendation. It needs the SDK packages and a collector before a person can read anything, and ADR-0066 rejected its
  SDK for the event record for the same reason. The entry keeps the idea of a start and an end for each unit, and the end
  state as a field.
- **A trace line in the daemon log.** Refused by ADR-0103.

## Consequences

- A person or a tool reads each lifecycle change of the work of a daemon, in write order, with no poll of snapshots, and
  follows with `--after <id>`.
- The machine names of `run.transition` are the names of the engine revision in `daemon.revision`. A later engine can
  rename a state, so a tool that keys on a name breaks.
- `numbers` of `run.started` is `null` for each run today.
- `restart: true` of `daemon.ended` is set from the claim of a successor when the stop completes. The spawn of the
  successor can still fail.
- The log is about 10 MiB at most, so the oldest entries leave with the rotation. A reader that fell behind gets all kept
  entries and one stderr line.
- The synchronous write can hold the daemon for up to 2 seconds while a reader holds the shared lock.
- A daemon that ends with `SIGKILL` or a crash writes no `daemon.ended`. A reader sees the next `daemon.started` with
  another PID.
- The read writes no entry. It makes `events.lock` when a log file exists and the lock file does not.
- The contract gets a new version, and the engine serves it beside the older versions. The contract of the plugin stays,
  because no plugin text uses the new form.
- The log has no follow mode and no filter option, and an OpenTelemetry export is not in this change.

## Reconsider when

- A tool needs a push of the entries, so that polling `--after <id>` is not enough. A follow mode can come later on the
  same file.
- A measured read or a measured volume shows that the 2-second wait of the synchronous write or the 10 MiB bound hurts a
  daemon.
- A tool needs the machine names to stay stable.
- The entries of the coordinator session, the board, the queue, or a direct landing have to be in the log.
- A transition of a run has to be traced in the daemon log (the condition of ADR-0103).
