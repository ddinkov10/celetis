# One shared event record with a lock

## Date

2026-11-03

## Related

- [Issue #239](https://github.com/ddinkov10/celetis/issues/239): the approved specification,
  "Approaches" and "Lock and rotation".
- [The principle `separate-before-serializing-shared-state`](../principles/separate-before-serializing-shared-state.md).
- `engine/lib/events.ts` (`withEventLock`, the writer and the rotation) and `tryFlock` of
  `engine/lib/update-lock.ts`.

## Context

Each Celetis process prints its failure to stderr, and nothing keeps it. The specification adds one
local, per-user record of failures that a later session reads with one command. Every Celetis
process of the user can fail at the same time, so all of them write to the record concurrently.
The principle `separate-before-serializing-shared-state` prefers a separate target for each writer.
When writers share a target, it requires enforced synchronization.

## Constraints and evidence

The writer runs in a synchronous `exit` handler, so it cannot wait asynchronously. The project
installs no npm packages (`--no-install`). The repository already has `tryFlock`: a non-blocking
`flock` on macOS and Linux, and `LockFileEx` on Windows. A Bun 1.4.4 probe on macOS showed that
`tryFlock` and `Bun.sleepSync(20)` work inside an `exit` handler, and that a 2-second retry loop
gives up after about 2 015 ms with the exit code unchanged. The scratch check of the recorder on
macOS wrote 20 concurrent entries as 20 whole lines, and 800 concurrent entries across one rotation
with no lost or split line. No check ran on Linux or Windows.

## Decision

All Celetis processes of a user append to one JSON Lines file, `events.jsonl`, and the writer keeps
one older file, `events.1.jsonl`. Each write and each rotation holds an exclusive `tryFlock` on
`events.lock`, and each read holds a shared one. A process waits at most 2 seconds for the lock,
then prints the failed-record line and keeps its exit code. The lock is the only synchronization.

The maintainer picked one file (issue #239, "Approaches"). A reader reads one file in one pass, and
the lock reuses the existing `tryFlock`, so the shared target costs one lock file and no new
mechanism.

## Alternatives considered

- One small JSON file per event, the npm CLI pattern. It needs no lock, because no two processes
  write one target, and the specification recommended it. The maintainer rejected it: the record
  becomes many small files, and the reader must list and sort a folder.
- A `bun:sqlite` database. It gives queries, but adds cross-process `SQLITE_BUSY` errors, a schema
  to maintain, and a binary file that an agent cannot read with its file tools.
- The OpenTelemetry SDK with a file exporter. It needs npm packages. The entry keeps its field
  names (`exception.type`, `exception.stacktrace`).

## Consequences

A reader gets all kept entries, oldest first, from two files. The record is about 10 MiB at most.
Each failing process takes the lock once at its failure, so a held lock can delay its exit by up
to 2 seconds, and a lost lock loses that entry with a visible stderr line. A writer that dies in the
middle of a line leaves a partial last line; the next writer ends it with `\n` under the lock, so
the reader reports one damaged line and reads the next entry. The behavior of `LockFileEx` in an exit handler, and of the
rename over an existing `events.1.jsonl`, is unverified on Windows.

## Reconsider when

- A check shows that `LockFileEx` or the rename of the rotation fails on Windows.
- A writer must wait longer than 2 seconds for the lock.
- The record needs queries, not one ordered read.
