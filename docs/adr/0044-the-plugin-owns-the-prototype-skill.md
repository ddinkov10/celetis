# The plugin owns the prototype skill

## Date

2026-10-28

## Related

- [Issue #146](https://github.com/ddinkov10/celetis/issues/146): the spec (approaches A to C), the
  calls of the session, the plan, and its Verify phase.
- [Issue #142](https://github.com/ddinkov10/celetis/issues/142): the design whose look decision
  showed the problem.
- `skills/prototype/`, and its `UI.md`.
- `AGENTS.md`, "Traps": the line that named `prototype` as vendored.

## Context

Text does not carry the idea of a UI. The maintainer must see how each option looks and behaves
before the pick. In the design of #142, the first options came as ASCII mockups. The session built
the variants before it researched how other products solve the problem. The questions about the
states came after the prototypes, and the approval-dialog state showed only after a late switch.

`specify` and `bug` built `celetis:prototype` variants only when the issue and the answers left the
look open. The `prototype` skill was vendored from `mattpocock/skills`. It knew only web pages. It
had no list of states, no screen sizes, no research, and no record that stays after the landing.
The screenshots went on the `prototype/<n>-<slug>` branch, and the landing deletes that branch.

## Constraints and evidence

- The vendored status was only a convention: a trap of `AGENTS.md`. No script synced the skill.
- The skill already held the host-entry line of celetis, so it was no longer a plain copy.
- The upstream skill knows only web pages: one route, a `?variant=` parameter, and a floating bar.
- `celetis --agent <host> land` deletes the prototype branches of the issue, so a screenshot on
  that branch does not stay.
- Storybook has one story for each state of a component. Chromatic captures one snapshot of each
  story at each configured viewport for review. Jetpack Compose and SwiftUI previews vary one view
  over its inputs and its device sizes. VHS records a terminal at a fixed size.
- `gh` 2.99.0 added `--attach` to `gh issue comment`: it uploads an image or a video into the
  comment, inline. GitHub Enterprise Server does not support it.

## Decision

**A first-party skill.** `skills/prototype/` belongs to the plugin and has no upstream. Only
`writing-for-agents` stays vendored.

**One home for the procedure.** `UI.md` holds the whole procedure of a look decision for each kind
of product: web, mobile, desktop, and terminal. It names the list of states and the platform row
before the build, the research before the variants, the live switches, the check at each size, the
captures, the hand-over with a recommendation, and the record. `specify`, `bug`, and `plan` cite its
headings for the procedure. Each caller keeps only the trigger of its step and the rules of its own
branches, for example the opt-out of `specify` and the regression fix of `bug`.

**The captures go on the issue.** Each capture is an attachment of an issue comment whose first line
is no `## ` heading, so the resolver does not read it. The branch holds the code of the variants and
no capture.

## Alternatives considered

- **A. One new plugin document, `docs/ui-decision.md`.** `specify` and `bug` cite it, and the
  vendored `prototype` stays unchanged. It gives one source with no drift, but the procedure is in
  two places: the vendored skill and the document. The session recommended A, because it kept the
  vendored text unchanged. The maintainer picked ownership of the skill.
- **B. The same rules in `specify` and in `bug`.** It needs no new file, but the two copies drift,
  and both skills get longer.

## Consequences

- The procedure of a look decision has one home. A change of the trigger of a step also edits the
  skill of that step.
- No merge from upstream comes. A later sync from `mattpocock/skills` must not overwrite `UI.md`.
- Each capture needs `gh` 2.99.0 or later on github.com, and the capture tool of the platform row.
  A project on GitHub Enterprise Server stops at the first capture.
- A product `AGENTS.md` that describes a look decision with the old, narrow meaning updates its text.
  The maintainer of each product owns that adoption (ADR-0031).
- The desktop row has no checked source. The first product of that kind checks it.

## Reconsider when

- The upstream skill gains a list of states, rows for each platform, and a record that stays after
  the landing.
- The plugin drops the look decision from `specify` and `bug`.
- GitHub removes `--attach`, or the issue stops being the record of a look decision.
