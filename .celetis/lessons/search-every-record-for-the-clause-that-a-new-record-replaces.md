---
{
  "schema": 1,
  "name": "search-every-record-for-the-clause-that-a-new-record-replaces",
  "description": "A new ADR missed a record whose Decision held a clause that the change replaced: from the plan alone (ADR-0083 in #283, ADR-0060 in #339), and behind a partial supersede of the same paragraph (ADR-0022 in #353)",
  "tags": [
    "process",
    "recurring"
  ],
  "date": "2026-11-10",
  "status": "active",
  "source": "The implement session of #353 on Claude Code, final whole-branch review, 2026-11-20\n\nThe implement session of #339 on Claude Code, final whole-branch review, 2026-11-18\n\nFinal review of ddinkov10/celetis#283 (commit dce0477)",
  "incidents": [
    {
      "id": "2fb3e8fd-8807-43c9-b525-b155c93cddad",
      "date": "2026-11-20",
      "action": "Task 3 of #353 wrote ADR-0119. A search of docs/adr for \"pins in one file\" matched ADR-0022 line 140, and the session left ADR-0022 out of Supersedes because ADR-0029 already has a Supersedes item for that paragraph.",
      "expected": "Supersedes names each decision clause that the change replaces. ADR-0022 \"The pins in one file\" says \"A missing tool fails the gate with one line that names its package. A version that differs from its pin prints a warning and does not fail.\" The change removes that warning for biome, tsc, and @types/bun (a removed code line of scripts/verify.ts) and makes the gate refuse.",
      "observed": "The final reviewer reported it as Important: ADR-0029 supersedes only the tools.txt and CI sentences of that item (0029 lines 81-84), and docs/adr/index.md did not list 0119 for 0022 until fix commit a83072a.",
      "source": {
        "kind": "tool-output",
        "excerpt": "ADR-0022, \"The pins in one file\", keeps a decision clause that the change makes false. No record supersedes it. ... ADR-0029 supersedes only the tools.txt and \"CI installs\" sentences of that item (0029:81-84).",
        "reference": "https://github.com/ddinkov10/celetis/issues/353"
      },
      "inference": "Inferred: the session took an earlier Supersedes item on the same paragraph as coverage of the whole paragraph, and did not compare the sentences. Also the rule derives literals from removed lines of agent text and documents, and the replaced behavior here was a removed code line (the pin warning of scripts/verify.ts). Alternative: the session read the rule and did not apply it to the match it found. The evidence does not separate the causes.",
      "diagnosis": [
        "not-followed",
        "wrong-or-incomplete-rule"
      ],
      "revision": "39e35e6",
      "brief": "Task 3 Lesson rules of the plan of #353 carried search-every-record-for-the-clause-that-a-new-record-replaces; plan Task 3 Step 1 named ADR-0022 line 181 as context that stays out",
      "lesson": {
        "name": "search-every-record-for-the-clause-that-a-new-record-replaces",
        "revision": "39e35e6",
        "digest": "b9be1be6335c4643cd1b91d8c23886fdd5cfd9ec6e0552b0e2c3d9cbc7dfb786"
      }
    },
    {
      "id": "1f075d3b-3cee-48e9-8ed3-1ab742981005",
      "date": "2026-11-18",
      "action": "Searched docs/adr only for the three literals that plan step 3 named, and wrote the Supersedes section of ADR-0111 with ADR-0040 only",
      "expected": "Supersedes names every earlier decision clause that the change replaces, including the ADR-0060 clause \"The design review is the last task of the plan of a web or mobile UI change.\"",
      "observed": "The final reviewer quoted docs/adr/0060 line 102 in Decision; the index row of 0060 did not list 0111 until fix commit 21518d2",
      "source": {
        "kind": "tool-output",
        "excerpt": "[Important] ADR-0111's Supersedes omits a decision clause of ADR-0060 that it replaces. docs/adr/0060 line 102: \"The design review is the last task of the plan of a web or mobile UI change.\"",
        "reference": "https://github.com/ddinkov10/celetis/issues/339"
      },
      "inference": "The literal list came from the plan, not from the diff; alternative: the active rule does not name the source of the literal list",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "edbf50c",
      "brief": "Task 2 Lesson rules carried search-every-record-for-the-clause-that-a-new-record-replaces; step 3 searched three literals: inline — one task, one task, micro-plan",
      "lesson": {
        "name": "search-every-record-for-the-clause-that-a-new-record-replaces",
        "revision": "21518d2",
        "digest": "ffb9ae691e80c286095b8694c08547d716244418f4b06e90ede317f261dc4765"
      }
    },
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
  "recurrences": 2,
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
    },
    {
      "id": "fba09d47-8372-4706-9a40-dd27c5b0060a",
      "requestDigest": "bf2e3742644bcdb525c4cff560471d180f10e262d177dd520e3c9e9061921e19",
      "date": "2026-11-18",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #339; claude child opus/high\n\nMerge under the reviewer rules: the proposal states the same rule as the active lesson search-every-record-for-the-clause-that-a-new-record-replaces, which its incident names as the examined lesson, and adds a new incident, so the survivor keeps both incidents. The incident is observed in the lane: at edbf50c the Supersedes section of ADR-0111 named only ADR-0040; docs/adr/0060 Decision, bullet \"The review refines and never redesigns\", says \"The design review is the last task of the plan of a web or mobile UI change.\"; the diff of plugins/celetis/skills/plan/SKILL.md puts the security-review task after the design review; commit 21518d2 added ADR-0060 to the Supersedes section and to the index row of ADR-0060. The proposal refines the action of the active rule, and does not contradict it: the literals come from the removed or changed lines of the diff, not from the plan or brief alone. The survivor rule takes that refinement, so no two incompatible rules stay active. The cause stays inference: the incident's diagnosis not-followed and its alternative, an incomplete rule, are both kept in the Root cause. The rule adds a search, widens no permission, weakens no check, and agrees with AGENTS.md \"Decision records\" and step 3 of \"Write\" of the skill record-architecture-decisions. The tag recurring is added because the rule now has two incidents.",
      "related": [
        "derive-replaced-literals-from-the-diff-not-only-the-plan",
        "search-every-record-for-the-clause-that-a-new-record-replaces"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A possible structural check, named in the Fix of the proposal: for a new record, print the records whose decision text holds a sentence that the diff of the same branch removed from an agent file. Not authorized or checked here."
      }
    },
    {
      "id": "2c01f489-f19b-4a8e-a396-507f4d8403a9",
      "requestDigest": "97616156b074ce138a08f2ad7e1a5ac97e4596dba1443b43571b23ceee487919",
      "date": "2026-11-20",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #353; claude child opus/high\n\nMerge under the reviewer rules: the proposal names the active lesson search-every-record-for-the-clause-that-a-new-record-replaces as its examined lesson and refines the same rule, the Supersedes search of the record store, so the survivor keeps all three incidents. The incident is observed in the lane: docs/adr/0022 lines 140-145, \"The pins in one file\", hold \"A missing tool fails the gate with one line that names its package. A version that differs from its pin prints a warning and does not fail.\"; the Supersedes item of ADR-0029 on that paragraph names only the tests/lib/tools.txt sentence and \"CI installs each package from that file.\"; commit e8829dc removes the pin warning of scripts/verify.ts for each pin except actionlint; commit a83072a adds ADR-0022 to the Supersedes section of ADR-0119 and ADR-0119 to the index row of ADR-0022. The refinement does not contradict the active rule: it adds code lines that carry a recorded behavior as a source of literals, and a sentence comparison for a clause that another record supersedes in part. So one rule stays active. The cause stays inference with its alternative; the diagnosis not-followed and wrong-or-incomplete-rule of the incident stays unchanged. The rule adds a reading, widens no permission, weakens no check, and agrees with AGENTS.md \"Decision records\" and step 3 of \"Write\" of the skill record-architecture-decisions.",
      "related": [
        "read-the-sentences-that-an-earlier-supersede-covers",
        "search-every-record-for-the-clause-that-a-new-record-replaces"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No new structural follow-up: which sentence of a clause states a decision needs a reading. The proposed follow-up of review fba09d47-8372-4706-9a40-dd27c5b0060a stays as it is."
      }
    }
  ]
}
---
# Search every record for the clause that a new record replaces

