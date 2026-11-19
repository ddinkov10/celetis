---
{
  "schema": 1,
  "name": "keep-the-read-scope-of-a-caller-when-a-fix-adds-remote-lookups",
  "description": "A cache fix of #332 looked up the issue of every subject number in a 50-commit chunk, so a number that does not exist after the 20th History entry failed the whole board read, where the base read never asked it",
  "tags": [
    "api",
    "regression",
    "refix"
  ],
  "date": "2026-11-19",
  "status": "active",
  "source": "The implement session of #332 on Claude Code, scoped re-review of the final-review fix wave, 2026-11-19",
  "incidents": [
    {
      "id": "4d2b852e-2a9f-4eea-aaee-ee56f8285f22",
      "date": "2026-11-19",
      "action": "The final-review fix of #332 (e240086) applied a maintainer rule (do not cache a commit whose subject number is a pull request) by reading the issue of every subject number of each 50-commit chunk in issuesOf of engine/lib/board-read.ts, ahead of the answer that History needs; History, which runs inside the board document read, then read numbers past its 20 entries.",
      "expected": "A fix keeps the remote read scope of each caller: History reads only the numbers of its 20 entries, as the base did, so a number that GitHub cannot resolve after those entries does not fail the board read.",
      "observed": "A reviewer probe with a fake gh (30 direct commits, commit 26 names #9999, answered null plus NOT_FOUND): the base read gave `History ok, entries 20` with `issues 1..20`; the fix gave `History FAILED: malformed GitHub data` with `issues 1..25,9999,27..30`. The fix 3f85f1e applies the rule at the issue answer, in the base scope: `History ok, entries 20`, `issues 1..20`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "base History ok, entries 20 first 1 last 20 / issues 1..20; head History FAILED: malformed GitHub data / issues 1,...,25,9999,27,...,30",
        "reference": "https://github.com/ddinkov10/celetis/issues/332"
      },
      "inference": "Inferred: the fixer moved a lookup earlier to decide a cache rule in one place, and no probe held an unresolvable number outside the caller's base scope. Alternative: the fix brief named the rule but not the scope of each caller.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "e240086",
      "brief": "Final-review fix brief of #332, F2: when a commit's associatedPullRequests is empty and its subject number resolves to a PullRequest, cache neither line; the next read asks again."
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "cd8aa494-289f-4c25-9671-a464d9bb84bf",
      "requestDigest": "8c45e27213fd1a6d57b9456003228faef141bbbc0777f0eac50350541056d272",
      "date": "2026-11-19",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #332; claude child opus/high\n\nApprove (reviewer rules: no rule rejects, merges, replaces, or skips it). The proposal has observed tool-output evidence: a reviewer probe with a fake gh and an unresolvable #9999 at commit 26 gave `History ok, entries 20` with issues 1..20 on the base, `History FAILED: malformed GitHub data` with issues 1..25,9999,27..30 on e240086, and the base result again on 3f85f1e. The cause is labeled as inferred, with an alternative. The rule states applicability (a change that adds, moves, or batches a remote lookup on a read path whose failure fails a larger read), action, and check; it widens no permission, weakens no check, and adds no network or credential act. No live or historical lesson holds its incident. count-the-calls-of-a-split-batch-on-a-cold-cache-with-a-long-tail (approved in this batch) governs the call count of a split batch, and compare-the-inputs-when-a-read-changes-its-data-source governs the input set of a replaced data source; this rule governs the item set that each caller reads, a different and compatible rule.",
      "related": [
        "keep-the-read-scope-of-a-caller-when-a-fix-adds-remote-lookups"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal proposes no structural check: read scopes differ per caller, so the rule stays text."
      }
    }
  ]
}
---
# Keep the read scope of a caller when a fix adds remote lookups

## What happened

In #332, a final-review fix applied a maintainer rule about what the commit cache may hold. It read the issue of every subject number of each 50-commit chunk, ahead of the answer that each caller needed. History runs inside the board document read and needs only its 20 entries. A probe with a number that GitHub cannot resolve after the 20th entry showed the base read succeed and the fixed read fail the whole board (`malformed GitHub data`). The second fix applied the rule at the issue answer, in the base scope of each caller.

## Root cause

Inferred: the lookup moved earlier so one place could decide the cache rule, and that widened the set of remote reads of a caller whose failure fails a larger read. No probe held a failing item outside the caller's old scope.

## Fix

The fix of #332 (3f85f1e) keeps each caller's base read scope and decides the cache rule when the answer arrives. Proposed structural follow-up, not authorized here: none; read scopes differ per caller, so the rule stays text.

## Rule

Applies when a change adds, moves, or batches a remote lookup on a read path whose failure fails a larger read (a page document, a list, a report). Action: list the items that each caller read before the change, keep that set, and apply a new rule at the point where the answer arrives instead of reading more items ahead of time. Check: a probe holds one item that the remote answers with an error just outside the caller's base scope; the base and the change both succeed, and the probe log shows the same set of items read as the base.

## Related lessons

[[compare-the-inputs-when-a-read-changes-its-data-source]]
