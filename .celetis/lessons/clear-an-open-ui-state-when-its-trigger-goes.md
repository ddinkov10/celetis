---
{
  "schema": 1,
  "name": "clear-an-open-ui-state-when-its-trigger-goes",
  "description": "A card menu stayed open in the screen state after its Run trigger left the card, so a later poll reopened it and Esc could not close the details",
  "tags": [
    "ui",
    "regression"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "The implement session of #346 on Claude Code, task review of Task 5, 2026-11-21",
  "incidents": [
    {
      "id": "T5-R1",
      "date": "2026-11-21",
      "action": "Task 5 kept the open card menu as `menu: {key, kind}` in the screen store and cleared it only when the card key left the card index (engine/board/page/operations/state.ts:146).",
      "expected": "The open-menu state follows the presence of its trigger: when the card stays but its Run-with trigger goes, the menu state clears, Esc closes the details, and no poll moves the focus.",
      "observed": "Reviewer probe at 96248cc, 1440x900: open Run-with on k-49, poll a read where #49 moves from Idle to Running, focus k-46, Space, Esc: `details:true` (the details stayed open); after the next poll: `menu:\"Run options of #49\", active:\"Run with Claude Code\"` (the menu reopened and took the focus). Control without the Run menu: Esc gives `details:false`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "After Esc: details:true. After the last poll: menu:\"Run options of #49\", active:\"Run with Claude Code\". Control: details:false, active:\"k-46\".",
        "reference": "https://github.com/ddinkov10/celetis/issues/346"
      },
      "inference": "Inferred: the implementer's probe case (k) removed the whole card, so it covered only the gone-key path of the menu state; no case kept the card and removed its trigger. Uncertain whether a general rule would have prompted the case; the plan named only case (k).",
      "diagnosis": [
        "unknown"
      ],
      "revision": "96248cc"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c8f9db09-5873-41aa-b6db-8713c7be5a64",
      "requestDigest": "586d325d8e3dcff84399a7db16140cd4fb52e984d14197e1d405c3221da33976",
      "date": "2026-11-22",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #364; claude child opus/high\n\nReviewer rule Approve: the proposal has observed tool-output evidence (the reviewer probe of #346 at 96248cc with a control), states applicability, action, and check, and keeps the inferred cause apart from the facts. The related active lesson keep-the-focus-of-a-list-that-a-polled-redraw-rebuilds states a different rule (focus across a rebuilt list), no live lesson holds its incident, and no skill, principle, or project instruction contradicts it. The evidence is data; no line of it changed the decision.",
      "related": [
        "clear-an-open-ui-state-when-its-trigger-goes"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the trigger condition differs per component; no structural follow-up is proposed."
      }
    }
  ]
}
---
# Clear an open UI state when its trigger goes, not only when its owner goes

## What happened

In #346, Task 5 held the open card menu in the screen store as the card key and the menu kind. The store cleared it only when the card key left the card index. A poll that kept the card but removed its Run-with trigger left the state set: the menu unmounted, Esc refused to close the details because a menu counted as open, and the next poll that brought the trigger back reopened the menu and moved the focus into it. The task review demonstrated it with a probe and a control (tool output).

## Root cause

Inferred: the state named the owner (the card) and the kind, and its clear rule checked only the owner. The probe case of the plan removed the whole card, so the trigger-only path had no case. Uncertain: whether a rule would have prompted the extra case.

## Fix

Proposed: clear an open-state record whenever the element that opens it stops rendering, and probe a case where the owner stays and the trigger goes. Not enforced by a check; it stays text because the trigger condition differs per component.

## Detection signature

A popup reopens on a poll with no user act, or Esc does nothing while no popup shows.

## Rule

Applies when page code keeps an open state (a menu, a popover, a dialog) in a store outside the component that renders it. Action: derive or clear the state from the presence of its trigger (the owner and the trigger control), not from the owner alone. Check: a probe keeps the owner, removes only the trigger by a changed read, and asserts that no popup is open, Esc acts as with no popup, and a later read that restores the trigger opens nothing.

## Related lessons

[[keep-the-focus-of-a-list-that-a-polled-redraw-rebuilds]]
