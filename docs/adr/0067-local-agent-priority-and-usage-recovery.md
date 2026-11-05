# Local agent priority and usage recovery

## Date

2026-11-04

## Related

- [Issue #236](https://github.com/ddinkov10/celetis/issues/236), approved specification.
- [ADR-0015](0015-one-repository-yaml-config.md) and
  [ADR-0032](0032-shared-configuration-operation-snapshots.md).

## Context

A tracked scalar default cannot express a person's ordered choices or temporary usage blocks.
Editing it also changes repository policy for other machines. Two editors can replace local
preferences concurrently, while a host can report a new limit at the same time.

## Decision

Keep one ordered, unique, nonempty list of supported hosts in the canonical Git common
directory, shared by linked worktrees on this machine. With no record, use `claude`, then
`codex`. Setup initializes an absent preference from ordered `--hosts` only on `write`.
The `agents` command and board use the same store. Re-inclusion appends a host.

The preference record is exactly `{schema:1,order}` at `celetis-flow/agents.json`. Its version
is a digest of canonical content. A replacement supplies the version read by the editor.
Under one bounded preference lock, a stale different edit returns a conflict with the latest
valid order; a repeated current edit succeeds. Validate private directories, regular files,
opened identity, and content before atomic replacement. Invalid records remain intact.
Usage observations and attempt sequence state have separate targets and locks, so an order
edit cannot discard a concurrent observation.

This replaces only the YAML default-source clauses of ADR-0015 and ADR-0032. Remove YAML
`host` and setup `--default`, with no migration or legacy reader. YAML still owns workflow
policy and custom text. Each native skill entry still reads and validates the whole active
file. Keep the operation-local configuration and exact Resume contracts.

Carry default choice separately from the host of the current control operation. Explicit
`--agent`, explicit `CELETIS_AGENT`, explicit board choices, and saved Resume stay pinned.
Control operations use the first preferred host without quota checks and remain usable
through explicit selection when the preference is invalid.

New default work uses the first included host without a confirmed active usage block.
Only a bound, authoritative usage refusal permits progression; ordinary setup, network,
permission, model, authentication, and transport errors keep their existing handling.

Automatic cross-host continuation belongs only to runner-owned issue steps. Before retry,
end the owned session and establish that it and its delegated work cannot still write.
Re-read issue state under the existing ownership rules. Same-step dirty-lane recovery must
retain the binding to issue, branch, checkout, and attempt. Keep dirty-main guards, unresolved
Git-operation guards, human holds, and later workflow gates. A fresh host session rebuilds
context from the issue and checkout; native conversation IDs do not transfer.

Try each eligible host once per failure cycle. Exhaustion pauses the owned runner. A known
future reset schedules one wake; otherwise Retry permits one bounded attempt. Re-read order,
observations, ownership, and issue state before a wake. A stopped runner cannot wake. A
recovered preferred host affects the next step and does not interrupt working sessions.

Independent Intake, Assist, and Make visual sessions keep native recovery. Their observations
affect later starts, but their unsaved conversations do not move to another host.

## Alternatives

Keeping the scalar in YAML cannot express local priority or exclusion. Retrying every host
on every operation ignores known blocks. Adaptive balancing adds routing policy outside the
approved requirement. A shared preference-and-observation document could lose independent
updates and adds unnecessary serialization.

## Consequences

Local preference changes create no tracked diff. Existing YAML `host` is a validation error
for its owner to remove in a separate adoption operation. A digest detects stale edits but
grants no authority. Preference and observations survive restarts but authorize no new work.
Native interactive refusal transport remains required evidence for automatic recovery;
print-only observations and terminal text cannot replace it.
