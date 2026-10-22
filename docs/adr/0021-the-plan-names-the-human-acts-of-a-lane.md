# The plan names the human acts of a lane, and a check by hand runs after the landing

## Date

2026-10-22

## Related

- ddinkov10/celetis#88: the spec of this change, with the decisions of the maintainer.
- ddinkov10/celetis#41 and ddinkov10/celetis#42: the two waits at a `## Before landing` stop.
- ADR-0008: the build step lands the change. ADR-0011: a step session hands a stop to the issue.
  This record changes a part of each (Supersedes).
- `skills/plan/SKILL.md`, `skills/implement/SKILL.md`, rule 5 of `step-prompt.md`, and
  `docs/issue-tracker.md`.

## Supersedes

From ADR-0008, "The build step lands the change, by the mechanism that the repository names", the
sentence "A build step stops before the landing only for a human precondition." A check by hand on
the built change is no precondition of the landing now. A precondition that the plan names stops
the build only when it has no report.

From ADR-0011, "A step session hands a stop to the issue: a comment, then `ready-for-human`", two
parts:

- The part "The two rules live in the step text only". The stop for an act of "During the build"
  with no report is in the Verify phase of `implement`.
- The consequence "After a `## Before landing` stop for a Verify scenario, the next run of
  `/implement` lands the built change and runs no scenario". After a stop for an act with no
  report, the next run runs the scenarios that waited for the act.

A guard refusal keeps the rules of ADR-0011. The rest of each record stands.

## Context

Before this change, `implement` named a human act at Land, step 2: it posted a `## Before landing`
comment and added `ready-for-human`. At that time the change was built, reviewed, and green, and
it waited for the maintainer. In 16 lane issues (#30 to #77, read through the GitHub REST API on
2026-10-21), #41 waited 275 min and #42 waited 91 min at such a stop.

The plan of #42 named its human act: a private scratch repository for Verify V3. The act was on
line 514 of a long `## Plan` comment, so the maintainer did not see it during the build.

Most of the acts were live checks on the built change: a live `/celetis:setup` run in a scratch
project, on an isolated and signed-in install of the lane package. A cloud session cannot run such
a check, because a nested session has the identity of the cloud session. The maintainer cannot run
it before the build, because the change does not exist yet.

## Constraints and evidence

- The act of a skill that moves the line of the issue is its last act (`AGENTS.md`, "Traps"). The
  publish of the plan moves the line. So the human acts are a section of the `## Plan` comment, not
  a comment of their own, and `plan` adds no act after the publish.
- Each push to the trunk reaches each product project at its next step (`AGENTS.md`, "Traps"). So
  a change that lands before its check by hand is live at once.
- Each `gh` call uses the maintainer's token. So each comment has the maintainer as its author,
  also a comment that a session writes.
- Unverified premise (risk 2 of the spec): GitHub sends no notification to an account for a
  comment of that same account. The design does not depend on a notification.

## Decision

