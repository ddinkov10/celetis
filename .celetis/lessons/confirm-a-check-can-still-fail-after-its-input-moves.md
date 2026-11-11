---
{
  "schema": 1,
  "name": "confirm-a-check-can-still-fail-after-its-input-moves",
  "description": "A changed source path made an unchanged comparison check compare a file with its proven copy, so it could never refuse",
  "tags": [
    "false-negative",
    "regression",
    "process"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Final whole-branch review of ddinkov10/celetis#261",
  "incidents": [
    {
      "id": "db9a77b1-ccdc-4473-b4de-145b9967c35a",
      "date": "2026-11-09",
      "action": "Task 3 of #261 made record.source.path of the Codex plugin record point to <clone>/plugins/celetis and left codexSessionPin reading its original catalog from realpath(record.source.path).",
      "expected": "The spec of #261 keeps the other checks of codexSessionPin: the sibling check refuses a pinned session catalog that changes a configured plugin of the original marketplace.",
      "observed": "The original catalog became the folder catalog, which codexRevision had just proved byte-equal to the cache catalog, so isDeepStrictEqual(entries, previous) was always true and the refusal could not happen. The task review passed it; the final review found it.",
      "source": {
        "kind": "tool-output",
        "excerpt": "f4-sibling.ts on 8eec2f5: old reading refuses foo@celetis: false; new reading (nativeCatalog(metadata.marketplaceRoot)) refuses foo@celetis: true",
        "reference": "https://github.com/ddinkov10/celetis/issues/261#issuecomment-6736156155"
      },
      "inference": "Inferred: the task changed a value that a check further down the same function reads, and checked the new value only for the new rule, not for the old check. Alternative: the brief did not list the sibling check as a site of the changed value.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "499f5d5"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "5514f9c5-9165-4b4a-b009-1ba3c678ab45",
      "requestDigest": "239b087e86676e367290f4287c096e774799ba2367caf1b4d85b9fce006cb0ca",
      "date": "2026-11-09",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #261; claude child opus/high\n\nApprove under the reviewer rules: the retained probe output on 8eec2f5 is observed evidence that the moved source path made the sibling check unable to refuse, the rule states applicability, action, and a check, and it agrees with test-behavior-not-implementation, which asks that a breaking change make the check fail. No active or historical lesson holds the incident or the same rule; keep-each-effect-of-a-removed-helper-call is related, not the same rule. It widens no permission and weakens no check.",
      "related": [
        "confirm-a-check-can-still-fail-after-its-input-moves"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The Fix keeps this as a text rule, because no general structural check can tell that a comparison became a tautology."
      }
    }
  ]
}
---
# Confirm that a check can still fail after its input moves

## What happened

Task 3 of #261 changed the Codex plugin record so that `record.source.path` names `<clone>/plugins/celetis`. `codexSessionPin` still read its original catalog from that path. The new witness `codexRevision` had already proved that catalog byte-equal to the cache catalog that the sibling check compares with, so the check could never refuse. The task review passed it. The final review found it, and the fix reads the original catalog from the marketplace root (8eec2f5). A scratch check showed the old reading accepts a changed sibling plugin and the new reading refuses it.

## Root cause

Inferred, not proven: the change moved a value that an unchanged check reads, and the work confirmed the new rule but not that the old check still had a failing input. An alternative cause is that the brief did not name the check as a site of the moved value.

## Fix

Proposed prevention: for each changed value, list each check on the same call path that reads it, and give each check one failing input after the change. This stays a text rule: no general structural check can tell that a comparison became a tautology.

## Rule

Applies when a change alters a value that an unchanged check reads (a path, a source, a record field, a file that the check compares). Action: list each check on the call path that reads the changed value, name the input that must make each check refuse after the change, and confirm that such an input still exists. Check: a probe gives each listed check its failing input after the change and observes the refusal.

## Related lessons

[[keep-each-effect-of-a-removed-helper-call]]
