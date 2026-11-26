# A held issue waits only on a tracker relation or a label

## Date

2026-11-26

## Related

- [Issue #369](https://github.com/ddinkov10/celetis/issues/369): the intent and the spec (the body of the issue,
  `Spec: 2026-11-23`). In this record, "Decisions of the maintainer" and "The place of a held issue" name sections of
  that body. The read of the next free record number was on `origin/main` at af553fb, where the highest record is 0144.
- [A step session hands a stop to the issue](0011-a-step-session-hands-a-stop-to-the-issue.md): the stop that this
  record gives a reason and blockers. The label `ready-for-human` still moves the line.
- [A held change lands only by its released content](0143-a-held-change-lands-only-by-its-released-content.md): the
  Hold landing press. This change names its row hold `RowHold`, the field `rowHold` of `IssueRow` and `Card`, and
  `rowHoldOf`, so the two meanings share no name.
- [The GitHub tracker reads only the text of trusted authors](0144-the-github-tracker-reads-only-the-text-of-trusted-authors.md):
  the reason of a hold comes from the comments that its rule keeps, and of those only from the comments of the engine
  login (decision 5). The `blockers` read keeps each blocker, because the relation is not text, but it reads the
  title only of a blocker of this repository by a trusted author.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the build of this change added no tracked test.
- Match kept out of `## Supersedes`: [A capture record feeds the normal steps](0074-a-capture-record-feeds-the-normal-steps.md)
  states in "Constraints and evidence" that a later `## ` comment ends a landing refusal. That is evidence of the
  resolver at its date. This change adds one exception, the `## Stopped` comment of `defer`, and the record states no
  decision on it. [A set-aside record keeps auto mode away from an issue](0109-a-set-aside-record-keeps-auto-mode-away-from-an-issue.md)
  and [The board shows what each agent asks](0004-the-board-shows-what-each-agent-asks-and-unblocks-a-stuck-card.md)
  state Needs you as a place of cards at their date. The four columns of
  [A local web board starts each step in herdr](0003-a-local-web-board-starts-each-step-in-herdr.md) were already
  not the columns of the page before this change, and the new place `waiting` is a section of Needs you on the page.

## Supersedes

- [A step session hands a stop to the issue](0011-a-step-session-hands-a-stop-to-the-issue.md), in part: in "Decision",
  the item "The resolver names no `## Stopped` heading", and in "Consequences" the card text `ready for your step`
  of the item on a stop with `ready-for-human`. A card of `ready-for-human` with no landing refusal now reads the text
  of its hold: the reason of the newest `## Stopped` or `## Before landing` comment of the engine login, a blocker line, or
  `no reason recorded`. The resolver reads the heading `## Stopped` for that reason, and for the marker of a deferral.
  The older text of 0011 read no stop comment for the card text. This record reads only the comments of the engine
  login for it (decision 5).
- [The plan names the human acts of a lane](0021-the-plan-names-the-human-acts-of-a-lane.md), in part: in
  "Consequences", the sentence that a `## Human steps done` comment ends a current landing refusal "and the card then
  reads `ready for your step`". The card then reads the text of its hold.
- [The coordinator session starts assist runs for held issues](0128-the-coordinator-session-starts-assist-runs-for-held-issues.md),
  in part: in "Decision", point 1, the refusal "the issue has no `needs-info` or `ready-for-human` hold (exit 3)". An issue with `deferred` is a
  hold for an assist run.
- [A held change lands only by its released content](0143-a-held-change-lands-only-by-its-released-content.md), in
  part: in "Supersedes", the sentence "The definition holds eleven labels, with `hold-landing`." The definition holds
  twelve labels, with `deferred`.

## Context

The board showed seven issues in Needs you on 2026-11-23, and at most two needed the maintainer. Four issues waited for
an open epic, one was put off by the maintainer, and one could continue. Each card read `ready for your step`, with
one generic act. The reason of a hold was in a `## Stopped` comment that the board did not read.

## Constraints and evidence

- Each person who can comment on an issue can write any text in a comment, so the text of a comment cannot decide
  whether the maintainer must act.
