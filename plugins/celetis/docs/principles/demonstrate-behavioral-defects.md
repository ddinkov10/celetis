# Demonstrate behavioral defects

## Applies when

A review reports a defect, accepts a finding, or verifies a repair.

## Rule

Separate evidence category from severity. A score, severity label, or plausible explanation
cannot establish a behavioral defect.

A **demonstrated behavioral defect** has all of this evidence:

- The required behavior and its source. A disputed inferred requirement stays unresolved.
- The affected file and line, and the reviewed revision or working-tree state.
- The exact executed reproduction or interaction, inputs, setup, and environment.
- The observed result, with decisive output or a captured observation.
- The expected result and how the observation violates the requirement.

A code-reading argument alone is not an executed reproduction. A setup or access failure does
not prove a product defect. A negative probe result does not prove the risk absent.

An **unresolved risk** records the concern, requirement or assumption, affected source,
available evidence, likely impact, and why the probe cannot settle it. Name the missing evidence
and the specific check or decision needed. An unresolved material risk prevents an unqualified
PASS. An explicit maintainer disposition can accept the risk or authorize mitigation; it does
not verify the evidence. Keep risks distinct from demonstrated defects, including in mixed reports.

A **non-behavioral finding** cites the source and an applicable structural, maintainability,
documentation, or style constraint. A directly observable violation needs no runtime reproduction.
A claimed runtime failure keeps the behavioral evidence requirement even when labeled structural.
Optional preferences remain optional.

## Check

Verify the requirement and its source, rerun the focused reproduction against the reviewed state,
and compare the observed and expected results before accepting a behavioral defect. Merge only
findings with the same demonstrated cause, preserving each affected behavior and observation.
Verify a repair against the changed state. Changed requirements or affected code invalidate
prior evidence that no longer applies; a past green result cannot establish a current repair.
