---
{
  "schema": 1,
  "name": "end-a-piped-child-at-its-exit",
  "description": "A suite runner that moved from inherited stdio to pipes waited at close for a leaked descendant, also after an abort",
  "tags": [
    "regression",
    "platform-quirk"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Implementer concern and controller reproduction of ddinkov10/celetis#276, Task 1",
  "incidents": [
    {
      "id": "342efeba-4b7d-4cbd-ac6a-012fbd24d56e",
      "date": "2026-11-08",
      "action": "Task 1 of #276 implemented streamBun to resolve at the close event of the suite child, after it changed the suite stdio from inherited (runBun) to pipes.",
      "expected": "The landing ends when the suite exits, as runBun with inherited stdio did, also when a descendant of the suite keeps a pipe open; an abort ends it too.",
      "observed": "For a suite that exits 0 and leaves /bin/sleep 4 with inherited stdout and stderr, runBun resolved after 19 ms, streamBun after 4025 ms, and streamBun aborted at 1 s after 4054 ms.",
      "source": {
        "kind": "tool-output",
        "excerpt": "runBun: status 0 after 19 ms / streamBun: status 0 after 4025 ms / streamBun aborted at 1 s: status 143 after 4054 ms",
        "reference": "ddinkov10/celetis#276 Task 1 report, Concern 2; controller rerun of grandchild-probe.ts"
      },
      "inference": "Tool fact: close fires when every holder of the pipe write end has closed it, and a descendant that inherits the pipe holds it. Inferred: the plan interface named the end status but not the end event. The implementer flagged it and kept close to keep the order of the last suite bytes.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "6ee5211285c37e4109f573592d42198b27d5b7a8"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "d84873af-bff9-462d-acb1-1edbbdf0cc10",
      "requestDigest": "3ae62936d762854c9b661b323eeae2b9d07a2101ee7e6083b2356f7bd30274fd",
      "date": "2026-11-08",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #276; claude child opus/high\n\nEdit, then approve, under the reviewer rules: the retained timings of the implementer and the controller rerun (runBun 19 ms, streamBun 4025 ms, and 4054 ms after an abort at 1 s) establish the incident, and the close semantics of a pipe that a descendant holds is a tool fact. The edit moves the effect on the daemon of Task 2 from What happened into Root cause as an inference, because no run observed it, and links the related active lesson check-forwarded-output-with-a-late-reader. The rule states applicability, action, and check; it grants no permission, adds no network or credential act, weakens no check, and contradicts no project instruction, skill, or principle. No active or historical lesson states the same rule. The lane code at 90aa8bb (streamBun in engine/lib/process.ts) ends 1 s after the exit and destroys the pipes, as the Fix says.",
      "related": [
        "end-a-piped-child-at-its-exit"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal names no structural follow-up. The repair in engine/lib/process.ts (streamBun ends 1 s after the exit and destroys the pipes) is part of the #276 change."
      }
    }
  ]
}
---
# End a piped child at its exit, not at the close of its pipes

## What happened

Task 1 of #276 moved the suite of a landing from inherited stdio (`runBun`) to pipes (`streamBun`), and `streamBun` resolved at the `close` event of the child. A suite that exits 0 and leaves a background `/bin/sleep 4` with its stdout and stderr made `streamBun` resolve after 4025 ms, and after 4054 ms when it was aborted at 1 s. `runBun` resolved after 19 ms.

## Root cause

Tool fact: `close` fires when each holder of the pipe write end closed it, and a descendant that inherits the pipe holds it. With inherited stdio no pipe existed, so the end came at the exit. Inference: the plan interface named the end status but not the end event. Inferred, not observed: in the daemon of Task 2, the same wait would hold the landing, each later landing, and the 60 seconds of `celetis daemon stop` for the life of a leaked descendant.

## Fix

The ruling of the build: resolve at the `close`, or at a short bound after the `exit`, then destroy the pipes; probe a leaked descendant in a normal and an aborted run. The prevention stays text: the bound and the drain need judgment for each caller.

## Rule

Applies when a change moves a child process from inherited stdio to pipes, or when code waits on a child whose descendants can inherit its pipes. Action: decide the end of the child by its exit; then drain the pipes for a short bounded time, destroy them, and resolve; an abort follows the same rule. Check: a probe child that exits and leaves a descendant that holds its stdout and stderr ends the wait within the bound, in a normal and an aborted run, while the control with inherited stdio shows the old end time.

## Related lessons

[[recheck-process-liveness-claims-in-a-long-lived-process]] [[check-forwarded-output-with-a-late-reader]]
