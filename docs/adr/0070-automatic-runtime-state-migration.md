# Automatic migration of Celetis-owned runtime state

## Date

2026-11-05

## Related

- [Issue #244](https://github.com/ddinkov10/celetis/issues/244).
- `engine/lib/state-migration.ts`, `engine/lib/state-preparation.ts`, and the queue, session,
  and dispatch stores.
- [The continuous queue](../workflow.md#the-continuous-queue).

## Supersedes

[ADR-0014](0014-one-workflow-uses-explicit-host-operations.md), only its exclusion of migrations for
Celetis-owned runtime records; strict host metadata and installation boundaries remain.
[ADR-0049](0049-the-engine-binds-dispatch-report-identity.md), only its schema-1 dispatch
refusal and fresh-session requirement caused by that format. Manual-only queue and saved-session
schema recovery clauses in current references are replaced by this decision. Other decisions remain.

## Context

After a Celetis update, a valid empty schema-2 queue blocked ordinary board Run. The maintainer
approved automatic conversion only for Celetis-owned persisted runtime state in #244, including
preservation of unfinished work, order, authority, and exact source bytes.

## Constraints and evidence

The queue has execution ownership and a short native write lock. Historical schema 1 writers
hold execution ownership without that write lock. Saved sessions share issue ownership with
Resume; dispatch records already have a per-record transaction. Previous runners recognize
`celetis-flow.ts` by its process command line, so a board process cannot substitute for a runner
owner. A global installation update cannot safely discover project state or exclude live work.
The approved spec establishes the mappings and the narrow exception to the no-migration rule.

## Decision

Convert supported historical runtime records at their ordinary access boundary. Each store
validates its complete historical input and current target, and consumers and writers use only
the current format after preparation. Share checked filesystem preservation and atomic replacement,
with no migration registry or compatibility consumer.

- Queue schemas 1 and 2 become schema 3. Schema 2 retains work, state, Runs, reason/action,
  and pending launch authority. Schema 1 retains `numbers.slice(position)`; complete becomes
  empty, and completed history stays in the backup. Nonempty work pins the old host explicitly.
  Active host and wait ID become null; schema 1 launch is null. Advance the revision once.
- Saved session schema 1 becomes schema 2. Preserve native identity, host, issue, step, and
  main checkout exactly, including a null native ID. Set the new effort policy to `high`;
  this makes no claim about historical effort and grants no Resume authority.
- Dispatch schema 1 becomes schema 2. Require report host/session to match the enclosing record
  and active binding, then remove only those duplicates. Preserve all execution and child history.

Queue conversion holds queue execution ownership, then current-issue ownership, then the write
lock. Session conversion holds issue ownership; dispatch uses its existing lock. Reread under
ownership. A same-revision finite internal `celetis-flow.ts` path provides ownership for board
and other unowned callers, with no host, terminal, GitHub read, or workflow authorization.
A live owner causes bounded refusal; an ordinary retry can proceed after it exits.

Publish exact source bytes to a private immutable sibling archive named by basename, source
schema, and SHA-256 before replacing the live record atomically. Validate existing archives
before reuse. The live schema marks completion; retries create no duplicate effects. Unsafe,
invalid, unsupported, or unmappable data refuses intact. Never restore backups automatically.
This guarantees process-interruption recovery on the exercised local filesystem, with no
power-loss durability claim.

Later changes to accepted persisted runtime formats bump their schema and supply explicit
conversions for supported predecessors, or record why safe conversion is impossible. Arbitrary
history and downgrade conversion are not promised. Current and missing records keep their
normal behavior; unchanged formats need no speculative converter.

Product configuration, tracked content, setup and update wiring, lessons, capability profiles,
host registries, native conversations, session-attempt archives, and prior backups are excluded.
No product scan or real installation update is part of conversion. Product adoption remains
independent under ADR-0031, and obsolete public CLI forms remain removed.

## Alternatives considered

- Move all runtime stores to SQLite: its transactions help, but the storage and access rewrite
  exceeds the requirements of these small existing stores.
- Run version handlers during installation: installation versions do not identify project record
  schemas or provide exclusion against live owners, and project enumeration is out of scope.
- Keep manual archival: it interrupts valid unfinished work and caused the reported Run failure.

## Consequences

Ordinary reads can perform bounded schema maintenance without starting work. Exact archives
cost disk space and remain until explicitly managed. Conversion can refuse while work is live
or when old data cannot satisfy the current invariant. Native filesystem and ownership behavior
must be checked on each claimed platform; atomic rename alone proves no power-loss guarantee.

## Reconsider when

- A future format requires atomic changes to more than one live record.
- The local filesystem or process-identity primitives cannot enforce the preservation contract.
- State size or concurrent access makes the existing individual JSON transactions insufficient.
