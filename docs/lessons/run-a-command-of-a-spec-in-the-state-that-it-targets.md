---
{
  "schema": 1,
  "name": "run-a-command-of-a-spec-in-the-state-that-it-targets",
  "description": "A spec gave an adoption command and a check premise that no run supported: git mv failed without its parent folder, and a land check needed a daemon and a lab",
  "tags": [
    "process",
    "git",
    "false-negative"
  ],
  "date": "2026-11-10",
  "status": "active",
  "source": "Plan step of ddinkov10/celetis#285 (Claude Code, 2026-11-10)",
  "incidents": [
    {
      "id": "e06896e3-f4dd-4b53-8cb0-a196e4cf5949",
      "date": "2026-11-10",
      "action": "The spec of #285 (specify step) gave the maintainer the adoption command `git mv docs/lessons .celetis/lessons` and put the move of the untracked folder docs/lessons/_pending/ as the last act, with no run of either command.",
      "expected": "A command that a spec or a plan gives a person is run once in a temporary copy of the state that it targets, in the order of the text, or the document names it as an unverified premise.",
      "observed": "In a temporary repository with no .celetis/ folder, `git mv docs/lessons .celetis/lessons` exits 128. On a scratch copy of the engine with the planned edits, a capture made .celetis/lessons/_pending/ first; `mv docs/lessons/_pending .celetis/lessons/_pending` then put the old folder inside the new one, and `lesson-store read main` exited 2 with `unrecognized lesson store file; review it explicitly`. The maintainer changed the order of the acts in the plan session.",
      "source": {
        "kind": "tool-output",
        "excerpt": "fatal: renaming 'docs/lessons' to '.celetis/lessons' failed: No such file or directory",
        "reference": "https://github.com/ddinkov10/celetis/issues/285"
      },
      "inference": "Inferred, not proven: the spec session wrote the commands from the design and ran no probe of them. The spec listed four other premises as unverified and did not list these. Alternative: the session assumed that git mv makes the parent folder.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "3244a067d37d5cb487750a5a21836b5b693e7763"
    },
    {
      "id": "7e1f4b9b-b339-4b5d-81de-921d2c2714f2",
      "date": "2026-11-10",
      "action": "The spec of #285 listed a check that `land` refuses a lane with an invalid lesson, said that each check runs the entry of the checkout in a temporary repository, and said that no check uses the Herdr app, so no lab is necessary.",
      "expected": "A spec that names the command of a check follows that command from its entry and lists what it needs to run (a daemon, a terminal core, a remote), or names the premise as unverified.",
      "observed": "`celetis land` refuses with `no daemon runs for this repository` when no daemon runs (requireDaemon in engine/land.ts), and `daemon start` reads the hc core and the Herdr app (requireTerminals in engine/lib/terminal.ts). So the check through the entry needs a lab of scripts/herdr-lab.ts. The two lines of the spec exclude each other, and the maintainer chose a direct call of runLanding in the plan session.",
      "source": {
        "kind": "tool-output",
        "excerpt": "engine/land.ts: await requireDaemon(common, 'land'); engine/daemon.ts requireStart: await requireTerminals();",
        "reference": "https://github.com/ddinkov10/celetis/issues/285"
      },
      "inference": "Inferred, not proven: the spec session read the lesson check in engine/lib/landing.ts and did not follow the command `land` from its entry. Alternative: the session meant a direct call of the function and wrote `the entry` for each check.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "3244a067d37d5cb487750a5a21836b5b693e7763"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "c6120144-7f61-426d-88cf-94cba11863aa",
      "requestDigest": "10f906b9f50b74b560e9258e295d47b274289623fcb05197b33ba431a9ba37bd",
      "date": "2026-11-10",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #280; claude child opus/high\n\nEdit under the reviewer rules: the proposal has observed tool-output evidence for two incidents and states applicability, action, and check, and no rule rejects it; but its action told a session to run each hand command of a spec in a copy of the target state with no limit, which can add a network or credential act, or an inspection of another product repository against the project instructions (AGENTS.md, \"Plugin development\" and \"Host checks\"). The edit keeps the evidence, the facts, and the inference, and limits the run to a copy that the session builds in a scratch folder, never the real target or another product repository, with no login and no network act or shared-resource change that the task does not already permit; a command outside those limits is named as an unverified premise, as the specify and plan skills already require for an unsettled premise. Not a merge: the active lesson run-a-documented-host-recipe-in-the-state-that-it-repairs states a narrower rule for host commands that change an installed state, with its own private-host-home limits, so it does not state the same rule; the edit points host commands to it. No incident of the proposal is held by a live or historical lesson.",
      "related": [
        "run-a-command-of-a-spec-in-the-state-that-it-targets"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal states that the rule stays text, because which state a command targets needs judgment; no structural check is proposed."
      }
    }
  ]
}
---
# Run a command of a spec in the state that it targets, and trace what a named check needs

## What happened

In #285 the spec gave the maintainer the adoption command `git mv docs/lessons .celetis/lessons` and put the move of the untracked pending folder last. The plan session ran both in temporary repositories. `git mv` exits 128 when `.celetis/` does not exist. After a capture by the changed engine, the `mv` of the pending folder puts the old folder inside the new one, and `lesson-store read main` exits 2. The maintainer changed the order in the plan session.

The same spec listed a check that `land` refuses a lane with an invalid lesson, said that each check runs the entry of the checkout, and said that no check needs a lab. `celetis land` needs a daemon, and a daemon start reads the hc core and the Herdr app, so that check through the entry needs a lab. The maintainer chose a direct call of `runLanding`.

## Root cause

Inferred, not proven: the spec session wrote the commands and the premise from the design and from the function that holds the check, and ran no probe of them. It did list four other premises as unverified. Alternative for the second incident: the session meant a direct call and wrote "the entry" for each check.

## Fix

Proposed, in text: before a spec or a plan gives a command to a person, run it once in a temporary copy of the state that it targets, and write the command and its order from that run. The copy is a temporary repository or folder that the session builds in a scratch folder, never the real target and never another product repository. The run stays within the existing authorization of the task: no login, and no network act or change of a shared resource that the task does not already permit. For a check that names a command, follow the command from its entry and list what it needs to run. What is not run, also a command that cannot run within those limits, goes to the unverified premises. This stays text: which state a command targets needs judgment. The active lesson `run-a-documented-host-recipe-in-the-state-that-it-repairs` covers host commands that change an installed state, with its own limits for a private host home, and applies to such a command. This lesson covers each other command that a spec or a plan gives a person.

## Rule

Applies when a spec or a plan gives a command for a person to run by hand (an adoption or a move step), or names the command that a check runs. Action: run each hand command once in a temporary copy of the state that it targets, in the order that the text gives, and write the command and the order from that run. Build the copy in a scratch folder, never in the real target or in another product repository, and run a command only when it needs no login and no network act or change of a shared resource that the task does not already permit. For a host command that changes an installed state, apply `run-a-documented-host-recipe-in-the-state-that-it-repairs`. For a check command, follow it from its entry in the code and list what it needs to run (a daemon, a terminal core, a remote, a login). Name each command that was not run, and each need that was not traced, as an unverified premise. Check: the document names the run of each hand command with its exit, or names it as unverified; and each check command has its needs listed, with no need that contradicts another line of the document.

## Related lessons

[[run-a-documented-host-recipe-in-the-state-that-it-repairs]]
[[derive-plan-oracle-values-from-real-producers]]
