---
{
  "schema": 1,
  "name": "cite-only-durable-sources-in-a-landed-record",
  "description": "A decision record cited a git-ignored plan file as the home of its commands, so a later reader could not open the source",
  "tags": [
    "process"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Task 6 review of ddinkov10/celetis#261",
  "incidents": [
    {
      "id": "f6b66d56-4e5a-4023-bbde-dc857217babc",
      "date": "2026-11-09",
      "action": "Task 6 of #261 wrote the decision record of the change with the source docs/superpowers/plans/261.md and with labels of that plan (Task N, VN) as the evidence of its claims.",
      "expected": "A landed record stays resolvable after the lane ends: each cited source is a tracked file or a durable link.",
      "observed": ".gitignore:4 ignores docs/superpowers/, so the plan file is not tracked; the task review found it, and 55feb18 replaced the path with the plan comment link and named what the labels mean.",
      "source": {
        "kind": "tool-output",
        "excerpt": "git check-ignore -v docs/superpowers/plans/261.md -> .gitignore:4:docs/superpowers/\tdocs/superpowers/plans/261.md",
        "reference": "https://github.com/ddinkov10/celetis/issues/261#issuecomment-6729102229"
      },
      "inference": "Inferred: the writer took the local plan copy, which every lane session fetches, as a repository file. Alternative: the brief named the plan by that path.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "2b2ca14"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "5a183f70-d963-411a-830d-e52e28d5b742",
      "requestDigest": "318e4c6a0a76256a4a3225eb0bca4963a6ce52ab0377d549fa553047bfe9543a",
      "date": "2026-11-09",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #261; claude child opus/high\n\nApprove under the reviewer rules: the retained git check-ignore output is observed evidence that the landed record cited an ignored path, the rule states applicability, action, and a check, and it agrees with the ADR guidance of the plugin and with preserve-intended-behavior. No active or historical lesson holds the incident or the same rule. It widens no permission and weakens no check.",
      "related": [
        "cite-only-durable-sources-in-a-landed-record"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The Fix names a gate check that refuses a decision-record link to an ignored path. This review does not authorize that change."
      }
    }
  ]
}
---
# Cite only durable sources in a landed record

## What happened

Task 6 of #261 wrote the decision record of the change. It cited `docs/superpowers/plans/261.md` as the home of the crossing commands and used the plan's task and scenario labels as evidence. `.gitignore` ignores `docs/superpowers/`, so the file is a local copy that no later reader has. The task review found it, and 55feb18 linked the plan comment of the issue instead.

## Root cause

Inferred: the local plan copy, which each lane session fetches, looked like a repository file. An alternative is that the brief named the plan by its local path.

## Fix

Proposed prevention: before a record lands, check each cited path with `git check-ignore` and `git ls-files`. A structural check in the gate could refuse a link of a decision record to an ignored path; that needs separate authorization.

## Rule

Applies when a decision record or another landed document cites its sources or its evidence. Action: cite only a tracked file, an issue or comment URL, or another durable link; for a scratch or git-ignored file, cite its durable copy, and say once what any plan-only label names. Check: each path that the record cites is listed by `git ls-files` and not by `git check-ignore`, and each label resolves through a cited durable link.
