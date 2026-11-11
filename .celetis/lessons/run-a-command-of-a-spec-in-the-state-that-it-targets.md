---
{
  "schema": 1,
  "name": "run-a-command-of-a-spec-in-the-state-that-it-targets",
  "description": "Hand commands of a spec and a decision record had no run in each start state that the document reaches: git mv failed without its parent folder and nested the store when the folder existed, and a land check needed a daemon and a lab",
  "tags": [
    "process",
    "git",
    "false-negative"
  ],
  "date": "2026-11-10",
  "status": "active",
  "source": "Final review of the build of ddinkov10/celetis#285, 2026-11-10: https://github.com/ddinkov10/celetis/issues/285#issuecomment-6776064246\n\nPlan step of ddinkov10/celetis#285 (Claude Code, 2026-11-10)",
  "incidents": [
    {
      "id": "8ac0a653-b359-40ec-b019-8525656031d1",
      "date": "2026-11-10",
      "action": "The build session of #285 wrote the move command of ADR-0093, `mkdir -p .celetis && git mv docs/lessons .celetis/lessons`, from the adoption probe of the plan, which ran the command in one start state: a lane with no `.celetis/` folder. The record gave the command with no such condition, and the same record tells the owner to move the pending folder to `.celetis/lessons/_pending/` in the main checkout.",
      "expected": "A command that a document gives to a person works in each start state that the steps of the same document and the normal use of the product reach, or the document names the state that the command needs.",
      "observed": "The final reviewer ran the command in two more states. With `.celetis/lessons/` present (after the move of the pending folder in the same checkout, or with a lesson at the new path on the trunk), `git mv` exits 0 and puts the folder at `.celetis/lessons/lessons`, and `lesson-store read active` then exits 2. The build session reran the probe on the reviewed commit 3853158 with the same result.",
      "source": {
        "kind": "tool-output",
        "excerpt": "m1 {\"pmv\":0,\"gitmv\":{\"code\":0,\"stdout\":\"\",\"stderr\":\"\"},\"nested\":true,\"read\":{\"code\":2,\"stderr\":\"lesson-store: <work>/m1/.celetis/lessons/lessons: unrecognized lesson store file; review it explicitly\"}}",
        "reference": "https://github.com/ddinkov10/celetis/issues/285#issuecomment-6776064246"
      },
      "inference": "Inferred: the plan probed the command only in the state of its own step order (a lane), and the build session widened the command to each checkout in the record with no new run. Alternative: the plan session saw the same hazard for `mv` of the pending folder (maintainer decision 1 of the plan) and did not ask the same question for `git mv`. The evidence does not separate the two. The active lesson run-a-documented-host-recipe-in-the-state-that-it-repairs covers by its text only a host command that changes an installed state, so no carried rule named this case.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "3853158",
      "brief": "The plan of #285 (https://github.com/ddinkov10/celetis/issues/285#issuecomment-6775203591) carried no lesson rule for a documented command; Task 4, step 3, named the command `mkdir -p .celetis && git mv docs/lessons .celetis/lessons` as a consequence to record.",
      "lesson": {
        "name": "run-a-documented-host-recipe-in-the-state-that-it-repairs",
        "revision": "ebed861",
        "digest": "347296c4d8f7e70f88797ebd93baa4452f1aef3905154164fa9f73348b1b465b"
      }
    },
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
  "recurrences": 2,
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
    },
    {
      "id": "d1a7be9e-84cc-400e-b2ff-b82eeeedc784",
      "requestDigest": "c655d48b9e96960667a1ceacff6bf32576f167bd3dc58732d811586699d94e7b",
      "date": "2026-11-10",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #285; claude child opus/high\n\nMerge under the reviewer rules: merge a proposal into an active lesson that states the same rule, and keep every incident. The active lesson run-a-command-of-a-spec-in-the-state-that-it-targets already states the rule of the proposal: run a hand command that a document gives a person in a temporary copy of the state that it targets, or name it as an unverified premise. The new incident is the same move command of #285, and it shows that this rule was incomplete, not wrong: one run in one start state passed, and two other start states that the same record and normal use reach nested the store. So the survivor keeps its name, both earlier incidents, and its prior review, adds incident 8ac0a653-b359-40ec-b019-8525656031d1, widens its applicability from a spec or a plan to each document, a decision record, and a printed line, and asks for a run in each start state that the document order and normal use reach. Not a merge with run-a-documented-host-recipe-in-the-state-that-it-repairs, as the proposal suggested: that rule has its own private-host-home limits for host commands that change an installed state, the review of the landing of #280 kept it apart, and the survivor still points host commands to it, so the two rules stay compatible. The proposed action had no limits for the runs; the survivor keeps the limits of the active rule (a scratch copy, never the real target or another product repository, no login, and no network act or shared-resource change that the task does not already permit), so the merge adds no network or credential act. No incident of the proposal is held by another live or historical lesson. Attributed correction: the incident names the decision record of #285 as ADR-0093; after the merge of the trunk into the lane, that record is docs/adr/0094-the-lesson-store-lives-in-celetis-lessons.md, and the trunk's ADR-0093 is another record. The incident evidence stays unchanged. The inference of the incident says that no carried rule named this case, and it examined only the host recipe lesson. The active lesson of this merge, from the plan step of #285, covers a hand command of a spec or a plan, but by its text not a decision record and not more than one start state. The review cannot tell whether that lesson was active when the build ran.",
      "related": [
        "run-a-documented-command-in-each-start-state-that-the-document-reaches",
        "run-a-command-of-a-spec-in-the-state-that-it-targets"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal and the survivor state that the rule stays text: which start states a hand command meets needs a reading of the document order and of the normal use of the product. No structural check is proposed."
      }
    }
  ]
}
---
# Run a hand command of a document in each start state that the document reaches, and trace what a named check needs

