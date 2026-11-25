---
{
  "schema": 1,
  "name": "plan-condition-must-not-narrow-a-spec-rule",
  "description": "A plan, a repair ruling, a fix brief, or a design-review refine fix changed a spec rule or its scope with no maintainer decision, and the build dropped a required case",
  "tags": [
    "process",
    "ui",
    "recurring",
    "false-negative"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "implement session of #381 (coordinator), claude\n\nThe implement session of #311 on Claude Code, task review of Task 11 (the design review), 2026-11-14\n\nTask 4 of ddinkov10/celetis#269 (implement step, subagent flow), controller Ruling 6 and its correction Ruling 7\n\nFinal fix wave of ddinkov10/celetis#263\n\nFinal review of ddinkov10/celetis#250, implement step session (coordinator incident)\n\nTask 3 review of #182 (ddinkov10/celetis), controller-confirmed reproduction",
  "incidents": [
    {
      "id": "381-plan-narrowing",
      "date": "2026-11-25",
      "action": "The plan of #381 changed two spec rules. (1) The spec, \"The label and the act\", says the act \"can run at any time before the landing\" and \"The card menu of such an issue has Hold landing\". Plan Task 4 said \"Each issue card gets `hold: issue.holdable && isOpen`\". (2) The spec, \"Required behavior\", says \"A running action shows its progress in words, is announced, and takes no second press\". Plan Task 5 gave only Land a running state. Each task built its plan text.",
      "expected": "Each card that the spec rule covers has the entry, and each act of the spec rule has a running state: progress in words, an announcement, and no second press.",
      "observed": "Task 4 review, demonstrated with place(): a running implement session gave a card with no hold, and noRun set gave hold:false. Final review, demonstrated in Chromium with the Discard POST held 4 s: both buttons kept aria-disabled null, no live text, and the page sent [\"discard\",\"land\",\"discard\"].",
      "source": {
        "kind": "tool-output",
        "excerpt": "place(): running implement session -> card with no `hold`; noRun set -> hold:false. Chromium, Discard POST held 4 s: aria-disabled null on both buttons, no live text, sent [\"discard\",\"land\",\"discard\"]."
      },
      "inference": "Inferred, not established: the plan stated each rule from the card or the act that the author had in mind (an open issue card, Land) and did not list each card state and each act that the spec rule names. The planning transcript was not read. Alternative: the plan review read \"each issue card\" and \"a running action\" as the common case.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "126b556, bb0844f",
      "brief": "Each affected task brief of the plan carried the lesson plan-condition-must-not-narrow-a-spec-rule (digest 905deb76...). Its Action says: quote each affected spec rule, name every mode, caller, or entry point that it covers, and add a probe case for each mode that the change can exclude.",
      "lesson": {
        "name": "plan-condition-must-not-narrow-a-spec-rule",
        "revision": "2026-11-14",
        "digest": "905deb763acf60691d624f607a05a21198b6c06e24a725273aaabf5eae1b9f1b"
      }
    },
    {
      "id": "73e2a03a-42f0-4b61-9d2c-e15913e93006",
      "date": "2026-11-14",
      "action": "Task 11 of #311 (the design review) changed engine/board/page/panel.ts so that a done lane step shows no gate label (`step.state !== 'done' && gateOf(flow, step.name) === 'auto' ? gateLabel(auto) : el('span')`), as a refine fix for a repeated `auto off`.",
      "expected": "Spec of #311, B3, G3 A: the gate label of each ready card and of the lane steps in the details reads `auto off` while auto mode is off or stops, and stays the green `auto` while it is on; no maintainer decision narrows it.",
      "observed": "The task reviewer's probe: base 522d414 with auto on shows `auto` on done steps; head 74d44b7 shows none in either mode. The fix bbcc54e restored the Task 3 line.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Base, auto on: the done steps show `auto`. Lane head, auto on: the done steps show nothing. Auto off: only `now` and `next` steps show `auto off`.",
        "reference": "https://github.com/ddinkov10/celetis/issues/311 (commits 74d44b7 and bbcc54e)"
      },
      "inference": "The plan's lesson rules for Task 11 named preserve-the-requested-ui-container-during-design, check-visible-surfaces-before-composing-browser-probes, and give-browser-tool-output-files-a-path-outside-the-lane, not plan-condition-must-not-narrow-a-spec-rule, although a refine fix can narrow a spec rule like a plan condition. Alternative: the design-review procedure's rule 'keep the direction' was read as permission for any change that keeps the look.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "74d44b7",
      "brief": "Plan of #311, Task 11 'Lesson rules': preserve-the-requested-ui-container-during-design, check-visible-surfaces-before-composing-browser-probes, give-browser-tool-output-files-a-path-outside-the-lane (https://github.com/ddinkov10/celetis/issues/311, the ## Plan comment 6861255296)",
      "lesson": {
        "name": "plan-condition-must-not-narrow-a-spec-rule",
        "revision": "522d414",
        "digest": "4ae38f3cabfddef721d74bcfb78b066f1c319f1ee2ffde03e17e30c5f2565811"
      }
    },
    {
      "id": "9e4a15f4-71c6-45c5-ab17-6f5a62d266ce",
      "date": "2026-11-09",
      "action": "The task review of Task 4 showed that the new read-side import check of scripts/verify.ts refused a type query typeof import('../lib/git.ts'). The controller ruled (Ruling 6) that an import( whose previous token is typeof passes, and sent that ruling to the fixer.",
      "expected": "The approved spec keeps type-only imports allowed and, by maintainer decision Q2, refuses each value import of the nine engine-state modules. A ruling that changes what the check passes covers only the type-position form, or records a maintainer decision for each other form that it passes.",
      "observed": "The round-1 fix (b45ab7f) followed the ruling. Its scoped re-review reported that const t = typeof import('../lib/git.ts'); also passes, and that this expression loads the module at run time. The ruling had excluded that value form from Q2 with no maintainer decision. The controller corrected it (Ruling 7), and round 2 (2b98533) refuses the expression forms, decided by what Bun.Transpiler scanImports keeps.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Re-review of fix round 1: The input `const t = typeof import('../lib/git.ts');` gives `[]`. ... The expression `typeof import('x')` loads the module at run time, but the check passes it. Q2 refuses each value import.",
        "reference": "https://github.com/ddinkov10/celetis/issues/269"
      },
      "inference": "Inferred: the ruling was written from the failing input (a type query) and named the token pattern of that input, not each mode that the pattern matches; the same token pattern occurs in an expression position. The carried lesson rule asks for a probe case of each mode that the change can exclude, and the ruling listed none for the expression form. Uncertain: the ruling was written under time pressure inside a review loop; an alternative cause is that the expression form looked absurd enough to ignore.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "b45ab7f",
      "brief": "The round-1 fix brief (task-4-findings.md of the lane workspace) carried the rule plan-condition-must-not-narrow-a-spec-rule and stated the limit 'an expression typeof import(...) (which loads the module at runtime) also passes' as accepted, with no maintainer decision.",
      "lesson": {
        "name": "plan-condition-must-not-narrow-a-spec-rule",
        "revision": "3915b5e",
        "digest": "32f8889f787aa09d910ce438014c6beb26c96e7d345a26a6f2277e15303bd898"
      }
    },
    {
      "id": "26847cec-9749-4680-8b28-da22097f7a17",
      "date": "2026-11-09",
      "action": "The #263 build controller accepted a Minor final-review finding (the `branchForm` lookbehind of scripts/verify.ts refuses `docs/feat/12-x.md`) and wrote in the fix brief: 'add `/` to the lookbehind (so a path segment passes)'. The fixer did it in commit c8b7669.",
      "expected": "A repair ruling that changes a spec rule keeps the rule (spec Design 6: 'a prefix of `lanes`, or a `|`-list of them, followed by `/<` or `/` and a digit'; only `prototype/<n>-*` passes), or records a maintainer decision; the observed false refusal becomes a stated limit.",
      "observed": "The fixer's probe gate-probe-final.ts showed that `refs/heads/feat/12-x` (case B2) and `origin/feat/12-x` (case B6) pass after c8b7669; the fixer reported that the change narrows the spec rule and needs a maintainer decision.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Concern: the `/` lookbehind that the brief asked for (F4) narrows the spec rule. A full ref or a remote ref of a lane branch now passes: refs/heads/feat/12-x (B2) and origin/feat/12-x (B6).",
        "reference": "ddinkov10/celetis#263, final fix wave, commit c8b7669"
      },
      "inference": "The controller weighed the finding by the false refusal that the reviewer showed, and did not quote the spec rule in the brief before it changed the rule's scope. The lesson was in the final lesson set that the controller built (final-lessons.md). Alternative: the controller read 'path segment' as outside 'a lane branch form'; the spec text does not support that reading.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "c8b7669",
      "brief": ".superpowers/sdd/263/final-fix-brief.md, F4 (workspace of the #263 build)",
      "lesson": {
        "name": "plan-condition-must-not-narrow-a-spec-rule",
        "revision": "d480bc1",
        "digest": "72422c20316c2a88ffee6b2046abbd80be920c5fffbe94effc5892ff7b03e201"
      }
    },
    {
      "id": "eb9f3f71-4777-471e-affb-ba3a6017407c",
      "date": "2026-11-07",
      "action": "After the Task 3 review, the coordinator ruled that an automatic open of the board's update dialog keeps the focus where it is, and that Escape with the focus inside the dialog still closes it. The fix (88c9a37) followed the ruling. The coordinator did not list the other required behaviors of the same dialog against the new open mode.",
      "expected": "The spec rule \"The dialog is nonmodal, Escape closes it, and focus returns to the control\" keeps holding for each open mode, or a maintainer decision records a narrower rule.",
      "observed": "The final review reproduced it on 7e5b20b, and the coordinator reran it: after the automatic open {\"open\":true,\"active\":\"BODY\"}; after Escape {\"open\":true,\"active\":\"BODY\"}. Escape closed the dialog only with the focus inside it.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Playwright Chromium 1440x900 on the mock fr-mock/mock.ts (sha256 147c8af5...): after load {\"open\":true,\"active\":\"BODY\"}; after Escape with the focus on the body {\"open\":true,\"active\":\"BODY\"}",
        "reference": "Final review report and runtime report of ddinkov10/celetis#250"
      },
      "inference": "Inferred by the coordinator: the ruling resolved one required behavior (no focus move) and took the Escape behavior as unchanged, because the old automatic open put the focus inside the dialog, where the dialog's own Escape handler works. The ruling text even said \"Escape with the focus inside the dialog\", which narrowed the rule. Uncertain whether a listing step would have been done under time pressure.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "88c9a37",
      "brief": "The Task 3 brief and its repair message carried plan-condition-must-not-narrow-a-spec-rule (sha256:6b5368a1...) with its rule (.superpowers/sdd/250/task-3-brief.md, Lesson rules).",
      "lesson": {
        "name": "plan-condition-must-not-narrow-a-spec-rule",
        "revision": "b1c4a621bcd19a32f8badacd3515a039e560d318",
        "digest": "6b5368a17a703d36bc27ed4fec41be2639d8729dab5cf59ba93344b624e82786"
      }
    },
    {
      "id": "5b1f0c2e-8a47-4d1e-9c3a-2f6e7d81a4b9",
      "date": "2026-11-02",
      "action": "The #182 plan (Task 3, 'The session rule') required a link label for a runner foreground: 'a runner (an element whose basename is celetis-flow.ts) while labels[LINK] is set'. The implementer built it as specified (engine/board/place.ts:19, commit fc1460b).",
      "expected": "The spec rule ('The board -> Sessions') accepts 'a Celetis command that runs the host in the foreground (the runner celetis-flow.ts ...)' with no label condition; Acceptance 6 wants a card for each hc terminal of the repository.",
      "observed": "A hand-run `celetis-flow --resume <n>` sets no link label (resume mode is not managed, engine/celetis-flow.ts:663), so its terminal got no card at all.",
      "source": {
        "kind": "tool-output",
        "excerpt": "rv3/r3b.ts on fc1460b: 'hand-run resume, no link label: []' and 'board Resume, link #7 plan: [[\"t5\",7,\"blocked\"]]'; fixed in 6506cd7 (runner with --resume accepted).",
        "reference": "ddinkov10/celetis#182, commits fc1460b and 6506cd7"
      },
      "inference": "Inferred: the planner added the label condition to hide a stale status between two runner steps, and checked it only against the step runner, not against every runner mode (resume). Alternative: the spec's own 'stale done' risk pushed the planner to narrow the rule. The plan review did not compare the condition with the spec's rule text.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "fc1460b"
    },
    {
      "id": "c3d9a6e1-4f2b-4b7a-9e15-7a8d2c64f0b3",
      "date": "2026-11-02",
      "action": "The #232 plan (Risks and decision points, 'The empty space') replaced the spec's close rule 'or when the runner ends' with 'when that issue run ends', and Task 3 built it (engine/celetis-flow.ts: runIssue's finally calls closeTabs, which closes the pending normal-end tab).",
      "expected": "The #232 spec, 'Left to the builder': 'If the app removes an empty space, the runner closes the tab of a normal end only after the next session tab of the same start is open, or when the runner ends.'",
      "observed": "Verify V1 on 44d1e65 (target: clone at 94b60b8 plus the lane diff, tree cdd61616): after #1 closed and its last tab closed, herdr-app ls listed the space celetis-v232-6a5c47 only under 'recent', so the app removes an empty space. With the per-issue-run close, a queue or automatic runner closes the last tab of one issue, the space goes, and the next issue makes the space again and shows it.",
      "source": {
        "kind": "tool-output",
        "excerpt": "V1-after-close snapshot 2026-11-02T21:23:52Z: spaces with name celetis-v232-*: []; herdr-app ls 'recent': {\"name\": \"celetis-v232-6a5c47\"}. Task 3 review M3: 'deferred close per runIssue, not per start (plan-mandated; depends on V1 empty-space fact)'.",
        "reference": "ddinkov10/celetis#232, Verify V1, fix task verify-1"
      },
      "inference": "Inferred: the planner narrowed the spec's 'when the runner ends' so that a finished tab does not stay open while an automatic runner waits, and kept the code independent of the unknown empty-space fact. The plan review and the final review flagged the difference only as conditional on the fact. Alternative: the planner read 'the same start' as one issue run.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "44d1e65"
    }
  ],
  "recurrences": 6,
  "reviews": [
    {
      "id": "8385ab4c-cffb-479f-9c23-69fddfe2c2e9",
      "requestDigest": "743280b23254656eae27accb9611cb56dc8e37010b510dba9da2cf91d7966b5d",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #236; codex child host default/high\n\nApprove under the reviewer rules: two retained incidents show a specification rule narrowed by the plan, and the causes remain marked as inference. The rule gives scope, action, and a check against the approved source or a recorded decision. It agrees with the current acceptance coverage procedure. Its proposed structural follow-up remains proposed.",
      "related": [
        "plan-condition-must-not-narrow-a-spec-rule"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Consider a separate instruction change that compares each plan rule with its specification source during the existing acceptance coverage review. This review does not authorize that change."
      }
    },
    {
      "id": "84bd20e4-e857-408a-b446-3987a7fe5fd0",
      "requestDigest": "1434c2263251b770f6624dddca729679b27e7ad13325006f968ee93ada4fa244",
      "date": "2026-11-07",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #250; claude child opus/high\n\nMerge under the reviewer rules: the active lesson plan-condition-must-not-narrow-a-spec-rule states the same rule, and the proposal names it as the lesson that its incident did not follow. The incident is observed: the repair message .superpowers/sdd/250/t3-fix1-message.txt of the lane holds the ruling \"Escape with the focus inside the dialog still closes it\", the plan context of #250 holds the spec rule \"the dialog is nonmodal, Escape closes it, focus returns to the control\", and the final review retains the Playwright output {\"open\":true,\"active\":\"BODY\"} after Escape. A repair ruling is a task brief that added a condition to a spec rule, so the active rule applies. The survivor keeps the active name and every incident and review, widens the applicability to repair briefs and review rulings, and adds the list of the sibling spec rules of the changed element, which the proposal adds. The cause stays labeled as the inference of the coordinator. The rule adds a check, weakens none, and agrees with the preserve-intended-behavior principle of the plugin celetis: an agent ruling cannot supersede a requirement.",
      "related": [
        "check-sibling-required-behaviors-before-a-repair-ruling",
        "plan-condition-must-not-narrow-a-spec-rule"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The earlier proposed follow-up stays open and now covers repair rulings too: the existing reviews compare each rule of a plan, a task brief, or a repair ruling that restates the spec with its source text, and with the other spec rules of the same element. It needs separate authorization; this review changes no skill or procedure."
      }
    },
    {
      "id": "42131cf2-9c63-43ac-82d9-f2ffda474ed3",
      "requestDigest": "9159881c3df144db6ec78ecc729796dcd6d40952aa8a459bb432d84de986a954",
      "date": "2026-11-09",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #263; claude child opus/high\n\nMerge under the reviewer rules: the active lesson plan-condition-must-not-narrow-a-spec-rule states the same rule, and the proposal names it as the lesson that its incident did not follow. The incident is observed: commit c8b7669 of the lane adds `/` to the `branchForm` lookbehind with the message that `refs/heads/feat/12-x` now passes, and commit ccf66cd restores the lookbehind \"as the spec rule of the restatement check of `checkContract` says\". A fix brief that changes what a check passes is a repair brief that narrows the scope of a spec rule, so the active rule applies. The survivor keeps the active name and every incident and review, adds the incident, names a fix brief and a change of what a check refuses or passes in the applicability, and adds the probe-case check of the proposal. The cause stays labeled as inference. The rule adds a check, weakens none, and agrees with the acceptance coverage procedure of the plugin celetis: a repair brief cannot silently weaken an approved outcome.",
      "related": [
        "check-a-review-fix-against-the-spec-rule-before-the-brief",
        "plan-condition-must-not-narrow-a-spec-rule"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The earlier proposed follow-up stays open and now covers fix briefs too: the existing reviews compare each rule of a plan, a task brief, a repair ruling, or a fix brief that restates the spec with its source text. It needs separate authorization; this review changes no skill or procedure."
      }
    },
    {
      "id": "d563972a-cbc0-4d4e-9f23-2a202672ba15",
      "requestDigest": "4b1a396e4ad5a2b4a3e81fecb02d1857a0cdc7c35311d1e6f40b3dca2cbbe81b",
      "date": "2026-11-09",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #264; claude child opus/high\n\nMerge: the proposal states the same rule as the active lesson plan-condition-must-not-narrow-a-spec-rule (a fix brief or a ruling that changes what a check passes quotes the spec rule and gives each mode a probe case with its spec result; a refused form needs a maintainer decision). Its incident was not-followed with that lesson in the brief, so it is a recurrence. The survivor keeps every incident and review of both inputs, and its text adds the #269 incident and the mode list of a new pass condition.",
      "related": [
        "a-repair-ruling-that-widens-a-pass-lists-each-mode-it-passes",
        "plan-condition-must-not-narrow-a-spec-rule"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "This merge adds no structural follow-up. The proposed follow-up in the Fix of the survivor stays proposed and needs separate authorization."
      }
    },
    {
      "id": "9b22976b-b5af-4cb4-8064-e64e35e1c9d4",
      "requestDigest": "e004f754276b0588551b5ae16dcf5af6133e6f4891d06148952fd6fb8c862b5e",
      "date": "2026-11-14",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #311; claude child opus/high\n\nMerge under the reviewer rules: the active lesson plan-condition-must-not-narrow-a-spec-rule states the same rule (a change that narrows a spec rule quotes it, probes each mode, and needs a maintainer decision), and the proposal names it as the lesson that its incident did not retrieve. The incident is observed: commit bbcc54e of the lane restores the gate label of done lane steps that the design-review fix of Task 11 hid, against spec rule B3 of #311. A refine fix of a design review that hides a spec-named label narrows a spec rule like a plan condition, so the survivor keeps the active name and every incident and review, widens the applicability to a refine fix, adds the base-and-head probe check of the proposal, and keeps the cause labeled as inference. Keeping a separate design-review lesson would leave two active lessons with one rule. The rule adds a check, weakens none, and agrees with the design review of the plugin celetis, which keeps the direction and reports each finding that needs a new look.",
      "related": [
        "carry-the-spec-narrowing-rule-into-a-design-review",
        "plan-condition-must-not-narrow-a-spec-rule"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The earlier proposed follow-up stays open. A second one is added: the plan skill carries plan-condition-must-not-narrow-a-spec-rule into the lesson rules of each design-review task, and its check is a plan whose design-review task lacks it (owner: the plugin celetis). Both need separate authorization; this review changes no skill or procedure."
      }
    },
    {
      "id": "ab418bfb-adc2-4972-9747-8df2d6f00ebd",
      "requestDigest": "8b7db6032060819cf758fda4899d942dfc189f1fcae41afba420a86b10534fdc",
      "date": "2026-11-25",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #381; claude child opus/high\n\nMerge (reviewer rules): the proposal states the same rule as the active lesson plan-condition-must-not-narrow-a-spec-rule. That rule already covers a plan that changes a spec rule by an added condition or a removed case, and tells the author to name every mode, caller, or entry point that the rule covers. The incident records that the briefs carried that lesson (diagnosis not-followed). The proposal has observed tool-output evidence (place() probes and a Chromium probe of a held Discard POST), and no live or historical lesson holds its incident. The survivor keeps every incident and prior review, and its rule now names card states, acts, and each member of a set explicitly. The inferred cause stays labeled apart from the facts. The rule widens no permission and weakens no check.",
      "related": [
        "a-plan-task-covers-each-card-and-each-action-that-a-spec-rule-names",
        "plan-condition-must-not-narrow-a-spec-rule"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up, which needs separate authorization: the acceptance coverage review of the plan step lists each member of a set that a spec rule names (each card state, each act) and compares each member with a task step and a probe case. A check that would reject this incident is a plan review that finds no step for the running state of Discard.",
        "owner": "the plugin celetis"
      }
    }
  ]
}
---
# A plan, a repair ruling, a fix brief, or a refine fix must not change a spec rule or its scope without a maintainer decision

