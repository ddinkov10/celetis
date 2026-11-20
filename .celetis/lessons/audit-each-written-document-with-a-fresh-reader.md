---
{
  "schema": 1,
  "name": "audit-each-written-document-with-a-fresh-reader",
  "description": "Six documents that the skill document wrote passed the parent source check, and an independent claim audit then listed about 40 unsourced or wrong statements",
  "tags": [
    "process",
    "false-negative"
  ],
  "date": "2026-11-20",
  "status": "active",
  "source": "implement #354, Verify V7 (claim audit) of the documents of Task 3",
  "incidents": [
    {
      "id": "67e325b3-65c3-49be-a7ea-2b06c18f57d0",
      "date": "2026-11-20",
      "action": "The parent session of the skill document accepted six child-written explanation documents after its step 5 check that each claim names a source",
      "expected": "Each statement of each document comes from a file of the checkout (the anti-goal of the spec of #354: no claim without a source)",
      "observed": "The V7 audit of the six documents at dc9d2c7 listed about 40 statements with no source or a conflicting source; after two fix tasks the third audit still listed accepted items in board.md and records.md",
      "source": {
        "kind": "tool-output",
        "excerpt": "change-lifecycle.md: 'The feature lane has the most steps.' This is wrong. workflow.ts gives feature and bug four steps each. board.md: 'four homes' ... The records give five homes.",
        "reference": "https://github.com/ddinkov10/celetis/issues/354"
      },
      "inference": "The writer and the checker share the context of the sources, so a synthesis past a source looks sourced to both; or the writers did not follow the rule. Not distinguished.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "dc9d2c7"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "3300c70b-3e1e-4082-8761-befb381bc4a1",
      "requestDigest": "421f560cc908a3d43fec80c9ad7d56c8a78366dd2e2156fb2ac6596607199c54",
      "date": "2026-11-20",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #333; claude child opus/high\n\nApprove by the reviewer rules: the proposal has observed tool-output evidence of the #354 claim audit, states applicability, action, and check, labels its cause as an unproven inference with the alternative, and uses tags of the vocabulary. The rule adds an independent check before a commit and widens no permission. It does not contradict step 5 of the skill document on the branch of #354, which the reviewer read: that step keeps its parent check, and the rule adds a reader that did not write the document. No active lesson states the same rule; keep-child-verification-prompts-independent covers the prompt of a verification child, not an audit of written claims.",
      "related": [
        "audit-each-written-document-with-a-fresh-reader"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Step 5 of the skill document (branch of #354) runs one fresh audit child for each written document and sends each listed statement back to the writer once; this needs a separately authorized change of the skill."
      }
    }
  ]
}
---
# Audit each written document with a fresh reader before the commit

## What happened

The first run of the skill `document` on this repository (issue #354, Task 3, commit fb6a0d2) wrote six explanation documents in six child agents. The parent read each file and checked that it "names a source for each claim" (SKILL.md step 5), and it passed all six. The plan's claim audit (V7: a fresh `claude -p` reader with Read, Grep, and Glob that lists each statement with no file that states it) then listed about 40 items across the six documents: wrong facts (the feature lane "has the most steps"; the board "had four homes"; a stop of the daemon "ends no session"), wrong citations, and reasons with no record. Three fix tasks (verify-1, verify-2, and their repairs) and three audits followed. At the third audit, board.md and records.md still had accepted items.

## Root cause

Inference, not proven: the writer child and the parent check share one context of the sources that the writer read, so a synthesis or a paraphrase that goes past a source looks sourced to both. An independent reader that must find a file for each statement finds the gap. Alternative: the rule "Write each claim only from a source" is enough and the writers did not follow it; the evidence does not separate the two causes.

## Fix

Proposed, not enforced: step 5 of the skill `document` runs one fresh audit child for each written document (the prompt of V7), and sends each listed statement back to the writer once, before step 6. This needs a separately authorized change of the skill. The rule stays text in this proposal: whether a statement is a synthesis of its cited sources or a claim with no source needs judgment.

## Rule

Applies when an agent writes a document whose claims must each come from a source, and the same agent or its coordinator checks the sources. Action: before the commit, have an independent reader that did not write the document list each statement with no file that states it, and settle each item: cut it, correct it, or cite the file. Check: the report names the audit, its list, and the act on each item.
