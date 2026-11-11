---
{
  "schema": 1,
  "name": "give-each-agent-rule-a-check-where-its-actor-reads",
  "description": "Agent rules did not reach their actor: a research module that the build never reads, and a sub-agent brief that carried only the tool and the bypass call",
  "tags": [
    "process",
    "recurring",
    "ui"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#277 (final-reviewer-277, opus/xhigh, 2026-11-08), reproduced by the build\n\nFinal whole-branch review of #243 in the implement session, 2026-11-04",
  "incidents": [
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
  "recurrences": 1,
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
    }
  ]
}
---
# Give each agent rule a check, in the files that its actor reads

## What happened

The implement session of #243 wrote a component research module. Its rule "use, drive, close, or reset only a browser that the session opened" named no way to tell whether a browser is the session's own. Its rules "the build copies no code without a license that permits it" and "a look is never a target of the build" lived only in the research module, which the plan and the build do not load. The final reviewer reported both. A focused reading check on commit 27a85e4 answered "not settled by the text" for the browser check and for the Verify bar. An earlier reading check of the base `plan` text made the measured values of a model the Verify bar.

In #277, step 1 of "The design review" in `docs/procedures/design.md` required that the brief of Assessment B name the tool and the call of "The page CSP", and it did not require the other rules of that section. B is a sub-agent of `critique`: it reads only its brief and `critique.md`, and `critique.md` has no origin check. So the tab rules of "The page CSP" (loopback only, a page behind a sign-in, the end of a bypassed tab, the output files) did not reach B. The reading check x1 of the final review answered that, with only the required brief, B follows `critique.md` alone, so at a redirect to a foreign sign-in page its next step is the preflight, in a tab with the CSP bypassed. The rerun of the build answered that, with `critique.md` alone, the text does not settle the act, because `critique.md` has no rule for the origin, a sign-in, or a redirect. Earlier, the build's own reading check RC5 had named the open point ("The text does not say if the brief of B includes the loopback rule and the sign-in rule"), and the text stayed unchanged after it. The Task 3 brief carried this lesson.

## Root cause

Inferred, not established: the build checked each rule against the spec wording only. It did not ask which agent acts on the rule, which file that agent reads, and what that agent can observe. Alternative: the plan brief carried the rules without a check, and the build transcribed them.

In #277, inferred: the build applied this rule to the review session that writes the brief, not to the sub-agent that acts. The expected answers of the plan's RC5 covered only the tool and the call, so that check could not fail on the gap, and its open point stayed a note. Alternative: the spec scoped the brief the same way ("adds the tool and the call to the brief of Assessment B"), so the narrower scope can also come from the spec and the plan.

## Fix

Proposed prevention, not proven enforcement: for each constraint in agent text, name the actor and its step. Keep one canonical rule in the layer that the project requires. Make the actor reach that rule through text it loads at that step, with an explicit pointer when needed. Give the rule an observable check. A focused reading check that asks the actor's question can show a missing rule, pointer, or check before review. The rule stays text because the choice of actor, loading path, and check needs judgment.

The fix of #277: the brief of B cites "The page CSP" of `design.md`; on another origin, or on a page that asks for a sign-in, B closes its tab, runs no preflight and no injection, and returns the URL; and B removes the `.playwright-mcp/` files that its tool results name. Proposed prevention, not proven: when agent text delegates an act to a sub-agent through a brief, the plan adds a reading check that starts from only the brief and the files that the sub-agent reads, with a case at each exit of the act. The set of rules that an act needs is a judgment, so this part stays text too.

## Rule

Applies when agent text adds a constraint, also when a step delegates the act to a sub-agent through a brief. Action: name the agent that must apply the constraint and the step where it acts; for a delegated act, that agent is the sub-agent, not the session that writes the brief. Keep the canonical rule in the layer required by the project, and make it reachable from the files that agent reads at that step: a brief cites each section of rules that the act needs, whole, and states the act of the sub-agent at each exit (another origin, a sign-in, a failure, the cleanup). Give the rule a check that the agent can observe. Treat an open point that a reading check names about those files as a finding, not a note. Check: a focused reading check, starting from only those files and following their applicable pointers, settles that agent's question, with a case at each exit of a delegated act.
