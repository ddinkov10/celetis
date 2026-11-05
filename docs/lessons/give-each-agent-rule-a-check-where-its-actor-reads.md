---
{
  "schema": 1,
  "name": "give-each-agent-rule-a-check-where-its-actor-reads",
  "description": "A research module stated browser and license rules with no check, in a file that the build never reads",
  "tags": [
    "process"
  ],
  "date": "2026-11-04",
  "status": "active",
  "source": "Final whole-branch review of #243 in the implement session, 2026-11-04",
  "incidents": [
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
  "recurrences": 0,
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
    }
  ]
}
---
# Give each agent rule a check, in the file that its actor reads

## What happened

The implement session of #243 wrote a component research module. Its rule "use, drive, close, or reset only a browser that the session opened" named no way to tell whether a browser is the session's own. Its rules "the build copies no code without a license that permits it" and "a look is never a target of the build" lived only in the research module, which the plan and the build do not load. The final reviewer reported both. A focused reading check on commit 27a85e4 answered "not settled by the text" for the browser check and for the Verify bar. An earlier reading check of the base `plan` text made the measured values of a model the Verify bar.

## Root cause

Inferred, not established: the build checked each rule against the spec wording only. It did not ask which agent acts on the rule, which file that agent reads, and what that agent can observe. Alternative: the plan brief carried the rules without a check, and the build transcribed them.

## Fix

Proposed prevention, not proven enforcement: for each constraint in agent text, name the actor and its step. Keep one canonical rule in the layer that the project requires. Make the actor reach that rule through text it loads at that step, with an explicit pointer when needed. Give the rule an observable check. A focused reading check that asks the actor's question can show a missing rule, pointer, or check before review. The rule stays text because the choice of actor, loading path, and check needs judgment.

## Rule

When agent text adds a constraint, name the agent that must apply it and the step where it acts. Keep the canonical rule in the layer required by the project, and make it reachable from the files that agent reads at that step. Give the rule a check that the agent can observe. Check: a focused reading check, starting from only those files and following their applicable pointers, settles that agent's question.
