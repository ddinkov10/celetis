# Explicit host usage limits can permit landing

## Date

2026-10-30

## Related

- [Issue #172](https://github.com/ddinkov10/celetis/issues/172)
- [Runtime verification](../../plugins/celetis/docs/procedures/runtime-verification.md#usage-limit-exception)
- [ADR-0011](0011-a-step-session-hands-a-stop-to-the-issue.md)
- [ADR-0036](0036-the-engine-enforces-the-lifecycle-and-the-landing.md)

## Supersedes

Only ADR-0011's blanket requirement that every unrun Verify scenario prevents landing.
Its other decisions remain in force, including the handling of guard refusals and step stops.

## Context

A host usage limit can block a change that the other supported host has verified.
The historical landing of #166 required a separate maintainer waiver. Repeating that process
adds a human dependency without adding evidence about the unavailable host.

## Constraints and evidence

The specification requires complete valid runtime evidence on one supported host and an explicit
observed usage-limit refusal on the other. The gate alone cannot establish runtime behavior.
The hosts have no established common quota diagnostic or exit code. Synthetic probe inputs do
not establish real host coverage. Issue #172 holds the actual probe records and their limits.
The engine enforces workflow readiness; it does not assess the truth of prose runtime evidence.

## Decision

Keep the narrow eligibility and reporting rule in the runtime verification procedure.
Its callers apply that rule before creating a new quota-only human hold, in every lane and in
both interactive and step sessions. Existing human holds keep their completion requirements.
Source and target evidence keeps its current lifetime, including after repairs and on re-entry.
The existing landing command and all other landing prerequisites remain required.

The procedure separates the result of a check from whether its permitted absence prevents
landing. Incomplete host checks remain BLOCKED. Acceptance can omit operations specific to the
quota-blocked host, and a passing host never proves parity with the other host.
This durable coverage trade-off belongs in an ADR because it changes what landing acceptance
means and cannot be inferred from the unchanged engine.

## Alternatives considered

- An engine quota classifier and workflow transition would add state and parsing without a
  reliable shared diagnostic format. The requested decision needs neither.
- Per-change human waivers preserve the former process but do not meet the requested behavior.
- Calling quota-blocked checks PASS would hide incomplete coverage and falsify the report.

## Consequences

Eligible builds can use the normal landing path without a separate quota waiver.
Reports must preserve exact diagnostics and incomplete scenarios. The blocked host remains
unverified for those scenarios. Ambiguous errors and actual failures retain ordinary handling.
This procedure adds no permission to clear existing holds or convert historical records.
An agent still supplies the evidence; the engine makes no independent claim that it is true.

## Reconsider when

- The hosts expose reliable structured quota results that justify engine validation.
- A defect shows that the accepted absence of host-specific coverage is too costly.
- Runtime reports cannot reliably distinguish usage limits from actual failures.
- A future requirement needs automatic clearance of existing holds or another workflow transition.
