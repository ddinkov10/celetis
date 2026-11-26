---
{
  "schema": 1,
  "name": "derive-plan-oracle-values-from-real-producers",
  "description": "Plan oracles gave hand-derived values, also gate results, probe inputs, a refusal line behind a failing import, a flag of every browser process, the foreground of a session tab, and the result of a queued landing, that the real producers, including guards, the module load, unchanged gate jobs, the session starter, and the state that an earlier operation leaves, do not produce",
  "tags": [
    "test",
    "process",
    "recurring",
    "build",
    "false-positive",
    "e2e"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of #396 on Claude Code, Verify phase V5, 2026-11-26\n\nVerify of #390 (build session, 2026-11-25): scenario V2 (e) of the plan comment https://github.com/ddinkov10/celetis/issues/390#issuecomment-7146703165, and the runtime report https://github.com/ddinkov10/celetis/issues/390#issuecomment-7170779267\n\nThe implement session of #356 on Claude Code, 2026-11-21\n\nThe implement session of #348 on Claude Code, Task 2 implementer report (INC-348-T2-1), 2026-11-19\n\nThe implement session of ddinkov10/celetis#305 on Claude Code, Verify V2 run A, 2026-11-11\n\nImplement step session of ddinkov10/celetis#260, Task 1 Step 1 (red probe)\n\nTask 4 of ddinkov10/celetis#255\n\nTask 1 implementer report of ddinkov10/celetis#249 (subagent-driven build, commit 0fd8ed3)\n\nImplementation of ddinkov10/celetis#270, Task 2 and Verify corrections",
  "incidents": [
    {
      "id": "96ef9ef6-9088-408e-876c-c960f6af9e51",
      "date": "2026-11-26",
      "action": "The plan of #396 named the V5 case b command `land 1 'probe'` for a fixture with `tracker: local`.",
      "expected": "The probe input reaches the version refusal of revisionRefusal and prints the caller line with exit 3.",
      "observed": "Exit 2: `usage: celetis --agent <host> land <n> '<subject>'`. The local key grammar is `[0-9a-f]{7}` (engine/lib/tracker/grammar.ts) and landingSubject needs `<type>(<area>): <what>` (engine/lib/daemon/types.ts). With `land abc1234 'fix(probe): probe the refusal'` the case gave exit 3 and the caller line.",
      "source": {
        "kind": "tool-output",
        "excerpt": "land 1 probe -> exit 2 usage; land 1 'fix(probe): probe the refusal' -> exit 2 usage; land abc1234 'fix(probe): probe the refusal' -> exit 3 land: prerequisite: this engine at a77a95806d56 is not the installed engine 5d1b4fa584a5, which the daemon runs; start a fresh session, or run the installed celetis",
        "reference": "https://github.com/ddinkov10/celetis/issues/396"
      },
      "inference": "Inferred: the plan author listed the guards of the daemon client but not the argument guards of land.ts that run before it, and took the key form of the GitHub tracker. Alternative: the author did not know that the key grammar follows CELETIS_TRACKER of the launcher.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "a77a95806d563227b431753eb3964ef9142a1660",
      "brief": "The plan of #396 carried this lesson in its Verify lesson rules: \"for a probe input that must reach one check, list each guard of that producer before the check and choose an input that passes each one on the base\".",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "5eb80ef2402fbc8ae2f621d140eb859ca616ef14",
        "digest": "c39f7275bfa301b77a0b9d69446f325621e6ff4adbb8fa2d74bf68c8f926e804"
      }
    },
    {
      "id": "43e4e21d-dd9f-41ee-be32-a38af7e6bafb",
      "date": "2026-11-25",
      "action": "The plan of #390 gave the Verify oracle V2 (e) 'during the step: ... its foreground is <fixture>/bin/claude' for the session tab of a daemon step in a Linux lab, with no trace of how the daemon starts the host in that tab.",
      "expected": "An oracle for the foreground of a session tab names the process that the real session start puts in the foreground (the starter `engine/daemon.ts --session-start`), and states the host check on the child of that process.",
      "observed": "On lane tip 1633ddc with hc 0.1.19, `hc get` of the session tab read foreground null, then `/root/.bun/bin/bun ... <lane>/engine/daemon.ts --session-start ... claude ... --session-id 6f52dc26-...`, then `/bin/bash -li` after the host exit; it never read `<fixture>/bin/claude`. The driver read the child: `foreground pid 13542 (bun) has the child 13644: /bin/bash <fixture>/bin/claude --session-id 6f52dc26-...`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "foreground pid 13542 (bun) has the child 13644: /bin/bash <fixture>/bin/claude --session-id 6f52dc26-...",
        "reference": "https://github.com/ddinkov10/celetis/issues/390#issuecomment-7170779267"
      },
      "inference": "Inferred: the plan session took the foreground of a lab control tab (where `sh -c` is the started program) as the model of a session tab, and did not read `waitingSession` of `engine/daemon.ts`, which starts the host with `spawnConsumer` (`engine/lib/update/lock.ts:36`), a plain spawn with no new process group. Uncertain: whether the plan session retrieved the related rule; the plan Verify carried the Task 3 lesson rules, which do not include it. Alternative: the author meant the host process, not the foreground, and wrote the wrong field. The behavior does not depend on Linux; macOS was not observed.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "1633ddceae0b28250735bd12ff0596d505f3ccf4",
      "brief": "Plan of #390, Verify V2 (e): 'during the step: `hc get` of the session tab shows `working`, then `idle`; its foreground is `<fixture>/bin/claude`; no lab process runs `/opt/node22/bin/claude`'",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "1633ddceae0b28250735bd12ff0596d505f3ccf4",
        "digest": "41ab0566a2e833c8119c46e5eacbce60d64d0d2f64f67144b5a54128292820de"
      }
    },
    {
      "id": "4e1d8b6a-2c7f-4a93-b5e0-8f3a6c2d1e74",
      "date": "2026-11-21",
      "action": "The plan of #356, Verify V7 case `the line`, expected `land 8` during the landing of #7 to print the wait line first \"and lands after it\".",
      "expected": "The oracle gives the result that the landing code gives for the start state of #8 after #7 lands.",
      "observed": "In the lab run on 6fd6eaf, land 8 printed `land: #8 waits for the landing of #7 in the daemon PID 15844` first; after #7 ended, the daemon ran #8 and it gave exit 4 `land: repair: chore/8-y does not contain the head of main; …`, because chore/8-y started on the old head of main and the ancestry check of mergeMechanism.check refuses it. The Verify child corrected the oracle to the wait line and the order.",
      "source": {
        "kind": "tool-output",
        "excerpt": "land: #8 waits for the landing of #7 in the daemon PID 15844 ... land: repair: chore/8-y does not contain the head of main",
        "reference": "https://github.com/ddinkov10/celetis/issues/356#issuecomment-7062528315"
      },
      "inference": "Inferred: the plan derived the result of the second landing by hand from the daemon line alone, and did not trace the state that the first landing leaves (a new trunk head) through the ancestry check.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "6fd6eafeafc1462fb08cad162dce5df7a632f43a",
      "brief": "The plan of #356, ## Verify, lists derive-plan-oracle-values-from-real-producers among its lessons for the probes.",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "45910e091ca6d3f4a0b3164d05bca32956048fde",
        "digest": "7608053e07d69a21fb35c4f27ee9e58ce30ebdab840c4e3921352a3de0771392"
      }
    },
    {
      "id": "INC-348-T2-1",
      "date": "2026-11-19",
      "action": "The plan of #348, Task 2 Step 1 case (a), stated that the verify gate of a checkout with engine/node_modules removed prints `verify: engine/node_modules/yaml is missing; ...`, the same line for zod, and `verify: FAIL`, with the lines added to textErrors of execute. The plan listed the guards of execute before the check (the tools, git, claude, the file roles, the text checks) but not the module load of scripts/verify.ts.",
      "expected": "The oracle of a check that refuses a missing package derives from the module graph of the checking program: each static import that resolves the missing package runs before any code of the program.",
      "observed": "The first GREEN run of case (a) gave `error: Cannot find package 'yaml'` and exit 1 before any `verify:` line, because scripts/verify.ts statically imports modules (operation.ts, hosts.ts, install-tools.ts) that reach engine/lib/config/core.ts, which imports yaml. The implementer moved checkDependencies into a preflight and made those three imports dynamic.",
      "source": {
        "kind": "tool-output",
        "excerpt": "case (a) first GREEN run: error: Cannot find package 'yaml' (exit 1); the brief's textErrors wiring cannot print case (a)",
        "reference": "https://github.com/ddinkov10/celetis/issues/348"
      },
      "inference": "The plan applied the guard listing of derive-plan-oracle-values-from-real-producers to the run-time guards of execute only. Inferred cause: the rule text names guards, gate defaults, and lock-holder rules, and does not name the load of the program itself, so a load-time failure stayed outside the listing. Alternative: the plan session read the imports but did not connect core.ts to yaml after the Task 1 change; the evidence does not settle which.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "ff511e52457b1b7aaecb073a8c8730b9cba3ab08",
      "brief": "Task 2 Step 1 of the ## Plan comment of #348: \"Each case starts from a fresh copy, so a case reaches the dependency check only through the guards of execute before it (the tools, git, claude, the file roles, and the text checks), which the unchanged copy passes.\"",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "50cb5a1e7327b480fdbf16947d956e8244d42889",
        "digest": "5e9c62e236312d912d44539c0114319d5c6ebc2c310c3f3103a675b276e17c2b"
      }
    },
    {
      "id": "a9d1ac08-3cae-4df9-8913-225023e3b5b6",
      "date": "2026-11-11",
      "action": "The plan of #305 (Verify V2, run A) stated the oracle: each Chrome process in the tree of the child has `--headless` in its command. The Verify harness sampled processes whose command matched /chrom/i.",
      "expected": "The lesson derive-plan-oracle-values-from-real-producers: compute the part of an oracle that an existing producer gives from that producer on the planned inputs. Chrome is the producer of its process command lines.",
      "observed": "On a correct headless run, the Chrome main process had `--headless`, but its helper processes (`--type=` renderer, GPU, utility) had mixed flags; in the headed control (V4) every helper lacked the flag. The substring match also caught three md5sum processes of a host plugin hook. The literal oracle fails a correct run.",
      "source": {
        "kind": "tool-output",
        "excerpt": "jq over docs/superpowers/verification/305/v2a/chrome.jsonl with the filter ^/Applications/Google Chrome.app: main (no --type=) n=1 pid 51879 headless [true]; helpers n=7 headless [false, true]. v4/chrome.jsonl: main n=1 headless [false]; helpers n=7 headless [false]. Non-Chrome matches of /chrom/i: \"md5sum ./plugins/marketplaces/thedotmack/...\" (3 processes).",
        "reference": "https://github.com/ddinkov10/celetis/issues/305"
      },
      "inference": "Inferred: the plan took the flag from the design probe of the spec, which read the main process, and extended it to every process of the tree with no run of the producer. Alternative: the plan meant the browser process and wrote 'each Chrome process' loosely.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "d49aa13",
      "brief": "The plan of #305 (issue comment 6796269712), Verify phase, lesson rules: derive-plan-oracle-values-from-real-producers sha256:9a6a41b136d4375a6bbd2ca5850f074e8d84894e6c800567c1310a97b20570e3; V2 expected: \"each Chrome process in the tree of the child has --headless in its command\".",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "eb3812d",
        "digest": "9a6a41b136d4375a6bbd2ca5850f074e8d84894e6c800567c1310a97b20570e3"
      }
    },
    {
      "id": "861fdb93-8d76-4692-81a4-40e21e6813f1",
      "date": "2026-11-09",
      "action": "The plan of #260 named the red probe engine/probe-260.ts, run as `celetis probe-260 <marker>`, and expected exit 0 and the marker from the trunk launcher.",
      "expected": "The probe name passes each guard on the trunk call path before the behavior under test (the file lookup), so the trunk runs the undeclared file and the red result shows.",
      "observed": "The trunk launcher refused probe-260 at its regular expression /^[a-z][a-z-]*$/ (digits), with exit 2 and the unknown-command lines; no marker. The session renamed the probe to probe-lane, and the trunk then gave exit=0 and the marker.",
      "source": {
        "kind": "tool-output",
        "excerpt": "celetis probe-260 <marker>: 'celetis: the program has no command probe-260' exit=2 (no marker). celetis probe-lane <marker>: exit=0, marker present.",
        "reference": "ddinkov10/celetis#260 implement ledger Task 1 Ruling; engine/launcher.ts at d480bc1 line 12 (commandName)"
      },
      "inference": "Inferred: the plan derived the red expectation from the file check alone and did not compute the earlier name guard of the same producer. The active lesson derive-plan-oracle-values-from-real-producers covers this guard case; the plan's Task 1 lesson list did not carry it, but the plan session context is not available, so retrieval failure is not established.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "d480bc111398fa11dbae8bc8eb575581d5df7863",
      "brief": "Plan #260 Task 1 Step 1 and its Lesson rules list (four lessons, not derive-plan-oracle-values-from-real-producers)",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "d480bc111398fa11dbae8bc8eb575581d5df7863",
        "digest": "aed30333df387d13df8bda9d6047a6d5e628b64ce88ccb3785ffe9a936e5e51c"
      }
    },
    {
      "id": "d21bb6c7-2bcd-4515-bbdd-3f0f844b7873",
      "date": "2026-11-08",
      "action": "The #255 plan, Task 4 step 2, expected `verify: PASS` with two probe re-exports in place (`export { main as probeCommand } from '../next-step.ts';` in engine/lib/lines.ts and `... from '../update.ts';` in engine/board/history.ts), as the red result of the new Biome rule.",
      "expected": "The plan computes the expected gate result from each job of the existing gate on the planned probe inputs, or expects only the Biome part of the gate.",
      "observed": "The gate run with the probes gave `verify: FAIL`: the job `tsc browser` (engine/board/tsconfig.json, types []) failed with 196 TS2591 errors ('Cannot find name 'node:crypto'...'), because the board probe pulls node: modules into the browser project; `== biome check` passed in that run. The controller ruled that the red result of the rule shows in the Biome part.",
      "source": {
        "kind": "tool-output",
        "excerpt": "== tsc browser ... engine/lib/agent-order.ts(1,40): error TS2591: Cannot find name 'node:crypto'. ... verify: FAIL (biome check passed in the same run)",
        "reference": "ddinkov10/celetis#255, Task 4 step 2"
      },
      "inference": "Inferred: the plan derived the step 2 result from the change (no rule yet, so no refusal) and did not run the unchanged gate jobs on the probe input. The plan carried derive-plan-oracle-values-from-real-producers in its Verify section, not in Task 4; the rule names lists, counts, triggers, record writes, and liveness results, not a gate result. Uncertain: whether the rule reached the plan author for this step, or its coverage misses a gate result.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "adfa9bb59d55682dca331c02134b386111bff99f",
      "brief": "Plan #255, Task 4 step 2: 'Run the gate command. Expected: verify: PASS, because no rule refuses them yet. This is the red result of the rule.' Task 4 lesson rules: scope-shared-prohibitions-against-required-callers only.",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "adfa9bb59d55682dca331c02134b386111bff99f",
        "digest": "82374a5ef999ae3a64156d1c366b1c8de2160cb0d321e022fddb8d4122e121c3"
      }
    },
    {
      "id": "484c9592-1377-4567-91b1-3365029703ba",
      "date": "2026-11-07",
      "action": "The #249 plan, Task 1 case (e), expected a refused queue wake with a live foreground holder of issue-A to leave the queue record `error`; case (g) expected a reconcile wake to reach `running` with a session of B.",
      "expected": "Each oracle value that an unchanged producer derives (the guard of failQueueLaunch, holderFrom liveness, the plan gate of the fixture) is computed from that producer on the planned fixture.",
      "observed": "The implementer observed that a createLockOwner holder in a non-daemon process is not live (holderFrom), so the run adopted the lock; with a holder that calls registerSession, the guard of failQueueLaunch counts the holder of the current issue as a live queue owner and keeps the record `starting`. A reconcile wake has authorization null, so with the default `me` gate (g) ends at me-gate.",
      "source": {
        "kind": "tool-output",
        "excerpt": "(e) live foreground: 409 with `queue: a run or its foreground still owns this work`, code 2. The record keeps its bytes. ... The default gate is `me` (`defaultGate` in `engine/lib/workflow.ts`), so the run correctly ends at `me-gate` with a 409 of code 0 (first GREEN run).",
        "reference": "ddinkov10/celetis#249 lane .superpowers/sdd/249/task-1-report.md; engine/lib/locks.ts holderFrom; engine/lib/queue.ts queueOwner; engine/lib/queue-actions.ts failQueueLaunch"
      },
      "inference": "Inferred: the plan derived the oracles by hand from the spec sentences and did not run the existing guards (holderFrom, queueOwner, the failQueueLaunch guard, defaultGate) on the planned fixture. The spec itself states the guard; the oracle conflicted with it. Uncertain whether the plan session had the active lesson derive-plan-oracle-values-from-real-producers in context: the plan does not carry it in any task, and the plan transcript is not available.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "050e54fc9e587f3e2c94c43704716619c69ba58d",
      "brief": "Task 1 brief (e): 'a probe process that takes issue-A with the real createLockOwner of the lane in that window: 409 ... the record is error with that reason'",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "050e54fc9e587f3e2c94c43704716619c69ba58d",
        "digest": "96021f4353685d83fca5b2120fcf6c9be403f8f596ed87fe53771a305fae4689"
      }
    },
    {
      "id": "61139222-0d92-4326-95e8-13b31e08abb7",
      "date": "2026-11-05",
      "action": "The #270 plan (comment 6668306212) gave the Task 2 Step 1 and V3 oracle 'Idle items #300, #280, #195 row, #240 row, #100, #55 row, #31, #9, #8' and 'The Idle count is 24', and its self-review says it traced each expected fixture state to its producer.",
      "expected": "Each expected oracle value comes from the real producer applied to the planned data set.",
      "observed": "The planned data set has #30 (open, no labels, no parent), which the board places in Idle between #31 and #9; the real Idle count is 25. The Task 2 implementer asserted the real data and reported the plan list as wrong.",
      "source": {
        "kind": "tool-output",
        "excerpt": "task-2 report: 'The brief lists Idle items without #30, and the count 24. The full dataset has #30 (no label, no parent) as an Idle card, so the true Idle count is 25'. kit make-data.ts:19 s.push({ n: 30, labels: [] }).",
        "reference": "ddinkov10/celetis#270 runtime report"
      },
      "inference": "Inferred: the plan derived the list by hand from its own data list and dropped the parent #30 of child #31. The rule of the related lesson governs fixture inputs and the check at execution, which caught the error; it does not ask the plan to compute expected values from the producers. Alternative: a one-off counting slip.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "92b91337586e0992316ac8835d10db28e6954d44",
      "brief": "Plan #270 Task 1 Lesson rules carry derive-fixture-state-from-real-producers sha256:fa0750b7…; Self-review record: 'The self-review traced each expected fixture state to its producer (decide, PLACERS, stages)'.",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "92b91337586e0992316ac8835d10db28e6954d44",
        "digest": "fa0750b7eb699d677cb04d9153641bf0226578b3d7e2c0b637ae867d2cecba2f"
      }
    },
    {
      "id": "0308c8da-20b5-4e20-b3db-6822577079fe",
      "date": "2026-11-05",
      "action": "The #270 plan Task 2 Step 9 checked the closed-row changed dot with 'a title change of a hidden child shows the row dot'.",
      "expected": "The probe changes an input that the existing changed-dot producer reads.",
      "observed": "The board changed dot comes from signature, which ignores the title, so a title change shows no dot; a step change (#254 gains bug) does.",
      "source": {
        "kind": "tool-output",
        "excerpt": "task-2 report: 'A title change alone does not show the row dot, because signature ignores the title. A step change (#254 gaining the label bug) does show it.'",
        "reference": "ddinkov10/celetis#270 runtime report"
      },
      "inference": "Inferred: the plan assumed which fields mark a card changed without reading signature. Same family as the first incident.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "92b91337586e0992316ac8835d10db28e6954d44",
      "lesson": {
        "name": "derive-fixture-state-from-real-producers",
        "revision": "92b91337586e0992316ac8835d10db28e6954d44",
        "digest": "fa0750b7eb699d677cb04d9153641bf0226578b3d7e2c0b637ae867d2cecba2f"
      }
    }
  ],
  "recurrences": 9,
  "reviews": [
    {
      "id": "6b752a90-9785-461b-ae6b-5bab3892695f",
      "requestDigest": "6301fd91f6868e093466c9c29f393200a2928c2fc32a931cd3428f2f7aee8fd9",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #270; claude child opus/high\n\nEdit under the reviewer rules. The incidents are observed: the #270 Task 2 report gives the real Idle count 25 with #30, and engine/board/view.ts signature joins column, state, step, and waitFor, not the title. The active lesson derive-fixture-state-from-real-producers governs runtime fixture inputs, not the expected values that a plan writes, so this is a new rule and not a merge. As proposed, the rule computed every oracle value from the real producer, which contradicts the test-behavior-not-implementation principle of the plugin celetis (derive the expected result from the requirement) when the producer is the code under change. The edit limits the rule to the part of a value that an existing, unaltered producer gives, keeps the part that the change adds with the requirement, and retitles the lesson to match. Incident evidence stays unchanged.",
      "related": [
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference; it needs separate authorization."
      }
    },
    {
      "id": "38a51d74-8877-42f1-8a73-ed198599da4b",
      "requestDigest": "d1baeb2cd6d63d1482e05e62734deb267a3662f5b70295bd1e2b04a336644104",
      "date": "2026-11-07",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #249; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed: the #249 Task 1 report retains the refusal \"queue: a run or its foreground still owns this work\" with code 2 and the me-gate end of a reconcile wake, and the lane code holds that refusal in engine/lib/run-engine.ts and defaultGate 'me' in engine/lib/workflow.ts. The proposal states the same rule as the active lesson derive-plan-oracle-values-from-real-producers: compute the part of an oracle that an existing, unaltered producer gives from that producer. A guard, a gate default, and a lock-holder liveness rule of unchanged code are such producers, so the rules are compatible. The survivor keeps the active name and the limit of the test-behavior-not-implementation principle of the plugin celetis, widens the applicability to record writes and liveness results, and adds the guard list and the live-owner fixture from the proposal. Incident evidence stays unchanged; the retained excerpt holds the evidence because the task report file is no longer in the lane.",
      "related": [
        "check-plan-oracles-against-guards-of-existing-producers",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference, and an oracle of a record write that names no guard that can refuse it; it needs separate authorization."
      }
    },
    {
      "id": "60dca0eb-b577-42ed-b641-37388e603ff5",
      "requestDigest": "815d2a60b9c4a13432e59c4c1fde1e376956e223f447a93001e4170cffdd1fe1",
      "date": "2026-11-08",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #257; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed: ADR-0081 in commit 45b2729 of the lane branch of #255 records that without the rule the gate fails at tsc browser because a probe import pulls node: modules into the browser project, which agrees with the retained excerpt. The proposal states the same rule as the active lesson derive-plan-oracle-values-from-real-producers: compute the part of an oracle that an existing, unaltered producer gives from that producer. An unchanged job of the gate that a probe input reaches is such a producer, and the job under test keeps the requirement-derived part, so the rules are compatible with each other and with the test-behavior-not-implementation principle of the plugin celetis. The proposal itself names this merge. The survivor keeps the active name, widens the applicability to a gate or multi-job check result on a probe input, adds the per-job action and check, and adds the tag build. Incident evidence stays unchanged.",
      "related": [
        "derive-a-planned-gate-result-from-each-job-of-the-gate",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference, an oracle of a record write that names no guard that can refuse it, and a planned gate result with a probe in place that names no job; it needs separate authorization."
      }
    },
    {
      "id": "1fd7c8e5-6791-46c6-a836-29fd7ce2f5b6",
      "requestDigest": "3858737a9c1a6ad844dc8aa08845af2778668eac5a1c9a310093258b61a39c2d",
      "date": "2026-11-09",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #260; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed: engine/launcher.ts at d480bc1 holds commandName /^[a-z][a-z-]*$/, which refuses a name with digits before the file lookup, and this agrees with the retained excerpt (exit 2 for probe-260, exit 0 and the marker for probe-lane). No live or historical lesson holds the incident. The proposal states the same rule as the active lesson derive-plan-oracle-values-from-real-producers: compute the part of an oracle that an existing, unaltered producer gives from that producer, including each guard on its call path. The name guard of the trunk launcher is such a producer, so the rules are compatible with each other and with the test-behavior-not-implementation principle of the plugin celetis. The proposal itself names this merge. The survivor keeps the active name and tags, widens the applicability to the exit and output of a command on a probe input that must reach one check, adds the guard-passing action, check, and detection signature from the proposal, and adds the #260 case to the observed facts and the inferred cause. Incident evidence stays unchanged.",
      "related": [
        "name-a-red-probe-input-that-passes-the-guards-it-must-reach",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference, an oracle of a record write that names no guard that can refuse it, a planned gate result with a probe in place that names no job, and a red probe input that names no earlier guard of its producer; it needs separate authorization."
      }
    },
    {
      "id": "dcff8947-cc2b-4fde-a48e-a56dd29e8cda",
      "requestDigest": "1dbb188f405b819b03902cd2471c0a03d9a3e5a48d09622b12070203c6e63935",
      "date": "2026-11-11",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #305; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed: the retained jq excerpt over the v2a and v4 chrome.jsonl samples shows `--headless` on the main process only, mixed or absent flags on the `--type=` helpers, and three md5sum matches of /chrom/i. The incident cites this active lesson as its expected behavior and has the diagnosis not-followed: the plan carried the lesson and did not run the producer (Chrome) before it fixed the oracle. So the proposal states the same rule as derive-plan-oracle-values-from-real-producers, applied to a process-table oracle; this follows the earlier merges of the #249, #257, and #260 curations into the same lesson. The survivor keeps every incident and review, and its rule adds the process case: list the process kinds of one real launch, state the oracle for the kind that carries the property, and select processes by the executable path. browser.md of the plugin names `--headless` only as an argument of an MCP server entry, so the rule contradicts no skill, principle, or instruction file. It widens no permission and weakens no check.",
      "related": [
        "state-a-browser-process-oracle-for-the-process-kind-that-carries-it",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural check is proposed: which process kind carries a property, and which values of an oracle are derived, are judgments of the plan that the gate cannot decide."
      }
    },
    {
      "id": "26f3b26d-a954-4862-a7ca-e9654eaa52de",
      "requestDigest": "cf8ddab03828317c005c4dd1c5229c92e91cdcd84667536fe23411e9fea58b81",
      "date": "2026-11-20",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #348; claude child opus/high\n\nMerge under the reviewer rule for a proposal that states the rule of an active lesson. The incident is observed: the retained excerpt gives `error: Cannot find package 'yaml'` with exit 1 before any verify: line, and the lane code agrees with it: engine/lib/config/core.ts imports yaml, and scripts/verify.ts now runs checkDependencies before dynamic imports of operation.ts, hosts.ts, and install-tools.ts. The incident names derive-plan-oracle-values-from-real-producers as the examined lesson and diagnoses its rule as incomplete: the rule lists the guards of a producer before a check, and the module load of the program is such an earlier guard that it did not name. So the proposal states the same rule as the active lesson, for one more guard; this follows the earlier merges of the #249, #257, #260, and #305 curations into the same lesson. The survivor keeps the active name, tags, date, every incident, and every review; it adds the module load to the trigger, the import-path action, check, and detection signature of the proposal, and the #348 case to the observed facts and the inferred cause, with its unresolved alternative. The part that the change adds still comes from the requirement, so the rule stays compatible with the test-behavior-not-implementation principle of the plugin celetis. It widens no permission and weakens no check.",
      "related": [
        "trace-the-module-load-before-a-check-of-a-missing-package",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A plan review check that flags a derived oracle value with no producer or requirement reference, an oracle of a record write that names no guard that can refuse it, a planned gate result with a probe in place that names no job, a red probe input that names no earlier guard of its producer, and a planned refusal of a missing package that names no import path of the program; it needs separate authorization."
      }
    },
    {
      "id": "63a8957d-f7b7-40f3-91b5-1d68ed7adefd",
      "requestDigest": "da314e2b4436b66e5792565db7488b593f586071eca5a3cd0968652fa74cedf3",
      "date": "2026-11-21",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #356; claude child opus/high\n\nMerge (reviewer rules): the proposal states a case of the active rule derive-plan-oracle-values-from-real-producers, which covers the exit and output of a command on a probe input and each guard on the call path of its producer; the ancestry check of the merge landing is such a guard, and the planned input of the queued landing is the state that the first landing leaves. The incident is observed tool output (exit 4 with the repair line in the lab run on 6fd6eaf), the plan carried the active lesson (diagnosis not-followed), and the proposal itself names this merge. The survivor keeps every incident and review, adds the queued case to its applicability, action, check, and detection signature, and keeps the inferred cause and its alternative apart from the facts. It widens no permission and weakens no check.",
      "related": [
        "derive-the-result-of-a-queued-landing-from-its-start-state",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is authorized in this curation."
      }
    },
    {
      "id": "39c63690-9486-4076-8a6e-57cea4ac72bf",
      "requestDigest": "1af2f25f164cf4c23161d0a72c962c4e83d644a7c815e60a269f17d6f3587f3c",
      "date": "2026-11-25",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #390; claude child opus/high\n\nMerge under the reviewer rule for a proposal that states the rule of an active lesson. The incident is observed tool output (the foreground reads of the session tab and the child read of the driver on lane tip 1633ddc), and the lane code agrees with it: waitingSession of engine/daemon.ts starts the host with spawnConsumer of engine/lib/update/lock.ts, a plain spawn with no new process group. No live or historical lesson holds the incident. The incident names derive-plan-oracle-values-from-real-producers as the examined lesson, and its rule already covers a property of the processes that a program launches: list the process kinds of one real launch, state the oracle for the kind that carries the property, and select processes by the executable path. The proposal applies that clause to the foreground of a session tab and itself names this merge. The survivor keeps the active name, tags, date, every incident, and every review; it adds the foreground case to the description, the observed facts, the inferred cause with its uncertainty and alternative, the fix, the applicability, the action, and the detection signature, and links read-hc-foreground-until-it-settles. The rule widens no permission, weakens no check, and stays compatible with the test-behavior-not-implementation principle of the plugin celetis.",
      "related": [
        "derive-a-terminal-foreground-oracle-from-the-real-session-start",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural check is proposed: which process of a launch carries a property, such as the foreground of a session tab, is a judgment of the scenario that the gate cannot decide."
      }
    },
    {
      "id": "65ae33a8-e590-4682-b720-6fa7056453db",
      "requestDigest": "27e8e113d7731bf3218ad3f37488e66d0d45ffbac935a56e9f839e87f13462f0",
      "date": "2026-11-27",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #396; claude child opus/high\n\nMerge under the reviewer rule for a proposal that states the same rule as an active lesson: the rule of derive-plan-oracle-values-from-real-producers already says, for a probe input that must reach one check, to list each guard of that producer before the check and choose an input that passes each one on the base. The incident names that lesson, and the plan of #396 carried it (diagnosis not-followed). The incident has observed tool output (exit 2 usage for land 1, exit 3 and the caller line for land abc1234 with a conventional subject); its grammar and subject facts match engine/lib/tracker/grammar.ts, engine/lib/daemon/types.ts, and engine/launcher.ts in the lane. The survivor keeps every incident and prior review, adds the #396 facts and inference apart, and names the argument guards of the command entry in the Fix, the Detection signature, and the Rule. It widens no permission, weakens no check or gate, adds no network or credential act, and agrees with the plan skill and the principle test-behavior-not-implementation of the plugin celetis.",
      "related": [
        "choose-a-probe-input-that-passes-the-tracker-grammar-of-the-fixture",
        "derive-plan-oracle-values-from-real-producers"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The active rule already names the guards before the check; this merge adds the argument guards of the command entry as an example and keeps the incident. Judgment decides the guards of a call path, so the rule stays text."
      }
    }
  ]
}
---
# Derive planned oracle values of existing producers from those producers

