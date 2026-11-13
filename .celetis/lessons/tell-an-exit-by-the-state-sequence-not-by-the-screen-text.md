---
{
  "schema": 1,
  "name": "tell-an-exit-by-the-state-sequence-not-by-the-screen-text",
  "description": "Two versions of the coordinator panel told the exit of the host by the text of a read, and the real host printed text at its exit",
  "tags": [
    "ui",
    "refix",
    "e2e"
  ],
  "date": "2026-11-13",
  "status": "active",
  "source": "The implement session of #288 on Claude Code, Verify V3/V4 and the fix task verify-1, 2026-11-13",
  "incidents": [
    {
      "id": "868fabdc-c3cf-4bf7-a1c8-bcd145bb56cf",
      "date": "2026-11-13",
      "action": "The fix task verify-1 (commit a1b4cf7) made the page keep its text only when a `starting` read has an empty text, after the first Verify run saw an End of Codex go through `starting` with an empty screen and show an empty ended log.",
      "expected": "Spec of #288, \"The page\": in `ended` the panel keeps the last text of the session, for each End of each host.",
      "observed": "In the Verify rerun on a1b4cf7, 1 of 6 Ends of Claude Code lost the last text: after /exit Claude prints \"Resume this session with: claude --resume ...\", so the exit `starting` read had a non-empty text that replaced the log (capture after-fix-claude-1440-ended.png).",
      "source": {
        "kind": "tool-output",
        "excerpt": "V3 (Claude) FAIL on End: 1 of 6 Ends lost the last text. After `/exit`, Claude prints \"Resume this session with: claude --resume …\". A `starting` read with that non-empty text replaced the log."
      },
      "inference": "Both the first page code and the verify-1 fix assumed that the exit read can be told from its text. The state sequence (a live state, then `starting`, for the same session id) marks the exit for each host. Uncertain: another host event that drops the status without an exit was not observed.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "a1b4cf72c8bccb324ecc2a7a8c9c744d9d07956c"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "24d20901-a90b-4c11-bfde-d6e93c7bcaf3",
      "requestDigest": "0c5284c215f177381ec999b0ab9b3f052aed18a617ba8eaf2e783de4747d1af9",
      "date": "2026-11-13",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #288; claude child opus/high\n\nEdit, then approve, under the reviewer rules: the proposal has observed evidence (the V3 rerun on a1b4cf7, 1 of 6 Claude Code Ends lost the last text), states applicability, action, and check, widens no permission, and no live lesson states the same rule. The edit makes the example of the Rule say a definite read with no status, so that the rule stays compatible with the active lesson a-failed-process-read-is-not-an-exit, where a failed read is not an end.",
      "related": [
        "tell-an-exit-by-the-state-sequence-not-by-the-screen-text"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal states that the rule stays text, because the right signal depends on the protocol of each external tool."
      }
    }
  ]
}
---
# Tell an exit by the state sequence, not by the screen text

## What happened

In #288, the ended panel of the coordinator must keep the last text of the session. The first Verify run saw a Codex End pass through `starting` with an empty screen, so the ended panel showed an empty log. The fix task verify-1 kept the text only when a `starting` read had an empty text. The rerun saw a Claude End lose the text again: after `/exit`, Claude prints "Resume this session with: claude --resume ...", so the exit read was not empty.

## Root cause

Inferred: both versions tried to tell the exit read from the text of the read, and each host prints a different text at its exit. The sequence of states (a live state, then `starting`, for the same session id) marks the exit independently of the host. Uncertain: no other event that drops the hc status of a live host was observed.

## Fix

Proposed prevention, not enforced: decide a transition of an external session from the sequence of definite states and the identity of the session, not from the content of a screen read. The rule stays text, because the right signal depends on the protocol of each external tool.

## Rule

Applies when code decides from reads of an external program that it ended, restarted, or changed phase, and the program prints text of its own around that change. Action: base the decision on the sequence of definite states for the same identity (for example a live state followed by a definite read with no status for the same session id; a failed read is no state), not on the text or the emptiness of a screen read; test it with each real host that the code serves. Check: a probe with the real exit output of each host (also a non-empty one) gives the same decision, and a control with a new session id gives the other decision.

## Related lessons

[[a-failed-process-read-is-not-an-exit]]
