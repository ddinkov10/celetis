---
{
  "schema": 1,
  "name": "read-the-base-source-before-a-brief-states-the-old-behavior",
  "description": "Briefs stated old behavior with no run of the base: three commands of #333 that a fixer wrote into a record as a false claim, and a follow result of #359 that a source read got wrong in three of seven start states",
  "tags": [
    "process",
    "ui",
    "test"
  ],
  "date": "2026-11-23",
  "status": "active",
  "source": "The build of #359, task verify-1: the fix brief of the controller and the base probe of its implementer.\n\nThe implement session of #333 on Claude Code, final-review fix wave, 2026-11-20",
  "incidents": [
    {
      "id": "46da13be-c05a-4197-b820-e51df549ab5e",
      "date": "2026-11-23",
      "action": "The controller read coordinator.ts of the base and wrote in the verify-1 brief that a new session leaves the log at its end from each start state.",
      "expected": "The brief names the base result of each start state from an observed run of the base.",
      "observed": "The implementer ran the base at three sizes. At the end, press in the end zone, tall press, and held at the end gave gap 0. Press then scroll up, reader above, and held above gave top 0, gap 2976, and Go to the end shown.",
      "source": {
        "kind": "tool-output",
        "excerpt": "base after a new session: pressThenUp, above, heldAbove: top 0, gap 2976, Go to the end shown",
        "reference": "issue #359, task verify-1 report"
      },
      "inference": "Inferred: the controller derived a state transition from the scroll handler and did not see that follow stays false when the clamped scroll event reads as an upward scroll. Uncertain whether a run of one more state would have shown it.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "3c26582981c402960b8305f969920cb20726a828",
      "brief": "The base rule. A new session empties the list ... and it sets follow = true. Confirm this on the base before you rely on it.",
      "lesson": {
        "name": "read-the-base-source-before-a-brief-states-the-old-behavior",
        "revision": "3c26582981c402960b8305f969920cb20726a828",
        "digest": "8db10c7fe909db5bef28404e03ede48b075a6c34721663dcb4131cb0064beaeb"
      }
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "2dd4572d-6c85-448b-8423-8409192e8a0b",
      "requestDigest": "e43a6c70d0db455f9638839d3f15a2c175d17bcf0f10fac9a51ee01d85c58670",
      "date": "2026-11-23",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #359; claude child opus/high\n\nMerge under the reviewer rules. The active lesson read-the-base-source-before-a-brief-states-the-old-behavior states the same rule for a fact of old behavior, and the incident of #359 shows that its permitted source read is not enough for a state sequence. Two active lessons would give a controller two answers for one brief, so the survivor keeps one rule: a source read or a run for a single fact, and a run in each start state, or the value unknown, for a state transition. Both incidents stay. The brief of #359 also asked the implementer to confirm the fact, and that run found the difference.",
      "related": [
        "run-the-base-in-each-start-state-before-a-brief-names-its-result",
        "read-the-base-source-before-a-brief-states-the-old-behavior"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because which sentences of a brief state old behavior is a judgment. This review changes lesson data only."
      }
    }
  ]
}
---
# Read or run the base before a brief states the old behavior

## What happened

In the final-review fix wave of #333, the coordinator's brief told the fixer that `assist`, `coordinator`, and `next-step` already refused `0` and `012` before the change, and asked for that clause in ADR-0116. The fixer wrote it (098ff08) and said that it had not rerun that clause. The scoped re-review read the base sources: `assist` and `coordinator` read `012` as issue 12, and `next-step` took `0` and `012`. The coordinator corrected the sentence in 9d60f3c.

In the build of #359, the verify-1 brief said that a new session leaves the log at its end, from a read of the base scroll handler. The brief also told the implementer to confirm this on the base. The implementer ran the base at three sizes. Three of the seven start states (press then scroll up, reader above, and held above) ended at top 0 and gap 2976, with `Go to the end` shown.

## Root cause

Inferred: the coordinator wrote the fact from memory of the plan and reversed it. The related lesson `derive-plan-oracle-values-from-real-producers` covers an expected value of a check, not a fact about old behavior that a brief hands to a record, so no rule required the read. Not checked: whether a fixer that reruns each stated fact would have caught it alone.

In #359, inferred: a read of one handler does not show the order of the clamp, the scroll event, and the next read. This rule accepted a source read for a fact of old behavior, and this fact was a state sequence. Uncertain whether a run of one more state would have shown it.

## Fix

9d60f3c corrects the ADR sentence from the base sources. Proposed, not authorized: a brief template line that asks the coordinator to cite the base file and line for each statement of old behavior. The rule stays text, because which sentences state old behavior is a judgment.

Proposed after #359, not enforced: when a brief states the old result of a state transition, the controller runs the base in each start state, or states the result as unknown and asks the implementer to measure it.

## Rule

Applies when a coordinator, a brief, or a ruling states what code did before the change (an accepted input, a refusal, an output) and asks an implementer to write it into a document, a record, or a commit message, and when it states what the base does across a state transition with more than one start state (a scroll, a focus, a follow, a reset). Action: read the base source or run the base entry for each such fact, and cite the file and line or the run in the brief; tell the implementer to confirm each cited fact against the base before writing it. For a state transition, a source read is not enough: run the base in each named start state and cite the measured result, or mark the result unknown and require the implementer to measure it before the fix. Check: each statement of old behavior in the brief names its base source, each start state of a transition has an observed base value or says that the value is unknown, and the implementer's report shows the base read or run for each one.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]]
[[list-the-sites-before-a-document-claims-every-site]]
[[run-a-command-of-a-spec-in-the-state-that-it-targets]]
