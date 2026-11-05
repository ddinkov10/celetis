---
{
  "schema": 1,
  "name": "read-keyboard-actions-before-driving-a-check",
  "description": "A browser check used Enter for details but invoked the existing primary action",
  "tags": [
    "test",
    "ui",
    "process"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Implementation of ddinkov10/celetis#245, temporary browser driver correction",
  "incidents": [
    {
      "id": "036f9e3e-845e-4d7a-b2b7-e20692536ed4",
      "date": "2026-11-05",
      "action": "The #245 temporary Chromium driver pressed Enter on a focused Idle card to open details without checking CARD_KEYS.",
      "expected": "The verification opens details using the existing keyboard action and does not invoke Run.",
      "observed": "The driver timed out waiting for has-panel. CARD_KEYS maps Enter to .main-action.click() and Space to openPanel. The fixture rejects mutations, so no real issue run started.",
      "source": {
        "kind": "tool-output",
        "excerpt": "browser-first.json retained V1 PASS and V2 shrink/empty/focus results, then TimeoutError: forFunction: Timeout 30000ms exceeded. engine/board/board.ts:1602 maps Enter to .main-action; :1603 maps Space to openPanel.",
        "reference": "ddinkov10/celetis#245 implementation; docs/superpowers/verification/245-idle-scroll/check-first.ts and browser-first.json"
      },
      "inference": "Inferred: the driver assumed a conventional Enter action instead of reading the existing keyboard map. No broader cause or product defect is established.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa plus the three-line Idle scroll fix"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "d3808f61-f41b-48dd-a27e-c9139abb9713",
      "requestDigest": "8e2a0b2bb0cc70493d1f478bbd9ecf8f2166abe6dba3d4c77b81a6a0a77ae98f",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nApprove under the reviewer rules: the retained timeout and the cited keyboard map establish the incident, the rule states applicability, action, and check, and the root cause is labeled as inference. The rule keeps the rejecting mutation adapter, grants no permission, and weakens no check. No active or historical lesson states the same rule.",
      "related": [
        "read-keyboard-actions-before-driving-a-check"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Read the existing keyboard action before a browser check

## What happened

The #245 temporary driver pressed Enter to open details. The page binds Enter to the primary action and Space to details. The check timed out; the fixture rejected the attempted mutation.

## Root cause

Inferred: the driver used a familiar convention without checking the current keyboard map. No product defect is established.

## Fix

The driver uses Space, which the current code binds to details. Proposed prevention remains a text rule because keyboard actions depend on the application and focused element. No new enforcement is claimed.

## Rule

When a runtime check drives a keyboard action, read the current documented action and its focused-element binding before choosing the key. Use the supported key and verify the intended visible state. Keep mutation adapters rejecting operations outside the scenario.