## What happened

Seven incidents. In #182, the plan added a link-label condition to the spec's session rule for a
runner foreground. The build followed the plan. A hand-run `celetis-flow --resume <n>` sets no
link label, so its terminal got no board card. The Task 3 review reproduced it at the
`sessionsOf` boundary (`hand-run resume, no link label: []`), and fix 6506cd7 also accepts a
runner with `--resume`.

In #232, the spec said that, when the Herdr app removes an empty space, the runner closes the tab
of a normal end only after the next session tab of the same start is open, or when the runner
ends. The plan replaced "when the runner ends" with "when that issue run ends", and the build
followed it. Verify V1 then showed that the app removes an empty space, so the build missed the
spec rule for a start with more than one issue (a board Queue or the automatic runner).

In #250, a task review found that an automatic open of the board's update dialog moved the
keyboard focus, against the spec rule that the polite status region announces each state change
with no focus move. The coordinator's repair ruling kept the focus in place for each automatic
open, and said that Escape "with the focus inside the dialog" still closes it. The fix (88c9a37)
followed the ruling. The final review then showed (Playwright Chromium on a mock server) that
after an automatic open the dialog stayed open on Escape with the focus on the body:
`{"open":true,"active":"BODY"}`. The only Escape handlers were on the dialog, and the focus was
outside it. The spec says "The dialog is nonmodal, Escape closes it, and focus returns to the
control", and no maintainer decision narrowed that rule. The task briefs and the repair message
carried this lesson. The final fix wave (007e845) closes the dialog on Escape from anywhere.

