---
{
  "schema": 1,
  "name": "search-every-record-for-the-clause-that-a-new-record-replaces",
  "description": "A new ADR listed the records that the plan named in its Supersedes section, and missed ADR-0083, whose Decision also stated the replaced root entry",
  "tags": [
    "process"
  ],
  "date": "2026-11-10",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#283 (commit dce0477)",
  "incidents": [
    {
      "id": "0800d9ec-26c3-49ae-b1e1-2f42344a0dd0",
      "date": "2026-11-10",
      "action": "Task 4 of #283 wrote ADR-0091, whose Supersedes section named the clauses of ADR-0042 and ADR-0085 that the plan listed (\"at least ADR-0085\"; read ADR-0042 and ADR-0089), and no other record.",
      "expected": "The Supersedes section names each record that the new decision replaces in part, as spec design 5 and AGENTS.md \"Decision records\" require, also a record that the plan did not name.",
      "observed": "The final review found that ADR-0083, Decision, says a library starts each daemon process \"only through the program entry `<root>/celetis` and that form\", while the code runs join(root, 'engine', 'celetis'); a grep of docs/adr/*.md for `<root>/celetis` finds only 0042 and 0083.",
      "source": {
        "kind": "tool-output",
        "excerpt": "ADR-0083, Decision (docs/adr/0083-a-library-starts-a-celetis-process-through-the-program-entry.md:65), says a library starts each daemon process \"only through the program entry `<root>/celetis` and that form\". ... A grep of docs/adr/*.md for `<root>/celetis` finds only 0042 (already listed) and 0083.",
        "reference": "https://github.com/ddinkov10/celetis/issues/283"
      },
      "inference": "Inferred: the record author read only the records that the plan named, and did not search the record store for the literal of each replaced clause (the old path, the old name). Alternative: the plan's \"at least\" list read as a complete list. Uncertain which cause dominated.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "dce0477"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "3f0c6a2e-8b14-4d7a-9e51-6c2d7b9a1f03",
      "requestDigest": "20a601c1de8743c3fa74f7282f115e8c64ee0086918f44217960cc01ceca7042",
      "date": "2026-11-10",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #283; claude child opus/high\n\nApprove under the reviewer rules: the incident is observed. In the lane, ADR-0083 line 65 (Decision) says \"only through the program entry `<root>/celetis` and that form\", engine/lib/daemon-start.ts gives `<root>/engine/celetis`, and the Supersedes section of ADR-0091 named only ADR-0085 and ADR-0042 until 9e30a81 added ADR-0083. Correction of the evidence: at dce0477, a search of docs/adr/*.md for the literal `<root>/celetis` matches only ADR-0083 (lines 52 and 65), not ADR-0042; ADR-0042 states the entry as \"The root file `celetis`\", another literal. The incident text stays unchanged, and the correction does not change the decision. The cause stays labeled as inference with an alternative. The rule states applicability, action, and check; it adds a search, widens no permission, weakens no check, and agrees with AGENTS.md \"Decision records\" and step 3 of \"Write\" of the skill record-architecture-decisions. No live or historical lesson states the rule or holds its incident: list-the-sites-before-a-document-claims-every-site covers a sentence that claims every site, not the search of the record store for each replaced clause, so the two stay related.",
      "related": [
        "search-every-record-for-the-clause-that-a-new-record-replaces"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, as its Fix says: the classification of each match needs a reading."
      }
    }
  ]
}
---
# Search every record for the clause that a new record replaces

## What happened

In #283, ADR-0091 replaced the root entry `<root>/celetis` with `engine/celetis`. Its `## Supersedes` section named ADR-0042 and ADR-0085, the records that the plan named. The final review found that ADR-0083, Decision, also states the entry `<root>/celetis`, and the index did not show 0091 against it.

## Root cause

Inferred: the record was written from the list of the plan, with no search of the record store for the literal of each replaced clause. The plan said "at least ADR-0085", which can read as a complete list. The evidence does not show which cause dominated.

## Fix

Proposed: before the record is committed, search each record file for each literal that the decision replaces (an old path, an old name, an old value) and classify each match as replaced in part, context, or unchanged. A structural check is not proposed: whether a match is a clause or only evidence needs a reading of the record.

## Rule

Applies when a new decision record replaces part of earlier decisions (a path, a name, a value, or a rule). Action: list each literal that the decision replaces, search every record file for each one, and add each record whose decision clause holds a match to `## Supersedes`; a match in evidence or context stays out, with its reason. Check: the search of each literal over the record store finds no decision clause that the new record neither supersedes nor names as unchanged.

## Related lessons

[[list-the-sites-before-a-document-claims-every-site]]
