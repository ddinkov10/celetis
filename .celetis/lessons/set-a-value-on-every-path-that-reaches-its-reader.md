---
{
  "schema": 1,
  "name": "set-a-value-on-every-path-that-reaches-its-reader",
  "description": "The merge landing set offTrunk only in check(), and the rerun path of land() skips check(), so after() printed no pull line off the trunk",
  "tags": [
    "git",
    "false-negative"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "The implement session of #356 on Claude Code, 2026-11-21",
  "incidents": [
    {
      "id": "1a8f4e2c-6d3b-4b17-9c5e-3e7a2d6f8b40",
      "date": "2026-11-21",
      "action": "Task 3 of #356 (a0b8146) set `offTrunk` in `check()` of engine/lib/landing/merge.ts and read it in `land()` and `after()`, as plan step 3 said (\"With offTrunk, print ...\").",
      "expected": "Off the trunk, every landing that ends with exit 0 prints `land: the main checkout did not move to origin/<trunk>; run git pull on <trunk> there` (spec #356).",
      "observed": "The final review probe rerun.ts on 5c67013: a rerun after an exit 7 (lane tree already on origin/main, issue open) with the main checkout on claude/x gave exit 0 and only [\"land: #7 is on main\",\"land: chore/7-x and its worktree are gone\"]. The tree-equal branch of land() skips preflight, the only caller of check(). Fixed in 6fd6eaf: after() reads the branch itself, as after() of pr.ts does.",
      "source": {
        "kind": "tool-output",
        "excerpt": "exit: 0 / land lines: [\"land: #7 is on main\",\"land: chore/7-x and its worktree are gone\"]",
        "reference": "https://github.com/ddinkov10/celetis/issues/356#issuecomment-7062528315"
      },
      "inference": "Inferred: the plan and the task followed only the first-landing path of runLanding; the task review did not list the paths of land(). The task probes covered no rerun state.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "a0b8146e4a7b824863dfdf3da8b273b983138e88"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "3c6fcbac-da70-4adb-836f-b50f148f637a",
      "requestDigest": "ce323bdc97cd21597eb750e5f88934616327df13aca1ddc6551efb00d5e3a829",
      "date": "2026-11-21",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #356; claude child opus/high\n\nEdit (reviewer rules): the proposal has observed tool-output evidence (the rerun probe on 5c67013 gave exit 0 with no pull line off the trunk); its rule states applicability, action, and check; it widens no permission, skips no check, and contradicts no skill or principle; no live or historical lesson states its rule (list-every-producer-before-a-consumer-requires-a-new-part covers several producers of a shared input, and keep-a-copy-of-a-deduplicated-rule-on-each-path-that-reaches-its-act covers paths of agent text, not the call paths that skip a setter). The edit corrects the tag regression to false-negative, because the pull line off the trunk was new behavior of #356 and the task probes and the task review passed the gap, and links the two related lessons. The facts and the inferred cause stay apart as captured.",
      "related": [
        "set-a-value-on-every-path-that-reaches-its-reader"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is authorized in this curation."
      }
    }
  ]
}
---
# Set a value on every path that reaches its reader

## What happened

Task 3 of #356 set `offTrunk` in `check()` of the merge mechanism and read it in `land()` and `after()`, as the plan said. The task probes and the task review passed. The final review found that the tree-equal branch of `land()` (a rerun after an exit 7 whose push reached origin) skips `preflight`, the only caller of `check()`. Its probe on 5c67013, with the main checkout on `claude/x`, gave exit 0 with no pull line (tool output). The fix (6fd6eaf) makes `after()` read the branch itself.

## Root cause

Inferred: the design traced only the path of a first landing. A value that one call sets and a later call reads is correct only on the paths that run the setter, and the rerun path did not.

## Fix

Proposed, not enforced: when a change sets state in one method of an object and reads it in another, list each path from the entry to the reader, and read the source fact at the reader when a path skips the setter. A type cannot show the call order, so this stays text.

## Rule

Applies when a change sets a value in one call (a closure variable, a field, a flag) and another call reads it later. Action: list each path of the caller from its entry to the reader (also the rerun, the early-return, and the error paths), and either set the value on each such path or compute it at the reader from its source. Check: a probe runs each listed path that skips the setter and observes the reader's result that the requirement names.

## Related lessons

[[list-every-producer-before-a-consumer-requires-a-new-part]]
[[keep-a-copy-of-a-deduplicated-rule-on-each-path-that-reaches-its-act]]
