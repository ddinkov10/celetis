---
{
  "schema": 1,
  "name": "check-cst-addition-at-collection-boundaries",
  "description": "Required YAML additions failed at a trailing comma and after nested content without a final newline",
  "tags": [
    "config",
    "test",
    "false-negative",
    "process"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 2 review and coordinator reproduction of ddinkov10/celetis#46",
  "incidents": [
    {
      "id": "celetis-46-cst-add-boundaries",
      "date": "2026-11-05",
      "action": "Task 2 added required YAML keys by appending CST items while handling a trailing separator and final newline only for some token shapes.",
      "expected": "Setup adds required suite to valid current YAML while retaining unrelated tokens and parsed custom values.",
      "observed": "A flow map with a trailing comma, a final nested plain scalar without a final newline, and a final nested literal scalar without a final newline all passed readConfig first, then setup write refused the required addition before writes.",
      "source": {
        "kind": "tool-output",
        "excerpt": "On bd69ed0, `{ landing: pr, } # product\\n` failed with `Unexpected , in flow map`; final nested plain content failed with `Nested mappings are not allowed in compact mappings`; final nested `|-` content failed with `suite: required field`. All calls used setup write --hosts codex --landing merge --suite verify.ts. Initial readConfig succeeded and no-write snapshots matched.",
        "reference": "#46 Task 2 review I1/I2 and coordinator run /private/tmp/celetis46-review2-EDflCE/review-1793894175720-claude-{1,2,3}-yaml-add-edge"
      },
      "inference": "The review identifies separate separator and final-nested-token handling defects in the insertion helper. Why the initial checks covered trailing-comma removal and simple addition but omitted these insertion combinations is uncertain. The findings remain separate repairs.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "bd69ed04f499000ddf7d2dabf4631fab7f0f0470"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "840bc471-84f8-404f-b9cf-d58154004a36",
      "requestDigest": "c0b6dcc0373d073efc957debac6b4b74524afcee39759df932895f83933e8465",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nApprove under the reviewer rules: the retained coordinator reproduction establishes valid YAML inputs that required insertion failed to update, while the no-write snapshots establish safe refusal. The rule gives applicability, operation-specific boundary cases, and a public success and preservation check. It agrees with boundary discipline and behavioral verification and differs from the active reversible-byte lesson by checking insertion boundaries. No tracked test or proven enforcement is claimed.",
      "related": [
        "check-cst-addition-at-collection-boundaries"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The check depends on the affected operation. No structural follow-up is required by this review."
      }
    }
  ]
}
---
# Check CST addition at collection boundaries

## What happened

The Task 2 review found two separate required-key insertion defects in the YAML CST editor. A valid trailing-comma flow map received a second separator. A valid block mapping with final nested content and no final newline received an unsafe appended key. Both plain and literal nested values were checked separately. The coordinator reproduced every refusal on the reviewed source. Preflight validation prevented project or label writes, but setup could not perform the required refresh.

## Root cause

The observed code and output establish separate separator and final-token handling gaps. The cause of the missing insertion combinations in the initial verification is uncertain. Passing replacement or removal checks for a syntax shape did not exercise addition at that shape's boundary.

## Fix

The task repairs both findings through its existing scored repair loop. Proposed prevention: pair each supported collection boundary with the required insertion operation, and compare unrelated bytes and parsed values after a successful command. Keep this as a scoped text rule because the supported syntax and permitted edit authority vary by parser and task. This proposal adds no retained repository test and claims no proven structural enforcement.

## Rule

When a CST editor adds a required mapping item, check insertion into each supported boundary shape. Include an existing trailing separator and final nested content without a final newline. Establish that each input is valid first. Require the public operation to succeed and preserve unrelated bytes and parsed values; replacement or removal evidence does not prove insertion.

## Related lessons

[[keep-byte-preserving-transformations-reversible]]
