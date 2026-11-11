---
{
  "schema": 1,
  "name": "check-a-lock-free-read-against-a-live-writer",
  "description": "A lock-free journal check made every lane read and every landing refuse while another lane's lesson apply ran",
  "tags": [
    "data-store",
    "git",
    "false-positive",
    "process"
  ],
  "date": "2026-11-04",
  "status": "active",
  "source": "implement session of ddinkov10/celetis#242, final whole-branch review",
  "incidents": [
    {
      "id": "e78b06e2-d122-4c25-ba7b-f3dd4e3006ba",
      "date": "2026-11-04",
      "action": "The coordinator ruled in the Task 1 fix round that a linked-checkout `lesson-store read active` checks the main journal without taking the lesson lock; Task 4 then put that read into every `land`.",
      "expected": "A read that runs while another checkout's apply holds the lock and its journal waits for that writer, or reads a consistent store; a landing of an unrelated lane still runs.",
      "observed": "With a 4 s pre-commit hook in lane 1 during its apply, lane 2 `read active` exited 6 and `land 2` exited 6 with `land: blocked: .../_pending/.transaction.json: incomplete transaction; run lesson-store recover`; after lane 1 finished, `land 2` exited 0.",
      "source": {
        "kind": "tool-output",
        "excerpt": "land 2 during lane 1 apply: exit 6; stderr land: blocked: .../docs/lessons/_pending/.transaction.json: incomplete transaction; run lesson-store recover / land 2 after lane 1 apply: exit 0",
        "reference": "final review probe r1.ts, case land-during-other-lane-apply, rerun by the coordinator at d46ac63"
      },
      "inference": "Inferred: the journal check cannot tell a live writer from an interrupted one without the lock, so a lock-free check turns a running write into a refusal. The ruling weighed only a partial read, not a refusal. Alternative: the plan's D1 sentence, which kept the read lock-free, also invited the ruling.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "d46ac63"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "bf5e4774-af01-42ac-9c5a-0c8592dbf4bc",
      "requestDigest": "767e7a29fc6374ec19d8e0dafb33ca39fd708f3eb15868eb009a8a256cf5b934",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nEdit under the reviewer rules: the retained slow-writer probe establishes a false incomplete-transaction refusal. The proposed universal no-refusal wording exceeds that evidence and conflicts with the current approved bounded wait and busy result. Scope the check to a live writer that completes within the wait limit, preserve busy at the limit, and allow any synchronization method that gives a consistent result. Keep the original incident and inferred cause. The edited rule agrees with lesson-format and the shared-state and behavioral-check principles; structural work stays proposed.",
      "related": [
        "check-a-lock-free-read-against-a-live-writer"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Consider a separately authorized concurrency probe for live journal writers. This review changes no source or verification procedure."
      }
    }
  ]
}
---
# Check a lock-free read against a live writer before the ruling

## What happened

A task review found that a linked-checkout `lesson-store read active` ignored an incomplete journal. The coordinator ruled to add the journal check without the lesson lock. A later task put that read into every `land`. The final review then observed that `land` of an unrelated lane exits 6 `blocked` while another lane's apply runs a commit hook, and exits 0 after that apply ends.

## Root cause

Inferred, not proven: a journal exists for the whole time of a write. Only the lock tells a live writer from an interrupted one. The ruling considered only the risk of a partial read. It did not run the case of a check during a live write. The plan's decision that the read takes no lock also invited the ruling.

## Fix

Proposed prevention: synchronize a journal read with the writer, or use another method that gives a consistent result and distinguishes a live write from an interrupted write. Keep the approved lock wait limit and its busy result. A permitted probe with a writer that finishes within that limit checks the recorded failure. This remains a text rule because the synchronization and allowed wait depend on the shared-state contract. No new structural enforcement is claimed.

## Detection signature

`incomplete transaction; run lesson-store recover` from a read or from `land` while another session's lesson write is still running.

## Rule

When a design adds a check of shared state that a writer marks in progress, check how the reader distinguishes a live write from an interrupted write. Run a permitted probe while a slow writer holds that state and finishes within the approved wait limit. Confirm that the reader waits or gets a consistent result, and that callers do not report an interrupted write from that live operation. Preserve the approved busy result when the wait limit is reached.
