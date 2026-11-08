---
{
  "schema": 1,
  "name": "keep-a-bounded-heartbeat-while-children-work",
  "description": "A coordinator ended its turn on a child idle notice that waited on a monitor, so a child with a passing probe sat idle 20 minutes until the human asked",
  "tags": [
    "process",
    "performance"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Human report in the #276 implement step session (ddinkov10/celetis#276), Task 3",
  "incidents": [
    {
      "id": "642a49a0-9081-453b-9184-58700ed1172d",
      "date": "2026-11-08",
      "action": "The #276 implement coordinator got the Task 3 implementer's idle notice ('The GREEN run of line-probe.ts is still running. I'll continue when the monitor reports its result.') and ended its turn with no bounded wait or reconciliation of its children.",
      "expected": "While a child works, the coordinator waits in bounded stretches (the subagent-driven-development skill: five to ten minutes) and reconciles each child after a stretch, so an idle child with a finished task is noticed within minutes.",
      "observed": "The probe ended at 02:21 with 'line: PASS (35 checks)'; ListAgents showed the child idle at 02:40 with no probe process and no file written after 02:21; the human asked 'is anything running' and only then did the coordinator wake the child.",
      "source": {
        "kind": "user-report",
        "excerpt": "Human: 'so if i didn't wake up it will be idle until i see the session :( sad'; tool: /private/tmp/celetis-276-checks/green-t3-0.out ends 'line: PASS (35 checks)' at 02:21; ListAgents 02:40 't276-task3-impl … idle'",
        "reference": "ddinkov10/celetis#276 implement session; .superpowers/sdd/276/progress.md (Task 3 lines)"
      },
      "inference": "Inferred: the coordinator treated the child's idle notice as progress and relied on a later notification, but the child's own monitor did not wake it, so neither side had a wake source. The skill rule on bounded waits existed in the loaded skill text; no Celetis lesson carried it.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "50a08c0"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c8eed108-f491-46f9-9675-a0c9f24f22b8",
      "requestDigest": "f8b1ee380e44be35259906f603a893bb66f1beba714c72d0592651250f15df32",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #276; claude child opus/high\n\nApprove, under the reviewer rules: the human report and the retained tool output (the probe file ends 'line: PASS (35 checks)' at 02:21, and ListAgents showed the child idle at 02:40) establish the incident, and the root cause is labeled as inference. The rule states applicability, action, and check. It agrees with the bounded-wait rule of superpowers:subagent-driven-development, which the implement skill of the plugin celetis invokes for its subagent flow (wait in stretches of five to ten minutes, then reconcile the live children), and with docs/procedures/dispatch.md, which says to wait for the real completion of a child. It grants no permission, adds no network or credential act, and weakens no check or gate. No active or historical lesson states the same rule. The structural follow-up stays proposed.",
      "related": [
        "keep-a-bounded-heartbeat-while-children-work"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up named in the Fix, which needs separate authorization: the step session or the dispatch engine re-invokes the coordinator when a child of the task loop stays idle with no report for a bounded time."
      }
    }
  ]
}
---
# Keep a bounded heartbeat while children work

## What happened

In the #276 implement session, the Task 3 implementer reported idle with "The GREEN run of `line-probe.ts` is still running. I'll continue when the monitor reports its result." The coordinator ended its turn and waited for a notification. The probe ended at 02:21 with `line: PASS (35 checks)`, but the child's monitor did not wake it. At 02:40 `ListAgents` showed the child idle, no probe process ran, and no file had changed since 02:21. The human asked whether anything was running; only then did the coordinator wake the child.

## Root cause

Inference: the coordinator took an idle notice that names a pending wait as progress, and relied on the child's own wake source. When that source failed, no actor had a wake source. The subagent-driven-development skill already says to wait in bounded stretches and reconcile the children; the coordinator did not follow it.

## Fix

The coordinator now starts a background heartbeat (a bounded sleep that re-invokes it) while a child works, and on each wake checks `ListAgents`, the probe processes, and the child's files. Proposed structural follow-up, which needs separate authorization: the step session or the dispatch engine could re-invoke the coordinator when a child of the task loop stays idle with no report for a bounded time. No enforcement is proven.

## Rule

Applies when a coordinator waits for a child agent, and in particular when a child goes idle with a notice that it waits for its own monitor or background job. Action: keep your own bounded wake source (at most about ten minutes) for as long as a child of the task works; at each wake, compare the child state, its processes, and its newest files, and resume an idle child whose wait already ended. Check: after a child idle notice, the coordinator has a scheduled wake before its turn ends, and an idle child with a finished job is resumed within one wake interval.
