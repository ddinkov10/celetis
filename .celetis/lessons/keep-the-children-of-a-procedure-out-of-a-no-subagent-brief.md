---
{
  "schema": 1,
  "name": "keep-the-children-of-a-procedure-out-of-a-no-subagent-brief",
  "description": "Implementer briefs forbade every subagent, so a design review that requires two isolated critique assessments ran degraded, twice: a standard template in #360, and a shared prompt helper in #347 while the brief carried this lesson",
  "tags": [
    "process",
    "recurring"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "Issue #347, implement session, Task 7 of the subagent flow\n\nThe implement session of issue #360, the dispatch and the task review of Task 8",
  "incidents": [
    {
      "id": "7a8838b1-4e19-4655-a456-2d555afef5ad",
      "date": "2026-11-23",
      "action": "The coordinator dispatched Task 7 (the design review) with its reusable implementer prompt, which says \"You do not dispatch subagents\", and named no exception.",
      "expected": "The dispatch names the two isolated critique assessments that the design procedure requires as the one exception to the no-subagent rule.",
      "observed": "The child ran critique in one context and marked the result degraded. The task review then required a repeat with two isolated assessments, which cost a fix round of about one hour.",
      "source": {
        "kind": "tool-output",
        "excerpt": "DEGRADED: single-context (the brief forbids subagents, so Assessment A and Assessment B ran in this session, not as two isolated sub-agents).",
        "reference": "https://github.com/ddinkov10/celetis/issues/347"
      },
      "inference": "The rule was in the task brief, and the coordinator generated the prompt from a shared helper for each task, so the prompt did not vary with the procedure of the task. The cause is inferred from the session; no other cause was ruled out.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "4f10c67",
      "brief": "Task 7 brief of #347 carried the rule; the dispatch prompt said: You do not dispatch subagents.",
      "lesson": {
        "name": "keep-the-children-of-a-procedure-out-of-a-no-subagent-brief",
        "revision": "31bc92e",
        "digest": "43ec3ce250e51716eb2d8546865806efa90ce74926eec3d3abb2a1b4f407a1d7"
      }
    },
    {
      "id": "dispatch-30956770-b59b-43d5-9968-5364986c9ae7",
      "date": "2026-11-22",
      "action": "Dispatched the Task 8 design review with the standard implementer text \"Do the work yourself. Do not spawn a subagent or a reviewer.\"",
      "expected": "The brief lets the child start the two isolated critique assessments that design.md, \"The design review\", step 1 requires",
      "observed": "The child ran the critique as one context and reported it as degraded because the task forbade a sub-agent",
      "source": {
        "kind": "tool-output",
        "excerpt": "The critique ran as one context (degraded), because the task forbids a sub-agent."
      },
      "inference": "The coordinator reused one implementer template for each task and did not compare its no-subagent line with the procedure that the brief names. An alternative is that the upstream template rule and the project procedure conflict for any task that names a procedure with its own children. The evidence does not separate these causes.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f0f2b4b621e035b6229d80034b7f0b4091249c92",
      "brief": "design.md, \"The design review\": \"They stay two isolated sub-agents\""
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "bfe601e2-c289-43cb-8b78-61f596f738d2",
      "requestDigest": "6d8ecf848b901c6da9b318dba5af3799a33e09d08a360b781ae6b662dec3d4f1",
      "date": "2026-11-23",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #359; claude child opus/high\n\nApprove under the reviewer rules. The incident holds observed tool output: the child reported the critique as one degraded context because its brief forbade a sub-agent. The installed design.md, \"The design review\", step 1 requires two isolated sub-agents, so the rule follows that procedure. It names only children that the procedure already requires, so it widens no permission and weakens no check. scope-shared-prohibitions-against-required-callers covers a prohibition added to a shared instruction, and give-each-agent-rule-a-check-where-its-actor-reads covers the reach of a constraint; neither states this check of a dispatch brief, so no merge applies.",
      "related": [
        "keep-the-children-of-a-procedure-out-of-a-no-subagent-brief"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The step design.md or the implement skill can state this exception for a design-review task. This needs separate authorization."
      }
    },
    {
      "id": "f5948e54-2d80-4cf7-983f-47ee7f46f03a",
      "requestDigest": "a9b3bf254c2d476cb74ebafbdf4876e9aa8b80349c66a80f13f4b2cfbd6a9b39",
      "date": "2026-11-24",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #347; claude child opus/high\n\nMerge (reviewer rules: merge a proposal into an active lesson that states the same rule, and keep every incident). The proposal has observed tool output (the child reported DEGRADED single-context because the brief forbade subagents). Its incident names keep-the-children-of-a-procedure-out-of-a-no-subagent-brief as the lesson that the brief of the task carried, with the diagnosis not-followed, and its rule states the same act: read the procedure of the task and name its required children as the exception. The active lesson already inferred the reuse of one template as a cause. The merge keeps both incidents and the prior review, and extends the survivor to a prompt that a reused template or a shared helper builds. The rule names only children that the procedure already requires, so it widens no permission, weakens no check, and adds no network or credential act. The installed dispatch.md, \"One child\", step 5, requires the brief to carry the required skills and constraints, which agrees with the rule.",
      "related": [
        "check-a-reused-dispatch-template-against-the-procedure-of-the-task",
        "keep-the-children-of-a-procedure-out-of-a-no-subagent-brief"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The step design.md or the implement skill can state this exception for a design-review task, or a check can compare the procedures that a brief cites with the procedures that require children. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Keep the children of a procedure out of a no-subagent brief

## What happened

The implement session of #360 dispatched Task 8, a design review, with the standard implementer text that forbids each subagent. The procedure of that task, `design.md`, "The design review", requires `critique` to run as two isolated assessments. The child obeyed the brief, ran one context, and marked the critique degraded. The coordinator found the conflict after the task review, and authorized the two children for round 2.

In the subagent flow of #347, the coordinator built each implementer prompt with one shared helper, which says "You do not dispatch subagents". Task 7 was the design review, and its task brief carried this lesson. The dispatch named no exception. The child ran critique in one context and marked the result degraded. The task review required a repeat with two isolated assessments, which cost a fix round of about one hour.

## Root cause

Inferred: the coordinator reused one implementer template for each task, and did not compare its no-subagent line with the procedure that the task names. An alternative cause is the conflict between the upstream template and a project procedure with its own children. The evidence does not separate these two causes.

Inferred for #347: a shared prompt helper does not vary with the procedure of the task, so the fixed sentence hid the rule that the brief carried. No other cause was ruled out.

## Fix

Proposed prevention, not enforced: before each dispatch, also one from a reused template or a shared helper, search the procedures that the task names for required child agents, and name exactly those children as the exception in that dispatch. A structural follow-up that needs separate authorization: the step `design.md` or the `implement` skill states this exception for a design-review task, or a check compares the procedures that a brief cites with a list of procedures that require children. Until then, this rule stays text, because the choice depends on reading the procedure. Check: a brief for a design review names the two assessments, and its report carries no degraded mark when the host can start them.

## Detection signature

`degraded` in a design-review report, with a brief or a dispatch prompt that holds `Do not spawn a subagent` or `You do not dispatch subagents`

## Rule

Applies when a coordinator writes an implementer brief or a dispatch prompt that forbids subagents, also one that a reused template or a shared helper builds, for a task that names a procedure. Action: before each dispatch, read that procedure for child agents that it requires, and name exactly those children in that dispatch as the one exception. Check: for each task that names a procedure, the dispatch prompt lists each child that the procedure requires, or says that it requires none, and the task report shows that each ran, or the exact limit that stopped it.

## Related lessons

[[give-each-agent-rule-a-check-where-its-actor-reads]]
[[scope-shared-prohibitions-against-required-callers]]
