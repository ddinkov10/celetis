---
{
  "schema": 1,
  "name": "derive-plan-oracle-values-from-real-producers",
  "description": "Plan oracles gave hand-derived values, also gate results with a probe in place, that the real producers, including guards and unchanged gate jobs, do not produce",
  "tags": [
    "test",
    "process",
    "recurring",
    "build"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Task 4 of ddinkov10/celetis#255\n\nTask 1 implementer report of ddinkov10/celetis#249 (subagent-driven build, commit 0fd8ed3)\n\nImplementation of ddinkov10/celetis#270, Task 2 and Verify corrections",
  "incidents": [
    {
      "id": "d21bb6c7-2bcd-4515-bbdd-3f0f844b7873",
      "date": "2026-11-08",
      "action": "The #255 plan, Task 4 step 2, expected `verify: PASS` with two probe re-exports in place (`export { main as probeCommand } from '../next-step.ts';` in engine/lib/lines.ts and `... from '../update.ts';` in engine/board/history.ts), as the red result of the new Biome rule.",
      "expected": "The plan computes the expected gate result from each job of the existing gate on the planned probe inputs, or expects only the Biome part of the gate.",
      "observed": "The gate run with the probes gave `verify: FAIL`: the job `tsc browser` (engine/board/tsconfig.json, types []) failed with 196 TS2591 errors ('Cannot find name 'node:crypto'...'), because the board probe pulls node: modules into the browser project; `== biome check` passed in that run. The controller ruled that the red result of the rule shows in the Biome part.",
      "source": {
        "kind": "tool-output",
        "excerpt": "== tsc browser ... engine/lib/agent-order.ts(1,40): error TS2591: Cannot find name 'node:crypto'. ... verify: FAIL (biome check passed in the same run)",
        "reference": "ddinkov10/celetis#255, Task 4 step 2"
      },
      "inference": "Inferred: the plan derived the step 2 result from the change (no rule yet, so no refusal) and did not run the unchanged gate jobs on the probe input. The plan carried derive-plan-oracle-values-from-real-producers in its Verify section, not in Task 4; the rule names lists, counts, triggers, record writes, and liveness results, not a gate result. Uncertain: whether the rule reached the plan author for this step, or its coverage misses a gate result.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "adfa9bb59d55682dca331c02134b386111bff99f",
      "brief": "Plan #255, Task 4 step 2: 'Run the gate command. Expected: verify: PASS, because no rule refuses them yet. This is the red result of the rule.' Task 4 lesson rules: scope-shared-prohibitions-against-required-callers only.",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "adfa9bb59d55682dca331c02134b386111bff99f",
        "digest": "82374a5ef999ae3a64156d1c366b1c8de2160cb0d321e022fddb8d4122e121c3"
      }
    },
    {
      "id": "484c9592-1377-4567-91b1-3365029703ba",
      "date": "2026-11-07",
      "action": "The #249 plan, Task 1 case (e), expected a refused queue wake with a live foreground holder of issue-A to leave the queue record `error`; case (g) expected a reconcile wake to reach `running` with a session of B.",
      "expected": "Each oracle value that an unchanged producer derives (the guard of failQueueLaunch, holderFrom liveness, the plan gate of the fixture) is computed from that producer on the planned fixture.",
      "observed": "The implementer observed that a createLockOwner holder in a non-daemon process is not live (holderFrom), so the run adopted the lock; with a holder that calls registerSession, the guard of failQueueLaunch counts the holder of the current issue as a live queue owner and keeps the record `starting`. A reconcile wake has authorization null, so with the default `me` gate (g) ends at me-gate.",
      "source": {
        "kind": "tool-output",
        "excerpt": "(e) live foreground: 409 with `queue: a run or its foreground still owns this work`, code 2. The record keeps its bytes. ... The default gate is `me` (`defaultGate` in `engine/lib/workflow.ts`), so the run correctly ends at `me-gate` with a 409 of code 0 (first GREEN run).",
        "reference": "ddinkov10/celetis#249 lane .superpowers/sdd/249/task-1-report.md; engine/lib/locks.ts holderFrom; engine/lib/queue.ts queueOwner; engine/lib/queue-actions.ts failQueueLaunch"
      },
      "inference": "Inferred: the plan derived the oracles by hand from the spec sentences and did not run the existing guards (holderFrom, queueOwner, the failQueueLaunch guard, defaultGate) on the planned fixture. The spec itself states the guard; the oracle conflicted with it. Uncertain whether the plan session had the active lesson derive-plan-oracle-values-from-real-producers in context: the plan does not carry it in any task, and the plan transcript is not available.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "050e54fc9e587f3e2c94c43704716619c69ba58d",
      "brief": "Task 1 brief (e): 'a probe process that takes issue-A with the real createLockOwner of the lane in that window: 409 ... the record is error with that reason'",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "050e54fc9e587f3e2c94c43704716619c69ba58d",
        "digest": "96021f4353685d83fca5b2120fcf6c9be403f8f596ed87fe53771a305fae4689"
      }
    },
    {
      "id": "61139222-0d92-4326-95e8-13b31e08abb7",
      "date": "2026-11-05",
      "action": "The #270 plan (comment 6668306212) gave the Task 2 Step 1 and V3 oracle 'Idle items #300, #280, #195 row, #240 row, #100, #55 row, #31, #9, #8' and 'The Idle count is 24', and its self-review says it traced each expected fixture state to its producer.",
      "expected": "Each expected oracle value comes from the real producer applied to the planned data set.",
      "observed": "The planned data set has #30 (open, no labels, no parent), which the board places in Idle between #31 and #9; the real Idle count is 25. The Task 2 implementer asserted the real data and reported the plan list as wrong.",
      "source": {
        "kind": "tool-output",
        "excerpt": "task-2 report: 'The brief lists Idle items without #30, and the count 24. The full dataset has #30 (no label, no parent) as an Idle card, so the true Idle count is 25'. kit make-data.ts:19 s.push({ n: 30, labels: [] }).",
        "reference": "ddinkov10/celetis#270 runtime report"
      },
      "inference": "Inferred: the plan derived the list by hand from its own data list and dropped the parent #30 of child #31. The rule of the related lesson governs fixture inputs and the check at execution, which caught the error; it does not ask the plan to compute expected values from the producers. Alternative: a one-off counting slip.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "92b91337586e0992316ac8835d10db28e6954d44",
      "brief": "Plan #270 Task 1 Lesson rules carry derive-fixture-state-from-real-producers sha256:fa0750b7…; Self-review record: 'The self-review traced each expected fixture state to its producer (decide, PLACERS, stages)'.",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "92b91337586e0992316ac8835d10db28e6954d44",
        "digest": "fa0750b7eb699d677cb04d9153641bf0226578b3d7e2c0b637ae867d2cecba2f"
      }
    },
    {
      "id": "0308c8da-20b5-4e20-b3db-6822577079fe",
      "date": "2026-11-05",
      "action": "The #270 plan Task 2 Step 9 checked the closed-row changed dot with 'a title change of a hidden child shows the row dot'.",
      "expected": "The probe changes an input that the existing changed-dot producer reads.",
      "observed": "The board changed dot comes from signature, which ignores the title, so a title change shows no dot; a step change (#254 gains bug) does.",
      "source": {
        "kind": "tool-output",
        "excerpt": "task-2 report: 'A title change alone does not show the row dot, because signature ignores the title. A step change (#254 gaining the label bug) does show it.'",
        "reference": "ddinkov10/celetis#270 runtime report"
      },
      "inference": "Inferred: the plan assumed which fields mark a card changed without reading signature. Same family as the first incident.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "92b91337586e0992316ac8835d10db28e6954d44",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "92b91337586e0992316ac8835d10db28e6954d44",
        "digest": "fa0750b7eb699d677cb04d9153641bf0226578b3d7e2c0b637ae867d2cecba2f"
      }
    }
  ],
  "recurrences": 3,
  "reviews": [
    {
      "id": "6b752a90-9785-461b-ae6b-5bab3892695f",
      "requestDigest": "6301fd91f6868e093466c9c29f393200a2928c2fc32a931cd3428f2f7aee8fd9",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #270; claude child opus/high\n\nEdit under the reviewer rules. The incidents are observed: the #270 Task 2 report gives the real Idle count 25 with #30, and engine/board/view.ts signature joins column, state, step, and waitFor, not the title. The active lesson derive-fixture-state-from-real-producers governs runtime fixture inputs, not the expected values that a plan writes, so this is a new rule and not a merge. As proposed, the rule computed every oracle value from the real producer, which contradicts the test-behavior-not-implementation principle of the plugin celetis (derive the expected result from the requirement) when the producer is the code under change. The edit limits the rule to the part of a value that an existing, unaltered producer gives, keeps the part that the change adds with the requirement, and retitles the lesson to match. Incident evidence stays unchanged.",
      "related": [
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference; it needs separate authorization."
      }
    },
    {
      "id": "38a51d74-8877-42f1-8a73-ed198599da4b",
      "requestDigest": "d1baeb2cd6d63d1482e05e62734deb267a3662f5b70295bd1e2b04a336644104",
      "date": "2026-11-07",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #249; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed: the #249 Task 1 report retains the refusal \"queue: a run or its foreground still owns this work\" with code 2 and the me-gate end of a reconcile wake, and the lane code holds that refusal in engine/lib/run-engine.ts and defaultGate 'me' in engine/lib/workflow.ts. The proposal states the same rule as the active lesson derive-plan-oracle-values-from-real-producers: compute the part of an oracle that an existing, unaltered producer gives from that producer. A guard, a gate default, and a lock-holder liveness rule of unchanged code are such producers, so the rules are compatible. The survivor keeps the active name and the limit of the test-behavior-not-implementation principle of the plugin celetis, widens the applicability to record writes and liveness results, and adds the guard list and the live-owner fixture from the proposal. Incident evidence stays unchanged; the retained excerpt holds the evidence because the task report file is no longer in the lane.",
      "related": [
        "check-plan-oracles-against-guards-of-existing-producers",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference, and an oracle of a record write that names no guard that can refuse it; it needs separate authorization."
      }
    },
    {
      "id": "60dca0eb-b577-42ed-b641-37388e603ff5",
      "requestDigest": "815d2a60b9c4a13432e59c4c1fde1e376956e223f447a93001e4170cffdd1fe1",
      "date": "2026-11-08",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #257; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed: ADR-0081 in commit 45b2729 of the lane branch of #255 records that without the rule the gate fails at tsc browser because a probe import pulls node: modules into the browser project, which agrees with the retained excerpt. The proposal states the same rule as the active lesson derive-plan-oracle-values-from-real-producers: compute the part of an oracle that an existing, unaltered producer gives from that producer. An unchanged job of the gate that a probe input reaches is such a producer, and the job under test keeps the requirement-derived part, so the rules are compatible with each other and with the test-behavior-not-implementation principle of the plugin celetis. The proposal itself names this merge. The survivor keeps the active name, widens the applicability to a gate or multi-job check result on a probe input, adds the per-job action and check, and adds the tag build. Incident evidence stays unchanged.",
      "related": [
        "derive-a-planned-gate-result-from-each-job-of-the-gate",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference, an oracle of a record write that names no guard that can refuse it, and a planned gate result with a probe in place that names no job; it needs separate authorization."
      }
    }
  ]
}
---
# Derive planned oracle values of existing producers from those producers

