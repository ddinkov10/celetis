---
{
  "schema": 1,
  "name": "run-a-named-skill-command-by-its-reference",
  "description": "The design review of #368 ran the impeccable audit as own checks, with no dimension scores and no Audit Health Score, and missed two findings that the audit reference names",
  "tags": [
    "ui",
    "process"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "The implement session of #368 on Claude Code, Task 7 (the design review) and its task review, 2026-11-25",
  "incidents": [
    {
      "id": "6b1f4e2a-3c8d-4f7a-9e51-368000000201",
      "date": "2026-11-25",
      "action": "The Task 7 implementer ran audit as \"own checks\" (accessibility, responsive, contrast) and did not read <impeccable>/reference/audit.md.",
      "expected": "design.md, \"The design review\", step 1 runs audit by its reference: five dimensions scored 0-4 and an Audit Health Score, and the report keeps each unfixed finding.",
      "observed": "The task reviewer found no score and no Performance, Theming, or Implementation Integrity dimension, and two unlisted findings: the global reduced-motion kill and the global * scrollbar rule. After the fix round, the report gives 15/20 and lists seven unfixed audit findings.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Important 1: the audit ran as \"own checks\" and not by reference/audit.md. That reference needs five dimensions with a score of 0 to 4 and an \"Audit Health Score\" report.",
        "reference": "issue #368 runtime verification comment (design review section)"
      },
      "inference": "Inferred: the brief told the child to follow design.md, and design.md says \"by its reference\", but the child took the word audit as a task name. Alternative: the long state sweep left no budget for the reference read.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "8472dab"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "e5832fd9-e483-45a4-b5a1-c8768fc31a36",
      "requestDigest": "4d20cdeaf74daa9d337abf396597f6d5500fbf33c1369fcaf327806a4209c986",
      "date": "2026-11-25",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #368; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed tool output of the #368 task review: the design review ran audit as own checks, with no dimension scores and no Audit Health Score, and missed two findings that the audit reference names. The rule states applicability, action, and check. It agrees with design.md of the plugin celetis (\"A skill command ... runs by its reference\", and step 1 of \"The design review\"), widens no permission, weakens no check, and adds no network or credential act. No live or historical lesson holds the incident or states the rule; the impeccable lessons run-a-project-config-tool-from-the-project-root and scan-the-changed-ui-state-not-a-fresh-load cover other rules. The cause and its alternative stay labeled as inference.",
      "related": [
        "run-a-named-skill-command-by-its-reference"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A brief that hands a procedure with skill commands to a child names the reference file of each command and its required output sections. This needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Run a skill command that a procedure names by its reference file

## What happened

In Task 7 of #368, the design review ran `audit` as a self-made list of checks. The task reviewer found that the report had no dimension scores and no Audit Health Score, which <impeccable>/reference/audit.md requires, and that it missed two findings of that reference. One fix round ran the audit by the reference.

## Root cause

Inferred, not confirmed: the child took the command name as a description of the work and did not open the reference file that design.md names. Alternative: the long state sweep before it.

## Fix

Proposed: a brief that hands a procedure with skill commands to a child names the reference file of each command and its required output sections. This depends on judgment of the brief author, so the rule stays text.

## Rule

Applies when a procedure says to run a skill command by its reference (for example `critique` or `audit` of `impeccable`). Action: read the reference file of that command before it runs, and produce each output section that the reference requires. Check: the task report holds each required section of the reference (for `audit`, the five scores and the Audit Health Score), and names the reference path.
