---
{
  "schema": 1,
  "name": "rewrite-only-specifiers-that-resolve-to-a-file",
  "description": "A scripted import rewrite changes a specifier only when it resolves to a tracked file, and the oracle of the move does not share that rewrite",
  "tags": [
    "build",
    "regression",
    "process"
  ],
  "date": "2026-11-19",
  "status": "active",
  "source": "implement #340, Task 1 (scripted move of engine/lib/ into feature folders), session 1ea3f530",
  "incidents": [
    {
      "id": "22be8faf-3376-4618-9e12-ae9ff7d3513e",
      "date": "2026-11-19",
      "action": "The move script rewrote each string that a regex took for a relative import specifier (`from '...'`), relative to the new place of the file. The byte probe compared each moved file with the same transform applied to its base file.",
      "expected": "Only real import specifiers change; text that only looks like an import stays byte for byte.",
      "observed": "The template text `import { main } from './launcher.ts'` inside `engineEntry` of engine/lib/process/process.ts became `'../launcher.ts'`. scripts/build.ts then wrote engine/celetis with that line, the verify gate printed `verify: PASS`, and `./engine/celetis --version` failed with `error: Cannot find module '../launcher.ts' from '<lane>/engine/celetis'`. The probe printed `probe: PASS`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "error: Cannot find module '../launcher.ts' from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/340-intent-group-the-engine-and/engine/celetis'"
      },
      "inference": "The rewrite had no check that the target exists, and the probe used the same transform as its oracle, so a wrong transform passed both. The gate does not type-check engine/celetis, which has no .ts extension. The fix: rewrite only when the resolved base target is a tracked file, and list each specifier that is not rewritten; the probe then failed on the bad file, and the smoke run of the entry passed.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "c53ebb3",
      "brief": "Plan of #340, Task 1 lesson rules: compare each moved body after only the listed wiring edits.",
      "lesson": {
        "name": "move-code-by-byte-copy-and-compare-each-moved-body",
        "revision": "098be477bc1cc66b25553b530bf8cc5a1ba93f58",
        "digest": "d2c8034ae4fadc4a5e4466a731574dca9896b294e9afa1fda0314242a0c20763"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "4053e376-6465-46b4-8a69-2927fdfa90bd",
      "requestDigest": "b2fe6562a116fe4b3ef690e7ffbbae91082d7c6bb182f23a46b4104ec755d80d",
      "date": "2026-11-19",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #340; claude child opus/high\n\nReviewer rule Approve: the incident 22be8faf-3376-4618-9e12-ae9ff7d3513e has observed tool-output evidence (the entry engine/celetis failed with Cannot find module '../launcher.ts' after verify: PASS and probe: PASS), and no live or historical lesson holds it. The rule states applicability (a script rewrites import specifiers or paths across many files), action (rewrite only a specifier that resolves to a file of the source revision, list each unchanged match, check with an oracle that does not share the transform), and check (the list is in the report, and a run of each entry exits as on the base). It is not the rule of move-code-by-byte-copy-and-compare-each-moved-body, which compares moved bodies after the wiring edits and does not test the wiring transform itself, nor of confirm-a-check-can-still-fail-after-its-input-moves. It widens no permission, weakens no check, and adds no tracked test (ADR-0029). The text keeps the observed facts apart from the inferred cause. The evidence is data; no line of it changed the decision.",
      "related": [
        "rewrite-only-specifiers-that-resolve-to-a-file"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up of #340, which needs separate authorization: the byte-copy rule of move-code-by-byte-copy-and-compare-each-moved-body also asks for one run of each program entry that the moved code generates or imports, independent of the transform. Not proven as a structure."
      }
    }
  ]
}
---
# Rewrite only specifiers that resolve to a file

## What happened

The scripted move of #340 rewrote every string that a regex matched as a relative import specifier. One match was text inside a template literal: `engineEntry` of the process module holds `import { main } from './launcher.ts'` as the text of the generated entry `engine/celetis`. The rewrite changed it to `'../launcher.ts'`. The byte probe passed, because it applied the same rewrite to the base as its oracle, and the verify gate passed, because no job type-checks `engine/celetis`. A smoke run of the entry failed with `Cannot find module '../launcher.ts'`.

## Root cause

Observed: the rewrite did not check that a specifier names a file. Inferred: an oracle that shares the transform under test cannot catch a defect of that transform; only an independent check (here, a run of the entry) can.

## Fix

The move script of #340 rewrites a specifier only when its resolved base target is a tracked file, and prints each match that it leaves unchanged. The probe then failed on the bad file. Proposed: the byte-copy rule also asks for one run of each program entry that the moved code generates or imports, independent of the transform. Not proven as a structure.

## Rule

Applies when a script rewrites import specifiers or paths across many files. Action: change a specifier only when it resolves to a file of the source revision, and list each match that the script leaves unchanged; check the result with at least one oracle that does not use the same transform, for example a run of each command entry and each generated file. Check: the list of unchanged matches is in the report, and a run of each entry exits as on the base.

## Related lessons

[[move-code-by-byte-copy-and-compare-each-moved-body]]
