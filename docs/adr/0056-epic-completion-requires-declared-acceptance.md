# Epic completion requires declared acceptance

## Date

2026-10-31

## Related

- [Issue #187](https://github.com/ddinkov10/celetis/issues/187), its approved spec and plan.
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md).
- [ADR-0036](0036-the-engine-enforces-the-lifecycle-and-the-landing.md).
- [ADR-0045](0045-readiness-is-separate-from-build-completion.md).
- [ADR-0055](0055-assistance-can-complete-verified-holds.md).
- `engine/lib/epic.ts`, `engine/lib/epic-acceptance.ts`, and `skills/accept-epic/SKILL.md`.

## Context

Child completion establishes individual delivery, but it cannot establish a shared outcome.
The former last-child landing path closed the parent from child status alone. Independent
children, however, need no artificial integration check. The maintainer approved conditional
parent acceptance and assumptions A1–A4 in the issue's spec.

## Constraints and evidence

GitHub remains the durable state store. Epics have no lane, branch, build, landing, or runner
stage. Child landing and cleanup must succeed independently of parent acceptance. Existing
timeline and hold rules remain binding; hold clearance supplies no behavioral evidence.

GitLab's explicit epic close separates parent completion from child management. Factory
Missions uses separate checks of running behavior at validation boundaries. The approved spec
uses these patterns without adding a mission scheduler. The engine can validate data and current
issue inputs, but cannot establish the truth of arbitrary runtime observations. Shared
credentials provide no independent attestation of an evidence writer.

## Decision

Keep one bounded acceptance declaration in the parent body: an independent rationale or named
combined scenarios. Missing or ambiguous declarations remain unresolved. Scope changes require
a sourced maintainer decision. Children continue to consume the current parent body.

Use `issue <n> epic <file>` for definition publication and one guarded `complete-epic` operation
for parent completion. Last-child landing can invoke that guard for independent parents only.
Combined parents require the maintainer's explicit `accept-epic` session and a current submission
bound to the definition, complete child snapshot, targets, results, and published evidence.
The engine checks structural coverage and freshness. The session checks semantic coverage,
evidence truth, loaded targets, and lifetime. Every required criterion part stays visible.

Publish the accepted record before closing, with a stable identity that excludes only the current
review session and time. Re-entry reads actual state and reconciles partial writes. Serialize
definition and completion writes with a process-safe per-parent lock in the shared local Git
directory. Re-read under the lock and before closure. Existing holds use assistance, then return
to explicit acceptance. Repairs use linked child lanes; acceptance changes no retained code.

The accepted limits are:

- **A1:** The maintainer starts parent acceptance. No scheduler, event watcher, runner stage,
  or board layout is added. A last child closed by hand uses the same explicit entry.
- **A2:** The host usage-limit exception can permit child landing, but cannot complete a
  parent with a required BLOCKED check. Incomplete results retain their actual status.
- **A3:** Enforcement covers Celetis operations only. Direct GitHub closure by a user or
  another integration remains possible; Celetis reports a closed parent without inventing PASS.
- **A4:** Serialization covers processes sharing one local Git common directory. Separate
  machines and direct GitHub writes share no lock. Re-reads detect observed changes, without an
  atomic cross-machine snapshot or an exactly-once claim.

## Alternatives considered

- An automatic runner stage for every parent would add scheduling and workflow states beyond
  the approved scope, and unnecessary checks for independent epics.
- A final validation child would make acceptance look like implementation and still require a
  parent guard to prevent child status from becoming behavioral proof.
- Historical prose PASS or readiness labels would not bind current scope, children, or targets.
- A migration or default independent mode would silently accept undeclared shared outcomes.
- A distributed lock service would exceed the supported local concurrency boundary.

## Consequences

Combined parents remain open until current evidence establishes their outcomes. Independent
parents retain inexpensive completion. Explicit acceptance leaves a manual next action, and
semantic review remains necessary because a structured envelope cannot prove its own truth.
Partial writes retain evidence and require reconciliation rather than a direct-close repair.
No compatibility reader weakens existing unresolved declarations.

## Reconsider when

- The product requires automatic parent scheduling or a parent implementation lane.
- Cross-machine concurrent acceptance requires stronger serialization than local locks.
- The evidence store can independently attest runtime observations and their authorship.
- Direct external closure must be prevented rather than reported as outside Celetis enforcement.
