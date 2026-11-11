---
{
  "schema": 1,
  "name": "keep-a-copy-of-a-deduplicated-rule-on-each-path-that-reaches-its-act",
  "description": "A writing pass kept one copy of a duplicated authorization in the step that the main path reads, and a re-entry path that skips that step lost it",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of ddinkov10/celetis#297 on Claude Code, final review of the inline flow, 2026-11-11",
  "incidents": [
    {
      "id": "d6afc8ce-15af-4146-9d4a-81e1557b7c50",
      "date": "2026-11-11",
      "action": "The writing pass over `plugins/celetis/skills/chore/SKILL.md` (commit b703eeb) removed \"the commit\" from the step 6 sentence \"Invoking this lane authorizes the commit and the landing.\", as a duplicate of the commit authorization of step 5, and wrote \"Invoking this lane also authorizes the landing.\"",
      "expected": "Each path that reaches a commit keeps its authorization: the re-entry of step 2 goes \"to step 4, then step 6\" and skips step 5, and step 6 commits the fix of a refusal before the next landing.",
      "observed": "The final reviewer (agent a74794e3bf99afa61) found the re-entry path past step 5 by reading the text; the reading case chore/C08 (a re-entry after a refusal, with the person's earlier \"Commit only when I ask you to\") gave Codex Q1 `one unsettled` on the new text against a settled commit with no question on the base text. fb586d3 restored the base sentence.",
      "source": {
        "kind": "tool-output",
        "excerpt": "judge codex chore-C08 q9c0_ynvy Q1: one unsettled: q9c0 settles it: the session commits the formatter fix without asking, because invoking /celetis:chore #135 overrides the 'commit only when asked' rule. ynvy says the lane rule means no question, but leaves open whether ...",
        "reference": "/Users/dinq/.cache/celetis-297-proof/judge/codex/chore-C08/q9c0_ynvy/verdict.jsonl"
      },
      "inference": "Inferred: the pass judged the duplicate by the main path (step 5 then step 6) and did not list the other paths that reach step 6 (the re-entry). The active lesson keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer covers a dedup that leaves a pointer; this dedup left no pointer, and its reading cases entered at step 6 by the main path only. Alternative: a reader might still take the authorization from the Iron Law paragraph (\"its commit-without-asking\"); the case shows that this was not enough on Codex.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "b703eeb",
      "brief": "Plan of #297, Task 3 step 3: \"Duplication: the authorization of the commit is in step 5 (lines 54–55) and in step 6 (...). The kept copy keeps the authorization of the landing, which only line 61 states.\"",
      "lesson": {
        "name": "keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer",
        "revision": "7c504ee",
        "digest": "874cbde10f3442380bb25ad5fdb5f7d82ffdeff81c1fe99ada94bb902723f3c3"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "92ec0d0a-39f7-4fed-a3e8-f3816f809ace",
      "requestDigest": "794f15cb7d85c2bf813372b9d744828a6f16c8f3d09d668ac69e6a740a9f78df",
      "date": "2026-11-11",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #298; claude child opus/high\n\nEdit, then approve, under the reviewer rules. The incident is observed: commit b703eeb removed the commit authorization from step 6 of the chore skill, the reading case chore/C08 on Codex gave one unsettled on the new text and a settled commit on the base text, and fb586d3 restored the base sentence (both commits are in the lane history). The rule states applicability, action, and check; it adds a reading case, widens no permission, and weakens no check. It does not state the same rule as keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer, whose applicability needs a pointer that this dedup did not leave, so no merge applies. It agrees with the skill writing-for-agents, Information hierarchy, which says to inline what every branch needs. The edit replaces the presumed ledger row of the check with the record of the pass, because a writing pass can have no ledger.",
      "related": [
        "keep-a-copy-of-a-deduplicated-rule-on-each-path-that-reaches-its-act"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the paths are prose jumps that only a reading resolves."
      }
    }
  ]
}
---
# Keep a copy of a deduplicated rule on each path that reaches its act

## What happened

In #297 the writing pass over the `chore` lane skill removed "the commit" from the authorization sentence of step 6, because step 5 also authorizes the commit. The re-entry of step 2 goes from step 4 to step 6 and skips step 5, and step 6 commits the fix of a landing refusal. The final review found the gap; the reading case chore/C08 on Codex gave `one unsettled` on the new text and a settled commit with no question on the base text. Commit fb586d3 restored the base sentence.

## Root cause

Inferred: the duplicate was judged on the main path through the steps. The other paths that reach the act (a re-entry, a jump, a fix loop) were not listed, and the reading cases entered step 6 only by the main path. The active lesson on a dedup that leaves a pointer did not cover a dedup that leaves no pointer.

## Fix

Proposed prevention, text only: before a dedup removes an act from a step, list each path of the document that reaches that step (each jump such as "go to step 4, then step 6", each re-entry, each fix loop), and keep the act at the step unless every listed path passes the kept copy. Give each path that skips the kept copy a reading case that enters by that path and asks the act. A structural check is not suitable: the paths are prose jumps that only a reading resolves.

## Rule

Applies when a writing pass removes one copy of a duplicated rule or act from a step of agent text. Action: list each path that reaches the step of the removed copy, also the jumps and re-entries that skip the step of the kept copy; keep the act where a path does not pass the kept copy. Check: the record of the pass (for example the ledger row of the removed copy) names each path, and a reading case that enters by each skipping path gives the same act on the base and the new text.

## Related lessons

[[keep-each-act-of-a-step-when-a-dedup-leaves-only-a-pointer]]
[[a-pointer-to-a-shared-rule-restates-no-part-of-it]]
