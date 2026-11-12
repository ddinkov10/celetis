# A product project has one constitution at a fixed path

## Date

2026-11-12

## Related

- [Issue #291](https://github.com/ddinkov10/celetis/issues/291): the spec (the body of the issue).
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): the placement rule. The constitution check is a shared
  procedure, so it is one module; the constitution form is read by one skill, so it is a file of that skill's folder.
- [ADR-0095](0095-the-shared-agent-text-lives-in-references.md): the layout of `references/` and of the skill folders.
  The form of the constitution is `plugins/celetis/skills/constitution/template.md`, beside the skill that reads it.
- `plugins/celetis/references/procedures/ui.md`: the plugin fixes the path of `DESIGN.md` in the same way.
- Files of this change:
  - `plugins/celetis/skills/constitution/SKILL.md`, `plugins/celetis/skills/constitution/template.md`, and
    `plugins/celetis/skills/constitution/agents/openai.yaml`: the skill and its form.
  - `plugins/celetis/references/procedures/constitution.md`: the constitution check.
  - `plugins/celetis/skills/specify/SKILL.md`, `plugins/celetis/skills/plan/SKILL.md`,
    `plugins/celetis/skills/bug/SKILL.md`, `plugins/celetis/skills/record-architecture-decisions/SKILL.md`, and
    `plugins/celetis/skills/record-architecture-decisions/template.md`: the four citers of the check.
  - `plugins/celetis/README.md`, `plugins/celetis/skills/guide/SKILL.md`, and `plugins/celetis/docs/issue-tracker.md`:
    the documents that name the constitution and its sections.

## Context

A product project has no single document that states what the product is and what it must always achieve.
`AGENTS.md` holds the architecture, the product rules, and the traps. The ADRs hold the reasons of each decision.
No skill reads a statement of direction before it decides, and no decision names the lasting goal that it serves.

The check must work for every product that uses the plugin, so the plugin fixes the file path and the form.
The product project owns the text. A product that has no file gets no check and no new section.

## Constraints and evidence

