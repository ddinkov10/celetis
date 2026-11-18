---
{
  "schema": 1,
  "name": "assert-the-value-that-a-check-name-claims",
  "description": "A Verify probe printed ok for a check named 'in Geist Mono' while its observed font was the browser default monospace, and the runner reported the break as an observation",
  "tags": [
    "ui",
    "test",
    "false-positive",
    "process"
  ],
  "date": "2026-11-18",
  "status": "active",
  "source": "The implement session of #331 on Claude Code, Verify phase, 2026-11-18",
  "incidents": [
    {
      "id": "e2c3e72a-cbea-4143-bddc-f9300c7582f0",
      "date": "2026-11-18",
      "action": "The Verify runner of #331 asserted the font of the code `celetis daemon start` in the server-down Automation sentence with a check named 'in Geist Mono' that passed on the value `monospace`, and reported the scenario V4 PASS with the difference as 'Observation (not a fail)'.",
      "expected": "A check whose name claims a value (Geist Mono, per DESIGN.md 'Geist Mono for numbers, paths, and identifiers' and the Global Constraint 'no new font') fails when the observed value differs, and the runner reports a FAIL.",
      "observed": "The probe line printed ok with the observed font `monospace`; the coordinator ruled it a FAIL; the fix verify-1 (c0bab9a) gave `\"Geist Mono\", ui-monospace, SFMono-Regular, Menlo, monospace`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "ok   server-down 1440x900 code of the Automation line is `celetis daemon start` in Geist Mono: {\"text\":\"celetis daemon start\",\"font\":\"monospace\"}",
        "reference": "docs/superpowers/verification/331/verify/V4.out.txt line 61 (ignored evidence folder of the #331 lane)"
      },
      "inference": "Inferred: the probe asserted only that the code text exists, and its name carried the font claim; the runner then judged the font difference by reach (a code span in a failure state) instead of by the design rule. Uncertain: whether the probe intended a font assertion and lost it in an edit. Alternative: the plan oracle of V4 named Geist Mono only for #ctl-auto-command, so the runner read the second code span as outside the oracle.",
      "diagnosis": [
        "not-retrieved",
        "wrong-or-incomplete-rule"
      ],
      "revision": "05afe98953209eb425da4049089d8ac7803541d9",
      "brief": ".superpowers/sdd/331 Verify brief of the lane carried the plan Verify lesson rules; it did not carry compare-each-known-limit-with-the-spec-rule-that-it-narrows, whose actors are implementers, task reviewers, and controllers, not a Verify runner",
      "lesson": {
        "name": "compare-each-known-limit-with-the-spec-rule-that-it-narrows",
        "revision": "active",
        "digest": "9bbc93b6b03205523106e4b750f7efade4ac17d77eebe52759ca4062ea6f5e4d"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "5eca5101-48b5-467a-aa67-1cf5edfde914",
      "requestDigest": "c244981c4e1435f30c9f53552d171e5b77ee4721668df0d9c48f516679b99d5d",
      "date": "2026-11-18",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #331; claude child opus/high\n\nApprove: the proposal has observed tool-output evidence (the ok probe line with font monospace), states applicability, action, and check, keeps its inferred cause apart from the facts, and only tightens a check. No active or historical lesson holds its incident or states the same rule: compare-each-known-limit-with-the-spec-rule-that-it-narrows binds implementers, task reviewers, and controllers, and derive-plan-oracle-values-from-real-producers binds plan oracle values, not a probe assertion or a Verify runner grade. It agrees with the principle test-behavior-not-implementation and the procedure runtime-verification, and contradicts no skill, principle, or project instruction.",
      "related": [
        "assert-the-value-that-a-check-name-claims"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Which design or spec rule covers an observed value needs judgment, so no structural check covers the rule; it stays text, as its Fix says."
      }
    }
  ]
}
---
# Assert the value that a check name claims, and grade each runtime observation by the design rule

## What happened

In the Verify phase of #331, the probe of scenario V4 printed `ok` for the check "code of the Automation line is `celetis daemon start` in Geist Mono", and its own output held `"font":"monospace"`. The runner reported V4 PASS and listed the difference as "Observation (not a fail)". `DESIGN.md` says Geist for words and Geist Mono for identifiers, and the plan's Global Constraints forbid a new font. The coordinator ruled it a FAIL, and the fix task verify-1 (commit c0bab9a) gave the code the Geist Mono rule; the computed font then read `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`.

## Root cause

Inferred: the assertion checked the text and not the font, so the check name claimed more than the check proved. The runner then graded the difference by reach. Uncertain: whether the font assertion was lost in an edit of the probe. Alternative: the V4 oracle of the plan named Geist Mono only for `#ctl-auto-command`, so the runner read the second code span as outside the oracle. The lesson `compare-each-known-limit-with-the-spec-rule-that-it-narrows` names implementers, task reviewers, and controllers, and it did not reach the Verify brief.

## Fix

Proposed prevention, as text, not enforced: each probe check asserts every value that its name claims, and a Verify runner compares each observation that it reports with the spec and the design rules, and reports a break as FAIL, not as an observation. This stays text: which rule covers an observed value needs judgment.

## Detection signature

A probe line `ok ... in <value>` whose printed observation holds another value; a Verify report with "observation (not a fail)" next to a design or spec term.

## Rule

Applies when a runtime check asserts a property that its name or message states (a font, a color, a size, a label), or when a Verify runner reports an observation beside a scenario result. Action: assert the stated value itself, not only the presence of the element; compare each reported observation with the spec, the design document, and the plan constraints, and report a break of one as FAIL of the scenario. Check: each `ok` line of the evidence holds an observed value equal to the value that its name claims, and each observation of the report names the rule that it was compared with and the result.

## Related lessons

[[compare-each-known-limit-with-the-spec-rule-that-it-narrows]]
[[derive-plan-oracle-values-from-real-producers]]
