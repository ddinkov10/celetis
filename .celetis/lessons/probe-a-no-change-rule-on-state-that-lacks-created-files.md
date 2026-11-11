---
{
  "schema": 1,
  "name": "probe-a-no-change-rule-on-state-that-lacks-created-files",
  "description": "A conversion refused an invalid record but created its lock file, and a probe from real state could not see it because real state always had the lock file",
  "tags": [
    "data-store",
    "test",
    "false-negative"
  ],
  "date": "2026-11-06",
  "status": "active",
  "source": "Task 3 of ddinkov10/celetis#141 (implement session, child t3-impl); recorded by the coordinator",
  "incidents": [
    {
      "id": "c6e3c55b-765e-40d5-bed1-684b9afe9072",
      "date": "2026-11-06",
      "action": "The first Task 3 implementation of the recovery-record conversion took the record lock <n>.lock for each schema-1 record before it validated the record.",
      "expected": "Ruling R10 of #141: a record that the conversion cannot validate keeps today's refusal and changes no file of the folder.",
      "observed": "With no <n>.lock present, the refusal of an invalid schema-1 record created the lock file. The implementer's mutation run caught it: (d no lock) no lock file and no other file appears: FAIL. The committed code validates before it takes the lock.",
      "source": {
        "kind": "tool-output",
        "excerpt": "(d no lock) no lock file and no other file appears: FAIL",
        "reference": "ddinkov10/celetis#141 Task 3 report, section Incidents; lane evidence docs/superpowers/verification/141-t3/mutant/records.out"
      },
      "inference": "Reported by the implementer: the brief put the validation under the lock, and real old state always holds the lock file, so a probe that starts only from real state cannot see a created lock file.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "396d2a4"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "a62f3965-b7d3-45f0-b567-6a908b37d36d",
      "requestDigest": "5fa6875a40816ab887e24b3c725220003a510290250bb5d761a68e4b51b39368",
      "date": "2026-11-06",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #274; claude child opus/high\n\nApprove under the reviewer rules: the retained mutation output \"(d no lock) no lock file and no other file appears: FAIL\" establishes that the first conversion created <n>.lock on the refusal of an invalid record, against ruling R10 of #141, and that the cases from real state could not show it. The rule states applicability (a check that a refusal or a read changes no file of a folder), action (list each file that the operation can create and add a case with that file absent, and keep the real-state cases), and check (each listed file has an absent-file case that asserts that no file appears). It adds check cases, weakens no check, and widens no permission. It agrees with the principle test-behavior-not-implementation, because the absent-file case is a change of state that must make the check fail, and it does not ask for a tracked test. It complements check-new-state-rules-against-existing-runner-folders and derive-fixture-state-from-real-producers, which keep their real-state cases; no live or historical lesson states this rule or holds its incident. The body labels the cause as the inference of the implementer, with its uncertainty.",
      "related": [
        "probe-a-no-change-rule-on-state-that-lacks-created-files"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the set of created files depends on the operation. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Probe a no-change rule on state that lacks the files the operation creates

## What happened

In Task 3 of #141, the first conversion of a schema-1 recovery record took its record lock before it validated the record. For an invalid record, the refusal then created `<n>.lock`, against the rule that the refusal changes no file. Real old state always holds that lock file, so the probe cases that started from real state passed. A synthetic case with no lock file failed, and the implementer moved the validation before the lock.

## Root cause

Reported by the implementer, inferred: the brief placed the validation under the lock, and the probe's real-state fixture already held every file that the operation would create. Uncertain: whether the brief or the probe design is the main cause.

## Fix

Proposed: a check of a "changes no file" rule adds one case for each file that the operation can create, with that file absent. This is text, not enforcement: the set of created files depends on the operation.

## Rule

Applies when a check asserts that a refusal or a read changes no file of a folder. Action: list each file that the operation can create (a lock, a temporary file, a folder), and add a case that starts with that file absent; keep the cases that start from the real state of the existing producer. Check: each listed file has an absent-file case that asserts that no file appears.

## Related lessons

[[check-new-state-rules-against-existing-runner-folders]] [[derive-fixture-state-from-real-producers]]
