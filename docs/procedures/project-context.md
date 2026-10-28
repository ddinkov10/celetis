# The project context

The grounding reads of a change, before the step that designs, plans, debugs, or edits it.
`bug`, `chore`, `hotfix`, `plan`, and `specify` cite it.

Read, in the checkout of the lane:

- `AGENTS.md` — the architecture of the project.
- the `AGENTS.md` of each subsystem that the change touches, or likely touches.
- `docs/lessons/INDEX.md` — scan it for lessons matching this change; read each match in full.
- `docs/adr/` — the architectural decisions that bear on the change; factor them in.

Surface the traps of those subsystems as constraints on the change early, so that the change
cannot violate them; a spec, a plan, or a report that the step writes carries them.
