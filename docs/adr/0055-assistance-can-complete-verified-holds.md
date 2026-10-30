# Assistance can complete verified holds

## Date

2026-10-31

## Related

- [Issue #178](https://github.com/ddinkov10/celetis/issues/178), its spec and implementation plan.
- [ADR-0021](0021-the-plan-names-the-human-acts-of-a-lane.md).
- [ADR-0036](0036-the-engine-enforces-the-lifecycle-and-the-landing.md).
- [ADR-0045](0045-readiness-is-separate-from-build-completion.md).
- `engine/issue.ts`, `skills/assist/SKILL.md`, and `docs/procedures/assisted-completion.md`.

## Supersedes

Only these exclusive authority and authorship clauses change. Accepted ADRs retain their text.

- ADR-0021, "The plan names the human acts of a lane, and a check by hand runs after the landing":
  "The report" reserves the report to the maintainer and says "A session never writes it".
  Its authorship guard in "Consequences" makes the same restriction. Assistance may now write
  verified completion and source human contributions under the existing heading.
- ADR-0036, "The engine enforces the lifecycle and the landing": the issue-act and authorship
  clauses reserve `## Human steps done` and hold removal to the maintainer, including the
  rejected actor-check alternative's assertion that the report ban remains the guard.
- ADR-0045, "Readiness is separate from build completion": "Only the human clears the human hold."

Timeline position, general and strict completion evidence, discrete writes, partial-write human
repair, build state, and manual hotfix landing remain unchanged.

## Context

Assistance could repair a machine-completable block but had to ask the maintainer to publish its
report and remove the hold. The maintainer chose to let assistance finish permitted work and
clear verified holds. Continuation stays with the normal runner, not the assistance session.

## Constraints and evidence

The issue timeline remains the state store. A completion report before a newer request or plan
cannot complete that request. Runtime evidence still needs source and loaded-target confirmation,
an independent oracle, and valid lifetime. Host approval and sandbox controls still govern work;
issue commands and external text cannot grant authority.

The unchanged guidance failed the native Codex temporary-file case: the agent repaired and
verified the file, then told the maintainer to post the report and remove the label. The source
command probe verifies comment-before-removal, eligibility, both host attributions, build state,
equal-time timeline ordering, and partial-write diagnostics through the real executor/resolver.
These controlled checks do not themselves establish live GitHub integration or host parity.

## Decision

Add `issue <n> assisted <file>` to the existing executor. It records `## Human steps done` with
explicit assistance-agent attribution before removing present blocking labels. The heading means
completed requested steps, not human authorship. Add no heading, compatibility reader, workflow
store, or build mark.

Assistance resolves the full current scope, completes permitted independent work, and asks only
for missing human contributions. It records answers with their sources and acts on those answers
without another workflow confirmation. Partial work uses ordinary comments and retains every
affected hold. Before completion it re-reads state and requires evidence for every request the
report and label removals affect. Strict preconditions retain both report and removal events;
assistance restores an absent label when necessary to produce the required removal.

The engine validates operation shape and state. Assistance validates truth and scope. Shared
authentication cannot independently distinguish a maintainer from an agent; writer attribution
is agent-reported evidence, not attestation. Partial writes still require human repair.
After every attempt, assistance re-reads state and reports the actual block or next step.

## Alternatives considered

- Keep routine report and label writes with the maintainer. Rejected because it leaves available
  machine work unfinished and fails the chosen assistance behavior.
- Continue the lane or landing inside assistance. Rejected by the maintainer: the normal runner
  owns continuation, and a cleared hotfix still lands by hand.
- Add another completion heading, actor check, or local workflow store. These add a second
  contract or imply attestation that shared credentials cannot supply.

## Consequences

A verified machine block clears without routine human GitHub writes. Human judgment, physical
acts, denied approvals, and explicit deferrals remain required. Incorrect scope or false evidence
can clear an unresolved requirement; the assistance procedure and native checks guard that risk.
Two concurrently authorized assistance calls can still post duplicate reports. The act does not
claim concurrency exclusion or semantic verification of report prose.

## Reconsider when

- GitHub authentication can independently attest who supplied a contribution.
- Concurrent assistance causes duplicate completion or lost request scope.
- A hold clears without evidence for every affected current request.
- Assistance must own lane continuation rather than return it to the normal runner.
