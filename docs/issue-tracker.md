# Issue tracker: GitHub

Issues are the state store for every lane. The issue number `#<n>` is the handle that carries work between commands and sessions; state lives in the issue and the repo, never in chat history. Use the `gh` CLI for every operation — it infers the repo from the clone, and `{owner}/{repo}` in an API path fills itself in.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <file>` (or `--body "..."` with a heredoc).
- **Read an issue**: `gh issue view <n> --comments`; for structured output `--json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,labels --jq '.[] | "#\(.number)\t\([.labels[].name] | join(","))\t\(.title)"'`, filtered with `--label` and `--state`.
- **Comment**: `gh issue comment <n> --body-file <file>` / `--body "..."`.
- **Replace the body**: `gh issue edit <n> --body-file <file>`.
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <n> --comment "..."`.

## Labels

Exactly one lane label per routed issue. The other labels mark waits and gates.

| Label | Meaning | Set by | Cleared by |
|---|---|---|---|
| `needs-triage` | not yet classified | `/intake` | `/triage`, or a lane when it sets its lane label |
| `bug` | existing behavior misbehaves, production not on fire | `/triage` or `/bug` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `enhancement` | new behavior — the feature lane | `/triage` or `/feature` | the lane that reclassifies the issue; `/feature`'s scope check when it makes the issue an epic (the one case where the row's own lane clears it) |
| `hotfix` | production broken, the fix ships now | `/triage` or `/hotfix` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `chore` | zero-behavior-change edit | `/triage` or `/chore` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `epic` | parent of several feature sub-issues | `/feature` scope check | — |
| `needs-info` | the report lacks what its lane needs; the questions are in a comment | `/triage` | the reporter's reply, then `/triage` |
| `ready-for-agent` | plan posted; `/implement #<n>` can start | `plan` | `implement`, when the change is built |
| `ready-for-human` | a step only a human runs (a human precondition of a landing; a hotfix whose landing stopped; a step session that stopped). The card of the issue reads `landing refused` while a landing refusal is current ("Resolving an issue's state"), else `ready for your step` | `implement`, `/hotfix`, a step session at a stop (`.claude/agent-flow/step-prompt.md`) | the human |
| `wontfix` | not actioned; the reason is in a comment | `/triage`, `specify` | — |

`wayfinder:*` labels belong to a retired flow and stay unused.

## What lives on the issue

- **Intent** — `/intake` writes the intent template as the body of a new issue, or as a comment headed `## Intent` on an existing one. A reporter's body is never rewritten by intake.
- **Spec** — `specify` replaces the body with the design spec (`gh issue edit <n> --body-file`); its first line is `Spec: YYYY-MM-DD`. The body is the current truth for the item.
- **Plan** — `plan` posts the implementation plan as a comment headed `## Plan`, then adds `ready-for-agent`. `implement` in a fresh context re-fetches the latest `## Plan` comment.
- **Root cause** — `/bug` and `/hotfix` post the debugging report as a comment headed `## Root cause`.
- **Prototype** — a look decision (`AGENTS.md`, Agent flow) is recorded as a `## Prototype` section inside the spec (the issue body) or the `## Root cause` report, edited in place when that is already posted. It holds the question, the `prototype/<n>-<slug>` branch with its commit, one line per variant, and the verdict with its reason. The `## Root cause` comment on #251 is the model.
- **Built** — a `## Plan` comment with no `ready-for-agent` label: `plan` sets the label, and `implement` clears it when the change is built.
- **Before landing** — a comment headed `## Before landing` names a human precondition, or a Verify scenario that a step session could not run; the issue carries `ready-for-human` until the maintainer did the act.
- **Landing refused** — a comment headed `## Landing refused` holds the output of `scripts/land.sh` at a stop; a step session then adds `ready-for-human`. The refusal is current while this comment is the last comment of the issue that starts with `## ` ("Resolving an issue's state").
- **Stopped** — a comment headed `## Stopped` holds the reason of a stop of a step session for which its skill posts no comment (a refusal of `scripts/worktree.sh`, gate attempt 4 of `implement`, a blocked hotfix), and the act of the maintainer that lets the step go on; the issue carries `ready-for-human` until the maintainer did the act. `docs/agents/agent-flow.md`, "How a step runs", defines a step session.
- **External facts of a dependency bump** — `/chore` posts a comment headed `## External facts`.
- **Finished** — the issue is closed and does not carry `wontfix`.

