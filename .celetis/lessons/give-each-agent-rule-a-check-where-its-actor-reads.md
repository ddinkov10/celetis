---
{
  "schema": 1,
  "name": "give-each-agent-rule-a-check-where-its-actor-reads",
  "description": "Agent rules did not reach their actor: a research module that the build never reads, a sub-agent brief that carried only the tool and the bypass call, an open point that a ruling closed as settled with no reading check, and a code-health exclusion that only the generator of ideate read",
  "tags": [
    "process",
    "recurring",
    "ui",
    "refix",
    "false-negative"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "The implement session of #272 on Claude Code, Verify scenario V7, 2026-11-20\n\nThe implement session of ddinkov10/celetis#305 on Claude Code, Task 2 fix round 1 and its scoped re-review, 2026-11-11\n\nFinal review of ddinkov10/celetis#277 (final-reviewer-277, opus/xhigh, 2026-11-08), reproduced by the build\n\nFinal whole-branch review of #243 in the implement session, 2026-11-04",
  "incidents": [
    {
      "id": "0dd7546c-820f-4d1f-bafe-d2b35c65b89f",
      "date": "2026-11-20",
      "action": "Task 1 of #272 wrote the code-health non-goal of the spec into frames.md, \"The frames\", only (\"A frame does not look for defects, security gaps, speed, test gaps, or the structure of the code.\"); \"The verdict\" and \"The cut\" had no check for it.",
      "expected": "Spec non-goal: code health is out, and the run cuts such an idea with the reason \"code health, not product direction\".",
      "observed": "Three live runs at 0147274 kept defect-fix survivors with the verdict sound; the fresh judge of V7 answered for them, for example, \"Yes. It fixes a packaging bug and changes the build and code structure\"; a verifier reading probe gave sound to a data-loss fix in 6 of 6 runs.",
      "source": {
        "kind": "tool-output",
        "excerpt": "V7 judge, V1 sample 1 round 2, survivor 2: \"(c) Yes. It fixes a packaging bug and changes the build and code structure by inlining `slug`.\" Its verdict line: \"sound — ... close to a defect fix.\"",
        "reference": "https://github.com/ddinkov10/celetis/issues/272"
      },
      "inference": "Inferred: the generation-step line does not reach the verifier, whose brief names only \"The basis\", \"Trust\", and \"The verdict\", and the session treats a sound verdict as a pass. Alternative: a frame child cannot tell a user-visible fix from product direction without the rule \"also when the users notice the fix\". The fix 60c1026 added both, and V7 passed after it.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "0147274",
      "lesson": {
        "name": "give-each-agent-rule-a-check-where-its-actor-reads",
        "revision": "0730e81",
        "digest": "e47bc28df0886a6b62212d40b1a8518556bdd546f4c33f3602d620cb9a8f8f4e"
      }
    },
    {
      "id": "9cd73e36-b9a4-4808-accd-318356a70bae",
      "date": "2026-11-11",
      "action": "In Task 2, fix round 1, the implementer's reading check named an open point: after Assessment A returns a busy, failed, or foreign background browser, does Assessment B still call that server, and which line does B get? The coordinator ruled that the existing text settles it (browser.md: each actor reads the roles and lists the tabs itself, so B gets the line of its own case) and sent the round to the scoped re-review with no reading check of that ruling.",
      "expected": "The lesson give-each-agent-rule-a-check-where-its-actor-reads: 'Treat an open point that a reading check names about those files as a finding, not a note.' A ruling that the text already settles the point needs evidence from the actor's reading, not the coordinator's own reading.",
      "observed": "The re-review graded the ruling 'DOES NOT HOLD' and new Important breakage: both final runs on 8c37e60 named the gap. A second fix round (56f6dbc) had to add the act of B.",
      "source": {
        "kind": "tool-output",
        "excerpt": "docs/superpowers/verification/305/rc/fix1-a-busy/answer.md, Q1: \"Not settled by the text: what happens to Assessment B. The rule 'make no further call to that tool' applies to the session, and the session includes its assessments\"; rc/fix1-a-fail/answer.md: \"no file says if Assessment B still tries the same failed server\". Re-review verdict: \"Ruling (1): B makes its own read and gets the line of its own case. DOES NOT HOLD.\"",
        "reference": "https://github.com/ddinkov10/celetis/issues/305"
      },
      "inference": "Inferred: the coordinator treated the open point as a question of fact and answered it from its own reading of browser.md, so the ruling closed the point without the check that the lesson asks for. Alternative: the coordinator judged one more reading check too costly at that round; the ledger does not say so.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "8c37e60",
      "brief": "The plan of #305 (issue comment 6796269712), Task 2, lesson rules: give-each-agent-rule-a-check-where-its-actor-reads sha256:e922e39032325ac768180a4989c94b818a0021dc7360876800a4ef138d2aad54.",
      "lesson": {
        "name": "give-each-agent-rule-a-check-where-its-actor-reads",
        "revision": "eb3812d",
        "digest": "e922e39032325ac768180a4989c94b818a0021dc7360876800a4ef138d2aad54"
      }
    },
    {
      "id": "f95a2252-9143-4e01-9e49-ce12b57be5ae",
      "date": "2026-11-08",
      "action": "Task 3 of #277 wrote step 1 of \"The design review\" in docs/procedures/design.md so that the brief of Assessment B, a sub-agent of critique, names only the Playwright tool and the bypass call of \"The page CSP\". The task's own RC5 reading check named the open point, and the build recorded it but kept the text.",
      "expected": "Each rule of a bypassed tab (loopback only, the sign-in rule, the close of the tab, the output files) reaches Assessment B, which reads only its brief and critique.md.",
      "observed": "Reading check x1 (claude -p, Read only, design.md fa4b4390 at e82ee2e) answered that with the required brief, B follows critique.md alone, which has no origin check, so B runs the preflight in a bypassed tab on a foreign sign-in host. The rerun of the build gave the same answer.",
      "source": {
        "kind": "tool-output",
        "excerpt": "x1 Q2: \"With critique.md alone: not settled by the text. critique.md has no rule for the origin, a sign-in, or a redirect. B knows these rules only if the brief carries them. B reads no design.md.\"; RC5 of the build: \"The text does not say if the brief of B includes the loopback rule and the sign-in rule\"",
        "reference": "Runtime report on ddinkov10/celetis#277; docs/superpowers/verification/277-final-red/x1 and 277-rc5 of the main checkout"
      },
      "inference": "The rule of the lesson was in the Task 3 brief, but the build applied it to the review session that writes the brief and not to the sub-agent that acts. The plan's expected answer for RC5 covered only the tool and the call, so the check could not fail on the gap. Alternative: the spec scoped the brief the same way (\"adds the tool and the call to the brief of Assessment B\"), so the narrower scope came from the spec and the plan.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "e82ee2e57fc46513098201b3c744962386cde3e4",
      "brief": "Task 3 lesson rules: give-each-agent-rule-a-check-where-its-actor-reads sha256:de942885…; plan V1 RC5 Q1 expected: \"B uses the Playwright MCP server, a new tab, and the fixed call before its navigation; A gets no call.\"",
      "lesson": {
        "name": "give-each-agent-rule-a-check-where-its-actor-reads",
        "revision": "92b91337586e0992316ac8835d10db28e6954d44",
        "digest": "de942885dcd5e139f2a36100f4ddf9bf3fdca184175d012d55a181bb99ddddf0"
      }
    },
    {
      "id": "c4fae7b0-7da6-40fe-bea5-6f4ac824708f",
      "date": "2026-11-04",
      "action": "The implement session of #243 wrote docs/procedures/component-research.md with the rule 'use only a browser that the session opened' and no check that tells a session whether a browser is its own. It put 'the build copies no code without a license that permits it' and 'a look is never a target' only in that research module, which plan and implement do not load.",
      "expected": "Each rule that an agent must apply names an observable check, and lives in a file that the agent who acts reads (spec #243 anti-goals: taking over another session's browser, a copied implementation, a copied look).",
      "observed": "The final reviewer reported 'The module gives no check for the rule use only a browser that the session opened' and 'The license rule does not reach the session that builds'. A focused reading check on commit 27a85e4 answered Q1 and Q3 'not settled by the text'; on commit a41b6f1 both were settled.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Q1. The text does not settle this. It gives a rule but no check that tells a session if a browser is its own ... Q3. The plan skill does not settle this ... Neither file says if the bar of the Verify phase is a 'target of the build'.",
        "reference": "/Users/dinq/Dinq/PROJECTS/celetis/docs/superpowers/verification/243-final-fix/red/result.md"
      },
      "inference": "Inferred, not established: the build compared each rule with the spec wording, but not with the agent that must act on it, nor with how that agent observes the condition. Alternative: the plan brief named the rules without a check, and the build transcribed them.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "27a85e430451c25df4ee9137971ad912fa139744"
    }
  ],
  "recurrences": 3,
  "reviews": [
    {
      "id": "8f1aad0e-006b-4a87-8aea-bc1c145127c5",
      "requestDigest": "944cb078ded6d2a6828c51f67ea80b5f43ade02cb2725121f41b0225f37cba6b",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nEdit under the reviewer rules: the retained focused-reading results establish that the original text did not settle the actor questions. Preserve the incident and inferred cause. Clarify that the rule has one canonical home in the project-required layer and reaches the actor through loaded text and applicable pointers. This avoids interpreting direct placement as permission to duplicate a canonical principle or shared procedure. The edited rule agrees with AGENTS.md placement rules, writing-for-agents, and the current component-research, plan, and implement procedures. It states applicability, action, and a focused check. The related active shared-prohibition lesson concerns conflicting callers rather than missing reachability or observable checks. Structural work stays proposed.",
      "related": [
        "give-each-agent-rule-a-check-where-its-actor-reads"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Consider a separately authorized reading check of rule reachability and observable checks. This review changes no skill, instruction, or source path."
      }
    },
    {
      "id": "93b31928-c51e-49d6-90a1-02172d10b34a",
      "requestDigest": "84c92fa6a9f58ae7ff809b4e8873ee18c9aef0a8befb07b855bed6facc187d64",
      "date": "2026-11-08",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #277; claude child opus/high\n\nMerge under the reviewer rules: the active lesson give-each-agent-rule-a-check-where-its-actor-reads states the same rule, and the proposal names it as the lesson that its incident did not follow; the Task 3 brief carried it (digest de942885). The incident is observed: the reading check x1 of the final review (277-final-review/checks/x1) and the rerun of the build (277-final-red/x1) answer that B, with only the required brief, has no rule for the origin or a sign-in, and the events of 277-rc5 hold the quoted open point. Lane commit ad306ab adds the fix that the proposal names to docs/procedures/design.md. The survivor keeps the active name, both incidents, and the earlier review. It widens the rule to a delegated act: the sub-agent is the actor, its brief cites each section of rules that the act needs, whole, and states the act at each exit, and an open point of a reading check about those files is a finding, not a note. The body keeps the facts apart from the inferred causes: x1 is a reading check of the text, not a browser run, and its answer names the preflight as the next step of B; the proposal body also named the injection, which that answer does not state. The rule adds checks, weakens none, widens no permission, adds no network or credential act, and agrees with docs/procedures/dispatch.md, \"One child\" (the brief carries the task and its constraints), the placement rules of AGENTS.md and writing-for-agents (one canonical rule, reached by a citation), docs/procedures/review-evidence.md (each finding gets a disposition), and the principle encode-lessons-in-structure: the rule stays text, because the set of rules that an act needs is a judgment.",
      "related": [
        "give-a-delegated-actor-the-rules-of-its-act-in-its-brief",
        "give-each-agent-rule-a-check-where-its-actor-reads"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The earlier proposed follow-up stays open and now covers delegated acts: a separately authorized plan or review step that runs a reading check from only the brief and the files of each sub-agent that a change gives an act, with a case at each exit of the act. This review changes no skill, procedure, or instruction file."
      }
    },
    {
      "id": "8d1ec449-b64a-4281-b1af-d8a19c5117f2",
      "requestDigest": "6d530b9c08d212300ec9e78ba34cce48d18ba71a18df4c2bff9c9e4fdd918116",
      "date": "2026-11-11",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #305; claude child opus/high\n\nMerge under the reviewer rules. The incident is observed: the retained excerpts of rc/fix1-a-busy and rc/fix1-a-fail answer \"Not settled by the text\" for the act of Assessment B, and the re-review verdict reads \"Ruling (1): ... DOES NOT HOLD\"; commit 56f6dbc of the lane added the act of B. The incident cites the rule of give-each-agent-rule-a-check-where-its-actor-reads (\"Treat an open point that a reading check names about those files as a finding, not a note\") as its expected behavior, with the diagnosis not-followed: a ruling that the text settles the point is that same rule, so the proposal merges into it and keeps every incident and review. The survivor's rule now names the ruling case and its check. The rule agrees with stop.md of the plugin, where coordinator authority settles a question of fact: it asks for evidence of the ruling and removes no authority. It widens no permission and weakens no check.",
      "related": [
        "prove-a-settled-by-the-text-ruling-with-a-reading-check",
        "give-each-agent-rule-a-check-where-its-actor-reads"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural check is proposed: whether existing text settles an open point is a judgment of meaning that the gate cannot decide; the check is the reading run."
      }
    },
    {
      "id": "4e76b304-fe52-4aa5-92a6-48cc2942d52c",
      "requestDigest": "180057eb95a7a0f0c5dbc3aeb0857f230fdf651a4b369f270782bd139ca87a5f",
      "date": "2026-11-21",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #272; claude child opus/high\n\nMerge under the reviewer rules: the active lesson give-each-agent-rule-a-check-where-its-actor-reads states the same rule (a constraint reaches each agent that applies it, in the files that agent reads, with a reading check), and the incident names it as the examined lesson (revision 0730e81, digest e47bc28d) with the diagnosis wrong-or-incomplete-rule. The incident is observed: the V7 judge excerpt and lane commit 60c1026, which adds the code-health check to \"The verdict\" and \"The cut\" of plugins/celetis/skills/ideate/frames.md. The survivor keeps the active name, all four incidents, and the earlier reviews. It widens the action from one agent to each agent, and names the actors of an exclusion of generated items (the generator, each critic, the final cut) with the borderline case; the body keeps the inferred cause and its alternative apart from the facts. The rule adds checks, weakens none, widens no permission, adds no network or credential act, and agrees with the placement rules of AGENTS.md and the principle encode-lessons-in-structure: it stays text, because the excluded class is a judgment.",
      "related": [
        "give-each-exclusion-of-generated-content-a-check-at-the-critique",
        "give-each-agent-rule-a-check-where-its-actor-reads"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The earlier proposed follow-up stays open and now covers exclusions of generated items: a separately authorized plan or review step that runs a reading case for each actor that can pass an item (the generator, each critic, the final cut). This review changes no skill, procedure, or instruction file."
      }
    }
  ]
}
---
# Give each agent rule a check, in the files that its actor reads