## What happened

In #283, ADR-0091 replaced the root entry `<root>/celetis` with `engine/celetis`. Its `## Supersedes` section named ADR-0042 and ADR-0085, the records that the plan named. The final review found that ADR-0083, Decision, also states the entry `<root>/celetis`, and the index did not show 0091 against it.

In #339 (2026-11-18), Task 2 wrote ADR-0111. Plan step 3 named three literals to search in `docs/adr/`: `inline — one task`, `one task`, and `micro-plan`. The session searched only these three, and `## Supersedes` named only ADR-0040 (commit edbf50c). The same change also edited the design-review paragraph of `plugins/celetis/skills/plan/SKILL.md`: the security-review task now comes after the design review. The final whole-branch review found that ADR-0060, "Decision", says "The design review is the last task of the plan of a web or mobile UI change.", and that ADR-0111 did not supersede it. Fix commit 21518d2 added the clause, and the index then listed ADR-0111 in the row of ADR-0060.

In #353 (2026-11-20), Task 3 wrote ADR-0119, which moves the gate tools into `engine/bun.lock`. A search of `docs/adr/` for "pins in one file" matched ADR-0022 line 140. ADR-0029 already has a Supersedes item for "The pins in one file", and the session left ADR-0022 out of `## Supersedes` (commit 39e35e6). That item of ADR-0029 names only the `tests/lib/tools.txt` and "CI installs" sentences. The final whole-branch review found that the sentences "A missing tool fails the gate with one line that names its package. A version that differs from its pin prints a warning and does not fail." stayed active, and the change makes them false: commit e8829dc removed the pin warning of `scripts/verify.ts` for Biome, TypeScript, and the Bun types, and only `actionlint` keeps a warning. Fix commit a83072a added ADR-0022 to `## Supersedes`, and the index then listed ADR-0119 in the row of ADR-0022.

