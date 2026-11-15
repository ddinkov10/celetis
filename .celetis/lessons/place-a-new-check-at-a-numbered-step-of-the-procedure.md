---
{
  "schema": 1,
  "name": "place-a-new-check-at-a-numbered-step-of-the-procedure",
  "description": "A plan placed a new check 'after the lock' with no numbered step, so an epic result could stop before the steps that write what the epic needs.",
  "tags": [
    "process"
  ],
  "date": "2026-11-15",
  "status": "active",
  "source": "Final whole-branch review of #325 (implement session, 2026-11-15), and the fix commit 1ca3296 on the lane feat/325-intent-a-standard-workflow-to.",
  "incidents": [
    {
      "id": "4304893f-2a02-4f33-ab10-eefc70d2f070",
      "date": "2026-11-15",
      "action": "The plan of #325 (Tasks 1 and 3) wrote the second scope check of a whole-app revision as 'After the lock, run the scope check' in ui.md, epic.md, and specify addition 7, with no place among steps 4 to 10 of 'The procedure'.",
      "expected": "The check runs after the steps whose output its result needs: the epic result needs the ## Prototype record (step 9) and the capture comments (step 7) in the parent body.",
      "observed": "The lock is step 3. Addition 4 of specify stops the session after the epic definition. So an epic result right after the lock skips steps 4 to 10, and the parent body gets no ## Prototype record and no captures, which epic.md and ui.md 'The rollout' require.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Final reviewer (Important 2): 'If the check runs right after step 3, steps 4 to 10 do not run. Then no prototype is built on the screens and no capture comments of the parent are posted. Step 9 writes no ## Prototype record, and step 10 does no cleanup.' Fix: 'After the lock, the look decision does steps 4 to 10. Then run the scope check'.",
        "reference": "https://github.com/ddinkov10/celetis/issues/325"
      },
      "inference": "Likely cause: the spec says 'After the lock', and the plan copied the event name, not a step number; the plan listed the consumers of the inventory but not the consumers of the epic result. Alternative: the plan session judged the order evident from addition 7 ('through its cleanup (step 10)'). No plan-session transcript was read, so the cause is uncertain.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "606d5cd",
      "brief": "Plan of #325, Task 1 lesson rules carried check-every-consumer-of-a-skipped-upstream-step for the list of states only.",
      "lesson": {
        "name": "check-every-consumer-of-a-skipped-upstream-step",
        "revision": "40a0c7d",
        "digest": "8568bce17f5ac01f017041f9b165a9e662050a87ed5d17ca2b30e7ecfeb6d550"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "f3bddaba-fdc9-43cb-9ca4-e3662879272e",
      "requestDigest": "804ccd91a44c9b0d64256b9f28119ac691734e7107a8538885a9589fac9fd87e",
      "date": "2026-11-15",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #325; claude child opus/high\n\nApprove (reviewer rules, \"Approve\"): the evidence is a retained reviewer excerpt and the fix commit 1ca3296, the rule states applicability, action, and check, and it keeps the inferred cause apart from the facts. No active lesson states the same rule: check-every-consumer-of-a-skipped-upstream-step covers a path of an upstream skill, and list-every-producer-before-a-consumer-requires-a-new-part covers a new required input; this rule covers the place of a new act in a numbered procedure. It widens no permission, weakens no check, and does not contradict the plan skill.",
      "related": [
        "place-a-new-check-at-a-numbered-step-of-the-procedure"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays a reading rule of the plan review; the proposal names no structural check."
      }
    }
  ]
}
---
# Place a new check of a procedure at a numbered step

## What happened

The plan of #325 added a second scope check to the whole-app look decision and placed it "after the lock". The lock is step 3 of the ten steps of "The procedure" of `ui.md`. An epic result of that check makes `specify` stop after the epic definition (addition 4). So the text let a session make the epic before steps 4 to 10, and the parent body would get no `## Prototype` record and no capture comments, which the epic children need. The final review of the build found it, and commit `1ca3296` moved the check after step 10.

## Root cause

Inference, not established: the spec says "After the lock", and the plan copied the event, not a step number. The plan listed the consumers of the inventory, but not the consumers of the result of the new check. Alternative: the plan session read "through its cleanup (step 10)" of addition 7 as enough to settle the order.

## Fix

Proposed prevention (text): when a plan or a spec adds an act to a numbered procedure, name the step after which it runs, and list each output that the act or its result reads, with the step that writes it. Proven enforcement: none. A structural check is not suitable: the gate cannot tell which outputs an act needs; this stays a reading rule of the plan review.

## Rule

Applies when a plan, a spec, or a fix adds an act to a numbered procedure, or a check whose result can end the session. Action: place the act after a named step, not after an event of the procedure, and list each output that the act or any of its results needs, with the step that writes it. Check: for each result of the act that ends or hands off the session, a reading case shows that each output it needs is written before it.

## Related lessons

- [[check-every-consumer-of-a-skipped-upstream-step]]
