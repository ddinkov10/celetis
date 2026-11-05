---
{
  "schema": 1,
  "name": "a-failed-process-read-is-not-an-exit",
  "description": "A poll of a process identity took one failed ps read as the end of a live session",
  "tags": [
    "false-positive",
    "platform",
    "regression"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#232",
  "incidents": [
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
  "recurrences": 0,
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
    }
  ]
}
---
# Treat a failed process read as unknown, not as an exit

## What happened

In #232 the runner stopped taking the session end from the child `exit` event and polled the barrier identity with `processRuns && processStart === start` each 500 ms. A failed `ps` spawn resolves with code 1, so the helper said "gone". A probe that failed one `ps -o stat=` read made the runner exit 1 after 2.7 s while the host still ran, and leave its tab open. The final review caught it before the Verify phase.

## Root cause

Inference: a two-state liveness helper (runs / not runs) was reused for a decision that needs three states (runs / gone / unknown). The retained probe establishes one false exit after a failed read. It does not establish the frequency or cost of failures in other callers.

## Fix

Proposed prevention, not enforced: a process identity check returns runs, gone, or unknown; gone only on a definite read (for example `kill(pid, 0)` with `ESRCH`, or a successful `ps` that shows another start). A poll treats unknown as "read again", and a lock release treats it as "keep". A structural follow-up needs separate authorization: a type with the three outcomes, so the compiler forces each caller to handle unknown.

## Detection signature

A wait that ends at once after a transient tool failure; `status unknown` or a next step while the old host still works in its tab.

## Rule

Applies when code polls or checks an external process, terminal, or service to decide that something ended. Action: separate "gone" from "could not read", and decide the end only on a definite observation. Check: inject one failed read into a permitted probe. Confirm that the check preserves the live state after that failure and accepts a definite end, as in the control run.
