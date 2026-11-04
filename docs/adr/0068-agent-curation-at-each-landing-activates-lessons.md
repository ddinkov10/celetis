# Agent curation at each landing activates lessons

## Date

2026-11-04

## Related

- [Issue #242](https://github.com/ddinkov10/celetis/issues/242): the approved specification,
  "Decisions of the maintainer", "Approaches", and "Design".
- [Issue #189](https://github.com/ddinkov10/celetis/issues/189): the lesson store and its human
  approval gate, which its specification recorded.
- [ADR-0052](0052-setup-owns-required-configuration-and-host-wiring.md): setup creates no store.
- [ADR-0008](0008-the-build-step-lands-the-change.md) and
  [ADR-0036](0036-the-engine-enforces-the-lifecycle-and-the-landing.md):
  `land` is the one landing path.
- `docs/procedures/lesson-curation.md`, `docs/procedures/landing.md` ("Step 3: the landing"), and
  `applyLessonReview` and `commitLessons` in `engine/lib/lesson-store.ts`.

## Context

A captured lesson steered no task until a human approved its exact snapshot in `lesson-review`.
On 2026-11-04, the main checkout of this repository held 22 pending proposals and 0 active
lessons, so no lesson steered work. The maintainer asked for a product that improves itself with
no review of each lesson by a person.

## Constraints and evidence

- The maintainer decided four points in the specification: (1) the judge is an agent reviewer,
  not a human and not a count rule; (2) lessons persist in git on `origin`; (3) lessons reach the
  trunk through the landing of a lane; (4) this is a first version, and a pending queue on each
  device is acceptable.
- 19 of the 22 pending proposals had one incident.
- Pending records hold excerpts of tool output and user text: untrusted data at the input of the
  reviewer.
- `land` refuses a main checkout with commits that the trunk does not have, and a lane branch
  that does not contain the trunk head.
- Prior art: GitHub Copilot Memory and Claude Code auto memory write memories with no approval
  and let people review them afterwards; ACE separates the Reflector that extracts a lesson from
  the Curator that merges it with deduplication.

## Decision

Before `land` puts a change on the trunk, the step that lands curates the lesson queue in the
lane checkout; a run of `land` again after the change is on the trunk curates nothing.
One fresh reviewer child, not the agent that captured the incident, decides at most the five
oldest proposals by "The reviewer rules" of `docs/procedures/lesson-curation.md`. It runs
`lesson-store preview` and `lesson-store apply` itself. In a linked checkout, `apply` makes one
local lesson commit on the lane branch, and only after that commit does it remove the proposal
from the queue of the main checkout. The lessons reach the trunk in the squash of `land`, with
the checks of the project. A curation failure never blocks or fails the landing.

This replaces the human approval gate of #189. An approval is the decision of the reviewer, human
or agent; the snapshot digest now detects stale input, not a human approval. `lesson-review`
stays as the optional human review, with the exact preview and the explicit approval. Its result
goes to the checkout where it runs.

No live catalog file exists. `lesson-store read` derives the active and history lists from the
lesson files, so two lanes with different new lessons merge with no conflict, and a leftover
`docs/lessons/INDEX.md` fails each read. This amends the sentence of ADR-0052 "A live lesson or
approved promotion creates its catalog on first use": a live lesson creates only its own file.

## Alternatives considered

- **No judge.** Capture writes active lessons at once. Rejected: each guess about a cause becomes
  a rule in every matching plan, and duplicates and contradictions accumulate.
- **A count rule.** A proposal becomes active at its second incident. Rejected: 19 of 22
  proposals had one incident, so learning is slow.
- **A store outside git**, as Claude Code auto memory keeps it. Rejected by decision 2: the
  lessons stay on one machine.
- **A direct commit and push to the trunk.** Rejected: a protected trunk of a `pr` project
  refuses it, it races with `land`, and each lesson commit makes each open lane merge and run the
  verify gate again.
- **A lesson branch**, as git-bug keeps its data under its own references. Not chosen: the
  maintainer wants the lessons on the trunk.

## Consequences

- A captured proposal becomes an active lesson on the trunk at a later landing, with no human
  act. Each decision record names the agent review and the lane in its `source`.
- An agent can approve a wrong rule. The reviewer rules, the separate reviewer, and the optional
  human audit reduce this risk; they do not remove it.
- Each landing with a nonempty queue costs one reviewer child. The batch bound spreads a long
  queue over several landings.
- A lane abandoned after its lesson commit and before its landing loses the proposals that it
  took from the queue: there is no claim state.
- A revert of a change also removes the lessons that it carried. The PR of a `pr` project shows
  the lesson files to the code reviewer.
- With no staleness check, the active lessons only grow, except by supersession and retirement.

## Reconsider when

- A Celetis service with its own persistence holds the lessons.
- The reviewer approves an unsafe or weak rule in a host check or in use.
- The cost of one reviewer child at each landing outweighs the value of the lessons.
- Lessons need a staleness check against the current code, or an expiry.
