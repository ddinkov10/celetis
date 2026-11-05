---
{
  "schema": 1,
  "name": "keep-child-verification-prompts-independent",
  "description": "A verification parent added the expected behavior to its child prompt, invalidating the child result",
  "tags": [
    "test",
    "false-positive",
    "process"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "Implementation of ddinkov10/celetis#197, V2 Claude child probe",
  "incidents": [
    {
      "id": "celetis-197-tool-use-toolu_018wtsBgQrEMWdWMHAnQafGb",
      "date": "2026-11-02",
      "action": "The controller asked a host parent to delegate an ordinary review, without fixing the exact child task text. The parent added a prohibition that supplied the behavior under test.",
      "expected": "The child must derive update-check silence from the changed Celetis entry. The plan forbids permission or fixture text from suppressing checks on behalf of that contract.",
      "observed": "The actual Agent prompt included an extra constraint: Do not run any update check or update command. A zero-call result under that prompt cannot establish the contract behavior.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Agent toolu_018wtsBgQrEMWdWMHAnQafGb, general-purpose, prompt Constraints: \"Do not run any update check or update command.\"",
        "reference": "Claude session 41073ed1-4883-4061-b95b-077dd05987ce; #197 V2 child-claude/stdout.jsonl"
      },
      "inference": "The parent may have copied a known entry rule into its child brief. The controller did not request that extra rule. The prompt preparation, rather than the product behavior, invalidated this run.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "0a69b157739b34efd38fdc611376de5f48df6462 plus #197 working diff"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "cc2adb88-7dfb-4b10-8fd8-581c7dbb6a58",
      "requestDigest": "11f4a629029ca99584d0603178d7bebcdbab27c284b1d72097a01c895cddc3fe",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #245; codex child host default/high\n\nApprove under the reviewer rules: the retained actual child prompt supplied the behavior under test, so the zero-call observation could not verify the entry contract. The rule gives a clear scope, requires an uncontaminated task and inspection of the real dispatch, and rejects invalid evidence. It agrees with the independent behavioral oracle, native dispatch evidence, and behavioral-check rules. Preserve the uncertain motivation and all original evidence; the proposed structural check remains proposed.",
      "related": [
        "keep-child-verification-prompts-independent"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Consider a separately authorized check that compares the actual child dispatch prompt with the prescribed neutral task. This review adds no enforcement."
      }
    }
  ]
}
---
# Keep child verification prompts independent of the behavior under test

## What happened

In #197, a parent delegated a harmless review to a child and added "Do not run any update check or update command." The required behavior was to derive that choice from Celetis entry. The controller rejected the child result as unverified before claiming PASS.

## Root cause

Inferred: the parent converted a known entry rule into an extra child constraint. The controller allowed the parent to rewrite the test task. The exact motivation is not known.

## Fix

Proposed prevention: give the parent the complete neutral child task and require it to forward that task unchanged. Inspect the actual native dispatch before accepting the child result. A check can compare the dispatch prompt with the prescribed task; no repository enforcement is added by this proposal.

## Rule

When an agent delegates a behavioral verification task, preserve the neutral task text through the dispatch. Check the actual child prompt for any instruction that supplies the expected behavior. Reject contaminated runs and retain their evidence before repeating the probe.
