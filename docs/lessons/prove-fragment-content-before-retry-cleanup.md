---
{
  "schema": 1,
  "name": "prove-fragment-content-before-retry-cleanup",
  "description": "Retry cleanup deleted a substituted migration fragment based on its name and dead process identity alone",
  "tags": [
    "data-store",
    "test"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 1 self-review of ddinkov10/celetis#244; child /root/task1",
  "incidents": [
    {
      "id": "244-task1-uncertain-fragment",
      "date": "2026-11-05",
      "action": "Retry recovery removed a substituted target temporary using its migration name, file owner, and dead process identity without proving its content.",
      "expected": "Cleanup removes only proven migration-owned fragments and preserves uncertain substituted files with an explicit refusal.",
      "observed": "The first transaction refused and preserved the substituted target. The next ordinary commit deleted that file and committed. The isolated red check failed with Missing expected rejection. Recovery now compares file identity and bytes against the expected complete or partial migration write; unrelated bytes remain intact and refuse.",
      "source": {
        "kind": "tool-output",
        "excerpt": "transaction-uncertain-red-2.log: AssertionError: Missing expected rejection. Child /root/task1: a retry deleted the substituted target based only on name/owner/dead process. transaction-green-4.log: transaction: PASS.",
        "reference": "docs/superpowers/verification/244-20261105; Task 1 report and retained transaction driver"
      },
      "inference": "The first refusal and retry used different ownership proof. A valid-looking name and dead process did not establish that the file was the helper's expected write. The broader frequency of this pattern is unknown.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa plus Task 1 working helper"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "82de8f81-530e-4a27-81d2-c97ca6493f94",
      "requestDigest": "52c0c1513899d840bab1e15954f879d949d39c1bbec005d0ff6c697e16a59bff",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nApprove under the reviewer rules: the retained refusal-then-retry failure establishes deletion of substituted bytes, and the corrected probe result is retained. The rule states applicability, identity and content proof under synchronization, and a retry check that preserves uncertain bytes. It agrees with boundary discipline, safe recovery, and synchronization principles, and gives no new deletion permission. No live or historical lesson states this retry-fragment proof rule or holds this incident. The broader frequency remains unknown.",
      "related": [
        "prove-fragment-content-before-retry-cleanup"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Ownership and recoverable content depend on each operation. No separate structural change is required by this review."
      }
    }
  ]
}
---
# Prove fragment content before retry cleanup

## What happened

During #244 Task 1 self-review, the helper preserved a substituted target temporary on its first refusal. A later retry deleted the same file based on its name, owner, and dead process identity, then committed. An isolated check expected refusal and reported `Missing expected rejection`. The child changed recovery to check held identity and bytes against the expected complete or partial write. The corrected driver passed while preserving unrelated bytes.

## Root cause

The retry path used weaker proof than the failure path. A migration-shaped name and a dead writer identified a candidate but did not establish its content. The exact code and focused retry support this cause; no wider recurrence is established.

## Fix

Recovery now proves identity and expected write content before deleting a fragment. Uncertain files remain and cause a named refusal. Proposed prevention remains text because each operation defines its own recoverable fragment and write boundary. The focused temporary driver exercises refusal followed by retry with substituted bytes.

## Rule

When recovery deletes an interrupted operation's temporary file, prove the file's identity and expected write content under the same synchronization. A name and dead process identify candidates, not deletion authority. Check a refusal followed by retry with a substituted file; the retry must preserve uncertain bytes and refuse.
