---
{
  "schema": 1,
  "name": "derive-fixture-state-from-real-producers",
  "description": "A raw fixture label did not produce the board state required by a transition check, and a shared helper stored an explicit agent where a fixture run needed the default choice",
  "tags": [
    "test",
    "process",
    "e2e",
    "recurring"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 3 of ddinkov10/celetis#141 (implement session, child t3-impl); recorded by the coordinator\n\nImplementation of ddinkov10/celetis#245, temporary verification correction",
  "incidents": [
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
  "recurrences": 1,
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
    }
  ]
}
---
# Derive fixture state from its real producer

## What happened

The temporary #245 driver added ready-for-agent to an unstarted bug issue and waited for the card to move from Idle to Needs you. The wait timed out. data.ts derives started from a later stage and urgent from hotfix; PLACERS.ready uses started or urgent, so ready-for-agent alone leaves the card in Idle.

In Task 3 of #141 on 2026-11-06, the records probe started a quota-wait run of its fixture through a shared helper that adds `--agent claude`. The run record then held `"selection":{"explicit":"claude"}` in place of the default choice, and the fixture did not reach the state that the case needed. The implementer saw the stored input in the first RED output, stopped that attempt, and corrected the probe before any evidence was accepted. The task brief carried this lesson.

## Root cause

The source and retained output establish the mismatch. Inferred: the fixture author assumed a boundary without reading its actual producer. No wider product defect is established.

In #141, reported by the implementer and inferred: a shared command helper added an input (`--agent claude`) that the derived state depends on, and the case did not read the stored input of the producer before the wait. Uncertain: whether the helper or the case setup should own the choice.

## Fix

The temporary check was corrected against the existing source. Proposed prevention remains text because derived state producers vary by project and by state. No new enforcement is claimed.

Proposed in #141, not enforced: before a case waits for a derived state, read the input that its producer stored (there `input.selection` of the run record) and compare it with the input that the derivation needs.

## Rule

Applies when a runtime fixture must produce a derived state for a check. Action: trace that state to its real input producer, and choose inputs that satisfy the existing derivation. When a shared helper starts the producer, read the input that the producer stored (for example the selection of a run record) before the case waits, and stop the case when it differs from the input that the derivation needs. Check: the case output shows the stored input next to the expected input before the wait, and the fixture reaches the required state before the check accepts the scenario result.
