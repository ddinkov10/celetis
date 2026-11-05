---
{
  "schema": 1,
  "name": "check-retained-verification-fixtures-against-current-boundaries",
  "description": "A resumed board probe reused a local remote despite the required no-remote fixture boundary",
  "tags": [
    "e2e",
    "git",
    "process"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 5 recovery of ddinkov10/celetis#236",
  "incidents": [
    {
      "id": "236-task5-reentry-remote-fixture-20261105",
      "date": "2026-11-05",
      "action": "The Task 5 recovery worker reused the retained board.ts setup, which creates a bare clone and adds it as remote origin, before checking the current no-remote fixture requirement.",
      "expected": "AGENTS.md Host checks and the approved #236 plan require fake gh on PATH and a local fixture repository with no remote.",
      "observed": "The worker reported an in-progress synthetic run whose fxb/repo origin points to fxb/origin.git. Source lines 178–181 clone --bare, remote add origin, fetch origin, and remote set-head. The coordinator required a no-remote fixture with local origin refs before accepting the required proof.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Task 5 worker: 'The retained board.ts probe creates fxb/repo with remote origin pointing only to fxb/origin.git (a local bare clone) ... No GitHub remote is present.' Coordinator: 'The no-remote boundary is explicit.'",
        "reference": "ddinkov10/celetis#236; implement session 01a1aa9b-f163-7b20-bc72-a1c96162cc28; /root/task5"
      },
      "inference": "Inferred: a retained probe was reused as a trusted recipe even though its topology violated the current instruction. The fixture had no GitHub remote and caused no observed external mutation. Why the earlier run introduced the local remote is uncertain.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "4d51551"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "a7ce8229-70ce-4e82-83c2-8c758eaa5b90",
      "requestDigest": "6ebc19755f726f5163f359fb40d31116d0c92e0d4745e1dd46e12ba3bf04f653",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nApprove under the reviewer rules: the worker report and the cited setup lines establish the incident against the no-remote fixture boundary of the project instructions, the rule states applicability, action, and check, and the root cause is labeled as inference. The rule uses a read-only git command, grants no permission, and weakens no check. No active or historical lesson states the same rule.",
      "related": [
        "check-retained-verification-fixtures-against-current-boundaries"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision; the proposal claims no new repository check."
      }
    }
  ]
}
---
# Check retained verification fixtures against current boundaries

## What happened

The #236 Task 5 recovery reused a retained board probe. That probe created a local bare clone and configured remote origin. The current project instructions and approved plan require a fixture repository with no remote. The worker identified the local-only topology; the coordinator required local refs without a remote before accepting the required proof. No GitHub remote or external mutation was observed.

## Root cause

Inferred: reuse of a retained probe substituted for checking its fixture setup against the current boundary. The earlier reason for adding the remote is uncertain.

## Fix

The proposed focused correction seeds refs/remotes/origin/main and refs/remotes/origin/HEAD locally, without a remote configuration, then runs the same behavioral assertions. This is not yet proof that the corrected probe passes. Proposed prevention remains a contextual rule because the fixture prerequisites vary by scenario; no new repository check is authorized.

## Rule

Before reusing a retained verification probe, compare its fixture topology and side effects with the current project instructions and approved scenario. Confirm the required remote configuration with git remote -v. Keep nonconforming earlier results separate, and renew the affected checks after correcting the fixture.
