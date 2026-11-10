# A workflow run with no check run is a check of the pr landing

## Date

2026-11-10

## Related

- [Issue #280](https://github.com/ddinkov10/celetis/issues/280): the intent; the
  [`## Root cause` report](https://github.com/ddinkov10/celetis/issues/280#issuecomment-6774154044), with the
  red repro, the table "States", the external facts, the prior art, and the decision of the maintainer; and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/280#issuecomment-6774779013). In this record, a
  name in code form such as `pseudo` or `late` is a fixture of that plan: real answers of GitHub for one commit,
  with the one changed value that the plan names. The runtime report of #280 holds the result of each fixture.
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195) (finding F8) and
  [issue #256](https://github.com/ddinkov10/celetis/issues/256) (its spec section "The `startup_failure` premise
  of #195"): the finding that #280 comes from.
- [ADR-0001](0001-agents-merge-lane-prs.md) and [ADR-0008](0008-the-build-step-lands-the-change.md): the merge
  rule stands. The landing `pr` merges only when each check passed or was skipped and at least one check passed.
  "A check" now also means a workflow run of the table in the Decision.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [A landing re-runs a failed check of GitHub Actions once before it refuses](0023-a-landing-re-runs-a-failed-check-once.md):
  - "The conditions of a re-run": "When a poll of the first wait finds no pending check and a red check, the
    script reads the check runs, the commit statuses, and the workflow runs of the tip." A poll with no pending
    check and a red workflow run refuses at once, before it reads these conditions. So a red workflow run gets no
    re-run, and no check gets a re-run while a workflow run is red.
  - "The workflow run gates the second wait": "Only then does the check list decide, as in the first wait." The
    check list and the workflow runs decide, in the first wait, in the second wait, and in the last check before
    the merge.
  - "The lines": the list has one more refusal line, the line of the Decision.
- [Every GitHub call of the engine goes through the tracker port](0082-every-github-call-goes-through-the-tracker-port.md):
  - Decision: "One function, `bucket`, maps a check run or a commit status to one of the five buckets of
    `gh pr checks`. The board and the landing both use it. This is the one red-check rule." The rule has a second
    function, `runBucket`, for a workflow run. The two functions share the one table from a conclusion to a
    bucket. Only the landing calls `runBucket`.
  - Consequences: "The board and the landing cannot disagree on the colour of a check." They agree on each check
    run and each commit status. The board reads no workflow run, so it can show `pass`, or no value, for a PR that
    the landing refuses.

## Context

`green` in `engine/lib/landing-pr.ts` took the color of a PR head only from the check runs and the commit
statuses of the tip. It read the workflow runs too, but only their `status`: the tracker port dropped the
`conclusion`. GitHub makes no check run for a workflow run that fails to start. So the landing read such a head as
green when other checks passed, and it merged the PR. When the run was the only workflow of the head, the landing
waited 15 minutes and ended `blocked` with `no check runs`. The red repro of the report shows both results with
the real answers of GitHub.

## Constraints and evidence

The report holds the source of each fact (its "External facts", observed 2026-11-10).

- `actions/runs?head_sha=<sha>` lists a workflow run that failed to start with `status` `completed` and
  `conclusion` `startup_failure`. Such a run can have no job, and then `commits/<sha>/check-runs` holds no check
  run of its check suite.
- A `startup_failure` run can also hold check runs, and they can be `success`.
- `commits/<sha>/check-runs` holds the check runs of each check suite of the commit. So "no check run of the list
  has the suite of the run" means that the run made no check run.
- A run with `failure`, `action_required`, or `cancelled` and no check run exists. A run with `success` or
  `skipped` and no check run was not found in 240 runs.
- The `statusCheckRollup` of a commit does not show a workflow run that made no check run. So the refusal line
  must name the run and give its URL.
- A pseudo-run of a failed event has the name `""` and the path `BuildFailed`.
- `commits/<sha>/check-suites` holds a `queued` suite with no check run for each installed app, and suites with
  no workflow run.
- Each refusal of `land` prints exactly one line that starts with `land: ` (ADR-0023). Each GitHub read goes
  through `engine/lib/tracker.ts`, and a parser requires only the fields that a caller reads (ADR-0082).
- No landing ran against a real PR: this repository has the landing `merge`. The proof is the fixtures of the plan.

## Decision

1. **The port.** A `WorkflowRun` of `engine/lib/tracker.ts` has the conclusion (`null` for a run that is not
   `completed`), the name, and the URL of the run. The name is the path of the run when its name is `null` or
   empty (`row-noname`, `pseudo`). A run with no URL makes the read of the runs fail, and the poll is then pending, as for each other
   response that a parser refuses (`row-nourl`).
2. **The rule.** `runBucket` gives the bucket that a workflow run of the tip adds in each poll of `green`. The
   first row that matches decides:

   | The workflow run | Bucket |
   | --- | --- |
   | Its `status` is not `completed` | none |
   | Its `conclusion` is `startup_failure` | `fail` |
   | A check run of the tip has the check suite of the run | none |
   | Its `conclusion` is `failure`, `timed_out`, or `action_required` | `fail` |
   | Its `conclusion` is `cancelled` | `cancel` |
   | Its `conclusion` is `success`, `neutral`, or `skipped` | none |
   | Each other conclusion, for example `stale` | `pending` |

   The last four rows follow the table of `bucket` for a completed check run, with no bucket where that table
   gives `pass` or `skipping`. A workflow run adds no green: a green
   needs a check run or a commit status. This is the answer of the maintainer of 2026-11-10, "Each not-green
   conclusion" (the report, "The decision of the maintainer").
3. **The refusal.** A `pending` bucket keeps the wait, as before. At the first poll with no `pending` bucket and
   one or more workflow runs with `fail` or `cancel`, `land` exits 5 (`checks`) with this one line:
   `land: checks: PR #<pr> has a workflow run that is not green (<name>: <conclusion>[, <name>: <conclusion>]…): <url of the first such run>`.
   The runs are in the order of the list of GitHub. The refusal comes before the decision on a re-run, so a red
   workflow run gets no re-run (`red-rerun`), and the landing sends no merge call.
4. **The read.** The rule uses `actions/runs?head_sha=<sha>`, which `green` read already. It adds no call.

## Alternatives considered

- **Only `startup_failure`.** A run with `failure` or `action_required` and no check run would stay unseen. The
  maintainer did not choose it.
- **Each not-green conclusion except `cancelled`.** A cancelled check run refuses the landing already (ADR-0023),
  and a cancelled workflow run did not run to its end either. The maintainer did not choose it.
- **A list of required check names**, the pattern of GitHub required status checks. It also blocks when a
  workflow makes no run at all. It is a new field of `.celetis.yaml` and a choice for each product project, so it
  is a feature with its own spec.
- **The read `commits/<sha>/check-suites`.** Its answer holds suites that no workflow run made, and a `queued`
  suite for each installed app.
- **A re-run of a red workflow run.** ADR-0023 re-runs only a check run of GitHub Actions with `failure` or
  `timed_out`, and each other red check refuses at once. GitHub cannot re-run a pseudo-run.
- **The same rule on the board.** #280 names only the landing, and the rule costs one more read for each open PR.

## Consequences

- A PR head whose workflow run failed to start does not merge, and the landing refuses it in the first poll with
  no pending check (`only`, `mixed`).
- A head with a `BuildFailed` pseudo-run is refused, also when the real workflows passed later on the same head
  (`pseudo`). A new commit on the lane gives a new head.
- While a check of the head is pending, a red workflow run does not refuse: the landing waits (`pending`).
- A project whose workflows cancel a duplicate run before its first job cannot land that head (`row-cancelled`).
- A workflow that makes no run for the head stays unseen (`plain`).
- The board shows `pass`, or no value, for a PR that the landing refuses (the board value of `mixed` and of `only`).
  `plugins/celetis/docs/workflow.md`, "Limits", states it.
- A run that comes into the list after the first green poll is seen by the last check before the merge (`late`).
  A run that comes after that check is not seen.

## Reconsider when

- GitHub makes a check run for a workflow that fails to start.
- A product project needs a duplicate run that a newer run cancels before its first job.
- The board must show the color of the landing.
- A product project wants a list of required check names.
