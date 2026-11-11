---
{
  "schema": 1,
  "name": "isolate-verification-barriers-per-attempt",
  "description": "A reused release marker bypassed a temporary shutdown verification barrier",
  "tags": [
    "test",
    "false-negative",
    "process"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "Celetis implement #76, final V5 runtime check",
  "incidents": [
    {
      "id": "celetis-76-final-v5-stale-barrier-20261103",
      "date": "2026-11-03",
      "action": "Reused deterministic V5 child barrier paths in the same temporary directory for development and final Verify.",
      "expected": "V5 waits after the occupied bind until this run sends a signal and releases its barrier.",
      "observed": "Final V5 logged attempts at 24404 and 24405, printed a startup URL, and failed 2 !== 1. A prior V5-1.retry release file remained.",
      "source": {
        "kind": "tool-output",
        "excerpt": "V5-stale-barrier-events: attempt 24404; retry; attempt 24405; controller. AssertionError: 2 !== 1. ls: V5-1.retry, 2 bytes, Nov 3 17:26.",
        "reference": "Issue #76; retained V5-stale-barrier.log and V5-stale-barrier-events.jsonl"
      },
      "inference": "The pre-existing release marker bypassed the temporary wait. UUID-based barrier names remove this cross-run state; no production edit was needed.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "94cdb90f51d1be9154271909549f314658dcb402"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "4f8e1111-796d-4d05-a3da-323495f5628c",
      "requestDigest": "2ff02e5ad46a0a02daf1e5ea7bd86323655d63d317d258f9728046eab6034067",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nApprove under the reviewer rules: the event trace and retained release marker establish stale fixture state, rather than a production defect. The scoped rule gives new attempt paths and a repeated-run check. It agrees with the idempotency and behavioral-check principles and preserves all verification gates. The possible structural helper remains proposed.",
      "related": [
        "isolate-verification-barriers-per-attempt"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A separately authorized fixture helper could create per-attempt directories and check that no release marker exists before launch. This decision does not authorize or verify it."
      }
    }
  ]
}
---
# Give each verification attempt its own barrier files

## What happened

The #76 final Verify run reused deterministic child barrier paths from development. V5 reported two bind attempts and a startup URL where it required one attempt and no URL. The retained development V5-1.retry file already contained the release marker.

## Root cause

The temporary driver reset its child counter but kept the same probe directory. Its child treated any existing barrier file as permission to continue. This is a fixture lifecycle error, not evidence that the production cancellation guard failed. The event trace and retained file support that cause; the initial assertion alone did not distinguish a fixture defect from a product defect.

## Fix

The temporary driver now gives each child a UUID-based barrier path. V5, V6, and V7 then pass with the production commit unchanged. Proposed prevention is a rule for temporary verification programs. No repository enforcement is added. A reusable fixture helper, if later authorized, can create per-attempt directories and check that no release marker exists before launch.

## Rule

When a verification program can run again in the same directory, give each attempt new barrier and completion paths. Before launching a child, ensure that its completion condition cannot be satisfied by an earlier run. Repeat the check in the same parent directory and confirm that the child still waits for the current run's release.
