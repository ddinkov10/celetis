---
{
  "schema": 1,
  "name": "write-browser-observations-once-after-all-reads",
  "description": "A probe read an observation file that the browser observer wrote before its observation was complete",
  "tags": [
    "test",
    "e2e",
    "false-negative"
  ],
  "date": "2026-11-07",
  "status": "active",
  "source": "Verify phase of ddinkov10/celetis#249 (verification child, build 642c5e0)",
  "incidents": [
    {
      "id": "5d0c2a8e-6f41-4b7e-9a3c-2e1f0b7d9c44",
      "date": "2026-11-07",
      "action": "The verifier wrote an early obs-v4.json (the board #announce region, empty) while queue-retry.ts waited for that file.",
      "expected": "The observation file appears once, after every read of the observation.",
      "observed": "The probe read the early file and printed a V4 page FAIL with []; the later file shows the Retry announcement in the agent picker's own aria-live region, which has no id.",
      "source": {
        "kind": "tool-output",
        "excerpt": "V4 page … FAIL [] (superseded); obs-v4-full.json: \"Retry requested for #5. Its run starts one attempt with the current order.\" in the picker live region",
        "reference": "ddinkov10/celetis#249 lane docs/superpowers/verification/249-verify/V5/queue-retry.out, obs-v4.json, obs-v4-full.json"
      },
      "inference": "Inferred: the probe used the existence of the file as its completion condition, and the observer wrote it before the full read; the observer also named the live region by id `announce`, while the picker owns a second live region with no id. Uncertain which of the two caused the empty early file.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "642c5e08c22ed61015017ccbd2c3ce67b54d144e",
      "brief": "The Verify brief carried the plan's Verify lesson rules (keep-child-verification-prompts-independent, check-retained-verification-fixtures-against-current-boundaries, keep-launch-variables-when-a-launch-moves-terminals, match-process-tokens-only-in-the-environment, probe-real-tool-semantics-behind-fakes, match-each-verify-oracle-to-a-producing-task-step), not isolate-verification-barriers-per-attempt.",
      "lesson": {
        "name": "isolate-verification-barriers-per-attempt",
        "revision": "642c5e08c22ed61015017ccbd2c3ce67b54d144e",
        "digest": "450c7be235b09edabcfc6369b1692d993fb022dc6c8d31e4886a686f5a3701e1"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "21da0802-bcbd-4006-afa6-c981bec3e433",
      "requestDigest": "e9c8461c9d0ffc9b98b461644243a6e91d8f83f5a0a1216d998973448896962b",
      "date": "2026-11-07",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #249; claude child opus/high\n\nEdit under the reviewer rules. The incident is observed: queue-retry.out of the #249 Verify retains \"check V4 page: ... FAIL []\", and the retained observation files show an empty #announce observation and a later observation with the Retry announcement in the agent picker live region. No active lesson states the same rule: isolate-verification-barriers-per-attempt covers a completion condition that an earlier run satisfies, not a partial write of the current run. The rule states applicability, action, and check, and contradicts no skill, principle, or instruction file. Attributed correction of the incident excerpt: it puts the picker announcement in obs-v4-full.json, but the retained bytes have it in obs-v4.json (05:26:09), and obs-v4-full.json (05:25:47) holds the empty #announce observation. The edit states the files as retained, keeps the inferred cause apart from the facts, and keeps the incident evidence unchanged.",
      "related": [
        "write-browser-observations-once-after-all-reads"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A shared observer helper for browser probes that writes its file atomically and reads every aria-live region; it needs separate authorization."
      }
    }
  ]
}
---
# Write a browser observation file once, after all its reads

## What happened

In the Verify phase of #249, a probe (`queue-retry.ts`) waited for the browser observation file `obs-v4.json` and printed `check V4 page: ... FAIL []` (`queue-retry.out`). The retained `obs-v4-full.json` (written at 05:25:47) holds an observation of the board `#announce` region with an empty `announce` list. The retained `obs-v4.json` (written again at 05:26:09) holds the Retry announcement "Retry requested for #5. Its run starts one attempt with the current order." from the aria-live region of the agent picker, a `<p>` with no id, and says that the `#announce` region of the board stayed empty. So the probe read an earlier version of the file that held no announcement.

## Root cause

Inferred: the existence of the file was the completion condition of the probe, so a write before the observation was complete satisfied it, and the later corrected write came too late. The observer also first read the live region by the id `announce`, while the announcement went to a second live region with no id. Uncertain which of the two made the early file empty; the evidence supports both.

## Fix

Proposed prevention, not proven enforcement: an observer writes to a temporary name and renames the file into place only after all its reads; it finds live regions by `[aria-live]`, not by one id. The related lesson isolate-verification-barriers-per-attempt covers a completion condition that an earlier run satisfies; this rule covers a partial result of the current run. The rule stays text because each probe has its own hand-off between the browser and the program.

## Rule

Applies when a probe program waits for a file that a browser or another agent writes as its observation. Action: write the file to a temporary name and rename it into place only after every read, and find each live region by `[aria-live]`. Check: a probe run with a deliberately slow observer still waits for the final file, and the observation names each aria-live region of the page.

## Related lessons

[[isolate-verification-barriers-per-attempt]]
[[check-visible-surfaces-before-composing-browser-probes]]
