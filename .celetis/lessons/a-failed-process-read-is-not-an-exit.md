---
{
  "schema": 1,
  "name": "a-failed-process-read-is-not-an-exit",
  "description": "A failed liveness read was treated as a definite end in a process poll and in a planned terminal wait",
  "tags": [
    "process",
    "recurring",
    "false-positive",
    "platform",
    "regression"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "The implement session of #252 on Claude Code, task review of Task 2 (the coordinator session), 2026-11-10\n\nFinal review of ddinkov10/celetis#232",
  "incidents": [
    {
      "id": "eec23713-4ba1-4690-9f20-9817447cc52b",
      "date": "2026-11-10",
      "action": "The plan of #252 (Task 2, open step 5) told the start wait of the coordinator tab to read `terminalLive` each second and to treat a dead terminal as the refusal L6, which closes the tab. The same plan carried the lesson a-failed-process-read-is-not-an-exit in that task and the Global Constraint \"A failed read is unknown\". The implementer built the wait as the brief said and reported the conflict as a concern.",
      "expected": "A failed read of hc is unknown: the wait goes on until a definite end (L6) or its 60-second limit (L7). The spec of #252, \"Constraints and traps\": \"a failed read of the coordinator process or of a terminal is unknown. It is not 'gone' and not 'idle'.\"",
      "observed": "`terminalLive` returns false for a failed `hc get`, for a finished terminal, and for a removed terminal alike, so one failed read ends a good open with code 6, closes the tab, and prints a wrong cause.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Reviewer probe live.ts on b04b548, rerun by the implement session: `live true`, `failed false`, `finished false`, `notFound false`. engine/lib/coordinator.ts:130: `if (!(await terminalLive(terminal, exec))) throw new HostError(`coordinator: the tab ${tab} ended before its start barrier reported; …`",
        "reference": "https://github.com/ddinkov10/celetis/issues/252"
      },
      "inference": "Inferred cause: the plan copied the start wait of `startSession` of engine/lib/run-engine.ts, which has the same boolean read from before the lesson, and the lesson check of the plan covered the process reads (the 3-state `processState`) but not the terminal read. Alternative: the plan session judged the start wait harmless because no record exists yet; the plan does not say so.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "b04b548",
      "brief": "Task 2 of the plan of #252 (issue comment 6776961592): \"Read the `pid` file of the folder each 250 ms through `barrierOf`, and `terminalLive` each second. A dead terminal is L6\", with the lesson rule in the same task: \"separate 'gone' from 'could not read', and decide the end only on a definite observation\".",
      "lesson": {
        "name": "a-failed-process-read-is-not-an-exit",
        "revision": "b04b548",
        "digest": "61940f2f6253e8ae5b312918172859caa85909081fa3e13f5bbf6a6df50fb8da"
      }
    },
    {
      "id": "ba72b606-605d-42ba-90bc-085e299a1de3",
      "date": "2026-11-02",
      "action": "Task 3 of #232 replaced the child exit event of the session with a poll each 500 ms of processRuns(pid) && processStart(pid) === start. Both spawn ps; run() never rejects, so a failed spawn gives code 1, an empty field, and the result 'gone'. locks.ts release used the same check once per ref.",
      "expected": "The spec of #232: the exit of the barrier (its PID and process start) is the one sign that the session ended. A failed observation is not an exit; the runner neither stops nor starts the next step while the session works, and the issue lock stays while the session lives.",
      "observed": "With one failed 'ps -o stat=' read, the runner exited 1 after 2.7 s while the host ran 6 s more, left the tab open, and kept its own lock row; on a step the code would stop the watcher and either stop with 'status unknown' or start the next step while the old session ran.",
      "source": {
        "kind": "tool-output",
        "excerpt": "f1.ts on ca47313: 'CONTROL runner exit 0 after 8.3 s' / 'PSFAIL runner exit 1 after 2.7 s' / 'PSFAIL host lines at runner exit: [\"start ...\"] (host still running: true)' / 'PSFAIL failed ps reads: \"fail -p 78843 -o stat=\"'.",
        "reference": "ddinkov10/celetis#232, final review of 94b60b8..ca47313"
      },
      "inference": "Inferred: the old design took the end from an OS event that cannot fail this way; the new poll reused a two-state helper (runs / not runs) whose 'not runs' also covers 'could not read'. About 14,000 ps spawns in a one-hour session make a rare spawn failure likely. Uncertain how often ps spawns fail on the maintainer's machine.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ca47313"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "32746199-1897-40a3-b085-129dc2b4b0a4",
      "requestDigest": "ad75865d3ebfbdbf1ddab54f0c2a92b11a45c2c849fc36ef15b6bd9dd5ab0656",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #245; codex child host default/high\n\nEdit under the reviewer rules: the retained failed-read probe shows a false exit while the host remained live, and the rule states applicability, action, and a behavioral check. Remove the unsupported general claim that a false gone result was rare and cheap for lock callers. Preserve the original incident and its uncertainty. Clarify that the probe checks live state and a definite end, without requiring equal timing. The rule agrees with the domain-model, precise-type, and behavioral-check principles; structural work stays proposed.",
      "related": [
        "a-failed-process-read-is-not-an-exit"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Consider a separate type change that requires callers to distinguish runs, gone, and unknown. This review does not authorize that change."
      }
    },
    {
      "id": "9b8bdb22-91c4-4ec8-ae2d-e72a0738eb6d",
      "requestDigest": "af58ae8d57f11e4fc5ecf9c399eb2d59b017be3fce489391de453a337cd8f0b3",
      "date": "2026-11-10",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #287; codex child host default/high\n\nMerge under the reviewer rule for a proposal that states the same rule as an active lesson. Both incidents show a failed external liveness read combined with a definite end. Preserve every incident, original source, and prior review; extend the survivor to apply before a plan chooses the read and retain the failed-read probe check. The retained probe is observed evidence; the claimed copying cause remains inference with its alternative. The rule agrees with model-the-domain, type-system-discipline, test-behavior-not-implementation, the plan task-lesson requirements, and AGENTS.md. It widens no permission, weakens no gate, and requires no network or credential act. Structural work stays proposed.",
      "related": [
        "decide-an-end-only-from-a-read-that-has-an-unknown-result",
        "a-failed-process-read-is-not-an-exit"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Move any remaining end decision from a boolean liveness read to a separate unknown result and remove obsolete boolean helpers. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Treat a failed process read as unknown, not as an exit

## What happened

In #232 the runner stopped taking the session end from the child `exit` event and polled the barrier identity with `processRuns && processStart === start` each 500 ms. A failed `ps` spawn resolves with code 1, so the helper said "gone". A probe that failed one `ps -o stat=` read made the runner exit 1 after 2.7 s while the host still ran, and leave its tab open. The final review caught it before the Verify phase.

In #252, a plan told a new terminal start wait to use the boolean `terminalLive` read for its end decision. A reviewer probe returned `false` for a failed read, a finished terminal, and a removed terminal. The task already carried this lesson and the constraint that a failed read is unknown. The implementer followed the planned call and reported the conflict.

## Root cause

Inference: a two-state liveness helper (runs / not runs) was reused for a decision that needs three states (runs / gone / unknown). The retained probe establishes one false exit after a failed read. It does not establish the frequency or cost of failures in other callers.

For #252, the proposed cause is that the plan copied an older boolean wait and checked process reads without checking the terminal read. The evidence does not exclude a deliberate but unstated judgment about the start wait.

## Fix

Proposed prevention, not enforced: a process identity check returns runs, gone, or unknown; gone only on a definite read (for example `kill(pid, 0)` with `ESRCH`, or a successful `ps` that shows another start). A poll treats unknown as "read again", and a lock release treats it as "keep". A structural follow-up needs separate authorization: a type with the three outcomes, so the compiler forces each caller to handle unknown.

Before a plan names a liveness read, list its results for a failed call, a definite end, and a live target. A boolean read that combines failed and ended results cannot support this decision. The #252 proposal reports a three-state terminal read for the new wait; moving the older `startSession` wait and removing the boolean function remain proposed structural work, with no enforcement claim from this review.

## Detection signature

A wait that ends at once after a transient tool failure; `status unknown` or a next step while the old host still works in its tab.

## Rule

Applies when a plan or code polls or checks an external process, terminal, session, or service to decide that something ended. Action: before naming the read in a plan or using it in code, list its results for a failed call, a definite end, and a live target; use a read that separates "gone" from "could not read", and decide the end only on a definite observation. Check: inject one failed read into a permitted probe. Confirm that the check preserves the live state after that failure and accepts a definite end, as in the control run.