## What happened

Three plans gave hand-derived oracle values that the existing producers do not give. The #270 plan gave an Idle list and count that omitted fixture #30, so the real count was 25, not 24, and a changed-dot probe that used a title change, which the board signature ignores. The plan carried the related lesson and claimed to trace each state. The #249 plan, Task 1, expected a refused queue wake with a live foreground holder of the current issue to write `error` to the queue record, and a reconcile wake to reach `running` with a session. The implementer observed (tool output) that a `createLockOwner` holder in a process other than `daemon.ts` is not live (`holderFrom`), that a holder with `registerSession` is a live queue owner, so the guard of `failQueueLaunch` keeps the record unchanged, and that a reconcile wake with `authorization: null` ends at the default `me` gate (`defaultGate`). The spec of #249 states that guard. The #255 plan, Task 4 step 2, expected `verify: PASS` with two probe re-exports of command files in place, as the red result of a new Biome rule. The gate gave `verify: FAIL` (tool output): the unchanged job `tsc browser` failed with 196 TS2591 errors, because the board probe pulled `node:` modules into the browser project, and `biome check` passed in that run. In each case, the implementers or the controller caught the error at execution and asserted the real behavior.

## Root cause

Inferred: the plans computed the values by hand, from their own data lists, from spec sentences, or from the change alone, and did not run the existing producers on the planned inputs. For #249, the unchanged producers were guards: a lock-holder liveness rule, an owner check, and a gate default. For #255, the unchanged producer was another job of the gate that the probe input also reached. Uncertain: whether this lesson reached the #249 and #255 plan sessions; neither plan carries it in the affected task (the #255 plan carries it in its Verify section only), and the earlier rule named lists, counts, triggers, record writes, and liveness results, not a gate result. Alternative: independent slips.

