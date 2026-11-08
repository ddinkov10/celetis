---
{
  "schema": 1,
  "name": "state-the-limits-of-a-check-from-a-probe-of-its-configuration",
  "description": "A new ADR stated limits of a Biome rule that no probe supported; two review rounds corrected two limit sentences",
  "tags": [
    "build",
    "process",
    "false-positive"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Task 4 review and final whole-branch review of ddinkov10/celetis#255",
  "incidents": [
    {
      "id": "95f37510-bee1-47b5-af9f-8445f16997ea",
      "date": "2026-11-08",
      "action": "The Task 4 implementer of #255 wrote ADR-0081 with two limit sentences for the Biome override style/noRestrictedImports with group **/../*: a nested-folder sentence ('A ../<file> in a nested folder ... matches **/../* only when the pattern fits its path depth') and a coverage sentence ('dynamic imports, and require()'; 'A require() and an inline import('…').T type are covered by Biome only when they name the listed pattern'). It ran no probe of either claim.",
      "expected": "A decision record states what the configured check refuses and what it does not, from an executed probe of that configuration; the plan's External facts already recorded that the group does not refuse require() or an inline import('…').T type.",
      "observed": "Biome 2.5.15 with the checkout biome.jsonc refused both ../next-step.ts and ../../next-step.ts from engine/lib/a/ (and ../quota-recovery.ts, a false positive), and refused neither require('../next-step.ts') nor export type T = import('../next-step.ts').X ('Checked 2 files ... No fixes applied.'). The task review found the first sentence, the final review the second; each needed a fix round of the ADR before the landing.",
      "source": {
        "kind": "tool-output",
        "excerpt": "engine/lib/a/b.ts:1:17 lint/style/noRestrictedImports / engine/lib/a/c.ts:1:17 lint/style/noRestrictedImports (× A library or board module imports the library, not a command file of engine/ (ADR-0081).); and for r.ts (require) and t.ts (inline type): Checked 2 files in 25ms. No fixes applied.",
        "reference": "ddinkov10/celetis#255, commits 05bba55 (first text), 45b2729 (fix round 1), f2cf38f (final fix)"
      },
      "inference": "Inferred: the implementer derived the limits from its reading of the docs and the plan prose, not from a run of the configured rule; the plan's Task 4 External facts held the probe results, but the brief asked for 'its limits' without asking for a probe per sentence. Uncertain: whether a cheaper model tier (haiku/low) made the difference. Alternative: independent slips.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f2cf38f6a60110b2b9774c6cccde8b53821346db"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "a67a4707-0a62-45b2-b987-cae7f5980e1e",
      "requestDigest": "dd24e718ac3fced86b3bb05479e74298c05b70d6aa1e4770236c682f632318f8",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #257; claude child opus/high\n\nApprove under the reviewer rules: no rule rejects, merges, replaces, or skips it. The incident is observed: in the lane branch of #255, commit 05bba55 holds the nested-folder sentence (\"matches **/../* only when the pattern fits its path depth\") and the require() sentence, 45b2729 keeps \"covered by Biome only when they name the listed pattern\", and f2cf38f replaces it with \"Biome does not refuse a require(), an inline import('…').T type, or an import() with a computed specifier\". The rule states applicability, action, and check, widens no permission, weakens no check or gate, and adds no network or credential act; a probe is not a tracked test. The record-architecture-decisions skill says never to rewrite a landed ADR, which supports the cost stated in the body. No active lesson states the same rule: an-origin-check-does-not-see-no-cors-gets covers only Origin checks in browsers, and probe-real-tool-semantics-behind-fakes covers fakes of external tools; both are compatible. The body keeps the inferred cause apart from the observed facts.",
      "related": [
        "state-the-limits-of-a-check-from-a-probe-of-its-configuration"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that each limit claim of a planned document or decision record about a configured check cites a probe of that configuration; it needs separate authorization."
      }
    }
  ]
}
---
# State the limits of a check from a probe of its configuration

## What happened

Tool output: in #255, ADR-0081 recorded a Biome override of `style/noRestrictedImports` with the group `**/../*`. Its first text said that a nested-folder import "matches only when the pattern fits its path depth", and that the rule refuses `require()`, with an inline `import('…').T` type "covered only when it names the listed pattern". A probe with the checkout `biome.jsonc` showed that Biome refuses `../next-step.ts` and `../../next-step.ts` from `engine/lib/a/` (also `../quota-recovery.ts`, a false positive), and refuses neither `require('../next-step.ts')` nor `import('../next-step.ts').X`. The task review caught the first sentence and the final review the second; each cost a fix round of a record that becomes immutable at the landing.

## Root cause

Inferred: the limit sentences came from documentation and plan prose, not from a run of the configured check. The plan's External facts held the right probe results, but the task brief asked for the limits without a probe per claim. Uncertain: the effect of the model tier of the implementer. Alternative: independent slips.

## Fix

Proposed prevention, not proven enforcement: each sentence of a document or a decision record that says what a configured check (a lint rule, a gate job, a guard) refuses or passes names a probe of that configuration that shows it, or quotes the recorded probe of the plan. A structural follow-up needs separate authorization: a plan review check that each limit claim of a planned ADR cites a probe. Judgment decides which sentences are claims about the check, so the rule stays text.

## Rule

Applies when a change writes, in a document or a decision record, what a configured check refuses, passes, or does not cover. Action: run the configured check on a probe input for each such claim (a refused form, a passed form, and each stated limit), or quote the recorded probe of the plan, and write only the observed result. Check: each limit sentence names its probe or the recorded probe, and a rerun of that probe on the final configuration gives the stated result.

## Related lessons

[[probe-real-tool-semantics-behind-fakes]]
