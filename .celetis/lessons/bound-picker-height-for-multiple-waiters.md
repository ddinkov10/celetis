---
{
  "schema": 1,
  "name": "bound-picker-height-for-multiple-waiters",
  "description": "A viewport-contained picker placed later Retry actions below a 375×812 viewport",
  "tags": [
    "ui",
    "e2e",
    "regression"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 5 review and coordinator reproduction of ddinkov10/celetis#236",
  "incidents": [
    {
      "id": "236-task5-review-eight-waiters-20261105",
      "date": "2026-11-05",
      "action": "The Task 5 picker positioned its panel above the trigger but did not bound panel height when rendering an unbounded list of issue-specific quota waits.",
      "expected": "The approved Task 5 contract requires an upward viewport-contained picker and issue-specific Retry actions when several runners wait, usable at 375×812.",
      "observed": "With eight valid synthetic waits at 375×812 in reduced-motion mode on 80c35f5, the panel began at y=12, was 912.5390625 px high, and ended at y=924.5390625. Retry #8 began at y=868.5390625, below the 812 px viewport. overflow-y was visible. The coordinator rerun matched the reviewer.",
      "source": {
        "kind": "tool-output",
        "excerpt": "viewport 375×812; panel y12 height912.5390625 bottom924.5390625; Retry#8 top868.5390625 height44 bottom912.5390625; panelOverflowY visible; waits8. Browser-loaded board.js, agent-picker.mjs and board.css SHA256 matched the 80c35f5 archive.",
        "reference": "ddinkov10/celetis#236; task-5-coordinator-eight-waiters.json and inspected capture; /root/review5"
      },
      "inference": "The panel's placement clamps the top to a viewport edge but does not constrain content height or make overflow scrollable. Why the implementation and earlier checks omitted a larger valid waiter list is uncertain.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "80c35f5fbe4c2bbfd646affc6ec7a6e50a92d159"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "8ef4e1f4-8237-4441-aad7-aae85c73d496",
      "requestDigest": "3f58c0a946fdb86aeda75699c9b1e4ebc3e0ef5b73f37b9949f175d27b58ad34",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nEdit under the reviewer rules: the reviewer and coordinator geometry establish the incident, and no active or historical lesson states this rule. The edit keeps the observed geometry apart from the inferred cause, dates the pending repair to 80c35f5, and states the rule as applicability, action, and check. Addendum of this review, from source reading only: the lane's engine/board/agent-picker.ts now sets a maxHeight on the panel; this review ran no rendered check and claims no verified repair. The rule agrees with the 375x812 UI check of the project AGENTS.md and adds no tracked test.",
      "related": [
        "bound-picker-height-for-multiple-waiters"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text inside the existing rendered check; no structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Bound picker height for multiple waiters

## What happened

The #236 Task 5 picker supports one Retry action per waiting issue. At 375×812, eight valid synthetic waits made the panel 912.5390625 px high. Its top was clamped to 12 px, but its bottom reached 924.5390625 px. Retry #8 began below the viewport. The reviewer and coordinator reproduced the same geometry with confirmed browser assets and inspected the capture.

## Root cause

Observed: the panel top was clamped to 12 px, the panel height was not bounded, and its `overflow-y` was `visible`. Inferred: the placement code bounded the top position without bounding the content height or making the overflow scrollable. Why the implementation and earlier checks used smaller lists is uncertain.

## Fix

At 80c35f5 the repair was pending. Proposed prevention: in the existing rendered check, use enough valid issue waiters to exceed the small viewport. Constrain panel height and provide a usable scroll path for every issue-specific action while retaining menu and focus behavior. This remains a contextual rule because the panel's content is dynamic and the project permits no tracked tests; no new enforcement is claimed.

## Rule

Applies when a viewport-contained control holds a variable number of actions. Action: in the existing rendered check, use a valid list taller than the smallest supported viewport. Check: the panel stays within the viewport, and pointer and keyboard users reach the last action without page overflow.
