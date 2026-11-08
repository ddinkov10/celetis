---
{
  "schema": 1,
  "name": "list-every-producer-of-an-oracle-record",
  "description": "A probe compared a fake gh log exactly after it moved the work into the daemon, whose board also writes that log",
  "tags": [
    "false-positive",
    "test",
    "process"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Implementer incident of ddinkov10/celetis#276, Task 2",
  "incidents": [
    {
      "id": "0594cd66-fb4f-4f33-a498-a6a1fe4f2dfc",
      "date": "2026-11-08",
      "action": "The first GREEN run of the #276 Task 2 request probe compared the fake gh log of a lane landing with the base exactly (the oracle of Task 1, where no daemon ran), and checked 'no new gh call' right after a daemon start.",
      "expected": "The oracle compares the gh calls of the landing; each other producer of the same log in the long-lived process is listed and kept apart.",
      "observed": "The board of the lane daemon also writes the fake gh log, so b-a failed on an extra GET issues?state=open&per_page=100 line and four refusal checks failed on no gh call.",
      "source": {
        "kind": "tool-output",
        "excerpt": "FAIL b-a: side effects: line 56 / base: \"GET \", / lane: \"GET issues?state=open&per_page=100\",",
        "reference": "docs/superpowers/verification/276-t2/green-0/probe.out in the #276 lane; .superpowers/sdd/276/task-2-report.md, Incidents"
      },
      "inference": "Inferred: the oracle came from Task 1, where no daemon ran, and the probe did not list the board as a producer of gh calls on the path of the lane run. Uncertain whether the carried rule derive-plan-oracle-values-from-real-producers was not followed or does not cover a moved producer.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f6096a477c401fa66e593f5c9935d4ed6766cc98",
      "brief": "Task 2 dispatch of #276 (.superpowers/sdd/276/task-2-dispatch.md) carried derive-plan-oracle-values-from-real-producers sha256:82374a5e…",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "2fc548691a802b56b8be30acacb0ce82eae057d1",
        "digest": "82374a5ef999ae3a64156d1c366b1c8de2160cb0d321e022fddb8d4122e121c3"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "bab362f5-d303-4168-b0c1-805fbc775394",
      "requestDigest": "18b1bfe7750634754748b360927fd08ea2f7a52a1cd1a7fe75baed4de76b39e1",
      "date": "2026-11-08",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #253; claude child opus/high\n\nEdit under the reviewer rules. The incident is observed: the retained excerpt gives the extra GET issues?state=open&per_page=100 line of the lane against the base log. The rule states applicability, action, and check, and keeps the inferred cause apart from the facts. It is compatible with the active lesson derive-plan-oracle-values-from-real-producers but not the same rule: that lesson computes a plan oracle value from an existing producer, and this one separates the entries of other producers of a shared record in a long-lived process by a definite mark, names what the separation hides, and checks it with a control run. So it is a new lesson, not a merge, and it links that lesson. The edit only adds to the Fix that the prevention is proposed text, not enforced; the incident evidence stays unchanged. The rule widens no permission, weakens no check, and contradicts no instruction, skill, or principle.",
      "related": [
        "list-every-producer-of-an-oracle-record"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The producers of a shared record depend on the process that a change targets, so no general structural check is known; the control run of the rule stays its check."
      }
    }
  ]
}
---
# List every producer of an oracle record before an exact comparison

## What happened

In #276 Task 2 the landing moved from its own process into the master daemon. The request probe reused the oracle of Task 1: it compared the fake `gh` log of the lane landing with the base exactly, and it checked "no new gh call" right after a daemon start. The board of the lane daemon also reads GitHub through the same fake `gh`, so the first GREEN run failed on an extra `GET issues?state=open&per_page=100` line and on four refusal checks. Each functional check passed. The implementer then compared the base calls as an ordered subsequence and accepted each other lane call only as a board read.

## Root cause

Inference: the oracle came from a run with one producer of the log (the `land` process). The moved work runs in a process with more producers (the board and its refresh), and the probe did not list them. Uncertain whether the carried rule `derive-plan-oracle-values-from-real-producers` was not followed or does not name a moved producer.

## Fix

The repair lists the board reads by shape and compares the landing calls as an ordered subsequence, with the limit that an extra landing read of a board shape stays hidden. Proposed prevention (text, not enforced): the rule below. The rule stays text, because the producers of a record depend on the process that the change targets.

## Rule

Applies when a check reuses an oracle of a shared record (a log, a fake tool call log, an event file) after the work moves into a long-lived process. Action: before the oracle compares the record exactly, list each other producer of that record in the target process, and separate their entries by a definite mark (a shape, a tag, or a time window), and name what the separation can hide. Check: a control run of the long-lived process with no unit of work shows only the entries that the separation accepts, and the comparison still fails for one extra entry of the work.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]] [[derive-fixture-state-from-real-producers]]
