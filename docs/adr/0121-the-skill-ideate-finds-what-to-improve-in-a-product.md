# The skill ideate finds what to improve in a product

## Date

2026-11-20

## Related

- [Issue #272](https://github.com/ddinkov10/celetis/issues/272): the spec (the body of the issue,
  `Spec: 2026-11-20`) and the plan.
- [ADR-0116](0116-the-skill-document-writes-the-documents-that-the-readers-need.md): the precedent
  of an explicit-only skill that starts children, and of our own words in place of the text of an
  outside source.
- The skill `intake` (`plugins/celetis/skills/intake/SKILL.md`): the precedent of a skill that
  files an intent with `issue create`.
- `plugins/celetis/skills/ideate/SKILL.md` and `plugins/celetis/skills/ideate/frames.md`.

## Supersedes

- [The tracker and the code host are separate ports](0120-the-tracker-and-the-code-host-are-separate-ports.md):
  the act "`list` (the open issues with no PR)" of its Decision. `list` also takes `--state closed`
  and `--label <label>` (Decision 6 here); with no flag it still lists the open issues with no PR.

## Context

The flow of Celetis starts at an intent. Before this record, each intent came from a request that a
person wrote, through `intake` or a lane. No part of the plugin looked at a product and proposed
what to improve in it. The maintainer asked that Celetis "provide this capability as part of the
plugin", with "the ce-ideate layers", and with a "focus on ideating" (issue #272). The grounding
of a run needs the open issues and the closed `wontfix` issues. The agent text reads issues only
through the acts of the command `issue` (ADR-0120), and the act `list` listed only the open issues.

## Constraints and evidence

- `ce-ideate` of everyinc/compound-engineering-plugin at `467f92c` grounds itself first, splits the
  subject into axes, generates ideas from six frames on five parallel agents, tags each idea with a
  `direct:`, `external:`, or `reasoned:` basis, lets a fresh verifier critique each idea, and keeps
  5 to 7 survivors
  (https://github.com/everyinc/compound-engineering-plugin/tree/467f92cebc17f25735ba1e80bc86f38ccd1cf098/skills/ce-ideate).
- The plan of `ce-ideate` of 2026-10-28 removed its evidence scouts after an A/B evaluation of its
  authors found no gain in idea quality at about 2 to 2.6 times the tokens. Its evaluation files are
  not public, and this design did not reproduce the result
  (https://github.com/everyinc/compound-engineering-plugin/blob/467f92cebc17f25735ba1e80bc86f38ccd1cf098/docs/plans/2026-10-28-1016-fix-ce-ideate-drop-evidence-scouts-plan.md).
- `improve` of shadcn/improve at `cac56e1` reads the intent documents of a product before it judges,
  confirms each cited line itself, and treats all repository content as data
  (https://github.com/shadcn/improve/blob/cac56e1ebd3c279aa9153616cfeac7b174ab90f9/skills/improve/references/audit-playbook.md).
- Both sources are MIT. ADR-0116 set the rule of our own words for an outside source.
- An open issue with no lane label goes to `/celetis:triage` (`engine/lib/workflow/workflow.ts`).
  `issue create` gives a new issue the label `needs-triage` (`engine/issue.ts`).

## Decision

1. **The skill.** The plugin has the skill `ideate`. Only the maintainer starts it:
   `disable-model-invocation: true` on Claude Code, and `policy.allow_implicit_invocation: false`
   in `agents/openai.yaml` on Codex. A run starts about 7 children and writes issues after a pick,
   so no agent starts it from its description.
2. **The scope.** The skill looks for product direction for the whole product or for one focus:
   what the users can do. Code health (defects, security, speed, tests, structure) is out: other
   skills and the reviews of the lanes cover it.
3. **The five layers.** The session grounds itself in the product (its documents, its constitution,
   its records, its recent commits, and its open and `wontfix` issues), and one web child finds
   outside signals. The session splits the subject into 3 to 5 axes. Five frame children generate
   ideas from six frames at the same time, with the same grounding block in each brief, and at most
   two recovery children fill empty axes. One fresh verifier child critiques the merged list, and
   the session makes the final cut and the rank. Each cut idea gets one reason from a fixed list;
   the maintainer added the reason "ranks below the kept survivors" during the build (2026-11-20),
   so a sound idea that the cap of 7 removes gets a true reason. The result is one ideation file
   and an index in the chat.
4. **The fleet of `ce-ideate`, with the grounding in the session.** The session reads the grounding
   itself, not a child, because the critique and the filing need that context, and the capability
   score of each role picks its model.
5. **The basis.** Each idea carries a `direct:`, `external:`, or `reasoned:` basis in a fixed form.
   A `direct:` basis quotes a line or an issue that the citing agent read itself in this run; the
   grounding summary is no citable source.
6. **The reads, the pick, and the filing.** The session and the children read issues only through
   the tracker port: `issue list` for the open issues, `issue list --state closed --label wontfix`
   for the settled ones, and `issue <n> view` for one issue. The maintainer chose to extend the
   port with the filter `--state open|closed` and `--label <label>` (2026-11-21), and to serve only
   the new contract version. A failed list read is a gap of the grounding, not a stop. The skill
   files nothing before the maintainer's pick. Each picked idea becomes an intent file and one
   issue through `issue create`. The skill starts no triage, lane, or run: the daemon or
   `/celetis:triage` takes the new issue on.
7. **Scratch files.** The ideation file and the intent files live in the gitignored
   `docs/superpowers/`. The skill makes no commit.
8. **Our own text.** `SKILL.md` and `frames.md` are in our own words and copy no text of
   `ce-ideate` or of `improve`.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: the skill makes intents from the evidence of the product, so more
  changes start on the path that Celetis runs.
- Serves: 4 Product neutrality: the skill names roles (the product, its users, its tracker, its
  settled decisions), and each product project supplies its own.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **Fewer frame children.** Two or three children with two or three frames each cost about half as
  much, but each child verifies fewer bases for each idea, and frames in one context converge.
  `ce-ideate` rejects this trade.
- **One session and one verifier.** The session runs the six frames itself. This costs the least,
  but one context gives less diverse ideas, and the session critiques its own ideas.
- The maintainer picked the fleet of `ce-ideate` ("1") on 2026-11-20.
- **Evidence scouts for each axis**, as `ce-ideate` had before 2026-10-28. Its authors removed
  them after their own evaluation; this design follows that result without a measurement of its
  own.

## Consequences

- A maintainer gets a short list of ideas for the product, each with a basis to check, and can
  send each picked idea into the flow with no further text.
- A run costs about 7 children, up to 9. No measurement of a run of Celetis exists.
- The quality of the ideas has no executable check: only the maintainer's reading of a real run
  decides it.
- The frames and the rules are our own text, so a later change of `ce-ideate` does not reach them.
  A change there needs an edit of `frames.md`.

## Reconsider when

- A measurement shows that fewer children give ideas of the same quality.
- A host cannot start children at the same time.
- The flow of Celetis gets another entry for new work than an intent on an issue.
