---
{
  "schema": 1,
  "name": "set-a-value-on-every-path-that-reaches-its-reader",
  "description": "A value set on one path missed another path to its reader twice: the rerun path of land() skipped check() (#356), and the daemon entry form --daemon skipped commandInput (#335)",
  "tags": [
    "git",
    "false-negative",
    "config",
    "process"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of #335 on Claude Code (Windows), Verify V8, 2026-11-22\n\nThe implement session of #356 on Claude Code, 2026-11-21",
  "incidents": [
    {
      "id": "b1ff1a99-7cc3-46fe-9f36-516731fc820a",
      "date": "2026-11-22",
      "action": "Task 6 set the process key grammar with useGrammar inside commandInput, and its task review stated that each engine command calls commandInput; the daemon entry form --daemon of engine/daemon.ts goes straight to runDaemon and never called it.",
      "expected": "Each process that parses a key, also the detached daemon, uses the grammar of the tracker of the project.",
      "observed": "In V8 with the daemon running, land <local key> exited 2 with the daemon usage line; POST /aside with {\"number\":\"dab0818\"} gave 400 and with {\"number\":\"12\"} gave 200. Fix task verify-1 (942dd19) sets the grammar at the daemon entry; V8 then passed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "POST /aside {\"number\":\"dab0818\"} -> 400; {\"number\":\"12\"} -> 200 (engine/daemon.ts:338 if (form === '--daemon') ... runDaemon)",
        "reference": "https://github.com/ddinkov10/celetis/issues/335#issuecomment-7076360053"
      },
      "inference": "The listed paths covered each command through commandInput but not the other argv forms of one entry file (--daemon, --session-start, --prepare-state). Alternative: the rule covers this, and the review list was incomplete.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "e8a0187",
      "brief": "Task 6 brief carried set-a-value-on-every-path-that-reaches-its-reader: \"list each entry path of the engine that parses a key (each command through commandInput, the daemon, the board server, a run, and any script that the launcher does not start)\".",
      "lesson": {
        "name": "set-a-value-on-every-path-that-reaches-its-reader",
        "revision": "611692e392d634d6204e9e7cd08b2ee4b6b3bc5c",
        "digest": "a67f7c3659dbc606419e86af487f149d2a848ee4706b1ec4a8e13e2c77fc3f96"
      }
    },
    {
      "id": "1a8f4e2c-6d3b-4b17-9c5e-3e7a2d6f8b40",
      "date": "2026-11-21",
      "action": "Task 3 of #356 (a0b8146) set `offTrunk` in `check()` of engine/lib/landing/merge.ts and read it in `land()` and `after()`, as plan step 3 said (\"With offTrunk, print ...\").",
      "expected": "Off the trunk, every landing that ends with exit 0 prints `land: the main checkout did not move to origin/<trunk>; run git pull on <trunk> there` (spec #356).",
      "observed": "The final review probe rerun.ts on 5c67013: a rerun after an exit 7 (lane tree already on origin/main, issue open) with the main checkout on claude/x gave exit 0 and only [\"land: #7 is on main\",\"land: chore/7-x and its worktree are gone\"]. The tree-equal branch of land() skips preflight, the only caller of check(). Fixed in 6fd6eaf: after() reads the branch itself, as after() of pr.ts does.",
      "source": {
        "kind": "tool-output",
        "excerpt": "exit: 0 / land lines: [\"land: #7 is on main\",\"land: chore/7-x and its worktree are gone\"]",
        "reference": "https://github.com/ddinkov10/celetis/issues/356#issuecomment-7062528315"
      },
      "inference": "Inferred: the plan and the task followed only the first-landing path of runLanding; the task review did not list the paths of land(). The task probes covered no rerun state.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "a0b8146e4a7b824863dfdf3da8b273b983138e88"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "3c6fcbac-da70-4adb-836f-b50f148f637a",
      "requestDigest": "ce323bdc97cd21597eb750e5f88934616327df13aca1ddc6551efb00d5e3a829",
      "date": "2026-11-21",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #356; claude child opus/high\n\nEdit (reviewer rules): the proposal has observed tool-output evidence (the rerun probe on 5c67013 gave exit 0 with no pull line off the trunk); its rule states applicability, action, and check; it widens no permission, skips no check, and contradicts no skill or principle; no live or historical lesson states its rule (list-every-producer-before-a-consumer-requires-a-new-part covers several producers of a shared input, and keep-a-copy-of-a-deduplicated-rule-on-each-path-that-reaches-its-act covers paths of agent text, not the call paths that skip a setter). The edit corrects the tag regression to false-negative, because the pull line off the trunk was new behavior of #356 and the task probes and the task review passed the gap, and links the two related lessons. The facts and the inferred cause stay apart as captured.",
      "related": [
        "set-a-value-on-every-path-that-reaches-its-reader"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is authorized in this curation."
      }
    },
    {
      "id": "47405bf1-43f4-4682-a31a-91350b17b1b1",
      "requestDigest": "864511f398d790c6815f3f45886c9228a819f5a3108c5d38b83f7ae7bc06acd2",
      "date": "2026-11-22",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #361; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed tool output: with the daemon running, POST /aside with a local key gave 400 and with a number gave 200, and the fix 942dd19 that sets the grammar at the daemon entry made V8 pass. The proposal states the rule of the active lesson set-a-value-on-every-path-that-reaches-its-reader for the case of a process-wide value and a process entry that skips its setter, and it names that merge as its reconciliation. Two active rules for one act would overlap, so the survivor is the active lesson, with its applicability and its action widened to each process entry, and with every incident and prior review kept. The tag regression of the proposal is not kept: the local key was new behavior of #335 and the task review passed the gap, as false-negative of the survivor states. The survivor keeps the facts and the inferred causes apart. It widens no permission, weakens no check, and contradicts no instruction, skill, or principle.",
      "related": [
        "set-a-process-wide-value-at-each-process-entry",
        "set-a-value-on-every-path-that-reaches-its-reader"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "One entry function that each import.meta.main block of the engine calls before its forms, with a gate check that each entry file calls it. It needs separate authorization."
      }
    }
  ]
}
---
# Set a value on every path that reaches its reader

## What happened

Task 3 of #356 set `offTrunk` in `check()` of the merge mechanism and read it in `land()` and `after()`, as the plan said. The task probes and the task review passed. The final review found that the tree-equal branch of `land()` (a rerun after an exit 7 whose push reached origin) skips `preflight`, the only caller of `check()`. Its probe on 5c67013, with the main checkout on `claude/x`, gave exit 0 with no pull line (tool output). The fix (6fd6eaf) makes `after()` read the branch itself.

The local tracker of #335 sets a key grammar for the whole process. The setter ran in `commandInput`. The daemon starts as a detached process with the argv form `--daemon`, which goes to `runDaemon` and skips `commandInput`. So the daemon parsed keys with the GitHub grammar and refused each local key: in V8, `POST /aside` with a local key gave 400 and with a number gave 200 (tool output). The brief carried this lesson and named the daemon; the task review accepted "each engine command calls commandInput" as the proof. The fix (942dd19) sets the grammar at the daemon entry.

## Root cause

Inferred (#356): the design traced only the path of a first landing. A value that one call sets and a later call reads is correct only on the paths that run the setter, and the rerun path did not.

Inferred (#335): the list of paths named the commands but not each argv form of each entry file, and a detached child of the same program is a separate process entry. Alternative: the rule covered this, and the review list was incomplete.

## Fix

Proposed, not enforced: when a change sets state in one call and reads it in another, list each path from each entry to the reader, and read the source fact at the reader when a path skips the setter. For a process-wide value, the entries are each argv form of each entry file and each detached or spawned child. A type cannot show the call order, so this stays text. Proposed structural follow-up (#335), which needs separate authorization: one entry function that each `import.meta.main` block of the engine calls before its forms, with a gate check that each entry file calls it.

## Rule

Applies when a change sets a value in one call (a closure variable, a field, a flag, or a process-wide value such as a module setting, a mode, or a grammar) and another call reads it later. Action: list each path from each entry to the reader (also the rerun, the early-return, and the error paths; for a process-wide value, each `import.meta.main` block, each argv form that it dispatches, and each detached or spawned child of the program), and either set the value on each such path before its first reader or compute it at the reader from its source. Check: a probe runs each listed path or entry form that skips the setter, for example the daemon mode, and observes the reader's result that the requirement names.

## Related lessons

[[list-every-producer-before-a-consumer-requires-a-new-part]]
[[keep-a-copy-of-a-deduplicated-rule-on-each-path-that-reaches-its-act]]
