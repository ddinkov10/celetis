---
{
  "schema": 1,
  "name": "keep-the-focus-of-a-list-that-a-polled-redraw-rebuilds",
  "description": "The new Home lists of the board were rebuilt with replaceChildren at each polled redraw, so a keyboard user on an Open button lost the focus to body, while the board columns keep it through markFocus",
  "tags": [
    "ui",
    "regression"
  ],
  "date": "2026-11-18",
  "status": "active",
  "source": "The implement session of #332 on Claude Code, task review of Task 5, 2026-11-18",
  "incidents": [
    {
      "id": "e5970c24-1682-4346-bead-a4b703278ccf",
      "date": "2026-11-18",
      "action": "Task 5 of #332 drew #home-needs-list and #home-agents-list in drawHome (engine/board/page/home.ts) with replaceChildren on each redraw of the polled board read; the page already keeps the focus of #columns and the human pills across a redraw with markFocus (engine/board/page/board.ts).",
      "expected": "A focused control of a list that a polled redraw rebuilds keeps the focus on the same row (by its key) after the redraw, as the existing lists of the page do.",
      "observed": "The fix probe home-focus.ts: Tab to the Open of row 2 (and to Agents now rows), append one sample so only `trends` changes, wait for the redraw: on a32375c 3 of 13 checks failed with the focus on body; on 494a718 0 failed, each case with a seen redraw.",
      "source": {
        "kind": "tool-output",
        "excerpt": "RED on a32375c: 13 checks, 3 failed (Open of row 2, Agents now row 2, Agents now row 1: focus went to body). GREEN on 494a718: 13 checks, 0 failed, redraw seen in each case.",
        "reference": "https://github.com/ddinkov10/celetis/issues/332"
      },
      "inference": "Inferred: the brief carried the lesson read-the-focused-element-before-hiding-it, whose Applies-when names page code that hides an element and then moves the focus; a rebuild that moves no focus fell outside it. Alternative: the implementer did not compare the new lists with the redraw pattern of the page.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "a32375c",
      "brief": "Task 5 of the plan of #332: drawHome draws #home-needs-list and #home-agents-list; lesson rules include read-the-focused-element-before-hiding-it.",
      "lesson": {
        "name": "read-the-focused-element-before-hiding-it",
        "revision": "ba0de65",
        "digest": "eded6e783a2bd69505db82cc0aab27b44799605ec3ae0e25ab5baee5ded1b798"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "4b35c9de-b21d-4698-8ce3-d19b5b0ecc2e",
      "requestDigest": "00e40c1659ad7ad1f8f4cf2793e108c56705c0aa2b9e9beaadd7599d34e092b1",
      "date": "2026-11-19",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #332; claude child opus/high\n\nApprove (reviewer rules: no rule rejects, merges, replaces, or skips it). The proposal has observed tool-output evidence: the probe home-focus.ts failed 3 of 13 checks with the focus on body on a32375c and passed 13 of 13 on 494a718, with a seen redraw in each case. The cause is labeled as inferred, with an alternative. The rule states applicability (page code that rebuilds a list or region of focusable controls on each redraw of a polled read or another repeated update), action, and check; it widens no permission and weakens no check, and its browser probe agrees with the Chromium check of AGENTS.md. The examined lesson read-the-focused-element-before-hiding-it applies when page code hides or removes an element and then moves the focus; this rule applies to a rebuild that moves no focus, and asks to restore the focus by the row key. The two rules are compatible and different, so no merge or supersede: both stay active. No live or historical lesson holds its incident.",
      "related": [
        "keep-the-focus-of-a-list-that-a-polled-redraw-rebuilds"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal proposes no structural check: the redraw paths of a page differ, so the rule stays text."
      }
    }
  ]
}
---
# Keep the focus of a list that a polled redraw rebuilds

## What happened

In #332, Task 5 added the Home lists of the board. `drawHome` rebuilt each list with `replaceChildren` at every redraw of the polled board read. The page already keeps the focus of its columns and pills across a redraw (`markFocus` of `engine/board/page/board.ts`). The controller found the gap by code reading after a clean task review; a probe then showed the focus on `body` after a redraw that changed only `trends` (3 of 13 checks failed on a32375c, 0 on the fix 494a718).

## Root cause

Inferred: the lesson in the brief covers code that hides an element and then moves the focus. A rebuild that moves no focus was outside its Applies-when, and no probe drove a redraw while a list control held the focus.

## Fix

The fix of #332 reads the focused row (list, key, index) before the rebuild and restores the focus to the same row, else a neighbour. Proposed structural follow-up, not authorized here: none; the redraw paths of a page differ, so the rule stays text.

## Rule

Applies when page code rebuilds a list or a region that holds focusable controls on each redraw of a polled read or another repeated update. Action: before the rebuild, read `document.activeElement`, and record the row key and the control; after the rebuild, focus the same control of the same row, else a neighbour; follow the existing focus-keeping pattern of the page when one exists. Check: a browser probe reaches the control by Tab, changes only one field of the polled read, observes the redraw (for example with a MutationObserver), and asserts the focused control after it; the same probe fails on the code before the fix.

## Related lessons

[[read-the-focused-element-before-hiding-it]]