## What happened

The implement session of #243 wrote a component research module. Its rule "use, drive, close, or reset only a browser that the session opened" named no way to tell whether a browser is the session's own. Its rules "the build copies no code without a license that permits it" and "a look is never a target of the build" lived only in the research module, which the plan and the build do not load. The final reviewer reported both. A focused reading check on commit 27a85e4 answered "not settled by the text" for the browser check and for the Verify bar. An earlier reading check of the base `plan` text made the measured values of a model the Verify bar.

In #277, step 1 of "The design review" in `docs/procedures/design.md` required that the brief of Assessment B name the tool and the call of "The page CSP", and it did not require the other rules of that section. B is a sub-agent of `critique`: it reads only its brief and `critique.md`, and `critique.md` has no origin check. So the tab rules of "The page CSP" (loopback only, a page behind a sign-in, the end of a bypassed tab, the output files) did not reach B. The reading check x1 of the final review answered that, with only the required brief, B follows `critique.md` alone, so at a redirect to a foreign sign-in page its next step is the preflight, in a tab with the CSP bypassed. The rerun of the build answered that, with `critique.md` alone, the text does not settle the act, because `critique.md` has no rule for the origin, a sign-in, or a redirect. Earlier, the build's own reading check RC5 had named the open point ("The text does not say if the brief of B includes the loopback rule and the sign-in rule"), and the text stayed unchanged after it. The Task 3 brief carried this lesson.

