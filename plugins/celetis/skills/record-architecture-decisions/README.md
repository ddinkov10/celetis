# Architecture Decision Records

Records of architectural decisions the code cannot express: durable choices about *why* a part of
the project is shaped as it is. When an issue is triaged — at the type-axis step, inside a lane
skill, or in free-flow consultation — consult this store and factor past decisions into the verdict.

## When to write one

Create an ADR when a decision:
- is architectural — it shapes why a part of the project is the way it is (a structural split,
  a cross-component contract); AND
- chose among meaningful alternatives; AND
- cannot be recovered from the code.

## How to write one

1. Use the `celetis:record-architecture-decisions` skill to review and land the record.

## Rules

- Merged = accepted. An unmerged ADR is a proposal in its branch.
