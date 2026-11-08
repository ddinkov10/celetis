---
{
  "schema": 1,
  "name": "check-forwarded-output-with-a-late-reader",
  "description": "A suite runner that forwards piped output kept the order only for an eager reader; with a late reader a land line came at line 8192 of the suite output",
  "tags": [
    "regression",
    "platform-quirk",
    "test"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Task review and implementer incident of ddinkov10/celetis#276, Task 1, fix round 1",
  "incidents": [
    {
      "id": "a635e47e-53da-4839-97b5-517587360dc8",
      "date": "2026-11-08",
      "action": "In the concern-fix round of #276 Task 1 (commit 8bec1c1), streamBun forwarded each suite chunk with process.stdout.write or process.stderr.write and resolved at close; the report claimed the suite bytes reach stdout and stderr in order before streamBun resolves, with covering checks that read land output with an eager reader only.",
      "expected": "The order and the bytes of the base land on each stream, also when the reader of land lags (the ruling on concern 2, and the global byte rule of the plan).",
      "observed": "With a stdout reader 3 s late, land: #1 is on main came at line 8192; the base land had it at line 131072. The task reviewer and the controller reproduced it (order-probe: streamBun AFTER at 8192 of 131074, runBun at 131072).",
      "source": {
        "kind": "tool-output",
        "excerpt": "FAIL o: … land line base 131072, lane 8192",
        "reference": "docs/superpowers/verification/276-t1/fix-2-red/probe.out in the #276 lane; .superpowers/sdd/276/task-1-review.md Important 1"
      },
      "inference": "Inferred, not certain: the order of the writes in the process was taken as the order of the bytes in the pipe. On Bun 1.4.4 a queued process.stdout.write and a direct console.log are two writers, and an eager reader queues nothing, so it cannot show the difference. Alternative: another Bun version behaves differently.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "8bec1c128ca867cae06d957a55da11f5ca76964d"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "2a4693e4-3e3a-49ec-b9f0-b9448f26432a",
      "requestDigest": "f96da32a83452ad14384a039f627cf5a5c4609773f87b0062a8213c7fc5442fe",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #276; claude child opus/high\n\nApprove, under the reviewer rules: the retained probe output of the #276 Task 1 review (the land line at line 8192 of the lane against 131072 of the base, with a reader 3 s late) establishes the incident, and the task reviewer and the controller reproduced it. The root cause is labeled as inference with its alternative. The rule states applicability, action, and check; it grants no permission, adds no network or credential act, weakens no check, and contradicts no project instruction, skill, or principle. No active or historical lesson states the same rule: keep-byte-preserving-transformations-reversible covers the bytes, not the order of two writers of one stream. The lane code at 90aa8bb (streamBun in engine/lib/process.ts) waits for the callback of each forwarded write, as the Fix says.",
      "related": [
        "check-forwarded-output-with-a-late-reader"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal names no structural follow-up. The repair in engine/lib/process.ts (streamBun waits for the callback of each forwarded write) is part of the #276 change."
      }
    }
  ]
}
---
# Check forwarded output with a late reader on each stream

## What happened

In #276 Task 1, `streamBun` forwarded the piped suite output with `process.stdout.write` and `process.stderr.write`, and the landing then printed its `land:` lines with `console.log` and `console.error`. The covering checks read the output of `land` with an eager reader and passed. The task review ran a reader that started 2–3 s late: `land: #1 is on main` came at line 8192 of the suite output, and the base `land` (inherited stdio) had it at line 131072. The fix waits for the callback of each pending write before `streamBun` resolves.

## Root cause

Inference, not certain: the order of the writes in the process was taken as the order of the bytes in the pipe. On Bun 1.4.4, a full pipe makes `process.stdout.write` queue and return `false`, while `console.log` writes past that queue. An eager reader never fills the pipe, so it cannot show the difference. Bun 1.4.4 also kept emitting `data` events from a paused child pipe, so pause and resume did not give backpressure.

## Fix

The repair resolves only after the callback of each pending forwarded write, and adds probe cases with a late reader on stdout and on stderr that compare the bytes and the line index of each `land:` line with the base program. The rule stays text, because the writers of a stream and the reader timing depend on the caller.

## Rule

Applies when a change moves output from an inherited descriptor into a pipe that the process forwards, or adds a second writer (a stream API and a console API) to one output stream. Action: before relying on the order, list each writer of each stream, and wait for each forwarded write to flush before a later writer runs. Check: a probe with a reader that starts late on each stream, with more output than one pipe buffer, compares the bytes and the position of each later line with the program before the change.

## Related lessons

[[end-a-piped-child-at-its-exit]] [[keep-byte-preserving-transformations-reversible]]
