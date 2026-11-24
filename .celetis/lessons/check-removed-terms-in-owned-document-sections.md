---
{
  "schema": 1,
  "name": "check-removed-terms-in-owned-document-sections",
  "description": "Documentation passes kept removed claims: removed host, queue schema, and selection terms in the named files, and a removed privacy claim in a file outside the path list of the plan",
  "tags": [
    "process",
    "regression",
    "false-negative"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "The implement session of #40 on Claude Code 2.1.330, final whole-branch review.\n\nTask 5 recovery of ddinkov10/celetis#236",
  "incidents": [
    {
      "id": "817e8572-86d9-40e5-86bc-241eb912b334",
      "date": "2026-11-23",
      "action": "The session checked that no document says the repository is private with the git grep path list of the plan.",
      "expected": "The documents no longer say that the repository is private, as the root cause of #40 requires.",
      "observed": "PRODUCT.md:108 still said that the repository is private. The path list of the plan did not hold PRODUCT.md.",
      "source": {
        "kind": "tool-output",
        "excerpt": "PRODUCT.md:108:The repository is private. gh repo view: {\"visibility\":\"PUBLIC\"}",
        "reference": "https://github.com/ddinkov10/celetis/issues/40"
      },
      "inference": "Inferred: the session took the search scope from the plan and did not derive it from the claim. The plan may also have been incomplete at its writing.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "20f69824b086c2ee36fdbb1c513b19a044cece08",
      "brief": "Task 3 of the plan of #40 carried the rule check-removed-terms-in-owned-document-sections.",
      "lesson": {
        "name": "check-removed-terms-in-owned-document-sections",
        "revision": "15d7692eae3c428ac53abab4a8e38289fb9a5455",
        "digest": "b87bea310efee3eba8478d29b1f25240891cae0befd0f77fe07e77ba43e66d70"
      }
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "ac51c235-7af2-42eb-96e3-02f1c7d09055",
      "requestDigest": "e4a51e110c337d1450f7ef7f809f066e77da767e95f4c3c90221aa80f83fdb1b",
      "date": "2026-11-24",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #347; claude child opus/high\n\nMerge (reviewer rules: merge a proposal into an active lesson that states the same rule, and keep every incident). The proposal has observed tool output (`PRODUCT.md:108:The repository is private.` while `gh repo view` reported PUBLIC). Its incident names check-removed-terms-in-owned-document-sections as the lesson that the brief of the task carried, with the diagnosis not-followed: the active rule already told the session to search the owned current documents for a removed claim. The merge keeps both incidents and the prior review, and widens the survivor so that it names a removed statement of fact and a search over all tracked text files with no include list from a plan. The survivor keeps its name, because other lessons link to it. It widens no permission, weakens no check, and adds no network or credential act. Both causes stay labeled as inference.",
      "related": [
        "search-a-removed-claim-across-the-tracked-documents",
        "check-removed-terms-in-owned-document-sections"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text inside the documentation assessment; this review changes lesson data only."
      }
    }
  ]
}
---
# Check removed terms and claims in all current documents

## What happened

The #236 Task 5 report claimed that board documentation matched the new ordered agent selection. The named files still described the removed YAML host, queue schema 2, and a fixed queue host. The recovery corrected these claims in commit 80c35f5. The implementation already used queue schema 3, AgentChoice, and local order and usage records.

Task 3 of #40 removed the claim that the repository is private. Its check ran `git grep` with the path list of the plan, and the brief of the task carried this lesson. The final review found the same claim at `PRODUCT.md:108`, a file that the list did not hold, while `gh repo view` reported `PUBLIC`.

## Root cause

The evidence establishes incomplete coverage of the owned sections. Why the #236 pass missed the sentences is unknown. A list of edited files did not establish that all affected claims in those files were corrected.

Inference for #40: the session took the search scope from the plan and did not derive it from the claim. An incomplete plan is an alternative cause. Both incidents show that a given list of files does not bound the documents that hold a removed claim.

## Fix

The applied corrections change only current claims against the approved spec and current source. Proposed prevention: search all tracked text files for the removed field names, schema names, old selection terms, or the removed statement, with no include list from a plan or a report; exclude only historical records by name; compare each match with the new contract. No new test or document store is proposed. This remains a contextual check because an identical term can be correct in historical records or in a different role, and a reader decides whether a match is the same claim.

## Rule

Applies when a change removes a field, changes a state schema or a selection contract, or removes a statement of fact that current documents describe, also when a plan or a report names the paths to check. Action: search all tracked text files for the old field, schema, and selection terms or the removed statement, with no include list taken from the plan; exclude only historical records by name; read each match and compare it with the approved behavior and the implementation. Keep valid historical text intact. Check: the search command names no include list, each remaining match is a valid historical or different-role use, and the task report names each unresolved claim apart from the completed corrections.

## Related lessons

[[list-the-sites-before-a-document-claims-every-site]]
[[search-membership-claims-when-a-boundary-moves]]