**The decisions of the maintainer** (spec of #88):

1. Each check that needs the maintainer's hands on the built change runs after the landing. The
   lane does not wait for it at the end.
2. Each act that prepares a check moves to plan time, for example a scratch repository, an
   install, or a secret. The maintainer does it while the build runs.

The design treats a precondition of the landing that the plan can see in the same way
(assumption 5 of the spec).

**Three kinds of human act.** The plan sorts each human act that it can see into one kind:

| Kind | Example | List | Needed by |
|---|---|---|---|
| Preparation of an agent check | a scratch repository for a live check | During the build | a Verify scenario |
| Precondition of the landing | an environment variable that the new code reads | During the build | Land |
| Check by hand on the built change | a live run on an isolated, signed-in install | After the landing | nothing in the lane |

**The plan opens with `### Your steps`.** It is the first section of the plan, before the header
and the tasks. It has two lists, `**During the build.**` and `**After the landing.**`. An item of
"During the build" names the act, the step that needs it, and its report. An item of "After the
landing" names its commands and its expected result. A list with no item is one line:
`**During the build.** None.` or `**After the landing.** None.` The Terminal of `plan` repeats both
lists verbatim before the line that tells the user to run `/celetis:implement #<n>`.

**The sort rule.** `plan` sorts each check by its kind, not by the abilities of one session. A
check by hand needs what only a person has: the person's own signed-in account or a second
identity, the person's own machine or device, or the person's judgment of a live result. It goes
to "After the landing", never to the Verify phase. Each other check is a Verify scenario, also when
it needs an act of "During the build". When `plan` is not sure, the check stays in the Verify phase.
A wrong sort to Verify costs a wait. A wrong sort to "After the landing" removes a gate.

**The report.** The maintainer reports the acts of "During the build" in one comment whose first
line is `## Human steps done`, after the latest `## Plan` comment. It names each act that is done
and each value that an act gives. A session never writes it.

**The rules of `implement`:**

- Verify phase: a scenario that needs an act of "During the build" reads the value of the act from
  the report. With no report of the act, the scenario has no PASS. The session runs each other
  scenario, then posts one `## Before landing` comment for this build: each act with no report, its
  report form, and the scenarios that wait for it. Then it runs
  `gh issue edit <n> --remove-label ready-for-agent --add-label ready-for-human` as the last act,
  and stops.
- Land, step 2: an act of "During the build" is done when the report holds it. An act with no
  report that no `## Before landing` comment of this build names stops the landing with a new such
  comment, also after an earlier stop of this build. When a `## Before landing` comment of this
  build names such an act, the landing needs both for that act: a report after that comment, and
  the maintainer's removal of `ready-for-human` after that comment.
- Re-entry: when one or more reports after that comment report each act that it names, and the
  maintainer removed `ready-for-human` after it, the session runs the Verify scenarios that waited
  for those acts. It goes to Land, step 2 on a PASS. A FAIL loops back to a fix.
- Land, step 3: a check by hand is no stop. On an exit 0 of `scripts/celetis land`, the last
  message quotes the "After the landing" list verbatim after the quoted `land:` lines. The session
  runs no command for it, posts no comment, and adds no label.

## Alternatives considered

- **A follow-up issue for each lane.** Rejected in the design session (assumption 1 of the spec,
  the recommended option of the second decision card, "A section of the plan only"): it needs a new
  act after the landing, when the runner can end the session first.
- **The checks before the landing, as before.** Rejected: the waits of #41 and #42.
- **A dependent check moves after the landing when its report is missing.** Rejected: the
  maintainer was told at plan time, and a precondition of the landing protects the trunk.
- **A sort by the abilities of the current session.** Rejected: `plan` does not know where
  `implement` runs.

## Consequences

- The maintainer knows each human act of a lane when the plan is posted, and the lane does not wait
  at the end for a check by hand.
- A bad change is live before its check by hand. Each push to the trunk reaches each product
  project at its next step. A FAIL of a check of "After the landing" needs a bug lane, and the bad
  change is live until that lane lands. The maintainer accepted this (decision 1).
- The maintainer can miss the plan. With `implement: auto` in `gates`, the runner starts the build
  directly after the plan. The section at the top of the plan and the last message of `plan` are
  the signals.
- The author does not prove a report. Each comment has the maintainer as its author. The rule that
  a session never writes the report is the only guard, as for the completion report before.
- A plan can sort a check wrong. A check that an agent can run can go to "After the landing" and
  lose its gate before the landing. The review of the plan is the guard, and that review is
  automatic now.
- A `## Human steps done` comment starts with `## `. So in the reading of the resolver it ends a
  current landing refusal, and the card then reads `ready for your step`. The resolver does not
  change (spec, "Non-goals").

## Reconsider when

- A check of "After the landing" fails, and the bad change hurts a product project before its bug
  lane lands.
- A session can run a check on an isolated, signed-in install.
- The board shows a card for a closed issue.
- A review of plans finds checks sorted wrong.
