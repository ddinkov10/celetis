---
{
  "schema": 1,
  "name": "derive-plan-oracle-values-from-real-producers",
  "description": "A plan oracle gave a hand-derived Idle list and a dot trigger that the real producers do not produce",
  "tags": [
    "test",
    "process",
    "recurring"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Implementation of ddinkov10/celetis#270, Task 2 and Verify corrections",
  "incidents": [
    {
      "id": "61139222-0d92-4326-95e8-13b31e08abb7",
      "date": "2026-11-05",
      "action": "The #270 plan (comment 6668306212) gave the Task 2 Step 1 and V3 oracle 'Idle items #300, #280, #195 row, #240 row, #100, #55 row, #31, #9, #8' and 'The Idle count is 24', and its self-review says it traced each expected fixture state to its producer.",
      "expected": "Each expected oracle value comes from the real producer applied to the planned data set.",
      "observed": "The planned data set has #30 (open, no labels, no parent), which the board places in Idle between #31 and #9; the real Idle count is 25. The Task 2 implementer asserted the real data and reported the plan list as wrong.",
      "source": {
        "kind": "tool-output",
        "excerpt": "task-2 report: 'The brief lists Idle items without #30, and the count 24. The full dataset has #30 (no label, no parent) as an Idle card, so the true Idle count is 25'. kit make-data.ts:19 s.push({ n: 30, labels: [] }).",
        "reference": "ddinkov10/celetis#270 runtime report"
      },
      "inference": "Inferred: the plan derived the list by hand from its own data list and dropped the parent #30 of child #31. The rule of the related lesson governs fixture inputs and the check at execution, which caught the error; it does not ask the plan to compute expected values from the producers. Alternative: a one-off counting slip.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "92b91337586e0992316ac8835d10db28e6954d44",
      "brief": "Plan #270 Task 1 Lesson rules carry derive-fixture-state-from-real-producers sha256:fa0750b7…; Self-review record: 'The self-review traced each expected fixture state to its producer (decide, PLACERS, stages)'.",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "92b91337586e0992316ac8835d10db28e6954d44",
        "digest": "fa0750b7eb699d677cb04d9153641bf0226578b3d7e2c0b637ae867d2cecba2f"
      }
    },
    {
      "id": "0308c8da-20b5-4e20-b3db-6822577079fe",
      "date": "2026-11-05",
      "action": "The #270 plan Task 2 Step 9 checked the closed-row changed dot with 'a title change of a hidden child shows the row dot'.",
      "expected": "The probe changes an input that the existing changed-dot producer reads.",
      "observed": "The board changed dot comes from signature, which ignores the title, so a title change shows no dot; a step change (#254 gains bug) does.",
      "source": {
        "kind": "tool-output",
        "excerpt": "task-2 report: 'A title change alone does not show the row dot, because signature ignores the title. A step change (#254 gaining the label bug) does show it.'",
        "reference": "ddinkov10/celetis#270 runtime report"
      },
      "inference": "Inferred: the plan assumed which fields mark a card changed without reading signature. Same family as the first incident.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "92b91337586e0992316ac8835d10db28e6954d44",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "92b91337586e0992316ac8835d10db28e6954d44",
        "digest": "fa0750b7eb699d677cb04d9153641bf0226578b3d7e2c0b637ae867d2cecba2f"
      }
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "6b752a90-9785-461b-ae6b-5bab3892695f",
      "requestDigest": "6301fd91f6868e093466c9c29f393200a2928c2fc32a931cd3428f2f7aee8fd9",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #270; claude child opus/high\n\nEdit under the reviewer rules. The incidents are observed: the #270 Task 2 report gives the real Idle count 25 with #30, and engine/board/view.ts signature joins column, state, step, and waitFor, not the title. The active lesson derive-fixture-state-from-real-producers governs runtime fixture inputs, not the expected values that a plan writes, so this is a new rule and not a merge. As proposed, the rule computed every oracle value from the real producer, which contradicts the test-behavior-not-implementation principle of the plugin celetis (derive the expected result from the requirement) when the producer is the code under change. The edit limits the rule to the part of a value that an existing, unaltered producer gives, keeps the part that the change adds with the requirement, and retitles the lesson to match. Incident evidence stays unchanged.",
      "related": [
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference; it needs separate authorization."
      }
    }
  ]
}
---
# Derive planned oracle values of existing producers from those producers

## What happened

The #270 plan gave two hand-derived oracle values. Its Idle list and count omitted fixture #30, so the real count was 25, not 24. Its changed-dot probe used a title change, which the board signature ignores. The implementers caught both at execution and asserted the real behavior. The plan carried the related lesson and claimed to trace each state.

## Root cause

Inferred: the related lesson covers fixture inputs and a check at execution, not the expected values that a plan writes into its oracles. The plan computed the values by hand. Alternative: two independent slips.

## Fix

Proposed prevention, not proven enforcement: when a plan writes an expected list, count, or trigger for a derived state, it computes the part that an existing producer gives, and that the change does not alter, from that producer (for example a probe that runs the placer or the signature on the planned data), and records how. The part that the change adds comes from the requirement, as the test-behavior-not-implementation principle of the plugin celetis says: an oracle computed from the code under change cannot fail when that code is wrong. A structural follow-up needs separate authorization: a plan review check that flags a derived oracle value with no producer or requirement reference. Judgment decides which values are derived, so the rule stays text.

## Rule

Applies when a plan or a brief states an expected value of a derived state (a list, an order, a count, a trigger) for a check, and an existing producer that the change does not alter gives part of that value. Action: compute that part from the existing producer on the planned inputs and cite the producer; derive the part that the change adds from the requirement. Check: each such oracle value names its producer or its requirement, and a run of the existing producer on the planned data gives the part that it covers.

## Related lessons

[[derive-fixture-state-from-real-producers]]
