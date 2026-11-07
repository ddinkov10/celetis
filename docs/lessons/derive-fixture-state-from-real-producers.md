---
{
  "schema": 1,
  "name": "derive-fixture-state-from-real-producers",
  "description": "Fixtures did not produce the state that a check required: a raw label left a card in Idle, a shared helper stored an explicit agent, and a block held a run press after the daemon had answered it",
  "tags": [
    "test",
    "process",
    "e2e",
    "recurring"
  ],
  "date": "2026-11-07",
  "status": "active",
  "source": "Task 2 of ddinkov10/celetis#250, implement step session (child report to the coordinator)\n\nTask 3 of ddinkov10/celetis#141 (implement session, child t3-impl); recorded by the coordinator\n\nImplementation of ddinkov10/celetis#245, temporary verification correction",
  "incidents": [
    {
      "id": "94d13517-e442-49d2-8cd4-ab39af3120ab",
      "date": "2026-11-07",
      "action": "The Task 2 implementer wrote probe case (h), a board Run press that waits for its answer when the update restart begins, from the plan's fixture text (daemon-bin/hc with fx/data/hc-run-blocks) and its oracle (the press gets the stop line), without tracing where the press waits. Two runs failed on the same case.",
      "expected": "The case holds the press before the daemon answers it, so the restart begins while the press waits.",
      "observed": "green-1: the run refused before hc run, because the plugin metadata named B while the daemon ran A' (the session plugin check). green-2: the press answered 200 {\"ok\":true} before the restart, because the daemon answers a run request before the tab opens; the setup guard passed because the answer promise settled after the process-table read.",
      "source": {
        "kind": "tool-output",
        "excerpt": "green-2/green-2.out: check (h) setup: the run of the press waits in hc run: PASS, then check (h) the press gets the stop line ...: FAIL {\"status\":200,\"body\":{\"ok\":true}}",
        "reference": "docs/superpowers/verification/250-t2/green-2/ of the lane feat/250-host-the-board-server-the; Task 2 report in the runtime report of #250"
      },
      "inference": "Reported by the child: the brief named the fixture concretely, and the child treated it as already derived. Inferred by the coordinator: the plan derived the wait from the spec's open-risk text (up to 120 seconds for a run request) and not from the answer point of the run request in the daemon; so both the plan and the first two runs skipped the trace. Uncertain whether the plan session read the answer point.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "b32bf78",
      "brief": "The Task 2 brief carried derive-plan-oracle-values-from-real-producers (sha256:82374a5e...) and derive-fixture-state-from-real-producers (sha256:ce2880a0...) with their rules (.superpowers/sdd/250/task-2-brief.md, Lesson rules).",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "b1c4a621bcd19a32f8badacd3515a039e560d318",
        "digest": "82374a5ef999ae3a64156d1c366b1c8de2160cb0d321e022fddb8d4122e121c3"
      }
    },
    {
      "id": "54868064-84e3-4b42-b637-5158819141f3",
      "date": "2026-11-06",
      "action": "The Task 3 records probe started the quota-wait issue #5 of its old-state fixture through a shared CLI helper (baseCli) that adds --agent claude.",
      "expected": "A run with the default agent choice, so that the run waits when both synthetic hosts are blocked, as the Task 2 probe move.ts starts it (celetis-flow 5 with no agent).",
      "observed": "The run record held \"selection\":{\"explicit\":\"claude\"}, so the fixture did not reach the planned state; the implementer stopped the RED attempt and corrected the probe before any evidence was accepted.",
      "source": {
        "kind": "tool-output",
        "excerpt": "check old state: the run record of #3 names its released session: FAIL [{… \"input\":{\"kind\":\"number\",\"number\":3,\"selection\":{\"explicit\":\"claude\"} …}]",
        "reference": "ddinkov10/celetis#141 Task 3 report, section Incidents (the first RED output was overwritten)"
      },
      "inference": "Reported by the implementer: a shared CLI helper that adds --agent claude hid the input that the derived state needs. Uncertain whether the helper or the case setup should own the choice.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "396d2a4",
      "brief": "The Task 3 lesson rules carried derive-fixture-state-from-real-producers (trace the state to its real input producer; confirm that the fixture reaches the required state).",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "396d2a4",
        "digest": "fa0750b7eb699d677cb04d9153641bf0226578b3d7e2c0b637ae867d2cecba2f"
      }
    },
    {
      "id": "56808cf1-ad1f-42c9-9cae-0d5498577b30",
      "date": "2026-11-05",
      "action": "The temporary #245 driver added ready-for-agent to an unstarted bug issue and waited for the card to move from Idle to Needs you.",
      "expected": "The scenario creates a real data change that moves another card between columns.",
      "observed": "The wait timed out. data.ts derives started from a later stage and urgent from hotfix; PLACERS.ready uses started or urgent, so ready-for-agent alone leaves the card in Idle.",
      "source": {
        "kind": "tool-output",
        "excerpt": "browser-second.json: V2 shrink, empty, focus, and details recorded, then TimeoutError: forFunction: Timeout 15000ms exceeded. data.ts:68-69 derives started and urgent; place.ts:95 selects Needs you only for started || urgent.",
        "reference": "ddinkov10/celetis#245; retained verification logs"
      },
      "inference": "The local mismatch is confirmed. The reason for the unchecked assumption is inferred; no broader cause is established.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa plus the Idle scroll fix"
    }
  ],
  "recurrences": 2,
  "reviews": [
    {
      "id": "6b06a4d9-8913-44c4-9181-015b1c981f26",
      "requestDigest": "bcf33c8389893662e01c8f442e7797f277c99c717fd3da994f5a9293027e46b1",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nEdit under the reviewer rules: the retained timeout and the source establish the incident; the lane's engine/board/data.ts derives started from a later stage and urgent from hotfix, and engine/board/place.ts places ready in Needs you only for started or urgent. No active or historical lesson states this rule. The edit makes the title a plain statement of the rule, removes an unrelated scan-boundary clause from the Fix, and states the rule as applicability, action, and check. The rule agrees with the test-behavior-not-implementation principle: the fixture exercises the real producer, and the check still observes the required state. Incident evidence stays unchanged.",
      "related": [
        "derive-fixture-state-from-real-producers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision."
      }
    },
    {
      "id": "ff1757e1-7636-4c87-aeca-a5363f0e3fb7",
      "requestDigest": "9302bff6c7644bfa22e86c1bfbb34e916e85f3e6dde6e665c857aba8fb5ecd7e",
      "date": "2026-11-06",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #274; claude child opus/high\n\nMerge, under the reviewer rules: the proposal states the rule of the active lesson derive-fixture-state-from-real-producers (trace a derived state to its real input producer, and confirm that the fixture reaches it) for one more input path, and its incident is a recurrence that the brief carried (diagnosis not-followed). The retained output \"the run record of #3 names its released session: FAIL\" with \"selection\":{\"explicit\":\"claude\"} establishes that a shared helper stored an explicit agent where the case needed the default choice; the implementer stopped the attempt before any evidence was accepted. The survivor keeps the active name and every incident and review, and adds the check of the stored input before the wait to the action and the check of the rule. The cause stays labeled as the inference of the implementer, with its uncertainty about the owner of the choice. The rule adds a check, weakens none, and widens no permission; it agrees with the principle test-behavior-not-implementation.",
      "related": [
        "check-the-stored-input-of-a-fixture-producer",
        "derive-fixture-state-from-real-producers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the fixture inputs vary by case. This decision requires no structural follow-up."
      }
    },
    {
      "id": "c2d35260-383f-451e-b78a-84b84b2b515b",
      "requestDigest": "f44156c02db2fb6ebece8626f65d7b7f4f459989466b4021421a3d75abcd2278",
      "date": "2026-11-07",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #250; claude child opus/high\n\nMerge under the reviewer rules: the active lesson derive-fixture-state-from-real-producers states the same rule (trace a derived state that a fixture must produce to its real producer, and confirm that the fixture reaches it before the check accepts the result); a request that is still unanswered at a later event is such a state, and the brief of the task carried the lesson (diagnosis not-followed). The incident is observed: the lane retains docs/superpowers/verification/250-t2/green-2/green-2.out with \"check (h) setup: the run of the press waits in hc run: PASS\" followed by the FAIL {\"status\":200,\"body\":{\"ok\":true}}, and green-3 retains the PASS with the 409 stop line. The block is a fixture choice, not an oracle value, so derive-plan-oracle-values-from-real-producers is the related lesson, not the target. The survivor keeps the active name and every incident and review, and adds the answer-point trace, the direct observation of the unanswered request, and a control with the block after the answer point. The causes stay labeled as the report of the child and the inference of the coordinator. The rule adds a check, weakens none, and agrees with the test-behavior-not-implementation principle of the plugin celetis.",
      "related": [
        "trace-the-answer-point-before-holding-a-request-in-flight",
        "derive-fixture-state-from-real-producers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the answer point and the block depend on each request path. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Derive fixture state from its real producer

## What happened

The temporary #245 driver added ready-for-agent to an unstarted bug issue and waited for the card to move from Idle to Needs you. The wait timed out. data.ts derives started from a later stage and urgent from hotfix; PLACERS.ready uses started or urgent, so ready-for-agent alone leaves the card in Idle.

In Task 3 of #141 on 2026-11-06, the records probe started a quota-wait run of its fixture through a shared helper that adds `--agent claude`. The run record then held `"selection":{"explicit":"claude"}` in place of the default choice, and the fixture did not reach the state that the case needed. The implementer saw the stored input in the first RED output, stopped that attempt, and corrected the probe before any evidence was accepted. The task brief carried this lesson.

In Task 2 of #250 on 2026-11-07, probe case (h) needed a board Run press that still waits for its answer when the daemon restarts. The plan named the block: a fixture `hc` that blocks `hc run` while a flag file exists, and the implementer used it. Two runs failed on the case. In green-1, the run refused before `hc run` because of the session plugin check. In green-2, the daemon answered the press with `200 {"ok":true}` before the restart, because the daemon answers a run request before the tab opens; the setup guard `the run of the press waits in hc run: PASS` read a promise flag between process-table samples and passed. The third attempt held the first decision read of the run (a slow fake GitHub read) instead, and the press got the stop line. The task brief carried this lesson and derive-plan-oracle-values-from-real-producers.

## Root cause

The source and retained output establish the #245 mismatch. Inferred: the fixture author assumed a boundary without reading its actual producer. No wider product defect is established.

In #141, reported by the implementer and inferred: a shared command helper added an input (`--agent claude`) that the derived state depends on, and the case did not read the stored input of the producer before the wait. Uncertain: whether the helper or the case setup should own the choice.

In #250, observed: the run request of the daemon answers at admission, before `hc run` of its tab, so a block in `hc run` does not hold the answer. Reported by the child: the brief named the fixture concretely, and the child treated it as already derived. Inferred by the coordinator: the plan derived the wait from the spec's open-risk text, not from the answer point in the producer. Uncertain: whether the plan session read the answer point.

## Fix

The temporary checks were corrected against the existing source. Proposed prevention remains text because derived state producers vary by project and by state. No new enforcement is claimed.

Proposed in #141, not enforced: before a case waits for a derived state, read the input that its producer stored (there `input.selection` of the run record) and compare it with the input that the derivation needs.

Proposed in #250, not enforced: before a case or a plan needs a request in flight, read the answer point of that request in its producer and choose a block that comes before it. Observe "unanswered" directly at the moment of the event (the connection state, or a fixture log line written before the answer), not by a promise flag read between other samples. The choice of the block depends on the request path, so the rule stays text.

## Rule

Applies when a runtime fixture must produce a derived state for a check, including a request that must still be unanswered at a later event (a stop, a restart, a timeout). Action: trace that state to its real input producer, and choose inputs that satisfy the existing derivation. When a shared helper starts the producer, read the input that the producer stored (for example the selection of a run record) before the case waits, and stop the case when it differs from the input that the derivation needs. For a request in flight, find the point where its producer answers, put the block before that point, and observe the unanswered request directly when the event begins. Check: the case output shows the stored input next to the expected input before the wait, and shows a request in flight still unanswered when the event begins; a control with the block after the answer point fails that observation; and the fixture reaches the required state before the check accepts the scenario result.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]]
