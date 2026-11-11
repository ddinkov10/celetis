---
{
  "schema": 1,
  "name": "rename-a-term-by-its-referent-when-the-new-name-covers-less",
  "description": "A rename pass changed \"the program folder\" to \"the engine folder\" word for word, after the engine became a subfolder of the folder that the sentences meant",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-10",
  "status": "active",
  "source": "Task 3 review of ddinkov10/celetis#283 (commit 2bfb758)",
  "incidents": [
    {
      "id": "fa87408b-ddcc-4120-9ebf-1ee00fe7dbe0",
      "date": "2026-11-10",
      "action": "Task 3 of #283 renamed \"the program folder\" to \"the engine folder\" and \"the folder of the program\" to \"the folder of the engine\" word for word in engine/README.md (the defect and refusal rows of \"The event record\", the daemon restart sentence) and plugins/celetis/docs/configuration.md (the root command), after Task 1 made the engine the subfolder engine/ of the version folder.",
      "expected": "Each renamed sentence names the folder that the code uses: the folder that holds engine/ (the version folder of an installed engine, or the checkout), so no current sentence says that the engine folder is the version folder.",
      "observed": "The task review found the claims false against the code: engine/lib/events.ts:48 sets root = resolve(import.meta.dir, '../..'), and firstLine replaces that root with <engine>, while engine/README.md said \"the engine folder replaced by <engine>\"; engine/README.md:540 said \"a daemon whose engine folder is the version folder of its revision\"; configuration.md:437 kept \"root prints the folder of the engine\", which spec design 2 rejects.",
      "source": {
        "kind": "tool-output",
        "excerpt": "engine/README.md:1045: the refusal row. It says \"the engine folder replaced by `<engine>`\", but the code replaces `root` (`engine/lib/events.ts:207`), which is the version folder. ... plugins/celetis/docs/configuration.md:437: \"`root` prints the folder of the engine: the version folder that runs the command\". This is the exact phrase that Decision 6 and design 2 reject.",
        "reference": "https://github.com/ddinkov10/celetis/issues/283"
      },
      "inference": "Inferred: the old name \"the program\" covered the whole clone, and the new name \"the engine\" covers only engine/ inside it, so a word substitution turned true claims about the clone root into false claims. The brief carried search-membership-claims-when-a-boundary-moves, whose check would have refused the result. Alternative contributing cause: the coordinator's carry-over line \"Rename 'program folder' in both rows\" named the word, not the referent. Uncertain which cause dominated.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "2bfb758",
      "brief": "Task 3 brief of the #283 plan, \"Lesson rules\": search-membership-claims-when-a-boundary-moves; coordinator context: \"Rename 'program folder' in both rows.\"",
      "lesson": {
        "name": "search-membership-claims-when-a-boundary-moves",
        "revision": "5cfd9da95d79b6c17ee35f3ece555b9281bd7c8b",
        "digest": "05ab572239307c25548c9b80a64c2388528053b4bdb26a58b711b87347beab35"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "8d2e47b1-5c39-4f6a-a0d8-2b7e91c4e5f6",
      "requestDigest": "a7c62f75d2c8fdac5eb0232d0836eb67b98f962d877f217eff67b45f1f39db0e",
      "date": "2026-11-10",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #283; claude child opus/high\n\nApprove under the reviewer rules: the incident is observed. At 2bfb758, engine/README.md line 540 said \"a daemon whose engine folder is the version folder of its revision\", lines 1044 and 1045 said \"the engine folder\", and plugins/celetis/docs/configuration.md line 437 said \"`root` prints the folder of the engine: the version folder\"; in the lane, engine/lib/events.ts line 48 sets root to resolve(import.meta.dir, '../..'), the folder above engine/, and line 207 replaces that root with `<engine>`. Fix commit 4b7967c rewrote these sentences. The cause stays labeled as inference with an alternative. The rule states applicability, action, and check, widens no permission, and weakens no check. It is not the rule of search-membership-claims-when-a-boundary-moves: that rule sets what a search after a boundary move covers (membership phrases), and this rule sets what a rename pass writes for each match (the name of its referent), and what a rename brief names. The two rules agree and stay related; no live or historical lesson holds the incident.",
      "related": [
        "rename-a-term-by-its-referent-when-the-new-name-covers-less"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, as its Fix says: the classification of each match needs a reading."
      }
    }
  ]
}
---
# Rename a term by its referent when the new name covers less

## What happened

In #283, the engine became the folder `engine/` inside the version folder. The rename pass of Task 3 changed "the program folder" to "the engine folder" and "the folder of the program" to "the folder of the engine" word for word. The task review found three sentences that the code contradicts: the event record rows of `engine/README.md` (the code uses the folder above `engine/`), the daemon restart sentence ("whose engine folder is the version folder"), and the `root` sentence of `configuration.md`, which the spec rejects.

## Root cause

Inferred: the old name covered the whole clone, and the new name covers less. A word substitution keeps the sentence form but moves its referent. The brief carried the membership lesson, and its check would have refused the result. A coordinator line that named the word to rename can also have steered the pass. The evidence does not show which cause dominated.

## Fix

Proposed: a rename brief names the referent of each old term ("the program folder" meant the folder that holds `engine/`), and the pass writes the name of that referent. No structural check is proposed: whether a sentence names the new component or a folder around it needs a reading of the code.

## Rule

Applies when a rename replaces a name with a new name that covers less or another thing than the old name covered (a module that becomes one folder of a clone). Action: for each match of the old name, find the thing that the sentence means in the code, and write the new name only when it covers that thing; else write the name of that thing. A brief that hands a rename to another agent names the referent, not only the word. Check: for each renamed sentence that names a folder, a path, or a value, a read of the cited code gives the same thing as the new text.

## Related lessons

[[search-membership-claims-when-a-boundary-moves]]
