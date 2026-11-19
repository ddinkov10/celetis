---
{
  "schema": 1,
  "name": "plan-a-decision-record-when-a-change-reverses-a-recorded-decision",
  "description": "A plan that reverses an accepted decision record schedules the superseding record",
  "tags": [
    "process"
  ],
  "date": "2026-11-19",
  "status": "active",
  "source": "implement session of #343, final whole-branch review",
  "incidents": [
    {
      "id": "7ec4c24b-a33e-44b1-89f0-79b5404c2f06",
      "date": "2026-11-19",
      "action": "The spec and the plan of #343 made the daemon send SIGKILL to the host and every member of the attempt after a Stop or a usage-limit recovery, and the plan scheduled no decision record; Tasks 1-3 landed the code with none.",
      "expected": "AGENTS.md, \"Decision records\": a record that replaces part of an earlier record names it in `## Supersedes`, so a later session does not read the old rule as current.",
      "observed": "The final review found that ADR-0080 still says \"The daemon sends no SIGKILL\" and that \"the maintainer decided against a forced kill\", and ADR-0107 item 5 says \"the daemon ends only the host\", with no record that supersedes them; the fix wave added ADR-0113.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Important 1: no decision record for the reversal of ADR-0080. ADR-0080 line 57 says \"The daemon sends no SIGKILL\". ... Items 4 and 5 of ADR-0107 (\"the daemon ends only the host\") are also partly replaced.",
        "reference": "https://github.com/ddinkov10/celetis/issues/343"
      },
      "inference": "Inferred: the spec cited the current behavior from engine/README.md and the code, not from the decision records, so neither the spec nor the plan searched docs/adr for the rule that the approach reverses. Alternative: the plan session found the record and judged the spec decision enough.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "c3b0198"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "99dd71f4-785c-4e1d-a9a9-4f6ee37ccd41",
      "requestDigest": "6e06f51c54f8dafcac9ae52355580a9ab7fa7f98f4eab306d28ebb34ac26fc6d",
      "date": "2026-11-19",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #343; claude child opus/high\n\nApprove (the reviewer rules): the proposal has observed tool-output evidence (the final review of #343 found ADR-0080 and ADR-0107 contradicted with no superseding record; the fix wave added ADR-0113 with a Supersedes section, present on this branch) and a rule that states applicability, action, and check. It widens no permission, weakens no check or gate, and agrees with AGENTS.md, \"Decision records\". The related active lesson search-every-record-for-the-clause-that-a-new-record-replaces applies once a new record exists; this rule applies at plan time, when no record is planned. The two rules are compatible and share no incident, so the proposal is neither a duplicate nor a merge.",
      "related": [
        "plan-a-decision-record-when-a-change-reverses-a-recorded-decision"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up: the rule stays text, as its Fix section explains."
      }
    }
  ]
}
---
# Plan a decision record when a change reverses a recorded decision

## What happened

The change of #343 made the daemon send SIGKILL after a Stop and after a usage-limit recovery. ADR-0080 records that the daemon sends no SIGKILL and that the maintainer decided against a forced kill; ADR-0107 item 5 records that the daemon ends only the host. The plan had no task for a new record, and three tasks and their reviews passed before the final review found the gap. A fix wave added ADR-0113 with `## Supersedes`.

## Root cause

Inferred: the spec and the plan read the current behavior from the README and the code, and did not search the decision records for the rule that the chosen approach reverses. Unresolved alternative: the reversal was noticed and judged covered by the spec.

## Fix

Proposed prevention only: at plan time, search `docs/adr` for each rule that the approach changes, and add a task that writes the superseding record. No structural check enforces it; a check would need to know which behavior a diff reverses, which needs judgment.

## Rule

Applies when a spec or a plan changes a behavior that a project decision record states as decided (a limit, a refusal, a "no X" rule). Action: at plan time, search the record store for each rule that the change reverses or narrows, and add a task that writes the superseding record with its `## Supersedes` links before the final review. Check: the plan names each matched record and the task that supersedes it, and the final review finds no decision clause that the branch contradicts without a superseding record.

## Related lessons

[[search-every-record-for-the-clause-that-a-new-record-replaces]]
