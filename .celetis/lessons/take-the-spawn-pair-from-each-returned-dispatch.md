---
{
  "schema": 1,
  "name": "take-the-spawn-pair-from-each-returned-dispatch",
  "description": "A reviewer spawn helper hard-coded the model sonnet, the issued pair was opus/medium, the engine saved a mismatch, and every later dispatch act of the session stopped with setup exit 6",
  "tags": [
    "process"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "The implement session of #368 on 2026-11-25 (the coordinator, Task 5 reviewer dispatch).",
  "incidents": [
    {
      "id": "4b027603-51dc-49af-a42b-0cf832e1dc51",
      "date": "2026-11-25",
      "action": "The coordinator spawned the Task 5 reviewer through a helper that always passed model \"sonnet\" and effort \"medium\" to Agent, instead of the pair of the returned dispatch.",
      "expected": "The spawn applies pair.model and pair.effort of the dispatch that the engine returned (opus/medium for the Task 5 reviewer, CAP J1 V1 B2 N1 S2 X0 = 7).",
      "observed": "dispatch report saved a mismatch and printed \"dispatch: setup: dispatch 25e4b35d-433e-49cd-9edb-5a30f8803f99: the spawn model must be opus\" with exit 6; dispatch next for the same task then gave the same setup refusal, so no later task act of the session could run.",
      "source": {
        "kind": "tool-output",
        "excerpt": "dispatch: setup: dispatch 25e4b35d-433e-49cd-9edb-5a30f8803f99: the spawn model must be opus [exit 6]"
      },
      "inference": "Inferred: the helper was written when Tasks 1 to 4 all had the reviewer pair sonnet/medium, so the literal matched each earlier dispatch and the defect stayed hidden until the first task with another pair. Alternative: the helper was copied from the implementer helper, which did read the pair; the evidence does not separate the two.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "6cc4f7e",
      "lesson": {
        "name": "copy-the-native-model-into-a-dispatch-report",
        "revision": "6cc4f7e",
        "digest": "56431fa8b5505d99718584499adb96ad0f70638a499ac5229c1d96f60aa7dee0"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "0e635db4-2b60-424c-8023-e60756005b6d",
      "requestDigest": "302b12e80410b4aaf6c023b6b21780aa09ebc21123b9790c55582dd2708a6a0e",
      "date": "2026-11-25",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #368; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed tool output: dispatch report exited 6 with \"the spawn model must be opus\" after a reviewer helper passed the literal model sonnet for a dispatch with the pair opus/medium. The rule states applicability, action, and check. It agrees with dispatch.md of the plugin celetis (\"apply pair.model and pair.effort with the host's actual spawn controls, and omit the model field when it is null\"), widens no permission, weakens no check, and adds no network or credential act. No live or historical lesson holds the incident or states the rule: copy-the-native-model-into-a-dispatch-report covers the outcome of the report after the spawn, and report-the-exact-arguments-of-a-dispatched-call covers the prompt of the report, not the spawn pair. The two causes stay labeled as inference.",
      "related": [
        "take-the-spawn-pair-from-each-returned-dispatch"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "An engine act that prints the exact spawn arguments of a ready dispatch, so that a session copies them and a helper cannot pass a literal model. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Take the spawn pair from each returned dispatch

## What happened

The implement session of #368 ran the subagent task loop. Its implementer helper passed `pair.model` and `pair.effort` of each returned dispatch to `Agent`. Its reviewer helper passed the literal model `sonnet` and effort `medium`. Tasks 1 to 4 had the reviewer pair sonnet/medium, so each report matched. Task 5 had the pair opus/medium. `dispatch report` saved a mismatch and exited 6 with `the spawn model must be opus`. The engine then refused each later dispatch act of the session, because a saved mismatch blocks the whole record of the host session. The session stopped the wrong reviewer before it gave a verdict.

## Root cause

Inferred: the literal matched every earlier dispatch, so no earlier report showed the defect. Alternative: the reviewer helper was written separately from the implementer helper and did not copy its pair read. The evidence does not separate the two.

## Fix

Proposed prevention, not enforced: a spawn helper takes the model and the effort only from the returned dispatch, never from a literal or a parameter with a default. The only enforcement is the refusal of `dispatch report`, which comes after the spawn and stops the session. A structural follow-up that needs separate authorization: an engine act that prints the exact spawn arguments of a ready dispatch, so a session copies them. Check: a helper that passes a model other than `pair.model` is refused before the spawn.

## Detection signature

`the spawn model must be`

## Rule

Applies when a session spawns or replaces a child of a task-loop dispatch, in a helper or by hand. Action: set the spawn model to `pair.model` and the effort to `pair.effort` of the dispatch that the engine returned for that call, and omit the model when it is null; never use a literal or a default. Check: before the call, the spawn arguments equal the pair of the returned dispatch, for each role and each task.

## Related lessons

[[copy-the-native-model-into-a-dispatch-report]]