- GitHub REST API 2026-03-10 (latest) lists the blockers of an issue at `issues/{n}/dependencies/blocked_by`, and it adds
  and removes one by `issue_id`. The Issue object holds `issue_dependencies_summary`. Source:
  https://docs.github.com/en/rest/issues/issue-dependencies
- `defer` posts its `## Stopped` comment with `<!-- celetis-deferred -->` as line 2, before it adds `deferred`. The
  comment is a deferral and not a stop, so the resolver skips it for a landing refusal and for the reason of a hold.

## Decision

The maintainer made the first two decisions on 2026-11-23 and the fifth on 2026-11-26. The third and the fourth are
assumptions of the session, which the approval of the spec covers.

1. **A blocker is the native "blocked by" relation of the tracker.** The maintainer answered "369 1" through the
   coordinator session (authority: maintainer), 2026-11-23T20:32:14Z. A step runs
   `celetis --agent <host> issue <n> blocked-by <m>` before `issue <n> stopped <file>`, and the tracker port reads and
   writes the relation. `github` uses the REST endpoints above, and `local` stores a metadata key. A blocker has an
   effect only on a held issue. It does not stop a run, and the engine does not clear a hold when the last blocker closes.
2. **A deferral is a `deferred` label on the issue.** The maintainer answered in the `specify` session of #369 on
   2026-11-23. `issue <n> defer <file>` posts the `## Stopped` comment with the marker and adds the label, and
   `undefer` removes it. `decide` returns the stop `deferred` before each other label check, so no run starts a
   deferred issue. The resolver skips the marked comment for the landing refusal and for the reason.
3. **Only a tracker relation or a label moves a card to Waiting.** The text of a comment never decides the place. Each
   failure or unknown keeps the card in Act now, because a wrong Waiting hides work. A row is a held issue only when its
   board state is `blocked`, and the first row of the table of the spec that matches decides.
4. **The board has a column `waiting` outside the Needs you count.** `columns.needs` then holds only Act now, so the
   badges, the title, the tab icon, Notify, the tile, and the trend count follow with no filter at each count. The page
   shows Waiting as one closed row at the foot of Needs you.
5. **The reason of a hold comes only from comments of the engine login.** The maintainer answered "Engine login only"
   to a terminal question in the `implement` session of #369, 2026-11-26T18:14:32.682Z, after the security review of the change found that
   each person with comment access can write a `## Stopped` comment, and that text then showed as the card text and
   as the act that the maintainer should do. `holdReason` keeps only comments with `own` set, as `holdOf` does for
   the landing hold. The card then reads `no reason recorded`, or an older reason, in these modes:
   - on GitHub, a `## Stopped` or `## Before landing` comment by a login other than the login of `gh`, for example
     one written by hand under another account;
   - a newer comment of another login does not replace an older comment of the engine login, so the older reason stays;
   - with the tracker `local`, a comment by another local identity (another machine, or a collaborator after a sync),
     and every comment when no identity resolves.

The engine serves only contract version 17 after this change, as decision 4 of the spec asked for a single served
version.

## Alternatives considered

- **A marker line in the `## Stopped` comment** for a blocker. GitHub does not show it, and each change needs a new
  comment.
- **A parse of `#<n>` in the prose of a hold.** A mention is not a blocker: the hold of #349 names closed issues and
  its parent.
- **Set aside on the board**, or **no record**, for a deferral. A record on one machine is not seen by each machine,
  and with no record a deferred issue stays in the badge.
- **A filter at each count** in place of a column. Each count needs its own filter, and one missed place shows a wrong
  count.

## Consequences

- The Needs you badge counts only the issues that the maintainer can act on now.
- A step that stops for another issue must run `blocked-by` for it. A stop with no relation stays in Act now.
- When the last blocker closes, the card moves to Act now with `blockers closed`, and the maintainer still clears the
  hold.
- Each reader of all columns must read `waiting` too.

## Reconsider when

- GitHub changes what `issue_dependencies_summary` counts, or the relation crosses repositories in a way that the
  board cannot read.
- A tracker has no native blocker relation.
