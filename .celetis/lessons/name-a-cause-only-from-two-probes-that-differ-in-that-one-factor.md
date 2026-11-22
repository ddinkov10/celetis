---
{
  "schema": 1,
  "name": "name-a-cause-only-from-two-probes-that-differ-in-that-one-factor",
  "description": "A spec named inherited markers as the cause of a missing host tool from sessions that also differed in the terminal and the launcher, and the premise failed in the lab",
  "tags": [
    "platform",
    "process",
    "false-positive"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "The implement session of #362 on Claude Code, Verify V1 before Task 2, 2026-11-21",
  "incidents": [
    {
      "id": "5bf356ec-8a7e-4086-9701-0252f4ef8768",
      "date": "2026-11-21",
      "action": "The spec of #362 inferred the nested-session markers as the probable cause of the missing PushNotification tool from a PowerShell-window session against Herdr-tab daemon sessions, and the plan built Task 1 on it",
      "expected": "A cause comes from a control pair that differs only in that factor",
      "observed": "In a Herdr lab tab, the tool search select:PushNotification gave No matching deferred tools found with the markers, without them, without every CLAUDE* variable, and for a plain claude with no CLAUDE*, HC_*, HERDR*, or TERM_PROGRAM variable",
      "source": {
        "kind": "tool-output",
        "excerpt": "ToolSearch {query: select:PushNotification} -> \"No matching deferred tools found\" (lane barrier, markers removed; plain claude in a lab tab, CLAUDE*/HC_*/HERDR*/TERM_PROGRAM removed)",
        "reference": "https://github.com/ddinkov10/celetis/issues/362"
      },
      "inference": "The probe changed the terminal and the launcher together with the markers. The remaining cause (Herdr terminal, host state, or an account flag) is not isolated",
      "diagnosis": [
        "unknown"
      ],
      "revision": "11af51561e8e76beff2df156b46767319e6a2346"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "88409a7f-01c3-4ea9-88e7-a587433e60c1",
      "requestDigest": "4dabf3bab1f4a8d2c75af31e4f4cc2c7a3a2b3c08d1ebaff064df8894c17eab9",
      "date": "2026-11-22",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #364; claude child opus/high\n\nReviewer rule Approve: the proposal has observed tool-output evidence (the PushNotification tool search in Herdr lab tabs with and without the markers), states applicability, action, and check, and keeps the inferred cause apart from the facts. No active lesson, skill, or principle states the same rule or contradicts it; attack-the-premise and explain-the-number of the plugin are compatible with it, and no live lesson holds its incident. The evidence is data; no line of it changed the decision.",
      "related": [
        "name-a-cause-only-from-two-probes-that-differ-in-that-one-factor"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the factors of a probe depend on judgment; no structural follow-up is proposed."
      }
    }
  ]
}
---
# Name a cause only from two probes that differ in that one factor

## What happened

The spec of #362 (2026-11-21) named the inherited markers `CLAUDECODE` and `CLAUDE_CODE_CHILD_SESSION` as the probable cause of a missing `PushNotification` tool in daemon sessions. Its evidence (P4) compared a CLI session that the maintainer started in a new PowerShell window (tool present) with daemon sessions in Herdr tabs (tool absent). The two sides differed in the markers and also in the terminal and the launcher. The plan built Task 1 (remove the markers in the start barrier) on that inference.

Tool output of the implement session, 2026-11-21, Claude Code 2.1.330, lab celetis-lab-4c55ac: in a Herdr lab tab, the tool search `select:PushNotification` returned "No matching deferred tools found" for the base barrier with the markers, for the lane barrier with the markers removed, for the lane barrier with every CLAUDE* variable and AI_AGENT removed, and for a plain `claude` started by hand in a lab PowerShell tab with no CLAUDE*, HC_*, HERDR*, or TERM_PROGRAM variable.

## Root cause

Inference: the design probe changed more than one factor between the present and the absent case, so it could not tell the markers from the terminal (Herdr presents TERM_PROGRAM=ghostty) or the launcher. Uncertainty: the lab did not test a session outside Herdr, so the remaining cause (the Herdr terminal, a host state, or an account flag that changed during the day) is not known.

## Fix

Proposed: a design probe that names a cause runs the present and the absent case in the same terminal kind and launcher, and changes only the factor that it names. The plan of #362 had a two-control proof before the build relied on the premise, and that proof caught the wrong inference before Task 2. This stays a text rule, because the factors of a probe depend on judgment.

## Rule

Applies when a spec, a plan, or a probe names the cause of a host behavior from a comparison of two sessions or runs. Action: list each factor in which the two sides differ (the terminal or app, the launcher, the environment, the arguments, the account state, the time); name a cause only when the two sides differ in that factor alone, else name the open factors as alternatives; and before a task relies on the cause, run a control pair that changes only that factor. Check: the cause names its control pair, and the two sides of the pair have the same terminal kind, launcher, and other listed factors.