- The maintainer asked for a document that "explains what the product is and what it should always need to achieve",
  and that every decision follows. The maintainer picked a feature of the plugin for each product project, not a
  document of this repository only ([issue #291](https://github.com/ddinkov10/celetis/issues/291)).
- The placement rule of `AGENTS.md`, "Where agent text lives", puts text that two or more skills need into one module,
  and `checkCitations` of `scripts/verify.ts` refuses a module with fewer than two citers.
- Spec Kit keeps one constitution file for each project, written and amended by its own command, and checks each plan
  against it; a conflict needs a change of the spec or the plan, or an explicit constitution update. Source:
  [Spec Kit analyze command](https://raw.githubusercontent.com/github/spec-kit/2ee2b1e8005905db05f5717300a469b3068b908f/templates/commands/analyze.md).
- Kiro loads a steering file `product.md` in each interaction and has no check. Source:
  [Kiro steering](https://kiro.dev/docs/steering/).
- Anthropic's constitution for Claude ranks its core values for a conflict and keeps a small set of hard constraints.
  Source: [Anthropic constitution](https://www.anthropic.com/constitution).
- No engine check reads the content of a section, so the check rests on the judgment of the agent. The Verify phase
  of [issue #291](https://github.com/ddinkov10/celetis/issues/291) runs it on a fixture product.

## Decision

1. **The file.** A product project keeps `CONSTITUTION.md` at the root of its checkout. The plugin fixes the path and
   the form, in this order: what it is, who it serves, the goals in priority order, the hard limits, the non-goals,
   and the amendments. Each goal has a reason. The first amendment line records the adoption. The constitution has no
   version number. The date of the last amendment line identifies the text that a decision read. Spec Kit uses a
   semantic version, which this design does not take. The goals use the form of Anthropic's constitution for Claude:
   ranked goals with reasons, and a few hard limits. The ranking gives the order that decides a conflict, and each
   reason lets a decision name its tension. Source: [Anthropic constitution](https://www.anthropic.com/constitution).
2. **The skill.** The skill `constitution` (`/celetis:constitution`) writes the first text and amends it. It runs only
   when the maintainer starts it. It writes only the text that the maintainer approved in that invocation.
3. **One check, four citers.** The module `plugins/celetis/references/procedures/constitution.md` holds the check.
   `specify`, `plan`, `bug` (only when its fix chooses new behavior), and `record-architecture-decisions` cite it. When
   `CONSTITUTION.md` exists, the spec, the `## Root cause` report of `bug`, and the ADR each hold a `## Constitution`
   section. The plan holds one only for a goal, tension, or conflict that the spec's section does not name. Otherwise
   it holds one line that names the spec's section. Each section names the goals that the decision serves, the
   tensions that it costs, and the answer for each hard limit or non-goal that it touches. A section names only the
   goals that the decision actually serves or costs. At a read, `record-architecture-decisions` also flags an ADR
   whose decision conflicts with the constitution, as it flags an ADR whose premise became false, and does not inherit
   that ADR. The flag does not stop a step; item 4 covers the stop.
4. **A conflict stops the step.** A decision that breaks a hard limit, enters a non-goal, or costs a higher goal for a
   lower goal stops before the document is final. This holds for each decision that the document records, also an
   option or an approach that the maintainer picks. The step asks the maintainer one question with two choices: change
   the design, or amend the constitution first with `/celetis:constitution`. A step does not start the amendment.
5. **The amendment lands on the lane.** The amendment is made in the lane worktree of the issue that found the conflict.
   Its commit lands with the change that needs it. The next run of the step reads the file again.
6. **No engine check.** The engine does not refuse a spec or an ADR with no `## Constitution` section. The verify gate
   checks the form of the plugin text, not the content of a section.
7. **No other step checks the constitution.** The skills `chore`, `hotfix`, `implement`, `critic-loop`, `triage`, and
   `intake` do not read it. `doc-drift-sync` does not edit it. Outside the four citers, no skill checks it.

## Alternatives considered

- **The Spec Kit form and mechanism** (a principles file and a check in each plan, with the engineering principles as
  content). The principles repeat the plugin principles, and no part of that file says what the product is for. Source:
  [Spec Kit constitution command](https://raw.githubusercontent.com/github/spec-kit/2ee2b1e8005905db05f5717300a469b3068b908f/templates/commands/constitution.md)
  and [Spec Kit plan template](https://raw.githubusercontent.com/github/spec-kit/2ee2b1e8005905db05f5717300a469b3068b908f/templates/plan-template.md).
- **The Kiro form with no check** (a `product.md` the agent loads). No decision shows that it followed the file, so the
  goal "every decision follows it" fails. Source: [Kiro steering](https://kiro.dev/docs/steering/).
- **A part of `AGENTS.md`.** `AGENTS.md` already holds the architecture, the rules, and the traps. A purpose part in it
  mixes two kinds of text, and the check would have no file of its own to read.
- **The amendment in a separate issue.** That lane would land after the stopped change needs the amendment. Its lane
  worktree would read the old text until its next update.

## Consequences

- A product project with no `CONSTITUTION.md` keeps its current behavior.
- When the file exists, the spec, the `## Root cause` report of `bug` (only when its fix chooses new behavior), and the
  ADR each hold a `## Constitution` section. The plan holds one only for a new goal, tension, or conflict, and one line
  otherwise. The rule "only the goals that it actually serves" limits the section length.
- Nothing checks that an agent applies the check with judgment. Verify of the change plans a behavioral check with the
  Claude Code installation and a fixture product. It is not an oracle of this record.
- A constitution that no one amends steers decisions in an old direction. The amendment path exists, and no step prompts it.
- This record adds no `CONSTITUTION.md` to this repository. The maintainer writes the text of this repository in a later act.

## Reconsider when

- Agents apply the check without naming the goals that a decision serves or costs.
- The `## Constitution` sections grow, or each decision names every goal.
- A missing or malformed section passes unnoticed, and an engine check becomes necessary.
- A constitution goes stale while its product's decisions keep moving away from it.
