---
{
  "schema": 1,
  "name": "distinguish-capability-catalog-from-execution",
  "description": "A native no-invocation oracle treated an advertised skill name as an executed skill",
  "tags": [
    "test",
    "false-negative",
    "e2e"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "Runtime verification of ddinkov10/celetis#231",
  "incidents": [
    {
      "id": "celetis-231-catalog-is-not-invocation-20261103",
      "date": "2026-11-03",
      "action": "The extra runtime oracle rejected an ordinary-complaint case whenever the serialized host log contained celetis:feedback.",
      "expected": "The negative invocation check must reject an actual feedback load or write, while permitting the host to advertise the explicitly available skill.",
      "observed": "Claude made no tool call and no issue write in the ordinary-complaint turn. Its startup slash_commands catalog contained celetis:feedback, so the string assertion failed. A check of actual Skill/Read events passes on the same retained interaction.",
      "source": {
        "kind": "tool-output",
        "excerpt": "First extra oracle: claude-ordinary FAIL AssertionError false == true. Native result: I did not read any files or run any commands. Corrected event oracle: claude-ordinary PASS.",
        "reference": "#231 extra-results.json and retained claude-ordinary.jsonl at 5af998f9a51744e547d81bc6923f8ae84e142823"
      },
      "inference": "The assertion confused an advertised capability with its execution. The native interaction itself needed no repair.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "5af998f9a51744e547d81bc6923f8ae84e142823"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "15ce1e63-7ef6-4fae-a2dc-4345270e36d8",
      "requestDigest": "955ced4447542efbc5f0e991c5030596d6ae0e985a9be9a4b0986cbeaecdfd40",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nApprove under the reviewer rules: the retained native result and corrected event assertion show that advertised metadata caused a false invocation finding. The rule identifies its scope, the executed events or effects to inspect, and an advertised-but-unused negative case. It agrees with the feedback explicit-invocation boundary and the runtime evidence and behavioral-check procedures. It removes no required check.",
      "related": [
        "distinguish-capability-catalog-from-execution"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Host event formats need local judgment. This review needs no structural change."
      }
    }
  ]
}
---
# Distinguish an advertised capability from its execution

## What happened

In #231, the ordinary-complaint oracle searched the serialized Claude log for the feedback skill name. It falsely rejected the case because the startup catalog advertised that explicit skill. No tool call or issue write occurred. Checking actual Skill and Read events passed the same retained interaction.

## Root cause

The assertion treated discovery metadata as execution evidence. This is an oracle defect, not an observed implicit invocation.

## Fix

The temporary oracle checks tool events and external calls. Proposed prevention is to state which event establishes each claimed action before asserting over a host log. This remains a verification rule because host event shapes vary; no product enforcement is added.

## Rule

When verifying whether an agent invoked a capability, inspect its executed tool or loaded-resource events and observable effects. A name in a startup catalog does not establish invocation. Check that an advertised but unused capability passes the no-invocation case.
