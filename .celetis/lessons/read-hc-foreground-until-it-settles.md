---
{
  "schema": 1,
  "name": "read-hc-foreground-until-it-settles",
  "description": "A plan read the hc foreground once at process start, and hc still reported the previous job",
  "tags": [
    "platform-quirk",
    "false-negative"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "implement session of ddinkov10/celetis#228, Task 1 step 4 (V1 positive control)",
  "incidents": [
    {
      "id": "a0ef3e4a-a66b-4580-bdb2-28c27162b446",
      "date": "2026-11-02",
      "action": "The plan of #228 made ownTerminal read hc get <id> once and compare foreground.pid with process.pid at the start of the runner.",
      "expected": "The foreground leader of a fresh hc terminal gets its own terminal from ownTerminal (positive control of V1).",
      "observed": "The leader got the 'does not lead' stop. A probe in the same board-shaped start (zsh -lic) showed hc get reporting the PID of an exited ssh-add from the login files for about 450 ms, then the probe's own PID.",
      "source": {
        "kind": "tool-output",
        "excerpt": "v1.json: outerPid 12939, outerOwn \"error: this runner does not lead hc terminal t47 ...\"; hc get t47 later: foreground 12939. probe.json: [384 ms, fg 13207 ssh-add] then [451 ms, fg 13227 bun].",
        "reference": "https://github.com/ddinkov10/celetis/issues/228#issuecomment-6578301256"
      },
      "inference": "Tool output shows the stale value; the cause inside hc (a sampled or lazily refreshed foreground) is inferred and not confirmed in hc documentation. The 5 s poll limit rests on one 451 ms sample.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "a6bee7a"
    },
    {
      "id": "c0606eaa-df89-4ccc-80e5-795f69b0ca82",
      "date": "2026-11-03",
      "action": "The Verify script v3a.ts of #233 read foreground.pid of the hidden runner R2 once, right after hc ls --label celetis.runner=#2 first listed it, and failed the check that R2 runs the program clone celetis-flow.ts",
      "expected": "The check reads the foreground until the runner process appears or a bounded limit passes",
      "observed": "At +0.72 s hc get R2 gave no foreground PID (an empty command); about one minute later hc get R2 gave foreground 63196, `bun.exe … <program>/engine/celetis-flow.ts --agent claude …`, with the lab token in its environment",
      "source": {
        "kind": "tool-output",
        "excerpt": "0.71 R2 t5 0.377 / 0.72 PASS R2 runs with --quiet () / 0.72 FAIL R2 runs the program clone celetis-flow.ts ... later: {\"state\":\"live\",\"labels\":{\"celetis.runner\":\"#2\"},\"fg\":63196,\"quiet\":true}",
        "reference": "https://github.com/ddinkov10/celetis/issues/233#issuecomment-6606651110"
      },
      "inference": "Same staleness as the #228 incident: hc sets the foreground of a new terminal after a delay. The rule was pending, and task retrieval reads only active lessons, so it did not reach the Verify session.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "6e5c2ae8223c311ac63316479d39feaad1c1b540",
      "brief": "celetis --agent claude lesson-store read active gave active [] at each task boundary of #233",
      "lesson": {
        "name": "read-hc-foreground-until-it-settles",
        "revision": "pending bff8e8f3-0bef-4b4b-96b3-ce3a22b16cc4",
        "digest": "e75f3e0774b2b07c22acad71d5ee9e4af192e6ffd7e88c6b954dddbf407d9a9a"
      }
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "9a9da720-7a7d-4d46-b64e-274fab338030",
      "requestDigest": "2075ae15c86cf5d9d3c67574776f5bdb8bd9d9a0b8e39b7fbf795a5ace91399e",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #245; codex child host default/high\n\nApprove under the reviewer rules: the retained positive-control failure and delayed foreground observations establish stale reads at job start. The rule gives a bounded observation policy and a fresh-terminal positive control. It preserves immediate handling of read errors and does not bypass target confirmation, the project lab boundary, or a permission check. Its platform explanation and polling-limit evidence remain explicitly uncertain. It agrees with the domain-model and behavioral-check principles and the runtime target-confirmation procedure.",
      "related": [
        "read-hc-foreground-until-it-settles"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The polling bound depends on the caller and its approved behavior. This review adds no structural follow-up."
      }
    }
  ]
}
---
# Poll hc foreground state until it settles before a decision

## What happened

The plan of #228 decided terminal ownership from one `hc get` read at runner start. In the build, the real foreground leader of a fresh terminal failed the check. A probe showed that `hc get` reported the previous foreground job (an exited `ssh-add` of the zsh login files) for about 450 ms after the new job took the terminal.

In #233, the Verify script of V3 read `foreground` of the board's hidden runner once, 0.01 s after `hc ls --label celetis.runner=#2` first listed it. The read had no foreground PID, and the script failed its target check; a later read showed the runner `<program>/engine/celetis-flow.ts`.

## Root cause

Inferred: herdr-core 0.1.16 refreshes `foreground` after a delay, so its answer right after a job change is stale. Not confirmed in the hc schema, which documents no refresh interval. The plan treated the value as live.

## Fix

Proposed and applied in #228: `ownTerminal` polls `hc get` every 250 ms for up to 5 seconds with the existing `poll` helper, and a read error still stops at once. No structural check enforces this for other callers; the rule stays text because the right limit depends on the decision that uses the value.

## Detection signature

A process that is the foreground leader (as a later `hc get` shows) is refused right after its start.

## Rule

When a decision uses `foreground` of `hc get` shortly after a job starts or ends in that terminal, read until the expected value appears or a bounded limit passes, and test the decision with a positive control that runs in a fresh terminal.
