---
{
  "schema": 1,
  "name": "a-pointer-to-a-shared-rule-restates-no-part-of-it",
  "description": "A fix brief asked for a pointer to a shared rule with a paraphrase in parentheses; the paraphrase dropped the rule's exception and the fixer copied it into the step text",
  "tags": [
    "process",
    "refix"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Task 6 of ddinkov10/celetis#264, fix rounds 1 and 2 (implement step session)",
  "incidents": [
    {
      "id": "9c1d3e52-264-t6-brief",
      "date": "2026-11-09",
      "action": "The coordinator's round-1 fix brief asked for a pointer in step-prompt.md rule 1 to stop.md, \"The act that moves the line\", and added a parenthetical paraphrase: \"each other act of the skill and each act of the custom text of the entry comes before the act that moves the line\". The fixer wrote that paraphrase after the pointer.",
      "expected": "A pointer to a shared rule names the section and restates no part of it, or names each case of it, so the exception (an act that the skill names after the act, for example a worktree removal or the report) stays reachable for its callers (specify, feature, epic.md, effort.md).",
      "observed": "The scoped re-review flagged the new clause as Important: it drops bullet 3 (the exception) and bullet 1 of the cited section, so a reader of only the step text takes it as unconditional. Round 2 replaced it with the pointer only (commit 0aa102b); the re-review of round 1 covered commits 7a154d4..62085e0.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Important: the pointer clause in plugins/celetis/step-prompt.md rule 1 restates the rule and drops its exception. ... It contradicts bullet 3 and the skills that rely on it.",
        "reference": "https://github.com/ddinkov10/celetis/issues/264"
      },
      "inference": "The coordinator paraphrased the rule to make the brief self-explaining; the paraphrase covered only the case that the coordinator had in mind. The carried lesson scope-shared-prohibitions-against-required-callers was in the brief of the task but the coordinator applied it to the fixer's work, not to its own brief text. Alternative: the fixer could have checked the paraphrase against the cited section.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "62085e0",
      "brief": "Fix: in step-prompt.md, rule 1 ..., add a pointer clause that orders the acts of the turn by <plugin>/docs/procedures/stop.md, \"The act that moves the line\" (each other act of the skill and each act of the custom text of the entry comes before the act that moves the line).",
      "lesson": {
        "name": "scope-shared-prohibitions-against-required-callers",
        "revision": "d3779b1",
        "digest": "e6676436893dd32ffceccdc3e6eacb520ed01bf05dda9cc9562dc1e3ba171918"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "30f8d23d-b67c-4a9d-a718-10e790b40269",
      "requestDigest": "ff8d429d1708654567072527aa8d679598f28c2266c69f3963f6f6e3f87d144f",
      "date": "2026-11-09",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #264; claude child opus/high\n\nApprove: the proposal has observed tool-output evidence (the Important finding of the scoped re-review and the round-2 commit 0aa102b), and its rule states applicability, action, and check. The cited section (plugins/celetis/docs/procedures/stop.md, The act that moves the line) holds the exception bullet that the paraphrase dropped. No rule rejects it: it widens no permission, weakens no check, and agrees with the placement rule of AGENTS.md that a citer leaves the rule body in its file. The related lesson scope-shared-prohibitions-against-required-callers lists the callers of a shared rule; this proposal governs the words after a pointer, a different rule, and no live or historical lesson holds its incident.",
      "related": [
        "a-pointer-to-a-shared-rule-restates-no-part-of-it"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal proposes no structural check: whether words after a pointer restate a rule is a judgment of meaning that the gate cannot decide."
      }
    }
  ]
}
---
# A pointer to a shared rule restates no part of it

## What happened

In Task 6 of #264, a coordinator fix brief asked for a pointer from `step-prompt.md` rule 1 to `stop.md`, "The act that moves the line", and added a paraphrase of the rule in parentheses. The fixer wrote the paraphrase into the step text. The paraphrase held only bullet 2 of the section. The scoped re-review found that it dropped the exception (an act that the skill names after the act) and the answer rule. A second fix round replaced it with the pointer alone.

## Root cause

Inferred: the coordinator wrote a summary of the rule to make the brief clear, and the summary covered only the case in view. The lesson about shared rules and their required callers was in the task brief, but the coordinator did not apply it to its own brief text. Uncertain: the fixer could also have compared the paraphrase with the cited section.

## Fix

Proposed prevention, as text: a brief or an edit that adds a pointer to a shared rule asks for the pointer alone. When words follow the pointer, compare them with each case of the cited section first. No structural check is proposed: whether words after a pointer restate a rule is a judgment of meaning, which the gate cannot decide.

## Rule

Applies when a brief, a ruling, or an edit adds a pointer to a section that holds a shared rule. Action: write the pointer alone (the path and the section name), or, when the text must say more, list each case of the cited section, its exceptions included. Check: every word after the pointer maps to a case of the cited section, and no case of the section is contradicted for a caller that relies on it.

## Related lessons

[[scope-shared-prohibitions-against-required-callers]]
