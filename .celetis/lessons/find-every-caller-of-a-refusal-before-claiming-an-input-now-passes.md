---
{
  "schema": 1,
  "name": "find-every-caller-of-a-refusal-before-claiming-an-input-now-passes",
  "description": "A plan claimed that two refusals leave the step start of #262 (a non-Git Codex source, a Claude policy conflict), but other callers on the start path still made each one",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Verify phase of ddinkov10/celetis#262 (implement step, 2026-11-09), scenario V2 d",
  "incidents": [
    {
      "id": "69b517fe-d5a8-428b-9454-3b1807a4834e",
      "date": "2026-11-09",
      "action": "The plan of #262 (Decision 7 and scenario V2 d) and its Task 2 replaced requireSameRevision with requireContract and stated that a plugin from a non-Git marketplace can start a step session. Task 2 probed only requireContract at module level (probe r7). ADR-0089 and plugins/celetis/docs/workflow.md wrote the claim.",
      "expected": "Spec of #262: a plugin from a non-Git marketplace source can start a step session; the Verify oracle of V2 d: the session starts.",
      "observed": "In the Herdr lab, the fixture daemon of the lane passed requireContract, then startSession (engine/lib/run-engine.ts:746) called the Codex pin codexSessionPin, which calls codexRevision (engine/lib/plugin-metadata.ts:463) and refused the local marketplace; the run stopped with code 3 and no session.",
      "source": {
        "kind": "tool-output",
        "excerpt": "daemon: start: /celetis:plan #1 at high (default)\nupdate: selected Codex marketplace is not a Git source; no remote update check is available\n(run stopped, code 3; no start record, no session record)",
        "reference": "https://github.com/ddinkov10/celetis/issues/262"
      },
      "inference": "Inferred: the plan listed the reads inside the removed helper (requireSameRevision and installation()) and did not search for other callers of the same refusal (codexRevision) on the start path; the session pin is a separate call that the base also made after the revision check, so the base never reached it with a local source. Uncertain: whether the plan session read the pin; its transcript was not read. Alternative: the plan meant only the runner check, and the pin was out of its view.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "5b48404b5394ae47afab93b36288342eb3291bf1",
      "brief": "Plan of #262, Verify phase lesson rules: the rule derive-plan-oracle-values-from-real-producers (for a probe input that must reach one check, list each guard of that producer before the check); Decision 7; V2 d (https://github.com/ddinkov10/celetis/issues/262#issuecomment-6743878789)",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "6e7d9ea0bcf366756f74ab4ecb8de0e683730aa0",
        "digest": "9a6a41b136d4375a6bbd2ca5850f074e8d84894e6c800567c1310a97b20570e3"
      }
    },
    {
      "id": "8d2b6f0e-4c1a-4f7e-9b52-3a6e0c9d7f14",
      "date": "2026-11-09",
      "action": "Plan Decision 7 of #262 and ADR-0089 decision 7 stated that the Claude policy files and a policy conflict refusal leave the step start, because requireSameRevision (installation()) read them.",
      "expected": "A record states only what the code does on the start path.",
      "observed": "The step start still calls requireUpdatePolicy (engine/lib/run-engine.ts:447-453 requireStart, engine/lib/interactive.ts:44-45), which is checkClaudePolicy(await claudePolicy(cwd)), the same read and refusal that installation() made; the verify-1 task reviewer probe on 3500528 refused with code 3.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Celetis automatic updates are enabled or unknown (code 3, step start on 3500528)\nengine/lib/plugin-policy.ts:83 requireUpdatePolicy: if (host === 'claude') checkClaudePolicy(await claudePolicy(cwd))",
        "reference": "https://github.com/ddinkov10/celetis/issues/262"
      },
      "inference": "Inferred: the plan listed the reads inside the removed helper and did not grep the refusing function (checkClaudePolicy) for other callers on the start path. The same shape as the first incident of this proposal. Uncertain: the plan session transcript was not read.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "3500528060c778b801c642aa16ad4b7c73a9fcf1",
      "brief": "Plan of #262, Decision 7 (https://github.com/ddinkov10/celetis/issues/262#issuecomment-6743878789)",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "6e7d9ea0bcf366756f74ab4ecb8de0e683730aa0",
        "digest": "9a6a41b136d4375a6bbd2ca5850f074e8d84894e6c800567c1310a97b20570e3"
      }
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "489c2aa3-6f05-40d1-9941-752d90bf96e8",
      "requestDigest": "492cfb2d02965de4d5a896f0c43d0172b3f631dcd536e8fe8e0a5cd88a2af077",
      "date": "2026-11-09",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #262; claude child opus/high\n\nApprove under the reviewer rules. The incidents are observed and hold in the lane: at 5b48404, startSession (engine/lib/run-engine.ts:746) calls the host pin, codexSessionPin (engine/lib/plugin-metadata.ts:518) calls codexRevision, which holds the refusal 'update: selected Codex marketplace is not a Git source', and the lane head no longer makes that call; requireStart (engine/lib/run-engine.ts:449-452) and the interactive launch (engine/lib/interactive.ts:44-45) still call requireUpdatePolicy, which calls checkClaudePolicy. The root cause is labeled as inference with an alternative. The rule states applicability, action, and check, adds a search and an end-to-end probe, widens no permission, weakens no check, and contradicts no project instruction, skill, or principle. No live or historical lesson states the same rule, so this is not a merge: derive-plan-oracle-values-from-real-producers computes oracle values of unchanged producers, and here the V2 d oracle came from the spec and was right, while the change and its documents missed a second caller of the refusal; list-the-sites-before-a-document-claims-every-site covers a document claim of every site but not the completeness of a change that removes a refusal; keep-each-effect-of-a-removed-helper-call keeps the effects of a removed call, not the other callers of its refusal. The diagnosis not-followed of each incident stays as the proposer's inference: the cited lesson reaches the V2 d oracle only in part. Incident evidence stays unchanged.",
      "related": [
        "find-every-caller-of-a-refusal-before-claiming-an-input-now-passes"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: which calls lie on an operation path needs a read of the code, and the end-to-end probe of the claim is the check."
      }
    }
  ]
}
---
# Find every caller of a refusal before you claim that an input now passes

