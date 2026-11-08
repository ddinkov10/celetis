---
{
  "schema": 1,
  "name": "keep-each-effect-of-a-removed-helper-call",
  "description": "A ruling removed passOn at the land client to parse the daemon code and lost its second effect, so each nonzero landing recorded an empty refusal",
  "tags": [
    "regression",
    "process"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "#253 implement session (step session), Task 4 task review of 67798b7..427f27d",
  "incidents": [
    {
      "id": "2e1be3f3-5035-4b9b-9e45-25edb2dcafb8",
      "date": "2026-11-08",
      "action": "The coordinator ruling C4 told Task 3 to return the parsed landing code in engine/land.ts without passOn, because the plan rule R11 says that only the D4 sites pass a child code on.",
      "expected": "The event record of the land client stays as in the base: the daemon records the landing (land-exit), and the client records only its own refusals (docs/workflow.md, \"The event record\").",
      "observed": "For one landing with code 6, the base client wrote 0 event entries and the lane client wrote 1 entry: kind=refusal command=land name=exit code=6 message=\"\".",
      "source": {
        "kind": "tool-output",
        "excerpt": "base: land exit 6; stderr: \"\" / base: event entries: 0 / lane: land exit 6; stderr: \"\" / lane: event entries: 1 / lane:   kind=refusal command=land name=exit code=6 message=\"\"",
        "reference": "#253 Task 4 review probe land-event/probe.ts, rerun by the coordinator; fixed in 45da931 (recordedElsewhere)"
      },
      "inference": "Inferred: passOn had two effects, the returned code and an entry in the passed set that the exit handler of engine/lib/events.ts skips; the ruling and R11 named only the pass-through role. Uncertain: whether a reading of passOn before the ruling would have shown it; the Task 3 review did not probe the event record either.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "6c14f8b"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "b7566dcd-d1c2-476d-8f78-ac976171f3a3",
      "requestDigest": "490479bd263d6af7699fba4341c6d2b24820f622de0dc64dadcda61fda87ae50",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #253; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed: the retained probe excerpt gives 0 event entries in the base and 1 refusal with an empty message in the lane for one landing with code 6, and the lane holds passOn (passed.add, then passThrough) and the fix recordedElsewhere in engine/lib/events.ts, called in engine/land.ts by 45da931. The rule states applicability, action, and check, and keeps the inferred cause apart from the facts. No active lesson states this rule: a-moved-check-keeps-the-states-of-its-old-rule covers the accepted states of a moved check, and plan-condition-must-not-narrow-a-spec-rule covers a changed spec rule, not a lost effect of a removed helper call. The rule widens no permission, weakens no check, and contradicts no instruction, skill, or principle.",
      "related": [
        "keep-each-effect-of-a-removed-helper-call"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The effects of each helper differ, so no general structural check is known; a probe of the effects at the changed site stays the check of the rule."
      }
    }
  ]
}
---
# Keep each effect of a shared helper call that a change removes

## What happened

In #253, the coordinator ruling C4 made `engine/land.ts` return the parsed landing code of the daemon without `passOn`, because the plan allowed `passOn` only at the pass-through sites. The Task 3 review accepted it. The Task 4 review then probed the event record: for one landing with code 6, the base client wrote no entry, and the lane client wrote a refusal with an empty message next to the daemon's `land-exit`. The fix `45da931` added `recordedElsewhere` to `engine/lib/events.ts` and called it at that one site.

## Root cause

Inference: `passOn` returned the code and also marked it as recorded elsewhere, so the `exit` handler did not record it. The ruling looked only at the role that the rule named. Uncertain: whether a read of the helper body before the ruling would have caught it.

## Fix

Proposed prevention (text, not enforced): before a change removes or replaces a call to a shared helper at a site, list each effect of the helper at that site, and keep each effect that the site needs. A structural check is a probe that compares each such effect with the base at that site. The rule stays text, because the effects of each helper differ.

## Detection signature

A new entry in a record, a log, or a set that the base does not write, after a call was removed for a reason that names only its return value.

## Rule

Applies when a change or a ruling removes or replaces a call to a shared helper at one site. Action: read the helper, list each effect at that site (the return value, recorded state, events, marks, flags), and keep each effect that the site needs, or record why it goes. Check: a probe compares each listed effect with the base at that site, for example the event record of the command for one case.
