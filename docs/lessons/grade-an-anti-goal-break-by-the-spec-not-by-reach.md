---
{
  "schema": 1,
  "name": "grade-an-anti-goal-break-by-the-spec-not-by-reach",
  "description": "A task controller deferred two findings as Minor because they were rare, though each broke a spec anti-goal that a carried lesson names",
  "tags": [
    "process",
    "regression"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#268",
  "incidents": [
    {
      "id": "e128ed40-c8f1-4d9e-9842-596c961059db",
      "date": "2026-11-09",
      "action": "In the task loop of #268, the controller accepted the Task 3 review (board agentCause maps every unsafe outcome, also I/O reasons, to the permissions line) and the Task 5 review (a tryFlock throw no longer maps to LessonError 6 'cannot acquire the lesson lock') as clean, and deferred both as Minor to the final review, because each path is rare.",
      "expected": "The spec of #268 lists as anti-goals 'a moved check that tests fewer states than its old copy' and 'a merged helper call that loses one of its effects'. A finding that a moved check accepts other states, or that a replaced helper call lost an effect, breaks an anti-goal, so the task fix loop handles it before close, whatever its reach.",
      "observed": "The final whole-branch review raised both again as findings against the anti-goals and the lessons keep-each-effect-of-a-removed-helper-call and a-moved-check-keeps-the-states-of-its-old-rule. A fault-injection probe showed the lost effect: 06b7536 printed 'lesson-store: <lock>: cannot acquire the lesson lock', 3ce9bb8 printed 'lesson-store: update: cannot acquire the plugin update lock (errno 22)', exit 6 on both. The one final fix wave (fcc75f5) restored both.",
      "source": {
        "kind": "tool-output",
        "excerpt": "06b7536: exit=6, stderr 'lesson-store: /tmp/celetis-501/lessons/<hash>.lock: cannot acquire the lesson lock'; 3ce9bb8: exit=6, stderr 'lesson-store: update: cannot acquire the plugin update lock (errno 22)'. Task 3 reviewer: 'maps every unsafe outcome to the permissions line ... unresolved risk ... plan-level' (Minor).",
        "reference": "https://github.com/ddinkov10/celetis/issues/268#issuecomment-6727974554"
      },
      "inference": "Inferred: the task reviewers graded by reach (rare race or errno path) and by the brief text, and the controller deferred Minor findings without checking them against the spec anti-goals. Alternative: the brief of Task 3 required the board mapping by kind, so part of the cause is a plan line that did not restate the old states. Uncertain which weighs more.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "3ce9bb8",
      "brief": ".superpowers/sdd/268/task-5-brief.md carried keep-each-effect-of-a-removed-helper-call; task-3-brief.md carried a-moved-check-keeps-the-states-of-its-old-rule",
      "lesson": {
        "name": "keep-each-effect-of-a-removed-helper-call",
        "revision": "46c687c",
        "digest": "8db46c0445bc5909d19e57be0dcea9bd4046a2653c2eaee983d6dabcf1428b2c"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "173d562a-19ea-4af7-9121-b5c3c656ab25",
      "requestDigest": "cc0b67e96e2632428064046df94902607fed050192ee3f1f4df1a93c8ae809ce",
      "date": "2026-11-09",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #268; claude child opus/high\n\nEdit, then promote, under the reviewer rules. The incident is observed: the retained probe excerpt gives exit 6 with the lesson lock line on 06b7536 and the plugin update lock line on 3ce9bb8, the progress ledger of #268 records the Task 3 and Task 5 items as deferred Minor findings, and the final review findings anchor F1 and F2 in spec anti-goals, fixed by fcc75f5. The rule states applicability, action, and check. No active lesson states it: keep-each-effect-of-a-removed-helper-call and a-moved-check-keeps-the-states-of-its-old-rule state the technical rules, and plan-condition-must-not-narrow-a-spec-rule covers a changed spec rule, not the grade of a deferred finding. Edit 1: the upstream task loop says that Minor findings never enter the fix loop, so the action now grades an anti-goal break a missed requirement (Important by the review calibration) by a recorded ruling, keeps the existing round limit, and sends an uncertain comparison to a maintainer decision as an unresolved material risk; this keeps the rule consistent with the skill and the review-evidence module, and it widens no permission and weakens no check. Edit 2, an attributed correction of the body only: 06b7536 is an older trunk commit, an ancestor of the base 46c687c, not the base; the final review still graded both findings Minor, and a controller ruling (R3) sent them to the fix wave. The incident evidence stays unchanged.",
      "related": [
        "grade-an-anti-goal-break-by-the-spec-not-by-reach"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Whether a finding breaks a spec anti-goal needs judgment, so no structural check is known; the ledger line that names the compared anti-goals stays the check of the rule."
      }
    }
  ]
}
---
# Grade an anti-goal break by the spec, not by its reach

## What happened

In the task loop of #268, two task reviews reported a lost state or a lost effect as Minor: the board mapped every `unsafe` outcome (also I/O reasons) to the permissions line, and a `tryFlock` throw lost the lesson lock line. The controller closed both tasks and recorded both items as deferred Minor findings for the final review; its ledger called the Task 3 item an unresolved risk and the Task 5 item a lost effect. The task briefs carried the lessons `a-moved-check-keeps-the-states-of-its-old-rule` and `keep-each-effect-of-a-removed-helper-call`. The final review raised both again, still graded Minor, and anchored each in a spec anti-goal; a controller ruling sent them to the one final fix wave, which restored them. A fault-injection probe showed the old lesson lock line on an older trunk commit (06b7536) and the plugin update lock line on the branch (3ce9bb8), with exit 6 on both.

## Root cause

Inferred: the reviewers graded by reach (a rare race or errno path), and the controller accepted the grade without checking the finding against the anti-goals of the spec. Alternative: the Task 3 brief required the mapping by kind and did not restate the old states, so the plan also invited the gap. The evidence does not settle which weighs more.

## Fix

Proposed, not enforced: before the controller accepts a deferred Minor finding, it compares the finding with each anti-goal and goal of the spec. A finding that breaks one is a missed requirement, which the review calibration grades Important, so the controller records that ruling and the finding enters the task fix loop under its existing round limit. This stays text, because whether a finding breaks an anti-goal needs judgment.

## Rule

Applies when a task review grades a finding Minor or defers it, and the spec lists anti-goals or goals (for example "a moved check keeps every state", "a merged helper call keeps each effect"). Action: compare the finding with each anti-goal and goal; when it breaks one, record a ruling that grades it a missed requirement (Important), whatever its reach, and send it through the task fix loop before close; when the comparison stays uncertain, carry it as an unresolved material risk for a maintainer decision. Check: each deferred finding of the ledger names the anti-goals it was compared with, and none of them breaks one.

## Related lessons

[[keep-each-effect-of-a-removed-helper-call]]
[[a-moved-check-keeps-the-states-of-its-old-rule]]
[[plan-condition-must-not-narrow-a-spec-rule]]
