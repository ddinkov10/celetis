---
{
  "schema": 1,
  "name": "carry-each-write-lesson-to-each-task-that-adds-a-write",
  "description": "The plan of #334 carried the lesson on ambiguous failed creates to the port split, not to the task that added the link POST, and the link act said nothing changed for every failed POST",
  "tags": [
    "process",
    "api",
    "recurring"
  ],
  "date": "2026-11-20",
  "status": "active",
  "source": "The implement session of #334 on Claude Code, task review of Task 2, 2026-11-20",
  "incidents": [
    {
      "id": "e960a881-577b-482f-b0c3-f295b3899911",
      "date": "2026-11-20",
      "action": "The plan of #334 put the lesson a-failed-create-is-ambiguous-unless-the-server-refused-it in the lesson rules of Task 1 (the port split) only. Task 2 added the act `issue <epic> link <child>`, whose GitHub adapter posts a sub-issue link; its brief carried no such rule, and the implementer wrote one failure line for every error of the POST.",
      "expected": "Each task that adds or changes a non-idempotent write (a create, an append, a POST) carries the active rule that a failed write says nothing changed only for a server refusal (HTTP 4xx), and that each other failure says the record can exist and names the read before a retry.",
      "observed": "engine/issue.ts linkIssue at 95d9440: the `.catch` of `gh.link(epic, child)` printed `#<epic>: the link of #<child> failed; nothing changed` for each error, also for an HTTP 5xx after GitHub could have made the link. The controller found it at the task review and sent a fix round; fix 2e7a891 splits the refused line from the 'the link can exist' line, with a 502 and a 422 probe case.",
      "source": {
        "kind": "tool-output",
        "excerpt": "die('blocked', `#${epic}: the link of #${child} failed; nothing changed`, gh.stderr(), ...)",
        "reference": "https://github.com/ddinkov10/celetis/issues/334"
      },
      "inference": "Inferred: the plan selected lessons by the files that a task touches and the act it names (Task 1 moved the create code), not by the new write that a task adds. Not checked: whether the plan session read the rule and judged it not to apply. Alternative: the rule's applicability line names a create, an append, and a post, so a careful selection would have matched; the miss is a selection error, not a rule defect.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "95d9440",
      "brief": "Task 2 of the plan of #334 (comment 7049049468): its Lesson rules list declare-the-exit-classes…, derive-plan-oracle-values…, compare-the-inputs…, probe-real-tool-semantics…, derive-fixture-state…, retain-probe-sources…, read-the-diff…; no a-failed-create-is-ambiguous-unless-the-server-refused-it.",
      "lesson": {
        "name": "a-failed-create-is-ambiguous-unless-the-server-refused-it",
        "revision": "0730e81",
        "digest": "ffc140d33b3c439260dcbfa850856fa2693eb1e6ac2d30925999249f1ce1ef6d"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "194f1f98-3a41-4f1c-b75f-0f5fad81aff3",
      "requestDigest": "7ae43e550207f9371c6cd6653357ac83d0bb03b866ebdc9adfb454452741ada5",
      "date": "2026-11-20",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #334; claude child opus/high\n\nApprove by the reviewer rules: the proposal has observed tool-output evidence (the linkIssue failure line at 95d9440, the brief of Task 2 without the lesson, and the fix 2e7a891), and states applicability, action, and check. No active or historical lesson holds its incident. It is not a merge into a-failed-create-is-ambiguous-unless-the-server-refused-it: that rule governs the failure line of a write, and this rule governs which task briefs carry such a write rule. It agrees with task-lessons.md, Authoring (include every applicable rule, repeat a shared rule in each affected task) and the plan skill, and adds a check of that selection; it widens no permission and weakens no check. Attributed correction: the incident diagnosis is not-retrieved, but its inference and the Root cause say that no one checked whether the plan session read the rule, so the evidence cannot tell not-retrieved from not-followed; read the diagnosis as unknown. The incident evidence stays unchanged.",
      "related": [
        "carry-each-write-lesson-to-each-task-that-adds-a-write"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A lesson-selection step of celetis:plan (task-lessons.md, Authoring) that lists each new or changed write of a task and matches the lessons whose applicability names that write. Not authorized by this review."
      }
    }
  ]
}
---
# Carry each write lesson to each task that adds a write

## What happened

In #334, the plan put the active lesson `a-failed-create-is-ambiguous-unless-the-server-refused-it` in the lesson rules of Task 1, which moved the GitHub code with no behavior change. Task 2 added the act `issue <epic> link <child>`, whose adapter posts a sub-issue link. The brief of Task 2 did not carry that lesson. At 95d9440 the link act printed `#<epic>: the link of #<child> failed; nothing changed` for each failure of the POST, also for an HTTP 5xx. The controller found it in the task review, and fix 2e7a891 split the lines, with a 502 case and a 422 case.

## Root cause

Inferred: the plan selected the lessons of a task by the files and the existing acts that it touches, not by each new write that it adds. Not checked: whether the plan session read the rule for Task 2 and judged it not to apply. The rule text itself names a post, so the rule is not wrong; the selection missed it.

## Fix

The fix of #334 (2e7a891) corrects the act. Proposed structural follow-up, not authorized here: the lesson selection of `celetis:plan` lists, for each task, each new write of the task (a create, an append, a POST, a PATCH) and matches the lessons whose applicability names that write. This stays text until such a selection step exists.

## Rule

Applies when a plan or a brief selects the lesson rules of a task that adds or changes a write to an external store (a create, an append, a POST, a PATCH). Action: list each new or changed write of the task, and carry each active lesson whose applicability names that kind of write, also when another task of the plan already carries it. Check: for each listed write, the brief of its task holds each matching active lesson with its path and digest, and a review of the write finds the rule applied.

## Related lessons

[[a-failed-create-is-ambiguous-unless-the-server-refused-it]]
