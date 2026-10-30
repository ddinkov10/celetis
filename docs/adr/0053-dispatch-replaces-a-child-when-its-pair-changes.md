# Dispatch replaces a child when its pair changes

## Date

2026-10-30

## Related

- [Issue #181](https://github.com/ddinkov10/celetis/issues/181).
- [The blocked repair of #107](https://github.com/ddinkov10/celetis/issues/107).
- `engine/lib/dispatch-record.ts` and [Dispatch records](../capability.md#dispatch-records).

## Supersedes

[ADR-0041](0041-the-engine-owns-the-attempts-and-checks-each-dispatch.md) and
[ADR-0014](0014-one-workflow-uses-explicit-host-operations.md), only their requirement that a
changed pair stop the engine task loop before a repair or scoped re-review. Rules outside that
loop and all execution-evidence rules remain in force.

## Context

The saved Task 1 work of #107 passed to a failed gate. The engine recorded the failure and
advanced to attempt 2. The child had inherit/xhigh, while the repair required inherit/max.
The native follow-up could not change effort, so the engine stopped without issuing a repair.
Retrying `next` selected the same unsupported resume.

## Constraints and evidence

The active Codex follow-up accepts only a target and message. Isolated starts accept the
required effort. Celetis already has an engine-authorized replacement action and immutable
execution reports. Its counters belong to the task, not the worker. The saved failure is valid
evidence; replaying it would incorrectly advance the attempt again.

## Decision

Resolve the pair before choosing a normal action. Resume a started child only when its model,
effort, and runtime match. Otherwise issue the existing replacement action at the required pair.
Rank metadata alone does not change the effective pair. Preserve explicit BLOCKED and later-round
replacements.

Keep the same task and counters. Preserve saved work and all prior reports and child identities.
Give the replacement that saved context. Recover a gate failure that issued no repair with
`next`, using the saved task digits and bias. Do not edit the ledger or replay the gate.

Keep the schema and accepted no-worker retry rules. A retry retains its issued action and resume
identity; a changed binding cannot turn a failed resume into an unrecorded substitute. A valid
failed replacement can retry even when the freshly resolved pair matches the earlier child.
Pending, mismatched, incomplete, and unsupported executions still stop dependent work.

## Alternatives considered

- Stop every changed pair: a normal gate escalation becomes a permanent setup block even when
  the host can start the required pair.
- Lower the repair effort or alter the saved child: neither applies the resolved pair through
  supported native controls.
- Reset the task or replay the failed gate: this loses history or changes the failure count.
- Add a host-specific restart protocol or a new record shape: the existing replacement action
  already expresses the required transition.

## Consequences

Gate escalation can progress without a same-child effort override. Same-pair work retains its
child. Replacement loses the old child's conversational memory, so its brief must carry the
saved task context. Agents still apply native settings and report actual results; this adds no
independent native enforcement. Unsupported starts still stop setup.

## Reconsider when

- Supported follow-up operations can apply changed pairs to the same worker.
- Native execution evidence replaces agent-reported calls.