In #263, the controller accepted a Minor final-review finding that the new `branchForm` check of
`scripts/verify.ts` refuses a path such as `docs/feat/12-x.md`. The fix brief told the fixer to
add `/` to the lookbehind so that a path segment passes, and commit c8b7669 did it. The fixer's
probe then showed that `refs/heads/feat/12-x` and `origin/feat/12-x` pass too, against the spec
rule of the check, and the fixer reported that the change narrows the spec rule. Commit ccf66cd
restored the lookbehind and stated the false refusal as an observed limit. The controller's
final lesson set held this lesson.

In #269, a task review of Task 4 showed that the new read-side import check of
`scripts/verify.ts` refused a type query `typeof import('../lib/git.ts')`, which the spec allows.
The controller ruled (Ruling 6) that an `import(` whose previous token is `typeof` passes, and the
round-1 fix (b45ab7f) followed it. The fix brief carried this lesson and recorded "an expression
typeof import(...) (which loads the module at runtime) also passes" as an accepted limit, with no
maintainer decision. The scoped re-review reported that `const t = typeof import('../lib/git.ts');`
passes and loads the module at run time, while maintainer decision Q2 refuses each value import.
The controller corrected the ruling (Ruling 7), and round 2 (2b98533) refuses the expression forms
by what `Bun.Transpiler` `scanImports` keeps.

