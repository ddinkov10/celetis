---
{
  "schema": 1,
  "name": "move-code-by-byte-copy-and-compare-each-moved-body",
  "description": "A hand copy of a moved History link regex dropped one escape; a byte copy and a substring check of each moved body caught and replaced it",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Task 2 of ddinkov10/celetis#269 (implement step, subagent flow), implementer report",
  "incidents": [
    {
      "id": "c60d27ab-5378-4731-b559-9ef18f574201",
      "date": "2026-11-09",
      "action": "The Task 2 implementer moved the History read of engine/board/history.ts into engine/lib/board-read.ts by a manual copy of the code.",
      "expected": "The plan says to move the code of the read port unchanged, so each moved body keeps each byte of its source, including the link check regex /[\\u0000-\\u0020\\u007f-\\u009f]/ of the History URL (a trust check of rule 12).",
      "observed": "The first manual copy dropped the escape \\u0020 from the link regex. The implementer found it before the commit, replaced the History block with a programmatic byte copy of history.ts, and confirmed each moved body of data.ts and history.ts with a substring check.",
      "source": {
        "kind": "tool-output",
        "excerpt": "8. An error that I corrected. My first manual copy of the History `link` regex dropped the escape `\\u0020`. I replaced the History block with a programmatic byte copy of `history.ts`. A substring check then confirmed each moved body of `data.ts` and `history.ts`.",
        "reference": "https://github.com/ddinkov10/celetis/issues/269"
      },
      "inference": "Inferred: a manual retype of a long body with escape sequences can drop or change characters without a visible error, and the gate (Biome, tsc) accepts the changed regex. Uncertain: the drop can also come from an escape transform of the editing tool. Without the substring check, the request matrix would catch it only for a row that sends a URL with a space.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "099d35e"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "4cd778a4-9fd4-4441-951c-e36db98a3163",
      "requestDigest": "f596605d78551c8c30e270b158fb85618e8cc4c4b522bf62ce05231cb18cd082",
      "date": "2026-11-09",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #264; claude child opus/high\n\nApprove: the proposal has observed tool-output evidence (the implementer report of the dropped escape and its byte-copy repair), a substantive mistake in a trust check that the gate accepts, and a rule that states applicability, action, and check. No rule rejects it: its probe is a temporary check, not a tracked test, so it agrees with AGENTS.md and ADR-0029; it widens no permission and weakens no check. Its text labels the cause as inferred, with diagnosis unknown and an alternative cause. No live or historical lesson holds its incident or states the same rule: a-moved-check-keeps-the-states-of-its-old-rule and keep-byte-preserving-transformations-reversible govern other rules.",
      "related": [
        "move-code-by-byte-copy-and-compare-each-moved-body"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal proposes no structural check: the project keeps no tracked tests (ADR-0029), and a move has no fixed shape that a gate check can name."
      }
    }
  ]
}
---
# Move code by a byte copy, and compare each moved body with its source

## What happened

Task 2 of #269 moved the History read of `engine/board/history.ts` into `engine/lib/board-read.ts`. The plan said to move the code unchanged. The implementer's first manual copy dropped the escape `\u0020` from the link check regex `/[\u0000-\u0020\u007f-\u009f]/`, a trust check of the History URL. The implementer found the difference before the commit, replaced the block with a programmatic byte copy of `history.ts`, and confirmed each moved body of `data.ts` and `history.ts` with a substring check. The verify gate accepts the changed regex too, so only a comparison with the source catches it.

## Root cause

Inferred: a manual retype of a long body with escape sequences can drop or change characters without a visible error. Uncertain: an escape transform of the editing tool is an alternative cause. The request matrix of the task covers the regex only for a row that sends such a URL.

## Fix

Proposed prevention, not proven enforcement: move each body with a programmatic copy from the source revision, keep the wiring edits separate, and compare each moved body with its source as a substring before the commit. The rule stays text, because the project keeps no tracked tests (ADR-0029) and a move has no fixed shape that a gate check can name.

## Detection signature

A moved function, regex, or literal that differs from its source revision in one character, with a passing gate.

## Rule

Applies when a change moves code between files with no behavior change (a move, a split, an extraction). Action: copy each moved body from the source revision with a program (for example a script that slices the source file), not by retyping, and make the wiring edits (imports, names, parameters) as separate, listed edits. Check: before the commit, a probe finds each moved body of the source revision as a substring of its new file, after only the listed wiring edits, and the probe fails on a copy with one changed byte.

## Related lessons

- [[a-moved-check-keeps-the-states-of-its-old-rule]]
