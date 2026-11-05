---
{
  "schema": 1,
  "name": "scope-shared-prohibitions-against-required-callers",
  "description": "A global entry prohibition conflicted with a preserved task-specific command",
  "tags": [
    "process",
    "regression",
    "test"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#197",
  "incidents": [
    {
      "id": "celetis-197-final-review-setup-scope-20261102",
      "date": "2026-11-02",
      "action": "The implementation made update check conditional on an explicit status or troubleshooting request without bounding the rule to entry maintenance. The reviewer initially treated unchanged setup source as preservation.",
      "expected": "The plan removes optional automatic entry maintenance while preserving setup step 4, which explicitly requires the same command for chosen-host discovery.",
      "observed": "The shared entry permits the command only for status/troubleshooting, while setup step 4 requires it for a separate setup task. The coordinator identified the caller; the reviewer then reported the instruction conflict as Important.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Final review: setup:30 says \"Run celetis --agent <host> update check once\"; entry:86 says \"only when the person explicitly requests update status or update troubleshooting.\" Category: non-behavioral instruction-contract finding; no executed setup failure claimed.",
        "reference": "#197 review at 77d210c8293585b10c86e2b00c32f04898aef42a; /root/final_review_197"
      },
      "inference": "Inferred: the shared rule was reviewed mainly against ordinary-work scenarios, and byte-preservation of setup was mistaken for preservation of its dependent instructions. The reviewer reported this uncertainty.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "77d210c8293585b10c86e2b00c32f04898aef42a"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "2d4be774-427c-4db0-8376-fb0ff50d66b8",
      "requestDigest": "c5427757514ce8c5932f213827b17ab1c6add6b7eeb77aa50670ca00ae95531b",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #236; codex child host default/high\n\nApprove under the reviewer rules: the retained instruction-conflict evidence is observed, the cause is marked as inferred, and the rule states its scope, caller check, and required verification. It preserves the current entry exception for task-required commands and the existing gate.",
      "related": [
        "scope-shared-prohibitions-against-required-callers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule needs judgment about instruction callers. No structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Scope shared prohibitions against preserved task callers

## What happened

In #197, a new global entry rule permitted update check only for explicit status or troubleshooting requests. The approved plan also preserved setup step 4, which requires that command for chosen-host discovery. Setup source was unchanged, but the shared instruction made its operation ambiguous. The coordinator identified the caller and the final reviewer reported an Important instruction conflict. No runtime setup failure was claimed.

## Root cause

Inferred: review of the shared trigger focused on ordinary maintenance, while unchanged caller bytes were treated as sufficient preservation. The interaction between the global exclusive condition and the existing task-required command was missed.

## Fix

Proposed prevention: before adding an exclusive shared trigger, find task-specific callers and compare their required operations with the new condition. Bound the condition to its intended role. Keep a focused caller scenario in the existing verification plan. This remains a judgment rule because the repository has no machine-readable instruction dependency model.

## Rule

When a shared instruction adds an exclusive trigger or prohibition, check every preserved task-specific caller of the affected operation. Source bytes alone do not prove preservation. Confirm that the shared rule still permits each required caller, and verify the affected caller through its normal interface.
