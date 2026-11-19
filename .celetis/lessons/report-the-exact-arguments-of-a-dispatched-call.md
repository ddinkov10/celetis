---
{
  "schema": 1,
  "name": "report-the-exact-arguments-of-a-dispatched-call",
  "description": "A dispatch execution report carried a paraphrase of the reviewer prompt, the engine saved a mismatch, and every later act of the fix task stopped with setup exit 6",
  "tags": [
    "process",
    "test"
  ],
  "date": "2026-11-18",
  "status": "active",
  "source": "Implement session of #338 (ddinkov10/celetis), the verify-1 fix task, Claude Code 2.1.327.",
  "incidents": [
    {
      "id": "72925a3a-78e0-4f61-9863-66df5e36faf5",
      "date": "2026-11-18",
      "action": "After the Agent call of the verify-1 task reviewer (dispatch 6efaaed2-bd7b-4a30-80c7-fd39e44fed1d), the session wrote the execution report with a one-line summary of the prompt in place of the exact prompt, so its first line held the CAP line plus summary text.",
      "expected": "The report holds the exact arguments of the real call: the prompt verbatim, whose first line equals the issued CAP line (dispatch.md, \"The task loop\": \"Save the exact tool name, arguments, and native result of the real call\").",
      "observed": "dispatch report returned status setup: \"the first message line must equal the issued CAP line\", execution mismatch; a second report with the exact prompt was refused (\"already has execution evidence\"); dispatch close and dispatch next of verify-1 then exit 6.",
      "source": {
        "kind": "tool-output",
        "excerpt": "dispatch: setup: dispatch 6efaaed2-bd7b-4a30-80c7-fd39e44fed1d: the first message line must equal the issued CAP line; dispatch: refused: dispatch 6efaaed2-bd7b-4a30-80c7-fd39e44fed1d already has execution evidence",
        "reference": "https://github.com/ddinkov10/celetis/issues/338"
      },
      "inference": "The session composed the report from memory to save tokens and treated the prompt field as descriptive. The implementer report of the same task used the same summary style but kept the exact CAP line as its first line, so it passed; the difference was luck, not a check. Alternative: the engine could accept a corrected report before any later act, but the docs say no report can replace earlier execution evidence.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "44c33b5"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "8ee0c2f3-5db9-4c0d-89f8-c3dd6d214cb8",
      "requestDigest": "e1cf0dbe9e32e43c28a7561c114148b9ae3ee6f22425f91fb6685b578fe6fea9",
      "date": "2026-11-19",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #332; claude child opus/high\n\nApprove (reviewer rules: no rule rejects, merges, replaces, or skips it). The proposal has observed tool-output evidence: dispatch report saved the setup mismatch \"the first message line must equal the issued CAP line\", a second report was refused with \"already has execution evidence\", and dispatch close and dispatch next of the task then exited 6. The cause is labeled as an inference, with an alternative. The rule states applicability (a task-loop dispatch reported with dispatch report), action, and check. It agrees with the plugin module references/procedures/dispatch.md, \"The task loop\" (save the exact tool name, arguments, and native result of the real call), and adds a way to keep the prompt exact; it widens no permission, weakens no check, and adds no network or credential act. No live or historical lesson holds its incident; give-each-probe-dispatch-run-its-own-session-id governs the session ID of a probe dispatch, a different rule.",
      "related": [
        "report-the-exact-arguments-of-a-dispatched-call"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The proposal names a structural follow-up that needs separate authorization: an engine helper that sends nothing but builds the dispatch execution report from a saved prompt file and the native result, and refuses a report whose prompt differs from the saved file. Not authorized or checked in this review."
      }
    }
  ]
}
---
# Report the exact arguments of a dispatched call

## What happened

In the verify-1 fix of #338, the session dispatched the task reviewer with the Agent tool. Its execution report summarized the prompt on one line after the CAP line. `dispatch report` saved a mismatch ("the first message line must equal the issued CAP line"). A second report with the exact prompt was refused ("already has execution evidence"). `dispatch close` and `dispatch next` of the task then exited 6, so the clean review could not close the task.

## Root cause

Inference: the session wrote the report from memory and treated `arguments.prompt` as a description, not as the exact sent text. The procedure already says to save the exact arguments; the rule was in context and was not followed.

## Fix

Proposed prevention, not enforced: write each dispatch prompt to a file first, send that file's text, and build the report from the same file (`jq --rawfile`). A structural follow-up that needs separate authorization: a helper of the engine that sends nothing but builds the report from a saved prompt file and the native result. Check: a report whose prompt differs from the saved file is refused before it reaches the engine.

## Detection signature

`dispatch: setup: dispatch <id>: the first message line must equal the issued CAP line`

## Rule

Applies when a session reports a task-loop dispatch with `dispatch report`. Action: save the prompt to a file before the call, send exactly that text, and build the report `arguments` from the same file and the native result; never type or summarize the prompt in the report. Check: the report's `arguments.prompt` equals the saved file byte for byte, and its first line equals the issued CAP line.

## Related lessons

[[give-each-probe-dispatch-run-its-own-session-id]]
