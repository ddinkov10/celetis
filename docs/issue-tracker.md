# Issue tracker: GitHub

Issues are the state store for every lane. The issue number `#<n>` is the handle that carries work between commands and sessions; state lives in the issue and the repo, never in chat history. Use the `gh` CLI for each operation apart from the workflow writes of "Conventions" — it infers the repo from the clone, and `{owner}/{repo}` in an API path fills itself in.

The state, headings, paths, and branches are shared by both hosts. `/celetis:<skill>` names the
shared skill; use the selected host's invocation. Skills expand each launcher call with the
explicit `--agent claude` or `--agent codex` prefix under [Host entry](hosts/entry.md). Human
terminal and board commands can use the project default. Changing hosts between steps retains
the same issue and lane checkout; resume always uses the host in the current session record.

In this document, these names are files of the plugin `celetis`, also when a session reads the document inside a product project that has a `docs/` folder and an ADR store of its own: the four documents (`docs/celetis-flow.md`, `docs/issue-tracker.md`, `docs/capability.md`, `docs/docs-lookup.md`), `step-prompt.md`, a runtime `<name>.ts` of `engine/` or a program of `scripts/` that the text names by its file, and each ADR number, which is a record of `docs/adr/` in the folder of the plugin and not of the product project. Each other path is a path of the product project, apart from a path that starts with `~/` or `/`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <file>` (or `--body "..."` with a heredoc).
- **Read an issue**: `gh issue view <n> --comments`; for structured output `--json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,labels --jq '.[] | "#\(.number)\t\([.labels[].name] | join(","))\t\(.title)"'`, filtered with `--label` and `--state`.
- **Comment**: `gh issue comment <n> --body-file <file>` / `--body "..."`.
- **Replace the body**: `gh issue edit <n> --body-file <file>`.
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <n> --comment "..."`.

Use the `gh` forms above only for the writes that the engine does not read, for example the
`## Intent` and `## External facts` comments. Each workflow write that the engine reads goes
through `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> issue <n> <act>`.
In this document, `issue <n> <act>` stands for that command. The command reads the issue once,
checks the prerequisite of the act with the rules of the resolver, and then writes:

| Act | Prerequisite | Writes |
|---|---|---|
| `route <lane>` (`feature`, `bug`, `chore`, `hotfix`) | open; not an epic | the label of the lane; it removes the other lane labels and `needs-triage` |
| `epic` | open; lane `feature` | adds `epic`, removes `enhancement` |
| `needs-info <file>` | open | the file as a comment, then `needs-info` |
| `wontfix <file>` | open | the file as a comment, then `wontfix`, then the close as not planned |
| `spec <file>` | open; lane `feature` | the body: `Spec: YYYY-MM-DD` (the local date), a blank line, then the file |
| `root-cause <file>` | open; lane `bug` or `hotfix` | a `## Root cause` comment |
| `plan <file>` | open; a `feature` with a spec, or a `bug` with a `## Root cause` comment | a `## Plan` comment, then `ready-for-agent` |
| `built` | the resolver line is `implement` of a planned change | removes `ready-for-agent` |
| `before-landing <file> [--during-the-build]` | the resolver line is the step that lands the lane (`implement`, `chore`, `hotfix`) | a `## Before landing` comment with the marker of its kind ("Completing a human precondition"), then it adds `ready-for-human`, and removes `ready-for-agent` when it is on |
| `landing-refused <file>` | as `before-landing` | a `## Landing refused` comment |
| `stopped <file>` | open | a `## Stopped` comment, then `ready-for-human` |
| `ready-for-human` | open | adds `ready-for-human` |
| `state` | none | nothing |

- The command writes the heading of each comment. The `<file>` holds the text with no heading: the
  command refuses a file whose first line that is not blank starts with `## `, and, for `spec`,
  one that starts with `Spec:`. No act writes `## Human steps done` or removes `ready-for-human`.
