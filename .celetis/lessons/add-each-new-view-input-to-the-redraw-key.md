---
{
  "schema": 1,
  "name": "add-each-new-view-input-to-the-redraw-key",
  "description": "A new board field drove a label, but the page redraw key did not include it, so the label went stale",
  "tags": [
    "ui",
    "regression"
  ],
  "date": "2026-11-14",
  "status": "active",
  "source": "The implement session of #311 on Claude Code, the final whole-branch review, 2026-11-14",
  "incidents": [
    {
      "id": "b16a99ce-371f-4ae5-8861-6baac1fc7c9c",
      "date": "2026-11-14",
      "action": "Task 10 of #311 added `Board.starts` and used it in `detailActions` of engine/board/page/board.ts for the label `Run with <agent>`, but did not add `next.starts` to the key that `render` compares before a redraw.",
      "expected": "When only `starts.<step>` changes (for example the preferred agent reaches a usage limit), the open details name the new agent at the next read.",
      "observed": "The final reviewer, on an isolated copy with only `starts.plan` changed in the routed answer: the button stayed `Run with Codex` after 3 reads at both sizes; a control change of a field in the key updated within 2 reads. After cd33c2d added `next.starts` to the key, the same check passed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "button stayed `Run with Codex` after 3 reads (expected `Run with Claude Code`); after the fix: `Run with Claude Code PASS` at 1440 and 375",
        "reference": "https://github.com/ddinkov10/celetis/issues/311 (commits 250cc58 and cd33c2d)"
      },
      "inference": "The board page skips a redraw when its JSON key is unchanged, so every input of a drawn element must be in the key; the task added a consumer of a new field without the key. The Task 10 probe changed several fields at once, so it could not see a change of `starts` alone. Alternative: the key is a list maintained by hand, and no check ties it to the fields that the draw functions read.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "250cc58"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "7d17eaab-151c-46df-94d1-57ff8218db4f",
      "requestDigest": "70c323f576c8cf2f865f2386cf1fdb064b7f0fad773029f62222fc48cec9d0b9",
      "date": "2026-11-14",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #311; claude child opus/high\n\nApprove under the reviewer rules: the incident is observed (the final reviewer saw the label stay 'Run with Codex' after 3 reads with only starts.plan changed, and commit cd33c2d of the lane adds next.starts to the render key of engine/board/page/board.ts). No active or historical lesson states the rule: check-announcements-without-a-state-change covers feedback that changes without a state transition, and list-every-producer-before-a-consumer-requires-a-new-part covers producers of an input, not the comparison key of a redraw. The rule states applicability, action, and check, keeps the cause labeled as inference, adds a check, and weakens none. Its structural follow-up stays proposed.",
      "related": [
        "add-each-new-view-input-to-the-redraw-key"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The structural follow-up in the Fix (derive the redraw key from the projection that the draw functions read, with a probe that changes each drawn field alone) needs separate authorization; owner: the board of the engine. This review changes no code, skill, or procedure."
      }
    }
  ]
}
---
# Add each new view input to the redraw key

## What happened

Task 10 of #311 added the field `starts` to the board read and used it for the label `Run with <agent>` in the details. The page redraws only when its JSON key changes, and the key did not include `starts`. The final review changed only `starts.plan` and saw the old label after three reads. Adding `next.starts` to the key fixed it.

## Root cause

Inferred: the redraw key of `render` in engine/board/page/board.ts is a list maintained by hand; a new consumer of a board field does not add the field to it by itself. The probe of the task changed several fields together, so the key gap stayed hidden. Uncertain: other draw inputs may have the same gap.

## Fix

Proposed prevention, text: when a change makes a drawn element read a new field of the board read, add that field to the redraw key in the same change, and probe a change of that field alone. A structural follow-up (needs separate authorization; owner: the board of the engine): derive the key from the same projection that the draw functions read, so that no hand list exists; the check is a probe that changes each drawn field alone and sees the redraw.

## Detection signature

A label or a state stays old after the server answer changed only one field; a reload shows the new value.

## Rule

Applies when a change makes page code draw from a new or a changed field of a polled read whose redraw is skipped by a comparison key. Action: add the field to the comparison key in the same change, and list each other field that the changed draw reads. Check: a probe changes only that field between two reads and observes the new view at the next read.

## Related lessons

[[check-announcements-without-a-state-change]] [[list-every-producer-before-a-consumer-requires-a-new-part]]
