---
{
  "schema": 1,
  "name": "check-retained-verification-fixtures-against-current-boundaries",
  "description": "Reused retained probes broke current fixture boundaries: a local remote in a no-remote fixture, and a lab script whose tabs got the real HOME",
  "tags": [
    "e2e",
    "git",
    "process",
    "test",
    "config"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "The implementer of Task 4 of #252 (child t4-impl of the implement session on Claude Code), report of 2026-11-10; the implement session read the two event lines\n\nTask 5 recovery of ddinkov10/celetis#236",
  "incidents": [
    {
      "id": "3AAC42A0-799D-45C9-8117-3AE7B72C6B04",
      "date": "2026-11-10",
      "action": "The implementer restored the lab script of a retained fixture from `lab.sh.txt` (the script of an earlier task) instead of `lab-s.sh.txt` (the script of the fixture S, which the README of the folder names), and ran the first RED lab of its probe.",
      "expected": "Each tab of the lab gets the fixture `HOME`, `CELETIS_HOME`, and `CLAUDE_CONFIG_DIR`, so that no command of the check reads or writes the state of the maintainer (AGENTS.md, \"Host checks\": temporary test data).",
      "observed": "The tabs got `HOME=/Users/dinq` and no `CLAUDE_CONFIG_DIR`. Two client calls of `coordinator send` from the fixture session wrote two refusal events into the real `~/.local/state/celetis/events.jsonl`. No real host started and no other real state changed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "~/.local/state/celetis/events.jsonl lines 3036 and 3037: {\"time\":\"2026-11-10T21:34:20.504Z\",\"kind\":\"refusal\",\"name\":\"exit\",\"command\":\"coordinator\",\"argv\":[\"--agent\",\"claude\",\"send\",\"1\",\"…/scratchpad/task-4/252/out/three.txt\",\"--as\",\"coordinator\"],…} and the same with three-b.txt and --as maintainer at 21:34:32.661Z",
        "reference": "https://github.com/ddinkov10/celetis/issues/252"
      },
      "inference": "Inferred cause, from the child report: two retained lab scripts with similar names lay in one folder, and the README named the right one only in a table that the copy loop of the child did not apply. Contributing: the probe had no check of its own session environment before the first command. Alternative: the brief of the implement session named the retained folder but not the script of the fixture; uncertain which weighs more.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f8f0cae"
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "99a2f1d3-e0c6-46e2-83fd-7e01ed83d8f4",
      "requestDigest": "87278ed65f8717482e06193b8fbb905d85b16ec46836ddda8be5e79f7a44a1c1",
      "date": "2026-11-11",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #139; claude child opus/high\n\nMerge under the reviewer rules: the active lesson check-retained-verification-fixtures-against-current-boundaries states the same rule, to compare a retained probe or fixture with the current boundaries and side effects before its reuse. The #252 incident is a reuse of a retained lab script whose session environment broke the temporary-data boundary of AGENTS.md, Host checks. The two rules are compatible, so one survivor keeps both incidents and the prior review, and its rule gains the control-tab read of HOME and the state variables and the one-start-script rule. The tool-output excerpt is observed evidence, and the cause stays labeled as inference. The rule adds a read-only check, widens no permission, and weakens no gate. Edit in the merge: the check drops the control run with the wrong script, because that control can itself write outside the scratch folder when its guard fails. The structural follow-up stays proposed.",
      "related": [
        "refuse-a-fixture-run-whose-session-environment-holds-the-real-home",
        "check-retained-verification-fixtures-against-current-boundaries"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up proposed in #252, which needs separate authorization: the retained harness refuses to start a session tab whose HOME or state folder is outside the scratch folder, and a retained folder keeps one lab script. Not implemented and not proven.",
        "reference": "https://github.com/ddinkov10/celetis/issues/252"
      }
    }
  ]
}
---
# Check retained verification fixtures against current boundaries

## What happened

The #236 Task 5 recovery reused a retained board probe. That probe created a local bare clone and configured remote origin. The current project instructions and approved plan require a fixture repository with no remote. The worker identified the local-only topology; the coordinator required local refs without a remote before accepting the required proof. No GitHub remote or external mutation was observed.

In Task 4 of #252 on 2026-11-10, the retained probe folder held two lab scripts, `lab.sh.txt` (Task 1) and `lab-s.sh.txt` (the fixture S, which the README of the folder names). The implementer restored the first one and ran its first RED lab. The tabs got `HOME=/Users/dinq` and no `CLAUDE_CONFIG_DIR`. The synthetic host crashed, and two `coordinator send` calls of the fixture session wrote two refusal events into the real `~/.local/state/celetis/events.jsonl` (lines 3036 and 3037; the implement session read both lines). No real host started.

## Root cause

Inferred: reuse of a retained probe substituted for checking its fixture setup against the current boundary. The earlier reason for adding the remote is uncertain.

In #252, inferred from the child report: two retained scripts had similar names, the README named the right one only in a table that the copy step did not apply, and the probe had no check of its own session environment before the first command. Alternative: the brief of the implement session named the retained folder but not the script of the fixture. Which cause weighs most is not settled.

## Fix

The proposed focused correction seeds refs/remotes/origin/main and refs/remotes/origin/HEAD locally, without a remote configuration, then runs the same behavioral assertions. This is not yet proof that the corrected probe passes. Proposed prevention remains a contextual rule because the fixture prerequisites vary by scenario; no new repository check is authorized.

In #252 the child added a guard to that probe: it stops when the coordinator session has no fixture `CELETIS_HOME` or `CLAUDE_CONFIG_DIR`, and it wrote the trap into the README of the folder. This guards one probe. Proposed structural follow-up, which needs separate authorization: the retained harness refuses to start a session tab whose `HOME` or state folder is outside the scratch folder, and a retained folder keeps one lab script. Not proven.

## Detection signature

A configured remote in `git remote -v` of a fixture that must have no remote; a control tab of a lab that prints the real home for `HOME`; an event of a probe (an argv with a scratch path) in the real event record.

## Rule

Applies when a check reuses a retained verification probe, fixture, or lab script. Action: before the first command of the check, compare the fixture topology and side effects with the current project instructions and approved scenario, and confirm the required remote configuration with `git remote -v`. When the check starts sessions or engine commands, read `HOME` and each state or config variable in a control tab that starts as a session tab starts, and stop when a value is outside the scratch folder of the check. Keep one start script in a retained folder, or name the script in the first line of its README. Keep nonconforming earlier results separate, and renew the affected checks after correcting the fixture. Check: the evidence holds the remote configuration and the control-tab values from before the first command, and each value is under the scratch folder.

## Related lessons

[[give-a-probe-a-private-home-before-a-case-unsets-a-home-variable]]
[[keep-launch-variables-when-a-launch-moves-terminals]]
