---
{
  "schema": 1,
  "name": "keep-the-cleanup-scope-of-decision-code-that-moves-out-of-a-try",
  "description": "A driver loop from an approved spec called the pure table entry outside each try, so a throw of decision code that the old finally blocks covered skipped both cleanups of a run",
  "tags": [
    "process",
    "regression",
    "false-negative"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of ddinkov10/celetis#289 on Claude Code, final whole-branch review (the coordinator session), 2026-11-11",
  "incidents": [
    {
      "id": "abb92680-c7ce-4ce1-ba26-b562e7953629",
      "date": "2026-11-11",
      "action": "The spec of #289 gave a driver loop that calls the table entry between the try of the activity and the try of the effects, and Task 3 built that loop as written. The decision code of the entries came from the try blocks of `runIssue` and `work`, whose finally blocks ran the cleanup of the issue and of the run for each throw.",
      "expected": "A throw of the moved decision code runs the cleanup of the issue and of the run, as the finally blocks of the base did (spec 11 and spec 14 of #289: the same acts as the base on each path).",
      "observed": "The final reviewer patched one entry to throw. The run released no lock, called no releaseAll, and kept the label `starting`. With the same throw in an activity (the control), `closing` and `ending` ran and the label was `finished`. The coordinator reran the probe with the same result. Three task reviews and the driver probe (25 checks) did not find it, because each test of a throw used an activity or an effect.",
      "source": {
        "kind": "tool-output",
        "excerpt": "{\"mode\":\"entry\",\"trace\":[\"act starting\",\"act admitting\",\"act binding\",\"entry binding.bound throws\"],\"label\":\"starting\"} against {\"mode\":\"activity\",\"trace\":[...,\"activity binding throws\",\"act closing\",\"release issue-7\",\"act ending\",\"releaseAll\"],\"label\":\"finished\"}",
        "reference": "https://github.com/ddinkov10/celetis/issues/289"
      },
      "inference": "Inferred cause: the design treated a pure function as code that cannot throw, so the loop gave it no failure path, and each later step compared the loop with the spec text, not with the scope of the old try blocks. Uncertain: no current entry throws for a valid input, so the gap was a latent risk, not an observed failure of a run.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "e3fb9b2"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c447f2d6-b9b3-4893-af25-4a030aa13cf2",
      "requestDigest": "093d1131837354a1515048ff14cebd2518d86eebb903e567bea597f8233d3887",
      "date": "2026-11-12",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #289; claude child opus/high\n\nApprove (reviewer rule: approve a proposal that no other rule rejects, merges, replaces, or skips). The proposal has observed tool-output evidence: a fault injection in one table entry gave the trace `entry binding.bound throws` and the label `starting`, while the same throw in an activity ran `closing`, `release issue-7`, `ending`, and `releaseAll`. It is a substantive defect against spec 11 and spec 14 of #289, not a new requirement. Its rule states applicability, action, and check. No live or historical lesson holds its incident or states its rule: keep-each-effect-of-a-removed-helper-call governs a removed helper call, and a-moved-check-keeps-the-states-of-its-old-rule governs the accept states of a moved check, not the error-handling scope of moved code. The text keeps the latent-risk uncertainty and the diagnosis unknown apart from the facts. The rule widens no permission, adds no tracked test, and agrees with the principles preserve-intended-behavior and test-behavior-not-implementation.",
      "related": [
        "keep-the-cleanup-scope-of-decision-code-that-moves-out-of-a-try"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Which error-handling scopes matter needs a read of the old code, so the rule stays text; the proposal names no structural check."
      }
    }
  ]
}
---
# Keep the cleanup scope of decision code that moves out of a try

## What happened

The spec of #289 moved the decisions of a run from a closure into pure table entries, and gave a driver loop that calls the entry outside each `try`. At the base, that decision code ran inside `try` blocks whose `finally` blocks released the locks and the records of the issue and of the run. The final review patched one entry to throw: the run kept its lock and its label, and no cleanup ran. The same throw in an activity ran both cleanups. The fix put the entry call inside the `try` of the effects, so that a throw of an entry takes the failure path of the state.

## Root cause

Inference: a pure function was treated as a function that cannot throw. The plan and the task reviews compared the driver with the loop text of the spec, and each throw test used an activity or an effect. Unresolved alternative: a spec review with a fault-injection case for each kind of call in the loop would have found it before the plan.

## Fix

Proposed prevention (text): the rule below, for a spec, a plan, and a review of a refactor that moves code out of an error-handling scope. It stays text, because which scopes matter needs a read of the old code. No enforcement is proven.

## Rule

Applies when a design or a change moves code out of a `try`, a `finally`, or another error-handling scope into a new call site (a table entry, a callback, a pure helper). Action: list each `catch` and `finally` that covered the code at its old place, and give the new call site a failure path that runs the same cleanup; do not assume that pure code cannot throw. Check: a probe makes each kind of call of the new loop throw once (not only the kinds that do I/O) and observes the same cleanup acts as the old code gives for a throw at that point.
