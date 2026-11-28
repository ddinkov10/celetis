---
{
  "schema": 1,
  "name": "cite-only-durable-sources-in-a-landed-record",
  "description": "Decision records cited sources that a later reader could not open: a git-ignored plan file in #261, and a Verify report that the build of #394 had not yet posted",
  "tags": [
    "process",
    "recurring"
  ],
  "date": "2026-11-28",
  "status": "active",
  "source": "The implement session of #394 on Claude Code, final whole-branch review, 2026-11-28\n\nTask 6 review of ddinkov10/celetis#261",
  "incidents": [
    {
      "id": "ee7d81a0-40cd-47e3-b126-f6385eeb66f2",
      "date": "2026-11-28",
      "action": "Task 3 of #394 wrote in ADR-0151, \"Constraints and evidence\": \"The build of #394 observed it on 2026-11-28, and its Verify report on the issue holds the output.\" The report did not exist yet.",
      "expected": "A landed record cites only a durable source that exists when it is written, or quotes the decisive evidence itself.",
      "observed": "The final whole-branch reviewer ran `gh issue view 394 --json comments`, found 4 comments and no Verify report, and reported the bullet; the fix 5066b2e quoted the EPERM line in the record.",
      "source": {
        "kind": "tool-output",
        "excerpt": "ADR-0151, \"Constraints and evidence\", last bullet, cites a source that does not exist yet ... `gh issue view 394 --json comments` lists 4 comments and no Verify report.",
        "reference": "https://github.com/ddinkov10/celetis/issues/394#issuecomment-7229781958"
      },
      "inference": "Inferred: the session planned to publish the report later and cited it in advance. Alternative: none found.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "cea2c30",
      "brief": "Task 3 of the plan of #394 carried the rule: \"cite only a tracked file, an issue or comment URL, or another durable link\".",
      "lesson": {
        "name": "cite-only-durable-sources-in-a-landed-record",
        "revision": "eed50cc",
        "digest": "e7c79584a91655f2d17eb06139c4e596cd6d6ed51997331c4f7d2a4ee26c827b"
      }
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "9b1aebc9-69d9-41d3-8aa0-53cb00a21ade",
      "requestDigest": "7f9de865b21473f9f2fb3b5e2d22bbc2106234f33106a0328984de1c1b1a3336",
      "date": "2026-11-28",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #394; claude child opus/high\n\nMerge under the reviewer rule for a proposal that states the same rule as an active lesson: the active lesson cite-only-durable-sources-in-a-landed-record requires that each source of a landed record stays resolvable, the incident names it as the lesson not followed, and the proposal proposes this extension of it in its Fix. The incident is observed: in the lane, commit 5066b2e replaces the ADR-0151 sentence \"its Verify report on the issue holds the output\" with the quoted EPERM line. The survivor keeps the active name and every incident and review, adds the #394 incident first and the tag recurring, and adds to the rule that a cited source exists when the sentence is written. The proposal check that each comment URL resolves at commit time is edited to a URL that a completed posting act printed, so the rule adds no network act. The cause stays labeled as inference with its alternative. The rule adds a check, weakens none, and contradicts no skill, principle, or instruction file.",
      "related": [
        "cite-no-evidence-that-the-build-has-not-yet-published",
        "cite-only-durable-sources-in-a-landed-record"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: a gate check that resolves comment links needs network access and separate authorization, and whether a sentence cites a future source needs judgment."
      }
    }
  ]
}
---
# Cite only durable sources in a landed record

## What happened

Task 6 of #261 wrote the decision record of the change. It cited `docs/superpowers/plans/261.md` as the home of the crossing commands and used the plan's task and scenario labels as evidence. `.gitignore` ignores `docs/superpowers/`, so the file is a local copy that no later reader has. The task review found it, and 55feb18 linked the plan comment of the issue instead.

Task 3 of #394 wrote ADR-0151 before the Verify phase. Its "Constraints and evidence" said that the Verify report on the issue holds an `EPERM` output. The brief of the task carried this lesson. The final whole-branch review found no such comment on the issue. Commit 5066b2e of the lane quoted the error line in the record instead.

## Root cause

Inferred: the local plan copy, which each lane session fetches, looked like a repository file. An alternative is that the brief named the plan by its local path.

In #394, inferred: the session cited a report that it planned to post later. The incident records the rule as not followed; an alternative is that the rule named durable links but not the time at which the source must exist.

## Fix

Proposed prevention: before a record lands, check each cited path with `git check-ignore` and `git ls-files`. A structural check in the gate could refuse a link of a decision record to an ignored path; that needs separate authorization.

For evidence of the current build, post the report first and cite the URL that the posting act printed, or quote the decisive evidence in the record. A gate check that resolves comment links needs network access and separate authorization, so this part stays text.

## Rule

Applies when a decision record or another landed document cites its sources or its evidence. Action: cite only a tracked file, an issue or comment URL, or another durable link that exists when the sentence is written; for a scratch or git-ignored file, cite its durable copy, and say once what any plan-only label names; for evidence that the build has not yet posted, quote the decisive evidence in the document, or cite it only after it is posted. Check: each path that the record cites is listed by `git ls-files` and not by `git check-ignore`, each label resolves through a cited durable link, each cited comment URL is one that a completed posting act printed, and no sentence names a report that the build still has to post.
