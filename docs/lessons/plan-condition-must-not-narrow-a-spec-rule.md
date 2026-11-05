---
{
  "schema": 1,
  "name": "plan-condition-must-not-narrow-a-spec-rule",
  "description": "A plan changed a spec rule or its condition, and the build dropped a required case",
  "tags": [
    "process",
    "ui",
    "recurring"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "Task 3 review of #182 (ddinkov10/celetis), controller-confirmed reproduction",
  "incidents": [
    {
      "id": "5b1f0c2e-8a47-4d1e-9c3a-2f6e7d81a4b9",
      "date": "2026-11-02",
      "action": "The #182 plan (Task 3, 'The session rule') required a link label for a runner foreground: 'a runner (an element whose basename is celetis-flow.ts) while labels[LINK] is set'. The implementer built it as specified (engine/board/place.ts:19, commit fc1460b).",
      "expected": "The spec rule ('The board -> Sessions') accepts 'a Celetis command that runs the host in the foreground (the runner celetis-flow.ts ...)' with no label condition; Acceptance 6 wants a card for each hc terminal of the repository.",
      "observed": "A hand-run `celetis-flow --resume <n>` sets no link label (resume mode is not managed, engine/celetis-flow.ts:663), so its terminal got no card at all.",
      "source": {
        "kind": "tool-output",
        "excerpt": "rv3/r3b.ts on fc1460b: 'hand-run resume, no link label: []' and 'board Resume, link #7 plan: [[\"t5\",7,\"blocked\"]]'; fixed in 6506cd7 (runner with --resume accepted).",
        "reference": "ddinkov10/celetis#182, commits fc1460b and 6506cd7"
      },
      "inference": "Inferred: the planner added the label condition to hide a stale status between two runner steps, and checked it only against the step runner, not against every runner mode (resume). Alternative: the spec's own 'stale done' risk pushed the planner to narrow the rule. The plan review did not compare the condition with the spec's rule text.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "fc1460b"
    },
    {
      "id": "c3d9a6e1-4f2b-4b7a-9e15-7a8d2c64f0b3",
      "date": "2026-11-02",
      "action": "The #232 plan (Risks and decision points, 'The empty space') replaced the spec's close rule 'or when the runner ends' with 'when that issue run ends', and Task 3 built it (engine/celetis-flow.ts: runIssue's finally calls closeTabs, which closes the pending normal-end tab).",
      "expected": "The #232 spec, 'Left to the builder': 'If the app removes an empty space, the runner closes the tab of a normal end only after the next session tab of the same start is open, or when the runner ends.'",
      "observed": "Verify V1 on 44d1e65 (target: clone at 94b60b8 plus the lane diff, tree cdd61616): after #1 closed and its last tab closed, herdr-app ls listed the space celetis-v232-6a5c47 only under 'recent', so the app removes an empty space. With the per-issue-run close, a queue or automatic runner closes the last tab of one issue, the space goes, and the next issue makes the space again and shows it.",
      "source": {
        "kind": "tool-output",
        "excerpt": "V1-after-close snapshot 2026-11-02T21:23:52Z: spaces with name celetis-v232-*: []; herdr-app ls 'recent': {\"name\": \"celetis-v232-6a5c47\"}. Task 3 review M3: 'deferred close per runIssue, not per start (plan-mandated; depends on V1 empty-space fact)'.",
        "reference": "ddinkov10/celetis#232, Verify V1, fix task verify-1"
      },
      "inference": "Inferred: the planner narrowed the spec's 'when the runner ends' so that a finished tab does not stay open while an automatic runner waits, and kept the code independent of the unknown empty-space fact. The plan review and the final review flagged the difference only as conditional on the fact. Alternative: the planner read 'the same start' as one issue run.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "44d1e65"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "8385ab4c-cffb-479f-9c23-69fddfe2c2e9",
      "requestDigest": "743280b23254656eae27accb9611cb56dc8e37010b510dba9da2cf91d7966b5d",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #236; codex child host default/high\n\nApprove under the reviewer rules: two retained incidents show a specification rule narrowed by the plan, and the causes remain marked as inference. The rule gives scope, action, and a check against the approved source or a recorded decision. It agrees with the current acceptance coverage procedure. Its proposed structural follow-up remains proposed.",
      "related": [
        "plan-condition-must-not-narrow-a-spec-rule"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Consider a separate instruction change that compares each plan rule with its specification source during the existing acceptance coverage review. This review does not authorize that change."
      }
    }
  ]
}
---
# A plan must not change a spec rule or its condition without a maintainer decision

## What happened

Two incidents. In #182, the plan added a link-label condition to the spec's session rule for a
runner foreground. The build followed the plan. A hand-run `celetis-flow --resume <n>` sets no
link label, so its terminal got no board card. The Task 3 review reproduced it at the
`sessionsOf` boundary (`hand-run resume, no link label: []`), and fix 6506cd7 also accepts a
runner with `--resume`.

In #232, the spec said that, when the Herdr app removes an empty space, the runner closes the tab
of a normal end only after the next session tab of the same start is open, or when the runner
ends. The plan replaced "when the runner ends" with "when that issue run ends", and the build
followed it. Verify V1 then showed that the app removes an empty space, so the build missed the
spec rule for a start with more than one issue (a board Queue or the automatic runner).

## Root cause

Inferred, not established: in #182 the condition was added to hold out a stale status between two
runner steps, and was checked only against the step runner. In #232 the plan narrowed the rule so
that a finished tab does not stay open while an automatic runner waits. In both cases the plan
review did not hold the plan text to the spec rule text, and the change got no maintainer
decision. The planning transcripts were not read.

## Fix

Proposed prevention (text, not enforced): when a plan states a rule that the spec states, quote
the spec rule, and mark each difference (an added condition, a removed case, a changed scope) as
a decision that the maintainer records before the build. List each mode or caller that the rule
covers (for the runner: numbered, automatic, queue, resume) and check the plan rule against each
one in a probe. This depends on judgment about which modes exist and which wording is a change,
so it stays a text rule; a structural check would need a machine-readable spec rule, which the
project does not have. A proposed follow-up, which needs separate authorization: the acceptance
coverage review of the plan step compares each plan rule that quotes the spec with its source text.

## Detection signature

A plan sentence that adds `while`, `only when`, or `and` to a rule quoted from the spec, or
replaces a scope word of the spec ("the runner", "the same start") with a narrower one, with a
probe or a Verify scenario that covers fewer modes than the spec rule names.

## Rule

Applies when a plan or a task brief changes a rule that the approved spec states: an added
condition, a removed case, or a narrower scope. Action: quote the spec rule, name every mode,
caller, or entry point that it covers, and add a probe case for each mode that the change can
exclude. Check: each excluded mode is one that the spec excludes too, or the plan records a
maintainer decision for it.