- It posts the comment first (ADR-0011). Then it adds the labels in one call, removes each label in
  a call of its own, and last changes the body or closes the issue. It never replaces the whole set
  of labels, so a label that a person adds or removes at the same time stays as the person set it.
  A label that is already on, or already off, is no change, and a write with no change is not
  sent. The removal of a label that is already off on GitHub is no failure.
- `state` prints the facts that the engine reads, one per line: `lane:`, `line:` (the resolver
  line), `build:` (`none`, `planned`, `built`, `not-marked`, `added-again`), `plan:` (the id of
  the current `## Plan` comment, or `none`), `open:` (the kind, the comment id, and the missing
  evidence of each open human step, or `none`), and `refusal:` (`current` or `none`).
- Exit status: 0 done, 1 internal error, 2 usage (bad arguments, or a file that the command
  refuses), 3 prerequisite (`issue: prerequisite: #<n> cannot <act>:` and the resolver line),
  6 blocked (GitHub does not answer, or a write failed). When a write after the first failed, the
  line gives the `gh` command that completes each write that is not done. Until then, the
  resolver stops a `## Before landing` comment with no `ready-for-human` as an open human step, and
  a `## Plan` comment with no `ready-for-agent` as a plan that is not marked ("Resolving an issue's
  state").

## Labels

The lane labels are `bug`, `enhancement`, `hotfix`, and `chore`, one for each lane. A routed issue
carries exactly one lane label, or `epic` in place of a lane label. The resolver stops an issue with
two or more lane labels until you keep one ("Resolving an issue's state"). The other labels mark
waits and gates.

| Label | Meaning | Set by | Cleared by |
|---|---|---|---|
| `needs-triage` | not yet classified | `/celetis:intake` | `/celetis:triage`, or a lane when it sets its lane label |
| `bug` | existing behavior misbehaves, production not on fire | `/celetis:triage` or `/celetis:bug` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `enhancement` | new behavior — the feature lane | `/celetis:triage` or `/celetis:feature` | the lane that reclassifies the issue; `/celetis:feature`'s scope check when it makes the issue an epic (the one case where the row's own lane clears it) |
| `hotfix` | production broken, the fix ships now | `/celetis:triage` or `/celetis:hotfix` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `chore` | zero-behavior-change edit | `/celetis:triage` or `/celetis:chore` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `epic` | parent of several feature sub-issues | `/celetis:feature` scope check | — |
| `needs-info` | the report lacks what its lane needs; the questions are in a comment | `/celetis:triage` | the reporter's reply, then `/celetis:triage` |
| `ready-for-agent` | plan posted; `/celetis:implement #<n>` can start | `plan` | `implement`, when the change is built |
| `ready-for-human` | a step only a human runs (a human precondition of a landing; a hotfix whose landing stopped; a step session that stopped). The card of the issue reads `landing refused` while a landing refusal is current ("Resolving an issue's state"), else `ready for your step` | `implement`, `/celetis:hotfix`, a step session at a stop (`step-prompt.md` of the plugin) | the human |
| `wontfix` | not actioned; the reason is in a comment | `/celetis:triage`, `specify` | — |

## What lives on the issue