In #305, Task 2 fix round 1, the implementer's reading check named an open point: after Assessment A returns a busy, failed, or foreign background browser, does Assessment B still call that server, and which line does B get? The coordinator ruled that the existing text of `browser.md` settles it (each actor reads the roles itself) and sent the round to the scoped re-review with no reading check of that ruling. The re-review graded the ruling "DOES NOT HOLD": both final reading runs on 8c37e60 answered that the text does not settle the act of B (tool output). A second fix round (56f6dbc) added the act of B. The Task 2 brief carried this lesson.

In #272, Task 1 wrote the code-health non-goal of the `ideate` spec only into "The frames" of `frames.md`, which the frame children read. "The verdict", which the verifier reads, and "The cut", which the session applies, had no check for it. Three live runs at 0147274 kept survivors whose main change fixed a defect, with the verdict `sound`. The fresh judge of V7 answered for one of them: "(c) Yes. It fixes a packaging bug and changes the build and code structure by inlining `slug`." (tool output). Commit 60c1026 stated the exclusion, with the case of a fix that users notice, in "The frames", "The verdict", and "The cut", and V7 passed after it.

## Root cause

Inferred, not established: the build checked each rule against the spec wording only. It did not ask which agent acts on the rule, which file that agent reads, and what that agent can observe. Alternative: the plan brief carried the rules without a check, and the build transcribed them.

