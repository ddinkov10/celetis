---
{
  "schema": 1,
  "name": "a-pointer-to-a-shared-rule-restates-no-part-of-it",
  "description": "References to another section restated part of it: a fix-brief paraphrase of a shared rule dropped its exception, and a record rule named a three-cause state by one cause, so a Codex session with the skill and a failed npx skipped the one line",
  "tags": [
    "process",
    "refix",
    "false-negative",
    "recurring"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Implement session of #338 (ddinkov10/celetis), Verify scenario V6 on Codex CLI 0.167.0 (gpt-6-luna).\n\nTask 6 of ddinkov10/celetis#264, fix rounds 1 and 2 (implement step session)",
  "incidents": [
    {
      "id": "4ab9e1c4-d6c7-4abc-bd99-5b3247857bb4",
      "date": "2026-11-18",
      "action": "Task 1 of #338 wrote plugins/celetis/references/procedures/web-guidance.md, \"The record\", with \"With no skill, it holds the one line of \\\"Unavailable\\\"\", while \"Unavailable\" defines three causes (no skill, a failed launch, a failed command).",
      "expected": "The record holds the one line for each cause of \"Unavailable\" (spec of #338: the line holds \"the one line of 'Unavailable'\"; \"Unavailable\": the skill is missing, its launch fails, or npx fails).",
      "observed": "V6 (Codex, skill present, no network): pnpx failed ENOTFOUND and npx --offline failed ENOTCACHED; report.md held \"Web guidance: Searched \\\"confirmation modal dialog\\\". The modern-web-guidance package was unavailable because pnpm reported ENOTFOUND and the offline npm cache reported ENOTCACHED.\" and no line \"web guidance: modern-web-guidance is not available; <cause>.\"",
      "source": {
        "kind": "tool-output",
        "excerpt": "Web guidance: Searched \"confirmation modal dialog\". The `modern-web-guidance` package was unavailable because pnpm reported `ENOTFOUND` and the offline npm cache reported `ENOTCACHED`.",
        "reference": "https://github.com/ddinkov10/celetis/issues/338"
      },
      "inference": "The record bullet restated the trigger of \"Unavailable\" by one cause. A Claude reader on the base text still inferred the line from \"Unavailable\", so the defect shows only on some readers. The active lesson keep-the-whole-class-of-a-condition-when-a-pass-co-locates-it covers a co-location pass, and the plan's lesson set of Task 1 did not carry it; whether it applies to a new text that restates a sibling section is uncertain.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "d77cad6",
      "brief": "Plan of #338, Task 1, **Lesson rules:** lists nine lessons; keep-the-whole-class-of-a-condition-when-a-pass-co-locates-it is not among them.",
      "lesson": {
        "name": "keep-the-whole-class-of-a-condition-when-a-pass-co-locates-it",
        "revision": "ba0de65",
        "digest": "c27a36c0265f5d3b13bd18ee728dae198bd62d0029f0efaa8cfd935edf324383"
      }
    },
    {
      "id": "9c1d3e52-264-t6-brief",
      "date": "2026-11-09",
      "action": "The coordinator's round-1 fix brief asked for a pointer in step-prompt.md rule 1 to stop.md, \"The act that moves the line\", and added a parenthetical paraphrase: \"each other act of the skill and each act of the custom text of the entry comes before the act that moves the line\". The fixer wrote that paraphrase after the pointer.",
      "expected": "A pointer to a shared rule names the section and restates no part of it, or names each case of it, so the exception (an act that the skill names after the act, for example a worktree removal or the report) stays reachable for its callers (specify, feature, epic.md, effort.md).",
      "observed": "The scoped re-review flagged the new clause as Important: it drops bullet 3 (the exception) and bullet 1 of the cited section, so a reader of only the step text takes it as unconditional. Round 2 replaced it with the pointer only (commit 0aa102b); the re-review of round 1 covered commits 7a154d4..62085e0.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Important: the pointer clause in plugins/celetis/step-prompt.md rule 1 restates the rule and drops its exception. ... It contradicts bullet 3 and the skills that rely on it.",
        "reference": "https://github.com/ddinkov10/celetis/issues/264"
      },
      "inference": "The coordinator paraphrased the rule to make the brief self-explaining; the paraphrase covered only the case that the coordinator had in mind. The carried lesson scope-shared-prohibitions-against-required-callers was in the brief of the task but the coordinator applied it to the fixer's work, not to its own brief text. Alternative: the fixer could have checked the paraphrase against the cited section.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "62085e0",
      "brief": "Fix: in step-prompt.md, rule 1 ..., add a pointer clause that orders the acts of the turn by <plugin>/docs/procedures/stop.md, \"The act that moves the line\" (each other act of the skill and each act of the custom text of the entry comes before the act that moves the line).",
      "lesson": {
        "name": "scope-shared-prohibitions-against-required-callers",
        "revision": "d3779b1",
        "digest": "e6676436893dd32ffceccdc3e6eacb520ed01bf05dda9cc9562dc1e3ba171918"
      }
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "30f8d23d-b67c-4a9d-a718-10e790b40269",
      "requestDigest": "ff8d429d1708654567072527aa8d679598f28c2266c69f3963f6f6e3f87d144f",
      "date": "2026-11-09",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #264; claude child opus/high\n\nApprove: the proposal has observed tool-output evidence (the Important finding of the scoped re-review and the round-2 commit 0aa102b), and its rule states applicability, action, and check. The cited section (plugins/celetis/docs/procedures/stop.md, The act that moves the line) holds the exception bullet that the paraphrase dropped. No rule rejects it: it widens no permission, weakens no check, and agrees with the placement rule of AGENTS.md that a citer leaves the rule body in its file. The related lesson scope-shared-prohibitions-against-required-callers lists the callers of a shared rule; this proposal governs the words after a pointer, a different rule, and no live or historical lesson holds its incident.",
      "related": [
        "a-pointer-to-a-shared-rule-restates-no-part-of-it"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal proposes no structural check: whether words after a pointer restate a rule is a judgment of meaning that the gate cannot decide."
      }
    },
    {
      "id": "a66f8ce3-3658-4caa-aa55-66174abd92e8",
      "requestDigest": "f995f274275d988b379e71d88a9772f1eff845fa5ca5c5ffe39a38f11c302c8b",
      "date": "2026-11-19",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #332; claude child opus/high\n\nMerge (reviewer rules: merge a proposal into an active lesson that states the same rule). The proposal has observed tool-output evidence: V6 on Codex recorded the searched topics and the errors ENOTFOUND and ENOTCACHED, and no line \"web guidance: modern-web-guidance is not available\". Its rule (name the defined state and cite its section, do not restate it by one cause) is the rule of the active lesson a-pointer-to-a-shared-rule-restates-no-part-of-it (write the pointer alone, or list each case of the cited section): in both, words that refer to another section restate one case of it and drop the others. The survivor keeps the name of the active lesson and both incidents; its Applies-when now also covers a reference to a state that another section defines with several causes, and its Check adds the reading case for each cause from the proposal. The inferred causes stay labeled apart from the facts. keep-the-whole-class-of-a-condition-when-a-pass-co-locates-it governs a pass that merges copies of one rule, not a new reference, so it stays a separate related lesson. The merged rule widens no permission and weakens no check.",
      "related": [
        "name-the-defined-state-not-one-of-its-causes-in-a-record-rule",
        "a-pointer-to-a-shared-rule-restates-no-part-of-it"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Neither input proposes a structural check: whether words after a pointer restate a rule, or a phrase matches a defined state, is a judgment of meaning that the gate cannot decide; a reading case for each cause is the check."
      }
    }
  ]
}
---
# A pointer to a shared rule restates no part of it

