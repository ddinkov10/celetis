# A security review runs security-audit on a trust-boundary change

## Date

2026-11-18

## Related

- [Issue #339](https://github.com/ddinkov10/celetis/issues/339): the spec (the body of the issue, `Spec:
  2026-11-18`), with its external facts, its prior art, its approaches, and its design probe. "Approach A",
  "approach B", and "approach C" in this record name the approaches of that spec.
- [The Codex child probe](https://github.com/ddinkov10/celetis/issues/339#issuecomment-6990325119) of the build.
- [ADR-0060](0060-impeccable-gives-the-options-of-web-and-mobile-look-decisions.md): the precedent of a
  user-scope skill in a lane, with a check, a one line when it is missing, and a host part for each host.
- [ADR-0063](0063-a-step-stops-only-for-an-act-outside-the-session.md) stays unchanged: for a hotfix micro-plan
  with an invalid `Execution:` line, `implement` still writes `Execution: inline — one task` and goes on.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): host-specific text lives in modules, and a shared
  procedure is a module with two or more citers.
- `plugins/celetis/references/procedures/security.md`, the paragraph "Add the security-review task to a change
  that touches a trust boundary" of `plugins/celetis/skills/plan/SKILL.md`, and step 5 of
  `plugins/celetis/skills/hotfix/SKILL.md`.

## Supersedes

Only this clause changes. The accepted records keep their historical text and evidence.

- [ADR-0040](0040-the-planner-chooses-the-build-flow.md), "Decision", the paragraph "The hotfix micro-plan": "Its
  first line is `Execution: inline — one task`." A micro-plan with the security-review task has two tasks, and
  its first line is `Execution: inline — ` with a reason of one sentence that names the fix and its security
  review. A micro-plan with one task keeps the line `Execution: inline — one task`. The Context sentence of
  ADR-0040 "A hotfix micro-plan always has one task." is context and stays as a fact of its time.
- [ADR-0060](0060-impeccable-gives-the-options-of-web-and-mobile-look-decisions.md), "Decision", the bullet "The
  review refines and never redesigns": "The design review is the last task of the plan of a web or mobile UI
  change." When the plan also has the security-review task, the design review is the task before it. The other
  clauses of that bullet stay.

## Context

No lane step reviewed a change for security. The principle `boundary-discipline` makes the builder keep the
guarantees of a trust boundary, but no separate pass looked for a vulnerability in the result. The maintainer
installs Cloudflare's `security-audit` skill at user scope, and wants the Celetis workflow to use it, with no
wiring in each product. The maintainer picked a first layer: a security review of each change that touches a
trust boundary.

## Constraints and evidence

- cloudflare/security-audit-skill c1c8a8c: the skill is `security-audit`. Guidance mode is the default; the
  complete workflow (six phases, an output folder, and audit artifacts) runs only for an explicit audit request.
  "If the request could mean either mode, ask one focused question before creating files or starting the
  complete workflow." Product code runs only in an OS-enforced sandbox; else the skill reports a
  `needs_validation` blocker. The verdicts are `confirmed` (with a severity), `needs_validation` (with an exact
  open fact), and `rejected`. The user-level install is
  `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit --global`, which
  writes to `~/.claude/skills/` for Claude Code and to `~/.agents/skills/` for Codex (vercel-labs/skills
  57217cf).
- Codex loads skills from `.agents/skills` roots and from `$HOME/.agents/skills`, and lists each with the path of
  its `SKILL.md` (ADR-0060).
- `plugin.json` `dependencies` of Claude Code has no optional form (ADR-0060), so the skill cannot be an
  optional dependency of the plugin.
- The design probe of the spec (Claude Code 2.1.327): a `general-purpose` child invoked a user-scope skill with
  the Skill tool, and the launch printed its base directory. On Claude Code, the task implementer of the subagent
  flow can run the check and the launch itself.
- The Codex child probe of the build (Codex CLI 0.167.0, one answered run): a child that `spawn_agent` started
  with `fork_turns: "none"` listed the project skill `security-audit` with the path of its `SKILL.md`, and its
  only tool event read the first five lines of that file. The first run made no model turn, because the default
  model of the host config was not supported with the account; the answered run used `-m gpt-6-luna`. The
  probe put the skill in the `.agents/skills` folder of the project. No probe ran for a Codex child with the
  user-scope install in `$HOME/.agents/skills`; that root rests on the source read of ADR-0060.
- The engine accepts the task names `<n>`, `final`, `verify-<n>`, and `land-<n>`, so a numbered plan task needs
  no engine change.

## Decision

1. A procedure module, `references/procedures/security.md`, holds the procedure. `plan` and `hotfix` cite it.
2. **The check.** The skill is available when the skill list of the session holds `security-audit` and its
   launch succeeds. The text names commit c1c8a8c. The lane never installs or updates the skill, and the skill is
   no dependency of the plugin.
3. **Missing.** A failed check prints `security: security-audit is not available; the security review does not
   run.`, and the task completes with no change and no commit. It is no hold.
4. **The review.** The request names a focused review of the lane diff in guidance mode, with no complete audit,
   no output folder, and no report file, so the skill has no reason to ask which mode. The scope is the diff from
   the merge base with the trunk to the start commit of the task. The review runs no product code: a fact that
   needs a run stays `needs_validation`.
5. **The findings.** The task fixes each `confirmed` finding of the change test-first in the lane. A `confirmed`
   finding from before the change and each `needs_validation` finding go into one issue comment headed
   `## Security review`, with no hold. A `rejected` finding stays in the task report. The task posts no second
   comment that holds the same findings.
6. **The task.** `plan` adds the security-review task when `boundary-discipline` applies to one or more tasks.
   It is the last task before the Verify phase, after the design-review task. The `hotfix` micro-plan adds it as
   Task 2 under the same condition. The `bug` lane gets it through `plan`; the `chore` lane gets none.

This is the practical choice: it follows the shape of ADR-0060, needs no engine change, and the maintainer sees
the task in the plan. Each fix of the task gets the final review, and on the subagent flow also the task review.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: a change that crosses a trust boundary gets its confirmed vulnerabilities fixed
  before it lands.
- Serves: 2 Autonomous steps: a missing skill and a `needs_validation` finding make no hold, and the request
  names the mode, so the skill asks no question.
- Serves: 4 Product neutrality: the text names the role "a trust boundary of the product" and needs no wiring in
  the product.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **Approach A, a step in the Tail of `implement` after the final review.** It reviews the final diff and reaches
  `hotfix` with no extra text, but its fixes need a new task kind in the dispatch record, the engine command, and
  the contract. Rejected: more engine work for the same result.
- **Approach C, a security part in the final review.** The smallest change. Rejected: one reviewer then does two
  jobs, and the method of the skill asks for a separate, focused pass.
- **A plugin dependency on the skill.** Rejected: the dependency of Claude Code has no optional form, and the
  Codex manifest has no dependency field (ADR-0060).

## Consequences

- A fix after the security-review task (a final-review fix, a Verify fix, a landing fix) gets no second security
  review.
- In a product where most changes touch a trust boundary, most plans get the task, and the skill can launch
  focused agents in guidance mode.
- A hotfix micro-plan with two tasks and an invalid `Execution:` line gets `Execution: inline — one task` from
  `implement` (ADR-0063). The flow word `inline` is right, but the reason words are then not true.
- A product needs no file, no setting, and no line of its `AGENTS.md` for the review. With no installed skill,
  each lane goes on as before, with one printed line.

## Reconsider when

- The skill renames its modes or its verdicts, or changes how it chooses a mode.
- A host gains an optional plugin dependency.
- The maintainer wants a security review of later fixes, or a periodic full audit.
- #338 makes a second module of the same shape for another user-scope skill.
