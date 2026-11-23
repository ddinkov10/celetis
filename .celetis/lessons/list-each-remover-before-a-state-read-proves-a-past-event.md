---
{
  "schema": 1,
  "name": "list-each-remover-before-a-state-read-proves-a-past-event",
  "description": "Three proofs of a never-released session failed, because each read a file state with no list of what writes and removes that file",
  "tags": [
    "false-positive",
    "refix",
    "data-store",
    "process"
  ],
  "date": "2026-11-23",
  "status": "active",
  "source": "Task 2 of the build of ddinkov10/celetis#371, its task review and scoped re-reviews",
  "incidents": [
    {
      "id": "4e187688-310d-4206-8534-c7dff91b09b6",
      "date": "2026-11-23",
      "action": "Built three successive proofs of a never-released session from the state of the start folder, without listing each writer and remover of its files.",
      "expected": "A not-started end is recorded only when the state proves that the start barrier was never released.",
      "observed": "c8c5665 recorded not-started for a released session whose folder was removed. e0ece12 left a never-started session open. c6617e8 recorded not-started after a killed recursive removal.",
      "source": {
        "kind": "tool-output",
        "excerpt": "left=[env,error,pid,status,terminated] neverReleased=true end=not-started (2 of 400 forced kills, c6617e8)",
        "reference": "https://github.com/ddinkov10/celetis/issues/371"
      },
      "inference": "Probable cause: each proof came from the reader of the state, with no list of writers and removers. Uncertain: an earlier list may not have shown the case that needs a kill during a library call.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "c6617e8b759115beac06dfbf35119a79dbd42391"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "fa6612a7-e9f9-4aec-af28-7a8c36ca35a2",
      "requestDigest": "8ba9c5ed2eb8066eef418de896f2d9ad16613d3f5df74d7cd18102503a559ae6",
      "date": "2026-11-24",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #371; claude child opus/high\n\nApprove (reviewer rules): the incident holds observed tool output from three commits of #371; the rule states applicability, action, and check; it widens no permission, weakens no check, and adds no network or credential act; it agrees with the principles boundary-discipline and make-operations-idempotent of the plugin celetis. No live or historical lesson holds its incident or states its rule: list-every-producer-before-a-consumer-requires-a-new-part covers a new required part, and return-the-safe-result-for-a-known-proof-blind-spot covers a blind spot already known. The order that its Fix names is in the lane: engine/daemon.ts writes pid before it waits for go, and the ending in engine/lib/run/activities.ts removes pid before the folder.",
      "related": [
        "list-each-remover-before-a-state-read-proves-a-past-event"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the choice of a proof needs judgment."
      }
    }
  ]
}
---
# Before a state read proves a past event, list each writer and remover of what it reads

## What happened

During the build of #371, an attempt record needed the outcome `not-started`, defined as "the start barrier was never released". A takeover reads that state from the start folder of the session.

Three proofs were built in turn:

1. A missing `go` file. A probe showed a false `not-started` on c8c5665: a detached daemon had removed the whole folder of a released session.
2. A null barrier in the run record. A probe on e0ece12 showed that a session which never started stayed `open`.
3. A start folder that exists with no `go`. On c6617e8, a forced kill during the recursive removal left `[env,error,pid,status,terminated]` with no `go` in 2 of 400 runs, and the entry recorded a false `not-started`.

## Root cause

Inferred: each proof was chosen from the reader of the state, with no list of the code that writes and removes the files it reads. Removal order was not considered until the third review. It is uncertain whether an earlier list would have shown the partial-removal case, because that case needs a process kill during a library call.

## Fix

Proposed prevention: the proof now relies on an order that the code enforces. The barrier writes `pid` before it waits for `go`, and `ending` removes `pid` before the rest of the folder, so `pid` with no `go` proves no release. This rule stays text because the choice of a proof needs judgment. A structural check is not proposed.

## Rule

Applies when code or a plan decides that a past event did or did not happen from the present state of files, records, or processes, and writes that decision to a durable record. Action: list each writer and each remover of what the check reads, including a partial or interrupted removal, a process that exits by itself, and an in-memory state that is not persisted. Base the proof on an order that the code enforces, and keep the unknown result when no such order exists. Check: a probe builds each state from the list, including one left by a killed removal, and the record claims the event only in the states that prove it.

## Related lessons

[[a-failed-process-read-is-not-an-exit]]
[[return-the-safe-result-for-a-known-proof-blind-spot]]
[[plan-condition-must-not-narrow-a-spec-rule]]
