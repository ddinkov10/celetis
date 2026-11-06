---
{
  "schema": 1,
  "name": "a-moved-check-keeps-the-states-of-its-old-rule",
  "description": "A moved liveness check of the daemon used a narrower state test, twice: a repeated Retry and a takeover got a false refusal",
  "tags": [
    "process",
    "recurring",
    "false-negative"
  ],
  "date": "2026-11-06",
  "status": "active",
  "source": "Task 1 review of #248 (ddinkov10/celetis), implementer reproduction with a base-program control",
  "incidents": [
    {
      "id": "1147cca4-f385-4d0d-bfb2-92b81e0b19fb",
      "date": "2026-11-06",
      "action": "The #248 plan (Task 1, Step 4) defined the daemon's `waiting(record)` for a Retry as: an entry of this daemon with `view().issue === number` and `view().state === 'quota-wait'`. The implementer built it as specified (engine/lib/daemon-server.ts, commit 141080f).",
      "expected": "Spec call 2 of #248: '`--retry` becomes a request. The daemon writes the recovery record in-process (the rules of `retryQuota` stay)'. Today's rule (`recoveryOwner`: the waiting runner process still runs) accepts a repeated Retry of the same wait ID after the wake, with exit 0.",
      "observed": "After the first Retry woke the wait, the run moved to `starting`/`running`, and a second Retry of the same wait ID got 409 `recovery: the runner of #1 no longer runs; start the runner again`, code 2.",
      "source": {
        "kind": "tool-output",
        "excerpt": "retry-twice.ts at 141080f, lab celetis-lab-1e41b6: second -> {\"status\":409,\"body\":{\"accepted\":false,\"line\":\"recovery: the runner of #1 no longer runs; start the runner again\",\"code\":2}}; control (base CLI) -> {\"code\":0,\"stdout\":\"celetis-flow: #1: Retry requested; the waiting runner starts one bounded attempt cycle\"}",
        "reference": "ddinkov10/celetis#248, Task 1 review, commit 141080f"
      },
      "inference": "Inferred: the planner replaced the process-liveness test of the old runner with a test of one run state, so that a stale record of an ended run inside a live daemon is refused (the lesson recheck-process-liveness-claims-in-a-long-lived-process). The planner checked the stale case but not the states that the old rule accepted after the wake (starting, running) or during a takeover. Alternative: the planner read 'waits' as 'is in quota-wait'. The planning transcript was not read.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "141080f",
      "brief": "Task 1 brief, Step 4: \"`waiting(record)` is: when `record.runner` is the identity of this daemon (PID and start), whether an entry of this daemon has `view().issue === number` and `view().state === 'quota-wait'`; else `recoveryOwner(record)`.\" The brief did not carry plan-condition-must-not-narrow-a-spec-rule.",
      "lesson": {
        "name": "plan-condition-must-not-narrow-a-spec-rule",
        "revision": "5954d3c",
        "digest": "6b5368a17a703d36bc27ed4fec41be2639d8729dab5cf59ba93344b624e82786"
      }
    },
    {
      "id": "d8bae566-3a90-4051-bb0c-c89c2263d287",
      "date": "2026-11-06",
      "action": "The #248 coordinator ruled the round-1 fix predicate of Task 1 as 'an entry of this daemon for the issue whose state is not ending, finished, or taken-over', from the first task review's suggestion, and the fixer built it (engine/lib/daemon-server.ts `over` table, commit ee51b79).",
      "expected": "Spec call 2 of #248 keeps the rules of `retryQuota`: the old rule accepted a Retry while the waiting runner process ran, also during a takeover of the wait.",
      "observed": "`mark('taken-over')` has one call site, the first statement of `takeOver` (engine/lib/run-engine.ts:1594), the start of a live takeover run of this daemon; no end path sets it. So the predicate refuses a duplicate Retry during a takeover with 'recovery: the runner of #<n> no longer runs; start the runner again', code 2.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Scoped re-review of fix round 1 at ee51b79: \"Important. engine/lib/daemon-server.ts:60 ('taken-over': true) ... treats a live run as ended. mark('taken-over') has one call site, the first statement of takeOver (run-engine.ts:1594).\" Source read by the coordinator: run-engine.ts:1593-1594 `const takeOver = async (record: RunRecord): Promise<RunEnd> => { mark('taken-over');`.",
        "reference": "ddinkov10/celetis#248, Task 1 fix rounds 1 and 2, commits ee51b79 and its successor"
      },
      "inference": "Inferred: the reviewer read the state name 'taken-over' as 'taken over by another daemon' (ended here), and the coordinator accepted the suggestion without a read of the call site. Not a behavioral run: the takeover window was not reproduced. Second failed fix of the same problem (the state set of a moved liveness check).",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ee51b79"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "d9424317-5ac2-4f4f-89f1-1d4790f980f3",
      "requestDigest": "3350cdab42071c2e6b1b215a6df828c06375d06ae8abf5a1fc1f9dc1c3e1fd3d",
      "date": "2026-11-06",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #271; claude child opus/high\n\nApprove, under the reviewer rules: two observed incidents (a base-program control of a repeated Retry, and a read of the only call site of mark('taken-over')) show one fault, and the root cause is labeled as inference with its alternative. The rule states applicability, action, and check, grants no permission, and weakens no check. It is compatible with recheck-process-liveness-claims-in-a-long-lived-process, which ends the claims of ended work, and it adds to plan-condition-must-not-narrow-a-spec-rule the specific act for a moved liveness check: take the accepted states from each call site that sets them, not from their names; so no active lesson states the same rule. The structural follow-up stays proposed.",
      "related": [
        "a-moved-check-keeps-the-states-of-its-old-rule"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up named in the Fix, which needs separate authorization: the acceptance coverage review of the plan step compares each moved check with the accept set of its old rule."
      }
    }
  ]
}
---
# A moved check keeps every state that its old rule accepted

