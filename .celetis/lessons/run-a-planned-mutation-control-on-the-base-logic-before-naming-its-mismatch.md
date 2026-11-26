---
{
  "schema": 1,
  "name": "run-a-planned-mutation-control-on-the-base-logic-before-naming-its-mismatch",
  "description": "Two plan mutation controls of #351 named a MISMATCH case that the mutation could not produce: a moved test still skipped the line, and a .catch hid the change",
  "tags": [
    "test",
    "process",
    "false-negative"
  ],
  "date": "2026-11-26",
  "status": "active",
  "source": "implement session of #351 (subagent flow), Tasks 2 and 3, 2026-11-26",
  "incidents": [
    {
      "id": "2f0a7c1e-351a-4b2c-9d01-7a6b5c4d3e21",
      "date": "2026-11-26",
      "action": "The plan of #351, Task 2 Step 5, named the mutation \"move the method test after the id test in call\" and the expected MISMATCH on the line with a string method and the request id.",
      "expected": "A planned mutation control names a mutation and a probe case for which the mutated code gives an outcome other than the base.",
      "observed": "The implementer reported that the mutated call still reached continue on that line, so both trees gave the same outcome; the probe printed MISMATCH client notification first instead. The task reviewer traced both placements and confirmed it.",
      "source": {
        "kind": "tool-output",
        "excerpt": "When the method test moves after the id tests, the line with a string method and the request id gives the same outcome on both trees. The probe instead reports MISMATCH client notification first."
      },
      "inference": "The plan author stated the oracle from the intent of the check order and did not trace the mutated code on that input. Uncertain: one placement of the moved test still skips the line, another does not; the plan traced neither.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "b86e504b5091bac5fa276208d36a3bceaee1dbe5",
      "brief": "Plan comment 7200828631 of #351, Task 2 Step 5",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "8fb4f83f4fe7d1cddfe1f729c4fd4bca300bb53f",
        "digest": "c39f7275bfa301b77a0b9d69446f325621e6ff4adbb8fa2d74bf68c8f926e804"
      }
    },
    {
      "id": "8d4e2b6f-351b-4c3d-8e12-1b2c3d4e5f60",
      "date": "2026-11-26",
      "action": "The plan of #351, Task 3 Step 5, named the mutation \"make secondary optional in the bucket schema\" and the expected MISMATCH on the secondary absent case.",
      "expected": "A planned mutation control names a mutation and a probe case for which the mutated code gives an outcome other than the base.",
      "observed": "The implementer reported that with secondary optional, undefined.usedPercent throws and .catch gives null, the same as the base, so the probe gave no MISMATCH; a wider mutation (nullish and a loop test window == null) gave MISMATCH usage secondary absent.",
      "source": {
        "kind": "tool-output",
        "excerpt": "The brief mutation does not discriminate. When secondary is optional, undefined.usedPercent throws and .catch gives null, the same as the base."
      },
      "inference": "The plan author did not follow the mutated value through the later code (the window loop and the .catch of the read), which maps the new accept back to the old outcome. Alternative: the oracle came from the schema alone, not from the whole read.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "7fb3f837145800cb121b1eff05327e663bbee5f4",
      "brief": "Plan comment 7200828631 of #351, Task 3 Step 5",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "8fb4f83f4fe7d1cddfe1f729c4fd4bca300bb53f",
        "digest": "c39f7275bfa301b77a0b9d69446f325621e6ff4adbb8fa2d74bf68c8f926e804"
      }
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "ed9add2f-983d-465e-abff-b17d32a1ac1d",
      "requestDigest": "39ce9ac533f2480066a6f8520cb791cba1f39c21b61f6029299cc71470b6a3c4",
      "date": "2026-11-26",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #351; claude child opus/high\n\nApprove (reviewer rules): the proposal has two observed tool-output incidents from the implementers of #351 Tasks 2 and 3; its rule states applicability, action, and check; it widens no permission, weakens no check or gate, adds no network or credential act, and agrees with the principle test-behavior-not-implementation of the plugin celetis (a change that breaks the behavior must make the check fail). No live or historical lesson holds its incidents. It is not merged into derive-plan-oracle-values-from-real-producers: that rule covers expected values of existing producers on a probe input, and this rule covers whether a planned mutation control discriminates at all. The proposal keeps the inferred cause apart from the facts.",
      "related": [
        "run-a-planned-mutation-control-on-the-base-logic-before-naming-its-mismatch"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule is a judgment-dependent text rule; the proposal names no structural check, because the gate cannot run a planned mutation before the build."
      }
    }
  ]
}
---
# Run a planned mutation control on the base logic before naming its mismatch

## What happened

In the build of #351, two of the five mutation controls of the plan named a MISMATCH that the mutation could not produce. In Task 2, moving the `method` test of `call` after the `id` test still skipped the line that the plan named. In Task 3, making `secondary` optional did not change the outcome, because the later read threw on `undefined.usedPercent` and its `.catch` gave `null`, the base value. Each implementer found it, reported it, and added a mutation that does discriminate.

## Root cause

Inference: the plan stated each expected mismatch from the intent of the mutated check, not from a trace of the mutated code through the rest of the read on that probe input. Later code (a skip branch, a `.catch`, a loop guard) mapped the change back to the base outcome. Uncertain: the plan carried derive-plan-oracle-values-from-real-producers, which covers oracle values of a probe input, but it does not name mutation controls.

## Fix

Proposed prevention (text, no structural check): before a plan names the MISMATCH of a mutation control, trace the mutated code on that probe input to the returned outcome, through each later guard and fallback, or run the mutation once on the base tree. A structural check is not suitable: the gate cannot run a plan's mutation before the build.

## Rule

Applies when a plan or a brief names a mutation control (a temporary code change) and the probe case that must give a MISMATCH. Action: trace the mutated code on that probe input through every later guard, skip branch, and fallback (`.catch`, `??`, a loop test) to the outcome that the caller gets, or apply the mutation once to a scratch copy of the base and run the case; name only a case whose outcome differs. Check: the plan or the report shows, for each mutation control, the traced or measured outcome of the named case with and without the mutation, and they differ.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]]
[[confirm-a-check-can-still-fail-after-its-input-moves]]
