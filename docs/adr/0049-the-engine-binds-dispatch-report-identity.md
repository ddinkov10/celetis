# The engine binds dispatch report identity

## Date

2026-10-29

## Related

- [Issue #171](https://github.com/ddinkov10/celetis/issues/171).
- [The observed stop on #166](https://github.com/ddinkov10/celetis/issues/166#issuecomment-6501883048).
- `engine/dispatch.ts`, `engine/lib/dispatch-record.ts`, and [Dispatch records](../capability.md#dispatch-records).

## Supersedes

[ADR-0041](0041-the-engine-owns-the-attempts-and-checks-each-dispatch.md), only its requirement
that an execution report repeat the current host and session. The other decisions remain in force.

## Context

The command already selects a private record with the running host and validated host session
environment. Asking the agent to repeat that identity creates a second input for the same fact.
On #166, a task name in the report's session field stopped implementation after a native spawn
and required the maintainer to clear the hold.

## Constraints and evidence

The maintainer reports repeated failures of this kind. The observed #166 stop identifies the
wrong value and the actual session. A scratch probe on the unchanged checkout rejects a report
that supplies only call and outcome with `invalid report.host`. Dispatch IDs are issued inside
the selected record, and reports cannot complete an unknown ID there. The record loader checks
the host and session before an act can mutate it.

## Decision

An execution report contains exactly `call` and `outcome`. Keep host/session identity once,
in the engine-owned record. The active command selects that record; its dispatch ID must exist
there. Preserve the exact report, provenance, action checks, counters, and immutable evidence.

Use record schema 2 for the changed stored report shape. Reject old records without migration
and retain them as evidence. Use a fresh host session after the update. The CLI result envelope
remains schema 1.

## Alternatives considered

- Add stronger prompt reminders or expose the identity for copying: this retains the second
  input and the same failure mode.
- Retry or correct an identity mismatch after submission: this changes rejected evidence and
  weakens the meaning of setup stops.
- Accept both report formats: this keeps an obsolete path and two sources for one identity.

## Consequences

Agents cannot invent a current session field in valid report input. Cross-session and cross-host
dispatch IDs refuse as unknown in the selected record. Missing or invalid environment identity
still stops setup. Native mismatches still save their evidence and stop dependent work.

Existing sessions with old records need a fresh host session. The engine still validates
agent-reported calls; this does not add independent native enforcement or prevent a consistently
false report. The guarantees still depend on the actual host environment reaching the command.

## Reconsider when

- A supported host supplies independently verified execution events that replace agent reports.
- A dispatch must intentionally move between host sessions, with a defined authority transfer.
