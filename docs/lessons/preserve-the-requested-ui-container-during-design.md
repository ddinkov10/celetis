---
{
  "schema": 1,
  "name": "preserve-the-requested-ui-container-during-design",
  "description": "A requested collapsible toolbar strip became a detached popover after reference research",
  "tags": [
    "ui",
    "process"
  ],
  "date": "2026-11-04",
  "status": "active",
  "source": "Interactive specify and prototype session for ddinkov10/celetis#236",
  "incidents": [
    {
      "id": "4b6d9d64-492b-44a5-8073-84403a4548fe",
      "date": "2026-11-04",
      "action": "I replaced the requested horizontal agent strip with a single icon that opened a detached vertical popover, then built that prototype.",
      "expected": "The collapsed icon expands inline into a horizontal strip in the top or bottom bar; the agents can be dragged there.",
      "observed": "The user corrected the result: \"what i mean is a strip, not a pop though\".",
      "source": {
        "kind": "user-report",
        "excerpt": "Earlier: \"what about an element on the top/bottom bar ... you can drag which one is first\". Correction after the popover prototype: \"what i mean is a strip, not a pop though\".",
        "reference": "Chat for issue #236, 2026-11-04, correction after the popover preview"
      },
      "inference": "Inferred: I let a matched reference pattern replace the user's specified spatial structure. The later request for one collapsed icon did not explicitly replace the earlier strip requirement. The precise expansion mechanics were initially ambiguous.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ed1f9be"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c391d759-bb0f-43b6-a9f0-d2adc8d80078",
      "requestDigest": "c65ec372a11bff4ce47e1b28e94dd1d70c265959929173facb7e6ba6c1aecee7",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nApprove under the reviewer rules: the retained user correction establishes that a detached popover replaced the requested strip. The rule gives applicability, preserves stated placement and interaction requirements, and checks both design states against the complete request. It agrees with specify, prototype, the UI procedure, and the maintainer pick rule. It does not replace the required research or design decision. The cause remains inferred. No active lesson states this design-state preservation rule.",
      "related": [
        "preserve-the-requested-ui-container-during-design"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Preserving the complete request during design needs contextual judgment. This review requires no structural change."
      }
    }
  ]
}
---
# Preserve the requested UI container during design

## What happened

During the design of #236, the user requested agent icons in a top or bottom bar and drag reordering. The user then requested a single icon in the collapsed state. I researched popovers and built a detached vertical panel. The user corrected the result: "what i mean is a strip, not a pop though".

## Root cause

Inferred: I applied a reference product's container instead of preserving the user's existing strip requirement. A single collapsed icon defines the closed state; it does not authorize a different expanded container. The exact expansion mechanics were initially ambiguous.

## Fix

The prototype must expand horizontally within its existing bar. Proposed prevention: record the closed state, expanded container, and main action together before adapting a reference. This remains a design judgment rule. No instruction or structural enforcement is changed by this capture.

## Rule

When a user refines one state of an existing design, preserve the other stated interaction and placement requirements. Apply references within those constraints. Check the collapsed and expanded states against the complete request before presenting the result.