Local `docs/superpowers/` files are gitignored scratch; a fresh session re-fetches from the issue.

## Branches, PRs, merge

Trunk-based. Every issue is its own work item: one lane branch off `master`, landed by `scripts/land.sh` with the mechanism that `.claude/agent-flow/landing.json` names: `pr` here, one PR back to `master`; `merge` is one squash commit on the trunk, with no PR.

- Branch: `feat/<n>-<slug>` (feature), `fix/<n>-<slug>` (bug), `hotfix/<n>-<slug>`, `chore/<n>-<slug>`.
- Worktree: every command that works on the issue's branch (the four lanes, `specify`, `plan`, `implement`) runs `scripts/worktree.sh <n>` (`<n>` or `#<n>`) and enters the path it prints with `EnterWorktree`. The script re-enters the issue's local branch; else it checks out the head branch of the issue's open PR (`feat|fix|hotfix|chore/<n>-…`), tracking `origin`; else it creates `<prefix>/<n>-<slug>` off a freshly fetched `origin/master`, the prefix from the lane label and the slug from the title (lowercased, each run of other characters than `a-z0-9` turned into one `-`, trimmed of `-` at both ends, at most 30 characters cut at a `-` or hard-cut at 30 when the first word alone is longer, `issue` when empty). It checks the branch out in `.claude/worktrees/<n>-<slug>` and installs the gate's prerequisites. It refuses an epic, an issue with no lane label (run `/triage #<n>`), an issue with more than one lane label, and an issue that two branches or two open PRs match. Every later step runs there, so the main checkout never changes branch and flows run side by side. `scripts/land.sh` removes the worktree, the lane branch, and the prototype branches after the landing. `scripts/worktree.sh --remove <n>` removes them in the two cases with no landing by the script. After a merge by hand: a PR of the branch is merged and the local tip is that PR's head. Without a merge: no PR of the branch is open or merged, the issue is closed or carries `epic`, and every local commit is on an `origin` remote-tracking branch other than the issue's prototype branches (push the branch when the script names it); `specify` runs it after it rejects a design or makes the issue an epic. The script refuses an open issue without `epic` whose branch has no merged PR. If a session-end prompt offers to remove the worktree, keep it; only `scripts/land.sh` and `scripts/worktree.sh --remove` remove a lane worktree.
- Prototype: a look decision's prototype lives on `prototype/<n>-<slug>`, never on the lane branch. It is not a lane branch: `scripts/worktree.sh` does not take it, it is never merged, and it never gets a PR. From the lane worktree, `git worktree add -b prototype/<n>-<slug> <main>/.claude/worktrees/prototype-<n>-<slug>` checks it out (`<main>` is the main checkout), and `npm --prefix <that path>/frontend ci` installs what its dev server needs. Variants that need a settled Capture Attempt get one from the lane worktree's API (`API_INTERNAL_BASE_URL`) when `backend/face_landmarker.task` exists, and render a stubbed one otherwise. The screenshots, and any `playwright-core` script that takes them, live in that checkout's `frontend/` and are committed with the variants; `npm --prefix <that path>/frontend install --no-save playwright-core` installs `playwright-core` there without touching `package.json`. After the pick, stop its dev server, commit the variants, push the branch, and remove the checkout with `git worktree remove`. The branch stays until the lane is removed: `scripts/land.sh`, or `scripts/worktree.sh --remove <n>` (`specify` after a rejection or an epic), deletes it with any leftover checkout, locally and on `origin`.
- Every commit message references `#<n>`.
- The PR body carries `Closes #<n>`. Merges are squash-only (`gh pr merge --squash`; the repo allows no other method). The PR title is the squash subject that release-please reads for a PR with two or more commits, so it is a Conventional Commit `<type>(<area>): <what> (#<n>)`; for a PR with one commit, GitHub takes the subject of that commit and adds the PR number (the repository setting `squash_merge_commit_title` is `COMMIT_OR_PR_TITLE`), so that commit carries the Conventional Commit subject of the change. Only `feat` and `fix` (or a `!` breaking change) cut a release. An agent lands a change only with `scripts/land.sh <n> '<subject>'`, which its build step runs (`/implement`, `/chore`). With `pr` it pushes the branch, opens the PR when none is open (title `<subject> (#<n>)`, body `Closes #<n>`), and squash-merges it at the commit that the checks ran on, only when every check passed or was skipped and at least one check passed (ADR-0007, ADR-0014). `.claude/settings.json` denies `gh pr merge` to an agent; the maintainer can still merge by hand.

