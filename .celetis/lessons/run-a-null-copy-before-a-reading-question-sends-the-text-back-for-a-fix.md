---
{
  "schema": 1,
  "name": "run-a-null-copy-before-a-reading-question-sends-the-text-back-for-a-fix",
  "description": "A differential reading check sent critic-loop back for four rounds of fixes while two of its failing questions also failed on a copy of the base with identical bytes",
  "tags": [
    "process",
    "test",
    "false-positive",
    "recurring"
  ],
  "date": "2026-11-12",
  "status": "active",
  "source": "The implement session of #299 on Claude Code, Task 6 (critic-loop), child t6-impl, reported to the coordinator, 2026-11-12",
  "incidents": [
    {
      "id": "b5f6e1d2-9a47-4c3e-8d10-6f2a7c4e91b3",
      "date": "2026-11-12",
      "action": "Task 6 ran four rounds of full reruns of all critic-loop cases after reading questions failed, and each round gave a different subset of failing questions on unchanged text.",
      "expected": "A reading question sends the text back for a fix only when the difference comes from the text, so a question whose lines are unchanged returns same act.",
      "observed": "On the null tree vtn4 (the bytes of the base fwia, made with control fwia controls/null.json), cl-C08 Q6 gave one unsettled on a single run and different majority act on three runs, and cl-C22 Q4 gave one unsettled. After four rounds, C08 Q4, C08 Q6, and C22 Q4 on Claude Code still gave different majority act on the final text.",
      "source": {
        "kind": "tool-output",
        "excerpt": "vtn4 (bytes of fwia): C08 Q6 one unsettled (single) and different majority act (3 runs); C22 Q4 one unsettled.",
        "reference": "/Users/dinq/.cache/celetis-299-proof/report/cl.md"
      },
      "inference": "Inferred by the child: questions of the form 'list every act' and 'is the list complete' invite reader choices about which points to leave open, and the model judge counts each choice as a different act; the harness has no noise threshold. Alternative: a real but small difference of the text that the null tree hides by chance; not excluded.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f30e73d"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c03d4c2b-8a60-469a-b0b0-c92aa01fc1ca",
      "requestDigest": "12df8cde424064c6b87ca39fbe5913fcaaa1e88bcf5c0225c750f70abd4d000a",
      "date": "2026-11-12",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #297; claude child opus/high\n\nApprove, under the reviewer rules. The incident is observed tool output: on the null tree vtn4 of #299, with the bytes of the base fwia, cl-C08 Q6 and cl-C22 Q4 of critic-loop failed as on the new text, after four rounds of text fixes. The rule states applicability, action, and check. It adds a control run to the differential reading check and does not skip or weaken it: a question that also fails on the null copy is recorded as unstable with both spreads for the maintainer, not graded as a pass, and a text fix still follows a failure that the null copy does not show. It widens no permission and contradicts no skill, principle, or instruction file; the reading check harness is not a file of this repository. No active lesson states the same rule: give-a-reading-case-an-input-that-only-the-rule-under-test-covers isolates the input of a case, not the noise of a question on identical text. The diagnosis unknown and the alternative of a real small text effect stay labeled as inference.",
      "related": [
        "run-a-null-copy-before-a-reading-question-sends-the-text-back-for-a-fix"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A command of the differential reading check that runs a failed question on a null copy of the base with the same run count and reports both spreads; it needs separate authorization."
      }
    }
  ]
}
---
# Run a null copy before a reading question sends the text back for a fix

## What happened

In #299, Task 6 ran four rounds of full reruns of the `critic-loop` cases. Each round gave a different subset of failing questions on unchanged text. A null tree with the bytes of the base (`vtn4`) failed two of the same questions (`cl-C08` Q6, `cl-C22` Q4) on Claude Code.

## Root cause

Inferred: open questions such as "list every act" or "is the list complete" let each reader leave different points open, and the model judge counts each choice as a different act. The harness had no measure of the variance of one question on identical text. A small real text effect is not excluded.

## Fix

Proposed: when a question fails after the reruns, run it on a null copy of the base before the next text fix. A failing null copy marks the question as unstable; the build records it for the maintainer instead of editing the text again. This is a proposed process step; a harness command could enforce it later, with separate authorization.

## Rule

Applies when a differential reading check fails a question after its reruns and the next act is a fix of the text. Action: run the same question on a copy tree with the bytes of the base, with the same run count; when the copy fails too, record the question as unstable with both spreads and stop fixing the text for it. Check: each text fix that a failed question caused names a null-copy verdict of `same act` or `same majority act` for that question.

## Related lessons

[[give-a-reading-case-an-input-that-only-the-rule-under-test-covers]]
[[confirm-a-check-can-still-fail-after-its-input-moves]]