## What happened

Four plans gave hand-derived oracle values that the existing producers do not give. The #270 plan gave an Idle list and count that omitted fixture #30, so the real count was 25, not 24, and a changed-dot probe that used a title change, which the board signature ignores. The plan carried the related lesson and claimed to trace each state. The #249 plan, Task 1, expected a refused queue wake with a live foreground holder of the current issue to write `error` to the queue record, and a reconcile wake to reach `running` with a session. The implementer observed (tool output) that a `createLockOwner` holder in a process other than `daemon.ts` is not live (`holderFrom`), that a holder with `registerSession` is a live queue owner, so the guard of `failQueueLaunch` keeps the record unchanged, and that a reconcile wake with `authorization: null` ends at the default `me` gate (`defaultGate`). The spec of #249 states that guard. The #255 plan, Task 4 step 2, expected `verify: PASS` with two probe re-exports of command files in place, as the red result of a new Biome rule. The gate gave `verify: FAIL` (tool output): the unchanged job `tsc browser` failed with 196 TS2591 errors, because the board probe pulled `node:` modules into the browser project, and `biome check` passed in that run. The #260 plan, Task 1 Step 1, named the red probe `engine/probe-260.ts` and expected the trunk launcher to run it (`celetis probe-260 <marker>`, exit 0, marker present). The trunk launcher refused the name at its unchanged name guard `/^[a-z][a-z-]*$/` (`commandName` in `engine/launcher.ts`), because the name has digits: exit 2 with `celetis: the program has no command probe-260` and no marker (tool output). With the name `probe-lane`, the trunk gave exit 0 and the marker. In each case, the implementers or the controller caught the error at execution and asserted the real behavior.

