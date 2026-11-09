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

Do not create one for:
- a lane-type verdict — which of `/celetis:bug`, `/celetis:hotfix`, `/celetis:feature`,
  `/celetis:chore` an issue takes;
- routine maintenance, implementation detail, or a choice the code already makes obvious.

## How to write one

The generic guidance and [template](template.md) are read from the plugin. Product ADR policy
belongs in the product's `AGENTS.md` or the document it names. Existing product README and template
files remain product content.

1. Read the plugin template and the product ADR policy.
2. Create `docs/adr/` when writing the first record. Copy the plugin template to
   `docs/adr/NNNN-short-title.md`: `0001` for an empty store, otherwise the next number after the
   highest existing record number.
3. Fill every section. Omit `Supersedes` when no decision is being replaced.
4. Use the `celetis:record-architecture-decisions` skill to review and land the record.

## Rules

- Merged = accepted. An unmerged ADR is a proposal in its branch.
- Never rewrite a landed ADR. To change a decision, add a new ADR with `Supersedes: <old-title>`.
- `Reconsider when` is the machine-consumable core: a classifier greps for a decision whose premise
  just became false, and re-evaluates rather than inheriting a stale decision.