- **Intent** — `/celetis:intake` writes the intent template as the body of a new issue, or as a comment headed `## Intent` on an existing one. A reporter's body is never rewritten by intake.
- **Spec** — `specify` replaces the body with the design spec (`issue <n> spec <file>`); its first line is `Spec: YYYY-MM-DD`. The body is the current truth for the item.
- **Plan** — `plan` posts the implementation plan as a comment headed `## Plan`, then adds `ready-for-agent` (`issue <n> plan <file>`). Its first section, `### Your steps`, lists the human acts of the lane in two lists: "During the build" (each act that the maintainer does while the build runs, the step that needs it, and its report) and "After the landing" (each check by hand on the built change; nothing in the lane waits for it). `implement` in a fresh context re-fetches the latest `## Plan` comment.
- **Human steps done** — the maintainer reports the acts of "During the build" in one comment whose first line is `## Human steps done`, after the latest `## Plan` comment. The comment names each act that is done and each value that an act gives. `implement` reads each such comment after the latest `## Plan` comment. A session never writes it, and the command `issue` has no act for it.
- **Root cause** — `/celetis:bug` and `/celetis:hotfix` post the debugging report as a comment headed `## Root cause` (`issue <n> root-cause <file>`).
- **Prototype** — a look decision (`AGENTS.md` of the project) is recorded as a `## Prototype` section inside the spec (the issue body) or the `## Root cause` report, edited in place when that is already posted. It holds the question, the `prototype/<n>-<slug>` branch with its commit, one line per variant, and the verdict with its reason.
- **Built** — no `ready-for-agent` label, and a removal of it after the latest `## Plan` comment: `plan` sets the label, and `implement` clears it when the change is built (`issue <n> built`).
- **Before landing** — a comment headed `## Before landing` names a human precondition that the plan did not name, an act of "During the build" with no report (its report form, and the scenarios that wait for it), or a Verify scenario that a step session could not run; the issue carries `ready-for-human` until the maintainer did the act. `issue <n> before-landing <file>` posts it with `<!-- celetis-before-landing general -->` on its second line, or with `<!-- celetis-before-landing during-the-build -->` when `--during-the-build` follows the file, for a comment that names an act of "During the build" ("Completing a human precondition"). Then it adds `ready-for-human`, and removes `ready-for-agent` when it is on.
- **Landing refused** — a comment headed `## Landing refused` holds the output of `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` at a stop (`issue <n> landing-refused <file>`); a step session then adds `ready-for-human` (`issue <n> ready-for-human`). The refusal is current while this comment is the last comment of the issue that starts with `## ` ("Resolving an issue's state").
- **Stopped** — a comment headed `## Stopped` holds the reason of a stop of a step session for which its skill posts no comment (a refusal of `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree`, gate attempt 4 of `implement`, a blocked hotfix), and the act of the maintainer that lets the step go on; `issue <n> stopped <file>` posts it and adds `ready-for-human`, and the issue carries the label until the maintainer did the act. `docs/celetis-flow.md`, "How a step runs", defines a step session.
- **External facts of a dependency bump** — `/celetis:chore` posts a comment headed `## External facts`.
- **Finished** — the issue is closed and does not carry `wontfix`.

Local `docs/superpowers/` files are scratch; a fresh session re-fetches from the issue. A product project ignores `docs/superpowers/` and `.claude/worktrees/` in its `.gitignore`: with no entry for `.claude/worktrees/`, a lane worktree makes the main checkout dirty, and the resolver prints the dirty-tree line for each issue.

## Branches, PRs, merge

The main checkout's `.celetis.yaml` owns repository setup (ADR-0015).

Trunk-based. Every issue is its own work item: one lane branch off the trunk, landed by `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` with the `landing` field of the main checkout's `.celetis.yaml`: `pr` is one PR back to the trunk; `merge` is one squash commit on the trunk, with no PR. The trunk is the default branch of the repository on GitHub.

