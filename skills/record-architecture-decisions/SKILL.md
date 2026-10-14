---
name: record-architecture-decisions
description: Use when a decision is significant enough that a future maintainer must know why it was made — hard to reverse, surprising without context, and chosen among real alternatives. Not for routine work, obvious choices, lane-type verdicts, or a harness learning-loop.
---

**Host entry.** Read [the host operations](../../docs/hosts/entry.md) relative to this loaded SKILL.md before the procedure, including a same-session handoff.

# Record Architecture Decisions

The read/write tool for `docs/adr/`. Decisions here are architectural: durable choices about
why a subsystem or the harness is shaped as it is (a structural split, a cross-component contract, an
engine or scheme choice) — the things code cannot express. A lane-type verdict (which of `/celetis:bug`,
`/celetis:hotfix`, `/celetis:feature`, `/celetis:chore` an issue takes) is not an architectural decision and does not
belong here. This is harness-level memory; it is not a mechanical learning-loop that
auto-promotes facts from runs.

## Read

When classifying an issue — at triage or inside a lane — search the ADR store for
decisions that bear on the verdict:

1. List the store: `ls docs/adr/`.
2. Read `docs/adr/README.md` if you have not already.
3. Grep for relevant terms: `grep -ril "<term>" docs/adr/`.
4. Read each matching ADR's `Decision` and `Reconsider when`. A decision whose premise just became
   false (per `Reconsider when`) must not be inherited — re-evaluate and flag it.
5. State in your handoff which ADRs you consulted and how each affected the verdict.

## Write

An ADR is for a decision a future maintainer must know. All THREE must hold:

1. **Hard to reverse** — the cost of changing the decision later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder why it is this way.
3. **The result of a real trade-off** — genuine alternatives existed and one was picked for specific reasons.

If any one is missing, do not write an ADR; state "no ADR needed". A lane-type verdict fails all
three — never an ADR. Routine maintenance, implementation detail, and choices the code already
makes obvious are not ADRs.

When all three hold:

1. Read `docs/adr/README.md` and `docs/adr/template.md`.
2. Copy `template.md` to `docs/adr/NNNN-short-title.md` (the next number after the highest in the store) and fill every section.
3. If replacing a prior decision, set `Supersedes: <old-title>`; never rewrite a landed ADR.
4. Commit the landed ADR with the subject `docs(adr): <topic>`; no commit when no ADR landed.

!`cat "$(git rev-parse --show-toplevel)/.claude/celetis-flow/custom/record-architecture-decisions.md" 2>/dev/null || true`