**Environments.** `master` deploys to the staging stack (`staging.fwhr-calculator.com`) on every push, so a merged issue is on staging, not live. Production tracks the `production` branch and runs only releases: `scripts/promote.sh`, run by the maintainer after `/promote-preview`, merges the open release-please PR and fast-forwards `production` to its `vX.Y.Z` tag. An agent never promotes and never merges the release PR: `scripts/land.sh` selects a PR by its lane branch name, and the release PR has none. Model: ADR-0005, ADR-0006; procedures: `docs/coolify-shared-network-runbook.md`.

## Epics

A request that spans several independent features becomes an **epic**: the parent issue carries `epic` as its only lane label and has one native sub-issue per feature. The epic has no branch and no PR; each child runs its own `/feature #<child>`. GitHub leaves a parent open after its last sub-issue closes, so `scripts/land.sh` closes the epic, with a comment, when its last sub-issue lands. An epic whose last sub-issue closes with no landing by the script (`wontfix`, a merge by hand, a close that failed) stays open: close it by hand.

Make the parent an epic: `gh issue edit <n> --add-label epic --remove-label enhancement`. Create a child, then link it — the sub-issues API wants the child's numeric database id (`.id`), not its `#number`:

```bash
url=$(gh issue create --label enhancement --title "..." --body "...")
cid=$(gh api "repos/{owner}/{repo}/issues/${url##*/}" --jq .id)
gh api --method POST "repos/{owner}/{repo}/issues/<epic>/sub_issues" -F sub_issue_id="$cid"
```

- **List an epic's children**: `gh api repos/{owner}/{repo}/issues/<epic>/sub_issues --jq '.[] | "#\(.number) \(.state) \(.title)"'`.
- **Find a child's parent**: `gh api repos/{owner}/{repo}/issues/<n>/parent --jq .number` (404 when standalone). Read the parent's body before designing a child — its decisions bind.

## Resolving an issue's state

`gh issue view <n> --json state,labels,body,comments`.

- **routed** — carries a lane label (`bug`, `enhancement`, `hotfix`, `chore`, `epic`); unrouted → `/triage #<n>`.
- **waiting** — `needs-info` or `ready-for-human`.
- **landing refused** — `ready-for-human`, and a landing refusal is current: the last comment of the issue that starts with `## ` starts with `## Landing refused`. A later comment that starts with `## ` and not with `## Landing refused` (the result of a later step, for example `## Plan` or `## Before landing`) ends the refusal. A comment that does not start with `## ` does not end it. A second refusal is a new comment, and it is current.
- **specced** — the body opens with `Spec:`.
- **planned** — `ready-for-agent`, with a `## Plan` comment.
- **built** — a `## Plan` comment with no `ready-for-agent`; `/implement #<n>` lands the change and does not build it again.
- **finished** — the issue is closed and does not carry `wontfix`.

`.claude/scripts/next-step.sh` encodes this resolution as one ordered list, first match wins: closed (`wontfix`, else finished), `needs-info`, `ready-for-human`, `epic`, unrouted (`/triage`), an `enhancement` without a spec (`/feature`, which runs `specify`), a `bug` without `## Root cause` (`/bug`), `chore`, `hotfix`, no `## Plan` comment (`/plan`), then `/implement`. With a number it prints one line, `run <command>` or `stop <reason>`; with `--open` it prints one row for each open issue, lowest number first: the number, a tab, and that line. Both forms print the dirty-tree line for a dirty checkout. While `scripts/land.sh` lands the issue, both print `stop the landing of #<n> runs; wait until scripts/land.sh ends`. The form with a number prints it before any `gh` call; `--open` prints it in the row of the issue. `--json` prints the rows for `scripts/agent-flow.sh --board`, which prints contract 1 for the board: one row with a state for each open issue and each issue that closed in the last 14 days (an issue that resolves to `epic` or to a closed `wontfix` has no row), and the open PR of each with its CI result and review state, from 3 `gh` calls. The runner (`docs/agents/agent-flow.md`) acts on it. A `blocked` row has the `reason` `needs info`, `landing refused`, or `ready for your step`; a refused landing keeps the `stop` line and the `act` of `ready-for-human`. A change to a label, a heading, or this order updates the resolver and `.claude/scripts/next-step.test.sh` in the same PR.
