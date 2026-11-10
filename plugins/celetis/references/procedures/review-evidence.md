# Review evidence

Use [Demonstrate behavioral defects](../principles/demonstrate-behavioral-defects.md) for the
finding contract. Read it before reviewing, accepting findings, or repairing them. Keep the
findings and their evidence in the existing review report or ledger, not a parallel store.

## Reviewer

For each concrete behavioral concern, run the smallest permitted focused check and report its
evidence category under the principle. Respect the project's verification policy and the
reviewer's read-only checkout. Use an owned isolated copy for a mutating probe. A focused check
does not authorize a broad suite rerun, unsafe access, or extra permissions.

Include the complete evidence or unresolved-risk record, independently of severity and score.
For a non-behavioral finding, cite its constraint and source. Preserve decisive output, probe
contents, and source identity in the review record before removing owned temporary probes;
a deleted path alone is not evidence.

## Receiving session

Apply the principle's Check to each incoming finding before accepting a verdict or sending a
finding to a fixer. Verify the requirement against its source and rerun the focused reproduction
against the reviewed state, using an isolated copy when needed. Compare the result with the
report. A blocked, unsafe, or inconclusive rerun leaves an unresolved risk, not an accepted defect.
Check non-behavioral findings against their cited constraints; keep preferences optional.

Merge only findings whose demonstrated cause is the same. Keep their distinct affected inputs,
behaviors, and observations. Record accepted, merged, rejected, fixed, and unresolved dispositions
with reasons in the existing record as they occur. Rejection of an unsupported defect claim does
not discard its unresolved risk. Apply this acceptance again after an existing scoped re-review.

Send only accepted behavioral defects with their evidence and valid non-behavioral findings to
the existing fixer under its severity rules. Carry unresolved risks as context, explicitly outside
the automatic fix list. A mixed report does not promote a risk into a defect.

## Repairs and disposition

Give the fixer the accepted findings, retained evidence, and unresolved context, with the exact
resolved paths of this module and the principle. Require reads of both. Before the workflow
removes a review workspace, preserve the required review record, evidence, and dispositions in
the existing issue or a durable verification report. Record its location and confirm it remains
readable outside that workspace. Reconstruct later repair context from that retained record and
the current plan when the earlier workspace is gone.

Rerun the focused check against the changed state before marking a behavioral defect fixed.
Recheck a structural repair against its constraint. Renew evidence invalidated by changed code or
requirements. Use the existing scoped re-review where present. The inline final fix pass makes
its own focused check and gains no second reviewer. Preserve evidence before probe cleanup.

An unresolved material risk goes through `<plugin>/references/procedures/stop.md`, "The two modes",
for a maintainer decision before a clean close or unqualified PASS. Apply this also to parked,
deferred-minor, and out-of-scope findings; these dispositions do not settle material risk or expand
re-review scope. Retain any explicit maintainer disposition and its source with the unverified
evidence label. A risk-only stop dispatches no fixer and consumes no automatic fix round.
This procedure adds no review, fix allowance, or dispatch state.