In #305, the Verify phase of the plan (V2, run A) required `--headless` on each Chrome process in the tree of a check session. On a correct headless run, the Chrome main process had the flag, and its helper processes (`--type=` renderer, GPU, utility) had mixed flags; in the headed control (V4), no helper had the flag (tool output). The sampler matched the command by `/chrom/i`, which also caught three `md5sum` processes of a host plugin hook. So the literal oracle failed a correct run. The session corrected the oracle to the main process and selected processes by the executable path. The plan carried this lesson in its Verify lesson rules.

In #348, the plan, Task 2 Step 1 case (a), expected the verify gate of a checkout with no `engine/node_modules` to print a `verify:` refusal line for each missing package and `verify: FAIL`. The plan listed the run-time guards of `execute` before the new check, not the module load of `scripts/verify.ts`. The first run of the case gave `error: Cannot find package 'yaml'` and exit 1 before any `verify:` line (tool output): `scripts/verify.ts` statically imported modules that reach `yaml` through `engine/lib/config/core.ts`. The implementer moved the dependency check into a preflight and made those imports dynamic.

In #356, the plan (Verify V7, case `the line`) expected a daemon landing of #8, queued behind the landing of #7, to print the wait line and then land. In the lab run on 6fd6eaf, the wait line came first; after #7 landed, the daemon ran #8, which gave exit 4 with `land: repair: chore/8-y does not contain the head of main` (tool output). Both lanes of the fixture started on the same trunk head, so the landing of #7 moved the head past the base of `chore/8-y`, and the ancestry check of the merge landing refused it. The Verify session corrected the oracle to the wait line and the order. The plan carried this lesson among its Verify lessons.

