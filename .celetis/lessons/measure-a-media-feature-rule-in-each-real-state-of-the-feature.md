---
{
  "schema": 1,
  "name": "measure-a-media-feature-rule-in-each-real-state-of-the-feature",
  "description": "A phone-width check of a new hover-none rule forced the media state with injected CSS, so the page still overflowed at 375 px in the hover-capable Chromium that the project names",
  "tags": [
    "ui",
    "test",
    "false-negative"
  ],
  "date": "2026-11-14",
  "status": "active",
  "source": "The implement session of #322 on Claude Code, Task 5 task review, 2026-11-14",
  "incidents": [
    {
      "id": "f749e8f2-ad21-4acc-9d2a-e74d775d22d9",
      "date": "2026-11-14",
      "action": "The Task 5 implementer added a rule under (hover: none) and (max-width: 719px) that hid the card head type, and measured the 375 px head with injected CSS that forced the hover-none rules, then reported the head as fitting.",
      "expected": "The 375x812 check measures the head in the media state that the browser really reports (AGENTS.md: Chromium at 375x812), and in an emulated hover-none context, so the page fits in both.",
      "observed": "The task reviewer measured the same commit at 375x812 with matchMedia('(hover: none)').matches === false: head scrollWidth 339 vs clientWidth 295, the More button right edge 379 vs card edge 350, document scrollWidth 386 (the page scrolled sideways).",
      "source": {
        "kind": "tool-output",
        "excerpt": "matchMedia('(hover: none)').matches === false ... head scrollWidth 339 against clientWidth 295 ... More button right edge is 379 against the card right edge 350 ... document.documentElement.scrollWidth is 386",
        "reference": "https://github.com/ddinkov10/celetis/issues/322"
      },
      "inference": "Inferred: the implementer treated a forced media state as the phone state, because the brief rule says to measure at the phone width but does not name the media features that the rule depends on. Alternative: the implementer could not emulate hover-none and chose injection as a stand-in. Uncertain which.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "ab0db724",
      "brief": "The Task 5 brief of the #322 plan carried the lesson measure-a-new-size-rule-at-the-phone-width with its full rule body.",
      "lesson": {
        "name": "measure-a-new-size-rule-at-the-phone-width",
        "revision": "25d5e42bab1c85597fcde55ed9cd8c1c38cd86f4",
        "digest": "a9d258cf6619964bc4f478a556a26b9cd2d8b45d8cca1ad7340952b0c99c9297"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "dce8393b-5392-41dc-ae32-9592d053fe84",
      "requestDigest": "2808ed02c677ad08c38b2fce0122b72f2edfc5700688c0cd69766dcdf4f3303d",
      "date": "2026-11-14",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #322; claude child opus/high\n\nApprove under the reviewer rules: the incident is observed tool output (the task reviewer measured commit ab0db724 at 375x812 with matchMedia((hover: none)).matches false: head scrollWidth 339 > clientWidth 295, document scrollWidth 386). No active or historical lesson holds its incident or states its rule: measure-a-new-size-rule-at-the-phone-width covers the specificity of a size rule against a phone rule, check-visible-surfaces-before-composing-browser-probes covers setup visibility, and measure-the-painted-box-of-a-moved-decoration-against-its-container covers painted extents; none covers the real state of a media feature other than width or forced media state by injected CSS. The rule states applicability, action, and check, keeps the cause labeled as inference with its alternative, adds a check, weakens none, and agrees with the project rule to check a UI change in Chromium at desktop width and at 375x812.",
      "related": [
        "measure-a-media-feature-rule-in-each-real-state-of-the-feature"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The Fix keeps the rule as text: which media features a rule depends on needs judgment for each rule. No structural follow-up is proposed."
      }
    }
  ]
}
---
# Measure a media-feature rule in each real state of the feature

## What happened

In Task 5 of #322 on 2026-11-14, the implementer added a rule under `(hover: none) and (max-width: 719px)` that hid the type of the card head, and measured the head at 375 px with injected CSS that forced the hover-none rules. The report said the head fit. The task reviewer measured the same commit (ab0db724) in Chromium at 375x812, where `matchMedia('(hover: none)').matches` was false: the head `scrollWidth` was 339 against a `clientWidth` of 295, the More button ended at x 379 past the card edge at 350, and the page scrolled sideways (`scrollWidth` 386). The brief carried the lesson `measure-a-new-size-rule-at-the-phone-width`.

## Root cause

Observed: the check measured a forced media state, not the state that the browser of the project check reports. Inferred: the existing rule names the phone width but not the media features (hover, pointer) that a rule can also depend on, so a width-only check passed. Alternative: the implementer could not emulate `hover: none` and used injection as a stand-in. The evidence does not separate the two.

## Fix

Proposed prevention: a check of a rule that depends on a media feature measures the page in each real state of that feature at the phone width, through the browser's own emulation (a context option or media emulation), never through injected CSS. This stays a text rule: which features matter needs judgment for each rule. It changes no instruction.

## Rule

Applies when a change adds or changes a page rule under a media feature other than width (for example `hover`, `pointer`, or `prefers-reduced-motion`). Action: at each size of the project check, measure the affected elements once in the state that the check browser reports and once in each other state of that feature through the browser's own emulation, not through injected CSS. Check: the evidence names `matchMedia(<feature>)` for each run, and each run asserts the box sizes and the page width.

## Related lessons

[[measure-a-new-size-rule-at-the-phone-width]]
