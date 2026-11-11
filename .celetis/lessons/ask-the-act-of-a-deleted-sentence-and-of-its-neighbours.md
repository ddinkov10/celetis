---
{
  "schema": 1,
  "name": "ask-the-act-of-a-deleted-sentence-and-of-its-neighbours",
  "description": "A writing pass removed sentences that it classified as a copy, a policy restatement, or exposition, and readers lost a settled act",
  "tags": [
    "process",
    "regression",
    "recurring"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of ddinkov10/celetis#298 on Claude Code, Task 3 (lesson-review), 2026-11-11",
  "incidents": [
    {
      "id": "92343440-3dda-4dae-a9eb-209a533baa68",
      "date": "2026-11-11",
      "action": "Task 3 of #298 deleted the clause \"`apply` refuses a dirty tree or a detached HEAD with exit 2\" of lesson-review step 3 as a restated engine policy, and earlier deleted the step-3 clause on unrelated edits as a scattered copy of the step-4 rule.",
      "expected": "Each reading case gives the same act on the base text and on the new text, also for the unchanged sentences next to an edit.",
      "observed": "The blind differential reading check changed acts twice: with the step-3 clause gone, readers on both hosts no longer reported the commit conflict before apply (lesson-review-C06 Q1, Q3); with the exit 2 clause gone, Codex readers changed the act after the unchanged sentence \"Exit 2 requires correction of the named input or of the checkout state\" (2 of 3 runs add a new preview and approval; 0 of 3 base runs).",
      "source": {
        "kind": "tool-output",
        "excerpt": "lesson-review-C07 Q2 codex: different majority act: mvyg majority (runs 1 and 2): correct the named request field, then make a new preview, display it and get approval again. aabd (all three runs): correct the named request field, with no new preview, display or approval step.",
        "reference": "/Users/dinq/.cache/celetis-298-proof/report/tally-lesson-review.txt (second new tree mvyg)"
      },
      "inference": "Inferred: a clause that restates engine behavior also tells the reader which case a nearby exit or rule sentence covers; without it, the reader fills the case from other steps. Alternative: run-to-run variance on Codex; the 3-run majorities differ, so variance alone is less likely.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "9a3a81a",
      "brief": "The plan of #298, Task 3, carried keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer, which covers a copy that becomes a pointer, not a deleted policy clause or a clause next to an unchanged exit sentence.",
      "lesson": {
        "name": "keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer",
        "revision": "9a3a81a",
        "digest": "874cbde10f3442380bb25ad5fdb5f7d82ffdeff81c1fe99ada94bb902723f3c3"
      }
    },
    {
      "id": "5d3b5b1c-00d3-4042-97e3-406ceeb66c56",
      "date": "2026-11-11",
      "action": "Task 4 of #298 deleted the last sentence of the capture states table (\"When `triage` later routes the issue to `chore` or `hotfix`, the record stays on the issue as a source comment, and those lanes do not read it.\") as a relevance fault with no act of the capture.",
      "expected": "Each reading case gives the same act on the base text and on the new text.",
      "observed": "capture-C15 Q1 (both hosts) and Q2 (Codex) changed from settled to unsettled after 3 runs on each tree: 3 of 3 base runs settle that the record stays and chore does not read it; 3 of 3 new runs do not.",
      "source": {
        "kind": "tool-output",
        "excerpt": "capture-C15 Q1 codex: different majority act: sm6z (3/3): unsettled, since no rule says to keep, delete, or mark the posted record after triage routes to chore. aabd (3/3): the record stays on the issue as a source comment.",
        "reference": "/Users/dinq/.cache/celetis-298-proof/report/capture.md"
      },
      "inference": "Inferred: a sentence about what later lanes do still settles a question that a reader of this skill asks; the no-act verdict was a judgment of the editor, not a reading result.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "897d9d0"
    },
    {
      "id": "80d89015-1314-4972-9412-844e9a8807f7",
      "date": "2026-11-11",
      "action": "Task 6 of #298 deleted \"Re-read state before retrying; retain valid evidence and never replay an uncertain write blindly.\" after the exit list of accept-epic step 4, as a duplicate of epic.md \"A partial write\".",
      "expected": "Each reading case gives the same act on the base text and on the new text.",
      "observed": "accept-epic-C05 Q3 on Claude: after exit 2, 3 of 3 base runs re-read the state and resubmit; 1 of 3 new runs do. epic.md \"A partial write\" covers only exit 6, so the sentence was wider than the module.",
      "source": {
        "kind": "tool-output",
        "excerpt": "accept-epic-C05 Q3 claude: different majority act: 2x6s majority (runs 1 and 2) is unsettled ... aabd majority (all 3 runs): correct the envelope, re-read epic-state and re-check coverage and evidence lifetime, keep valid evidence, then run complete-epic again.",
        "reference": "/Users/dinq/.cache/celetis-298-proof/report/accept-epic.md"
      },
      "inference": "Inferred: the sentence covered each retry after each exit, not only the exit that the cited module covers; the duplicate test compared words, not the cases that each text covers.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "5eedc7a"
    }
  ],
  "recurrences": 2,
  "reviews": [
    {
      "id": "ccbf486a-e9bf-40fe-9ee6-4fba68ea64b9",
      "requestDigest": "44f8d01b8012f543ee4ee2c1113a2b4c218627d140b261a17b21a7bfefeae6bc",
      "date": "2026-11-11",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #298; claude child opus/high\n\nEdit, then approve, under the reviewer rules. The three incidents are observed: the blind differential reading check of #298 changed an act or its settledness in lesson-review-C06 and C07, capture-C15, and accept-epic-C05, and the fix commits 557f325, 9a3a81a, 897d9d0, and 5eedc7a restored each sentence; the restored sentences match the trunk text. The rule states applicability, action, and check; it adds reading cases, widens no permission, and weakens no check. It agrees with the skill writing-for-agents, Pruning, which settles a no-op by running the document. It does not state the same rule as keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer (a pointer) or keep-a-copy-of-a-deduplicated-rule-on-each-path-that-reaches-its-act (the paths into a step), so no merge applies. The edit replaces the tags agent-text and reading-check, which are not in the tag vocabulary, with process, regression, and recurring (three incidents); renames the lesson to match its rule, because the old name named one incident; states the restoration as a fact of the fix commits; and links the path lesson.",
      "related": [
        "a-removed-policy-clause-can-carry-the-meaning-of-its-neighbour",
        "ask-the-act-of-a-deleted-sentence-and-of-its-neighbours"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the act of a sentence depends on a reading, and no structural check exists."
      }
    }
  ]
}
---
# Ask the act of each removed sentence and of its neighbours before a writing pass deletes it

## What happened

The build of #298 deleted sentences of agent text as restated policy, scattered copies, module duplicates, or exposition. The reading check found four changed acts: in lesson-review, the report of a commit conflict before apply (both hosts) and the act after an unchanged exit 2 sentence (Codex); in capture, the fate of a posted record after a route to chore (both hosts); in accept-epic, the re-read and resubmission after exit 2 (Claude). The fix commits restored each sentence with the bytes of the base text.

## Root cause

Inferred: a deleted sentence can hold an act of its own step that the other copy does not have at that time, cover more cases than the module it seems to copy, settle a question that the editor judged to be no act, or tell the reader which case a neighbour sentence covers. The active lesson on dedup covers only a copy that becomes a pointer. Uncertain: run-to-run variance can add to single results.

## Fix

Proposed prevention, as text: the reading cases of a writing pass ask the act of each sentence that it deletes and of each unchanged neighbour sentence about the same command, exit, or case, also when the deletion is classed as a duplicate or as exposition. No structural check exists; the act depends on a reading, so the rule stays text.

## Rule

Applies when a writing pass deletes a sentence or a clause of agent text (a restated policy, a scattered copy, a module duplicate, or exposition). Action: before the edit, write a reading case question for the act of the deleted sentence and of each unchanged neighbour sentence about the same command, exit, or case, and run it on the base and the new text on each host; keep the sentence when an act or its settledness changes. Check: the case file names each deleted sentence and each such neighbour with its question, and the verdict on each host is the same act.

## Related lessons

[[keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer]]
[[keep-a-copy-of-a-deduplicated-rule-on-each-path-that-reaches-its-act]]
