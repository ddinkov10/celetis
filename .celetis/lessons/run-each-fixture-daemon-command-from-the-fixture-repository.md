---
{
  "schema": 1,
  "name": "run-each-fixture-daemon-command-from-the-fixture-repository",
  "description": "A Verify child ran a daemon stop of the lane entry from the lane worktree as a cleanup, and stopped the real master daemon of the repository",
  "tags": [
    "test",
    "e2e",
    "process"
  ],
  "date": "2026-11-20",
  "status": "active",
  "source": "The implement session of #333 on Claude Code, Verify phase, 2026-11-20",
  "incidents": [
    {
      "id": "ca6e2017-7f75-4d73-badf-58507795846e",
      "date": "2026-11-20",
      "action": "The Verify child of #333 ran `<lane>/engine/celetis daemon stop` through `herdr-lab.ts run` as a cleanup step of a fixture side. Its working folder was the lane worktree of the real repository, not the fixture repository.",
      "expected": "Each engine command of a check runs with its working folder in the fixture repository, so that a command that selects the daemon by the repository of its working folder can only reach a fixture daemon.",
      "observed": "The command printed `daemon: stopped PID 87952`, the real master daemon; the fixture daemon PID 99655 still ran. `celetis daemon status` in the main checkout then printed `daemon: no daemon runs for this repository`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "daemon: stopped PID 87952\n(main checkout) daemon: no daemon runs for this repository",
        "reference": "https://github.com/ddinkov10/celetis/issues/333"
      },
      "inference": "Inferred: the daemon commands pick their daemon from the Git common folder of the working folder, and a lane worktree shares the common folder of the main checkout. The brief said to never touch the real daemon but named no working-folder rule. Alternative: a guard in the lab wrapper that refuses a working folder outside the lab root would enforce it.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "9d60f3c",
      "brief": ".superpowers/sdd/333/verify-brief.md, Rules: \"never touch the real installation, the real daemon, or the main checkout's state\""
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "309665d7-e291-49bf-b617-67416bab5bcd",
      "requestDigest": "dbb34084d1ef537156b7fa58cf508f5580668476571608819fdeb29729d97e11",
      "date": "2026-11-20",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #333; claude child opus/high\n\nApprove with an edit by the reviewer rules: the proposal has observed tool-output evidence, states applicability, action, and check, keeps the inference apart from the facts, and contradicts no project instruction (AGENTS.md \"Host checks\") or skill. No active lesson states the same rule: run-a-project-config-tool-from-the-project-root covers a config tool, and check-retained-verification-fixtures-against-current-boundaries covers HOME and state variables of a retained fixture, not the working folder of a daemon command. Edit: the tags verification and safety are not in the tag vocabulary; they become test, e2e, and process.",
      "related": [
        "run-each-fixture-daemon-command-from-the-fixture-repository"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A guard in scripts/herdr-lab.ts run that refuses a working folder outside the lab root, or sets the fixture repository as the working folder of each command, needs a separately authorized change."
      }
    }
  ]
}
---
# Run each fixture daemon command from the fixture repository

## What happened

In the Verify phase of #333, a child ran `<lane>/engine/celetis daemon stop` through `herdr-lab.ts run` to clean up a fixture side. The working folder was the lane worktree. The command stopped PID 87952, the master daemon of the real repository; the fixture daemon still ran. Sessions of #354, #64, and the Coordinator were live at that time.

## Root cause

Inferred: a `daemon` command selects its daemon by the Git common folder of its working folder, and a lane worktree shares that folder with the main checkout. The brief forbade a touch of the real daemon but gave no working-folder rule, so the rule did not reach the child. Not checked: whether `herdr-lab.ts run` sets a working folder of its own.

## Fix

No code fix in #333. Proposed, not authorized: `herdr-lab.ts run` refuses a working folder outside the lab root, or the lab wrapper sets the fixture repository as the working folder of each command. Until then the rule stays text.

## Rule

Applies when a check runs an engine command that selects a daemon, a lock, or state by the repository of its working folder (`daemon`, `run`, `land`, `queue`, `coordinator`, `--prepare-state`), also a cleanup step. Action: set the working folder of each such command to the fixture repository explicitly, and never run it from a lane worktree or the main checkout; before a stop or a write, print the daemon status from that folder and compare its PID with the fixture daemon. Check: the evidence of each such command shows its working folder under the scratch folder, and the real `daemon status` in the main checkout shows the same PID before and after the check.

## Related lessons

[[run-a-project-config-tool-from-the-project-root]]
