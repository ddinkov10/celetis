---
{
  "schema": 1,
  "name": "measure-the-close-order-when-a-library-dialog-replaces-a-native-one",
  "description": "Two fixes of the focus after a dialog close failed, because the native close returns the focus at once and the library close finishes later",
  "tags": [
    "ui",
    "regression",
    "refix"
  ],
  "date": "2026-11-24",
  "status": "active",
  "source": "Issue #347, implement session, final review and fix task verify-1",
  "incidents": [
    {
      "id": "82f5b8cb-07dc-4328-b478-211ed89eb418",
      "date": "2026-11-24",
      "action": "The build moved the palette and the shortcuts dialog from native dialog elements to Base UI. Fix ab59041 returned the focus to a prior container only for a direct Esc. Fix 89e731e returned the focus when the close completed, with no check of a later press.",
      "expected": "The focus after each close path, act, and press equals the old page, where the native close returns the focus before the act and before any later input.",
      "observed": "After ab59041, Go to Control from #tab-agents ended on BODY (old page: work). After 89e731e, Esc and a press on #tab-pipeline 1 ms later ended on tab-agents in 7 of 8 runs (old page: tab-pipeline in 8 of 8). 25ac04c, which returns the focus when open turns false and lets a press through the closing layers, matched the old page.",
      "source": {
        "kind": "tool-output",
        "excerpt": "tip: { escLag1: { tab-agents: 7, tab-pipeline: 1 } }, base: { escLag1: { tab-pipeline: 8 } }",
        "reference": "https://github.com/ddinkov10/celetis/issues/347"
      },
      "inference": "Each fix treated one close path and did not first measure the order of close, focus return, act, and input on the old page. A library close spans frames, so an order that the native element gave for free became a set of separate cases.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "25ac04c"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "5d3184ed-3f08-4e4e-a5b7-25f1d634adf1",
      "requestDigest": "ea4c1f76cb558f071639e5a779366cda979065cdfc945909abb06392ce220375",
      "date": "2026-11-24",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #347; claude child opus/high\n\nEdit (reviewer rules: approve, edit first when the text needs a correction). The incident holds observed tool output: after 89e731e, Esc and a press 1 ms later ended on tab-agents in 7 of 8 runs, where the old page ended on tab-pipeline in 8 of 8, and 25ac04c matched the old page. No live or historical lesson holds its incident or states its rule: read-the-focused-element-before-hiding-it covers the read of the focus before a hide, and find-the-scroll-anchor-before-a-fix-of-a-scroll-that-a-redraw-moves covers a scroll. The rule states applicability, action, and check, and adds no permission, network act, or credential act. The edit adds the exception for a difference that the spec or a maintainer decision accepts, because ADR-0136 of this repository records accepted differences of the same move, so an unconditional \"keep that order\" could contradict a recorded decision. It also names the store of ADR-0029. The incident and the inferred cause stay unchanged.",
      "related": [
        "measure-the-close-order-when-a-library-dialog-replaces-a-native-one"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text with a probe of the lane; this review changes lesson data only."
      }
    }
  ]
}
---
# Measure the close order when a library dialog replaces a native one

## What happened

On #347, the palette and the shortcuts dialog moved from a native `dialog` to Base UI. The final review found that Esc left the focus on the wrong control. The first fix covered only a direct Esc, so a palette act that changed the area ended on `body`. The second fix returned the focus when the close completed, so a press during the close lost its focus. The third change returned the focus when `open` turned false and let a press through the closing layers. It matched the old page in each measured row.

## Root cause

Inferred: the native close returns the focus synchronously, before the act and before the next input. Base UI completes the close over later frames. The two first fixes each repaired one path without a measured order of all paths. Other causes were not excluded.

## Fix

Proposed prevention: measure the order on the old page first, and keep that order in the view, except a difference that the spec or a maintainer decision accepts. A tracked check cannot hold this, because the Celetis repository keeps no tests (its ADR-0029), so the rule stays text with a probe of the lane.

## Detection signature

The focus ends on `body`, on the first tabbable child of a container, or on the prior control after a press during the close.

## Rule

Applies when a change replaces a native dialog, popover, or other element with built-in focus behavior by a library component. Action: before the first fix, measure on the old page the order of the close, the focus return, the act, and a key or press in the next frame, and keep that order, except a difference that the spec or a maintainer decision accepts. Check: a probe runs each close path and act kind, with a key and a press started together at 0 and 1 ms, and the final focus equals the old page in each run, or the run shows a recorded accepted difference.

## Related lessons

[[read-the-focused-element-before-hiding-it]]
[[keep-each-effect-of-a-removed-helper-call]]
