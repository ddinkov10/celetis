---
{
  "schema": 1,
  "name": "derive-fixture-state-from-real-producers",
  "description": "Runtime fixtures expected derived state without using or confirming the real state producer",
  "tags": [
    "e2e",
    "config",
    "process",
    "test",
    "recurring",
    "ui"
  ],
  "date": "2026-11-07",
  "status": "active",
  "source": "implement session of #310 (Verify phase), 2026-11-13\n\nImplementation verification of ddinkov10/celetis#287\n\nTask 2 of ddinkov10/celetis#250, implement step session (child report to the coordinator)\n\nTask 3 of ddinkov10/celetis#141 (implement session, child t3-impl); recorded by the coordinator\n\nImplementation of ddinkov10/celetis#245, temporary verification correction",
  "incidents": [
    {
      "id": "5b0d7c1e-3f2a-4c8e-9a61-7d2e4b9f0310",
      "date": "2026-11-13",
      "action": "The Task 1 harness started a read-only board in a Herdr lab with a fake gh, but with no claude or codex on the board PATH; Tasks 2-7 probes and the first Verify run (V1-V9 and 23 captures) ran on it.",
      "expected": "The probe board shows the same enabled Run and Open agent rows and buttons as the real board, so the V8 oracle 'Go to #<n> first, Run rows follow' and the V7 look captures can be judged.",
      "observed": "The lab board reported 'celetis: claude is not on PATH'; Search #119 listed only 'Show the details' under 'Actions for #119', with no Run rows, and the Run and Open agent buttons in all captures were grey (disabled). After adding fake claude/codex (print a version, start nothing) to the lab PATH, the same search listed 'Run triage on opus at medium', 'Run #119 with claude', 'Run #119 with codex', and the whole Verify run and all captures had to be renewed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "lab board: \"celetis: claude is not on PATH\"; Actions for #119 holds only \"Show the details\" and no Run rows",
        "reference": "https://github.com/ddinkov10/celetis/issues/310#issuecomment-6863157921"
      },
      "inference": "The harness derived the card states from the real producers (readBoard, place) but not the host-availability input of the board, which gates the Run actions. Uncertain whether an earlier task probe that asserted an Enter result on a Run action passed for the wrong reason; Task 3 'enter' used a Go action.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "e277ce319936cde4be328a4c1e9826777ae53448",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "e277ce3",
        "digest": "62157e607b579ae5952f87acc0d3ea41274ee242fa66ef0a83f8985f0891bd2d"
      }
    },
    {
      "id": "1b47ed80-9522-46b0-b863-21e64039221e",
      "date": "2026-11-10",
      "action": "The V3 probe changed fixture gates and immediately read /api/board. After the cached manual value failed the auto assertion, its first repair polled that GET for 40 seconds without requesting refresh.",
      "expected": "Each configuration case checks a board snapshot produced from that case, through the supported refresh operation.",
      "observed": "The initial baseline and changed runs reported manual/me instead of auto. The repaired runs failed with AssertionError: fresh board configuration auto. engine/board/reads.ts uses BACKGROUND_MS = 300_000; beforeBoard serves its current snapshot, while POST /api/refresh awaits reads.refresh().",
      "source": {
        "kind": "tool-output",
        "excerpt": "Initial board-manual.log: 'manual' !== 'auto'. Repaired board-manual-fresh.log: AssertionError: fresh board configuration auto. Source reads.ts: BACKGROUND_MS = 300_000; perimeter.ts /api/refresh: await reads.refresh().",
        "reference": "https://github.com/ddinkov10/celetis/issues/287"
      },
      "inference": "Inferred: the probe treated a successful read as a new production of configuration state. The retry changed only the wait duration, retaining that premise. No product defect was established.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "d202da5567890379c7e2e663b367d04f430b688d",
      "brief": "Task 1 carried derive-fixture-state-from-real-producers; V3 changes fixture gate configuration and checks actual board output.",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "d202da5567890379c7e2e663b367d04f430b688d",
        "digest": "64f614a98cec93390990e94c5d0f26d7a9dd0180bc74c672483b790c9d8fa27f"
      }
    },
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
  "recurrences": 4,
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
    },
    {
      "id": "b64a2625-1adf-42d1-9bf9-1ef38dfc8974",
      "requestDigest": "1a2fecd85c89bb990aef441506d0b2fc1bf8bd67c66945268514bbf4c04c977d",
      "date": "2026-11-10",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #287; codex child host default/high\n\nMerge under the reviewer rule for the same active rule: trace the derived fixture state to its real producer and reach that state before accepting the check. The proposal applies this rule to a cached model and a missing refresh completion. Retain the observed failed assertions and source excerpt, every incident, original source, and prior review. Keep the claimed successful-read assumption and exact timing uncertainty separate from observations. Add the specific cached-model action and independent freshness check to the survivor. check-refresh-causes-before-first-document concerns scheduler retry causes, so its rule remains separate and compatible. The merged rule agrees with AGENTS.md, runtime-verification, and test-behavior-not-implementation; it grants no new act or tracked test and weakens no gate. Any helper stays proposed.",
      "related": [
        "refresh-the-board-before-checking-new-fixture-config",
        "derive-fixture-state-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A reusable temporary board fixture helper could change configuration, await the supported refresh operation, and compare the new model. Such structural work needs separate authorization and adds no tracked test in this review."
      }
    },
    {
      "id": "2b6af16a-fc5e-42fc-b05b-64b5a68f6d73",
      "requestDigest": "fb63efd822cf96a7953e9f50bf2a92b77600a9456cdc360c87293318b9fab9df",
      "date": "2026-11-13",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #310; claude child opus/high\n\nMerge under the reviewer rule for the same active rule: the active lesson derive-fixture-state-from-real-producers says to trace a derived state that a fixture must produce to its real producer, and to reach that state before the check accepts the result. The enabled Run and Open agent controls of the board are such a derived state, and the host commands on PATH are an input of its producer; the proposal itself names this lesson as the rule that the harness did not apply (diagnosis wrong-or-incomplete-rule). The retained output \"celetis: claude is not on PATH\" and the Actions for #119 list with only \"Show the details\" establish the incident. The survivor keeps the active name and every incident, source, and review, and adds the enabled-control case to the applicability, the action, and the check, with the detection signature of the proposal. The cause stays labeled as inference, with its alternative and its uncertainty. probe-real-tool-semantics-behind-fakes concerns the target inputs of a faked call, so it stays separate and becomes a related lesson. The rule adds a check, weakens none, adds no network or credential act, and agrees with AGENTS.md, \"Host checks\", and the principle test-behavior-not-implementation of the plugin celetis.",
      "related": [
        "give-a-probe-board-the-host-commands-of-the-real-board",
        "derive-fixture-state-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A harness smoke step could fail a probe board that prints `is not on PATH` before the first probe. Such structural work needs separate authorization and adds no tracked test in this review."
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

In #287, a V3 board probe changed fixture gate configuration and read `/api/board`. Its auto case saw the previous manual snapshot. A repair polled the same GET for 40 seconds and failed again. The retained source excerpt shows a 300-second background interval and a supported `POST /api/refresh` operation that awaits the read refresh. No product defect was established.

In the Verify phase of #310 on 2026-11-13, the harness started a read-only board in a Herdr lab with a fake `gh` and an adapter that rejects every start, but with no `claude` or `codex` on the board PATH. The board printed `celetis: claude is not on PATH` and disabled each Run and Open agent control. Task probes and the first Verify run (V1-V9 and 23 captures) ran on that board. The V8 check of an Idle card found only `Show the details` under `Actions for #119`, and every capture showed grey Run buttons. With fake `claude` and `codex` (print a version, start nothing) on the lab PATH, the same search listed the Run rows, and the whole Verify run and its captures were renewed.

## Root cause

The source and retained output establish the #245 mismatch. Inferred: the fixture author assumed a boundary without reading its actual producer. No wider product defect is established.

In #141, reported by the implementer and inferred: a shared command helper added an input (`--agent claude`) that the derived state depends on, and the case did not read the stored input of the producer before the wait. Uncertain: whether the helper or the case setup should own the choice.

In #250, observed: the run request of the daemon answers at admission, before `hc run` of its tab, so a block in `hc run` does not hold the answer. Reported by the child: the brief named the fixture concretely, and the child treated it as already derived. Inferred by the coordinator: the plan derived the wait from the spec's open-risk text, not from the answer point in the producer. Uncertain: whether the plan session read the answer point.

For #287, inferred: the probe treated a successful cached GET as a new production of the model. The second attempt kept that premise and changed only the wait. The exact timing of the first read is uncertain.

In #310, inferred: the harness derived the card states from the real producers, but missed one input of the board, the host commands on PATH, which gates the Run and Open agent controls. The harness author did not count host availability as an input of a derived state. Alternative: the brief named only `gh` and the adapter as fakes. Uncertain: whether an earlier task probe that asserted an Enter result on a Run action passed for the wrong reason; the Task 3 enter case used a Go action.

## Fix

The temporary checks were corrected against the existing source. Proposed prevention remains text because derived state producers vary by project and by state. No new enforcement is claimed.

Proposed in #141, not enforced: before a case waits for a derived state, read the input that its producer stored (there `input.selection` of the run record) and compare it with the input that the derivation needs.

Proposed in #250, not enforced: before a case or a plan needs a request in flight, read the answer point of that request in its producer and choose a block that comes before it. Observe "unanswered" directly at the moment of the event (the connection state, or a fixture log line written before the answer), not by a promise flag read between other samples. The choice of the block depends on the request path, so the rule stays text.

Proposed in #287, not enforced: after changing inputs behind a cached read model, use the supported refresh producer and its completion boundary before the assertion. Retain the old snapshot, the completion, and the new independently expected values. A reusable fixture helper remains proposed work that needs separate authorization.

Proposed in #310, not enforced: before the first probe, compare the probe board with the real board for each control that a case acts on or a capture shows, and give the probe process each host command that the page checks, as a fake that answers its read and starts nothing. A harness smoke step that fails when the board prints `is not on PATH` remains proposed structural work that needs separate authorization.

## Detection signature

The board prints `celetis: <host> is not on PATH`; Run and Open agent controls are disabled; a Search for an Idle card lists no Run rows.

## Rule

Applies when a runtime fixture must produce a derived state for a check, including a cached read model after its inputs change, a request that must still be unanswered at a later event (a stop, a restart, a timeout), and the enabled state of a control that a case uses or a capture shows. Action: trace that state to its real input producer, and choose inputs that satisfy the existing derivation. For a cached model, trace and use the supported refresh producer and its completion boundary before asserting the new model; a successful cached read alone is no evidence of refresh. When a shared helper starts the producer, read the input that the producer stored (for example the selection of a run record) before the case waits, and stop the case when it differs from the input that the derivation needs. For a request in flight, find the point where its producer answers, put the block before that point, and observe the unanswered request directly when the event begins. For a control of a page, list each external command and service that the page reads to enable it (for the Celetis board, the host commands `claude` and `codex` on PATH), and give the probe process a fake of each that answers its read and starts nothing. Check: for a cached model, retain the old snapshot, refresh completion, and new independently expected values, and do not accept a no-refresh control as fresh evidence. The case output shows the stored input next to the expected input before the wait, and shows a request in flight still unanswered when the event begins; a control with the block after the answer point fails that observation; before the first probe, the page shows no unavailable-host message, and each control that a case uses or a capture shows is enabled as on the real board; and the fixture reaches the required state before the check accepts the scenario result.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]]
[[probe-real-tool-semantics-behind-fakes]]
