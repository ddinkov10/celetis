---
{
  "schema": 1,
  "name": "count-the-calls-of-a-split-batch-on-a-cold-cache-with-a-long-tail",
  "description": "A cached History walk asked for the PRs of one or two commits per query, so a cold walk past many commits with no issue sent about one GraphQL query per commit",
  "tags": [
    "api",
    "performance",
    "test"
  ],
  "date": "2026-11-18",
  "status": "active",
  "source": "The implement session of #332 on Claude Code, task review of Task 3, 2026-11-18",
  "incidents": [
    {
      "id": "4be0882a-5212-476b-9159-ab5355fc4288",
      "date": "2026-11-18",
      "action": "Task 3 of #332 moved the PR lookup of readHistory (engine/lib/board-read.ts) out of the page query into a cached batch, and asked for the PRs in chunks of `20 - entries.length` commits, so that History never sent the PRs of a commit after its 20th entry; the implementer chose the chunk to keep the fault rule `oldpulls` of the fixture fake gh away from History. The fixture found 20 entries within 30 commits, so its probe passed.",
      "expected": "A split of a batched remote read keeps the number of calls of the base read per page on a cold cache, also when the walk passes long runs of commits with no issue; the 60-second board read must end and must keep the answers it already has.",
      "observed": "A focused reviewer probe with a fresh cache folder: N300 LANDED19 gave base 4 calls and lane cold 269 calls (265 pulls); N2000 LANDED5 gave base 21 and lane cold 160. The cache was appended only at the end of the read, so an aborted read saved nothing.",
      "source": {
        "kind": "tool-output",
        "excerpt": "N300 LANDED19 entries base 19 lane 19 base calls {total:4,pulls:0} lane cold calls {total:269,pulls:265} lane warm calls {total:4,pulls:0}",
        "reference": "https://github.com/ddinkov10/celetis/issues/332"
      },
      "inference": "Inferred: the fixture fake and its probe data shaped the batch size, and no case counted calls on a cold cache with a long tail of commits that map to no issue. Alternative: the brief named no call-count check, so the reviewer was the first to measure it.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "9ed3208",
      "brief": "Task 3 of the plan of #332: uncached SHAs get their PRs in one query of object(oid:) aliases; History keeps its return and its rules."
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "55ff0eda-54ca-4fc4-8be5-277c244e987a",
      "requestDigest": "e3a12f255e61a1e915151763fc40a82173799eaf57b343a02f4917ac3b0375da",
      "date": "2026-11-19",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #332; claude child opus/high\n\nApprove (reviewer rules: no rule rejects, merges, replaces, or skips it). The proposal has observed tool-output evidence: a reviewer probe with a fresh cache counted 269 calls (265 pulls) against 4 for the base read on 300 commits with 19 landings. The cause is labeled as inferred, with an alternative. The rule states applicability (a change that splits, chunks, or moves a batched remote read, or adds a cache in front of it), action, and check. It widens no permission, weakens no check, adds no network or credential act, and agrees with the principle explain-the-number of the plugin (it separates the cold and the warm cache). No live or historical lesson holds its incident or states a call-count rule; derive-fixture-state-from-real-producers and compare-the-inputs-when-a-read-changes-its-data-source govern fixture state and the input set of a read, which are different rules.",
      "related": [
        "count-the-calls-of-a-split-batch-on-a-cold-cache-with-a-long-tail"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal proposes no structural check: the call count depends on the input shape of each read, so the rule stays text."
      }
    }
  ]
}
---
# Count the calls of a split batch on a cold cache with a long tail

## What happened

In #332, Task 3 moved the PR lookup of the History read out of each 100-commit page query into a cached batch. The implementer sized each batch as `20 - entries.length` commits, so History never asked for the PRs of a commit after its 20th entry, which kept a fault rule of the fixture fake away from History. The fixture data held 20 entries within 30 commits, so the probe passed. A reviewer probe with a fresh cache and a long tail of commits with no issue counted 269 calls where the base read made 4 (300 commits, 19 landings). The cache was appended only at the end, so a read that the 60-second board limit aborted saved nothing, and every retry started cold. The fix (2ccd611) sends one batch per page and appends the cache after each answer: 7 calls cold, 4 warm.

## Root cause

Inferred: the batch size came from the fixture's fault rule and the fixture's short history, not from the cost of the base read. No probe counted calls on a cold cache with the worst-case input shape.

## Fix

The fix of #332 restores one batch per page and saves progress per page. Proposed structural follow-up, not authorized here: none; the call count depends on the input shape of each read, so the rule stays text.

## Rule

Applies when a change splits, chunks, or moves a batched remote read (a GraphQL or REST call per page or per batch), or adds a cache in front of it. Action: count the remote calls of the base and of the change on a cold cache and on a warm cache, with an input whose tail the read must walk past (many items that match nothing), and size each batch by the page of the base read, not by a fault rule of a fixture fake; when the read runs under a time limit, save each successful answer before the next call. Check: the probe output shows the base and the changed call counts side by side for a cold and a warm cache on the long-tail input, the cold count stays within a small constant factor of the base page count, and a read aborted after its first page keeps that page's answers.

## Related lessons

[[derive-fixture-state-from-real-producers]]
