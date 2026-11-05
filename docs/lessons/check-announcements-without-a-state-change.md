---
{
  "schema": 1,
  "name": "check-announcements-without-a-state-change",
  "description": "A new warning was visible but silent because the announcement depended on leaving the pending state",
  "tags": [
    "ui",
    "regression",
    "test"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "Task 2 review of ddinkov10/celetis#238",
  "incidents": [
    {
      "id": "238-unknown-warning-announcement-20261103",
      "date": "2026-11-03",
      "action": "Added an unknown runner observation warning while preserving the starts card state; left startNotices unchanged.",
      "expected": "The plan Task 2 requires the existing live-region announcements to report the new warning.",
      "observed": "A Chromium pending-to-unknown transition showed the warning but #announce stayed empty. The same focused assertion passed after tracking changed warnings independently.",
      "source": {
        "kind": "tool-output",
        "excerpt": "RED: assert.match(observed.announce, /runner-unknown-238/) received empty string. GREEN: #236: hc could not read completed output for runner-unknown-238.",
        "reference": "issue #238 verification notice-red.log and notice-green.log"
      },
      "inference": "The existing announcement path only reported warnings when a card left starts. The new unknown state intentionally stays starts. The reason this consumer was missed during Task 1 is uncertain.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "07ea290"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "5ea3b31a-9cec-4b4a-9dc7-eceb84ef57d7",
      "requestDigest": "9dd70111f69764b475c007d1a280c955d0c2b18fa9cfcd14469215e872bdd2e5",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nApprove under the reviewer rules: the retained browser assertion shows visible warning text with an empty live region, followed by a passing announcement check. The rule gives scope, action, and a rendered-interface check. It agrees with the current design review and behavioral-check principle. Its facts and inferred omission remain separate.",
      "related": [
        "check-announcements-without-a-state-change"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The affected consumers depend on the UI contract. This decision needs no structural change."
      }
    }
  ]
}
---
# Check announcements when content changes without a state change

## What happened

The #238 implementation added an observation warning while the card stayed in starts. The design review and coordinator reproduced an empty live region despite visible warning text.

## Root cause

The existing announcement path only inspected warnings after leaving starts. Inferred: review of the data contract did not cover this stateful consumer. The reason for that omission is unknown.

## Fix

The implementation now tracks changed warning text independently of the startup state. A focused browser assertion failed before the change and passed afterward. Proposed prevention: exercise new content transitions through both the visible result and the existing accessible announcement. This remains a contextual rule; no project-wide enforcement is claimed.

## Rule

When new UI feedback can change without a state change, inspect consumers that depend on state transitions. Check the visible feedback and its accessible announcement through the rendered interface.
