---
{
  "schema": 1,
  "name": "find-the-scroll-anchor-before-a-fix-of-a-scroll-that-a-redraw-moves",
  "description": "Two fixes of a board scroll that a poll moved failed: overflow-anchor none broke a tail collapse, and a kept scrollTop cut a smooth scroll and missed the Pipeline columns",
  "tags": [
    "ui",
    "refix",
    "regression"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "Verify fix task verify-2 of #346 (Operations screen on React) and its task review, implement session on Claude Code, 2026-11-22",
  "incidents": [
    {
      "id": "346-verify-2-scroll",
      "date": "2026-11-22",
      "action": "verify-2 of #346 fixed the board scroll that changed after a poll rescued a moved focused card: first 2d43e8a set overflow-anchor: none on the Agents board, then 6dfb5a6 replaced it with useKeptScroll, a layout effect that writes the saved scrollTop of #tp-board after each new board render",
      "expected": "A poll keeps the scroll of the board and of each column as the base does, and an intended scroll (a smooth scroll of the tail button, a scrollIntoView) completes",
      "observed": "2d43e8a: the card jumped 66px (311 to 245 at 375) when the Needs-you tail collapsed, where anchoring keeps it still on the base. 6dfb5a6: a read 80 ms into the smooth scroll of the tail button stopped it short (375x812 final scrollTop base 269, lane 245; 1440x500 base 173, lane 121), and a Pipeline column at 375x812 still went 236 to 0 on a poll (base 236 to 236; overflow-anchor: none on .col-body gives 236)",
      "source": {
        "kind": "tool-output",
        "excerpt": "tail click, poll at 80 ms: base 269 / lane 245 (375x812), base 173 / lane 121 (1440x500); Pipeline Plan column scrollTop base 236->236, lane 236->0 in 6 of 6 runs; control overflow-anchor:none 236->236",
        "reference": "https://github.com/ddinkov10/celetis/issues/346"
      },
      "inference": "Inferred: the base redraw replaced the nodes and restored each column scrollTop by hand, so Chrome scroll anchoring had no kept anchor; the React screen keeps the nodes, so the anchor can be the moved card. Each fix changed one scroller and one symptom without listing every scroller that a read can move and every intended scroll that the fix must not cut. Uncertain: which anchor node Chrome picks in each case.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "0582343"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "e5f5b38e-951d-44ea-9586-d6c55f013e29",
      "requestDigest": "ddbaf0e88b49fcafbc2cff15e110736fa743bf8451e9f5ded9163e8f869bb982",
      "date": "2026-11-22",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #365; claude child opus/high\n\nApprove (the reviewer rules): the proposal has observed tool-output evidence of two failed repairs of one scroll in #346 (2d43e8a: a 66px card jump at a tail collapse; 6dfb5a6: a smooth scroll cut short, base 269 / lane 245 at 375x812, and a Pipeline column 236 to 0 in 6 of 6 runs, with an overflow-anchor control that keeps 236); the commits exist with these subjects. The rule states applicability, action, and check, and the body keeps the inferred cause and its uncertainty apart from the facts. It widens no permission, weakens no check or gate, and adds no network or credential act; its check agrees with test-behavior-not-implementation and with the Chromium checks at desktop width and at 375x812 of AGENTS.md. No live or historical lesson holds its incident or states its rule: keep-the-focus-of-a-list-that-a-polled-redraw-rebuilds covers focus, and name-a-cause-only-from-two-probes-that-differ-in-that-one-factor covers cause naming; both are compatible and linked.",
      "related": [
        "find-the-scroll-anchor-before-a-fix-of-a-scroll-that-a-redraw-moves"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up: the rule depends on the layout and the browser behavior, so it stays text, as its Fix section explains."
      }
    }
  ]
}
---
# Find the scroll anchor before a fix of a scroll that a redraw moves

## What happened

In verify-2 of #346, a poll that rescued a moved focused card changed the scroll of the Agents board `#tp-board` (base 851 to 851, lane 851 to 947). The first fix set `overflow-anchor: none` on the board; it made a card jump 66px when the Needs-you tail collapsed. The second fix, `useKeptScroll`, wrote the saved `scrollTop` after each new board render; it cut a smooth scroll of the tail button that a read interrupted (base 269, lane 245 at 375x812), and a Pipeline column still went from 236 to 0 on a poll, which `overflow-anchor: none` on `.col-body` prevents.

## Root cause

Inferred: the base redraw replaced the nodes and restored each column `scrollTop` by hand, so Chrome scroll anchoring found no kept anchor. The React screen keeps the nodes, so the browser can anchor on a card that the read moved. Each fix treated one scroller and one symptom. Uncertain: which anchor node Chrome picks in each case.

## Fix

Proposed: before a fix of a scroll that a redraw moves, list every scroller that the read can change, find the anchor node that the browser picks in each case, and list each intended scroll that the fix must not cut. This depends on reading the layout and the browser behavior, so the rule stays text.

## Rule

Applies when a change fixes a scroll position that a redraw or a poll moves in a browser page. Action: list each scroller that the redraw can change, record the anchor node of each (for example by toggling `overflow-anchor` on candidate nodes in two probes that differ in that one factor), and list each intended scroll (a smooth scroll, a `scrollIntoView`, a user scroll) in flight during a redraw. Fix at the anchor, not by writing `scrollTop` after the commit. Check: a probe moves each listed scroller by a read and runs each intended scroll with a read in flight, on the base and the head, and each final position equals the base.

## Related lessons

- [[name-a-cause-only-from-two-probes-that-differ-in-that-one-factor]]
- [[keep-the-focus-of-a-list-that-a-polled-redraw-rebuilds]]