## What happened

In #285 the spec gave the maintainer the adoption command `git mv docs/lessons .celetis/lessons` and put the move of the untracked pending folder last. The plan session ran both in temporary repositories. `git mv` exits 128 when `.celetis/` does not exist. After a capture by the changed engine, the `mv` of the pending folder puts the old folder inside the new one, and `lesson-store read main` exits 2. The maintainer changed the order in the plan session.

The same spec listed a check that `land` refuses a lane with an invalid lesson, said that each check runs the entry of the checkout, and said that no check needs a lab. `celetis land` needs a daemon, and a daemon start reads the hc core and the Herdr app, so that check through the entry needs a lab. The maintainer chose a direct call of `runLanding`.

The decision record of #285 (ADR-0093 at the capture, `docs/adr/0094-the-lesson-store-lives-in-celetis-lessons.md` after the merge of the trunk) then gave the owner of a product project the command `mkdir -p .celetis && git mv docs/lessons .celetis/lessons`. The adoption probe of the plan ran it in one start state: a lane with no `.celetis/` folder. The same record tells the owner to move the pending folder to `.celetis/lessons/_pending/` in the main checkout. The final reviewer ran the command with `.celetis/lessons/` present, in the main checkout after that move and in a lane whose trunk held a lesson at the new path. In both states `git mv` exited 0, put the folder at `.celetis/lessons/lessons`, and each `lesson-store read active` then exited 2. The fix gave a command that moves the files, and a probe that reads the command from the record and runs it in five start states.

## Root cause

Inferred, not proven: the spec session wrote the commands and the premise from the design and from the function that holds the check, and ran no probe of them. It did list four other premises as unverified. Alternative for the second incident: the session meant a direct call and wrote "the entry" for each check.

Inferred for the decision record: the command had one probed start state, and the record gave it for each checkout with no new run. Alternative: the plan session found the same hazard for `mv` of the pending folder and did not ask the same question for `git mv`. Uncertain which one holds. A rule that asks for one run in "the state that it targets" lets one probed state pass when the steps of the document or the normal use of the product reach other states.

## Fix

Proposed, in text: before a document gives a command to a person, list each start state that the steps of the same document, in each order that its text permits, and the normal use of the product can produce before the command. Run the command, as the final text of the document gives it, once in a temporary copy of each listed state, and write the command and its order from those runs, or name the state that the command needs. Each copy is a temporary repository or folder that the session builds in a scratch folder, never the real target and never another product repository. The run stays within the existing authorization of the task: no login, and no network act or change of a shared resource that the task does not already permit. For a check that names a command, follow the command from its entry and list what it needs to run. What is not run, also a start state or a command that cannot run within those limits, goes to the unverified premises. This stays text: which start states a command meets needs a reading of the document order and of the normal use of the product, which a gate cannot derive. The decision record of #285 now has a probe that reads its command from the record and runs it in five start states; that probe covers that one command, and no enforcement of the rule is proven. The active lesson `run-a-documented-host-recipe-in-the-state-that-it-repairs` covers host commands that change an installed state, with its own limits for a private host home, and applies to such a command. This lesson covers each other command that a document gives a person.

## Rule

Applies when a spec, a plan, a decision record, another document, or a printed line gives a person a command to run by hand (for example an adoption or a move step), or names the command that a check runs. Action: list each start state that the steps of the same document, in each order that its text permits, and the normal use of the product can produce before the hand command. Run the command, as the final text gives it, once in a temporary copy of each listed state, in the order that the text gives, and write the command and the order that pass in each state, or name in the same sentence the state that the command needs. Build each copy in a scratch folder, never in the real target or in another product repository, and run a command only when it needs no login and no network act or change of a shared resource that the task does not already permit. For a host command that changes an installed state, apply `run-a-documented-host-recipe-in-the-state-that-it-repairs`. For a check command, follow it from its entry in the code and list what it needs to run (a daemon, a terminal core, a remote, a login). Name each command or start state that was not run, and each need that was not traced, as an unverified premise. Check: the document or the task report names each listed start state with the exit and the result of each hand command, or names it as unverified; and each check command has its needs listed, with no need that contradicts another line of the document.

## Related lessons

[[run-a-documented-host-recipe-in-the-state-that-it-repairs]]
[[derive-plan-oracle-values-from-real-producers]]
