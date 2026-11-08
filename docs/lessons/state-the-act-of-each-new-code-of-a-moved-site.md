---
{
  "schema": 1,
  "name": "state-the-act-of-each-new-code-of-a-moved-site",
  "description": "A text pass changed the old dispatch codes 4 or 5 to 8 or 6, but an invalid config moved from 5 to 2, and the text had no act for exit 2",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "#253 implement session (step session), Task 7 fresh reading check of docs/procedures/dispatch.md",
  "incidents": [
    {
      "id": "bce4a851-0c5e-42a2-98b2-080dd5217363",
      "date": "2026-11-08",
      "action": "The plan's text edits and the Task 7 implementer changed \"Exit 4 or 5\" of dispatch to \"Exit 8 or 6\" in docs/procedures/dispatch.md, from the list of old codes in the text.",
      "expected": "Each code that a moved site of dispatch now gives has an act in the text that an agent reads: an invalid .celetis.yaml of dispatch moved from 5 (sent to a stop by the old text) to 2.",
      "observed": "A fresh reader of dispatch.md alone listed acts for exit 3, 8, and 6 of dispatch <act> and none for exit 2; the task review had approved the edit.",
      "source": {
        "kind": "tool-output",
        "excerpt": "dispatch <act>: reader 3 -> correct the act; 8 -> stop; 6 -> stop. Declared 0 1 2 3 6 8. Gap: exit 2 of dispatch (usage, and an invalid .celetis.yaml, moved 5 -> 2 by R7) has no instruction in dispatch.md",
        "reference": "#253 docs/superpowers/verification/253-t7/fresh-reader-summary.txt; fixed in ece059c"
      },
      "inference": "Inferred: the edit list came from the old codes that the text named, so a site whose new code the text never named stayed without an act. Alternative: the plan's site list named the move (dispatch 5 -> 2, R7) but not its text consequence.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "396faba"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "e9b40e03-bc2b-4417-8ded-abd044e3abe7",
      "requestDigest": "addccbc95340ff4e956dc127d4783aecf19cb2cdfa1fef12e9afeb576c4cc44f",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #253; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed: the retained excerpt of the #253 fresh reader lists acts for exit 3, 8, and 6 of dispatch <act> and none for exit 2, and ece059c adds the exit 2 act to docs/procedures/dispatch.md. The Fix states a fact that the lane confirms: checkContract in scripts/verify.ts reports a code of the text that the command does not declare, or a code with no named command, and does not check that each declared code has an act. The rule states applicability, action, and check, and keeps the inferred cause apart from the facts. No active lesson states this rule: check-removed-terms-in-owned-document-sections covers removed terms, not a new code with no act. The rule widens no permission, weakens no check, and contradicts no instruction, skill, or principle.",
      "related": [
        "state-the-act-of-each-new-code-of-a-moved-site"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A verify gate check that each exit class that a command declares has an act in the agent text of that command; it needs separate authorization."
      }
    }
  ]
}
---
# State the act of each new code that a moved site gives

## What happened

In #253, the exit codes of `dispatch` moved: its stop 4 to 8, its setup failure 5 to 6, and an invalid `.celetis.yaml` 5 to 2. The text pass changed "Exit 4 or 5" of `docs/procedures/dispatch.md` to "Exit 8 or 6", and the task review approved it. A fresh reader of that file alone found acts for exit 3, 8, and 6 and none for exit 2. Before the change, the invalid configuration was 5, which the text sent to a stop. The fix `ece059c` added the act for exit 2.

## Root cause

Inference: the edits came from the old codes that the text named. A site whose new code the text never named got no act. Uncertain: the plan listed the move of the code, but not its consequence for the text.

## Fix

Proposed prevention (text, not enforced): for each moved site, start from its new code and find the act of that code in the text of its command. The `checkContract` gate of #253 checks that each code in the text is declared, not that each declared code has an act, so it does not reject this case. The rule stays text, because the act depends on the meaning of each site.

## Detection signature

A reader of a command's text names no act for a code that the command declares and that a moved site now gives.

## Rule

Applies when a change moves an exit site of a command to another code. Action: for each moved site, find the act of its new code in the text of that command, not only the text that named its old code; add the act when the text has none. Check: a reader of the command's text alone names an act for each new code of a moved site.
