---
{
  "schema": 1,
  "name": "keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer",
  "description": "A writing pass replaced a step's copy of its later acts with a pointer to a shared list, and Codex readers of that step lost one act in 3 of 3 runs",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of ddinkov10/celetis#296 on Claude Code, Task 1 (the pass over specify), reading check, 2026-11-11",
  "incidents": [
    {
      "id": "bbe7cd4d-4096-42be-a0fa-e38d94005ee7",
      "date": "2026-11-11",
      "action": "The first pass over plugins/celetis/skills/specify/SKILL.md replaced the sentence of addition 4 (\"Remove the lane worktree (Terminal) in the turn of the epic definition (...), before the report of the children, and stop after the report.\") with a pointer alone: \"Do the later acts of the epic definition (...) in its turn, by Terminal.\" Terminal kept the full list of the later acts.",
      "expected": "A reader who reaches the epic path from addition 4 names the same later acts as on the base text, the removal of the lane worktree among them.",
      "observed": "Case specify/C20 Q3 on Codex (the epic path reached from addition 4): 3 of 3 base runs name the removal of the lane worktree before the report; 0 of 3 runs on the first-pass tree name it. The judge gave different majority act. Case C07, which starts after the epic command and asks the later acts directly, passed on both trees.",
      "source": {
        "kind": "tool-output",
        "excerpt": "different majority act: ... eghz (all 3 runs) adds one step: remove the lane worktree before the report, in the same turn. None of the 3 xovx runs has that removal step.",
        "reference": "ddinkov10/celetis#296 runtime verification report"
      },
      "inference": "Inferred: a pointer alone fires only when the reader decides that the cited section applies; a reader that answers from the step it reached does not open the later list. The active lesson a-pointer-to-a-shared-rule-restates-no-part-of-it permits a pointer alone, so its rule did not prevent this. Alternative: model variance on one host; the base gave the act in 3 of 3 runs and the pointer form in 0 of 3, so variance alone is unlikely.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "eb468ce16a8a0f0e71d43e9c908f99cc3082d2a1",
      "brief": "Task 1 lesson rules of the #296 plan carried a-pointer-to-a-shared-rule-restates-no-part-of-it: \"write the pointer alone (the path and the section name), or, when the text must say more, list each case of the cited section\".",
      "lesson": {
        "name": "a-pointer-to-a-shared-rule-restates-no-part-of-it",
        "revision": "4cfd71c48c24a031ca40f2d2a8d7726c2ac3cec2",
        "digest": "4d362673cb10fdc04a3e08065c7b34efb91a903caf825d31d6d8cdc4e0f50807"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "531a162f-8cbe-4ded-9c2d-d360bc9a4203",
      "requestDigest": "d724c8fdd146a2817ccc521364b941daaf8d17502c83038f09ea2ccc149c920b",
      "date": "2026-11-11",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #290; claude child opus/high\n\nEdit, then approve, under the reviewer rules. The incident is observed: the reading check of #296 names the act in 3 of 3 base runs and in 0 of 3 runs on the first-pass tree, on Codex. The rule adds a reading check, widens no permission, and weakens no gate. It is compatible with a-pointer-to-a-shared-rule-restates-no-part-of-it, whose action already allows a list of each case in place of the pointer alone. The edit aligns the action with the skill writing-for-agents, Context pointers, which says to sharpen the wording of a pointer to a must-have target first and to inline the material only if sharpening fails; it records that #296 tried no sharpened pointer.",
      "related": [
        "keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: only a reading check shows whether a reader follows a pointer."
      }
    }
  ]
}
---
# Keep each act of a step when a dedup leaves only a pointer

## What happened

The pass of #296 over `specify` removed the copy of the later acts of the epic definition from addition 4 and left a pointer to Terminal, which kept the full list. A blind reading check of the same case on the base and the new text, three runs on each tree, showed that Codex readers who reached the epic path from addition 4 named the removal of the lane worktree in 3 of 3 base runs and in 0 of 3 new runs. A case that started from Terminal passed. The fix commit restored the base sentence of addition 4.

## Root cause

Inferred: a pointer alone is read as reference, and a reader that answers from the step that it reached does not open the cited list. The active lesson `a-pointer-to-a-shared-rule-restates-no-part-of-it` allows a pointer alone, so it did not cover a dedup that moves acts out of a step. Uncertain: one host and three runs; the same edit passed on Claude Code.

## Fix

Proposed prevention, not enforced: before a dedup removes acts from a step and leaves a pointer, give the reading check a case that reaches the acts from that step, on each host. When that case loses an act, sharpen the wording of the pointer first, as the skill `writing-for-agents` says for a must-have target behind a pointer, and run the case again; keep the copy when the sharpened pointer still loses the act. In #296 the fix kept the copy, and no sharpened pointer was tried. The rule stays text, because only a reading check shows whether a reader follows a pointer.

## Rule

Applies when a writing pass removes a copy of acts from a step of agent text and leaves a pointer to another place that keeps them. Action: run a reading case that enters at that step and asks for its acts, on each host, before and after the edit; when the pointer form loses an act, sharpen the pointer and run the case again, and keep the copy at the step when the act is still lost. Check: the case file has a case that enters at the step of the removed copy, and its verdict on each host is the same act.

## Related lessons

- [[a-pointer-to-a-shared-rule-restates-no-part-of-it]]
- [[give-a-reading-case-an-input-that-only-the-rule-under-test-covers]]
