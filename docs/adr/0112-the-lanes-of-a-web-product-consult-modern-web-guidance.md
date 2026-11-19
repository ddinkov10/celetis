# The lanes of a web product consult Modern Web Guidance

## Date

2026-11-18

## Related

- [Issue #338](https://github.com/ddinkov10/celetis/issues/338): the spec (the body of the issue,
  `Spec: 2026-11-18`) and the plan.
- [ADR-0060](0060-impeccable-gives-the-options-of-web-and-mobile-look-decisions.md): the pattern of a
  skill that the maintainer installs and the lanes check for, with no plugin dependency and one
  line when it is missing.
- [ADR-0006](0006-domain-routing-and-the-domain-skills-go.md): an agent invoked a skill from
  its description in 3 of 3 runs with no routing text, so the own trigger of a skill is a real path,
  not a guaranteed one.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): a shared procedure is a module with
  two or more citers, and host text lives in modules.
- `plugins/celetis/references/procedures/web-guidance.md`; the item **Web guidance — both flows**
  and the fix brief of `plugins/celetis/skills/implement/SKILL.md`; addition 8 of
  `plugins/celetis/skills/specify/SKILL.md`; step 6 of `plugins/celetis/skills/bug/SKILL.md`.

## Context

The maintainer wants the Celetis workflow to use the skill `modern-web-guidance` (Google Chrome,
with Microsoft Edge, Mozilla Firefox, and MDN) when a change touches the UI of a web product, with
no wiring in each product. The maintainer said: "we will install it at user scope and use it, why
not integrate it in celetis itself". Before this record, no Celetis text named the skill. A
session used it only when the host invoked it from its description, and a child of the task loop
works from its brief.

## Constraints and evidence

- modern-web-guidance 1.0.1, skill version `2026_11_10-47b4c80e`, at commit `64a6d70`: the skill
  triggers itself for HTML, CSS, and client-side JavaScript work, and not for backend, tooling, or
  test work. Its workflow is `search`, `retrieve`, a compliance check, and a disclosure of the
  applied guide ids with short quotes. The CLI comes from npm through `npx` on each call, so a call
  needs the network. `retrieve` gates the guides of Origin Trial and volatile features, which
  `.mwgrc` unlocks. The CLI sends anonymous telemetry unless `DISABLE_TELEMETRY=1` is set. Sources:
  https://github.com/GoogleChrome/modern-web-guidance/blob/64a6d708f5a43f2cd3fde5d4d7db3905ba1bdf65/skills/modern-web-guidance/SKILL.md
  and
  https://github.com/GoogleChrome/modern-web-guidance/blob/64a6d708f5a43f2cd3fde5d4d7db3905ba1bdf65/README.md
- Claude Code makes a `plugin.json` dependency a hard requirement, and Codex has no dependency
  field (ADR-0060).
- The prior art of the spec: Adobe stardust names the skill at its workflow points, records the
  guide ids, and skips the consult when the skill is absent; gstack probes an optional skill, never
  installs it, and skips its check with one line.
- The search of the record store for the clauses that this record could replace (`grep -i` over
  `docs/adr/0*.md` for `modern-web`, `web guidance`, and `prior art`): no decision clause names the
  skill, and the `## Prior art` and `### Required behavior` rules of
  [ADR-0067](0067-component-research-binds-behavior-and-guides-looks.md) stay as they are. A guide
  line uses their forms. So this record has no `## Supersedes` section.

## Decision

1. **One module holds the procedure.** `references/procedures/web-guidance.md` states when a step
   consults the skill (a product of the kind web, and work that writes or decides HTML, CSS, or
   client-side JavaScript), how it names the skill, the consult, the limits, the record, the
   review, a conflict, and the one line when the skill is unavailable. It names the role "a web
   product", never a part of a product.
2. **The build, the task review, and the research cite it.** `implement` carries the module path
   in each brief and fix brief of a covered task, the task reviewer checks the code against the
   reported guides, and on the inline flow the final reviewer does that check. `specify` (addition
   8) and `bug` (step 6) apply it in the research of a web UI.
3. **The limits.** A session never installs, updates, or pins the skill, runs no `install`,
   `update`, `set-allow-origin-trials`, `set-allow-volatile-features`, or `legacy-scan`, writes no
   `.mwgrc` and no browser support policy, copies no guide, and leaves a gated guide unused.
4. **The record.** In the build, one task report line starts with `Web guidance:` and holds the
   applied ids with short quotes, the searched topics, or the one line. On the inline flow, it is a
   ledger line. In the research, each applied guide is a finding line of `## Prior art`, and a line
   of `### Required behavior` when it states a behavior of a component. This record replaces the
   `### Modern Web Guidance` section of the skill.
5. **The rank.** The guides bind the code below the approved spec, the plan, the principles, and
   the permission rules. A conflict is reported with the guide id and changes no design.
6. **Unavailable is one line.** A missing skill, a failed launch, or a failed command, after the
   sandbox approval procedure of the host, gives
   `web guidance: modern-web-guidance is not available; <cause>.` The step goes on, with no stop,
   no hold, and no effect on a PASS.

## Alternatives considered

- **Rely on the own trigger of the skill.** A child of the task loop works from its brief, and a
  reviewer has no reason to check the code against a guide that nobody reported. ADR-0006 shows a
  trigger that works, not one that is guaranteed.
- **A plugin dependency.** A missing skill would disable the plugin `celetis` on Claude Code, and
  Codex has no dependency field.
- **Vendor the guides, or read the guide files directly.** The guides change often, and a direct
  read skips the gating and the Baseline policy of the CLI.
- **Lines in the `AGENTS.md` of each product.** The maintainer excluded per-product wiring.

## Consequences

- Each consult sends the search queries and the guide ids to Google unless the shell of the host
  sets `DISABLE_TELEMETRY=1`. The README names the opt-out.
- Each consult runs `modern-web-guidance@latest` from npm. Celetis adds no pin and no copy.
- A lane with no skill, or with no network for `npx`, gets no guidance. Its record holds the one
  line.
- A child agent gets the guidance only when its host lists the skill for it. The Verify phase of
  #338 checks this on each host.

## Reconsider when

- The skill renames its commands, its gating, or its disclosure.
- A host adds an optional dependency for plugins or skills.
- A child agent of a host cannot see a skill of its parent.
