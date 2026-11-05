---
{
  "schema": 1,
  "name": "return-the-safe-result-for-a-known-proof-blind-spot",
  "description": "A quiescence proof with a known blind spot for detached writers returned quiescent while a detached writer still wrote",
  "tags": [
    "process",
    "false-positive",
    "data-loss"
  ],
  "date": "2026-11-04",
  "status": "active",
  "source": "implement session of ddinkov10/celetis#236, Task 4 task review and repair round 1",
  "incidents": [
    {
      "id": "79247fc0-f21a-434d-9409-b713a75aee3c",
      "date": "2026-11-04",
      "action": "The Task 4 implementer of #236 built endOwnedAttempt on the barrier's parent-PID process tree and documented detached children as a limit of tree-based proof",
      "expected": "A replacement session starts only after every writer of the owned attempt is proved gone; unknown or detached ownership returns unverified (approved spec, Task 1 limits, Acceptance 5)",
      "observed": "The task review demonstrated a writer with PPID 1 that kept writing while endOwnedAttempt returned quiescent; the coordinator reran the probe on c000280 and got the same result",
      "source": {
        "kind": "tool-output",
        "excerpt": "\"result\": \"quiescent\", \"barrierAfter\": \"gone\", \"stillWriting\": true, \"writers\": \"44671     1 /bin/sh -c while :; do echo tick >> ...writer.log; sleep 0.2; done &\" ... orphan-writer: DEFECT REPRODUCED",
        "reference": "https://github.com/ddinkov10/celetis/issues/236"
      },
      "inference": "Reported by the implementer: it treated a proof-method gap as an acceptable documented limit instead of a case that requires the safe result. Uncertain whether the plan's wording (endOwnedAttempt implements only the proved path) suggested that a documented limit was enough. The repair 26d8c99 added an environment marker and the tab terminal group; a writer that clears its environment and leaves the terminal is still not seen.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "c0002805969a008e4c5ac394ec556c2de40e69a8"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "78d7cf9d-1069-4465-8f9c-bbf9b65a0f31",
      "requestDigest": "b313894ec8b693baaa056fce71f56a1a4e9af3880e26c4958916a479b393683d",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nApprove under the reviewer rules: the retained detached-writer result establishes a positive quiescence claim while a writer remained active. The rule states applicability, requires the safe result or a method that covers the known gap, and requires a permitted probe per blind spot. The safe result follows the approved contract and does not remove a gate or grant permission for process control. It agrees with boundary discipline, domain modeling, and behavioral checks. It differs from the active failed-process-read lesson, which concerns an uncertain observation rather than an ownership case the proof cannot see. Preserve the reported cause and uncertainty; structural work stays proposed.",
      "related": [
        "return-the-safe-result-for-a-known-proof-blind-spot"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Consider a separately authorized proof-boundary probe for each listed blind spot. This review does not authorize source changes or runtime checks."
      }
    }
  ]
}
---
# Return the safe result for each case that a proof method cannot see

## What happened

Task 4 of #236 had to prove that every writer of an owned agent attempt had stopped before a replacement started. The implementation tracked the barrier's process tree by parent PID and listed detached children as a documented limit. The task review started a writer with `cmd &`, which reparented it to PID 1. `endOwnedAttempt` returned `quiescent` while that writer still wrote. The coordinator reproduced the result. Repair `26d8c99` added a per-attempt environment marker and the tab terminal group, and the probe then returned `unverified`.

## Root cause

Reported by the implementer: a known blind spot of the proof method was recorded as a limit, but the method still returned the positive result for that case. The spec required the safe result for unknown ownership. Uncertain: whether the plan's phrase about implementing only the proved path made a documented limit look sufficient.

## Fix

Proposed: before documenting a blind spot of a proof, decide what the code returns in that case. When the spec names a safe result for unproved cases, the code returns it, or it adds an identity that covers the case. A structural check is a probe that exercises each listed blind spot and asserts the safe result; this rule stays text because the blind spots differ per proof.

## Detection signature

A report or document lists a case as "cannot be seen" or "a limit", while the function returns its positive result for that case.

## Rule

When a check proves a safety condition and its method has a known blind spot, make the code return the safe result for that blind spot, or extend the method to cover it, before you record the blind spot as a limit. Check: one probe per listed blind spot asserts the safe result.
