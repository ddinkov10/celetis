---
{
  "schema": 1,
  "name": "run-each-fixture-git-command-against-the-fixture-by-path",
  "description": "Probe and fixture git commands ran in the lane worktree twice in the build of #335: a probe run with no arguments committed there, and a child moved the lane HEAD",
  "tags": [
    "git",
    "process",
    "test"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of #335 on Claude Code (Windows), 2026-11-21 and 2026-11-22: a coordinator re-run of a reviewer probe, and a Verify child of V3",
  "incidents": [
    {
      "id": "33104586-5a8d-4fda-99e4-c21d80c0ae24",
      "date": "2026-11-21",
      "action": "The coordinator re-ran the reviewer probe scripts rv6/probe2.sh and rv6/probe.sh with no arguments, with the lane worktree as the working folder, to reproduce a review finding of Task 6.",
      "expected": "A probe script runs only in its own fixture folder, with the arguments of its usage line, and changes no checkout of the project.",
      "observed": "The script set W=\"$R/w2\" to \"/w2\"; git init and cd \"$W/main\" failed; the script went on in the lane worktree, set user.name=probe and user.email=probe@example.invalid in the shared local git config, wrote .celetis.yaml and suite.ts, and made the commits 57d32ef and 315bddc on the lane branch. A git push of main pushed nothing (origin main stayed 8365fe7). The Task 6 implementer found the commits, reset the branch with its own edits kept, and unset the local identity.",
      "source": {
        "kind": "tool-output",
        "excerpt": "probe2.sh: line 14: /engine/celetis: No such file or directory ... probe.sh: line 16: /s2.txt: Permission denied",
        "reference": "https://github.com/ddinkov10/celetis/issues/335"
      },
      "inference": "The coordinator read the usage line of the script only after the run, and the script had no set -eu and no check of its cd. Alternative: a script that takes its folders from arguments is safe only with the arguments; the act that failed was the run without them.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "8e72270",
      "brief": "The coordinator session had no brief for its own re-run; the rule of check-retained-verification-fixtures-against-current-boundaries was not in its context at that act.",
      "lesson": {
        "name": "check-retained-verification-fixtures-against-current-boundaries",
        "revision": "611692e392d634d6204e9e7cd08b2ee4b6b3bc5c",
        "digest": "6d507c776018629a9729b31b67a2410bcead06ff653d6f5a82febb940db96fe9"
      }
    },
    {
      "id": "4626d53f-9519-4d19-98d9-da61608fe29f",
      "date": "2026-11-22",
      "action": "The Verify child of V3 ran git symbolic-ref HEAD refs/heads/main without -C, so it ran in the lane worktree, while two other Verify children used the lane entry.",
      "expected": "Each fixture git command runs with git -C <fixture> (or init and clone with a path), as the brief of the child said.",
      "observed": "The lane HEAD pointed to refs/heads/main (8365fe7) from 2026-11-22 09:44:27 to 09:44:46 +0200 (lane reflog); the child restored refs/heads/feat/335-intent-a-local-tracker-in-the; no file or commit changed; the coordinator told the two running children to record their target again.",
      "source": {
        "kind": "tool-output",
        "excerpt": "8365fe7 HEAD@{2026-11-22 09:44:27 +0200}: / e8a0187 HEAD@{2026-11-22 09:44:46 +0200}:",
        "reference": "https://github.com/ddinkov10/celetis/issues/335"
      },
      "inference": "The brief held the rule, and the child did not apply it to one command that it typed by hand. Uncertain: whether a guard could refuse a git command whose working folder is a project checkout during a Verify run.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "e8a0187",
      "brief": "verify-common.md of the build: \"Start each shell script with set -eu; use git -C <fixture> or a checked cd. Never run a probe or a fixture command with the lane checkout or the main checkout as its working folder.\""
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "43728a3b-3482-4da7-9ae9-0566dd2f71ce",
      "requestDigest": "a1eea6103355c471935b82631b14a33980faa38cdec77dadc8961020a09c0c0b",
      "date": "2026-11-22",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #361; claude child opus/high\n\nApprove under the reviewer rules. Both incidents are observed tool output: the probe run with no arguments made the commits 57d32ef and 315bddc on the lane branch and set a local git identity, and the lane reflog shows HEAD on refs/heads/main from 09:44:27 to 09:44:46. The rule states applicability, action, and check, and keeps the inferred causes apart from the facts. No live or historical lesson states this rule: check-retained-verification-fixtures-against-current-boundaries covers the topology and the environment of a reused fixture, and run-each-fixture-daemon-command-from-the-fixture-repository covers engine commands that select a daemon by the working folder, not git commands and probe scripts. The rule widens no permission, adds no network or credential act, weakens no check, and contradicts no instruction, skill, or principle.",
      "related": [
        "run-each-fixture-git-command-against-the-fixture-by-path"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A check of each Verify child brief or of the lab wrapper that compares symbolic-ref HEAD, rev-parse HEAD, status --porcelain, and config --local --get-regexp user of each project checkout before and after the run. It needs separate authorization."
      }
    }
  ]
}
---
# Run each fixture git command against the fixture by path

## What happened

In the build of #335, two runs changed the lane worktree. The coordinator re-ran a reviewer probe with no arguments: its `cd` failed, and the script made two commits on the lane branch and set a local git identity. Later a Verify child ran `git symbolic-ref HEAD refs/heads/main` without `-C`, and the lane HEAD pointed to `main` for 19 seconds while two other children read the lane as their target. Both were repaired with no lost work.

## Root cause

Inferred: a git command that names no repository acts on the working folder, and a probe whose `cd` fails goes on in the folder where it started. The first run had no brief that carried the rule; the second brief carried it, and one typed command skipped it. Uncertain: whether a structural guard can tell a fixture command from a deliberate command in the checkout.

## Anti-pattern

```sh
git init -q --bare "$W/origin.git"; cd "$W/main"   # no set -eu: a failed cd goes on
git symbolic-ref HEAD refs/heads/main             # acts on the working folder
```

## Fix

Proposed prevention (text): each fixture git command names its repository with `git -C <fixture>`, each probe script starts with `set -eu`, and a script of another agent runs only with the arguments of its usage line from a scratch folder. Proposed structural follow-up, which needs separate authorization: a check of each Verify child brief or of the lab wrapper that compares `symbolic-ref HEAD`, `rev-parse HEAD`, `status --porcelain`, and `config --local --get-regexp user` of each project checkout before and after the run, and fails the run on a change. Enforcement is not proven.

## Detection signature

A lane commit with the author `probe@example.invalid`; a reflog entry of the lane with no message; `git status` of the lane that shows fixture files such as `suite.ts`.

## Rule

Applies when a session or a child runs a probe script, a fixture script, or a fixture git command on a machine with a checkout of the project. Action: name the repository of each fixture git command with `git -C <fixture>` (or `init` and `clone` with a path), start each script with `set -eu` and check each `cd`, and run a script that another agent wrote only with the arguments of its usage line, from a scratch folder. Check: before and after the probe, `git -C <checkout> symbolic-ref HEAD`, `rev-parse HEAD`, `status --porcelain`, and `config --local --get-regexp user` of each project checkout give the same output.

## Related lessons

[[check-retained-verification-fixtures-against-current-boundaries]] (proposed reconciliation: this rule names the git and the script part that that rule leaves to "side effects")
[[run-each-fixture-daemon-command-from-the-fixture-repository]]
