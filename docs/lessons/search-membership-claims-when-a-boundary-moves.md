---
{
  "schema": 1,
  "name": "search-membership-claims-when-a-boundary-moves",
  "description": "A document pass after a component boundary moved searched the moved paths but left sentences that said a program file is a part of the plugin",
  "tags": [
    "false-negative",
    "process"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Final whole-branch review of ddinkov10/celetis#261",
  "incidents": [
    {
      "id": "0e8f7f80-db8e-4e46-adaa-e8c7a2ea5546",
      "date": "2026-11-09",
      "action": "Task 5 of #261 ran the path searches of its brief and classed sentences such as \"The board is engine/board/ of the plugin, a part of its engine\" as plugin-relative mentions.",
      "expected": "The spec of #261: a sentence in a moved document that states the old layout changes with the issue; after the move, engine/ is the program, not a part of the plugin.",
      "observed": "The final review listed about 20 current sites in plugins/celetis/docs/workflow.md, README.md, issue-tracker.md, configuration.md, and engine/board/README.md that still said a program file or the board is of the plugin; the fix rewrote them in 8eec2f5.",
      "source": {
        "kind": "tool-output",
        "excerpt": "plugins/celetis/README.md:1393: The board is `engine/board/` of the plugin, a part of its engine.",
        "reference": "https://github.com/ddinkov10/celetis/issues/261#issuecomment-6736156155"
      },
      "inference": "Inferred: the old-layout claim was a phrase of membership, not a path, so the path searches did not find it, and the classification took the phrase as true of the plugin. Alternative: the brief's class list (plugin-relative mention) invited that reading.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "81555f0",
      "brief": "Task 5 brief, Step 3: each remaining match is ... a plugin-relative mention (\"of the plugin\", or inside a plugin document)",
      "lesson": {
        "name": "check-removed-terms-in-owned-document-sections",
        "revision": "81555f0",
        "digest": "b87bea310efee3eba8478d29b1f25240891cae0befd0f77fe07e77ba43e66d70"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "1ae1da34-7a01-44e9-bb6c-b0730230225e",
      "requestDigest": "9e14b8417e4c95541a4c65a2dea7d360449756308df7fab9e803c6261b044c6e",
      "date": "2026-11-09",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #261; claude child opus/high\n\nApprove under the reviewer rules: the retained README line is observed evidence that a membership claim of the old boundary survived the path searches, the rule states applicability, action, and a check, and it keeps historical records as preserve-intended-behavior and doc-drift-sync require. check-removed-terms-in-owned-document-sections states a different rule (removed field, schema, and selection terms), so this is no merge; the two stay related. No active or historical lesson holds the incident. It widens no permission and weakens no check.",
      "related": [
        "search-membership-claims-when-a-boundary-moves"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The Fix keeps this as a text rule, because the membership phrases depend on the component and its prose."
      }
    }
  ]
}
---
# Search the membership claims when a component boundary moves

## What happened

Task 5 of #261 updated the documents after the plugin moved into `plugins/celetis/`. It ran the path searches of its brief and classed sentences such as "The board is `engine/board/` of the plugin" as plugin-relative mentions. After the move, `engine/` is the program, so about 20 current sentences stated the old layout. The task review missed them; the final review found them, and 8eec2f5 fixed them.

## Root cause

Inferred: the old claim was a phrase of membership ("of the plugin", "the plugin holds"), not a path, so a path search did not find it, and the class list of the brief let the phrase pass as true of the plugin. The active lesson on removed terms was in the brief; its terms cover fields and schemas, not a boundary claim.

## Fix

Proposed prevention: when a boundary moves, add the membership phrases of the component to the search, and classify each match against the new boundary. This stays a text rule: the phrases depend on the component and its prose.

## Rule

Applies when a change moves the boundary of a component: what a package, plugin, folder, or service holds. Action: besides the moved paths, search the owned current documents for each claim of membership of that component ("of the <component>", "the <component> holds", "a part of its <part>"), and classify each match against the new boundary; historical records stay. Check: after the edit, the same search finds no current claim that names a part outside the new boundary as a part of the component.

## Related lessons

[[check-removed-terms-in-owned-document-sections]]
[[list-the-sites-before-a-document-claims-every-site]]
