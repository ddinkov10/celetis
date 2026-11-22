---
{
  "schema": 1,
  "name": "copy-the-native-model-into-a-dispatch-report",
  "description": "A dispatch report wrote model null over a native resolvedModel, the engine saved a mismatch, and every later act of the session stopped with setup exit 6 (two sessions on 2026-11-22)",
  "tags": [
    "process",
    "recurring"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of issue #360, the dispatch report of Task 1",
  "incidents": [
    {
      "id": "dispatch-4047babc-5ce4-4f84-8f07-68cb549db929",
      "date": "2026-11-22",
      "action": "Reported outcome.model as null for an Agent spawn whose native result held resolvedModel claude-opus-5-5",
      "expected": "The report carries the native model verbatim, and dispatch report answers reported",
      "observed": "dispatch report exited 6 with a setup status, and the record refuses each later act of the session",
      "source": {
        "kind": "tool-output",
        "excerpt": "dispatch 4047babc-5ce4-4f84-8f07-68cb549db929: the reported model contradicts the native result (native result: \"resolvedModel\":\"claude-opus-5-5\"; reported outcome.model: null)"
      },
      "inference": "The session probably copied the literal null of the report shape in the dispatch module. The example result there has no model field, which can also mislead. The evidence does not separate these causes.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "eb049cb",
      "brief": "dispatch.md, Claude Code: Keep a native model ID verbatim when available; leave unreported model and effort null."
    },
    {
      "id": "dispatch-7ac740ab-8124-4c50-8850-67326db244f2",
      "date": "2026-11-22",
      "action": "Reported outcome.model as null for an Agent spawn whose native result held resolvedModel claude-haiku-5-5",
      "expected": "The report carries the native model verbatim, and dispatch report answers reported",
      "observed": "dispatch report exited 6 with a setup status, and the record refuses each later act of the session",
      "source": {
        "kind": "tool-output",
        "excerpt": "dispatch 7ac740ab-8124-4c50-8850-67326db244f2: the reported model contradicts the native result (native result: \"resolvedModel\":\"claude-haiku-5-5\"; reported outcome.model: null)"
      },
      "inference": "The helper of the session hard-coded the null of the report shape in the dispatch module. The session had read the module sentence that says to keep a native model ID. The pending proposal of #360 did not reach the session, because task retrieval reads only active lessons. The evidence does not show which factor weighed more.",
      "diagnosis": [
        "not-retrieved",
        "not-followed"
      ],
      "revision": "eb049cb",
      "brief": "dispatch.md, Claude Code: Keep a native model ID verbatim when available; leave unreported model and effort null.",
      "lesson": {
        "name": "copy-the-native-model-into-a-dispatch-report",
        "revision": "eb049cb",
        "digest": "2629c8d054eecd054f4b3161f8e9aa2897075edd815091d60ec116ccafaeeb9b"
      }
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "03da959b-09fb-4f6a-8c05-5493f1285ff3",
      "requestDigest": "6457b71ee1a4fef4a85ca772f6eba117dedc8260cff525fbd92b5d799f0e259d",
      "date": "2026-11-22",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #367; claude child opus/high\n\nEdit, then promote (reviewer rules): both incidents are observed tool output of dispatch report (the reported model contradicts the native result, with resolvedModel claude-opus-5-5 and claude-haiku-5-5 against outcome.model null). The rule states applicability, action, and check, and agrees with nativeFields of engine/lib/capability/dispatch-record.ts (resolvedModel, else model; effort, else reasoning_effort) and with the Claude Code part of dispatch.md in the lane after 56eff01. It widens no permission, weakens no check, and adds no network or credential act. No live or historical lesson holds its incidents; report-the-exact-arguments-of-a-dispatched-call covers the prompt of the arguments, not the outcome model, so it is a related rule and not a merge target. The edit corrects two claims that the lane of #367 made stale: the module sentence is dated to eb049cb, and the dispatch module example with resolvedModel is recorded as done in 56eff01 as text, not as enforcement, so the follow-up keeps only the engine helper. The tag recurring is added for two incidents on one day; the inferred causes stay labelled as inference.",
      "related": [
        "copy-the-native-model-into-a-dispatch-report"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "An engine helper that builds the dispatch execution report from a saved prompt file and the native result, so that outcome.model and outcome.effort come from the result fields that nativeFields of engine/lib/capability/dispatch-record.ts reads. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Copy the native model of a spawn into its dispatch report

## What happened

The implement session of #360 spawned the Task 1 implementer with the issued pair opus/medium. The native `Agent` result held `"resolvedModel":"claude-opus-5-5"`. The session built the execution report from a helper that always wrote `"model":null` in `outcome`. `dispatch report` saved a mismatch and exited 6 with `the reported model contradicts the native result`. No report can replace saved evidence, so the engine refused each later dispatch act of that session. The session stopped the child before it changed a file, and handed the stop to the issue.

The implement session of #359 made the same mistake on the same day. It spawned the Task 1 implementer with the issued pair haiku/medium. The native `Agent` result held `"resolvedModel":"claude-haiku-5-5"`. The helper of that session also wrote `"model":null` in `outcome`, and `dispatch report` saved a mismatch and exited 6. The session stopped the child, saved its uncommitted diff, returned the lane to its base, and handed the stop to the issue.

## Root cause

Inferred: the session copied the literal `"model": null` of the report shape in the dispatch module into a helper, and did not read the model from the native result. At eb049cb, the same module said to keep a native model ID verbatim when available. An alternative cause is that the example result in that module holds no model field, so the example reads as if null is always correct. The evidence does not separate these two causes. The session of #359 read the module sentence before it wrote its helper, and did not receive this pending proposal, because a task reads only active lessons.

## Fix

Proposed prevention, not enforced: build `outcome.model` and `outcome.effort` from the native result with the field order of `nativeFields` in `engine/lib/capability/dispatch-record.ts` (`resolvedModel`, else `model`), and write null only when the result has neither. The fix of #367 (56eff01) changed the Claude Code part of the dispatch module: it now says to set `outcome.model` to the `resolvedModel` of the native result, else its `model`, and its spawn example result holds `resolvedModel`. That is text. The only enforcement is the refusal of `dispatch report`, which comes after the mistake and stops the session. A structural follow-up that needs separate authorization: an engine helper that builds the report from a saved prompt file and the native result. Check: a report made from a result with `resolvedModel` carries that value, and `dispatch report` answers `reported`.

## Detection signature

`the reported model contradicts the native result`

## Rule

Applies when a session writes the `outcome` of a task-loop `dispatch report` for a spawn or a resume. Action: before the report, read the model and the effort from the native result (`resolvedModel`, else `model`; `effort`, else `reasoning_effort`), copy each value verbatim into `outcome`, and write null only for a field that the result does not hold. Check: each model and effort field of the native result equals the same field of `outcome`, and `dispatch report` answers `status: "reported"`.

## Related lessons

[[report-the-exact-arguments-of-a-dispatched-call]]
[[give-each-probe-dispatch-run-its-own-session-id]]
