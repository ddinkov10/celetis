---
{
  "schema": 1,
  "name": "hold-an-issue-whose-spec-waits-for-another-issue",
  "description": "An issue whose approved spec defers its plan behind an open issue gets a hold, so the resolver does not start its plan step early.",
  "tags": [
    "process",
    "recurring"
  ],
  "date": "2026-11-07",
  "status": "active",
  "source": "Plan step session of ddinkov10/celetis#250 on 2026-11-07.\n\nPlan step session of ddinkov10/celetis#141 on 2026-11-05.",
  "incidents": [
    {
      "id": "7133de53-3479-42b6-9872-104a3033db9b",
      "date": "2026-11-07",
      "action": "The specify session of #250 published a spec whose constraints say \"Build after #249 lands\" and whose lessons part says \"the plan of #250 waits for the landing of #249\", and left #250 with no hold, so a plan step session of #250 started while #249 was open.",
      "expected": "An issue whose approved spec defers its plan behind an open issue does not resolve to a plan step until that issue lands.",
      "observed": "The plan step session of #250 started on 2026-11-07. #249 was open with enhancement and ready-for-agent, and its commits f6b8b03, 0fd8ed3, and cedb36c were only on feat/249-send-the-board-presses-to-the. #250 had only the label enhancement. The trunk 050e54f had no commit of #249.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Spec of #250, Constraints: \"Build after #249 lands. ... The plan of #250 measures the files again on the trunk after #249\"; Lessons: \"hold-an-issue-whose-spec-waits-for-another-issue: the plan of #250 waits for the landing of #249.\" gh issue view 249: OPEN, enhancement,ready-for-agent. gh issue view 250: OPEN, enhancement. git merge-base --is-ancestor cedb36c origin/main: NOT_ON_MAIN.",
        "reference": "ddinkov10/celetis#250"
      },
      "inference": "Inferred, not confirmed: the active rule limits its action to the session that finds the deferral, and its review says not to prescribe an extra act after specify publishes its spec. So the specify session of #250 followed the rule, named the lesson in the spec, and added no hold, and the resolver, which reads labels and headings only, chose the plan step again. Alternative: the resolver is correct and the cost of one held session is accepted. Unknown: whether auto mode, a numbered run, or a board press began this session.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "050e54fc9e587f3e2c94c43704716619c69ba58d",
      "brief": "Spec of ddinkov10/celetis#250, \"Lessons that bear on the change\" and \"Constraints\".",
      "lesson": {
        "name": "hold-an-issue-whose-spec-waits-for-another-issue",
        "revision": "050e54fc9e587f3e2c94c43704716619c69ba58d",
        "digest": "450c659d3ca7d4e24410fd3506a25fd05216299c16dc1b1bde29b3caf4d661e9"
      }
    },
    {
      "id": "e3bc9fa6-6aae-450d-b33d-bb0aaef7158e",
      "date": "2026-11-05",
      "action": "The specify session of #141 published a spec whose maintainer decision 4 defers the plan until #248 lands, and left #141 with no hold, so a plan step session of #141 started while #247 and #248 were open.",
      "expected": "An issue whose approved spec defers its plan behind an open issue does not resolve to a plan step until that issue lands.",
      "observed": "The plan step session of #141 started on 2026-11-05. #247 was open with ready-for-agent, #248 was open with only enhancement, and the trunk 92b9133 had engine/celetis-flow.ts and no engine/daemon.ts.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Spec of #141, decision 4: \"The plan and the build of #141 start after #248 lands on the trunk.\" gh issue view 247: OPEN, labels enhancement, ready-for-agent. gh issue view 248: OPEN, labels enhancement. gh issue view 141: OPEN, labels enhancement. ls engine/: celetis-flow.ts, no daemon.ts.",
        "reference": "ddinkov10/celetis#141"
      },
      "inference": "Inferred, not confirmed: specify has no rule that holds an issue whose spec waits for another open issue, and the next-step resolver reads labels and headings only, with no dependency between issues. Unknown: whether the automatic runner or a numbered start by the maintainer began this session.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "92b9133"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "d05e4f59-8e22-404a-8974-7ac6e2b8ff37",
      "requestDigest": "ebc91b4c04ab236160d2a16a0928c135d903a6985f5fc40d18d487d3bf3f6eaa",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nEdit under the reviewer rules: the retained spec deferral and premature plan session are observed evidence, and the stop procedure treats an explicit maintainer deferral as a hold. Limit the rule to the session that finds an approved deferral. Remove the unsupported claim about which start path ran, and do not prescribe an extra act after the specify skill publishes its spec. Preserve the original incident and uncertainty. Use the existing hold and clearance procedure; this lesson adds no dependency resolver or authority to clear a hold.",
      "related": [
        "hold-an-issue-whose-spec-waits-for-another-issue"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A dependency-aware resolver is a separate proposal. Its API facts, authorization, implementation, and checks remain unverified."
      }
    },
    {
      "id": "46e67053-53ab-4b88-b655-df2240936d6a",
      "requestDigest": "672e112e870803f348f43e0c5611e7ea3bf7743202562284579266dca5bd17c3",
      "date": "2026-11-07",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #249; claude child opus/high\n\nMerge under the reviewer rules. The new incident is observed evidence (the spec of #250 defers its build behind #249, #249 open with its commits only on its lane branch, #250 with no hold, a plan session of #250 started) and it recurs the same failure that the active lesson hold-an-issue-whose-spec-waits-for-another-issue holds, so the proposal states the same rule and both incidents stay in one lesson. As proposed, the rule widens to the session that publishes the spec and makes the hold there. That contradicts the specify skill of the plugin celetis: the publish of the spec is an act that moves the line, and only the Terminal message follows it (docs/procedures/stop.md of the plugin celetis, \"The act that moves the line\"). The reviewer rules forbid combining incompatible rules, so the survivor keeps the active rule text. The survivor records the recurrence, the inference that the rule cannot prevent the first plan session, and the two structural follow-ups as proposed. Incident evidence stays unchanged.",
      "related": [
        "hold-an-issue-whose-spec-waits-for-another-issue-at-specify",
        "hold-an-issue-whose-spec-waits-for-another-issue"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A structural change needs separate authorization: either the specify skill ends a spec that defers its next step behind an open issue with a hold in place of the publish, or the resolver reads a dependency line of the spec and prints a stop line while the named issue is open. Its API facts, implementation, and checks remain unverified."
      }
    }
  ]
}
---
# Keep an approved issue dependency on hold