In #390, the plan (Verify V2 (e)) expected the foreground of the session tab of a daemon step in a Linux lab to be `<fixture>/bin/claude`. In the Verify run on lane tip 1633ddc, with hc 0.1.19, `hc get` of the session tab read `null`, then the starter `/root/.bun/bin/bun ... engine/daemon.ts --session-start ... claude ...`, then `/bin/bash -li` after the host exit; it never read the fixture host. The driver read the child of the foreground process: `foreground pid 13542 (bun) has the child 13644: /bin/bash <fixture>/bin/claude --session-id ...` (tool output). `waitingSession` of `engine/daemon.ts` starts the host with `spawnConsumer` (`engine/lib/update/lock.ts`), a plain `spawn` with no new process group, so the starter leads the foreground group of the tab and the host is its child. The build corrected the oracle in the runtime report.

In #396, the plan gave Verify case V5 b the command `land 1 'probe'` in a fixture with `tracker: local`, to reach the version refusal of `revisionRefusal`. The command exited 2 with the usage line `usage: celetis --agent <host> land <n> '<subject>'` before that refusal (tool output). A local key matches `[0-9a-f]{7}` (`engine/lib/tracker/grammar.ts`), and `landingSubject` of `engine/lib/daemon/types.ts` needs the form `<type>(<area>): <what>`. With `land abc1234 'fix(probe): probe the refusal'` the case gave exit 3 and the caller line. The plan carried this lesson in its Verify lesson rules.

