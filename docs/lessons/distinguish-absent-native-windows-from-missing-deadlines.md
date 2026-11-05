---
{
  "schema": 1,
  "name": "distinguish-absent-native-windows-from-missing-deadlines",
  "description": "A reset parser treated an absent optional window as a required window with missing data",
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
      "id": "907a73ca-6e16-4e4b-b3e8-68c97a5bd0f2",
      "date": "2026-11-04",
      "action": "The first reset parser required both primary and secondary windows to be objects.",
      "expected": "Keep all supplied applicable exhausted windows; a null slot is not itself a missing required deadline.",
      "observed": "The native account schema supplied a weekly primary and secondary:null. The first predicate would omit that supported single-window deadline. The predicate was corrected, and the focused probe passed the one-window, two-window, and missing-required-deadline cases.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Native account: primary is a weekly window; secondary:null. Corrected focused assertions pass one-window, two-window, and missing-required-deadline cases. No live exhausted single-window account was observed.",
        "reference": "Task 1 report; docs/superpowers/verification/236-native-adapters/codex-account.json"
      },
      "inference": "Nullable native window slots were treated as unavailable required windows instead of distinguishing absent slots from present exhausted windows with missing reset data.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ed1f9befee7feb73958cccb5b94570c69a4d96b5 plus Task 1 working changes"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "dbfd6f4f-f2d0-421c-aaea-ab2ec17545d3",
      "requestDigest": "551be55c08885f7070eca00c039757c73a30805e37553ba891a5e75a97a5fdee",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nApprove under the reviewer rules: the retained native payload excerpt and focused cases establish an optional null slot and the corrected predicate. The record explicitly distinguishes an implementation-assumption correction from a live exhausted-account failure. The rule states applicability, retains all applicable exhausted windows, preserves missing-required-data handling, and checks one, multiple, and missing-data cases. It agrees with boundary discipline, domain modeling, type discipline, and behavioral verification. No active lesson states the same optional-window rule. No runtime coverage beyond the retained evidence is claimed.",
      "related": [
        "distinguish-absent-native-windows-from-missing-deadlines"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Applicability of optional windows depends on the native domain. This review adds no structural requirement."
      }
    }
  ]
}
---
# Distinguish absent optional windows from missing deadlines

## What happened

The first Task 1 reset predicate required both native window slots to contain objects. A real account response had one weekly primary window and a null secondary slot. The predicate was corrected, and focused cases covered one or two applicable windows and a missing required deadline. This was an implementation-assumption correction, not a live exhaustion failure.

## Root cause

The parser conflated an absent optional window with an exhausted applicable window that lacks its deadline.

## Fix

The parser now considers supplied applicable exhausted windows and retains null when their required reset data is missing. Proposed prevention: compare optional fields with the installed schema and a real payload before enforcing their presence. No new repository-wide enforcement is claimed; field applicability requires domain judgment.

## Rule

When combining native window deadlines, distinguish absent optional windows from present applicable windows with missing data. Derive the result from all applicable exhausted windows. Check one-window, multiple-window, and missing-required-data cases independently.
