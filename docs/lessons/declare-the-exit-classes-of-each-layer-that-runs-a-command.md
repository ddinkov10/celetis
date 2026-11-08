---
{
  "schema": 1,
  "name": "declare-the-exit-classes-of-each-layer-that-runs-a-command",
  "description": "A controller ruling declared the exit classes of a new command from its own code only, and left out the launcher's 3 and 6",
  "tags": [
    "build",
    "process"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Task 4 review of issue #254 (implement step session), lane feat/254-the-program-does-not-read-the, commit 7dd450c",
  "incidents": [
    {
      "id": "5a9be110-8ca5-4699-b22a-d307e703cb23",
      "date": "2026-11-08",
      "action": "The implement controller of #254 ruled (R3) that the new command `config` declares `['done', 'internal', 'usage']` in `engine/lib/contract.ts`, from the exits of `engine/config.ts` only.",
      "expected": "The declared list names each class that a run of the documented form `celetis --agent <host> config <checkout> <plugin>` can give, as `README.md` states: \"The `Exit status:` list of a row names the classes that the command declares\". The launcher gives 3 (`requireBun`) and 6 (a failed process replacement) before the command code runs, and every other entry, also `root`, declares `base` or `hosted` with 3 and 6.",
      "observed": "The Task 4 reviewer found the generated README row \"Exit status: 0 done, 1 internal, 2 usage\", while the same commit documents \"a below-floor Bun exits 3\" in `docs/configuration.md`. The controller confirmed the sources.",
      "source": {
        "kind": "tool-output",
        "excerpt": "engine/lib/host.ts:48-51 requireBun throws HostError(..., exits.prerequisite); engine/lib/update-lock.ts:67-70 throws HostError('celetis: process replacement failed ...', exits.blocked); engine/lib/contract.ts entry('root', false, [...], 'Prints the folder of the program. ...') uses the default base list; README.md:1175 \"The `Exit status:` list of a row names the classes that the command declares\"",
        "reference": "issue #254, Task 4 review of commit 7dd450c"
      },
      "inference": "Inferred: the ruling took the exit list from the code paths of the command file and did not list the layers that run before it (the program entry and the launcher), nor compare with the declared lists of the other entries. Uncertain: whether the convention is meant to include launcher exits for every command, or only by habit; the README sentence and the `root` entry support inclusion.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "7dd450c"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c2bff572-fc22-4096-a252-73d9b26fda46",
      "requestDigest": "651da25a9856f6eef183cbc068927b059cf0524280b1b1e6ad288f1c8da6a172",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #254; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed: the lane confirms engine/lib/host.ts requireBun throws exits.prerequisite (3), contract.ts declares base and hosted lists with prerequisite and blocked, README.md:1175 says the Exit status list names the declared classes, and f3f2501 corrects config to the base list. The rule states applicability, action, and check, and keeps the inferred cause apart from the facts. No active or historical lesson states this rule: state-the-act-of-each-new-code-of-a-moved-site covers the act of a moved code in text, and plan-condition-must-not-narrow-a-spec-rule covers spec rules. The rule widens no permission, weakens no check, and contradicts no instruction, skill, or principle. The structural follow-up stays proposed.",
      "related": [
        "declare-the-exit-classes-of-each-layer-that-runs-a-command"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A check in scripts/build.ts or scripts/verify.ts that each agent-facing entry of engine/lib/contract.ts declares at least the exit classes that the launcher can give (3 prerequisite, 6 blocked); it needs separate authorization."
      }
    }
  ]
}
---
# Declare the exit classes of each layer that runs a command

## What happened

In the build of #254, the controller ruled that the new command `config` declares the exit classes `['done', 'internal', 'usage']` in `engine/lib/contract.ts`. The list came from the exits of `engine/config.ts` alone. The task review found that the generated README row said "Exit status: 0 done, 1 internal, 2 usage", while the same commit said in `docs/configuration.md` that a below-floor Bun exits 3. The launcher runs before the command: `requireBun` exits 3, and a failed process replacement exits 6. Each other entry of the contract, also `root`, declares a list with 3 and 6. `README.md` states that the `Exit status:` list names the classes that the command declares.

## Root cause

Inferred: the ruling looked only at the code of the command file. It did not list the layers that run the documented form (the program entry, the launcher, the process replacement), and it did not compare the new entry with the declared lists of the other entries. Uncertain: the convention is not stated as a rule for each command; the README sentence and the `root` entry support it.

## Fix

Proposed prevention, in text: before a ruling or a change declares the exit classes of a command, list the exits of each layer that runs its documented form, and compare the list with the other entries. Proposed structural follow-up, which needs separate authorization: a check in `scripts/build.ts` or `scripts/verify.ts` that each agent-facing entry declares at least the classes that the launcher can give; it would reject the recorded list. Not implemented.

## Rule

Applies when a plan, a ruling, or a change declares or narrows the exit classes of a command in a contract or its documents. Action: list the exits of each layer that runs the documented form of the command (the program entry, the launcher, process replacement, and the command code), compare the list with the declared lists of the other commands, and declare each class that a run can give. Check: each exit code that a document of the command names is in its declared list, and each layer's exit has a class in the list.

## Related lessons

[[plan-condition-must-not-narrow-a-spec-rule]]
[[state-the-act-of-each-new-code-of-a-moved-site]]