## What happened

In #248, the plan moved the owner check of a quota Retry from the old runner process into the
daemon. The old rule accepted a Retry while the waiting runner process ran. The plan replaced it
with one run state (`quota-wait`). After the first Retry woke the wait, the run left that state, so
a repeated Retry of the same wait ID got `recovery: the runner of #1 no longer runs; start the
runner again`, code 2. The base program accepts the same Retry with exit 0. The spec said that the
rules of `retryQuota` stay.

## Root cause

Inferred, not established: the plan aimed to refuse a stale record of an ended run inside a live
daemon, and it tested only that case. It did not list the states in which the old rule accepted the
request (after the wake, during a takeover). The planning transcript was not read. The first
fix then excluded `taken-over` by its name; the name reads as an end, but `takeOver` sets it at
the start of a live takeover run. Both faults chose the states by a name or one case, not by a
read of every call site that sets the state. This recurs the
shape of plan-condition-must-not-narrow-a-spec-rule: a plan narrowed a rule that the spec kept.

## Fix

Proposed prevention (text, not enforced): when a change moves a check from a short-lived process
into a long-lived one, list each state in which the old check accepted, and keep each of them
accepted unless the spec excludes it. A proposed follow-up, which needs separate authorization: the
acceptance coverage review of the plan step compares each moved check with its old accept set. The
choice of the states needs judgment about the old process lifetime, so the rule stays text.

## Detection signature

A plan replaces a process-liveness test with a test of one state value (`state === ...`), with a
probe that covers the stale case but no repeated or in-flight request.

## Rule

Applies when a change moves a liveness or owner check from a process that exits with its work into
a long-lived process, and the spec keeps the old rule. Action: list every state of the work in which
the old check accepted, from each call site that sets the state, not from its name, and accept each of them in the new check, while the new check refuses only
the work that ended. Check: a probe sends the request in each listed state (also a repeat after the
first request took effect) and compares the line and code with the old program.

## Related lessons

[[plan-condition-must-not-narrow-a-spec-rule]]
[[recheck-process-liveness-claims-in-a-long-lived-process]]
