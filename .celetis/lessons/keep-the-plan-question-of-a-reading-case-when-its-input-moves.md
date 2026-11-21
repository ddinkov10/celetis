---
{
  "schema": 1,
  "name": "keep-the-plan-question-of-a-reading-case-when-its-input-moves",
  "description": "A reading case whose input moves away from an exclusion keeps its original question as a case or an unresolved risk.",
  "tags": [
    "test",
    "process",
    "false-negative"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "implement #337, final review of the inline build",
  "incidents": [
    {
      "id": "de4e91d5-2fbc-466b-b2d6-e23aa2bee0e5",
      "date": "2026-11-21",
      "action": "Changed the input of plan case R9 from \"a run of the red repro\" to \"a run of the red repro after the fix\" to avoid the exclusion of pre-fix red reproductions, and recorded only a ledger ruling.",
      "expected": "The original question (does the rule reach a pre-fix red repro on an unused host?) stays as a case or as an unresolved risk in the report.",
      "observed": "The final reviewer reported that no run covered the pre-fix case and that the rule does not reach it (Important 1); the maintainer then accepted the gap.",
      "source": {
        "kind": "tool-output",
        "excerpt": "A pre-fix red repro on an unused host is outside the new rule (unresolved risk). ... R9 in docs/superpowers/verification/337/cases/R9.md says \"after the fix\", while the plan R9 table says \"the red repro\". So no run covers the pre-fix case."
      },
      "inference": "The followed lesson does not say what happens to the question of the original input; uncertain whether the plan case was mis-scoped instead.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "9a2e368b423741e09b9e204ccca52eab7cc577ba",
      "brief": "Ledger line: Task 1: Ruling: V3 inputs ... R9 says \"after the fix\" so that the red-repro exclusion of the module does not trigger",
      "lesson": {
        "name": "give-a-reading-case-an-input-that-only-the-rule-under-test-covers",
        "revision": "45910e091ca6d3f4a0b3164d05bca32956048fde",
        "digest": "4e0d315982f91b3790d1da5bcd8b4e1e4ac409f0e9f75ede6e594adfb8438616"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "8f37ff9a-1b6d-4921-9fd7-2ca3c8e64dac",
      "requestDigest": "3186deb558289ff5afd252469fb91575b1c1f7c08442b6d31a900837d65f5f85",
      "date": "2026-11-21",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #337; claude child opus/high\n\nEdit, then approve, under the reviewer rules. The incident is observed: the retained excerpt of the final review of #337 says that no run covers the pre-fix case, and that R9 says \"after the fix\" while the plan R9 table says \"the red repro\". The rule states applicability (a changed input of a planned reading case that avoids an exclusion, a scope line, or another rule), action (keep the original input as its own case, or name the original question as an unresolved risk with the excluded rule before the final review), and check (the case files or the report hold the original question and its result or its risk record). It adds a check, weakens none, widens no permission, and adds no network or credential act. It agrees with runtime-verification.md (pre-fix red reproductions keep their roles; the rule only keeps the question visible), with the unresolved-risk record of the principle demonstrate-behavioral-defects, and with give-a-reading-case-an-input-that-only-the-rule-under-test-covers, which allows an input that triggers two rules when the case writes the act of each. No active lesson states the same rule: that lesson chooses the input, and plan-condition-must-not-narrow-a-spec-rule covers a changed spec rule, not a changed plan case, so no merge applies. The edit moves the motive \"to give the case an input that only the rule under test covers\" from What happened to Root cause, because the retained ledger line names only the exclusion as the reason, and puts that ledger reason in What happened as the observed fact.",
      "related": [
        "keep-the-plan-question-of-a-reading-case-when-its-input-moves"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the choice of a reading case input is a judgment that no gate can read."
      }
    }
  ]
}
---
# Keep the plan question of a reading case when its input moves away from an exclusion

## What happened

In the build of #337 (inline, 2026-11-21), the plan defined V3 case R9: a hotfix micro-plan needs "a run of the red repro on Codex and on Claude Code" with the order `["claude"]`. The runtime-verification module excludes pre-fix red reproductions from its scope. The session changed the input to "a run of the red repro after the fix" and wrote a ledger ruling: R9 says "after the fix" so that the red-repro exclusion of the module does not trigger. The final reviewer (sonnet, 2026-11-21) reported that no run then covered the pre-fix case, and that the new rule "Used hosts" does not reach a pre-fix red repro on an unused host (tool output: review report, Important 1). The maintainer decided to accept the gap (answer "Accept the gap (Recommended)" in the step session).

## Root cause

Inferred: to give the case an input that only the rule under test covers, the session followed the lesson give-a-reading-case-an-input-that-only-the-rule-under-test-covers, which says to choose an input that only the rule under test covers. It does not say what to do with the question of the original input when that input triggers an exclusion. The changed input answered another question, and the original question (does the rule reach the excluded case?) became an uncovered gap that only the review found. Alternative: the plan case itself was mis-scoped; the session could also have asked about it at the pre-flight scan.

## Fix

Proposed text change: when a case input moves away from an exclusion or another rule, keep the original question as its own case, or name it in the report as an unresolved risk with the excluded rule. No structural check is proposed: the choice of a case input is a judgment that a gate cannot read.

## Rule

Applies when a session or a brief changes the input of a planned reading case so that the case avoids an exclusion, a scope line, or another rule of the files that the reader reads. Action: keep the original input as a case of its own, or, when the change is to remove it, name the original question in the runtime report as an unresolved risk with the excluded rule, before the final review. Check: for each changed case input, the case files or the report hold the original question and its result or its risk record.

## Related lessons

[[give-a-reading-case-an-input-that-only-the-rule-under-test-covers]]
