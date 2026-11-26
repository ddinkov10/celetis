---
{
  "schema": 1,
  "name": "search-reads-outside-the-port-before-a-port-claims-one-boundary",
  "description": "A trust rule at the GitHub tracker port of #393 missed a GraphQL title read of the board outside the port, and a queue caller that dropped the reason line of the refusal",
  "tags": [
    "api",
    "process"
  ],
  "date": "2026-11-26",
  "status": "active",
  "source": "The implement session of #393 on Claude Code, final whole-branch review, 2026-11-26",
  "incidents": [
    {
      "id": "cb4d4d11-8b3c-4b39-a4df-fd157f3fe4c0",
      "date": "2026-11-26",
      "action": "Task 1 of #393 put the trust rule in the reading methods of engine/lib/github/tracker.ts and audited callers with a grep of those method names; the caller table sent run and the queue to a source trace with no probe.",
      "expected": "Each read of GitHub issue text in the engine applies the rule (spec Requirement 1: absent from the board), and each caller of the refused read prints the reason line (spec Requirement 2).",
      "observed": "The final reviewer showed that readIssues of engine/lib/board-read/board-read.ts read issueOrPullRequest { title } through GraphQL outside the port, so readBoard gave history [\"2 issue 2 title\"] for an untrusted #2, and that admitQueue of engine/lib/queue/actions.ts printed \"queue: the displayed decision changed: stop cannot read #2 from GitHub\" with no reason line.",
      "source": {
        "kind": "tool-output",
        "excerpt": "readBoard history: [\"2 issue 2 title\"]; queue: 2 refused: queue: the displayed decision changed: stop cannot read #2 from GitHub code 3",
        "reference": "https://github.com/ddinkov10/celetis/issues/393"
      },
      "inference": "Inferred: the grep listed only callers of the port methods, so a direct API read of the same data outside the port and a caller two hops away (through nextIssue, which returns stderr that the caller drops) were not listed. Alternative: the plan table named the queue but traded its probe for a source trace.",
      "diagnosis": [
        "not-followed",
        "wrong-or-incomplete-rule"
      ],
      "revision": "a80a8faa",
      "brief": "Plan of #393, table \"The callers of the refused read\": run and the queue reach the read only through nextIssue and readDecision; the report names this source trace and claims no runtime PASS for run.",
      "lesson": {
        "name": "find-every-caller-of-a-refusal-before-claiming-an-input-now-passes",
        "revision": "653dce0f",
        "digest": "46f76552383aa6f21ab56e72e3def857be7d532d2e22fe32301d4e97411be7b8"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "24856414-a942-4c51-81a0-007c9ac5c02a",
      "requestDigest": "f23f54705ec2272ceebba77a0ab1bc2137531fe687f230057ed2bef228f882e9",
      "date": "2026-11-26",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #393; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence (readBoard gave the history title of an untrusted #2 through a GraphQL read in board-read.ts outside the tracker port, and admitQueue refused with no reason line), and fix a80a8faa matches it; its rule states applicability, action, and check; it widens no permission, skips no check, adds no network or credential act, and agrees with the principle boundary-discipline of the plugin celetis. No live or historical lesson holds its incident. It is not a merge: find-every-caller-of-a-refusal-before-claiming-an-input-now-passes applies when a refusal is removed and an input now passes, and list-the-sites-before-a-document-claims-every-site applies to a sentence of a document; neither tells the author to search the reads of the same external objects that do not go through the port, which is the new action here. The body labels the cause as inferred.",
      "related": [
        "search-reads-outside-the-port-before-a-port-claims-one-boundary"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the set of reads of an external API outside a port is not a fixed name list, so no gate can check it. This review changes lesson data only."
      }
    }
  ]
}
---
# Search every read of the data outside a port before a port claims to be the one boundary

## What happened

#393 put a trust rule for GitHub issue text in the reading methods of the tracker port. The caller audit was a grep of the names of those methods. The final review found two misses. The board history read the title of each landed issue with its own GraphQL query, outside the port, so an issue of an untrusted author showed its title. A queue action read the issue through `nextIssue`, which returns the stderr of the read, and dropped that stderr, so its refusal had no reason line. The plan had sent the queue to a source trace with no probe.

## Root cause

Inferred: a grep of the port methods lists only direct callers. It does not list a read of the same external data through another client call, and it does not show what a caller two hops away prints. Uncertain: the plan also chose a source trace over a probe for the queue.

## Fix

Proposed prevention, text only: before a document or a plan claims that one port is the only boundary of an external input, search for each read of that input that does not go through the port (for example each GraphQL field or REST path of the same objects), and probe each caller of the refusal through its real entry, also a caller that reaches the read through a helper. A structural check is unsuitable because the set of reads of an external API is not a fixed name list.

## Rule

Applies when a change puts a rule (trust, validation, filtering) on an external input at one port or adapter, and a plan, a document, or a record claims that the port is the one place of the rule, or that each caller shows its refusal. Action: search the code for each read of the same external objects outside the port (the client calls, the query fields, and the paths), and list each with its handling; trace each caller of the refused read through each helper to the line that it prints, and probe it through its real entry. Check: a search of the client calls and query fields of the input names no read outside the port that the list leaves out, and the probe output of each listed caller holds the refusal line.

## Related lessons

- [[find-every-caller-of-a-refusal-before-claiming-an-input-now-passes]]
- [[list-the-sites-before-a-document-claims-every-site]]
