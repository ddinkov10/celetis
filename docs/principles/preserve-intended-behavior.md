# Preserve intended behavior

## Applies when

A change or documentation assessment compares requirements with implementation behavior.

## Rule

Keep intended behavior, observed implementation, and documentation claims distinct. Approved
requirements and applicable accepted decisions establish intent. A later approval can supersede
an earlier requirement; a plan, newer commit, passing check, or agent claim alone cannot.
Current normative documentation remains contract evidence when no later approval is established.

Correct stale documentation against established intent. Preserve the intended requirement when
implementation violates it, and keep that defect visible even when documentation also needs a
correction. Missing, inaccessible, ambiguous, or conflicting intent evidence remains uncertainty,
not permission to redefine the requirement from source behavior.

Preserve historical specifications, published plans, and decision records. A later approved
change belongs in current documentation, with its historical evidence intact.

## Check

For each changed behavioral claim, identify its supporting approval and compare the claim with
the implementation. Account for each discrepancy without turning a defect into a requirement
or rewriting history.