- Branch: `feat/<n>-<slug>` (feature), `fix/<n>-<slug>` (bug), `hotfix/<n>-<slug>`, `chore/<n>-<slug>`.
- Worktree: every command that works on the issue's branch (the four lanes, `specify`, `plan`, `implement`) runs `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree <n>` (`<n>` or `#<n>`) and binds the exact path it prints through the selected host operations. Every file, command, instruction read, and child brief then uses that lane path. The script re-enters the issue's local branch; else it checks out the head branch of the issue's open PR (`feat|fix|hotfix|chore/<n>-…`), tracking `origin`; else it creates `<prefix>/<n>-<slug>` off the freshly fetched trunk of `origin`, the prefix from the lane label and the slug from the title (lowercased, each run of other characters than `a-z0-9` turned into one `-`, trimmed of `-` at both ends, at most 30 characters cut at a `-` or hard-cut at 30 when the first word alone is longer, `issue` when empty). It checks the branch out in `.claude/worktrees/<n>-<slug>` and runs the worktree setup of the project (`docs/celetis-flow.md`, "The config and the custom parts"). It refuses an epic, an issue with no lane label (run `/celetis:triage #<n>`), an issue with more than one lane label, and an issue that two branches or two open PRs match. Every later step runs there, so the main checkout never changes branch and flows run side by side. `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` removes the worktree, the lane branch, and the prototype branches after the landing. `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree --remove <n>` removes them in the two cases with no landing by the script. After a merge by hand: a PR of the branch is merged and the local tip is that PR's head. Without a merge: no PR of the branch is open or merged, the issue is closed or carries `epic`, and every local commit is on an `origin` remote-tracking branch other than the issue's prototype branches (push the branch when the script names it); `specify` runs it after it rejects a design or makes the issue an epic. The script refuses an open issue without `epic` whose branch has no merged PR. If a session-end prompt offers to remove the worktree, keep it; only `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` and `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree --remove` remove a lane worktree.
- Prototype: a look decision's prototype lives on `prototype/<n>-<slug>`, never on the lane branch. It is not a lane branch: `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree` does not take it, it is never merged, and it never gets a PR. From the lane worktree, `git worktree add -b prototype/<n>-<slug> <main>/.claude/worktrees/prototype-<n>-<slug>` checks it out (`<main>` is the main checkout). Install there what the dev server of the project needs. The screenshots, and any script that takes them, live in that checkout and are committed with the variants; install a tool that such a script needs with no change to a tracked file. After the pick, stop its dev server, commit the variants, push the branch, and remove the checkout with `git worktree remove`. The branch stays until the lane is removed: `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land`, or `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree --remove <n>` (`specify` after a rejection or an epic), deletes it with any leftover checkout, locally and on `origin`.
- Every commit message references `#<n>`.
- Landing prerequisites: before each push, PR, re-run of a check, and merge, `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` resolves the issue by "Resolving an issue's state" and refuses it unless the result is a `chore` or `hotfix` step, a **built** change, or **land by hand**. So it refuses a closed issue, an epic, no lane label or two, `needs-info` or `ready-for-human` on the issue, an open human step, and a `feature` or `bug` change that is not built. A change that is already on the trunk skips this check, so a second run completes its cleanup. The exit status names the result, and so does the first word after `land: `: 0 landed (also with a warning), 1 an internal error, 2 `usage`, 3 `prerequisite`, 4 `repair`, 5 `checks`, 6 `blocked`, 7 `cleanup` (the change is on the trunk and the cleanup stopped: run the script again), 128+n a signal. `docs/celetis-flow.md`, "A landing", gives the examples of each class.
- The PR body carries `Closes #<n>`. Merges are squash-only (`gh pr merge --squash`). The PR title is the squash subject of a PR with two or more commits, so it is a Conventional Commit `<type>(<area>): <what> (#<n>)`: `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` refuses a subject that is no Conventional Commit subject, and it gives the subject, with `(#<n>)` after it, to the commit on the trunk (`merge`) and to the title of the PR that it opens (`pr`). A product project with the landing `pr` keeps the repository setting `squash_merge_commit_title` at `COMMIT_OR_PR_TITLE`: with that value, for a PR with one commit, GitHub takes the subject of that commit and adds the PR number, so that commit carries the Conventional Commit subject of the change. An agent lands a change only with `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land <n> '<subject>'`, which its build step runs (`/celetis:implement`, `/celetis:chore`). With `pr` it pushes the branch, opens the PR when none is open (title `<subject> (#<n>)`, body `Closes #<n>`), and squash-merges it at the commit that the checks ran on, only when every check passed or was skipped and at least one check passed (ADR-0001, ADR-0008). Each invocation waits for workflow completion before it accepts green checks, including when a dependent job has no check row yet. When each red check is a check of GitHub Actions that failed or timed out, it first re-runs the failed jobs of their workflow runs, once for each commit, and waits up to 15 more minutes (ADR-0023). The README gives the Claude and Codex permission rules for the permitted landing forms and direct-merge restriction. Their scope does not replace the script checks; the maintainer can still merge by hand.

## Epics

