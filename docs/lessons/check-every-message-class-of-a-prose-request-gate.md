---
{
  "schema": 1,
  "name": "check-every-message-class-of-a-prose-request-gate",
  "description": "Three fix rounds of the start gate of the capture skill each fixed one finding and left or opened a gap for another class of message",
  "tags": [
    "process",
    "refix"
  ],
  "date": "2026-11-06",
  "status": "active",
  "source": "Fix task verify-1 of ddinkov10/celetis#274 (the Verify FAIL of V5), its task review and scoped re-reviews 1-3",
  "incidents": [
    {
      "id": "0d26cc74-68e7-4fae-8108-e516d40c9447",
      "date": "2026-11-06",
      "action": "Fix rounds 1-3 of verify-1 rewrote the start gate of skills/capture/SKILL.md one review finding at a time, and each round ran the reading checks of its own finding",
      "expected": "One gate text that settles every class of message at once: a request to run the skill, a question about it, the capture's job in other words (with an issue, with a comment, with no place), another place that the person names (a file, a document, a memory), and an unrelated request",
      "observed": "Each scoped re-review found a gap that the round opened or left: round 1 added 'To such a message, do not do the job in another way', which refused a handoff document and a memory (re-review 1, N1); round 2 dropped the capture reply for 'Record the decided design on issue #41' (re-review 2, R1); round 3 still excluded a message that names a comment (re-review 3, R1b)",
      "source": {
        "kind": "tool-output",
        "excerpt": "re-review-1 N1: \"The session writes no handoff document ('do not do the job in another way')\"; re-review-2 R1: \"Whether 'record ... on issue #41' names the act 'a comment on an issue' is not settled by the text\"; re-review-3 R1b: \"The session posts a plain comment as a usual request. It does not explain the capture.\"",
        "reference": "lane .superpowers/review-274/verify-1/re-review-1.md, re-review-2.md, re-review-3.md of ddinkov10/celetis#274"
      },
      "inference": "Inferred: the case set grew one review at a time, so a rewording that settled the cases of one finding moved the boundary for a class that no check of that round covered. Uncertain: the classes may also be hard to state exactly in prose at all; a structural check is not available for agent text.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "769d24f"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "aeba9824-cfd0-4025-a086-60b678e0099f",
      "requestDigest": "5c0c0c3c4a74fcb7e4d6882cda1a5493f388d4e54b50d2b710440129f8627da1",
      "date": "2026-11-06",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #274; claude child opus/high\n\nApprove under the reviewer rules: the retained re-reviews of verify-1 (re-review-1.md N1, re-review-2.md R1, re-review-3.md R1b in the lane) establish that each fix round of the start gate of skills/capture/SKILL.md settled its own finding and left or opened a gap for another class of message: a handoff and a memory, a record on a named issue, and a record in a named comment. The rule states applicability (agent text that adds a gate that sorts the messages of a person into classes with different acts), action (write the table of classes and acts before the first wording, include the unrelated requests and each named place, make each row a case of one neutral reading check, and run the whole table on each rewording), and check (each fix round reports every row). It adds checks, weakens none, and widens no permission. It agrees with give-each-agent-rule-a-check-where-its-actor-reads and keep-child-verification-prompts-independent, because the reading check stays neutral. No live or historical lesson states this rule or holds its incident. The body labels the cause as inference with its uncertainty.",
      "related": [
        "check-every-message-class-of-a-prose-request-gate"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The gate is agent text and its oracle is a reading check that needs judgment, so the rule stays text. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Check every message class of a prose request gate on each rewording

## What happened

A Verify scenario of ddinkov10/celetis#274 showed that agents who read `skills/capture/SKILL.md` started the capture with no request that named it. The fix task verify-1 added a start gate in prose. Its task review and three scoped re-reviews each found one more class of message that the current wording got wrong: a question that names the skill, an unrelated request after a read of the file, a handoff or a memory that the person asks for, a record on a named issue, and a record in a named comment. Each round fixed the cases of its finding and ran only those reading checks.

## Root cause

Inferred: no round held the whole table of message classes, so each rewording moved the boundary for a class that its checks did not cover. Uncertain: the classes can also be hard to state exactly in prose.

## Fix

Proposed prevention, as text: before the first wording of such a gate, write the table of message classes with the act of each, including the person's other requests, and make each row a case of one neutral reading check. Each round runs the whole table. Not enforced: the gate is agent text, and the oracle is a reading check that needs judgment, so the rule stays text.

## Rule

Applies when agent text adds a gate that sorts a person's messages into classes with different acts (start, reply, do the other request as usual). Action: write the table of message classes and the act of each before the first wording, include the person's unrelated requests and each named place, and turn each row into a case of one neutral reading check; run the whole table on each rewording. Check: each fix round reports the result of every row of the table, not only the rows of its finding.
