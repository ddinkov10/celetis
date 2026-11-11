---
{
  "schema": 1,
  "name": "check-every-consumer-of-a-skipped-upstream-step",
  "description": "Options for a new upstream short path kept the issue's rules but let the session skip the user's pick among prior-art patterns",
  "tags": [
    "process"
  ],
  "date": "2026-11-06",
  "status": "active",
  "source": "Bug session of ddinkov10/celetis#273, 2026-11-06",
  "incidents": [
    {
      "id": "c4f2564e-a0b5-4462-9407-d3a1c32667a3",
      "date": "2026-11-06",
      "action": "The bug session of #273 offered two orders for specify on the Superpowers 7.0.2 short-design path; both let the session decide 'one sensible way' with no tie to the prior-art findings.",
      "expected": "Options that keep prior-art.md, 'The recommendation': the approaches include each pattern that the research found, and the person can still pick one.",
      "observed": "The maintainer asked whether the short path removes the choice of approaches after the prior-art findings; the session found that neither option kept that choice and added the condition 'the short path only when the research leaves one pattern'.",
      "source": {
        "kind": "user-report",
        "excerpt": "so i will lose the option to choose approaches after prior art findings?"
      },
      "inference": "Inferred: the options were checked only against the three rules that the issue named, not against every rule that reads the skipped approaches message. Alternative: prior-art.md was read for its timing only. The planning of the options is in this session only.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "58d4c12"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c481ebd4-95fb-446f-a26a-1a1998b8179a",
      "requestDigest": "3427aa56f84bbeef8659ce38ef749d0384bbccc782e988bc5b852254bd43e94a",
      "date": "2026-11-06",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #273; claude child opus/high\n\nApprove by the reviewer rules: the proposal has observed user-report evidence of a substantive correction, its rule states applicability, action, and check, it widens no permission and weakens no check, and it agrees with prior-art.md, 'The recommendation', and specify addition 10. No active or historical lesson states the same rule: scope-shared-prohibitions-against-required-callers covers a shared prohibition against its callers, and plan-condition-must-not-narrow-a-spec-rule covers a plan against an approved spec, not an upstream step that a new path skips. The root cause stays labeled as inference.",
      "related": [
        "check-every-consumer-of-a-skipped-upstream-step"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the repository has no machine-readable model of which agent text reads which upstream step."
      }
    }
  ]
}
---
# Check every rule that consumes an upstream step before an option skips it

## What happened

In the bug session of ddinkov10/celetis#273, Superpowers 7.0.2 brainstorming had a new short path: when nothing is open, the first message carries the approach and a short design, and no "Lay out the approaches" message comes. The session offered the maintainer two orders for `specify` on that path. Both orders kept the three rules that the issue named: the research before any approach, the builder check, and the approval of the written spec. Neither order tied the session's "one sensible way" decision to the prior-art findings. The maintainer asked: "so i will lose the option to choose approaches after prior art findings?" `prior-art.md`, "The recommendation", says that the approaches include each pattern that the research found, and that the person can still pick one. The session then added a condition to the options: the short path applies only when the research leaves one pattern. No skill text changed before the question.

## Root cause

Inference, not established: the session checked the new upstream path only against the rules that the issue named. It did not list every Celetis rule that reads the output of the skipped step, the approaches message. Alternative: the session read `prior-art.md` for its timing ("When") and not for its consumer of the approaches ("The recommendation").

## Fix

Proposed prevention, not enforced: when an upstream release removes, merges, or reorders a step that Celetis text orders against, list each Celetis rule and module that consumes the output of that step. Check each option against each listed rule before the options go to the maintainer. The rule stays text, because the repository has no machine-readable model of which agent text reads which step.

## Rule

Applies when an upstream skill adds a path that skips, merges, or reorders a step that Celetis text orders against or consumes. Action: list every Celetis rule that reads the output of that step, not only the rules that the issue names, and keep each one on the new path. Check: each option offered to the maintainer says how each listed rule holds on the new path.

## Related lessons

[[scope-shared-prohibitions-against-required-callers]]
[[plan-condition-must-not-narrow-a-spec-rule]]
