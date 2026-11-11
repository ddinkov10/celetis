---
{
  "schema": 1,
  "name": "check-removed-terms-in-owned-document-sections",
  "description": "A completed documentation pass retained removed host, queue schema, and selection claims",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 5 recovery of ddinkov10/celetis#236",
  "incidents": [
    {
      "id": "f74ebfd0-6e46-4144-af29-cddf936a0945",
      "date": "2026-11-05",
      "action": "The prior Task 5 report stated that board documentation had been updated, but current board references still described removed YAML host, schema 2, and a fixed queue host.",
      "expected": "Current selection, priority, and Retry documentation must match the approved #236 spec while historical records stay intact.",
      "observed": "At 4d51551, engine/board/README.md said The view carries the schema-2 record and The host stays fixed while nonempty; docs/celetis-flow.md said YAML gives host and gates at each read. QueueRecord instead has schema 3 and AgentChoice, and readAgentState reads local order and usage.",
      "source": {
        "kind": "tool-output",
        "excerpt": "80c35f5 removes 'host and gates at each read', replaces 'schema-2 record' with 'schema-3 record', and replaces 'The host stays fixed while nonempty' with 'The agent choice stays fixed while nonempty. A default choice uses the current order at each new step.'",
        "reference": "ddinkov10/celetis#236; commit 80c35f5fbe4c2bbfd646affc6ec7a6e50a92d159; task-5-report.md Codex recovery"
      },
      "inference": "Incomplete document coverage is observed; why the prior pass missed these sentences is unknown. The prior report already named these owned files, so file selection alone did not ensure section coverage.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "4d51551e42d7729327630c5c8511e68a4027f374"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "7ff30b6e-8ae0-41bf-ba47-de5eab06b45b",
      "requestDigest": "ec0474c79038a0d001b13fdd63fa6cf5b0bb756fc0b17b7622627c0b4f8da373",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nEdit under the reviewer rules: the retained correction commit and the observed stale sentences establish the incident, and no active or historical lesson states this rule. The edit states the rule as applicability, action, and check, with a check that a reviewer can observe. The rule agrees with the documentation assessment of the plugin and the doc-drift-sync skill: it keeps historical records intact and adds no test, store, or document. Incident evidence and the unknown cause stay unchanged.",
      "related": [
        "check-removed-terms-in-owned-document-sections"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text inside the existing documentation assessment; no structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Check removed terms in the owned document sections

## What happened

The #236 Task 5 report claimed that board documentation matched the new ordered agent selection. The named files still described the removed YAML host, queue schema 2, and a fixed queue host. The recovery corrected these claims in commit 80c35f5. The implementation already used queue schema 3, AgentChoice, and local order and usage records.

## Root cause

The evidence establishes incomplete coverage of the owned sections. Why the prior pass missed the sentences is unknown. A list of edited files did not establish that all affected claims in those files were corrected.

## Fix

The applied correction changes only current claims against the approved spec and current source. Proposed prevention: within the existing documentation assessment, search the owned sections for removed field names, schema names, and old selection terms; compare each match with the new contract. No new test or document store is proposed. This remains a contextual check because an identical term can be correct in historical records or in a different role.

## Rule

Applies when a change removes a field, or changes a state schema or a selection contract, that current documents describe. Action: search each owned current document section for the old field, schema, and selection terms, and compare each match with the approved behavior and the implementation. Keep valid historical text intact. Check: each remaining match is a valid historical or different-role use, and the task report names each unresolved claim apart from the completed corrections.
