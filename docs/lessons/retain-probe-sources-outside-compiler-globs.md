---
{
  "schema": 1,
  "name": "retain-probe-sources-outside-compiler-globs",
  "description": "Ignored TypeScript evidence copies entered the project compiler and failed the task gate",
  "tags": [
    "test",
    "build",
    "process"
  ],
  "date": "2026-11-04",
  "status": "active",
  "source": "Implementation of ddinkov10/celetis#245, temporary verification correction\n\nImplementation of ddinkov10/celetis#197, task gate attempt 1",
  "incidents": [
    {
      "id": "922a909d-5b67-458b-bcff-7583eedf72b2",
      "date": "2026-11-05",
      "action": "The coordinator copied temporary browser and fixture programs into the ignored verification directory with .ts extensions.",
      "expected": "Temporary checks remain outside the repository; evidence retention must not add executable source to the project type environment.",
      "observed": "The verify gate failed tsc on docs/superpowers/verification/245-idle-scroll/check.ts and server.ts. tsconfig.runtime.json includes **/*.ts and does not exclude that ignored directory.",
      "source": {
        "kind": "tool-output",
        "excerpt": "task-1-gate.log: check.ts(1,26): error TS7016; server.ts(6,311): error TS2322; FAIL: tsc (exit 1). tsconfig.runtime.json: include [\"**/*.ts\"].",
        "reference": "ddinkov10/celetis#245; retained verification logs"
      },
      "inference": "The local mismatch is confirmed. The reason for the unchecked assumption is inferred; no broader cause is established.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa plus the Idle scroll fix"
    },
    {
      "id": "celetis-197-task-gate-1-77d210c",
      "date": "2026-11-02",
      "action": "The controller copied temporary TypeScript probe source into ignored docs/superpowers/verification as .ts evidence files.",
      "expected": "Probes remain outside the project compilation. Retained evidence must preserve their contents without adding executable source to the project gate.",
      "observed": "tsconfig.runtime.json includes **/*.ts and does not exclude docs/superpowers. The task gate compiled the ignored run.ts copy and failed with TS2551.",
      "source": {
        "kind": "tool-output",
        "excerpt": "docs/superpowers/verification/197-20261102/run.ts(25,219): error TS2551: Property CELETIS_197_RESTRICTION does not exist on the inferred environment object. FAIL: tsc (exit 1).",
        "reference": "#197 task-gate-first.log at commit 77d210c8293585b10c86e2b00c32f04898aef42a"
      },
      "inference": "The controller treated Git ignore status as isolation from the compiler. The compiler include glob establishes the actual scope; Git tracking does not.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "77d210c8293585b10c86e2b00c32f04898aef42a"
    },
    {
      "id": "celetis-193-task-1-gate-6306e5e",
      "date": "2026-11-02",
      "action": "The implementer retained TypeScript source snapshots under ignored docs/superpowers/verification/193-implementation/task-1/source with .ts extensions, as directed to retain evidence by the coordinator.",
      "expected": "Retain exact source evidence without adding incomplete copies to the project compiler inputs.",
      "observed": "The task gate compiled the retained land.ts, tracker.ts, and refresh-hints.ts copies and failed with missing relative imports.",
      "source": {
        "kind": "tool-output",
        "excerpt": "docs/superpowers/verification/193-implementation/task-1/source/land.ts(4,29): error TS2307: Cannot find module './lib/config-core.ts' or its corresponding type declarations. FAIL: tsc (exit 1). verify: FAIL",
        "reference": "#193 task-1-gate.txt, 6306e5e5f98ccce75cec8940cbed27d765e1186f"
      },
      "inference": "Git ignore status was treated as isolation from compiler input. The existing related proposal was pending, so active lesson retrieval did not deliver it.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "6306e5e5f98ccce75cec8940cbed27d765e1186f",
      "brief": "Preserve source evidence under docs/superpowers/verification/193-implementation/; active lesson set is empty."
    },
    {
      "id": "celetis-236-baseline-ignored-prototype-20261104",
      "date": "2026-11-04",
      "action": "The prior prototype work retained incomplete TypeScript source snapshots under ignored docs/superpowers/verification/236-prototype with .ts extensions.",
      "expected": "Preserve the exact evidence without adding incomplete snapshots to project compiler inputs.",
      "observed": "The clean implementation baseline gate compiled the ignored snapshots and failed with TS2307 missing relative imports. Moving the whole evidence directory unchanged outside the checkout restored verify: PASS without a tracked source change.",
      "source": {
        "kind": "tool-output",
        "excerpt": "docs/superpowers/verification/236-prototype/evidence/archive/inline-source/engine/board/board.ts(1,49): error TS2307: Cannot find module '../lib/effort.ts' or its corresponding type declarations. FAIL: tsc (exit 1). After preserving the directory outside the checkout: verify: PASS.",
        "reference": "Issue #236 implementation baseline; docs/superpowers/verification/236-implement/baseline-gate-failed.txt and baseline-gate-pass.txt"
      },
      "inference": "The compiler includes **/*.ts independently of Git ignore status. The prototype author context is not available here; why the pending rule did not prevent the capture is unknown.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ed1f9befee7feb73958cccb5b94570c69a4d96b5",
      "brief": "The implement session active lesson read was empty. The matching proposal remained pending."
    }
  ],
  "recurrences": 3,
  "reviews": [
    {
      "id": "c4e0d504-ecea-4638-b3d9-6812457d8fbc",
      "requestDigest": "c117f1b60cf21f4eb15d239db7020ac048fa887800b3565bfc847169970c19a9",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nEdit under the reviewer rules: three tool-output incidents (#197, #193, #236) establish the same failure, and no active or historical lesson states this rule. The lane's tsconfig.runtime.json confirms the include glob and the missing exclude. The edit labels the inferred cause apart from the observed compiler scope and states the rule as applicability, action, and check. The rule changes no compiler configuration and weakens no gate. Incidents and evidence stay unchanged. The pending proposal c103dc73-7187-49a5-9ce1-d044cfdce92b states a similar rule but is outside this batch; a later curation can merge it.",
      "related": [
        "retain-probe-sources-outside-compiler-globs"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A separate change can make the evidence-copy step refuse a compilable snapshot inside compiler inputs, or exclude the evidence folder from the compiler configuration. This review does not authorize that change."
      }
    },
    {
      "id": "0a58ec11-7814-47d5-94d0-7878a4f4a0b2",
      "requestDigest": "72cdf4528306a02f8b74c9dfaed3dc07ae790be4747d1f5b38f413e9c4c1a3e8",
      "date": "2026-11-05",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nMerge under the reviewer rules: the active lesson states the same applicability, action, and compiler-scope check. The new retained tsc failure is a distinct incident. Keep all four incidents and the prior review, label the cause as inferred, and retain the proposed structural follow-up. The rule preserves the project gate and the prohibition on tracked tests. No permission or compiler exclusion is added.",
      "related": [
        "keep-executable-evidence-outside-project-scans",
        "retain-probe-sources-outside-compiler-globs"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A separate authorized change can make evidence retention refuse compilable snapshots inside compiler inputs. This curation changes no instruction, compiler configuration, or enforcement."
      }
    }
  ]
}
---
# Keep retained probe sources outside compiler globs

## What happened

In #197, temporary probes ran outside the checkout, but their source snapshots were copied into an ignored evidence directory with .ts extensions. The runtime tsconfig includes **/*.ts. The task gate compiled a snapshot and failed with TS2551. Renaming the snapshots to .ts.txt preserved their bytes without including them in compilation.

The same mistake occurred in #193 at 6306e5e: retained land.ts, tracker.ts, and refresh-hints.ts copies failed the task gate with TS2307 missing relative imports. The active lesson result was empty; this proposal was still pending.

The clean #236 implementation baseline also compiled ignored prototype snapshots at ed1f9bef and failed with TS2307. Moving the complete evidence directory unchanged outside the checkout restored the gate. The prior capture context is not available, and the active lesson set was empty.

In #245, ignored check.ts and server.ts evidence copies also entered the same compiler include glob. The task gate failed with TS7016 and TS2322. The incident confirms the same scope mismatch; the reason for the assumption remains inferred.

## Root cause

Observed: `tsconfig.runtime.json` includes `**/*.ts` and does not exclude `docs/superpowers`, so Git ignore status does not remove a file from compilation. Inferred: the controller treated Git ignore status as isolation from the compiler and did not compare the evidence location with the compiler include and exclude patterns. Why the pending proposal did not prevent the #193 and #236 recurrences is unknown; active lesson retrieval does not deliver a pending proposal.

## Fix

Proposed prevention: retain source as non-executable text or an archive when it sits inside a compiler scan. Check the project compiler scope before copying probe sources. This lesson changes no instruction or compiler configuration.

Proposed structural follow-up, not implemented or authorized by this capture: the evidence-copy helper can require non-compilable snapshot extensions and verify that copied files do not enter compiler inputs. The maintainer owns that separate change. A check must reject a .ts snapshot under the runtime include glob. Current enforcement is not claimed.

## Rule

Applies when a task retains probe source or source snapshots inside a checkout. Action: compare the evidence location and extension with the include and exclude patterns of each project compiler configuration. Keep runnable probes outside those inputs, and retain a snapshot inside a compiler scan as non-compilable text or an archive. Check: the compiler file list of the project (for example `tsc --listFilesOnly -p <config>`) names no retained evidence path, and the project gate gives no error for an evidence path.
