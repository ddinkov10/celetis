---
{
  "schema": 1,
  "name": "probe-a-cleanup-that-cannot-end-when-a-change-sends-it-a-new-leftover",
  "description": "A prune change sent a new kind of leftover to an existing start cleanup; the build probed only a blocker that went away, and the final review showed that a blocker that stays stops each later install",
  "tags": [
    "regression",
    "process"
  ],
  "date": "2026-11-10",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#281",
  "incidents": [
    {
      "id": "0ee50b5d-d5e1-44f2-abc2-40da5b5ef156",
      "date": "2026-11-10",
      "action": "The build of #281 recorded that the next install removes the renamed folder of a stopped prune, from a probe whose blocker was removed before that install; it did not probe a blocker that stays.",
      "expected": "The task record and the decision record name each result of an interrupted prune, also the one in which the delete cannot end, compared with the base.",
      "observed": "The final reviewer ran a probe with a blocker that stays: on the head d3c0ec7 each later install exits 1 in the start loop and the engine does not switch; on the base 3244a06 a later install exits 0 and switches the engine.",
      "source": {
        "kind": "tool-output",
        "excerpt": "head: {\"install\":\"r6 (blocker stays)\",\"code\":1,\"err\":\"ENOTEMPTY: directory not empty, rm <versions>/.<r2>.<uuid>\",\"versions\":[\".r2.<uuid>\",\"r3\",\"r4\",\"r5\"],\"link\":\"r5\"} base: {\"install\":\"r6 (blocker stays)\",\"code\":0,\"err\":\"\",\"versions\":[\"r2\",\"r5\",\"r6\"],\"link\":\"r6\"}",
        "reference": "https://github.com/ddinkov10/celetis/issues/281#issuecomment-6774848597"
      },
      "inference": "Inferred: the idempotency check listed only an interruption whose cause goes away. Alternative: the build took the start loop as decided by the spec and out of scope. The evidence does not distinguish them.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "d3c0ec7e385bbc878798852b1daaa57856bc6d55"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "0fdbc4ab-0bb3-4c4c-9422-15830aad06dd",
      "requestDigest": "b5f490329fa1df7879c9aa3b4c2f6faebd9cd6100be831289dbaa767a8a60f4b",
      "date": "2026-11-10",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #281; claude child opus/high\n\nEdit, then promote, under the reviewer rules (\"Approve ... Edit it first when its text needs a correction\"). The incident is observed tool output with a durable reference, and the body keeps the inferred cause apart from the facts; the Fix section matches the lane, where commits 7689113 and 5a72080 change only engine/README.md, plugins/celetis/README.md, and the decision record. The rule states applicability, action, and check, widens no permission, adds no network or credential act, and adds probes, not a tracked test. It is compatible with the principle make-operations-idempotent, which it narrows to a cleanup that fails each time. No live or historical lesson holds its incident or states the same rule: prove-fragment-content-before-retry-cleanup covers the identity proof before a delete, probe-a-no-change-rule-on-state-that-lacks-created-files covers absent created files, and return-the-safe-result-for-a-known-proof-blind-spot covers proof methods. The correction: the action let a regression against the base become a stated limit with no gate, which can weaken the gate of compare-each-known-limit-with-the-spec-rule-that-it-narrows; the edited action routes a stated limit through that comparison, and Related lessons names it.",
      "related": [
        "probe-a-cleanup-that-cannot-end-when-a-change-sends-it-a-new-leftover"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The lesson text is the prevention; no structural change is proposed."
      }
    }
  ]
}
---
# Probe a cleanup that cannot end when a change sends it a new kind of leftover

## What happened

Observed in the build of #281. The prune of an install was changed to rename a version folder to a name that starts with a dot before it deletes the folder. An existing loop at the start of each install deletes each entry with such a name. The plan probe covered a delete that stops once: the probe removed the blocker, and the next install deleted the renamed folder. The task record and the decision record stated only that result ("the next install removes it"). The final reviewer ran a variant with a blocker that stays. On the head, each later install failed with exit 1 in the start loop, before the switch of the engine. On the base, a later install in the same state switched the engine.

## Root cause

Inference, not observed: the idempotency check of the task listed one interrupted run, whose cause goes away. It did not list the state in which the cleanup step itself fails each time, and it did not compare that state with the base. An alternative that the evidence does not exclude: the spec named the start loop as the cleanup, so the build took its behavior as decided and out of scope.

## Fix

Proposed prevention, not proven enforcement: the rule below, applied when a task changes which leftovers an existing cleanup path receives. It stays text, because the list of failure states of a cleanup needs judgment for each change. In #281 the limit went into the decision record and the install text of the README; no code changed.

## Rule

Applies when a change makes an existing cleanup, recovery, or retry path handle a new kind of leftover (a renamed folder, a staging file, a record of a stopped operation). Action: list the failure states of that path for the new leftover, also the state in which the cleanup cannot end and its cause stays, run the operation again in each state on the change and on the base, and record each difference in the documents of the change as a fix, or as a stated limit only after the comparison of [[compare-each-known-limit-with-the-spec-rule-that-it-narrows]] accepts it. Check: a probe leaves the blocker in place, runs the operation two more times, and compares the exit and the resulting state with the base; the task report and each document of the change name the result.

## Related lessons

[[return-the-safe-result-for-a-known-proof-blind-spot]]
[[state-the-limits-of-a-check-from-a-probe-of-its-configuration]]
[[compare-each-known-limit-with-the-spec-rule-that-it-narrows]]
