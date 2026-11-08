---
{
  "schema": 1,
  "name": "keep-the-seed-terminal-of-a-lab-space-until-the-lab-ends",
  "description": "A lab cleanup between scenarios ended the seed terminal too, the lab space and window closed, and the next daemon start in that lab exited 6",
  "tags": [
    "e2e",
    "process",
    "test"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Verify phase of ddinkov10/celetis#255, part C (lab)",
  "incidents": [
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
  "recurrences": 0,
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
    }
  ]
}
---
# Keep the seed terminal of a lab space until the lab ends

## What happened

Tool output: in the Verify phase of #255, a child cleaned up after one lab scenario by ending every hc terminal of the lab, the seed tab of its space too. The lab space closed, `herdr-app status` in the lab gave `{"error": "the window did not answer"}`, and the next `daemon start` in that lab exited 6 with "the Herdr app does not answer". The run needed a second lab for the last scenario.

## Root cause

Inferred from the child's observations: the Herdr app of the lab closes its window after the last space closes, and the space closes with its last terminal. Uncertain: the delay, and whether a new seed tab could reopen the space. Alternative: an app quirk of herdr-app 0.1.14.

## Fix

Proposed prevention, not proven enforcement: a lab cleanup between scenarios ends only the terminals that a scenario started (for example the session terminals of the daemon), and keeps the seed terminal of each space until `down`. A structural follow-up needs separate authorization: `scripts/herdr-lab.ts` could offer a cleanup that keeps the seed terminal, or refuse `run` after the lab window closed with a line that names the cause. Which terminals a probe owns is a judgment of each probe, so the rule stays text.

## Rule

Applies when a check runs more than one scenario in one lab of `scripts/herdr-lab.ts`. Action: between scenarios, end only the terminals that the scenario started, and keep the seed terminal of each lab space until `down`. Check: after each cleanup, `herdr-app status` through `run <id>` answers, and the lab space still lists its seed terminal.

## Related lessons

[[keep-launch-variables-when-a-launch-moves-terminals]]
