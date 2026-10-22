# A landing re-runs a failed check of GitHub Actions once before it refuses

## Date

2026-10-22

## Related

- ddinkov10/celetis#87: the spec of this change, and its plan, which holds the live proof of two
  re-runs.
- ddinkov10/celetis#41 and ddinkov10/celetis#67: two landings that a random failure refused. From
  PR open to merge took 453 min (#41) and 343 min (#67).
- ddinkov10/celetis#49, ddinkov10/celetis#73, and ddinkov10/celetis#86: fixes of random failures of
  `tests/celetis-flow.test.sh`.
- ddinkov10/celetis#83: the CI of the lane PR is the only run of the full suite in a lane
  (ADR-0022).
- ADR-0001: the merge rule. Its "Reconsider when" names "a check is flaky". ADR-0008: the build
  step lands the change. This record changes one clause of ADR-0008 (Supersedes).
- `scripts/land.sh`, `tests/land.test.sh`, `docs/hosts/claude.md`, `docs/hosts/codex.md`, and Land
  step 3 of `skills/implement/SKILL.md`.

## Supersedes

From ADR-0008, "The build step lands the change, by the mechanism that the repository names", the
clause "it waits up to 15 minutes for the checks" of the landing `pr`. When the first wait ends on a
red check that GitHub can re-run, the script re-runs the check once, and then it waits up to 15 more
minutes. The rest of that sentence, the merge rule of ADR-0001, stands: the script squash-merges
only at the commit that the checks ran on, and only when each check passed or was skipped and at
least one check passed. This record changes no other part of ADR-0008.

## Context

The maintainer said: "every issue implementation and verification takes too much time this is fast
moving project i cant allow that".

With the landing `pr`, `scripts/land.sh` refused the landing at the first red check. So a check
that failed at random cost a whole refusal: the session posted `## Landing refused`, the issue got
`ready-for-human`, and the lane waited for a human. The landings of #41 and #67 were refused
because `tests/celetis-flow.test.sh` failed at random on CI, about 20 s into the run. #49, #73, and
#86 fixed random failures of that test, but a new random failure in any test can still refuse a
landing. After #83, the CI of the lane PR is the only run of the full suite in a lane, so no
earlier run catches a random failure.

ADR-0001 names a flaky check as a reason to reconsider its merge rule. This record keeps the rule,
and it gives a failed check one re-run before the refusal.

## Constraints and evidence

- GitHub REST API: `POST repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs` re-runs the
  failed jobs of a workflow run and the jobs that depend on them, and it answers 201.
  `POST …/check-runs/{check_run_id}/rerequest` only sends a webhook: "The check run itself is not
  updated." `GET …/commits/{ref}/check-runs` takes `filter`, `latest` (the default) or `all`.
  Source: github/rest-api-description, `descriptions/api.github.com/api.github.com.json`.
- GitHub Actions: a workflow run can be re-run up to 30 days after its first run, and at most 50
  times. A re-run uses the same `GITHUB_SHA` and `GITHUB_REF`. A run of a disabled workflow cannot
  be re-run. Source: github/docs,
  `content/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs.md`.
- Before the live proof below, no CI run of this repository was re-run: `run_attempt` was 1 on each
  of 18 PR runs (#30 to #77, read through the REST API on 2026-10-21).
- The live proof, in this repository on 2026-10-21, with gh 2.89.0 and a throwaway workflow with a
  job that fails when `GITHUB_RUN_ATTEMPT` is 1:
  - Workflow run 39694064154: `rerun-failed-jobs` answered `201 Created` with the body `{}` and the
    header `X-Accepted-Github-Permissions: actions=write`. 0.8 s later, the default check list was
    empty, and the run read `run_attempt` 1 and `status` `queued`. 1.8 s later, the list held a new
    check run (a new `id`, `queued`), and the run read `run_attempt` 2.
  - Workflow run 39694378726, with the jobs `ok`, `test`, and `after` (`needs: test`): after the
    re-run call, the list was empty. Then it held `ok` (a new id, `success`) and `test` (a new id,
    `queued`). It held `after` only after `test` passed, so for some seconds the list was all green
    while the re-run still ran. The run read `status` `completed` only after its last job.
  - In attempt 1 of workflow run 39694378726, `ok` and `test` were created at 23:35:22Z. `test`
    ended with `failure` at 23:35:28Z, and GitHub created `after` in that same second, as
    `skipped`. So a first attempt also lists a job with `needs` only when that need ends, and for
    a moment the list can show no pending check while the workflow run still runs. Read with
    `gh api 'repos/{owner}/{repo}/actions/runs/39694378726/attempts/1/jobs'` on 2026-10-22.
  - At the end, the default list (`filter=latest`) held only the check runs of attempt 2, and
    `filter=all` held the check runs of both attempts. The workflow run id and the check suite id
    stayed the same.
  - The `details_url` of the failed check run of attempt 1 stays valid after the re-run:
    `GET actions/jobs/119547037125` reads `run_attempt` 1 and `conclusion` `failure`.
- GitHub refuses a re-run of a workflow run that still runs: "This workflow is already running", as
  reported in https://github.com/orgs/community/discussions/67654. This repository did not test it
  live.
- `GET repos/{owner}/{repo}/actions/runs?head_sha=<tip>` finds the workflow run of a PR head. The
  `check_suite_id` 107558474680 of the `pull_request` run 39687075224 is the `check_suite.id` of
  the check run `test` of PR #86 (app `github-actions`, read on 2026-10-21).
- Claude Code 2.1.307: in a session that runs unattended, such as a `-p` run, an Agent SDK
  application, a CI job, or a cloud session, a background command gets 30 minutes, or the `timeout`
  that Claude passes with `run_in_background`, up to a maximum of 2 hours. A local session in a
  terminal, the desktop app, or the VS Code extension has no time limit on background commands.
  Source: https://code.claude.com/docs/en/tools-reference, "Time limit for background commands".
- Codex CLI 0.162.1: `exec_command` yields and keeps the process, and no code ends a unified-exec
  process by its age. A process is pruned only when 64 exist, and the 8 most recently used are
  protected. Source: `codex-rs/core/src/unified_exec/mod.rs` and `process_manager.rs` at
  `rust-v0.162.1`.

## Decision

**Only the landing `pr`, only `scripts/land.sh`.** The landing `merge` has no checks. No skill
decides a re-run: the script decides it, as it decides the merge (ADR-0008). The merge rule of
ADR-0001 stands.

**The conditions of a re-run.** When a poll of the first wait finds no pending check and a red
check, the script reads the check runs, the commit statuses, and the workflow runs of the tip. It
re-runs only when each of these conditions holds:

- Each red check is a check run of GitHub Actions (app `github-actions`) with the conclusion
  `failure` or `timed_out`.
- No commit status is red.
- The workflow run of each red check run reads `run_attempt` 1.
- The workflow run of each red check run reads `status` `completed`.

When one of the first three conditions does not hold, the script refuses at once, with the same
line as before this change: a `cancelled` or `action_required` check, a red commit status, a red
check of another app, or a workflow run at attempt 2 or more. When only the last condition does not
hold, the script posts nothing and counts the poll as pending, within the same 60 polls of the
first wait, and the next red poll decides again. GitHub refuses a re-run of a workflow run that
still runs, and such a run can still add a job with `needs`. GitHub cannot re-run a commit status
or a check run of another app. A
`cancelled` check did not run to its end, for example because a person or a newer run stopped it,
and an `action_required` check waits for an approval. So a re-run of either of these two does not
tell whether a failure was random.

**One call for each workflow run.** The script finds the workflow run of each red check run by its
check suite: the `check_suite.id` of the check run is the `check_suite_id` of the workflow run. It
posts `rerun-failed-jobs` once for each workflow run that holds a red check run, so two red jobs
of one run get one call. GitHub re-runs the failed jobs and the jobs that depend on them, on the
same commit.

**The workflow run gates the second wait.** The script prints
`Waiting up to 15 more minutes for the re-run of the failed checks of PR #<pr> at <tip>` and polls
again, up to 60 times. A poll counts the checks as pending until each re-run workflow run reads
`run_attempt` 2 or more and `status` `completed`. Only then does the check list decide, as in the
first wait. Right after the re-run call, the list can be empty or show only the jobs that passed,
and such a list can read green.

**`run_attempt` is the count.** The script keeps no state: no file, no git config, and no comment
counts a re-run. A workflow run at attempt 2 or more gets no re-run. So after a re-run call that
GitHub accepted, a later run of the script on the same tip re-runs nothing, and a re-run that the
maintainer started by hand counts too. A new
commit gets new workflow runs at attempt 1, so it gets its own one re-run.

**The lines.** Each refusal still prints exactly one line that starts with `land: ` and exits 1. It
leaves the trunk, the lane branch, the worktree, the pushed branch, and the open PR as they were.

- A red check after the re-run:
  `land: PR #<pr> has a check that is not green after the re-run (<buckets>): <url>`.
- A re-run call that GitHub refuses: the error of `gh`, then
  `land: GitHub refused the re-run of the failed checks of PR #<pr>: <url>`.
- A first wait that runs out while the workflow run of a red check run is not `completed`:
  `land: the checks of PR #<pr> did not finish in 15 minutes (the workflow run of a failed check is not done): <url>`.
- A second wait that runs out:
  `land: the checks of PR #<pr> did not finish in 15 minutes after the re-run (<buckets>): <url>`.
  While a re-run workflow run is not done, `<buckets>` is `the re-run is not done`.
- A red check that gets no re-run keeps its line:
  `land: PR #<pr> has a check that is not green (<buckets>): <url>`.

After the merge call succeeds, the script prints one line for each re-run check run:
`land: the check <name> of PR #<pr> failed, then passed on its re-run; look for a flaky test: <details_url>`.
The name and the URL are those of the failed check run of attempt 1, so the URL opens the log of
the failed attempt. Land step 3 of `implement` names each such `land:` line of an exit 0 an act of
the maintainer, which the session quotes verbatim in its last message. So no skill rule changes for
this line.

**The host waits.** A landing can now last more than 30 minutes. On Claude Code, the session runs
`land` with `run_in_background` and a `timeout` of `3600000` (60 minutes), because an unattended
session stops a background command at 30 minutes when no `timeout` is given. On Codex, the session
keeps polling the command with `write_stdin` until it exits: Codex ends no process by its age.

## Alternatives considered

- **The check list with the old-id rule** (point 4 of "Design shape" in the spec): the script keeps
  the id of each failed check run that it re-ran, and it counts that check as pending while the list
  still shows that id. Rejected by the live proof: right after the re-run call, the list was empty,
  not the old red check run, and later it was all green for some seconds while the re-run still
  ran. The rule does not stop a merge in that window. The spec named the read of the workflow run
  as the fallback in its Risks.
- **`POST …/check-runs/{check_run_id}/rerequest`.** Rejected: it only sends a webhook, and the
  check run itself is not updated. The app decides what to do, so the script cannot count on a new
  result.
- **`POST …/actions/runs/{run_id}/rerun`, a re-run of the whole workflow run.** Rejected: it
  re-runs the jobs that passed too.
- **A state file of the script that counts the re-runs.** Rejected: GitHub counts already. The
  `run_attempt` of a workflow run also counts a re-run by hand and a re-run from another machine,
  and a file of one machine sees neither.
- **A comment or an issue for a flaky check.** Rejected: the issue closes with the merge, and the
  board shows no card for a finished issue, so a comment reaches the maintainer no better than the
  last message of the step. No issue opens by itself for a flaky test: the `land:` line names the
  check, and GitHub keeps the failed attempt in the history of the run.
- **No re-run, and a fix of each flaky test only.** Rejected: #49, #73, and #86 fixed random
  failures of one test, one after another, and a new random failure can come in any test.

## Consequences

- A check of GitHub Actions that fails at random and passes on its re-run no longer refuses a
  landing, and its `land:` line tells the maintainer which check failed once.
- A landing can last up to about 37 minutes. Each of the two waits is up to 60 polls with a sleep
  of 15 s after each poll, so the two waits sleep 30 minutes, and the calls of each poll add the
  rest.
- A red check that is not random, such as a `security` job on an upstream advisory (ADR-0001), now
  refuses one re-run later, after up to 15 more minutes of wait.
- A token without the write right to Actions gets the "GitHub refused" line, and no landing. After
  that refusal, the workflow run stays at attempt 1, so a later run of the script posts the re-run
  again.
- A second run of the script on the same tip, while a re-run that an earlier run started still
  runs, starts with no re-run of its own to wait for: its first wait reads only the check list, as
  before this change. So, as in the live proof, it can read the list as green while a job that
  `needs` a re-run job is not listed yet.
- The report line comes only from the run that merges. When the removal stops after the merge, the
  session runs the script again, and that second run completes the landing with no report line.
  The line is then only in the output of the first run.
- In attempt 1 and in attempt 2, GitHub listed the check run of a job with `needs` only when the
  job that it needs ended. So the first wait can read a green list before such a job is listed, as
  before this change. With a red check, the script waits for the completed workflow run before it
  decides on a re-run.
- A product project whose CI matrix keeps GitHub's default `fail-fast: true` can get `cancelled`
  sibling jobs after one failed job: GitHub cancels only the matrix jobs that are still queued or
  running. A `cancelled` check gets no re-run, so that project gets the same refusal as before this
  change. This repository sets `fail-fast: false`.

## Reconsider when

- GitHub changes what `filter=latest` lists after a re-run, or what `rerun-failed-jobs` re-runs.
- A project needs a re-run of a check of another app.
- One re-run is not enough: a check fails again on its re-run, and a re-run by hand then passes.
- The report lines name the same test again and again.
- Claude Code lowers the maximum `timeout` of a background command (2 hours in 2.1.307) below the
  `3600000` (60 minutes) that the session passes, or Codex ends a process by its age.
