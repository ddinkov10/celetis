---
{
  "schema": 1,
  "name": "emulate-hover-none-with-touch-emulation-and-assert-matchmedia",
  "description": "A hover: none sweep used setEmulatedMedia, matchMedia stayed false in all 218 combinations, and only touch emulation reached hover: none",
  "tags": [
    "ui",
    "test",
    "platform-quirk"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "The Task 5 implementer of the implement session of #368 on 2026-11-24 (own correction in its report).",
  "incidents": [
    {
      "id": "0b7f3c52-5d1e-4c8e-9a61-3f2e7d9c4a18",
      "date": "2026-11-24",
      "action": "The first hover: none sweep of the probe (218 combinations) used CDP Emulation.setEmulatedMedia with the features hover and any-hover set to none.",
      "expected": "matchMedia('(hover: none)') is true in each combination of the sweep.",
      "observed": "matchMedia('(hover: none)') was false on both pages in all 218 combinations; a direct test of setEmulatedMedia also gave false after goto. Emulation.setTouchEmulationEnabled({enabled:true,maxTouchPoints:1}) gave hover none, pointer coarse, and any-hover none all true, and the second sweep recorded true in each combination.",
      "source": {
        "kind": "tool-output",
        "excerpt": "setEmulatedMedia hover none: matchMedia('(hover: none)') false in 218/218; setTouchEmulationEnabled: [hover none, pointer coarse, any-hover none] = [true,true,true]"
      },
      "inference": "Inferred: this Chromium build or the Playwright session ignores the hover features of setEmulatedMedia. Not confirmed against the Chrome DevTools Protocol documents. The matchMedia check of the related lesson caught the case before the evidence was used.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "8a5a6ed",
      "lesson": {
        "name": "measure-a-media-feature-rule-in-each-real-state-of-the-feature",
        "revision": "8a5a6ed",
        "digest": "29bf0e0bac3f51aa47fc5933f5626afc82e7eeba04187ce3ec9ef8b80aca4f2b"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "2cb3cab6-ec33-455d-8b36-92c1f18363a6",
      "requestDigest": "a2ea6807095da08d279433750bdc1db85a50475c5c3c2097076d9d3a165418a1",
      "date": "2026-11-25",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #368; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed tool output of the #368 Task 5 probe: with Emulation.setEmulatedMedia for hover and any-hover none, matchMedia('(hover: none)') was false in 218 of 218 combinations, and with Emulation.setTouchEmulationEnabled it was true. The rule states applicability, action, and check. It refines measure-a-media-feature-rule-in-each-real-state-of-the-feature, which requires the browser's own emulation and a matchMedia record but names no working emulation for hover: none; the two rules are compatible, so both stay active and no merge applies. It agrees with the Chromium check of the board in AGENTS.md, widens no permission, weakens no check, and adds no network or credential act. The cause in the browser stays labeled as inference, not confirmed against the protocol documents.",
      "related": [
        "emulate-hover-none-with-touch-emulation-and-assert-matchmedia"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the working emulation can differ by browser version, and the probe is a scratch file that no gate runs. This review changes lesson data only."
      }
    }
  ]
}
---
# Emulate hover: none with touch emulation, and assert matchMedia first

## What happened

The Task 5 implementer of #368 ran a probe sweep under `hover: none`. It used CDP `Emulation.setEmulatedMedia` with the features `hover` and `any-hover` set to `none`. The probe recorded `matchMedia('(hover: none)')` as false on both pages in all 218 combinations, so the sweep was no evidence. `Emulation.setTouchEmulationEnabled({enabled: true, maxTouchPoints: 1})` made `hover: none`, `pointer: coarse`, and `any-hover: none` all true, and a second sweep recorded true in each combination.

## Root cause

Observed: media emulation of the hover features had no effect in this browser session. Inferred: the Chromium build or the Playwright session ignores those features; not confirmed against the protocol documents. The related lesson says to use the browser's own emulation and to record matchMedia; its Check caught the case, but its Action does not say which emulation reaches `hover: none`.

## Fix

Proposed prevention: reach `hover: none` through touch emulation, and assert the matchMedia result before the first measurement of a sweep. This stays text: the working emulation can differ by browser version. It changes no instruction.

## Rule

Applies when a check measures a page under `hover: none` or `pointer: coarse` in Chromium. Action: enable touch emulation (`Emulation.setTouchEmulationEnabled` with `maxTouchPoints` 1, or a context with `hasTouch`), and read `matchMedia('(hover: none)')` after each load, before the first measurement. Check: the evidence holds the matchMedia value true for each combination, and a sweep with a false value stops before it compares.

## Related lessons

[[measure-a-media-feature-rule-in-each-real-state-of-the-feature]]
