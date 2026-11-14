---
{
  "schema": 1,
  "name": "measure-the-painted-box-of-a-moved-decoration-against-its-container",
  "description": "A hover fan lifted ringed icon discs out of the pill while the probe checked only ring color and transform",
  "tags": [
    "ui",
    "test",
    "false-negative"
  ],
  "date": "2026-11-14",
  "status": "active",
  "source": "The implement session of #321 on Claude Code, task review of Task 3 (the agent order pill), 2026-11-14",
  "incidents": [
    {
      "id": "7a1a8892-1906-4edc-b803-b855f29a0150",
      "date": "2026-11-14",
      "action": "Task 3 sized the agent order pill to 24px with 18px icon discs and a 2px box-shadow ring, kept the hover/focus fan rules with translateY(-2px), and accepted the change on probe cases that read the ring color, the transform, and the rest-state box of each disc.",
      "expected": "The stack fits the pill on hover, on keyboard focus, and while open: the ring stays inside the pill's inner box (Intended behavior 6 and Required behavior 'A status bar control stays inside the bar height' of the #321 root cause).",
      "observed": "On hover the lifted ring covered the top hairline of the pill and stood about 1px above it; the task probe passed with 0 failed rows.",
      "source": {
        "kind": "tool-output",
        "excerpt": "light theme, 1440x900, hover .ap-trigger: pill 871.5-895.5, icon 871.6-891.4, transform matrix(.99,-.10,.10,.99,0,-2); zoomed screenshot shows ring bumps that break the top hairline above both icons. Probe pill-hover/pill-ring did not catch it (they check ring color and transform, not overlap with the border).",
        "reference": "https://github.com/ddinkov10/celetis/issues/321"
      },
      "inference": "Inferred: the probe measured getBoundingClientRect of the disc, which excludes the box-shadow ring, and measured containment only at rest; the fan transform moved the painted ring outward in states the containment row did not read. Alternative: the plan's case list named containment only for pill-rest, so the implementer followed the plan's case list exactly.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "e51fd2f"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "7db7d469-d19d-448f-941a-e1762c4c64db",
      "requestDigest": "f598190030a85e00bd46842d038969a127e0e15a8ef14a1f6e5836a382c66a39",
      "date": "2026-11-14",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #323; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence (the hover measures of the pill and the lifted disc at 1440x900, and a zoomed screenshot, while the task probe passed); its rule states applicability, action, and check; it widens no permission and skips no check, but adds a measure; it agrees with the principle test-behavior-not-implementation of the plugin celetis and with ui.md; no live or historical lesson holds its incident or states its rule (check-visible-surfaces-before-composing-browser-probes and measure-a-new-size-rule-at-the-phone-width cover visibility and the phone width, not the painted extent of a moved decoration). The body labels the cause as inferred, not proven.",
      "related": [
        "measure-the-painted-box-of-a-moved-decoration-against-its-container"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The painted extent depends on the CSS of each element, so no structural check covers the rule; it stays text, as its Fix says."
      }
    }
  ]
}
---
# Measure the painted box of a moved decoration against its container

## What happened

In #321, Task 3 made the agent order pill 24px high with 18px icon discs and a 2px `box-shadow` ring. The hover and focus fan kept `translateY(-2px)`. The task probe read the ring color, the `transform`, and the disc box at rest, and passed. The task review hovered the pill in the light theme at 1440x900 and read the pill at 871.5-895.5 and the lifted disc at 871.6-891.4; with the 2px ring the painted circle covered the top hairline and stood about 1px above the pill. A zoomed screenshot showed the notches.

## Root cause

Inferred, not proven: `getBoundingClientRect()` excludes a `box-shadow` ring, and the containment row ran only in the rest state, so neither the ring nor the moved states were measured against the container. The plan's case list also named containment only for the rest state.

## Fix

Proposed prevention (text only, a judgment check): when a check asserts that a decorated element fits a container, measure its painted extent (the box plus a ring, outline, or shadow spread) against the container's inner box in each state that moves it (hover, focus, open, transition end). No structural enforcement exists; the painted extent depends on the CSS of each element, so the rule stays text.

## Rule

Applies when a check asserts that an element with a ring, outline, or shadow spread fits inside a container, and a state (hover, focus, open) transforms or resizes it. Action: compute the painted extent (the bounding box expanded by the ring, outline, or spread width) and compare it with the container's inner box (minus its border) in each such state, not only at rest. Check: the case output lists the painted extent and the inner box for each state, and a control with the decoration moved 1px outside makes the row fail.

## Related lessons

[[measure-a-new-size-rule-at-the-phone-width]]
[[check-visible-surfaces-before-composing-browser-probes]]