A request that spans several independent features becomes an **epic**: the parent issue carries `epic` and no lane label, and has one native sub-issue per feature. The epic has no branch and no PR; each child runs its own `/celetis:feature #<child>`. GitHub leaves a parent open after its last sub-issue closes, so `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` closes the epic, with a comment, when its last sub-issue lands. An epic whose last sub-issue closes with no landing by the script (`wontfix`, a merge by hand, a close that failed) stays open: close it by hand.

Make the parent an epic: `issue <n> epic` ("Conventions"). Create a child, then link it — the sub-issues API wants the child's numeric database id (`.id`), not its `#number`:

```bash
url=$(gh issue create --label enhancement --title "..." --body "...")
cid=$(gh api "repos/{owner}/{repo}/issues/${url##*/}" --jq .id)
gh api --method POST "repos/{owner}/{repo}/issues/<epic>/sub_issues" -F sub_issue_id="$cid"
```

- **List an epic's children**: `gh api repos/{owner}/{repo}/issues/<epic>/sub_issues --jq '.[] | "#\(.number) \(.state) \(.title)"'`.
- **Find a child's parent**: `gh api repos/{owner}/{repo}/issues/<n>/parent --jq .number` (404 when standalone). Read the parent's body before designing a child — its decisions bind.

## Completing a human precondition

A `## Before landing` comment belongs to the build it names. Before re-entry can land that
build, require a trusted human report that its required acts and scenarios completed, or the
maintainer's removal of `ready-for-human` after that comment; a comment of "During the build", and
a comment with no marker, need both (below). Check the current build and
comment; an older clearance does not clear a newer precondition. Label absence alone is not
completion evidence: a label write can fail.

The engine checks this evidence from the timeline of the issue,
`gh api --paginate 'repos/{owner}/{repo}/issues/<n>/timeline?per_page=100'` (`factsOf` in
`engine/lib/workflow.ts` of the plugin). "After" is a later position in the timeline, not a later
time. The current build starts at the latest `## Plan` comment; for a lane with no `plan` step
(`chore`, `hotfix`), it starts at the start of the issue. A `## Before landing` comment before that
start belongs to an older build. A report or a removal before the comment does not count. The
resolver stops an issue with an open human step ("Resolving an issue's state").

The second line of a `## Before landing` comment is a hidden marker of its kind:
`<!-- celetis-before-landing general -->` for a general precondition, and
`<!-- celetis-before-landing during-the-build -->` for a comment that names an act of "During the
build". A comment with no marker gets the strict rule of "During the build": a report and a removal.

