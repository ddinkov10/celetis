# Agents merge lane PRs when CI is green; the human gate is promotion

Source: ddinkov10/fwrh_calculator ADR-0007. Each issue number of this record is an issue of that repository.

## Date

2026-10-04

## Related

- #385
- #381 (the board runner), #384 (`scripts/wait-for-staging.sh`), #386 (the board queue)
- ddinkov10/fwrh_calculator ADR-0005 (`docs/adr/0005-master-staging-production-fast-forward.md`) and ddinkov10/fwrh_calculator ADR-0006 (`docs/adr/0006-production-runs-release-please-releases.md`), which this builds on
- `scripts/merge-pr.sh`, `.claude/skills/finish/SKILL.md`, `.claude/scripts/next-step.sh`, `.claude/settings.json`
- `docs/agents/issue-tracker.md` (Branches, PRs, merge), `docs/agents/herdr-board.md` (Gates, Guards)

## Context

The maintainer runs the agent flow from herdr-board and wants the card of an issue to run from its first step to the recorded staging walkthrough with no human act. Until #385 an agent squash-merged a PR only after a human confirmed that merge, so each card stopped in `Human` with an open PR, also when CI was green (#375: PR #383 waited with all 4 checks green). An issue that started while an earlier PR was open had a base without that fix, so PRs on one surface conflicted, and each later PR needed a rebase.

## Constraints and evidence

- A merge reaches `master`, which deploys to staging only (ddinkov10/fwrh_calculator ADR-0005). Production moves only when the maintainer runs the promote script, and only that script merges the release-please PR (ddinkov10/fwrh_calculator ADR-0006).
- The repository is private on a personal plan: `allow_auto_merge` is `false`, and the branch-protection API answers 403. GitHub can neither require checks nor merge a PR by itself (read on 2026-10-04).
- The repository allows only squash merges. A merged lane PR closes its issue through `Closes #<n>`.
- gh 2.100.0: `gh pr checks --json bucket` sorts each check into `pass`, `fail`, `pending`, `skipping`, or `cancel`, and `gh pr merge --match-head-commit <sha>` merges only when the PR head is that commit.
- Claude Code evaluates permission rules in the order deny, ask, allow, on the text of the command that the agent writes. A rule does not see the commands that a script runs.

## Decision

An agent merges each lane PR, and the human gate moves to promotion. `scripts/merge-pr.sh <n>` is the one merge path of an agent. It selects the one open PR whose head branch is a lane branch of the issue (`feat/<n>-…`, `fix/<n>-…`, `hotfix/<n>-…`, `chore/<n>-…`), waits for its checks, and squash-merges it only when every check passed or was skipped and at least one check passed. It merges the commit that the checks ran on, and nothing newer. The release-please PR has no lane branch name, so the script cannot select it.

`/finish` runs the script as its first act, in a session of its own, and the resolver sends an issue with an open PR to `/finish`. `.claude/settings.json` denies `gh pr merge` to every agent session and allows the script. A PR that the script does not merge (a check that is not green, no check run, a conflict with `master`, more than one lane PR) stays open, the reason goes to the issue, and the card stops in `Human`. Every check must be green, the `security` job too.

The checks before a merge are the local gate, the task reviews and the whole-branch review in `/implement`, and CI on the PR. The check after it is the staging walkthrough. `/promote-preview` is the maintainer's one review point, and it covers a batch of merged issues.

## Alternatives considered

- **A human confirmation for each merge (the rule until #385).** It keeps a person before `master`, but it stops every card, and the open PRs go stale against each other.
- **GitHub auto-merge with required checks.** It is the platform's own flow, but this repository cannot use it: `allow_auto_merge` is `false`, and branch protection needs GitHub Pro or a public repository.
- **A merge at the end of `/implement`.** The session that wrote the code would land it, the resolver could not see the state "PR open", and a card that a human moves back to `Run` after a fix would have no step that lands the PR.

## Consequences

- A card runs from `Run` to `stop #<n> is finished` with no human act when CI is green, and each new issue starts from a `master` that holds the earlier fixes.
- No person reads a diff before it reaches `master` and staging. A defect is found by the staging walkthrough or at `/promote-preview`, in a batch.
- An upstream CVE that turns the `security` job red stops every merge until a person or a chore handles it. This is intended: a red check on the only review signal of `master` is a reason to look.
- The permission rules match command text and are not a security boundary. The guard against a second merge path is the deny rule together with the rule in the skills.
- The maintainer still merges by hand, in their own shell or on GitHub.
- A lane PR that is open when this lands is merged by the next `/finish` of its card when its checks are green.

## Reconsider when

- A defect reaches production through a batch promotion.
- The repository gains rulesets or branch protection that can require a review or required checks (GitHub Pro, or a public repository). GitHub auto-merge then replaces the script.
- A second person merges, or an outside contributor opens PRs.
- CI stops being a signal to trust: a check is flaky, or a workflow no longer runs on each PR.
