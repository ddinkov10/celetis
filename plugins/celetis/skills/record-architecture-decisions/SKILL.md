---
name: record-architecture-decisions
description: Use when a decision is significant enough that a future maintainer must know why it was made — hard to reverse, surprising without context, and chosen among real alternatives. Not for routine work, obvious choices, lane-type verdicts, or a harness learning-loop.
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/references/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# Record Architecture Decisions

The read/write tool for `docs/adr/`. Decisions here are architectural: durable choices about
why a subsystem or the harness is shaped as it is (a structural split, a cross-component contract, an
engine or scheme choice) — the things code cannot express. This is harness-level memory; it is not a mechanical learning-loop that
auto-promotes facts from runs.

## Guidance and store

Before a read or write, read `<plugin>/skills/record-architecture-decisions/README.md` and
`<plugin>/skills/record-architecture-decisions/template.md`. Honor product ADR policy in `AGENTS.md` or the document it names.
Preserve existing product `docs/adr/README.md` and `docs/adr/template.md` without rewriting or
deleting them.

A confirmed missing `docs/adr/` means no records. A read creates no store. Validate existing ADR
records against the record format in the plugin template and the product policy. An access
failure or a malformed record is an error: report its path and cause, then stop before writing.

## Read

When classifying an issue — at triage or inside a lane — search the ADR store for
decisions that bear on the verdict:

1. If the store exists, list its records and search for relevant terms.
2. Read each matching ADR's `Decision` and `Reconsider when`. A decision whose premise just became
   false (per `Reconsider when`) must not be inherited — re-evaluate and flag it. When
   `CONSTITUTION.md` exists, also flag an ADR whose decision conflicts with it, the same way; the
   first sentence of `<plugin>/references/procedures/constitution.md`, "A conflict", defines a
   conflict. The read only flags the ADR: the stop and the question of that section are for a
   decision that a decision document of a step records.
3. State in your handoff which ADRs you consulted and how each affected the verdict.

## Write

An ADR is for a decision a future maintainer must know. All THREE must hold:

1. **Hard to reverse** — the cost of changing the decision later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder why it is this way.
3. **The result of a real trade-off** — genuine alternatives existed and one was picked for specific reasons.

If any one is missing, do not write an ADR; state "no ADR needed". A lane-type verdict (which of
`/celetis:bug`, `/celetis:hotfix`, `/celetis:feature`, `/celetis:chore` an issue takes) fails all three — never an ADR. Routine maintenance, implementation detail, and choices the code already
makes obvious are not ADRs.

When all three hold:

1. Check whether the decision is already recorded. Reuse that record instead of creating a duplicate.
2. Create `docs/adr/` only when writing the record. Use `0001` with no existing records; otherwise
   use the next number after the highest existing record number. Copy the plugin template to
   `docs/adr/NNNN-short-title.md` and fill every section. Before filling the sections, apply
   `<plugin>/references/procedures/constitution.md`; omit the `## Constitution` section of the
   template when the project has no `CONSTITUTION.md`. Before writing, check that the destination
   and its parent paths are in the project and are not symlinks.
3. If replacing a prior decision, add a new ADR with `Supersedes: <old-title>`; never rewrite a landed ADR.
4. Commit the landed ADR with the subject `docs(adr): <topic>`; no commit when no ADR landed.
