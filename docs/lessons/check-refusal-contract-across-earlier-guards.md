---
{
  "schema": 1,
  "name": "check-refusal-contract-across-earlier-guards",
  "description": "A permission fixture rejected a valid earlier Git guard because it expected one read diagnostic",
  "tags": [
    "test",
    "git",
    "false-positive"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "Task 2 implementation of ddinkov10/celetis#46; recurrence of check-refusal-contract-across-earlier-guards\n\nImplementation of ddinkov10/celetis#230, temporary V3 unreadable check",
  "incidents": [
    {
      "id": "50cf6be1-96b6-4cf6-847d-81736ce6a4a0",
      "date": "2026-11-05",
      "action": "The Task 2 YAML fixture used suite: product and required the unowned-suite diagnostic. Other initial fixtures used old/new suite values.",
      "expected": "A valid current configuration reaches the intended ownership-block refusal, and the independent snapshot oracle shows no writes.",
      "observed": "The probe expected /suite.*unowned/ but the current configuration reader first refused: suite: need a relative path of a .ts file in the checkout. Corrected product.ts/old.ts/new.ts fixtures reach the intended ownership refusal.",
      "source": {
        "kind": "tool-output",
        "excerpt": "task2-matrix1.log: FAIL V3 unowned suite blocks owned pr before writes: The input did not match /suite.*unowned/. Actual: suite: need a relative path of a .ts file in the checkout. The same log reports the invalid old/new suite values in four YAML fixtures.",
        "reference": "#46 Task 2 task2-matrix1.log; corrected probe2.ts and matrix2"
      },
      "inference": "The child reports that fixture validity was not independently established before selecting a diagnostic. The failure establishes the earlier configuration guard; further cause is uncertain.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "cd40032 plus Task 2 working changes",
      "brief": ".superpowers/sdd/46/context-2.md carries the complete active rule and digest before Task 2.",
      "lesson": {
        "name": "check-refusal-contract-across-earlier-guards",
        "revision": "active in lane at cd40032",
        "digest": "954695156b87e3f7fbaac2572840985182b90172d257ea5a2dab8377aad015e9"
      }
    },
    {
      "id": "celetis-230-unreadable-fixture-diagnostic",
      "date": "2026-11-02",
      "action": "The temporary setup driver required a direct read error for a chmod 000 instruction file.",
      "expected": "An unreadable destination must refuse without project-file or tracker-label writes.",
      "observed": "The driver confirmed EACCES, but setup refused earlier because Git reported the unreadable file as dirty. The driver rejected that valid refusal.",
      "source": {
        "kind": "tool-output",
        "excerpt": "assert.rejects(readFile(AGENTS.md), /EACCES/) passed; setup stderr: \"setup: commit or drop the uncommitted changes of these files first: AGENTS.md\"; assertion expected /cannot read AGENTS.md.*EACCES/.",
        "reference": "#230 green.log, temporary driver line 90"
      },
      "inference": "The check assumed which guard would run first. Git status can mark an unreadable tracked file as dirty. The source contract specifies refusal, not a particular guard.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "0a69b157739b34efd38fdc611376de5f48df6462 plus #230 setup diff"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "ec69a3b1-6746-423b-9d01-f8ad38f3d882",
      "requestDigest": "347b12e043b53e04ade756e251a6bfd2ba62752b8a30251ab184296bb01d65e1",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #236; codex child host default/high\n\nApprove under the reviewer rules: the retained EACCES and earlier Git refusal establish the observed fixture error. The rule requires independent confirmation of the fault and prohibited-side-effect checks; it preserves a diagnostic requirement when the contract specifies one. This agrees with the behavioral-check principle and does not weaken an existing gate.",
      "related": [
        "check-refusal-contract-across-earlier-guards"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The correct refusal depends on each approved contract. No structural follow-up is required by this decision."
      }
    },
    {
      "id": "dcfbe32d-66ef-425c-9b2f-e832e95992fe",
      "requestDigest": "e9cc406ba2244f75bfc302b7e87575c5dc7355bef270512b3c6ecebce292545a",
      "date": "2026-11-05",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nMerge under the reviewer rules: the proposal states the exact active refusal rule and contributes a new observed incident. Keep both incidents, origins, and all prior reviews in check-refusal-contract-across-earlier-guards. The retained error demonstrates the invalid fixture and earlier guard, while the cause remains attributed to the child. The behavioral-check and boundary principles require independent fault validity and no prohibited side effects. No gate is weakened.",
      "related": [
        "validate-fixtures-before-a-specific-refusal",
        "check-refusal-contract-across-earlier-guards"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A temporary setup fixture builder could validate current configuration before probes of a later guard. This review adds no tracked test or helper; that work needs separate authorization."
      }
    }
  ]
}
---
# Check the refusal contract across earlier guards

## What happened

The #230 temporary driver confirmed EACCES on an instruction file, then required setup to emit its direct read error. Setup refused earlier because Git reported that file as dirty. The driver incorrectly rejected this valid refusal.

In #46 Task 2, temporary YAML fixtures used suite values without the required .ts suffix. The current configuration guard refused them before the intended ownership guard. The worker corrected the paths and repeated the matrix. The proposal reports that the active rule and exact digest had reached the task; no prohibited write was observed.

## Root cause

The check assumed that the read guard would be reached. The observed Git dirty-path refusal established an earlier guard; the specification required a refusal without writes, not one diagnostic source.

For #46, the child reported that fixture validity was not independently established before selecting a diagnostic. The retained output establishes an earlier configuration refusal; a broader cause remains uncertain.

## Fix

The driver accepts the existing dirty-path or read refusal, retains the independently observed EACCES, and checks that no label call or success report follows. This is a proposed text rule, not new enforcement. The applicable guard order depends on the command and fixture.

## Rule

When a failure fixture can trigger an earlier guard, derive the expected refusal from the approved behavior. Confirm the intended fault independently and verify the absence of prohibited side effects. Require a particular diagnostic only when the contract specifies it.
