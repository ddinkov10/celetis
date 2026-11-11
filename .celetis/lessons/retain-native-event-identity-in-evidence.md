---
{
  "schema": 1,
  "name": "retain-native-event-identity-in-evidence",
  "description": "A sanitized native envelope omitted the event ID required for freshness and replay checks",
  "tags": [
    "api",
    "test",
    "process"
  ],
  "date": "2026-11-04",
  "status": "active",
  "source": "Implementation of ddinkov10/celetis#236, Task 1; child /root/task1 report",
  "incidents": [
    {
      "id": "f03920e4-7bb4-4eae-a413-9d6900909d07",
      "date": "2026-11-04",
      "action": "The first sanitizer retained the prompt_id key name but omitted its value from early Claude native envelopes.",
      "expected": "Retain the native event identity needed for attempt freshness and stable sequence evidence.",
      "observed": "The new receiver correctly returned unknown/null identity for those incomplete retained envelopes, while the initial adapter probe expected a verified event.",
      "source": {
        "kind": "tool-output",
        "excerpt": "claude-real-observation.json has prompt_id in keys but no prompt_id value. The incomplete envelope returns unknown/null identity; a fresh native adapter event returns available with stable sequence 1.",
        "reference": "https://github.com/ddinkov10/celetis/issues/236#issuecomment-6632153323; Task 1 report"
      },
      "inference": "The capture field list was selected before the native event ID requirement was fully applied; other causes are not established.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ed1f9befee7feb73958cccb5b94570c69a4d96b5 plus Task 1 working changes"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c63e5f87-53cf-44e4-801f-2c0547aff356",
      "requestDigest": "8ce45002bbd85aaee21731abbd28fb7c4595ba0ad399eab6dec5daff95f46505",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nApprove under the reviewer rules: the retained envelope excerpt and the receiver result establish the incident, the rule states applicability, action, and check, and the root cause is labeled as inference. The rule keeps the removal of secrets, grants no permission, and weakens no check. No active or historical lesson states the same rule.",
      "related": [
        "retain-native-event-identity-in-evidence"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Retain native event identity in sanitized evidence

## What happened

The Task 1 capture preserved the name of prompt_id but omitted its value. The adapter correctly rejected those old envelopes as unverified. Fresh native runs retained the value and established stable observation sequences.

## Root cause

Inferred: the sanitizer field list was chosen before the event identity requirement was applied. No other cause is established.

## Fix

The incomplete old envelopes remain unknown. Native cases were renewed with complete identity. Proposed prevention: check the retained envelope against the evidence contract before accepting the capture. This remains a judgment rule because the identity fields depend on the native surface; no new enforcement is claimed.

## Rule

When sanitizing native evidence for freshness or replay checks, preserve each required event or turn identity value. Remove secrets without removing the proof. Check the retained envelope against the required identity fields before using it as evidence.
