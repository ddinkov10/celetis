---
{
  "schema": 1,
  "name": "ambiguity-check-counts-every-claimant",
  "description": "An ambiguity check counted only claimants with full binding evidence, so an ambiguous name passed",
  "tags": [
    "process",
    "false-negative"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "Final review of #211 (ddinkov10/celetis), controller-confirmed reproduction",
  "incidents": [
    {
      "id": "f53f7f0d-2e4c-4781-a6f1-42251001cddd",
      "date": "2026-11-02",
      "action": "The #211 build implemented the plan's ambiguity rule literally: followupAddress counted a holder of a Claude spawn name only when spawnName bound it (the Agent `name` argument plus a `name` echo in the native result), engine/lib/dispatch-record.ts at commit f7b9695.",
      "expected": "A resume by name is refused when the record shows that another worker also received that name, because the host routes a shared name to its latest holder (plan Verify bar: 'refuses an ambiguous name').",
      "observed": "A second Agent call with the same `name` argument and a native result without the echo was not counted, so a SendMessage to that name was accepted as `started` for the earlier child.",
      "source": {
        "kind": "tool-output",
        "excerpt": "repro case other-holder-noecho on f7b9695: 'report: exit 0 {\"status\":\"reported\",...,\"result\":\"started\"}'; after fix 4ee6669 the case exits 5 ('the follow-up needs recorded child').",
        "reference": "ddinkov10/celetis#211, commits f7b9695 and 4ee6669"
      },
      "inference": "Inferred: the spec defined 'bound' (argument plus echo) and the plan reused that one predicate for both the acceptance side and the conflict side. The binding evidence that makes an alias safe to accept is stricter than the evidence that makes a name ambiguous, so reusing it on the conflict side narrowed the refusal. Alternative: the planner judged a non-echoing result impossible on the real host; no host evidence was checked.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f7b9695"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "70c6af14-4028-421d-aba7-04d522af0500",
      "requestDigest": "b45966f5de31a6033538a24fd8982f42fd2d82d3c981b0353b3c4887e013c6ab",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #245; codex child host default/high\n\nApprove under the reviewer rules: the retained competing-call reproduction shows acceptance of an ambiguous name when the second native result omitted its echo. The rule states its scope, distinguishes acceptance evidence from credible competing claims, and requires a weak-evidence refusal probe. It agrees with the current dispatch procedure, which counts another Agent call using the name, and with boundary discipline. The cause remains inferred. This rule differs from the active lesson about plan scope: it governs the ambiguity predicate itself rather than plan-to-spec coverage.",
      "related": [
        "ambiguity-check-counts-every-claimant"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The credible claimant evidence depends on the identity boundary. No separate structural follow-up is required by this review."
      }
    }
  ]
}
---
# An ambiguity check counts every claimant, not only the ones with full binding evidence

## What happened

The #211 build accepted a Claude spawn name as a follow-up address only when the recorded spawn
report bound it, and refused the name when another recorded worker also bound it. Both sides used
one predicate: the `name` argument plus a `name` echo in the native result. The final review found
that a second `Agent` call with the same `name` argument but no echo was not counted, so a send to
that name was accepted (`exit 0 ... "result":"started"`). Fix 4ee6669 counts every started `Agent`
call whose `name` argument equals the address.

## Root cause

Inferred, not established: the predicate that proves a safe alias was reused to detect a conflict.
Acceptance needs the strongest evidence; refusal needs only a credible competing claim. The plan
and the spec used one term ("bound") for both, and neither the plan review nor the build compared
the two sides.

## Fix

Proposed prevention (text, not enforced): when a check accepts an identity or alias only if it is
unique, define the claimant set by the weakest evidence that a competitor could hold the identity,
and keep the strong evidence only on the acceptance side. Add a probe case where a competitor has
the weak evidence only. This depends on judgment about what counts as a claim, so it stays text.

## Rule

Applies when a check accepts a name, alias, or identity only when no other holder exists. Count as
a holder every record with credible evidence of the claim, not only records with the full evidence
that the acceptance side requires. Check: a probe where a second holder has only the weak evidence
must be refused.

## Related lessons

[[plan-condition-must-not-narrow-a-spec-rule]]
