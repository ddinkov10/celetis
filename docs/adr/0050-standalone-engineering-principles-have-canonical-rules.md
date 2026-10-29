# Standalone engineering principles have canonical rules

## Date

2026-10-29

## Related

- [ddinkov10/celetis#166](https://github.com/ddinkov10/celetis/issues/166): standalone engineering
  principles, from the approved scope of
  [#165](https://github.com/ddinkov10/celetis/issues/165).
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): placement of agent text and the
  standard skill entry.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the verify gate and the ban on tracked tests.
- `docs/principles/`, `checkCitations` in `scripts/verify.ts`, and `AGENTS.md`, "Where agent text
  lives".

## Supersedes

From ADR-0047, "Skills load shared procedures on demand, and entry is a facts block", its
Decision, "Three layers and one placement rule": only the caller-count placement of general
engineering principles. These rules now have their own canonical files even with one or no
current callers. The placement of procedures, the entry contract, host-specific text in
procedure modules, and the ban on reading another skill's `SKILL.md` as a reference still hold.
The landed record keeps its text.

## Context

An engineering principle must serve both ordinary tasks and workflow steps. A rule kept only
inside a lane cannot serve an ordinary task. Copies in several callers can diverge. Caller
count does not determine whether the rule needs an independent home.

## Constraints and evidence

- The approved scope names nine principles. Each needs an applicability trigger, an action,
  and an observable completion check.
- The [Agent Skills specification](https://agentskills.io/specification), read on 2026-10-29,
  separates metadata discovery, activated instructions, and resources loaded as needed. It
  supports a skill that points directly to a separate rule file.
- Loading all rules at entry would add instructions that do not apply to the task. The normal
  skill entry, configuration validation, and per-invocation custom text must remain intact.

## Decision

General engineering principles live in `docs/principles/<name>.md`, separate from procedure
modules. Each file stands alone and has exactly `Applies when`, `Rule`, and `Check` sections.
It names no issue state, workflow command, host tool, or product-specific path. Its home does
not depend on its caller count.

A discovery skill supplies the trigger and the normal entry, then points directly to its rule
file. A workflow caller points to that same file when the trigger applies. The rule body has
one home. No entry scan, router, or required principle catalog loads the rules as a group.

`checkCitations` checks direct `docs/principles/*.md` files with the skills, procedure modules,
and step text. Principle citations and relative links must resolve to tracked files, and
principles obey the host-reference restriction. Only procedure modules need two citers. Skill
entry-line checks and all other file roles remain unchanged.

## Alternatives considered

- **Keep rule bodies in native skills.** Workflow steps would need another skill invocation
  or a borrowed `SKILL.md` read. A direct rule reference keeps procedure and rule separate.
- **Apply caller-count placement to principles.** A rule would move as callers changed, or
  remain inside a lane that ordinary tasks do not use.
- **Require a catalog read or an entry scan.** This would load unrelated rules and add a second
  discovery path beside native skill metadata.

## Consequences

- A rule change needs one edit. Standalone skills and workflow callers use the same rule.
- Principles add a distinct class of agent text, with citation checks but no minimum citer
  count. Procedures keep the existing placement and citation requirements.
- Citation checks establish reference integrity. They do not prove native discovery or that an
  agent applies a rule; those behaviors need separate observed evidence.

## Reconsider when

- Native skills can no longer refer directly to supporting rule files.
- Observed use shows that a rule cannot stand alone without a workflow or host procedure.
- The same principle needs different behavior for standalone and workflow use.
