---
{
  "schema": 1,
  "name": "read-the-entry-shapes-of-a-generated-input-before-naming-a-check-rule",
  "description": "A plan named the new rules of the lock check of the gate from the flat lock of #348, and the real lock with nested keys and bundled entries failed the gate twice",
  "tags": [
    "build",
    "process",
    "false-positive"
  ],
  "date": "2026-11-20",
  "status": "active",
  "source": "The implement session of #344 on Claude Code, Task 1 (checkDependencies of scripts/verify.ts), 2026-11-20",
  "incidents": [
    {
      "id": "b80a9918-7407-4598-a02b-c9783424c984",
      "date": "2026-11-20",
      "action": "The Task 1 implementer changed checkDependencies of scripts/verify.ts as the plan brief said (accept devDependencies, skip the missing-install error only for a locked package with os, cpu, or libc) and ran the gate on the new engine/bun.lock.",
      "expected": "verify: PASS on the new lock, with only the platform packages of other platforms missing from the install.",
      "observed": "Two gate failures in a row on the same check: first 32 missing lines for nested lock keys, then three version lines for nested bundled entries.",
      "source": {
        "kind": "tool-output",
        "excerpt": "verify: engine/node_modules/conf/semver is missing; run bun install --frozen-lockfile --ignore-scripts in engine/ (scripts/worktree-setup.ts)\nverify: engine/node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/tslib has 2.8.1, and engine/bun.lock locks 2.9.1",
        "reference": "https://github.com/ddinkov10/celetis/issues/344"
      },
      "inference": "Inferred by the implementer: the check of #348 maps a lock key to node_modules/<key>, which holds only for a flat lock; the plan and the brief did not read the entry shapes of the real lock of the change (nested keys such as conf/semver, entries with bundled: true) before they named the rule. Alternative: the plan could not produce the lock before the build; then the brief should have named the shape read as a step.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "0730e810857f2ccfe0336c44b287f48d2c6bdf1f"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "8c2cc5e6-52a8-40bb-a77b-a363cf9b29a5",
      "requestDigest": "ce06a4b5eede6ae4b2f385f7809c37773c3fda1048d62737215e50fd960a480c",
      "date": "2026-11-20",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #334; claude child opus/high\n\nApprove by the reviewer rules: the proposal has observed tool-output evidence (two gate failures on the real engine/bun.lock of #344), separates the inferred cause and its alternative from the facts, and states applicability, action, and check. No active or historical lesson holds its incident. derive-plan-oracle-values-from-real-producers covers the expected values of a check, not the rule of a check over the entry shapes of a generated input, so the rule is new and not a merge. It widens no permission, weakens no check or gate, and agrees with the plan skill, task-lessons.md, and the principle test-behavior-not-implementation (a probe case per shape is an untracked probe, not a tracked test).",
      "related": [
        "read-the-entry-shapes-of-a-generated-input-before-naming-a-check-rule"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule depends on the shapes of each generated file and stays text; the lesson names no structural follow-up."
      }
    }
  ]
}
---
# Read the entry shapes of a generated input before naming a rule of its check

## What happened

Task 1 of #344 added twelve development packages to `engine/bun.lock` and changed `checkDependencies` of `scripts/verify.ts` by the rules of the plan: accept `devDependencies`, and skip the missing-install error only for a locked package with `os`, `cpu`, or `libc`. The gate then failed twice on the same check. First it printed 32 lines such as `verify: engine/node_modules/conf/semver is missing`. After a fix that mapped a nested lock key to its nested `node_modules` path, it printed three lines such as `verify: engine/node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/tslib has 2.8.1, and engine/bun.lock locks 2.9.1`. A skip of `bundled` entries made the gate pass.

## Root cause

Inferred, not proven: the check of #348 was written for a flat lock of two packages, and the plan named the new rules from that check, not from the entry shapes of the lock that the change produces (nested keys, `bundled: true`). An alternative is that the lock could not exist before the build; then the brief lacked a step that reads its shapes first.

## Fix

Proposed prevention, not enforced: before a plan or a brief names a rule of a check that reads a generated file (a lockfile, a manifest, a build output), produce or read that file of the change, list its entry shapes, and give the probe one case for each shape. The rule stays text, because the shapes depend on each generated file.

## Rule

Applies when a plan, a brief, or an implementer names or changes a rule of a check that reads a generated file (a lockfile, a manifest, a metafile, a build output). Action: produce or read that generated file as the change makes it, list each entry shape that the check reads (for example nested keys, platform fields, bundled entries), and state the rule for each shape. Check: the probe of the check has one case for each listed shape, and the gate on the real generated file of the change passes before the rule is called done.
