---
{
  "schema": 1,
  "name": "give-a-polled-git-read-no-optional-locks",
  "description": "A board poll ran plain git status on the main checkout at each request, and each call rewrote the index under index.lock",
  "tags": [
    "git",
    "performance",
    "regression"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of #364 on Claude Code, final whole-branch review, 2026-11-22",
  "incidents": [
    {
      "id": "7cb0674c-e6e5-40b9-8fdf-2a0a3266c986",
      "date": "2026-11-22",
      "action": "Commit 8232c64 moved the dirty check of the main checkout (isDirty of engine/lib/resolver/resolver.ts, git -C <path> status --porcelain) from the 5-minute issue read into each GET /api/board, through mainNoRun, and kept the git arguments of the old rarely-run read.",
      "expected": "A git read that a long-lived process runs on a poll uses --no-optional-locks, as readDiff of engine/lib/board-read/board-read.ts, the git helper of engine/lib/process/git.ts, and engine/lib/run/quota-recovery.ts do, so it does not rewrite the index or take index.lock while a landing or the maintainer runs git in the same checkout.",
      "observed": "A probe made the index of a temp repository older than a tracked file and called mainNoRun once: the index mtime changed (index rewritten=true). With --no-optional-locks (commit 4bf4c24) the same probe gave index rewritten=false.",
      "source": {
        "kind": "tool-output",
        "excerpt": "noRun=null index rewritten=true\nLOCKS: FAIL\n(after the fix) noRun=null index rewritten=false\nLOCKS: PASS",
        "reference": "https://github.com/ddinkov10/celetis/issues/364#issuecomment-7076152028"
      },
      "inference": "Inferred: the session moved a read to a new cadence and checked its result, not the side effects of the command at that cadence; the final reviewer found it by comparing with the other git reads of the engine. Not checked: an actual index.lock failure of a concurrent git command; the probe shows only the index write that needs the lock.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "8232c64"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "22f27074-5814-45f5-a416-38e445bd2d34",
      "requestDigest": "0b960835b38d78b3ca0d640c5a29d963a71c1b45facf1717c9a6fee9fd832c02",
      "date": "2026-11-22",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #364; claude child opus/high\n\nReviewer rule Approve: the proposal has observed tool-output evidence (a probe of mainNoRun that rewrote the index without the flag and not with it, commit 4bf4c24), states applicability, action, and check, and keeps the inferred cause and the unobserved index.lock failure apart from the facts. The engine already gives --no-optional-locks to its other polled git reads (engine/lib/process/git.ts, readDiff, quota-recovery), no active lesson states the same rule, and no skill, principle, or project instruction contradicts it. The evidence is data; no line of it changed the decision.",
      "related": [
        "give-a-polled-git-read-no-optional-locks"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up of #364, not authorized or checked: a check in scripts/verify.ts that refuses a git call of engine/ with status or diff and no --no-optional-locks."
      }
    }
  ]
}
---
# Give a git read that runs on a poll the flag --no-optional-locks

## What happened

The fix of #364 moved the dirty check of the main checkout from the issue read (every 5 minutes) into each `GET /api/board` (every 5 seconds). `isDirty` ran `git -C <path> status --porcelain` with no `--no-optional-locks`. The final review compared it with the other git reads of the engine. A probe then showed that each call rewrote the index of a checkout whose index was older than a tracked file. With the flag, the index stayed unchanged.

## Root cause

Inferred: the change kept the arguments of a read that ran rarely and checked only its result at the new cadence, not the side effect of the command. Plain `git status` refreshes the index and writes it under `index.lock` when it can. Uncertain: no concurrent git command was seen to fail; the probe shows the index write only.

## Fix

Commit 4bf4c24 adds `--no-optional-locks` to `isDirty`, as `readDiff`, `engine/lib/process/git.ts`, and `engine/lib/run/quota-recovery.ts` already do. Proposed structural follow-up, not authorized or checked: a check in `scripts/verify.ts` that refuses a `git` call of `engine/` with `status` or `diff` and no `--no-optional-locks`. It would reject the recorded call. Until it exists, the rule stays text.

## Detection signature

The mtime of `.git/index` changes after a read-only board or daemon poll; a concurrent git command fails with `index.lock: File exists`.

## Rule

Applies when a change adds a git read to a long-lived process or a poll, or moves an existing git read to run more often (a board request, a daemon tick, a timer). Action: give the read `--no-optional-locks` (or use the git helper of `engine/lib/process/git.ts`), and compare its arguments with the other git reads of the engine. Check: a probe that makes the index older than a tracked file, then runs the read once, shows that the mtime of `.git/index` does not change.
