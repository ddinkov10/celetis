---
{
  "schema": 1,
  "name": "move-code-by-byte-copy-and-compare-each-moved-body",
  "description": "Moved bodies differed from their source: a hand copy dropped a regex escape, and a substring probe passed a one-byte change of a body used twice and of a short body",
  "tags": [
    "process",
    "regression",
    "test",
    "false-negative",
    "recurring"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of ddinkov10/celetis#289 on Claude Code, task review of Task 2 (the coordinator session), 2026-11-11\n\nTask 2 of ddinkov10/celetis#269 (implement step, subagent flow), implementer report",
  "incidents": [
    {
      "id": "ffe88d6b-ddcb-4c82-8a77-d50c384bbd29",
      "date": "2026-11-11",
      "action": "The implementer of Task 2 of #289 wrote a move probe that tests `file.includes(body)` for each moved body, and showed one control (one changed byte in one body) that failed.",
      "expected": "The probe fails on a copy with one changed byte of any moved body (the Check of the lesson move-code-by-byte-copy-and-compare-each-moved-body, and spec 17.3 of #289).",
      "observed": "The task reviewer changed one byte of the second copy of the body of base line 1101 (lane line 1500) and one byte of the body of base line 1460 in `advancing` (lane line 1534). The probe gave `move: 45 bodies, 0 missing` for each. The coordinator reran both controls with the same result. The body 1101 is used twice, so one intact copy satisfied the probe; the body 1460 with less indentation is a substring of lane line 293.",
      "source": {
        "kind": "tool-output",
        "excerpt": "move: 45 bodies, 0 missing (run of move-probe.ts on review-2/lane-dup-control.ts and on review-2/lane-1460-control.ts, each with one changed byte); after the fix: MISSING 1101-1101: 1 of 2 copies at line bounds; move: 45 bodies, 1 missing",
        "reference": "https://github.com/ddinkov10/celetis/issues/289"
      },
      "inference": "Inferred cause: the rule asks for a substring check and one failing control, and the implementer did both. A substring check does not count copies and does not anchor at line starts. Alternative: the implementer could have derived the uniqueness need from the Check sentence, so the rule can also count as not followed.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "f8c3c22",
      "brief": "Task 2 brief of #289, step 4: \"it applies only the edits of wiring.json for that range to the base slice and finds the result as a substring of the lane file ... Then change one byte of one body in a copy of the lane file and confirm 1 missing.\"",
      "lesson": {
        "name": "move-code-by-byte-copy-and-compare-each-moved-body",
        "revision": "7c504eea828418d07d6a828791d729f8828b7bc4",
        "digest": "5917c50035faedc260a890bd4dbdafb6a9b5930dd6c40bbbc219414b1e1afa73"
      }
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "87d90bcf-7f75-4a9a-b95f-abd7ef86fd7f",
      "requestDigest": "b1405aee198143b160c81040e17b04d36bdbe69d75892b99866e8c9261bf10a4",
      "date": "2026-11-12",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #289; claude child opus/high\n\nMerge (reviewer rule: merge a proposal into an active lesson that states the same rule, and keep every incident). The proposal has observed tool-output evidence: two one-byte controls of the task reviewer gave `move: 45 bodies, 0 missing`, and the fixed probe gave `1 missing`. Its rule governs the same act as the active lesson move-code-by-byte-copy-and-compare-each-moved-body (a probe that proves a code move by finding each moved body in its new file), and it corrects the Check of that lesson, which asked for a substring check. Two active rules on one probe, one with a substring check and one with a count at line bounds, would conflict, so the survivor keeps one Check: a match at line bounds with a count of the uses. The survivor keeps the name of the active lesson and both incidents. The inferred cause and its alternative (not followed) stay labeled as inference. The rule widens no permission, adds no tracked test (ADR-0029 of this project), and agrees with the principle test-behavior-not-implementation.",
      "related": [
        "count-the-copies-of-each-moved-body-at-line-bounds",
        "move-code-by-byte-copy-and-compare-each-moved-body"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A shared move-probe helper that counts the matches of each moved body at line bounds, so that each build does not write its own probe. It needs separate authorization."
      }
    }
  ]
}
---
# Move code by a byte copy, and compare each moved body with its source

## What happened

Task 2 of #269 moved the History read of `engine/board/history.ts` into `engine/lib/board-read.ts`. The plan said to move the code unchanged. The implementer's first manual copy dropped the escape `\u0020` from the link check regex `/[\u0000-\u0020\u007f-\u009f]/`, a trust check of the History URL. The implementer found the difference before the commit, replaced the block with a programmatic byte copy of `history.ts`, and confirmed each moved body of `data.ts` and `history.ts` with a substring check. The verify gate accepts the changed regex too, so only a comparison with the source catches it.

In the build of #289, a move probe checked 45 moved bodies with `file.includes(body)`. Its one control (one changed byte in one body) failed, as required. The task reviewer then changed one byte in two other bodies, and the probe still gave `move: 45 bodies, 0 missing`. One body was used twice in the new file, so the intact copy satisfied the test. One short body, after its indentation change, was a substring of a longer line elsewhere. The fixed probe counts the matches of each body at line bounds and compares the count with the number of uses in the build template; both controls then gave `1 missing`.

## Root cause

Inferred: a manual retype of a long body with escape sequences can drop or change characters without a visible error. Uncertain: an escape transform of the editing tool is an alternative cause. The request matrix of the task covers the regex only for a row that sends such a URL.

Inference for #289: a substring test proves that the text exists somewhere, not that each copy is whole. The Check of this rule asked for a substring check and a probe that fails on one changed byte, and one control cannot show that for each body. Alternative: the Check ("fails on a copy with one changed byte") already implies each body, so the rule can also count as not followed fully.

## Fix

Proposed prevention, not proven enforcement: move each body with a programmatic copy from the source revision, keep the wiring edits separate, and compare each moved body with its source before the commit: match it at line bounds and count its copies (#289), not only find it as a substring. A structural follow-up needs separate authorization: a shared move-probe helper that counts matches at line bounds, so that each build does not write its own probe. The rule stays text, because the project keeps no tracked tests (ADR-0029) and a move has no fixed shape that a gate check can name.

## Detection signature

A moved function, regex, or literal that differs from its source revision in one character, with a passing gate. A move probe that still passes after a one-byte change of a body that the new file uses twice, or of a one-line body.

## Rule

Applies when a change moves code between files with no behavior change (a move, a split, an extraction). Action: copy each moved body from the source revision with a program (for example a script that slices the source file), not by retyping, and make the wiring edits (imports, names, parameters) as separate, listed edits. Check: before the commit, a probe matches each moved body of the source revision in its new file at line bounds (a newline or the file start before it, and a newline or the file end after it), after only the listed wiring edits, counts its matches, and requires the count to equal the number of places that use that body. A substring test alone is not this check. The probe fails on a copy with one changed byte: show it for one body, for one body that is used more than once, and for one one-line body, when the move has such bodies.

## Related lessons

- [[a-moved-check-keeps-the-states-of-its-old-rule]]