## Root cause

Inferred: the plans computed the values by hand, from their own data lists, from spec sentences, or from the change alone, and did not run the existing producers on the planned inputs. For #249, the unchanged producers were guards: a lock-holder liveness rule, an owner check, and a gate default. For #255, the unchanged producer was another job of the gate that the probe input also reached. For #260, the unchanged producer was the name guard of the launcher, before the file lookup under test. Uncertain: whether this lesson reached the #249, #255, and #260 plan sessions; none of these plans carries it in the affected task (the #255 plan carries it in its Verify section only), and the earlier rule named lists, counts, triggers, record writes, liveness results, and gate results, not the result of a command on a probe input. Alternative: independent slips.

For #305, inferred: the plan extended a fact of the main process, from the design probe of the spec, to every process of the tree, with no launch of the real producer, although the plan carried this lesson. Alternative: "each Chrome process" was loose wording for the browser process.

For #348, inferred: the plan applied the guard listing of this rule to the run-time guards of `execute` only. The rule named guards, gate defaults, and lock-holder rules, not the module load of the program, and a static import of a missing package fails before any statement of the program runs. Alternative: the plan session read the imports but did not connect `core.ts` to `yaml` after the Task 1 change; the evidence does not settle which.

For #356, inferred: the result of the second landing came from the daemon line alone, not from the checks that the landing runs on the state that the first landing leaves. Alternative: the author meant a lane that contains the new head, and the fixture text did not say so.

