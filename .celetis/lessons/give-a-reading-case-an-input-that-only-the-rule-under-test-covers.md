---
{
  "schema": 1,
  "name": "give-a-reading-case-an-input-that-only-the-rule-under-test-covers",
  "description": "Reading cases used inputs that another rule also covers: a sandbox-block sample line in #252, and a migration that also fires the high row of the level table in #290, so correct readers failed the grade",
  "tags": [
    "test",
    "process",
    "false-positive",
    "recurring"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of #290 on Claude Code, Task 7 (the reading checks of effort.md), 2026-11-11\n\nThe fixer of the final review of #252 (child final-fix-2 of the implement session on Claude Code), report of 2026-11-11",
  "incidents": [
    {
      "id": "8da7fc36-cfa3-4dc4-a987-a60a81f4efe9",
      "date": "2026-11-11",
      "action": "The plan of #290 wrote reading case K3 (plan decides implement: the build is one coupled migration of eleven tasks, and opus at high is not enough) with the expected act fable at medium.",
      "expected": "A reading case input that only the rule under test covers (fable in place of opus above high), or an expected act for each rule that the input triggers.",
      "observed": "The Claude Code reader answered fable at high in 3 of 3 samples; the input also fits the high row of the level table (verification matters or edge cases are likely: a migration). A variant K3b with a clear scope and no likely edge case gave fable at medium on both hosts.",
      "source": {
        "kind": "tool-output",
        "excerpt": "K3 | fable named, level `high` (3 samples) -> see K3b | PASS fable medium; K3b (K3 + clear scope, no edge case) | PASS fable medium | PASS fable medium",
        "reference": "https://github.com/ddinkov10/celetis/issues/290"
      },
      "inference": "The plan author applied the carried lesson to the model rows only and did not list the level rows that the same input fires. Alternative: the author judged a migration as clear-scope work; the spec level table says edge cases are likely for it.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "9885bda",
      "brief": "Task 7 of the plan of #290 carried give-a-reading-case-an-input-that-only-the-rule-under-test-covers with its digest in its Lesson rules section.",
      "lesson": {
        "name": "give-a-reading-case-an-input-that-only-the-rule-under-test-covers",
        "revision": "630d7d0",
        "digest": "aff20802552e5d566fd6067beb8a42d3c76f6269df8f87386423e601fa0d7d63"
      }
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "c1b33050-24e3-40c5-a7c5-2f6b78900fde",
      "requestDigest": "c386a56ab162d6e12e0ab47ba0c38049f0b6e17ff734e53ccc6c19ddbd06aa03",
      "date": "2026-11-11",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #290; claude child opus/high\n\nMerge under the reviewer rules: the proposal states the same rule as the active lesson give-a-reading-case-an-input-that-only-the-rule-under-test-covers, whose action already lists each rule that the input can trigger; the incident records that rule as carried and not followed. The survivor keeps both incidents and names a row of a second table as such a rule. Observed facts and inferred causes stay apart.",
      "related": [
        "check-each-planned-reading-case-against-every-row-it-can-trigger",
        "give-a-reading-case-an-input-that-only-the-rule-under-test-covers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: which rules an input fires is a judgment of the agent text."
      }
    }
  ]
}
---
# Give a reading case an input that only the rule under test covers

## What happened

The fix wave of the final review of #252 added one sentence to the skill `coordinate`: the act for exit 1 of `coordinator send`. Its reading case K26 used the sample line `coordinator: connect EPERM <socket>` and graded a second send before a screen read as FAIL. That line is a sandbox block, and the entry contract of the plugin gives a sandbox block another first act (one approved retry). The three Codex readers followed the entry contract, and the case failed. A second case K27 with a line that is no sandbox block passed 6 of 6.

The plan of #290 gave reading case K3 a coupled migration of eleven tasks and expected `fable` at `medium`. The Claude Code reader answered `fable` at `high` in 3 of 3 samples. The input also fits the `high` row of the level table (edge cases are likely in a migration). The variant K3b, with a clear scope and no likely edge case, gave `fable` at `medium` on both hosts. Task 7 of the plan carried this lesson.

## Root cause

Inference: the sample input came from the finding and was not compared with the other rules that the reader reads. Unresolved alternative: the two rules have a real order question for that input, which the kept case K26 records.

In #290, inferred: the plan author checked the input against the rows of the table under test (the model rows) and not against the rows of the second table that the same decision reads (the level rows). Alternative: the author judged the migration as clear-scope work. The evidence does not settle which. The rule reached the author and was not followed.

## Fix

In #252 the fixer added the isolating case and kept the first case with its grade. In #290 the variant K3b removed the second trigger. Proposed reconciliation, for a separate review: `check-refusal-contract-across-earlier-guards` states the same idea for a failure fixture of code; this lesson applies it to a reading case of agent text. When an expected act holds values that more than one table decides (for example a model and a level), each row of each table counts as a rule that the input can trigger. The rule stays text: which rules an input triggers needs a read of the agent text.

## Detection signature

Each reader of one host gives the same act that the grade refuses, and its answer cites another rule of the files that it read.

## Rule

Applies when a reading check adds a case for one new or changed sentence of agent text, also when a plan or a brief writes that case; a row of each table that decides a value of the expected act counts as a rule. Action: before the grade is fixed, list each rule of the files that the reader reads that the sample input can trigger, and choose an input that only the rule under test covers; when an input must trigger two rules, write the expected act for each rule and their order. Check: the case file names, for each case and for each value of its expected act, the rules that its input triggers, and a control without the sentence under test, or without the second trigger, changes only the act that it covers.

## Related lessons

[[check-refusal-contract-across-earlier-guards]]
[[check-every-message-class-of-a-prose-request-gate]]
