---
{
  "schema": 1,
  "name": "list-the-sites-before-a-document-claims-every-site",
  "description": "ADR-0081 claimed exit 6 at every site, and its fix claimed one exception where the code has two",
  "tags": [
    "process",
    "refix"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#256 and its scoped re-review",
  "incidents": [
    {
      "id": "855161f3-8d7c-4a99-94c5-bbe14934c059",
      "date": "2026-11-08",
      "action": "Task 6 of #256 wrote ADR-0081 with 'A malformed response now ends on the failure path of its call (blocked, exit 6)' and 'A response that its parser refuses throws the one port error GitHubError'. The final-review fix (d4c8ad1) replaced them and added 'The one exception is engine/board/history.ts'.",
      "expected": "A sentence that states a property of every site, or names the one exception, matches the list of sites in the code and in the recorded results.",
      "observed": "Final review: the V8 results show exit 7, exit 5, a longer wait, a warning, a blocked row, and no board data, not exit 6 at each site; the parent refusals carry their own texts; board/history.ts:63 calls parseIssue outside a port method. Scoped re-review of d4c8ad1: GitHub.epic also passes plain Errors of parseEpicRepository (tracker.ts:411, rethrown by parsed) and parseEpicChildren (tracker.ts:447, outside parsed), so 'the one exception' is false.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Minor 1: The exit class in ADR-0081 is too general ... Minor 4: One path does not give GitHubError for a refusal (board/history.ts:63). Re-review: The ADR claims one exception, and the code has two (GitHub.epic passes on refusals of the epic parsers as a plain Error).",
        "reference": "https://github.com/ddinkov10/celetis/issues/256"
      },
      "inference": "Inferred: each writer generalized from the sites it had in view (the landing reads; then the board history call) and did not enumerate the error paths of every method from the code. Alternative: the plan's Global Constraints said 'blocked in the landing and the worktree', which framed the first sentence.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "d4c8ad1138dd47a82254de94f728647ce9de3cc5"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "2a530405-b476-4943-bcc6-863be4f41ee1",
      "requestDigest": "04c576371729e79c309b4e1762cf02113fcf75f9f41a08676aee17310a6cc977",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #256; claude child opus/high\n\nApprove under the reviewer rules: the tool-output excerpts of the final review and its scoped re-review establish the incident, and the cited sites hold in the lane (engine/board/history.ts:63 calls parseIssue outside a port method; engine/lib/tracker.ts calls parseEpicRepository and parseEpicChildren in GitHub.epic). The root cause is labeled as inference with an alternative. The rule states applicability, action, and check, widens no permission, weakens no check, and contradicts no project instruction, skill, or principle. No live or historical lesson states the same rule: check-removed-terms-in-owned-document-sections covers removed terms, and declare-the-exit-classes-of-each-layer-that-runs-a-command covers the declared exit classes of a command, not a universal claim of a document.",
      "related": [
        "list-the-sites-before-a-document-claims-every-site"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision; the rule stays text."
      }
    }
  ]
}
---
# List the sites before a document claims every site

## What happened

ADR-0081 of #256 first said that a malformed response ends as `blocked`, exit 6, and that every refusal throws `GitHubError` with `malformed GitHub data`. The recorded results showed other failure paths and other texts. The fix replaced both sentences and added "The one exception is `engine/board/history.ts`". The scoped re-review found a second path, `GitHub.epic`, that passes plain errors of the epic parsers. The final review allows one fix wave, so the false sentence stayed open.

## Root cause

Inferred, not proven: each writer generalized from the sites in view and did not list every call site or error path from the code before writing a universal claim. Alternative: the plan text framed the first claim.

## Fix

Proposed, needs no structural change: before a document states a property of every site, or names the only exception, list the sites from the code (for example a grep of the callers or of each method's error path) and the recorded results, and write the claim from that list. This stays text: which sites a claim covers needs judgment that no gate can check.

## Rule

Applies when a document, an ADR, or a report states that every site, call, or path has a property, or names the one exception. Action: list each site from the code and the recorded results before writing the sentence, and write the claim so that it holds for each listed site, or name each exception. Check: a reader can map each site of the list to the sentence, and a grep of the sites finds none that the sentence does not cover.
