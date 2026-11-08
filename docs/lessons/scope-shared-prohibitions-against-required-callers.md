---
{
  "schema": 1,
  "name": "scope-shared-prohibitions-against-required-callers",
  "description": "Shared instruction changes blocked preserved callers: a global entry prohibition, a new completion test of a step, and a step pointer to a web-only rule",
  "tags": [
    "process",
    "regression",
    "test",
    "recurring"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#277 (final-reviewer-277, opus/xhigh, 2026-11-08), reproduced by the build\n\nFinal review of ddinkov10/celetis#197",
  "incidents": [
    {
      "id": "07bc92be-a7a7-4842-bad0-7ebc7e6fe193",
      "date": "2026-11-08",
      "action": "Task 2 of #277 made step 2 of docs/procedures/ui.md complete only \"when its findings are in `## Prior art`\" and took the first prompt of `generate` from `## Prior art`; a direct run of /celetis:prototype writes no `## Prior art`.",
      "expected": "Each preserved caller of the changed step keeps a test that it can meet, also the direct run.",
      "observed": "Reading check x5 (claude -p, ui.md 58b7ca08 at e82ee2e): \"The test for 'complete' is not settled by the text for this case … a direct run has no such section\"; the source of the prompt was not settled either.",
      "source": {
        "kind": "tool-output",
        "excerpt": "x5 Q1: \"No, not yet. The text does not settle when step 2 is complete in a direct run.\"",
        "reference": "Runtime report on ddinkov10/celetis#277; docs/superpowers/verification/277-final-red/x5 of the main checkout"
      },
      "inference": "The lesson scope-shared-prohibitions-against-required-callers was not in the Task 2 brief, and the boundary scan did not add it for a new completion test. The build checked the callers of the bypass, not the callers of the new step-2 gate.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "e82ee2e57fc46513098201b3c744962386cde3e4",
      "brief": "Task 2 lesson rules: check-every-consumer-of-a-skipped-upstream-step, give-each-agent-rule-a-check-where-its-actor-reads, keep-child-verification-prompts-independent (no scope-shared-prohibitions)",
      "lesson": {
        "name": "scope-shared-prohibitions-against-required-callers",
        "revision": "40a31cb92ecce73591fc4c75321489240c5392fa",
        "digest": "c5d83fa406da65eea249ed9cfd8e53c8bb40192df233427de4a6fe8eee555b3e"
      }
    },
    {
      "id": "4eb9da81-ce51-4c3e-a96d-3fa7896070a4",
      "date": "2026-11-08",
      "action": "Task 3 of #277 changed step 7 of docs/procedures/ui.md to hide the bar \"as 'Captures' says\" and wrote a hide in \"Captures\" that uses the `style` property and the page CSP, for every kind.",
      "expected": "The captures of mobile, desktop, and terminal keep a hide rule that they can apply.",
      "observed": "Reading check x8 (claude -p, ui.md 58b7ca08 at e82ee2e): \"The text does not settle this … each method in the rule exists only in a web page … A SwiftUI or UIKit overlay in the iOS simulator has none of these.\"",
      "source": {
        "kind": "tool-output",
        "excerpt": "x8 Q1: \"Not settled by the text.\"; Q2: \"Desktop: not settled by the text.\"",
        "reference": "Runtime report on ddinkov10/celetis#277; docs/superpowers/verification/277-final-red/x8 of the main checkout"
      },
      "inference": "The lesson was in the Task 3 brief, and the build listed the callers of the bypass, but it did not list the callers of the changed step-7 pointer, which every kind reads.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "e82ee2e57fc46513098201b3c744962386cde3e4",
      "brief": "Task 3 lesson rules: scope-shared-prohibitions-against-required-callers sha256:c5d83fa4…; ledger \"callers of the changed operations\" line (bypass callers only)",
      "lesson": {
        "name": "scope-shared-prohibitions-against-required-callers",
        "revision": "40a31cb92ecce73591fc4c75321489240c5392fa",
        "digest": "c5d83fa406da65eea249ed9cfd8e53c8bb40192df233427de4a6fe8eee555b3e"
      }
    },
    {
      "id": "celetis-197-final-review-setup-scope-20261102",
      "date": "2026-11-02",
      "action": "The implementation made update check conditional on an explicit status or troubleshooting request without bounding the rule to entry maintenance. The reviewer initially treated unchanged setup source as preservation.",
      "expected": "The plan removes optional automatic entry maintenance while preserving setup step 4, which explicitly requires the same command for chosen-host discovery.",
      "observed": "The shared entry permits the command only for status/troubleshooting, while setup step 4 requires it for a separate setup task. The coordinator identified the caller; the reviewer then reported the instruction conflict as Important.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Final review: setup:30 says \"Run celetis --agent <host> update check once\"; entry:86 says \"only when the person explicitly requests update status or update troubleshooting.\" Category: non-behavioral instruction-contract finding; no executed setup failure claimed.",
        "reference": "#197 review at 77d210c8293585b10c86e2b00c32f04898aef42a; /root/final_review_197"
      },
      "inference": "Inferred: the shared rule was reviewed mainly against ordinary-work scenarios, and byte-preservation of setup was mistaken for preservation of its dependent instructions. The reviewer reported this uncertainty.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "77d210c8293585b10c86e2b00c32f04898aef42a"
    }
  ],
  "recurrences": 2,
  "reviews": [
    {
      "id": "2d4be774-427c-4db0-8376-fb0ff50d66b8",
      "requestDigest": "c5427757514ce8c5932f213827b17ab1c6add6b7eeb77aa50670ca00ae95531b",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #236; codex child host default/high\n\nApprove under the reviewer rules: the retained instruction-conflict evidence is observed, the cause is marked as inferred, and the rule states its scope, caller check, and required verification. It preserves the current entry exception for task-required commands and the existing gate.",
      "related": [
        "scope-shared-prohibitions-against-required-callers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule needs judgment about instruction callers. No structural follow-up is required by this decision."
      }
    },
    {
      "id": "b63b854f-9c11-4403-b8a2-0ba957aaa021",
      "requestDigest": "16810741e440f0720d395ad3b3ac3c3bbed3f9294528dfdd98e26ecfe12d72e5",
      "date": "2026-11-08",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #277; claude child opus/high\n\nMerge under the reviewer rules: the active lesson scope-shared-prohibitions-against-required-callers states the same rule, and both incidents of the proposal name it at its current digest c5d83fa4: the boundary scan did not carry it into the Task 2 brief (not-retrieved), and the Task 3 brief carried it (not-followed). The final review of #277 cites this lesson for the narrowed hide. The incidents are observed: the reading checks x5 and x8 (277-final-red, and 277-final-review/checks) answer that the text does not settle the completion of step 2 in a direct run or the hide of a mobile or a desktop capture, and lane commit ad306ab adds the fixes that the proposal names to docs/procedures/ui.md. A new completion test of a shared step and a pointer to a rule for only some callers are exclusive conditions of a shared instruction. So the survivor keeps the active name, the three incidents, and the earlier review, and widens the applicability to them, with the list of each path, kind, and direct run, and a test or a rule that each caller can meet. The body keeps the observed briefs and reading-check answers apart from the inferred causes. The rule adds checks, weakens none, widens no permission, adds no network or credential act, and agrees with the principle preserve-intended-behavior, with docs/procedures/task-lessons.md (the boundary scan selects each rule that constrains the scope, and the wider applicability names these changes), with \"A direct run\" of docs/procedures/ui.md, and with skills/prototype/SKILL.md. By the principle encode-lessons-in-structure, the rule stays text: the repository has no machine-readable model of the callers of a shared step.",
      "related": [
        "check-every-caller-of-a-new-step-gate-or-pointer",
        "scope-shared-prohibitions-against-required-callers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the repository has no machine-readable model of the callers of a shared step, and finding them needs judgment. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Scope each shared prohibition, step gate, and pointer against every preserved caller

## What happened

In #197, a new global entry rule permitted update check only for explicit status or troubleshooting requests. The approved plan also preserved setup step 4, which requires that command for chosen-host discovery. Setup source was unchanged, but the shared instruction made its operation ambiguous. The coordinator identified the caller and the final reviewer reported an Important instruction conflict. No runtime setup failure was claimed.

In #277, Task 2 made step 2 of `docs/procedures/ui.md` complete only "when its findings are in `## Prior art`", and the first prompt of `generate` came from `## Prior art`. A direct run of `/celetis:prototype` writes no such section. The reading check x5 answered that the text does not settle when step 2 is complete in a direct run, nor the source of the prompt. Task 3 changed step 7 of the same file to hide the bar or the overlay "as 'Captures' says", and the one hide of "Captures" used the `style` property and the page CSP. The reading check x8 answered that the text does not settle the hide for a mobile or a desktop capture. The Task 2 brief did not carry this lesson. The Task 3 brief carried it, and the ledger line of the callers of the changed operations named only the callers of the bypass.

## Root cause

Inferred: review of the shared trigger focused on ordinary maintenance, while unchanged caller bytes were treated as sufficient preservation. The interaction between the global exclusive condition and the existing task-required command was missed.

In #277, inferred: the boundary scan did not add this lesson for a new completion test, and the build checked the callers of the bypass, not the callers of the new gate of step 2. For the pointer of step 7, the lesson was in the brief, but the build listed the callers of the bypass, not the callers of the changed step, which every kind reads. Each change looked local to the path of the issue.

## Fix

Proposed prevention: before adding an exclusive shared trigger, find task-specific callers and compare their required operations with the new condition. Bound the condition to its intended role. Keep a focused caller scenario in the existing verification plan. This remains a judgment rule because the repository has no machine-readable instruction dependency model.

The fix of #277: a direct run gives its findings for the hand-over the place of `## Prior art` in steps 2 and 3 and in the prompt of `generate`, and the `style` hide applies "On the web", while step 7 keeps a hide for each kind. Proposed prevention, not proven: a plan task that adds a completion test to a shared step, or that points a shared step to a narrower rule, carries this lesson, and its reading check starts from each preserved caller (other paths, other kinds, direct runs).

## Rule

Applies when a shared instruction adds an exclusive trigger or a prohibition, adds a completion test to a shared step, or points a shared step to a rule that serves only some of its callers. Action: list every preserved caller of the affected operation or step (each task-specific caller, path, kind, and direct run), not only the callers of the main operation of the change. Source bytes alone do not prove preservation. Confirm that the shared rule still permits each required caller, and give each caller a test or a rule that it can meet. Check: verify each listed caller through its normal interface; for agent text, a reading check from each listed caller settles its next act.

## Related lessons

[[check-every-consumer-of-a-skipped-upstream-step]]
