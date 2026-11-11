---
{
  "schema": 1,
  "name": "give-a-reading-case-an-input-that-only-the-rule-under-test-covers",
  "description": "A reading case for a new sentence used a sample line that another rule of the same agent text also covers, so each reader followed the other rule and the grade failed",
  "tags": [
    "test",
    "process",
    "false-positive"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The fixer of the final review of #252 (child final-fix-2 of the implement session on Claude Code), report of 2026-11-11",
  "incidents": [
    {
      "id": "5e7072cb-1f4e-49dd-821a-95de2f363101",
      "date": "2026-11-11",
      "action": "For the reading check of a new sentence of the skill `coordinate` (the act for exit 1 of `coordinator send`), the fixer chose the sample line `coordinator: connect EPERM <socket>` and fixed the grade \"FAIL when the session sends the text again before a screen read\".",
      "expected": "A reading case that isolates the new sentence: the reader's act shows whether the sentence works.",
      "observed": "The sample line is a sandbox block, for which the entry contract of the plugin gives another act first (one approved retry). The three Codex readers followed the entry contract and failed the grade. A second case with a line that is no sandbox block passed 6 of 6.",
      "source": {
        "kind": "tool-output",
        "excerpt": "K26 answer of a Codex reader: \"The entry's Codex rule requires an approved retry for the `connect EPERM` sandbox block before reporting a setup stop.\" Case K27 (another line): 6 of 6 PASS.",
        "reference": "https://github.com/ddinkov10/celetis/issues/252"
      },
      "inference": "Inferred cause, from the child report: the fixer took the sample line from the finding (the Codex sandbox) and did not list the other rules of the agent text that the same line triggers. Alternative: the two rules do conflict for that input, and the case found a real ordering question; the child kept the case in the record with its grade, so this stays open.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "9ad4979",
      "brief": "The fix brief of the wave did not carry `check-refusal-contract-across-earlier-guards` for the reading cases; the task context of the fixer held the rule set `final-review-lessons.md`, which includes it for the engine refusals.",
      "lesson": {
        "name": "check-refusal-contract-across-earlier-guards",
        "revision": "9ad4979",
        "digest": "89b445c095abb63b7806eb150ae92a2c89683a4f34cde256303235daaafc0301"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "8a7e8662-ebf7-44d9-9c65-d01eef0075f1",
      "requestDigest": "24d994222c395cfc326acf66864e1352c15c77ff109ab4562c07d027140b345c",
      "date": "2026-11-11",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #252; claude child opus/high\n\nEdit, then approve, under the reviewer rules: the incident is observed. The retained K26 answer of a Codex reader cites the approved retry that the entry contract gives for a sandbox block, and case K27, with a line that is no sandbox block, passes 6 of 6. The entry contract of the plugin (references/procedures/entry.md, \"The contract\", \"The approval procedure for a sandbox block\") holds that retry for each host, so the sample line of K26 triggers two rules. The rule states applicability (a reading check adds a case for one new or changed sentence of agent text), action (list each rule that the sample input can trigger, choose an input that only the rule under test covers, and when an input must trigger two rules, write the expected act of each and their order), and check (the case file names the rules that each input triggers, and a control without the sentence under test changes the act). It adds checks, weakens none, widens no permission, adds no network or credential act, and agrees with the principle test-behavior-not-implementation (a change that breaks the behavior must make the check fail). It is not the rule of check-refusal-contract-across-earlier-guards: that rule derives the expected refusal of a code fixture from the approved behavior and accepts an earlier guard, and this rule isolates the input of a reading case or states the order of two rules; so it is no merge, and no live or historical lesson holds the incident 5e7072cb-1f4e-49dd-821a-95de2f363101. The edit changes one tag only: false-negative becomes false-positive, because the check reported a failure for an act that another rule allows, and the store tags that pattern false-positive (check-refusal-contract-across-earlier-guards, a-failed-process-read-is-not-an-exit). Attributed addendum, from the runtime report of #252 (V8, \"Deviations and gaps\"): with the line of K26 the request did not reach the daemon, so the approved retry cannot type a text twice. The order question of the two rules stays open, as the body says, and the body keeps the inferred cause apart from the facts. The rule stays text by the principle encode-lessons-in-structure.",
      "related": [
        "give-a-reading-case-an-input-that-only-the-rule-under-test-covers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: which rules of the agent text an input triggers needs a read of that text, and the oracle is a reading check. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Give a reading case an input that only the rule under test covers

## What happened

The fix wave of the final review of #252 added one sentence to the skill `coordinate`: the act for exit 1 of `coordinator send`. Its reading case K26 used the sample line `coordinator: connect EPERM <socket>` and graded a second send before a screen read as FAIL. That line is a sandbox block, and the entry contract of the plugin gives a sandbox block another first act (one approved retry). The three Codex readers followed the entry contract, and the case failed. A second case K27 with a line that is no sandbox block passed 6 of 6.

## Root cause

Inference: the sample input came from the finding and was not compared with the other rules that the reader reads. Unresolved alternative: the two rules have a real order question for that input, which the kept case K26 records.

## Fix

In #252 the fixer added the isolating case and kept the first case with its grade. Proposed reconciliation, for a separate review: `check-refusal-contract-across-earlier-guards` states the same idea for a failure fixture of code; this proposal applies it to a reading case of agent text. The rule stays text: which rules an input triggers needs a read of the agent text.

## Detection signature

Each reader of one host gives the same act that the grade refuses, and its answer cites another rule of the files that it read.

## Rule

Applies when a reading check adds a case for one new or changed sentence of agent text. Action: before the grade is fixed, list each rule of the files that the reader reads that the sample input can trigger, and choose an input that only the rule under test covers; when an input must trigger two rules, write the expected act for each rule and their order. Check: the case file names, for each case, the rules that its input triggers, and a control without the sentence under test changes the act of the case.

## Related lessons

[[check-refusal-contract-across-earlier-guards]]
[[check-every-message-class-of-a-prose-request-gate]]
