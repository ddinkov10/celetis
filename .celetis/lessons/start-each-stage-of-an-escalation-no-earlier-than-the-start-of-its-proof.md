---
{
  "schema": 1,
  "name": "start-each-stage-of-an-escalation-no-earlier-than-the-start-of-its-proof",
  "description": "A stage clock anchored at a past act skips stages when the proof starts late",
  "tags": [
    "process"
  ],
  "date": "2026-11-19",
  "status": "active",
  "source": "implement session of #343, Task 1 task review and its coordinator reproduction",
  "incidents": [
    {
      "id": "e464e8a3-8adb-408e-81cc-375601dd187f",
      "date": "2026-11-19",
      "action": "The plan of #343 set the escalation of the ended attempt-end path at an absolute time, `stop.closedAt + stageMs`, with SIGKILL at `+ stageMs` and the final read at `+ 2 * stageMs`, and Task 1 implemented that formula in engine/lib/attempt-end.ts.",
      "expected": "SIGTERM, then SIGKILL 5 s later, then a final read of at most 5 s (spec of #343, \"The stages\" 4-6), also when the proof starts more than 5 s after the tab close.",
      "observed": "late.ts on 8b1c458 with closedAt 16 s in the past: `{\"kind\":\"unverified\",\"reason\":\"processes of the attempt still run after SIGKILL\",\"running\":[76166],\"signalled\":[]}`, the process still ran; with 11 s: SIGKILL with no SIGTERM.",
      "source": {
        "kind": "tool-output",
        "excerpt": "late 16000 ms: returned after 123 ms {\"kind\":\"unverified\",\"reason\":\"processes of the attempt still run after SIGKILL\",\"running\":[76166],\"signalled\":[]} service 76166 runs",
        "reference": "https://github.com/ddinkov10/celetis/issues/343"
      },
      "inference": "Inferred: the plan derived each stage time from the polite act alone and did not consider a proof that begins after the first stage times have passed; the fix 6771c42 clamps the escalation with Math.max(politeAt + stageMs, begun). Alternative: a relative clock that starts at the first read.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "8b1c458",
      "brief": "Plan of #343, Task 1, \"The stage driver\": escalation = politeAt + stageMs; Ended path with Stop evidence: politeAt = stop.closedAt.",
      "lesson": {
        "name": "start-a-grace-at-the-request-not-at-the-return-of-its-call",
        "revision": "7937d4c",
        "digest": "415a8aa9f2ffc0e84ec0a681d2e3072099fe10162892603bf7ca015ab8931901"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "9fb72ef2-feab-455a-a5ce-c0ada1601633",
      "requestDigest": "7ae750ed0cd7385e969bef5de1ec62638f94a482b1d9e9ac3cf1e65d59c7fc65",
      "date": "2026-11-19",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #343; claude child opus/high\n\nApprove (the reviewer rules): the proposal has observed tool-output evidence (late.ts on 8b1c458: an unverified result with no signal sent, and SIGKILL with no SIGTERM) and a rule that states applicability, action, and check. It widens no permission and weakens no check or gate. The related active lesson start-a-grace-at-the-request-not-at-the-return-of-its-call states a different, compatible rule (measure a grace from the start of the request call) and holds none of its incidents, so the proposal is neither a duplicate nor a merge.",
      "related": [
        "start-each-stage-of-an-escalation-no-earlier-than-the-start-of-its-proof"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up: the rule stays text, as its Fix section explains."
      }
    }
  ]
}
---
# Start each stage of an escalation no earlier than the start of its proof

## What happened

The plan of #343 fixed the stages of the attempt-end proof at absolute times from the tab close (`closedAt + 5 s` SIGTERM, `+ 10 s` SIGKILL, `+ 15 s` final read). A task review ran the ended path with `closedAt` 11 s and 16 s in the past. At 11 s the member got SIGKILL with no SIGTERM. At 16 s no signal went out, the member still ran, and the result was `unverified` with the reason `processes of the attempt still run after SIGKILL`, a stage that did not run.

## Root cause

Inferred: each stage time came from the earlier act alone. The proof can start later than that act (the session end can come up to 60 s after a Stop), so stages whose times had passed were skipped. Uncertain whether the plan session considered a late start.

## Fix

The change clamps the escalation to the start of the proof (`Math.max(politeAt + stageMs, begun)`), so each later stage keeps its full period. Proposed prevention only: a plan or code review asks for one probe with the anchor act far in the past. No structural check enforces this; it stays text because the anchor and the work differ by case.

## Detection signature

A result names a stage (for example "after SIGKILL") while the record of acts lacks that stage, or a later stage runs with no earlier stage.

## Rule

Applies when code or a plan schedules a sequence of stages (a grace, a signal, a retry, a final read) at times derived from an act that happened before the work that runs the stages starts. Action: start the first stage no earlier than the start of that work, and give each later stage its full period from the stage before it. Check: a probe runs the sequence with the anchor act further in the past than the sum of all stage periods, and observes every stage in order and a result whose reason names only stages that ran.

## Related lessons

[[start-a-grace-at-the-request-not-at-the-return-of-its-call]]
