---
{
  "schema": 1,
  "name": "run-a-dependent-report-after-its-check-returns",
  "description": "A report of a check result goes in a turn after the check returns, never in the same parallel batch.",
  "tags": [
    "process"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "implement of #357 (step session), lane feat/357-intent-a-set-of-mcp-tools-that",
  "incidents": [
    {
      "id": "0a1df6b5-709d-48e4-95ca-676f6089baad",
      "date": "2026-11-21",
      "action": "The coordinator of #357 sent the verify gate run and `celetis --agent claude dispatch gate 357 3 pass verify <report>` as two calls of one parallel batch.",
      "expected": "A gate report states the result of a gate run that finished before the report.",
      "observed": "The session guard refused the gate call (\"this command names git in a form too complex to verify\"), and the report call still ran and returned `{\"status\":\"ready\",\"role\":\"reviewer\",...}`. The coordinator then ran the gate on 2854b24: `verify: PASS`, so the reported result held by chance.",
      "source": {
        "kind": "tool-output",
        "excerpt": "dispatch gate 357 3 pass ... -> {\"schema\":1,\"status\":\"ready\",\"issue\":\"357\",\"task\":\"3\",\"role\":\"reviewer\",...}; the gate call: \"Refusing to run it\"",
        "reference": "https://github.com/ddinkov10/celetis/issues/357"
      },
      "inference": "Inferred: independent-looking calls in one batch run even when an earlier call of the batch is refused, so a report that depends on another call can record a result that no run produced. Uncertain: whether the host always runs the later calls of a batch after a refusal.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "2854b24"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "d39b5441-5ecc-4053-8b6f-64aa844d2fc2",
      "requestDigest": "cac9faca7bf6c4915bf68b5fd41b456a779bcb0aea692835b8cb74b18e3add8e",
      "date": "2026-11-21",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #357; claude child opus/high\n\nEdit, then promote: observed tool-output evidence that a gate report call ran in the same batch as a refused gate call and issued the reviewer. The rule states applicability, action, and check; it widens no permission, weakens no check, and agrees with the implement skill (run the gate and save its report, then report it with dispatch gate). No live or historical lesson holds its incident or states the same rule; read-the-diff-of-each-edit-before-the-commit-and-the-report treats a refused call as one that ran nothing, but for document edits and fix reports, so it is linked, not merged. The edit keeps the general claim of the root cause apart from the one observed case: the body now marks it as observed once, with the uncertainty of the incident.",
      "related": [
        "run-a-dependent-report-after-its-check-returns"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A structural check that the gate report file carries the output digest of the run that it reports. It needs separate authorization."
      }
    }
  ]
}
---
# Run a dependent report after its check returns

## What happened

During the build of #357, the coordinator sent the verify gate and the `dispatch gate ... pass` report as two calls of one parallel batch. A session guard refused the gate call. The report call ran anyway, and the engine issued the task reviewer. The coordinator ran the gate afterwards; it passed, so the record was true by chance.

## Root cause

Inferred: a report that states the result of another call was sent before that call returned. Observed once: the refusal of the gate call did not stop the report call of the same batch. Uncertain: whether the host always runs the later calls of a batch after a refusal or a failure of an earlier call.

## Fix

Proposed prevention, not enforced: send a report of a check result only in a turn after the check returned, and quote its last line. The rule stays text: the engine validates the report file, not that the run happened; a structural check could require the report file to carry the run's own output digest.

## Rule

Applies when an agent records the result of a check (a gate, a test, a probe) with another call. Action: run the check, wait for its result, and send the record in a later turn, from the result. Check: the record's input file holds the output of a run that ended before the record call, and no record call shares a batch with the check that it reports.

## Related lessons

- [[read-the-diff-of-each-edit-before-the-commit-and-the-report]]