For #390, inferred: the plan author modelled the session tab on a lab control tab, where the started program is the foreground, and did not read the session start. Uncertain: whether this lesson reached the plan session; the plan Verify carried the lesson rules of Task 3, which do not include it. Alternative: the author meant the host process and named the wrong field.

For #396, inferred: the plan listed the guards of the daemon client, not the argument guards of the command entry that run before it, and used the key form of the GitHub tracker. The key grammar follows the tracker of the fixture through `CELETIS_TRACKER`, which the launcher sets (`engine/launcher.ts`). Alternative: the author did not know that the key grammar follows that variable.

## Fix

Proposed prevention, not proven enforcement: when a plan writes an expected list, count, trigger, record write, liveness result, gate result, or command result on a probe input for a derived state, it computes the part that an existing producer gives, and that the change does not alter, from that producer (for example a probe that runs the placer, the signature, the guards of the call path, or the unchanged jobs of the gate on the planned data, fixture, or probe input), and records how. A guard, a gate default, a lock-holder rule, and a job of the gate of unchanged code are such producers; the plan names how its fixture makes a live owner, a planned gate result with a temporary probe names the job that gives it, or expects only the lines of the job under test, and a probe input that must reach one check passes each earlier guard of that producer on the base. The argument guards of the command entry are such earlier guards: the key grammar of the tracker of the fixture, the subject form, and the argument count. The module load of the program is such an earlier guard: for an input that removes, breaks, or changes a package or a module, the plan traces each static import path of the program to it, and the check runs before any such import (a dynamic import, or a check in a program that does not import it), or the plan states the load error as the oracle. The part that the change adds comes from the requirement, as the test-behavior-not-implementation principle of the plugin celetis says: an oracle computed from the code under change cannot fail when that code is wrong. A structural follow-up needs separate authorization: a plan review check that flags a derived oracle value with no producer or requirement reference, an oracle of a record write that names no guard that can refuse it, and a planned gate result with a probe in place that names no job. For a property of the processes that a program launches (a flag, a process type, a count), the plan lists the process kinds of one real launch (for Chrome: the main process with no `--type=`, its helpers, and other processes that match the name; for the session tab of a daemon step: the starter `engine/daemon.ts --session-start`, which leads the foreground, and the host that it spawns as its child), states the oracle for the kind that carries the property, and selects processes by the executable path, not by a substring of the command. For an operation that waits behind another operation on the same shared state (a queued landing, a second run, a later write), the planned input is the state that the first operation leaves: the plan writes that state and derives the result of the second operation from the checks that it runs on that state, or gives the fixture the start state that the intended result needs. Judgment decides which values are derived, which guards apply, and which jobs a probe reaches, so the rule stays text.

