---
{
  "schema": 1,
  "name": "compare-each-absence-oracle-with-the-text-that-the-tasks-write",
  "description": "A Verify grep oracle required no match of the old act form, while a task step of the same plan required two sentences that name that form, and the pre-flight scan passed it",
  "tags": [
    "process",
    "test",
    "false-positive"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of #290 on Claude Code, Verify V0 G1, 2026-11-11",
  "incidents": [
    {
      "id": "42169e6e-d290-4c94-abf1-32618558c139",
      "date": "2026-11-11",
      "action": "The plan of #290 gave V0 G1 the oracle 'this command prints nothing' for a grep of `Effort: <step> <level>`, while Task 2 Step 9 required issue-tracker.md and engine/README.md to say that a first line in the old form `Effort: <step> <level>` is no decision; the implement pre-flight scan (rows per Verify scenario) did not flag the conflict.",
      "expected": "An absence oracle that excludes the text that the plan's own task steps require, or a pre-flight ruling on the conflict.",
      "observed": "At Verify the grep printed 2 lines: plugins/celetis/docs/issue-tracker.md:120 and engine/README.md:70, both the required no-decision sentences; the coordinator recorded ruling R12 to grade G1.",
      "source": {
        "kind": "tool-output",
        "excerpt": "engine/README.md:70:\"Effort\"); a comment in the old form `Effort: <step> <level>` is no decision.",
        "reference": "https://github.com/ddinkov10/celetis/issues/290"
      },
      "inference": "match-each-verify-oracle-to-a-producing-task-step asks for the producing step of each element that an oracle checks; an absence oracle checks no element, so the scan named no producer and compared none. Alternative: the planner meant a narrower grep and wrote a wide pattern.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "aa0285d",
      "brief": "The ledger of the build (pre-flight table, row V0) named producers only for elements that the oracles check.",
      "lesson": {
        "name": "match-each-verify-oracle-to-a-producing-task-step",
        "revision": "630d7d0",
        "digest": "0ef44fa9aafda6777e8f3e06baa813f108fbea6f91cb1ab527db137c0701b719"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "da1cbc47-cb7c-427a-a702-ae4a5f96c89e",
      "requestDigest": "98fb55255eb48a337806be92bfe5656f840eb14d54c12e85016c6b6ce0175449",
      "date": "2026-11-11",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #290; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed: at Verify of #290 the grep of V0 G1 printed the two sentences that Task 2 Step 9 requires, at plugins/celetis/docs/issue-tracker.md:120 and engine/README.md:70. The rule adds a comparison to the pre-flight scan, widens no permission, weakens no check or gate, and contradicts no skill or principle. The active lesson match-each-verify-oracle-to-a-producing-task-step maps each element that an oracle checks to its producer; an absence oracle checks no element, so that rule does not state this one, and the two stay separate lessons at the same scan. The text keeps the inferred cause and its alternative apart from the facts and states applicability, action, and check.",
      "related": [
        "compare-each-absence-oracle-with-the-text-that-the-tasks-write"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text at plan time: a structural check needs the final text."
      }
    }
  ]
}
---
# Compare each absence oracle with the text that the tasks write

## What happened

V0 G1 of the plan of #290 expected a grep of `Effort: <step> <level>` over the documents to print nothing. Task 2 Step 9 of the same plan required two documents to say that a first line in the old form `Effort: <step> <level>` is no decision. At Verify the grep printed those two sentences. The pre-flight scan of the implement session had a row for V0 and named producers only for the elements that the oracles check.

## Root cause

Inferred: the rule `match-each-verify-oracle-to-a-producing-task-step` covers an oracle that checks an element; an absence oracle checks no element, so the scan had no producer to compare with it. Alternative: the planner meant a narrower pattern. The evidence does not settle which.

## Fix

Proposed prevention, text only: at the pre-flight scan, run each absence oracle (a search that must find nothing) against the text that the task steps require, and rule on each match before Task 1. A structural check needs the final text, so the rule stays text at plan time.

## Rule

Applies when a plan has a Verify oracle that requires the absence of a pattern (a search that prints nothing), and a task step of the same plan writes or keeps text in the searched files. Action: at the pre-flight scan, list each sentence that a task step requires in those files and compare it with the pattern; narrow the pattern or rule on each match before the first task. Check: the pre-flight table has, for each absence oracle, the required sentences that it was compared with and the result, and the Verify run of the oracle finds no match that the table does not name.

## Related lessons

[[match-each-verify-oracle-to-a-producing-task-step]]
