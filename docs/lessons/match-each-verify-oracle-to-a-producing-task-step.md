---
{
  "schema": 1,
  "name": "match-each-verify-oracle-to-a-producing-task-step",
  "description": "A Verify oracle covered focused cards while the task step gave only the group row a scroll margin, and the pre-flight scan passed it",
  "tags": [
    "process",
    "ui",
    "false-negative"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Implementation of ddinkov10/celetis#270, Verify V6 and fix task verify-1",
  "incidents": [
    {
      "id": "b7c4f40d-8520-42f4-aacd-c4182711472f",
      "date": "2026-11-05",
      "action": "The implement coordinator of #270 ran the pre-flight scan of the plan and recorded every task 'consistent'. Task 2 Step 7 gave a scroll-margin only to the group row; V6 required 'each focused row and card partly visible between the bottom of .top and the top of .statusbar'.",
      "expected": "The pre-flight scan finds each Verify oracle element that no task step produces, and rules on it before the build.",
      "observed": "V6 failed after the final review: at 375x812 the k path left 8 child cards fully behind .top (4 at 1200x650); the base build had the same fault. Fix task verify-1 (1ab9379) gave .card the row scroll margin.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Verify report: 'k path: 8 child cards (k-241,242,255,256,260,261,265,266) end fully behind .top. Same on no-epics board and on base build'. Ledger pre-flight table: 'T2 self | ... | consistent'.",
        "reference": "ddinkov10/celetis#270 runtime report"
      },
      "inference": "Inferred: the pre-flight scan compared tasks with each other and with Global Constraints, but not each Verify oracle with the task steps that produce its behavior. The plan's acceptance table mapped the row rule to Task 2 and V6 without noting that V6 also covers pre-existing cards. Alternative: the oracle was meant for rows only and the card clause was an overreach.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "6e084fe"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "1d333810-0062-4b14-8ddb-5bee8cd77c00",
      "requestDigest": "c64ae3722d3910d82032bcf3fcc7c02a217d26cf8d520b364695880428f3d2a0",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #270; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed: the Verify report names 8 child cards behind .top on the k path, and fix commit 1ab9379 moves the scroll margin into one rule for .card and .epic-row in engine/board/board.css. The rule adds a check to the pre-flight scan; it widens no permission, weakens no check or gate, and contradicts no skill or principle: the upstream pre-flight scan compares tasks with each other, and the acceptance coverage procedure of the plugin celetis maps criteria at plan time. No active or historical lesson states this rule. The text keeps the inferred cause and its alternative apart from the facts and states applicability, action, and check.",
      "related": [
        "match-each-verify-oracle-to-a-producing-task-step"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A pre-flight table row per Verify scenario that maps each oracle element to its producing task step; it needs separate authorization."
      }
    }
  ]
}
---
# Match each Verify oracle element to a task step that produces it

## What happened

The #270 plan's V6 required each focused row and card on the j/k path to stay clear of the sticky header. Task 2 gave only the group row a scroll margin. The pre-flight scan of implement recorded each task as consistent. V6 failed after the final review on pre-existing cards, and a verify-1 fix task added the margin to cards.

## Root cause

Inferred: the pre-flight scan checks task pairs and Global Constraints, not Verify oracles against task steps. Uncertain whether the plan meant the card clause.

## Fix

Proposed prevention, not proven enforcement: in the pre-flight scan, list each Verify oracle line and the task step that produces each element it names. An element with no producing step gets a ruling before Task 1: add it to a task, or record that the oracle excludes it. A structural follow-up needs separate authorization: a pre-flight table row per Verify scenario. Judgment maps behaviors to steps, so the rule stays text.

## Rule

Applies when an implement session runs the pre-flight scan of a plan with Verify scenarios. Action: for each oracle line, name the task step that produces each element it checks, including pre-existing elements it covers. Check: the pre-flight table has a row per Verify scenario, and each element has a producing step or a recorded ruling.