In #311, the design review (Task 11) fixed a refine finding about a repeated `auto off` by hiding
the gate label of done lane steps in `engine/board/page/panel.ts`. Spec rule B3 of #311 requires
the gate label on the lane steps in the details in both auto modes, and no maintainer decision
narrowed it. The task reviewer compared the base and the head in a browser: on the base with auto
on, the done steps show `auto`; on the head, they show nothing in either mode. Fix bbcc54e restored
the earlier line. The lesson rules of Task 11 in the plan did not name this lesson.

In #381, the plan narrowed two spec rules, and each task built the narrowed rule. The spec says
that the hold act "can run at any time before the landing" and that the card menu of such an
issue has Hold landing. Plan Task 4 said "Each issue card gets `hold: issue.holdable && isOpen`".
The Task 4 review showed with `place()` that a running implement session gave a card with no
`hold`, and that `noRun` gave `hold:false`. The spec also says that a running action shows its
progress in words, is announced, and takes no second press. Plan Task 5 gave only Land a running
state. The final review held the Discard POST for 4 s in Chromium: both buttons kept
`aria-disabled` null, there was no live text, and the page sent `["discard","land","discard"]`.
Fixes: 126b556 and bb0844f. Each affected task brief carried this lesson.

## Root cause

Inferred, not established: in #182 the condition was added to hold out a stale status between two
runner steps, and was checked only against the step runner. In #232 the plan narrowed the rule so
that a finished tab does not stay open while an automatic runner waits. In both cases the plan
review did not hold the plan text to the spec rule text, and the change got no maintainer
decision. The planning transcripts were not read.

