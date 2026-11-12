---
{
  "schema": 1,
  "name": "keep-the-whole-class-of-a-condition-when-a-pass-co-locates-it",
  "description": "A writing pass that co-located the flag rule of doc-drift-sync narrowed its class, and a reader lost the act of reporting a known rename",
  "tags": [
    "process",
    "regression",
    "recurring"
  ],
  "date": "2026-11-12",
  "status": "active",
  "source": "The implement session of #299 on Claude Code, Task 4 (doc-drift-sync), child t4-impl, reported to the coordinator, 2026-11-12",
  "incidents": [
    {
      "id": "8b4312c4-2954-4a7a-8ec9-c01fd586eed1",
      "date": "2026-11-12",
      "action": "The first edit of doc-drift-sync (commit d0be0de) co-located the three copies of the flag rule into one list item and worded its class as the item of one place, which narrowed the class that the base copies gave together.",
      "expected": "The kept copy holds each condition of the base copies whole, so a reader still flags and reports every discrepancy class that the base names, also a known rename in an excluded file.",
      "observed": "Reading case dd-C10 Q2 on Codex, base tree fwia against new tree o7bj: the judge gave one unsettled; the base answer reports the remaining references in the closing summary by the Flag rule, the new answer says the Flag rule covers unresolved discrepancies and these known renames are not one. A later commit (bb04f4e) kept the general class of the flag item, and the final tree passed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "dd-C10 Q2 codex one unsettled: Both leave the plan and ADR unchanged. fwia also reports the remaining references in the closing summary, citing the Flag rule. o7bj says the text does not settle whether to report them, because the Flag rule covers unresolved discrepancies and these known renames are not one.",
        "reference": "/Users/dinq/.cache/celetis-299-proof/report/dd-tally-o7bj.txt"
      },
      "inference": "Inferred by the child and the coordinator: the merge of scattered copies kept the wording of one copy, and that copy named a narrower class than the union of the copies. Alternative: run variance on Codex; not excluded by one run, but the fix commit restored the act.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "d0be0dea36578f2f2a25737012e90d753ab0dc36",
      "brief": "The Task 4 brief of #299 carried the lesson rule plan-condition-must-not-narrow-a-spec-rule and the M3 fault line: 'The kept copy is where the actor flags; each condition stays (a claim that cannot be confirmed, a dangling filename, an ambiguous rename, a guessed count, a gap outside the diff), and the act don't edit stays with it.'",
      "lesson": {
        "name": "plan-condition-must-not-narrow-a-spec-rule",
        "revision": "f123b8f",
        "digest": "4ae38f3cabfddef721d74bcfb78b066f1c319f1ee2ffde03e17e30c5f2565811"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c566647b-2edd-468c-8869-0bfe55ec6c7a",
      "requestDigest": "ddc764ba8da82793b6b7b15083e1e10dd9efeb8cf6eb73ea6be149dfced6a139",
      "date": "2026-11-12",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #297; claude child opus/high\n\nApprove, under the reviewer rules. The incident is observed tool output: reading case dd-C10 Q2 of #299 on Codex gave one unsettled between base tree fwia and new tree o7bj after commit d0be0de co-located the flag rule of doc-drift-sync, and commit bb04f4e restored the general class. The rule states applicability, action, and check; it adds a reading case, widens no permission, and weakens no check. It does not state the same rule as plan-condition-must-not-narrow-a-spec-rule, which covers a plan, a brief, or a ruling that changes a spec rule, nor as ask-the-act-of-a-deleted-sentence-and-of-its-neighbours, which asks the act of a deleted sentence but does not require the kept copy to hold the union of the classes of all copies; so no merge applies. It agrees with the skill writing-for-agents, Co-location, which groups one meaning under one heading. The diagnosis not-followed and the run-variance alternative stay labeled as inference.",
      "related": [
        "keep-the-whole-class-of-a-condition-when-a-pass-co-locates-it"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the class of a condition is a judgment of meaning that no static check compares, and the differential reading check already caught this case. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Keep the whole class of a condition when a pass co-locates it

## What happened

In #299, Task 4 co-located the flag rule of `doc-drift-sync` from three places into one list item. The first wording (commit `d0be0de`) named a narrower class than the three base copies gave together. On Codex, reading case `dd-C10` Q2 lost the act of reporting a known rename in an excluded file (judge: one unsettled). Commit `bb04f4e` restored the general class, and the final tree passed.

## Root cause

Inferred: the merged item kept the words of one copy and not the union of the conditions of all copies. The brief carried the lesson `plan-condition-must-not-narrow-a-spec-rule` and the list of conditions to keep, so the rule reached the task and was not followed. Run variance on Codex is not excluded by one run.

## Fix

Proposed, not new structure: the differential reading check of the pass caught the narrowing before the review, so the existing proof method is the enforcement that worked here. The rule stays text, because the class of a condition is a judgment of meaning that no static check can compare.

## Rule

Applies when a writing pass merges or co-locates copies of one rule from several places. Action: before the edit, list the conditions and classes of every copy, and word the kept copy so that it holds their union; run a reading case for each class. Check: each class of each base copy maps to words of the kept copy, and its reading case gives the same act on each host.

## Related lessons

[[plan-condition-must-not-narrow-a-spec-rule]]
[[keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer]]
