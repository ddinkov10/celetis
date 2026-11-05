---
{
  "schema": 1,
  "name": "derive-fixture-state-from-real-producers",
  "description": "A raw fixture label did not produce the board state required by a transition check",
  "tags": [
    "test",
    "process"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Implementation of ddinkov10/celetis#245, temporary verification correction",
  "incidents": [
    {
      "id": "56808cf1-ad1f-42c9-9cae-0d5498577b30",
      "date": "2026-11-05",
      "action": "The temporary #245 driver added ready-for-agent to an unstarted bug issue and waited for the card to move from Idle to Needs you.",
      "expected": "The scenario creates a real data change that moves another card between columns.",
      "observed": "The wait timed out. data.ts derives started from a later stage and urgent from hotfix; PLACERS.ready uses started or urgent, so ready-for-agent alone leaves the card in Idle.",
      "source": {
        "kind": "tool-output",
        "excerpt": "browser-second.json: V2 shrink, empty, focus, and details recorded, then TimeoutError: forFunction: Timeout 15000ms exceeded. data.ts:68-69 derives started and urgent; place.ts:95 selects Needs you only for started || urgent.",
        "reference": "ddinkov10/celetis#245; retained verification logs"
      },
      "inference": "The local mismatch is confirmed. The reason for the unchecked assumption is inferred; no broader cause is established.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa plus the Idle scroll fix"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "6b06a4d9-8913-44c4-9181-015b1c981f26",
      "requestDigest": "bcf33c8389893662e01c8f442e7797f277c99c717fd3da994f5a9293027e46b1",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nEdit under the reviewer rules: the retained timeout and the source establish the incident; the lane's engine/board/data.ts derives started from a later stage and urgent from hotfix, and engine/board/place.ts places ready in Needs you only for started or urgent. No active or historical lesson states this rule. The edit makes the title a plain statement of the rule, removes an unrelated scan-boundary clause from the Fix, and states the rule as applicability, action, and check. The rule agrees with the test-behavior-not-implementation principle: the fixture exercises the real producer, and the check still observes the required state. Incident evidence stays unchanged.",
      "related": [
        "derive-fixture-state-from-real-producers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Derive fixture state from its real producer

## What happened

The temporary #245 driver added ready-for-agent to an unstarted bug issue and waited for the card to move from Idle to Needs you. The wait timed out. data.ts derives started from a later stage and urgent from hotfix; PLACERS.ready uses started or urgent, so ready-for-agent alone leaves the card in Idle.

## Root cause

The source and retained output establish the mismatch. Inferred: the fixture author assumed a boundary without reading its actual producer. No wider product defect is established.

## Fix

The temporary check was corrected against the existing source. Proposed prevention remains text because derived state producers vary by project and by state. No new enforcement is claimed.

## Rule

Applies when a runtime fixture must produce a derived state for a check. Action: trace that state to its real input producer, and choose inputs that satisfy the existing derivation. Check: confirm that the fixture reaches the required state before the check accepts the scenario result.
