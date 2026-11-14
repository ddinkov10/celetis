---
{
  "schema": 1,
  "name": "measure-a-new-size-rule-at-the-phone-width",
  "description": "A desktop size rule outside a media block outranked the phone rule of the same element by specificity",
  "tags": [
    "ui",
    "regression"
  ],
  "date": "2026-11-14",
  "status": "active",
  "source": "The implement session of #311 on Claude Code, task review of Task 6 (the header chips), 2026-11-13",
  "incidents": [
    {
      "id": "9720ddb4-7d56-46a2-9372-7b44e44b311e",
      "date": "2026-11-13",
      "action": "Task 6 of #311 added `.chip-needs.hot { height: 32px; padding-inline: 12px; font-size: 13.5px }` to engine/board/board.css outside any media block, and its probe asserted only `height === 32` at both sizes.",
      "expected": "At 375x812 the phone rule `.chip` inside `@media (max-width: 719px)` keeps every header chip at the phone size (44px high, 11px text) with no overflow; the 32px hot height applies to the desktop header only.",
      "observed": "The task reviewer measured at 375x812 a hot chip of 32px with 13.5px text beside 44px siblings, and scrollHeight 33 > clientHeight 30 (the label sat on the bottom border). The probe passed because it checked the number, not the phone box.",
      "source": {
        "kind": "tool-output",
        "excerpt": "hot chip h 32, scrollHeight 33 > clientHeight 30; not hot: all four chips 44px (375x812); fix d08bf24 wraps the rule in @media (min-width: 720px): hot 44px, scrollHeight 42 = clientHeight 42",
        "reference": "https://github.com/ddinkov10/celetis/issues/311 (branch feat/311-board-signals-that-mislead-the, commits 5315c31 and d08bf24)"
      },
      "inference": "Two classes (0,2,0) outrank one class (0,1,0) whatever the media block, so a desktop rule written outside a media block wins at the phone width. The probe asserted a fixed value at both sizes, so it could not see the phone layout. Alternative: the plan named only the desktop value, so the implementer had no phone target.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "5315c31"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "6cba1791-b851-4519-b7c8-9bc30438278a",
      "requestDigest": "13b9abb807edbf9a66135ee46ad86759f39c63e36d2b0126a9d48e6128c9dd4d",
      "date": "2026-11-14",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #311; claude child opus/high\n\nApprove under the reviewer rules: the incident is observed (the task reviewer measured a 32px hot chip with scrollHeight 33 > clientHeight 30 at 375x812, and commit d08bf24 of the lane scopes the rule to @media (min-width: 720px)). No active or historical lesson states the rule; check-visible-surfaces-before-composing-browser-probes covers setup visibility, not the specificity of a size rule against a phone rule. The rule states applicability, action, and check, keeps the cause labeled as inference, adds a check, weakens none, and agrees with the project rule to check a UI change at desktop width and at 375x812. Its structural follow-up stays proposed.",
      "related": [
        "measure-a-new-size-rule-at-the-phone-width"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The structural check in the Fix (a gate rule that flags a size property set both by a non-media rule of higher specificity and by a phone media rule) needs separate authorization and an owner; this review changes no gate, skill, or procedure."
      }
    }
  ]
}
---
# Measure a new size rule at the phone width

## What happened

Task 6 of #311 gave the hot `need you` chip a height, a padding, and a font size in a rule outside any media block. The rule has two classes, so it outranked the one-class phone rule of `.chip` inside `@media (max-width: 719px)`. At 375x812 the hot chip was 32px high beside 44px siblings, and its text overflowed by 3px. The probe of the task asserted `height === 32` at both sizes and passed. The task reviewer found it with a box measurement at 375x812.

## Root cause

Inferred: CSS specificity, not the media block, decides which rule wins; a desktop rule with a higher specificity wins at every width. The probe checked one fixed number at both sizes, not the phone layout. Uncertain: the plan gave only the desktop value, so the implementer may not have had a phone target in mind.

## Fix

Proposed prevention, text only: before a size rule (height, padding, font size, width) lands, list the phone rules of the same element, and measure the box and its overflow at the phone width. A structural check (a gate rule that flags a size property that both a non-media rule of higher specificity and a phone media rule set) needs a separate authorization and its owner; it is judgment-dependent (some desktop rules should win), so the rule remains text until such a check exists.

## Detection signature

At the phone width, an element differs in size from its siblings that share the phone rule, or `scrollHeight > clientHeight` on a fixed-height control.

## Rule

Applies when a change adds or changes a size, padding, or font-size rule of a page element that a phone media rule also styles. Action: compare the specificity of the new rule with each phone rule of the same element, scope a desktop-only rule to its own media block, and measure the element at the phone width. Check: the probe at the phone width asserts the box size against the phone rule and `scrollHeight <= clientHeight`, not only the desktop value.

## Related lessons

[[check-visible-surfaces-before-composing-browser-probes]]