## Detection signature

A red probe step whose base run prints a refusal from an earlier guard in place of the planned red behavior. A check that fails its own oracle on a correct run, with helper processes or processes of other programs in the failing rows. `error: Cannot find package '<name>'` with no line of the program, on an input whose planned output is a refusal line of that program. A queued operation that gives a refusal of its own checks (for example `land: repair: <lane> does not contain the head of <trunk>`) where the plan expected success. A foreground read of a session tab that shows `daemon.ts --session-start` where the oracle expects the host binary. A probe command that exits 2 with the usage line of its command where the plan expected a refusal of a later check.

## Rule

Applies when a plan or a brief states an expected value of a derived state (a list, an order, a count, a trigger, a record write, a liveness result, the result of a gate or a multi-job check on a probe input, the exit and output of a command on a probe input that must reach one check, a property of the processes that a program launches, including the foreground process of a terminal that a daemon or a starter program opens for a session, or the result of an operation that waits behind another operation on the same shared state) for a check, and an existing producer that the change does not alter gives part of that value, including each guard, gate default, or lock-holder rule on its call path, the module load of the program, and each unchanged job of the gate that the probe input reaches. Action: compute that part from the existing producer on the planned inputs and cite the producer; for a record write or a state, list each such guard from the call path and name how the fixture makes a live owner; for a gate result, run or read each unchanged job on the probe input and state the result of each job that the probe reaches, or expect only the lines of the job under test; for a probe input that must reach one check, list each guard of that producer before the check, also the argument guards of the command entry (the key grammar of the tracker of the fixture, the subject form, the argument count), and choose an input that passes each one on the base; for an input that removes, breaks, or changes a package or a module that the program can import, list each static import path of the program that reaches it, and make the check run before any such import, or state the load error as the expected output; for a property of launched processes, list the process kinds of one real launch, state the oracle for the kind that carries the property (for Chrome, the main process with no `--type=`; for the foreground of a session terminal, read the start path of the session and state the host check on the child of the foreground process), and select processes by the executable path; for an operation queued behind another, write the state that the first operation leaves and derive the result of the second from the checks that it runs on that state, or give the fixture the start state that the intended result needs; derive the part that the change adds from the requirement. Check: each such oracle value names its producer or its requirement, a planned gate result names its jobs, and a run of the existing producer, with its guards, on the planned data or probe input reaches the check under test and gives the part that it covers, an input that removes a package reaches the check and prints its line or the plan names the load error as the oracle, a process oracle passes on a known-good launch and fails on a control launch that lacks the property, and a run of a queued case gives the expected exit and line on the state that the first operation leaves.

## Related lessons

[[derive-fixture-state-from-real-producers]]
[[check-refusal-contract-across-earlier-guards]]
[[read-hc-foreground-until-it-settles]]

