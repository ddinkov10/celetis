# The engine enforces the lifecycle and the landing

## Date

2026-10-26

## Related

- [Issue #103](https://github.com/ddinkov10/celetis/issues/103): the approved spec, the five
  decisions of the maintainer, and the plan.
- [ADR-0008](0008-the-build-step-lands-the-change.md): the build step lands the change with the
  landing script. The script now also refuses an issue that is not ready to land.
- [ADR-0011](0011-a-step-session-hands-a-stop-to-the-issue.md): a step session hands a stop to the
  issue. Its writes change ("Supersedes").
- [ADR-0022](0022-the-verify-gate-is-a-fast-check-and-the-full-suite-runs-before-the-landing.md):
  the full suite runs once, before the landing. Its `merge` rule changes ("Supersedes").
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the checks of this change are scratch
  programs outside the checkout. One clause changes ("Supersedes").
- [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md): one workflow definition. Its
  "Reconsider when" names a lifecycle guard that needs the history of the issue (#103). One clause
  changes ("Supersedes").
- `engine/lib/workflow.ts`, `engine/lib/tracker.ts`, `engine/lib/lines.ts`, `engine/issue.ts`,
  `engine/land.ts`, `engine/next-step.ts`, `engine/lib/config.ts`, the skills `triage`,
  `feature`, `bug`, `chore`, `hotfix`, `specify`, `plan`, and `implement`, and `step-prompt.md`.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- ADR-0033, "One workflow definition and the skip rule", Decision, "A typed boundary":
  "`engine/next-step.ts` keeps the GitHub collection, the boundary validation of each field that
  the resolver reads, the local observations, and the text format." The read of one issue and its
  timeline, and the validation of each field that it reads, are in `engine/lib/tracker.ts`. The
  text of each line (`describe`, `lineOf`) is in `engine/lib/lines.ts`. `engine/next-step.ts`
  keeps the local observations, the board rows (`jsonRow`), and its typed results.
- ADR-0022, "The verify gate is a fast check, and the full suite runs before the landing",
  Decision, "The `merge` rule": "So Land step 3 of `implement` runs the full suite of the project
  in the lane, on the head that `land` gets. It runs it again when the head moved after its last
  pass … When `AGENTS.md` names no full suite, the verify gate is the full suite", and, in "The
  role keeps its name", the row "The full suite" of `README.md`, "`AGENTS.md`". With the landing
  `merge`, `land` runs the `suite` file of `.celetis.yaml`, and the session runs no full suite
  before it. `AGENTS.md` does not name the full suite. The `pr` rule stays.
- ADR-0011, "A step session hands a stop to the issue", Decision: the `gh` writes of rules 4 and 5,
  `gh issue edit <n> --add-label ready-for-human` and
  `gh issue edit <n> --remove-label ready-for-agent --add-label ready-for-human`, and the clause
  "it changes the two labels in one command". A step session writes through the command `issue`:
  `stopped`, `ready-for-human`, and `before-landing`. The comment still comes first.
- ADR-0029, "The repository keeps no tests, and the verify gate is its only check", Decision,
  "For this repository only": "The `AGENTS.md` of this repository names no full suite, so Land
  step 3 runs the verify gate here, and no skill text changes for the landing." This repository
  sets `suite: scripts/verify.ts` in `.celetis.yaml`, so `land` runs the verify gate at the tip
  that it lands. The session runs no full suite before `land`, and the text of Land step 3 of
  `implement` changes.

## Context

The rules that protect a landing were prompt text only: `skills/implement/SKILL.md`, rules 4 and 5
of `step-prompt.md`, and `docs/issue-tracker.md`, "Completing a human precondition". No code
checked them:

- `decide()` read only the labels and the first line of each comment. "Built" was "a `## Plan`
  comment and no `ready-for-agent`". A label that a failed write did not add read as "done".
- `land` checked Git and CI, and it read no lifecycle fact. It landed while `ready-for-human` was
  on the issue, and while a `## Before landing` comment had no completion evidence.
- With `landing: merge`, the agent ran the full suite and then `land`. Nothing proved that the
  suite passed on the commit that landed.
- Exit 1 of `land` covered each refusal, each external block, and a cleanup that stopped after the
  change was on the trunk.
- Each skill posted the workflow comments and changed the labels with `gh`, with its own heading
  text and order.

The maintainer accepted three examples of the risk as the goal: a `## Before landing` comment whose
label write fails, and the next run lands; a suite that passes, then one more changed line lands;
and a re-entry that builds a built change again.

## Constraints and evidence

- GitHub stays the state store. The issue excludes a workflow database and a local state store.
- `engine/lib/workflow.ts` stays pure (ADR-0033). The lines of `next-step <n>` and `--open` stay
  byte for byte, apart from the lines of the new stops.
- GitHub REST API 2022-11-28: `GET /repos/{owner}/{repo}/issues/{issue_number}/timeline` returns
  `commented` events with `id`, `created_at`, and `body`, and `labeled` and `unlabeled` events with
  `label.name` and `created_at`. A live read of the timeline of #102 on 2026-10-26 listed its
  comments and label changes in order. The documentation does not state the order of two entries
  with the same `created_at`, and one engine act can write two entries in the same second.
- `PATCH /repos/{owner}/{repo}/issues/{issue_number}` with `labels` replaces the whole set of
  labels. "Add labels to an issue" adds to the existing set, and "Remove a label from an issue"
  returns 404 for a label that is not on the issue (GitHub docs, read 2026-10-26).
- The agent and the maintainer use the same token, so the actor of a label event proves nothing.
- The live check of `issue` (2026-10-26, recorded in `docs/celetis-flow.md`, "Acceptance status"):
  Claude Code 2.1.310 in auto mode ran `issue` with no refusal and no personal rule. In the
  `workspace-write` sandbox of codex-cli 0.164.0, with no network, each act exited 6 before any
  write; it ran after an approved escalation, and with a personal `prefix_rule`. The timelines of
  #132 and #133 list the comment, then `labeled wontfix`, then `closed`.

## Decision

The maintainer chose one set of rules that every caller uses (approach 1 of the spec), the full
goal of #103, and these five decisions: `land` runs the suite itself; the skills call the new
write command in this issue; `land` refuses while `ready-for-human` is on, also for the maintainer
in a shell; the work comes in layers; and a cleared hotfix stop shows "land it by hand".

**One set of rules over the ordered timeline.** `engine/lib/tracker.ts` reads one issue and, when
it has a comment, its whole timeline with one paginated call. It keeps the comments and the label
changes in timeline order. `factsOf` in `engine/lib/workflow.ts` computes the facts from that
history:

- the anchor of the current build: the latest `## Plan` comment, or the start of the issue for a
  lane with no `plan` step;
- the build: `none`, `planned`, `built` (a removal of `ready-for-agent` after the anchor, and the
  label off), and the two invalid orders `not-marked` and `added-again`;
- each open human step: a `## Before landing` comment after the anchor with no completion
  evidence after it, and the evidence that is missing;
- a current landing refusal, by the existing rule.

`decide()` reads these facts. It has three new stops: `human-step`, `plan-order`, and
`land-by-hand`. `landable(decision)` holds for a `chore` or `hotfix` step, a built change, and
`land-by-hand`. The resolver, the runner, the board, `land`, and `issue` call the same functions.
The absence of a label is never evidence.

**The position rule.** "After" is a later position in the timeline list, never a later
`created_at`. This is safe without a proof of the order of two entries of the same second: no rule
compares two entries that one engine act writes. Each compared pair has a session or a human act
between its two entries: a `## Plan` comment and a removal of `ready-for-agent` (the acts `plan`
and `built` or `before-landing`), and a `## Before landing` or `## Landing refused` comment and a
`## Human steps done` report or a removal of `ready-for-human` (only the maintainer writes these
two).

**The marker.** The act `before-landing` writes a hidden marker of the kind on the second line of
the comment: `<!-- celetis-before-landing general -->`, or
`<!-- celetis-before-landing during-the-build -->` for a comment that names an act of "During the
build". A general precondition keeps the existing rule: a report or a removal. A precondition of
"During the build" keeps its rule: a report and a removal. A comment with no marker, which an older
session wrote, gets the strict rule.

**The landing guards.** After it detects an already-landed change, and before each push, PR, check
re-run, and merge, `land` reads the issue again and refuses unless `landable(decide())` holds. The
refusal quotes the resolver line. An already-landed change skips the guards and completes its
cleanup.

**The result classes.** Each outcome of `land` has its own exit status and its own word after
`land: `: 0 landed (also with a warning), 1 an internal error, 2 `usage`, 3 `prerequisite`,
4 `repair`, 5 `checks`, 6 `blocked`, 7 `cleanup` (the change is on the trunk; run `land` again),
and 128+n a signal before `land` puts the change on the trunk or finds it there. A signal after that
gives 7. The skills read the class from the status and keep the judgment of the cause.

**The suite on the exact tip.** With `landing: merge`, `suite` in the main `.celetis.yaml` names a
relative TypeScript file of the checkout. `land` runs that file of the lane checkout, at the tip
that it lands, with the selected Bun, the isolated options, and the child environment of the
worktree setup. It runs after the Git checks of the preflight and before the commit. Then the
preflight runs again, so a changed tip, a moved trunk head, or a dirty lane refuses the landing.
Each attempt runs the suite again, with no cache. A failed suite is status 5, and a missing lane
worktree is status 4. With `landing: pr`, `suite` is refused: the checks of the PR at the tip are
the evidence, as before.

**The command `issue`.** `engine/issue.ts` owns each workflow write that the engine reads:
`route`, `epic`, `needs-info`, `wontfix`, `spec`, `root-cause`, `plan`, `built`,
`before-landing`, `landing-refused`, `stopped`, and `ready-for-human`. `state` writes nothing and
prints the facts. Each act checks its prerequisite with the same facts before any write, and
refuses with status 3. The command writes the heading, and it refuses a file that starts with a
`## ` line. No act writes `## Human steps done` or removes `ready-for-human`: only the maintainer
does these two acts. One act writes in this order: the comment, then one call that adds the
labels, then one `DELETE` for each label to remove (a 404 counts as already off), then a `PATCH`
of the body, the state, or the reason of the close. The `PATCH` never carries `labels`. When a
write after the first fails, the command exits 6 and names the `gh` command that completes each
write that is not done. That command is an act of the maintainer. `land` posts its close comment
and closes the issue through the same write module. The skills and the step text call `issue` in
place of each such `gh` write. The `## Intent` comment of `intake` and the `## External facts`
comment of `chore` stay `gh` writes: the engine does not read them. The personal rule generator of
`README.md` takes `issue` as well as `land`.

**The text module.** `engine/lib/lines.ts` holds the text of each resolver line. `land` and
`issue` quote that line without an import of `engine/next-step.ts`, a command module with process
code.

## Alternatives considered

- **Each command checks its own rules** (approach 2). A smaller change, but the rules exist two
  times and drift. #101 removed that problem. Rejected.
- **The labels are the only truth** (approach 3). New labels mark "built" and "waiting for a
  human". A failed label write then reads as "done", and the label protocol changes. Rejected.
- **A local workflow database.** Excluded by the issue.
- **A suite record that the agent makes through an engine command.** The agent then picks the
  command that runs, and the record still needs a binding to the commit. Rejected with decision 1.
  **No suite guard** was rejected with it.
- **Document the gap after a cleared hotfix stop.** A new hotfix session could then start before
  the maintainer's landing. Rejected with decision 5.
- **A compare of `created_at`.** One engine act can write two entries in the same second, so a
  compare of times cannot order them. The position rule needs no time.
- **A check of the actor of a label event.** The agent and the maintainer use the same token.
  The rule "a session never writes a human report" stays the guard.
- **One `PATCH` of the whole label set for an act**, the "one edit" of spec section 6. It loses a
  label change that a person makes at the same time. The engine could then write
  `unlabeled ready-for-human`, which the rules read as completion evidence. `gh issue edit` itself
  changes labels with discrete mutations. Rejected in review.
- **No marker, and the strict rule for each comment.** It changes the existing rule of a general
  precondition, which the acceptance criteria keep. Rejected.

## Consequences

- The three examples of the risk refuse with a typed reason before any protected side effect: an
  open human step stops the resolver and refuses `land`; `land` runs the suite on the tip that it
  lands; and `built` refuses a change that is not planned, while `state` gives `implement` the
  build from the history.
- A failed write leaves a safe state, because the rules read the history: a `## Before landing`
  comment with no `ready-for-human` is the `human-step` stop. The resolver now gives a stop line
  for that comment, which ADR-0011 names under "Reconsider when". The label of the session still
  ends the session in the normal case.
- The hotfix checklist removes `ready-for-human` before `land`. Until the landing, the card reads
  "land by hand", and no new hotfix session starts.
- A step session needs `issue` to run in its host. Claude in auto mode ran it with no rule. A
  Codex sandbox with no network blocks it before any write, so a Codex step session needs the
  personal `issue` rule or an approved escalation. A step session that runs `issue` from a skill is
  an open runtime check on each host.
- With `merge`, the suite runs inside the one-hour background limit of a Claude `land`
  (`docs/hosts/claude.md`). Each landing attempt pays for one suite run.
- An installed package from before #103 refuses the field `suite`. A repository that sets it needs
  the updated package for each command.
- A `## Before landing` comment that an older session wrote has no marker, so it needs a report and
  a removal.
- The prompt algorithms stay in the skills until #105 removes them on top of these guards.

## Reconsider when

- GitHub documents an order for timeline entries of the same second: the position rule can then
  rest on that order, or on time.
- The tracker gets a second store, or GitHub stops being the state store.
- A host refuses the `issue` prefix in a step session, or its sandbox blocks it with no rule or
  approval that lets it run.
