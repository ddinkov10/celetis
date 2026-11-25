---
{
  "schema": 1,
  "name": "drive-a-transition-projection-probe-through-the-real-machine-paths",
  "description": "Verify a mapping of machine transitions by driving the real transition function along each real path of the class.",
  "tags": [
    "test",
    "false-negative",
    "process"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "implement #388: Verify V5 FAIL in the Herdr lab, and fix task verify-1",
  "incidents": [
    {
      "id": "9747ac12-6dab-4127-a180-cb5723192294",
      "date": "2026-11-25",
      "action": "The final-review fix and the V2 mapping probe of #388 checked \"no step.ended for a detached live session\" only on the direct live to ending path, with hand-built transitions.",
      "expected": "No step.ended for a detached live session on every real path, including live to closing to ending of an issue run.",
      "observed": "A daemon stop with a live issue session logged step.ended with event failed before run.ended with end detached.",
      "source": {
        "kind": "tool-output",
        "excerpt": "8 run.transition f10817b1 {\"from\":\"live\",\"event\":\"failed\",\"to\":\"closing\"} | 9 step.ended f10817b1 {\"step\":\"chore\",\"host\":\"claude\",\"event\":\"failed\",\"code\":null} | 14 run.ended f10817b1 {\"end\":\"detached\",\"code\":0,\"reason\":\"\"}",
        "reference": "https://github.com/ddinkov10/celetis/issues/388"
      },
      "inference": "Hand-built triples covered only the path that the rule named. Alternative: the rule of derive-plan-oracle-values-from-real-producers reached the brief and was not followed; the brief is unavailable.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "5bfd61a6738bf3a586c446a0992139456685ffb3",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "5bfd61a6738bf3a586c446a0992139456685ffb3",
        "digest": "41ab0566a2e833c8119c46e5eacbce60d64d0d2f64f67144b5a54128292820de"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "520c8d35-c564-4000-8639-54c407c8b0fb",
      "requestDigest": "74abd71b46bffcf3d52ef209e0edede4b2dc3f78edafdc4cec5411b2bd783cbb",
      "date": "2026-11-25",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #388; claude child opus/high\n\nEdit, then approve, under the reviewer rules. The incident has observed tool-output evidence: in the Herdr lab, a daemon stop with a live issue session logged step.ended with event failed before run.ended with end detached, although the mapping probe of the build had passed. The body keeps the inferred cause and the unknown reach of derive-plan-oracle-values-from-real-producers apart from the facts. The rule states applicability, action, and check; it widens no permission, weakens no check or gate, adds no network or credential act, and agrees with the principle test-behavior-not-implementation of the plugin celetis and with the rule of AGENTS.md that adds no tracked test (the rule names a probe). No live or historical lesson holds its incident. The related active lessons derive-plan-oracle-values-from-real-producers (expected values from real producers) and list-every-producer-of-an-oracle-record (producers of a shared record) state other rules than the coverage of each real machine path of a class, so no merge. The edit only replaces the tags verification and state-machine, which are not in the tag vocabulary, with test, false-negative, and process.",
      "related": [
        "drive-a-transition-projection-probe-through-the-real-machine-paths"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the set of paths of a class of runs needs judgment of the machine, as the Fix section says. This review changes lesson data only."
      }
    }
  ]
}
---
# Drive a probe of a transition projection through the real machine paths

## What happened

Issue #388 adds `transitionNotes` (`engine/lib/run/lifecycle.ts`), which maps each run machine transition to lifecycle log entries. The final review of the build required that a detached live session gives no `step.ended`. The fix skipped `step.ended` only when `live` goes straight to `ending` with a detached end, and the V2 mapping probe of the build ("14 of 14 cases, including no `step.ended` for a detached end") passed. In the Herdr lab on Windows (lane commit 5bfd61a, 2026-11-25), a `daemon stop` with a live issue session logged (tool output, `daemon events`):

```
8 run.transition f10817b1 {"from":"live","event":"failed","to":"closing"}
9 step.ended f10817b1 {"step":"chore","host":"claude","event":"failed","code":null}
10 run.transition f10817b1 {"from":"closing","event":"closed","to":"ending"}
14 run.ended f10817b1 {"end":"detached","code":0,"reason":""}
```

An issue run detaches through `closing` (`scoped` and `fail()` in `engine/lib/run/machine.ts`). Fix task verify-1 (commit f988bb8) moved the predicate into `machine.ts` (`detaches`, shared with `failure()`). A probe that drives the real `on[]` table then passed for both detach paths and four controls.

## Root cause

Inferred: the mapping probe built (from, event, to) triples by hand from the rule text, not from the real transition table, so it covered only the path that the rule named. The brief of the final-review fix is not available (a cloud session), so it is unknown whether the lesson `derive-plan-oracle-values-from-real-producers` reached it.

## Fix

Proposed prevention, text only. A structural check is not suitable: the set of paths of a class needs judgment of the machine.

## Rule

Applies when a check (a probe, a review, or a fix) verifies a function that maps state-machine transitions to records (log entries, notes, metrics) for a class of runs, for example "a detached run gives no step end". Action: list each path in the real machine from the source state to each end state of that class, for each scope of the machine, with file:line of each transition; drive the real transition function along each path and apply the mapping at each real step; never build the (from, event, to) triples by hand; add one control path that ends outside the class. Check: the probe output names each listed path and shows the records at each real step; the control path keeps the record that the class removes; and a search of the machine for transitions into the end state of the class finds no path that the list lacks.

## Related lessons

- [[derive-plan-oracle-values-from-real-producers]]
- [[list-every-producer-of-an-oracle-record]]
