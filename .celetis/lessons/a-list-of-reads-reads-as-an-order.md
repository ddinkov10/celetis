---
{
  "schema": 1,
  "name": "a-list-of-reads-reads-as-an-order",
  "description": "Writing passes split prose into Markdown lists, and readers then took the lists as ordered (the reads of a step) or as complete (the parts of a fix brief), unlike the base text",
  "tags": [
    "process",
    "regression",
    "recurring"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of ddinkov10/celetis#296 on Claude Code, Task 1 (the pass over specify), reading check, 2026-11-11",
  "incidents": [
    {
      "id": "30d0384b-716c-47bc-905a-d3a34ba329f7",
      "date": "2026-11-11",
      "action": "The first pass over plugins/celetis/skills/specify/SKILL.md turned step 2 (\"Read before the first message, with no offer to the user: the issue, the grounding documents below, and the code that the request touches. ...\") into a lead with one list item for each read, with no word of order added.",
      "expected": "Readers give the same act as on the base: the parent read of an epic child is part of the issue read, and its place against the grounding documents and the code is not fixed.",
      "observed": "Case specify/C02 Q3, three runs on each tree: on Claude Code and on Codex the base majority says the order among the reads is not settled; the new majority places the parent read first, before the project context, the docs lookup, and the code (3 of 3 runs on Codex). The judge gave different majority act on both hosts.",
      "source": {
        "kind": "tool-output",
        "excerpt": "different majority act: eghz (3/3): unsettled. ... xovx (3/3): the parent read comes with the issue read in the first bullet, before the project context, the docs-lookup external facts, and the code reads.",
        "reference": "ddinkov10/celetis#296 runtime verification report"
      },
      "inference": "Inferred: readers take the item order of a Markdown list as a sequence, while a comma series in one sentence reads as a set. Uncertain: one case and one model for each host.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "eb468ce16a8a0f0e71d43e9c908f99cc3082d2a1"
    },
    {
      "id": "b9bc60e4-3289-47bc-bb0e-1eee9983f8bd",
      "date": "2026-11-11",
      "action": "The first pass over plugins/celetis/skills/implement/SKILL.md gathered the parts of the fix brief of \"A fix after the final review\" into one list under \"The brief holds:\", with the two later paragraphs (\"The saved fix brief also carries the lesson rules ...\", \"Carry the affected documentation assessment ... in that saved or reconstructed brief\") as items.",
      "expected": "Readers name the same parts of the fix brief as on the base, also the review evidence that the addition Review evidence carries into each repair brief.",
      "observed": "Case implement/C10 Q2, single runs: on Claude Code and on Codex the base readers put the review evidence and dispositions into the brief (citing the Review evidence addition, SKILL.md:54); the new readers list only the six items of the list. The judge gave different act on both hosts.",
      "source": {
        "kind": "tool-output",
        "excerpt": "eghz also puts the review evidence and dispositions into the brief, citing SKILL.md:54. poea's six-part list leaves that part out.",
        "reference": "ddinkov10/celetis#296 runtime verification report"
      },
      "inference": "Inferred: a list under a lead such as \"The brief holds:\" reads as the complete set, while the base's \"also carries\" and \"Carry ... in that saved brief\" read as open, so a reader adds the parts that other additions give each repair brief. Uncertain: single runs; the fix commit restored the base paragraphs before reruns.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "c5e4e4c7a2e59b208267d6a60d56cdddfc820f0f"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "db2cce91-86ff-4c24-bf6e-438494d0ed3b",
      "requestDigest": "a4fe722249212cb497892abf098f1be7358c88742c6e90a0edb1b33fc1cb385e",
      "date": "2026-11-11",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #290; claude child opus/high\n\nEdit, then approve, under the reviewer rules. Both incidents are observed in the reading checks of #296: on both hosts, the list form fixed an order of the reads of specify step 2, and closed the set of parts of the fix brief of implement. The rule adds a reading check, widens no permission, weakens no gate, and contradicts no skill or principle; the skill writing-for-agents gives no rule that prose series become lists. No active lesson states this rule. The edit only replaces the title, which named the order alone, with a plain statement of the rule that also covers the closed set of the second incident.",
      "related": [
        "a-list-of-reads-reads-as-an-order"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: only a reading check shows how a reader takes a list."
      }
    }
  ]
}
---
# Keep the prose form when a list would fix an order or close a set

## What happened

Two passes of #296 split prose of a skill into a Markdown list. In `specify` step 2, a sentence of reads became a list, and readers on both hosts then fixed an order of the reads that the base leaves open (three runs on each tree). In `implement`, the parts of a fix brief and two later paragraphs became one list under "The brief holds:", and readers on both hosts then took the list as the whole brief and left out the review evidence that another addition carries into each repair brief. Each fix commit restored the prose form.

## Root cause

Inferred: a Markdown list implies a sequence and a closed set; a comma series and an "also carries" paragraph do not. Uncertain: two cases, one model for each host.

## Fix

Proposed prevention, not enforced: when a pass turns prose into a list, ask in a reading case for the order and for the parts that other places add, on the base and the new text; keep the prose form when the list fixes an order or closes a set that the base leaves open. The rule stays text, because only a reading check shows how a reader takes a list.

## Rule

Applies when a writing pass turns a series of acts, reads, or parts in prose into a list, and the base gives them no order or lets other places add parts. Action: ask the order and the complete set in a reading case on the base and the new text; keep the prose form, or state the order and the openness, when the list form changes them. Check: the case file has an order question and a completeness question for the split series, and both verdicts are the same act.

## Related lessons

- [[give-a-reading-case-an-input-that-only-the-rule-under-test-covers]]
- [[keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer]]
