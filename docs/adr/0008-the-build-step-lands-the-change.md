# The build step lands the change, by the mechanism that the repository names

## Date

2026-10-11

## Related

- #415 (this change), #418 (no step fixed a refused merge; the card text for a refused landing stays
  there), #417 (GitHub leaves an epic open after its last sub-issue closes)
- ADR-0005 (`docs/adr/0005-master-staging-production-fast-forward.md`) and ADR-0006
  (`docs/adr/0006-production-runs-release-please-releases.md`): the staging and production model
  stands, apart from the one phrase below
- ADR-0007 (`docs/adr/0007-agents-merge-lane-prs.md`): superseded in part, below
- ADR-0008 (`docs/adr/0008-loop-script-and-mod-run-the-agent-flow.md`) and ADR-0011
  (`docs/adr/0011-herdr-gives-the-session-state-and-ends-each-step.md`): the script, the gate rule,
  and the step-end rule stand, unchanged
- ADR-0013 (`docs/adr/0013-specify-is-a-step-of-the-runner.md`): it made `specify` a step of the
  runner with its own gate, on the date of this record. With that gate and without `finish`, the
  runner has seven gates: `triage`, `specify`, `bug`, `chore`, `hotfix`, `plan`, and `implement`
- `scripts/land.sh`, `.claude/agent-flow/landing.json`, `.claude/scripts/next-step.sh`, and the
  `implement`, `chore`, and `hotfix` skills
- `docs/agents/issue-tracker.md`, `docs/agents/agent-flow.md`

## Supersedes

- From ADR-0007, "Agents merge lane PRs when CI is green; the human gate is promotion": where the
  merge runs. `scripts/merge-pr.sh <n>` as the one merge path, `/finish` in a session of its own,
  the resolver line that sends an issue with an open PR to `/finish`, and the staging walkthrough
  as the check after a merge go. The rule that a refused PR stops with the reason on the issue
  goes too: the session first fixes a cause that the change made. The merge rule, the rule that an
  agent has one landing path, the permission rules, and the human gate at promotion stand.
- From ADR-0005, "`master` deploys to staging; `production` is a fast-forward-only branch promoted
  by hand": the phrase that a human promotes "after the epic walkthrough passed on staging". The
  check before promotion is `/promote-preview`.

## Context

Until #415 a lane ended with an open PR, and a second step, `/finish`, landed it in a session of
its own (ADR-0007): it merged the PR with `scripts/merge-pr.sh`, waited for staging, walked the
stories again on staging, and removed the worktree and the branch. This shape had three defects.

