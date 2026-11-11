---
{
  "schema": 1,
  "name": "retain-probe-sources-outside-compiler-globs",
  "description": "TypeScript evidence copies in an ignored folder entered the project compiler five times, also with this rule in the brief",
  "tags": [
    "test",
    "build",
    "process",
    "recurring"
  ],
  "date": "2026-11-07",
  "status": "active",
  "source": "Task 1 of ddinkov10/celetis#250, implement step session (child report to the coordinator)\n\nImplementation of ddinkov10/celetis#245, temporary verification correction\n\nImplementation of ddinkov10/celetis#197, task gate attempt 1",
  "incidents": [
    {
      "id": "0b0ad6a4-3d0e-4a8f-9a55-250e1a5c0a01",
      "date": "2026-11-07",
      "action": "While saving evidence, the Task 1 implementer ran one cp of a mixed file list (serve.ts, seed-queue.ts, make-delayed.ts, and others) into docs/superpowers/verification/250-t1/ of the lane, which put three TypeScript probe sources with the .ts extension inside the checkout.",
      "expected": "Retained probe sources inside a compiler scan are non-compilable text or an archive (active lesson retain-probe-sources-outside-compiler-globs), so the gate never compiles an evidence path.",
      "observed": "The three .ts files existed in the evidence folder for one command; the implementer renamed them to .ts.txt at once, before any gate run. tsconfig.runtime.json includes **/*.ts and does not exclude docs/superpowers.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Child report: ls of the folder then showed serve.ts.txt, seed-queue.ts.txt, make-delayed.ts.txt; find . -name '*.ts' | wc -l -> 0; the later gate passed (verify: PASS) and tsc --listFilesOnly -p tsconfig.runtime.json listed 335 files and no docs/superpowers path.",
        "reference": ".superpowers/sdd/250/task-1-report.md of the lane feat/250-host-the-board-server-the (workspace scratch); summary retained in the runtime report of #250"
      },
      "inference": "Reported by the child: the earlier copies of the same step used explicit .txt names, and the batch form of one cp dropped them. Uncertain: whether a structural exclude would have removed the need for the rule; the cause of the batch form is the child's own account.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "7a2f331",
      "brief": "The Task 1 dispatch quoted the complete Rule of retain-probe-sources-outside-compiler-globs with its path and digest (.superpowers/sdd/250/task-1-dispatch.md, section Lesson rules).",
      "lesson": {
        "name": "retain-probe-sources-outside-compiler-globs",
        "revision": "b1c4a621bcd19a32f8badacd3515a039e560d318",
        "digest": "f9413c92f89a51e137f8109288035a19a9ebdd977309b72606527eee4948022a"
      }
    },
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
  "recurrences": 4,
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
    },
    {
      "id": "a0a34f48-f249-4cc1-afcf-4fa3e618b349",
      "requestDigest": "fd57ace655956617b66d178c8aed853a8e57f2993b99e0c3047fcdfc87482cc3",
      "date": "2026-11-07",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #250; claude child opus/high\n\nMerge under the reviewer rules: the active lesson retain-probe-sources-outside-compiler-globs states the same rule (retain a snapshot inside a compiler scan only as non-compilable text, and check the compiler file list), and the proposal names it as the lesson that its incident did not follow. The incident is observed: the Task 1 report of #250 in the lane retains the cp of serve.ts, seed-queue.ts, and make-delayed.ts into docs/superpowers/verification/250-t1/, the rename to .ts.txt before any gate run, and the tsc --listFilesOnly result; the folder now holds only the .ts.txt names, and tsconfig.runtime.json of the lane includes **/*.ts with no exclude of docs/superpowers. The proposed rule adds only a structural change, which this review cannot make: the survivor keeps the active name, every incident and review, and the active rule, adds the check of each file of a batch copy, and records the specific exclude as a proposed follow-up under the encode-lessons-in-structure principle of the plugin celetis. The cause stays labeled as the report of the child and as inference. The rule adds a check and weakens none.",
      "related": [
        "exclude-ignored-evidence-folders-from-the-runtime-compiler",
        "retain-probe-sources-outside-compiler-globs"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Add docs/superpowers/ to the exclude of tsconfig.runtime.json, which already excludes .claude and .superpowers, and of each other compiler configuration with a broad include; or let scripts/verify.ts refuse to compile an untracked file under an ignored folder. Check: a .ts file placed in docs/superpowers/verification/x/ gives no compiler input and no gate error. It needs separate authorization; this review changes no compiler configuration, gate, or instruction.",
        "owner": "the maintainer"
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

In Task 1 of #250 on 2026-11-07, the implementer saved its probe evidence with one `cp` of a mixed file list into `docs/superpowers/verification/250-t1/`, so three TypeScript probe sources kept the `.ts` extension inside the checkout. The dispatch of the task quoted the complete rule of this lesson. The implementer renamed the files to `.ts.txt` in the next command, before any gate run; the gate passed, and `tsc --listFilesOnly -p tsconfig.runtime.json` listed no evidence path.

## Root cause

Observed: `tsconfig.runtime.json` includes `**/*.ts` and excludes `.claude` and `.superpowers`, but not `docs/superpowers`, so Git ignore status does not remove a file there from compilation. Inferred: the controller treated Git ignore status as isolation from the compiler and did not compare the evidence location with the compiler include and exclude patterns. Why the pending proposal did not prevent the #193 and #236 recurrences is unknown; active lesson retrieval does not deliver a pending proposal.

In #250, reported by the child: the earlier copies of the same step used explicit `.txt` names, and the batch form of one `cp` dropped them. Inferred: a text rule that each session must apply at each copy keeps the mistake possible; this recurrence happened with the rule in the brief.

## Fix

Proposed prevention: retain source as non-executable text or an archive when it sits inside a compiler scan. Check the project compiler scope before copying probe sources, and check the name of each file of a batch copy. This lesson changes no instruction or compiler configuration.

Proposed structural follow-up, not implemented or authorized by this lesson: add the ignored scratch folder `docs/superpowers/` to the `exclude` of `tsconfig.runtime.json` and of each other project compiler configuration with a broad include, or let the project verify gate refuse to compile an untracked file under an ignored folder; an evidence-copy helper that requires non-compilable snapshot extensions is an alternative. The mistake has five incidents, and the exclude needs no judgment, so the encode-lessons-in-structure principle of the plugin celetis points to the structure. The maintainer owns that separate change. Its check: a `.ts` file placed in `docs/superpowers/verification/x/` gives no compiler input and no gate error. Current enforcement is not claimed; until the change exists, this text rule stays the prevention.

## Rule

Applies when a task retains probe source or source snapshots inside a checkout. Action: compare the evidence location and the extension of each copied file, also each file of a batch copy, with the include and exclude patterns of each project compiler configuration. Keep runnable probes outside those inputs, and retain a snapshot inside a compiler scan as non-compilable text or an archive. Check: after each copy, the compiler file list of the project (for example `tsc --listFilesOnly -p <config>`) names no retained evidence path, and the project gate gives no error for an evidence path.
