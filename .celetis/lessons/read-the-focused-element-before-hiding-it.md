---
{
  "schema": 1,
  "name": "read-the-focused-element-before-hiding-it",
  "description": "A focus fix of the #250 update dialog read document.activeElement after it hid the focused button, so Chromium had already moved the focus to the body",
  "tags": [
    "ui",
    "test"
  ],
  "date": "2026-11-07",
  "status": "active",
  "source": "Task 3 of ddinkov10/celetis#250, implement step session (child report to the coordinator)",
  "incidents": [
    {
      "id": "22ec06a2-cfac-44c4-9836-717f0d2ee3b2",
      "date": "2026-11-07",
      "action": "In draw() of engine/board/update-dialog.ts (commit c4f39bc of the Task 3 work) the implementer added `if ((start.hidden && document.activeElement === start) || ...) title.focus();` after the lines that set `hidden` on the buttons.",
      "expected": "After a press of Restart hides the button, the focus is on the dialog title, so Escape still reaches the dialog.",
      "observed": "The browser probe failed: `check (k) restarting: restarting@desktop: the focus stays in the dialog (the title) after the press, so Escape still reaches the dialog: FAIL \"BODY\"`, and the same for restart-refused. A scratch probe in the same Chromium gave [\"in-click:b\",\"after-hide:BODY\",\"after-focus:BODY\",\"later:BODY\"]: the active element is the body at once after `hidden = true`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "browser/browser.out: check (k) restarting: restarting@desktop: the focus stays in the dialog (the title) after the press ...: FAIL \"BODY\"; scratch probe: [\"in-click:b\",\"after-hide:BODY\",\"after-focus:BODY\",\"later:BODY\"]",
        "reference": "docs/superpowers/verification/250-t3/ of the lane feat/250-host-the-board-server-the; Task 3 report in the runtime report of #250"
      },
      "inference": "Reported by the child: it assumed that the focus fix-up of the browser runs at the next rendering update, but Chromium moves the focus synchronously when the focused element is hidden. Not checked in other browsers.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "a1b64be"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "f4ea13b6-5a9c-46ad-929a-285382011737",
      "requestDigest": "c7efd7f3c28ab3fc387e88416a3dadd267fc47a1102e2c6accb009c99d30e47f",
      "date": "2026-11-07",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #250; claude child opus/high\n\nApprove under the reviewer rules: the incident is observed. The lane retains docs/superpowers/verification/250-t3/browser/browser.out with \"the focus stays in the dialog (the title) after the press ...: FAIL \\\"BODY\\\"\" for restarting and restart-refused, the Task 3 report retains the scratch probe [\"in-click:b\",\"after-hide:BODY\",\"after-focus:BODY\",\"later:BODY\"], and draw() of engine/board/update-dialog.ts in the lane now reads document.activeElement before any change. The rule states applicability, action, and check, with a control variant that must fail. It grants no permission and weakens no check. The text keeps the observed Chromium result apart from the inferred cause of the child, and states that other browsers were not checked. No active or historical lesson states the same rule: check-visible-surfaces-before-composing-browser-probes and read-keyboard-actions-before-driving-a-check cover probe composition and key choice, not the read order of the focus in page code.",
      "related": [
        "read-the-focused-element-before-hiding-it"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the condition depends on the drawing code of each control. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Read the focused element before hiding it

## What happened

In Task 3 of #250 on 2026-11-07, the update dialog of the board hides its Restart button when the maintainer presses it. The implementer added a focus fix to `draw()` of `engine/board/update-dialog.ts`: after the lines that set `hidden`, it moved the focus to the dialog title when `document.activeElement` was the hidden button. The browser probe failed: after the press the focus was on `BODY`, so Escape no longer reached the dialog. A scratch probe in the same Chromium showed that the active element is the body at once after `hidden = true`. The fix read `document.activeElement` at the top of `draw()`, before any change; the final run passed the focus checks.

## Root cause

Observed: Chromium moves the focus away from an element synchronously when the element becomes hidden, so a later read of `document.activeElement` no longer names it. Reported by the child (inference): it assumed that the focus fix-up happens at the next rendering update. Other browsers were not checked.

## Fix

Proposed prevention: when code hides or removes a control and must keep the focus inside its container, capture the focused element before the change and decide the new focus from that capture. No structural check is proposed: the condition depends on the drawing code of each control. Enforcement is not claimed.

## Rule

Applies when page code hides, disables, or removes an element that can hold the focus and then moves the focus. Action: read `document.activeElement` before the change and decide the new focus from that value. Check: a browser probe presses that control and asserts the focus target right after the press, and a variant that reads the focus after the change fails the same check.

## Related lessons

[[check-visible-surfaces-before-composing-browser-probes]]