## What happened

In Task 6 of #264, a coordinator fix brief asked for a pointer from `step-prompt.md` rule 1 to `stop.md`, "The act that moves the line", and added a paraphrase of the rule in parentheses. The fixer wrote the paraphrase into the step text. The paraphrase held only bullet 2 of the section. The scoped re-review found that it dropped the exception (an act that the skill names after the act) and the answer rule. A second fix round replaced it with the pointer alone.

In Task 1 of #338, the new module `web-guidance.md` defined "Unavailable" with three causes (the skill is missing, its launch fails, or npx fails). Its section "The record" referred to that state as "With no skill, it holds the one line of \"Unavailable\"". In Verify V6 on Codex, the skill was present and npx failed with no network; the session recorded the searched topics and the errors, with no fixed line. Fix 44c33b5 changed both record bullets to "When the skill is unavailable".

## Root cause

Inferred: the coordinator wrote a summary of the rule to make the brief clear, and the summary covered only the case in view. The lesson about shared rules and their required callers was in the task brief, but the coordinator did not apply it to its own brief text. Uncertain: the fixer could also have compared the paraphrase with the cited section.

Inferred for #338: the referring section restated the trigger of a defined state by its most common cause. A Claude reader on the base text still inferred the full state; a Codex reader followed the words. This lesson was not in the lesson set of the task; whether it would have prevented the restatement is uncertain.

## Fix

Proposed prevention, as text: a brief or an edit that adds a pointer to a shared rule or to a defined state asks for the pointer alone, or names the state. When words follow the pointer, compare them with each case of the cited section first. No structural check is proposed: whether words after a pointer restate a rule, or whether a phrase matches a defined state, is a judgment of meaning, which the gate cannot decide. A reading case for each cause of a referred state is the check.

## Rule

Applies when a brief, a ruling, or an edit adds a pointer to a section that holds a shared rule, or refers from one section to a state or a case that another section defines with several causes. Action: write the pointer alone (the path and the section name), or name the defined state and cite its section; never restate the rule or the state by one of its cases or causes; when the text must say more, list each case of the cited section, its exceptions included. Check: every word after the pointer maps to a case of the cited section, no case of the section is contradicted for a caller that relies on it, and for a referred state a reading case with each cause as the only input gives the act of the referring rule on each host.

## Related lessons

[[scope-shared-prohibitions-against-required-callers]]
[[keep-the-whole-class-of-a-condition-when-a-pass-co-locates-it]]
[[plan-condition-must-not-narrow-a-spec-rule]]
