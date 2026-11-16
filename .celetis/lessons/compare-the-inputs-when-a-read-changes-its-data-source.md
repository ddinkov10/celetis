---
{
  "schema": 1,
  "name": "compare-the-inputs-when-a-read-changes-its-data-source",
  "description": "A GraphQL replacement of REST check reads matched on the derived check result, while the rollup source left out a whole class of check runs that REST lists",
  "tags": [
    "api",
    "false-negative",
    "test"
  ],
  "date": "2026-11-15",
  "status": "active",
  "source": "The implement session of #329 on Claude Code, final whole-branch review, 2026-11-15",
  "incidents": [
    {
      "id": "fd20a039-4996-4211-b6e4-a59d10f6923d",
      "date": "2026-11-15",
      "action": "Task 2 of #329 mapped Commit.statusCheckRollup.contexts to the CheckRun and CommitStatus inputs of bucket() in place of REST commits/<sha>/check-runs plus commits/<sha>/status, and the plan's V3 oracle compared only the derived checks and review values per PR.",
      "expected": "A read that moves to a new data source gives the same input records as the old source for each case, so a derived value stays equal in every state of those records, not only in the observed states.",
      "observed": "On 20 open cli/cli PRs the derived checks value was equal on all 20, but the bucket multisets differed on 13: the rollup had no copilot-pull-request-reviewer check run. A pending or failing run of that class would give pass on the tip and pending or fail on the base.",
      "source": {
        "kind": "tool-output",
        "excerpt": "20 pulls 20 equal 1942 ms\n[]\nraw bucket differences [15052,15049,15048,14927,14926,14925,14924,14923,14922,14921,14920,14679,14259]",
        "reference": "https://github.com/ddinkov10/celetis/issues/329"
      },
      "inference": "Inferred: the oracle compared a derived value that hides input differences, because the missing runs had passed and a pass bucket does not change checkResult. Not checked: why the rollup omits the Copilot review check suite. Alternative: the plan named the rollup equality as unsettled and gave V3 to decide it, so the gap was in the V3 oracle, not in the build.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "7c89dc6"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "80add2f3-3fbf-4d58-874e-56dac6d6ee1c",
      "requestDigest": "5b33a66347ed3a98a72c00bde669d304b8374ae5477dd8f672c417f300bbebe8",
      "date": "2026-11-16",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #329; claude child opus/high\n\nApprove: the proposal has observed tool-output evidence, keeps the inference apart from the facts, and states applicability, action, and check. It widens no permission, weakens no check or gate, and contradicts no instruction, skill, or principle (it is compatible with test-behavior-not-implementation: the compared records are the result of the replaced read). No live or historical lesson states the same rule: derive-plan-oracle-values-from-real-producers derives expected values from producers, and confirm-a-check-can-still-fail-after-its-input-moves keeps a check able to refuse; neither compares the input records of an old and a new data source.",
      "related": [
        "compare-the-inputs-when-a-read-changes-its-data-source"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule is judgment text for plans and probes of a source replacement; the lesson states why a structural check does not fit."
      }
    }
  ]
}
---
# Compare the inputs when a read changes its data source

## What happened

Task 2 of #329 replaced the REST check-runs and status reads of the board with `statusCheckRollup.contexts` in GraphQL. The plan's V3 oracle compared the derived `checks` value per PR. On 20 open cli/cli PRs the derived value was equal on all 20, but the input bucket multisets differed on 13: the rollup had no `copilot-pull-request-reviewer` check run. A query of `checkSuites` with `checkRuns(filterBy: {checkType: LATEST})` and `status.contexts` gave the same inputs as REST on 20 of 20 PRs.

## Root cause

Inferred: a derived value (`checkResult` of the buckets) hides input differences in states where the missing inputs do not change it. The observed PRs had only passed runs of the missing class, so the derived oracle passed. Not checked: why the rollup omits that check suite.

## Fix

Proposed prevention, as text: a plan or a probe of a source replacement compares the input records of both sources before the derived value. A structural check is not suitable, because the input set and its keys differ for each source.

## Rule

Applies when a change replaces the data source of a read (another API, endpoint, or query) and a check must show that the result stays equal. Action: compare the input records that both sources give for each case (as multisets, with the fields that the consumer reads), and then the derived value. Do not accept equality of a derived value alone as proof of equal inputs. Check: the check output shows the input comparison per case, and a control case with one known input class removed fails it.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]]
