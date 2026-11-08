---
{
  "schema": 1,
  "name": "keep-the-seed-terminal-of-a-lab-space-until-the-lab-ends",
  "description": "Lab cleanups between scenarios ended the seed terminal: once the lab window closed, and once a second probe process that did not know the seed replaced it",
  "tags": [
    "e2e",
    "process",
    "test",
    "recurring"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Renewed Verify phase of ddinkov10/celetis#266 (V6, lab celetis-lab-63fd18)\n\nVerify phase of ddinkov10/celetis#255, part C (lab)",
  "incidents": [
    {
      "id": "e3842ff7-bb41-49ba-849d-5ce264953cb8",
      "date": "2026-11-09",
      "action": "The Verify child of #266 ran V5 and V6 as two probe processes in the one lab celetis-lab-63fd18. The V6 process started with no known seed terminal, and its first cleanup (`settle('f-control')`) ended every hc terminal of the lab, the V5 seed `t1` too; it then made a new seed `t6`.",
      "expected": "The seed terminal of the lab space stays from the first scenario until `down`; a cleanup between scenarios ends only the terminals that its scenario started.",
      "observed": "After attempt 1 of V6, `hc ls --json` of the lab listed only `t6` (`\"where\":\"repo / seed\"`), and `herdr-app ls` had one space `repo` with the seed tab of `t6`; the V5 record names seed `t1`. The lab still answered.",
      "source": {
        "kind": "tool-output",
        "excerpt": "f-control: setup: the space repo exists with one seed tab (/bin/sleep, no host, terminal t6) — after the V5 record of seed t1 (E/V5/starts/seed.json)",
        "reference": "ddinkov10/celetis#266 comment 6728436694 (renewed runtime report), section Corrections"
      },
      "inference": "Reported by the child, cause inferred: the seed identity lived only in the memory of one probe process, and a new probe process in the same lab had no seed to spare, so its generic cleanup ended all terminals. Uncertain: whether the lab script could have refused the end of the seed. Alternative: one probe process for all lab scenarios.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "d975aae81b7ebf240350d25c846b16245214318a",
      "brief": "The renewed Verify brief of #266 carried keep-the-seed-terminal-of-a-lab-space-until-the-lab-ends (sha256 76817c6b...) with its full Rule: between scenarios, end only the terminals that the scenario started, and keep the seed terminal of each lab space until down.",
      "lesson": {
        "name": "keep-the-seed-terminal-of-a-lab-space-until-the-lab-ends",
        "revision": "d975aae81b7ebf240350d25c846b16245214318a",
        "digest": "76817c6b8f615eebf77cc864bbccdfc0d8a226dafa40db1ee9733fbd0a8eff67"
      }
    },
    {
      "id": "f7eb7903-7a80-4fc2-ab54-fe17e73410a2",
      "date": "2026-11-08",
      "action": "A Verify child of #255 ran a cleanup after the V3 cards scenario in lab celetis-lab-8fb4da that ended every hc terminal of the lab, the seed tab (/bin/sleep) of the space too, before the next scenario (V4 e) of the same lab.",
      "expected": "The lab window and its space stay for the next scenario of the same Verify run, so its daemon can start in the lab.",
      "observed": "`herdr-app status` in the lab gave {\"error\": \"the window did not answer\"}, the lab view.json had \"spaces\": {}, and `daemon start` exited 6 with \"daemon: the Herdr app does not answer: the window did not answer; open the Herdr app window, then start again\". The controller allowed a second lab (`down`, then `up`) for V4 e only.",
      "source": {
        "kind": "tool-output",
        "excerpt": "daemon: the Herdr app does not answer: the window did not answer; open the Herdr app window, then start again (exit 6); herdr-app status: {\"error\": \"the window did not answer\"}",
        "reference": "/Users/dinq/Dinq/PROJECTS/celetis/docs/superpowers/verification/255-verify/c-lab/v4e-base-try1.out"
      },
      "inference": "Reported by the child (tool output), cause inferred: the Herdr app closes the lab window some time after the last space of the lab closes, and a space closes with its last terminal. Uncertain: the delay and whether a new space would reopen the window. Alternative: an app quirk of herdr-app 0.1.14.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f2cf38f6a60110b2b9774c6cccde8b53821346db"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "2a0dba81-ea8f-4149-8812-5fd958dc7c31",
      "requestDigest": "20c2fb97ce3d6c0750954d9054fb25e2097c627ee065e5a29935c6a890e7b158",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #255; claude child opus/high\n\nApprove under the reviewer rules: the tool output (herdr-app status {\"error\": \"the window did not answer\"} and the daemon start exit 6 line) establishes the incident, and the root cause is labeled as inference with its alternatives. The rule states applicability, action, and check, grants no permission, adds no network or credential act, and weakens no check. It agrees with the project instructions that one lab serves one Verify run, and with the seed tab of keep-launch-variables-when-a-launch-moves-terminals, which makes the seed tab but does not say how long it stays. No active lesson states this cleanup rule.",
      "related": [
        "keep-the-seed-terminal-of-a-lab-space-until-the-lab-ends"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Proposed in the incident, not authorized: scripts/herdr-lab.ts could offer a cleanup that keeps the seed terminal, or refuse run after the lab window closed with a line that names the cause. It needs a separate authorization and check."
      }
    },
    {
      "id": "86856db7-bba5-44df-8b2c-5938788b6266",
      "requestDigest": "2230e2f5045de983fccf706afff7ab1354b7f96f005a230fd7fd008b951a093a",
      "date": "2026-11-09",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #266; claude child opus/high\n\nMerge under the reviewer rules: the active lesson keep-the-seed-terminal-of-a-lab-space-until-the-lab-ends states the same rule (end only the terminals that the scenario started, keep the seed until down), and the proposal's incident is a recurrence of that rule with the rule in the brief (diagnosis not-followed). The tool output (hc ls listed only the new seed t6 after the V5 record of seed t1) establishes the incident; the cause stays labeled as inference. The survivor keeps both incidents, adds the tag recurring, and adds the proposal's action as a step of the same rule: each probe process reads the seed at its start. The rule grants no permission, weakens no check, and agrees with AGENTS.md, Host checks (one lab serves one Verify run). The structural follow-up stays proposed.",
      "related": [
        "adopt-the-seed-terminal-in-each-lab-probe-process",
        "keep-the-seed-terminal-of-a-lab-space-until-the-lab-ends"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Proposed in both incidents, not authorized: scripts/herdr-lab.ts could offer a cleanup that keeps the seed terminal of each space, so that no probe writes its own terminal sweep, and its check would refuse to end the seed. It needs a separate authorization and check."
      }
    }
  ]
}
---
# Keep the seed terminal of a lab space until the lab ends

## What happened

Tool output: in the Verify phase of #255, a child cleaned up after one lab scenario by ending every hc terminal of the lab, the seed tab of its space too. The lab space closed, `herdr-app status` in the lab gave `{"error": "the window did not answer"}`, and the next `daemon start` in that lab exited 6 with "the Herdr app does not answer". The run needed a second lab for the last scenario.

Tool output: in the renewed Verify phase of #266, V5 and V6 ran as two probe processes in one lab of `scripts/herdr-lab.ts`. The brief carried this rule. The V6 process started with no known seed, and its first cleanup ended every terminal of the lab, the V5 seed `t1` too, then made a new seed `t6`. The lab still answered. The child kept that attempt apart with no PASS, made the probe adopt the existing seed of the space at its start, and ran V6 again: `t6` stayed until `down`.

## Root cause

Inferred from the child's observations in #255: the Herdr app of the lab closes its window after the last space closes, and the space closes with its last terminal. Uncertain: the delay, and whether a new seed tab could reopen the space. Alternative: an app quirk of herdr-app 0.1.14.

Inferred in #266: the seed identity lived only in the memory of one probe process, so a second process of the same lab could not tell the seed from a scenario terminal, and its generic cleanup ended all terminals. Uncertain: whether one probe process for all scenarios would have avoided it in every case.

## Fix

Proposed prevention, not proven enforcement: a lab cleanup between scenarios ends only the terminals that a scenario started (for example the session terminals of the daemon), and keeps the seed terminal of each space until `down`. Each probe process reads and records the seed terminal of each lab space at its start, before its first cleanup. A structural follow-up needs separate authorization: `scripts/herdr-lab.ts` could offer a cleanup that keeps the seed terminal, or refuse `run` after the lab window closed with a line that names the cause. Which terminals a probe owns is a judgment of each probe, so the rule stays text.

## Rule

Applies when a check runs more than one scenario in one lab of `scripts/herdr-lab.ts`, in one probe process or in more. Action: at the start of each probe process, read and record the seed terminal of each lab space before the first cleanup; between scenarios, end only the terminals that the scenario started, and keep the seed terminal of each lab space until `down`. Check: the evidence of each probe process shows the seed id that it read at its start; after each cleanup, `herdr-app status` through `run <id>` answers, and the lab space still lists that same seed terminal until `down`.

## Related lessons

[[keep-launch-variables-when-a-launch-moves-terminals]]