In #250, observed: the old automatic open put the focus inside the dialog, so the dialog's own
Escape handler covered every open. Inferred by the coordinator: the ruling resolved one required
behavior (no focus move) and did not check the other spec rules of the same dialog against the new
open mode; its wording narrowed the Escape rule. The lesson was in context, so this is a
recurrence of a rule that was not followed. Uncertain: whether a listing step would have been done
under time pressure.

In #263, inferred: the controller weighed the fix by the false refusal that the reviewer showed,
and did not quote the spec rule of the check in the brief before the fix changed what the check
passes. The lesson was in the controller's lesson set, so this is a further recurrence of a rule
that was not followed. Alternative: the controller read a path segment as outside a lane branch
form; the spec text does not support that reading.

In #269, inferred: the ruling named the token pattern of the failing input, not each mode that the
pattern matches; the same tokens also occur in an expression position. The brief carried this
lesson, so this is a further recurrence of a rule that was not followed. Uncertain: the expression
form looked too rare to matter, and the ruling was written inside a review loop.

In #311, observed: the plan's lesson rules for the design-review task named three other lessons and
not this one. Inferred: a refine fix of a design review can narrow a spec rule like a plan
condition, but the earlier applicability named only plans, briefs, and rulings, so the lesson was
not retrieved for the refine work. Uncertain alternative: "refinement preserves" of the design
review was read as "keeps the look", not "keeps every spec rule".

