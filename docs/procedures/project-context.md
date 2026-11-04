# The project context

The grounding reads of a change, before the step that designs, plans, debugs, or edits it.
`bug`, `chore`, `hotfix`, `plan`, and `specify` cite it.

Read, in the checkout of the lane:

- `AGENTS.md` — the architecture of the project.
- the `AGENTS.md` of each subsystem that the change touches, or likely touches.
- the lessons — run `celetis --agent <host> lesson-store read active`. It validates this
  checkout's lesson files. Scan its `active` records for lessons matching this change
  and read each match in full; its `files` entry holds the validated text and digest. A
  `history` record is evidence of past guidance, never a current instruction. A link between
  lessons is a lead to check, not a rule.
- `docs/adr/` — the architectural decisions that bear on the change; factor them in.

A confirmed missing ADR store means no recorded decisions. An empty `active` list means no
lessons. Create no store paths during grounding. Access failures and format failures in an
existing store are errors: report the path and cause instead of treating the store as empty.
A nonzero exit of the lesson read is such an error.

Surface the traps of those subsystems as constraints on the change early, so that the change
cannot violate them; a spec, a plan, or a report that the step writes carries them.
