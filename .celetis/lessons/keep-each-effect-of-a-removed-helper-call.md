---
{
  "schema": 1,
  "name": "keep-each-effect-of-a-removed-helper-call",
  "description": "A removed shared helper call or a removed synthetic event lost an effect twice: passOn at the land client (#253), and a .click() through pressable at the Enter key of a card (#346)",
  "tags": [
    "regression",
    "process",
    "ui",
    "recurring"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "Final whole-branch review of #346 (Operations screen on React), implement session on Claude Code, 2026-11-22\n\n#253 implement session (step session), Task 4 task review of 67798b7..427f27d",
  "incidents": [
    {
      "id": "346-final-F1",
      "date": "2026-11-22",
      "action": "Task 5 of #346 replaced the Enter path of the card key handler, base .main-action.click() through pressable, with a direct action.run() in engine/board/page/operations/keys.ts",
      "expected": "Enter on a card sends one POST while the act runs and shows the busy label with aria-busy, as pressable gave on the base",
      "observed": "Two Enters with an 800 ms POST: base sent [/api/shell] and showed Opening with busy true; the lane sent [/api/shell,/api/shell] and showed Open shell with busy null; /api/go the same",
      "source": {
        "kind": "tool-output",
        "excerpt": "base k-43 {\"during\":{\"label\":\"Opening\",\"busy\":\"true\"},\"posts\":[\"/api/shell\"]}; lane k-43 {\"during\":{\"label\":\"Open shell\",\"busy\":null},\"posts\":[\"/api/shell\",\"/api/shell\"]}",
        "reference": "https://github.com/ddinkov10/celetis/issues/346"
      },
      "inference": "Inferred: the plan interface named only the act of actionsOf(card)[0] for Enter, and the implementer and the task reviewer did not read a removed .click() as a removed helper call, although the listener pressable held the effects. Alternative: the rule text reads as covering only direct helper calls.",
      "diagnosis": [
        "not-followed",
        "wrong-or-incomplete-rule"
      ],
      "revision": "30fce77",
      "brief": ".superpowers/sdd/346/task-5-brief.md carried keep-each-effect-of-a-removed-helper-call sha256:8db46c04",
      "lesson": {
        "name": "keep-each-effect-of-a-removed-helper-call",
        "revision": "30fce77",
        "digest": "8db46c0445bc5909d19e57be0dcea9bd4046a2653c2eaee983d6dabcf1428b2c"
      }
    },
    {
      "id": "2e1be3f3-5035-4b9b-9e45-25edb2dcafb8",
      "date": "2026-11-08",
      "action": "The coordinator ruling C4 told Task 3 to return the parsed landing code in engine/land.ts without passOn, because the plan rule R11 says that only the D4 sites pass a child code on.",
      "expected": "The event record of the land client stays as in the base: the daemon records the landing (land-exit), and the client records only its own refusals (docs/workflow.md, \"The event record\").",
      "observed": "For one landing with code 6, the base client wrote 0 event entries and the lane client wrote 1 entry: kind=refusal command=land name=exit code=6 message=\"\".",
      "source": {
        "kind": "tool-output",
        "excerpt": "base: land exit 6; stderr: \"\" / base: event entries: 0 / lane: land exit 6; stderr: \"\" / lane: event entries: 1 / lane:   kind=refusal command=land name=exit code=6 message=\"\"",
        "reference": "#253 Task 4 review probe land-event/probe.ts, rerun by the coordinator; fixed in 45da931 (recordedElsewhere)"
      },
      "inference": "Inferred: passOn had two effects, the returned code and an entry in the passed set that the exit handler of engine/lib/events.ts skips; the ruling and R11 named only the pass-through role. Uncertain: whether a reading of passOn before the ruling would have shown it; the Task 3 review did not probe the event record either.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "6c14f8b"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "b7566dcd-d1c2-476d-8f78-ac976171f3a3",
      "requestDigest": "490479bd263d6af7699fba4341c6d2b24820f622de0dc64dadcda61fda87ae50",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #253; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed: the retained probe excerpt gives 0 event entries in the base and 1 refusal with an empty message in the lane for one landing with code 6, and the lane holds passOn (passed.add, then passThrough) and the fix recordedElsewhere in engine/lib/events.ts, called in engine/land.ts by 45da931. The rule states applicability, action, and check, and keeps the inferred cause apart from the facts. No active lesson states this rule: a-moved-check-keeps-the-states-of-its-old-rule covers the accepted states of a moved check, and plan-condition-must-not-narrow-a-spec-rule covers a changed spec rule, not a lost effect of a removed helper call. The rule widens no permission, weakens no check, and contradicts no instruction, skill, or principle.",
      "related": [
        "keep-each-effect-of-a-removed-helper-call"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The effects of each helper differ, so no general structural check is known; a probe of the effects at the changed site stays the check of the rule."
      }
    },
    {
      "id": "0edd09fc-a9e5-4594-9011-d7bbf2c0f9e0",
      "requestDigest": "9a0b18174ace9bf8a44c013afb6fc3c38baaf87d587f6cee1401233975a38818",
      "date": "2026-11-22",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #361; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed tool output: with an 800 ms POST, two Enters on the base sent one /api/shell and showed Opening with busy true, and on the lane sent two and showed no busy state. The proposal states the rule of the active lesson keep-each-effect-of-a-removed-helper-call for a site that removes a synthetic event instead of a direct helper call, and its diagnosis names that rule as incomplete. Two active rules for one act would overlap, so the survivor is the active lesson, with its applicability and its check widened to synthetic events and their listeners, and with every incident and prior review kept. The survivor keeps the facts and the inferred causes apart. It widens no permission, weakens no check, and contradicts no instruction, skill, or principle.",
      "related": [
        "probe-each-removed-click-path-for-its-press-effects",
        "keep-each-effect-of-a-removed-helper-call"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The effects of a listener are found by reading code, so the rule stays text; a probe of the effects at the changed site stays its check."
      }
    }
  ]
}
---
# Keep each effect of a shared helper call or a synthetic event that a change removes

## What happened

In #253, the coordinator ruling C4 made `engine/land.ts` return the parsed landing code of the daemon without `passOn`, because the plan allowed `passOn` only at the pass-through sites. The Task 3 review accepted it. The Task 4 review then probed the event record: for one landing with code 6, the base client wrote no entry, and the lane client wrote a refusal with an empty message next to the daemon's `land-exit`. The fix `45da931` added `recordedElsewhere` to `engine/lib/events.ts` and called it at that one site.

In #346, Task 5 ported the card keys to React. The base Enter called `.main-action.click()`, and the click listener `pressable` of `engine/board/page/ui.ts` set `aria-busy`, showed the busy label, and dropped a second press while the act ran. The lane called `action.run()` directly in `engine/board/page/operations/keys.ts`. A double Enter sent two `/api/shell` POSTs and showed no busy state. The brief carried this lesson, and the task review passed. The final review found it with a probe of the base and the lane.

## Root cause

Inference (#253): `passOn` returned the code and also marked it as recorded elsewhere, so the `exit` handler did not record it. The ruling looked only at the role that the rule named. Uncertain: whether a read of the helper body before the ruling would have caught it.

Inference (#346): the removed call was a `.click()`, not a call of the helper, so the effects lived in a listener that the site did not name, and the rule text named only a call to a shared helper. Uncertain: the plan interface named only the act, which may have narrowed the reading.

## Fix

Proposed prevention (text, not enforced): before a change removes or replaces a call to a shared helper or a synthetic event at a site, list each effect of the helper, or of each listener that the event reached, at that site, and keep each effect that the site needs. A structural check is a probe that compares each such effect with the base at that site. The rule stays text, because the effects of each helper and listener differ and are found by reading code.

## Detection signature

A new entry in a record, a log, or a set that the base does not write, after a call was removed for a reason that names only its return value. A second request, or a missing busy state, after two quick presses where the base sent one request.

## Rule

Applies when a change or a ruling removes or replaces, at one site, a call to a shared helper or a synthetic event (a `.click()`, a `dispatchEvent`, a `submit()`) whose target has a listener with effects. Action: read the helper, or each listener that the event reached on the base, list each effect at that site (the return value, recorded state, events, marks, flags, a busy label, a guard against a second press), and keep each effect that the site needs, or record why it goes. Check: a probe compares each listed effect with the base at that site, for example the event record of the command for one case, or the request count and each listed effect after two quick presses.