In #277, inferred: the build applied this rule to the review session that writes the brief, not to the sub-agent that acts. The expected answers of the plan's RC5 covered only the tool and the call, so that check could not fail on the gap, and its open point stayed a note. Alternative: the spec scoped the brief the same way ("adds the tool and the call to the brief of Assessment B"), so the narrower scope can also come from the spec and the plan.

In #305, inferred: the coordinator answered the open point from its own reading, not from a reading of the actor's files, so the ruling closed a finding as a note. Alternative: the coordinator weighed the cost of one more check; the ledger does not say so.

In #272, inferred: the session applied the rule to one actor, the generator, so the exclusion did not reach the verifier, whose brief names only "The basis", "Trust", and "The verdict", or the session, which took a `sound` verdict as a pass. Alternative: a frame child cannot tell a fix that users notice from product direction without that borderline case.

## Fix

Proposed prevention, not proven enforcement: for each constraint in agent text, name the actor and its step. Keep one canonical rule in the layer that the project requires. Make the actor reach that rule through text it loads at that step, with an explicit pointer when needed. Give the rule an observable check. A focused reading check that asks the actor's question can show a missing rule, pointer, or check before review. The rule stays text because the choice of actor, loading path, and check needs judgment.

The fix of #277: the brief of B cites "The page CSP" of `design.md`; on another origin, or on a page that asks for a sign-in, B closes its tab, runs no preflight and no injection, and returns the URL; and B removes the `.playwright-mcp/` files that its tool results name. Proposed prevention, not proven: when agent text delegates an act to a sub-agent through a brief, the plan adds a reading check that starts from only the brief and the files that the sub-agent reads, with a case at each exit of the act. The set of rules that an act needs is a judgment, so this part stays text too.

