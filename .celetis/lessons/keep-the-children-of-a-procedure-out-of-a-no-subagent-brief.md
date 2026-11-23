---
{
  "schema": 1,
  "name": "keep-the-children-of-a-procedure-out-of-a-no-subagent-brief",
  "description": "An implementer brief forbade every subagent, so a design review that requires two isolated critique assessments ran degraded",
  "tags": [
    "process"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of issue #360, the dispatch and the task review of Task 8",
  "incidents": [
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
  "recurrences": 0,
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
    }
  ]
}
---
# Keep the children of a procedure out of a no-subagent brief

## What happened

The implement session of #360 dispatched Task 8, a design review, with the standard implementer text that forbids each subagent. The procedure of that task, `design.md`, "The design review", requires `critique` to run as two isolated assessments. The child obeyed the brief, ran one context, and marked the critique degraded. The coordinator found the conflict after the task review, and authorized the two children for round 2.

## Root cause

Inferred: the coordinator reused one implementer template for each task, and did not compare its no-subagent line with the procedure that the task names. An alternative cause is the conflict between the upstream template and a project procedure with its own children. The evidence does not separate these two causes.

## Fix

Proposed prevention, not enforced: before a dispatch, search the procedures that the task names for required child agents, and name exactly those children as the exception in the brief. A structural follow-up that needs separate authorization: the step `design.md` or the `implement` skill states this exception for a design-review task. Check: a brief for a design review names the two assessments, and its report carries no degraded mark when the host can start them.

## Detection signature

`degraded` in a design-review report, with a brief that holds `Do not spawn a subagent`

## Rule

Applies when a coordinator writes an implementer brief that forbids subagents, for a task that names a procedure. Action: read that procedure for child agents that it requires, and name exactly those children in the brief as the one exception. Check: each child that the named procedure requires appears in the brief, and the task report shows that each ran, or the exact limit that stopped it.

## Related lessons

[[give-each-agent-rule-a-check-where-its-actor-reads]]