- **The second session had none of the context of the build.** When the merge script refused a PR,
  `/finish` posted the refusal and stopped, and no step of the flow fixed the cause (#418).
- **The staging walk repeated a check.** The Verify phase of `/implement` already walks the stories
  on the local runtime before the PR.
- **The flow had the shape of one repository.** The maintainer runs the agent flow in more than one
  repository. Another repository opens no PR: it squash-merges the lane branch into the trunk, and
  a script then removes the worktree and the branch. Some repositories have a staging stack, and
  some deploy nothing.

## Constraints and evidence

Read on 2026-10-11 in this repository, with gh 2.100.0, git 2.55.0, and herdr 0.9.3, where a line
gives no other date:

- `gh pr create` takes `--base`, `--head`, `--title`, and `--body`, and it prints the URL of the new
  PR, so the number of the PR is the last path part (`gh pr create --help`).
- `gh pr checks --json bucket` sorts each check into `pass`, `fail`, `pending`, `skipping`, or
  `cancel`, and `gh pr merge --match-head-commit <sha>` merges only when the PR head is that commit
  (ADR-0007).
- `unique` of jq sorts, so `[.[].bucket] | unique | join(" ")` prints `pass pending`, never
  `pending pass` (a run of `scripts/land.test.sh`).
- `gh pr list --state merged --json number,headRefName,headRefOid` gives the head commit of each
  merged PR, and the field `baseRefName` gives the base branch of a PR.
- `gh issue close <n> --comment <text>` closes an issue with a comment (`gh issue close --help`).
- `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name` prints the default branch,
  `master` here.
- `gh api repos/{owner}/{repo}/issues/403/parent --jq '"\(.number) \(.state)"'` prints `401 open`.
  For an issue with no parent (#415), gh exits 1, prints the JSON body on stdout, and prints
  `gh: No parent issue found (HTTP 404)` on stderr. `…/issues/401/sub_issues` gives `.number` and
  `.state` (`open` or `closed`) for each sub-issue.
- A parent issue stays open after its last sub-issue closes: #13 and #401 were open with each
  sub-issue closed (#417, read on 2026-10-10).
- This repository has `delete_branch_on_merge: true`, allows only squash merges, and has
  `squash_merge_commit_title: COMMIT_OR_PR_TITLE` (`gh api repos/{owner}/{repo}`). So GitHub names
  the squash commit of a PR with one commit by the subject of that commit, and by the PR title only
  for a PR with two or more commits.
- `git push origin --delete <branch>` exits 1 for a branch that `origin` does not have
  (`remote ref does not exist`), as it does for a delete that `origin` refuses. So the exit status
  of the delete does not tell a branch that is gone from a delete that failed (a run in a fixture
  repository).
- The repository is private on a personal plan, and the branch-protection API answers 403, so no
  branch has protection on GitHub (`gh api repos/{owner}/{repo}/branches/production/protection`).
  `.claude/settings.json` has no rule for `gh pr create`, and it allows `scripts/land.sh` with no
  prompt.
- A merged lane PR closes its issue through `Closes #<n>`, and the keyword works only on the
  default branch (ADR-0005, ADR-0007).
- `git merge-tree --write-tree <branch1> <branch2>` does a real merge and prints the id of its
  tree. It exits 0 for a clean merge and 1 for a merge with conflicts (`git help merge-tree`, EXIT
  STATUS).
- `git commit-tree <tree> -p <parent> -m <message>` makes one commit object and prints its id. It
  touches no working tree, and no hook runs (`git commit-tree -h`).
- herdr reads a Claude Code agent that waits for a background command as `done`, then `idle`, not
  as `working`. 30 samples of `herdr agent get` over 30 seconds, in the pane of the `/plan #415`
  session, gave 3 `working`, 6 `done`, and 21 `idle`, and `state_change_seq` did not change between
  `done` and `idle`.
- The wait for the checks of a PR can last 15 minutes, and a foreground Bash command of Claude Code
  stops at 10.
- A permission rule matches the text of a command (ADR-0007), and `.claude/settings.json` denies a
  Bash command that holds the path of the promote script.
- 31 issues that closed since 2026-09-01 (#102 to #250) had no walkthrough comment, so the resolver
  printed `run /finish` for each one.
- The spec on #415 names this record ADR-0012, and the plan names it ADR-0013. Both numbers were
  taken on the trunk while the work ran, by #419 and #414.

The tests of this change:

- `scripts/land.test.sh` runs the two mechanisms and each refusal that the spec names on real git,
  with a real bare `origin` and a stub of `gh`. `merge` ran in no real repository.
- Fixture tests show the hold of the step end. While a live `land.sh` holds the lock,
  `next-step.sh <n>` prints the landing line before any `gh` call, and the job of the runner types
  no `/exit` (`.claude/scripts/next-step.test.sh`, `scripts/agent-flow.test.sh`).
- Three of the four shell tests of the harness start their script with the bash that runs the
  test. `scripts/worktree.test.sh` starts its script with the `bash` that is first on `PATH`, and
  so does each script that starts another script. So the proof on bash 3.2 is the form
  `PATH="/bin:$PATH" /bin/bash <test>`. The gate `scripts/verify.sh` runs no harness test.

## Decision

- **The repository names its landing mechanism.** `.claude/agent-flow/landing.json`, beside
  `gates.json`, holds `{"landing": "pr"}` or `{"landing": "merge"}`. The file is tracked, so the
  mechanism is a property of the repository, not of a machine. There is no default: with no file,
  or with another value, the script exits 2 with a message. This repository names `pr`. No skill
  names a mechanism: each build step runs the script.
- **`scripts/land.sh <n> '<subject>'` is the one landing path of an agent.** It takes the place of
  `scripts/merge-pr.sh`. `.claude/settings.json` allows it, and `gh pr merge` stays denied. The
  subject is a Conventional Commit subject with no issue number, and the script adds ` (#<n>)`. The
  trunk is the default branch that GitHub reports: the script holds no branch name.
  - With `pr`, the script pushes the lane branch and opens the PR when the branch has none (title
    `<subject> (#<n>)`, body `Closes #<n>`). It then applies the merge rule of ADR-0007, unchanged:
    it waits up to 15 minutes for the checks and squash-merges at the commit that the checks ran
    on, only when each check passed or was skipped and at least one check passed. The merge closes
    the issue through `Closes #<n>`. The script selects a PR only by a lane branch name, so it
    cannot take the release PR. It takes only a lane PR whose base is the trunk. An open lane PR
    of the issue on another base is a refusal that names the PR and its base, and a lane PR that
    is merged into another base does not count as this landing. The script runs with no prompt,
    and no permission rule stops a `gh pr create` with another base, so without the check of the
    base one wrong PR is enough to put a change on `production`.
  - With `merge`, the script refuses unless the main checkout is clean, on the trunk, and level
    with the trunk on `origin`, and unless the lane branch contains the trunk head. It then makes
    one commit on the trunk head with the tree of the branch and the subject `<subject> (#<n>)`,
    pushes the trunk, and closes the issue with a comment that names the commit. The branch
    contains the trunk head, so that tree is the tree that `scripts/verify.sh` checked on the
    branch.
  - After the landing, with each mechanism, the script prints `land: #<n> is on <trunk>` and
    closes the parent epic. It then removes the prototype branches of the issue, the lane
    worktree, and the lane branch, locally and on `origin`. The local lane branch goes last: a
    second run finds the issue by that branch, so it completes a landing that stopped part of the
    way.
  - No read comes before the delete of the lane branch on `origin`. GitHub deletes the branch of
    a merged PR at a moment of its own, so a delete that fails for a branch that is gone is the
    result that the script wants. A delete that fails for another cause stops the script: the
    branch is still on `origin`, or `origin` does not answer the read after the delete.
  - Each exit with a failure after the line `land: #<n> is on <trunk>` has the status 1 and
    prints one more `land:` line, which says that the change is on the trunk, that the removal of
    the lane branch stopped, and that the reader must run `scripts/land.sh` again.
  - A refusal prints one line that starts with `land: `, exits 1, and leaves the trunk, the lane
    branch, and the worktree as they were; with `pr`, the pushed branch and the open PR stay.
    With `merge`, two exits with the status 1 come after the push of the trunk: the main checkout
    did not move, or the issue did not close. Each says that the change is on the trunk and that
    the reader must run the script again. A usage error and a bad `landing.json` exit 2. No
    message names the path of the promote script, so a session can quote each message in a
    command.
- **The build step lands the change that it built.** `/implement` and `/chore` end with the
  script, and `/hotfix` lands through its `implement` run. Land takes the place of the
  branch-finish step of the base skill of `implement`. The session leaves the worktree and runs the
  script from the main checkout, as a background command. When the script refuses for a cause that
  the change made (a check that fails on the diff, a conflict with the trunk, a branch that does
  not contain the trunk head), the session fixes the cause and lands again; `/implement` fixes it
  through its task loop. The session stops at its third refusal, and at once for a cause outside
  the change. A build step stops before the landing only for a human precondition. No step stops
  at an open PR that waits for another step.
- **The issue holds the marks of a landing.** *Built* is a `## Plan` comment with no
  `ready-for-agent` label: `implement` clears the label before it lands. A comment headed
  `## Before landing` names a human precondition, and the issue carries `ready-for-human` until the
  maintainer did the act; in this repository the act is a new environment variable on the staging
  stack. A comment headed `## Landing refused` holds the output of the script at a stop. A new run
  of the build step on a built issue does not build again: it reads the latest `## Landing refused`
  comment, handles its cause, and lands. `/chore` has no plan: its built mark is the commit of the
  chore on a clean lane branch.
- **A closed issue that is not `wontfix` is finished.** `/finish` goes: the skill, its gate, its
  stage and its track step on the board, and each `run /finish` line of the resolver. The resolver
  has no landing state: an issue with an open lane PR resolves by its labels to its build step.
  Nothing posts or reads a `Walkthrough passed` comment.
- **The script closes an epic with its last sub-issue**, with a comment, when the issue has a
  parent and each other sub-issue of that parent is closed. A failure of that close does not fail
  the landing: the script prints it.
- **A lock holds the step end while the script runs.** The script writes its PID to
  `<git common dir>/agent-flow/land-<n>.lock` and removes the file when it exits. While a live
  `land.sh` holds the lock, `next-step.sh <n>` and `next-step.sh --open` print
  `stop the landing of #<n> runs; wait until scripts/land.sh ends` for that issue. The line does
  not start with `stop #<n> `, so the step-end rule of `scripts/agent-flow.sh` (ADR-0011) stays as
  it is and types no `/exit`. `--json` does not read the lock: an issue that lands has a live
  session, and the card of the session wins.

Seven rules of the skills are not in the spec of #415:

- **Re-entry after a cause outside the change.** When the `## Landing refused` comment names a
  cause outside the change and the trunk now holds the fix of that cause, the new run fetches the
  trunk, merges it into the branch, and runs the gate, so that the checks run on a new head.
  `scripts/land.sh` starts no check run.
- **A fix on re-entry has a task loop.** It uses the task loop of the base skill of `implement`,
  with the fix as its one task.
- **The hotfix terminal has three forms**, named by what the issue shows: the fix landed; the
  landing stopped with a `## Landing refused` comment; the landing stopped with a
  `## Before landing` comment. In the second and the third form the maintainer runs
  `scripts/land.sh` in their own shell. The micro-plan of a hotfix is a local file, so the re-entry
  rule of `implement` does not apply to it.
- **A lane with one commit lands with the subject of that commit.** The Land step passes that
  subject to the script, because GitHub takes the squash subject of a PR with one commit from the
  commit (Consequences).
- **A stop after the landing is no refusal.** A `land:` line that says
  `run scripts/land.sh again` means that the change is on the trunk: the removal of the lane
  stopped, or, with `merge`, the main checkout did not move or the issue did not close. The
  session does what the line says and runs the script again, and the limit of three refusals does
  not count it. A second stop with the same line is a cause outside the change: the session stops
  with a `## Landing refused` comment.
- **An error that the session caused is no refusal.** Exit 2 with the usage line, a run from
  inside the lane worktree, and a lane worktree that is dirty are errors of the session. The
  session corrects the error and runs the script again, and the limit of three refusals does not
  count it.
- **The session of a chore makes the fix for a refusal itself.** The task loop of the Land step
  names an implementer and a task review, and the chore lane has neither.

The other acts of `/finish` have these homes. `/promote-preview` waits for staging with
`scripts/wait-for-staging.sh` before it touches staging. The Verify phase of `/implement` runs the
`polish` command of `impeccable` for a UI change, on the local runtime. The check that a new
environment variable is set on staging is the human precondition of Land.

## Alternatives considered

- **A resolver line for "PR open".** A `merge` repository never has that state, so the flow would
  differ by mechanism.
- **A thin `/land` step.** It keeps the second session, which has none of the context of the
  build.
- **The `mergeable` field of GitHub for a conflict.** It is not known for a new PR, and a PR with a
  conflict gets no check run, so the script would wait 15 minutes. `git merge-tree` gives the
  answer before the push.

ADR-0007 rejected "a merge at the end of `/implement`" for three reasons. Each has an answer:

- *The session that wrote the code would land it.* The script decides by the checks, not the
  session. `/finish` applied the same merge rule and added no review.
- *The resolver could not see the state "PR open".* It does not need that state: the build step is
  re-entrant.
- *A card that a human moves back to Run after a fix would have no step that lands the PR.* Run
  starts the build step, and its re-entry rule lands the change.

## Consequences

- One session builds the change and lands it, and it fixes a refusal with the context of the
  build. A lane has one step less: the runner loses the `finish` gate, and the board loses the
  Finish stage and the `finish` track step.
- With the default gates, the Run press of `finish` was a stop of the maintainer between a built
  change and the trunk. No gate holds a built change now: the press that starts the build step
  also lands the change when its checks are green.
- No issue has a staging walk. A defect that only staging shows is found at `/promote-preview`, in
  a batch.
- A fix for a refused landing gets the gate, a task review, and CI, but no second whole-branch
  review.
- The judgment "a cause that the change made" is the agent's. An agent can take an outside cause
  for its own and change files that the plan does not name. The task review of the fix and the
  limit of three refusals bound it. The rule of ADR-0007 stays: a red `security` job on an upstream
  advisory stops the landing until a person or a chore handles it.
- With `pr`, a lane with one commit lands with the subject of its commit, which has no ` (#<n>)`:
  GitHub adds only the number of the PR. The script merges with no `--subject`, as
  `scripts/merge-pr.sh` did. So its subject argument is the title of a PR that the script opens,
  and GitHub takes the squash subject from it only for a PR with two or more commits. For a lane
  with one commit, the Land step passes the subject of that commit, so the two agree. With
  `merge`, the argument is the subject of the squash commit.
- `merge` ran only in a fixture test in this repository. Its first real use is in another
  repository, where its refusals meet real state for the first time. A refusal there leaves the
  trunk as it was. The two exits after the push of the trunk do not: the change is then on the
  trunk of `origin`, and a second run of the script completes the landing.
- **The end of the hold is an unverified premise.** The tests show that the job types no `/exit`
  while the lock is held. After the script ends, the job types `/exit` only when the agent works
  again. That needs a new turn of Claude Code at the end of the background command, and herdr must
  read that turn as `working`. No fixture test and no step of the Verify phase of #415 shows it.
  If the premise is false, a session stays open after its landing, and the maintainer leaves it
  with `/exit`.
- It is not known whether the exit of a session stops its background command. After the merge the
  issue is closed, the resolver prints `stop #<n> is finished`, and neither Run nor
  `scripts/agent-flow.sh <n>` starts a step: the lane worktree and the branch stay, and nothing
  shows them. So a person who leaves a session during a landing runs
  `scripts/land.sh <n> '<subject>'` again from the main checkout, which completes the landing, or
  `scripts/worktree.sh --remove <n>` after the merge of the PR. While the script runs, the board
  shows its session in Needs you as `turn ended`, as it shows a session that waits for nothing.
- Apart from the number of this record, the spec on #415 differs from it in three places. The spec
  names the removal of the lane before the close of the epic, and the script closes the epic first,
  because the local lane branch must go last. The spec selects a PR only by a lane branch name,
  and the script also takes only a PR whose base is the trunk. The spec does not hold the seven
  rules above, or the sentence that Land takes the place of the branch-finish step: the controller
  of the #415 build added them after the reviews of the build.
- #415 itself lands by the flow that `master` has, with `/finish`, because the skills of a step
  session come from the main checkout. So its own landing does not prove the new flow, and the
  first merge by `scripts/land.sh` on the real GitHub is that of a later issue. If it fails for a
  defect of the script, the maintainer merges that PR by hand, and the defect is a `/bug`.
- An issue that has an open lane PR when this lands resolves to its build step. `/implement` finds
  a `## Plan` comment and no `ready-for-agent` label, because the old flow removed the label when
  the PR opened, so it lands the PR and builds nothing. `/chore` finds its commit on a clean
  branch, runs the gate, and lands.
- Each closed issue with no walkthrough comment changes from `run /finish` to finished, with no
  walk.
- The maintainer closes the epics #13 and #401 by hand, once: each of their sub-issues is closed,
  so no landing closes them. A git config value `agent-flow.gate.finish` on a machine has no
  effect.

## Reconsider when

- A defect reaches production that the staging walk of an issue would have found.
- An agent changes files outside its plan to turn a refusal green.
- herdr reads an agent that waits for a background command as `working`. The lock is then not
  needed.
- A session stays open after its landing ended: the premise on the end of the hold is then false,
  and the step end needs another signal.
- A repository needs a third mechanism, or another tracker than GitHub.
- GitHub closes a parent issue with its last sub-issue. The script then closes no epic.
- The repository changes `squash_merge_commit_title`, or a reader of the trunk needs the issue
  number in each squash subject. The script then sets the subject of the merge.
