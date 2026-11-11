---
{
  "schema": 1,
  "name": "check-refresh-causes-before-first-document",
  "description": "An existing queue comparison bypassed the new empty-cache scheduling guard",
  "tags": [
    "test",
    "process",
    "regression"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "Implementation of ddinkov10/celetis#193 Task 3, V5 focused server check",
  "incidents": [
    {
      "id": "91803b58-86d5-4837-a411-75fc5142811f",
      "date": "2026-11-02",
      "action": "Retained queueView's refresh-on-owner-mismatch condition while adding a no-document scheduling guard.",
      "expected": "After repeated full failures, a local board request must not create a read loop without a good document.",
      "observed": "V5 initial local GET started full read 3 after two failures; expected 2. queueView compared null ownership against the absent projection's undefined owner and requested refresh.",
      "source": {
        "kind": "tool-output",
        "excerpt": "v5.log: V5 no-document failure does not create retry loop; AssertionError: 3 !== 2. server-before-initial-fix.ts.txt retains the source.",
        "reference": "Task 3, base 156c7caaece61752ea55884a96084503964b534a, /private/tmp/celetis-193-task3.hCP1NX"
      },
      "inference": "Confirmed local absence mismatch; no wider recurrence is established.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "156c7caaece61752ea55884a96084503964b534a plus Task 3 working diff"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "421cc069-5588-4206-819f-9a98b3c971d7",
      "requestDigest": "537ea153eedac215c28bda534e094b2f603571e8d2a04605211f166c4bc6f8e4",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #236; codex child host default/high\n\nApprove under the reviewer rules: the retained failed count identifies an indirect refresh before a good document exists. The rule has a specific scope, requires every existing refresh cause to be checked across empty and failed states, and checks the approved scheduling result. It agrees with the domain-model and behavioral-check principles.",
      "related": [
        "check-refresh-causes-before-first-document"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Refresh causes depend on the affected scheduler. No structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Check refresh causes before the first good document

## What happened

In #193 Task 3, the scheduler guard prevented direct target retries without a published document. The existing queueView mismatch cause still compared null ownership against the absent projection's undefined owner. A local GET after two failed full reads started read 3. V5 failed with `AssertionError: 3 !== 2`. The retained pre-fix source and log identify the working state.

## Root cause

The local absence mismatch is confirmed by the focused server check and source. No wider recurrence is established. The new scheduler guard did not cover an existing indirect refresh cause.

## Fix

The task repair compares queue ownership only when a document exists. Proposed prevention: include the empty-cache state when checking each existing cause that can request a refresh. This remains a scoped verification rule because the set of indirect callers depends on the scheduler. No permanent enforcement is claimed or introduced by this proposal.

## Rule

When changing a cached reader's scheduler, check each existing refresh cause before the first successful publication and after a read failure. Confirm that requests do not create retries forbidden by the scheduling contract.
