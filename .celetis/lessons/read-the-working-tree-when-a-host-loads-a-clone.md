---
{
  "schema": 1,
  "name": "read-the-working-tree-when-a-host-loads-a-clone",
  "description": "A check that a clone is at a commit must also read its working tree when a consumer loads files from that tree",
  "tags": [
    "git",
    "false-negative",
    "platform-quirk"
  ],
  "date": "2026-11-23",
  "status": "active",
  "source": "Final review and Verify of #370, implement session, 2026-11-23",
  "incidents": [
    {
      "id": "5a4740a5-dded-4e75-acf2-b5def1ee03e2",
      "date": "2026-11-23",
      "action": "The clone pin of #370 compared only the HEAD of the Claude marketplace clone with the approved commit, and the plan named claude plugin marketplace update as the repair of a changed clone.",
      "expected": "A local change in the clone stops the update before the plugin moves, and the printed repair removes that change.",
      "observed": "git checkout --detach kept a local change in a file that both commits share. The update returned ok, the check printed up to date, and a plugin reload loaded the changed file. At the branch head, claude plugin marketplace update exited 0 and kept the change.",
      "source": {
        "kind": "tool-output",
        "excerpt": "R1 result ok=true error=null; R1 clone status=[M plugins/celetis/skills/triage/SKILL.md]; R1 reload copy holds local change=true; V4-6 at b53c74c: FAIL repair leaves a clean clone: M plugins/celetis/skills/triage/SKILL.md",
        "reference": "https://github.com/ddinkov10/celetis/issues/370"
      },
      "inference": "Inferred cause: HEAD identifies a commit and says nothing about the files on disk, and the reload path copies the files on disk. The repair recipe came from a probe whose clone was behind the branch head, so it did not cover a clone at the head.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "b53c74c23570c0a2fde4aea01e87f498eaa7101f"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "9782b82b-8bff-4911-880e-646bb974e068",
      "requestDigest": "7c23336348cb1d291393dbc8293e95cb49e6c479563b5cc73afe356d1795b41b",
      "date": "2026-11-23",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #370; claude child opus/high\n\nReviewer rule: approve. The evidence is observed tool output, the rule states applicability, action, and check, no live lesson states it, and it weakens no gate. The lesson run-a-documented-host-recipe-in-the-state-that-it-repairs covers host recipes in general and does not state the HEAD and working tree rule.",
      "related": [
        "read-the-working-tree-when-a-host-loads-a-clone"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Check whether status.showUntrackedFiles=no hides an untracked file from the git status --porcelain read of cloneRevision. The git-status manual says that this variable changes the default of --untracked-files. No run of this case is recorded. Not authorized in this curation."
      }
    }
  ]
}
---
# Read the working tree when a host loads a clone

## What happened

The update of #370 pinned the Claude marketplace clone and compared its `HEAD` with the approved commit. A local change in a file that both commits share survived `git checkout --detach`. The update returned `ok`, the check printed `up to date`, and a plugin reload loaded the changed file. `claude plugin marketplace update` exited 0 and kept that change when the clone was at the branch head.

## Root cause

Inference: `HEAD` identifies a commit, and the reload path copies the files on disk. The repair recipe came from a probe with a clone behind the branch head, so it did not cover a clone at the head.

## Fix

`cloneRevision` in `engine/lib/update/updater.ts` now reads `git status --porcelain`, and a changed clone is an error part that names commands that discard the change. Scenarios V4-1, V4-5, V4-6, and V4-7 of #370 observed the refusal and the repair. This rule stays text, because the choice of what counts as the loaded state depends on the consumer.

## Rule

Applies when a check accepts a Git checkout as being at a commit, and a program loads or copies files from its working tree. Action: read the working tree as well as `HEAD` (`git status --porcelain`, with untracked files), and refuse a changed tree or make the refusal name a repair. Run the repair in each start state: behind the branch head, and at the branch head. Check: a probe with a local change in a file that the old and the new commit share, and a probe with an untracked file, are both refused, and the printed repair leaves `git status --porcelain` empty in each state.
