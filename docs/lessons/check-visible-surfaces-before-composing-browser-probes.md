---
{
  "schema": 1,
  "name": "check-visible-surfaces-before-composing-browser-probes",
  "description": "A draft probe combined a nonzero Idle scroll assertion with a panel that hides Idle",
  "tags": [
    "ui",
    "test",
    "process"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Self-review of the implementation plan for ddinkov10/celetis#245",
  "incidents": [
    {
      "id": "issue-245-plan-draft-v2-hidden-idle-20261105",
      "date": "2026-11-05",
      "action": "Drafted one V2 browser sequence that opens details on an Idle card, focuses that card, and then expects its visible scroll offset to survive updates.",
      "expected": "The verification sequence must exercise reachable UI states and compare scroll and focus only when those controls are visible.",
      "observed": "Source inspection shows that openPanel adds has-panel, and the desktop has-panel rule sets the Idle column to display:none. The draft combined a visible-offset assertion with a hidden surface. Self-review corrected the draft before publication; no failed browser run is claimed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Draft V2: \"open details on a surviving Idle card, focus that card\". engine/board/board.ts:1158: document.body.classList.add('has-panel'); engine/board/board.css:527-529: body.has-panel .board[data-view=\"now\"] .col-idle { display: none; }.",
        "reference": "The #245 plan self-review in this session; source 40a31cb92ecce73591fc4c75321489240c5392fa"
      },
      "inference": "The draft appears to have combined individually useful checks without first tracing their layout interaction. The precise cause is not established. No runtime regression or recurring failure is inferred.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "0a4abae9-7678-4ffa-99ad-46e6d872c897",
      "requestDigest": "c92f063e62deeeb9b30f21f5bd1c6bdb009acf86a8fe4f10632998d0d8ac1dd5",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nApprove under the reviewer rules: the cited source lines establish that the draft combined a visible-offset assertion with a surface that the open panel hides, the proposal claims no failed run, the rule states applicability, action, and check, and the root cause is labeled as inference. The rule grants no permission and weakens no check. derive-fixture-state-from-real-producers covers fixture inputs, not the visibility of the asserted surface, so no active or historical lesson states the same rule.",
      "related": [
        "check-visible-surfaces-before-composing-browser-probes"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Check visible surfaces before composing browser probes

## What happened

The first #245 Verify draft opened details on an Idle card, then expected to focus that card and retain its visible scroll offset. The source adds `has-panel` when details open, and desktop CSS hides Idle under that class. Self-review found the conflict before the plan was published. No failing browser run is claimed.

## Root cause

Inferred: the draft combined useful cases without tracing their layout interaction. The exact reason is unknown. A hidden scroll container has no associated layout box; a zero read there does not establish that the visible scrolling case works.

## Fix

The plan separates the visible Idle focus/offset case from the open-details preservation case. It closes details before exercising visible Idle scrolling and layout transitions. The root-cause states table now identifies the intentionally hidden body. Proposed prevention remains a text rule because the applicable visibility transitions depend on the screen; no structural enforcement is claimed or authorized.

## Rule

When a browser probe combines scroll or focus assertions with a panel, view, or responsive transition, trace which surface remains visible after each action. Separate assertions that require incompatible states. Check that the scrolling surface has a layout box and overflow before interpreting its offset as evidence of the visible behavior.
