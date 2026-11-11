---
{
  "schema": 1,
  "name": "capture-stable-functions-before-module-mocks",
  "description": "A filesystem fault wrapper recursed through the module namespace after mock.module replaced its exports",
  "tags": [
    "test",
    "platform-quirk"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 1 implementation of ddinkov10/celetis#244; child /root/task1",
  "incidents": [
    {
      "id": "244-task1-mock-live-binding",
      "date": "2026-11-05",
      "action": "The temporary transaction driver called fs.open from its imported namespace inside the mock.module replacement for node:fs/promises.",
      "expected": "Fault-injection wrappers retain the real filesystem operation except at the selected fault or barrier.",
      "observed": "The first green probe reached unreadability, then the archive-write fault wrapper recursively called its own mocked fs.open and failed with Maximum call stack size exceeded. Capturing { ...fs } before mock.module removed that recursion; the corrected transaction driver passed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "transaction-green-1.log: state migration: .../20/record.json: Maximum call stack size exceeded. transaction-green-2.log: unsafe_storage: PASS; replacement_race: PASS; interrupted_commit: PASS; transaction: PASS.",
        "reference": "docs/superpowers/verification/244-20261105; temporary transaction-green-1.log and transaction-green-2.log"
      },
      "inference": "The child reports directly observed mutation of the imported module namespace. The log establishes recursion and the corrected driver result. The exact Bun module-binding mechanism was not independently isolated.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa plus Task 1 working diff"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "2d48a33e-5e2e-4d47-84e9-1d774990ebcf",
      "requestDigest": "11bb5436d462fa69e16aa7f4fb6f822f0566ee23f805758b3fbd90376630e981",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nApprove under the reviewer rules: retained tool output shows recursion in the temporary wrapper and a corrected driver result, a useful incident rather than a bare tool error. The rule states applicability, stable reference capture before replacement, and an observable delegation check. The body preserves the reported namespace observation and uncertainty about the precise binding mechanism. It does not claim all module systems behave alike. It agrees with behavioral verification and the project prohibition on tracked tests. No live or historical lesson states this wrapper-reference rule or holds the incident.",
      "related": [
        "capture-stable-functions-before-module-mocks"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The wrapper and interception point depend on the permitted temporary probe. This review adds no production hook or retained test."
      }
    }
  ]
}
---
# Capture stable real functions before replacing module exports

## What happened

The #244 Task 1 temporary transaction driver wrapped node:fs/promises with mock.module. A wrapper called fs.open through the imported namespace. After the replacement, the namespace referred to the wrapper. The archive-write fault case failed with `Maximum call stack size exceeded`. The child changed the driver to capture `{ ...fs }` before mocking and call that snapshot. The corrected driver passed its transaction cases.

## Root cause

The child observed the namespace change and identified recursion through the replacement export. The retained log establishes recursion and the corrected result. The precise Bun binding mechanism was not independently isolated, so no claim is made about all module systems.

## Fix

The temporary driver captures real filesystem function references before mock.module changes the exports. This preserves real I/O while wrapping the selected operation. The proposed rule remains text because the required wrapper and its interception point depend on the probe. No production hook or permanent test is added.

## Rule

When a fault driver replaces a module's exports and delegates to the real operation, capture stable real function references before installing the replacement. Call those references from the wrapper. Check that the wrapper intercepts its named operation once and that the delegated real operation completes without recursion.