## What happened

Two plan step sessions started while the approved spec of their issue deferred the plan behind an open issue. On 2026-11-05, a plan session of #141 started while the spec said that its plan and build start after #248 lands; #248 was open and #141 had no hold. On 2026-11-07, a plan session of #250 started while its spec said "Build after #249 lands"; #249 was open with `ready-for-agent`, its commits were only on its lane branch, and #250 had only the label `enhancement`. The specify session of #250 named this lesson in the spec and added no hold. Each plan session found the deferral before it wrote a plan. The retained evidence does not identify which start path began either session.

## Root cause

Inference, not confirmed: the absence of a hold let the ordinary resolver select the plan step, because its state does not model dependencies between issues. This rule acts only in the session that finds the deferral, and the specify skill ends at the publish of the spec, so each spec that waits for another issue can cost one plan session that only makes the hold. Alternative: the resolver is correct and the cost of one held session is accepted. Unknown: which start path began each session.

## Fix

Proposed prevention: when a session finds an approved spec that explicitly defers its next step until another issue lands, preserve that decision through the existing stop procedure and write no deferred plan or build. This rule does not add a publication act after the specify skill publishes its spec and does not change its terminal order: the publish of the spec moves the line, and only the Terminal message follows it. Two structural follow-ups are proposed, not authorized and not implemented: (1) the specify skill ends a spec that defers its next step behind an open issue with a hold in place of the publish that makes the issue ready; (2) the resolver reads a dependency line of the spec and prints a stop line while the named issue is open. A check that rejects the recorded mistake: with #249 open, the resolver prints a stop line for #250 and starts no plan session. The rule stays text because the approved dependency and its clearance need judgment.

## Rule

Applies when a session finds an approved spec that defers its plan or build until another issue lands and the precondition remains unmet. Action: write no deferred plan or build; use the existing stop procedure to record the explicit deferral as a hold, naming the blocking issue and the clearance condition. Preserve the existing authority and evidence rules for clearing the hold. Check: while the hold applies, the issue resolver prints a stop line for the issue.