## Fix

Proposed prevention, not proven enforcement: when a plan writes an expected list, count, trigger, record write, liveness result, or gate result for a derived state, it computes the part that an existing producer gives, and that the change does not alter, from that producer (for example a probe that runs the placer, the signature, the guards of the call path, or the unchanged jobs of the gate on the planned data, fixture, or probe input), and records how. A guard, a gate default, a lock-holder rule, and a job of the gate of unchanged code are such producers; the plan names how its fixture makes a live owner, and a planned gate result with a temporary probe names the job that gives it, or expects only the lines of the job under test. The part that the change adds comes from the requirement, as the test-behavior-not-implementation principle of the plugin celetis says: an oracle computed from the code under change cannot fail when that code is wrong. A structural follow-up needs separate authorization: a plan review check that flags a derived oracle value with no producer or requirement reference, an oracle of a record write that names no guard that can refuse it, and a planned gate result with a probe in place that names no job. Judgment decides which values are derived, which guards apply, and which jobs a probe reaches, so the rule stays text.

## Rule

Applies when a plan or a brief states an expected value of a derived state (a list, an order, a count, a trigger, a record write, a liveness result, or the result of a gate or a multi-job check on a probe input) for a check, and an existing producer that the change does not alter gives part of that value, including each guard, gate default, or lock-holder rule on its call path and each unchanged job of the gate that the probe input reaches. Action: compute that part from the existing producer on the planned inputs and cite the producer; for a record write or a state, list each such guard from the call path and name how the fixture makes a live owner; for a gate result, run or read each unchanged job on the probe input and state the result of each job that the probe reaches, or expect only the lines of the job under test; derive the part that the change adds from the requirement. Check: each such oracle value names its producer or its requirement, a planned gate result names its jobs, and a run of the existing producer, with its guards, on the planned data gives the part that it covers.

## Related lessons

[[derive-fixture-state-from-real-producers]]
[[check-refusal-contract-across-earlier-guards]]