## Root cause

Inferred for #283: the record was written from the list of the plan, with no search of the record store for the literal of each replaced clause. The plan said "at least ADR-0085", which can read as a complete list. The evidence does not show which cause dominated.

Inferred for #339: the task brief carried this rule, and the session took its literal list from the plan step, not from the diff. The plan listed the literals of the decision that its author saw, not of a second rule that the same change edits. Alternative: the rule did not say where the literal list comes from, so a list that a plan gives read as complete. The evidence does not separate the two.

Inferred for #353: the session took the earlier Supersedes item of ADR-0029 on the same paragraph as coverage of every sentence of it, and did not compare the sentences. Also inferred: the rule took its literals only from removed lines of agent text and documents, and the replaced behavior was a removed code line (the pin warning of `scripts/verify.ts`), so no document literal pointed at the warning sentence. Alternative: the session did not apply the rule to a match that it had found. The evidence does not separate the causes.

## Fix

Proposed: before the record is committed, derive the literals that the decision replaces from each line that the diff of the change removes or changes in agent text, in a document, or in code that carries a recorded behavior (a printed line, a refusal, a warning), add the literals that the plan names, search each record file for each literal, and classify each match as replaced in part, context, or unchanged. For a match in a clause that a later record already supersedes in part, read the sentences that the later Supersedes item names, and classify each other sentence of the clause on its own. A structural check is not proposed: which words of a changed line are a decision literal, whether a match is a clause or only evidence, and which sentence of a clause states a decision need a reading. A possible check that prints, for a new record, the records whose decision text holds a sentence that the diff of the same branch removed from an agent file, is a separate follow-up and is not authorized here.

## Rule

Applies when a new decision record replaces part of earlier decisions (a path, a name, a value, a behavior, or a rule). Action: list each literal that the decision replaces, from each removed or changed line of the diff of the change (agent text, documents, and code lines that carry a recorded behavior, for example a printed warning or a refusal) and from the plan or brief, not from the plan or brief alone; search every record file for each one, and add each record whose decision clause holds a match to `## Supersedes`; a match in evidence or context stays out, with its reason. When another record already supersedes the matched clause in part, that earlier item covers only the sentences that it names: compare each other sentence of the clause with the new decision. Check: for each line that the diff removes or changes, the search of its decision literals over the record store finds no decision clause that the new record neither supersedes nor names as unchanged, and each sentence of each matched clause is named by an earlier Supersedes item, named by the new record, or true after the change.

## Related lessons

[[list-the-sites-before-a-document-claims-every-site]]