In #381, observed: the task briefs carried this lesson, and the plan text still added a condition
(`&& isOpen`) and left out a member of the set (Discard). So this is a further recurrence of a
rule that was not followed. Inferred, not established: the plan stated each rule from the card or
the act that the author had in mind (an open issue card, Land), and did not list each card state
(running, `noRun`) or each act (Land and Discard) that the rule names. Uncertain: the planning
transcript was not read. Alternative: a plan author can read "each issue card" and "a running
action" as the common case, and the rule text gives no listing step for a member that is left
out with no added condition.

## Fix

Proposed prevention (text, not enforced): when a plan states a rule that the spec states, quote
the spec rule, and mark each difference (an added condition, a removed case, a changed scope) as
a decision that the maintainer records before the build. List each mode or caller that the rule
covers (for the runner: numbered, automatic, queue, resume) and check the plan rule against each
one in a probe. When the spec rule names a set ("each issue card", "a running action"), list each
member of the set (each card state, each act) under the rule, with the task step and the probe case
of each member.

A repair ruling or a repair brief that changes how an element or an operation behaves in one mode
can narrow another spec rule of the same element without naming it. So, before the ruling, list
each spec rule of that element (for the dialog: no focus move, Escape closes it, focus returns to
the control), state how the new mode keeps each one, and give each rule that the new mode can
lose a probe case or a maintainer decision.

