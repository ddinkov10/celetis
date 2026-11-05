---
{
  "schema": 1,
  "name": "hold-an-issue-whose-spec-waits-for-another-issue",
  "description": "An issue whose approved spec defers its plan behind an open issue gets a hold, so the resolver does not start its plan step early.",
  "tags": [
    "process"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Plan step session of ddinkov10/celetis#141 on 2026-11-05.",
  "incidents": [
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
  "recurrences": 0,
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
    }
  ]
}
---
# Keep an approved issue dependency on hold

## What happened

A plan session of #141 started while the approved spec said that its plan and build start after #248 lands. The retained output showed #248 open and #141 without a human hold. The session found the conflict before writing a plan and handed the deferral to the issue. The retained evidence does not identify which start path began the session.

## Root cause

Inference: the absence of a hold let the ordinary resolver select the plan step, because its state does not model dependencies between issues. Unknown: whether the automatic runner or a numbered maintainer start began this session.

## Fix

Proposed prevention: when a session finds an approved spec that explicitly defers its next step until another issue lands, preserve that decision through the existing stop procedure and write no deferred plan or build. This rule does not add a publication act after the specify skill publishes its spec and does not change its terminal order. A separate resolver change could model issue dependencies, but no API shape, implementation, or enforcement is established. The rule stays text because the approved dependency and its clearance need judgment.

## Rule

Applies when a session finds an approved spec that defers its plan or build until another issue lands and the precondition remains unmet. Action: write no deferred plan or build; use the existing stop procedure to record the explicit deferral as a hold, naming the blocking issue and the clearance condition. Preserve the existing authority and evidence rules for clearing the hold. Check: while the hold applies, the issue resolver prints a stop line for the issue.
