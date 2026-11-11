---
{
  "schema": 1,
  "name": "give-each-probe-dispatch-run-its-own-session-id",
  "description": "A child's probe ran dispatch next with the coordinator's inherited session ID, so the engine refused every later act of the build",
  "tags": [
    "process",
    "test"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Task 5 of ddinkov10/celetis#267 (implement step, subagent flow)",
  "incidents": [
    {
      "id": "6718e343-b712-4fdc-b077-c3402aca62e7",
      "date": "2026-11-09",
      "action": "The Task 5 implementer of #267, a child agent of the build session, ran one early manual `dispatch next 1 1 implementer 1 1 1 1 1 0 --bias 0` of its capscore probe with the CLAUDE_CODE_SESSION_ID that it inherited from the coordinator session, before its probe set a new session ID for each run.",
      "expected": "Each probe run of a `dispatch` act uses a new unique CLAUDE_CODE_SESSION_ID, as Step 1 of Task 5 of the plan says, and removes only the dispatch record that it creates; the coordinator's dispatch record keeps only the dispatches of its task loop.",
      "observed": "The coordinator's record `/tmp/celetis-501/dispatch/claude-<coordinator session>.json` held a task for issue 1, task 1, and dispatch bfbcd152 with `execution: null`. The next act of the build, `dispatch gate 267 5 pass verify <report>`, exited 6 with status `setup`. An honest report of that dispatch could only be `unsupported` with `call: null`, which the guard of `engine/lib/dispatch-record.ts` also treats as pending, and a `failed` report needs a real Agent call. The coordinator removed the one stray task and dispatch under the record lock with the engine's own `validateRecord`, `withLock`, and `writeAtomic`; the gate act then returned the reviewer dispatch.",
      "source": {
        "kind": "tool-output",
        "excerpt": "dispatch: setup: dispatch bfbcd152-798a-439d-8b96-fc19388e64bd: missing execution report; run dispatch report bfbcd152-798a-439d-8b96-fc19388e64bd <report-file> (exit 6). Child report: \"An early manual dispatch next wrote to the existing record /tmp/celetis-501/dispatch/claude-f71607dd-….json. That record predates my run, so I did not remove it.\"",
        "reference": "https://github.com/ddinkov10/celetis/issues/267"
      },
      "inference": "Tool output and the child report establish the inherited session ID. Inferred cause: a child agent of a Claude Code session inherits CLAUDE_CODE_SESSION_ID, so any `dispatch` act that it runs without an explicit new ID writes into the coordinator's record. The plan step named the new ID for the probe runs, but not for a manual trial run before the probe. Alternative: the brief did not say that a trial run counts as a probe run. Uncertain whether other children of earlier builds made the same write unnoticed.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "7970681"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "1054dff7-79a8-4cf2-ae58-1402b2d48362",
      "requestDigest": "0ae5731eb892bfcfe11041dd8af315b61c02ff9d41fd116c67f72e76446a9dd2",
      "date": "2026-11-09",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #264; claude child opus/high\n\nApprove: the proposal has observed tool-output evidence (the exit 6 setup line and the child report), a substantive mistake, and a rule that states applicability, action, and check. No rule rejects it: it widens no permission, weakens no check or gate, adds no network or credential act, and contradicts no skill, principle, or instruction file (plugins/celetis/docs/procedures/dispatch.md and docs/capability.md, Dispatch records, key the record by host and session ID and say nothing against a separate ID for a probe). No active or historical lesson holds its incident or states the same rule. Its text keeps the observed facts apart from the inferred cause, and the structural follow-up stays proposed.",
      "related": [
        "give-each-probe-dispatch-run-its-own-session-id"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up named in the Fix, which needs separate authorization: the engine refuses a dispatch act for an issue other than the issue of the existing tasks of the record, or records it with a marker that a coordinator can clear; its check is a probe that runs dispatch next for another issue in a record of a running build and observes the refusal."
      }
    }
  ]
}
---
# Give each probe run of a dispatch act its own session ID

## What happened

In the build of #267, the Task 5 implementer (a child agent) tried one `dispatch next 1 1 implementer 1 1 1 1 1 0 --bias 0` by hand before its probe ran. The child inherited `CLAUDE_CODE_SESSION_ID` of the coordinator, so the act wrote a task for issue 1 and an unreported dispatch into the coordinator's dispatch record. The next act of the build, `dispatch gate 267 5 ...`, exited 6 with `setup: dispatch bfbcd152-...: missing execution report`. No honest report could clear it: `unsupported` with `call: null` stays pending in the guard, and `failed` needs a real native call. The coordinator removed the one stray task and dispatch under the record lock with the engine's own record functions, and the build went on.

## Root cause

Observed: the child ran the act with the inherited session variable, and the plan step required a new ID only for the probe runs. Inferred: a child of a session shares the session variable of the coordinator, so any `dispatch` act of a child writes into the coordinator's record unless the child sets a new ID. The guard refuses every later act while one dispatch has no started or failed report. Uncertain: whether earlier builds had the same write unnoticed.

## Fix

Proposed prevention, not proven: each brief that lets a child run a `dispatch` act for a probe says that every such run, also a first trial, sets a new unique `CLAUDE_CODE_SESSION_ID` (or `CODEX_SESSION_ID`) and removes only the record file that it creates. Proposed structural follow-up, which needs separate authorization: the engine could refuse a `dispatch` act for an issue other than the issue of the existing tasks of the record, or record the act with a marker that a coordinator can clear; a check that rejects the recorded mistake is a probe that runs `dispatch next` for another issue in a record of a running build and observes the refusal. The rule stays text until such a check exists, because a record can hold more than one issue in a normal session.

## Detection signature

`dispatch: setup: dispatch <id>: missing execution report` for a dispatch ID that no Agent or SendMessage call of the coordinator issued, and a task of another issue in `dispatch show`.

## Rule

Applies when a coordinator brief lets a child run a `dispatch` act, or any command that writes the session's dispatch record, for a probe or a check. Action: tell the child to set a new unique session ID (`CLAUDE_CODE_SESSION_ID` or `CODEX_SESSION_ID`) for every such run, also a first trial run, and to remove only the record file that the run creates; never run the act with the inherited session variable. Check: after the child reports, `dispatch show` of the coordinator lists only the tasks and dispatches of its own task loop.