A fix brief that changes what a check refuses or passes, also to remove a false result that a
reviewer showed, quotes the spec rule of that check next to the finding and names each case that
the fix moves from refused to passed, or the reverse. A false result that the spec rule itself
produces becomes a stated limit, or goes to the maintainer for a decision. When the fix makes the
check pass a pattern, the brief lists each mode that the pattern matches (for example each
syntactic position of the same tokens), not only the mode of the failing input. A form that the
spec refuses is never an accepted limit of the fix without a recorded maintainer decision.

A refine fix of a design review, or of another refine pass, that removes, hides, or limits an
element, a label, or a state that the approved spec names, quotes the spec rule of that element
before the fix. It keeps the fix only when the spec allows the narrower form or a maintainer
decision records it; else it reports the finding as one that needs a new look.

This depends on judgment about which modes and rules exist and which wording is a change, so it
stays a text rule; a structural check would need a machine-readable spec rule, which the project
does not have. A proposed follow-up, which needs separate authorization: the acceptance coverage
review of the plan step compares each plan rule that quotes the spec with its source text. A second
proposed follow-up, which also needs separate authorization (owner: the plugin `celetis`): the plan
skill carries this lesson into the lesson rules of each design-review task; its check is a plan
whose design-review task lacks it.

## Detection signature

