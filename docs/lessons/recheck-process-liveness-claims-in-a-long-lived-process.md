---
{
  "schema": 1,
  "name": "recheck-process-liveness-claims-in-a-long-lived-process",
  "description": "A daemon kept an issue lock after its run ended, because the lock owner read the daemon process as the live runner",
  "tags": [
    "false-positive",
    "regression"
  ],
  "date": "2026-11-06",
  "status": "active",
  "source": "Final whole-branch review of ddinkov10/celetis#247",
  "incidents": [
    {
      "id": "e3e786c6-de4d-4705-a7d3-4d487aee38da",
      "date": "2026-11-06",
      "action": "Tasks 2 and 3 of #247 moved issue runs into the long-lived daemon and kept LockOwner.release, which keeps a lock ref with a live session under an owner record that names the runner process.",
      "expected": "After a daemon run ends with its session still live, the issue lock is held only by that session and is free once the session ends (spec of #247: A lock is held only while its runner or its session lives).",
      "observed": "After the session ended, the issue-1 owner record named the daemon as runner, and a second run request for #1 got 409 with the daemon PID; the old runner control freed the lock.",
      "source": {
        "kind": "tool-output",
        "excerpt": "second /run #1 after the session end: 409 {\"accepted\":false,\"line\":\"celetis-flow: another celetis-flow.ts or its session (PID 47363) works on #1\",\"code\":0} (47363 = daemon); controller rerun: after session 52114 ended: lockHolder=52109; new run take=52109; daemon pid=52109; control new take=taken",
        "reference": "ddinkov10/celetis#247 final review, lane .superpowers/sdd/247/final-review-report-2.md"
      },
      "inference": "The owner record uses process liveness as run liveness; correct for a runner that exits after its run, wrong for a daemon. Alternative: the review focus of the plan named no lock release case for a run that ends inside a running daemon.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f16fd9ef5682f536bff7e4281afc5b1e0cb5f5a3"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "989d670f-4f5b-42ca-b6e7-344acf22aa4f",
      "requestDigest": "d82c5ebf60babb333eb8a872423cc569d9b6976cf8b6e2e82f55bbda2f671aa5",
      "date": "2026-11-06",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #247; claude child opus/high\n\nApprove: the proposal has observed tool-output evidence, keeps the inferred cause apart from the facts, and states applicability, action, and check. No active or historical lesson states the same rule or holds its incident, and the rule widens no permission, weakens no check, and contradicts no project instruction, skill, or principle.",
      "related": [
        "recheck-process-liveness-claims-in-a-long-lived-process"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the set of liveness proxies differs per change and needs judgment to list."
      }
    }
  ]
}
---
# Re-check process-liveness claims when work moves into a long-lived process

## What happened

Issue #247 moved each issue run of the old runner (a process that exits after its run) into one long-lived daemon process. The lock owner kept its rule: `release` keeps a lock ref while the registered session lives, under an owner record that names the runner process. The final whole-branch review ran a daemon run that ended with its session still live ("cannot prove that the session stopped"). After the session ended, the owner record still named the daemon as runner, and a new run request for the issue was refused with the daemon PID. The old runner, in the same scenario, freed the lock after the session end, because its process exited.

## Root cause

Inferred: the owner record uses the liveness of the runner process as the liveness of the run. That proxy holds for a runner that exits after its run, and fails for a process that outlives the run. The plan, six task reviews, and the probes did not end one run inside a still-running daemon and then check the claims of that run. Uncertain: whether a review-focus item on lock release in the daemon would have caught it.

## Fix

Proposed prevention: when a run ends in a long-lived process, end its claims explicitly (for the lock, leave a kept ref to the session alone). No structural check exists yet; the rule stays text, because the set of liveness proxies differs per change and needs judgment to list.

## Detection signature

A refusal line that names the PID of a daemon or server for work that already ended: `another celetis-flow.ts or its session (PID <daemon>) works on #<n>`.

## Rule

Applies when a change moves work from a process that exits after the work into a process that outlives it (a daemon, a server, a long loop). Action: list every rule that reads the liveness of the process as the liveness of the work (lock owners, barriers, watchers, records), and end each claim of the work explicitly when the work ends. Check: a probe ends one unit of work inside the long-lived process while that process stays, and confirms that every claim of that work is free, with the short-lived process as the control.
