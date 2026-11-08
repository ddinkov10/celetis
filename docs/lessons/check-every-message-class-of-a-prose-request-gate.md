---
{
  "schema": 1,
  "name": "check-every-message-class-of-a-prose-request-gate",
  "description": "Prose gates missed message classes: three fix rounds of the start gate of the capture skill, and a reference question with no class for free-text answers or mixed replies",
  "tags": [
    "process",
    "refix",
    "recurring"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#277 (final-reviewer-277, opus/xhigh, 2026-11-08), reproduced by the build\n\nFix task verify-1 of ddinkov10/celetis#274 (the Verify FAIL of V5), its task review and scoped re-reviews 1-3",
  "incidents": [
    {
      "id": "dd0dab48-fd6a-4501-a19c-350c3659489a",
      "date": "2026-11-08",
      "action": "Task 1 of #277 wrote the reply table of \"The reference question\" in docs/procedures/component-research.md with eight classes; no class covered free text with the meaning of \"Go with these\" (\"no\", \"skip\", \"you pick\"), and none covered a reference and another request in one reply.",
      "expected": "Each reply class of the question has one act, also the free-text forms of each option and a reply that mixes an answer with another request.",
      "observed": "Reading check x3 (claude -p, component-research.md b60725ad at e82ee2e) left \"skip\", \"you pick\", and the other request of a mixed reply \"not settled by the text\"; the rerun of the build also left \"No, I have nothing to add.\" unsettled.",
      "source": {
        "kind": "tool-output",
        "excerpt": "x3: \"(b) skip … This is not settled by the text … The safest row is :61, which asks again\"; \"(c) you pick … This is not settled by the text\"; \"(d) … The README part is not settled by the text\"",
        "reference": "Runtime report on ddinkov10/celetis#277; docs/superpowers/verification/277-final-red/x3 of the main checkout"
      },
      "inference": "The table listed the classes that the plan and the spec named, and treated each option as one literal reply. It did not list the free-text forms of an option or the combined replies. Alternative: the lesson names unrelated requests as a class, but not a reply that answers and also asks for something else.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "e82ee2e57fc46513098201b3c744962386cde3e4",
      "brief": "Task 1 lesson rules: check-every-message-class-of-a-prose-request-gate sha256:b644b928…; plan Task 1 step 2: the table of seven answer classes",
      "lesson": {
        "name": "check-every-message-class-of-a-prose-request-gate",
        "revision": "97e7e3b698cfb2f38bf56569d257457ca7bcd06f",
        "digest": "b644b928462ea1d23473c2b909f6ef268ba245bc07afc0c00ecef42f8426eb13"
      }
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "1df82027-ac0d-4569-ab03-3cda284800f0",
      "requestDigest": "253d68407a69fc3708615f16982de87b9d12ff4f26399eb59f5fd9e46122b483",
      "date": "2026-11-08",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #277; claude child opus/high\n\nMerge under the reviewer rules: the active lesson check-every-message-class-of-a-prose-request-gate states the same rule, and the proposal names it as the lesson that its incident did not follow; the Task 1 brief carried it at its current digest b644b928. The final review of #277 cites this lesson for the same finding. The incident is observed: the reading check x3 of the final review leaves \"skip\", \"you pick\", and the other request of a mixed reply not settled by the text, the rerun of the build also leaves \"No, I have nothing to add.\" unsettled, and lane commit ad306ab adds the two rows to docs/procedures/component-research.md. Attributed correction: the quoted x3 excerpt of the incident is in 277-final-review/checks/x3 and its report.md; 277-final-red/x3, which the reference names, holds the rerun of the build, with the same results for \"skip\", \"you pick\", and the mixed reply in other words. The reply table of a question is a gate that sorts a person's messages into classes with different acts. So the survivor keeps the active name, both incidents, and the earlier review, and adds the classes that a question needs: the free-text forms of each answer, and a reply that answers and also asks for something else, with an act for each part. The body keeps the facts apart from the inferred causes; for \"skip\", x3 took the safest row, which asks again. The rule adds checks, weakens none, widens no permission, adds no network or credential act, and agrees with \"The reference question\" of docs/procedures/component-research.md, the question parts of docs/procedures/design.md, and keep-child-verification-prompts-independent, because the reading check stays neutral. By the principle encode-lessons-in-structure, the rule stays text: the meaning of free text is a judgment.",
      "related": [
        "map-free-text-and-mixed-replies-of-a-question-gate",
        "check-every-message-class-of-a-prose-request-gate"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the classes of a gate and the meaning of free text need judgment, and the oracle is a reading check. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Check every message class of a prose request gate on each rewording

## What happened

A Verify scenario of ddinkov10/celetis#274 showed that agents who read `skills/capture/SKILL.md` started the capture with no request that named it. The fix task verify-1 added a start gate in prose. Its task review and three scoped re-reviews each found one more class of message that the current wording got wrong: a question that names the skill, an unrelated request after a read of the file, a handoff or a memory that the person asks for, a record on a named issue, and a record in a named comment. Each round fixed the cases of its finding and ran only those reading checks.

In #277, Task 1 wrote the reply table of "The reference question" in `docs/procedures/component-research.md` with eight rows, among them a row for each answer, a row for free text that adds, drops, or swaps a model, and a row for a reply that does not answer the question. No row covered free text with the meaning of "Go with these" ("no", "skip", "you pick"), and no row covered a reference and another request in one reply. The reading check x3 of the final review left "skip", "you pick", and the other request of a mixed reply "not settled by the text", and for "skip" it took the safest row, which asks the reference question again. The rerun of the build also left "No, I have nothing to add." unsettled. The Task 1 brief carried this lesson.

## Root cause

Inferred: no round held the whole table of message classes, so each rewording moved the boundary for a class that its checks did not cover. Uncertain: the classes can also be hard to state exactly in prose.

In #277, inferred: the table took its classes from the plan and the spec, and it treated each answer as one literal reply. The person can answer the host question in free text in place of an answer, as the row for free text that changes the models shows, so each answer also has free-text forms. Alternative: the rule of this lesson named the person's unrelated requests as a class, but not a reply that answers and also asks for something else.

## Fix

Proposed prevention, as text: before the first wording of such a gate, write the table of message classes with the act of each, including the person's other requests, and make each row a case of one neutral reading check. Each round runs the whole table. Not enforced: the gate is agent text, and the oracle is a reading check that needs judgment, so the rule stays text.

The fix of #277 added two rows: free text with the meaning of "Go with these", and a reference with another request. Proposed prevention, not proven: the reading check of a question gate gets one case for a free-text form of each answer and one for a mixed reply. The meaning of free text is a judgment, so this part stays text too.

## Rule

Applies when agent text adds a gate that sorts a person's messages into classes with different acts (start, reply, do the other request as usual), also the reply table of a question with fixed answers that the person can answer in free text too. Action: write the table of message classes and the act of each before the first wording, include the person's unrelated requests and each named place, and turn each row into a case of one neutral reading check. For a question, add for each answer the class of free text with its meaning, and the class of a reply that answers and also asks for something else, with an act for each part. Run the whole table on each rewording. Check: each fix round reports the result of every row of the table, not only the rows of its finding, and the reading check of a question has a case for a free-text form of each answer and for a mixed reply, each settled with one act.