A plan sentence that adds `while`, `only when`, or `and` to a rule quoted from the spec, or
replaces a scope word of the spec ("the runner", "the same start") with a narrower one, with a
probe or a Verify scenario that covers fewer modes than the spec rule names. A ruling that changes
how an element opens, takes the focus, or stops, and restates another rule of that element with a
new condition ("with the focus inside the dialog"). A fix brief that widens a pattern of a check
("add `/` to the lookbehind so that a path segment passes") with no quote of the spec rule of
that check. A ruling or a fix brief that states a new pass condition and records a form that the
spec refuses as an accepted limit. A refine fix whose diff adds a condition that hides or drops a
spec-named label or element (for example `step.state !== 'done' && ...`), and a base-and-head
probe in which that element shows on the base and not on the head. A plan task that adds a
condition to a set that the spec names ("each issue card" built as `hold: issue.holdable && isOpen`),
or that gives a state to one act of a set ("a running action" built for Land only).

## Rule

Applies when a plan, a task brief, a repair brief, a fix brief, a review ruling, or a refine fix of
a design review or of another refine pass changes a rule
that the approved spec states (an added condition, a removed case, a narrower scope, or a change of
what a check refuses or passes), or changes a mode of an element or an operation that other spec
rules of that element cover (for example how a dialog opens, or when a process stops). Action: quote each affected spec rule, including each
other rule of the same element that the changed mode can reach; name every mode, caller, entry
point, card state, or act that it covers, also each member of a set that the rule names ("each
issue card", "a running action"), and each mode that a new pass condition matches; and add a probe case for
each mode that the change can exclude or newly pass. Check: each
excluded mode is one that the spec excludes too, or the plan or the ruling records a maintainer
decision for it; a repair brief names each sibling rule with its case, and the repair's probe runs
each case; each probe case that a fix moves from refused to passed, or the reverse, gets the same
result from the quoted spec rule; no form that the spec refuses passes as an accepted limit
without a recorded maintainer decision; after a refine fix, a probe of the reviewed state shows
each spec-named element in each mode of its spec rule, on the base and on the head, or the finding
goes to the report as one that needs a new look.
