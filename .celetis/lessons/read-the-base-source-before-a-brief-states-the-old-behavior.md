---
{
  "schema": 1,
  "name": "read-the-base-source-before-a-brief-states-the-old-behavior",
  "description": "A fix brief of the implement coordinator told the fixer what three commands did before the change, with no read of the base source, and the fixer wrote the false claim into a decision record",
  "tags": [
    "process"
  ],
  "date": "2026-11-20",
  "status": "active",
  "source": "The implement session of #333 on Claude Code, final-review fix wave, 2026-11-20",
  "incidents": [
    {
      "id": "4c8a5e77-623c-4fe5-b7db-563a87d6f3a6",
      "date": "2026-11-20",
      "action": "The coordinator wrote in the final-review fix brief of #333 that `assist`, `coordinator`, and `next-step` \"already refused `0` and `012` differently\", from memory, and asked the fixer to name them in ADR-0116 \"Consequences\". The fixer copied the claim (commit 098ff08) and did not rerun that clause.",
      "expected": "A brief that states what a command did before the change derives each such fact from the base source or a base run, and cites it, before an implementer writes it into a record.",
      "observed": "The scoped re-review read the base sources: assist.ts:26 and coordinator.ts:21-22 read `012` as issue 12, and next-step.ts:12 took `0` and `012`. The ADR sentence was false and contradicted intended difference 2 of the plan.",
      "source": {
        "kind": "tool-output",
        "excerpt": "base assist.ts:26: !/^#?[0-9]+$/.test(args[0] ?? '') || !Number.isSafeInteger(issue) || issue < 1\nbase next-step.ts:12: (arg === '--open' || /^\\d+$/.test(n))",
        "reference": "https://github.com/ddinkov10/celetis/issues/333"
      },
      "inference": "Inferred: the coordinator summarized the plan's intended difference 2 in reverse and did not open the base files. The fixer reported that it did not rerun the clause, so the review was the only check. Alternative: the rule of derive-plan-oracle-values-from-real-producers covers expected values of a check, not a fact that a brief hands to a document, so it did not apply.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "098ff08",
      "brief": ".superpowers/sdd/333/final-fix-brief.md, Important 3: \"(with `assist`, `coordinator`, and `next-step`, which already refused `0` and `012` differently)\"",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "9d60f3c",
        "digest": "7608053e07d69a21fb35c4f27ee9e58ce30ebdab840c4e3921352a3de0771392"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "2b0490de-29ad-421c-9578-c799503d28fc",
      "requestDigest": "d2aae0ae56d8d084e4e04b671254aaa7a1e4adc7a943787cb15e8f971bdfc5b6",
      "date": "2026-11-20",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #333; claude child opus/high\n\nApprove with an edit by the reviewer rules: the proposal has observed tool-output evidence, and the reviewer confirmed it from the base sources (engine/assist.ts lines 25-27 and engine/next-step.ts lines 11-12 at b09438b~1 accept 012 and, for next-step, 0). It states applicability, action, and check, keeps the inference apart from the facts, and contradicts no instruction, skill, or principle. No active lesson states the same rule: derive-plan-oracle-values-from-real-producers covers the expected values of a check, and list-the-sites-before-a-document-claims-every-site covers universal claims, not a statement of old behavior of named commands. Edit: the tags documentation and review are not in the tag vocabulary; process stays.",
      "related": [
        "read-the-base-source-before-a-brief-states-the-old-behavior"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A line of the implement fix-brief text that asks the coordinator to cite the base file and line for each statement of old behavior needs a separately authorized change."
      }
    }
  ]
}
---
# Read the base source before a brief states the old behavior

## What happened

In the final-review fix wave of #333, the coordinator's brief told the fixer that `assist`, `coordinator`, and `next-step` already refused `0` and `012` before the change, and asked for that clause in ADR-0116. The fixer wrote it (098ff08) and said that it had not rerun that clause. The scoped re-review read the base sources: `assist` and `coordinator` read `012` as issue 12, and `next-step` took `0` and `012`. The coordinator corrected the sentence in 9d60f3c.

## Root cause

Inferred: the coordinator wrote the fact from memory of the plan and reversed it. The related lesson `derive-plan-oracle-values-from-real-producers` covers an expected value of a check, not a fact about old behavior that a brief hands to a record, so no rule required the read. Not checked: whether a fixer that reruns each stated fact would have caught it alone.

## Fix

9d60f3c corrects the ADR sentence from the base sources. Proposed, not authorized: a brief template line that asks the coordinator to cite the base file and line for each statement of old behavior. The rule stays text, because which sentences state old behavior is a judgment.

## Rule

Applies when a coordinator, a brief, or a ruling states what code did before the change (an accepted input, a refusal, an output) and asks an implementer to write it into a document, a record, or a commit message. Action: read the base source or run the base entry for each such fact, and cite the file and line or the run in the brief; tell the implementer to confirm each cited fact against the base before writing it. Check: each statement of old behavior in the brief names its base source, and the implementer's report shows the base read or run for each one.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]]
[[list-the-sites-before-a-document-claims-every-site]]
