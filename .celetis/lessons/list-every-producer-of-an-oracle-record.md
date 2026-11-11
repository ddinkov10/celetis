---
{
  "schema": 1,
  "name": "list-every-producer-of-an-oracle-record",
  "description": "Checks of a shared record missed a producer: a fake gh log that the daemon board writes, a daemon log that an earlier case wrote, and an event store that an unrecorded child process created in a two-run write trace",
  "tags": [
    "false-positive",
    "test",
    "process",
    "recurring"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of ddinkov10/celetis#289 on Claude Code, Verify phase, dry run of the two-engine lab (the coordinator session), 2026-11-11\n\nThe implement session of ddinkov10/celetis#139 on Claude Code (inline flow), Task 2, the real daemon case V6 of the build probe, 2026-11-10\n\nImplementer incident of ddinkov10/celetis#276, Task 2",
  "incidents": [
    {
      "id": "3b97931a-0cf5-4138-af9c-cc3f8ea92ebc",
      "date": "2026-11-11",
      "action": "The lab harness of #289 loaded a write-trace preload into each engine process, but the preload recorded only a script directly in `engine/` (the pattern `/engine/[^/]+`). The updater child of the board (`engine/lib/updater.ts --inspect`) writes an exit event into the event store, and the harness compared the creation of that store.",
      "expected": "Each process that can write a compared store has a stream in the transcript, or the store is outside the comparison with a stated reason (the lesson list-every-producer-of-an-oracle-record).",
      "observed": "In one case of a run of the base engine against the lane, the base transcript had four lines for the creation of the event store before the first event of the run, and the lane transcript had none in any stream: `compare: E5e: DIFFERENT (4 lines)`. The control of the same harness with two copies of the base engine had been equal. The cause was the updater child, which wrote its event about 300 ms from the event of the run; the process that writes first creates the store.",
      "source": {
        "kind": "tool-output",
        "excerpt": "- {\"op\":\"mkdirSync\",\"path\":\"<LAB>/fx/home/.local/state\"} - {\"op\":\"openSync\",\"path\":\".../celetis/events.lock\",\"created\":true} - {\"op\":\"openSync\",\"path\":\".../celetis/events.jsonl\",\"created\":true} ... compare: E5e: DIFFERENT (4 lines); after the fix the trace shows two streams `lib/updater.ts --inspect` with writeSync on events.jsonl",
        "reference": "https://github.com/ddinkov10/celetis/issues/289"
      },
      "inference": "Inferred cause: the builder of the harness listed the engine processes from the entry scripts of `engine/`, not from the processes that the daemon spawns. The brief carried the lesson list-every-producer-of-an-oracle-record by path. Alternative: the base-against-base control could not show the gap, because the race fell the same way in each of its runs.",
      "diagnosis": [
        "not-followed",
        "wrong-or-incomplete-rule"
      ],
      "revision": "7c504eea828418d07d6a828791d729f8828b7bc4",
      "brief": "Lab brief of #289: \"The lesson rules of the Verify phase: verify-phase.md lists 14 lesson paths ... Read the ## Rule of each one before the first lab command\"; the list holds list-every-producer-of-an-oracle-record.",
      "lesson": {
        "name": "list-every-producer-of-an-oracle-record",
        "revision": "7c504eea828418d07d6a828791d729f8828b7bc4",
        "digest": "f71e328b5a490437b60001313bfa61e90db8180f203e36b88283538128df256d"
      }
    },
    {
      "id": "64fe07a6-e141-46ec-853f-01f313f1d12d",
      "date": "2026-11-10",
      "action": "The V6 probe of #139, written by the implement session, ran three cases against one daemon process. For case (c) it asserted that the daemon log holds the line `autoLanes: need a sequence with one or more of triage, feature, bug, chore, hotfix` within 70 seconds after the edit of the list to `[]`, with a search of the whole log. It then waited 15 seconds for `daemon: auto mode off`.",
      "expected": "The search reads only the log text after the edit of case (c), because case (b) of the same probe makes the same line in the same daemon log. The wait for auto mode off is longer than the 60-second wait of the loop of auto mode (`autoLoop` of engine/lib/run-engine.ts).",
      "observed": "The log check of case (c) passed at once on the line that case (b) made two minutes earlier. The next check failed with a timeout, and the probe stopped the daemon 15 seconds after the edit, before the next operation of auto mode. The log held no field line after the edit.",
      "source": {
        "kind": "tool-output",
        "excerpt": "ok 19 (c) the daemon log holds the field line within 70 seconds / v6: FAIL after 20 checks: timeout after 15000 ms: auto mode off / daemon.log, the only field line: 2026-11-10T21:20:16.121Z daemon celetis: <fixture>/.celetis.yaml: autoLanes: need a sequence with one or more of triage, feature, bug, chore, hotfix (case (b); the edit of case (c) came after 21:22:27). After the correction: {\"newLogLines\":[\"2026-11-10T21:28:02.147Z daemon celetis: <fixture>/.celetis.yaml: autoLanes: need a sequence with one or more of triage, feature, bug, chore, hotfix\"]} / v6: PASS (22 checks)",
        "reference": "The runtime report of the build on https://github.com/ddinkov10/celetis/issues/139 names this incident and holds the corrected probe source"
      },
      "inference": "Inferred: the session listed the board of the daemon as a second producer of the fake gh log, but it did not list the earlier cases of its own probe as producers of the daemon log. It derived the 15-second wait from no producer. The plan carried list-every-producer-of-an-oracle-record in this task. Its applicability names a reused oracle and an exact comparison after the work moves into a long-lived process; a new substring search across the cases of one probe is close to that text but not named, which can have contributed. The evidence does not show which of the two had more weight.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "fa7904c942a0d87078832995f50756177612fb3b",
      "brief": "Task 2 of the plan of #139 (https://github.com/ddinkov10/celetis/issues/139#issuecomment-6778947159) carries `docs/lessons/list-every-producer-of-an-oracle-record.md` sha256:21cbc3f34e6653ff0075428155f0866982d7fa8663a2304779c3de5a1dec381a",
      "lesson": {
        "name": "list-every-producer-of-an-oracle-record",
        "revision": "86802b11e051963fc513429c14a0080ebb3c32e6",
        "digest": "21cbc3f34e6653ff0075428155f0866982d7fa8663a2304779c3de5a1dec381a"
      }
    },
    {
      "id": "0594cd66-fb4f-4f33-a498-a6a1fe4f2dfc",
      "date": "2026-11-08",
      "action": "The first GREEN run of the #276 Task 2 request probe compared the fake gh log of a lane landing with the base exactly (the oracle of Task 1, where no daemon ran), and checked 'no new gh call' right after a daemon start.",
      "expected": "The oracle compares the gh calls of the landing; each other producer of the same log in the long-lived process is listed and kept apart.",
      "observed": "The board of the lane daemon also writes the fake gh log, so b-a failed on an extra GET issues?state=open&per_page=100 line and four refusal checks failed on no gh call.",
      "source": {
        "kind": "tool-output",
        "excerpt": "FAIL b-a: side effects: line 56 / base: \"GET \", / lane: \"GET issues?state=open&per_page=100\",",
        "reference": "docs/superpowers/verification/276-t2/green-0/probe.out in the #276 lane; .superpowers/sdd/276/task-2-report.md, Incidents"
      },
      "inference": "Inferred: the oracle came from Task 1, where no daemon ran, and the probe did not list the board as a producer of gh calls on the path of the lane run. Uncertain whether the carried rule derive-plan-oracle-values-from-real-producers was not followed or does not cover a moved producer.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f6096a477c401fa66e593f5c9935d4ed6766cc98",
      "brief": "Task 2 dispatch of #276 (.superpowers/sdd/276/task-2-dispatch.md) carried derive-plan-oracle-values-from-real-producers sha256:82374a5e…",
      "lesson": {
        "name": "derive-plan-oracle-values-from-real-producers",
        "revision": "2fc548691a802b56b8be30acacb0ce82eae057d1",
        "digest": "82374a5ef999ae3a64156d1c366b1c8de2160cb0d321e022fddb8d4122e121c3"
      }
    }
  ],
  "recurrences": 2,
  "reviews": [
    {
      "id": "bab362f5-d303-4168-b0c1-805fbc775394",
      "requestDigest": "18b1bfe7750634754748b360927fd08ea2f7a52a1cd1a7fe75baed4de76b39e1",
      "date": "2026-11-08",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #253; claude child opus/high\n\nEdit under the reviewer rules. The incident is observed: the retained excerpt gives the extra GET issues?state=open&per_page=100 line of the lane against the base log. The rule states applicability, action, and check, and keeps the inferred cause apart from the facts. It is compatible with the active lesson derive-plan-oracle-values-from-real-producers but not the same rule: that lesson computes a plan oracle value from an existing producer, and this one separates the entries of other producers of a shared record in a long-lived process by a definite mark, names what the separation hides, and checks it with a control run. So it is a new lesson, not a merge, and it links that lesson. The edit only adds to the Fix that the prevention is proposed text, not enforced; the incident evidence stays unchanged. The rule widens no permission, weakens no check, and contradicts no instruction, skill, or principle.",
      "related": [
        "list-every-producer-of-an-oracle-record"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The producers of a shared record depend on the process that a change targets, so no general structural check is known; the control run of the rule stays its check."
      }
    },
    {
      "id": "b2de8503-7f62-41bf-a7c4-de279f2811a2",
      "requestDigest": "f490366e5ca797992aaebb0379a1c7fab8ab2b4aac07a13f5cb6eef80afa2eab",
      "date": "2026-11-11",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #286; claude child opus/high\n\nMerge under the reviewer rules: the proposal states the same rule as the active lesson list-every-producer-of-an-oracle-record, and every incident stays. The incident is observed: the retained excerpt gives the case (c) check that passed at once on the field line of case (b) at 21:20:16, before the edit after 21:22:27, the timeout of the 15-second wait, and the corrected run with one new field line and v6: PASS; autoLoop of engine/lib/run-engine.ts waits 60 seconds. No live or historical lesson holds the incident. An earlier case of the same check is one more producer of a shared record of a long-lived process, and the record length before the act of the case is a definite mark, so the action of the proposal is the action of the active rule. Two active rules for one failure would overlap, and the proposal itself names this merge. The survivor keeps the active name, widens the applicability from a reused oracle with an exact comparison after a move of the work to any assertion on a shared record that another producer, also an earlier case, can write, adds the offset mark, the wait from the interval of the real producer, the skipped-act control, the anti-pattern, and the detection signature, retitles the body to match, and adds the tag recurring. The rule agrees with the test-behavior-not-implementation principle of the plugin celetis (the control with the act skipped must fail the check) and adds no tracked test (ADR-0029). The diagnosis not-followed of the incident and its inference that the narrow applicability can have contributed stay as captured; the evidence does not separate them. Incident evidence stays unchanged.",
      "related": [
        "read-a-shared-log-from-the-start-of-the-case",
        "list-every-producer-of-an-oracle-record"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The producers of a shared record and the cases of a probe depend on the process that a change targets, and this repository tracks no probe (ADR-0029), so no general structural check or shared helper is known; the control run of the rule stays its check."
      }
    },
    {
      "id": "97a219cd-6c7f-4270-9a41-fc63fe23fe6a",
      "requestDigest": "58074e3328fd026298e4b270215b2127cea3eea176e599b024cfcaefb43fc1c7",
      "date": "2026-11-12",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #289; claude child opus/high\n\nMerge (reviewer rule: merge a proposal into an active lesson that states the same rule, and keep every incident). The proposal has observed tool-output evidence: `compare: E5e: DIFFERENT (4 lines)` with the creation of the event store on one side only, and after the fix two trace streams of `lib/updater.ts --inspect`. Its rule is the rule of the active lesson list-every-producer-of-an-oracle-record (list each producer of a compared record before a check reads it), and its own Root cause names the gap of that rule: a child process with its own entry script. The survivor keeps that name, extends its applicability and its Check to a write trace of two runs and to the child processes of one real run, and keeps all three incidents. The diagnosis (not followed, and wrong or incomplete rule) and the alternative stay labeled as inference. The rule widens no permission and weakens no check.",
      "related": [
        "trace-each-process-that-writes-a-compared-store",
        "list-every-producer-of-an-oracle-record"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The set of processes depends on the program under test, so the rule stays text; the proposal names no structural check."
      }
    }
  ]
}
---
# List every producer of a shared record before a check reads it

## What happened

In #276 Task 2 the landing moved from its own process into the master daemon. The request probe reused the oracle of Task 1: it compared the fake `gh` log of the lane landing with the base exactly, and it checked "no new gh call" right after a daemon start. The board of the lane daemon also reads GitHub through the same fake `gh`, so the first GREEN run failed on an extra `GET issues?state=open&per_page=100` line and on four refusal checks. Each functional check passed. The implementer then compared the base calls as an ordered subsequence and accepted each other lane call only as a board read.

In #139 Task 2, the V6 probe ran three cases against one daemon process. Case (b) sent an auto on with an invalid `autoLanes` list, and the daemon wrote the field line of the refusal to its log. Case (c) edited the list to `[]` while auto mode waited, and asserted that the daemon log holds the same field line within 70 seconds. The assertion searched the whole log, so it passed at once on the line of case (b). The probe then waited 15 seconds for `daemon: auto mode off`, got a timeout, and stopped the daemon. The log held no field line after the edit. After the correction (a search of the log text after the length that the probe took before the edit, and a wait of 75 seconds), the log showed one new field line, the status showed auto mode off, and the case passed (tool output). The task carried this lesson.

In the Verify lab of #289, a write-trace preload recorded the file operations of each engine process, and the harness compared the writes of a base run with a lane run. The preload recorded only a script directly in `engine/`. The daemon also starts the updater child of the board (`engine/lib/updater.ts --inspect`), which writes an exit event into the event store. In one case, the base transcript had four lines for the creation of the event store and the lane transcript had none in any stream: `compare: E5e: DIFFERENT (4 lines)`. The control with two copies of the base engine had been equal. After the fix, the trace showed two streams `lib/updater.ts --inspect` with writes to `events.jsonl`. The brief carried this lesson by path.

## Root cause

Inference: in #276, the oracle came from a run with one producer of the log (the `land` process). The moved work runs in a process with more producers (the board and its refresh), and the probe did not list them. Uncertain whether the carried rule `derive-plan-oracle-values-from-real-producers` was not followed or does not name a moved producer.

Inference: in #139, the session listed the board of the daemon as a producer of the fake `gh` log, but not the earlier cases of the same probe as producers of the daemon log. The 15-second wait came from no producer: the loop of auto mode reads the configuration again only after its 60-second wait (`autoLoop` of `engine/lib/run-engine.ts`). The earlier applicability of this rule named a reused oracle and an exact comparison after the work moves into a long-lived process, which can have made the session read it as not applicable to a new substring search across the cases of one probe. The evidence does not separate these causes.

Inference: in #289, the builder of the harness listed the engine processes from the entry scripts of `engine/`, not from the processes that the daemon starts, and this rule named "another part of the target process" but not a child process with its own entry script. The process that writes first creates the store, so a race between the daemon and the child decided the difference. Alternative: a control with equal engines cannot show a race that falls the same way in each of its runs.

## Anti-pattern

```ts
await configure(root, invalidList);
await until(async () => (await logText()).includes(fieldLine), 70_000, 'the field line');
```

## Fix

The #276 repair lists the board reads by shape and compares the landing calls as an ordered subsequence, with the limit that an extra landing read of a board shape stays hidden. The #139 repair takes the length of the log before the act of the case, asserts on the text after it, and takes the wait from the interval of the real producer of the awaited entry. The #289 repair records a script in each subfolder of `engine/`, creates the store in the fixture before each daemon start, and makes each run wait for the processes of the run before. Proposed prevention (text, not enforced): the rule below, which now also names an earlier case of the same check as a producer, and any assertion on the record, not only an exact comparison of a reused oracle. It also names a child process that the target starts, listed from a real run, as a producer of a store that a write trace compares. The rule stays text, because the producers of a record depend on the process that the change targets, and this repository tracks no probe (ADR-0029) that a shared helper could hold.

## Detection signature

A check of a later case passes in less time than the event of that case can take, or a wait that follows it ends with a timeout.

## Rule

Applies when a check asserts that a shared record of a long-lived process (a log, a fake tool call log, an event file) holds, lacks, or equals entries, and another producer can write that record: another part of the target process, for example after the work moves into a long-lived process, or an earlier case of the same check against the same process, or a child process that the target starts with its own entry script. It also applies when a check compares a record of writes (a trace, a log of file operations) between two runs of a program that starts child processes. Action: before the assertion, list each other producer of that record, including the earlier cases of the same check, and list each process that the program starts from the process table of one real run, not from a path pattern; give each such process a stream in a record of writes, or exclude each store that an unrecorded process can write, with the reason; separate their entries by a definite mark (a shape, a tag, a time window, or the length or entry count of the record before the act of the case, with the assertion only on the part after it); and name what the separation can hide. Take each wait for an awaited entry from the interval of its real producer. Check: a control run with no unit of work, or with the act of the case skipped, shows only the entries that the separation accepts and fails the assertion, and the comparison still fails for one extra entry of the work. For a record of writes, the record of one real run has a stream for each process of the list, and a search of the compared stores for a write with no stream finds none.

## Related lessons

[[derive-plan-oracle-values-from-real-producers]] [[derive-fixture-state-from-real-producers]]
