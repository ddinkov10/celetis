# Readiness is separate from build completion

## Date

2026-10-28

## Related

- [Issue #160](https://github.com/ddinkov10/celetis/issues/160), its root-cause report, and the
  maintainer's choice of explicit completion comments.
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md): the pure shared resolver and
  comparison by result remain unchanged.
- [ADR-0036](0036-the-engine-enforces-the-lifecycle-and-the-landing.md): ordered issue evidence,
  discrete writes, human preconditions, and landing guards.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): scratch checks stay outside the repository.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): no product adoption or
  installation update is a precondition of this change.
- `engine/lib/workflow.ts`, `engine/issue.ts`, `engine/lib/lines.ts`, and `docs/issue-tracker.md`.

## Supersedes

Supersedes: The engine enforces the lifecycle and the landing, completion-by-readiness-removal
clauses only (ADR-0036).

The build rule and `plan-order` stop of ADR-0036 are replaced. The corresponding completion
clauses of ADR-0008, "The issue holds the marks of a landing", and ADR-0011, "The removal marks
the change as built" and "an issue with a `## Plan` comment and no `ready-for-agent` label reads
as built", are also replaced. The accepted records retain their historical text. The latest
plan boundary, timeline position rule, human evidence rules, and hotfix hand-landing rule stay.

## Context

`ready-for-agent` encoded both readiness and build progress. A blocked unfinished build retained
that label while `stopped` added `ready-for-human`. Removing the agent label alone made the
resolver report `built`; after the human cleared the hold, the unfinished change could land.
The maintainer requires one readiness label at a successful stop without losing build progress.

## Constraints and evidence

- GitHub remains the durable state store. The tracker already reads comments and label events
  in timeline order. Equal timestamps must not change their meaning.
- The root-cause reproduction records both readiness labels after `stopped`. A simulated agent
  label removal and human clearance then produce `built` and permit landing without completion.
- A plan-label write can fail after its comment succeeds. Missing readiness must not imply a
  completed build. An explicit precondition must block landing even if its label writes fail.
- GitHub label additions and removals use separate requests. Replacing the whole set can remove
  unrelated concurrent changes. The existing command reports partial failures for human repair.
- Temporary checks cover the resolver, command writes, partial failures, and shared consumers.
  They do not prove a live GitHub mutation or native host exit.

## Decision

Record completion with a `## Built` comment after the latest `## Plan`. The argument-free `built`
act posts this comment before removing `ready-for-agent` when present. A `## Before landing`
comment after the current plan also records completion, while retaining its human precondition.
These are the only completion records. A plan with neither remains `planned`, regardless of
readiness labels. With no plan, the build is `none`. A newer plan starts a new build.

Treat the readiness labels as current readiness only. Successful `stopped`, `ready-for-human`,
and `before-landing` acts add or retain the human label and remove the agent label. They preserve
unrelated labels. A plan posted under a human hold keeps that hold and removes the agent label;
otherwise it adds the agent label. Only the human clears the human hold. Clearance resumes the
actual build state without requiring the human to restore an agent label.

Keep the existing write executor and its partial-write refusal. A failed removal can leave both
labels temporarily, but the command reports failure. A successful completion comment remains
completion evidence even when a later label removal fails. Keep human report and removal
evidence separate from build evidence. Add no compatibility reader, migration, or fallback to
the old completion rule.

## Alternatives considered

- Remove the agent label at a stop but retain the old resolver. This permits an unfinished
  change to land after human clearance. Rejected.
- Add a separate build label with timeline evidence. This separates the attributes but adds a
  label and setup protocol when the existing issue timeline can hold explicit completion.
  The maintainer chose comments instead.
- Keep label-removal evidence for old histories. That preserves the ambiguous rule and can
  misclassify an unfinished stop. Rejected; existing remove-only histories receive no completion
  event automatically.
- Store progress locally. This would split the durable state and break issue-based handoffs.
  Rejected.

## Consequences

Stops can show one readiness value while retaining unfinished or completed build progress.
The `not-marked` and `added-again` build states and their repair instructions are obsolete.
A failed plan readiness write leaves an unfinished plan. The runner, board, and landing guards
consume the same three build states without another rule or a UI change.

Old remove-only build histories read as unfinished. There is no automatic migration. Separate
label requests still permit a temporary invalid pair on a reported partial failure or a
concurrent write. Installation and adoption remain separate maintainer operations.

## Reconsider when

- GitHub stops being the workflow state store, or no longer supplies the ordered timeline.
- Build completion needs evidence bound to a specific commit rather than the current plan.
- Readiness writes require an atomic guarantee that the GitHub label API cannot provide.