The `unlabeled` event of the timeline identifies `actor`, `created_at`, and `label.name`
([GitHub event types](https://docs.github.com/en/rest/using-the-rest-api/issue-event-types)).
For a general precondition, a maintainer's later removal of `ready-for-human` is the workflow's
completion signal, as a trusted human completion report is. Without the evidence that the kind of
the comment needs, keep the change built, restore the human label (`issue <n> ready-for-human`)
using the existing comment as its reason, and stop. No new approval is needed. Each
required scenario still needs PASS; an unrun scenario has none.

When a `## Before landing` comment of this build names an act of "During the build", the evidence
for that act is both: a `## Human steps done` comment after that comment that reports the act, and
the maintainer's removal of `ready-for-human` after that comment. One or more such reports can
cover the acts that the comment names. The next run of `implement` then runs the scenarios that
waited for the acts, and lands on a PASS. For a precondition of the landing, no scenario runs. With
the reports and the removal, the next run lands. An act of "During the build" with no report that
no `## Before landing` comment of this build names stops the landing with a new such comment, also
after an earlier stop of this build. Each `gh` call uses the maintainer's token, so the
author of a comment proves nothing: the rule that a session never writes the report is the guard.

## Resolving an issue's state

`gh issue view <n> --json state,labels,body`, and the timeline of the issue
(`gh api --paginate 'repos/{owner}/{repo}/issues/<n>/timeline?per_page=100'`) for its comments and
label changes in order.

- **routed** — carries one lane label (`bug`, `enhancement`, `hotfix`, `chore`) or `epic`; unrouted, with neither → `/celetis:triage #<n>`.
- **several lanes** — two or more lane labels: no step starts until you keep one lane label.
- **waiting** — `needs-info` or `ready-for-human`.
- **landing refused** — `ready-for-human`, and a landing refusal is current: the last comment of the issue that starts with `## ` starts with `## Landing refused`. A later comment that starts with `## ` and not with `## Landing refused` (the result of a later step, for example `## Plan` or `## Before landing`) ends the refusal. A comment that does not start with `## ` does not end it. A second refusal is a new comment, and it is current.
- **specced** — the body opens with `Spec:`.
- **planned** — `ready-for-agent`, with a `## Plan` comment, and no removal of `ready-for-agent` after the latest `## Plan` comment.
- **built** — no `ready-for-agent`, and a removal of `ready-for-agent` after the latest `## Plan` comment; `/celetis:implement #<n>` lands the change and does not build it again.
- **plan not marked** — the latest `## Plan` comment has no `ready-for-agent` and no removal of it after it: the `plan` step did not add the label.
- **plan already built** — `ready-for-agent`, and a removal of it after the latest `## Plan` comment: the change is built, and a second build needs a new plan.
- **human step open** — a `## Before landing` comment of the current build with no completion evidence after it ("Completing a human precondition"). The absence of `ready-for-human` is no evidence.
- **land by hand** — a `hotfix` whose latest `## Landing refused` or `## Before landing` comment has a removal of `ready-for-human` after it: the maintainer lands the change in a shell of their own, and no hotfix step starts.
- **finished** — the issue is closed and does not carry `wontfix`.

`BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step` encodes this resolution as one ordered list, first match wins: closed (`wontfix`, else finished), `needs-info`, `ready-for-human`, `epic`, two or more lane labels (`stop #<n> has several lane labels (<labels>). Keep one lane label and remove the others.`, with the labels in one line, separated by a space), unrouted (`/celetis:triage`), an `enhancement` without a spec (`/celetis:feature`, which runs `specify`), a `bug` without `## Root cause` (`/celetis:bug`), an open human step (`stop #<n> has an open human step. <act>`, with the act that names the missing evidence of the latest open `## Before landing` comment: the report and the removal, the report, or the removal), a `hotfix` to land by hand (`stop #<n> waits for a landing by hand. <act>`, with the `land` command), `chore`, `hotfix`, no `## Plan` comment (`/celetis:plan`), a plan that is not marked (`stop #<n> has a plan with no ready-for-agent. <act>`) or already built (`stop #<n> has ready-for-agent on a built plan. <act>`), then `/celetis:implement` (planned or built). With a number it prints one line, `run <command>` or `stop <reason>`; with `--open` it prints one row for each open issue, lowest number first: the number, a tab, and that line. Both forms print the dirty-tree line for a dirty checkout. While `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` lands the issue, both print `stop the landing of #<n> runs; wait until BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land ends`. The form with a number prints it before any `gh` call; `--open` prints it in the row of the issue. The board reads its rows in its own process through the typed board read of the same resolver (`nextBoard` of `next-step.ts`): one row with a state for each open issue and each issue that closed in the last 14 days (an issue that resolves to `epic` or to a closed `wontfix` has no row), and the open PR of each with its CI result and review state, from these `gh api` calls: 3 paginated lists (open issues, closed issues, open PRs), one paginated call for the timeline of each open issue that has a comment, and 3 calls for each open PR whose branch holds `/<number>-`. The form with a number reads the timeline of its issue only when the issue has a comment. The runner and the board (`docs/celetis-flow.md`) act on this resolution. A `blocked` row has the `reason` `needs info`, `landing refused`, `ready for your step`, `several lane labels`, `human step open`, `land by hand`, `plan not marked`, or `plan already built`; a refused landing keeps the `stop` line and the `act` of `ready-for-human`. `engine/lib/workflow.ts` of the plugin is the one definition of the labels, the headings that the resolver reads, the lifecycle facts, and this order. A change to a label, a heading, or this order updates that definition in the same PR.
