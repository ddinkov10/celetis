---
{
  "schema": 1,
  "name": "confirm-native-plugin-cache-after-source-pins",
  "description": "A native recovery probe pinned a temporary marketplace but Codex loaded its existing plugin cache",
  "tags": [
    "platform",
    "test",
    "false-positive"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Implementation re-entry of ddinkov10/celetis#236",
  "incidents": [
    {
      "id": "236-reentry-native-cache-source-mismatch-20261105",
      "date": "2026-11-05",
      "action": "The probe used temporary synthetic preflight metadata and a local marketplace source pin while launching native Codex with its existing home. Its initial oracle accepted native continuation from identities, files, and the injected header without validating the skill catalog root.",
      "expected": "A source-bound native continuation result links the plugin files actually selected by the native target to the reviewed checkout.",
      "observed": "The actual Codex request listed r2 as /Users/dinq/.codex/plugins/cache/celetis/celetis/local/skills, while the injected header named /private/tmp/celetis-236-checks/fx/codex-home/plugins/cache/celetis/celetis/local. The initial oracle printed PASS within its transport scope but did not establish full plugin-source proof.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Native request: r2 = /Users/dinq/.codex/plugins/cache/celetis/celetis/local/skills. Header plugin root: /private/tmp/celetis-236-checks/fx/codex-home/plugins/cache/celetis/celetis/local. Initial loaded-resource-proof.json: pluginSkillPaths:[], planEntry:false.",
        "reference": "#236 ae60ba8; docs/superpowers/verification/236-reentry-20261105/provider-request-4-codex.json and native-continuation/source-assessment.json"
      },
      "inference": "A local marketplace source pin does not replace an existing same-version plugin cache. Synthetic preflight cannot establish native cache selection. The native orchestration did work in its recorded scope; actual plan execution was never proved.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ae60ba8b15b8d60498eeeb7b13ea4b073265b4ab"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "69529acc-51b6-4496-b9dd-e6e06796b829",
      "requestDigest": "1d6e3b5cee05a5b61d92d10ff37b077e793a48b7a9995697bed786e06fe1dfa0",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nApprove under the reviewer rules: the retained actual request and header show different plugin roots and an incomplete initial source oracle. The rule requires actual-target cache evidence and file comparison before source-bound PASS, consistent with runtime target confirmation and the project boundary between installed and checkout checks. It grants no real installation, authentication, trust, or host-setting change and keeps the original uncertainty and evidence.",
      "related": [
        "confirm-native-plugin-cache-after-source-pins"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A future authorized native-check helper could retain the actual cache-root and byte-comparison assertions. This review changes no helper or host setting."
      }
    }
  ]
}
---
# Confirm the native plugin cache after a source pin

## What happened

During #236 re-entry, native Claude-to-Codex orchestration completed through loopback provider data. The Codex request still listed the real installed cache, while its injected header named the temporary checkout clone. The first oracle checked the turn, files, identities, and header. Those observations did not establish the full loaded plugin source. The coordinator retained the mismatch assessment and repeated the affected scenario with temporary unsigned-in Codex data. The existing exact fixture trust came from the prior human-approved record; no host trust or real installation changed. The corrected catalog selected the temporary cache, all 290 tracked files matched the checkout, and the native continuation oracle passed.

## Root cause

Inference: the temporary marketplace pin was mistaken for proof of cache selection. Native cache resolution remained bound to CODEX_HOME. The preflight was synthetic, so its plugin report could not establish which cache the actual host loaded.

## Fix

The temporary oracle now asserts the expected cache root in the actual native request and rejects the installed cache root. It also compares checkout and temporary plugin bytes. Proposed prevention is to retain these assertions in a future authorized reusable native-check helper. No permanent enforcement was added. Temporary installation data must keep the existing host executable and must not create another login or change the real installation.

## Rule

When a native plugin check uses a source pin or synthetic preflight, confirm cache selection from the actual target and compare its files with the intended checkout. Reject the source-bound PASS when the target still selects another cache, even if the header, version, and behavioral oracle match.
