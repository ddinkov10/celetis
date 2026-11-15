---
{
  "schema": 1,
  "name": "scan-the-changed-ui-state-not-a-fresh-load",
  "description": "A Verify detect scan by URL loaded the board fresh with the changed panel closed, so its exit 0 said nothing about the change; a --cdp scan of the open panel found a tiny-text finding",
  "tags": [
    "ui",
    "e2e",
    "false-negative"
  ],
  "date": "2026-11-15",
  "status": "active",
  "source": "The implement session of #326 on Claude Code, Verify phase V4, 2026-11-15",
  "incidents": [
    {
      "id": "6f962ed0-0338-45ae-9ddb-c105e1f6a4ee",
      "date": "2026-11-15",
      "action": "The plan's V4 named `impeccable detect --json --viewport <W>x<H> <url>` \"on the board of the lane daemon with the panel open\", and the Verify run accepted the URL scan's exit 0 as V4 PASS.",
      "expected": "A scan that judges a changed UI state scans the page in that state (here the coordinator panel open, in turn-ended and dialog), for example through `detect --cdp` on a browser that shows the state.",
      "observed": "The board keeps no open state of the coordinator panel, so the URL scan loaded the board with the panel closed (exit 0, []). A `detect --cdp 9333` scan of a Chromium that showed the open panel gave exit 2 in the dialog state at both sizes: tiny-text \"11.5px body text\" on `p.co-ask-head > span.co-sum`; it took the fix task verify-1.",
      "source": {
        "kind": "tool-output",
        "excerpt": "desktop 1440x900, state dialog, panel open, li = 28: exit 2. JSON: tiny-text (warning): \"11.5px body text\" on `p.co-ask-head > span.co-sum`. phone 375x812, state dialog: exit 2, the same finding. URL form (panel closed): exit 0.",
        "reference": "https://github.com/ddinkov10/celetis/issues/326 (Runtime verification for #326, V4 rounds 2 to 4)"
      },
      "inference": "Tool output plus inference: a URL scan loads its own fresh page, so it reaches only the default state; the plan's oracle assumed that the scan sees the state the tester prepared. Uncertain: whether the earlier design review of Task 8 scanned the open panel by URL.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "5b770ecdd289285ebd98e66a02ab19503d3a7be0"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "7bd20161-1df2-4a4c-b623-8b4fb40fb002",
      "requestDigest": "75b818e8488683bb2558f79a747f87981ea29b48b8abbb5e316973569077ec59",
      "date": "2026-11-15",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #326; claude child opus/high\n\nEdit (reviewer rule: approve, edit first when the text needs a correction). The evidence is observed tool output: a URL scan with the panel closed gave exit 0, and a --cdp scan of the open panel gave exit 2 with a tiny-text finding that took a fix task. No active or historical lesson holds this incident or this rule; check-visible-surfaces-before-composing-browser-probes covers the surfaces of a probe, not the page that a scanner reaches. The rule states applicability, action, and check, and adds no permission, network act, or credential act. The edit keeps each scan that the project procedure names (\"The detect scenario\" of the design procedure of the plugin runs detect by URL), so that the lesson adds the scan of the changed state and replaces no part of that procedure.",
      "related": [
        "scan-the-changed-ui-state-not-a-fresh-load"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up, not authorized here: \"The detect scenario\" of the design procedure of the plugin could name `detect --cdp <port>` for a changed state that no URL reaches."
      }
    }
  ]
}
---
# Scan the changed UI state, not a fresh load of the page

## What happened

The plan of #326 named a V4 `detect` scan by URL "with the panel open". The board keeps no open state of the coordinator panel, so the URL scan loaded the board with the panel closed and gave exit 0. A `detect --cdp` scan of a Chromium that showed the open panel gave exit 2 in the dialog state at both sizes (tiny-text on the summary of the dialog card), which took a fix task.

## Root cause

Inference: `detect <url>` loads its own fresh page; a state that a person reaches by acts (an open panel, a dialog) is not in that page. The plan's oracle assumed the prepared state. Uncertain whether other URL scans of earlier changes missed states the same way.

## Fix

Proposed prevention (text): a plan or a Verify run that scans a changed UI state names how the scan reaches it: a URL that opens it, or `detect --cdp <port>` on a browser that shows it, with the element count or a screenshot of the state taken before the scan. A structural follow-up needs separate authorization: the design procedure's detect scenario could name `--cdp` for a state that no URL reaches.

## Detection signature

A scan by URL passes while the changed element is not in the default state of the page.

## Rule

Applies when a check runs a page scanner (for example `impeccable detect`) to judge a UI state that a fresh load of the URL does not show. Action: keep each scan that the project procedure names, and also scan the page in that state: bring a browser to that state and scan the shown page (for example `detect --cdp <port>`), or use a URL that opens the state; record the state evidence (a screenshot or an element count) before each scan. Check: the evidence of each scan shows the changed element present in the scanned page; a URL scan whose page lacks the changed element is no evidence for that state.

## Related lessons

[[check-visible-surfaces-before-composing-browser-probes]]
