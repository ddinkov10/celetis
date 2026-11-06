# A capture record feeds the normal steps

## Date

2026-11-06

## Related

- [Issue #274](https://github.com/ddinkov10/celetis/issues/274): its approved spec
  (`Spec: 2026-11-06`), the decisions of the maintainer, and its plan.
- [ADR-0038](0038-a-bug-session-hands-on-to-plan.md): a bug session hands on to plan.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): skills load shared procedures on
  demand.
- `skills/capture/SKILL.md`, `docs/procedures/capture.md` ("The record", "A step with a record"),
  and the issue reads of `skills/specify/SKILL.md`, `skills/bug/SKILL.md`, and
  `skills/plan/SKILL.md`.
- `engine/lib/workflow.ts` (`factsOf`) and `engine/lib/config-core.ts` (the `skills` tuple).

## Context

A person often designs a feature or a bug fix in a free chat with an agent, outside a lane. The
decided work existed only in that chat. A lane started later asked the design questions again,
and a `plan` session in a fresh context could not see the chat at all. The maintainer wants one
explicit skill that records the decided work and continues the lane at its current step.

## Constraints and evidence

- The landing refusal is position-based: `factsOf` treats a refusal as current while
  `## Landing refused` is the last comment whose first line starts with `## `. A new `## `
  comment after it ends the refusal. A probe of the resolver in the plan session of #274 found
  one issue that resolves to `run /celetis:plan` with a current refusal: a `hotfix` issue with a
  root cause and a refused landing, relabeled to `bug` with no `ready-for-human`.
- `issue <n> plan` refuses an issue with no spec and no root cause, so a chat plan can be
  published only after its design artifact.
- `specify` tells the person to run `plan` in a fresh context; `bug` hands on to `plan` in the
  same session (ADR-0038).
- Text that two or more skills need is a module (ADR-0047). The record form and the read rule
  serve `capture`, `specify`, `bug`, and `plan`.
- In piped output, `gh issue view <n> --comments` omits the issue body (observed on #274).
- The prior art (OpenSpec explore and capture) keeps the person's confirmed decisions apart from
  proposals and open points, and later steps read the durable artifact, not the chat memory.

## Decision

The skill `capture` records the decided work as one comment headed `## Captured`, with the parts
`### Decided`, `### Plan`, and `### Open`, and then hands on to the current step of the issue.

- A decision is a point that the person stated or explicitly accepted. An agent proposal with no
  explicit yes goes under `### Open`. The person confirms the record before the post.
- The capture posts only while `issue <n> state` decides a Run of `triage`, `specify`, `bug`, or
  `plan`, and only with `refusal: none`. So the comment changes no resolver state.
- `specify`, `bug`, and `plan` read the newest record through `docs/procedures/capture.md`, "A
  step with a record". A `### Decided` line is an answer of the person and is not asked again; an
  `### Open` line is a gap. The record removes questions, not checks: each step still runs every
  check and addition of its skill.
- A published spec, root cause, or plan binds over the record. A contradicted line is void, and
  the step names it.
- In `bug`, a captured root cause is the first hypothesis. The red repro and the causal chain
  decide it.
- A captured plan is converted by `/celetis:plan #<n>` in a fresh context, as for any spec. On a
  `bug` issue, `bug` hands on to `plan` in the same session (ADR-0038).
- The capture records text only. It moves no code, branch, or uncommitted change, and it never
  edits a body or a published artifact.
- The skill is explicit-only on both hosts. `capture` is an allowed custom key of
  `.celetis.yaml` (the maintainer's decision in the plan session of #274).

## Alternatives considered

- **Everything in the chat session.** The capture hands on to the lane, and `plan` runs in the
  same session after `specify`, as `bug` already does. Rejected: nothing is recorded until each
  step publishes, so the decided work is lost when the session ends early or compacts; `specify`
  needs an exception to its fresh-context rule; and the runner cannot start the plan conversion.
- **Steps only, no entry.** `specify`, `bug`, and `plan` treat earlier conversation as decided
  input, and the person runs a lane in the chat. Rejected: it has no named entry, and it cannot
  carry a decided plan to a fresh session.

## Consequences

- The decided work is durable on the issue as soon as the capture ends, and both hosts behave
  the same.
- A captured plan needs one more session: the fresh `plan` session.
- A free-text capture repeats the short intake job (the intent, the `needs-triage` create, and
  "proceed?").
- The record stays on an epic parent, and a child's `specify` reads only the parent body. A child
  does not see the record; the person can capture again per child.
- A `### Decided` line that the person confirmed without reading still steers the next step; the
  person's confirmation is the only check of the record.

## Reconsider when

- The resolver stops reading headings by position, so a comment after `## Landing refused` no
  longer ends the refusal.
- A host carries a chat into a later session, so a fresh step can read the decided work itself.
- A third caller needs the intake job, so it can move into a module.