## What happened

In #262, the plan replaced `requireSameRevision` with `requireContract` at the step start and stated that a plugin from a non-Git marketplace can start a step session (Decision 7, scenario V2 d, ADR-0089, `plugins/celetis/docs/workflow.md`). Task 2 probed `requireContract` alone at module level. In the Verify lab, the daemon passed `requireContract`, then `startSession` called the Codex session pin `codexSessionPin`, which calls `codexRevision` and refused the local marketplace with `update: selected Codex marketplace is not a Git source; no remote update check is available`. The run stopped with code 3 and no session. The task review of the fix then found the same shape for a second refusal: Decision 7 and ADR-0089 said that a Claude policy conflict leaves the step start, but `requireStart` and the interactive launch still call `requireUpdatePolicy`, the same policy read that the removed helper made.

## Root cause

Inferred, not established: the plan listed the reads inside the removed helper and did not search for other callers of the same refusing function on the operation path. At the base, the earlier revision check refused first, so no run reached the second caller with that input. Uncertain: the plan session transcript was not read; the pin may have been out of view rather than overlooked.

## Fix

Proposed prevention, in text: when a change removes a refusal from one site and claims that an input now passes the whole operation, grep the refusal text and the refusing function for every caller on that operation path, and probe the input through the whole operation, not only the changed site. A structural check is not suitable: which calls lie on an operation path needs a read of the code; the end-to-end probe is the check.

## Detection signature

A plan or a document says that an input "can now" pass an operation after a check moved, and the only probe of that claim calls the new check function directly.

## Rule

Applies when a change removes or replaces a refusal at one site, and a plan, a document, or an oracle claims that an input the old site refused now passes the whole operation (for example a step start). Action: search the refusal text and each function that makes it (`grep -rn`) for every other caller on that operation path, list each caller with whether the input reaches it, and include each one in the change or in the claim. Check: a probe sends that input through the whole operation through its real entry and observes the claimed result; a grep of the refusal text names no caller on the path that the list leaves out.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]]
[[keep-each-effect-of-a-removed-helper-call]]
[[check-refusal-contract-across-earlier-guards]]
