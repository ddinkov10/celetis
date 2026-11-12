---
{
  "schema": 1,
  "name": "keep-the-condition-of-a-nested-list-in-its-lead",
  "description": "A writing pass over setup nested acts under a bullet, and readers lost the condition of the sentence before the nest",
  "tags": [
    "process",
    "regression",
    "recurring"
  ],
  "date": "2026-11-12",
  "status": "active",
  "source": "The implement session of #299 on Claude Code, Task 8 (setup), child t8-impl, reported to the coordinator, 2026-11-12",
  "incidents": [
    {
      "id": "6c8d2068-6bdd-4be1-ab93-1446c95f5092",
      "date": "2026-11-12",
      "action": "Task 8 turned paragraphs of setup into nested lists: the failed-check acts of step 7 and the acts after a run in step 12.",
      "expected": "The nested acts keep the conditions of the sentence before the list: the act to run the checks again, and the rule that the acts of step 12 follow only a yes.",
      "observed": "Readers of the new text answered from the nested block only. C56 Q2 on Codex, 3 of 3 runs on tree m68g: no 'run the checks again'. C99 on tree ffec: the git status of a lane after a 'not now' answer.",
      "source": {
        "kind": "tool-output",
        "excerpt": "C56 Q2, 3/3 runs on m68g: no \"run the checks again\"; C99 on ffec: git status of a lane after a \"not now\".",
        "reference": "/Users/dinq/.cache/celetis-299-proof/report/su.md"
      },
      "inference": "Inferred by the child: a bullet that carries only a lead and nested items hides the sentence before it from a reader that looks for the act of one question. Alternative: run variance; the fixes (the joined step 7 item, the On a yes: nest) made both questions pass, which supports the inferred cause.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "3b68ec6",
      "brief": "The Task 8 brief of #299 carried the lesson a-list-of-reads-reads-as-an-order (order and completeness of a split series); it does not name the condition of a sentence before a nested list.",
      "lesson": {
        "name": "a-list-of-reads-reads-as-an-order",
        "revision": "405050d",
        "digest": "a096bcc2f2830938be4d6fd7bb2115c0e0a7a6693d9651300a191eee07e96272"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "3a1d9db1-e258-45bb-bc55-3a4dc2a27251",
      "requestDigest": "e12a07a647c0ee349cc03848e1d93fd108ab1a72cccbcc95aa9e63b094f8667e",
      "date": "2026-11-12",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #297; claude child opus/high\n\nApprove, under the reviewer rules. The incident is observed tool output: reading cases C56 Q2 (Codex, 3 of 3 runs on m68g) and C99 (ffec) of #299 lost the condition of the sentence before a nested list of setup, and the fixes made both questions pass. The rule states applicability, action, and check; it adds a reading case, widens no permission, and weakens no check. It does not state the same rule as a-list-of-reads-reads-as-an-order, which covers the order and the closed set of a split series and not a condition that sits before a nest, so no merge applies. It agrees with the skill writing-for-agents, which keeps a rule and its caveats together. The inferred cause and its alternative (run variance) stay labeled as inference.",
      "related": [
        "keep-the-condition-of-a-nested-list-in-its-lead"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: which sentence is a condition of a nest is a judgment of meaning that only a reading case shows. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Keep the condition of a nested list in its lead

## What happened

In #299, Task 8 split paragraphs of `setup` into nested lists. Readers of the new text answered from the nested block only: C56 Q2 on Codex lost the act "run the checks again" in 3 of 3 runs, and C99 put a `git status` of a lane after a "not now" answer. Joining the dependent sentence into the item and nesting the acts under `On a yes:` made both questions pass.

## Root cause

Inferred: a bullet that holds only a lead and nested items separates the nested acts from the sentence before the list, so a reader that looks for the act of one question reads only the nest. The lesson `a-list-of-reads-reads-as-an-order` covers order and completeness, not a condition that sits before the list.

## Fix

Proposed: when a pass nests acts under a lead, put the condition in the lead of the nest, and put each sentence that the nested acts depend on in the same item. The differential reading check found both cases before the review. The rule stays text, because which sentence is a condition of a nest is a judgment of meaning.

## Rule

Applies when a writing pass turns a paragraph into a list with nested items. Action: name the condition of the nested acts in the lead of the nest, keep each sentence that the nested acts depend on in the same item, and run a reading case that enters at a nested act and asks for its condition. Check: each nested act keeps the condition of the base sentence on each host, and the case gives the same act on the base and the new text.

## Related lessons

[[a-list-of-reads-reads-as-an-order]]
[[keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer]]