Proposed prevention after #305, not proven: a coordinator or a reviewer that rules "the existing text settles it" about an open point of a reading check quotes a focused reading run from the actor's files whose input is that point. With no such run, the point stays a finding of the round. Only judgment can tell whether text settles a point, so this part stays text.

Proposed prevention after #272, not proven: when agent text excludes a class of item that agents generate and later critique or cut, each actor that can pass an item (the generator, each critic, the final cut) is an actor of the exclusion. State the exclusion, with its borderline case, in the section that each of them reads. The class is a judgment, so no static check finds a missing exclusion, and this part stays text.

## Rule

Applies when agent text adds a constraint, also when a step delegates the act to a sub-agent through a brief. Action: name each agent that must apply the constraint and the step where it acts; for a delegated act, that agent is the sub-agent, not the session that writes the brief; for an exclusion of a class of item that agents generate and later critique or cut, the agents are each actor that can pass an item (the generator, each critic, the final cut), and each of them gets the exclusion with its borderline case. Keep the canonical rule in the layer required by the project, and make it reachable from the files that agent reads at that step: a brief cites each section of rules that the act needs, whole, and states the act of the sub-agent at each exit (another origin, a sign-in, a failure, the cleanup). Give the rule a check that the agent can observe. Treat an open point that a reading check names about those files as a finding, not a note; a ruling that the existing text settles such a point closes it only with a focused reading run from those files whose input is the point, and quotes the lines that settle it. Check: a focused reading check, starting from only those files and following their applicable pointers, settles that agent's question, with a case at each exit of a delegated act and, for an exclusion, a case for each actor with one item of the excluded class that passes each other check and gets the cut or the bad verdict, and each "settled by the text" ruling names its reading run and the quoted lines.

