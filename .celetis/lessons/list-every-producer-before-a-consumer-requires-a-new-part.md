---
{
  "schema": 1,
  "name": "list-every-producer-before-a-consumer-requires-a-new-part",
  "description": "A new required env file of the session-start barrier was written by the step start only, so the coordinator session no longer started",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-12",
  "status": "active",
  "source": "Final whole-branch review of #308 (implement step session), range 8c55408..50b088e",
  "incidents": [
    {
      "id": "13185b82-4472-46fe-addd-432788a097d8",
      "date": "2026-11-12",
      "action": "Task 2 of #308 made the session-start barrier require the start-folder file env and wrote it only in startSession; the coordinator start folder writes only go",
      "expected": "Every producer of a start folder (startSession and the coordinator open) writes each file that the barrier requires",
      "observed": "Barrier probe with a go-only start folder: base 8c55408 exit 0 (fake claude ran); lane 50b088e exit 1 with the env-not-valid line",
      "source": {
        "kind": "tool-output",
        "excerpt": "lane 50b088e: celetis: the session environment file …/start.XLJ3Yw/env is not valid; start the step again; lane exit=1 files: error go pid status",
        "reference": "https://github.com/ddinkov10/celetis/issues/308"
      },
      "inference": "The brief named one producer and nobody searched the other writers of startPrefix; uncertain whether a search instruction alone suffices",
      "diagnosis": [
        "unknown"
      ],
      "revision": "50b088e"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "206e2f87-59ec-482f-bc97-bec20c6a1741",
      "requestDigest": "b64874c89ba45bd5abe0dd428fd68908421310b22ea3d71b25149060d7112c73",
      "date": "2026-11-12",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #308; claude child opus/high\n\nReviewer rule Approve, with Edit first: the evidence is observed tool output, the rule states applicability, action, and check, and it widens no permission and contradicts no skill or principle. It is not a duplicate: list-every-producer-of-an-oracle-record covers records that a check asserts, and find-every-caller-of-a-refusal-before-claiming-an-input-now-passes covers the callers of a removed refusal; neither states this rule, and no live lesson holds its incident. The edit labels the claim that the coordinator session no longer started as an inference from the probe, adds the observed fix commit 893c57a, and adds why the rule stays text, as the Fix section of the format requires.",
      "related": [
        "list-every-producer-before-a-consumer-requires-a-new-part"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up of the Fix: one helper that creates a start folder with all its required files, and a probe that drives each producer of startPrefix through the session-start barrier. It needs separate authorization."
      }
    }
  ]
}
---
# List every producer of a shared input before a consumer requires a new part of it

## What happened

In #308, Task 2 made the `session-start` barrier of `engine/daemon.ts` require a new file `env` in the start folder, and wrote it only in `startSession` of `engine/lib/run-activities.ts`. The coordinator session (`engine/lib/coordinator.ts:266-307`) makes its own start folder with `mkdtemp(state.startPrefix)` and writes only `go`. The task implementer and the task reviewer passed it. The final whole-branch review found it with a barrier probe: on base 8c55408 a start folder with only `go` started the fake `claude` (exit 0); on the lane 50b088e it gave `celetis: the session environment file …/env is not valid; start the step again` (exit 1). Inference from the probe: the coordinator session no longer started on Claude or Codex. Commit 893c57a then made `writeSessionEnv` of `engine/lib/hosts.ts` write `env` for both producers.

## Root cause

Inference: the task brief named one producer (`startSession`), and neither the implementer nor the reviewer searched for other writers of the start folder (`startPrefix`, the `--session-start` form of `daemonArgv`). The active rule list-every-producer-of-an-oracle-record covers the oracle records of a check, not a runtime input that a consumer starts to require. Uncertain: a reviewer instruction to search the producers may have been enough.

## Fix

Proposed prevention (text): before a consumer requires a new part of a shared input (a file, a field, an argument, an environment value), search every producer of that input and give each one the new part, or keep the part optional with a reason. Proposed structural follow-up, which needs separate authorization: one helper that creates a start folder with all its required files, so that a producer cannot skip one; a check that rejects the recorded mistake is a probe that drives each producer of `startPrefix` through the barrier. Not enforced now. The rule stays text: which inputs count as shared, and which code is a producer of one, needs judgment that no current check of the project expresses.

## Rule

Applies when a change makes a consumer require a new part of an input that more than one producer can make (a start folder, a record, a message, a CLI argument). Action: search the code for every producer of that input (its path prefix, its constructor, its command form), list each one, and give each the new part in the same change, or keep the part optional for a producer with a stated reason. Check: a probe drives each listed producer through the consumer and observes success; a search of the producer patterns names no producer that the list leaves out.

## Related lessons

[[list-every-producer-of-an-oracle-record]] [[find-every-caller-of-a-refusal-before-claiming-an-input-now-passes]]
